-- =============================================================================
-- Ledgr AI — ready-made data sources for KPIs, trends, forecasts, anomalies
-- =============================================================================
-- This is a REFERENCE SCHEMA + VIEWS for the assistant's data context.
--
-- TWO WAYS TO USE THIS:
--   (A) If Ledgr already has these tables/columns, map the views below to the
--       real names (replace table/column references) and keep the view names.
--   (B) If not, this serves as the canonical accounting model. Run it as-is.
--
-- The assistant (buildAssistantContext) should SELECT from the v_ai_* views
-- for a single company_id; never compute money in app code when a view exists,
-- so the numbers always reconcile with the rest of Ledgr.
--
-- All monetary amounts are stored in the company's base currency (MWK) as
-- numeric(18,2). Money OUT is negative on ledger entries; money IN positive.
-- Multi-currency is out of scope here (post amounts already converted).
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 0. Canonical schema (skip/adjust if tables already exist)
-- ----------------------------------------------------------------------------
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_currency text not null default 'MWK',
  vat_rate numeric(5,2) not null default 16.50,      -- Malawi VAT
  fiscal_year_start date not null default date_trunc('year', now())::date,
  created_at timestamptz not null default now()
);

create table if not exists company_users (
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member',               -- owner|admin|accountant|viewer
  primary key (company_id, user_id)
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  type text not null check (type in ('asset','liability','equity','income','expense')),
  is_bank boolean not null default false,
  is_receivable boolean not null default false,
  is_payable boolean not null default false,
  unique (company_id, code)
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  type text not null check (type in ('customer','vendor')),
  email text, phone text,
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  invoice_number text,
  status text not null default 'draft' check (status in ('draft','sent','partially_paid','paid','overdue','void')),
  issue_date date not null,
  due_date date not null,
  currency text not null default 'MWK',
  amount numeric(18,2) not null default 0,        -- gross total incl. VAT
  tax_amount numeric(18,2) not null default 0,
  amount_paid numeric(18,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','received','scheduled','paid','void')),
  issue_date date, due_date date,
  amount numeric(18,2) not null default 0,
  amount_paid numeric(18,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete restrict,
  contact_id uuid references contacts(id) on delete set null,
  txn_date date not null,
  amount numeric(18,2) not null,               -- signed: + in, - out
  description text,
  reference text,
  source text,                                   -- invoice|bill|payroll|manual|bank_import
  source_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_txn_company_date on transactions(company_id, txn_date);

create table if not exists payroll_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  run_date date not null,
  period_start date, period_end date,
  gross numeric(18,2) not null default 0,
  deductions numeric(18,2) not null default 0,  -- PAYE etc.
  net numeric(18,2) not null default 0,
  status text not null default 'draft'
);

create index if not exists idx_invoices_company_due on invoices(company_id, due_date);
create index if not exists idx_bills_company_due on bills(company_id, due_date);
create index if not exists idx_contacts_company on contacts(company_id);

-- =============================================================================
-- 1. KPI snapshot for the current month-to-date
--    SELECT * FROM v_ai_kpis WHERE company_id = $1;
-- =============================================================================
create or replace view v_ai_kpis as
with month_range as (
  select company_id,
         date_trunc('month', now())::date as month_start,
         now()::date as today
  from companies
),
income as (
  select t.company_id, coalesce(sum(t.amount),0) as revenue
  from transactions t
  join accounts a on a.id = t.account_id
  join month_range m on m.company_id = t.company_id
  where a.type = 'income'
    and t.txn_date between m.month_start and m.today
  group by t.company_id
),
expenses as (
  select t.company_id, coalesce(sum(t.amount),0) as expenses
  from transactions t
  join accounts a on a.id = t.account_id
  join month_range m on m.company_id = t.company_id
  where a.type = 'expense'
    and t.txn_date between m.month_start and m.today
  group by t.company_id
),
cash as (
  select t.company_id, coalesce(sum(t.amount),0) as cash_balance
  from transactions t
  join accounts a on a.id = t.account_id
  where a.is_bank
  group by t.company_id
),
receivables as (
  select company_id,
         count(*)::int as outstanding_invoices,
         count(*) filter (where due_date < now()::date and (amount - amount_paid) > 0.01)::int as overdue_invoices,
         coalesce(sum(amount - amount_paid) filter (where due_date < now()::date),0) as overdue_total,
         coalesce(sum(amount - amount_paid),0) as receivables_total
  from invoices
  where status in ('sent','partially_paid','overdue')
  group by company_id
),
avg_pay as (
  -- average days customers take to pay (from issue date to latest payment)
  select i.company_id,
         coalesce(avg((coalesce(paid.last_paid, current_date) - i.issue_date))::int, 0) as avg_days_to_pay
  from invoices i
  left join lateral (
    select max(t.txn_date) as last_paid
    from transactions t
    where t.source = 'invoice' and t.source_id = i.id and t.amount < 0
  ) paid on true
  where i.status = 'paid'
  group by i.company_id
)
select c.id as company_id,
       coalesce(i.revenue,0) as revenue_mtd,
       abs(coalesce(e.expenses,0)) as expenses_mtd,
       coalesce(i.revenue,0) - abs(coalesce(e.expenses,0)) as net_profit_mtd,
       case when i.revenue > 0
         then round(((coalesce(i.revenue,0) - abs(coalesce(e.expenses,0))) / i.revenue * 100)::numeric, 1)
         else 0 end as profit_margin_pct,
       coalesce(cash.cash_balance,0) as cash_balance,
       coalesce(rec.outstanding_invoices,0) as outstanding_invoices,
       coalesce(rec.overdue_invoices,0) as overdue_invoices,
       coalesce(rec.overdue_total,0) as overdue_total,
       case when rec.receivables_total > 0
         then round((rec.overdue_total / rec.receivables_total * 100)::numeric, 1) else 0 end as overdue_ratio_pct,
       coalesce(ap.avg_days_to_pay,0) as avg_days_to_pay,
       case when i.revenue > 0
         then round((abs(coalesce(e.expenses,0)) / i.revenue * 100)::numeric, 1) else 0 end as expense_ratio_pct
from companies c
left join income i on i.company_id = c.id
left join expenses e on e.company_id = c.id
left join cash on cash.company_id = c.id
left join receivables rec on rec.company_id = c.id
left join avg_pay ap on ap.company_id = c.id;

-- =============================================================================
-- 2. Monthly trend — last 12 months of revenue/expenses/profit/cash
--    SELECT * FROM v_ai_monthly_trend WHERE company_id = $1 ORDER BY month;
-- =============================================================================
create or replace view v_ai_monthly_trend as
with months as (
  select company_id,
         generate_series(
           date_trunc('month', now())::date - interval '11 months',
           date_trunc('month', now())::date,
           interval '1 month'
         )::date as month_start
  from companies
),
ranges as (
  select company_id, month_start,
         (month_start + interval '1 month - 1 day')::date as month_end
  from months
),
posted as (
  select r.company_id, r.month_start,
    coalesce(sum(t.amount) filter (where a.type='income'),0) as revenue,
    abs(coalesce(sum(t.amount) filter (where a.type='expense'),0)) as expenses,
    coalesce(sum(t.amount) filter (where a.is_bank and t.amount > 0),0) as cash_in,
    abs(coalesce(sum(t.amount) filter (where a.is_bank and t.amount < 0),0)) as cash_out
  from ranges r
  left join transactions t on t.company_id = r.company_id
                           and t.txn_date between r.month_start and r.month_end
  left join accounts a on a.id = t.account_id
  group by r.company_id, r.month_start
)
select p.company_id, p.month_start,
       p.revenue, p.expenses, p.revenue - p.expenses as net_profit,
       p.cash_in, p.cash_out,
       sum(p.cash_in - p.cash_out) over (partition by p.company_id order by p.month_start) as cumulative_cash
from posted p;

-- =============================================================================
-- 3. Overdue invoices (for "which invoices are overdue?")
--    SELECT * FROM v_ai_overdue_invoices WHERE company_id = $1 ORDER BY days_overdue DESC;
-- =============================================================================
create or replace view v_ai_overdue_invoices as
select i.id, i.company_id, c.name as customer, i.invoice_number,
       i.amount - i.amount_paid as amount_outstanding,
       i.due_date,
       (now()::date - i.due_date)::int as days_overdue
from invoices i
left join contacts c on c.id = i.contact_id
where i.status in ('sent','partially_paid','overdue')
  and i.amount - i.amount_paid > 0.01
  and i.due_date < now()::date;

-- =============================================================================
-- 4. Top expense categories this period
--    SELECT * FROM v_ai_top_expenses WHERE company_id=$1 AND ... ;
-- =============================================================================
create or replace view v_ai_top_expenses as
select t.company_id,
       coalesce(nullif(a.name,''), 'Uncategorised') as category,
       abs(sum(t.amount)) as amount,
       date_trunc('month', t.txn_date)::date as period
from transactions t
join accounts a on a.id = t.account_id
where a.type = 'expense'
group by t.company_id, a.name, date_trunc('month', t.txn_date);

-- =============================================================================
-- 5. Top customers by revenue (trailing 12 months)
--    SELECT * FROM v_ai_top_customers WHERE company_id=$1 ORDER BY revenue DESC LIMIT 6;
-- =============================================================================
create or replace view v_ai_top_customers as
select t.company_id, c.id as contact_id, c.name,
       coalesce(sum(t.amount),0) as revenue,
       count(distinct t.id) as invoice_count
from transactions t
join contacts c on c.id = t.contact_id and c.type = 'customer'
join accounts a on a.id = t.account_id
where a.type = 'income'
  and t.txn_date >= now()::date - interval '12 months'
group by t.company_id, c.id, c.name;

-- Customer concentration: % of revenue from the single largest customer.
-- (Used by the advisor to flag over-reliance.)
create or replace view v_ai_customer_concentration as
with totals as (
  select company_id, sum(revenue) as total_revenue
  from v_ai_top_customers group by company_id
)
select tc.company_id, tc.name as top_customer,
       tc.revenue as top_revenue,
       case when t.total_revenue > 0
         then round((tc.revenue / t.total_revenue * 100)::numeric,1) else 0 end as concentration_pct
from v_ai_top_customers tc
join totals t on t.company_id = tc.company_id
where tc.revenue = (select max(revenue) from v_ai_top_customers x where x.company_id = tc.company_id);

-- =============================================================================
-- 6. Anomaly detection — all rules in one view.
--    SELECT * FROM v_ai_anomalies WHERE company_id=$1 ORDER BY detected_at DESC;
--    severity: high|medium|low. Each row is machine-readable and UI-ready.
-- =============================================================================
create or replace view v_ai_anomalies as
with stats as (
  -- 90-day per-contact baseline and stddev-ish spread.
  select company_id, contact_id,
         avg(abs(amount)) as avg_amt,
         coalesce(stddev_pop(abs(amount)),0) as std_amt,
         count(*) as n
  from transactions
  where txn_date >= now()::date - interval '90 days'
    and contact_id is not null
  group by company_id, contact_id
),
recent as (
  select t.*, abs(t.amount) as abs_amount,
         s.avg_amt, s.std_amt, s.n
  from transactions t
  left join stats s on s.company_id = t.company_id and s.contact_id = t.contact_id
  where t.txn_date >= now()::date - interval '30 days'
),
large as (
  select id, company_id, 'large_transaction' as type, 'high' as severity,
         txn_date as detected_at, amount,
         format('Unusually large %s for %s: %s (90-day average %s)',
                case when amount < 0 then 'payment' else 'receipt' end,
                coalesce((select name from contacts c where c.id = contact_id),'a contact'),
                abs(amount)::money, coalesce(avg_amt,0)::money) as description
  from recent
  where n >= 3 and abs_amount > avg_amt + 2*greatest(std_amt, avg_amt*0.5)
),
dupes as (
  select distinct on (t1.company_id, t1.contact_id, abs(t1.amount), t1.txn_date)
         t1.id, t1.company_id, 'duplicate' as type, 'medium' as severity,
         t1.txn_date as detected_at, t1.amount,
         format('Possible duplicate: %s posted twice on %s',
                abs(t1.amount)::money, t1.txn_date) as description
  from transactions t1
  join transactions t2
    on t2.company_id = t1.company_id
   and t2.id <> t1.id
   and t2.contact_id is not distinct from t1.contact_id
   and abs(t2.amount) = abs(t1.amount)
   and t2.txn_date between t1.txn_date - 1 and t1.txn_date + 1
  where t1.txn_date >= now()::date - interval '30 days'
),
rounds as (
  select id, company_id, 'round_amount' as type, 'low' as severity,
         txn_date as detected_at, amount,
         format('Round amount over 1,000,000: %s', abs(amount)::money) as description
  from transactions
  where abs(amount) >= 1000000
    and abs(amount) = round(abs(amount))
    and txn_date >= now()::date - interval '30 days'
),
neg_bal as (
  select gen_random_uuid() as id, t.company_id, 'negative_balance' as type, 'high' as severity,
         now()::date as detected_at,
         sum(t.amount) as amount,
         format('Bank account %s has a negative balance', a.name) as description
  from transactions t join accounts a on a.id = t.account_id
  where a.is_bank
  group by t.company_id, a.id, a.name
  having sum(t.amount) < 0
)
select * from large
union all select * from dupes
union all select * from rounds
union all select * from neg_bal;

-- =============================================================================
-- 7. Forecast inputs — scheduled/recurring receivables & payables for the
--    cash-flow projection. The TypeScript forecast() combines this with
--    v_ai_monthly_trend. (No view needed; use these parameterised queries.)
--
--    -- Expected cash in from unpaid invoices (weighted by age):
--    select date_trunc('month', due_date)::date as month,
--           sum((amount - amount_paid) *
--             case
--               when due_date < current_date then 0.6   -- overdue: 60% within 30d
--               when due_date < current_date + 30 then 0.85
--               else 0.5
--             end) as expected_in
--    from invoices
--    where company_id=$1 and status in ('sent','partially_paid','overdue')
--    group by 1 order by 1;
--
--    -- Expected cash out from upcoming bills/payroll:
--    select date_trunc('month', coalesce(due_date, issue_date))::date as month,
--           sum(amount - amount_paid) as expected_out
--    from bills where company_id=$1 and status in ('received','scheduled')
--    group by 1
--    union all
--    select date_trunc('month', pay_date), sum(net) from payroll_runs ... group by 1;
-- =============================================================================

-- Helper for the assistant: a single JSONB document with everything above,
-- so the app can fetch context in one round-trip.
create or replace function ai_context(p_company_id uuid)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'currency',        (select base_currency from companies where id=p_company_id),
    'kpis',            (select to_jsonb(k) from v_ai_kpis k where company_id=p_company_id),
    'monthlyTrend',    (select coalesce(jsonb_agg(x order by month_start),'[]'::jsonb) from v_ai_monthly_trend x where company_id=p_company_id),
    'overdueInvoices', (select coalesce(jsonb_agg(x order by days_overdue desc),'[]'::jsonb) from v_ai_overdue_invoices x where company_id=p_company_id limit 10),
    'topExpenses',     (select coalesce(jsonb_agg(x order by amount desc),'[]'::jsonb) from v_ai_top_expenses x where company_id=p_company_id and period=date_trunc('month',now())::date limit 6),
    'topCustomers',    (select coalesce(jsonb_agg(x order by revenue desc),'[]'::jsonb) from v_ai_top_customers x where company_id=p_company_id limit 6),
    'concentration',   (select to_jsonb(x) from v_ai_customer_concentration x where company_id=p_company_id),
    'anomalies',       (select coalesce(jsonb_agg(x order by severity, detected_at desc),'[]'::jsonb) from v_ai_anomalies x where company_id=p_company_id)
  );
$$;

-- Usage in buildAssistantContext:
--   select ai_context($companyId);
-- Then compute forecast() and advise() in TypeScript from this JSON, OR add
-- them as SQL functions if you prefer them server-side.
