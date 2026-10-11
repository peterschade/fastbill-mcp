/**
 * Fastbill API client
 * All requests go to a single endpoint via POST with a SERVICE field
 * Authentication: HTTP Basic Auth (email + API key)
 */
const FASTBILL_API_URL = "https://my.fastbill.com/api/1.0/api.php";
export class FastbillClient {
    authHeader;
    constructor(email, apiKey) {
        this.authHeader =
            "Basic " + Buffer.from(`${email}:${apiKey}`).toString("base64");
    }
    getAuthHeader() {
        return this.authHeader;
    }
    async request(payload) {
        const response = await fetch(FASTBILL_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: this.authHeader,
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            throw new Error(`Fastbill API error: ${response.status} ${response.statusText}`);
        }
        const data = (await response.json());
        if (data.RESPONSE &&
            "ERRORS" in data.RESPONSE &&
            Array.isArray(data.RESPONSE.ERRORS) &&
            data.RESPONSE.ERRORS.length > 0) {
            const errors = data.RESPONSE.ERRORS.map((e) => e.ERROR || JSON.stringify(e)).join("; ");
            throw new Error(`Fastbill API error: ${errors}`);
        }
        return data;
    }
}
let client = null;
export function getClient() {
    if (!client) {
        const email = process.env.FASTBILL_EMAIL;
        const apiKey = process.env.FASTBILL_API_KEY;
        if (!email || !apiKey) {
            throw new Error("FASTBILL_EMAIL and FASTBILL_API_KEY environment variables are required");
        }
        client = new FastbillClient(email, apiKey);
    }
    return client;
}
/**
 * Helper to strip undefined values from an object before sending to the API
 */
export function cleanData(obj) {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined && value !== null) {
            cleaned[key] = value;
        }
    }
    return cleaned;
}
/**
 * Get today's date as YYYY-MM-DD
 */
export function todayISO() {
    return new Date().toISOString().split("T")[0];
}
/**
 * Progressive search: tries increasingly wider date ranges (2w → 2m → 6m)
 * until results are found or all ranges are exhausted.
 */
export async function progressiveSearch(client, service, baseFilter, resultKey, limit, offset) {
    const now = new Date();
    const endDate = now.toISOString().split("T")[0];
    const ranges = [14, 60, 180].map((days) => {
        const d = new Date(now);
        d.setDate(d.getDate() - days);
        return { startDate: d.toISOString().split("T")[0], endDate };
    });
    let response = {};
    let usedStart = "";
    let usedEnd = "";
    for (const range of ranges) {
        const result = await client.request({
            SERVICE: service,
            FILTER: { ...baseFilter, START_DATE: range.startDate, END_DATE: range.endDate },
            LIMIT: limit,
            OFFSET: offset,
        });
        response = result.RESPONSE;
        usedStart = range.startDate;
        usedEnd = range.endDate;
        const items = response[resultKey];
        if (Array.isArray(items) && items.length > 0)
            break;
    }
    return { response, startDate: usedStart, endDate: usedEnd };
}
//# sourceMappingURL=client.js.map