import { z } from "zod";
import { getClient, cleanData, todayISO, progressiveSearch } from "../client.js";
import { formatTimeEntries, sortByDateDesc } from "../formatters.js";
export function registerTimeTools(server) {
    server.tool("time_get", "Get time tracking entries from Fastbill, sorted newest first. ALWAYS set start_date/end_date — without them the API returns random results.", {
        time_id: z.string().optional().describe("Filter by time entry ID"),
        customer_id: z.string().optional().describe("Filter by customer ID"),
        project_id: z.string().optional().describe("Filter by project ID"),
        task_id: z.string().optional().describe("Filter by task ID"),
        start_date: z.string().optional().describe("From date (YYYY-MM-DD). ALWAYS SET!"),
        end_date: z.string().optional().describe("Until date (YYYY-MM-DD). ALWAYS SET!"),
        date: z.string().optional().describe("Specific date (YYYY-MM-DD)"),
        limit: z.number().optional().describe("Max results (max 100)"),
        offset: z.number().optional().describe("Pagination offset"),
        detailed: z.boolean().optional().describe("Return full raw JSON (default false)"),
    }, async (params) => {
        const client = getClient();
        const today = todayISO();
        let startDate = params.start_date;
        let endDate = params.end_date;
        let response;
        const hasSpecificFilter = params.time_id || params.date || startDate || endDate;
        if (hasSpecificFilter) {
            const result = await client.request({ SERVICE: "time.get", FILTER: cleanData({ TIME_ID: params.time_id, CUSTOMER_ID: params.customer_id, PROJECT_ID: params.project_id, TASK_ID: params.task_id, START_DATE: startDate, END_DATE: endDate, DATE: params.date }), LIMIT: params.limit ?? 100, OFFSET: params.offset });
            response = result.RESPONSE;
        }
        else {
            const search = await progressiveSearch(client, "time.get", cleanData({ CUSTOMER_ID: params.customer_id, PROJECT_ID: params.project_id, TASK_ID: params.task_id }), "TIMES", params.limit ?? 100, params.offset);
            response = search.response;
            startDate = search.startDate;
            endDate = search.endDate;
        }
        if (Array.isArray(response.TIMES)) {
            response.TIMES = sortByDateDesc(response.TIMES, "DATE");
        }
        const dateInfo = startDate && endDate ? `\nZeitraum: ${startDate} bis ${endDate}` : "";
        const text = params.detailed
            ? JSON.stringify(response, null, 2)
            : `Heute: ${today}\n` + formatTimeEntries(response) + dateInfo;
        return { content: [{ type: "text", text }] };
    });
    server.tool("time_create", "Create a time tracking entry in Fastbill.", {
        customer_id: z.string().describe("Customer ID (required)"),
        project_id: z.string().describe("Project ID (required)"),
        task_id: z.string().optional().describe("Task ID within the project"),
        date: z.string().optional().describe("Date (YYYY-MM-DD)"),
        start_time: z.string().describe("Start time (YYYY-MM-DD hh:mm:ss, required)"),
        end_time: z.string().optional().describe("End time (YYYY-MM-DD hh:mm:ss)"),
        minutes: z.number().optional().describe("Duration in minutes (alternative to end_time)"),
        billable_minutes: z.number().optional().describe("Billable minutes"),
        comment: z.string().optional().describe("Comment/description of work"),
    }, async (params) => {
        const client = getClient();
        const result = await client.request({ SERVICE: "time.create", DATA: cleanData({ CUSTOMER_ID: params.customer_id, PROJECT_ID: params.project_id, TASK_ID: params.task_id, DATE: params.date, START_TIME: params.start_time, END_TIME: params.end_time, MINUTES: params.minutes, BILLABLE_MINUTES: params.billable_minutes, COMMENT: params.comment }) });
        return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    });
    server.tool("time_update", "Update a time tracking entry in Fastbill.", {
        time_id: z.string().describe("Time entry ID to update (required)"),
        customer_id: z.string().optional().describe("Customer ID"),
        project_id: z.string().optional().describe("Project ID"),
        task_id: z.string().optional().describe("Task ID"),
        date: z.string().optional().describe("Date (YYYY-MM-DD)"),
        start_time: z.string().optional().describe("Start time (YYYY-MM-DD hh:mm:ss)"),
        end_time: z.string().optional().describe("End time (YYYY-MM-DD hh:mm:ss)"),
        minutes: z.number().optional().describe("Duration in minutes"),
        billable_minutes: z.number().optional().describe("Billable minutes"),
        comment: z.string().optional().describe("Comment"),
    }, async (params) => {
        const client = getClient();
        const result = await client.request({ SERVICE: "time.update", DATA: cleanData({ TIME_ID: params.time_id, CUSTOMER_ID: params.customer_id, PROJECT_ID: params.project_id, TASK_ID: params.task_id, DATE: params.date, START_TIME: params.start_time, END_TIME: params.end_time, MINUTES: params.minutes, BILLABLE_MINUTES: params.billable_minutes, COMMENT: params.comment }) });
        return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    });
    server.tool("time_delete", "Delete a time tracking entry from Fastbill.", {
        time_id: z.string().describe("Time entry ID to delete (required)"),
    }, async (params) => {
        const client = getClient();
        const result = await client.request({ SERVICE: "time.delete", DATA: { TIME_ID: params.time_id } });
        return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    });
}
//# sourceMappingURL=time.js.map