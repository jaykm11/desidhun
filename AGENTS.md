# Desi Dhun / Meri Bhi Suno

Turns Hindi/Roman lyrics into raga-aware style prompts and AI-generated songs. Three deployables in one repo, no workspace/monorepo tooling — **each folder has its own `package.json` and its own `node_modules`; always `cd` into the folder before running npm**.

| Folder | What it is | Key commands |
|---|---|---|
| [web](web) | Vite + React 19 SPA, Firebase Hosting. Also holds the **shared** `src/data` + `src/lib` + `src/types.ts` | `npm run dev`, `npm run build` (`tsc -b && vite build`), `npm run lint` (oxlint) |
| [api](api) | Express 5 on Cloud Run, Firebase Admin + Firestore + GCS + Gemini/Lyria/TTS + Stripe/PayU | `npm run dev` (tsx watch), `npm run typecheck`, `npm run build` (esbuild) |
| [mobile](mobile) | Expo Router / React Native client | `npm start`, `npm run typecheck` |

Docs worth reading before changing infra: [web/README.md](web/README.md), [web/docs/GCP_DEPLOYMENT.md](web/docs/GCP_DEPLOYMENT.md), [mobile/README.md](mobile/README.md).

## Architecture

- **One source of truth for domain data.** Ragas, genres, tempo, voice tones, speech options, billing offers and the analysis/prompt engine live in [web/src/data](web/src/data) and [web/src/lib](web/src/lib). The API and the mobile app import those same files — never fork or re-declare an option list in `api/` or `mobile/`.
  - api imports them as `../../web/src/lib/analyze`, `../../web/src/data/billing`, …; see [api/Dockerfile](api/Dockerfile).
  - mobile imports them as `@shared/data/...` and `@shared/lib/...` via the `@shared/* -> ../web/src/*` alias in [mobile/tsconfig.json](mobile/tsconfig.json) and the Metro `watchFolders` entry in [mobile/metro.config.js](mobile/metro.config.js).
- **All business logic that costs money or credits is server-side.** Lyric analysis can run in the browser, but prompt/song/vocal generation, quota decrements and payment state must go through the API so Firestore transactions enforce them.
- **Routes** are declared on an `api` router in [api/src/index.ts](api/src/index.ts) under `/api/v1/...`, e.g. `api.post('/v1/songs/generate', requireUser, …)`. Auth is the `requireUser` middleware (Firebase ID token), admin endpoints add `requireAdmin`, and the Cloud Tasks callback uses `requireSongRenderTask` (OIDC). Public endpoints live under `/v1/public/...`.
- **Firestore layout**: `users/{uid}` (plan, credits, Stripe/PayU state) with subcollection `songs/{songId}`; top-level `communitySongs`, `presetSongs`, `membershipGrants`, `membershipHistory`, `generationEvents`, `payuPendingPayments`, `payuWebhookEvents`, `stripeWebhookEvents`, `paymentReceiptEmails`. Rules: [web/firestore.rules](web/firestore.rules).
- **Audio/video** are stored in GCS (`SONG_LIBRARY_BUCKET`) via [api/src/songLibrary.ts](api/src/songLibrary.ts); long renders are queued through Cloud Tasks ([api/src/songRenderTasks.ts](api/src/songRenderTasks.ts)). Share pages `/s/<id>` are server-rendered HTML from [api/src/sharePage.ts](api/src/sharePage.ts) and rewritten to Cloud Run in [web/firebase.json](web/firebase.json).

## Conventions

- TypeScript `strict` everywhere, ESM, single quotes, 2-space indent, no semicolon-free style. Prefer `type`/`interface` exports over runtime enums.
- **Client → API** always goes through the `apiFetch` helper ([web/src/lib/api.ts](web/src/lib/api.ts), [mobile/src/lib/api.ts](mobile/src/lib/api.ts)): it attaches `Authorization: Bearer <firebase id token>`, parses the JSON body, and throws `ApiError(message, status, code)`. Add new endpoints as a thin exported function there rather than calling `fetch` in a component.
- API errors are `res.status(n).json({ error, code })` — keep that shape so `ApiError.code` stays usable on the client.
- **Web styling is hand-written CSS** in [web/src/index.css](web/src/index.css) with semantic class names (`legal-page`, `workflow-step`, `muted`). No Tailwind, no CSS-in-JS; inline `style` only for dynamic values. Mobile uses `StyleSheet` plus [mobile/src/theme.ts](mobile/src/theme.ts) and `composeStyle`.
- Client config is public-by-convention env vars: `VITE_*` (see [.env.example](.env.example)) and `EXPO_PUBLIC_*`. **Never** put Stripe/PayU secrets, `GEMINI_API_KEY`, SMTP passwords or service accounts in them — server secrets come from Cloud Run `--update-secrets` in [web/cloudbuild.yaml](web/cloudbuild.yaml). Server code reads required vars through `requiredEnvironment(name)`.
- Quick engine checks: `cd web && npx tsx scripts/smoke.ts` and `npx tsx scripts/prosody-smoke.ts`. There is no unit test suite — validate with typecheck/build plus these smoke scripts.

## Pitfalls

- `api/` has no `node_modules` checked out by default; run `cd api && npm install` before `npm run typecheck`.
- API builds use the repository root as Docker context because the bundle imports shared modules from `web/src`; run `gcloud builds submit ...` from the repository root.
- Firebase auth uses same-site auth domains for `desidhun.net` / `desidhun.web.app` ([web/src/lib/firebase.ts](web/src/lib/firebase.ts)); changing the auth domain requires updating authorised OAuth redirect URIs.
- Production client API origins must use HTTPS. `VITE_API_BASE_URL` and `EXPO_PUBLIC_API_BASE_URL` are baked into public builds, and authenticated API requests carry Firebase ID tokens; never ship clients pointed at an HTTP IP endpoint. Use the Cloud Run or custom-domain HTTPS origin.
- Credit/quota changes must stay inside the Firestore transactions in [api/src/index.ts](api/src/index.ts) — a non-transactional decrement is a paid-feature bypass.
- Webhook routes (`/v1/webhooks/stripe`, `/v1/webhooks/payu`) use raw/urlencoded body parsers for signature verification; don't move them under the global JSON parser.
