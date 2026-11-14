-- Account and administration data for the branch preview. Run once in Supabase SQL Editor.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.game_users (
  id uuid primary key default gen_random_uuid(),
  username text not null check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  username_key text generated always as (lower(username)) stored unique,
  password_hash text not null,
  role text not null default 'player' check (role in ('player', 'admin')),
  is_banned boolean not null default false,
  xp integer not null default 0 check (xp >= 0),
  matches integer not null default 0 check (matches >= 0),
  wins integer not null default 0 check (wins >= 0),
  kills integer not null default 0 check (kills >= 0),
  credits integer not null default 30000 check (credits >= 0),
  rank text not null default 'Prata I',
  created_at timestamptz not null default now()
);

create table if not exists public.game_admin_logs (
  id bigint generated always as identity primary key,
  actor text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.game_users enable row level security;
alter table public.game_admin_logs enable row level security;
revoke all on public.game_users, public.game_admin_logs from anon, authenticated;

create or replace function public.register_game_user(p_username text, p_password text, p_admin boolean default false)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.game_users;
begin
  if p_username !~ '^[A-Za-z0-9_]{3,16}$' or char_length(p_password) < 10 or char_length(p_password) > 128 then
    raise exception 'Dados de cadastro inválidos';
  end if;
  if p_admin and lower(p_username) <> 'goat' then raise exception 'Administrador inicial inválido'; end if;
  insert into public.game_users(username, password_hash, role)
  values (p_username, crypt(p_password, gen_salt('bf', 12)), case when p_admin then 'admin' else 'player' end)
  returning * into u;
  return jsonb_build_object('id', u.id, 'username', u.username, 'role', u.role, 'xp', u.xp, 'matches', u.matches, 'wins', u.wins, 'kills', u.kills, 'credits', u.credits, 'rank', u.rank);
end;
$$;

create or replace function public.authenticate_game_user(p_username text, p_password text)
returns jsonb language sql security definer set search_path = public, extensions as $$
  select jsonb_build_object('id', u.id, 'username', u.username, 'role', u.role, 'xp', u.xp, 'matches', u.matches, 'wins', u.wins, 'kills', u.kills, 'credits', u.credits, 'rank', u.rank)
  from public.game_users u
  where u.username_key = lower(p_username)
    and u.password_hash = crypt(p_password, u.password_hash)
    and not u.is_banned
  limit 1;
$$;

create or replace function public.add_game_stats(p_user_id uuid, p_kills integer, p_matches integer, p_wins integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u public.game_users;
begin
  if p_kills < 0 or p_kills > 1000 or p_matches not in (0,1) or p_wins not in (0,1) or p_wins > p_matches then
    raise exception 'Estatísticas inválidas';
  end if;
  update public.game_users set kills = kills + p_kills, matches = matches + p_matches, wins = wins + p_wins,
    xp = xp + p_kills * 100 + p_wins * 600
  where id = p_user_id and not is_banned returning * into u;
  if u.id is null then raise exception 'Conta indisponível'; end if;
  return jsonb_build_object('xp',u.xp,'matches',u.matches,'wins',u.wins,'kills',u.kills);
end;
$$;

revoke all on function public.register_game_user(text, text, boolean) from public, anon, authenticated;
revoke all on function public.authenticate_game_user(text, text) from public, anon, authenticated;
revoke all on function public.add_game_stats(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.register_game_user(text, text, boolean) to service_role;
grant execute on function public.authenticate_game_user(text, text) to service_role;
grant execute on function public.add_game_stats(uuid, integer, integer, integer) to service_role;
grant select, insert, update on public.game_users to service_role;
grant select, insert on public.game_admin_logs to service_role;
