import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { formatTemplates } from "../formatters.js";

export function registerTemplateTools(server: McpServer) {
  server.tool("template_get", "Get all available invoice/estimate templates. Use TEMPLATE_HASH for permanent references (TEMPLATE_ID changes when template is modified).", {
    detailed: z.boolean().optional().describe("Return full raw JSON (default false)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "template.get" });
    const text = params.detailed ? JSON.stringify(result.RESPONSE, null, 2) : formatTemplates(result.RESPONSE);
    return { content: [{ type: "text", text }] };
  });
}
