# Ledgr AI assistant — implementation prompt for the developer AI

> Paste this whole file to your coding assistant (Cursor/Claude/Copilot). It is
> self-contained and tells the AI to read the repo, use the real schema, and
> reuse the SQL views in `supabase/migrations/0004_ai_data_views.sql`.

---

You are implementing an in-app AI assistant for my fintech/accounting app **Ledgr**. You have full access to this repository. Inspect it FIRST — the database schema, auth, data layer, UI stack and existing report/dashboard logic. Reuse existing code, conventions and calculations rather than inventing new ones.

## What to inspect before writing any code
1. **Schema:** `supabase/migrations/*.sql`, Prisma/Drizzle/Knex/TypeORM entities, or any `CREATE TABLE`. Identify real tables/columns for: companies/tenants and users; invoices (status, issue/due dates, amounts, payments); bills/expenses; bank/ledger transactions; customers & vendors; accounts (income/expense/bank); payroll; settings/currency.
2. **Tenant scoping:** how the active company is determined (Supabase `auth.uid()` + a `company_users`/membership table? a session?). Every AI query MUST filter to the authenticated user's company — never trust a `company_id` from the client.
3. **Existing money logic:** reuse the exact queries/functions the dashboards use for revenue, profit, cash, receivables and tax so the AI's numbers reconcile.
4. **Stack:** React + TypeScript + Vite + Tailwind + Supabase (adjust if the repo shows otherwise).

A reference data-source layer already exists at **`supabase/migrations/0004_ai_data_views.sql`**. Read it. It defines:
- `v_ai_kpis` — month-to-date revenue, expenses, net profit, margin, cash, outstanding/overdue totals, average days to pay, expense ratio.
- `v_ai_monthly_trend` — last 12 months revenue/expenses/profit/cash-in/out/cumulative cash.
- `v_ai_overdue_invoices` — customer, amount outstanding, due date, days overdue.
- `v_ai_top_expenses` — expense categories by period.
- `v_ai_top_customers` + `v_ai_customer_concentration` — revenue and single-customer risk.
- `v_ai_anomalies` — large transactions (> customer 90-day avg + 2σ), duplicates within ±1 day, large round amounts, negative bank balances, each with severity and a human-readable description.
- `ai_context(uuid)` — one JSONB document returning all of the above for a company.

**Use these views directly** if the real schema matches; if table/column names differ, create a thin mapping migration or adapt the views to the real names, but KEEP THE VIEW NAMES AND SHAPES so the assistant code stays stable.

## Two assistants, one UI and one backend
A) **Support Assistant** — how-to / troubleshooting / compliance from a knowledge base (free, no LLM).
B) **Ledgr AI** — analyses LIVE company data, forecasts cash/revenue/expenses, and gives performance-based advice. Free with deterministic analysis; an LLM is optional for open-ended natural language.

### Non-negotiables
- Works with **zero API keys** by default (rule + data engine).
- Any LLM is called ONLY from a server/Edge Function. The API key never reaches the browser.
- The LLM **never invents numbers** — it only reasons over the `DataContext` payload. Every figure it states must be traceable to that payload.
- All data queries are company-scoped to the authenticated user.
- Currency is **MWK**, formatted `MK 1,234,567` (no decimals). Markdown output. Concise (<~200 words unless asked to expand).

## Files to create

### 1. `src/lib/ai/types.ts`
`ChatRole`, `ChatMessage {role, content}`, `KnowledgeArticle {id, topic, keywords[], body}`,
`Forecast { cashFlow: {month, projected_in, projected_out, projected_balance}[], revenue: {month, projected}[], expenses: {month, projected}[], assumptions: string[], confidence: 'high'|'medium'|'low' }`,
`Advice { rating: 'healthy'|'watch'|'danger', headline: string, insights: string[], actions: string[] }`,
`DataContext { companyName?, data?, knowledgeBase?, forecast? }`,
`AIAnswer { content, provider, suggestions?, charts? }`,
`AIProvider { name, answer(messages, context): Promise<AIAnswer> }`.

### 2. `src/lib/ai/knowledge.ts`
Export `KNOWLEDGE_BASE: KnowledgeArticle[]` tailored to Ledgr's ACTUAL menu items (read the routes). Include: creating/sending invoices, recording expenses, bank/MoMo reconciliation, P&L / balance sheet / cash-flow reports, payroll, team & roles, tax/VAT/TPIN compliance, data export/privacy/security, connecting accounts. Bodies reference real menu paths and field names.

### 3. `src/lib/ai/context.ts`
`buildAssistantContext(userId, companyId, mode): Promise<DataContext>`.
- For `mode==='support'`: `{ companyName, knowledgeBase }`.
- For `mode==='ai'`: call `select ai_context($companyId)` (or the views individually), then run `forecast(...)` and attach it. Map the JSON to `DataContext.data`. All queries parameterised and company-scoped.

### 4. `src/lib/ai/forecast.ts`
`forecast(data, monthsAhead=3): Forecast`.
- **Transparent, explainable methods only** (no black boxes — we must be able to show assumptions).
- Starting cash = `kpis.cash_balance`.
- **Cash in** = weighted 3-month average of customer receipts from `monthlyTrend.cash_in` (weight 0.5/0.3/0.2 recent→older) + collectible receivables from `overdueInvoices` and upcoming invoices using documented collection curves: overdue 60% within 30d/30% within 60d; due in 0–30d 85%; 30–60d 50%.
- **Cash out** = weighted 3-month average running costs + upcoming bills/payroll (query them server-side; see the receivables/payables templates in 0004).
- Projected balance rolls forward month-to-month; **flag any month it goes negative**.
- Revenue/expenses projection = 3-month moving average (use simple linear regression instead when ≥6 months exist and R²>0.6).
- `confidence`: high ≥9 months of clean data, medium 4–8, low otherwise.
- `assumptions[]` lists EVERY assumption in plain English (collection %, no new loans, no big one-offs, etc.).
- Guard against empty history, divide-by-zero, NaN; a new company gets `confidence:'low'` and an assumption saying "limited history — projection is indicative only".

### 5. `src/lib/ai/advisor.ts`
`advise(ctx): Advice`. Derive rating and actions from the REAL numbers. Signals & thresholds (tune to Malawi/SME context):
- Profit margin: healthy >20%, watch 5–20%, danger <5%.
- Cash runway = `cash_balance / avg monthly cash_out` (months): danger <1, watch <3.
- Overdue ratio (`overdue_total / receivables_total`): danger >30%, watch >15%.
- Expense ratio: danger >95%, watch >85%.
- Customer concentration: danger >40% from one customer.
- MoM revenue/expense direction (from `monthlyTrend`).
- Upcoming VAT/payroll deadlines if the schema exposes them.
Return 2–5 **specific** actions, each citing a real figure and a named entity (e.g. "Chase Blantyre Traders Ltd — MK 4,250,000 is 43 days overdue", "Software spend up 38% MoM to MK 240,000"). No generic advice without a number.

### 6. `src/lib/ai/provider.ts`
- `getProvider()`: if `VITE_AI_CHAT_URL` is set use `remoteProvider` (POST `{messages, context}` to the Edge Function); else `rulesProvider()`.
- `rulesProvider()` intents (regex, in this order): greeting → KB match (score +5 for topic match, +2/keyword; >0 wins) → data intents:
  - performance/overview/summary → KPIs + advisor rating/headline/top actions.
  - overdue/past-due → `overdueInvoices` with days overdue + total.
  - top/biggest expenses → `topExpenses`.
  - top customers/revenue → `topCustomers` + concentration warning.
  - anomalies/unusual/fraud → `anomalies` grouped by severity.
  - **forecast/cash flow/project/will I have enough cash** → render `forecast.cashFlow` as a small month-by-month list/table with projected ending balance; explicitly call out any month below 0; show confidence and key assumptions.
  - **revenue/expenses forecast** → the relevant projection + assumptions.
  - **advice/how am I doing/what should I improve/recommendations** → `advise()` output (rating, insights, numbered actions).
  - error/broken/can't → troubleshooting reply + "Settings → Report a problem".
  - fallback with chips.
- Suggestions chips for each intent. Format money with the `MK` formatter.
- `buildSystemPrompt(ctx)`: Ledgr assistant; use ONLY provided numbers; show forecast assumptions/confidence; give specific advice with figures; flag anomalies/compliance; cap 200 words; include `data` JSON (<16k chars) and KB (<20k).
- Optional reference adapters for gemini/groq/openrouter/anthropic (the proxy is the production path).

### 7. `supabase/functions/ai-chat/index.ts`
- POST `{messages, context}`. Verify the JWT; **derive the company from the user's membership server-side** (do not trust client context for data). Rebuild the DataContext via the same logic as context.ts so the LLM always sees fresh, authorised data.
- Secrets: `AI_PROVIDER` (default `groq`), `AI_API_KEY`, optional `AI_MODEL`. Providers: groq (`llama-3.1-8b-instant`), gemini (`gemini-1.5-flash`), openrouter (`meta-llama/llama-3.1-8b-instruct:free`), anthropic (`claude-3-5-haiku-latest`). Return `{content, provider}`. CORS + error handling.

### 8. `<AssistantDrawer mode companyName />` (React/Tailwind)
- Dark fintech theme; user bubbles indigo→violet, assistant bubbles dark surface + 1px border; rounded; auto-scroll; markdown (bold, bullets, simple tables for forecasts).
- Header: green "Connected" chip + "Live data from {company} · Powered by {provider}".
- On first open in AI mode: welcome; **Business health card** with the advisor rating (green/amber/red), headline and top 2 actions; **Anomalies card** (amber) listing count + items if any.
- Suggestion chips send on click. AI defaults: "How is my business performing?", "Which invoices are overdue?", "Forecast my cash flow for 3 months", "What should I improve?". Support defaults: top KB topics.
- Input: Enter sends, Shift+Enter newline, disabled while waiting, helper "Press Enter to send · Shift+Enter for a new line", thinking indicator.

## Acceptance criteria
1. No env vars set → both assistants fully work offline. "Forecast my cash flow for 3 months" returns a projection from real monthly data with balances, assumptions, confidence, and negative-month warnings. "What should I improve?" returns advice with real figures/entities.
2. Every number matches an existing dashboard/report (reuse app queries or the v_ai_* views).
3. Company-scoped: a user cannot query another company's data (verify with RLS + server-side company derivation).
4. New/sparse company: no crash, no NaN — low-confidence forecast with an explicit assumption.
5. With `VITE_AI_CHAT_URL` + a Groq key, open questions ("why might my margin drop?") get grounded LLM answers that cite figures from context.
6. API key is absent from the client bundle/network tab.
7. TypeScript strict, no `any` without justification, mobile-responsive.
8. README section: how to deploy the function (`supabase functions deploy ai-chat`), set secrets (`supabase secrets set AI_PROVIDER=groq AI_API_KEY=...`), and how forecasts are calculated (the exact formulas/collection curves).

## Deliver
Every file IN FULL, using the REAL schema you found in the repo, then a short summary of: (a) which tables/columns the views map to, (b) any data point you couldn't source and why, (c) the exact SQL differences vs `0004_ai_data_views.sql` if you adapted names.
