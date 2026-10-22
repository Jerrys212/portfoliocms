import fs from 'fs';
import path from 'path';
import { compileStrapi, createStrapi } from '@strapi/strapi';
import type { Core, UID } from '@strapi/strapi';
import seedData from './seed-data.json';

const ASSETS_DIR =
  process.env.SEED_ASSETS_DIR ?? 'C:\\Users\\gmgx2\\Documents\\personalprojects\\portfolio\\public';

const MIME_TYPES: Record<string, string> = {
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
};

type MediaIds = Map<string, number>;
type SeedEntry = Record<string, unknown>;

let currentStep = 'startup';

const step = (name: string) => {
  currentStep = name;
};

const ok = (message: string) => console.log(`✔ ${message}`);

const toTags = (names: string[]) => names.map((name) => ({ name }));

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
  const { global, homePage, projects } = seedData;
  const files: [string, string][] = [
    [homePage.hero.photo, homePage.hero.photoAlt],
    [global.cv, ''],
    [homePage.about.illustration, ''],
    [homePage.services.illustration, ''],
    [homePage.contact.illustration, ''],
    ...projects.map((project): [string, string] => [project.image, '']),
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

const upsertSingleType = async (strapi: Core.Strapi, uid: UID.SingleType, data: SeedEntry) => {
  step(uid);

  const documents = strapi.documents(uid);
  const existing = await documents.findFirst();

  if (existing) {
    await documents.update({ documentId: existing.documentId, data: data as never });
  } else {
    await documents.create({ data: data as never });
  }

  ok(`${uid.split('.').pop()} (${existing ? 'updated' : 'created'})`);
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
  const { global, homePage, experiences, stackGroups, services, projects } = seedData;

  const ids = await uploadAllFiles(strapi);

  await upsertSingleType(strapi, 'api::global.global', {
    ...global,
    cv: mediaId(ids, global.cv),
  });

  await upsertSingleType(strapi, 'api::home-page.home-page', {
    ...homePage,
    hero: { ...homePage.hero, photo: mediaId(ids, homePage.hero.photo) },
    about: { ...homePage.about, illustration: mediaId(ids, homePage.about.illustration) },
    services: { ...homePage.services, illustration: mediaId(ids, homePage.services.illustration) },
    contact: { ...homePage.contact, illustration: mediaId(ids, homePage.contact.illustration) },
  });

  await upsertCollection(strapi, 'api::experience.experience', 'company', experiences);

  await upsertCollection(
    strapi,
    'api::stack-group.stack-group',
    'title',
    stackGroups.map((group) => ({
      ...group,
      primary: toTags(group.primary),
      secondary: toTags(group.secondary),
    }))
  );

  await upsertCollection(strapi, 'api::service.service', 'title', services);

  await upsertCollection(
    strapi,
    'api::project.project',
    'title',
    projects.map((project) => ({
      ...project,
      tags: toTags(project.tags),
      image: mediaId(ids, project.image),
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
