#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerCustomerTools } from "./tools/customer.js";
import { registerContactTools } from "./tools/contact.js";
import { registerInvoiceTools } from "./tools/invoice.js";
import { registerItemTools } from "./tools/item.js";
import { registerEstimateTools } from "./tools/estimate.js";
import { registerRecurringTools } from "./tools/recurring.js";
import { registerRevenueTools } from "./tools/revenue.js";
import { registerExpenseTools } from "./tools/expense.js";
import { registerArticleTools } from "./tools/article.js";
import { registerProjectTools } from "./tools/project.js";
import { registerTimeTools } from "./tools/time.js";
import { registerDocumentTools } from "./tools/document.js";
import { registerTemplateTools } from "./tools/template.js";
import { registerWebhookTools } from "./tools/webhook.js";
const server = new McpServer({
    name: "fastbill",
    version: "1.0.0",
});
// Register all tool groups
registerCustomerTools(server);
registerContactTools(server);
registerInvoiceTools(server);
registerItemTools(server);
registerEstimateTools(server);
registerRecurringTools(server);
registerRevenueTools(server);
registerExpenseTools(server);
registerArticleTools(server);
registerProjectTools(server);
registerTimeTools(server);
registerDocumentTools(server);
registerTemplateTools(server);
registerWebhookTools(server);
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map