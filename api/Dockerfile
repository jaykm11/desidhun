FROM node:22-slim AS build

WORKDIR /app
COPY api/package*.json ./api/
RUN cd api && npm ci

COPY web/src ./web/src
COPY api ./api
RUN cd api && npm run build

FROM node:22-slim AS production

WORKDIR /app
ENV NODE_ENV=production

COPY api/package*.json ./api/
RUN cd api && npm ci --omit=dev
COPY --from=build /app/api/dist ./api/dist
COPY web/public/covers ./public/covers

EXPOSE 8080
CMD ["node", "api/dist/index.mjs"]

FROM node:22-slim AS development

WORKDIR /app/api
COPY api/package*.json ./
RUN npm ci
COPY api ./
COPY web/src /app/web/src

EXPOSE 8080
CMD ["npm", "run", "dev:development"]
