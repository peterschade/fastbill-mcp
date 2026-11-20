import { z } from "zod";
import { lstat, mkdir, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, join, parse } from "node:path";
import { getClient, cleanData, todayISO, progressiveSearch } from "../client.js";
import { formatInvoices, sortByDateDesc, coverageNote } from "../formatters.js";
import { VAT_CASE_ENUM, SUBTYPE_ENUM, LineItemSchema, mapLineItems, documentDiscountParams, assertItemsWhenReplacing } from "./shared.js";
const subtypeParams = {
    subtype: SUBTYPE_ENUM.optional().describe("Invoice subtype: standard, progress_invoice (Abschlagsrechnung), final_invoice (Schlussrechnung). Must be progress_invoice or final_invoice when previous_invoice_id is set."),
    previous_invoice_id: z.string().optional().describe("ID of the preceding progress invoice in the chain ('0' = none). Customer, VAT case, gross flag and currency must match; omitted values are inherited."),
};
/** Expand a leading ~ and require an absolute path (the server's cwd is unpredictable, e.g. "/" under Claude Desktop). */
function resolveDir(dir) {
    const expanded = dir === "~" ? homedir() : dir.replace(/^~(?=[\/\\])/, homedir());
    if (!isAbsolute(expanded)) {
        throw new Error(`Target directory must be an absolute path (or start with ~): ${dir}`);
    }
    return expanded;
}
/** Target folder; isTemp marks the default temp folder, the only place where we restrict permissions. */
function pdfDir(targetDir) {
    if (targetDir)
        return { dir: resolveDir(targetDir), isTemp: false };
    const envDir = process.env.FASTBILL_PDF_DIR;
    if (envDir) {
        // Relative values in the config are resolved against the home folder (cwd is unpredictable).
        const expanded = envDir === "~" ? homedir() : envDir.replace(/^~(?=[\/\\])/, homedir());
        return { dir: isAbsolute(expanded) ? expanded : join(homedir(), expanded), isTemp: false };
    }
    return { dir: join(tmpdir(), "fastbill-pdf"), isTemp: true };
}
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
function safeFilename(name) {
    let base = name
        .replace(/[\/\\:*?"<>|\x00-\x1f]/g, "_")
        .trim()
        .replace(/^[.\s]+/, "")
        .replace(/[. ]+$/, "");
    if (base.toLowerCase().endsWith(".pdf"))
        base = base.slice(0, -4).replace(/[. ]+$/, "");
    if (!base)
        base = "rechnung";
    if (WINDOWS_RESERVED.test(base))
        base = `_${base}`;
    return `${base}.pdf`;
}
/** The shared temp folder must be a real directory owned by us and closed to others (not a symlink planted by someone else). */
async function assertPrivateDir(dir) {
    const st = await lstat(dir);
    if (!st.isDirectory() || st.isSymbolicLink()) {
        throw new Error(`${dir} is not a plain directory. Remove it or set FASTBILL_PDF_DIR.`);
    }
    if (process.platform === "win32")
        return; // no POSIX owner/mode; the Windows temp folder is per user
    if (typeof process.getuid === "function" && st.uid !== process.getuid()) {
        throw new Error(`${dir} belongs to another user. Remove it or set FASTBILL_PDF_DIR.`);
    }
    if ((st.mode & 0o077) !== 0) {
        throw new Error(`${dir} is accessible to other users (mode ${(st.mode & 0o777).toString(8)}). Run chmod 700 on it or set FASTBILL_PDF_DIR.`);
    }
}
/** Write without overwriting: name.pdf, name_2.pdf, name_3.pdf, ... */
async function writeNewFile(dir, filename, data, mode) {
    const { name, ext } = parse(filename);
    for (let n = 1; n <= 100; n++) {
        const filePath = join(dir, n === 1 ? filename : `${name}_${n}${ext}`);
        try {
            await writeFile(filePath, data, mode === undefined ? { flag: "wx" } : { flag: "wx", mode });
            return filePath;
        }
        catch (err) {
            if (err.code !== "EEXIST")
                throw err;
        }
    }
    throw new Error(`Too many files named ${filename} in ${dir}`);
}
export function registerInvoiceTools(server) {
    server.tool("invoice_get", "Get invoices from Fastbill. FastBill cannot sort: it returns the OLDEST entries of the range first, and limit cuts off the newest. The tool only re-sorts the returned page newest first. For the latest entries narrow the date range instead of using limit. IMPORTANT: Always set start_date and end_date! Without date filters the API returns random invoices from all time. For 'latest invoices' use the current month or last 3 months as range. For 'all invoices' use a full year range. Max 100 per request — use offset for pagination.", {
        invoice_id: z.string().optional().describe("Filter by invoice ID"),
        invoice_number: z.string().optional().describe("Filter by invoice number"),
        invoice_title: z.string().optional().describe("Filter by invoice title"),
        customer_id: z.string().optional().describe("Filter by customer ID"),
        type: z
            .enum(["outgoing", "draft", "credit"])
            .optional()
            .describe("Filter by type: outgoing, draft, or credit (note)"),
        subtype: SUBTYPE_ENUM.optional().describe("Filter by subtype"),
        state: z
            .enum(["unpaid", "overdue", "paid", "canceled", "issued"])
            .optional()
            .describe("Filter by state. Invoices: unpaid, overdue, paid, canceled. Credit notes: issued, canceled"),
        is_gross: z.number().optional().describe("Filter by gross flag (1 = unit prices are gross, 0 = net)"),
        start_due_date: z.string().optional().describe("Due date from (YYYY-MM-DD)"),
        end_due_date: z.string().optional().describe("Due date until (YYYY-MM-DD)"),
        start_paid_date: z.string().optional().describe("Paid date from (YYYY-MM-DD)"),
        end_paid_date: z.string().optional().describe("Paid date until (YYYY-MM-DD)"),
        start_date: z.string().optional().describe("Invoice date from (YYYY-MM-DD). ALWAYS SET THIS — otherwise random results!"),
        end_date: z.string().optional().describe("Invoice date until (YYYY-MM-DD). ALWAYS SET THIS — otherwise random results!"),
        start_lastupdate: z.string().optional().describe("Last update from (YYYY-MM-DD)"),
        end_lastupdate: z.string().optional().describe("Last update until (YYYY-MM-DD)"),
        limit: z.number().optional().describe("Max results (max 100). Cuts off the NEWEST entries, because FastBill returns oldest first — prefer a narrower date range"),
        offset: z.number().optional().describe("Pagination offset for fetching more results beyond 100"),
        detailed: z.boolean().optional().describe("Return full raw JSON instead of compact summary (default false)"),
    }, async (params) => {
        const client = getClient();
        const today = todayISO();
        let startDate = params.start_date;
        let endDate = params.end_date;
        let response;
        const hasSpecificFilter = params.invoice_id || params.invoice_number || startDate || endDate
            || params.start_due_date || params.end_due_date || params.start_paid_date || params.end_paid_date
            || params.start_lastupdate || params.end_lastupdate;
        if (hasSpecificFilter) {
            const result = await client.request({
                SERVICE: "invoice.get",
                FILTER: cleanData({
                    INVOICE_ID: params.invoice_id, INVOICE_NUMBER: params.invoice_number, INVOICE_TITLE: params.invoice_title,
                    CUSTOMER_ID: params.customer_id, TYPE: params.type, SUBTYPE: params.subtype,
                    STATE: params.state, IS_GROSS: params.is_gross,
                    START_DUE_DATE: params.start_due_date, END_DUE_DATE: params.end_due_date,
                    START_PAID_DATE: params.start_paid_date, END_PAID_DATE: params.end_paid_date,
                    START_DATE: startDate, END_DATE: endDate,
                    START_LASTUPDATE: params.start_lastupdate, END_LASTUPDATE: params.end_lastupdate,
                }),
                LIMIT: params.limit ?? 100, OFFSET: params.offset,
            });
            response = result.RESPONSE;
        }
        else {
            const search = await progressiveSearch(client, "invoice.get", cleanData({
                INVOICE_TITLE: params.invoice_title, CUSTOMER_ID: params.customer_id, TYPE: params.type,
                SUBTYPE: params.subtype, STATE: params.state, IS_GROSS: params.is_gross,
            }), "INVOICES", params.limit ?? 100, params.offset);
            response = search.response;
            startDate = search.startDate;
            endDate = search.endDate;
        }
        if (Array.isArray(response.INVOICES)) {
            response.INVOICES = sortByDateDesc(response.INVOICES, "INVOICE_DATE");
        }
        const dateInfo = (startDate && endDate ? `\nAbgefragt: ${startDate} bis ${endDate}` : "")
            + coverageNote(response.INVOICES, "INVOICE_DATE", params.limit ?? 100, params.offset);
        const text = params.detailed
            ? JSON.stringify(response, null, 2)
            : `Heute: ${today}\n` + formatInvoices(response) + dateInfo;
        return { content: [{ type: "text", text }] };
    });
    server.tool("invoice_create", "Create a new invoice in Fastbill. Requires customer_id and at least one item with description, unit_price, and vat_percent.", {
        customer_id: z.string().describe("Customer ID (required)"),
        customer_costcenter_id: z.string().optional().describe("Cost center ID"),
        contact_id: z.string().optional().describe("Contact ID"),
        currency_code: z.string().optional().describe("Currency (e.g. EUR)"),
        template_id: z.string().optional().describe("Template ID (changes when template is modified!)"),
        template_hash: z.string().optional().describe("Template hash (permanent, preferred over template_id)"),
        introtext: z.string().optional().describe("Introduction text on the invoice"),
        invoice_title: z.string().optional().describe("Invoice title"),
        invoice_date: z.string().optional().describe("Invoice date (YYYY-MM-DD)"),
        delivery_date: z.string().optional().describe("Delivery date (YYYY-MM-DD)"),
        service_period_start: z.string().optional().describe("Service period start (YYYY-MM-DD)"),
        service_period_end: z.string().optional().describe("Service period end (YYYY-MM-DD)"),
        cash_discount_percent: z.string().optional().describe("Cash discount percentage"),
        cash_discount_days: z.number().optional().describe("Days for cash discount"),
        vat_case: VAT_CASE_ENUM.optional().describe("VAT case"),
        is_gross: z.number().optional().describe("Prices are gross (1) or net (0)"),
        customer_accounting_note: z.string().min(1).optional().describe("Internal accounting note for the customer"),
        contract_reference: z.string().min(1).optional().describe("Contract reference number"),
        customer_order_reference: z.string().min(1).optional().describe("Customer's order reference number"),
        order_reference: z.string().min(1).optional().describe("Internal order reference number"),
        ...documentDiscountParams,
        ...subtypeParams,
        items: z.array(LineItemSchema).min(1).describe("Invoice line items (required, at least one)"),
    }, async (params) => {
        const client = getClient();
        const result = await client.request({
            SERVICE: "invoice.create",
            DATA: cleanData({
                CUSTOMER_ID: params.customer_id,
                CUSTOMER_COSTCENTER_ID: params.customer_costcenter_id,
                CONTACT_ID: params.contact_id,
                CURRENCY_CODE: params.currency_code,
                TEMPLATE_ID: params.template_id,
                TEMPLATE_HASH: params.template_hash,
                INTROTEXT: params.introtext,
                INVOICE_TITLE: params.invoice_title,
                INVOICE_DATE: params.invoice_date,
                DELIVERY_DATE: params.delivery_date,
                SERVICE_PERIOD_START: params.service_period_start,
                SERVICE_PERIOD_END: params.service_period_end,
                CASH_DISCOUNT_PERCENT: params.cash_discount_percent,
                CASH_DISCOUNT_DAYS: params.cash_discount_days,
                VAT_CASE: params.vat_case,
                IS_GROSS: params.is_gross,
                CUSTOMER_ACCOUNTING_NOTE: params.customer_accounting_note,
                CONTRACT_REFERENCE: params.contract_reference,
                CUSTOMER_ORDER_REFERENCE: params.customer_order_reference,
                ORDER_REFERENCE: params.order_reference,
                DISCOUNT_PERCENT: params.discount_percent,
                DISCOUNT_AMOUNT: params.discount_amount,
                SUBTYPE: params.subtype,
                PREVIOUS_INVOICE_ID: params.previous_invoice_id,
                ITEMS: mapLineItems(params.items),
            }),
        });
        return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    });
    server.tool("invoice_update", "Update an existing invoice in Fastbill. Can update fields and/or replace items.", {
        invoice_id: z.string().describe("Invoice ID to update (required)"),
        customer_id: z.string().optional().describe("Customer ID"),
        customer_costcenter_id: z.string().optional().describe("Cost center ID"),
        contact_id: z.string().optional().describe("Contact ID"),
        currency_code: z.string().optional().describe("Currency code"),
        template_id: z.string().optional().describe("Template ID"),
        template_hash: z.string().optional().describe("Template hash"),
        introtext: z.string().optional().describe("Introduction text"),
        invoice_title: z.string().optional().describe("Invoice title"),
        invoice_date: z.string().optional().describe("Invoice date (YYYY-MM-DD)"),
        delivery_date: z.string().optional().describe("Delivery date (YYYY-MM-DD)"),
        service_period_start: z.string().optional().describe("Service period start"),
        service_period_end: z.string().optional().describe("Service period end"),
        cash_discount_percent: z.string().optional().describe("Cash discount %"),
        cash_discount_days: z.number().optional().describe("Cash discount days"),
        vat_case: VAT_CASE_ENUM.optional().describe("VAT case"),
        is_gross: z.number().optional().describe("Prices gross (1) or net (0)"),
        customer_accounting_note: z.string().min(1).optional().describe("Internal accounting note for the customer"),
        contract_reference: z.string().min(1).optional().describe("Contract reference number"),
        customer_order_reference: z.string().min(1).optional().describe("Customer's order reference number"),
        order_reference: z.string().min(1).optional().describe("Internal order reference number"),
        ...documentDiscountParams,
        ...subtypeParams,
        delete_existing_items: z.number().optional().describe("Delete existing items before adding new ones (0 or 1). With 1, items must not be empty."),
        items: z.array(LineItemSchema).optional().describe("New/updated line items"),
    }, async (params) => {
        const client = getClient();
        const data = cleanData({
            INVOICE_ID: params.invoice_id,
            CUSTOMER_ID: params.customer_id,
            CUSTOMER_COSTCENTER_ID: params.customer_costcenter_id,
            CONTACT_ID: params.contact_id,
            CURRENCY_CODE: params.currency_code,
            TEMPLATE_ID: params.template_id,
            TEMPLATE_HASH: params.template_hash,
            INTROTEXT: params.introtext,
            INVOICE_TITLE: params.invoice_title,
            INVOICE_DATE: params.invoice_date,
            DELIVERY_DATE: params.delivery_date,
            SERVICE_PERIOD_START: params.service_period_start,
            SERVICE_PERIOD_END: params.service_period_end,
            CASH_DISCOUNT_PERCENT: params.cash_discount_percent,
            CASH_DISCOUNT_DAYS: params.cash_discount_days,
            VAT_CASE: params.vat_case,
            IS_GROSS: params.is_gross,
            CUSTOMER_ACCOUNTING_NOTE: params.customer_accounting_note,
            CONTRACT_REFERENCE: params.contract_reference,
            CUSTOMER_ORDER_REFERENCE: params.customer_order_reference,
            ORDER_REFERENCE: params.order_reference,
            DISCOUNT_PERCENT: params.discount_percent,
            DISCOUNT_AMOUNT: params.discount_amount,
            SUBTYPE: params.subtype,
            PREVIOUS_INVOICE_ID: params.previous_invoice_id,
            DELETE_EXISTING_ITEMS: params.delete_existing_items,
        });
        assertItemsWhenReplacing(params.delete_existing_items, params.items);
        if (params.items && params.items.length > 0)
            data.ITEMS = mapLineItems(params.items);
        const result = await client.request({ SERVICE: "invoice.update", DATA: data });
        return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    });
    server.tool("invoice_delete", "Delete an invoice from Fastbill.", {
        invoice_id: z.string().describe("Invoice ID to delete (required)"),
    }, async (params) => {
        const client = getClient();
        const result = await client.request({ SERVICE: "invoice.delete", DATA: { INVOICE_ID: params.invoice_id } });
        return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    });
    server.tool("invoice_complete", "Complete/finalize a draft invoice. Assigns an invoice number.", {
        invoice_id: z.string().describe("Invoice ID to complete (required)"),
    }, async (params) => {
        const client = getClient();
        const result = await client.request({ SERVICE: "invoice.complete", DATA: { INVOICE_ID: params.invoice_id } });
        return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    });
    server.tool("invoice_cancel", "Cancel an invoice by creating a cancellation invoice (Stornorechnung). Full cancellation by default. For a partial cancellation set partial_cancellation=1 and give item_text, net_amount and vat_percent. Once an invoice has a partial cancellation, only further partial cancellations are allowed; when they cover the full open amount, the invoice counts as cancelled.", {
        invoice_id: z.string().describe("Invoice ID to cancel (required)"),
        partial_cancellation: z.union([z.literal(0), z.literal(1)]).optional().describe("0 = full cancellation (default), 1 = partial cancellation"),
        item_text: z.string().optional().describe("Item text on the cancellation invoice (required for partial cancellation)"),
        net_amount: z.number().optional().describe("Net amount to cancel (required for partial cancellation)"),
        vat_percent: z.number().optional().describe("VAT percentage (required for partial cancellation)"),
    }, async (params) => {
        const partialFields = [params.item_text, params.net_amount, params.vat_percent];
        if (params.partial_cancellation === 1 && partialFields.some((v) => v === undefined)) {
            return {
                content: [{ type: "text", text: "Teilstorno braucht item_text, net_amount und vat_percent." }],
                isError: true,
            };
        }
        if (params.partial_cancellation !== 1 && partialFields.some((v) => v !== undefined)) {
            return {
                content: [{ type: "text", text: "item_text, net_amount und vat_percent gibt es nur beim Teilstorno (partial_cancellation=1). Für eine Vollstornierung weglassen." }],
                isError: true,
            };
        }
        const client = getClient();
        const result = await client.request({
            SERVICE: "invoice.cancel",
            DATA: cleanData({
                INVOICE_ID: params.invoice_id,
                PARTIAL_CANCELLATION: params.partial_cancellation,
                ITEM_TEXT: params.item_text,
                NET_AMOUNT: params.net_amount,
                VAT_PERCENT: params.vat_percent,
            }),
        });
        return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    });
    server.tool("invoice_lock", "Lock an invoice to prevent further changes.", {
        invoice_id: z.string().describe("Invoice ID to lock (required)"),
    }, async (params) => {
        const client = getClient();
        const result = await client.request({ SERVICE: "invoice.lock", DATA: { INVOICE_ID: params.invoice_id } });
        return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    });
    server.tool("invoice_sendbyemail", "Send an invoice via email through Fastbill.", {
        invoice_id: z.string().describe("Invoice ID to send (required)"),
        recipient_to: z.string().describe("Primary recipient email (required)"),
        recipient_cc: z.string().optional().describe("CC email address"),
        recipient_bcc: z.string().optional().describe("BCC email address"),
        subject: z.string().optional().describe("Email subject line"),
        message: z.string().optional().describe("Email body message"),
        receipt_confirmation: z.number().optional().describe("Request read receipt (0 or 1)"),
    }, async (params) => {
        const client = getClient();
        const recipient = { TO: params.recipient_to };
        if (params.recipient_cc)
            recipient.CC = params.recipient_cc;
        if (params.recipient_bcc)
            recipient.BCC = params.recipient_bcc;
        const result = await client.request({
            SERVICE: "invoice.sendbyemail",
            DATA: cleanData({ INVOICE_ID: params.invoice_id, RECIPIENT: recipient, SUBJECT: params.subject, MESSAGE: params.message, RECEIPT_CONFIRMATION: params.receipt_confirmation }),
        });
        return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    });
    server.tool("invoice_sendbypost", "Send an invoice via postal mail (uses letter credits).", {
        invoice_id: z.string().describe("Invoice ID to send by post (required)"),
    }, async (params) => {
        const client = getClient();
        const result = await client.request({ SERVICE: "invoice.sendbypost", DATA: { INVOICE_ID: params.invoice_id } });
        return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    });
    server.tool("invoice_setpaid", "Mark an invoice as paid.", {
        invoice_id: z.string().describe("Invoice ID to mark as paid (required)"),
        paid_date: z.string().optional().describe("Payment date (YYYY-MM-DD, defaults to today)"),
        payment_method: z.string().optional().describe("Payment method (e.g. paypal, cash, bank_transfer)"),
    }, async (params) => {
        const client = getClient();
        const result = await client.request({
            SERVICE: "invoice.setpaid",
            DATA: cleanData({ INVOICE_ID: params.invoice_id, PAID_DATE: params.paid_date, PAYMENT_METHOD: params.payment_method }),
        });
        return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    });
    server.tool("invoice_download_pdf", "Download the PDF of a completed invoice from Fastbill and save it locally (default: FASTBILL_PDF_DIR, otherwise <system temp>/fastbill-pdf). Identify the invoice by invoice_id or invoice_number. Never overwrites: an existing file gets a _2, _3, ... suffix. Returns the local file path, e.g. for attaching it to an email. Drafts are refused.", {
        invoice_id: z.string().optional().describe("Invoice ID (either this or invoice_number)"),
        invoice_number: z.string().optional().describe("Invoice number (either this or invoice_id)"),
        filename: z.string().optional().describe("Target file name (default: Rechnung_<number>.pdf)"),
        target_dir: z.string().optional().describe("Absolute target directory, ~ allowed (default: FASTBILL_PDF_DIR, otherwise <system temp>/fastbill-pdf)"),
    }, async (params) => {
        if (!params.invoice_id && !params.invoice_number) {
            throw new Error("invoice_id or invoice_number is required");
        }
        const { dir, isTemp } = pdfDir(params.target_dir);
        const client = getClient();
        // Never trust the filter blindly: only accept exact matches on what was asked for.
        const isMatch = (inv) => (!params.invoice_id || String(inv.INVOICE_ID) === params.invoice_id)
            && (!params.invoice_number || String(inv.INVOICE_NUMBER) === params.invoice_number);
        // The ID filter is exact. Without a date range the number filter is unreliable, so widen the range step by step.
        const windows = params.invoice_id ? [undefined] : [undefined, 90, 365, 3 * 365, 10 * 365];
        let matches = [];
        for (const days of windows) {
            const range = {};
            if (days) {
                const start = new Date();
                start.setDate(start.getDate() - days);
                range.START_DATE = start.toISOString().split("T")[0];
                range.END_DATE = todayISO();
            }
            const result = await client.request({
                SERVICE: "invoice.get",
                FILTER: cleanData({ INVOICE_ID: params.invoice_id, INVOICE_NUMBER: params.invoice_number, ...range }),
                LIMIT: 100,
            });
            const invoices = Array.isArray(result.RESPONSE.INVOICES)
                ? result.RESPONSE.INVOICES
                : [];
            matches = [...new Map(invoices.filter(isMatch).map((inv) => [String(inv.INVOICE_ID), inv])).values()];
            if (matches.length > 0)
                break;
        }
        if (matches.length === 0) {
            throw new Error(`Invoice not found: ${params.invoice_id ?? params.invoice_number}`);
        }
        if (matches.length > 1) {
            const ids = matches.map((inv) => `${inv.INVOICE_ID} (${inv.TYPE})`).join(", ");
            throw new Error(`Invoice number ${params.invoice_number} is ambiguous: ${ids}. Use invoice_id.`);
        }
        const invoice = matches[0];
        if (invoice.TYPE === "draft" || invoice.STATE === "draft") {
            throw new Error(`Invoice ${invoice.INVOICE_ID} is a draft. Complete it first (invoice_complete).`);
        }
        const documentUrl = invoice.DOCUMENT_URL ? String(invoice.DOCUMENT_URL) : "";
        if (!documentUrl) {
            throw new Error(`Invoice ${invoice.INVOICE_ID} has no PDF (DOCUMENT_URL empty).`);
        }
        const pdf = await client.downloadPdf(documentUrl);
        const number = invoice.INVOICE_NUMBER ? String(invoice.INVOICE_NUMBER) : `ID_${invoice.INVOICE_ID}`;
        // Only in the shared temp folder restrict access to the user; elsewhere keep the folder's defaults.
        await mkdir(dir, isTemp ? { recursive: true, mode: 0o700 } : { recursive: true });
        if (isTemp)
            await assertPrivateDir(dir);
        const filePath = await writeNewFile(dir, safeFilename(params.filename ?? `Rechnung_${number}`), pdf, isTemp ? 0o600 : undefined);
        const text = [
            `PDF gespeichert: ${filePath}`,
            `Rechnung: ${number} (ID ${invoice.INVOICE_ID})`,
            `Größe: ${(pdf.length / 1024).toFixed(1)} KB`,
        ].join("\n");
        return { content: [{ type: "text", text }] };
    });
}
//# sourceMappingURL=invoice.js.map