/**
 * Response formatters for compact, readable output.
 * Each formatter extracts only the most relevant fields.
 * Use detailed=true to get full JSON instead.
 */

type R = Record<string, unknown>;

/**
 * Sort an array of records by a date field, newest first.
 */
export function sortByDateDesc(items: R[], dateField: string): R[] {
  return [...items].sort((a, b) => {
    const da = String(a[dateField] || "0000-00-00");
    const db = String(b[dateField] || "0000-00-00");
    return db.localeCompare(da);
  });
}

function val(obj: R, key: string): string {
  const v = obj[key];
  if (v === undefined || v === null || v === "" || v === "0000-00-00")
    return "";
  return String(v);
}

function money(obj: R, key: string, currKey = "CURRENCY_CODE"): string {
  const v = obj[key];
  if (v === undefined || v === null) return "";
  const num = Number(v);
  const curr = val(obj, currKey) || "EUR";
  return `${num.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
}

function name(obj: R): string {
  const org = val(obj, "ORGANIZATION");
  const first = val(obj, "FIRST_NAME");
  const last = val(obj, "LAST_NAME");
  if (org && last) return `${org} (${first} ${last})`.trim();
  if (org) return org;
  return `${first} ${last}`.trim() || "—";
}

const STATE_MAP: Record<string, string> = {
  draft: "Entwurf",
  unpaid: "offen",
  overdue: "überfällig",
  paid: "bezahlt",
  canceled: "storniert",
  issued: "ausgestellt",
};

const ESTIMATE_STATE_MAP: Record<string, string> = {
  a: "erstellt",
  b: "gesendet",
  c: "Verhandlung",
  d: "akzeptiert",
  e: "abgelehnt",
  f: "in Rechnung gestellt",
};

const PAYMENT_TYPE_MAP: Record<string, string> = {
  "1": "Überweisung",
  "2": "Lastschrift",
  "3": "Bar",
  "4": "PayPal",
  "5": "Vorkasse",
  "6": "Kreditkarte",
};

function formatItemsList(items: R[]): string {
  if (!items || items.length === 0) return "";
  return items
    .map((item) => {
      const qty = Number(item.QUANTITY || 1);
      const price = Number(item.UNIT_PRICE || 0);
      const desc = val(item, "DESCRIPTION").substring(0, 60);
      const unit = val(item, "UNIT");
      return `  - ${desc} (${qty}${unit ? " " + unit : ""} × ${price.toLocaleString("de-DE", { minimumFractionDigits: 2 })}€)`;
    })
    .join("\n");
}

// --- Public formatters ---

export function formatInvoices(response: R): string {
  const invoices = (response.INVOICES || []) as R[];
  if (invoices.length === 0) return "Keine Rechnungen gefunden.";

  const lines = invoices.map((inv) => {
    const id = val(inv, "INVOICE_ID");
    const nr = val(inv, "INVOICE_NUMBER") || "ohne Nr.";
    const date = val(inv, "INVOICE_DATE");
    const customer = name(inv);
    const total = money(inv, "TOTAL");
    const state = STATE_MAP[val(inv, "STATE")] || val(inv, "STATE");
    const due = val(inv, "DUE_DATE");
    const paid = val(inv, "PAID_DATE");
    const title = val(inv, "INVOICE_TITLE");
    const items = formatItemsList((inv.ITEMS || []) as R[]);
    const pdf = val(inv, "DOCUMENT_URL");

    let line = `${nr} | ${date} | ${customer} | ${total} | ${state}`;
    if (title) line += `\n  Titel: ${title}`;
    if (due) line += `\n  Fällig: ${due}`;
    if (paid) line += `\n  Bezahlt: ${paid}`;
    if (items) line += `\n${items}`;
    if (pdf) line += `\n  PDF: ${pdf}`;
    line += `\n  [ID: ${id}]`;
    return line;
  });

  return `Rechnungen (${invoices.length} Ergebnisse):\n\n${lines.join("\n\n")}`;
}

export function formatCustomers(response: R): string {
  const customers = (response.CUSTOMERS || []) as R[];
  if (customers.length === 0) return "Keine Kunden gefunden.";

  const lines = customers.map((c) => {
    const id = val(c, "CUSTOMER_ID");
    const nr = val(c, "CUSTOMER_NUMBER");
    const n = name(c);
    const email = val(c, "EMAIL");
    const city = val(c, "CITY");
    const country = val(c, "COUNTRY_CODE");
    const phone = val(c, "PHONE") || val(c, "MOBILE");
    const type = val(c, "CUSTOMER_TYPE");
    const payment = PAYMENT_TYPE_MAP[val(c, "PAYMENT_TYPE")] || "";

    let line = `${nr || "—"} | ${n} | ${type}`;
    if (city || country) line += ` | ${[city, country].filter(Boolean).join(", ")}`;
    if (email) line += `\n  E-Mail: ${email}`;
    if (phone) line += ` | Tel: ${phone}`;
    if (payment) line += `\n  Zahlung: ${payment}`;
    line += `\n  [ID: ${id}]`;
    return line;
  });

  return `Kunden (${customers.length} Ergebnisse):\n\n${lines.join("\n\n")}`;
}

export function formatContacts(response: R): string {
  const contacts = (response.CONTACTS || []) as R[];
  if (contacts.length === 0) return "Keine Kontakte gefunden.";

  const lines = contacts.map((c) => {
    const id = val(c, "CONTACT_ID");
    const custId = val(c, "CUSTOMER_ID");
    const n = name(c);
    const email = val(c, "EMAIL");
    const phone = val(c, "PHONE") || val(c, "MOBILE");
    const pos = val(c, "POSITION");

    let line = `${n}`;
    if (pos) line += ` (${pos})`;
    if (email) line += ` | ${email}`;
    if (phone) line += ` | ${phone}`;
    line += `\n  [ID: ${id}, Kunde: ${custId}]`;
    return line;
  });

  return `Kontakte (${contacts.length} Ergebnisse):\n\n${lines.join("\n\n")}`;
}

export function formatEstimates(response: R): string {
  const estimates = (response.ESTIMATES || []) as R[];
  if (estimates.length === 0) return "Keine Angebote gefunden.";

  const lines = estimates.map((est) => {
    const id = val(est, "ESTIMATE_ID");
    const nr = val(est, "ESTIMATE_NUMBER") || "ohne Nr.";
    const date = val(est, "ESTIMATE_DATE");
    const customer = name(est);
    const total = money(est, "TOTAL");
    const state =
      ESTIMATE_STATE_MAP[val(est, "STATE")] || val(est, "STATE");
    const due = val(est, "DUE_DATE");
    const items = formatItemsList((est.ITEMS || []) as R[]);
    const pdf = val(est, "DOCUMENT_URL");

    let line = `${nr} | ${date} | ${customer} | ${total} | ${state}`;
    if (due) line += `\n  Gültig bis: ${due}`;
    if (items) line += `\n${items}`;
    if (pdf) line += `\n  PDF: ${pdf}`;
    line += `\n  [ID: ${id}]`;
    return line;
  });

  return `Angebote (${estimates.length} Ergebnisse):\n\n${lines.join("\n\n")}`;
}

export function formatRecurring(response: R): string {
  const invoices = (response.INVOICES || []) as R[];
  if (invoices.length === 0)
    return "Keine wiederkehrenden Rechnungen gefunden.";

  const lines = invoices.map((inv) => {
    const id = val(inv, "INVOICE_ID");
    const customer = name(inv);
    const total = money(inv, "TOTAL");
    const freq = val(inv, "FREQUENCY");
    const start = val(inv, "START_DATE");
    const items = formatItemsList((inv.ITEMS || []) as R[]);

    let line = `${customer} | ${total} | ${freq} | ab ${start}`;
    if (items) line += `\n${items}`;
    line += `\n  [ID: ${id}]`;
    return line;
  });

  return `Wiederkehrende Rechnungen (${invoices.length} Ergebnisse):\n\n${lines.join("\n\n")}`;
}

export function formatRevenues(response: R): string {
  const invoices = (response.INVOICES || []) as R[];
  if (invoices.length === 0) return "Keine Einnahmen gefunden.";

  const lines = invoices.map((inv) => {
    const id = val(inv, "INVOICE_ID");
    const nr = val(inv, "INVOICE_NUMBER") || "—";
    const date = val(inv, "INVOICE_DATE");
    const customer = name(inv);
    const total = money(inv, "TOTAL");
    const state = STATE_MAP[val(inv, "STATE")] || val(inv, "STATE");

    let line = `${nr} | ${date} | ${customer} | ${total} | ${state}`;
    line += `\n  [ID: ${id}]`;
    return line;
  });

  return `Einnahmen (${invoices.length} Ergebnisse):\n\n${lines.join("\n\n")}`;
}

export function formatExpenses(response: R): string {
  const expenses = (response.EXPENSES || []) as R[];
  if (expenses.length === 0) return "Keine Ausgaben gefunden.";

  const lines = expenses.map((exp) => {
    const id = val(exp, "INVOICE_ID");
    const nr = val(exp, "INVOICE_NUMBER") || "—";
    const date = val(exp, "INVOICE_DATE");
    const org = val(exp, "ORGANIZATION");
    const total = money(exp, "TOTAL");
    const paid = val(exp, "PAID_DATE");
    const cat = val(exp, "CATEGORY");

    let line = `${nr} | ${date} | ${org} | ${total}`;
    if (cat) line += ` | ${cat}`;
    if (paid) line += ` | bezahlt: ${paid}`;
    line += `\n  [ID: ${id}]`;
    return line;
  });

  return `Ausgaben (${expenses.length} Ergebnisse):\n\n${lines.join("\n\n")}`;
}

export function formatArticles(response: R): string {
  const articles = (response.ARTICLES || []) as R[];
  if (articles.length === 0) return "Keine Artikel gefunden.";

  const lines = articles.map((art) => {
    const id = val(art, "ARTICLE_ID");
    const nr = val(art, "ARTICLE_NUMBER");
    const title = val(art, "TITLE");
    const price = money(art, "UNIT_PRICE");
    const vat = val(art, "VAT_PERCENT");
    const unit = val(art, "UNIT");
    const type = val(art, "TYPE");

    let line = `${nr} | ${title} | ${price}`;
    if (unit) line += ` / ${unit}`;
    if (vat) line += ` | ${vat}% MwSt.`;
    if (type) line += ` | ${type}`;
    line += `\n  [ID: ${id}]`;
    return line;
  });

  return `Artikel (${articles.length} Ergebnisse):\n\n${lines.join("\n\n")}`;
}

export function formatProjects(response: R): string {
  const projects = (response.PROJECTS || []) as R[];
  if (projects.length === 0) return "Keine Projekte gefunden.";

  const lines = projects.map((proj) => {
    const id = val(proj, "PROJECT_ID");
    const projName = val(proj, "PROJECT_NAME");
    const custId = val(proj, "CUSTOMER_ID");
    const hourPrice = val(proj, "HOUR_PRICE");
    const start = val(proj, "START_DATE");
    const end = val(proj, "END_DATE");
    const tasks = (proj.TASKS || []) as R[];

    let line = `${projName} | Kunde: ${custId}`;
    if (hourPrice && hourPrice !== "0") line += ` | ${hourPrice}€/h`;
    if (start) line += ` | ${start}`;
    if (end) line += ` – ${end}`;
    if (tasks.length > 0) {
      line += `\n  Tasks: ${tasks.map((t) => val(t, "TASK_NAME")).join(", ")}`;
    }
    line += `\n  [ID: ${id}]`;
    return line;
  });

  return `Projekte (${projects.length} Ergebnisse):\n\n${lines.join("\n\n")}`;
}

export function formatTimeEntries(response: R): string {
  const entries = (response.TIMES || []) as R[];
  if (entries.length === 0) return "Keine Zeiteinträge gefunden.";

  const lines = entries.map((t) => {
    const id = val(t, "TIME_ID");
    const date = val(t, "DATE");
    const start = val(t, "START_TIME");
    const end = val(t, "END_TIME");
    const mins = val(t, "MINUTES");
    const billable = val(t, "BILLABLE_MINUTES");
    const comment = val(t, "COMMENT");
    const projId = val(t, "PROJECT_ID");
    const custId = val(t, "CUSTOMER_ID");

    let line = `${date} | ${start}${end ? " – " + end : ""} | ${mins} Min.`;
    if (billable && billable !== mins) line += ` (${billable} abrechenbar)`;
    line += ` | Projekt: ${projId} | Kunde: ${custId}`;
    if (comment) line += `\n  ${comment}`;
    line += `\n  [ID: ${id}]`;
    return line;
  });

  return `Zeiteinträge (${entries.length} Ergebnisse):\n\n${lines.join("\n\n")}`;
}

export function formatItems(response: R): string {
  const items = (response.ITEMS || []) as R[];
  if (items.length === 0) return "Keine Positionen gefunden.";

  const lines = items.map((item) => {
    const id = val(item, "INVOICE_ITEM_ID");
    const desc = val(item, "DESCRIPTION");
    const qty = Number(item.QUANTITY || 1);
    const price = Number(item.UNIT_PRICE || 0);
    const vat = val(item, "VAT_PERCENT");
    const net = money(item, "COMPLETE_NET");
    const gross = money(item, "COMPLETE_GROSS");

    return `${desc} | ${qty}x ${price.toLocaleString("de-DE", { minimumFractionDigits: 2 })}€ | ${vat}% MwSt. | Netto: ${net} | Brutto: ${gross} [ID: ${id}]`;
  });

  return `Positionen (${items.length}):\n\n${lines.join("\n")}`;
}

export function formatDocuments(response: R): string {
  const folders = (response.FOLDERS || []) as R[];
  const documents = (response.DOCUMENTS || []) as R[];

  const parts: string[] = [];

  if (folders.length > 0) {
    const folderLines = folders.map((f) => {
      return `📁 ${val(f, "NAME")} (${val(f, "CONTENT_COUNT")} Dateien) [ID: ${val(f, "FOLDER_ID")}]`;
    });
    parts.push(`Ordner:\n${folderLines.join("\n")}`);
  }

  if (documents.length > 0) {
    const docLines = documents.map((d) => {
      return `${val(d, "TITLE") || "Ohne Titel"} | ${val(d, "DATE")} | ${val(d, "TYPE")} [ID: ${val(d, "DOCUMENT_ID")}]`;
    });
    parts.push(`Dokumente:\n${docLines.join("\n")}`);
  }

  if (parts.length === 0) return "Keine Dokumente gefunden.";
  return parts.join("\n\n");
}

export function formatTemplates(response: R): string {
  const templates = (response.TEMPLATES || []) as R[];
  if (templates.length === 0) return "Keine Vorlagen gefunden.";

  const lines = templates.map((t) => {
    return `${val(t, "TEMPLATE_NAME")} | Hash: ${val(t, "TEMPLATE_HASH")} [ID: ${val(t, "TEMPLATE_ID")}]`;
  });

  return `Vorlagen (${templates.length}):\n\n${lines.join("\n")}`;
}

export function formatWebhooks(response: R): string {
  const webhooks = (response.WEBHOOKS || []) as R[];
  if (webhooks.length === 0) return "Keine Webhooks konfiguriert.";

  const lines = webhooks.map((w) => {
    return `${val(w, "ENDPOINT")} | Events: ${val(w, "EVENTS")} [ID: ${val(w, "WEBHOOK_ID")}]`;
  });

  return `Webhooks (${webhooks.length}):\n\n${lines.join("\n")}`;
}
