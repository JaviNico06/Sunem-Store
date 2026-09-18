# Duna Boutique

Catálogo público de exhibición + panel privado conectado a la nube + aplicación Windows compilable. Diseño femenino minimalista, en español y con precios en MXN. **Duna es un nombre provisional y editable.**

## Qué incluye

- Catálogo responsive con búsqueda por nombre/código, categorías, género, disponibilidad, orden por precio y ficha con galería.
- Panel `/admin`: inicio de sesión, recuperación de contraseña, alta/edición de productos, publicación/borradores, tallas/colores/presentaciones, códigos internos y de barras, fotografías, portada, costo privado, entradas/salidas e historial.
- Base PostgreSQL en Supabase, autenticación y almacenamiento privado de imágenes.
- Variantes con códigos únicos, stock no negativo, operaciones atómicas y detección de edición simultánea.
- Aplicación Electron para Windows: instalador y ejecutable portable. Abre el panel alojado en tu propia URL.
- Archivos para Vercel y workflows de GitHub para verificar código y generar los `.exe`.

No incluye carrito, pagos, pedidos ni facturación: el catálogo solo muestra productos. Se requiere internet para ver y administrar datos reales. No hay sincronización offline ni base de datos independiente dentro del ejecutable.

## 1. Ver el diseño sin configurar cuentas

Instala Node.js 22.12 o posterior (LTS), abre esta carpeta en VS Code y ejecuta:

```bash
npm ci
npm run dev:demo
```

Abre `http://localhost:5173` para el catálogo y `http://localhost:5173/admin` para el panel.

**La demo usa productos e imágenes ficticios y guarda cambios solamente en memoria. Al recargar se reinicia. No es tu inventario real.** No uses el modo demo para trabajar ni lo actives en la publicación final.

## 2. Crear la base de datos real en Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/dashboard). Guarda su contraseña de base de datos en tu gestor de contraseñas; la app no la necesita.
2. Abre **SQL Editor**, crea una consulta, pega el contenido completo de `supabase/001_schema.sql` y ejecútalo una sola vez en el proyecto nuevo. Crea tablas, funciones, permisos y el bucket `product-photos`. Si falla, revisa el error: el script usa una transacción para evitar una instalación parcial.
3. En **Authentication → Users**, crea el usuario administrador con correo real y contraseña robusta. Confirma su correo desde el panel si la creación no lo confirma automáticamente. No se incluye ningún usuario o contraseña predeterminada.
4. Copia `supabase/002_admin.example.sql`, cambia el correo por el de ese usuario y ejecútalo. Dar de alta una cuenta en Authentication no le da permisos de administrador hasta completar este paso.
5. En la configuración de Authentication, desactiva el registro público. El sitio no tiene pantalla para que cualquiera se registre; esta configuración también lo bloquea en la API.
6. En **Project Settings / Connect / API Keys** (el nombre de la sección puede variar), copia la URL del proyecto y la clave **publishable**. También funciona la clave heredada **anon**. **Nunca uses `service_role`, una clave secret ni la contraseña de PostgreSQL en el frontend.**
7. En tu computadora copia `.env.example` a `.env.local` y reemplaza los valores:

```dotenv
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu-clave-publicable
VITE_BRAND_NAME=Duna
VITE_DEMO_MODE=false
```

8. Reinicia el servidor con `npm run dev` y abre `/admin`. Ingresa con la cuenta creada. El catálogo real inicia vacío.

La clave publicable forma parte del código que recibe el navegador; es normal. La seguridad depende de las políticas RLS y los permisos de las funciones incluidos en el SQL. No los desactives.

## 3. Subir a GitHub

Crea un repositorio vacío en tu cuenta y ejecuta desde la carpeta del proyecto:

```bash
git init
git add .
git commit -m "Crear catálogo y panel de Duna Boutique"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPOSITORIO.git
git push -u origin main
```

Reemplaza usuario y repositorio. `.gitignore` excluye archivos `.env.local`, dependencias y compilaciones. Se incluyen los lockfiles para instalaciones reproducibles. Si usas GitHub Desktop, agrega esta carpeta y publícala desde ahí.

## 4. Publicar en Vercel

1. En [Vercel](https://vercel.com/new), importa el repositorio.
2. Selecciona **Vite**, la carpeta raíz que contiene `package.json`, `npm run build` como Build Command y `dist` como Output Directory. `vercel.json` ya contiene estos valores y la reescritura de `/admin`.
3. En Environment Variables agrega las cuatro variables de `.env.example` con tus valores reales. `VITE_DEMO_MODE` debe ser `false`. Actívalas en Production y, si quieres probar ramas, en Preview.
4. Publica. Copia la URL HTTPS del sitio.
5. En Supabase → Authentication → URL Configuration, agrega la URL del catálogo como **Site URL**, y `https://TU-DOMINIO/admin` como URL de redirección permitida. Para pruebas locales puedes agregar `http://localhost:5173/admin`.
6. Para recuperación de contraseña confiable, configura tu proveedor SMTP en Supabase y prueba el envío a la cuenta administradora. No dependas del correo de prueba del proveedor para operar el negocio.
7. Abre el catálogo en una ventana privada y `/admin` en otra. Crea una pieza de prueba y comprueba que solo aparece públicamente cuando la publicas.

Si cambias variables, vuelve a desplegar: Vite las incorpora durante la compilación. Si usas dominio Supabase personalizado, ajusta los dominios permitidos en Content-Security-Policy de `vercel.json`.

## 5. Generar el `.exe` desde GitHub — opción más sencilla

Una vez publicado el catálogo real:

1. Abre el repositorio en GitHub → **Actions**.
2. Selecciona **Generar aplicación Windows** → **Run workflow**.
3. En `site_url`, escribe la URL HTTPS del catálogo, por ejemplo `https://tu-boutique.vercel.app`, sin `/admin` ni parámetros.
4. Ejecuta el workflow y espera a que termine correctamente.
5. Abre la ejecución y descarga el artifact **Duna-Boutique-Windows**. Descomprime el ZIP: contendrá un instalador `...setup.exe` y una versión `...portable.exe`.
6. Instala en las computadoras que quieras, o copia el portable a una memoria USB. En cada computadora entra con una cuenta autorizada.

El ejecutable queda configurado con tu URL y muestra el panel actualizado desde Vercel. Los cambios publicados en el panel web se reflejan al recargar la aplicación. Si cambias de dominio, genera de nuevo el `.exe` con la nueva URL.

**Este proyecto entrega el código y la configuración para compilar; no incluye un `.exe` ya compilado ni firmado.** El workflow debe ejecutarse en tu repositorio con la URL real. GitHub conserva el artifact 14 días; descarga y conserva tus instaladores. Sin firma de código, Windows puede mostrar advertencias de editor desconocido. Para distribución con identidad verificada necesitas firmar con tu propio certificado.

### Compilar directamente en Windows

Edita `desktop/config.json` con la URL final. En una terminal dentro de `desktop`:

```powershell
npm ci
npm start
npm run dist:win
```

Los ejecutables aparecerán en `desktop/release`. Los equipos que los usan no necesitan Node.js. Se genera Windows x64. No se ha probado en una sesión real de Windows en esta entrega.

## 6. Uso diario

1. **Agregar producto**: captura nombre, categoría, género, descripción, marca opcional y variantes.
2. Cada variante tiene código interno único, código de barras opcional, talla/color/presentación, precio, costo privado y existencia inicial. Para un artículo sin variantes, deja talla/color/presentación vacíos: se mostrará “Única”.
3. Guarda el producto. Ábrelo con el lápiz y sube sus fotos. Puedes elegir portada y eliminar imágenes. Las fotos se guardan inmediatamente; cerrar el formulario no revierte esos cambios.
4. Activa **Mostrar en el catálogo** cuando esté listo. Desactívalo para ocultarlo; no se borra su historial.
5. Para entradas y salidas, usa el icono de flechas en la tabla. Selecciona variante, cantidad y motivo. El sistema evita stock negativo y registra el movimiento.
6. Un lector de códigos USB configurado como teclado puede escribir en el buscador o en el campo Código de barras. El código se almacena como texto; conserva ceros iniciales. No se incluye escaneo por cámara ni consulta automática de productos externos.
7. Consulta **Movimientos** para los últimos 100 registros. Los anteriores permanecen en la base de datos.

Los datos se vuelven a consultar cada 30 segundos y al regresar a la ventana. El catálogo también escucha eventos Realtime. Si el servicio interrumpe Realtime, continúa la consulta periódica. Usa Actualizar para consultar inmediatamente. Si otro usuario modificó el producto, la edición obsoleta será rechazada: cierra el editor, actualiza y vuelve a abrirlo.

Para usar cuentas separadas, crea cada usuario en Authentication y repite el alta administrativa. Para revocar acceso, elimina su fila de `admin_users` desde SQL Editor. No hay niveles de cajero/supervisor en esta primera versión: todos los administradores autorizados pueden gestionar el inventario.

## 7. Personalizar la identidad

- Nombre: `VITE_BRAND_NAME` en `.env.local` y Vercel.
- Título y descripción para buscadores: `index.html`.
- Paleta, tipografías y espaciado: `src/styles.css` (variables al inicio).
- Logo simple: `public/favicon.svg` y, si lo deseas, `desktop/icon.ico`.
- Nombre del ejecutable/instalador: `desktop/package.json`, `desktop/main.cjs` y el workflow.
- Fotos reales: desde el panel. No reemplaces el código para subir mercancía.

`public/demo` contiene tres imágenes originales generadas para esta muestra. No representan marcas ni inventario real. Se usan exclusivamente cuando habilitas el modo demo.

## 8. Estructura del código

| Archivo / carpeta                | Propósito                                                |
| -------------------------------- | -------------------------------------------------------- |
| `src/App.tsx`                    | Catálogo, filtros y ficha de producto                    |
| `src/Admin.tsx`                  | Autenticación, inventario, editor, fotos y movimientos   |
| `src/api.ts`                     | Conexión Supabase y adaptador de demo temporal           |
| `src/types.ts`                   | Tipos de producto, variante, fotografía y utilidades     |
| `src/styles.css`                 | Diseño responsive                                        |
| `supabase/001_schema.sql`        | Instalación transaccional de la base de datos y permisos |
| `supabase/002_admin.example.sql` | Alta explícita de administradores                        |
| `desktop/`                       | Contenedor Electron y configuración Windows              |
| `.github/workflows/`             | Verificación y compilación Windows                       |
| `tests/`                         | Pruebas de permisos, inventario y navegación             |
| `docs/ARQUITECTURA.md`           | Modelo, seguridad y límites operativos                   |
| `docs/VALIDACION.md`             | Qué se probó y qué queda por verificar al desplegar      |

## 9. Verificaciones de desarrollo

```bash
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:ui
```

Las pruebas SQL corren sobre PostgreSQL embebido (PGlite), con los esquemas `auth` y `storage` simulados. Validan reglas reales de PostgreSQL, pero no sustituyen una prueba contra tu proyecto Supabase. Las pruebas de interfaz usan datos demo. El workflow de GitHub ejecuta estas verificaciones.

## 10. Conservación de datos y operación

El código vive en GitHub; los datos y fotos viven en tu proyecto Supabase. Borrar o cambiar de computadora no borra la nube. Eliminar el proyecto Supabase o su almacenamiento sí puede causar pérdida de datos. El `.exe` no constituye una copia de seguridad.

Configura respaldos según el plan contratado y exporta también los objetos del bucket; un respaldo SQL no equivale a respaldar las imágenes. Antes de usarlo diariamente, verifica restauración, acceso desde dos máquinas y recuperación de contraseña. Costos, límites, pausas por inactividad y disponibilidad dependen de tus proveedores; revisa sus planes vigentes.

Documentación oficial consultada: [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite), [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [permisos de Storage](https://supabase.com/docs/guides/storage/security/access-control), [autenticación por contraseña](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [seguridad de Electron](https://www.electronjs.org/docs/latest/tutorial/security).
