import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient, cleanData } from "../client.js";
import { formatWebhooks } from "../formatters.js";

export function registerWebhookTools(server: McpServer) {
  server.tool("webhook_get", "Get all configured webhooks. Returns compact summary by default.", {
    detailed: z.boolean().optional().describe("Return full raw JSON (default false)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "webhook.get" });
    const text = params.detailed ? JSON.stringify(result.RESPONSE, null, 2) : formatWebhooks(result.RESPONSE);
    return { content: [{ type: "text", text }] };
  });

  server.tool("webhook_create", "Create a webhook in Fastbill. Events: customer.created/updated/deleted, invoice.created/completed/canceled, estimate.created/updated, contact.created/updated/deleted.", {
    endpoint: z.string().describe("Webhook endpoint URL (required)"),
    events: z.string().describe("Comma-separated list of events (required)"),
    type: z.string().optional().describe('Webhook type (currently only "url")'),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "webhook.create", DATA: cleanData({ TYPE: params.type || "url", ENDPOINT: params.endpoint, EVENTS: params.events }) });
    return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
  });

  server.tool("webhook_delete", "Delete a webhook from Fastbill.", {
    webhook_id: z.string().describe("Webhook ID to delete (required)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "webhook.delete", DATA: { WEBHOOK_ID: params.webhook_id } });
    return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
  });
}
