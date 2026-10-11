-- Paneles publicitarios administrables. Ejecutar UNA VEZ después de 001_schema.sql.
-- No modifica ni elimina productos, fotografías, usuarios o inventario existentes.
begin;

create table public.promotion_configs (
  slot text primary key check (slot in ('left', 'right')),
  name text not null default '' check (length(name) <= 160),
  alt_text text not null default '' check (length(alt_text) <= 500),
  vertical_path text unique,
  horizontal_path text unique,
  active boolean not null default false,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint promotion_active_image check (not active or vertical_path is not null),
  constraint promotion_active_alt check (not active or length(trim(alt_text)) > 0),
  constraint promotion_vertical_folder check (
    vertical_path is null or vertical_path like slot || '/vertical-%'
  ),
  constraint promotion_horizontal_folder check (
    horizontal_path is null or horizontal_path like slot || '/horizontal-%'
  )
);

insert into public.promotion_configs(slot) values ('left'), ('right');

alter table public.promotion_configs enable row level security;
revoke all on public.promotion_configs from anon, authenticated;
grant select on public.promotion_configs to authenticated;

create policy promotion_configs_read on public.promotion_configs
for select to authenticated using (public.is_admin());

-- La consulta pública no expone nombre interno, revisión ni fechas.
create function public.list_active_promotions()
returns table (
  slot text,
  alt_text text,
  vertical_path text,
  horizontal_path text,
  active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select promotion.slot,
         promotion.alt_text,
         promotion.vertical_path,
         promotion.horizontal_path,
         promotion.active
  from public.promotion_configs promotion
  where promotion.active;
$$;

create function public.promotion_image_visible(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.promotion_configs promotion
    where promotion.active
      and (promotion.vertical_path = p_path or promotion.horizontal_path = p_path)
  );
$$;

revoke all on function public.list_active_promotions(), public.promotion_image_visible(text) from public;
grant execute on function public.list_active_promotions(), public.promotion_image_visible(text) to anon, authenticated;

create function public.save_promotion(
  p_slot text,
  p_name text,
  p_alt_text text,
  p_active boolean,
  p_vertical_path text,
  p_horizontal_path text,
  p_expected_revision integer
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare current_revision integer;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_slot not in ('left', 'right') then
    raise exception 'Panel inválido';
  end if;
  if length(coalesce(p_name, '')) > 160 or length(coalesce(p_alt_text, '')) > 500 then
    raise exception 'Los textos de la promoción son demasiado largos';
  end if;
  if coalesce(p_active, false) and p_vertical_path is null then
    raise exception 'Agrega una imagen vertical antes de activar el panel';
  end if;
  if coalesce(p_active, false) and length(trim(coalesce(p_alt_text, ''))) = 0 then
    raise exception 'Agrega texto alternativo antes de activar el panel';
  end if;
  if p_vertical_path is not null and p_vertical_path not like p_slot || '/vertical-%' then
    raise exception 'Ruta de imagen vertical inválida';
  end if;
  if p_horizontal_path is not null and p_horizontal_path not like p_slot || '/horizontal-%' then
    raise exception 'Ruta de imagen horizontal inválida';
  end if;
  if p_vertical_path is not null and not exists (
    select 1 from storage.objects object
    where object.bucket_id = 'promotion-images' and object.name = p_vertical_path
  ) then
    raise exception 'La imagen vertical no está disponible en la nube';
  end if;
  if p_horizontal_path is not null and not exists (
    select 1 from storage.objects object
    where object.bucket_id = 'promotion-images' and object.name = p_horizontal_path
  ) then
    raise exception 'La imagen horizontal no está disponible en la nube';
  end if;

  select revision into current_revision
  from public.promotion_configs
  where slot = p_slot
  for update;

  if not found then raise exception 'Panel inexistente'; end if;
  if p_expected_revision is null or current_revision <> p_expected_revision then
    raise exception 'La promoción cambió en otra sesión. Actualiza y vuelve a intentarlo.' using errcode = '40001';
  end if;

  update public.promotion_configs
  set name = trim(coalesce(p_name, '')),
      alt_text = trim(coalesce(p_alt_text, '')),
      active = coalesce(p_active, false),
      vertical_path = p_vertical_path,
      horizontal_path = p_horizontal_path,
      revision = revision + 1,
      updated_at = now()
  where slot = p_slot
  returning revision into current_revision;

  return current_revision;
end;
$$;

revoke all on function public.save_promotion(text,text,text,boolean,text,text,integer) from public;
grant execute on function public.save_promotion(text,text,text,boolean,text,text,integer) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values(
  'promotion-images',
  'promotion-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
);

create policy promotion_images_read on storage.objects
for select to anon, authenticated using (
  bucket_id = 'promotion-images' and (
    public.is_admin() or public.promotion_image_visible(storage.objects.name)
  )
);

create policy promotion_images_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'promotion-images'
  and public.is_admin()
  and split_part(name, '/', 1) in ('left', 'right')
);

create policy promotion_images_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'promotion-images' and public.is_admin()
);

commit;
