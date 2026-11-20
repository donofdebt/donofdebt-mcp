// Copy-rule denylist: The Don of Debt / Jeffery Hartman only introduces buyers and sellers.
import { createHash } from "node:crypto";
// Excluded firm names are matched by SHA-256 of each lower-cased word, so the names never appear in this repo.
const EXCLUDED_WORD_HASHES = new Set(["00288e37e35426e83827209ce6d0c37a75a4f45bdd44dc102380ed83a373ed25"]);
export const RULES = [
  { id: "we-buy", re: /(?<!\b(?:can|could|should|do|would|may|might|where|how|when|if)\s+)\b(we|i)\s+(will\s+|'ll\s+|also\s+)?(buy|purchase|acquire)\b/i },
  { id: "we-buy-contraction", re: /\b(we|i)'(ll|re|m)\s+(buy|buying|purchas\w*)\b/i },
  { id: "buy-your-debt", re: /\bbuy(ing)?\s+your\s+(debt|portfolio|accounts|paper)\b/i },
  { id: "self-broker", re: /\b(the don of debt|don of debt|jeffery hartman|jeffery|hartman|we|he|this (service|tool|server))\b[^.?!\n]{0,40}?\b(is|are|acts?\s+as|serves?\s+as|works?\s+as|operates?\s+as)\s+(a|an|the|your)\s+(\w+\s+){0,2}?(broker|brokerage|debt\s+buyer|debt\s+purchaser)\b/i, negatable: true },
  { id: "our-brokerage", re: /\bour\s+(brokerage|broker|debt[- ]buying)\b/i },
  { id: "sister-self-description", re: /\bwe are paid by buyers|per-introduction fee|success fee\b/i },
];
const NEG = /\b(not|never|n't|no longer|neither|nor)\b|n't\b/i;
export function checkText(text, where) {
  const hits = [];
  for (const r of RULES) {
    const g = new RegExp(r.re.source, r.re.flags.includes("g") ? r.re.flags : r.re.flags + "g");
    let m;
    while ((m = g.exec(text))) {
      if (r.negatable && NEG.test(m[0])) continue;
      // Quoted rule text (e.g. never say "we buy") is a rule statement, not a claim.
      const before = text[m.index - 1] || "", after = text[m.index + m[0].length] || "";
      if (/["“'`]/.test(before) && /["”'`]/.test(after)) continue;
      hits.push({ rule: r.id, where, match: m[0].slice(0, 160) });
    }
  }
  for (const m of text.matchAll(/[A-Za-z]+/g)) {
    if (EXCLUDED_WORD_HASHES.has(createHash("sha256").update(m[0].toLowerCase()).digest("hex"))) hits.push({ rule: "excluded-firm", where, match: "[excluded firm name]" });
  }
  return hits;
}
