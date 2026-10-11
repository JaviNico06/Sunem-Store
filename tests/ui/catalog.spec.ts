import { test, expect } from "@playwright/test";
test("Catálogo filtra, abre detalle y funciona en móvil", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".promotion-panel")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ver Blusa Alba", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Joyería", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Ver Arracadas Aura", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Toda la colección" }).click();
  await page.getByLabel("Buscar productos").fill("000100001");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.getByLabel("Buscar productos").fill("");
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page.getByLabel("Solo disponibles").check();
  await expect(page.locator(".product-card")).toHaveCount(5);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Tu estilo. Tu esencia." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test("Publicidad rota desaparece sin dejar columna vacía", async ({ page }) => {
  await page.route("**/demo/blouse.png", (route) => route.abort());
  await page.route("**/demo/earrings.png", (route) => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?promotions");
  await expect(page.locator(".promotion-panel:visible")).toHaveCount(1);
  await expect(page.locator(".catalog-layout")).toHaveClass(/promotion-right-only/);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});
test("Panel crea, edita, sube foto y registra inventario", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Agregar producto" }).click();
  await page.getByLabel("Nombre del producto").fill("Gorra de prueba");
  await page
    .getByRole("combobox", { name: "Categoría", exact: true })
    .selectOption("gorras");
  await page.getByLabel("Código de barras").fill("000TEST001");
  await page.getByLabel("Precio de venta (MXN)").fill("250");
  await page.getByLabel("Existencias iniciales").fill("3");
  await page.getByLabel("Mostrar en el catálogo").check();
  await page.getByRole("button", { name: "Guardar producto" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Buscar inventario").fill("000TEST001");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Editar Gorra de prueba", exact: true })
    .click();
  await page
    .locator("input[type=file]")
    .setInputFiles("public/demo/earrings.png");
  await expect(
    page.getByText("1 fotos guardadas en la demostración."),
  ).toBeVisible();
  await page.getByLabel("Nombre del producto").fill("Gorra editada");
  await page.getByRole("button", { name: "Guardar producto" }).click();
  await page
    .getByRole("button", { name: "Ajustar inventario de Gorra editada" })
    .click();
  await page
    .getByRole("combobox", { name: "Movimiento", exact: true })
    .selectOption("out");
  await page.getByLabel("Cantidad", { exact: true }).fill("2");
  await page.getByLabel("Motivo").fill("Venta de prueba");
  await page.getByRole("button", { name: "Registrar movimiento" }).click();
  await expect(page.getByText("1 piezas", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Movimientos", exact: true }).click();
  await expect(page.getByText("Venta de prueba")).toBeVisible();
});

test("Panel administra promociones y valida imágenes", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Panel izquierdo" }).click();
  await page.getByLabel("Nombre interno de la promoción").fill("Temporada nueva");
  await page
    .getByLabel("Texto alternativo para accesibilidad")
    .fill("Modelo con prendas de la temporada nueva");
  await page
    .getByLabel("Subir imagen vertical")
    .setInputFiles("public/demo/blouse.png");
  await page
    .getByLabel("Subir imagen horizontal")
    .setInputFiles("public/demo/earrings.png");
  await expect(page.getByText(/se recomiendan 600 × 1800 px/)).toBeVisible();
  await expect(page.getByText(/se recomiendan 1200 × 600 px/)).toBeVisible();
  await page.getByLabel("Mostrar esta promoción").check();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    page.getByText("Promoción guardada en la demostración temporal."),
  ).toBeVisible();
  await expect(page.locator(".promotion-preview img")).toHaveCount(2);
});

test("Publicidad conserva proporción y no desborda en tamaños objetivo", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?promotions");
  for (const width of [360, 390, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.locator(".promotion-panel:visible")).toHaveCount(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `desbordamiento a ${width}px`,
    ).toBeTruthy();
    const objectFits = await page
      .locator(".promotion-panel:visible img")
      .evaluateAll((images) =>
        images.map((image) => getComputedStyle(image).objectFit),
      );
    expect(objectFits).toEqual(["contain", "contain"]);
    if (width >= 1280) {
      await expect(page.locator(".promotion-desktop:visible")).toHaveCount(2);
      await expect(page.locator(".promotion-inline:visible")).toHaveCount(0);
    } else {
      await expect(page.locator(".promotion-inline:visible")).toHaveCount(2);
      await expect(page.locator(".promotion-desktop:visible")).toHaveCount(0);
    }
  }
  expect(errors).toEqual([]);
});
