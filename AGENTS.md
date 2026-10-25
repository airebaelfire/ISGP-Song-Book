# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

This project is on Expo SDK 57 (`expo@^57.0.23` in package.json; React Native 0.86, React 19.2).

- Expo Go for SDK 57 may not be in the App Store / Play Store yet. On a physical iPhone, get it
  with `eas go` (TestFlight); on simulators and Android, Expo CLI installs it for you.
- `app.json` enables `ios.enableSceneSupport` via `expo-build-properties`, which needs
  `expo@57.0.23` or newer. Apps built with the iOS 27 SDK (Xcode 27) must use the UIKit scene
  life cycle. SDK 58 does this by default, so the setting can be removed after upgrading to 58.
- Minimums: iOS 16.4, Android API 24 (minSdk).

See [README.md](README.md) for how to upgrade to a newer SDK.
