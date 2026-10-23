# API de contenido para el frontend

Contrato entre este Strapi y el portfolio en Next.js: qué endpoints hay, cómo pedirlos y qué forma tiene cada respuesta. Todo el contenido sale de aquí, menos la navbar.

Los ejemplos son respuestas reales, recortadas con `…` donde se repiten.

## 1. Conexión

| Variable (servidor) | Desarrollo | Uso |
| --- | --- | --- |
| `STRAPI_URL` | `http://localhost:1337` | Origen de Strapi. La API cuelga de `/api` y los archivos de `/uploads`. |
| `STRAPI_API_TOKEN` | token `portfolio-read` | Token de solo lectura. |

- Todas las peticiones llevan el header `Authorization: Bearer <STRAPI_API_TOKEN>`.
- Sin token, Strapi responde `403`, porque el rol Public no tiene permisos. Así que las peticiones tienen que salir del servidor (Server Components, Route Handlers o Server Actions), nunca del navegador. El token no debe llevar el prefijo `NEXT_PUBLIC_`.
- El token solo puede leer (`find`/`findOne`). Cualquier escritura responde `403`.
- Dónde conseguirlo: en el admin de Strapi, en **Settings → API Tokens → portfolio-read**.

## 2. Formato general de respuesta (Strapi 5)

Strapi 5 devuelve los campos **planos** dentro de `data`. Ya no existe el `data.attributes` de Strapi 4.

```json
{
  "data": { "...campos del documento..." },
  "meta": {}
}
```

Las colecciones devuelven `data` como array y paginación en `meta`:

```json
{
  "data": [ { "...": "..." } ],
  "meta": { "pagination": { "page": 1, "pageSize": 25, "pageCount": 1, "total": 4 } }
}
```

Todo documento trae estos campos de sistema:

| Campo | Tipo | Nota |
| --- | --- | --- |
| `id` | number | Id interno. Cambia al republicar, así que no lo uses como identificador. |
| `documentId` | string | **Identificador estable** del documento. Es el que va en las rutas `/:documentId` y sirve como `key`. |
| `createdAt` / `updatedAt` / `publishedAt` | string ISO | |

Los componentes traen además un `id` numérico propio, que no tiene significado para el frontend.

### Lo que hay que saber

- **Nada viene populado por defecto.** Ni media ni componentes. Si un campo no aparece en la respuesta, es que falta en el `populate`. Usa las queries exactas de la sección 4.
- **`populate` estricto.** Si pides un campo que no existe, Strapi responde `400` (por ejemplo, `"Invalid key bad"`).
- **Solo llega contenido publicado.** Las colecciones tienen Draft & Publish y la API únicamente devuelve lo publicado. `global` y `home-page` no tienen borradores.
- **Campos opcionales vacíos.** Llegan como `null`, no se omiten.
- **Codificación.** Los textos vienen en UTF-8 tal cual, con acentos, `—` y `&` sin escapar.

## 3. Archivos (media)

Todos los campos de imagen o archivo devuelven este objeto (o `null` si no hay archivo):

```json
{
  "id": 1,
  "documentId": "aziy4erl0drwngrz3ezzvtvu",
  "name": "hero.avif",
  "alternativeText": "Foto de Gerardo García Medina",
  "caption": null,
  "width": null,
  "height": null,
  "formats": null,
  "ext": ".avif",
  "mime": "image/avif",
  "size": 67.67,
  "url": "/uploads/hero_501089f39a.avif",
  "provider": "local",
  "…": "…"
}
```

- **`url` es relativa.** La URL final es `STRAPI_URL + url`, por ejemplo `http://localhost:1337/uploads/hero_501089f39a.avif`. Para usar `next/image`, agrega el host de Strapi a `images.remotePatterns` (en desarrollo: `http`, `localhost`, puerto `1337`, ruta `/uploads/**`).
- **El nombre del archivo lleva un hash** que cambia si se vuelve a subir. No lo hardcodees; usa siempre la `url` que llega.
- **`width` y `height` pueden venir en `null`.** Strapi no lee las dimensiones de los AVIF (la foto del hero), aunque sí las de los SVG. No dependas de ellas: define el tamaño en el frontend.
- **`formats` viene en `null`** porque no hay miniaturas generadas. Usa siempre `url`.
- **`alternativeText`.** La foto del hero trae su alt, pero el campo que manda es `photoAlt` (sección 4.2). Las ilustraciones decorativas traen `alternativeText: ""`, y las imágenes de proyecto también llegan con alt vacío.

| Archivo | Dónde aparece | `mime` |
| --- | --- | --- |
| `hero.avif` | `home-page.hero.photo` | `image/avif` |
| `cv-gerardo-garcia.pdf` | `global.cv` | `application/pdf` |
| `design-system.svg` | `home-page.about.illustration` | `image/svg+xml` |
| `problem-solving.svg` | `home-page.services.illustration` | `image/svg+xml` |
| `contact.svg` | `home-page.contact.illustration` | `image/svg+xml` |
| `documents.svg`, `interaction.svg`, `analytics.svg` | `project.image` | `image/svg+xml` |

## 4. Endpoints

Resumen. Todas las rutas van sobre `STRAPI_URL`:

| Contenido | Ruta | Query |
| --- | --- | --- |
| Datos globales y SEO | `GET /api/global` | `populate=*` |
| Secciones del home | `GET /api/home-page` | ver 4.2 |
| Experiencia | `GET /api/experiences` | `sort=order:asc` |
| Stack | `GET /api/stack-groups` | `sort=order:asc&populate[primary]=true&populate[secondary]=true` |
| Servicios | `GET /api/services` | `sort=order:asc` |
| Proyectos | `GET /api/projects` | `sort=order:asc&populate[tags]=true&populate[image]=true` |
| Un proyecto | `GET /api/projects/:documentId` | `populate[tags]=true&populate[image]=true` |

Los corchetes de `populate[...]` van tal cual en la URL; `fetch` los acepta sin codificar.

### 4.1 `GET /api/global`

```
/api/global?populate=*
```

```json
{
  "data": {
    "documentId": "orepjm1jdbaphng84tpamxqb",
    "name": "Gerardo García",
    "fullName": "Gerardo García Medina",
    "role": "Full Stack Developer",
    "email": "jerryrogers2305@gmail.com",
    "phone": "(55) 4868-0612",
    "linkedinUrl": "https://www.linkedin.com/in/gerardo-garcia-63209a239",
    "cv": { "name": "cv-gerardo-garcia.pdf", "mime": "application/pdf", "url": "/uploads/cv_gerardo_garcia_632a753bae.pdf", "…": "…" },
    "seo": {
      "id": 3,
      "metaTitle": "Gerardo García Medina — Full Stack Developer",
      "metaDescription": "Desarrollador Full Stack especializado en Node.js y el ecosistema React/Next.js. …"
    }
  },
  "meta": {}
}
```

| Campo | Tipo | ¿Siempre viene? |
| --- | --- | --- |
| `name` | string | sí (nombre corto) |
| `fullName` | string | sí |
| `role` | string | sí |
| `email` | string | sí |
| `phone` | string | sí; formato de despliegue, para `tel:` hay que quitarle los caracteres que no sean dígitos |
| `linkedinUrl` | string | sí (URL absoluta) |
| `cv` | media \| null | opcional |
| `seo` | `{ metaTitle, metaDescription }` \| null | opcional |

### 4.2 `GET /api/home-page`

```
/api/home-page?populate[hero][populate]=*&populate[about][populate]=*&populate[services][populate]=*&populate[contact][populate]=*&populate[stack]=true&populate[experience]=true&populate[projects]=true
```

Cada sección es un componente. Las que no tienen nada anidado (`stack`, `experience`, `projects`) se piden con `=true`, y las que tienen media o componentes dentro, con `[populate]=*`.

```json
{
  "data": {
    "documentId": "…",
    "hero": {
      "eyebrow": "Full Stack Developer",
      "title": "Gerardo García Medina",
      "bio": "Desarrollador Full Stack con sólida experiencia …",
      "photo": { "url": "/uploads/hero_501089f39a.avif", "mime": "image/avif", "…": "…" },
      "photoAlt": "Foto de Gerardo García Medina",
      "ctas": [
        { "id": 4, "label": "Hablemos", "href": "#contacto", "variant": "primary" },
        { "id": 5, "label": "Ver proyectos", "href": "#proyectos", "variant": "outline" }
      ]
    },
    "about": {
      "header": { "eyebrow": "Sobre mí", "heading": "Del diseño a la producción", "description": null },
      "paragraphs": [
        { "id": 1, "text": "Tengo experiencia integrando tecnologías …" },
        { "id": 2, "text": "Complemento el trabajo con pruebas automatizadas …" }
      ],
      "illustration": { "url": "/uploads/design_system_….svg", "…": "…" },
      "highlights": [
        { "id": 1, "number": "01", "text": "Pruebas con RTL y Playwright en cada entrega." },
        { "id": 2, "number": "02", "text": "De Figma o Claude Design al código, sin fricción." },
        { "id": 3, "number": "03", "text": "Componentes accesibles con shadcn/ui y Radix UI." }
      ]
    },
    "stack": { "eyebrow": "Stack", "heading": null, "description": null },
    "experience": { "eyebrow": "Experiencia", "heading": "Trayectoria profesional", "description": null },
    "services": {
      "header": { "eyebrow": "Servicios", "heading": "En qué puedo ayudarte", "description": null },
      "illustration": { "url": "/uploads/problem_solving_….svg", "…": "…" },
      "cta": { "label": "Hablemos de tu proyecto", "href": "#contacto", "variant": "primary" }
    },
    "projects": { "eyebrow": "Proyectos", "heading": "Trabajo reciente", "description": null },
    "contact": {
      "header": {
        "eyebrow": "Contacto",
        "heading": "Hablemos de tu proyecto",
        "description": "Cuéntame qué necesitas y te responderé lo antes posible para revisar cómo puedo ayudarte."
      },
      "illustration": { "url": "/uploads/contact_….svg", "…": "…" }
    }
  },
  "meta": {}
}
```

Tipos reutilizados dentro del home:

**Section header** (`stack`, `experience`, `projects` y el `header` de `about`, `services` y `contact`)

| Campo | Tipo | ¿Siempre viene? |
| --- | --- | --- |
| `eyebrow` | string | sí |
| `heading` | string \| null | opcional (el de `stack` viene en `null`) |
| `description` | string \| null | opcional (solo `contact` lo tiene) |

**Link** (`hero.ctas[]`, `services.cta`)

| Campo | Tipo | Valores |
| --- | --- | --- |
| `label` | string | |
| `href` | string | anclas internas (`#contacto`, `#proyectos`) o URLs |
| `variant` | enum | `"primary"` \| `"outline"` |

Campos por sección:

| Sección | Campo | Tipo | Nota |
| --- | --- | --- | --- |
| `hero` | `eyebrow`, `title`, `bio`, `photoAlt` | string | `bio` es un solo párrafo |
| | `photo` | media | siempre presente |
| | `ctas` | Link[] | máximo 2 |
| `about` | `header` | Section header | |
| | `paragraphs` | `{ text }[]` | un elemento por párrafo, en orden |
| | `illustration` | media \| null | decorativa |
| | `highlights` | `{ number, text }[]` | `number` ya viene formateado (`"01"`) |
| `services` | `header` | Section header | los servicios en sí vienen de `/api/services` |
| | `illustration` | media \| null | decorativa |
| | `cta` | Link \| null | |
| `contact` | `header` | Section header | email, teléfono y LinkedIn vienen de `/api/global` |
| | `illustration` | media \| null | decorativa |

Cualquier sección puede llegar en `null` si se vacía desde el admin.

### 4.3 `GET /api/experiences`

```
/api/experiences?sort=order:asc
```

```json
{
  "data": [
    {
      "documentId": "…",
      "company": "XDEVELOP",
      "role": "Desarrollador Frontend",
      "startDate": "2026-04-01",
      "endDate": null,
      "description": "Desarrollo de proyectos de consultoría con Next.js 16 …",
      "order": 1
    },
    {
      "documentId": "wfdfr7z5jnngwinhz4j2y0lh",
      "company": "Telo",
      "role": "Desarrollador Front End",
      "startDate": "2023-09-01",
      "endDate": "2025-01-01",
      "description": "Diseño y desarrollo de Web Components reutilizables …",
      "order": 2
    }
  ],
  "meta": { "pagination": { "page": 1, "pageSize": 25, "pageCount": 1, "total": 4 } }
}
```

| Campo | Tipo | Nota |
| --- | --- | --- |
| `company` | string | único |
| `role` | string | |
| `startDate` | string `YYYY-MM-DD` | fecha sin hora ni zona horaria; parsearla como fecha local para evitar que se recorra un día |
| `endDate` | string `YYYY-MM-DD` \| null | **`null` = "Actualidad"** |
| `description` | string | un párrafo |
| `order` | number | orden de despliegue (1 = primero) |

### 4.4 `GET /api/stack-groups`

```
/api/stack-groups?sort=order:asc&populate[primary]=true&populate[secondary]=true
```

```json
{
  "data": [
    {
      "documentId": "r9onhdcjzqufp2juvj3uwi0i",
      "title": "Testing",
      "order": 3,
      "primary": [{ "id": 161, "name": "React Testing Library" }],
      "secondary": [{ "id": 162, "name": "Playwright" }]
    }
  ],
  "meta": { "pagination": { "…": "…", "total": 4 } }
}
```

| Campo | Tipo | Nota |
| --- | --- | --- |
| `title` | string | `Frontend`, `Backend`, `Testing`, `Infraestructura` |
| `primary` | `{ name }[]` | tecnologías destacadas |
| `secondary` | `{ name }[]` | tecnologías secundarias |
| `order` | number | |

Las tecnologías llegan como objetos `{ id, name }`, no como strings.

### 4.5 `GET /api/services`

```
/api/services?sort=order:asc
```

```json
{
  "data": [
    {
      "documentId": "lppitxjjgq7c8w0qt4vo4vtv",
      "title": "Desarrollo Frontend a medida",
      "description": "Interfaces en Next.js y React con shadcn/ui y Radix UI: accesibles, responsivas y con foco en rendimiento.",
      "icon": "code",
      "order": 1
    }
  ],
  "meta": { "pagination": { "…": "…", "total": 3 } }
}
```

| Campo | Tipo | Valores |
| --- | --- | --- |
| `title` | string | |
| `description` | string | |
| `icon` | enum | `"code"` \| `"server"` \| `"rocket"`. Es un identificador, no un componente: el frontend decide qué ícono le corresponde. |
| `order` | number | |

### 4.6 `GET /api/projects` y `GET /api/projects/:documentId`

```
/api/projects?sort=order:asc&populate[tags]=true&populate[image]=true
/api/projects/lys87jy2xq5etfusndom4ody?populate[tags]=true&populate[image]=true
```

```json
{
  "data": [
    {
      "documentId": "lys87jy2xq5etfusndom4ody",
      "title": "Plataforma de Gestión Interna",
      "description": "Panel administrativo con autenticación, roles y reportes en tiempo real construido con Next.js y shadcn/ui.",
      "projectStatus": "coming-soon",
      "url": null,
      "repoUrl": null,
      "order": 1,
      "tags": [
        { "id": 178, "name": "Next.js" },
        { "id": 179, "name": "TypeScript" },
        { "id": 180, "name": "PostgreSQL" }
      ],
      "image": { "name": "documents.svg", "width": 646, "height": 800, "mime": "image/svg+xml", "url": "/uploads/documents_5772514cc7.svg", "…": "…" }
    }
  ],
  "meta": { "pagination": { "…": "…", "total": 3 } }
}
```

| Campo | Tipo | Nota |
| --- | --- | --- |
| `title` | string | único |
| `description` | string | |
| `tags` | `{ name }[]` | |
| `image` | media \| null | |
| `projectStatus` | enum | `"coming-soon"` \| `"live"`. **Se llama `projectStatus`, no `status`** (`status` está reservado en Strapi). Hoy los tres proyectos vienen en `coming-soon`. |
| `url` | string \| null | demo en vivo |
| `repoUrl` | string \| null | repositorio |
| `order` | number | |

En la ruta individual, `data` es un objeto, no un array. Si el `documentId` no existe, responde `404`. Los proyectos no tienen slug: si hace falta una página por proyecto, se identifica con el `documentId`.

## 5. Errores

Todos los errores tienen la misma forma, con `data: null`:

```json
{ "data": null, "error": { "status": 403, "name": "ForbiddenError", "message": "Forbidden", "details": {} } }
```

| Status | Cuándo |
| --- | --- |
| `400` | Query inválida, por ejemplo un `populate` o `sort` sobre un campo que no existe. `details` dice cuál. |
| `401` | Token mal formado o revocado. |
| `403` | Petición sin token, o intento de escritura. |
| `404` | `documentId` inexistente, o un single type todavía vacío. |

## 6. Cuándo cambia el contenido

- El contenido se edita desde el admin de Strapi (`STRAPI_URL/admin`). En las colecciones, los cambios solo llegan a la API cuando se publican.
- Strapi no avisa al frontend de los cambios. La estrategia de caché o revalidación la decides tú.
- El contenido inicial se carga con `pnpm seed` en este proyecto. Ojo: correrlo de nuevo sobrescribe con `scripts/seed-data.json` los documentos que cargó.
