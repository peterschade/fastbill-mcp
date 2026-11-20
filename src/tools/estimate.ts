import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient, cleanData, todayISO, progressiveSearch } from "../client.js";
import { formatEstimates, sortByDateDesc, coverageNote } from "../formatters.js";
import { VAT_CASE_ENUM, LineItemSchema, mapLineItems, documentDiscountParams, assertItemsWhenReplacing } from "./shared.js";

export function registerEstimateTools(server: McpServer) {
  server.tool(
    "estimate_get",
    "Get estimates/quotes from Fastbill. FastBill cannot sort: it returns the OLDEST entries of the range first, and limit cuts off the newest. The tool only re-sorts the returned page newest first. For the latest entries narrow the date range instead of using limit. ALWAYS set start_date/end_date — without them the API returns random results. States: created, sent, negotiation, accepted, rejected, invoiced (older responses use letters a-f).",
    {
      estimate_id: z.string().optional().describe("Filter by estimate ID"),
      estimate_number: z.string().optional().describe("Filter by estimate number"),
      customer_id: z.string().optional().describe("Filter by customer ID"),
      is_gross: z.number().optional().describe("Filter by gross flag (1 = unit prices are gross, 0 = net)"),
      start_date: z.string().optional().describe("From date (YYYY-MM-DD). ALWAYS SET — otherwise random results!"),
      end_date: z.string().optional().describe("Until date (YYYY-MM-DD). ALWAYS SET — otherwise random results!"),
      limit: z.number().optional().describe("Max results (max 100). Cuts off the NEWEST entries, because FastBill returns oldest first — prefer a narrower date range"),
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
          FILTER: cleanData({ ESTIMATE_ID: params.estimate_id, ESTIMATE_NUMBER: params.estimate_number, CUSTOMER_ID: params.customer_id, IS_GROSS: params.is_gross, START_DATE: startDate, END_DATE: endDate }),
          LIMIT: params.limit ?? 100, OFFSET: params.offset,
        });
        response = result.RESPONSE;
      } else {
        const search = await progressiveSearch(client, "estimate.get",
          cleanData({ CUSTOMER_ID: params.customer_id, IS_GROSS: params.is_gross }),
          "ESTIMATES", params.limit ?? 100, params.offset);
        response = search.response;
        startDate = search.startDate;
        endDate = search.endDate;
      }

      if (Array.isArray(response.ESTIMATES)) {
        response.ESTIMATES = sortByDateDesc(response.ESTIMATES as Record<string, unknown>[], "ESTIMATE_DATE");
      }

      const dateInfo = (startDate && endDate ? `\nAbgefragt: ${startDate} bis ${endDate}` : "")
      + coverageNote(response.ESTIMATES, "ESTIMATE_DATE", params.limit ?? 100, params.offset);
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
    vat_case: VAT_CASE_ENUM.optional().describe("VAT case"),
    is_gross: z.number().optional().describe("Prices gross (1) or net (0)"),
    ...documentDiscountParams,
    items: z.array(LineItemSchema).min(1).describe("Line items (required)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({
      SERVICE: "estimate.create",
      DATA: cleanData({ CUSTOMER_ID: params.customer_id, CONTACT_ID: params.contact_id, CURRENCY_CODE: params.currency_code, TEMPLATE_ID: params.template_id, TEMPLATE_HASH: params.template_hash, INTROTEXT: params.introtext, ESTIMATE_TITLE: params.estimate_title, ESTIMATE_DATE: params.estimate_date, DUE_DATE: params.due_date, CUSTOMER_COSTCENTER_ID: params.customer_costcenter_id, PROJECT_ID: params.project_id, VAT_CASE: params.vat_case, IS_GROSS: params.is_gross, DISCOUNT_PERCENT: params.discount_percent, DISCOUNT_AMOUNT: params.discount_amount, ITEMS: mapLineItems(params.items) }),
    });
    return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
  });

  server.tool("estimate_update", "Update an existing estimate/quote in Fastbill: fields, status, validity date and/or line items. Only provided fields are changed.", {
    estimate_id: z.string().describe("Estimate ID to update (required)"),
    state: z.enum(["created", "sent", "negotiation", "accepted", "rejected", "invoiced"]).optional().describe("Estimate status"),
    customer_id: z.string().optional().describe("Customer ID"),
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
    vat_case: VAT_CASE_ENUM.optional().describe("VAT case"),
    is_gross: z.number().optional().describe("Prices gross (1) or net (0)"),
    ...documentDiscountParams,
    delete_existing_items: z.number().optional().describe("Delete all existing items before adding the given ones (0 or 1). With 1, items must not be empty."),
    items: z.array(LineItemSchema).optional().describe("New/updated line items"),
  }, async (params) => {
    assertItemsWhenReplacing(params.delete_existing_items, params.items);
    const client = getClient();
    const data: Record<string, unknown> = cleanData({ ESTIMATE_ID: params.estimate_id, STATE: params.state, CUSTOMER_ID: params.customer_id, CONTACT_ID: params.contact_id, CURRENCY_CODE: params.currency_code, TEMPLATE_ID: params.template_id, TEMPLATE_HASH: params.template_hash, INTROTEXT: params.introtext, ESTIMATE_TITLE: params.estimate_title, ESTIMATE_DATE: params.estimate_date, DUE_DATE: params.due_date, CUSTOMER_COSTCENTER_ID: params.customer_costcenter_id, PROJECT_ID: params.project_id, VAT_CASE: params.vat_case, IS_GROSS: params.is_gross, DISCOUNT_PERCENT: params.discount_percent, DISCOUNT_AMOUNT: params.discount_amount, DELETE_EXISTING_ITEMS: params.delete_existing_items });
    if (params.items && params.items.length > 0) data.ITEMS = mapLineItems(params.items);
    const result = await client.request({ SERVICE: "estimate.update", DATA: data });
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
