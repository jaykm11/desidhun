FROM node:22-slim AS dependencies

WORKDIR /workspace
COPY mobile/package*.json ./mobile/
RUN cd mobile && npm ci

FROM dependencies AS development

COPY mobile ./mobile
COPY web/src ./web/src
WORKDIR /workspace/mobile
EXPOSE 8081
CMD ["npx", "expo", "start", "--host", "lan", "--port", "8081"]

FROM dependencies AS production

COPY mobile ./mobile
COPY web/src ./web/src
WORKDIR /workspace/mobile
EXPOSE 8081
CMD ["npx", "expo", "start", "--no-dev", "--minify", "--host", "lan", "--port", "8081"]