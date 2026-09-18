import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const ADMIN = "11111111-1111-4111-8111-111111111111",
  OTHER = "22222222-2222-4222-8222-222222222222";
const database = new PGlite();
await database.exec(`
 create role anon; create role authenticated;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema public,storage,auth to anon,authenticated;
 grant select on storage.objects to anon;
 grant select,insert,delete on storage.objects to authenticated;
 insert into auth.users values('${ADMIN}'),('${OTHER}');
`);
await database.exec(
  await readFile(
    new URL("../supabase/001_schema.sql", import.meta.url),
    "utf8",
  ),
);
await database.exec(
  `insert into public.admin_users(user_id) values('${ADMIN}');`,
);
async function as(role, id, fn) {
  await database.exec(
    `set role ${role}; select set_config('request.jwt.claim.sub','${id || ""}',false);`,
  );
  try {
    return await fn();
  } finally {
    await database.exec("reset role;");
  }
}
const make = (extra = {}) => ({
  name: "Blusa",
  description: "Lino",
  brand: "Duna",
  category_id: "ropa",
  gender: "Mujer",
  published: false,
  variants: [
    {
      sku: "ABC",
      barcode: "000123",
      size: "CH",
      color: "Marfil",
      presentation: "",
      price: 350,
      stock: 5,
      active: true,
      cost: 100,
    },
  ],
  ...extra,
});
let pid, vid;
async function save(payload, revision = null) {
  const r = await database.query(
    "select public.save_product($1::jsonb,$2::integer) id",
    [JSON.stringify(payload), revision],
  );
  return r.rows[0].id;
}
await test("Admin crea producto, variante, costo e inventario inicial atómicamente", async () => {
  pid = await as("authenticated", ADMIN, () => save(make()));
  const { rows } = await database.query(
    "select * from public.variants where product_id=$1",
    [pid],
  );
  vid = rows[0].id;
  assert.equal(rows[0].barcode, "000123");
  assert.equal(rows[0].stock, 5);
  assert.equal(
    (
      await database.query(
        "select count(*)::int n from public.inventory_movements",
      )
    ).rows[0].n,
    1,
  );
});
await test("Visitante no ve borradores, costos ni movimientos", async () => {
  await as("anon", null, async () => {
    assert.equal(
      (await database.query("select * from public.products")).rows.length,
      0,
    );
    assert.equal(
      (await database.query("select * from public.variants")).rows.length,
      0,
    );
    await assert.rejects(
      database.query("select * from public.variant_costs"),
      /permission denied/,
    );
    await assert.rejects(
      database.query("select * from public.inventory_movements"),
      /permission denied/,
    );
  });
});
await test("Cuenta sin permiso no puede escribir ni darse rol administrador", async () => {
  await as("authenticated", OTHER, async () => {
    await assert.rejects(save(make({ name: "Intruso" })), /No autorizado/);
    await assert.rejects(
      database.exec(
        `insert into public.admin_users(user_id) values('${OTHER}')`,
      ),
      /permission denied/,
    );
    await assert.rejects(
      database.exec("update public.products set name='Intruso'"),
      /permission denied/,
    );
    assert.equal(
      (await database.query("select * from public.variant_costs")).rows.length,
      0,
    );
  });
});
await test("Código duplicado provoca rollback del producto completo", async () => {
  await as("authenticated", ADMIN, () =>
    assert.rejects(save(make({ name: "Duplicado" })), /unique constraint/),
  );
  assert.equal(
    (await database.query("select count(*)::int n from public.products"))
      .rows[0].n,
    1,
  );
});
await test("Publicar muestra solo variantes activas; foto borrador protegida", async () => {
  await database.query(
    "insert into public.photos(product_id,path) values($1,$2)",
    [pid, pid + "/photo.jpg"],
  );
  await database.query(
    "insert into storage.objects(bucket_id,name) values('product-photos',$1)",
    [pid + "/photo.jpg"],
  );
  await as("anon", null, async () =>
    assert.equal(
      (await database.query("select * from storage.objects")).rows.length,
      0,
    ),
  );
  await as("authenticated", ADMIN, () =>
    save(
      make({
        id: pid,
        published: true,
        variants: [{ ...make().variants[0], id: vid, stock: 999 }],
      }),
      1,
    ),
  );
  await as("anon", null, async () => {
    assert.equal(
      (await database.query("select * from public.products")).rows.length,
      1,
    );
    assert.equal(
      (await database.query("select * from storage.objects")).rows.length,
      1,
    );
  });
  assert.equal(
    (
      await database.query("select stock from public.variants where id=$1", [
        vid,
      ])
    ).rows[0].stock,
    5,
    "Editar metadatos no sobrescribe stock",
  );
});
await test("Edición obsoleta es rechazada y no pisa cambios de otro equipo", async () => {
  await as("authenticated", ADMIN, () =>
    assert.rejects(save(make({ id: pid }), 1), /cambió en otra sesión/),
  );
});
await test("Movimiento se aplica una vez incluso al reintentar; stock negativo se rechaza", async () => {
  const request = "33333333-3333-4333-8333-333333333333";
  const move = () =>
    database.query("select public.adjust_stock($1,-2,$2,$3) stock", [
      vid,
      "Venta",
      request,
    ]);
  await as("authenticated", ADMIN, async () => {
    assert.equal((await move()).rows[0].stock, 3);
    assert.equal((await move()).rows[0].stock, 3);
    await assert.rejects(
      database.query("select public.adjust_stock($1,-10,$2,$3)", [
        vid,
        "Venta",
        "44444444-4444-4444-8444-444444444444",
      ]),
      /No hay suficientes/,
    );
  });
  assert.equal(
    (
      await database.query("select stock from public.variants where id=$1", [
        vid,
      ])
    ).rows[0].stock,
    3,
  );
  assert.equal(
    (
      await database.query(
        "select count(*)::int n from public.inventory_movements",
      )
    ).rows[0].n,
    2,
  );
});
await test("Portada atómica y ocultar producto quita acceso público a las fotos", async () => {
  const photo = (await database.query("select id from public.photos limit 1"))
    .rows[0].id;
  await as("authenticated", ADMIN, () =>
    database.query("select public.set_cover_photo($1)", [photo]),
  );
  await as("authenticated", OTHER, () =>
    assert.rejects(
      database.query("select public.set_cover_photo($1)", [photo]),
      /No autorizado/,
    ),
  );
  await as("authenticated", ADMIN, () =>
    save(
      make({
        id: pid,
        published: false,
        variants: [{ ...make().variants[0], id: vid }],
      }),
      3,
    ),
  );
  await as("anon", null, async () => {
    assert.equal(
      (await database.query("select * from public.photos")).rows.length,
      0,
    );
    assert.equal(
      (await database.query("select * from storage.objects")).rows.length,
      0,
    );
  });
});
await database.close();
