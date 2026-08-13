# Kaarobar Mobile (`kaarobar-mobile`)

Expo (React Native) client for **business / staff** (KRB-SRS-004). Cloud edition — talks to Phoenix `kaarobar-backend` at `/api/v1`.

## Purpose

Staff POS, sales, products, customers, settings (including ESS Attendance). Consumer marketplace lives in [`mobile-consumer`](../mobile-consumer).

## Tabs

POS · Sales · Products · Customers · Settings  
Attendance (clock in/out, leave, payslips) is under **Settings → Attendance**.

## Setup

```bash
npm install
npm start          # Metro + Expo dev server
```

Then press `a` / `i` in the Expo CLI, or scan the QR code with **Expo Go**. Every
native module this app uses ships inside Expo Go, so no custom dev build is
needed for day-to-day work.

To build and run the native app locally instead (generates `android/` / `ios/` first):

```bash
npm run android    # expo run:android
npm run ios        # expo run:ios  (macOS only)
```

Set `EXPO_PUBLIC_API_URL` (defaults to `http://localhost:4000/api/v1`). Only
`EXPO_PUBLIC_*` variables are inlined into the bundle. Put it in `.env` or export it:

```bash
export EXPO_PUBLIC_API_URL=http://192.168.1.20:4000/api/v1
```

Use your machine's LAN IP for a physical device (not `localhost`).

Demo staff: `owner@kaarobar.local` / `Password@123`

## Native projects (CNG)

`android/` and `ios/` are **not** committed. They are generated from
[`app.json`](./app.json) by Continuous Native Generation:

```bash
npx expo prebuild                      # both platforms
npx expo prebuild --platform android   # one platform
npx expo prebuild --clean              # discard and regenerate
```

Never hand-edit the generated projects — change `app.json` or add a config
plugin instead, otherwise the edit is lost on the next prebuild.

Release APKs are signed with [`credentials/debug.keystore`](./credentials) (the
identity inherited from the pre-Expo builds, so installs stay upgradeable). CI
copies it into `android/app/` after prebuild. Replace it with a real release
keystore before a store submission.

### Android physical device (USB debugging)

`npm run android` targets a connected device when `adb` sees it. If the CLI looks for an emulator, the Android SDK is missing or the phone is not authorized.

1. Install **Android Studio**, **JDK 17**, and SDK **Platform-Tools** (provides `adb`).
2. Add to your shell profile:
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
   ```
3. Enable **USB debugging** on the phone → plug in → accept the RSA prompt.
4. Verify:
   ```bash
   adb devices
   # expect: <serial>    device
   ```
5. Run on that device:
   ```bash
   npm run android --device <serial>
   ```

`npm run ios` is for the iOS Simulator / Apple devices only — it will not use an Android USB phone.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run doctor     # expo-doctor: dependency/SDK compatibility
```

## Stack

- **Expo SDK 57** · React Native 0.86 · React 19 · New Architecture
- React Navigation 7 (native stack + bottom tabs)
- `expo-image-picker` for product / profile / attendance photos
- AsyncStorage session, duplicated theme/i18n (no shared npm package)
- TanStack Query — see [`docs/architecture/client-cache-standards.md`](../docs/architecture/client-cache-standards.md)
