import { z } from "zod";
import { getClient, cleanData, todayISO, progressiveSearch } from "../client.js";
import { formatExpenses, sortByDateDesc } from "../formatters.js";
const ExpenseItemSchema = z.object({
    description: z.string().describe("Item description"),
    quantity: z.number().optional().describe("Quantity"),
    unit_price: z.number().describe("Unit price"),
    vat_percent: z.number().describe("VAT percentage"),
    category: z.string().optional().describe("Expense category"),
    category_id: z.string().optional().describe("Expense category ID"),
});
export function registerExpenseTools(server) {
    server.tool("expense_get", "Get expenses from Fastbill, sorted newest first. ALWAYS set start_date/end_date — without them the API returns random results.", {
        invoice_id: z.string().optional().describe("Filter by expense ID"),
        invoice_number: z.string().optional().describe("Filter by invoice number"),
        start_paid_date: z.string().optional().describe("Paid from (YYYY-MM-DD)"),
        end_paid_date: z.string().optional().describe("Paid until (YYYY-MM-DD)"),
        start_date: z.string().optional().describe("Date from (YYYY-MM-DD). ALWAYS SET!"),
        end_date: z.string().optional().describe("Date until (YYYY-MM-DD). ALWAYS SET!"),
        limit: z.number().optional().describe("Max results (max 100)"),
        offset: z.number().optional().describe("Pagination offset"),
        detailed: z.boolean().optional().describe("Return full raw JSON (default false)"),
    }, async (params) => {
        const client = getClient();
        const today = todayISO();
        let startDate = params.start_date;
        let endDate = params.end_date;
        let response;
        const hasSpecificFilter = params.invoice_id || params.invoice_number || startDate || endDate
            || params.start_paid_date || params.end_paid_date;
        if (hasSpecificFilter) {
            const result = await client.request({
                SERVICE: "expense.get",
                FILTER: cleanData({ INVOICE_ID: params.invoice_id, INVOICE_NUMBER: params.invoice_number, START_PAID_DATE: params.start_paid_date, END_PAID_DATE: params.end_paid_date, START_DATE: startDate, END_DATE: endDate }),
                LIMIT: params.limit ?? 100, OFFSET: params.offset,
            });
            response = result.RESPONSE;
        }
        else {
            const search = await progressiveSearch(client, "expense.get", cleanData({}), "EXPENSES", params.limit ?? 100, params.offset);
            response = search.response;
            startDate = search.startDate;
            endDate = search.endDate;
        }
        if (Array.isArray(response.EXPENSES)) {
            response.EXPENSES = sortByDateDesc(response.EXPENSES, "INVOICE_DATE");
        }
        const dateInfo = startDate && endDate ? `\nZeitraum: ${startDate} bis ${endDate}` : "";
        const text = params.detailed
            ? JSON.stringify(response, null, 2)
            : `Heute: ${today}\n` + formatExpenses(response) + dateInfo;
        return { content: [{ type: "text", text }] };
    });
    server.tool("expense_create", "Create an expense entry in Fastbill.", {
        invoice_date: z.string().describe("Invoice date (YYYY-MM-DD, required)"),
        service_period_start: z.string().optional().describe("Service period start (YYYY-MM-DD)"),
        service_period_end: z.string().optional().describe("Service period end (YYYY-MM-DD)"),
        due_date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
        project_id: z.string().optional().describe("Project ID"),
        customer_id: z.string().optional().describe("Customer ID"),
        organization: z.string().describe("Vendor/organization name (required)"),
        invoice_number: z.string().optional().describe("External invoice number"),
        comment: z.string().optional().describe("Comment/notes"),
        sub_total: z.number().describe("Net amount (required)"),
        vat_total: z.number().optional().describe("VAT amount"),
        items: z.array(ExpenseItemSchema).optional().describe("Expense line items with categories"),
    }, async (params) => {
        const client = getClient();
        const items = params.items?.map((i) => cleanData({ DESCRIPTION: i.description, QUANTITY: i.quantity, UNIT_PRICE: i.unit_price, VAT_PERCENT: i.vat_percent, CATEGORY: i.category, CATEGORY_ID: i.category_id }));
        const data = cleanData({ INVOICE_DATE: params.invoice_date, SERVICE_PERIOD_START: params.service_period_start, SERVICE_PERIOD_END: params.service_period_end, DUE_DATE: params.due_date, PROJECT_ID: params.project_id, CUSTOMER_ID: params.customer_id, ORGANIZATION: params.organization, INVOICE_NUMBER: params.invoice_number, COMMENT: params.comment, SUB_TOTAL: params.sub_total, VAT_TOTAL: params.vat_total });
        if (items)
            data.ITEMS = items;
        const result = await client.request({ SERVICE: "expense.create", DATA: data });
        return { content: [{ type: "text", text: JSON.stringify(result.RESPONSE, null, 2) }] };
    });
}
//# sourceMappingURL=expense.js.map