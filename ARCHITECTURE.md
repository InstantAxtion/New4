# Hearthlands architecture

How the game is put together, and how to add to it without it turning into a tangle.

## The big picture

```
web/
  index.html            the page: canvas, HUD, panels
  style.css             all styling (colour tokens at the top)
  data/                 world data files (country shapes)
  js/
    main.js             boot: builds the world and art, then runs the game loop
    core/               small, dependency-free building blocks
      events.js         the event bus (on / emit / off)
      migrations.js     save versions and save upgrades
      types.js          JSDoc shapes of the main objects (documentation only)
    data/               pure content tables (no logic): add content here
      resources.js  tiers.js  buildings.js  zones.js  research.js  talents.js  chapters.js
    game.js             state (S), the rules, the simulation step, saving and loading
    systems (each listens to the simulation through events):
      folk.js           villagers: names, families, jobs, skills
      life.js           weather, roads, animals, boats, night
      alive.js          little scenes, wildlife, light and sky effects
      explore.js        explorers, highways, shipyards, rare finds
      stories.js        festivals, requests, the royal family, year reports
      records.js        backups, trophies, history
      kingdoms.js       neighbouring kingdoms and migrations
      war.js            raids, garrisons, the field army
      city.js           roads first, demand, taxes and budget, land value, needs and abandonment, walls, fires
      seasons.js        calendar, seasons, day and night
    world.js  rivers.js  regions.js  noise.js   the Earth itself
    render.js           camera, the frame loop, the map (overview and tiles), labels
    render/
      canvas.js         drawing helpers (sprites, labels, shapes)
      walkers.js        villagers, visitors, carts and soldiers walking the streets
      effects.js        fireworks, building pops, festivals, yards, animated details
    sprites.js          builds all the art at start-up; SPR holds it
    sprites/
      kit.js            the drawing kit: isometric boxes, roofs, cones, windows...
      terrain.js        ground tiles, trees, hills and mountains
      homes.js          regional homes (STYLES) and their variants
      buildings.js      every other building
      creatures.js      animals, boats, zone markers and small things
    ui.js               HUD, sheets, mode bars, the act() switch, map taps and painting
    ui/
      common.js         shared helpers: $, esc, icons, cost chips, sheet headers, zone info
      build.js  research.js  army.js  progress.js  people.js  realm.js  town.js  settings.js  title.js
                        one file per panel or screen
    input.js            touch, mouse, pen and keyboard
    audio.js            music and sound, all generated
    tutorial.js         Pip's first-time guide
tests/                  browser tests (Playwright)
scripts/                tools for refactoring (moving code between modules, pruning imports)
```

`ui.js`, `render.js` and `sprites.js` re-export everything from their folders, so other modules can keep
importing from them. New code may import from the specific file directly.

There is no build step: the browser loads `web/` directly as ES modules, and the Android app wraps
the same folder with Capacitor.

## How data flows

1. **State lives in one place.** `S` in `game.js` holds everything that is saved: towns, buildings,
   stores, research, kingdoms and so on. Systems may keep caches, but never anything that has to
   survive a reload.
2. **The simulation steps in fixed slices.** `update()` turns real time into quarter-day `step()`s.
   Each step runs production, growth and goals, then emits `stepped`. Other systems (folk, war,
   stories, explore...) listen for `stepped` and do their own work, so `game.js` doesn't need to
   know about them.
3. **Events connect the parts.** Something happens → `emit('built', {...})`, `emit('tier', n)`,
   `emit('raid', raid)`... Anything can `on(...)` to react: the UI shows a toast, audio plays a
   chime, the renderer pops the building. Prefer an event over importing another system.
4. **Hooks break import cycles.** Where `game.js` needs an answer from a module that imports it
   (for example "is this tile a street?"), that module registers a callback (`setStreetCheck`,
   `setRulerFx`, `setCityHooks`...). Look for `set...` functions in `game.js`.
5. **Rendering reads state; it never changes it.** `render.js` draws from `S` every frame. The only
   state it owns is visual: walkers, particles, the camera.
6. **The UI is HTML strings.** Panels are built by `openSheet(kind, () => html)` and redrawn when
   the realm changes. Buttons carry `data-act="name" data-arg="value"`, handled in one place: the
   `act()` switch in `ui.js`.

## Recipes

### Add a building
1. Add an entry to `js/data/buildings.js`: `name`, `cost`, `time`, `tier`, and optionally `prod`
   (per day), `use` (inputs), `jobs`, `homes` (makes homes roomier), `store`, `research` (an idea that unlocks it),
   `cat` (`'everyday'`, `'goods'`, `'military'`...), and `desc`.
2. Draw it in `sprites.js` (`S.mytype = [frame((g) => { ... })]`). Helpers like `box`, `gable`,
   `cone` and `windows` keep the style consistent.
3. List it where the Build menu should show it (`MANUAL`, `EVERYDAY` or `GOODS_BUILDINGS` in
   `game.js`).
4. If its job has a name, add it to `JOBS` and a skill to `SKILLS` in `folk.js`.
5. Run `npm test`: the content check catches unknown resources or research.

### Add a zone
Add it to `js/data/zones.js` (pointing at a building with `zone: 'yourzone'`), give it a marker in
`sprites.js` (`SPR.misc.zone.yourzone = zoneMarker(...)`), and a line of help in `ZONE_TEXT` in
`ui.js`. Placement rules beyond the usual go in `canZoneAs` in `game.js`.

### Add a research idea
Add it to `js/data/research.js` with an `era`, `cost`, `req` (ids it needs) and `desc`, plus
`unlocks: ['building']` if it opens up a building (also set `research: 'id'` on that building).
Put its effect where it applies: `techMult()` for production, `techBuild()` for build speed, or
any rule via `hasTech('id')`.

### Add a talent or a goal chapter
Talents live in `js/data/talents.js` (effects via `hasTalent('id')`). Goals are `QUESTS` in
`game.js` (each has a `check()`), grouped into chapters in `js/data/chapters.js`.

### Add a whole new system
Create `js/yoursystem.js`, import what you need from `game.js`, and react to the world with
`on('stepped', (days) => ...)`. Keep its saved data on `S` (for example `S.yoursystem`), and add it
to `save()` and `load()` in `game.js`. Import the module once from `main.js`.

### Change the save format
Saves carry a version number. If you rename or restructure saved data, bump `SAVE_VERSION` in
`js/core/migrations.js` and add a migration that upgrades the previous version. Purely new,
optional fields need no migration (`load()` fills in defaults). Never edit a shipped migration.

## Checks

| Command | What it does |
| --- | --- |
| `npm run dev` | Serve the game at http://localhost:8080 |
| `npm run lint` | ESLint: undefined names, unused code, syntax errors |
| `npm test` | Playwright: boots the game, checks content tables, plays a realm, save/load, research, raids, and Pip's guide |
| `npm run check` | Both of the above |

Every push runs lint and tests on GitHub Actions, and the Android APK is only built if they pass.

## Keeping modules small
When a file grows past roughly 600 lines, split it. `scripts/split-module.py` moves groups of top-level
functions into new modules and wires up the imports and exports. It refuses to move code that writes
shared `let` state owned by another module (ES module imports are read-only), so give that state a small
setter first. Then run `npx eslint web/js -f json > lint.json && python3 scripts/prune-imports.py lint.json`
to remove imports that are no longer used, and finish with `npm run check`.

## Conventions

- Plain modern JavaScript (ES2023 modules), two-space indent, semicolons, single quotes.
- Content goes in `js/data/`, rules in the system that owns them, and pictures in `sprites.js`.
- Write player-facing text in plain, friendly words.
- New saved fields must be optional, or come with a migration.
- Keep `render.js` free of game rules, and keep `game.js` free of DOM access.
