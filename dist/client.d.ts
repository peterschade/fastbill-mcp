/**
 * Fastbill API client
 * All requests go to a single endpoint via POST with a SERVICE field
 * Authentication: HTTP Basic Auth (email + API key)
 */
export interface FastbillRequest {
    SERVICE: string;
    FILTER?: Record<string, unknown>;
    DATA?: Record<string, unknown>;
    LIMIT?: number;
    OFFSET?: number;
}
export interface FastbillResponse {
    REQUEST: Record<string, unknown>;
    RESPONSE: Record<string, unknown>;
}
export declare class FastbillClient {
    private authHeader;
    constructor(email: string, apiKey: string);
    getAuthHeader(): string;
    request(payload: FastbillRequest): Promise<FastbillResponse>;
}
export declare function getClient(): FastbillClient;
/**
 * Helper to strip undefined values from an object before sending to the API
 */
export declare function cleanData(obj: Record<string, unknown>): Record<string, unknown>;
/**
 * Get today's date as YYYY-MM-DD
 */
export declare function todayISO(): string;
/**
 * Progressive search: tries increasingly wider date ranges (2w → 2m → 6m)
 * until results are found or all ranges are exhausted.
 */
export declare function progressiveSearch(client: FastbillClient, service: string, baseFilter: Record<string, unknown>, resultKey: string, limit: number, offset?: number): Promise<{
    response: Record<string, unknown>;
    startDate: string;
    endDate: string;
}>;
//# sourceMappingURL=client.d.ts.map