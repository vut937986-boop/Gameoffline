# NEON BREW Development Guide

## Run The Game

Open `index.html` in a browser for local play. The page and game logic are static; no backend or login is required. Service-worker installation is available on secure origins such as HTTPS hosting, not `file://`.

For Android packaging, use Node.js 22 or newer, Android Studio, and an Android SDK, then run:

```powershell
npm install
npm run build:android
```

The build copies `index.html`, `manifest.webmanifest`, `icon.svg`, `sw.js`, `css/`, and `js/` into `www/` before Capacitor/Gradle builds the APK. There is currently no `test`, `lint`, or standalone browser-test script in `package.json`.

## Where Changes Belong Today

| Change | Current source of truth |
| --- | --- |
| Add/edit base recipe, ingredients, customer, faction, weather, decor, track, or story copy | `js/catalog.js` |
| Change recipe-to-ingredient mapping or order/brew behavior | `js/app.js` (`ingredientPalette`, order and brewing functions) |
| Change event odds, challenge generation, ransom, Matrix duration | `js/event-rules.js` |
| Change event cooldown, scheduling, or resolution | `js/app.js` (`processWorldEvents`, `startThreat`, resolvers) |
| Change quality, tips, reward, combo, XP, or unlock thresholds | `js/app.js` (quality/reward/progression functions) |
| Change save defaults, sanitation, migration, backup, or export/import | `js/app.js` (`initialState`, `loadState`, `save`, import/export handlers) |
| Change gameplay DOM or navigation | `index.html` and `js/app.js` |
| Change translations | `js/i18n/en.js`, `js/i18n/vi.js`; application logic is in `js/i18n.js` |
| Change reusable HTML/security helpers or log/star rendering | `js/core/helpers.js`, `js/core/render.js` |
| Change tutorial behavior | `js/core/tutorial.js` and tutorial handlers in `js/app.js` |
| Change jukebox/SFX or canvas scene animation | `js/app.js` |
| Change visual styles | `css/app.css`, `css/cyber-events.css`, `css/game-themes.css`, `css/responsive.css`, `css/playful-cafe.css`, `css/modern-cafe.css` |
| Change Android assets copied to `www/` | `scripts/prepare-mobile.cjs` |

Do not add a second recipe/customer/event catalog. Check the existing catalog and rules files first.

## Current Architecture Constraints

- `app.js` is a classic-script IIFE, not an ES module. It owns the single live `state` object and most gameplay/UI responsibilities.
- The other JavaScript files publish `window.NEON_BREW_*` globals. `index.html` script order is part of the runtime contract.
- Preserve the `neon-brew-save-v1` key, `modernCafeVersion: 7`, and the existing version-1 export envelope unless a migration is deliberately added and tested.
- A module must receive the existing state/dependencies; it must not manufacture a second live game state or reach into DOM from a gameplay system.
- Keep `catalog.js` as the recipe/customer/faction/event-data source and `event-rules.js` as the event-rule source.
- The application must remain static and playable offline, on GitHub Pages, and in the Capacitor WebView.

## Refactor Rules

> DO NOT add gameplay logic directly to `app.js` once a system module owns that responsibility.

> DO NOT create duplicate state, recipe, customer, faction, or event databases.

> DO NOT put DOM rendering inside gameplay systems or `localStorage` calls throughout gameplay code.

> DO NOT create circular dependencies or convert the whole app to `file://`-incompatible module loading in one step.

> DO NOT change formulas, progression, timers, save keys, or UI behavior during a move-only phase.

Refactor incrementally. After each phase, verify page load, console, order generation, brew/quality/reward, save/reload, export/import, and the phase-specific system. Stop and repair the current slice if behavior changes unexpectedly.

## Planned First Boundary

The first extraction is state/save because its dependencies are well-defined: pass catalog data, event rules, the storage interface, and status callbacks into a save manager; keep the one live state reference in the app bootstrap. Extract initial-state creation separately. Preserve classic script loading initially to retain direct-file compatibility, then consider ES modules only after confirming every target browser and delivery mode supports the change.