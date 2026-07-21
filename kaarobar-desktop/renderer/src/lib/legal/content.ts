export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export const LEGAL_EFFECTIVE_DATE = "July 20, 2026";
export const LEGAL_CONTACT_EMAIL = "support@kaarobar.com";

export const privacySections: LegalSection[] = [
  {
    id: "overview",
    title: "1. Overview",
    paragraphs: [
      "Kaarobar helps owners run POS, accounting, and HR across more than one business and branch. This policy explains what information we handle when you use the product, why we need it, and how we look after it.",
      "We try to collect only what the product actually needs. If Pakistan’s data rules get clearer over time—or if we expand to other countries—we’ll keep updating how we work so we stay on the right side of those expectations.",
    ],
  },
  {
    id: "controller",
    title: "2. Who we are",
    paragraphs: [
      "When we talk about “Kaarobar,” “we,” or “us,” we mean the team providing the web app, desktop POS, and mobile apps.",
      "Your subscription account is with us. The day-to-day business data you put in—sales, stock, staff records, ledgers—belongs to you. We process that data so the product can do its job for your team.",
    ],
  },
  {
    id: "collect",
    title: "3. What we collect",
    paragraphs: [
      "Depending on how you use Kaarobar, we may hold:",
    ],
    bullets: [
      "Account details such as name, email, phone number, and a hashed password. If you turn on two-factor authentication, we also store what’s needed to verify those codes.",
      "Business and branch details: names, industry, tax setup, locations, and whether a business uses FBR Tier-1 reporting.",
      "Operational data from the till and stock room: products, prices, inventory, sales, returns, tills, purchase orders, and goods receipts.",
      "Accounting records: chart of accounts, journals, tax settings, and payables/receivables.",
      "Staff records: employee details, attendance, leave, pay structure, payroll runs, and payslips. Things like CNIC or bank account numbers are treated as sensitive and locked down more tightly.",
      "An audit trail of important changes—who did what, and when—so you can reconstruct what happened later.",
      "Billing and support information tied to your Kaarobar plan.",
      "Basic technical signals (for example IP address, device or app type, and timing) that help us keep the service secure and reliable.",
    ],
  },
  {
    id: "not-collect",
    title: "4. What we don’t collect",
    paragraphs: [
      "We never store full card numbers from your customers. Card payments at the till go through a payment provider that tokenizes them. Your Kaarobar subscription is billed through LemonSqueezy—we don’t keep your full card details for that either.",
    ],
  },
  {
    id: "use",
    title: "5. How we use information",
    paragraphs: ["We use this information to:"],
    bullets: [
      "Sign people in, apply the right roles, and keep each owner’s data separate from everyone else’s.",
      "Run POS, inventory, accounting, HR, payroll, reports, and offline sync.",
      "Post sales, stock, and approved payroll into the ledger so your books stay consistent.",
      "Send FBR reports when you’ve marked a business as Tier-1—without freezing the cashier at checkout.",
      "Enforce plan limits and handle subscription billing.",
      "Send service emails (and later, if we add them, SMS or WhatsApp notices).",
      "Spot abuse, protect accounts, and keep the platform stable.",
    ],
  },
  {
    id: "sharing",
    title: "6. Who we share with",
    paragraphs: [
      "We don’t sell your personal data. We only share what’s needed with trusted partners and, when required, authorities:",
    ],
    bullets: [
      "Hosting, database, file storage, and email providers that help us run the product.",
      "LemonSqueezy for subscriptions, plan changes, and failed payments.",
      "Payment gateways for customer payments at your tills.",
      "FBR, when you’ve enabled Tier-1 reporting for a business.",
      "Our support team, who may see account metadata to help you—without casually browsing your financial books.",
      "Anyone we must disclose to under a lawful request.",
    ],
  },
  {
    id: "tenancy",
    title: "7. Access inside your account",
    paragraphs: [
      "Kaarobar is built so staff only see the businesses and branches they’re assigned to. Owners can see every business they own. Permissions are checked on the server, not only hidden in the interface.",
    ],
  },
  {
    id: "security",
    title: "8. How we protect data",
    paragraphs: [
      "We take practical steps to keep information safe, including:",
    ],
    bullets: [
      "Encrypted connections (TLS) and encryption at rest on our database and file storage.",
      "Passwords stored with a modern hashing algorithm—never in plain text, and never written into logs.",
      "Extra protection for sensitive fields such as CNIC and bank account numbers.",
      "Short-lived login tokens that can be revoked if a session should end.",
      "Rate limits and lockouts when someone tries too many failed logins.",
      "Audit logs that can’t be quietly edited or deleted through the product.",
    ],
  },
  {
    id: "offline",
    title: "9. Data on the desktop POS",
    paragraphs: [
      "The desktop till can keep a local copy of the branch catalog, stock snapshot, open shift, and unsynced sales so work can continue when the internet drops. That copy lives on the machine. When connectivity comes back, those sales sync up without creating duplicates. Please treat POS devices carefully and use auto-logout where you’ve turned it on.",
    ],
  },
  {
    id: "retention",
    title: "10. How long we keep data",
    paragraphs: [
      "You can deactivate a business or branch without wiping history—your past sales and books often need to stay available for audits. Posted journals aren’t rewritten in place; corrections go through proper reversing entries.",
      "We keep account, billing, and audit information for as long as we need it to run the service, meet legal duties, and settle disputes. When we no longer need something, we delete or anonymize it where that’s practical—without breaking financial history you’re required to keep.",
    ],
  },
  {
    id: "rights",
    title: "11. Your choices",
    paragraphs: [
      "You can ask us to correct account details, explain what we hold, or help close an account. Because Kaarobar stores books and payroll history, some requests may mean deactivating or anonymizing rather than deleting every posted record. That’s deliberate—so your audit trail stays usable.",
    ],
  },
  {
    id: "children",
    title: "12. Children",
    paragraphs: [
      "Kaarobar is built for adult business users. It isn’t meant for anyone under 18.",
    ],
  },
  {
    id: "international",
    title: "13. Where data is processed",
    paragraphs: [
      "We’re building for Pakistan first. If you sign in from elsewhere, your data may be processed in the countries where our servers and partners operate.",
    ],
  },
  {
    id: "changes",
    title: "14. Changes to this policy",
    paragraphs: [
      "We’ll update this page when our practices change. The date at the top tells you when it last changed. If something material shifts, we’ll try to email Owners or show a notice in the product.",
    ],
  },
  {
    id: "contact",
    title: "15. Contact",
    paragraphs: [
      `Questions about privacy? Email ${LEGAL_CONTACT_EMAIL} or use the Contact page.`,
    ],
  },
];

export const termsSections: LegalSection[] = [
  {
    id: "acceptance",
    title: "1. Agreeing to these terms",
    paragraphs: [
      "These Terms & Conditions cover your use of Kaarobar on the web, desktop POS, and mobile apps. By creating an account or using the product, you agree to them. If you don’t, please don’t use Kaarobar.",
    ],
  },
  {
    id: "service",
    title: "2. What Kaarobar is",
    paragraphs: [
      "Kaarobar is software for multi-business, multi-branch POS, accounting, inventory, HR and payroll, reporting, and related integrations (including offline till sync and optional FBR reporting). We’ll keep improving the product. Some features may arrive after the core ones, and we may change or retire less-critical pieces with reasonable notice when we can.",
    ],
  },
  {
    id: "accounts",
    title: "3. Accounts and access",
    paragraphs: [
      "Keep your login details accurate and private. Sign-in uses email and password, with optional two-factor authentication—we strongly recommend MFA for Owners and Accountants.",
      "Owners can create businesses and branches and invite staff with the right roles. You’re responsible for what happens under your account and for giving people only the access they need.",
    ],
  },
  {
    id: "customer-data",
    title: "4. Your business data",
    paragraphs: [
      "You own the business data you put into Kaarobar. You give us permission to host and process it so we can run the product—post journals, generate payslips, sync offline sales, send FBR reports you’ve enabled, and so on.",
      "You’re also confirming you have the right to upload employee, customer, and supplier information, including any sensitive IDs you choose to store.",
    ],
  },
  {
    id: "acceptable-use",
    title: "5. Fair use",
    paragraphs: [
      "Please don’t:",
    ],
    bullets: [
      "Try to access another owner’s data or bypass permissions.",
      "Attack, overload, or probe the service.",
      "Use Kaarobar for illegal sales, fraud, or fake fiscal records.",
      "Copy or reverse-engineer the product beyond what the law already allows.",
      "Resell or rebrand Kaarobar without a written deal with us.",
    ],
  },
  {
    id: "financial",
    title: "6. Books and audit trail",
    paragraphs: [
      "Once a journal is posted, it stays put. Fixes happen with reversing or adjusting entries—not silent edits. Important actions are written to an audit log that can’t be quietly changed from inside the product.",
      "That design helps your books stand up to scrutiny, but you’re still responsible for your own filings, tax choices, payroll settings, and approvals. Kaarobar isn’t a substitute for a Chartered Accountant.",
    ],
  },
  {
    id: "offline",
    title: "7. Offline tills",
    paragraphs: [
      "The desktop POS can keep selling when the line drops, within what it has cached, then sync when you’re back online. You’re responsible for securing those machines, closing tills properly after reconnect, and finishing sync before wiping a device. Long outages can delay cloud and FBR reporting until the queue catches up.",
    ],
  },
  {
    id: "fbr",
    title: "8. FBR Tier-1",
    paragraphs: [
      "If you mark a business as Tier-1, we’ll try to report completed sales to FBR in the background, put fiscal details on receipts when we get them back, and retry failures—without stopping the customer at the counter. You’re responsible for knowing whether Tier-1 rules apply to you and for reconciling with FBR. We don’t give tax or legal advice.",
    ],
  },
  {
    id: "payments",
    title: "9. Customer payments",
    paragraphs: [
      "When your customers pay by card or wallet, that money moves through a payment provider. We don’t keep raw card numbers. Settlement, chargebacks, and merchant terms are between you and that provider.",
    ],
  },
  {
    id: "billing",
    title: "10. Your Kaarobar subscription",
    paragraphs: [
      "Using Kaarobar means staying on a paid (or trial) plan. We’ll enforce limits on businesses, branches, or users according to your plan. Platform billing runs through LemonSqueezy. That’s separate from what your customers pay you at the till.",
      "Fees aren’t refundable except where the law says so or we’ve agreed otherwise in writing. If payment fails and isn’t fixed, we may pause parts of the account—or the whole account—after we’ve tried to warn you.",
    ],
  },
  {
    id: "deactivation",
    title: "11. Pausing and ending access",
    paragraphs: [
      "You can deactivate a business or branch and still keep history. We may suspend or close an account if there’s a serious breach, fraud, non-payment, or legal risk. After that, any export window we offer and how long records stick around follow our Privacy Policy and the law.",
    ],
  },
  {
    id: "ip",
    title: "12. Our intellectual property",
    paragraphs: [
      "The Kaarobar software, name, docs, and default Pakistan templates are ours (or our licensors’). These terms don’t hand that ownership to you. If you send us ideas or feedback, we may use them to improve the product without owing you anything.",
    ],
  },
  {
    id: "disclaimer",
    title: "13. No extra promises",
    paragraphs: [
      "We provide Kaarobar as-is and as-available. To the fullest extent the law allows, we don’t make warranties about merchantability, fitness for a particular purpose, or uninterrupted third-party services (payment rails, FBR, internet). Automated books don’t replace professional advice.",
    ],
  },
  {
    id: "liability",
    title: "14. Limits on liability",
    paragraphs: [
      "To the fullest extent allowed by law, Kaarobar isn’t liable for indirect or consequential losses, lost profits, or tax penalties that come from how you configure or use the product—including FBR and payment integrations. If we’re liable at all, the total won’t exceed what you paid us for Kaarobar in the three months before the claim.",
    ],
  },
  {
    id: "indemnity",
    title: "15. If someone comes after us because of your use",
    paragraphs: [
      "You’ll cover Kaarobar for claims that arise from your business operations, the data you upload, your tax or FBR duties, misuse of the product, or breaking these terms.",
    ],
  },
  {
    id: "law",
    title: "16. Governing law",
    paragraphs: [
      "These terms follow the laws of Pakistan, unless a mandatory local rule says otherwise. Disputes go to the courts of Pakistan, subject to any rights you can’t waive.",
    ],
  },
  {
    id: "changes",
    title: "17. Updates",
    paragraphs: [
      "We may update these terms as the product grows. Keeping using Kaarobar after a change means you accept the new version. If a change really affects paid plans, we’ll try to email the Owner on file.",
    ],
  },
  {
    id: "contact",
    title: "18. Contact",
    paragraphs: [
      `Questions about these terms? Email ${LEGAL_CONTACT_EMAIL} or use the Contact page.`,
    ],
  },
];

export const cookieSections: LegalSection[] = [
  {
    id: "overview",
    title: "1. Overview",
    paragraphs: [
      "This page explains how Kaarobar uses cookies and similar storage on the website, the signed-in web app, and related clients. It goes with our Privacy Policy.",
    ],
  },
  {
    id: "what",
    title: "2. Cookies and similar tech",
    paragraphs: [
      "Cookies are small files a browser stores. We also use things like local storage, and on the desktop POS a local database that keeps a branch working when the internet is out. Mobile apps may keep session tokens in secure device storage.",
    ],
  },
  {
    id: "essential",
    title: "3. Essential cookies and storage",
    paragraphs: [
      "These are needed for the product to work safely. Turning them off in the browser usually breaks sign-in or the till:",
    ],
    bullets: [
      "Login and session handling, including the ability to end a session from our side.",
      "Basic security checks that reduce abuse and repeated failed logins.",
      "Infrastructure cookies that keep traffic routed correctly, when our hosts use them.",
      "On desktop POS: the local catalog, stock snapshot, and unsynced sales queue so checkout can continue offline.",
    ],
  },
  {
    id: "preferences",
    title: "4. Preference cookies",
    paragraphs: [
      "We may remember small preferences—like a dismissed notice or the last business you had open—so you don’t have to set them every visit. These aren’t used for ads.",
    ],
  },
  {
    id: "analytics",
    title: "5. Analytics",
    paragraphs: [
      "We may use lightweight analytics to see what pages people use and whether something is going wrong (for example sync errors). You don’t need analytics cookies to take a sale. Where the law asks for consent before non-essential analytics, we’ll ask.",
    ],
  },
  {
    id: "not-used",
    title: "6. What we don’t do with cookies",
    paragraphs: [
      "We don’t put card numbers in cookies. We don’t sell cookie data to advertisers.",
    ],
  },
  {
    id: "third-parties",
    title: "7. Other companies’ cookies",
    paragraphs: [
      "When you pay for a Kaarobar plan through LemonSqueezy, or take a customer payment through a gateway, those providers may set their own cookies under their own policies. FBR reporting happens over APIs—it isn’t driven by advertising cookies.",
    ],
  },
  {
    id: "manage",
    title: "8. Managing cookies",
    paragraphs: [
      "You can clear or block cookies in your browser. Blocking essential ones will sign you out or stop parts of the web app from working. On the desktop POS, only clear local data after you’re sure everything has synced—otherwise you could lose a queued sale.",
    ],
  },
  {
    id: "retention",
    title: "9. How long they last",
    paragraphs: [
      "Session cookies usually go away when you close the browser or after inactivity / auto-logout on a till. Preference cookies stick around until they expire or you clear them. Access tokens don’t live long; refresh tokens rotate and can be revoked.",
    ],
  },
  {
    id: "changes",
    title: "10. Changes",
    paragraphs: [
      "We’ll update this page when our use of cookies or local storage changes. Check the date at the top for the latest version.",
    ],
  },
  {
    id: "contact",
    title: "11. Contact",
    paragraphs: [
      `Questions? Email ${LEGAL_CONTACT_EMAIL}. You can also read the Privacy Policy or use the Contact page.`,
    ],
  },
];
