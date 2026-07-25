-- Zgłaszanie problemów z miejscem/wizytówką przez userów (złe zdjęcie, zła kategoria,
-- zamknięte, błędne dane, treść niezgodna, inne). Moderacja ręczna w panelu admina.
-- Tylko REALNI (nie-anonimowi) userzy mogą zgłaszać.

create table if not exists public.place_flags (
  id           uuid primary key default gen_random_uuid(),
  place_id     uuid not null references public.places(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  reason       text not null check (reason in
                 ('bad_photo','wrong_category','closed','wrong_data','inappropriate','other')),
  note         text check (char_length(note) <= 300),
  status       text not null default 'pending' check (status in
                 ('pending','reviewing','resolved','dismissed')),
  resolution   text,                         -- notatka moderatora przy zamknięciu
  resolved_by  uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

alter table public.place_flags enable row level security;

-- User (NIE-anonimowy): tworzy zgłoszenie jako on sam.
create policy "place_flags_insert_own" on public.place_flags
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- User: widzi tylko swoje zgłoszenia.
create policy "place_flags_select_own" on public.place_flags
  for select to authenticated
  using (auth.uid() = user_id);

-- Admin (founder): pełny wgląd + moderacja (has_role z user_roles, spójnie z resztą RLS).
create policy "place_flags_admin_all" on public.place_flags
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Anty-spam: jedno OTWARTE zgłoszenie na (miejsce, user).
create unique index if not exists place_flags_one_open
  on public.place_flags(place_id, user_id) where status in ('pending','reviewing');

-- Kolejka moderacji: najdłużej czekające na górze.
create index if not exists place_flags_queue on public.place_flags(status, created_at);
