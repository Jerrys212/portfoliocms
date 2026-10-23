FROM node:22-bookworm-slim AS base
RUN npm install -g pnpm@11.5.0
WORKDIR /opt/app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV NODE_ENV=production
RUN pnpm build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /opt/app
RUN chown node:node /opt/app
USER node
COPY --chown=node:node --from=prod-deps /opt/app/node_modules ./node_modules
COPY --chown=node:node --from=build /opt/app/dist ./dist
COPY --chown=node:node --from=build /opt/app/package.json /opt/app/tsconfig.json /opt/app/favicon.png ./
COPY --chown=node:node --from=build /opt/app/database ./database
COPY --chown=node:node --from=build /opt/app/public ./public
RUN mkdir -p public/uploads
EXPOSE 1337
CMD ["node_modules/.bin/strapi", "start"]
