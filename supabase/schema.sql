create table if not exists public.app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null check (
    jsonb_typeof(state) = 'object'
    and jsonb_typeof(state -> 'orders') = 'array'
  ),
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

revoke all on public.app_state from anon;
grant select, insert, update, delete on public.app_state to authenticated;

drop policy if exists "Users can read own app state" on public.app_state;
create policy "Users can read own app state"
  on public.app_state for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own app state" on public.app_state;
create policy "Users can insert own app state"
  on public.app_state for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own app state" on public.app_state;
create policy "Users can update own app state"
  on public.app_state for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own app state" on public.app_state;
create policy "Users can delete own app state"
  on public.app_state for delete to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.orders (
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  customer text generated always as (data ->> 'customer') stored,
  factory text generated always as (data ->> 'factory') stored,
  stage text generated always as (data ->> 'stage') stored,
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, order_id)
);

create index if not exists orders_user_created_at_idx
  on public.orders (user_id, created_at desc);

alter table public.orders enable row level security;

revoke all on public.orders from anon;
grant select, insert, update, delete on public.orders to authenticated;

drop policy if exists "Users can read own orders" on public.orders;
create policy "Users can read own orders"
  on public.orders for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own orders" on public.orders;
create policy "Users can insert own orders"
  on public.orders for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own orders" on public.orders;
create policy "Users can update own orders"
  on public.orders for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own orders" on public.orders;
create policy "Users can delete own orders"
  on public.orders for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.sync_my_orders(p_orders jsonb, p_seq integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  valid_order_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(p_orders) is distinct from 'array' then
    raise exception 'Orders must be a JSON array';
  end if;

  select count(*) into valid_order_count
  from pg_catalog.jsonb_array_elements(p_orders) as orders(item)
  where pg_catalog.jsonb_typeof(item) = 'object'
    and pg_catalog.jsonb_typeof(item -> 'id') = 'string'
    and pg_catalog.jsonb_typeof(item -> 'createdAt') = 'string';

  if valid_order_count <> pg_catalog.jsonb_array_length(p_orders) then
    raise exception 'Every order must include a string id and createdAt';
  end if;

  delete from public.orders existing
  where existing.user_id = current_user_id
    and not exists (
      select 1
      from pg_catalog.jsonb_array_elements(p_orders) as orders(item)
      where item ->> 'id' = existing.order_id
    );

  insert into public.orders (user_id, order_id, data, created_at, updated_at)
  select current_user_id, item ->> 'id', item, (item ->> 'createdAt')::timestamptz, pg_catalog.now()
  from pg_catalog.jsonb_array_elements(p_orders) as orders(item)
  on conflict (user_id, order_id) do update
    set data = excluded.data,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at;

  insert into public.app_state (user_id, state, updated_at)
  values (
    current_user_id,
    pg_catalog.jsonb_build_object('seq', greatest(p_seq, 268), 'orders', '[]'::jsonb),
    pg_catalog.now()
  )
  on conflict (user_id) do update
    set state = excluded.state,
        updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.sync_my_orders(jsonb, integer) from public, anon;
grant execute on function public.sync_my_orders(jsonb, integer) to authenticated;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id text not null,
  invoice_number text not null,
  issued_at date not null default current_date,
  due_date date,
  customer_name text not null,
  factory_name text not null default '',
  description text not null,
  order_snapshot jsonb not null check (jsonb_typeof(order_snapshot) = 'object'),
  amount_total numeric(14, 2) not null check (amount_total > 0),
  amount_paid numeric(14, 2) not null default 0 check (amount_paid >= 0 and amount_paid <= amount_total),
  status text not null default 'Belum Lunas'
    check (status in ('Belum Lunas', 'Lunas', 'Batal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, order_id),
  unique (user_id, invoice_number),
  foreign key (user_id, order_id)
    references public.orders (user_id, order_id) on delete cascade
);

create index if not exists invoices_user_created_at_idx
  on public.invoices (user_id, created_at desc);

alter table public.invoices enable row level security;

revoke all on public.invoices from anon;
grant select, insert on public.invoices to authenticated;

drop policy if exists "Users can read own invoices" on public.invoices;
create policy "Users can read own invoices"
  on public.invoices for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own invoices" on public.invoices;
create policy "Users can insert own invoices"
  on public.invoices for insert to authenticated
  with check ((select auth.uid()) = user_id);

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  method text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists invoice_payments_user_created_at_idx
  on public.invoice_payments (user_id, created_at desc);

alter table public.invoice_payments enable row level security;

revoke all on public.invoice_payments from anon;
grant select on public.invoice_payments to authenticated;

drop policy if exists "Users can read own invoice payments" on public.invoice_payments;
create policy "Users can read own invoice payments"
  on public.invoice_payments for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  invoice_row public.invoices%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be positive';
  end if;
  if p_method is null or pg_catalog.btrim(p_method) = '' then
    raise exception 'Payment method is required';
  end if;

  select * into invoice_row
  from public.invoices
  where id = p_invoice_id and user_id = current_user_id
  for update;

  if not found then
    raise exception 'Invoice not found';
  end if;
  if invoice_row.status = 'Batal' then
    raise exception 'Cannot pay a cancelled invoice';
  end if;
  if p_amount > invoice_row.amount_total - invoice_row.amount_paid then
    raise exception 'Payment exceeds invoice balance';
  end if;

  insert into public.invoice_payments (user_id, invoice_id, amount, method, notes)
  values (current_user_id, p_invoice_id, p_amount, pg_catalog.btrim(p_method), nullif(pg_catalog.btrim(p_notes), ''));

  update public.invoices
  set amount_paid = amount_paid + p_amount,
      status = case
        when amount_paid + p_amount >= amount_total then 'Lunas'
        else 'Belum Lunas'
      end,
      updated_at = pg_catalog.now()
  where id = p_invoice_id and user_id = current_user_id;
end;
$$;

revoke all on function public.record_invoice_payment(uuid, numeric, text, text) from public, anon;
grant execute on function public.record_invoice_payment(uuid, numeric, text, text) to authenticated;
