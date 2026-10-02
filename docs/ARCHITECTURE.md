# NEON BREW Architecture Map

This document describes the implementation that exists today. The module tree later in this file is a migration direction, not a claim that those modules already exist.

## Boot Path

`index.html` owns the DOM and loads classic scripts in this order:

```text
catalog.js ─┐
event-rules.js ─┤
i18n.js ───────┤
core/helpers.js ┤
core/render.js ─┤── app.js
core/tutorial.js┘
```

The data/core scripts publish `window.NEON_BREW_*` objects. `js/app.js` is a self-invoking closure and reads those globals after the browser has loaded them. It caches DOM nodes, loads UI settings and game state, applies offline earnings, repairs/normalizes the active order, attaches event handlers, renders the initial view, and starts the game tick when the player enters the game.

Keep this load order and the single state owner intact until a phase explicitly changes them. The current classic-script setup also supports opening the local HTML file directly; converting the whole app to ES modules would change that behavior in browsers that restrict `file://` module imports.

## Runtime Dependency Map

```text
index.html
  ├── js/catalog.js       → window.NEON_BREW_CATALOG
  ├── js/event-rules.js   → window.NEON_BREW_EVENT_RULES
  ├── js/i18n.js          → window.NEON_BREW_I18N
  │    └── js/i18n/{vi,en}.js → window.NEON_BREW_I18N_BUNDLES
  ├── js/core/helpers.js  → window.NEON_BREW_HELPERS
  ├── js/core/render.js   → window.NEON_BREW_RENDER
  ├── js/core/tutorial.js → window.NEON_BREW_TUTORIAL
  └── js/app.js           → game state, systems, DOM wiring, render, audio, loops
```

Data/core globals do not import the app. The app currently imports nothing; it reads their `window` objects. `catalog.js` is the source of truth for base recipes, ingredients, factions, named customers, weather, decor, tracks, and story-event copy. `event-rules.js` contains security randomization and event numeric rules; event scheduling and resolution remain in `app.js`.

## State And Save

There is one mutable `state` variable, declared in `app.js`. `initialState()`, `freshState()`, `withShiftDefaults()`, and `loadState()` are currently in the same closure. `state` is passed implicitly through closure scope, not stored in a second state container.

The primary save key is `neon-brew-save-v1`; the backup key is `neon-brew-backup-v1`. `save()` writes the same state snapshot to both. `modernCafeVersion` is the in-state schema version and is currently 7. Loads try the primary save, then the backup, normalize defaults and numeric fields, and migrate pre-v7 saves by retaining access to all six base recipes. Export/import keeps the existing `{ game, version: 1, state }` base64 JSON envelope.

UI theme/language preferences are separate under `neon-brew-ui-v1`. That is a UI preference record, not a second gameplay state.

## Current Ownership

| Responsibility | Current owner | Notes |
| --- | --- | --- |
| Initial state, live state, selectors, offline earnings | `js/app.js` | The app closure is the only state owner. |
| Save, backup, migration, sanitization, export/import | `js/app.js` | Direct `localStorage` access exists here. |
| Order generation, deadline, customer selection | `js/app.js` | Uses data from `catalog.js`. |
| Ingredient mapping, stock lots, expiry, research | `js/app.js` | Ingredient definitions live in the catalog. |
| Brewing steps, timing, quality, rewards, XP, combo | `js/app.js` | These systems share closure state and are coupled to completion flow. |
| Customer identity, faction reputation, loyalty | `js/app.js` | Profiles and faction definitions live in the catalog. |
| Security/story/weather/Matrix event scheduling and resolution | `js/app.js` | Numeric security rules are in `event-rules.js`. |
| Render and event wiring for all screens | `js/app.js` | Most DOM updates and listeners are inline in the IIFE. |
| Reusable escaping and security-answer parsing | `js/core/helpers.js` | Exposed as `window.NEON_BREW_HELPERS`. |
| Stars, log HTML, money formatting | `js/core/render.js` | Exposed as `window.NEON_BREW_RENDER`. |
| Tutorial lock helper | `js/core/tutorial.js` | Reads and mutates tutorial-related DOM. |
| Translation | `js/i18n.js` | Uses `MutationObserver`; locale bundles are data. |
| Jukebox and brew SFX | `js/app.js` | Web Audio contexts and their timers are app-owned. |
| Cafe canvas and visitor animation | `js/app.js` | `drawCafeScene()` also paints the intro canvas. |

## UI And Styles

`index.html` contains the intro, tutorial, shop, research, city, jukebox, archive, settings, and dialog DOM. The `data-view` tabs switch `.view-page` visibility. Runtime rendering uses a cached `$()` DOM lookup and direct element updates; some card lists are generated as HTML strings.

Styles load in this order: `css/app.css`, `cyber-events.css`, `game-themes.css`, `responsive.css`, `playful-cafe.css`, `modern-cafe.css`. Later files intentionally override earlier declarations. `modern-cafe.css` currently contains the active theme overrides and some gameplay component styles; `responsive.css` owns most mobile breakpoints.

## Loops And Timers

- The one-second `tick()` interval starts with the game session and advances orders, daily progress, weather/events, and saves.
- A 60ms canvas interval is created during app bootstrap; drawing is skipped while the document is hidden.
- The jukebox owns an 850ms note interval while music is enabled.
- Brew/result, toast, tutorial, visitor, and short visual effects use timeouts in `app.js`.
- The game uses `requestAnimationFrame` only inside the translation scheduling helper; gameplay canvas drawing uses the interval above.

Screen tab changes do not currently create separate gameplay loops. Timer ownership and cleanup must be preserved when extracting systems.

## Delivery And Tooling

The web runtime has no package-based test or lint script. `package.json` contains Capacitor Android build scripts and Capacitor dependencies. `scripts/prepare-mobile.cjs` copies the static app into `www/`; `scripts/build-android.cjs` invokes Capacitor and Gradle. `sw.js` caches the static app shell on secure origins. The page skips service-worker registration on `file://` while remaining directly playable from local files.

## Incremental Extraction Plan

1. Extract constants, initial-state creation, and save/load/migration behind injected dependencies. `app.js` must continue to own the one live state object and call the same functions in the same startup order.
2. Keep `catalog.js` and `event-rules.js` as the only base data/rules sources. Extract pure order, inventory, brewing, quality, reward, progression, and customer functions one system at a time.
3. Extract event/weather logic without introducing a second scheduler or state object.
4. Split DOM rendering/listeners by screen only after system contracts are stable. Keep tutorial and audio behavior intact.
5. Reduce `app.js` to orchestration only after each preceding boundary is browser-verified.

At every phase, compare the old/new behavior for order creation, one brew, quality/reward, save/reload, export/import, and browser console. No phase should reset or replace an existing save.