import type { Core } from '@strapi/strapi';

const READ_TOKEN_NAME = 'portfolio-read';

const READ_TOKEN_PERMISSIONS = [
  'api::global.global.find',
  'api::home-page.home-page.find',
  'api::experience.experience.find',
  'api::experience.experience.findOne',
  'api::stack-group.stack-group.find',
  'api::stack-group.stack-group.findOne',
  'api::service.service.find',
  'api::service.service.findOne',
  'api::project.project.find',
  'api::project.project.findOne',
];

const ensureReadToken = async (strapi: Core.Strapi) => {
  const apiTokenService = strapi.service('admin::api-token');

  if (await apiTokenService.exists({ name: READ_TOKEN_NAME })) {
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
    await ensureReadToken(strapi);
  },
};
