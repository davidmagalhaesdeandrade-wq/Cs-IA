-- Persistent player wallet, store catalog, inventory, and equipped finishes.
-- Run after 20261114_game_accounts.sql in the branch-preview Supabase project.
create table if not exists public.game_skin_catalog (
  id text primary key,
  weapon text not null,
  name text not null,
  rarity text not null check (rarity in ('consumer','industrial','milspec','restricted','classified','covert','gold')),
  price integer not null check (price >= 0),
  active boolean not null default true
);

create table if not exists public.game_inventory (
  user_id uuid not null references public.game_users(id) on delete cascade,
  skin_id text not null references public.game_skin_catalog(id),
  purchased_at timestamptz not null default now(),
  primary key (user_id, skin_id)
);

create table if not exists public.game_equipped_skins (
  user_id uuid not null references public.game_users(id) on delete cascade,
  weapon text not null,
  skin_id text not null,
  equipped_at timestamptz not null default now(),
  primary key (user_id, weapon),
  foreign key (user_id, skin_id) references public.game_inventory(user_id, skin_id) on delete cascade
);

alter table public.game_skin_catalog enable row level security;
alter table public.game_inventory enable row level security;
alter table public.game_equipped_skins enable row level security;
revoke all on public.game_skin_catalog, public.game_inventory, public.game_equipped_skins from anon, authenticated;
grant select, insert, update, delete on public.game_skin_catalog, public.game_inventory, public.game_equipped_skins to service_role;

create or replace function public.ensure_game_inventory(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.game_users where id = p_user_id and not is_banned) then
    raise exception 'Conta indisponível';
  end if;
  insert into public.game_inventory(user_id, skin_id)
  select p_user_id, id from public.game_skin_catalog where active and price = 0
  on conflict do nothing;
end;
$$;

create or replace function public.purchase_game_skin(p_user_id uuid, p_skin_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare item public.game_skin_catalog; balance integer;
begin
  select * into item from public.game_skin_catalog where id = p_skin_id and active for share;
  if item.id is null or item.price <= 0 then raise exception 'Item indisponível na loja'; end if;
  update public.game_users set credits = credits - item.price
  where id = p_user_id and not is_banned and credits >= item.price returning credits into balance;
  if balance is null then raise exception 'Saldo insuficiente ou conta indisponível'; end if;
  insert into public.game_inventory(user_id, skin_id) values (p_user_id, item.id)
  on conflict do nothing;
  if not found then
    update public.game_users set credits = credits + item.price where id = p_user_id returning credits into balance;
    raise exception 'Este acabamento já está no inventário';
  end if;
  return jsonb_build_object('skin_id', item.id, 'credits', balance);
end;
$$;

create or replace function public.equip_game_skin(p_user_id uuid, p_skin_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare item public.game_skin_catalog;
begin
  select c.* into item from public.game_skin_catalog c
  join public.game_inventory i on i.skin_id = c.id and i.user_id = p_user_id
  where c.id = p_skin_id and c.active;
  if item.id is null then raise exception 'Skin não pertence a esta conta'; end if;
  insert into public.game_equipped_skins(user_id, weapon, skin_id)
  values (p_user_id, item.weapon, item.id)
  on conflict (user_id, weapon) do update set skin_id = excluded.skin_id, equipped_at = now();
  return jsonb_build_object('weapon', item.weapon, 'skin_id', item.id);
end;
$$;

revoke all on function public.ensure_game_inventory(uuid) from public, anon, authenticated;
revoke all on function public.purchase_game_skin(uuid, text) from public, anon, authenticated;
revoke all on function public.equip_game_skin(uuid, text) from public, anon, authenticated;
grant execute on function public.ensure_game_inventory(uuid) to service_role;
grant execute on function public.purchase_game_skin(uuid, text) to service_role;
grant execute on function public.equip_game_skin(uuid, text) to service_role;

insert into public.game_skin_catalog(id, weapon, name, rarity, price) values
('ak47_default', 'ak47', 'Default', 'consumer', 0),
('ak47_redline', 'ak47', 'Redline Inspired', 'classified', 3200),
('ak47_gold', 'ak47', 'Gold Edition', 'covert', 6500),
('ak47_neon', 'ak47', 'Neon Circuit', 'restricted', 1600),
('m4a4_default', 'm4a4', 'Default', 'consumer', 0),
('m4a4_camo', 'm4a4', 'Urban Camo', 'industrial', 350),
('m4a4_bluesteel', 'm4a4', 'Blue Steel', 'restricted', 1600),
('m4a1s_default', 'm4a1s', 'Default', 'consumer', 0),
('m4a1s_neon', 'm4a1s', 'Neon Circuit', 'classified', 3200),
('awp_default', 'awp', 'Default', 'consumer', 0),
('awp_phantom', 'awp', 'White Phantom', 'classified', 3200),
('awp_dragon', 'awp', 'Dragon Inspired', 'covert', 6500),
('glock_default', 'glock', 'Default', 'consumer', 0),
('glock_fade', 'glock', 'Gradient Fade', 'restricted', 1600),
('usps_default', 'usps', 'Default', 'consumer', 0),
('usps_carbon', 'usps', 'Carbon Ops', 'milspec', 800),
('deagle_default', 'deagle', 'Default', 'consumer', 0),
('deagle_gold', 'deagle', 'Golden Eagle', 'covert', 6500),
('deagle_redline', 'deagle', 'Crimson Line', 'restricted', 1600),
('knife_default', 'knife', 'Default', 'consumer', 0),
('knife_fade', 'knife', 'Karambit Fade', 'covert', 26000),
('knife_tiger', 'knife', 'Butterfly Tiger Stripe', 'covert', 26000),
('knife_bluesteel', 'knife', 'Stiletto Blue Steel', 'covert', 26000),
('galil_default', 'galil', 'Default', 'consumer', 0),
('famas_default', 'famas', 'Default', 'consumer', 0),
('ssg08_default', 'ssg08', 'Default', 'consumer', 0),
('mac10_default', 'mac10', 'Default', 'consumer', 0),
('mp9_default', 'mp9', 'Default', 'consumer', 0),
('p90_default', 'p90', 'Default', 'consumer', 0),
('nova_default', 'nova', 'Default', 'consumer', 0),
('galil_dragon', 'galil', 'Inferno Scale', 'covert', 6500),
('galil_carbon', 'galil', 'Carbon Vector', 'restricted', 1600),
('famas_phantom', 'famas', 'Arctic Phantom', 'classified', 3200),
('famas_neon', 'famas', 'Pulse Grid', 'restricted', 1600),
('ssg08_fade', 'ssg08', 'Aurora Fade', 'classified', 3200),
('ssg08_bluesteel', 'ssg08', 'Tempered Storm', 'restricted', 1600),
('mac10_tiger', 'mac10', 'Predator', 'restricted', 1600),
('mac10_carbon', 'mac10', 'Carbon Rush', 'milspec', 800),
('mp9_neon', 'mp9', 'Neon Vector', 'classified', 3200),
('mp9_bluesteel', 'mp9', 'Blue Temper', 'restricted', 1600),
('p90_phantom', 'p90', 'Arctic Web', 'classified', 3200),
('p90_dragon', 'p90', 'Dragon Pulse', 'covert', 6500),
('nova_camo', 'nova', 'Urban Breach', 'milspec', 800),
('nova_redline', 'nova', 'Crimson Pump', 'restricted', 1600),
('ak47_camo', 'ak47', 'Forest Grid', 'milspec', 800),
('ak47_dragon', 'ak47', 'Ember Wyrm', 'covert', 6500),
('m4a4_fade', 'm4a4', 'Prism Shift', 'classified', 3200),
('m4a4_dragon', 'm4a4', 'Ashen Dragon', 'covert', 6500),
('m4a1s_phantom', 'm4a1s', 'Silent Frost', 'classified', 3200),
('m4a1s_carbon', 'm4a1s', 'Carbon Silence', 'restricted', 1600),
('galil_fade', 'galil', 'Dune Spectrum', 'restricted', 1600),
('galil_tiger', 'galil', 'Sand Predator', 'classified', 3200),
('famas_camo', 'famas', 'Urban Phantom', 'milspec', 800),
('famas_dragon', 'famas', 'Molten Scale', 'covert', 6500),
('awp_fade', 'awp', 'Solar Fade', 'covert', 6500),
('awp_carbon', 'awp', 'Longshot Carbon', 'restricted', 1600),
('ssg08_camo', 'ssg08', 'Recon Camo', 'milspec', 800),
('ssg08_tiger', 'ssg08', 'Tiger Recon', 'classified', 3200),
('mac10_fade', 'mac10', 'Voltage Fade', 'restricted', 1600),
('mac10_phantom', 'mac10', 'Ghostline', 'classified', 3200),
('mp9_fade', 'mp9', 'Neon Aurora', 'classified', 3200),
('mp9_dragon', 'mp9', 'Dragon Circuit', 'covert', 6500),
('p90_redline', 'p90', 'Red Sector', 'restricted', 1600),
('p90_carbon', 'p90', 'Carbon Pulse', 'milspec', 800),
('nova_fade', 'nova', 'Amber Tide', 'restricted', 1600),
('nova_phantom', 'nova', 'Cold Breach', 'classified', 3200),
('glock_neon', 'glock', 'Night Runner', 'restricted', 1600),
('glock_tiger', 'glock', 'Copper Fang', 'milspec', 800),
('usps_fade', 'usps', 'Quiet Spectrum', 'classified', 3200),
('usps_phantom', 'usps', 'White Noise', 'restricted', 1600),
('deagle_fade', 'deagle', 'Royal Spectrum', 'covert', 6500),
('deagle_carbon', 'deagle', 'Heavy Carbon', 'restricted', 1600),
('knife_neon', 'knife', 'Voltage Edge', 'covert', 26000),
('knife_dragon', 'knife', 'Wyrm Fang', 'covert', 26000),
('knife_carbon', 'knife', 'M9 Bayonet | Carbon', 'covert', 26000)
on conflict (id) do update set weapon=excluded.weapon, name=excluded.name, rarity=excluded.rarity;
