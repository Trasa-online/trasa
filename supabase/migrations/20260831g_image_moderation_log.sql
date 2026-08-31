-- SLAD PO MODERACJI ZDJEC (Vision SafeSearch). Bez tego odrzucone zdjecie znikalo bez sladu
-- i nie dalo sie sprawdzic falszywych alarmow ani odwolac od decyzji (pytanie Nat 2026-08-31).
--
-- Zapis robi edge function `moderate-image` (service role), NIE klient - inaczej dalo by sie
-- go pominac. Odrzucony plik ladu.je w PRYWATNYM buckecie kwarantanny, wiec admin moze go
-- obejrzec (signed URL), a nikt inny nie ma do niego dostepu.
create table if not exists public.image_moderation_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  context text,                       -- place_photo | pin_photo | trip_gallery | list_item | inne
  source_url text not null,           -- URL sprawdzanego zdjecia (po odrzuceniu juz nieaktywny)
  quarantine_path text,               -- sciezka w buckecie moderation-quarantine (kopia do wgladu)
  verdict text not null,              -- rejected (logujemy tylko odrzucenia)
  scores jsonb,                       -- pelna odpowiedz SafeSearch (adult/violence/racy/medical/spoof)
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,            -- admin obejrzal
  reviewer_note text                  -- np. "falszywy alarm - zdjecie z basenu"
);
create index if not exists image_moderation_log_new_idx on public.image_moderation_log (created_at desc);

alter table public.image_moderation_log enable row level security;

-- Tylko admin czyta i opisuje; zapis leci service rolem z edge function (omija RLS).
drop policy if exists "Admins manage moderation log" on public.image_moderation_log;
create policy "Admins manage moderation log" on public.image_moderation_log
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Kwarantanna: bucket PRYWATNY (public=false) - podglad tylko przez signed URL dla admina.
insert into storage.buckets (id, name, public)
values ('moderation-quarantine', 'moderation-quarantine', false)
on conflict (id) do nothing;

drop policy if exists "Admins read quarantine" on storage.objects;
create policy "Admins read quarantine" on storage.objects
  for select to authenticated
  using (bucket_id = 'moderation-quarantine' and public.has_role(auth.uid(), 'admin'::public.app_role));
