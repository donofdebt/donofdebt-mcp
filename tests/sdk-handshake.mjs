// Official MCP TypeScript SDK client check over Streamable HTTP:
// initialize + tools/list + tools/call for EVERY tool (the SDK validates structuredContent against each outputSchema)
// + a PII rejection + a bad-date rejection. Run from a dir with @modelcontextprotocol/sdk installed:  node sdk-handshake.mjs <url>
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const url = new URL(process.argv[2] || "https://donofdebt.com/mcp");
const ARGS = {
  sale_readiness_check: { authority_to_sell: "yes", nda_ready: "no" },
  data_tape_header_check: { columns: ["acct_ref", "chargeoff_date", "chargeoff_balance", "state"] },
  document_gap_check: { asset_type: "auto", documents_available: ["bill_of_sale_chain"] },
  portfolio_snapshot: { asset_type: "prime-cc", face_value_usd: 1000000, age_since_chargeoff: "1-3y", placement_history: "primary", media: "full" },
  chain_of_title_checklist: { known_transfers: 1 },
  forward_flow_vs_spot: {},
  placement_readiness_check: { role: "creditor_placing" },
  judgment_interest_estimate: { state: "NY", principal_usd: 5000, judgment_date: "2023-03-01", as_of_date: "2024-03-01", debt_type: "consumer_personal", defendant_type: "natural_person" },
  judgment_state_facts: { state: "FL" },
  state_regulator_sources: { state: "FL" },
  collection_net_recovery_calc: { placed_amount_usd: 1000, recovery_rate_pct: 10, contingency_fee_pct: 25 },
  buy_box_builder: { asset_types: ["auto-deficiency"] },
  diligence_checklist: { stage: "authority" },
  asset_class_guide: { asset_class: "medical" },
  faq_search: { query: "chain of title", audience: "lenders" },
  request_introduction: { side: "buyer" },
};
const client = new Client({ name: "dod-sdk-check", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(url);
await client.connect(transport);
const { tools } = await client.listTools();
const calls = {};
for (const t of tools) {
  try { const r = await client.callTool({ name: t.name, arguments: ARGS[t.name] }); calls[t.name] = !r.isError && !!r.structuredContent ? "ok (outputSchema validated by SDK)" : "error"; }
  catch (e) { calls[t.name] = "FAILED: " + e.message.slice(0, 200); }
}
const pii = await client.callTool({ name: "faq_search", arguments: { query: "email me at a@b.co" } });
const badDate = await client.callTool({ name: "judgment_interest_estimate", arguments: { state: "VA", principal_usd: 1, judgment_date: "06/15/2023", as_of_date: "2024-01-01" } });
const out = {
  server: client.getServerVersion(), negotiated_protocol: transport.protocolVersion, capabilities: client.getServerCapabilities(),
  tool_count: tools.length, all_have_outputSchema: tools.every((t) => !!t.outputSchema), calls,
  pii_rejected: pii.isError === true && /^pii_rejected/.test(pii.content[0].text),
  bad_date_invalid_input: badDate.isError === true && /^invalid_input/.test(badDate.content[0].text),
};
out.pass = out.tool_count === 16 && out.all_have_outputSchema && Object.values(calls).every((v) => v.startsWith("ok")) && out.pii_rejected && out.bad_date_invalid_input;
console.log(JSON.stringify(out, null, 1));
await client.close();
process.exit(out.pass ? 0 : 1);
