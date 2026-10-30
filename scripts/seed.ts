import fs from 'fs';
import path from 'path';
import { compileStrapi, createStrapi } from '@strapi/strapi';
import type { Core, UID } from '@strapi/strapi';
import seedData from './seed-data.json';

const ASSETS_DIR =
  process.env.SEED_ASSETS_DIR ??
  'C:\\Users\\gmgx2\\Documents\\personalprojects\\dark-minimal-next\\public';

const LOCALES = ['es', 'en'] as const;

type Locale = (typeof LOCALES)[number];

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
};

type MediaIds = Map<string, number>;
type SeedEntry = Record<string, unknown>;
type LocalizedEntry = { shared: SeedEntry; locales: Record<Locale, SeedEntry> };
type PublishStatus = 'published' | undefined;

let currentStep = 'startup';

const step = (name: string) => {
  currentStep = name;
};

const ok = (message: string) => console.log(`✔ ${message}`);

const toTags = (names: string[]) => names.map((name) => ({ name }));

const toParagraphs = (texts: string[]) => texts.map((text) => ({ text }));

const mapLocales = <T>(locales: Record<Locale, T>, fn: (value: T) => SeedEntry) =>
  Object.fromEntries(LOCALES.map((locale) => [locale, fn(locales[locale])])) as Record<
    Locale,
    SeedEntry
  >;

const uploadFile = async (strapi: Core.Strapi, relativePath: string, alternativeText: string) => {
  step(`file ${relativePath}`);

  const name = path.basename(relativePath);
  const existing = await strapi.db.query('plugin::upload.file').findOne({ where: { name } });

  if (existing) {
    if (existing.alternativeText !== alternativeText) {
      await strapi.db
        .query('plugin::upload.file')
        .update({ where: { id: existing.id }, data: { alternativeText } });
    }
    ok(`file: ${name} (reused)`);
    return existing.id as number;
  }

  const filepath = path.join(ASSETS_DIR, relativePath);
  if (!fs.existsSync(filepath)) {
    throw new Error(`Asset not found: ${filepath}`);
  }

  const mimetype = MIME_TYPES[path.extname(name).toLowerCase()];
  if (!mimetype) {
    throw new Error(`Unsupported asset extension: ${name}`);
  }

  const [uploaded] = await strapi
    .plugin('upload')
    .service('upload')
    .upload({
      data: { fileInfo: { name, alternativeText } },
      files: { filepath, originalFilename: name, mimetype, size: fs.statSync(filepath).size },
    });

  ok(`file: ${name} (uploaded)`);
  return uploaded.id as number;
};

const uploadAllFiles = async (strapi: Core.Strapi): Promise<MediaIds> => {
  const { global, technologies, projects } = seedData;
  const files: [string, string][] = [
    [global.shared.cv, ''],
    ...technologies.map((tech): [string, string] => [tech.icon, tech.name]),
    ...projects.map((project): [string, string] => [project.shared.image, project.shared.title]),
  ];

  const ids: MediaIds = new Map();
  for (const [relativePath, alternativeText] of files) {
    ids.set(relativePath, await uploadFile(strapi, relativePath, alternativeText));
  }
  return ids;
};

const mediaId = (ids: MediaIds, relativePath: string) => {
  const id = ids.get(relativePath);
  if (id === undefined) {
    throw new Error(`Media not uploaded: ${relativePath}`);
  }
  return id;
};

const findInAnyLocale = async (
  strapi: Core.Strapi,
  uid: UID.ContentType,
  filters: SeedEntry,
  status: 'draft' | undefined
) => {
  for (const locale of LOCALES) {
    const existing = await strapi
      .documents(uid)
      .findFirst({ filters, locale, status } as never);
    if (existing) {
      return existing;
    }
  }
  return null;
};

const upsertLocales = async (
  strapi: Core.Strapi,
  uid: UID.ContentType,
  existingDocumentId: string | undefined,
  { shared, locales }: LocalizedEntry,
  status: PublishStatus
) => {
  const documents = strapi.documents(uid);
  let documentId = existingDocumentId;

  for (const locale of LOCALES) {
    const data = { ...shared, ...locales[locale] };

    if (documentId) {
      await documents.update({ documentId, locale, data, status } as never);
    } else {
      const created = await documents.create({ locale, data, status } as never);
      documentId = created.documentId;
    }
  }
};

const upsertLocalizedSingleType = async (
  strapi: Core.Strapi,
  uid: UID.SingleType,
  entry: LocalizedEntry
) => {
  step(uid);

  const existing = await findInAnyLocale(strapi, uid, {}, undefined);
  await upsertLocales(strapi, uid, existing?.documentId, entry, undefined);

  ok(`${uid.split('.').pop()} (${existing ? 'updated' : 'created'})`);
};

const upsertLocalizedCollection = async (
  strapi: Core.Strapi,
  uid: UID.CollectionType,
  uniqueField: string,
  entries: LocalizedEntry[]
) => {
  const label = uid.split('.').pop();

  for (const entry of entries) {
    const key = String(entry.shared[uniqueField]);
    step(`${label} ${key}`);

    const existing = await findInAnyLocale(strapi, uid, { [uniqueField]: key }, 'draft');
    await upsertLocales(strapi, uid, existing?.documentId, entry, 'published');

    ok(`${label}: ${key} (${existing ? 'updated' : 'created'})`);
  }
};

const upsertCollection = async (
  strapi: Core.Strapi,
  uid: UID.CollectionType,
  uniqueField: string,
  entries: SeedEntry[]
) => {
  const label = uid.split('.').pop();
  const documents = strapi.documents(uid);

  for (const data of entries) {
    const key = String(data[uniqueField]);
    step(`${label} ${key}`);

    const existing = await documents.findFirst({
      filters: { [uniqueField]: key },
      status: 'draft',
    });

    if (existing) {
      await documents.update({
        documentId: existing.documentId,
        data: data as never,
        status: 'published',
      });
    } else {
      await documents.create({ data: data as never, status: 'published' });
    }

    ok(`${label}: ${key} (${existing ? 'updated' : 'created'})`);
  }
};

const seed = async (strapi: Core.Strapi) => {
  const { global, homePage, technologies, services, experiences, projects } = seedData;

  const ids = await uploadAllFiles(strapi);

  await upsertLocalizedSingleType(strapi, 'api::global.global', {
    shared: { ...global.shared, cv: mediaId(ids, global.shared.cv) },
    locales: global.locales,
  });

  await upsertLocalizedSingleType(strapi, 'api::home-page.home-page', {
    shared: {},
    locales: homePage,
  });

  await upsertCollection(
    strapi,
    'api::technology.technology',
    'name',
    technologies.map((tech) => ({ ...tech, icon: mediaId(ids, tech.icon) }))
  );

  await upsertLocalizedCollection(
    strapi,
    'api::service.service',
    'icon',
    services.map((service) => ({
      shared: service.shared,
      locales: mapLocales(service.locales, (content) => ({
        ...content,
        items: toParagraphs(content.items),
      })),
    }))
  );

  await upsertLocalizedCollection(
    strapi,
    'api::experience.experience',
    'company',
    experiences.map((experience) => ({
      shared: { ...experience.shared, tags: toTags(experience.shared.tags) },
      locales: experience.locales,
    }))
  );

  await upsertLocalizedCollection(
    strapi,
    'api::project.project',
    'title',
    projects.map((project) => ({
      shared: { ...project.shared, image: mediaId(ids, project.shared.image) },
      locales: project.locales,
    }))
  );
};

const main = async () => {
  const appContext = await compileStrapi();
  const app = createStrapi(appContext);
  app.log.level = 'error';

  let exitCode = 0;
  try {
    await app.load();
    await seed(app);
    // Strapi emits entry.* events fire-and-forget after commit; let them finish before destroy().
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log('\nSeed completed successfully.');
  } catch (error) {
    exitCode = 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n✖ Seed failed at "${currentStep}": ${message}`);
    const details = (error as { details?: unknown }).details;
    if (details) {
      console.error(JSON.stringify(details, null, 2));
    }
  } finally {
    await app.destroy();
  }

  process.exit(exitCode);
};

main().catch((error) => {
  console.error('✖ Seed failed before Strapi could start:', error);
  process.exit(1);
});
