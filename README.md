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
- **A slow, calm pace** meant to be enjoyed over days: Village takes about 30 minutes of play, Town about 2 hours, City about 5 and Kingdom about 10. There is one speed plus pause, and nothing happens while the app is closed.
- **Pip the messenger bird** guides your first few steps: zoning fields and homes, then building a Lumber Camp. You can skip the guide at any time.
- **Three save slots**, so you can keep realms in different places on Earth. Each autosaves on the device.
- Goals are tucked into a 📜 scroll button that shows a badge when you finish one.
- **A living world**: a gentle day and night cycle about every 5 minutes of play, with window glow in town at night. Seasons follow each hemisphere. Snow spreads and melts tile by tile, woods turn gold in autumn, and blossom opens in spring. Fields rest in winter and give a harvest boost in late summer and autumn.
- **Wildlife and weather**: sheep, cows and chickens on the farms. Deer, reindeer, rabbits, gazelles and camels in the wild. Flocks of birds, fishing boats and sailing ships. Drifting clouds with shadows, showers with soft rain sound, snowfall in winter, and crickets at night.
- **Regional building styles**: towns build in the style of where they stand on Earth (timber-framed, Nordic, Mediterranean, adobe, tropical stilt houses or curved-eave). Homes improve by themselves from cottage to town house to manor as a town grows, and each step holds more people.
- **Neighbours with personality**: each village has a leader with a temperament. Leaders send letters with small requests (help is rewarded, ignoring them costs nothing), share little stories with friends, and their villages visibly grow on the map.
- **Town mood**: everyday buildings (well, apiary, windmill, chapel, tavern, school), goods and charm make towns 🙂 Content, 😊 Happy or 😄 Joyful. Happier towns attract families faster, and mood never punishes.
- **Goods**: bread (bakery), tools (smithy), cloth (weaver) and ale or wine (brewery). Each is a simple one-step workshop, and the goods row appears once goods unlock.
- **Regional specialties**: orchards in timber-framed towns, ice-fishing huts in Nordic ones, vineyards in Mediterranean ones, oasis gardens in adobe towns, cacao groves in the tropics and rice terraces in curved-eave towns.
- **Villagers with lives**: everyone has a name from their region, an age, a family, a home, a job and a growing skill. Weddings, babies, coming of age, master craftspeople, retirements and young families moving between towns all appear in each town's chronicle. Tap anyone walking about to meet them.
- **Regional wonders**: Cliff Monastery, Great Bridge, Observatory and Botanical Dome.
- **The late game**: build a **Harbour** to send settlers to other continents. Chart **sea routes** between harbour towns on different continents (ships sail them, each adds gold and room for another settlement). Make towns lovelier with **civic improvements**: town green, paved streets, fountain square, street lanterns and window boxes. Long-term goals include settling six continents.
- **Roads** form by themselves from each building to its town hall, and villagers walk along them.
- Works in portrait and landscape.

## Tuned for the Galaxy S26 Ultra
- Renders at up to 3× pixel density, with art drawn at 3× so it stays crisp on the QHD+ screen. Runs at the full 120 Hz refresh rate.
- **S Pen**: hover to see a tile's name. In Zones, the pen paints and fingers move the map. Hold the side button to erase.
- Immersive full screen (system bars hidden, swipe to peek). Landscape controls stay clear of the punch-hole camera.
- The Back gesture closes menus and modes. With nothing open, it sends the game to the background instead of quitting.

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
| `web/js/seasons.js` | Seasons per hemisphere, day and night |
| `web/js/regions.js` | Which building style a place uses |
| `web/js/folk.js` | Villagers' lives: names, families, jobs, skills, life events, chronicle |
| `web/js/life.js` | Weather, clouds, birds, animals, boats, roads, night lighting |
| `web/js/tutorial.js` | Pip the messenger bird's first-time guide |
| `web/js/audio.js` | Generative music, nature sounds, sound effects, haptics |
| `android-overrides/MainActivity.java` | Full screen and Back gesture handling, copied into the Android project at build time |

Map data: Natural Earth (public domain) via [world-atlas](https://github.com/topojson/world-atlas).
