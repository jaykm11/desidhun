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