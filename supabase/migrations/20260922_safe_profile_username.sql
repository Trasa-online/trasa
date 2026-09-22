-- LOGOWANIE PRZEZ GOOGLE/APPLE PADALO NA DLUGIM ADRESIE E-MAIL (zgloszenie testerki 2026-09-22).
--
-- `handle_new_user` robil nazwe uzytkownika z czesci adresu przed @, a `reject_banned_username`
-- (migracja 20260914b) odrzuca nazwy dluzsze niz 20 znakow i te spoza [[:alnum:]._-].
-- Adres `usagi.lukowska.contact@gmail.com` daje 22 znaki -> wyjatek `username_not_allowed`
-- w triggerze na `profiles` wywracal CALA transakcje tworzenia konta w auth.users:
--   "500: Database error saving new user ... ERROR: username_not_allowed (SQLSTATE P0001)"
-- Konto nie powstawalo wcale (logi auth: /callback 500 dla google I apple - to nie byl problem
-- jednego dostawcy, tylko kazdej pierwszej rejestracji takiego adresu).
--
-- Naprawa ma dwie warstwy:
--  1. `safe_profile_username` - nazwa startowa jest SANITYZOWANA, nie brana wprost: tylko
--     dozwolone znaki, przyciecie do 16 znakow (zostaje miejsce na licznik unikalnosci),
--     a gdy po oczyszczeniu nic nie zostanie albo wpadnie na liste zakazanych -> `user_<uuid8>`.
--  2. `handle_new_user` NIE MOZE juz wywrocic rejestracji: zalozenie profilu siedzi w bloku
--     z `exception`, wiec nawet nieprzewidziany blad (np. nowa regula na `profiles`) zostawia
--     konto zalozone, a profil dorobi `ensure_current_user_profile` przy pierwszym wejsciu.
-- ⛔ To NIE jest poluzowanie regul nazw - limit 20 znakow i lista slow zostaja bez zmian dla
--    nazw, ktore user wpisuje SAM (onboarding, Ustawienia). Zmienia sie wylacznie nazwa
--    STARTOWA, ktorej i tak nikt nie widzi przed onboardingiem.

create or replace function public.safe_profile_username(p_base text, p_uid uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix int := 0;
  v_n1 text;
  v_n2 text;
  c_base_len constant int := 16;  -- 20 (limit) minus miejsce na licznik
begin
  -- Tylko znaki, ktore przepuszcza `reject_banned_username`; reszta (spacje, +, diakrytyki,
  -- znaki spoza ASCII) wypada, wiec adres z plusem czy imie z ogonkami nie wywroca zapisu.
  v_base := regexp_replace(lower(coalesce(p_base, '')), '[^a-z0-9._-]', '', 'g');
  v_base := left(v_base, c_base_len);
  -- ⚠️ `normalize_username_for_match` ma DWA warianty (z podmiana cyfr na litery i bez) i wolanie
  -- z jednym argumentem jest niejednoznaczne (42725) - podajemy oba jawnie, dokladnie tak jak
  -- robi to `reject_banned_username`, zeby sanityzacja i straznik widzialy to samo.
  v_n1 := public.normalize_username_for_match(v_base, true);
  v_n2 := public.normalize_username_for_match(v_base, false);
  -- Sama kropka / podkreslnik nie przejdzie regulami (`n = ''`), wiec traktujemy jak pustke.
  if v_n1 = '' then
    v_base := null;
  -- Zakazane slowo w adresie e-mail = nazwa zastepcza, nie blad rejestracji.
  elsif exists (
    select 1 from public.banned_usernames b
     where (b.match_type = 'exact' and b.pattern in (v_n1, v_n2))
        or (b.match_type = 'substring' and (position(b.pattern in v_n1) > 0 or position(b.pattern in v_n2) > 0))
  ) then
    v_base := null;
  end if;
  v_base := coalesce(v_base, 'user_' || substring(p_uid::text, 1, 8));

  v_candidate := v_base;
  while exists (select 1 from public.profiles where username = v_candidate) loop
    v_suffix := v_suffix + 1;
    v_candidate := v_base || v_suffix::text;
    if v_suffix > 100 then
      -- Ostatnia deska ratunku: fragment UUID jest unikalny w praktyce.
      v_candidate := left(v_base, 11) || '_' || substring(p_uid::text, 1, 8);
      exit;
    end if;
  end loop;
  return left(v_candidate, 20);
end;
$$;

-- Funkcja pomocnicza triggerow - klient nie ma po co jej wolac (regula z audytu).
revoke execute on function public.safe_profile_username(text, uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_first text;
begin
  if new.is_anonymous then
    return new;
  end if;

  -- Imie z dostawcy tez przechodzi przez straznika (`reject_banned_first_name`): za dlugie albo
  -- z zakazanym slowem zapisujemy jako NULL, bo user i tak podaje imie w onboardingu.
  v_first := nullif(new.raw_user_meta_data->>'first_name', '');
  if v_first is not null and (char_length(v_first) > 30 or public.contains_banned_words(v_first)) then
    v_first := null;
  end if;

  begin
    insert into public.profiles (id, username, first_name, avatar_url)
    values (
      new.id,
      public.safe_profile_username(
        coalesce(
          nullif(new.raw_user_meta_data->>'username', ''),
          nullif(split_part(new.email, '@', 1), '')
        ),
        new.id
      ),
      v_first,
      nullif(new.raw_user_meta_data->>'avatar_url', '')
    )
    on conflict (id) do nothing;
  exception when others then
    -- Konto ma powstac ZAWSZE. Profil dorobi `ensure_current_user_profile` przy pierwszym
    -- zapytaniu klienta; inaczej jeden straznik na `profiles` blokuje rejestracje calkiem.
    raise warning 'handle_new_user: profil nie powstal dla % (%)', new.id, sqlerrm;
  end;

  return new;
end;
$$;

create or replace function public.ensure_current_user_profile()
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid;
  v_email text;
  v_meta jsonb;
  v_first text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.profiles where id = v_user_id) then
    return v_user_id;
  end if;

  select email, raw_user_meta_data into v_email, v_meta
    from auth.users where id = v_user_id;

  v_first := nullif(v_meta->>'first_name', '');
  if v_first is not null and (char_length(v_first) > 30 or public.contains_banned_words(v_first)) then
    v_first := null;
  end if;

  insert into public.profiles (id, username, first_name, avatar_url)
  values (
    v_user_id,
    public.safe_profile_username(
      coalesce(
        nullif(v_meta->>'username', ''),
        nullif(v_meta->>'first_name', ''),
        nullif(split_part(v_email, '@', 1), '')
      ),
      v_user_id
    ),
    v_first,
    nullif(v_meta->>'avatar_url', '')
  )
  on conflict (id) do nothing;

  return v_user_id;
end;
$$;
