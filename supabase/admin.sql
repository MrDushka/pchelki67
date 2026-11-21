-- ---------- админ-панель ----------
-- Все функции сначала проверяют, что вызвавший — админ (users.is_admin).

create or replace function _admin(p_token uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  v := _auth(p_token);
  if not coalesce((select is_admin from users where nickname = v), false) then
    raise exception 'Только для админов';
  end if;
  return v;
end $$;

create or replace function _find_nick(p_nick text) returns text
language plpgsql stable security definer set search_path = public as $$
declare t text;
begin
  select nickname into t from users where lower(nickname) = lower(trim(p_nick));
  if t is null then raise exception 'Нет игрока %', p_nick; end if;
  return t;
end $$;

-- Выдать (или забрать минусом) мёд и пыльцу, поставить уровень мешочка 1..8.
create or replace function admin_give(p_token uuid, p_nick text, p_honey bigint, p_pollen int, p_bag int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  perform _admin(p_token);
  t := _find_nick(p_nick);
  update users set
    honey = greatest(0, honey + coalesce(p_honey, 0)),
    pollen = greatest(0, pollen + coalesce(p_pollen, 0)),
    bag_level = coalesce(least(8, greatest(1, p_bag)), bag_level)
  where nickname = t;
  return _user_json(t);
end $$;

-- Где игрок (по серверу). Если ещё не летал — у улья.
create or replace function admin_where(p_token uuid, p_nick text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t text; u users;
begin
  perform _admin(p_token);
  t := _find_nick(p_nick);
  select * into u from users where nickname = t;
  return jsonb_build_object('nick', t, 'x', coalesce(u.pos_x, 1000000), 'y', coalesce(u.pos_y, 1000000));
end $$;

-- Телепорт игрока (или себя, если ник пустой) в точку мира.
create or replace function admin_teleport(p_token uuid, p_nick text, p_x int, p_y int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a text; t text; x int; y int;
begin
  a := _admin(p_token);
  t := case when p_nick is null or trim(p_nick) = '' then a else _find_nick(p_nick) end;
  x := least(2000000, greatest(0, p_x)); y := least(2000000, greatest(0, p_y));
  update users set pos_x = x, pos_y = y, pos_at = now() where nickname = t;
  return jsonb_build_object('nick', t, 'x', x, 'y', y);
end $$;

revoke execute on function _admin(uuid) from public, anon, authenticated;
revoke execute on function _find_nick(text) from public, anon, authenticated;
grant execute on function admin_give(uuid, text, bigint, int, int) to anon, authenticated;
grant execute on function admin_where(uuid, text) to anon, authenticated;
grant execute on function admin_teleport(uuid, text, int, int) to anon, authenticated;
