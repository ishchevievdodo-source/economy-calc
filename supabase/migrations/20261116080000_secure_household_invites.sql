-- Extend invite codes and enforce a strict two-person household limit.

alter table public.households drop constraint if exists households_invite_code_check;

update public.households
set invite_code = upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10))
where invite_code !~ '^[A-Z0-9]{10}$';

alter table public.households
  add constraint households_invite_code_check check (invite_code ~ '^[A-Z0-9]{10}$');

create or replace function public.enforce_household_member_limit() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.household_id::text, 0));
  if (select count(*) from public.household_members where household_id = new.household_id) >= 2 then
    raise exception 'HOUSEHOLD_FULL';
  end if;
  return new;
end;
$$;

drop trigger if exists household_member_limit on public.household_members;
create trigger household_member_limit
  before insert on public.household_members
  for each row execute function public.enforce_household_member_limit();
