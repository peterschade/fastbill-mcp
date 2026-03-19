import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient, cleanData, todayISO, progressiveSearch } from "../client.js";
import { formatInvoices, sortByDateDesc } from "../formatters.js";

const InvoiceItemSchema = z.object({
  article_number: z.string().optional().describe("Article/product number"),
  description: z.string().describe("Item description (required)"),
  quantity: z.number().optional().describe("Quantity (default 1)"),
  unit: z.string().optional().describe("Unit (e.g. Stück, Stunde, Pauschal)"),
  unit_price: z.number().describe("Unit price (required)"),
  vat_percent: z.number().describe("VAT percentage, e.g. 19 (required)"),
  is_gross: z.number().optional().describe("Price is gross (1) or net (0)"),
  sort_order: z.number().optional().describe("Sort order of item"),
});

function mapItems(items: z.infer<typeof InvoiceItemSchema>[]) {
  return items.map((item) =>
    cleanData({
      ARTICLE_NUMBER: item.article_number,
      DESCRIPTION: item.description,
      QUANTITY: item.quantity,
      UNIT: item.unit,
      UNIT_PRICE: item.unit_price,
      VAT_PERCENT: item.vat_percent,
      IS_GROSS: item.is_gross,
      SORT_ORDER: item.sort_order,
    })
  );
}

export function registerInvoiceTools(server: McpServer) {
  server.tool(
    "invoice_get",
    "Get invoices from Fastbill, sorted by date (newest first). IMPORTANT: Always set start_date and end_date! Without date filters the API returns random invoices from all time. For 'latest invoices' use the current month or last 3 months as range. For 'all invoices' use a full year range. Max 100 per request — use offset for pagination.",
    {
      invoice_id: z.string().optional().describe("Filter by invoice ID"),
      invoice_number: z.string().optional().describe("Filter by invoice number"),
      invoice_title: z.string().optional().describe("Filter by invoice title"),
      customer_id: z.string().optional().describe("Filter by customer ID"),
      type: z
        .enum(["outgoing", "draft", "credit"])
        .optional()
        .describe("Filter by type: outgoing, draft, or credit (note)"),
      start_due_date: z.string().optional().describe("Due date from (YYYY-MM-DD)"),
      end_due_date: z.string().optional().describe("Due date until (YYYY-MM-DD)"),
      start_paid_date: z.string().optional().describe("Paid date from (YYYY-MM-DD)"),
      end_paid_date: z.string().optional().describe("Paid date until (YYYY-MM-DD)"),
      start_date: z.string().optional().describe("Invoice date from (YYYY-MM-DD). ALWAYS SET THIS — otherwise random results!"),
      end_date: z.string().optional().describe("Invoice date until (YYYY-MM-DD). ALWAYS SET THIS — otherwise random results!"),
      start_lastupdate: z.string().optional().describe("Last update from (YYYY-MM-DD)"),
      end_lastupdate: z.string().optional().describe("Last update until (YYYY-MM-DD)"),
      limit: z.number().optional().describe("Max results per request (max 100)"),
      offset: z.number().optional().describe("Pagination offset for fetching more results beyond 100"),
      detailed: z.boolean().optional().describe("Return full raw JSON instead of compact summary (default false)"),
    },
    async (params) => {
      const client = getClient();
      const today = todayISO();
      let startDate = params.start_date;
      let endDate = params.end_date;
      let response: Record<string, unknown>;

      const hasSpecificFilter = params.invoice_id || params.invoice_number || startDate || endDate
        || params.start_due_date || params.end_due_date || params.start_paid_date || params.end_paid_date
        || params.start_lastupdate || params.end_lastupdate;

      if (hasSpecificFilter) {
        const result = await client.request({
          SERVICE: "invoice.get",
          FILTER: cleanData({
            INVOICE_ID: params.invoice_id, INVOICE_NUMBER: params.invoice_number, INVOICE_TITLE: params.invoice_title,
            CUSTOMER_ID: params.customer_id, TYPE: params.type,
            START_DUE_DATE: params.start_due_date, END_DUE_DATE: params.end_due_date,
            START_PAID_DATE: params.start_paid_date, END_PAID_DATE: params.end_paid_date,
            START_DATE: startDate, END_DATE: endDate,
            START_LASTUPDATE: params.start_lastupdate, END_LASTUPDATE: params.end_lastupdate,
          }),
          LIMIT: params.limit ?? 100, OFFSET: params.offset,
        });
        response = result.RESPONSE;
      } else {
        const search = await progressiveSearch(client, "invoice.get",
          cleanData({ INVOICE_TITLE: params.invoice_title, CUSTOMER_ID: params.customer_id, TYPE: params.type }),
          "INVOICES", params.limit ?? 100, params.offset);
        response = search.response;
        startDate = search.startDate;
        endDate = search.endDate;
      }

      if (Array.isArray(response.INVOICES)) {
        response.INVOICES = sortByDateDesc(response.INVOICES as Record<string, unknown>[], "INVOICE_DATE");
      }

      const dateInfo = startDate && endDate ? `\nZeitraum: ${startDate} bis ${endDate}` : "";
      const text = params.detailed
        ? JSON.stringify(response, null, 2)
        : `Heute: ${today}\n` + formatInvoices(response) + dateInfo;
      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "invoice_create",
    "Create a new invoice in Fastbill. Requires customer_id and at least one item with description, unit_price, and vat_percent.",
    {
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
      vat_case: z.number().optional().describe("VAT case: 1 for reverse charge, 0 for normal"),
      is_gross: z.number().optional().describe("Prices are gross (1) or net (0)"),
      items: z.array(InvoiceItemSchema).describe("Invoice line items (required, at least one)"),
    },
    async (params) => {
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
          ITEMS: mapItems(params.items),
        }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    }
  );

  server.tool(
    "invoice_update",
    "Update an existing invoice in Fastbill. Can update fields and/or replace items.",
    {
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
      vat_case: z.number().optional().describe("VAT case (0 or 1)"),
      is_gross: z.number().optional().describe("Prices gross (1) or net (0)"),
      delete_existing_items: z.number().optional().describe("Delete existing items before adding new ones (0 or 1)"),
      items: z.array(InvoiceItemSchema).optional().describe("New/updated line items"),
    },
    async (params) => {
      const client = getClient();
      const data: Record<string, unknown> = cleanData({
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
        DELETE_EXISTING_ITEMS: params.delete_existing_items,
      });
      if (params.items) data.ITEMS = mapItems(params.items);
      const result = await client.request({ SERVICE: "invoice.update", DATA: data });
      return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    }
  );

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

  server.tool("invoice_cancel", "Cancel an invoice (creates a credit note).", {
    invoice_id: z.string().describe("Invoice ID to cancel (required)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "invoice.cancel", DATA: { INVOICE_ID: params.invoice_id } });
    return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
  });

  server.tool("invoice_lock", "Lock an invoice to prevent further changes.", {
    invoice_id: z.string().describe("Invoice ID to lock (required)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "invoice.lock", DATA: { INVOICE_ID: params.invoice_id } });
    return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
  });

  server.tool(
    "invoice_sendbyemail",
    "Send an invoice via email through Fastbill.",
    {
      invoice_id: z.string().describe("Invoice ID to send (required)"),
      recipient_to: z.string().describe("Primary recipient email (required)"),
      recipient_cc: z.string().optional().describe("CC email address"),
      recipient_bcc: z.string().optional().describe("BCC email address"),
      subject: z.string().optional().describe("Email subject line"),
      message: z.string().optional().describe("Email body message"),
      receipt_confirmation: z.number().optional().describe("Request read receipt (0 or 1)"),
    },
    async (params) => {
      const client = getClient();
      const recipient: Record<string, string> = { TO: params.recipient_to };
      if (params.recipient_cc) recipient.CC = params.recipient_cc;
      if (params.recipient_bcc) recipient.BCC = params.recipient_bcc;
      const result = await client.request({
        SERVICE: "invoice.sendbyemail",
        DATA: cleanData({ INVOICE_ID: params.invoice_id, RECIPIENT: recipient, SUBJECT: params.subject, MESSAGE: params.message, RECEIPT_CONFIRMATION: params.receipt_confirmation }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    }
  );

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
}
