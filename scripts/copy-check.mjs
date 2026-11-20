// Fails (exit 1) if any source, data, build output, doc, or captured tool output breaks the copy rules.
import fs from "node:fs";
import path from "node:path";
import { checkText } from "./copy-rules.mjs";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (!["node_modules", "scripts", ".git"].includes(f.name)) walk(p); } else if (/\.(js|mjs|json|md|txt|html)$/.test(f.name)) files.push(p); } };
walk(root);
for (const extra of []) { const p = path.join(root, extra); if (fs.existsSync(p)) files.push(p); }
let hits = [];
for (const f of files) hits = hits.concat(checkText(fs.readFileSync(f, "utf8"), path.relative(root, f)));
console.log(`copy-check: scanned ${files.length} files`);
if (hits.length) { console.log(JSON.stringify(hits, null, 2)); console.log(`copy-check: FAIL (${hits.length} hits)`); process.exit(1); }
console.log("copy-check: PASS (0 hits)");
