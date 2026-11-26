# The Don of Debt portfolio tools (MCP server)

Free, read-only tools for **lenders and creditors selling charged-off debt**, **collection agencies**, and **debt buyers**: sale-readiness and placement checklists, data-tape header mapping, document and chain-of-title gaps, diligence sequences, buy-box building, judgment-interest estimates, state judgment facts, regulator sources and verbatim FAQ search from [donofdebt.com](https://donofdebt.com).

**Connect URL (Streamable HTTP, no auth, free):**

```
https://donofdebt.com/mcp
```

```bash
claude mcp add --transport http donofdebt https://donofdebt.com/mcp
```

- 16 tools, every one read-only (`readOnlyHint: true`), with an `outputSchema` and `structuredContent`.
- Stateless: nothing is stored, and inputs are not logged.
- Aggregate inputs only. Personal or account-level data (names, SSNs, dates of birth, addresses, phone numbers, emails, account or case numbers, data-tape rows) is rejected with `pii_rejected` and never echoed back.
- About 60 requests per minute per IP. Over the limit you get HTTP 429 with `Retry-After: 60` (on `/mcp` the body is a JSON-RPC error, code -32029).
- JSON API and OpenAPI: `POST https://mcp.donofdebt.com/api/<tool>`, `GET https://mcp.donofdebt.com/openapi.json`. Server card: `https://donofdebt.com/.well-known/mcp/server-card.json`.

The Don of Debt (Jeffery Hartman) only introduces potential buyers and sellers privately. These tools never price a portfolio and never submit anything on your behalf.

## Tools by audience

**Lenders and creditors selling charge-offs**
| Tool | What it returns |
|---|---|
| `sale_readiness_check` | Stage checklist, top gaps to fix first, guide links |
| `data_tape_header_check` | Column-name mapping, missing recommended fields, sensitive columns to hold until an NDA (header names only) |
| `document_gap_check` | Missing documents for the asset class and why buyers ask for them |
| `portfolio_snapshot` | Factor summary, document gaps, file-completeness score. **No price.** |
| `chain_of_title_checklist` | Transfer-document checklist and open questions |
| `forward_flow_vs_spot` | One-time sale vs forward flow explainer (OCC 2014-37 context) |

**Collection agencies**
| Tool | What it returns |
|---|---|
| `placement_readiness_check` | Placement checklist (agreement, authority, validation fields, scrubs, licensing links, data security) |
| `judgment_interest_estimate` | Illustrative simple post-judgment interest. Computes on its own only for source-checked fixed-rate states; others need a rate you supply |
| `judgment_state_facts` | Judgment life and renewal, interest rule, assignment filing, licensing notes, each with a verified flag, source and check date |
| `state_regulator_sources` | Regulator, NMLS, CFPB and CSBS links (never a licensing conclusion) |
| `collection_net_recovery_calc` | Arithmetic on your own recovery and fee inputs |

**Debt buyers**
| Tool | What it returns |
|---|---|
| `buy_box_builder` | Structured buy box, unanswered criteria, optional fit check against an aggregate portfolio profile |
| `diligence_checklist` | The 8-stage due-diligence sequence (buyer or seller view) |
| `asset_class_guide` | Record story, documentation focus and typical documents for an asset class |

**All audiences**
| Tool | What it returns |
|---|---|
| `faq_search` | Verbatim answers from the 229 FAQs published on donofdebt.com (no AI rewriting), optional audience filter |
| `request_introduction` | The inquiry form link, the site page with the form, and a random reference code that is never stored. It collects no contact details |

## Client setup

**Claude Desktop / claude.ai:** Settings → Connectors → Add custom connector → URL `https://donofdebt.com/mcp`.
Or, for clients that only launch local servers, bridge with `mcp-remote` in `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "donofdebt": { "command": "npx", "args": ["-y", "mcp-remote", "https://donofdebt.com/mcp"] }
  }
}
```

**Claude Code:**
```bash
claude mcp add --transport http donofdebt https://donofdebt.com/mcp
```

**Cursor** (`~/.cursor/mcp.json` or `.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "donofdebt": { "url": "https://donofdebt.com/mcp" }
  }
}
```

**VS Code** (`.vscode/mcp.json`):
```json
{
  "servers": {
    "donofdebt": { "type": "http", "url": "https://donofdebt.com/mcp" }
  }
}
```

**Windsurf** (`~/.codeium/windsurf/mcp_config.json`):
```json
{
  "mcpServers": {
    "donofdebt": { "serverUrl": "https://donofdebt.com/mcp" }
  }
}
```

**Any other client:** use Streamable HTTP transport with `https://donofdebt.com/mcp`. No API key or OAuth.

**Raw JSON-RPC:**
```bash
curl -s https://donofdebt.com/mcp -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"diligence_checklist","arguments":{"side":"buyer"}}}'
```

## Guides on donofdebt.com

- [Debt for Sale](https://donofdebt.com/debt-for-sale): charged-off portfolio types, data tapes, and how a private introduction works.
- [Credit Card Charge-Off Portfolios for Sale](https://donofdebt.com/credit-card-charge-off-portfolios-for-sale): who sells credit card paper, what affects the discount to face value, and what to request.
- [Non-Performing Loan Portfolios](https://donofdebt.com/non-performing-loan-portfolios): non-performing vs. charged-off loans, common NPL portfolio types, and what buyers review.

Jeffery Hartman, The Don of Debt, introduces qualified buyers and sellers of debt portfolios. He does not buy debt or act as a broker.

## Not legal, valuation, or compliance advice

Every result is educational. It carries a disclaimer, a notice, its sources and an `as_of` date. Judgment-interest figures are illustrative estimates, not amounts owed. State facts and regulator links are research starting points; confirm with the court record, the regulator and your own counsel. Nothing here is an offer to buy or sell any debt, and no tool prices a portfolio.

## Source

A single stateless Cloudflare Worker.
- `src/worker.js`: PII guard, schema validation, the 16 tools, MCP JSON-RPC (Streamable HTTP, stateless JSON responses), REST API, OpenAPI, docs page
- `src/content.js`, `src/judgment.js`: site-derived content and judgment-interest rules
- `data/`: published FAQs and the 51-jurisdiction judgment research
- `scripts/build.mjs`: bundles everything into `dist/worker.js`
- `scripts/copy-check.mjs`: wording-rule check over source, data and docs
- `tests/run-tests.mjs`: end-to-end suite (`BASE=local` runs in-process; `BASE=https://mcp.donofdebt.com MCP_BASE=https://donofdebt.com` runs live)
- `tests/sdk-handshake.mjs`: official MCP TypeScript SDK client check of all 16 tools

```bash
node scripts/build.mjs
node scripts/copy-check.mjs
BASE=local node tests/run-tests.mjs
npx wrangler deploy   # to run your own copy (see wrangler.toml)
```

## Contact

admin@jefferyhartman.com · [donofdebt.com](https://donofdebt.com)

## License

[MIT](LICENSE)
