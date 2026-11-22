-- ---------- улей изнутри: соты ----------
-- В соту заливается 10 пыльцы, через 20 секунд в ней готова банка мёда.
-- Соты у каждого игрока свои. Больше сот покупается в магазине улья.

alter table users add column if not exists comb_level int not null default 1;

create table if not exists honeycomb (
  nickname text not null references users(nickname) on delete cascade,
  idx int not null,
  filled_at timestamptz not null default now(),
  primary key (nickname, idx)
);
alter table honeycomb enable row level security;
revoke all on honeycomb from anon, authenticated;

create or replace function _comb_count(lvl int) returns int language sql immutable as
$$ select (array[6,12,18,24])[lvl] $$;
create or replace function _comb_cost(lvl int) returns int language sql immutable as
$$ select (array[10,30,80])[lvl] $$;      -- null на последнем уровне
create or replace function _brew_sec() returns int language sql immutable as $$ select 20 $$;

-- игрок в улье? (рядом с центром мира)
create or replace function _at_hive(p_nick text) returns boolean
language sql stable security definer set search_path = public as $$
  select sqrt((coalesce(pos_x, 1000000) - 1000000)::float8 ^ 2 + (coalesce(pos_y, 1000000) - 1000000)::float8 ^ 2) <= 400
  from users where nickname = p_nick;
$$;

create or replace function _hive_json(p_nick text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'comb_level', u.comb_level,
    'comb_count', _comb_count(u.comb_level),
    'comb_next', _comb_count(u.comb_level + 1),
    'comb_cost', _comb_cost(u.comb_level),
    'brew', _brew_sec(),
    'combs', coalesce((select jsonb_agg(jsonb_build_object('idx', h.idx,
        'left', greatest(0, _brew_sec() - extract(epoch from now() - h.filled_at))) order by h.idx)
      from honeycomb h where h.nickname = p_nick), '[]'::jsonb),
    'user', _user_json(p_nick))
  from users u where u.nickname = p_nick;
$$;

create or replace function hive_state(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return _hive_json(_auth(p_token));
end $$;

-- Залить пыльцу: в одну соту (p_idx) или во все пустые (p_idx = null).
create or replace function comb_fill(p_token uuid, p_idx int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v text; u users; cnt int; n int; i int;
begin
  v := _auth(p_token);
  if not _at_hive(v) then raise exception 'Нужно быть в улье'; end if;
  select * into u from users where nickname = v for update;
  cnt := _comb_count(u.comb_level);
  if u.pollen < 10 then raise exception 'Нужно хотя бы 10 пыльцы'; end if;
  if p_idx is not null then
    if p_idx < 0 or p_idx >= cnt then raise exception 'Нет такой соты'; end if;
    if exists (select 1 from honeycomb where nickname = v and idx = p_idx) then raise exception 'Сота занята'; end if;
    insert into honeycomb (nickname, idx) values (v, p_idx);
    update users set pollen = pollen - 10 where nickname = v;
  else
    n := 0;
    for i in 0 .. cnt - 1 loop
      exit when u.pollen - n * 10 < 10;
      if not exists (select 1 from honeycomb where nickname = v and idx = i) then
        insert into honeycomb (nickname, idx) values (v, i);
        n := n + 1;
      end if;
    end loop;
    if n = 0 then raise exception 'Все соты заняты'; end if;
    update users set pollen = pollen - n * 10 where nickname = v;
  end if;
  return _hive_json(v);
end $$;

-- Забрать готовый мёд: из одной соты или из всех готовых.
create or replace function comb_collect(p_token uuid, p_idx int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v text; n int;
begin
  v := _auth(p_token);
  if not _at_hive(v) then raise exception 'Нужно быть в улье'; end if;
  perform 1 from users where nickname = v for update;
  with d as (
    delete from honeycomb where nickname = v and (p_idx is null or idx = p_idx)
      and filled_at <= now() - make_interval(secs => _brew_sec())
    returning 1)
  select count(*) into n from d;
  if n = 0 then raise exception 'Мёд ещё не готов'; end if;
  update users set honey = honey + n where nickname = v;
  return _hive_json(v) || jsonb_build_object('got', n);
end $$;

create or replace function upgrade_combs(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v text; u users; cost int;
begin
  v := _auth(p_token);
  select * into u from users where nickname = v for update;
  cost := _comb_cost(u.comb_level);
  if cost is null then raise exception 'Соты уже максимальные'; end if;
  if u.honey < cost then raise exception 'Не хватает мёда'; end if;
  update users set honey = honey - cost, comb_level = comb_level + 1 where nickname = v;
  return _hive_json(v);
end $$;

revoke execute on function _at_hive(text) from public, anon, authenticated;
revoke execute on function _hive_json(text) from public, anon, authenticated;
grant execute on function hive_state(uuid) to anon, authenticated;
grant execute on function comb_fill(uuid, int) to anon, authenticated;
grant execute on function comb_collect(uuid, int) to anon, authenticated;
grant execute on function upgrade_combs(uuid) to anon, authenticated;

-- мёд теперь делается только в сотах внутри улья
revoke execute on function sell_pollen(uuid, int, int) from public, anon, authenticated;
