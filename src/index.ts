import type { Core } from '@strapi/strapi';

const READ_TOKEN_NAME = 'portfolio-read';

const READ_TOKEN_PERMISSIONS = [
  'api::global.global.find',
  'api::home-page.home-page.find',
  'api::experience.experience.find',
  'api::experience.experience.findOne',
  'api::technology.technology.find',
  'api::technology.technology.findOne',
  'api::service.service.find',
  'api::service.service.findOne',
  'api::project.project.find',
  'api::project.project.findOne',
];

const LOCALES = [
  { code: 'es', name: 'Spanish (es)' },
  { code: 'en', name: 'English (en)' },
];

const DEFAULT_LOCALE = 'es';

const ensureLocales = async (strapi: Core.Strapi) => {
  const localesService = strapi.plugin('i18n').service('locales');

  for (const locale of LOCALES) {
    if (!(await localesService.findByCode(locale.code))) {
      await localesService.create(locale);
    }
  }

  if ((await localesService.getDefaultLocale()) !== DEFAULT_LOCALE) {
    await localesService.setDefaultLocale({ code: DEFAULT_LOCALE });
  }
};

const ensureReadToken = async (strapi: Core.Strapi) => {
  const apiTokenService = strapi.service('admin::api-token');

  const existing = await apiTokenService.getByName(READ_TOKEN_NAME);
  if (existing) {
    await apiTokenService.update(existing.id, { permissions: READ_TOKEN_PERMISSIONS });
    return;
  }

  const token = await apiTokenService.create({
    name: READ_TOKEN_NAME,
    description: 'Read-only access for the portfolio frontend',
    kind: 'content-api',
    type: 'custom',
    lifespan: null,
    permissions: READ_TOKEN_PERMISSIONS,
  });

  console.log(
    [
      '',
      '='.repeat(72),
      `API token "${READ_TOKEN_NAME}" created. Save it now, it will not be printed again:`,
      '',
      token.accessKey,
      '',
      'Store it as STRAPI_API_TOKEN in the frontend server-side env.',
      '='.repeat(72),
      '',
    ].join('\n')
  );
};

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureLocales(strapi);
    await ensureReadToken(strapi);
  },
};
