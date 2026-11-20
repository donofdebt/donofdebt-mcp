// End-to-end tests. Usage: BASE=https://mcp.donofdebt.com [MCP_BASE=https://donofdebt.com] node tests/run-tests.mjs   (BASE=local runs dist/worker.js in-process)
import fs from "node:fs";
import { checkText } from "../scripts/copy-rules.mjs";
const BASE = process.env.BASE || "local";
let worker = null;
if (BASE === "local") worker = (await import("../dist/worker.js")).default;
const origin = BASE === "local" ? "https://local.test" : BASE.replace(/\/$/, "");
const PACE_MS = worker ? 0 : Number(process.env.PACE_MS || 1100); // stay under the 60 req/min per-IP limit
let calls = 0;
async function req(path, init = {}) {
  if (PACE_MS) await new Promise((ok) => setTimeout(ok, PACE_MS));
  calls++;
  const MCP_BASE = process.env.MCP_BASE ? process.env.MCP_BASE.replace(/\/$/, "") : null; // e.g. https://donofdebt.com (public /mcp via the site Worker)
  const base = MCP_BASE && (path === "/mcp" || path.startsWith("/.well-known/mcp")) ? MCP_BASE : origin;
  const r = new Request(base + path, init);
  const res = worker ? await worker.fetch(r, {}) : await fetch(r);
  const body = await res.text();
  let j = null; try { j = JSON.parse(body); } catch {}
  return { status: res.status, headers: res.headers, body, json: j };
}
const post = (path, obj) => req(path, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify(obj) });
let rpcId = 1;
const rpc = (method, params) => post("/mcp", { jsonrpc: "2.0", id: rpcId++, method, params });
const results = []; const outputs = [];
function check(name, cond, info) { results.push({ name, pass: !!cond, info: cond ? undefined : info }); }
const DISC = "This website provides general information";

const VALID = {
  sale_readiness_check: { authority_to_sell: "yes", transfer_restrictions_reviewed: "yes", chain_of_title_complete: "no", data_tape_ready: "yes", media_inventory_done: "unknown" },
  data_tape_header_check: { columns: ["acct_ref", "Original Creditor", "chargeoff_date", "chargeoff_balance", "current_balance", "state", "last_payment_date", "first_name", "SSN", "bk_flag", "zzz_custom"] },
  document_gap_check: { asset_type: "auto", documents_available: ["bill_of_sale_chain", "last_statements"] },
  portfolio_snapshot: { side: "seller", asset_type: "prime-cc", face_value_usd: 2500000, account_count: 1800, age_since_chargeoff: "1-3y", placement_history: "secondary", media: "partial", documents_available: ["bill_of_sale_chain", "chargeoff_statements", "data_tape_field_dictionary"], top_state_share_pct: 18 },
  chain_of_title_checklist: { known_transfers: 2, originator_identified: "yes", bill_of_sale_each_transfer: "no" },
  forward_flow_vs_spot: { perspective: "seller" },
  placement_readiness_check: { role: "agency_receiving", placement_agreement: "yes", licensing_confirmed: "unknown" },
  judgment_interest_estimate: { state: "CA", principal_usd: 10000, judgment_date: "2024-01-01", as_of_date: "2024-12-31", debt_type: "commercial_or_other" },
  judgment_state_facts: { state: "TX" },
  state_regulator_sources: { state: "CA" },
  collection_net_recovery_calc: { placed_amount_usd: 100000, recovery_rate_pct: 20, contingency_fee_pct: 30, other_costs_usd: 500 },
  buy_box_builder: { asset_types: ["prime-cc", "auto"], age_bands: ["0-12m", "1-3y"], placement_levels: ["primary"], min_media: "partial", face_value_min_usd: 500000, face_value_max_usd: 5000000, excluded_states: ["NY"], sale_types: ["one_time"], portfolio: { asset_type: "auto", age_band: "1-3y", placement: "primary", media: "full", face_value_usd: 1000000, states_present: ["TX", "FL"], sale_type: "one_time" } },
  diligence_checklist: { side: "buyer" },
  asset_class_guide: { asset_class: "auto-deficiency" },
  faq_search: { query: "what is a forward flow agreement", limit: 3 },
  request_introduction: { side: "seller" },
};

// --- static endpoints & headers
for (const p of ["/", "/robots.txt", "/openapi.json", "/api", "/.well-known/mcp/server-card.json"]) {
  const r = await req(p);
  check(`GET ${p} 200`, r.status === 200, r.status);
  check(`GET ${p} X-Robots-Tag noindex`, /noindex/.test(r.headers.get("x-robots-tag") || ""), r.headers.get("x-robots-tag"));
  outputs.push([p, r.body]);
}
check("robots.txt Disallow all", (await req("/robots.txt")).body.includes("Disallow: /"));
check("docs page meta noindex", /<meta name="robots" content="noindex,nofollow">/.test((await req("/")).body));
const oa = (await req("/openapi.json")).json;
check("openapi has 16 tool paths", oa && Object.keys(oa.paths).length === 16, oa && Object.keys(oa.paths).length);
check("GET /mcp -> 405", (await req("/mcp")).status === 405);
check("404 unknown path", (await req("/nope")).status === 404);

// --- MCP protocol
const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
check("initialize ok", init.json?.result?.protocolVersion === "2025-06-18" && init.json.result.capabilities.tools, init.body);
check("initialize X-Robots-Tag", /noindex/.test(init.headers.get("x-robots-tag") || ""));
outputs.push(["initialize", init.body]);
const notif = await post("/mcp", { jsonrpc: "2.0", method: "notifications/initialized" });
check("notifications/initialized -> 202", notif.status === 202, notif.status);
check("ping", (await rpc("ping")).json?.result !== undefined);
const list = await rpc("tools/list", {});
const tools = list.json?.result?.tools || [];
check("tools/list returns 16 tools", tools.length === 16, tools.length);
check("every tool has inputSchema object", tools.every((t) => t.inputSchema && t.inputSchema.type === "object"));
outputs.push(["tools/list", list.body]);
check("unknown method -32601", (await rpc("foo/bar")).json?.error?.code === -32601);
check("unknown tool -32602", (await rpc("tools/call", { name: "nope", arguments: {} })).json?.error?.code === -32602);
const batch = await post("/mcp", [{ jsonrpc: "2.0", id: 91, method: "ping" }, { jsonrpc: "2.0", id: 92, method: "tools/list" }]);
check("batch request", Array.isArray(batch.json) && batch.json.length === 2);
check("parse error -32700", (await req("/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: "{bad" })).json?.error?.code === -32700);

// --- every tool over both transports
for (const t of tools) {
  const args = VALID[t.name];
  check(`${t.name}: has test args`, !!args);
  const m = await rpc("tools/call", { name: t.name, arguments: args });
  const mr = m.json?.result;
  check(`${t.name}: MCP ok`, mr && mr.isError === false && mr.structuredContent, m.body.slice(0, 300));
  const a = await post("/api/" + t.name, args);
  check(`${t.name}: API 200`, a.status === 200, a.status + " " + a.body.slice(0, 300));
  for (const [via, out] of [["mcp", mr?.structuredContent], ["api", a.json]]) {
    if (!out) continue;
    check(`${t.name} (${via}): disclaimer`, typeof out.disclaimer === "string" && out.disclaimer.startsWith(DISC));
    check(`${t.name} (${via}): sources + as_of`, Array.isArray(out.sources) && out.sources.length > 0 && !!out.as_of);
    check(`${t.name} (${via}): educational notice`, out.educational === true && /not legal, valuation, or compliance advice/.test(out.notice));
    check(`${t.name} (${via}): next_step Jotform link`, out.next_step?.optional_private_inquiry === "https://form.jotform.com/262856575148066");
  }
  outputs.push([t.name, m.body], [t.name + " api", a.body]);
}

// --- tool-specific assertions
const api = async (n, a) => (await post("/api/" + n, a));
let r = (await api("portfolio_snapshot", VALID.portfolio_snapshot)).json;
check("snapshot: price_shown false", r.price_shown === false);
check("snapshot: no price figures", !/¢|cents|per \$1|percent of (face|upb)|\bbid\b|indicative_range/i.test(JSON.stringify({ ...r, disclaimer: "", price_note: "" })));
check("snapshot: document gaps listed", r.document_gaps.length === 10, r.document_gaps.length);
r = (await api("data_tape_header_check", VALID.data_tape_header_check)).json;
check("tape: sensitive first_name+SSN flagged", r.sensitive_columns.map((x) => x.column).join() === "first_name,SSN", JSON.stringify(r.sensitive_columns));
check("tape: chargeoff_balance mapped", r.mapped.some((x) => x.field === "chargeoff_balance"));
check("tape: unmapped zzz_custom", r.unmapped.includes("zzz_custom"));
r = (await api("judgment_interest_estimate", VALID.judgment_interest_estimate)).json;
check("judgment CA 10% $10k 365d = $1000", r.status === "computed_from_source_checked_rate" && r.scenarios[0].interest_accrued_total_usd === 1000, JSON.stringify(r.scenarios));
check("judgment cites source + check date", r.rate_rule.source.includes("leginfo") && r.rate_rule.checked === "2026-11-19");
r = (await api("judgment_interest_estimate", { state: "CA", principal_usd: 10000, judgment_date: "2024-01-01", as_of_date: "2024-12-31" })).json;
check("judgment CA unknown type -> 10% and 5% scenarios", r.scenarios.length === 2 && r.scenarios[1].rate_pct === 5);
r = (await api("judgment_interest_estimate", { state: "NY", principal_usd: 5000, judgment_date: "2023-03-01", as_of_date: "2024-03-01", debt_type: "consumer_personal", defendant_type: "natural_person" })).json;
check("judgment NY consumer 2%", r.scenarios?.[0]?.rate_pct === 2 && r.warnings.some((w) => /secondary mirror/.test(w)));
r = (await api("judgment_interest_estimate", { state: "IL", principal_usd: 20000, judgment_date: "2022-01-01", as_of_date: "2023-01-01", debt_type: "consumer_personal" })).json;
check("judgment IL consumer <=25k 5%", r.scenarios?.[0]?.rate_pct === 5 && r.scenarios[0].interest_accrued_total_usd === 1000);
r = (await api("judgment_interest_estimate", { state: "TX", principal_usd: 10000, judgment_date: "2024-01-01", as_of_date: "2025-01-01" })).json;
check("judgment TX (variable) -> rate_required, no numbers", r.status === "rate_required" && r.scenarios === null);
r = (await api("judgment_interest_estimate", { state: "TX", principal_usd: 10000, judgment_date: "2024-01-01", as_of_date: "2025-01-01", rate_override_pct: 8.5 })).json;
check("judgment TX with override computes + warns", r.status === "computed_with_user_rate" && r.warnings.some((w) => /user-supplied/i.test(w)));
r = (await api("judgment_interest_estimate", { state: "AK", principal_usd: 10000, judgment_date: "2024-01-01", as_of_date: "2025-01-01" })).json;
check("judgment AK unverified -> rate_required + UNVERIFIED warning", r.status === "rate_required" && r.warnings.some((w) => /UNVERIFIED/.test(w)));
r = (await api("judgment_interest_estimate", { state: "US-FED", principal_usd: 10000, judgment_date: "2024-01-01", as_of_date: "2025-01-01" })).json;
check("judgment federal -> rate_required", r.status === "rate_required");
r = (await api("judgment_interest_estimate", { state: "VA", principal_usd: 10000, judgment_date: "2024-01-01", as_of_date: "2025-01-01", payments: [{ date: "2024-07-01", amount_usd: 1000 }] })).json;
check("judgment payments applied interest-first", r.scenarios[0].payments_applied[0].to_interest > 0 && r.scenarios[0].principal_remaining_usd < 10000, JSON.stringify(r.scenarios?.[0]));
check("judgment bad dates rejected", (await api("judgment_interest_estimate", { state: "VA", principal_usd: 1, judgment_date: "2025-01-01", as_of_date: "2024-01-01" })).status === 400);
r = (await api("collection_net_recovery_calc", VALID.collection_net_recovery_calc)).json;
check("net recovery math 20000-6000-500=13500", r.net_to_creditor_usd === 13500);
r = (await api("buy_box_builder", VALID.buy_box_builder)).json;
check("buy box fit: media full>=partial fit, states fit", r.fit.media === "fit" && r.fit.states === "fit" && r.fit.overall !== "no_fit", JSON.stringify(r.fit));
check("buy box opt-in link", r.opt_in_introduction.buyer_application_page.endsWith("/qualified-debt-buyer-application"));
r = (await api("diligence_checklist", {})).json;
check("diligence has 8 stages", r.stages.length === 8);
r = (await api("faq_search", VALID.faq_search)).json;
check("faq search finds forward flow", r.results.length > 0 && /forward flow/i.test(r.results[0].question));
const i1 = (await api("request_introduction", {})).json, i2 = (await api("request_introduction", {})).json;
check("intro: Jotform link + DOD ref, not stored", i1.inquiry_form_url === "https://form.jotform.com/262856575148066" && /^DOD-[A-Z2-9]{6}$/.test(i1.reference_code) && i1.reference_code_stored === false);
check("intro: refs random", i1.reference_code !== i2.reference_code);
check("intro: no contact fields accepted", (await api("request_introduction", { email: "x" })).status >= 400);
check("no tool schema has contact fields", tools.every((t) => !/email|phone|first_name|last_name|address/i.test(JSON.stringify(t.inputSchema.properties))));

// --- PII rejection (both transports)
const PII = [
  ["email in query", "faq_search", { query: "contact me at jane.doe@example.com" }],
  ["SSN in query", "faq_search", { query: "ssn 123-45-6789 portfolio" }],
  ["9-digit number", "faq_search", { query: "debt 123456789" }],
  ["phone in query", "faq_search", { query: "call (555) 123-4567 about my debt" }],
  ["account number", "faq_search", { query: "account 4111 1111 1111 1111 status" }],
  ["honorific name", "faq_search", { query: "Mr. Johnson owes money" }],
  ["street address", "faq_search", { query: "lives at 123 Main Street" }],
  ["DOB-like date", "faq_search", { query: "born 04/12/1980" }],
  ["identifier keyword", "faq_search", { query: "what is his date of birth" }],
  ["PII field name", "portfolio_snapshot", { ...VALID.portfolio_snapshot, debtor_name: "x" }],
  ["CSV rows in columns", "data_tape_header_check", { columns: ["acct,name,balance\n1001,John Smith,500.00\n1002,Ann Lee,250"] }],
  ["row values as headers", "data_tape_header_check", { columns: ["1001", "2024-01-05", "512.33", "TX", "Y"] }],
  ["email in headers", "data_tape_header_check", { columns: ["acct_ref", "jsmith@example.org"] }],
  ["email field on intro", "request_introduction", { email: "a@b.co" }],
];
for (const [label, tool, args] of PII) {
  const a = await api(tool, args);
  check(`PII rejected (api): ${label}`, a.status === 422 && a.json?.error === "pii_rejected", a.status + " " + a.body.slice(0, 200));
  check(`PII not echoed (api): ${label}`, !JSON.stringify(a.json || {}).includes(JSON.stringify(args).slice(2, 40)) || a.status !== 422);
  const m = await rpc("tools/call", { name: tool, arguments: args });
  check(`PII rejected (mcp): ${label}`, m.json?.result?.isError === true && /^pii_rejected/.test(m.json.result.content?.[0]?.text || "") && m.json.result.structuredContent === undefined, m.body.slice(0, 200));
}
check("unknown field rejected 400", (await api("diligence_checklist", { foo: 1 })).status === 400);
check("clean query not rejected", (await api("faq_search", { query: "chain of title bill of sale" })).status === 200);

// --- rate limit (remote only): burst past 60/min and expect 429s
if (!worker && process.env.RATE_TEST !== "0") {
  const burst = [];
  for (let i = 0; i < 75; i++) { burst.push((await fetch(origin + "/api/diligence_checklist", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status); await new Promise((ok) => setTimeout(ok, 40)); }
  const n429 = burst.filter((x) => x === 429).length;
  check("rate limit returns 429 after burst (75 quick sequential requests)", n429 > 0, `429s: ${n429}`);
}

// ================= v0.2 fixes (tinkabot review) =================
const { createRequire } = await import("node:module");
let Ajv = null;
try { Ajv = createRequire(process.env.AJV_FROM || "/tmp/mcpclient/package.json")("ajv"); Ajv = Ajv.default || Ajv; } catch {}
const ajv = Ajv ? new Ajv({ strict: false, validateFormats: false, allErrors: true }) : null;
const toolsV2 = (await rpc("tools/list", {})).json.result.tools;
// 1. outputSchema for every tool, matching structuredContent
check("fix1: every tool has outputSchema", toolsV2.every((t) => t.outputSchema && t.outputSchema.type === "object"));
check("fix1: ajv available for schema validation", !!ajv);
for (const t of toolsV2) {
  const m = await rpc("tools/call", { name: t.name, arguments: VALID[t.name] });
  const sc = m.json?.result?.structuredContent;
  if (ajv) { const v = ajv.compile(t.outputSchema); check(`fix1: ${t.name} structuredContent matches outputSchema`, v(sc), JSON.stringify(v.errors?.slice(0, 3))); }
  const txt = m.json?.result?.content?.[0]?.text || "";
  // 11. short human summary, not a JSON dump
  check(`fix11: ${t.name} text is a short summary`, !txt.trim().startsWith("{") && txt.split("\n").length <= 12 && /structuredContent/.test(txt), txt.slice(0, 120));
  // 7. as_of YYYY-MM-DD
  check(`fix7: ${t.name} as_of is YYYY-MM-DD`, /^\d{4}-\d{2}-\d{2}$/.test(sc?.as_of || ""), sc?.as_of);
  outputs.push([t.name + " summary", txt]);
}
for (const [label, a] of [["TX facts", ["judgment_state_facts", { state: "TX" }]], ["AK estimate", ["judgment_interest_estimate", { state: "AK", principal_usd: 1, judgment_date: "2024-01-01", as_of_date: "2024-02-01" }]], ["PA estimate", ["judgment_interest_estimate", { state: "PA", principal_usd: 1, judgment_date: "2024-01-01", as_of_date: "2024-02-01" }]]]) {
  const o = (await api(a[0], a[1])).json; check(`fix7: as_of YYYY-MM-DD (${label})`, /^\d{4}-\d{2}-\d{2}$/.test(o.as_of), o.as_of);
}
// 2. date format -> invalid_input, not pii_rejected
for (const [label, args] of [["MM/DD/YYYY judgment_date", { state: "VA", principal_usd: 1000, judgment_date: "06/15/2023", as_of_date: "2024-01-01" }], ["impossible date", { state: "VA", principal_usd: 1000, judgment_date: "2023-02-30", as_of_date: "2024-01-01" }], ["bad payment date", { state: "VA", principal_usd: 1000, judgment_date: "2023-01-01", as_of_date: "2024-01-01", payments: [{ date: "1/2/2023", amount_usd: 10 }] }]]) {
  const a = await api("judgment_interest_estimate", args);
  check(`fix2: ${label} -> 400 invalid_input (api)`, a.status === 400 && a.json?.error === "invalid_input", a.status + " " + a.body.slice(0, 150));
  const m = await rpc("tools/call", { name: "judgment_interest_estimate", arguments: args });
  check(`fix2: ${label} -> invalid_input (mcp)`, m.json?.result?.isError === true && /^invalid_input/.test(m.json.result.content[0].text), m.body.slice(0, 150));
}
check("fix2: DOB-like date in free text still pii_rejected", (await api("faq_search", { query: "born 06/15/1980" })).json?.error === "pii_rejected");
// 3. one asset enum + aliases
const assetEnums = toolsV2.flatMap((t) => { const p = t.inputSchema.properties; return [p.asset_type, p.asset_class, p.asset_types?.items, p.portfolio?.properties?.asset_type].filter(Boolean).map((x) => JSON.stringify(x.enum)); });
check("fix3: same asset enum on every asset field (5 fields)", assetEnums.length === 5 && new Set(assetEnums).size === 1, assetEnums.length + " " + new Set(assetEnums).size);
r = (await api("portfolio_snapshot", { ...VALID.portfolio_snapshot, asset_type: "auto" })).json;
check("fix3: alias auto -> auto-deficiency (snapshot)", r.factor_summary?.asset_type_code === "auto-deficiency" && r.input_aliases_applied?.[0] === "auto→auto-deficiency", JSON.stringify(r).slice(0, 200));
r = (await api("document_gap_check", { asset_type: "installments", documents_available: [] })).json;
check("fix3: alias installments -> installment-loan (gap check)", r.asset_type_code === "installment-loan");
r = (await api("asset_class_guide", { asset_class: "auto" })).json;
check("fix3: alias accepted by asset_class_guide", r.asset_class === "auto-deficiency");
check("fix3: asset_class_guide accepts prime-cc (shared enum)", (await api("asset_class_guide", { asset_class: "prime-cc" })).status === 200);
r = (await api("buy_box_builder", { asset_types: ["auto", "prime-cc"], portfolio: { asset_type: "auto" } })).json;
check("fix3: aliases in buy_box arrays + portfolio", r.buy_box?.asset_types?.[0]?.code === "auto-deficiency" && r.fit?.asset_type === "fit");
check("fix3: unknown asset still rejected", (await api("asset_class_guide", { asset_class: "spaceships" })).status === 400);
// 4. resources/prompts not advertised -> -32601
check("fix4: resources/list -32601", (await rpc("resources/list", {})).json?.error?.code === -32601);
check("fix4: prompts/list -32601", (await rpc("prompts/list", {})).json?.error?.code === -32601);
check("fix4: only tools capability advertised", JSON.stringify(Object.keys(init.json.result.capabilities)) === '["tools"]');
// 5. GET /mcp 405 Allow: POST; CORS methods match
let g = await req("/mcp");
check("fix5: GET /mcp 405 + Allow POST", g.status === 405 && /^POST/.test(g.headers.get("allow") || ""), g.headers.get("allow"));
check("fix5: /mcp CORS methods match Allow", g.headers.get("access-control-allow-methods") === g.headers.get("allow"));
g = await req("/mcp", { method: "OPTIONS" });
check("fix5: OPTIONS /mcp methods POST, OPTIONS", g.status === 204 && g.headers.get("access-control-allow-methods") === "POST, OPTIONS");
const pm = await rpc("ping");
check("fix5: POST /mcp CORS methods POST, OPTIONS", pm.headers.get("access-control-allow-methods") === "POST, OPTIONS");
g = await req("/api/faq_search");
check("fix5: GET /api/<tool> 405 + Allow POST", g.status === 405 && /^POST/.test(g.headers.get("allow") || "") && g.headers.get("access-control-allow-methods") === g.headers.get("allow"));
check("fix5: GET routes advertise GET", (await req("/openapi.json")).headers.get("access-control-allow-methods") === "GET, OPTIONS");
// 6. MCP-Protocol-Version header
check("fix6: initialize response header = negotiated", init.headers.get("mcp-protocol-version") === "2025-06-18", init.headers.get("mcp-protocol-version"));
const withHdr = await req("/mcp", { method: "POST", headers: { "content-type": "application/json", "mcp-protocol-version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", id: 501, method: "ping" }) });
check("fix6: echoes client's version", withHdr.headers.get("mcp-protocol-version") === "2025-06-18");
check("fix6: default 2025-03-26 without header", pm.headers.get("mcp-protocol-version") === "2025-03-26", pm.headers.get("mcp-protocol-version"));
const badVer = await req("/mcp", { method: "POST", headers: { "content-type": "application/json", "mcp-protocol-version": "1999-01-01" }, body: JSON.stringify({ jsonrpc: "2.0", id: 502, method: "ping" }) });
check("fix6: unsupported version -> 400", badVer.status === 400);
check("fix6: 202 notification carries header", !!notif.headers.get("mcp-protocol-version"));
// 8. one title everywhere + card websiteUrl
const card = (await req("/.well-known/mcp/server-card.json")).json;
const oa2 = (await req("/openapi.json")).json;
const title = init.json.result.serverInfo.title;
check("fix8: same title serverInfo/OpenAPI/card", title === oa2.info.title && title === card.title, [title, oa2.info.title, card.title].join(" | "));
check("fix8: card websiteUrl", card.websiteUrl === "https://donofdebt.com");
check("fix8: docs page uses the same title", (await req("/")).body.includes(`<h1>${title}</h1>`));
// 9. faq_search for all audiences
const faqTool = toolsV2.find((t) => t.name === "faq_search");
check("fix9: faq_search tagged all", faqTool.description.startsWith("[all]") && faqTool.inputSchema.properties.audience.enum.includes("all"));
r = (await api("faq_search", { query: "license collection agency", limit: 10, audience: "agencies" })).json;
check("fix9: agencies filter returns only agency-tagged pages", r.result_count > 0 && r.results.every((x) => x.audiences.includes("agencies")), JSON.stringify(r.results?.map((x) => x.page)));
r = (await api("faq_search", { query: "license collection agency", limit: 10 })).json;
check("fix9: default audience_filter all", r.audience_filter === "all");
// 10. fix_first: confirmed gaps first, then unknowns
r = (await api("sale_readiness_check", { authority_to_sell: "unknown", transfer_restrictions_reviewed: "unknown", sol_review_done: "no", nda_ready: "no", chain_of_title_complete: "yes" })).json;
check("fix10: fix_first lists confirmed gaps before unknowns", r.fix_first[0].status === "gap" && r.fix_first[1].status === "gap" && r.fix_first[2].status === "unknown", JSON.stringify(r.fix_first));
// 12. official regulator links preferred; mirrors labeled
r = (await api("state_regulator_sources", { state: "FL" })).json;
check("fix12: FL first link is official OFR", r.state_links[0].official === true && r.state_links[0].url.includes("flofr.gov"), JSON.stringify(r.state_links));
check("fix12: FL mirror labeled unofficial", r.state_links.some((l) => /public\.law/.test(l.url) && l.official === false && /UNOFFICIAL/.test(l.note)));
r = (await api("state_regulator_sources", { state: "TX" })).json;
check("fix12: TX official statutes link first, mirror labeled", r.state_links[0].official && r.state_links.some((l) => /public\.law/.test(l.url) && !l.official));
r = (await api("state_regulator_sources", { state: "CA" })).json;
check("fix12: CA DFPI first", r.state_links[0].url.includes("dfpi.ca.gov") && r.state_links.filter((l) => !l.official).every((l) => /UNOFFICIAL/.test(l.note)));
r = (await api("judgment_state_facts", { state: "NY" })).json;
check("fix12: state facts flag mirror sources", r.post_judgment_interest.source_official === false && /Unofficial/.test(r.post_judgment_interest.source_note));
// 13. NY defendant_type
const ny = async (debt_type, defendant_type) => (await api("judgment_interest_estimate", { state: "NY", principal_usd: 5000, judgment_date: "2023-03-01", as_of_date: "2024-03-01", debt_type, defendant_type })).json;
r = await ny("consumer_personal", "natural_person"); check("fix13: NY consumer + natural person = 2%", r.scenarios.length === 1 && r.scenarios[0].rate_pct === 2 && r.warnings.some((w) => /mirror/.test(w)));
r = await ny("consumer_personal", "business_or_other"); check("fix13: NY consumer + business = 9%", r.scenarios.length === 1 && r.scenarios[0].rate_pct === 9);
r = await ny("commercial_or_other", "natural_person"); check("fix13: NY commercial + natural person = 9%", r.scenarios.length === 1 && r.scenarios[0].rate_pct === 9);
r = await ny("consumer_personal", undefined); check("fix13: NY defendant unknown -> both scenarios", r.scenarios.length === 2 && r.defendant_type === "unknown");
r = await ny("unknown", "natural_person"); check("fix13: NY debt unknown -> both scenarios", r.scenarios.length === 2);
check("fix13: NY rate_rule marked unofficial source", r.rate_rule.source_official === false);

// --- copy rules over every captured output
let copyHits = [];
for (const [where, body] of outputs) copyHits = copyHits.concat(checkText(body, where));
check("copy rules: 0 hits across all outputs", copyHits.length === 0, JSON.stringify(copyHits.slice(0, 5)));

const pass = results.filter((x) => x.pass).length, fail = results.length - pass;
for (const x of results.filter((x) => !x.pass)) console.log("FAIL", x.name, x.info ?? "");
console.log(`requests: ${calls}`);
console.log(`\n${BASE}: ${pass} passed, ${fail} failed, ${results.length} total`);
fs.writeFileSync(new URL(`./last-results-${BASE === "local" ? "local" : "remote"}.json`, import.meta.url), JSON.stringify({ base: BASE, pass, fail, results }, null, 1));
process.exit(fail ? 1 : 0);
