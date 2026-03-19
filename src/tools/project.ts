import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient, cleanData } from "../client.js";
import { formatProjects } from "../formatters.js";

export function registerProjectTools(server: McpServer) {
  server.tool("project_get", "Get projects from Fastbill. Returns compact summary by default.", {
    project_id: z.string().optional().describe("Filter by project ID"),
    customer_id: z.string().optional().describe("Filter by customer ID"),
    limit: z.number().optional().describe("Max results (default 10, max 100)"),
    offset: z.number().optional().describe("Pagination offset"),
    detailed: z.boolean().optional().describe("Return full raw JSON (default false)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "project.get", FILTER: cleanData({ PROJECT_ID: params.project_id, CUSTOMER_ID: params.customer_id }), LIMIT: params.limit ?? 10, OFFSET: params.offset });
    const text = params.detailed ? JSON.stringify(result.RESPONSE, null, 2) : formatProjects(result.RESPONSE);
    return { content: [{ type: "text", text }] };
  });

  server.tool("project_create", "Create a new project in Fastbill linked to a customer.", {
    project_name: z.string().describe("Project name (required)"),
    customer_id: z.string().describe("Customer ID (required)"),
    customer_costcenter_id: z.string().optional().describe("Cost center ID"),
    hour_price: z.number().optional().describe("Hourly rate"),
    currency_code: z.string().optional().describe("Currency (e.g. EUR)"),
    vat_percent: z.number().optional().describe("VAT percentage"),
    start_date: z.string().optional().describe("Start date (YYYY-MM-DD)"),
    end_date: z.string().optional().describe("End date (YYYY-MM-DD)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "project.create", DATA: cleanData({ PROJECT_NAME: params.project_name, CUSTOMER_ID: params.customer_id, CUSTOMER_COSTCENTER_ID: params.customer_costcenter_id, HOUR_PRICE: params.hour_price, CURRENCY_CODE: params.currency_code, VAT_PERCENT: params.vat_percent, START_DATE: params.start_date, END_DATE: params.end_date }) });
    return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
  });

  server.tool("project_update", "Update an existing project in Fastbill.", {
    project_id: z.string().describe("Project ID to update (required)"),
    project_name: z.string().optional().describe("Project name"),
    customer_id: z.string().optional().describe("Customer ID"),
    customer_costcenter_id: z.string().optional().describe("Cost center ID"),
    hour_price: z.number().optional().describe("Hourly rate"),
    currency_code: z.string().optional().describe("Currency"),
    vat_percent: z.number().optional().describe("VAT %"),
    start_date: z.string().optional().describe("Start date (YYYY-MM-DD)"),
    end_date: z.string().optional().describe("End date (YYYY-MM-DD)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "project.update", DATA: cleanData({ PROJECT_ID: params.project_id, PROJECT_NAME: params.project_name, CUSTOMER_ID: params.customer_id, CUSTOMER_COSTCENTER_ID: params.customer_costcenter_id, HOUR_PRICE: params.hour_price, CURRENCY_CODE: params.currency_code, VAT_PERCENT: params.vat_percent, START_DATE: params.start_date, END_DATE: params.end_date }) });
    return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
  });

  server.tool("project_delete", "Delete a project from Fastbill.", {
    project_id: z.string().describe("Project ID to delete (required)"),
  }, async (params) => {
    const client = getClient();
    const result = await client.request({ SERVICE: "project.delete", DATA: { PROJECT_ID: params.project_id } });
    return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
  });
}
