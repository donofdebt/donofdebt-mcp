// ---- Static content drawn from donofdebt.com (prod build of donofdebt/donodebt2 @17e2a0d, Nov 19 2026) ----
const SITE = "https://donofdebt.com";
const JOTFORM_URL = "https://form.jotform.com/262856575148066";
const CONTENT_AS_OF = "2026-11-19";
const SERVER_VERSION = "0.2.1";

// Site disclaimer, verbatim from the donofdebt.com footer (adaptation to "This tool provides" awaits GoldGuy's OK).
const SITE_DISCLAIMER =
  "This website provides general information, not a binding offer, valuation, legal advice, or compliance advice. Portfolio pricing and transferability depend on the asset, seller authority, account facts, documentation, applicable law, servicing, and buyer demand. No live listing or outcome is represented unless it is confirmed directly for the transaction. Consult qualified advisers.";
const TOOL_NOTICE =
  "Outputs are educational estimates and checklists, not legal, valuation, or compliance advice. Do not send personal or account-level data.";
const ROLE_NOTE =
  "The Don of Debt (Jeffery Hartman) only introduces potential buyers and sellers privately. Any transaction terms are between the parties and their advisers.";
const FACE_VALUE_NOTE = "Face value is not market value. There is no universal price or guaranteed outcome.";
const JUDGMENT_NOTICE =
  "Illustrative interest estimate. Not legal advice, not a statement of any amount owed. Rates, accrual method, and applicability vary by court, judgment type, and date; verify with the court record and counsel.";

const PAGES = {
  debt_for_sale: SITE + "/debt-for-sale",
  seller_intake: SITE + "/debt-portfolio-seller-intake",
  buyer_application: SITE + "/qualified-debt-buyer-application",
  diligence_checklist: SITE + "/debt-portfolio-due-diligence-checklist",
  diligence_protocol: SITE + "/the-dons-diligence-protocol",
  data_tape: SITE + "/debt-portfolio-data-tape-checklist",
  chain_of_title: SITE + "/chain-of-title-debt-portfolio-sale",
  seller_readiness: SITE + "/seller-readiness-brief",
  seller_authority: SITE + "/seller-authority-transfer-restrictions",
  confidentiality: SITE + "/private-debt-sale-confidentiality-checklist",
  buy_box: SITE + "/debt-buyer-buy-box-guide",
  asset_classes: SITE + "/charged-off-debt-portfolio-asset-classes",
  licensing: SITE + "/debt-buyer-state-licensing-guide",
  servicing: SITE + "/servicing-considerations-debt-buyers",
  disputed: SITE + "/disputed-incomplete-portfolio-accounts",
  agency_start: SITE + "/how-to-start-a-debt-collection-agency",
  buyer_vs_agency: SITE + "/debt-buyer-vs-collection-agency",
  how_to_buy: SITE + "/how-to-buy-debt",
  online_private: SITE + "/online-debt-sales-private-process",
  purchase_agreement: SITE + "/portfolio-purchase-agreement-questions",
  commercial: SITE + "/commercial-debt-buying",
};

const EXT = {
  occ_2014_37: "https://www.occ.gov/news-issuances/bulletins/2014/bulletin-2014-37.html",
  reg_f: "https://www.ecfr.gov/current/title-12/chapter-X/part-1006",
  reg_f_1006_34: "https://www.consumerfinance.gov/rules-policy/regulations/1006/34",
  cfpb_exam: "https://files.consumerfinance.gov/f/documents/cfpb_debt-collection-examination-procedures.pdf",
  ftc_safeguards: "https://www.ftc.gov/business-guidance/resources/ftc-safeguards-rule-what-your-business-needs-know",
  nmls_slr: "https://mortgage.nationwidelicensingsystem.org/slr/Pages/default.aspx",
  csbs_overview: "https://www.csbs.org/sites/default/files/other-files/Chapter%20Five%20-%20Overview%20of%20Debt%20Collection%20FINAL4_updated.pdf",
  ftc_debt_buying: "https://www.ftc.gov/sites/default/files/documents/reports/structure-and-practices-debt-buying-industry/debtbuyingreport.pdf",
  ucc: "https://www.uniformlaws.org/acts/ucc",
  ca_dfpi: "https://dfpi.ca.gov/regulated-industries/debt-collection-licensee/",
  ct_dob: "https://portal.ct.gov/dob/consumer-credit-licensing-info/consumer-credit-licensing-information/collection-agency-licensing-information",
  fed_1961: "https://www.law.cornell.edu/uscode/text/28/1961",
};

// One asset-class enum shared by every tool. Old values are accepted as aliases (see ASSET_ALIASES).
const ASSET_LABELS = {
  "credit-card": "Credit card (general-purpose)",
  "prime-cc": "Prime credit card",
  "subprime-cc": "Subprime credit card",
  "retail-card": "Retail or store card",
  "personal-loan": "Personal loan",
  "installment-loan": "Installment loans",
  "auto-deficiency": "Auto deficiency",
  bhph: "BHPH (buy here, pay here)",
  rto: "RTO (rent-to-own)",
  medical: "Medical debt",
  payday: "Payday loans",
  fintech: "Fintech loans",
  "telecom-utility": "Telecom or utility",
  mca: "Merchant cash advance (MCA)",
  commercial: "Commercial receivables",
  "disputed-incomplete": "Disputed or incomplete accounts",
  other: "Other or mixed",
};
const ASSET_ALIASES = { auto: "auto-deficiency", installments: "installment-loan", "installment-loans": "installment-loan", "auto-loan": "auto-deficiency", "store-card": "retail-card", "credit_card": "credit-card", "personal_loan": "personal-loan", "telecom": "telecom-utility", "utility": "telecom-utility" };
const AGE_LABELS = {
  "0-12m": "Fresh (0–12 months)",
  "1-3y": "Aged (1–3 years)",
  "3-6y": "Older (3–6 years)",
  "6y+": "Older (6+ years)",
  unknown: "Not stated",
};
const PLACEMENT_LABELS = {
  primary: "Primary (direct from creditor)",
  secondary: "Secondary (one prior placement)",
  tertiary: "Tertiary (2+ prior placements)",
  unknown: "Not stated",
};
const MEDIA_LABELS = {
  full: "Full media available",
  partial: "Partial media",
  none: "No media",
  unknown: "Not stated",
};

// Document checklist (Diligence Protocol + data tape checklist + chain of title pages)
const DOCUMENTS = {
  bill_of_sale_chain: { label: "Bills of sale and assignments for every transfer (chain of title)", why: "Buyers trace the accounts from the originator through each transfer to the seller before relying on the pool.", page: PAGES.chain_of_title, weight: 3 },
  account_schedule: { label: "Account schedule or exhibit tied to the transfer documents", why: "A portfolio-level bill of sale may need a schedule that identifies the account population.", page: PAGES.chain_of_title, weight: 2 },
  original_agreements: { label: "Account agreements or applications (where relevant to the asset)", why: "Buyers ask what evidence exists for the specific asset type and what the seller can deliver.", page: PAGES.diligence_protocol, weight: 2 },
  last_statements: { label: "Account statements", why: "Statements support the account description and balance.", page: PAGES.diligence_protocol, weight: 2 },
  chargeoff_statements: { label: "Charge-off statements or charge-off balance support", why: "Charge-off information is reconciled to the data tape.", page: PAGES.diligence_protocol, weight: 2 },
  payment_history: { label: "Payment history", why: "Payment history is reconciled to the tape and supports balance logic.", page: PAGES.diligence_protocol, weight: 2 },
  data_tape_field_dictionary: { label: "Data tape with a field dictionary and cut-off date", why: "Field definitions, source systems, and cut-off dates are reconciled before the tape is used as an input.", page: PAGES.data_tape, weight: 3 },
  dispute_log: { label: "Dispute, complaint, and exception log", why: "Known disputes and exceptions are identified and separated rather than assumed absent.", page: PAGES.disputed, weight: 2 },
  bankruptcy_deceased_scrub: { label: "Bankruptcy, deceased, and other flag scrub results", why: "Flags trigger review and possible exclusion; a flag is not a legal conclusion.", page: PAGES.diligence_protocol, weight: 2 },
  sol_review: { label: "Statute-of-limitations review (with counsel)", why: "SOL and state-specific issues may need account-by-account review where required.", page: PAGES.diligence_protocol, weight: 2 },
  state_mix_summary: { label: "Aggregate state-mix summary", why: "Geography affects licensing, servicing, and legal review questions.", page: PAGES.licensing, weight: 1 },
  seller_authority_docs: { label: "Evidence of seller authority and any transfer restrictions", why: "Seller authority and transfer limits are the first diligence check.", page: PAGES.seller_authority, weight: 3 },
  nda_ready: { label: "Confidentiality agreement (NDA) and secure-transfer plan", why: "Account-level files should move only under confidentiality and secure transfer, never ordinary email.", page: PAGES.confidentiality, weight: 1 },
};
const DOC_KEYS = Object.keys(DOCUMENTS);

const ASSET_DOC_EXTRAS = {
  "auto-deficiency": ["Vehicle repossession and disposition chronology (notices, sale, deficiency calculation)"],
  bhph: ["Retail installment contract, servicing history, and furnishing provenance"],
  "retail-card": ["Brand or program references and statement-cycle details"],
  "telecom-utility": ["Provider, service-period, billing-event, and adjustment records"],
  "personal-loan": ["Loan agreement reference and dated history"],
  "installment-loan": ["Loan agreement reference and dated history"],
  medical: ["Provider and service records handled under applicable health-privacy requirements (confirm with counsel)"],
  mca: ["Merchant agreement, remittance history, and guarantor documents (commercial)"],
  commercial: ["Invoices, contracts, and correspondence supporting each receivable"],
};

// Diligence checklist: 8 stages from /debt-portfolio-due-diligence-checklist (published Oct 6, 2026)
const DILIGENCE_STAGES = [
  { id: "authority", n: 1, title: "Confirm seller authority and transaction scope", text: "Identify the proposed seller, its authority, the account pool in scope, any intermediaries, servicing roles, collateral interests, participation rights, and the agreements that may limit a transfer or disclosure." },
  { id: "ownership", n: 2, title: "Trace ownership and transfer support", text: "Reconcile bills of sale, assignments, schedules, chain-of-title records, and account identifiers. A template or sample document is not proof that every scheduled account carries the same support." },
  { id: "account_support", n: 3, title: "Match records to the proposed balances", text: "Review the agreements, credit applications where relevant, invoices, statements, payment history, credits, adjustments, correspondence, and other records that support the account description and balance." },
  { id: "data", n: 4, title: "Test the data tape and exception log", text: "Define the fields, source systems, cut-off date, duplicates, missing values, balance logic, samples, and exception categories. Reconcile the data schedule to supporting records before treating it as an underwriting input." },
  { id: "flags", n: 5, title: "Separate restrictions, disputes, and exclusions", text: "Identify disputes, settlements, bankruptcies, deceased or identity concerns, statute-of-limitations questions, military-status or other regulatory considerations, litigation, collateral, notice requirements, and contractual restrictions with qualified advisers." },
  { id: "operating", n: 6, title: "Define servicing and information controls", text: "Clarify who will hold and use files, service or administer accounts, handle communications, maintain records, manage vendors, protect data, and follow applicable requirements. A purchase discussion does not itself establish operating authority." },
  { id: "economics", n: 7, title: "Model assumptions without treating them as facts", text: "Document the inputs, costs, timing, fees, taxes, legal expenses, servicing assumptions, sensitivities, and excluded accounts behind any analysis. Do not substitute a headline face balance, historical result, or generic recovery rate for transaction-specific work." },
  { id: "closing", n: 8, title: "Negotiate representations, remedies, and closing controls", text: "Review the purchase agreement, schedules, disclosure obligations, representations, exclusions, remedies, notices, payment mechanics, closing conditions, data-transfer process, and post-closing responsibilities with qualified advisers." },
];
const SELLER_STAGE_PREP = {
  authority: "Gather evidence of authority to sell and list any agreements that restrict transfer or disclosure.",
  ownership: "Assemble each bill of sale, assignment, and schedule from the originator forward.",
  account_support: "Measure document availability by type (agreements, statements, charge-off support, payment history).",
  data: "Prepare the data tape with a field dictionary, cut-off date, row counts, and an exception log.",
  flags: "Run and document bankruptcy, deceased, dispute, and other scrubs; have counsel review SOL questions.",
  operating: "Decide how files will move (NDA, secure transfer) and what post-sale support you can give.",
  economics: "Document the aggregate facts a buyer will model; do not state a price expectation as a fact.",
  closing: "List purchase-agreement questions (representations, buyback or put-back terms, notices) for your counsel.",
};

// Asset class guide (from /charged-off-debt-portfolio-asset-classes and its feeder guides)
const ASSET_GUIDES = {
  "credit-card": { label: "General-purpose credit card", record_story: "General-purpose revolving account story", focus: "Statement-to-itemization and creditor-reference continuity.", typical_documents: ["Cardholder agreement or terms in effect", "Account statements", "Charge-off statement", "Payment history", "Bill of sale and schedule"], guide: SITE + "/charged-off-credit-card-debt-portfolios" },
  "personal-loan": { label: "Personal loan", record_story: "Fixed-term personal-loan account story", focus: "Agreement-reference and dated history tracing.", typical_documents: ["Loan agreement", "Payment history", "Charge-off balance support", "Bill of sale and schedule"], guide: SITE + "/charged-off-personal-loan-portfolios" },
  "auto-deficiency": { label: "Auto deficiency", record_story: "Vehicle repossession or disposition story", focus: "A vehicle-and-disposition chronology.", typical_documents: ["Retail installment contract", "Repossession and sale notices", "Disposition and deficiency calculation", "Payment history", "Bill of sale and schedule"], guide: SITE + "/charged-off-auto-deficiency-accounts" },
  bhph: { label: "Buy here, pay here (BHPH)", record_story: "Buy-here-pay-here receivable story", focus: "Contract, servicing-history, and furnishing provenance.", typical_documents: ["Retail installment contract", "Servicing history", "Furnishing records", "Payment history"], guide: SITE + "/charged-off-bhph-receivables" },
  "retail-card": { label: "Retail or store card", record_story: "Store-brand or retail-card story", focus: "Brand or program references and statement-cycle variance.", typical_documents: ["Program and brand references", "Account statements", "Charge-off statement", "Payment history"], guide: SITE + "/charged-off-retail-store-card-accounts" },
  "telecom-utility": { label: "Telecom or utility", record_story: "Telecom or utility service-account story", focus: "Provider, period, billing-event, and adjustment mapping.", typical_documents: ["Service agreement or terms", "Final bill", "Billing events and adjustments", "Service period records"], guide: SITE + "/charged-off-telecom-utility-accounts" },
  mca: { label: "Merchant cash advance (MCA) and business debt", record_story: "Commercial receivable story", focus: "Merchant agreement, remittance history, guarantor documents, and commercial-law questions.", typical_documents: ["Merchant agreement", "Remittance history", "Guaranty documents", "Default and reconciliation records"], guide: SITE + "/mca-business-debt-portfolios" },
  commercial: { label: "Commercial receivables", record_story: "Business-to-business receivable story", focus: "Invoices, contracts, and correspondence supporting each receivable.", typical_documents: ["Contracts or purchase orders", "Invoices", "Statements of account", "Correspondence"], guide: SITE + "/commercial-debt-buying" },
  "disputed-incomplete": { label: "Disputed or incomplete accounts", record_story: "Exception story", focus: "Keep exception signals visible instead of turning a gap into a conclusion.", typical_documents: ["Exception log", "Dispute history with dates and source", "Missing-document list"], guide: PAGES.disputed },
};

{
  const cc = ASSET_GUIDES["credit-card"], pl = ASSET_GUIDES["personal-loan"];
  ASSET_GUIDES["prime-cc"] = Object.assign({}, cc, { label: "Prime credit card" });
  ASSET_GUIDES["subprime-cc"] = Object.assign({}, cc, { label: "Subprime credit card" });
  ASSET_GUIDES["installment-loan"] = Object.assign({}, pl, { label: "Installment loans" });
  const hub = (label, focus, docs) => ({ label, record_story: "No dedicated record guide on donofdebt.com; route by the stated record story", focus, typical_documents: docs, guide: PAGES.asset_classes });
  ASSET_GUIDES.rto = hub("RTO (rent-to-own)", "Lease or rental-purchase agreement, merchandise and return history, and payment records.", ["Rental-purchase agreement", "Payment history", "Return or recovery records", "Bill of sale and schedule"]);
  ASSET_GUIDES.medical = hub("Medical debt", "Provider, service, and billing records, handled under applicable health-privacy and medical-debt rules (confirm with counsel).", ["Provider billing statements", "Insurance adjudication history", "Payment history", "Bill of sale and schedule"]);
  ASSET_GUIDES.payday = hub("Payday loans", "Loan agreement, licensing of the originator, and dated transaction history.", ["Loan agreement", "Transaction history", "Charge-off balance support", "Bill of sale and schedule"]);
  ASSET_GUIDES.fintech = hub("Fintech loans", "Originating-bank or lender agreements, electronic records, and servicing history.", ["Loan agreement and electronic-signature records", "Payment history", "Servicing records", "Bill of sale and schedule"]);
  ASSET_GUIDES.other = hub("Other or mixed", "Keep mixed labels as a routing question and use the diligence checklist.", ["Account agreements", "Statements", "Payment history", "Bill of sale and schedule"]);
}
for (const k of Object.keys(ASSET_LABELS)) if (!ASSET_GUIDES[k]) throw new Error("missing asset guide: " + k);

// Official sources preferred over mirrors for state regulator links.
const MIRROR_DOMAINS = ["public.law", "justia.com", "casetext.com", "findlaw.com", "law.cornell.edu", "codes.findlaw.com", "lawserver.com"];
const isMirror = (url) => !!url && MIRROR_DOMAINS.some((d) => new URL(url).hostname === d || new URL(url).hostname.endsWith("." + d));
const OFFICIAL_REGULATOR_LINKS = {
  CA: [{ name: "California DFPI — debt collector licensing (Debt Collection Licensing Act)", url: "https://dfpi.ca.gov/regulated-industries/debt-collection-licensee/", checked: "2026-11-19" }],
  CT: [{ name: "Connecticut Department of Banking — collection agency licensing", url: "https://portal.ct.gov/dob/consumer-credit-licensing-info/consumer-credit-licensing-information/collection-agency-licensing-information", checked: null }],
  FL: [
    { name: "Florida Office of Financial Regulation — Consumer Collection Agencies", url: "https://flofr.gov/sitePages/ConsumerCollectionAgencies.htm", checked: "2026-11-19" },
    { name: "Fla. Stat. § 559.553 (official Florida Senate statutes)", url: "https://www.flsenate.gov/Laws/Statutes/2025/559.553", checked: "2026-11-19" },
  ],
  TX: [{ name: "Tex. Fin. Code ch. 392 (official Texas statutes site; page renders by script, text not machine-checked)", url: "https://statutes.capitol.texas.gov/Docs/FI/htm/FI.392.htm", checked: null }],
};

// Data tape field dictionary (from /debt-portfolio-data-tape-checklist and Reg F § 1006.34 context)
const TAPE_FIELDS = [
  { key: "portfolio_id", category: "identifiers", label: "Portfolio identifier", syn: ["portfolio id", "portfolio", "pool id", "pool", "tranche", "file id"] },
  { key: "account_reference", category: "identifiers", label: "Account reference (masked or permitted reference)", syn: ["account reference", "acct ref", "account id", "account number", "acct num", "acct no", "account no", "loan id", "loan number", "reference", "ref id", "masked account", "last4", "last 4"] },
  { key: "originator", category: "creditor", label: "Original creditor / originator", syn: ["original creditor", "originator", "orig creditor", "issuer", "lender"] },
  { key: "current_creditor", category: "creditor", label: "Current creditor / owner", syn: ["current creditor", "current owner", "owner", "seller", "creditor"] },
  { key: "open_date", category: "dates", label: "Account open date", syn: ["open date", "opened", "origination date", "orig date", "date opened"] },
  { key: "chargeoff_date", category: "dates", label: "Charge-off date", syn: ["charge off date", "chargeoff date", "co date", "charged off date", "chg off date"] },
  { key: "last_payment_date", category: "dates", label: "Last payment date", syn: ["last payment date", "lpd", "last pay date", "date last payment"] },
  { key: "delinquency_date", category: "dates", label: "Date of first delinquency", syn: ["delinquency date", "dofd", "first delinquency", "date of first delinquency"] },
  { key: "itemization_date", category: "dates", label: "Itemization date (Reg F § 1006.34)", syn: ["itemization date", "itemization"] },
  { key: "cutoff_date", category: "dates", label: "File / balance cut-off date", syn: ["cutoff date", "cut off date", "as of date", "balance date", "file date", "snapshot date"] },
  { key: "chargeoff_balance", category: "amounts", label: "Charge-off balance", syn: ["charge off balance", "chargeoff balance", "co balance", "charge off amount", "chargeoff amount"] },
  { key: "current_balance", category: "amounts", label: "Current balance", syn: ["current balance", "balance", "upb", "unpaid balance", "outstanding balance", "amount due", "balance due"] },
  { key: "principal", category: "amounts", label: "Principal", syn: ["principal", "principal balance"] },
  { key: "interest", category: "amounts", label: "Interest since itemization", syn: ["interest", "accrued interest", "post co interest"] },
  { key: "fees", category: "amounts", label: "Fees since itemization", syn: ["fees", "fee", "late fees", "post co fees"] },
  { key: "payments_credits", category: "amounts", label: "Payments and credits since itemization", syn: ["payments", "payments since chargeoff", "credits", "adjustments", "payments credits", "total payments"] },
  { key: "last_payment_amount", category: "amounts", label: "Last payment amount", syn: ["last payment amount", "last pay amt", "lpa"] },
  { key: "state", category: "geography", label: "State (aggregate geography)", syn: ["state", "st", "debtor state", "state code"] },
  { key: "status", category: "status_exceptions", label: "Account status", syn: ["status", "account status", "status code"] },
  { key: "dispute_flag", category: "status_exceptions", label: "Dispute flag / dispute history", syn: ["dispute", "dispute flag", "disputed", "dispute date"] },
  { key: "bankruptcy_flag", category: "status_exceptions", label: "Bankruptcy flag", syn: ["bankruptcy", "bk", "bk flag", "bankruptcy flag", "bk chapter"] },
  { key: "deceased_flag", category: "status_exceptions", label: "Deceased flag", syn: ["deceased", "deceased flag", "dec flag"] },
  { key: "settlement_flag", category: "status_exceptions", label: "Settlement / payment plan flag", syn: ["settlement", "settled", "payment plan", "pif sif"] },
  { key: "litigation_flag", category: "status_exceptions", label: "Litigation / judgment flag", syn: ["litigation", "judgment", "suit", "legal status"] },
  { key: "sol_date", category: "status_exceptions", label: "Statute-of-limitations reference date (counsel review)", syn: ["sol", "sol date", "statute of limitations", "sol expiration"] },
  { key: "placement_history", category: "placement", label: "Placement history (primary/secondary/tertiary)", syn: ["placement", "placement history", "agency level", "prior placements", "agency"] },
  { key: "media_available", category: "documents", label: "Media / document availability indicator", syn: ["media", "media available", "docs available", "documents", "doc flag"] },
];
const SENSITIVE_HEADER_PATTERNS = [
  { re: /(^|[^a-z])(first|last|middle|full|debtor|consumer|customer|borrower|cardholder|guarantor)?[ _-]*name($|[^a-z])/i, label: "name" },
  { re: /ssn|social[ _-]*sec|tax[ _-]*id|\btin\b|\bein\b/i, label: "SSN or tax ID" },
  { re: /\bdob\b|birth/i, label: "date of birth" },
  { re: /address|addr|street|\bzip\b|postal|\bcity\b/i, label: "address" },
  { re: /phone|mobile|\bcell\b|tel[ _-]*no/i, label: "phone" },
  { re: /e[ _-]*mail/i, label: "email" },
  { re: /(full|unmasked)[ _-]*(account|acct)|card[ _-]*number|\bpan\b|routing|bank[ _-]*account/i, label: "full account or card number" },
  { re: /employer|driver|license[ _-]*no/i, label: "other personal identifier" },
];

// Placement readiness (collection agencies) — sources: /how-to-start-a-debt-collection-agency, CFPB Reg F, FTC Safeguards Rule
const PLACEMENT_ITEMS = [
  { key: "placement_agreement", label: "Written placement or servicing agreement (scope, fees, remittance, recall rights)", source: PAGES.agency_start },
  { key: "creditor_authority", label: "Documented authority from the account owner to place and collect", source: PAGES.seller_authority },
  { key: "itemization_data", label: "Validation-information fields ready (itemization date, amounts, creditor names)", source: EXT.reg_f_1006_34 },
  { key: "account_support", label: "Account support available on request (statements, agreements, payment history)", source: PAGES.diligence_protocol },
  { key: "scrubs", label: "Bankruptcy, deceased, and dispute scrubs completed and documented", source: PAGES.disputed },
  { key: "sol_review", label: "Statute-of-limitations review completed with counsel", source: EXT.reg_f },
  { key: "licensing_confirmed", label: "State licensing and bonding confirmed with each regulator (links only; no conclusion here)", source: EXT.nmls_slr },
  { key: "data_security", label: "Information-security program and secure file transfer in place", source: EXT.ftc_safeguards },
  { key: "complaints_disputes", label: "Complaint and dispute handling process documented", source: EXT.reg_f },
  { key: "reporting_remittance", label: "Reporting, remittance, and reconciliation schedule agreed", source: PAGES.agency_start },
];

// Seller sale-readiness items (seller readiness brief, seller authority, confidentiality checklist, diligence protocol)
const SALE_READINESS_ITEMS = [
  { key: "authority_to_sell", stage: "Authority", label: "Authority to sell is documented", page: PAGES.seller_authority, priority: 1 },
  { key: "transfer_restrictions_reviewed", stage: "Authority", label: "Transfer and disclosure restrictions reviewed", page: PAGES.seller_authority, priority: 2 },
  { key: "chain_of_title_complete", stage: "Ownership", label: "Chain of title assembled from originator to seller", page: PAGES.chain_of_title, priority: 3 },
  { key: "data_tape_ready", stage: "Data", label: "Data tape prepared with cut-off date and row counts", page: PAGES.data_tape, priority: 4 },
  { key: "field_dictionary_ready", stage: "Data", label: "Field dictionary and exception log prepared", page: PAGES.data_tape, priority: 6 },
  { key: "media_inventory_done", stage: "Account support", label: "Document (media) availability measured by type", page: PAGES.diligence_protocol, priority: 5 },
  { key: "scrubs_completed", stage: "Flags", label: "Bankruptcy, deceased, and dispute scrubs completed", page: PAGES.disputed, priority: 7 },
  { key: "sol_review_done", stage: "Flags", label: "Statute-of-limitations questions reviewed with counsel", page: PAGES.diligence_protocol, priority: 8 },
  { key: "nda_ready", stage: "Confidentiality", label: "NDA and secure-transfer plan ready", page: PAGES.confidentiality, priority: 9 },
  { key: "sale_structure_decided", stage: "Structure", label: "Sale structure decided (one-time sale or forward flow)", page: PAGES.debt_for_sale, priority: 10 },
];

const FORWARD_FLOW = {
  summary: "Debt portfolios are sold in two common ways: a one-time (spot) sale of a single file, or a forward flow, where the seller agrees to sell new charge-offs to the same buyer on a schedule, under one contract.",
  one_time_sale: {
    what: "A one-time sale moves a single file.",
    seller_considerations: ["One set of transfer documents, schedule, and closing", "Suits a seller clearing an existing file", "Each later sale is a new process"],
    buyer_considerations: ["Diligence focuses on one defined pool", "Suits buyers testing a new asset class or seller"],
  },
  forward_flow: {
    what: "The seller agrees to sell new charge-offs to the same buyer on a schedule, under one contract. Federal bank guidance describes these as forward-flow arrangements where accounts keep moving to the buyer on an ongoing basis (OCC Bulletin 2014-37, August 4, 2014).",
    seller_considerations: ["Ongoing oversight of the buyer and its practices (OCC 2014-37 context for OCC-supervised banks)", "Recurring data, document-delivery, and transfer mechanics", "Term, volume, resale-limit, and termination provisions in the contract"],
    buyer_considerations: ["Suits buyers with proven operations", "Recurring diligence on each tranche", "Funding, servicing capacity, and reporting over the term"],
  },
  boundaries: "Discussing a recurring sale structure does not create a forward-flow commitment. Terms are negotiated by the parties with their own advisers.",
  sources: [PAGES.debt_for_sale, PAGES.how_to_buy, PAGES.online_private, EXT.occ_2014_37],
};

const CHAIN_OF_TITLE_ITEMS = [
  { key: "originator_identified", label: "Originator (original creditor) identified for the pool" },
  { key: "bill_of_sale_each_transfer", label: "Bill of sale for each known transfer" },
  { key: "assignment_each_transfer", label: "Assignment documents for each known transfer" },
  { key: "schedule_or_exhibit", label: "Schedule, exhibit, or account-level extract tied to each transfer document" },
  { key: "account_references_reconcile", label: "Account references reconcile across schedules and the current tape" },
  { key: "entity_changes_documented", label: "Name changes, mergers, or successor entities documented" },
  { key: "transfer_dates_consistent", label: "Transfer and effective dates consistent across documents" },
  { key: "gaps_explained", label: "Any apparent gaps explained in writing for counsel review" },
];
