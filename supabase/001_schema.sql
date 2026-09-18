-- Duna Boutique. Ejecutar UNA VEZ en un proyecto Supabase nuevo, como postgres.
begin;
create table public.admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.admin_users where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

create table public.categories (id text primary key, name text not null unique);
insert into public.categories values ('ropa','Ropa'),('perfumes','Perfumes'),('joyeria','Joyería'),('calzado','Calzado'),('gorras','Gorras');
create table public.products (
 id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name)) between 1 and 160),
 description text not null default '' check(length(description)<=5000), brand text not null default '' check(length(brand)<=100),
 category_id text not null references public.categories(id),
 gender text not null default 'Unisex' check(gender in ('Mujer','Hombre','Unisex','No aplica')),
 published boolean not null default false, revision integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.variants (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id),
 sku text not null unique check(length(trim(sku)) between 1 and 80), barcode text unique check(barcode is null or length(barcode) between 1 and 80),
 size text not null default '' check(length(size)<=80), color text not null default '' check(length(color)<=80), presentation text not null default '' check(length(presentation)<=80),
 price numeric(12,2) not null check(price>=0), stock integer not null default 0 check(stock>=0), active boolean not null default true
);
create index variants_product_idx on public.variants(product_id);
create table public.variant_costs (
 variant_id uuid primary key references public.variants(id), cost numeric(12,2) check(cost>=0)
);
create table public.photos (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id),
 path text not null unique, position integer not null default 0 check(position>=0),
 created_at timestamptz not null default now(),
 constraint photo_folder check (path like product_id::text || '/%')
);
create index photos_product_idx on public.photos(product_id);
create table public.inventory_movements (
 id uuid primary key default gen_random_uuid(), variant_id uuid not null references public.variants(id),
 delta integer not null check(delta<>0), reason text not null check(length(trim(reason)) between 1 and 500),
 actor uuid not null references auth.users(id), request_id uuid not null unique,
 created_at timestamptz not null default now()
);
create index inventory_variant_idx on public.inventory_movements(variant_id,created_at desc);

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.variants enable row level security;
alter table public.variant_costs enable row level security;
alter table public.photos enable row level security;
alter table public.inventory_movements enable row level security;
revoke all on public.categories, public.products, public.variants, public.variant_costs, public.photos, public.inventory_movements from anon, authenticated;
grant select on public.categories, public.products, public.variants, public.photos to anon, authenticated;
grant select on public.variant_costs, public.inventory_movements to authenticated;
grant insert, update, delete on public.photos to authenticated;
create policy categories_read on public.categories for select using (true);
create policy products_read on public.products for select using (published or public.is_admin());
create policy variants_read on public.variants for select using (public.is_admin() or (active and exists(select 1 from public.products p where p.id=product_id and p.published)));
create policy costs_read on public.variant_costs for select to authenticated using(public.is_admin());
create policy photos_read on public.photos for select using (public.is_admin() or exists(select 1 from public.products p where p.id=product_id and p.published));
create policy photos_admin on public.photos for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy movements_read on public.inventory_movements for select to authenticated using(public.is_admin());

-- Edición atómica, protección ante ediciones simultáneas, sin sobreescribir stock existente.
create function public.save_product(payload jsonb, expected_revision integer default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare pid uuid; vid uuid; item jsonb; current_revision integer; fresh boolean; initial_stock integer;
begin
 if not public.is_admin() then raise exception 'No autorizado' using errcode='42501'; end if;
 if jsonb_typeof(payload->'variants') is distinct from 'array' then raise exception 'Faltan variantes'; end if;
 if jsonb_array_length(payload->'variants') < 1 or jsonb_array_length(payload->'variants') > 100 then raise exception 'Usa entre 1 y 100 variantes'; end if;
 pid := nullif(payload->>'id','')::uuid;
 if pid is null then
  insert into public.products(name, description,brand,category_id,gender,published)
  values(trim(payload->>'name'),coalesce(payload->>'description',''),coalesce(payload->>'brand',''),payload->>'category_id',payload->>'gender',coalesce((payload->>'published')::boolean,false)) returning id into pid;
 else
  select revision into current_revision from public.products where id=pid for update;
  if not found then raise exception 'Producto inexistente'; end if;
  if expected_revision is null or current_revision<>expected_revision then raise exception 'El producto cambió en otra sesión. Cierra el editor, actualiza y vuelve a intentarlo.' using errcode='40001'; end if;
  update public.products set name=trim(payload->>'name'),description=coalesce(payload->>'description',''),brand=coalesce(payload->>'brand',''),category_id=payload->>'category_id',gender=payload->>'gender',published=(payload->>'published')::boolean,revision=revision+1,updated_at=now() where id=pid;
 end if;
 for item in select value from jsonb_array_elements(payload->'variants') loop
  vid := nullif(item->>'id','')::uuid;
  fresh := vid is null;
  if fresh then
   initial_stock := coalesce((item->>'stock')::integer,0);
   insert into public.variants(product_id,sku,barcode,size,color,presentation,price,stock,active)
   values(pid,trim(item->>'sku'),nullif(trim(item->>'barcode'),''),coalesce(item->>'size',''),coalesce(item->>'color',''),coalesce(item->>'presentation',''),(item->>'price')::numeric,initial_stock,coalesce((item->>'active')::boolean,true)) returning id into vid;
   if initial_stock<>0 then
    insert into public.inventory_movements(variant_id,delta,reason,actor,request_id) values(vid,initial_stock,'Existencia inicial',auth.uid(),gen_random_uuid());
   end if;
  else
   update public.variants set sku=trim(item->>'sku'),barcode=nullif(trim(item->>'barcode'),''),size=coalesce(item->>'size',''),color=coalesce(item->>'color',''),presentation=coalesce(item->>'presentation',''),price=(item->>'price')::numeric,active=coalesce((item->>'active')::boolean,true) where id=vid and product_id=pid;
   if not found then raise exception 'Variante no pertenece al producto'; end if;
  end if;
  insert into public.variant_costs(variant_id,cost) values(vid,nullif(item->>'cost','')::numeric)
   on conflict(variant_id) do update set cost=excluded.cost;
 end loop;
 return pid;
end $$;

-- Bloqueo consistente producto -> variante; request_id evita duplicados al reintentar.
create function public.adjust_stock(variant uuid, change integer, note text, request uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare pid uuid; remaining integer; existing public.inventory_movements%rowtype;
begin
 if not public.is_admin() then raise exception 'No autorizado' using errcode='42501'; end if;
 if change is null or change=0 or request is null or note is null or length(trim(note)) not between 1 and 500 then raise exception 'Movimiento inválido'; end if;
 select product_id into pid from public.variants where id=variant;
 if not found then raise exception 'Variante inexistente'; end if;
 perform 1 from public.products where id=pid for update;
 select * into existing from public.inventory_movements where request_id=request;
 if found then
  if existing.variant_id<>variant or existing.delta<>change or existing.reason<>trim(note) then raise exception 'Identificador de movimiento ya utilizado'; end if;
  return (select stock from public.variants where id=variant);
 end if;
 update public.variants set stock=stock+change where id=variant and stock+change>=0 returning stock into remaining;
 if not found then raise exception 'No hay suficientes existencias'; end if;
 insert into public.inventory_movements(variant_id,delta,reason,actor,request_id) values(variant,change,trim(note),auth.uid(),request);
 update public.products set revision=revision+1,updated_at=now() where id=pid;
 return remaining;
end $$;
revoke all on function public.save_product(jsonb,integer), public.adjust_stock(uuid,integer,text,uuid) from public;
grant execute on function public.save_product(jsonb,integer), public.adjust_stock(uuid,integer,text,uuid) to authenticated;

-- Bucket privado: las fotos de borradores tampoco se pueden leer por URL pública.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-photos','product-photos',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy boutique_images_read on storage.objects for select to anon, authenticated using (
 bucket_id='product-photos' and (public.is_admin() or exists(
  select 1 from public.photos ph join public.products p on p.id=ph.product_id where ph.path=storage.objects.name and p.published
 ))
);
create policy boutique_images_insert on storage.objects for insert to authenticated with check(bucket_id='product-photos' and public.is_admin());
create policy boutique_images_delete on storage.objects for delete to authenticated using(bucket_id='product-photos' and public.is_admin());
-- Fotos mediante URLs firmadas de 5 minutos. Una URL ya emitida caduca tras ocultar un producto.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.products, public.variants, public.photos;
 end if;
end $$;

-- Cambio de portada en una sola transacción.
create function public.set_cover_photo(photo_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 if not public.is_admin() then raise exception 'No autorizado' using errcode='42501'; end if;
 select product_id into pid from public.photos where id=photo_id;
 if not found then raise exception 'Foto inexistente'; end if;
 perform 1 from public.products where id=pid for update;
 update public.photos set position=position+1 where product_id=pid;
 update public.photos set position=0 where id=photo_id;
end $$;
revoke all on function public.set_cover_photo(uuid) from public;
grant execute on function public.set_cover_photo(uuid) to authenticated;

commit;
