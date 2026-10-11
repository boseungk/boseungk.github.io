# Static website architecture

## Publishing and source ownership

`docs/` is the website and the GitHub Pages source (`main` + `/docs`). The deleted root Ruby/Jekyll blog is unrelated to this deployment. `docs/CNAME` supplies the custom domain; `.nojekyll` prevents Jekyll processing. Product/privacy/404 pages are standalone HTML using `style.css` and `app.js`; the homepage uses `home.css` and feature CSS.

`docs/index.html` owns Korean content, semantic sections and no-script images. `tools/build-english.py` translates it with `assets/v5/en-copy.json` into `en/index.html` and generates the shared `copy.js` runtime API. The build rejects missing static/literal-runtime copy. `MARCopy.text`, `.duration`, and `.taskSummary` translate only at controller-owned text creation sites. No DOM scanning or mutation observer is used. English inherits all asset/cache URLs from the Korean source. Native app canvas UI stays Korean deliberately.

CSS loads in order: `home.css` (page foundation), `v4/hero.css` (hero), `v5/customize.css`, `journey.css`, `actions.css`, `rooms.css` (features), and `polish.css` (site chrome/shared accents/locale typography). The v3/v4/v5 paths are historical asset locations, not alternate active implementations. Removed standalone companion/world/routine/chapter layouts are not reintroduced.

## Runtime responsibilities

| Owner | Responsibility |
| --- | --- |
| `home.js` | Global `mar:motion` pause, closing landscape/task phase canvases, statistics reveal; mounts customize and journey. |
| `v4/hero.js` | Deterministic scroll plateaus and native room/phone expansion, including reverse scroll. |
| `v4/phone.js` | GLB shell and direct source-canvas display with front-face polygon mask; `getScreenRect`, `render`, `resize`, `destroy`. |
| `v4/room.js`, `screen.js` + `drawn-app.js`, v3 landscape/pet | Native drawing adapters and copied app renderer. |
| `v5/customize.js` | Four fixed-projection incremental PNG stages; keep previous decoded image during load/failure. |
| `v5/rooms.js` | Nine rooms, aligned day/unlit/lamp PNG layers, one pet canvas per room, visible 8-second carousel and local/global pause. |
| `v5/journey.js` | Native focus → completion → 740ms mark flight → Memory, 11-second sequence and 3-second final hold. |
| `v5/actions.js` | Local task demo, native check/burst, one-time 650ms sequential completion; preserves manual changes. |
| `v5/growth.js` | ES-module adapter driving unchanged native `createPlantTransition().seek()` at the 2400ms recipe duration. |
| `v5/language-picker.js`, `polish.js` | Native details menu keyboard/outside-click handling and quiet heading wash. |

Controllers own their animation clock, visibility/hidden-page pause and reduced-motion behavior. The global pause event is shared; there is no universal animation framework. Canvas/WebGL are progressive enhancement boundaries. Failed graphics loading keeps static content and exposes a diagnostic; it must not silently invent app state. Do not change the native app's source to customize this site.

## Native exports

`tools/native-renderer.cjs` loads Dayloom TypeScript into a Canvas VM and resolves only documented native imports. Both export commands read the native app and write only `docs/assets/v5/`. Defaults are the local Dayloom checkout and bundled Codex Node modules; set `DAYLOOM_SOURCE` and `NATIVE_NODE_MODULES` to use other absolute paths.

```sh
node tools/render-customize.cjs
node tools/render-customize.cjs --night-only
node tools/render-customize.cjs --night-only --unlit
node tools/render-growth.cjs
node tools/check-native-contours.cjs
```

Native exports require Dayloom's installed TypeScript and bundled `@napi-rs/canvas`. `--incremental-only` refreshes only room stages 0–2 while retaining the rest of the daytime manifest; use the full commands for a complete export. Per-slot bounds in `*render-evidence.json` must remain uncropped. The napi-rs `Path2D.addPath` correction concatenates independent SVG subpaths so closed contours cannot grow diagonal triangles; source-pattern validation fails if the upstream adapter changes. Transformed paths retain their existing branch.

`growth-motion/` contains six unchanged design-prototype modules. [native-growth-sources.json](native-growth-sources.json) records source-relative paths and SHA-256 hashes. `tools/check-site.py` checks these local copies without requiring the app checkout. Only native export/contour tests need that checkout.

## Checks and limitations

`check-site.py` checks every published page's local assets/anchors, both locale contracts, room bounds evidence, native source hashes and the publishing boundary. `check-interactions.cjs` exercises real controllers using a small DOM/event fixture for timing/pause/manual state, image decode retry, locale output and Safari-safe menu behavior. `check-phone.cjs` uses vendored Three geometry with a mocked graphics driver to test direct-canvas ownership/mask/lifecycle and all three load fail-safe branches. The narrative check renders native drawing paths; the hero check samples scroll phases.

Browser QA is still required for actual GPU rendering, responsive composition, pointer/focus navigation and animation appearance. The fixtures exercise controller contracts, not a browser layout engine. No push or deployment is part of local cleanup.
