import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient, cleanData } from "../client.js";
import { formatDocuments } from "../formatters.js";

export function registerDocumentTools(server: McpServer) {
  server.tool("document_get", "Get documents and folders from Fastbill. Returns compact summary by default.", {
    folder_id: z.string().optional().describe("Filter by folder ID"),
    limit: z.number().optional().describe("Max results (default 10, max 100)"),
    offset: z.number().optional().describe("Pagination offset"),
    detailed: z.boolean().optional().describe("Return full raw JSON (default false)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "document.get", FILTER: cleanData({ FOLDER_ID: params.folder_id }), LIMIT: params.limit ?? 10, OFFSET: params.offset });
    const text = params.detailed ? JSON.stringify(result.RESPONSE, null, 2) : formatDocuments(result.RESPONSE);
    return { content: [{ type: "text", text }] };
  });

  server.tool("document_create", "Create a document entry in Fastbill (metadata only).", {
    type: z.string().optional().describe("Document type"),
    title: z.string().optional().describe("Document title"),
    date: z.string().optional().describe("Document date (YYYY-MM-DD)"),
    note: z.string().optional().describe("Note/description"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "document.create", DATA: cleanData({ TYPE: params.type, TITLE: params.title, DATE: params.date, NOTE: params.note }) });
    return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
  });
}
