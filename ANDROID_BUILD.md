# Build the Android APK

The Android app bundles the game locally. It does not need a hosting service or an app store to run.

## Requirements

- Node.js 22 or newer
- Android Studio 2025.2.1 or newer
- An Android SDK platform for API 24 or newer, installed from Android Studio's SDK Manager

Android Studio supplies the JDK used by the build.

## Build

Open PowerShell in the project folder and run:

```powershell
npm install
npm run build:android
```

The build script copies the current `index.html`, `css/`, and `js/` files into `www/`, creates the Capacitor Android project on the first run, syncs the game, and builds a debug APK.

The APK is written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Copy that APK to an Android phone and open it to install. Android may ask you to allow installation from that file source. The package supports Android 7.0 (API 24) and newer.

This debug APK is suitable for direct testing and sharing. A release APK for wider distribution should be generated and signed through Android Studio's **Build > Generate Signed Bundle / APK** flow.