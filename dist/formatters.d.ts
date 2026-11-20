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
/**
 * Explain which part of the requested range the returned page actually covers.
 * FastBill has no sort parameter and returns the oldest entries first, so a full page
 * means newer entries were left out.
 */
export declare function coverageNote(rows: unknown, dateField: string, limit: number, offset?: number): string;
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