# Hearthlands

A relaxing medieval kingdom builder set on a real Earth of **8 million isometric tiles** (2000 × 4000).
Pick any spot on the planet, then grow from a hamlet into a kingdom at your own pace. You can't lose,
there are no timers, and you can pause whenever you like.

## Features
- **Real Earth**: continents and coastlines come from Natural Earth country shapes. Mountains, deserts,
  rainforests, taiga, tundra and ice follow their real locations. Every tile knows which country it's in.
- **Pick any homeland**: the start screen rates the woodland, stone, farmland and coast around the spot you choose.
- **Mixed building**: paint Housing, Farmland and Workshop zones, and villagers build them over time.
  Place key buildings yourself: Lumber Camp, Quarry, Iron Mine, Fishing Dock, Watchtower and Market.
- **Expansion**: your border grows with your town, and Watchtowers push it further. Found new settlements anywhere on Earth.
- **Peaceful neighbours**: about 600 villages around the world. Trade with them and send gifts,
  and close friends can join your kingdom.
- **Progression**: Hamlet → Village → Town → City → Kingdom, 19 gentle goals, and 5 Wonders.
- **Cozy feel**: villagers walk around your towns, the capital's keep grows with your tier, generative music
  plays alongside birdsong, and building gives a little vibration.
- Autosaves on the device. Works in portrait and landscape.

## Play in a browser
```
npx http-server web -p 8080
```
Then open http://localhost:8080. It's plain HTML and JS with no build step.

## Android APK
Every push runs `.github/workflows/android.yml`, which wraps `web/` with Capacitor and builds a debug APK.
Download it from the run's **Artifacts** section (`Hearthlands-apk`), then install it on your phone
(allow "install unknown apps" if Android asks).

Local build (needs the Android SDK and JDK 21):
```
npm install
npx cap add android
npx capacitor-assets generate --android
npx cap sync android
cd android && ./gradlew assembleDebug
```

## Code map
| File | Purpose |
| --- | --- |
| `web/js/world.js` | Real-Earth generation: rasterises countries, places mountains, deserts and rainforests, assigns biomes |
| `web/js/game.js` | State, buildings, economy, towns, neighbours, quests, saving |
| `web/js/render.js` | Isometric tile renderer plus atlas overview at far zoom, borders, villagers |
| `web/js/sprites.js` | All art, drawn in code |
| `web/js/ui.js` | HUD, menus, modes and the start flow |
| `web/js/audio.js` | Generative music, nature sounds, sound effects, haptics |

Map data: Natural Earth (public domain) via [world-atlas](https://github.com/topojson/world-atlas).
