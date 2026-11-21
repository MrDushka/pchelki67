-- ---------- пыльца, мёд, мешочек, позиция ----------
-- Мир: 0..2 000 000 px, улей в центре (1000000, 1000000) = координаты 0 0 в игре.
-- 10 пыльцы = 1 банка мёда. Мешочек улучшается за мёд.

alter table users
  add column if not exists pollen int not null default 0,
  add column if not exists bag_level int not null default 1,
  add column if not exists pos_x int,
  add column if not exists pos_y int,
  add column if not exists pos_at timestamptz,
  add column if not exists last_collect_at timestamptz;

create table if not exists pollen_taken (
  nickname text not null references users(nickname) on delete cascade,
  gx int not null, gy int not null,
  taken_at timestamptz not null default now(),
  primary key (nickname, gx, gy)
);
alter table pollen_taken enable row level security;
revoke all on pollen_taken from anon, authenticated;

-- вместимость мешочка и цена улучшения до следующего уровня
create or replace function _bag_cap(lvl int) returns int language sql immutable as
$$ select (array[100,150,225,325,450,600,800,1000])[lvl] $$;
create or replace function _bag_cost(lvl int) returns int language sql immutable as
$$ select (array[5,12,25,45,75,120,180])[lvl] $$;   -- null на последнем уровне
-- редкость цветка: с какого расстояния от улья (px) встречается и во сколько раз больше пыльцы
create or replace function _tier_dist(t int) returns int language sql immutable as
$$ select (array[0,60000,200000,450000,750000])[t + 1] $$;
create or replace function _tier_mult(t int) returns int language sql immutable as
$$ select (array[1,2,3,5,10])[t + 1] $$;

create or replace function _user_json(p_nick text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nickname', nickname, 'honey', honey, 'wins', wins, 'is_admin', is_admin,
    'respects_bees', respects_bees, 'pollen', pollen, 'bag_level', bag_level,
    'bag_cap', _bag_cap(bag_level), 'bag_cost', _bag_cost(bag_level), 'pos_x', pos_x, 'pos_y', pos_y)
  from users where nickname = p_nick;
$$;

-- Проверка перемещения: пчела не может лететь быстрее ~800 px/с.
-- Возвращает true, если новая позиция принята.
create or replace function _move(p_nick text, p_x int, p_y int) returns boolean
language plpgsql security definer set search_path = public as $$
declare u users; dt float8; d float8;
begin
  if p_x is null or p_y is null or p_x < 0 or p_y < 0 or p_x > 2000000 or p_y > 2000000 then return false; end if;
  select * into u from users where nickname = p_nick for update;
  dt := coalesce(extract(epoch from now() - u.pos_at), 0);
  d := sqrt((p_x - coalesce(u.pos_x, 1000000))::float8 ^ 2 + (p_y - coalesce(u.pos_y, 1000000))::float8 ^ 2);
  if d > dt * 800 + 800 then return false; end if;
  update users set pos_x = p_x, pos_y = p_y, pos_at = now() where nickname = p_nick;
  return true;
end $$;

create or replace function save_pos(p_token uuid, p_x int, p_y int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v text; ok boolean; u users;
begin
  v := _auth(p_token);
  ok := _move(v, p_x, p_y);
  select * into u from users where nickname = v;
  return jsonb_build_object('ok', ok, 'x', coalesce(u.pos_x, 1000000), 'y', coalesce(u.pos_y, 1000000));
end $$;

-- Сбор пыльцы после мини-игры. Количество выбирает сервер: 2..7 × редкость.
create or replace function collect_pollen(p_token uuid, p_gx int, p_gy int, p_tier int, p_x int, p_y int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v text; u users; cx float8; cy float8; cap int; amount int; got int;
begin
  v := _auth(p_token);
  if not _move(v, p_x, p_y) then raise exception 'Слишком быстро летишь'; end if;
  if p_tier is null or p_tier < 0 or p_tier > 4 then raise exception 'Нет такого цветка'; end if;
  cx := p_gx * 256 + 128; cy := p_gy * 256 + 128;
  if sqrt((p_x - cx) ^ 2 + (p_y - cy) ^ 2) > 260 then raise exception 'Цветок слишком далеко'; end if;
  if sqrt((cx - 1000000) ^ 2 + (cy - 1000000) ^ 2) < _tier_dist(p_tier) - 200 then raise exception 'Нет такого цветка'; end if;
  select * into u from users where nickname = v for update;
  if u.last_collect_at > now() - interval '1.5 seconds' then raise exception 'Не так быстро'; end if;
  cap := _bag_cap(u.bag_level);
  if u.pollen >= cap then raise exception 'Мешочек полон! Лети в улей'; end if;
  delete from pollen_taken where nickname = v and taken_at < now() - interval '5 minutes';
  if exists (select 1 from pollen_taken where nickname = v and gx = p_gx and gy = p_gy) then
    raise exception 'Цветок пуст, подожди немного';
  end if;
  insert into pollen_taken (nickname, gx, gy) values (v, p_gx, p_gy);
  amount := (2 + floor(random() * 6)::int) * _tier_mult(p_tier);
  got := least(cap - u.pollen, amount);
  update users set pollen = pollen + got, last_collect_at = now() where nickname = v;
  return jsonb_build_object('got', got, 'user', _user_json(v));
end $$;

-- Сдать пыльцу в улье: каждые 10 пыльцы = 1 банка мёда.
create or replace function sell_pollen(p_token uuid, p_x int, p_y int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v text; u users; jars int;
begin
  v := _auth(p_token);
  if not _move(v, p_x, p_y) then raise exception 'Слишком быстро летишь'; end if;
  if sqrt((p_x - 1000000)::float8 ^ 2 + (p_y - 1000000)::float8 ^ 2) > 320 then raise exception 'Нужно быть у улья'; end if;
  select * into u from users where nickname = v for update;
  jars := u.pollen / 10;
  update users set honey = honey + jars, pollen = pollen - jars * 10 where nickname = v;
  return jsonb_build_object('jars', jars, 'user', _user_json(v));
end $$;

create or replace function upgrade_bag(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v text; u users; cost int;
begin
  v := _auth(p_token);
  select * into u from users where nickname = v for update;
  cost := _bag_cost(u.bag_level);
  if cost is null then raise exception 'Мешочек уже максимальный'; end if;
  if u.honey < cost then raise exception 'Не хватает мёда'; end if;
  update users set honey = honey - cost, bag_level = bag_level + 1 where nickname = v;
  return _user_json(v);
end $$;

revoke execute on function _move(text, int, int) from public, anon, authenticated;
revoke execute on function _user_json(text) from public, anon, authenticated;
grant execute on function save_pos(uuid, int, int) to anon, authenticated;
grant execute on function collect_pollen(uuid, int, int, int, int, int) to anon, authenticated;
grant execute on function sell_pollen(uuid, int, int) to anon, authenticated;
grant execute on function upgrade_bag(uuid) to anon, authenticated;

-- Телепорт любого игрока к общему улью (0 0). Раз в 60 секунд.
alter table users add column if not exists last_tp_at timestamptz;
create or replace function teleport_home(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v text; u users; wait int;
begin
  v := _auth(p_token);
  select * into u from users where nickname = v for update;
  if u.last_tp_at > now() - interval '60 seconds' then
    wait := ceil(60 - extract(epoch from now() - u.last_tp_at));
    raise exception 'Телепорт будет через % сек', wait;
  end if;
  update users set pos_x = 1000000, pos_y = 1000170, pos_at = now(), last_tp_at = now() where nickname = v;
  return jsonb_build_object('x', 1000000, 'y', 1000170);
end $$;
grant execute on function teleport_home(uuid) to anon, authenticated;
