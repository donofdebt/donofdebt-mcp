// ---- Judgment interest rules. Fixed rates computed only where the statute text was source-checked. ----
const RECHECK_NOV19 = "2026-11-19";
const FIXED_RATE_STATES = {
  CA: { cite: "Cal. Code Civ. Proc. § 685.010", source: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CCP&sectionNum=685.010", checked: RECHECK_NOV19, source_type: "official" },
  IL: { cite: "735 ILCS 5/2-1303", source: "https://www.ilga.gov/documents/legislation/ilcs/documents/073500050K2-1303.htm", checked: RECHECK_NOV19, source_type: "official" },
  MD: { cite: "Md. Code, Cts. & Jud. Proc. § 11-107", source: "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcj&section=11-107", checked: RECHECK_NOV19, source_type: "official" },
  MO: { cite: "Mo. Rev. Stat. § 408.040", source: "https://revisor.mo.gov/main/OneSection.aspx?section=408.040", checked: RECHECK_NOV19, source_type: "official" },
  NC: { cite: "N.C. Gen. Stat. § 24-1 (legal rate); § 24-5 (judgments)", source: "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_24/GS_24-1.html", checked: RECHECK_NOV19, source_type: "official" },
  NY: { cite: "N.Y. CPLR 5004", source: "https://newyork.public.law/laws/n.y._civil_practice_law_and_rules_section_5004", checked: RECHECK_NOV19, source_type: "secondary (public.law mirror; the official nysenate.gov page blocked an automated check)" },
  OR: { cite: "ORS 82.010", source: "https://www.oregonlegislature.gov/bills_laws/ors/ors082.html", checked: RECHECK_NOV19, source_type: "official" },
  PA: { cite: "42 Pa.C.S. § 8101; 41 P.S. § 202", source: "https://www.palegis.us/WU01/LI/LI/CT/HTM/42/00.081.001.000..HTM", checked: "2026-10", source_type: "official for § 8101 ('lawful rate'); the 6% figure comes from 41 P.S. § 202 as read by Pennsylvania appellate courts" },
  RI: { cite: "R.I. Gen. Laws § 9-21-10", source: "https://webserver.rilegislature.gov/Statutes/TITLE9/9-21/9-21-10.htm", checked: RECHECK_NOV19, source_type: "official" },
  VA: { cite: "Va. Code § 6.2-302", source: "https://law.lis.virginia.gov/vacode/title6.2/chapter3/section6.2-302/", checked: RECHECK_NOV19, source_type: "official" },
  WA: { cite: "RCW 4.56.110", source: "https://app.leg.wa.gov/RCW/default.aspx?cite=4.56.110", checked: RECHECK_NOV19, source_type: "official" },
};

const CONSUMER_TYPES = new Set(["consumer_personal", "consumer_medical"]);

// Returns { scenarios:[{label, rate_pct, basis}], warnings:[] } or { override_required: reason, warnings }
function judgmentRule(state, principal, jdate, debtType, defendantType = "unknown") {
  const w = [];
  const consumer = CONSUMER_TYPES.has(debtType);
  const unknown = debtType === "unknown";
  switch (state) {
    case "CA": {
      w.push("The Legislature may change the § 685.010 rate prospectively, regardless of the judgment date (§ 685.010(b)).");
      const post2023 = jdate >= "2023-01-01";
      if (debtType === "commercial_or_other" || debtType === "residential_rent") return { scenarios: [{ label: "General rate", rate_pct: 10, basis: "§ 685.010(a)(1): 10% a year on the unsatisfied principal" }], warnings: w };
      if (!post2023) {
        w.push("For consumer judgments entered before 2023, a renewal application filed on or after January 1, 2023 can trigger the 5% rate under § 685.010(a)(2). Confirm the renewal history.");
        return { scenarios: [{ label: "General rate", rate_pct: 10, basis: "§ 685.010(a)(1)" }], warnings: w };
      }
      if (debtType === "consumer_personal") {
        if (principal < 50000) return { scenarios: [{ label: "Personal debt under $50,000", rate_pct: 5, basis: "§ 685.010(a)(2)(A)(ii)" }], warnings: w };
        return { scenarios: [{ label: "General rate", rate_pct: 10, basis: "§ 685.010(a)(1); the 5% personal-debt rate applies only under $50,000" }], warnings: w };
      }
      if (debtType === "consumer_medical") {
        if (principal < 200000) return { scenarios: [{ label: "Medical-expense debt under $200,000", rate_pct: 5, basis: "§ 685.010(a)(2)(A)(i)" }], warnings: w };
        return { scenarios: [{ label: "General rate", rate_pct: 10, basis: "§ 685.010(a)(1)" }], warnings: w };
      }
      w.push("Debt type not stated, so both scenarios are shown. The 5% rate applies to personal debt under $50,000 and medical-expense debt under $200,000 against a natural person.");
      const s = [{ label: "General rate", rate_pct: 10, basis: "§ 685.010(a)(1)" }];
      if (principal < 200000) s.push({ label: "Consumer (personal under $50k or medical under $200k)", rate_pct: 5, basis: "§ 685.010(a)(2)" });
      return { scenarios: s, warnings: w };
    }
    case "IL": {
      w.push("Judgments against a unit of local government or other governmental entity draw 6% (§ 2-1303(a)); not modeled here.");
      const gen = { label: "General rate", rate_pct: 9, basis: "735 ILCS 5/2-1303(a)" };
      const cons = { label: "Consumer debt judgment of $25,000 or less", rate_pct: 5, basis: "735 ILCS 5/2-1303(b)(2)" };
      if (consumer && principal <= 25000) {
        if (jdate < "2020-01-01") return { override_required: "Illinois consumer-debt judgments of $25,000 or less entered before the 2020 amendment (P.A. 101-168) may follow a different rate. Supply rate_override_pct after confirming with counsel.", warnings: w };
        return { scenarios: [cons], warnings: w };
      }
      if (unknown && principal <= 25000 && jdate >= "2020-01-01") { w.push("Debt type not stated, so both scenarios are shown."); return { scenarios: [gen, cons], warnings: w }; }
      return { scenarios: [gen], warnings: w };
    }
    case "MD": {
      w.push("§ 11-107 has other exceptions (for example § 11-106 and property-tax judgments). Confirm which subsection applies.");
      if (debtType === "residential_rent") return { scenarios: [{ label: "Residential rent judgment", rate_pct: 6, basis: "§ 11-107(b)" }], warnings: w };
      return { scenarios: [{ label: "General rate", rate_pct: 10, basis: "§ 11-107(a)" }], warnings: w };
    }
    case "MO":
      w.push("Non-tort judgments on contracts bearing more than 9% carry the contract rate; tort judgments use a different, variable rate (§ 408.040.3). Confirm which applies.");
      return { scenarios: [{ label: "Non-tort default rate", rate_pct: 9, basis: "§ 408.040.2" }], warnings: w };
    case "NC":
      w.push("Under § 24-5 a judgment on a contract may carry the contract rate. Confirm which rate the judgment states.");
      return { scenarios: [{ label: "Legal rate", rate_pct: 8, basis: "§ 24-1" }], warnings: w };
    case "NY": {
      w.push("Source is a secondary mirror of CPLR 5004 (unofficial); confirm on the official New York statutes site.");
      const gen = { label: "General rate", rate_pct: 9, basis: "CPLR 5004(a)" };
      const cons = { label: "Consumer debt, natural-person defendant", rate_pct: 2, basis: "CPLR 5004(a) as amended (FAIR Consumer Judgment Interest Act)" };
      const consumerDefinite = consumer;
      const consumerPossible = consumer || unknown || debtType === "residential_rent";
      const naturalDefinite = defendantType === "natural_person";
      const naturalPossible = defendantType !== "business_or_other";
      if (!consumerPossible || !naturalPossible) {
        w.push(!naturalPossible ? "Defendant is not a natural person, so the 2% consumer-debt rate does not apply." : "Debt is not consumer debt, so the 2% rate does not apply.");
        return { scenarios: [gen], warnings: w };
      }
      if (jdate < "2022-05-01") return { override_required: "New York's 2% consumer-debt rate also applies to interest accruing after the 2022 amendment's effective date on older judgments, so judgments entered before May 2022 can accrue at mixed rates. Supply rate_override_pct (or split the period) after confirming with counsel.", warnings: w };
      if (consumerDefinite && naturalDefinite) return { scenarios: [cons], warnings: w };
      w.push("Debt type or defendant type not fully stated, so both scenarios are shown. The 2% rate applies only to consumer debt against a natural-person defendant; otherwise 9%.");
      return { scenarios: [gen, cons], warnings: w };
    }
    case "OR":
      w.push("ORS 82.010 applies 9% when the parties have not agreed to a different rate; a contract rate may apply.");
      return { scenarios: [{ label: "Statutory rate", rate_pct: 9, basis: "ORS 82.010" }], warnings: w };
    case "PA":
      w.push("The 6% figure comes from 41 P.S. § 202 as applied to judgments by Pennsylvania appellate courts, not from the text of § 8101 itself. Confirm with counsel.");
      return { scenarios: [{ label: "Lawful rate", rate_pct: 6, basis: "42 Pa.C.S. § 8101; 41 P.S. § 202" }], warnings: w };
    case "RI":
      w.push("§ 9-21-10 does not apply to contractual obligations where interest is already provided, and some medical-liability actions are excluded.");
      return { scenarios: [{ label: "Statutory rate", rate_pct: 12, basis: "§ 9-21-10(a)" }], warnings: w };
    case "VA":
      w.push("A money judgment arising from a contract carries the contract rate or 6%, whichever is higher (§ 6.2-302(A)).");
      return { scenarios: [{ label: "Judgment rate", rate_pct: 6, basis: "§ 6.2-302" }], warnings: w };
    case "WA":
      if (consumer) return { scenarios: [{ label: "Unpaid consumer debt", rate_pct: 9, basis: "RCW 4.56.110(5)" }], warnings: ["Consumer debt as defined in RCW 6.01.060. Confirm the judgment's terms."] };
      return { override_required: "Washington's general judgment rate is variable (the RCW 19.52.020 maximum rate on the date of entry), and tort and contract judgments follow other subsections. Only the 9% consumer-debt rate is computed here; supply rate_override_pct for other judgments.", warnings: w };
  }
  return null;
}

function daysBetween(a, b) { return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000); }
const r2 = (x) => Math.round(x * 100) / 100;

// Simple interest, 365-day year, payments applied to accrued interest first (US Rule).
function accrue(principal, ratePct, start, end, payments) {
  let p = principal, unpaid = 0, last = start, totalInterest = 0;
  const applied = [];
  const evs = (payments || []).filter((x) => x.date > start && x.date <= end).sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const ev of evs) {
    const d = daysBetween(last, ev.date);
    const i = p * (ratePct / 100) * d / 365;
    unpaid += i; totalInterest += i;
    let amt = ev.amount_usd;
    const toInt = Math.min(amt, unpaid); unpaid -= toInt; amt -= toInt;
    const toPrin = Math.min(amt, p); p -= toPrin; amt -= toPrin;
    applied.push({ date: ev.date, amount_usd: ev.amount_usd, to_interest: r2(toInt), to_principal: r2(toPrin), excess: r2(amt) });
    last = ev.date;
  }
  const d = daysBetween(last, end);
  const i = p * (ratePct / 100) * d / 365;
  unpaid += i; totalInterest += i;
  return {
    rate_pct: ratePct,
    days: daysBetween(start, end),
    per_diem_usd: r2(p * (ratePct / 100) / 365),
    interest_accrued_total_usd: r2(totalInterest),
    unpaid_interest_usd: r2(unpaid),
    principal_remaining_usd: r2(p),
    illustrative_total_usd: r2(p + unpaid),
    payments_applied: applied,
  };
}
