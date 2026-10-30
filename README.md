# portfoliocms

CMS headless en Strapi 5 para el contenido de mi portfolio personal, cuyo frontend está hecho en Next.js. Sigue la estructura de la plantilla `dark-minimal-next` y es bilingüe (`es` / `en`): hero, "¿Qué hago?", tecnologías, experiencia, proyectos y contacto. Los textos de interfaz se quedan en el frontend. El frontend lo lee por la API REST con un token de solo lectura.

## Stack

- [Strapi 5](https://strapi.io) con TypeScript
- PostgreSQL 16
- pnpm 11 y Node.js 22
- Docker para la base de datos en desarrollo y para el despliegue en producción

## Estructura

```
config/                 configuración de Strapi (servidor, base de datos, admin, plugins)
src/api/*/              content types: schema, controllers, routes y services
src/components/         componentes compartidos (shared.*) y secciones de la home (sections.*)
src/index.ts            bootstrap: crea el token de lectura portfolio-read
scripts/seed.ts         seeder idempotente del contenido
scripts/seed-data.json  contenido base que carga el seeder
FRONTEND_API.md         contrato de la API para el frontend
Dockerfile              imagen de producción
docker-compose.yml      Postgres para desarrollo
docker-compose.prod.yml Strapi + Postgres para producción
```

## Desarrollo local

### Requisitos

- Node.js 22
- pnpm 11 (`npm install -g pnpm@11`)
- Docker con Docker Compose

### Pasos

1. Clona el repo e instala las dependencias:

   ```bash
   git clone https://github.com/Jerrys212/portfoliocms.git
   cd portfoliocms
   pnpm install
   ```

2. Crea el `.env` a partir del ejemplo:

   ```bash
   cp .env.example .env
   ```

   Sustituye cada `tobemodified` por un valor aleatorio. Este comando genera uno; ejecútalo una vez por secreto (`APP_KEYS` lleva dos valores separados por coma):

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   Los `DATABASE_*` del ejemplo ya coinciden con el Postgres de `docker-compose.yml`.

3. Levanta Postgres:

   ```bash
   docker compose up -d
   ```

4. Arranca Strapi en modo desarrollo:

   ```bash
   pnpm develop
   ```

   Abre http://localhost:1337/admin y crea el usuario administrador. En la consola aparece, una sola vez, el token `portfolio-read` (ver [Acceso de lectura](#acceso-de-lectura)).

5. Carga el contenido base (opcional, ver [Seeder](#seeder)):

   ```bash
   SEED_ASSETS_DIR=/ruta/al/portfolio/public pnpm seed
   ```

### Scripts

| Script | Qué hace |
| --- | --- |
| `pnpm develop` | Strapi en modo desarrollo con recarga automática |
| `pnpm build` | Compila el servidor y el panel de admin a `dist/` |
| `pnpm start` | Arranca la build de producción |
| `pnpm seed` | Carga o actualiza el contenido desde `scripts/seed-data.json` |

### Variables de entorno

| Variable | Descripción |
| --- | --- |
| `HOST`, `PORT` | Dónde escucha Strapi (por defecto `0.0.0.0:1337`) |
| `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `ENCRYPTION_KEY` | Secretos de Strapi. Cada entorno usa los suyos. Si cambias `ENCRYPTION_KEY`, los tokens ya creados dejan de poder verse en el admin |
| `DATABASE_CLIENT` | `postgres` |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_SSL` | Conexión a Postgres |
| `IS_PROXIED` | `true` cuando Strapi corre detrás de un reverse proxy con HTTPS |
| `SEED_ASSETS_DIR` | Carpeta de donde el seeder lee los archivos multimedia |

## Modelo de contenido

El modelo sigue la estructura de la plantilla `dark-minimal-next`. El contenido es bilingüe con el plugin i18n: locales `es` (por defecto) y `en`, que crea el bootstrap.

| Tipo | Kind | i18n | Draft & Publish | Campo único | Sección de la plantilla |
| --- | --- | --- | --- | --- | --- |
| `global` | single | sí | no | — | perfil, enlaces, CV y SEO |
| `home-page` | single | sí | no | — | hero y encabezados de sección |
| `service` | collection | sí | sí | `icon` | "¿Qué hago?" |
| `technology` | collection | no | sí | `name` | carrusel de logos |
| `experience` | collection | sí | sí | `company` | experiencia |
| `project` | collection | sí | sí | `title` | proyectos |

Componentes: `shared.section-header`, `shared.tag`, `shared.paragraph`, `shared.seo`, `sections.hero`, `sections.contact`.

Los schemas viven como archivos en `src/api/*/content-types/*/schema.json` y `src/components/**`; los cambios al modelo se hacen ahí, no desde el Content-Type Builder. Cada atributo declara si se localiza (`pluginOptions.i18n.localized`): los textos sí; URLs, fechas, tags, orden e imágenes no, y Strapi los sincroniza entre idiomas.

`experience.endDate` en `null` significa "Actualidad". Los textos de interfaz (navbar, formulario, botones, pie de página) no viven aquí, sino en el diccionario del frontend.

## Acceso de lectura

- El rol **Public** no tiene permisos: cualquier petición sin token responde `403`.
- Al arrancar, `bootstrap` (`src/index.ts`) crea el API token **`portfolio-read`** si no existe, y si ya existe le sincroniza los permisos. Es de tipo `custom`, sin caducidad, con `find` en `global` y `home-page`, y `find`/`findOne` en las cuatro colecciones.
- La primera vez que se crea, el token se imprime **una sola vez** en la consola de Strapi. Guárdalo como `STRAPI_API_TOKEN` en las variables de entorno de servidor del frontend (nunca con prefijo `NEXT_PUBLIC_`).
- Si se pierde: como `ENCRYPTION_KEY` está configurado, se puede ver de nuevo en **Settings → API Tokens → portfolio-read**. También se puede regenerar ahí, lo que invalida el anterior.

Todas las peticiones llevan el header:

```
Authorization: Bearer <STRAPI_API_TOKEN>
```

## Endpoints y `populate`

Strapi 5 no popula relaciones, media ni componentes por defecto.

| Endpoint | Query |
| --- | --- |
| `GET /api/global` | `locale=…&populate=*` |
| `GET /api/home-page` | `locale=…&populate[hero]=true&populate[skills]=true&populate[experience]=true&populate[projects]=true&populate[contact][populate]=*` |
| `GET /api/services` | `locale=…&sort=order:asc&populate=items` |
| `GET /api/technologies` | `sort=order:asc&populate=icon&pagination[pageSize]=100` |
| `GET /api/experiences` | `locale=…&sort=order:asc&populate=tags` |
| `GET /api/projects` | `locale=…&sort=order:asc&populate=image` |

`locale` es `es` o `en`; sin él, Strapi devuelve `es`. Las colecciones responden solo documentos publicados. Las URLs de media (`url`) son relativas: se les antepone el origen de Strapi. El contrato completo está en [FRONTEND_API.md](FRONTEND_API.md).

## Seeder

```bash
pnpm seed
```

`scripts/seed.ts` levanta Strapi sin servidor HTTP, carga `scripts/seed-data.json` y cierra:

1. Sube los 22 archivos a la Media Library desde `C:\Users\gmgx2\Documents\personalprojects\dark-minimal-next\public` (se puede cambiar con `SEED_ASSETS_DIR`). Si ya existe un archivo con el mismo nombre, lo reutiliza.
2. Crea o actualiza `global` y `home-page` en `es` y `en`.
3. Hace upsert de cada colección por su campo único, en ambos idiomas, y publica cada documento.

Es idempotente: correrlo N veces deja el mismo resultado, sin duplicados. Si algo falla, sale con código 1 e indica en qué paso falló.

Para cambiar el contenido base, edita `scripts/seed-data.json` y vuelve a correr `pnpm seed`. Ojo: cualquier edición hecha desde el admin a esos mismos documentos se sobrescribe.

La carpeta de `SEED_ASSETS_DIR` debe contener estos archivos (son los del `public/` del frontend):

```
cv-gerardo-garcia.pdf
projects/*.png   (3 capturas de proyectos)
svg/*.svg        (18 logos de tecnologías)
```

## Despliegue en producción (VPS con Docker)

`docker-compose.prod.yml` levanta Strapi y Postgres 16:

- Strapi solo escucha en `127.0.0.1:1337`, así que se publica a través de un reverse proxy.
- Postgres no expone ningún puerto hacia fuera.
- La base de datos y `public/uploads` viven en volúmenes, para que los datos se conserven al recrear los contenedores.

1. En el VPS, clona el repo y crea un `.env` a partir de `.env.example` con **secretos nuevos**, distintos de los de desarrollo, y una `DATABASE_PASSWORD` fuerte. `DATABASE_HOST`, `DATABASE_PORT` e `IS_PROXIED` los fija el compose.

2. Construye y arranca:

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

3. Copia el token de lectura de producción, que se imprime en el primer arranque:

   ```bash
   docker logs portfoliocms | grep -A3 portfolio-read
   ```

4. Pon delante un reverse proxy con HTTPS. Por ejemplo, con Caddy:

   ```
   cms.tudominio.com {
       reverse_proxy 127.0.0.1:1337
   }
   ```

5. Entra en `https://cms.tudominio.com/admin` y crea el usuario administrador.

### Pasar el contenido a producción

La base de datos de producción arranca vacía. Para enviarle el contenido local con [`strapi transfer`](https://docs.strapi.io/cms/data-management/transfer):

1. En el admin de producción, crea un token en **Settings → Transfer Tokens** con tipo *Push*.
2. Desde tu máquina, con Strapi local apuntando a la base de datos de desarrollo:

   ```bash
   pnpm strapi transfer --to https://cms.tudominio.com/admin --to-token <token>
   ```

Esto copia el contenido y los archivos multimedia, y **sobrescribe** el contenido que ya haya en producción.

### Actualizar

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```
