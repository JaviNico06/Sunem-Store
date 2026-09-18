# Verificación de la entrega

Revisión: 17 de septiembre de 2026.

## Comprobado en este entorno

- Compilación TypeScript y producción Vite completadas.
- Nueve pruebas automáticas aprobadas: creación transaccional; privacidad de borradores/costos/historial; denegación a cuentas sin permisos; rollback ante códigos duplicados; publicación y permisos de imágenes; rechazo de ediciones obsoletas; movimiento idempotente y stock no negativo; portada y retiro de acceso público; validación del origen HTTPS de Electron.
- SQL ejecutado en PostgreSQL embebido PGlite, con roles anon/authenticated y esquemas auth/storage de prueba.
- Prueba de interfaz de catálogo aprobada: categorías, búsqueda por código, disponibilidad, modal y ancho móvil sin desbordamiento.
- Prueba de panel aprobada: crear, buscar, editar, subir foto de muestra, registrar salida y consultar movimiento.
- Revisión visual de capturas de catálogo y panel a 1440 px y catálogo a 390 px.
- Las dos pruebas de navegador se ejecutaron individualmente con Chromium local, por una limitación del navegador disponible al reutilizar contextos. El workflow usa la instalación estándar de Playwright.

## Pendiente en las cuentas y equipos del propietario

- Ejecutar el SQL en un proyecto Supabase real, crear la cuenta administradora y comprobar correo/recuperación.
- Verificar contra el servicio real la subida, firma y descarga de fotos, y la actualización desde dos computadoras.
- Publicar en la cuenta Vercel y verificar las rutas, variables y encabezados.
- Ejecutar GitHub Actions con la URL final; probar instalador/portable en Windows x64 y, si se requiere, firmarlos.
- Probar restauración de respaldos de PostgreSQL e imágenes.

No se creó un repositorio remoto, proyecto Supabase ni despliegue Vercel. No se generó un ejecutable Windows en este entorno. La entrega es código fuente, configuración, pruebas, documentación y capturas; no una instancia ya operativa con los datos del negocio.
