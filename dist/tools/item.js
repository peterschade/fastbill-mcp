import { z } from "zod";
import { getClient } from "../client.js";
import { formatItems } from "../formatters.js";
export function registerItemTools(server) {
    server.tool("item_get", "Get individual line items of a specific invoice. Returns compact summary by default.", {
        invoice_id: z.string().describe("Invoice ID to get items for (required)"),
        detailed: z.boolean().optional().describe("Return full raw JSON (default false)"),
    }, async (params) => {
        const client = getClient();
        const result = await client.request({ SERVICE: "item.get", FILTER: { INVOICE_ID: params.invoice_id } });
        const text = params.detailed ? JSON.stringify(result.RESPONSE, null, 2) : formatItems(result.RESPONSE);
        return { content: [{ type: "text", text }] };
    });
    server.tool("item_delete", "Delete a single line item from an invoice.", {
        invoice_item_id: z.string().describe("Invoice item ID to delete (required)"),
    }, async (params) => {
        const client = getClient();
        const result = await client.request({ SERVICE: "item.delete", DATA: { INVOICE_ITEM_ID: params.invoice_item_id } });
        return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    });
}
//# sourceMappingURL=item.js.map