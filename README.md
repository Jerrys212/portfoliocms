# portfoliocms

CMS en Strapi 5 para el contenido del portfolio (frontend en Next.js). Todo el contenido, menos la navbar, sale de aquí.

## Puesta en marcha

```bash
docker compose up -d   # Postgres 16
pnpm install
pnpm develop           # admin en http://localhost:1337/admin
pnpm seed              # carga o actualiza todo el contenido
```

Las variables de conexión están en `.env` (`DATABASE_*`).

## Modelo de contenido

| Tipo | Kind | Draft & Publish | Campo único |
| --- | --- | --- | --- |
| `global` | single | no | — |
| `home-page` | single | no | — |
| `experience` | collection | sí | `company` |
| `stack-group` | collection | sí | `title` |
| `service` | collection | sí | `title` |
| `project` | collection | sí | `title` |

Componentes: `shared.section-header`, `shared.link`, `shared.tag`, `shared.highlight`, `shared.paragraph`, `shared.seo`, `sections.hero`, `sections.about`, `sections.services`, `sections.contact`.

Los schemas viven como archivos en `src/api/*/content-types/*/schema.json` y `src/components/**`; los cambios al modelo se hacen ahí, no desde el Content-Type Builder.

`experience.endDate` en `null` significa "Actualidad". El estado de un proyecto es `projectStatus` (`coming-soon` | `live`), porque `status` está reservado en tipos con Draft & Publish.

## Acceso de lectura

- El rol **Public** no tiene permisos: cualquier petición sin token responde `403`.
- Al arrancar, `bootstrap` (`src/index.ts`) crea el API token **`portfolio-read`** si no existe. Es de tipo `custom`, sin caducidad, con `find` en `global` y `home-page`, y `find`/`findOne` en las cuatro colecciones.
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
| `GET /api/global` | `populate=*` |
| `GET /api/home-page` | `populate[hero][populate]=*&populate[about][populate]=*&populate[services][populate]=*&populate[contact][populate]=*&populate[stack]=true&populate[experience]=true&populate[projects]=true` |
| `GET /api/experiences` | `sort=order:asc` |
| `GET /api/stack-groups` | `sort=order:asc&populate[primary]=true&populate[secondary]=true` |
| `GET /api/services` | `sort=order:asc` |
| `GET /api/projects` | `sort=order:asc&populate[tags]=true&populate[image]=true` |
| `GET /api/projects/:documentId` | `populate[tags]=true&populate[image]=true` |

Las colecciones responden solo documentos publicados. Las URLs de media (`url`) son relativas: se les antepone el origen de Strapi.

## Seeder

```bash
pnpm seed
```

`scripts/seed.ts` levanta Strapi sin servidor HTTP, carga `scripts/seed-data.json` y cierra:

1. Sube los 8 archivos a la Media Library desde `C:\Users\gmgx2\Documents\personalprojects\portfolio\public` (se puede cambiar con `SEED_ASSETS_DIR`). Si ya existe un archivo con el mismo nombre, lo reutiliza.
2. Crea o actualiza `global` y `home-page`.
3. Hace upsert de cada colección por su campo único y publica cada documento.

Es idempotente: correrlo N veces deja el mismo resultado, sin duplicados. Si algo falla, sale con código 1 e indica en qué paso falló.

Para cambiar el contenido base, edita `scripts/seed-data.json` y vuelve a correr `pnpm seed`. Ojo: cualquier edición hecha desde el admin a esos mismos documentos se sobrescribe.
