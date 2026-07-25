-- Publiczna liczba znajomych (do wyswietlenia na profilu publicznym). friendships ma RLS
-- self-only (widzisz tylko swoje relacje), wiec liczba znajomych INNEGO usera wymaga
-- SECURITY DEFINER. Liczba znajomych to informacja publiczna (jak na wiekszosci apek).
create or replace function public.friend_count(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.friendships
  where status = 'accepted'
    and (requester_id = uid or addressee_id = uid);
$$;

grant execute on function public.friend_count(uuid) to anon, authenticated;
