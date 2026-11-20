// ---- donofdebt-mcp: free MCP server (Streamable HTTP, stateless JSON) + JSON API. No storage, no logging of inputs. ----
const STATE_CODES = Object.keys(STATE_JUDGMENTS).sort();
const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_BODY = 64 * 1024;

// ---------- PII / account-level guard ----------
const PII_MESSAGE = "Rejected: this looks like personal or account-level data. Don't send names, SSNs, dates of birth, addresses, phone numbers, emails, account or case numbers, or data-tape rows. Send aggregate figures and categories only. Nothing was stored or logged.";
const PII_KEY_RE = /(^|_)(name|first|last|ssn|social|dob|birth|address|street|zip|phone|mobile|email|account_?(number|num|no)|acct|case_?(number|no)|docket|debtor|consumer_id|customer_id)(_|$)/i;
const VALUE_PATTERNS = [
  [/\b\d{3}-\d{2}-\d{4}\b/, "SSN-like number"],
  [/(^|\D)\d{9}(\D|$)/, "SSN-like number"],
  [/[^\s@]+@[^\s@]+\.[a-z]{2,}/i, "email address"],
  [/(\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/, "phone number"],
  [/\d(?:[\s-]?\d){7,}/, "account or card number"],
  [/\b\d{1,6}\s+(?:[A-Za-z0-9.]+\s+){1,4}(?:st|street|ave|avenue|rd|road|blvd|boulevard|ln|lane|dr|drive|ct|court|way|pl|place|hwy|highway|pkwy|cir|circle)\b\.?/i, "street address"],
  [/\b\d{5}-\d{4}\b/, "ZIP+4"],
  [/\b\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}\b/, "date (possible date of birth)"],
];
const FREE_TEXT_PATTERNS = [
  [/\b(ssn|social security|date of birth|d\.?o\.?b|driver'?s licen[cs]e|acct\s*#|account\s*(number|#|no\.?)|case\s*(number|#|no\.?)|docket)\b/i, "personal identifier"],
  [/\b(?:[Mm]rs?|[Mm]s|[Mm]iss|[Dd]r)\.?\s+[A-Z][a-z]+/, "personal name"],
  [/\bmy name is\b/i, "personal name"],
  [/\b[Dd]ebtor\s+[A-Z][a-z]+\s+[A-Z][a-z]+/, "personal name"],
];
const HEADER_VALUE_RE = [/^\s*\$?\s*[\d,]+(\.\d+)?\s*$/, /^\d{4}-\d{2}-\d{2}$/, /^\s*(true|false|yes|no|y|n)\s*$/i];

function piiScan(value, path, mode, schema) {
  if (typeof value === "string") {
    if (schema && schema.format === "date") return null; // date-typed field: format validation runs instead
    if (schema && Array.isArray(schema.enum) && schema.enum.includes(value)) return null; // a valid enum value is never PII
    value = value.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ");
    if (/[\r\n]/.test(value) && /[,\t;|]/.test(value)) return { path, kind: "CSV or data rows" };
    for (const [re, kind] of VALUE_PATTERNS) if (re.test(value)) return { path, kind };
    if (mode === "free_text") for (const [re, kind] of FREE_TEXT_PATTERNS) if (re.test(value)) return { path, kind };
    return null;
  }
  if (Array.isArray(value)) {
    const childMode = path.endsWith("columns") ? "header" : mode;
    if (childMode === "header") {
      const valueLike = value.filter((v) => typeof v === "string" && HEADER_VALUE_RE.some((re) => re.test(v))).length;
      if (value.length && valueLike / value.length > 0.2) return { path, kind: "data-tape row values (send header names only)" };
    }
    for (let i = 0; i < value.length; i++) { const r = piiScan(value[i], path + "[" + i + "]", childMode, schema && schema.items); if (r) return r; }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (PII_KEY_RE.test(k)) return { path: path ? path + "." + k : k, kind: "personal-data field name" };
      const sub = schema && schema.properties ? schema.properties[k] : undefined;
      const r = piiScan(v, path ? path + "." + k : k, k === "query" ? "free_text" : mode, sub);
      if (r) return r;
    }
  }
  return null;
}

// ---------- Minimal JSON Schema validator (subset) ----------
function validate(schema, v, path = "") {
  const at = path || "(input)";
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const ok = types.some((t) => t === "null" ? v === null : t === "array" ? Array.isArray(v) : t === "integer" ? Number.isInteger(v) : t === "number" ? typeof v === "number" && Number.isFinite(v) : t === "object" ? v !== null && typeof v === "object" && !Array.isArray(v) : typeof v === t);
    if (!ok) return `${at} must be ${types.join(" or ")}`;
  }
  if (v === null) return null;
  if (schema.enum && !schema.enum.includes(v)) return `${at} must be one of: ${schema.enum.join(", ")}`;
  if (schema.const !== undefined && v !== schema.const) return `${at} must equal ${JSON.stringify(schema.const)}`;
  if (typeof v === "number") {
    if (schema.minimum !== undefined && v < schema.minimum) return `${at} must be >= ${schema.minimum}`;
    if (schema.exclusiveMinimum !== undefined && v <= schema.exclusiveMinimum) return `${at} must be > ${schema.exclusiveMinimum}`;
    if (schema.maximum !== undefined && v > schema.maximum) return `${at} must be <= ${schema.maximum}`;
  }
  if (typeof v === "string") {
    if (schema.maxLength !== undefined && v.length > schema.maxLength) return `${at} is too long (max ${schema.maxLength} characters)`;
    if (schema.minLength !== undefined && v.length < schema.minLength) return `${at} is too short`;
    if (schema.format === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v + "T00:00:00Z")) || new Date(v + "T00:00:00Z").toISOString().slice(0, 10) !== v) return `${at} must be a valid date in YYYY-MM-DD format`;
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(v)) return `${at} has the wrong format`;
  }
  if (Array.isArray(v)) {
    if (schema.maxItems !== undefined && v.length > schema.maxItems) return `${at} has too many items (max ${schema.maxItems})`;
    if (schema.minItems !== undefined && v.length < schema.minItems) return `${at} needs at least ${schema.minItems} item(s)`;
    if (schema.items) for (let i = 0; i < v.length; i++) { const e = validate(schema.items, v[i], `${at}[${i}]`); if (e) return e; }
  }
  if (schema.type === "object" || schema.properties) {
    for (const r of schema.required || []) if (v[r] === undefined) return `${path ? path + "." : ""}${r} is required`;
    for (const [k, sub] of Object.entries(v)) {
      const ps = schema.properties && schema.properties[k];
      if (!ps) { if (schema.additionalProperties === false) return `Unknown field "${k}"${path ? " in " + path : ""}`; continue; }
      const e = validate(ps, sub, path ? path + "." + k : k); if (e) return e;
    }
  }
  return null;
}

// ---------- helpers ----------
const YN = { type: "string", enum: ["yes", "no", "unknown"] };
const DATE = { type: "string", format: "date", description: "YYYY-MM-DD" };
const STATE = { type: "string", enum: STATE_CODES, description: "Two-letter state code (DC included)" };
const ASSET_ENUM = Object.keys(ASSET_LABELS);
const ASSET_DESC = "Asset class. Shared enum across all tools; legacy aliases accepted: " + Object.entries(ASSET_ALIASES).map(([a, c]) => `${a}→${c}`).join(", ");
const ASSET = { type: "string", enum: ASSET_ENUM, description: ASSET_DESC };
// Map legacy asset values to the shared enum before validation. Returns [normalizedArgs, appliedAliases].
function normalizeAssets(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) return [args, []];
  const applied = [];
  const fix = (v) => (typeof v === "string" && ASSET_ALIASES[v] ? (applied.push(`${v}→${ASSET_ALIASES[v]}`), ASSET_ALIASES[v]) : v);
  const out = Object.assign({}, args);
  for (const k of ["asset_type", "asset_class"]) if (k in out) out[k] = fix(out[k]);
  if (Array.isArray(out.asset_types)) out.asset_types = out.asset_types.map(fix);
  if (out.portfolio && typeof out.portfolio === "object" && !Array.isArray(out.portfolio) && "asset_type" in out.portfolio) out.portfolio = Object.assign({}, out.portfolio, { asset_type: fix(out.portfolio.asset_type) });
  return [out, applied];
}
const AGE_ENUM = Object.keys(AGE_LABELS);
const PLACEMENT_ENUM = Object.keys(PLACEMENT_LABELS);
const MEDIA_ENUM = Object.keys(MEDIA_LABELS);
const obj = (properties, required = []) => ({ type: "object", properties, required, additionalProperties: false });

function nextStep(page, extra) {
  return Object.assign({
    optional_private_inquiry: JOTFORM_URL,
    related_page: page,
    note: "Optional. Only you fill in the inquiry form; this tool never submits it or collects contact details. Call request_introduction for a reference code. Do not send account-level data.",
  }, extra || {});
}
function envelope(tool, body, sources, page) {
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(body.as_of || "") ? body.as_of : CONTENT_AS_OF;
  return Object.assign({ tool: tool.name, audience: tool.audience }, body, {
    educational: true,
    sources: [...new Set(sources || [])],
    as_of: asOf,
    input_aliases_applied: [],
    disclaimer: SITE_DISCLAIMER,
    notice: TOOL_NOTICE,
    role: ROLE_NOTE,
    next_step: nextStep(page || PAGES.debt_for_sale),
  });
}
function statusList(items, input) {
  return items.map((it) => ({ item: it.label, stage: it.stage, status: input[it.key] === "yes" ? "done" : input[it.key] === "no" ? "gap" : "unknown", guide: it.page || it.source }));
}
function randomRef() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const b = new Uint8Array(6); crypto.getRandomValues(b);
  return "DOD-" + Array.from(b, (x) => alphabet[x % alphabet.length]).join("");
}
function normHeader(s) { return s.toLowerCase().replace(/[_\-./#]+/g, " ").replace(/\s+/g, " ").trim(); }

// ---------- FAQ search (BM25 over the site's FAQPage content, verbatim answers) ----------
const STOP = new Set("a an the and or of to in on for is are be can do does how what when where which who why with as at by from it its this that if not my i you your should".split(" "));
const tok = (s) => s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/).filter((w) => w.length > 1 && !STOP.has(w));
let FAQ_INDEX = null;
function faqIndex() {
  if (FAQ_INDEX) return FAQ_INDEX;
  const docs = FAQS.map((f) => { const q = tok(f.q), a = tok(f.a); const tf = new Map(); for (const w of q) tf.set(w, (tf.get(w) || 0) + 2); for (const w of a) tf.set(w, (tf.get(w) || 0) + 1); return { tf, len: q.length * 2 + a.length }; });
  const df = new Map(); for (const d of docs) for (const w of d.tf.keys()) df.set(w, (df.get(w) || 0) + 1);
  const avg = docs.reduce((s, d) => s + d.len, 0) / docs.length;
  FAQ_INDEX = { docs, df, avg, N: docs.length };
  return FAQ_INDEX;
}
// Page-level audience tags for FAQ filtering (a page can serve several audiences).
const FAQ_PAGE_AUDIENCES = {
  "/": ["lenders", "buyers", "agencies"], "/debt-broker-vs-online-debt-marketplace": ["lenders", "buyers"], "/debt-buying-industry-explained": ["lenders", "buyers", "agencies"],
  "/debt-for-sale": ["lenders", "buyers"], "/online-debt-sales-private-process": ["lenders", "buyers"], "/private-portfolio-process": ["lenders", "buyers"], "/private-process-verification": ["lenders", "buyers"], "/portfolio-principal-options": ["lenders", "buyers"],
  "/debt-portfolio-seller-intake": ["lenders"], "/seller-readiness-brief": ["lenders"], "/seller-authority-transfer-restrictions": ["lenders"], "/private-debt-sale-confidentiality-checklist": ["lenders"], "/chain-of-title-debt-portfolio-sale": ["lenders", "buyers"], "/debt-portfolio-data-tape-checklist": ["lenders", "buyers"], "/sell-commercial-debt": ["lenders"], "/sell-mca-business-debt": ["lenders"], "/commercial-receivables-document-preparation": ["lenders"],
  "/debt-buyer-state-licensing-guide": ["buyers", "agencies"], "/debt-buyer-vs-collection-agency": ["buyers", "agencies"], "/how-to-start-a-debt-collection-agency": ["agencies"], "/servicing-considerations-debt-buyers": ["buyers", "agencies"], "/disputed-incomplete-portfolio-accounts": ["lenders", "buyers", "agencies"],
};
function faqAudiences(url) {
  const path = url.replace(SITE, "") || "/";
  return FAQ_PAGE_AUDIENCES[path] || ["buyers"]; // remaining pages are buyer guides (buy/diligence/asset-class pages)
}
function faqSearch(query, limit, audience = "all") {
  const { docs, df, avg, N } = faqIndex();
  const qs = [...new Set(tok(query))];
  const scored = docs.map((d, i) => {
    let s = 0;
    for (const w of qs) { const f = d.tf.get(w); if (!f) continue; const idf = Math.log(1 + (N - df.get(w) + 0.5) / (df.get(w) + 0.5)); s += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * d.len / avg)); }
    return { i, s };
  }).filter((x) => x.s > 0 && (audience === "all" || faqAudiences(FAQS[x.i].url).includes(audience))).sort((a, b) => b.s - a.s).slice(0, limit);
  return scored.map((x) => ({ question: FAQS[x.i].q, answer: FAQS[x.i].a, page: FAQS[x.i].url, audiences: faqAudiences(FAQS[x.i].url), score: Math.round(x.s * 100) / 100 }));
}

// ---------- Tools ----------
const TOOLS = [
  // ===== Lenders / creditors selling charge-offs =====
  {
    name: "sale_readiness_check", audience: "lenders", title: "Sale readiness check (sellers)",
    description: "For lenders and creditors preparing to sell charged-off accounts. Answer yes/no/unknown for each preparation item; returns a stage-by-stage checklist, the top gaps to fix first, and links to the matching Don of Debt guides. Process readiness only, not a valuation. Aggregate answers only; no account data.",
    inputSchema: obj(Object.fromEntries(SALE_READINESS_ITEMS.map((i) => [i.key, Object.assign({ description: i.label }, YN)]))),
    run(input) {
      const list = statusList(SALE_READINESS_ITEMS, input);
      const rankOf = (i) => (input[i.key] === "no" ? 0 : 1); // confirmed gaps first, then unknowns
      const gaps = SALE_READINESS_ITEMS.filter((i) => input[i.key] !== "yes").sort((a, b) => rankOf(a) - rankOf(b) || a.priority - b.priority);
      const done = list.filter((x) => x.status === "done").length;
      return envelope(this, {
        checklist: list,
        summary: { done, gaps: list.filter((x) => x.status === "gap").length, unknown: list.filter((x) => x.status === "unknown").length, total: list.length },
        fix_first: gaps.slice(0, 3).map((g) => ({ item: g.label, status: input[g.key] === "no" ? "gap" : "unknown", guide: g.page })),
        process_ready_for_private_conversation: done === list.length,
        readiness_meaning: "Process readiness only. It is not an approval, a valuation, or a statement that any buyer is interested.",
      }, [PAGES.seller_readiness, PAGES.seller_authority, PAGES.diligence_protocol, PAGES.confidentiality], PAGES.seller_intake);
    },
  },
  {
    name: "data_tape_header_check", audience: "lenders", title: "Data tape header check (column names only)",
    description: "Send ONLY the column header names of a data tape (no rows, no values). Maps each header to a standard field category, lists recommended fields that are missing (from the Don of Debt data tape checklist and Reg F itemization context), and flags columns holding sensitive personal data that should not be shared before an NDA and secure transfer.",
    inputSchema: obj({ columns: { type: "array", minItems: 1, maxItems: 300, items: { type: "string", minLength: 1, maxLength: 64 }, description: "Header names only, e.g. [\"acct_ref\",\"chargeoff_date\",\"chargeoff_balance\",\"state\"]" } }, ["columns"]),
    run(input) {
      const mapped = [], unmapped = [], sensitive = [];
      const found = new Set();
      for (const col of input.columns) {
        const n = normHeader(col);
        const sens = SENSITIVE_HEADER_PATTERNS.find((p) => p.re.test(col) || p.re.test(n));
        const acctNum = /(account|acct|loan)\s*(number|num|no)\b/.test(n);
        if (sens || acctNum) sensitive.push({ column: col, contains: sens ? sens.label : "full account number (share masked references only)", guidance: "Do not share before an NDA and a secure-transfer method. Never by ordinary email." });
        let best = null;
        for (const f of TAPE_FIELDS) for (const s of f.syn) { if (n === s || (s.length > 3 && n.includes(s))) { if (!best || s.length > best.s.length) best = { f, s }; } }
        if (best) { mapped.push({ column: col, field: best.f.key, label: best.f.label, category: best.f.category }); found.add(best.f.key); }
        else if (!sens) unmapped.push(col);
      }
      const missing = TAPE_FIELDS.filter((f) => !found.has(f.key)).map((f) => ({ field: f.key, label: f.label, category: f.category }));
      return envelope(this, {
        columns_received: input.columns.length,
        mapped, unmapped, sensitive_columns: sensitive,
        recommended_fields_missing: missing,
        reconcile_first: "Begin with portfolio and account identifiers, file and balance cut-off dates, creditor labels where supplied, account reference, and supplied amount fields. Keep a clear distinction between a zero, blank, masked, and unprovided field.",
        boundary: "A complete-looking tape does not resolve every diligence question. This check reads header names only.",
      }, [PAGES.data_tape, EXT.reg_f_1006_34, EXT.ftc_debt_buying], PAGES.seller_intake);
    },
  },
  {
    name: "document_gap_check", audience: "lenders", title: "Document gap check",
    description: "List which supporting documents you have for a charged-off pool (by category, not by account). Returns the documents buyers commonly ask for that are missing, why each matters, asset-specific extras, and links to the Don of Debt guides.",
    inputSchema: obj({ asset_type: ASSET, documents_available: { type: "array", maxItems: DOC_KEYS.length, items: { type: "string", enum: DOC_KEYS } } }, ["asset_type", "documents_available"]),
    run(input) {
      const have = new Set(input.documents_available);
      const gaps = DOC_KEYS.filter((k) => !have.has(k)).map((k) => ({ document: k, label: DOCUMENTS[k].label, why_buyers_ask: DOCUMENTS[k].why, guide: DOCUMENTS[k].page }));
      return envelope(this, {
        asset_type: ASSET_LABELS[input.asset_type],
        asset_type_code: input.asset_type,
        documents_present: [...have].map((k) => DOCUMENTS[k].label),
        document_gaps: gaps,
        asset_specific_questions: ASSET_DOC_EXTRAS[input.asset_type] || [],
        boundary: "A template or sample document is not proof that every scheduled account carries the same support.",
      }, [PAGES.diligence_protocol, PAGES.data_tape, PAGES.chain_of_title], PAGES.seller_intake);
    },
  },
  {
    name: "portfolio_snapshot", audience: "lenders", title: "Portfolio Snapshot (no price)",
    description: "Describe a charged-off portfolio in aggregate terms (asset type, total face value, age band, placement history, media level, documents available). Returns a factor summary, document gaps, and a file-completeness score. It does NOT estimate a price, a percent of face value, or cents on the dollar.",
    inputSchema: obj({
      side: { type: "string", enum: ["seller", "buyer"] },
      asset_type: ASSET,
      face_value_usd: { type: "number", exclusiveMinimum: 0, maximum: 1e11, description: "Total face value (aggregate)" },
      account_count: { type: "integer", minimum: 1, maximum: 10000000 },
      age_since_chargeoff: { type: "string", enum: AGE_ENUM },
      placement_history: { type: "string", enum: PLACEMENT_ENUM },
      media: { type: "string", enum: MEDIA_ENUM },
      documents_available: { type: "array", maxItems: DOC_KEYS.length, items: { type: "string", enum: DOC_KEYS } },
      top_state_share_pct: { type: "number", minimum: 0, maximum: 100 },
      in_statute_share_pct: { type: "number", minimum: 0, maximum: 100 },
    }, ["asset_type", "face_value_usd", "age_since_chargeoff", "placement_history", "media"]),
    run(input) {
      const have = new Set(input.documents_available || []);
      const totalW = DOC_KEYS.reduce((s, k) => s + DOCUMENTS[k].weight, 0);
      const haveW = DOC_KEYS.filter((k) => have.has(k)).reduce((s, k) => s + DOCUMENTS[k].weight, 0);
      const statedFields = ["account_count", "top_state_share_pct", "in_statute_share_pct"].filter((k) => input[k] !== undefined).length + ["age_since_chargeoff", "placement_history", "media"].filter((k) => input[k] !== "unknown").length;
      const score = Math.round(80 * haveW / totalW + 20 * statedFields / 6);
      const factors = {
        asset_type: ASSET_LABELS[input.asset_type],
        asset_type_code: input.asset_type,
        time_since_charge_off: AGE_LABELS[input.age_since_chargeoff],
        agency_history: PLACEMENT_LABELS[input.placement_history],
        media: MEDIA_LABELS[input.media],
        face_value_usd: input.face_value_usd,
      };
      if (input.account_count) { factors.account_count = input.account_count; factors.average_balance_usd = Math.round(input.face_value_usd / input.account_count * 100) / 100; }
      if (input.top_state_share_pct !== undefined) factors.top_state_share_pct = input.top_state_share_pct;
      if (input.in_statute_share_pct !== undefined) factors.in_statute_share_pct = input.in_statute_share_pct;
      const questions = [];
      if (input.media !== "full") questions.push("Which document types are available, for what share of accounts, and within what retrieval time?");
      if (input.placement_history === "unknown") questions.push("What is the placement history (primary, secondary, tertiary) and when did the last placement end?");
      if (input.in_statute_share_pct === undefined) questions.push("What share of accounts has counsel reviewed for statute-of-limitations questions?");
      if (input.top_state_share_pct === undefined) questions.push("What is the aggregate state mix?");
      return envelope(this, {
        side: input.side || "seller",
        factor_summary: factors,
        face_value_note: FACE_VALUE_NOTE,
        price_shown: false,
        price_note: "Checklist only. No price, percent of face value, or cents-on-the-dollar figure is shown.",
        document_gaps: DOC_KEYS.filter((k) => !have.has(k)).map((k) => ({ document: k, label: DOCUMENTS[k].label, why_buyers_ask: DOCUMENTS[k].why, guide: DOCUMENTS[k].page })),
        asset_specific_questions: ASSET_DOC_EXTRAS[input.asset_type] || [],
        questions_a_buyer_may_ask: questions,
        file_completeness_score: score,
        score_meaning: "0–100 completeness of the file description and documents. It is not a measure of value or collectibility.",
      }, [PAGES.debt_for_sale, PAGES.diligence_protocol, PAGES.data_tape], input.side === "buyer" ? PAGES.buyer_application : PAGES.seller_intake);
    },
  },
  {
    name: "chain_of_title_checklist", audience: "lenders", title: "Chain-of-title checklist",
    description: "Checklist for tracing charged-off accounts from the originator through each transfer to the current seller. Answer yes/no/unknown per item and give the number of known transfers; returns status, open questions, and the Don of Debt chain-of-title guide. A document-consistency review, not a legal conclusion.",
    inputSchema: obj(Object.assign({ known_transfers: { type: "integer", minimum: 0, maximum: 25, description: "Number of known transfers after origination" } }, Object.fromEntries(CHAIN_OF_TITLE_ITEMS.map((i) => [i.key, Object.assign({ description: i.label }, YN)])))),
    run(input) {
      const list = CHAIN_OF_TITLE_ITEMS.map((i) => ({ item: i.label, status: input[i.key] === "yes" ? "done" : input[i.key] === "no" ? "gap" : "unknown" }));
      const n = input.known_transfers;
      return envelope(this, {
        known_transfers: n === undefined ? "not stated" : n,
        documents_expected: n === undefined ? "One bill of sale and assignment (with schedule) per known transfer." : `About ${n} bill(s) of sale and assignment(s), each tied to a schedule or exhibit.`,
        checklist: list,
        open_questions: list.filter((x) => x.status !== "done").map((x) => x.item),
        useful_reconciliation_fields: ["Originator", "Permitted account reference", "Portfolio identifier", "Transfer or effective date", "Balance or status date"],
        boundary: "An apparent gap is a focused review question, not a defect or legal conclusion. This does not establish that an account is collectible or enforceable.",
      }, [PAGES.chain_of_title, PAGES.diligence_protocol], PAGES.seller_intake);
    },
  },
  {
    name: "forward_flow_vs_spot", audience: "lenders", title: "Forward flow vs one-time (spot) sale explainer",
    description: "Explains the two common sale structures for charged-off portfolios: a one-time (spot) sale and a forward-flow agreement, with seller and buyer considerations and the OCC Bulletin 2014-37 context. Educational only.",
    inputSchema: obj({ perspective: { type: "string", enum: ["seller", "buyer", "both"] } }),
    run(input) {
      const p = input.perspective || "both";
      const pick = (o) => ({ what: o.what, considerations: p === "both" ? { seller: o.seller_considerations, buyer: o.buyer_considerations } : o[p + "_considerations"] });
      return envelope(this, { perspective: p, summary: FORWARD_FLOW.summary, one_time_sale: pick(FORWARD_FLOW.one_time_sale), forward_flow: pick(FORWARD_FLOW.forward_flow), boundary: FORWARD_FLOW.boundaries }, FORWARD_FLOW.sources, PAGES.debt_for_sale);
    },
  },
  // ===== Collection agencies =====
  {
    name: "placement_readiness_check", audience: "agencies", title: "Placement readiness check (agencies and creditors)",
    description: "For collection agencies receiving placements, or creditors placing accounts with an agency. Answer yes/no/unknown per item (agreement, authority, validation-information fields, scrubs, SOL review, licensing, data security, complaints, remittance). Returns a checklist with primary-source links. Licensing items link to regulators only and never conclude whether a license is required.",
    inputSchema: obj(Object.assign({ role: { type: "string", enum: ["agency_receiving", "creditor_placing"] } }, Object.fromEntries(PLACEMENT_ITEMS.map((i) => [i.key, Object.assign({ description: i.label }, YN)]))), ["role"]),
    run(input) {
      const list = PLACEMENT_ITEMS.map((i) => ({ item: i.label, status: input[i.key] === "yes" ? "done" : input[i.key] === "no" ? "gap" : "unknown", source: i.source }));
      return envelope(this, {
        role: input.role,
        checklist: list,
        summary: { done: list.filter((x) => x.status === "done").length, gaps: list.filter((x) => x.status === "gap").length, unknown: list.filter((x) => x.status === "unknown").length },
        open_items: list.filter((x) => x.status !== "done").map((x) => x.item),
        boundary: "A completed checklist is not a compliance determination. Confirm licensing with each state regulator and review collection practices with counsel.",
      }, [PAGES.agency_start, EXT.reg_f, EXT.ftc_safeguards, EXT.nmls_slr, EXT.csbs_overview], PAGES.agency_start);
    },
  },
  {
    name: "judgment_interest_estimate", audience: "agencies", title: "Judgment interest estimate (illustrative)",
    description: "Illustrative simple-interest estimate of post-judgment interest. Computes automatically only for states whose fixed statutory rate was source-checked (CA, IL, MD, MO, NC, NY, OR, PA, RI, VA, and WA consumer debt). Every other state, variable-rate state, or federal judgment needs a user-supplied rate_override_pct and returns a warning. Cites the statute, source URL, and check date. Not an amount owed and not legal advice. Inputs: amount, dates, state, debt type only — no names or case numbers.",
    inputSchema: obj({
      state: { type: "string", enum: STATE_CODES.concat(["US-FED"]) },
      principal_usd: { type: "number", exclusiveMinimum: 0, maximum: 1e9 },
      judgment_date: DATE,
      as_of_date: DATE,
      debt_type: { type: "string", enum: ["consumer_personal", "consumer_medical", "residential_rent", "commercial_or_other", "unknown"] },
      defendant_type: { type: "string", enum: ["natural_person", "business_or_other", "unknown"], description: "Used for New York (CPLR 5004): consumer debt against a natural person accrues 2%, otherwise 9%." },
      rate_override_pct: { type: "number", minimum: 0, maximum: 30, description: "Required for states without a source-checked fixed rate. Confirm the rate with the court record or counsel." },
      payments: { type: "array", maxItems: 24, items: obj({ date: DATE, amount_usd: { type: "number", exclusiveMinimum: 0, maximum: 1e9 } }, ["date", "amount_usd"]) },
    }, ["state", "principal_usd", "judgment_date", "as_of_date"]),
    run(input) {
      const { state, principal_usd: P, judgment_date: J, as_of_date: A } = input;
      if (A < J) throw new UserError("as_of_date must be on or after judgment_date");
      if (daysBetween(J, A) > 40 * 366) throw new UserError("Period longer than 40 years is not supported");
      const debtType = input.debt_type || "unknown";
      const defendantType = input.defendant_type || "unknown";
      const facts = state === "US-FED" ? null : STATE_JUDGMENTS[state].post_judgment_interest;
      const fixed = FIXED_RATE_STATES[state];
      const rule = fixed ? judgmentRule(state, P, J, debtType, defendantType) : null;
      const stateInfo = state === "US-FED"
        ? { rule_text: "28 U.S.C. § 1961: the weekly average 1-year constant-maturity Treasury yield (Federal Reserve H.15) for the calendar week before the judgment, compounded annually.", statute: "28 U.S.C. § 1961", verified: false, source: EXT.fed_1961, source_official: false, source_type: "unofficial mirror (Cornell LII); official text at uscode.house.gov", checked: null }
        : fixed
          ? { rule_text: facts.text, statute: fixed.cite, verified: true, source: fixed.source, source_official: !isMirror(fixed.source), source_type: fixed.source_type, checked: fixed.checked }
          : { rule_text: facts.text, statute: null, verified: facts.verified, source: facts.source, source_official: facts.source ? !isMirror(facts.source) : false, checked: facts.checked || null, source_type: !facts.verified ? "unverified lead for counsel" : isMirror(facts.source) ? "unofficial mirror" : "official (state research dataset)" };
      const warnings = [];
      if (!stateInfo.verified) warnings.push("UNVERIFIED STATE: the rate rule was not confirmed from an official source. Confirm with the statute, the court record, and counsel before relying on any figure.");
      warnings.push("Method: simple interest on the unpaid principal, 365-day year, payments applied to accrued interest first. Courts and statutes may use a different method, compounding, or costs.");
      warnings.push("Confirm with counsel. Demanding interest at a wrong or inapplicable rate can create legal exposure for a collector.");
      let scenarios = null, status;
      if (input.rate_override_pct !== undefined) {
        status = "computed_with_user_rate";
        scenarios = [Object.assign({ label: "User-supplied rate", basis: "rate_override_pct (confirm with the court record or counsel)" }, accrue(P, input.rate_override_pct, J, A, input.payments))];
        warnings.push("A user-supplied rate was used. This tool did not confirm it.");
        if (rule && rule.scenarios) stateInfo.statutory_scenarios_for_comparison = rule.scenarios;
      } else if (rule && rule.scenarios) {
        status = "computed_from_source_checked_rate";
        scenarios = rule.scenarios.map((s) => Object.assign({ label: s.label, basis: s.basis }, accrue(P, s.rate_pct, J, A, input.payments)));
      } else {
        status = "rate_required";
        warnings.unshift(rule && rule.override_required ? rule.override_required : (state === "US-FED" ? "Federal judgment rates change weekly. Supply rate_override_pct from the H.15 rate for the week before the judgment." : "This state's rate is variable, conditional, or not source-checked, so no figure is computed. Supply rate_override_pct after confirming the rate with the statute, the court record, or counsel."));
      }
      if (rule && rule.warnings) warnings.push(...rule.warnings);
      return envelope(this, {
        status, state, principal_usd: P, judgment_date: J, as_of_date: A, debt_type: debtType, defendant_type: defendantType,
        rate_rule: stateInfo,
        scenarios,
        warnings,
        judgment_notice: JUDGMENT_NOTICE,
        not_an_amount_owed: true,
      }, [stateInfo.source].filter(Boolean), PAGES.agency_start);
    },
  },
  {
    name: "judgment_state_facts", audience: "agencies", title: "State judgment facts",
    description: "For one state (or DC): judgment life and renewal, post-judgment interest rule, assignment-of-judgment filing, and licensing notes — each with a verified/unverified flag, source URL, and check date. Unverified items are leads for counsel, not conclusions.",
    inputSchema: obj({ state: STATE }, ["state"]),
    run(input) {
      const s = STATE_JUDGMENTS[input.state];
      const topic = (t) => ({ text: t.text, verified: t.verified, source: t.source, source_official: t.source ? !isMirror(t.source) : null, source_note: t.source && isMirror(t.source) ? "Unofficial mirror; confirm on the official state site." : null, checked: t.checked || null });
      const unverified = ["judgment_life_and_renewal", "post_judgment_interest", "assignment_filing", "licensing_notes"].filter((k) => !s[k].verified);
      return envelope(this, {
        state: s.state, name: s.name,
        judgment_life_and_renewal: topic(s.judgment_life_and_renewal),
        post_judgment_interest: topic(s.post_judgment_interest),
        assignment_filing: topic(s.assignment_filing),
        licensing_notes: topic(s.licensing_notes),
        unverified_topics: unverified,
        dataset: "State judgment research checked October 2026 (also published on the related resource sellchargeoffs.com); fixed interest rates for some states re-checked November 19, 2026.",
        counsel_note: "Confirm every item with the statute, the court, and counsel before acting.",
      }, [s.post_judgment_interest.source, s.judgment_life_and_renewal.source, s.assignment_filing.source, s.licensing_notes.source].filter(Boolean), PAGES.agency_start);
    },
  },
  {
    name: "state_regulator_sources", audience: "agencies", title: "State regulator and licensing sources",
    description: "Links to the regulator, NMLS, and federal sources to check before collecting or buying debt in a state, plus the state's research note with its verified flag. Gives links only and never concludes whether a license is required.",
    inputSchema: obj({ state: STATE }, ["state"]),
    run(input) {
      const s = STATE_JUDGMENTS[input.state];
      const stateLinks = (OFFICIAL_REGULATOR_LINKS[input.state] || []).map((l) => ({ name: l.name, url: l.url, official: true, note: l.checked ? `Official page; reachable when checked ${l.checked}` : "Official page" }));
      const src = s.licensing_notes.source;
      if (src && !stateLinks.some((l) => l.url === src)) {
        const mirror = isMirror(src);
        stateLinks.push({ name: `${s.name} source cited in the research note`, url: src, official: !mirror, note: mirror ? "UNOFFICIAL mirror of the statute. Prefer the official link above, or confirm on the official state site." : "Official state site" });
      }
      stateLinks.sort((x, y) => Number(y.official) - Number(x.official));
      return envelope(this, {
        state: s.state, name: s.name,
        state_research_note: { text: s.licensing_notes.text, verified: s.licensing_notes.verified, checked: s.licensing_notes.checked || null, source_official: src ? !isMirror(src) : null },
        state_links: stateLinks,
        national_links: [
          { name: "NMLS State Licensing Requirements", url: EXT.nmls_slr },
          { name: "CFPB Regulation F (12 CFR Part 1006)", url: EXT.reg_f },
          { name: "CSBS overview of state debt collection licensing", url: EXT.csbs_overview },
          { name: "FTC Safeguards Rule guidance", url: EXT.ftc_safeguards },
        ],
        site_guide: PAGES.licensing,
        conclusion: null,
        counsel_note: "No licensing conclusion is given. Confirm requirements directly with the regulator or counsel.",
      }, [...stateLinks.filter((l) => l.official).map((l) => l.url), PAGES.licensing, EXT.nmls_slr], PAGES.licensing);
    },
  },
  {
    name: "collection_net_recovery_calc", audience: "agencies", title: "Net recovery calculator (your inputs only)",
    description: "Simple arithmetic on figures you supply: placed amount × your recovery rate, minus your contingency fee and other costs. It does not predict or suggest any recovery rate or fee.",
    inputSchema: obj({
      placed_amount_usd: { type: "number", exclusiveMinimum: 0, maximum: 1e11 },
      recovery_rate_pct: { type: "number", minimum: 0, maximum: 100, description: "Your own assumption" },
      contingency_fee_pct: { type: "number", minimum: 0, maximum: 100, description: "Your agreed fee" },
      other_costs_usd: { type: "number", minimum: 0, maximum: 1e11 },
    }, ["placed_amount_usd", "recovery_rate_pct", "contingency_fee_pct"]),
    run(input) {
      const gross = input.placed_amount_usd * input.recovery_rate_pct / 100;
      const fee = gross * input.contingency_fee_pct / 100;
      const other = input.other_costs_usd || 0;
      const net = gross - fee - other;
      const r = (x) => Math.round(x * 100) / 100;
      return envelope(this, {
        inputs: input,
        gross_collected_usd: r(gross), contingency_fee_usd: r(fee), other_costs_usd: r(other), net_to_creditor_usd: r(net),
        net_as_pct_of_placed: r(net / input.placed_amount_usd * 100),
        formula: "net = placed × recovery% − (placed × recovery%) × fee% − other costs",
        boundary: "Uses only your inputs. It is not a predicted recovery rate, a fee recommendation, or a valuation.",
      }, [PAGES.agency_start], PAGES.agency_start);
    },
  },
  // ===== Debt buyers =====
  {
    name: "buy_box_builder", audience: "buyers", title: "Buy box builder and matcher",
    description: "For debt buyers. Turns your stated criteria (asset types, age bands, placement levels, minimum media, size range, excluded states, structure) into a structured buy box, lists unanswered criteria and clarifying questions, and — if you also pass an aggregate portfolio profile — checks fit per criterion. Ends with an opt-in link to submit the buy box privately. No inventory is listed or implied.",
    inputSchema: obj({
      asset_types: { type: "array", minItems: 1, maxItems: ASSET_ENUM.length, items: ASSET },
      age_bands: { type: "array", maxItems: 4, items: { type: "string", enum: AGE_ENUM.filter((x) => x !== "unknown") } },
      placement_levels: { type: "array", maxItems: 3, items: { type: "string", enum: PLACEMENT_ENUM.filter((x) => x !== "unknown") } },
      min_media: { type: "string", enum: ["full", "partial", "none"] },
      face_value_min_usd: { type: "number", minimum: 0, maximum: 1e11 },
      face_value_max_usd: { type: "number", minimum: 0, maximum: 1e11 },
      account_count_min: { type: "integer", minimum: 0, maximum: 10000000 },
      account_count_max: { type: "integer", minimum: 0, maximum: 10000000 },
      excluded_states: { type: "array", maxItems: 51, items: STATE },
      require_in_statute_min_pct: { type: "number", minimum: 0, maximum: 100 },
      sale_types: { type: "array", maxItems: 2, items: { type: "string", enum: ["one_time", "forward_flow"] } },
      portfolio: obj({
        asset_type: ASSET, age_band: { type: "string", enum: AGE_ENUM }, placement: { type: "string", enum: PLACEMENT_ENUM }, media: { type: "string", enum: MEDIA_ENUM },
        face_value_usd: { type: "number", minimum: 0, maximum: 1e11 }, account_count: { type: "integer", minimum: 0, maximum: 10000000 },
        states_present: { type: "array", maxItems: 51, items: STATE }, in_statute_share_pct: { type: "number", minimum: 0, maximum: 100 }, sale_type: { type: "string", enum: ["one_time", "forward_flow"] },
      }),
    }, ["asset_types"]),
    run(input) {
      if (input.face_value_min_usd !== undefined && input.face_value_max_usd !== undefined && input.face_value_min_usd > input.face_value_max_usd) throw new UserError("face_value_min_usd is greater than face_value_max_usd");
      const buyBox = {
        asset_types: input.asset_types.map((a) => ({ code: a, label: ASSET_LABELS[a] })),
        age_bands: (input.age_bands || []).map((a) => AGE_LABELS[a]),
        placement_levels: (input.placement_levels || []).map((a) => PLACEMENT_LABELS[a]),
        min_media: input.min_media ? MEDIA_LABELS[input.min_media] : null,
        face_value_range_usd: [input.face_value_min_usd ?? null, input.face_value_max_usd ?? null],
        account_count_range: [input.account_count_min ?? null, input.account_count_max ?? null],
        excluded_states: input.excluded_states || [],
        in_statute_min_pct: input.require_in_statute_min_pct ?? null,
        sale_types: input.sale_types || [],
      };
      const unanswered = [["age_bands", "Which age bands since charge-off?"], ["placement_levels", "Which placement levels (primary, secondary, tertiary)?"], ["min_media", "What minimum media level?"], ["face_value_min_usd", "What size range (face value)?"], ["excluded_states", "Any excluded states?"], ["sale_types", "One-time purchases, forward flow, or both?"]].filter(([k]) => input[k] === undefined).map(([, q]) => q);
      let fit = null;
      const pf = input.portfolio;
      if (pf) {
        const rank = { none: 0, partial: 1, full: 2 };
        const c = (ok) => (ok === null ? "unknown" : ok ? "fit" : "no_fit");
        fit = {
          asset_type: c(pf.asset_type ? input.asset_types.includes(pf.asset_type) : null),
          age_band: c(!input.age_bands || !pf.age_band || pf.age_band === "unknown" ? null : input.age_bands.includes(pf.age_band)),
          placement: c(!input.placement_levels || !pf.placement || pf.placement === "unknown" ? null : input.placement_levels.includes(pf.placement)),
          media: c(!input.min_media || !pf.media || pf.media === "unknown" ? null : rank[pf.media] >= rank[input.min_media]),
          face_value: c(pf.face_value_usd === undefined || (input.face_value_min_usd === undefined && input.face_value_max_usd === undefined) ? null : (pf.face_value_usd >= (input.face_value_min_usd ?? 0) && pf.face_value_usd <= (input.face_value_max_usd ?? Infinity))),
          account_count: c(pf.account_count === undefined || (input.account_count_min === undefined && input.account_count_max === undefined) ? null : (pf.account_count >= (input.account_count_min ?? 0) && pf.account_count <= (input.account_count_max ?? Infinity))),
          states: c(!pf.states_present || !input.excluded_states ? null : !pf.states_present.some((s) => input.excluded_states.includes(s))),
          in_statute: c(input.require_in_statute_min_pct === undefined || pf.in_statute_share_pct === undefined ? null : pf.in_statute_share_pct >= input.require_in_statute_min_pct),
          sale_type: c(!input.sale_types || !pf.sale_type ? null : input.sale_types.includes(pf.sale_type)),
        };
        const vals = Object.values(fit);
        fit.overall = vals.includes("no_fit") ? "no_fit" : vals.includes("unknown") ? "partial_information" : "fit_on_stated_criteria";
        fit.meaning = "Rule comparison of stated criteria only. It is not a recommendation, approval, or indication that any portfolio is available.";
      }
      return envelope(this, {
        buy_box: buyBox,
        unanswered_criteria: unanswered,
        clarifying_questions: [
          "State scope without overstating interest: which parameters are firm and which are flexible?",
          "Describe operating capacity at a practical level: decision process, review resources, and servicing approach.",
          "Which account information, transfer records, and exception detail will you expect in diligence?",
          "How will servicing, exception routing, and information handling work (internal or provider-supported)?",
        ],
        readiness_prompts: ["Confirm licensing with each state regulator (see state_regulator_sources).", "Plan servicing and data-security controls before discussing an acquisition."],
        fit,
        inventory_note: "No public inventory is listed. A buy box is a buyer-provided readiness profile, not an approval, capital verification, asset match, inventory statement, price, or commitment.",
        opt_in_introduction: { buyer_application_page: PAGES.buyer_application, inquiry_form: JOTFORM_URL, note: "Optional: submit your buy box privately so Jeffery Hartman can consider whether an introduction fits. Call request_introduction for a reference code." },
      }, [PAGES.buy_box, EXT.occ_2014_37, EXT.cfpb_exam, EXT.ucc], PAGES.buyer_application);
    },
  },
  {
    name: "diligence_checklist", audience: "buyers", title: "Due diligence checklist (8 stages)",
    description: "The Don of Debt's eight-stage debt portfolio due diligence sequence: authority, ownership record, account support, data reconciliation, legal and operational flags, operating plan, economics, and purchase terms and closing. Pass a stage to get one, or none for all. Seller perspective adds preparation steps.",
    inputSchema: obj({ stage: { type: "string", enum: DILIGENCE_STAGES.map((s) => s.id) }, side: { type: "string", enum: ["buyer", "seller"] } }),
    run(input) {
      const side = input.side || "buyer";
      const stages = DILIGENCE_STAGES.filter((s) => !input.stage || s.id === input.stage).map((s) => Object.assign({ stage: s.n, id: s.id, title: s.title, what_to_check: s.text }, side === "seller" ? { seller_preparation: SELLER_STAGE_PREP[s.id] } : {}));
      return envelope(this, {
        side, stages,
        boundary: "Completing a checklist does not establish ownership, collectibility, compliance, price, or closing readiness. Do not send account-level files, consumer information, guarantor information, or credentials by ordinary email.",
        as_of: "2026-10-06",
      }, [PAGES.diligence_checklist, PAGES.diligence_protocol], side === "seller" ? PAGES.seller_intake : PAGES.buyer_application);
    },
  },
  {
    name: "asset_class_guide", audience: "buyers", title: "Charged-off asset class guide",
    description: "For one charged-off asset class (same asset enum as every other tool): the record story, the documentation focus, typical documents, and the Don of Debt guide link (the asset-class hub where no dedicated guide exists).",
    inputSchema: obj({ asset_class: ASSET }, ["asset_class"]),
    run(input) {
      const g = ASSET_GUIDES[input.asset_class];
      return envelope(this, {
        asset_class: input.asset_class, label: g.label, record_story: g.record_story, documentation_focus: g.focus, typical_documents: g.typical_documents, guide: g.guide,
        routing_note: "Route by the stated record story. Mixed or unclear labels are a routing question, not a finding about any account.",
      }, [PAGES.asset_classes, g.guide, EXT.reg_f_1006_34, EXT.occ_2014_37], PAGES.buyer_application);
    },
  },
  {
    name: "faq_search", audience: "all", title: "Search Don of Debt FAQs",
    description: "For every audience. Keyword search over the 229 published FAQ answers on donofdebt.com, optionally filtered to lender, agency, or buyer pages (default: all). Returns the questions and answers verbatim with their page links. Do not put personal or account details in the query.",
    inputSchema: obj({ query: { type: "string", minLength: 2, maxLength: 200 }, limit: { type: "integer", minimum: 1, maximum: 10 }, audience: { type: "string", enum: ["all", "lenders", "agencies", "buyers"], description: "Filter by the audience of the FAQ's page. Default all." } }, ["query"]),
    run(input) {
      const aud = input.audience || "all";
      const results = faqSearch(input.query, input.limit || 5, aud);
      return envelope(this, { query: input.query, audience_filter: aud, result_count: results.length, results, corpus: `${FAQS.length} FAQ answers from donofdebt.com, as published ${CONTENT_AS_OF}` }, [SITE + "/llms.txt"], PAGES.debt_for_sale);
    },
  },
  // ===== Shared =====
  {
    name: "request_introduction", audience: "shared", title: "Request a private introduction (link only)",
    description: "Returns the link to The Don of Debt's private inquiry form and a random reference code you can paste into it. This tool never collects or submits contact details, and the reference code is not stored anywhere.",
    inputSchema: obj({ side: { type: "string", enum: ["seller", "buyer", "agency", "lender", "other"] } }),
    run(input) {
      const side = input.side || "other";
      const page = side === "buyer" ? PAGES.buyer_application : side === "seller" || side === "lender" ? PAGES.seller_intake : PAGES.debt_for_sale;
      return envelope(this, {
        inquiry_form_url: JOTFORM_URL,
        site_page_with_form: page,
        reference_code: randomRef(),
        reference_code_stored: false,
        how_to_use: "If you choose to, open the form yourself and paste the reference code into your message so Jeffery can see which tool you used. Describe the portfolio or criteria in aggregate terms only.",
        what_to_expect: "Jeffery Hartman reviews inquiries and may offer a private introduction where stated criteria appear to fit. No introduction, counterparty, or outcome is promised.",
        collects_contact_details: false,
      }, [page], page);
    },
  },
];
// ---------- Output schemas (structuredContent) ----------
const T = {
  s: { type: "string" }, sn: { type: ["string", "null"] }, n: { type: "number" }, i: { type: "integer" }, b: { type: "boolean" },
  a: { type: "array" }, as: { type: "array", items: { type: "string" } }, o: { type: "object" }, on: { type: ["object", "null"] },
};
const ENVELOPE_OUT = {
  tool: T.s, audience: { type: "string", enum: ["lenders", "agencies", "buyers", "shared", "all"] }, educational: { type: "boolean", const: true },
  sources: T.as, as_of: { type: "string", format: "date", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, input_aliases_applied: T.as,
  disclaimer: T.s, notice: T.s, role: T.s,
  next_step: obj({ optional_private_inquiry: T.s, related_page: T.s, note: T.s }, ["optional_private_inquiry", "related_page", "note"]),
};
const OUTPUT_PROPS = {
  sale_readiness_check: { checklist: T.a, summary: T.o, fix_first: T.a, process_ready_for_private_conversation: T.b, readiness_meaning: T.s },
  data_tape_header_check: { columns_received: T.i, mapped: T.a, unmapped: T.as, sensitive_columns: T.a, recommended_fields_missing: T.a, reconcile_first: T.s, boundary: T.s },
  document_gap_check: { asset_type: T.s, asset_type_code: { type: "string", enum: ASSET_ENUM }, documents_present: T.as, document_gaps: T.a, asset_specific_questions: T.as, boundary: T.s },
  portfolio_snapshot: { side: T.s, factor_summary: T.o, face_value_note: T.s, price_shown: { type: "boolean", const: false }, price_note: T.s, document_gaps: T.a, asset_specific_questions: T.as, questions_a_buyer_may_ask: T.as, file_completeness_score: { type: "integer", minimum: 0, maximum: 100 }, score_meaning: T.s },
  chain_of_title_checklist: { known_transfers: { type: ["integer", "string"] }, documents_expected: T.s, checklist: T.a, open_questions: T.as, useful_reconciliation_fields: T.as, boundary: T.s },
  forward_flow_vs_spot: { perspective: T.s, summary: T.s, one_time_sale: T.o, forward_flow: T.o, boundary: T.s },
  placement_readiness_check: { role: T.s, checklist: T.a, summary: T.o, open_items: T.as, boundary: T.s },
  judgment_interest_estimate: { status: { type: "string", enum: ["computed_from_source_checked_rate", "computed_with_user_rate", "rate_required"] }, state: T.s, principal_usd: T.n, judgment_date: T.s, as_of_date: T.s, debt_type: T.s, defendant_type: T.s, rate_rule: T.o, scenarios: { type: ["array", "null"] }, warnings: T.as, judgment_notice: T.s, not_an_amount_owed: { type: "boolean", const: true } },
  judgment_state_facts: { state: T.s, name: T.s, judgment_life_and_renewal: T.o, post_judgment_interest: T.o, assignment_filing: T.o, licensing_notes: T.o, unverified_topics: T.as, dataset: T.s, counsel_note: T.s },
  state_regulator_sources: { state: T.s, name: T.s, state_research_note: T.o, state_links: T.a, national_links: T.a, site_guide: T.s, conclusion: { type: "null" }, counsel_note: T.s },
  collection_net_recovery_calc: { inputs: T.o, gross_collected_usd: T.n, contingency_fee_usd: T.n, other_costs_usd: T.n, net_to_creditor_usd: T.n, net_as_pct_of_placed: T.n, formula: T.s, boundary: T.s },
  buy_box_builder: { buy_box: T.o, unanswered_criteria: T.as, clarifying_questions: T.as, readiness_prompts: T.as, fit: T.on, inventory_note: T.s, opt_in_introduction: T.o },
  diligence_checklist: { side: T.s, stages: T.a, boundary: T.s },
  asset_class_guide: { asset_class: T.s, label: T.s, record_story: T.s, documentation_focus: T.s, typical_documents: T.as, guide: T.s, routing_note: T.s },
  faq_search: { query: T.s, audience_filter: T.s, result_count: T.i, results: T.a, corpus: T.s },
  request_introduction: { inquiry_form_url: { type: "string", const: JOTFORM_URL }, site_page_with_form: T.s, reference_code: { type: "string", pattern: "^DOD-[A-Z2-9]{6}$" }, reference_code_stored: { type: "boolean", const: false }, how_to_use: T.s, what_to_expect: T.s, collects_contact_details: { type: "boolean", const: false } },
};
for (const t of TOOLS) {
  const props = Object.assign({}, ENVELOPE_OUT, OUTPUT_PROPS[t.name]);
  t.outputSchema = { type: "object", properties: props, required: Object.keys(props), additionalProperties: false };
}

// ---------- Short human-readable summaries for MCP text content ----------
const money = (x) => "$" + Number(x).toLocaleString("en-US", { maximumFractionDigits: 2 });
const SUMMARIES = {
  sale_readiness_check: (r) => [`Sale readiness: ${r.summary.done}/${r.summary.total} done, ${r.summary.gaps} gap(s), ${r.summary.unknown} unknown.`, r.fix_first.length ? "Fix first: " + r.fix_first.map((f) => `${f.item} (${f.status})`).join("; ") : "No open items.", r.readiness_meaning],
  data_tape_header_check: (r) => [`Data tape headers: ${r.columns_received} received, ${r.mapped.length} mapped, ${r.unmapped.length} unmapped.`, r.sensitive_columns.length ? "Hold until NDA + secure transfer: " + r.sensitive_columns.map((c) => c.column).join(", ") : "No sensitive columns flagged.", `Recommended fields missing: ${r.recommended_fields_missing.length}.`],
  document_gap_check: (r) => [`Document gaps for ${r.asset_type}: ${r.document_gaps.length} missing.`, r.document_gaps.slice(0, 3).map((g) => g.label).join("; ") + (r.document_gaps.length > 3 ? "; …" : "")],
  portfolio_snapshot: (r) => [`Portfolio Snapshot (no price): ${r.factor_summary.asset_type}, ${r.factor_summary.time_since_charge_off}, ${r.factor_summary.agency_history}, ${r.factor_summary.media}.`, `File completeness: ${r.file_completeness_score}/100 (completeness, not value). Document gaps: ${r.document_gaps.length}.`, r.face_value_note],
  chain_of_title_checklist: (r) => [`Chain of title: ${r.open_questions.length} open item(s). ${r.documents_expected}`, r.boundary],
  forward_flow_vs_spot: (r) => [r.summary, r.boundary],
  placement_readiness_check: (r) => [`Placement readiness (${r.role}): ${r.summary.done} done, ${r.summary.gaps} gap(s), ${r.summary.unknown} unknown.`, r.boundary],
  judgment_interest_estimate: (r) => [
    `Judgment interest (${r.state}, ${money(r.principal_usd)}, ${r.judgment_date} to ${r.as_of_date}): ${r.status.replace(/_/g, " ")}.`,
    ...(r.scenarios || []).map((x) => `- ${x.label}: ${x.rate_pct}% → interest ${money(x.interest_accrued_total_usd)}, illustrative total ${money(x.illustrative_total_usd)}`),
    `Source: ${r.rate_rule.source || "none"}${r.rate_rule.source_official === false ? " (unofficial)" : ""}; checked ${r.rate_rule.checked || "n/a"}.`,
    r.warnings[0], r.warnings.length > 1 ? `(${r.warnings.length - 1} more warning(s) in structuredContent.)` : null, r.judgment_notice],
  judgment_state_facts: (r) => [`${r.name}: judgment facts (verified flags per topic). Unverified topics: ${r.unverified_topics.length ? r.unverified_topics.join(", ") : "none"}.`, `Interest: ${r.post_judgment_interest.text}`, r.counsel_note],
  state_regulator_sources: (r) => [`${r.name}: ${r.state_links.length} state link(s) (official first) and ${r.national_links.length} national links.`, r.counsel_note],
  collection_net_recovery_calc: (r) => [`Net to creditor: ${money(r.net_to_creditor_usd)} (${r.net_as_pct_of_placed}% of placed) from gross ${money(r.gross_collected_usd)} minus fee ${money(r.contingency_fee_usd)} and costs ${money(r.other_costs_usd)}.`, r.boundary],
  buy_box_builder: (r) => [`Buy box: ${r.buy_box.asset_types.map((a) => a.label).join(", ")}. Unanswered criteria: ${r.unanswered_criteria.length}.`, r.fit ? `Fit on stated criteria: ${r.fit.overall}.` : "No portfolio profile given, so no fit check.", r.inventory_note],
  diligence_checklist: (r) => [`Due diligence (${r.side}): ${r.stages.map((x) => `${x.stage}. ${x.title}`).join(" · ")}`, r.boundary],
  asset_class_guide: (r) => [`${r.label}: ${r.documentation_focus}`, `Guide: ${r.guide}`],
  faq_search: (r) => [`FAQ search "${r.query}" (${r.audience_filter}): ${r.result_count} result(s).`, ...r.results.slice(0, 3).map((x) => `- ${x.question} (${x.page})`)],
  request_introduction: (r) => [`Optional private inquiry form: ${r.inquiry_form_url}`, `Reference code (not stored): ${r.reference_code}`, r.how_to_use],
};
function summaryText(name, r) {
  const lines = (SUMMARIES[name] ? SUMMARIES[name](r) : []).filter(Boolean);
  lines.push("Educational only — not legal, valuation, or compliance advice. Full result (with disclaimer, sources, as_of) is in structuredContent.");
  return lines.join("\n");
}

const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));
class UserError extends Error {}

function callTool(name, rawArgs) {
  const tool = TOOL_MAP.get(name);
  if (!tool) return { ok: false, code: 404, error: { error: "unknown_tool", message: `Unknown tool: ${name}` } };
  const [args, aliases] = normalizeAssets(rawArgs ?? {});
  const pii = piiScan(args, "", "value", tool.inputSchema);
  if (pii) return { ok: false, code: 422, error: { error: "pii_rejected", message: PII_MESSAGE, field: pii.path, detected: pii.kind, disclaimer: SITE_DISCLAIMER } };
  const err = validate(tool.inputSchema, args);
  if (err) return { ok: false, code: 400, error: { error: "invalid_input", message: err } };
  try {
    const result = tool.run(args);
    result.input_aliases_applied = aliases;
    return { ok: true, result };
  } catch (e) { if (e instanceof UserError) return { ok: false, code: 400, error: { error: "invalid_input", message: e.message } }; return { ok: false, code: 500, error: { error: "internal_error", message: "Internal error" } }; }
}

// ---------- HTTP ----------
const SERVER_TITLE = "The Don of Debt portfolio tools (preview)";
const DEFAULT_PROTOCOL = "2025-03-26"; // version assumed when a client sends no MCP-Protocol-Version header (per spec)
const BASE_HEADERS = {
  "X-Robots-Tag": "noindex, nofollow",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
// Allowed methods by route; CORS Allow-Methods mirrors the Allow header.
function methodsFor(path) {
  if (path === "/mcp") return "POST, OPTIONS";
  if (path.startsWith("/api/") && path !== "/api/tools") return "POST, OPTIONS";
  return "GET, OPTIONS";
}
const json = (body, status = 200, extra) => new Response(JSON.stringify(body, null, 2), { status, headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, BASE_HEADERS, extra || {}) });
const text = (body, status = 200, type = "text/plain; charset=utf-8") => new Response(body, { status, headers: Object.assign({ "Content-Type": type }, BASE_HEADERS) });

const SERVER_INSTRUCTIONS = "Free educational tools from The Don of Debt for lenders selling charged-off debt, collection agencies, and debt buyers. Send aggregate figures and categories only; personal or account-level data is rejected. Always show each result's disclaimer, sources, and as_of. The Don of Debt (Jeffery Hartman) only introduces potential buyers and sellers. The request_introduction tool returns an inquiry link the user may choose to open; never fill in or submit it for them.";

function rpcResult(id, result) { return { jsonrpc: "2.0", id, result }; }
function rpcError(id, code, message) { return { jsonrpc: "2.0", id: id ?? null, error: { code, message } }; }

function handleRpc(msg) {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return rpcError(msg && msg.id, -32600, "Invalid Request");
  const isNotification = msg.id === undefined || msg.id === null;
  const id = msg.id;
  switch (msg.method) {
    case "initialize": {
      const requested = msg.params && msg.params.protocolVersion;
      const v = PROTOCOL_VERSIONS.includes(requested) ? requested : "2025-06-18";
      return rpcResult(id, { protocolVersion: v, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "donofdebt-mcp", title: SERVER_TITLE, version: SERVER_VERSION, websiteUrl: SITE }, instructions: SERVER_INSTRUCTIONS });
    }
    case "ping": return isNotification ? null : rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: TOOLS.map((t) => ({ name: t.name, title: t.title, description: `[${t.audience}] ${t.description}`, inputSchema: t.inputSchema, outputSchema: t.outputSchema, annotations: { title: t.title, readOnlyHint: true, destructiveHint: false, idempotentHint: t.name !== "request_introduction", openWorldHint: false } })) });
    case "tools/call": {
      const p = msg.params || {};
      if (typeof p.name !== "string") return rpcError(id, -32602, "Invalid params: name is required");
      if (!TOOL_MAP.has(p.name)) return rpcError(id, -32602, `Unknown tool: ${p.name}`);
      const r = callTool(p.name, p.arguments);
      if (r.ok) return rpcResult(id, { content: [{ type: "text", text: summaryText(p.name, r.result) }], structuredContent: r.result, isError: false });
      // Errors carry text only (no structuredContent), so they never conflict with the tool's outputSchema.
      const e = r.error;
      return rpcResult(id, { content: [{ type: "text", text: `${e.error}: ${e.message}${e.field ? ` (field: ${e.field}; detected: ${e.detected})` : ""}` }], isError: true });
    }
    default:
      if (msg.method.startsWith("notifications/")) return null;
      return isNotification ? null : rpcError(id, -32601, `Method not found: ${msg.method}`);
  }
}

async function readJson(request) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_BODY) throw new UserError("Request body too large");
  const body = await request.text();
  if (body.length > MAX_BODY) throw new UserError("Request body too large");
  return JSON.parse(body || "null");
}

async function handleMcp(request) {
  const allow = { Allow: "POST, OPTIONS" };
  if (request.method !== "POST") return new Response("This MCP server is stateless and does not offer an SSE stream. Use POST.", { status: 405, headers: Object.assign({ "Content-Type": "text/plain; charset=utf-8" }, BASE_HEADERS, allow, { "Access-Control-Allow-Methods": "POST, OPTIONS" }) });
  const mcpHeaders = (v) => Object.assign({ "MCP-Protocol-Version": v, "Access-Control-Allow-Methods": "POST, OPTIONS" });
  const reqVer = request.headers.get("mcp-protocol-version");
  if (reqVer && !PROTOCOL_VERSIONS.includes(reqVer)) return json(rpcError(null, -32600, `Unsupported MCP-Protocol-Version: supported ${PROTOCOL_VERSIONS.join(", ")}`), 400, mcpHeaders(PROTOCOL_VERSIONS[1]));
  let body;
  try { body = await readJson(request); } catch (e) { return json(rpcError(null, -32700, e instanceof UserError ? e.message : "Parse error"), 400, mcpHeaders(reqVer || DEFAULT_PROTOCOL)); }
  const msgs = Array.isArray(body) ? body : [body];
  if (!msgs.length) return json(rpcError(null, -32600, "Invalid Request"), 400, mcpHeaders(reqVer || DEFAULT_PROTOCOL));
  const out = msgs.map(handleRpc).filter((x) => x !== null);
  const initRes = out.find((x) => x && x.result && x.result.protocolVersion && x.result.serverInfo);
  const ver = initRes ? initRes.result.protocolVersion : reqVer || DEFAULT_PROTOCOL;
  if (!out.length) return new Response(null, { status: 202, headers: Object.assign({}, BASE_HEADERS, mcpHeaders(ver)) });
  return json(Array.isArray(body) ? out : out[0], 200, mcpHeaders(ver));
}

function openapi(origin) {
  const paths = {};
  for (const t of TOOLS) {
    paths["/api/" + t.name] = { post: { operationId: t.name, summary: t.title, description: t.description, tags: [t.audience], requestBody: { required: true, content: { "application/json": { schema: t.inputSchema } } }, responses: { 200: { description: "Result (includes disclaimer, sources, as_of)", content: { "application/json": { schema: t.outputSchema } } }, 400: { description: "Invalid input" }, 422: { description: "Rejected: personal or account-level data" }, 429: { description: "Rate limited" } } } };
  }
  return { openapi: "3.1.0", info: { title: SERVER_TITLE, version: SERVER_VERSION, description: "Free educational tools for lenders, collection agencies, and debt buyers. Aggregate inputs only. " + SITE_DISCLAIMER }, servers: [{ url: origin }], paths };
}

function docsPage(origin) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const groups = [["lenders", "Lenders and creditors selling charge-offs"], ["agencies", "Collection agencies"], ["buyers", "Debt buyers"], ["all", "All audiences"], ["shared", "Shared"]];
  const sec = groups.map(([k, h]) => `<h2>${esc(h)}</h2><ul>${TOOLS.filter((t) => t.audience === k).map((t) => `<li><code>${t.name}</code> — ${esc(t.description)}</li>`).join("")}</ul>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(SERVER_TITLE)}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;color:#222}code{background:#f3f3f3;padding:1px 4px}pre{background:#f3f3f3;padding:.75rem;overflow:auto}</style></head><body>
<h1>${esc(SERVER_TITLE)}</h1>
<p>Free educational tools for lenders selling charged-off debt, collection agencies, and debt buyers. ${esc(ROLE_NOTE)}</p>
<p><strong>MCP (Streamable HTTP):</strong> <code>${origin}/mcp</code><br><strong>JSON API:</strong> <code>POST ${origin}/api/&lt;tool&gt;</code> with a JSON body of the tool's arguments<br><strong>OpenAPI:</strong> <a href="/openapi.json">/openapi.json</a></p>
<p><strong>Privacy:</strong> send aggregate figures and categories only. Names, SSNs, dates of birth, addresses, phone numbers, emails, account or case numbers, and data-tape rows are rejected. Inputs are not stored or logged.</p>
${sec}
<h2>Example</h2><pre>curl -s -X POST ${origin}/api/diligence_checklist -H 'content-type: application/json' -d '{"stage":"authority"}'</pre>
<p><small>${esc(SITE_DISCLAIMER)} ${esc(TOOL_NOTICE)}</small></p>
<p><small>Paid tier: not offered. A future paid tier (batch scoring, full judgment schedules) is planned only after approval.</small></p>
</body></html>`;
}

// Official MCP Registry HTTP domain proof for com.donofdebt/* (public key only).
// Glama connector claim for https://donofdebt.com/mcp (public token, must stay published).
const GLAMA_CONNECTOR_CLAIM = { $schema: "https://glama.ai/mcp/schemas/connector.json", claim: "glama_claim_i0alkFuxuIKn096BGRQ7Bv4uc_mo0hg-" };
const MCP_REGISTRY_AUTH = "v=MCPv1; k=ed25519; p=A4I7vCBzz7q+pQAornapXsGwDn7I3MkAKP6zcQzYkr0=";

async function route(request, env, path, origin) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: BASE_HEADERS });
  if (path === "/mcp/.well-known/glama.json" && (request.method === "GET" || request.method === "HEAD")) return json(GLAMA_CONNECTOR_CLAIM);
  if (path === "/mcp" || path.startsWith("/api/")) {
    if (env && env.RL && request.method === "POST") {
      try { const { success } = await env.RL.limit({ key: request.headers.get("cf-connecting-ip") || "anon" }); if (!success) return json({ error: "rate_limited", message: "Too many requests. Try again in a minute." }, 429, { "Retry-After": "60" }); } catch (_) { /* fail open */ }
    }
  }
  if (path === "/mcp") return handleMcp(request);
  const allowed = methodsFor(path);
  const methodOk = allowed.split(", ").includes(request.method) || (request.method === "HEAD" && allowed.includes("GET"));
  const known = ["/", "/robots.txt", "/openapi.json", "/.well-known/mcp/server-card.json", "/.well-known/mcp-registry-auth", "/api", "/api/tools"].includes(path) || path.startsWith("/api/");
  if (known && !methodOk) return json({ error: "method_not_allowed", message: `Use ${allowed.replace(", OPTIONS", "")}.` }, 405, { Allow: allowed });
  if (path === "/robots.txt") return text("User-agent: *\nDisallow: /\n");
  if (path === "/.well-known/mcp-registry-auth") return text(MCP_REGISTRY_AUTH + "\n");
  if (path === "/") return text(docsPage(origin), 200, "text/html; charset=utf-8");
  if (path === "/openapi.json") return json(openapi(origin));
  if (path === "/.well-known/mcp/server-card.json") return json({ name: "donofdebt-mcp", title: SERVER_TITLE, websiteUrl: SITE, version: SERVER_VERSION, description: "Free educational tools for lenders, collection agencies, and debt buyers. Aggregate inputs only.", transport: { type: "streamable-http", url: origin + "/mcp" }, authentication: "none", tools: TOOLS.map((t) => t.name) });
  if (path === "/api" || path === "/api/tools") return json({ tools: TOOLS.map((t) => ({ name: t.name, audience: t.audience, title: t.title, description: t.description, endpoint: `${origin}/api/${t.name}`, inputSchema: t.inputSchema, outputSchema: t.outputSchema })) });
  if (path.startsWith("/api/")) {
    const name = path.slice(5);
    let args;
    try { args = await readJson(request); } catch (e) { return json({ error: "invalid_json", message: e instanceof UserError ? e.message : "Body must be JSON" }, 400); }
    const r = callTool(name, args);
    return r.ok ? json(r.result) : json(r.error, r.code);
  }
  return json({ error: "not_found" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const res = await route(request, env, path, url.origin);
    const headers = new Headers(res.headers);
    headers.set("Access-Control-Allow-Methods", methodsFor(path)); // CORS methods match each route's Allow
    headers.set("X-Robots-Tag", "noindex, nofollow");
    if (res.status === 405 && !headers.has("Allow")) headers.set("Allow", methodsFor(path));
    return new Response(res.body, { status: res.status, headers });
  },
};
