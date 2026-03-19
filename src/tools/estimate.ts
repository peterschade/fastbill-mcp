import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient, cleanData, todayISO, progressiveSearch } from "../client.js";
import { formatEstimates, sortByDateDesc } from "../formatters.js";

const EstimateItemSchema = z.object({
  article_number: z.string().optional().describe("Article/product number"),
  description: z.string().describe("Item description (required)"),
  quantity: z.number().optional().describe("Quantity"),
  unit: z.string().optional().describe("Unit (e.g. Stück, Stunde)"),
  unit_price: z.number().describe("Unit price (required)"),
  vat_percent: z.number().describe("VAT percentage (required)"),
  is_gross: z.number().optional().describe("Price is gross (1) or net (0)"),
  sort_order: z.number().optional().describe("Sort order"),
});

export function registerEstimateTools(server: McpServer) {
  server.tool(
    "estimate_get",
    "Get estimates/quotes from Fastbill, sorted newest first. ALWAYS set start_date/end_date — without them the API returns random results. States: a=created, b=sent, c=negotiation, d=accepted, e=rejected, f=invoiced.",
    {
      estimate_id: z.string().optional().describe("Filter by estimate ID"),
      estimate_number: z.string().optional().describe("Filter by estimate number"),
      customer_id: z.string().optional().describe("Filter by customer ID"),
      start_date: z.string().optional().describe("From date (YYYY-MM-DD). ALWAYS SET — otherwise random results!"),
      end_date: z.string().optional().describe("Until date (YYYY-MM-DD). ALWAYS SET — otherwise random results!"),
      limit: z.number().optional().describe("Max results (max 100)"),
      offset: z.number().optional().describe("Pagination offset"),
      detailed: z.boolean().optional().describe("Return full raw JSON (default false)"),
    },
    async (params) => {
      const client = getClient();
      const today = todayISO();
      let startDate = params.start_date;
      let endDate = params.end_date;
      let response: Record<string, unknown>;

      const hasSpecificFilter = params.estimate_id || params.estimate_number || startDate || endDate;

      if (hasSpecificFilter) {
        const result = await client.request({
          SERVICE: "estimate.get",
          FILTER: cleanData({ ESTIMATE_ID: params.estimate_id, ESTIMATE_NUMBER: params.estimate_number, CUSTOMER_ID: params.customer_id, START_DATE: startDate, END_DATE: endDate }),
          LIMIT: params.limit ?? 100, OFFSET: params.offset,
        });
        response = result.RESPONSE;
      } else {
        const search = await progressiveSearch(client, "estimate.get",
          cleanData({ CUSTOMER_ID: params.customer_id }),
          "ESTIMATES", params.limit ?? 100, params.offset);
        response = search.response;
        startDate = search.startDate;
        endDate = search.endDate;
      }

      if (Array.isArray(response.ESTIMATES)) {
        response.ESTIMATES = sortByDateDesc(response.ESTIMATES as Record<string, unknown>[], "ESTIMATE_DATE");
      }

      const dateInfo = startDate && endDate ? `\nZeitraum: ${startDate} bis ${endDate}` : "";
      const text = params.detailed
        ? JSON.stringify(response, null, 2)
        : `Heute: ${today}\n` + formatEstimates(response) + dateInfo;
      return { content: [{ type: "text", text }] };
    }
  );

  server.tool("estimate_create", "Create a new estimate/quote in Fastbill with line items.", {
    customer_id: z.string().describe("Customer ID (required)"),
    contact_id: z.string().optional().describe("Contact ID"),
    currency_code: z.string().optional().describe("Currency (e.g. EUR)"),
    template_id: z.string().optional().describe("Template ID"),
    template_hash: z.string().optional().describe("Template hash (permanent, preferred)"),
    introtext: z.string().optional().describe("Introduction text"),
    estimate_title: z.string().optional().describe("Estimate title"),
    estimate_date: z.string().optional().describe("Estimate date (YYYY-MM-DD)"),
    due_date: z.string().optional().describe("Valid until date (YYYY-MM-DD)"),
    customer_costcenter_id: z.string().optional().describe("Cost center ID"),
    project_id: z.string().optional().describe("Project ID"),
    vat_case: z.number().optional().describe("VAT case: 1=reverse charge, 0=normal"),
    is_gross: z.number().optional().describe("Prices gross (1) or net (0)"),
    items: z.array(EstimateItemSchema).describe("Line items (required)"),
  }, async (params) => {
    const client = getClient();
    const items = params.items.map((i) => cleanData({ ARTICLE_NUMBER: i.article_number, DESCRIPTION: i.description, QUANTITY: i.quantity, UNIT: i.unit, UNIT_PRICE: i.unit_price, VAT_PERCENT: i.vat_percent, IS_GROSS: i.is_gross, SORT_ORDER: i.sort_order }));
    const result = await client.request({
      SERVICE: "estimate.create",
      DATA: cleanData({ CUSTOMER_ID: params.customer_id, CONTACT_ID: params.contact_id, CURRENCY_CODE: params.currency_code, TEMPLATE_ID: params.template_id, TEMPLATE_HASH: params.template_hash, INTROTEXT: params.introtext, ESTIMATE_TITLE: params.estimate_title, ESTIMATE_DATE: params.estimate_date, DUE_DATE: params.due_date, CUSTOMER_COSTCENTER_ID: params.customer_costcenter_id, PROJECT_ID: params.project_id, VAT_CASE: params.vat_case, IS_GROSS: params.is_gross, ITEMS: items }),
    });
    return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
  });

  server.tool("estimate_sendbyemail", "Send an estimate via email through Fastbill.", {
    estimate_id: z.string().describe("Estimate ID to send (required)"),
    recipient_to: z.string().describe("Primary recipient email (required)"),
    recipient_cc: z.string().optional().describe("CC email"),
    recipient_bcc: z.string().optional().describe("BCC email"),
    subject: z.string().optional().describe("Email subject"),
    message: z.string().optional().describe("Email body"),
    receipt_confirmation: z.number().optional().describe("Request read receipt (0/1)"),
  }, async (params) => {
    const client = getClient();
    const recipient: Record<string, string> = { TO: params.recipient_to };
    if (params.recipient_cc) recipient.CC = params.recipient_cc;
    if (params.recipient_bcc) recipient.BCC = params.recipient_bcc;
    const result = await client.request({ SERVICE: "estimate.sendbyemail", DATA: cleanData({ ESTIMATE_ID: params.estimate_id, RECIPIENT: recipient, SUBJECT: params.subject, MESSAGE: params.message, RECEIPT_CONFIRMATION: params.receipt_confirmation }) });
    return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
  });

  server.tool("estimate_createinvoice", "Convert an estimate into an invoice. Returns the new invoice ID.", {
    estimate_id: z.string().describe("Estimate ID to convert (required)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "estimate.createinvoice", DATA: { ESTIMATE_ID: params.estimate_id } });
    return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
  });

  server.tool("estimate_delete", "Delete an estimate from Fastbill.", {
    estimate_id: z.string().describe("Estimate ID to delete (required)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "estimate.delete", DATA: { ESTIMATE_ID: params.estimate_id } });
    return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
  });
}
