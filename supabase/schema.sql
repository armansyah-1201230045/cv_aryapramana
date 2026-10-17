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
