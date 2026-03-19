import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient, cleanData } from "../client.js";
import { formatRecurring } from "../formatters.js";

const RecurringItemSchema = z.object({
  article_number: z.string().optional().describe("Article number"),
  description: z.string().describe("Item description (required)"),
  quantity: z.number().optional().describe("Quantity"),
  unit: z.string().optional().describe("Unit"),
  unit_price: z.number().describe("Unit price (required)"),
  vat_percent: z.number().describe("VAT percentage (required)"),
  is_gross: z.number().optional().describe("Price is gross (1) or net (0)"),
  sort_order: z.number().optional().describe("Sort order"),
});

function mapItems(items: z.infer<typeof RecurringItemSchema>[]) {
  return items.map((i) => cleanData({ ARTICLE_NUMBER: i.article_number, DESCRIPTION: i.description, QUANTITY: i.quantity, UNIT: i.unit, UNIT_PRICE: i.unit_price, VAT_PERCENT: i.vat_percent, IS_GROSS: i.is_gross, SORT_ORDER: i.sort_order }));
}

export function registerRecurringTools(server: McpServer) {
  server.tool("recurring_get", "Get recurring invoices from Fastbill. Returns compact summary by default.", {
    invoice_id: z.string().optional().describe("Filter by recurring invoice ID"),
    limit: z.number().optional().describe("Max results (default 10, max 100)"),
    offset: z.number().optional().describe("Pagination offset"),
    detailed: z.boolean().optional().describe("Return full raw JSON (default false)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "recurring.get", FILTER: cleanData({ INVOICE_ID: params.invoice_id }), LIMIT: params.limit ?? 10, OFFSET: params.offset });
    const text = params.detailed ? JSON.stringify(result.RESPONSE, null, 2) : formatRecurring(result.RESPONSE);
    return { content: [{ type: "text", text }] };
  });

  server.tool("recurring_create", "Create a new recurring invoice in Fastbill.", {
    customer_id: z.string().describe("Customer ID (required)"),
    customer_costcenter_id: z.string().optional().describe("Cost center ID"),
    currency_code: z.string().optional().describe("Currency (e.g. EUR)"),
    template_id: z.string().optional().describe("Template ID"),
    template_hash: z.string().optional().describe("Template hash (permanent)"),
    introtext: z.string().optional().describe("Introduction text"),
    start_date: z.string().describe("Start date (YYYY-MM-DD, required)"),
    frequency: z.enum(["weekly", "2 weeks", "4 weeks", "monthly", "2 months", "3 months", "6 months", "yearly", "2 years"]).describe("Frequency (required)"),
    occurences: z.number().optional().describe("Number of occurrences (0 = unlimited)"),
    output_type: z.enum(["draft", "outgoing"]).describe("Output type: draft or outgoing (required)"),
    email_notify: z.number().optional().describe("Send email notification (0 or 1)"),
    delivery_date: z.string().optional().describe("Delivery date (YYYY-MM-DD)"),
    cash_discount_percent: z.string().optional().describe("Cash discount %"),
    cash_discount_days: z.number().optional().describe("Cash discount days"),
    vat_case: z.number().optional().describe("VAT case (0 or 1)"),
    items: z.array(RecurringItemSchema).describe("Line items (required)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({
      SERVICE: "recurring.create",
      DATA: cleanData({ CUSTOMER_ID: params.customer_id, CUSTOMER_COSTCENTER_ID: params.customer_costcenter_id, CURRENCY_CODE: params.currency_code, TEMPLATE_ID: params.template_id, TEMPLATE_HASH: params.template_hash, INTROTEXT: params.introtext, START_DATE: params.start_date, FREQUENCY: params.frequency, OCCURENCES: params.occurences, OUTPUT_TYPE: params.output_type, EMAIL_NOTIFY: params.email_notify, DELIVERY_DATE: params.delivery_date, CASH_DISCOUNT_PERCENT: params.cash_discount_percent, CASH_DISCOUNT_DAYS: params.cash_discount_days, VAT_CASE: params.vat_case, ITEMS: mapItems(params.items) }),
    });
    return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
  });

  server.tool("recurring_update", "Update a recurring invoice in Fastbill.", {
    invoice_id: z.string().describe("Recurring invoice ID (required)"),
    customer_id: z.string().optional().describe("Customer ID"),
    customer_costcenter_id: z.string().optional().describe("Cost center ID"),
    currency_code: z.string().optional().describe("Currency"),
    template_id: z.string().optional().describe("Template ID"),
    template_hash: z.string().optional().describe("Template hash"),
    introtext: z.string().optional().describe("Introduction text"),
    start_date: z.string().optional().describe("Start date (YYYY-MM-DD)"),
    frequency: z.enum(["weekly", "2 weeks", "4 weeks", "monthly", "2 months", "3 months", "6 months", "yearly", "2 years"]).optional().describe("Frequency"),
    occurences: z.number().optional().describe("Occurrences (0=unlimited)"),
    output_type: z.enum(["draft", "outgoing"]).optional().describe("Output type"),
    email_notify: z.number().optional().describe("Email notify (0/1)"),
    delivery_date: z.string().optional().describe("Delivery date"),
    cash_discount_percent: z.string().optional().describe("Cash discount %"),
    cash_discount_days: z.number().optional().describe("Cash discount days"),
    vat_case: z.number().optional().describe("VAT case"),
    delete_existing_items: z.number().optional().describe("Delete existing items (0/1)"),
    items: z.array(RecurringItemSchema).optional().describe("New line items"),
  }, async (params) => {
    const client = getClient();
    const data: Record<string, unknown> = cleanData({ INVOICE_ID: params.invoice_id, CUSTOMER_ID: params.customer_id, CUSTOMER_COSTCENTER_ID: params.customer_costcenter_id, CURRENCY_CODE: params.currency_code, TEMPLATE_ID: params.template_id, TEMPLATE_HASH: params.template_hash, INTROTEXT: params.introtext, START_DATE: params.start_date, FREQUENCY: params.frequency, OCCURENCES: params.occurences, OUTPUT_TYPE: params.output_type, EMAIL_NOTIFY: params.email_notify, DELIVERY_DATE: params.delivery_date, CASH_DISCOUNT_PERCENT: params.cash_discount_percent, CASH_DISCOUNT_DAYS: params.cash_discount_days, VAT_CASE: params.vat_case, DELETE_EXISTING_ITEMS: params.delete_existing_items });
    if (params.items) data.ITEMS = mapItems(params.items);
    const result = await client.request({ SERVICE: "recurring.update", DATA: data });
    return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
  });

  server.tool("recurring_delete", "Delete a recurring invoice from Fastbill.", {
    invoice_id: z.string().describe("Recurring invoice ID to delete (required)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "recurring.delete", DATA: { INVOICE_ID: params.invoice_id } });
    return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
  });
}
