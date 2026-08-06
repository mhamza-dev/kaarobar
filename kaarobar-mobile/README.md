# Kaarobar Mobile (`kaarobar-mobile`)

React Native CLI client for **business / staff** (KRB-SRS-004). Cloud edition — talks to Phoenix `kaarobar-BE` at `/api/v1`.

## Purpose

Staff POS, sales, products, customers, settings (including ESS Attendance). Consumer marketplace lives in [`kaarobar-customer`](../kaarobar-customer).

## Tabs

POS · Sales · Products · Customers · Settings  
Attendance (clock in/out, leave, payslips) is under **Settings → Attendance**.

## Setup

```bash
npm install
npm start
# then in another terminal:
npm run ios
# or
npm run android
```

Set `API_URL` or `EXPO_PUBLIC_API_URL` (defaults to `http://localhost:4000/api/v1`). Use your Mac’s LAN IP for a physical device (not `localhost`).

Demo staff: `owner@kaarobar.local` / `Password@123`

### Android physical device (USB debugging)

`npm run android` targets a connected device when `adb` sees it. If the CLI looks for an emulator, the Android SDK is missing or the phone is not authorized.

1. Install **Android Studio**, **JDK 17**, and SDK **Platform-Tools** (provides `adb`).
2. Add to `~/.zshrc`:
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
   npm run android
   # or: npx react-native run-android --deviceId <serial>
   ```

`npm run ios` is for the iOS Simulator / Apple devices only — it will not use an Android USB phone.

Also pin Ruby for CocoaPods via [`.tool-versions`](./.tool-versions) (`ruby 4.0.2` with asdf).

## Stack

- React Native 0.76 + React Navigation (native stack + bottom tabs)
- AsyncStorage session, duplicated theme/i18n (no shared npm package)
- TanStack Query — see [`docs/architecture/client-cache-standards.md`](../docs/architecture/client-cache-standards.md)
