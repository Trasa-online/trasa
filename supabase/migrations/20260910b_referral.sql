-- Zapraszanie znajomych (2026-09-10). Zamiast paywalla - ekran zachety.
--
-- Zasada: liczy sie REJESTRACJA z linku, a nie samo wyslanie linku. Licznik, ktory
-- kazdy nabija w dziesiec sekund, nic nie mowi ani userowi, ani nam.
--
-- Nic nie jest za sciana. To swiadomy wybor na ten etap: przed premiera odcinanie
-- funkcji odbiloby tych samych ludzi, ktorych wlasnie zbieramy z TestFlight i waitlisty.
-- Model danych jest juz gotowy pod twardszy prog, gdyby liczby o niego poprosily.

alter table public.profiles
  add column if not exists referral_code text,
  -- Kto zaprosil tego usera. Ustawiane RAZ, przez RPC ponizej.
  add column if not exists referred_by uuid references public.profiles(id) on delete set null;

-- Kod krotki i czytelny na glos. Bez 0/O/1/I/L - to jedyne pomylki, ktore realnie
-- zdarzaja sie przy przepisywaniu kodu z ekranu na ekran.
create or replace function public.gen_referral_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where referral_code = candidate);
  end loop;
  return candidate;
end;
$$;

update public.profiles set referral_code = public.gen_referral_code() where referral_code is null;

alter table public.profiles alter column referral_code set default public.gen_referral_code();

create unique index if not exists profiles_referral_code_key on public.profiles (referral_code);
create index if not exists profiles_referred_by_idx on public.profiles (referred_by);

-- Przypisanie zaproszenia. SECURITY DEFINER, bo user nie ma prawa zapisu do cudzego
-- profilu, a tu musi tylko WSKAZAC, kto go zaprosil.
--
-- Trzy zabezpieczenia, kazde na realny przypadek:
--  1. auth.uid() is null -> wyjatek. Bez tego funkcja dziala dla anona, a domyslne
--     uprawnienia Supabase daja EXECUTE roli `anon` (revoke from public tego NIE zdejmuje).
--  2. tylko gdy referred_by jest jeszcze puste - zaproszenie przypisuje sie RAZ.
--  3. nie mozna wskazac samego siebie.
create or replace function public.attach_referral(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_inviter uuid;
begin
  if v_me is null then
    raise exception 'attach_referral requires an authenticated user';
  end if;
  if p_code is null or btrim(p_code) = '' then
    return false;
  end if;
  select id into v_inviter from public.profiles
   where referral_code = upper(btrim(p_code)) limit 1;
  if v_inviter is null or v_inviter = v_me then
    return false;
  end if;
  update public.profiles
     set referred_by = v_inviter
   where id = v_me and referred_by is null;
  return found;
end;
$$;

revoke all on function public.attach_referral(text) from public, anon;
grant execute on function public.attach_referral(text) to authenticated;

-- Kod zapraszajacego zapisany przy dopisaniu sie do waitlisty. Link z landingu prowadzi
-- do przegladarki, a rejestracja dzieje sie pozniej w natywce - localStorage tego nie
-- przenosi. E-mail jest jedynym mostem miedzy tymi dwoma swiatami.
alter table public.waitlist
  add column if not exists referral_code text;

-- Domkniecie mostu przez e-mail: user zapisal sie na waitliste z czyjegos linku
-- (w przegladarce), a konto zaklada dopiero teraz, w natywce. localStorage tego nie
-- przenosi, wiec kod odczytujemy z wiersza waitlisty po adresie z jego wlasnego tokenu.
create or replace function public.attach_referral_from_waitlist()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_code text;
begin
  if v_me is null then
    raise exception 'attach_referral_from_waitlist requires an authenticated user';
  end if;
  if v_email = '' then
    return false;
  end if;
  -- Tylko gdy zaproszenie nie jest jeszcze przypisane - inaczej niepotrzebnie szukamy.
  if exists (select 1 from public.profiles where id = v_me and referred_by is not null) then
    return false;
  end if;
  select referral_code into v_code
    from public.waitlist
   where lower(email) = v_email and referral_code is not null
   order by created_at asc limit 1;
  if v_code is null then
    return false;
  end if;
  return public.attach_referral(v_code);
end;
$$;

revoke all on function public.attach_referral_from_waitlist() from public, anon;
grant execute on function public.attach_referral_from_waitlist() to authenticated;

-- Statystyki zapraszania przez RPC, a NIE przez odczyt kolumn.
--
-- `profiles` ma kolumnowe grantry SELECT (whitelista 18 kolumn dla anon/authenticated) -
-- nowe kolumny sa dla klienta niewidoczne i tak ma zostac. Gdybysmy dopisali je do
-- whitelisty, `referred_by` staloby sie publiczna krawedzia grafu spolecznego: kazdy
-- widzialby, kto kogo zaprosil. Kod zapraszajacego jest jawny z natury (jest w linku),
-- ale "kto kogo" juz nie.
--
-- Funkcja oddaje WYLACZNIE dane wolajacego: swoj kod i liczbe osob, ktore weszly z jego
-- linku. Nie da sie przez nia zapytac o cudze konto.
create or replace function public.referral_stats()
returns table (code text, invited integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'referral_stats requires an authenticated user';
  end if;
  return query
    select p.referral_code,
           (select count(*)::int from public.profiles r where r.referred_by = v_me)
      from public.profiles p
     where p.id = v_me;
end;
$$;

revoke all on function public.referral_stats() from public, anon;
grant execute on function public.referral_stats() to authenticated;
