# Meri Bhi Suno — mobile app

An Expo / React Native client for the Desi Dhun AI music studio. It talks to the
same Cloud Run backend as the web app ([api](../api)) and reuses the shared
raga, genre, tempo, voice and billing tables in [web/data](../web/data), so the
app can never drift from the server's idea of what an option means.

## What it does

| Screen | Capability |
|---|---|
| Sign in | Firebase email/password, password reset, optional Google sign-in |
| Create | Songs, instrumental music, podcast/spoken-word and film-dialogue reels; AI lyrics, lyrics from a photo, genre/voice/tempo/pitch/pause controls |
| Library | Your generated tracks, live render status, playback, rename, rate, publish, delete |
| Explore | Featured / top / favourite community songs with likes and sharing |
| Account | Plan, prompt / song / vocal credits, membership checkout and billing portal |

Audio is downloaded to the app cache with your Firebase token, played with
`expo-audio`, and shared as a real `.mp3` to WhatsApp, Instagram, Files, AirDrop
and anything else through the OS share sheet. Playback continues while you move
between tabs.

## Prerequisites

- Node.js 20 or newer and npm
- The Expo Go app on your phone (iOS or Android), or an emulator/simulator
- A reachable deployment of [api](../api), or the API running locally
- A Firebase project with **Email/Password** enabled under Authentication → Sign-in method

## Install

```bash
cd mobile
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Notes |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Base URL of the backend, no trailing slash |
| `EXPO_PUBLIC_APP_BASE_URL` | Website that serves `/s/<id>` share links |
| `EXPO_PUBLIC_FIREBASE_*` | From Firebase console → Project settings → Your apps → Web app |
| `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` | Optional. Leave blank to hide the Google button |

Everything prefixed `EXPO_PUBLIC_` is compiled into the app bundle, so only put
client-safe values there. Never put the Firebase service account, Stripe secret
key or any API secret in this file. Restart Expo after editing `.env`.

> A phone cannot reach `localhost`. When running the API on your machine, set
> `EXPO_PUBLIC_API_BASE_URL` to your computer's LAN address
> (`http://192.168.x.x:8080`) and start Expo with `npx expo start --tunnel` if
> the two devices are on different networks.

## Run and test

```bash
npm start          # Expo dev server, then scan the QR code with Expo Go
npm run android    # open on a connected Android device or emulator
npm run ios        # open in the iOS simulator (macOS only)
npm run web        # run in a browser
npm run typecheck  # tsc --noEmit, including the shared ../web modules
```

`npm run start:clear` clears the Metro cache, which is the fix for most stale
module errors after changing `.env`, `app.json` or `metro.config.js`.

### Expo Go vs a development build

Everything in this app runs in **Expo Go**, so `npm start` plus the QR code is
enough for day-to-day testing. You need a development build (`npx expo prebuild`
then `npm run android` / `npm run ios`) only if you later add a library with
custom native code.

Google sign-in in Expo Go uses the Expo proxy redirect; native builds use the
`meribhisuno` scheme declared in [app.json](app.json). Add both redirect URIs to
the OAuth client in Google Cloud console if you enable it.

### Manual test pass

1. Register a new account, sign out, sign back in, and use "Forgot password".
2. Create → Song → type a few lines → **Create song**. The button cycles through
   the render status; the finished track appears in Library.
3. Create → Reels → **Generate dialogue** → pick a language and character →
   **Create audio**. Confirm the voice, pace and pauses follow the sliders.
4. Library → play a track, switch to Explore, confirm the now-playing bar keeps
   playing, then share the audio to another app.
5. Song detail → rename, rate, publish, copy link. Confirm the link opens the
   web share page.
6. Account → confirm the credit counts match the web app for the same user.
7. Turn off Wi-Fi mid-generation and confirm a readable error appears rather
   than a hang.

## Deploy

Builds and store submissions go through EAS.

```bash
npm install --global eas-cli
eas login
eas init                       # links this folder to an EAS project
eas build --platform android --profile preview     # installable APK for testers
eas build --platform android --profile production  # AAB for Google Play
eas build --platform ios --profile production      # needs an Apple developer account
eas submit --platform android
eas submit --platform ios
```

Build-time configuration:

- EAS does not read your local `.env`. Register the same `EXPO_PUBLIC_*` values
  as EAS environment variables (`eas env:create`) or put them in the `env` block
  of each profile in `eas.json`.
- Bump `expo.version` in [app.json](app.json) for every store release. EAS
  handles the Android `versionCode` and iOS build number automatically when
  `autoIncrement` is enabled in the build profile.
- Over-the-air JavaScript updates: `npx expo install expo-updates`, then
  `eas update --branch production`. Native changes still need a new build.

Backend expectations:

- Native requests do not send an `Origin` header, so `ALLOWED_ORIGINS` on the
  API only matters if you also ship the web build. Add the web origin there if
  you do.
- The app calls only `/api/v1/*` with `Authorization: Bearer <Firebase ID
  token>`; no extra server routes are required.

## Project layout

```
app/                  expo-router routes (file path = URL path)
  _layout.tsx         providers, theme and the root stack
  index.tsx           sends you to the tabs or to sign-in
  sign-in.tsx
  (tabs)/             create, library, explore, account
  song/[id].tsx       song detail, sharing and playback controls
src/
  auth/               Firebase auth context and readable error messages
  components/         shared UI primitives and the now-playing bar
  lib/api.ts          typed client for /api/v1/*
  lib/composeStyle.ts builds the style prompt and the KEY=value TTS tags
  lib/media.ts        authenticated audio download, cache and OS sharing
  player/             app-wide audio player
  theme.ts
metro.config.js       watches ../web so the shared data tables resolve
```

`@shared/*` maps to [../web](../web). Import the raga, genre, tempo, voice and
billing tables from there — never copy those values into this app, because the
server validates against the same tables.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "The app is not connected to a backend yet" | `EXPO_PUBLIC_API_BASE_URL` is missing. Set it and restart Expo. |
| "Firebase is not configured" | One of the `EXPO_PUBLIC_FIREBASE_*` values is blank. |
| Requests fail only on a physical device | The API is on `localhost`. Use the LAN IP or `npx expo start --tunnel`. |
| Sign-in works but every API call is 401 | The API and the app are pointed at different Firebase projects. |
| Audio never plays | The song is still rendering, or the device cannot reach the API host. Pull to refresh in Library. |
| Changes to `.env` have no effect | Restart with `npm run start:clear`. |
