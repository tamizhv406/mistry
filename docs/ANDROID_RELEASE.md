# Android build and Play Store checklist

Status: **not released, not tested on a physical phone.** This document says what exists, how to build
it, and what is still open before a Play Store submission. Nothing here claims Play approval.

## Packaging path

Mistry is a Vite + React web app. It is packaged for Android with **Capacitor 8**: the built web app
(`dist/`) is bundled inside a native app and shown in the system WebView. The app's files ship in the
APK, so it starts and works offline; records stay in the WebView's IndexedDB on the phone.

A Trusted Web Activity was not chosen: it needs the site hosted on a domain you control with a
`/.well-known/assetlinks.json` at the domain root, which a GitHub Pages project URL can not provide.

Generated native project: `android/` (application ID `com.buildingmistry.app`, min SDK 24,
target/compile SDK 36, version code 1, version name 1.0, permission: `INTERNET` only).

## What you need installed

| Tool | Version | Note |
| --- | --- | --- |
| Node.js | 20 or newer | |
| Android Studio | current | Installs the Android SDK. SDK Platform **36** and Build-Tools 36 are needed. |
| JDK | **21** | Required. Android Studio's bundled JDK 25 fails with this Gradle version ("Unsupported class file major version 69"). In Android Studio: Settings → Build Tools → Gradle → Gradle JDK → download/select 21. On the command line set `JAVA_HOME` to a JDK 21. |

## Build a test APK (debug)

```bash
npm install
npm run build                 # builds dist/ (reads .env.production.local if present)
npx cap sync android          # copies dist/ into the Android project
cd android
./gradlew assembleDebug       # Windows: gradlew.bat assembleDebug
```

Result: `android/app/build/outputs/apk/debug/app-debug.apk`. Install it on a phone with USB debugging:
`adb install -r app/build/outputs/apk/debug/app-debug.apk`, or open `android/` in Android Studio and press Run.

After any change to the web app, repeat `npm run build && npx cap sync android`.

## Build for Play (release bundle)

1. **Decide the application ID first.** It is permanent once published. To change it, edit `appId` in
   `capacitor.config.ts`, `namespace` and `applicationId` in `android/app/build.gradle`,
   `package_name` and `custom_url_scheme` in `android/app/src/main/res/values/strings.xml`, and move
   `MainActivity.java` to the matching package folder (or delete `android/` and run `npx cap add android` again).
2. **Create an upload key** (once; keep the file and passwords somewhere safe and backed up, and never commit them):
   ```bash
   keytool -genkeypair -v -keystore mistry-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias mistry-upload
   ```
3. Create `android/keystore.properties` (ignored by git):
   ```
   storeFile=/absolute/path/to/mistry-upload.jks
   storePassword=...
   keyAlias=mistry-upload
   keyPassword=...
   ```
   `android/app/build.gradle` reads this file when it exists and signs release builds with it.
4. Raise `versionCode` (must increase with every upload) and set `versionName` in `android/app/build.gradle`.
5. Build: `npm run build && npx cap sync android && cd android && ./gradlew bundleRelease`
   → `android/app/build/outputs/bundle/release/app-release.aab`. Upload that to Play Console.
   Use Play App Signing (Play keeps the app signing key; you keep the upload key).

## Environment variables (set before `npm run build`)

Put them in `.env.production.local` (git ignores `*.local`). They are compiled into the app, so only public values belong here.

```
VITE_SUPABASE_URL=            # optional: turns on cloud backup
VITE_SUPABASE_ANON_KEY=       # the public anon / publishable key ONLY. Never a service-role key.
VITE_ENABLE_DEMO_LOGIN=       # leave unset for release. "true" re-enables the demo accounts (public password).
```

## Release checklist

Done in code:

- [x] Demo accounts with a public password are not created, and demo login is hidden, in production builds.
- [x] In-app account deletion (More → Backup & Data → Delete my account), which also erases the cloud copy.
- [x] Only the `INTERNET` permission. Photos are chosen through the system picker; no camera, location, contacts or storage permission.
- [x] No ads, no analytics, no third-party trackers.
- [x] Signing files and `.env*.local` are git-ignored.

Still open (yours to do or decide):

- [ ] **Test on real phones** (a low-end Android 8–10 device and a current one): install, create project, attendance, floor planner gestures, kill and reopen the app, airplane mode.
- [ ] **Application ID** final value (see above).
- [ ] **App icon and splash** for Android (`android/app/src/main/res/mipmap-*`); the generated project still has Capacitor's default icon. Android Studio → New → Image Asset.
- [ ] **Privacy policy** on a public URL. Required: the app stores names, phone numbers, wages and payments, and (with cloud backup) sends them to Supabase.
- [ ] **Data safety form** in Play Console. Expected answers, to confirm against what you ship:
  - Without cloud backup: data stays on the device; nothing is collected or shared by you.
  - With cloud backup: you collect account email, and the user's records (personal info such as names and phone numbers; financial info such as wages and payments) for app functionality; encrypted in transit; users can request deletion (in-app). Not sold, not used for ads.
- [ ] **Account deletion web link** for the Play listing (a page or email address where deletion can be requested without the app). Deleting the Supabase login itself needs the Supabase dashboard or a server function; the app erases the records, not the login.
- [ ] **Android auto-backup**: `android:allowBackup="true"` lets Android copy app data to the user's Google account. Keep it (easier restore) or set it to `false` in `AndroidManifest.xml` (stricter privacy), and describe your choice in the privacy policy.
- [ ] **Target API level**: the project targets API 36. Check Play Console's current minimum when you submit.
- [ ] **Play Console**: developer account, content rating questionnaire, target audience (adults), store listing (512×512 icon, 1024×500 feature graphic, phone screenshots, short and full description), and any closed-testing period Play requires for new personal accounts.
- [ ] **Initial administrator account**: every install creates a hidden `SUPER_ADMIN` account for the address in `VITE_INITIAL_ADMIN_EMAIL` (default in `src/services/auth.ts`) with a first-login password hash that is in the public repository. On a customer's phone this account can see all data on that phone. Decide whether release builds should create it.
- [ ] Voice input uses the Web Speech API, which Android's WebView does not provide; the microphone button hides itself when unsupported. Confirm on a device.
