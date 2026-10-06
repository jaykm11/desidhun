FROM node:22-slim AS dependencies

WORKDIR /app/web
COPY package*.json ./
RUN npm ci

FROM dependencies AS development

COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev:development", "--", "--host", "0.0.0.0"]

FROM dependencies AS build

COPY . .
RUN npm run build:production

FROM nginx:alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80