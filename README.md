# Port City

A turn-based strategy game: govern a small coastal trading town from 1950 to 2050 and grow it into a world trade hub. Built for phones in portrait mode.

## Play

- **Android:** install [`dist/PortCity.apk`](dist/PortCity.apk). You'll need to allow "Install unknown apps" for your browser or file manager.
- **Browser:** open `web/index.html`, or host the `web/` folder on any static host such as GitHub Pages.

Progress saves automatically on the device.

## Layout

| Path | What it is |
|---|---|
| `web/index.html`, `web/style.css` | Page structure and styling |
| `web/core.js` | Simulation: economy, action cards, events, scoring (no DOM) |
| `web/ui.js` | Rendering, harbor scene, chart, input, saving |
| `android/` | Native Android WebView wrapper. Bundles `web/` as app assets |
| `tools/balance.js` | Headless bot playtests for balancing (`node tools/balance.js balanced 200`) |

## Build the APK

You need JDK 17+ and the Android SDK (platform 35, build-tools 35.0.0).

```sh
cd android
echo "sdk.dir=/path/to/android-sdk" > local.properties
./gradlew assembleRelease
# -> android/app/build/outputs/apk/release/app-release.apk
```

The app has no third-party dependencies. It is signed with `android/app/portcity-sideload.jks` (password `portcity`), so every build can update an existing install without losing saves. That key is public. Make your own before publishing to an app store.
