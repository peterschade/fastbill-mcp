/**
 * Response formatters for compact, readable output.
 * Each formatter extracts only the most relevant fields.
 * Use detailed=true to get full JSON instead.
 */
type R = Record<string, unknown>;
/**
 * Sort an array of records by a date field, newest first.
 */
export declare function sortByDateDesc(items: R[], dateField: string): R[];
export declare function formatInvoices(response: R): string;
export declare function formatCustomers(response: R): string;
export declare function formatContacts(response: R): string;
export declare function formatEstimates(response: R): string;
export declare function formatRecurring(response: R): string;
export declare function formatRevenues(response: R): string;
export declare function formatExpenses(response: R): string;
export declare function formatArticles(response: R): string;
export declare function formatProjects(response: R): string;
export declare function formatTimeEntries(response: R): string;
export declare function formatItems(response: R): string;
export declare function formatDocuments(response: R): string;
export declare function formatTemplates(response: R): string;
export declare function formatWebhooks(response: R): string;
export {};
//# sourceMappingURL=formatters.d.ts.map