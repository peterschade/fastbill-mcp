import { z } from "zod";
import { getClient, cleanData } from "../client.js";
import { formatRecurring } from "../formatters.js";
import { VAT_CASE_ENUM, LineItemSchema, mapLineItems, documentDiscountParams, assertItemsWhenReplacing } from "./shared.js";
export function registerRecurringTools(server) {
    server.tool("recurring_get", "Get recurring invoices from Fastbill. Returns compact summary by default.", {
        invoice_id: z.string().optional().describe("Filter by recurring invoice ID"),
        is_gross: z.number().optional().describe("Filter by gross flag (1 = unit prices are gross, 0 = net)"),
        limit: z.number().optional().describe("Max results (default 10, max 100)"),
        offset: z.number().optional().describe("Pagination offset"),
        detailed: z.boolean().optional().describe("Return full raw JSON (default false)"),
    }, async (params) => {
        const client = getClient();
        const result = await client.request({ SERVICE: "recurring.get", FILTER: cleanData({ INVOICE_ID: params.invoice_id, IS_GROSS: params.is_gross }), LIMIT: params.limit ?? 10, OFFSET: params.offset });
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
        frequency: z.enum(["weekly", "2 weeks", "4 weeks", "monthly", "2 months", "3 months", "6 months", "yearly"]).describe("Frequency (required)"),
        occurences: z.number().optional().describe("Number of occurrences (0 = unlimited)"),
        output_type: z.enum(["draft", "outgoing"]).describe("Output type: draft or outgoing (required)"),
        email_notify: z.number().optional().describe("Send email notification (0 or 1)"),
        delivery_date: z.string().optional().describe("Delivery date (YYYY-MM-DD)"),
        cash_discount_percent: z.string().optional().describe("Cash discount %"),
        cash_discount_days: z.number().optional().describe("Cash discount days"),
        vat_case: VAT_CASE_ENUM.optional().describe("VAT case"),
        is_gross: z.number().optional().describe("Prices gross (1) or net (0)"),
        ...documentDiscountParams,
        items: z.array(LineItemSchema).min(1).describe("Line items (required)"),
    }, async (params) => {
        const client = getClient();
        const result = await client.request({
            SERVICE: "recurring.create",
            DATA: cleanData({ CUSTOMER_ID: params.customer_id, CUSTOMER_COSTCENTER_ID: params.customer_costcenter_id, CURRENCY_CODE: params.currency_code, TEMPLATE_ID: params.template_id, TEMPLATE_HASH: params.template_hash, INTROTEXT: params.introtext, START_DATE: params.start_date, FREQUENCY: params.frequency, OCCURENCES: params.occurences, OUTPUT_TYPE: params.output_type, EMAIL_NOTIFY: params.email_notify, DELIVERY_DATE: params.delivery_date, CASH_DISCOUNT_PERCENT: params.cash_discount_percent, CASH_DISCOUNT_DAYS: params.cash_discount_days, VAT_CASE: params.vat_case, IS_GROSS: params.is_gross, DISCOUNT_PERCENT: params.discount_percent, DISCOUNT_AMOUNT: params.discount_amount, ITEMS: mapLineItems(params.items) }),
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
        frequency: z.enum(["weekly", "2 weeks", "4 weeks", "monthly", "2 months", "3 months", "6 months", "yearly"]).optional().describe("Frequency"),
        occurences: z.number().optional().describe("Occurrences (0=unlimited)"),
        output_type: z.enum(["draft", "outgoing"]).optional().describe("Output type"),
        email_notify: z.number().optional().describe("Email notify (0/1)"),
        delivery_date: z.string().optional().describe("Delivery date"),
        cash_discount_percent: z.string().optional().describe("Cash discount %"),
        cash_discount_days: z.number().optional().describe("Cash discount days"),
        vat_case: VAT_CASE_ENUM.optional().describe("VAT case"),
        is_gross: z.number().optional().describe("Prices gross (1) or net (0)"),
        ...documentDiscountParams,
        delete_existing_items: z.number().optional().describe("Delete existing items (0/1). With 1, items must not be empty."),
        items: z.array(LineItemSchema).optional().describe("New line items"),
    }, async (params) => {
        assertItemsWhenReplacing(params.delete_existing_items, params.items);
        const client = getClient();
        const data = cleanData({ INVOICE_ID: params.invoice_id, CUSTOMER_ID: params.customer_id, CUSTOMER_COSTCENTER_ID: params.customer_costcenter_id, CURRENCY_CODE: params.currency_code, TEMPLATE_ID: params.template_id, TEMPLATE_HASH: params.template_hash, INTROTEXT: params.introtext, START_DATE: params.start_date, FREQUENCY: params.frequency, OCCURENCES: params.occurences, OUTPUT_TYPE: params.output_type, EMAIL_NOTIFY: params.email_notify, DELIVERY_DATE: params.delivery_date, CASH_DISCOUNT_PERCENT: params.cash_discount_percent, CASH_DISCOUNT_DAYS: params.cash_discount_days, VAT_CASE: params.vat_case, IS_GROSS: params.is_gross, DISCOUNT_PERCENT: params.discount_percent, DISCOUNT_AMOUNT: params.discount_amount, DELETE_EXISTING_ITEMS: params.delete_existing_items });
        if (params.items && params.items.length > 0)
            data.ITEMS = mapLineItems(params.items);
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
//# sourceMappingURL=recurring.js.map