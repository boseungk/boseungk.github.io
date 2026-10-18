# Static website architecture

## Publishing and source ownership

`docs/` is the website and the GitHub Pages source (`main` + `/docs`). The deleted root Ruby/Jekyll blog is unrelated to this deployment. `docs/CNAME` supplies the custom domain; `.nojekyll` prevents Jekyll processing. Privacy/404 pages are standalone HTML using `style.css` and `app.js`; the homepage uses `home.css` and feature CSS.

`tools/templates/home.ko.html` and `feedback.ko.html` own Korean content and semantic markup. `tools/build-locales.py` generates the 30 home/feedback route pairs, language menus, canonical/alternate metadata, sitemap and runtime copy from `assets/i18n/source.json`, `catalogs/` and `locales.json`. The locale registry mirrors Dayloom's `src/core/localization/locale-registry.ts`; the app's `support-links.ts` maps to these exact published routes. `build-english.py` remains a compatibility entry point. Missing keys, placeholders or inline markup fail the build; untranslated fallback pages are not published.

`MARCopy.text`, `.duration`, and `.taskSummary` translate at controller-owned text creation sites. The feedback module selects its compiled catalog from the static page language and uses the matching locale for dates/numbers and permanent links. Posts, comments and nicknames remain their author's original text, with automatic text direction. No DOM scanning or translation service is used. All locales inherit assets and cache URLs from the templates; phone demo UI stays Korean. Privacy pages retain their existing Korean/English content.

The language picker uses native language names, text search, keyboard navigation, and same-page links. Shared suggestion IDs and section hashes survive language changes. Arabic/Hebrew pages declare RTL direction, while artwork and phone demos retain LTR geometry. Turnstile language codes follow [Cloudflare's supported-language list](https://developers.cloudflare.com/turnstile/reference/supported-languages/); Bengali, Tamil and Swahili use English for that third-party verification widget only.

CSS loads in order: `home.css` (page foundation), `v4/hero.css` (hero), `v5/customize.css`, `journey.css`, `actions.css`, `rooms.css` (features), and `polish.css` (site chrome/shared accents/locale typography). The v3/v4/v5 paths are historical asset locations, not alternate active implementations. Removed standalone companion/world/routine/chapter layouts are not reintroduced.

## Runtime responsibilities

The feedback board is a separate static entry at `feedback/index.html` with an
English page generated from that same source. It shares header type, colors and
the language menu, but mounts no homepage animation controllers. Its `client.mjs`
owns bounded HTTP requests, desired-state votes and anonymous session preparation;
`feedback.js` owns plain-text DOM rendering, forms and draft-preserving list updates.
Read results cannot overwrite a newer write. Votes and comments serialize per idea;
comments merge by id in chronological order. User content is never translated or
inserted as HTML.

`services/feedback/` is outside Pages and owns Worker/D1 storage, verification,
quotas and operator maintenance. The app opens public locale URLs or a mail draft;
it does not upload its local journals, tasks or backup identity. Refer to the
service README for deployment and moderation, and `docs/privacy/` for public data
and the API-only visitor cookie notice.

| Owner | Responsibility |
| --- | --- |
| `home.js` | Global `mar:motion` pause, task phase canvases, statistics reveal; mounts customize and journey. |
| `v4/hero.js` | Deterministic scroll plateaus and native room/phone expansion, including distinct day, sunset and night holds and reverse scroll. |
| `v4/phone.js` | GLB shell, polygon-masked source-canvas display and SVG text layer lifetime; `getScreenRect`, `render`, `resize`, `destroy`. |
| `v4/room.js`, `screen.js` + `drawn-app.js`, v3 landscape/pet | Native drawing adapters and copied app renderer. |
| `v5/customize.js` | Four fixed-projection PNG stages from the default room to Flower Conservatory; keep previous decoded image during load/failure. |
| `v5/rooms.js` | Nine rooms, aligned day/sunset/night/lamp PNG layers, one pet canvas per room, visible 12-second carousel and local/global pause. |
| `v5/journey.js` | Native focus → completion → 740ms mark flight → Memory, 11-second sequence and 3-second final hold. |
| `v5/actions.js` | Local task demo, native check/burst, one-time 650ms sequential completion; preserves manual changes. |
| `v5/growth.js` | ES-module adapter driving unchanged native `createPlantTransition().seek()` at the 2400ms recipe duration. |
| `ui/selection-spec.js`, `selection-motion.js`, `selection.js` | Exported native curve/padding/palette/timing, analytic spring clock, and measured label adapters for navigation, language choice, phase progress and feedback sorting. |
| `v5/language-picker.js` | Native details menu keyboard/outside-click handling. |

On narrow screens the hero introduction flows before the sticky phone stage, so translated paragraphs cannot cover or shrink the phone. Header and introduction measurements keep scroll plateaus aligned; desktop retains the side-by-side layout.

Controllers own their animation clock, visibility/hidden-page pause and reduced-motion behavior. The global pause event is shared; there is no universal animation framework. Canvas/WebGL are progressive enhancement boundaries. Failed graphics loading keeps static content and exposes a diagnostic; it must not silently invent app state. Do not change the native app's source to customize this site.

`screen.js` owns the shared `MARPhoneText` adapter. It records native text coordinates, transforms and opacity, then paints SVG glyphs at the display's final CSS pixel size, with an 11.5px minimum. Artwork and control shapes remain on canvas. The journey's shared focus screen feeds the same collector, preventing duplicate glyphs; each frame replaces the previous phase's text. The phone mounts and resizes this layer only after graphics loading succeeds. It stays hidden until a fresh draw removes canvas glyphs; an unmounted or zero-size display keeps canvas text. Hero artwork is drawn while its font loads, then text is enabled. The dense memory trace row reserves a 6px minimum gap without changing canvas coordinates.

## Native exports

`tools/native-renderer.cjs` loads Dayloom TypeScript into a Canvas VM and resolves only documented native imports. Both export commands read the native app and write only `docs/assets/v5/`. Defaults are the local Dayloom checkout and bundled Codex Node modules; set `DAYLOOM_SOURCE` and `NATIVE_NODE_MODULES` to use other absolute paths.

```sh
node tools/render-customize.cjs
node tools/render-customize.cjs --stages-only
node tools/render-customize.cjs --dusk-only
node tools/render-customize.cjs --night-only
node tools/render-customize.cjs --night-only --unlit
node tools/render-growth.cjs
node tools/check-native-contours.cjs
```

Native exports require Dayloom's installed TypeScript and bundled `@napi-rs/canvas`. `--stages-only` refreshes the four Flower Conservatory customization stages and their bounds evidence. `--incremental-only` refreshes only room stages 0–2 while retaining the rest of the daytime manifest; use the full commands for a complete export. `--dusk-only` exports native time index 1 for all nine rooms, with lamps off. Carousel time is independent of pointer position and pauses offscreen; sunset artwork must load before playback starts. Per-slot bounds in `*render-evidence.json` must remain uncropped. The napi-rs `Path2D.addPath` correction concatenates independent SVG subpaths so closed contours cannot grow diagonal triangles; source-pattern validation fails if the upstream adapter changes. Transformed paths retain their existing branch.

`growth-motion/` contains six unchanged design-prototype modules. [native-growth-sources.json](native-growth-sources.json) records source-relative paths and SHA-256 hashes. `tools/check-site.py` checks these local copies without requiring the app checkout. Only native export/contour tests need that checkout.

## Checks and limitations

`check-site.py` checks every published page's local assets/anchors, all 30 locale contracts, room bounds evidence, native source hashes and the publishing boundary. `check-interactions.cjs` exercises real controllers using a small DOM/event fixture for timing/pause/manual state, image decode retry, locale output and Safari-safe menu behavior. `check-phone.cjs` uses vendored Three geometry with a mocked graphics driver to test direct-canvas ownership/mask/lifecycle and all three load fail-safe branches. The narrative check renders native drawing paths; the hero check samples scroll phases.

Browser QA is still required for actual GPU rendering, responsive composition, pointer/focus navigation and animation appearance. The fixtures exercise controller contracts, not a browser layout engine. No push or deployment is part of local cleanup.

`check-phone-text.cjs` measures actual canvas glyph calls and tests primary SVG rendering versus canvas fallback, all journey phases and reverse seek, font/minimum size, opacity/transforms, first-mount/zero-size behavior, dense-row spacing and teardown. Visual QA covered Chrome at 1202×960 and 390×844, plus the user's in-app browser. The WebGL failure path retains its original canvas/static typography; its browser screenshot was not part of this visual pass.

The homepage ends with FAQ and the contact footer; `#contact` targets the footer email and links. The former illustrated closing banner and its canvas controller have been removed.

The hero wall extension uses native tinted ink, matching the room at day, sunset and night; raw wall color would create a visible band above the drawing on mobile. `check-narrative.cjs` compares the extension and room pixels in all three states.

`assets/ui/wash.css` loads last on all public pages. Selection is measured from the padded inner label (10px horizontal, 5px vertical), separately from the larger hit target. Each mutually exclusive group has one SVG backdrop. First appearance/fade uses native 110ms in-out quadratic timing; changes move its x/y/width/height with mass 1, stiffness 484, damping 36.52, relative energy threshold 1e-7. Hidden-page and reduced-motion states settle without motion. Headings and ordinary unselected text have no decorative sweep. `tools/export-selection-spec.cjs` extracts the contract from actual app files and records hashes in `native-selection-sources.json`.

The product/development page, its footer links and sitemap entry are removed. The footer retains direct contact, feedback, social channels, FAQ and privacy. App icon exports now have transparent rounded corners (22% radius), including the favicon. Social app artwork remains unmodified.
