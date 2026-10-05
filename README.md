# Desi Dhun environments

The repository contains three independent npm applications. Run npm commands
inside `api`, `web`, or `mobile`; dependencies are not shared between them.

## Prerequisites

- Node.js 22 for the API and Node.js 20 or newer for web/mobile
- A Firebase/GCP project and Application Default Credentials for local API use
- Firebase CLI for web deployment and EAS CLI for native production builds

Install dependencies once:

```bash
cd api && npm install
cd ../web && npm install
cd ../mobile && npm install
```

## Docker Compose

Install Docker Desktop with Compose v2, then copy each app's environment
template to `.env.development` and fill in the Firebase/API settings. The API
also needs valid local credentials for Google Cloud; run
`gcloud auth application-default login` before starting the local stack.

```bash
cp api/.env.example api/.env.development
cp web/.env.example web/.env.development
cp mobile/.env.example mobile/.env.development
```

Start all three apps in one of these modes from the repository root:

```bash
# Local: live source mounts and hot reload
docker compose -f compose.yaml -f compose.local.yaml up --build

# Dev: development processes from the source captured in the images
docker compose up --build

# Production-mode smoke test: optimized API, static web bundle, and Expo bundle
APP_ENV=production docker compose --env-file mobile/.env.production \
	-f compose.yaml -f compose.production.yaml up --build
```

Create the matching `.env.production` files from the templates before using
production mode. The web production image embeds values from
`web/.env.production`; client API origins must be HTTPS for public deployment.
The production Compose mode is a local smoke-test stack, not a replacement for
Cloud Run, Firebase Hosting, or EAS distribution. The mobile container serves
an optimized Expo bundle; shipping native iOS/Android apps still uses EAS.

The web app is at `http://localhost:5173`, the API at
`http://localhost:8080`, and Expo Metro at `http://localhost:8081`. For a
physical phone, set `MOBILE_API_BASE_URL` and `EXPO_PACKAGER_HOSTNAME` to your
computer's LAN IP before starting the local stack, for example:

```bash
MOBILE_API_BASE_URL=http://192.168.1.20:8080 \
EXPO_PACKAGER_HOSTNAME=192.168.1.20 \
docker compose -f compose.yaml -f compose.local.yaml up --build
```

Stop the stack with `Ctrl+C`; use `docker compose down` to remove its containers.

## Development

### API

```bash
cd api
cp .env.example .env.development
# Fill in .env.development. Keep secrets out of git.
gcloud auth application-default login
npm run dev:development
```

The API listens on `PORT` (default `8080`). At minimum, startup requires
`APP_BASE_URL`, `PAYU_CALLBACK_BASE_URL`, and `ALLOWED_ORIGINS`. Song rendering
also requires the Cloud Tasks variables in the template. Use test Stripe/PayU
credentials locally.

### Web

```bash
cd web
cp .env.example .env.development
# Point VITE_API_BASE_URL at the local API.
npm run dev:development
```

Open the URL printed by Vite, normally `http://localhost:5173`. Include that
origin in the API's `ALLOWED_ORIGINS`.

### Mobile

```bash
cd mobile
cp .env.example .env.development
# For a phone, use the computer's LAN address instead of localhost.
npm run start:development
```

Scan the Expo QR code. Use `npm run start:clear` after changing environment or
Metro configuration. The mobile Firebase project must match the API project.

## Production

### API on Cloud Run

Cloud Run receives non-secret configuration from [web/cloudbuild.yaml](web/cloudbuild.yaml)
and secrets from Secret Manager. From the repository root:

```bash
gcloud builds submit --config web/cloudbuild.yaml .
```

For a production-like local process, copy `api/.env.example` to
`api/.env.production`, fill it with production references, then run:

```bash
cd api
npm run build
npm run start:production
```

Do not store production secret values in `.env.production`; Cloud Run should
receive them through Secret Manager. See
[web/docs/GCP_DEPLOYMENT.md](web/docs/GCP_DEPLOYMENT.md) for the full setup.

### Web on Firebase Hosting

```bash
cd web
cp .env.example .env.production
# Set the production Firebase values and Cloud Run URL.
npm run build:production
npx firebase-tools deploy --only hosting
```

`npm run preview:production` serves the already-built bundle for a local smoke
test; it is not the production web server.

### Mobile with EAS

Create EAS `development`, `preview`, and `production` environments containing
the `EXPO_PUBLIC_*` values from `mobile/.env.example`. Public Expo variables are
embedded in the app, so never place server credentials in them.

```bash
cd mobile
npm install --global eas-cli
eas login
eas init
eas env:create --environment production
npm run build:android:production
# or: npm run build:ios:production
eas submit --platform android --profile production
```

For a local production-bundle smoke test, copy `mobile/.env.example` to
`mobile/.env.production`, fill it, then run `npm run start:production`.

## Validation

```bash
cd api && npm run typecheck && npm run build
cd ../web && npm run lint && npm run build:production
cd ../mobile && npm run typecheck
```