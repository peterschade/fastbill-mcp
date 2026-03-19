import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient, cleanData } from "../client.js";
import { formatArticles } from "../formatters.js";

export function registerArticleTools(server: McpServer) {
  server.tool("article_get", "Get articles/products from Fastbill. Returns compact summary by default.", {
    article_id: z.string().optional().describe("Filter by article ID"),
    article_number: z.string().optional().describe("Filter by article number"),
    limit: z.number().optional().describe("Max results (default 10, max 100)"),
    offset: z.number().optional().describe("Pagination offset"),
    detailed: z.boolean().optional().describe("Return full raw JSON (default false)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "article.get", FILTER: cleanData({ ARTICLE_ID: params.article_id, ARTICLE_NUMBER: params.article_number }), LIMIT: params.limit ?? 10, OFFSET: params.offset });
    const text = params.detailed ? JSON.stringify(result.RESPONSE, null, 2) : formatArticles(result.RESPONSE);
    return { content: [{ type: "text", text }] };
  });

  server.tool("article_create", "Create a new article/product in Fastbill.", {
    article_number: z.string().describe("Article number (required)"),
    title: z.string().describe("Article title (required)"),
    description: z.string().optional().describe("Description"),
    type: z.enum(["product", "digital_product", "service", "none"]).optional().describe("Article type"),
    unit: z.string().optional().describe("Unit (e.g. Stück, Stunde, Pauschal)"),
    unit_price: z.number().describe("Unit price (required)"),
    currency_code: z.string().optional().describe("Currency (e.g. EUR)"),
    vat_percent: z.number().optional().describe("VAT percentage (e.g. 19)"),
    is_gross: z.number().optional().describe("Price is gross (1) or net (0)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "article.create", DATA: cleanData({ ARTICLE_NUMBER: params.article_number, TITLE: params.title, DESCRIPTION: params.description, TYPE: params.type, UNIT: params.unit, UNIT_PRICE: params.unit_price, CURRENCY_CODE: params.currency_code, VAT_PERCENT: params.vat_percent, IS_GROSS: params.is_gross }) });
    return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
  });

  server.tool("article_update", "Update an existing article/product in Fastbill.", {
    article_id: z.string().describe("Article ID to update (required)"),
    article_number: z.string().optional().describe("Article number"),
    title: z.string().optional().describe("Title"),
    description: z.string().optional().describe("Description"),
    type: z.enum(["product", "digital_product", "service", "none"]).optional().describe("Type"),
    unit: z.string().optional().describe("Unit"),
    unit_price: z.number().optional().describe("Unit price"),
    currency_code: z.string().optional().describe("Currency"),
    vat_percent: z.number().optional().describe("VAT %"),
    is_gross: z.number().optional().describe("Gross (1) or net (0)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "article.update", DATA: cleanData({ ARTICLE_ID: params.article_id, ARTICLE_NUMBER: params.article_number, TITLE: params.title, DESCRIPTION: params.description, TYPE: params.type, UNIT: params.unit, UNIT_PRICE: params.unit_price, CURRENCY_CODE: params.currency_code, VAT_PERCENT: params.vat_percent, IS_GROSS: params.is_gross }) });
    return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
  });

  server.tool("article_delete", "Delete an article/product from Fastbill.", {
    article_id: z.string().describe("Article ID to delete (required)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "article.delete", DATA: { ARTICLE_ID: params.article_id } });
    return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
  });
}
