-- Imie w profilu bez zadnej bariery: "Cipa" przeszlo w onboardingu (zgloszenie Nat 2026-09-14).
-- Ta sama lista slow, co przy nazwie uzytkownika i tytulach (banned_usernames przez
-- contains_banned_words), plus limit 30 znakow. Sprawdzamy TYLKO zmieniane imie - historyczne
-- konta dzialaja dalej, dopoki nie ruszy imienia.
create or replace function public.reject_banned_first_name()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.first_name is not distinct from old.first_name then
    return new;
  end if;
  if new.first_name is null then return new; end if;
  if char_length(new.first_name) > 30 then
    raise exception 'first_name_not_allowed' using hint = 'imie moze miec najwyzej 30 znakow';
  end if;
  if public.contains_banned_words(new.first_name) then
    raise exception 'first_name_not_allowed' using hint = 'imie zawiera niedozwolone slowo';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_reject_banned_first_name on public.profiles;
create trigger trg_profiles_reject_banned_first_name
  before insert or update of first_name on public.profiles
  for each row execute function public.reject_banned_first_name();
