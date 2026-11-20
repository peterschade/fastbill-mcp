import { z } from "zod";
import { getClient, cleanData, todayISO, progressiveSearch } from "../client.js";
import { formatRevenues, sortByDateDesc, coverageNote } from "../formatters.js";
const RevenueItemSchema = z.object({
    description: z.string().describe("Item description"),
    quantity: z.number().optional().describe("Quantity"),
    unit_price: z.number().describe("Unit price"),
    vat_percent: z.number().describe("VAT percentage"),
    sort_order: z.number().optional().describe("Sort order"),
});
export function registerRevenueTools(server) {
    server.tool("revenue_get", "Get revenues from Fastbill. FastBill cannot sort: it returns the OLDEST entries of the range first, and limit cuts off the newest. The tool only re-sorts the returned page newest first. For the latest entries narrow the date range instead of using limit. ALWAYS set start_date/end_date — without them the API returns random results.", {
        invoice_id: z.string().optional().describe("Filter by revenue ID"),
        invoice_number: z.string().optional().describe("Filter by invoice number"),
        invoice_title: z.string().optional().describe("Filter by title"),
        customer_id: z.string().optional().describe("Filter by customer ID"),
        type: z.enum(["outgoing", "draft", "credit"]).optional().describe("Filter by type"),
        start_due_date: z.string().optional().describe("Due from (YYYY-MM-DD)"),
        end_due_date: z.string().optional().describe("Due until (YYYY-MM-DD)"),
        start_paid_date: z.string().optional().describe("Paid from (YYYY-MM-DD)"),
        end_paid_date: z.string().optional().describe("Paid until (YYYY-MM-DD)"),
        start_date: z.string().optional().describe("Date from (YYYY-MM-DD). ALWAYS SET!"),
        end_date: z.string().optional().describe("Date until (YYYY-MM-DD). ALWAYS SET!"),
        start_lastupdate: z.string().optional().describe("Last update from (YYYY-MM-DD)"),
        end_lastupdate: z.string().optional().describe("Last update until (YYYY-MM-DD)"),
        limit: z.number().optional().describe("Max results (max 100). Cuts off the NEWEST entries, because FastBill returns oldest first — prefer a narrower date range"),
        offset: z.number().optional().describe("Pagination offset"),
        detailed: z.boolean().optional().describe("Return full raw JSON (default false)"),
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
                SERVICE: "revenue.get",
                FILTER: cleanData({ INVOICE_ID: params.invoice_id, INVOICE_NUMBER: params.invoice_number, INVOICE_TITLE: params.invoice_title, CUSTOMER_ID: params.customer_id, TYPE: params.type, START_DUE_DATE: params.start_due_date, END_DUE_DATE: params.end_due_date, START_PAID_DATE: params.start_paid_date, END_PAID_DATE: params.end_paid_date, START_DATE: startDate, END_DATE: endDate, START_LASTUPDATE: params.start_lastupdate, END_LASTUPDATE: params.end_lastupdate }),
                LIMIT: params.limit ?? 100, OFFSET: params.offset,
            });
            response = result.RESPONSE;
        }
        else {
            const search = await progressiveSearch(client, "revenue.get", cleanData({ INVOICE_TITLE: params.invoice_title, CUSTOMER_ID: params.customer_id, TYPE: params.type }), "INVOICES", params.limit ?? 100, params.offset);
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
            : `Heute: ${today}\n` + formatRevenues(response) + dateInfo;
        return { content: [{ type: "text", text }] };
    });
    server.tool("revenue_create", "Create a revenue entry in Fastbill.", {
        invoice_date: z.string().describe("Invoice date (YYYY-MM-DD, required)"),
        due_date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
        customer_id: z.string().describe("Customer ID (required)"),
        project_id: z.string().optional().describe("Project ID"),
        invoice_number: z.string().optional().describe("External invoice number"),
        comment: z.string().optional().describe("Comment"),
        sub_total: z.number().describe("Net amount (required)"),
        vat_total: z.number().optional().describe("VAT amount"),
        currency_code: z.string().optional().describe("Currency (e.g. EUR)"),
        items: z.array(RevenueItemSchema).optional().describe("Revenue line items (item fields are not documented by Fastbill; modeled after invoice items)"),
    }, async (params) => {
        const client = getClient();
        const items = params.items?.map((i) => cleanData({ DESCRIPTION: i.description, QUANTITY: i.quantity, UNIT_PRICE: i.unit_price, VAT_PERCENT: i.vat_percent, SORT_ORDER: i.sort_order }));
        const data = cleanData({ INVOICE_DATE: params.invoice_date, DUE_DATE: params.due_date, CUSTOMER_ID: params.customer_id, PROJECT_ID: params.project_id, INVOICE_NUMBER: params.invoice_number, COMMENT: params.comment, SUB_TOTAL: params.sub_total, VAT_TOTAL: params.vat_total, CURRENCY_CODE: params.currency_code });
        if (items && items.length > 0)
            data.ITEMS = items;
        const result = await client.request({ SERVICE: "revenue.create", DATA: data });
        return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    });
    server.tool("revenue_setpaid", "Mark a revenue entry as paid.", {
        invoice_id: z.string().describe("Revenue/invoice ID (required)"),
        paid_date: z.string().optional().describe("Payment date (YYYY-MM-DD)"),
    }, async (params) => {
        const client = getClient();
        const result = await client.request({ SERVICE: "revenue.setpaid", DATA: cleanData({ INVOICE_ID: params.invoice_id, PAID_DATE: params.paid_date }) });
        return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    });
    server.tool("revenue_delete", "Delete a revenue entry from Fastbill.", {
        invoice_id: z.string().describe("Revenue/invoice ID to delete (required)"),
    }, async (params) => {
        const client = getClient();
        const result = await client.request({ SERVICE: "revenue.delete", DATA: { INVOICE_ID: params.invoice_id } });
        return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    });
}
//# sourceMappingURL=revenue.js.map