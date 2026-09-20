-- Czat lokal <-> spontaway (prosba Nat 2026-09-15).
--
-- Do dzis „Napisz do nas" wrzucalo wiersz do `bug_reports` i na tym sie konczylo: lokal nie
-- widzial, czy ktos to przeczytal, a odpowiedz szla mailem poza produktem. To ma byc rozmowa,
-- a nie skrzynka na listy - jeden watek NA LOKAL, widoczny po obu stronach.
--
-- Model: jedna tabela wiadomosci. Watek = `business_profile_id`, czyli lokal. Wlasciciel
-- kilku lokali ma tyle watkow, ile lokali - bo pytanie o menu w jednej kawiarni nie dotyczy
-- drugiej.

create table if not exists public.business_messages (
  id                  uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  -- Kto pisze: lokal czy my. Trzymamy to jawnie, a nie zgadujemy z roli autora - konto
  -- Nat jest jednoczesnie adminem i moze miec wlasny lokal.
  sender              text not null check (sender in ('business', 'admin')),
  author_user_id      uuid references auth.users(id) on delete set null,
  body                text not null check (length(btrim(body)) between 1 and 4000),
  created_at          timestamptz not null default now()
);

create index if not exists business_messages_thread_idx
  on public.business_messages (business_profile_id, created_at desc);

-- Stan przeczytania KAZDEJ strony osobno. Dwie kolumny zamiast flagi na wiadomosci:
-- licznik nieprzeczytanych to wtedy jedno porownanie dat, a nie przebieg po wierszach.
create table if not exists public.business_thread_reads (
  business_profile_id uuid primary key references public.business_profiles(id) on delete cascade,
  business_read_at    timestamptz,
  admin_read_at       timestamptz
);

alter table public.business_messages enable row level security;
alter table public.business_thread_reads enable row level security;

-- Wlasciciel widzi i pisze WYLACZNIE w watku swojego lokalu; admin widzi i pisze wszedzie.
drop policy if exists business_messages_select on public.business_messages;
create policy business_messages_select on public.business_messages
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or exists (select 1 from public.business_profiles bp
                where bp.id = business_profile_id and bp.owner_user_id = auth.uid())
  );

-- ⛔ Lokal nie moze podszyc sie pod nas: `sender` musi zgadzac sie z rola piszacego.
drop policy if exists business_messages_insert on public.business_messages;
create policy business_messages_insert on public.business_messages
  for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and (
      (sender = 'admin' and public.has_role(auth.uid(), 'admin'))
      or (sender = 'business' and exists (
            select 1 from public.business_profiles bp
             where bp.id = business_profile_id and bp.owner_user_id = auth.uid()))
    )
  );

drop policy if exists business_thread_reads_all on public.business_thread_reads;
create policy business_thread_reads_all on public.business_thread_reads
  for all to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or exists (select 1 from public.business_profiles bp
                where bp.id = business_profile_id and bp.owner_user_id = auth.uid())
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    or exists (select 1 from public.business_profiles bp
                where bp.id = business_profile_id and bp.owner_user_id = auth.uid())
  );

-- ── Oznaczenie watku jako przeczytanego ────────────────────────────────────
-- Strone wyliczamy z ROLI wolajacego, a nie z parametru: inaczej lokal moglby skasowac
-- nasz licznik nieprzeczytanych (albo odwrotnie).
create or replace function public.mark_business_thread_read(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_owner boolean;
begin
  if v_uid is null then raise exception 'Unauthorized'; end if;
  v_admin := public.has_role(v_uid, 'admin');
  select exists (select 1 from public.business_profiles bp
                  where bp.id = p_business_id and bp.owner_user_id = v_uid) into v_owner;
  if not (v_admin or v_owner) then raise exception 'Brak dostepu do tego watku'; end if;

  insert into public.business_thread_reads (business_profile_id, business_read_at, admin_read_at)
  values (p_business_id,
          case when v_owner and not v_admin then now() else null end,
          case when v_admin then now() else null end)
  on conflict (business_profile_id) do update
    set business_read_at = case when v_owner and not v_admin then now() else public.business_thread_reads.business_read_at end,
        admin_read_at    = case when v_admin then now() else public.business_thread_reads.admin_read_at end;
end;
$$;

revoke all on function public.mark_business_thread_read(uuid) from public, anon;
grant execute on function public.mark_business_thread_read(uuid) to authenticated;

-- ── Licznik nieprzeczytanych dla LOKALU (dymek w panelu) ───────────────────
create or replace function public.business_unread_for_owner(p_business_id uuid)
returns int
language sql
security definer
set search_path to 'public', 'auth'
as $$
  select count(*)::int
    from public.business_messages m
    left join public.business_thread_reads r on r.business_profile_id = m.business_profile_id
   where m.business_profile_id = p_business_id
     and m.sender = 'admin'
     and (r.business_read_at is null or m.created_at > r.business_read_at)
     and exists (select 1 from public.business_profiles bp
                  where bp.id = p_business_id and bp.owner_user_id = auth.uid());
$$;

revoke all on function public.business_unread_for_owner(uuid) from public, anon;
grant execute on function public.business_unread_for_owner(uuid) to authenticated;

-- ── Lista watkow dla panelu ops ────────────────────────────────────────────
-- Jeden wiersz na LOKAL, z ostatnia wiadomoscia i liczba nieprzeczytanych po naszej stronie.
create or replace function public.admin_message_threads()
returns table (
  business_profile_id uuid,
  business_name text,
  city text,
  logo_url text,
  last_body text,
  last_sender text,
  last_at timestamptz,
  unread int,
  total int
)
language sql
security definer
set search_path to 'public', 'auth'
as $$
  select bp.id,
         bp.business_name,
         bp.city,
         bp.logo_url,
         last.body,
         last.sender,
         last.created_at,
         (select count(*)::int from public.business_messages m2
           left join public.business_thread_reads r on r.business_profile_id = bp.id
          where m2.business_profile_id = bp.id
            and m2.sender = 'business'
            and (r.admin_read_at is null or m2.created_at > r.admin_read_at)) as unread,
         (select count(*)::int from public.business_messages m3 where m3.business_profile_id = bp.id) as total
    from public.business_profiles bp
    join lateral (
      select m.body, m.sender, m.created_at
        from public.business_messages m
       where m.business_profile_id = bp.id
       order by m.created_at desc
       limit 1
    ) last on true
   where public.has_role(auth.uid(), 'admin')
   order by last.created_at desc;
$$;

revoke all on function public.admin_message_threads() from public, anon;
grant execute on function public.admin_message_threads() to authenticated;

comment on table public.business_messages is
  'Czat lokal <-> spontaway. Watek = business_profile_id (jeden lokal, jeden watek).';
