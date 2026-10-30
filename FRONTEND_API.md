# API de contenido para el frontend

Contrato entre este Strapi y el portfolio en Next.js (plantilla `dark-minimal-next`): qué endpoints hay, cómo pedirlos y qué forma tiene cada respuesta.

El contenido es **bilingüe (`es` / `en`)**. Lo que es texto de contenido sale de aquí; los textos de interfaz (navbar, etiquetas del formulario de contacto, botones "Código" / "Ver en vivo", "Actualidad", pie de página) se quedan en el diccionario del frontend.

## 1. Conexión

| Variable (servidor) | Desarrollo | Uso |
| --- | --- | --- |
| `STRAPI_URL` | `http://localhost:1337` | Origen de Strapi. La API cuelga de `/api` y los archivos de `/uploads`. |
| `STRAPI_API_TOKEN` | token `portfolio-read` | Token de solo lectura. |

- Todas las peticiones llevan el header `Authorization: Bearer <STRAPI_API_TOKEN>`.
- Sin token, Strapi responde `403`, porque el rol Public no tiene permisos. Las peticiones tienen que salir del servidor (Server Components, Route Handlers o Server Actions), nunca del navegador. El token no debe llevar el prefijo `NEXT_PUBLIC_`.
- El token solo puede leer (`find`/`findOne`). Cualquier escritura responde `403`.
- Dónde conseguirlo: en el admin de Strapi, en **Settings → API Tokens → portfolio-read**.

## 2. Idiomas

- Locales: `es` (por defecto) y `en`. Los crea el bootstrap al arrancar.
- Se pide el idioma con `?locale=es` o `?locale=en`. Sin `locale`, Strapi devuelve el idioma por defecto (`es`).
- Los campos **no localizados** (URLs, fechas, tags, orden, imágenes, nombres de empresa y de proyecto) son iguales en ambos idiomas: Strapi los sincroniza al editarlos en cualquiera de los dos.
- `technologies` no está localizado: se pide sin `locale`.

## 3. Formato general de respuesta (Strapi 5)

Strapi 5 devuelve los campos **planos** dentro de `data` (no hay `data.attributes`). Las colecciones devuelven `data` como array y paginación en `meta.pagination`.

Todo documento trae `id`, `documentId`, `locale` (si está localizado), `createdAt`, `updatedAt` y `publishedAt`. Usa `documentId` como identificador estable: `id` cambia al republicar y es distinto en cada idioma.

- **Nada viene populado por defecto.** Ni media ni componentes. Usa las queries exactas de la sección 5.
- **`populate` estricto.** Pedir un campo que no existe responde `400`.
- **Solo llega contenido publicado** en las colecciones. `global` y `home-page` no tienen borradores.
- **Campos opcionales vacíos** llegan como `null`.
- **Paginación.** El `pageSize` por defecto es 25. `technologies` tiene 18 entradas; si crecen, pide `pagination[pageSize]=100`.

## 4. Archivos (media)

Los campos de imagen o archivo devuelven un objeto con, entre otros, `url`, `alternativeText`, `mime`, `width` y `height` (o `null` si no hay archivo).

- **`url` es relativa.** La URL final es `STRAPI_URL + url`, por ejemplo `http://localhost:1337/uploads/react_e5183c371a.svg`. Para `next/image`, agrega el host de Strapi a `images.remotePatterns`.
- **El nombre lleva un hash** que cambia si se vuelve a subir. Usa siempre la `url` que llega.
- **`alternativeText`**: los íconos de tecnologías traen el nombre de la tecnología y las imágenes de proyecto traen el título del proyecto.

| Archivo | Dónde aparece | `mime` |
| --- | --- | --- |
| `cv-gerardo-garcia.pdf` | `global.cv` | `application/pdf` |
| `svg/*.svg` (18) | `technology.icon` | `image/svg+xml` |
| `projects/*.png` (3) | `project.image` | `image/png` |

## 5. Endpoints

| Contenido | Ruta | Query |
| --- | --- | --- |
| Datos globales y SEO | `GET /api/global` | `locale=…&populate=*` |
| Textos del home | `GET /api/home-page` | `locale=…&populate[hero]=true&populate[skills]=true&populate[experience]=true&populate[projects]=true&populate[contact][populate]=*` |
| ¿Qué hago? | `GET /api/services` | `locale=…&sort=order:asc&populate=items` |
| Carrusel de tecnologías | `GET /api/technologies` | `sort=order:asc&populate=icon&pagination[pageSize]=100` |
| Experiencia | `GET /api/experiences` | `locale=…&sort=order:asc&populate=tags` |
| Proyectos | `GET /api/projects` | `locale=…&sort=order:asc&populate=image` |

Los corchetes de `populate[...]` van tal cual en la URL; `fetch` los acepta sin codificar.

### 5.1 `GET /api/global`

```json
{
  "data": {
    "documentId": "…",
    "locale": "es",
    "name": "Gerardo García",
    "fullName": "Gerardo García Medina",
    "role": "Desarrollador Full Stack",
    "email": "gmgx21@outlook.com",
    "githubUrl": "https://github.com/Jerrys212",
    "linkedinUrl": "https://www.linkedin.com/in/gerardo-garcia-63209a239",
    "cv": { "url": "/uploads/cv_gerardo_garcia_….pdf", "mime": "application/pdf", "…": "…" },
    "seo": {
      "metaTitle": "Gerardo García | Portafolio",
      "metaDescription": "Gerardo García Medina, Desarrollador Full Stack …",
      "ogImageAlt": "Gerardo García, Desarrollador Full Stack"
    }
  },
  "meta": {}
}
```

| Campo | Tipo | Localizado | Uso en la plantilla |
| --- | --- | --- | --- |
| `name`, `fullName` | string | no | `profile.name`, `profile.fullName` |
| `role` | string | sí | `jobTitle` del JSON-LD |
| `email` | string | no | enlaces `mailto:` |
| `githubUrl`, `linkedinUrl` | string | no | íconos sociales, JSON-LD, imagen OG |
| `cv` | media \| null | no | botón "Descargar CV" |
| `seo` | `{ metaTitle, metaDescription, ogImageAlt }` \| null | sí | `dict.meta` |

### 5.2 `GET /api/home-page`

```json
{
  "data": {
    "locale": "es",
    "hero": {
      "greeting": "Hola, soy Gerardo García",
      "titleTop": "Desarrollador",
      "titleBottom": "Full Stack",
      "taglineStart": "Construyo aplicaciones web escalables y orientadas al usuario, con especial fortaleza en el desarrollo",
      "taglineHighlight": "frontend",
      "taglineEnd": "."
    },
    "skills": { "eyebrow": null, "heading": "¿Qué hago?", "description": null },
    "experience": { "eyebrow": "Trayectoria", "heading": "Experiencia", "description": null },
    "projects": { "eyebrow": "Mi trabajo", "heading": "Proyectos", "description": null },
    "contact": {
      "header": {
        "eyebrow": "Hablemos",
        "heading": "Contacto",
        "description": "¿Tienes una pregunta o un proyecto en mente? …"
      },
      "location": "México"
    }
  },
  "meta": {}
}
```

**Section header** (`skills`, `experience`, `projects`, `contact.header`): `eyebrow` (string \| null), `heading` (string, siempre viene), `description` (string \| null).

| Campo | Uso en la plantilla |
| --- | --- |
| `hero.*` | `dict.hero` (`greeting`, `titleTop`, `titleBottom`, `taglineStart`, `taglineHighlight`, `taglineEnd`). `taglineEnd` incluye su espacio inicial si lo necesita (`" development."`). |
| `skills.heading` | `dict.skills.title` |
| `experience.eyebrow` / `.heading` | `dict.experience.eyebrow` / `.title` |
| `projects.eyebrow` / `.heading` | `dict.projects.eyebrow` / `.title` |
| `contact.header.eyebrow` / `.heading` / `.description` | `dict.contact.eyebrow` / `.title` / `.intro` |
| `contact.location` | `dict.contact.location` |

### 5.3 `GET /api/services`

```json
{
  "data": [
    {
      "documentId": "…",
      "locale": "en",
      "title": "Frontend Development",
      "icon": "code",
      "order": 1,
      "items": [
        { "id": 1, "text": "Apps with Next.js, App Router and Server Components" },
        { "id": 2, "text": "Accessible interfaces with shadcn/ui and Radix UI" }
      ]
    }
  ]
}
```

| Campo | Tipo | Localizado | Nota |
| --- | --- | --- | --- |
| `title` | string | sí | nombre de la categoría |
| `icon` | `"code"` \| `"server"` \| `"rocket"` | no | único. El frontend decide el ícono: `code` → ventana (frontend), `server` → servidor (backend), `rocket` → cohete (devops) |
| `items` | `{ text }[]` | sí | viñetas, en orden |
| `order` | number | no | |

### 5.4 `GET /api/technologies`

```json
{
  "data": [
    {
      "documentId": "…",
      "name": "React",
      "order": 1,
      "icon": { "url": "/uploads/react_e5183c371a.svg", "alternativeText": "React", "mime": "image/svg+xml", "…": "…" }
    }
  ],
  "meta": { "pagination": { "total": 18, "…": "…" } }
}
```

Sin `locale`. `name` es único; `icon` siempre viene.

### 5.5 `GET /api/experiences`

```json
{
  "data": [
    {
      "documentId": "…",
      "locale": "es",
      "company": "XDEVELOP",
      "role": "Desarrollador Frontend",
      "startDate": "2026-04-01",
      "endDate": null,
      "description": "Proyectos de consultoría para distintos clientes con Next.js 16 …",
      "order": 1,
      "tags": [{ "id": 1, "name": "Next.js" }, { "id": 2, "name": "shadcn/ui" }]
    }
  ]
}
```

| Campo | Tipo | Localizado | Nota |
| --- | --- | --- | --- |
| `company` | string | no | único |
| `role`, `description` | string | sí | |
| `startDate` | `YYYY-MM-DD` | no | fecha sin hora; parsearla como fecha local para que no se recorra un día |
| `endDate` | `YYYY-MM-DD` \| null | no | **`null` = "Actualidad" / "Present"** (texto del diccionario) |
| `tags` | `{ name }[]` | no | |
| `order` | number | no | |

La plantilla muestra un `period` ya formateado ("Abr 2026 – Actualidad"). Con las fechas, el frontend lo arma con `Intl.DateTimeFormat(locale, { month: "short", year: "numeric" })`.

### 5.6 `GET /api/projects`

```json
{
  "data": [
    {
      "documentId": "…",
      "locale": "es",
      "title": "Dulce Atardecer POS",
      "subtitle": "Punto de venta · Next.js 16",
      "repoUrl": "https://github.com/Jerrys212/frontdulceatardecer",
      "liveUrl": "https://frontdulceatardecer.vercel.app",
      "order": 1,
      "image": { "url": "/uploads/frontdulceatardecer_….png", "alternativeText": "Dulce Atardecer POS", "…": "…" }
    }
  ]
}
```

| Campo | Tipo | Localizado | Nota |
| --- | --- | --- | --- |
| `title` | string | no | único |
| `subtitle` | string | sí | la línea gris bajo el título (`status` en la plantilla) |
| `image` | media | no | siempre viene |
| `repoUrl` | string | no | siempre viene |
| `liveUrl` | string \| null | no | si es `null`, la tarjeta enlaza al repo y no muestra el botón "Ver en vivo" |
| `order` | number | no | |

## 6. Errores

Todos los errores tienen la misma forma, con `data: null`:

```json
{ "data": null, "error": { "status": 403, "name": "ForbiddenError", "message": "Forbidden", "details": {} } }
```

| Status | Cuándo |
| --- | --- |
| `400` | Query inválida, por ejemplo un `populate` o `sort` sobre un campo que no existe. `details` dice cuál. |
| `401` | Token mal formado o revocado. |
| `403` | Petición sin token, o intento de escritura. |
| `404` | Un single type todavía vacío en ese `locale`. |

## 7. Cuándo cambia el contenido

- El contenido se edita desde el admin de Strapi (`STRAPI_URL/admin`), con el selector de idioma arriba a la derecha. En las colecciones, los cambios solo llegan a la API cuando se publican, y cada idioma se publica por separado.
- Strapi no avisa al frontend de los cambios. La estrategia de caché o revalidación la decide el frontend.
- El contenido inicial se carga con `pnpm seed`. Correrlo de nuevo sobrescribe con `scripts/seed-data.json` los documentos que cargó.
