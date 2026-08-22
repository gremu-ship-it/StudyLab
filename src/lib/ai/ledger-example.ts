import type { DataContext, KnowledgeArticle } from "./provider";

/**
 * Example knowledge base for the Support Assistant.
 * In a real fintech app these rows would come from a `help_articles` table.
 */
export const LEDGR_KB: KnowledgeArticle[] = [
  {
    id: "create-invoice",
    topic: "Create and send an invoice",
    keywords: ["invoice", "send", "create", "bill", "customer", "payment link"],
    body:
      "To create and send an invoice:\n1. Go to **Sales → Invoices → New invoice**.\n2. Choose a customer (or add a new one).\n3. Add line items with description, quantity and price. VAT is calculated automatically.\n4. Set the due date and any early-payment discount.\n5. Click **Send** — your customer receives a PDF by email with a one-click Pay button.\n\nInvoices stay in **Draft** until sent. You can set up recurring invoices from the **Recurring** tab.",
  },
  {
    id: "record-expense",
    topic: "Record an expense",
    keywords: ["expense", "spend", "receipt", "purchase", "cost"],
    body:
      "Record an expense under **Purchases → Expenses → Add expense**:\n1. Choose or add the vendor.\n2. Enter the amount, date and category (e.g. Software, Travel).\n3. Attach a receipt (PDF or photo) — OCR fills the amount and date automatically.\n4. If paid from a linked bank/MoMo account, match it on the **Transactions** page.\n\nExpenses reduce your taxable profit and appear on your Profit & Loss statement.",
  },
  {
    id: "financial-statements",
    topic: "Generate financial statements",
    keywords: ["statement", "report", "p&l", "profit", "loss", "balance sheet", "cash flow", "financials"],
    body:
      "Open **Reports → Financials**. Ledgr generates, in real time:\n- **Profit & Loss** (income minus expenses)\n- **Balance Sheet** (assets, liabilities, equity)\n- **Cash Flow Statement** (operating, investing, financing)\n\nChoose a date range and click **Export** for PDF/Excel. Statements always reconcile to your transactions.",
  },
  {
    id: "setup-business",
    topic: "Set up your business",
    keywords: ["setup", "business", "company", "profile", "tax", "fiscal year", "currency", "vat"],
    body:
      "Set up your business under **Settings → Business profile**:\n1. Enter legal name, address and tax ID (TPIN).\n2. Set your base currency (MWK) and VAT rate (standard 16.5%).\n3. Choose your fiscal year start.\n4. Connect your bank/MoMo account under **Banking → Connect**.\n\nYou can invite teammates and assign roles (Admin, Accountant, Viewer) from **Settings → Team**.",
  },
  {
    id: "compliance-privacy",
    topic: "Compliance & data privacy",
    keywords: ["compliance", "privacy", "data", "gdpr", "security", "encrypt", "retention", "export", "delete"],
    body:
      "Ledgr is built for compliance:\n- Data is encrypted in transit (TLS) and at rest (AES-256).\n- Access is role-based and every action is audit-logged.\n- You can export all your data anytime from **Settings → Data → Export**.\n- To delete your account and data, go to **Settings → Data → Delete account** — data is permanently removed within 30 days.\n\nWe never sell your data. Read the full Privacy Policy at the footer of any page.",
  },
  {
    id: "payroll",
    topic: "Run payroll",
    keywords: ["payroll", "salary", "payslip", "paye", "employee", "wages"],
    body:
      "Run payroll under **Payroll → Run payroll**:\n1. Add employees and their gross salary under **People**.\n2. Ledgr auto-calculates PAYE and other statutory deductions using Malawi tax bands.\n3. Review the payroll summary, then click **Approve & pay**.\n4. Payslips are emailed automatically and entries post to your accounts.",
  },
];

/**
 * Example live company data — in production this would be queried from your DB
 * for the authenticated user's active company. Numbers in MWK.
 */
export function getLedgrLiveData(companyId = "demo-company-ltd"): DataContext {
  // Pretend these come from SQL queries / an ORM.
  const overdueInvoices = [
    { id: "INV-1042", customer: "Blantyre Traders Ltd", amount: 4_250_000, due_date: "2026-07-10" },
    { id: "INV-1051", customer: "Lilongwe Logistics", amount: 1_800_000, due_date: "2026-07-28" },
    { id: "INV-1059", customer: "Mzuzu Retail", amount: 650_000, due_date: "2026-08-02" },
  ];
  const topExpenses = [
    { category: "Inventory / COGS", amount: 18_400_000 },
    { category: "Salaries & wages", amount: 6_200_000 },
    { category: "Rent", amount: 1_500_000 },
    { category: "Fuel & transport", amount: 980_000 },
    { category: "Software subscriptions", amount: 240_000 },
  ];
  const topCustomers = [
    { name: "Blantyre Traders Ltd", revenue: 12_900_000 },
    { name: "Lilongwe Logistics", revenue: 9_400_000 },
    { name: "Southern Region Schools", revenue: 5_100_000 },
    { name: "Mzuzu Retail", revenue: 2_300_000 },
  ];
  const anomalies = [
    { type: "large_tx", description: "Unusually large transaction", amount: 57_593_600, date: "2026-08-01" },
    { type: "large_tx", description: "Unusually large transaction", amount: 9_000_000, date: "2026-07-23" },
    { type: "duplicate", description: "Duplicate amount", amount: 90_000, date: "2026-07-29" },
  ];
  const revenue = 32_400_000;
  const expenses = 27_320_000;

  return {
    companyName: "Demo company Ltd",
    knowledgeBase: LEDGR_KB,
    data: {
      currency: "MWK",
      kpis: {
        revenue_month_to_date: revenue,
        expenses_month_to_date: expenses,
        net_profit: revenue - expenses,
        profit_margin_pct: Math.round(((revenue - expenses) / revenue) * 100),
        cash_balance: 8_740_000,
        overdue_invoices: overdueInvoices.length,
        overdue_total: overdueInvoices.reduce((s, x) => s + x.amount, 0),
      },
      overdueInvoices,
      overdueTotal: overdueInvoices.reduce((s, x) => s + x.amount, 0),
      topExpenses,
      topCustomers,
      anomalies,
    },
  };
}
