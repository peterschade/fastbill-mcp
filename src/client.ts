/**
 * Fastbill API client
 * All requests go to a single endpoint via POST with a SERVICE field
 * Authentication: HTTP Basic Auth (email + API key)
 */

const FASTBILL_API_URL = "https://my.fastbill.com/api/1.0/api.php";

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

export class FastbillClient {
  private authHeader: string;

  constructor(email: string, apiKey: string) {
    this.authHeader =
      "Basic " + Buffer.from(`${email}:${apiKey}`).toString("base64");
  }

  /**
   * Download a document (e.g. an invoice PDF) from a URL returned by the API.
   * HTTPS only on every redirect hop; credentials are only sent to fastbill.com hosts.
   * Fails on timeout, oversize responses and non-PDF content.
   */
  async downloadPdf(documentUrl: string): Promise<Buffer> {
    const MAX_REDIRECTS = 5;
    const MAX_BYTES = 25 * 1024 * 1024;
    const signal = AbortSignal.timeout(30_000);

    let url = new URL(documentUrl);
    let response: Response | undefined;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (url.protocol !== "https:") {
        throw new Error(`Refusing non-HTTPS document URL: ${url.href}`);
      }
      const isFastbill = url.hostname === "fastbill.com" || url.hostname.endsWith(".fastbill.com");
      const headers: Record<string, string> = isFastbill ? { Authorization: this.authHeader } : {};
      response = await fetch(url, { headers, redirect: "manual", signal });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) throw new Error(`Redirect without location (${response.status})`);
        url = new URL(location, url);
        continue;
      }
      break;
    }
    if (!response || (response.status >= 300 && response.status < 400)) {
      throw new Error("PDF download failed: too many redirects");
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`PDF download failed: ${response.status} ${response.statusText}`);
    }
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) {
      await response.body?.cancel();
      throw new Error(`PDF too large (${declared} bytes)`);
    }
    if (!response.body) throw new Error("PDF download failed: empty response");

    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      total += chunk.length;
      if (total > MAX_BYTES) throw new Error(`PDF too large (> ${MAX_BYTES} bytes)`);
      chunks.push(Buffer.from(chunk));
    }
    const pdf = Buffer.concat(chunks);
    if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
      throw new Error(
        `Download is not a PDF (content-type: ${response.headers.get("content-type") ?? "unknown"})`
      );
    }
    return pdf;
  }

  async request(payload: FastbillRequest): Promise<FastbillResponse> {
    const response = await fetch(FASTBILL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Fastbill API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as FastbillResponse;

    if (
      data.RESPONSE &&
      "ERRORS" in data.RESPONSE &&
      Array.isArray(data.RESPONSE.ERRORS) &&
      data.RESPONSE.ERRORS.length > 0
    ) {
      const errors = data.RESPONSE.ERRORS.map(
        (e: Record<string, string>) => e.ERROR || JSON.stringify(e)
      ).join("; ");
      throw new Error(`Fastbill API error: ${errors}`);
    }

    return data;
  }
}

let client: FastbillClient | null = null;

export function getClient(): FastbillClient {
  if (!client) {
    const email = process.env.FASTBILL_EMAIL;
    const apiKey = process.env.FASTBILL_API_KEY;

    if (!email || !apiKey) {
      throw new Error(
        "FASTBILL_EMAIL and FASTBILL_API_KEY environment variables are required"
      );
    }

    client = new FastbillClient(email, apiKey);
  }
  return client;
}

/**
 * Helper to strip undefined values from an object before sending to the API
 */
export function cleanData(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
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
export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Progressive search: tries increasingly wider date ranges (2w → 2m → 6m)
 * until results are found or all ranges are exhausted.
 */
export async function progressiveSearch(
  client: FastbillClient,
  service: string,
  baseFilter: Record<string, unknown>,
  resultKey: string,
  limit: number,
  offset?: number,
): Promise<{ response: Record<string, unknown>; startDate: string; endDate: string }> {
  const now = new Date();
  const endDate = now.toISOString().split("T")[0];
  const ranges = [14, 60, 180].map((days) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return { startDate: d.toISOString().split("T")[0], endDate };
  });

  let response: Record<string, unknown> = {};
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
    if (Array.isArray(items) && items.length > 0) break;
  }

  return { response, startDate: usedStart, endDate: usedEnd };
}
