# Static website architecture

## Publishing and source ownership

`docs/` is the website and the GitHub Pages source (`main` + `/docs`). The deleted root Ruby/Jekyll blog is unrelated to this deployment. `docs/CNAME` supplies the custom domain; `.nojekyll` prevents Jekyll processing. Every page shares `site/base.css`, `site/chrome.css` and the native selection treatment (`ui/wash.css`); the 404 page uses the minimal header.

`tools/templates/home.ko.html`, `feedback.ko.html` and `news.ko.html` own Korean content and semantic markup. `tools/build-locales.py` generates the 30 home/feedback/news route sets, language menus, canonical/alternate metadata, sitemap and runtime copy from `assets/i18n/source.json`, `catalogs/` and `locales.json`. The locale registry mirrors Dayloom's `src/core/localization/locale-registry.ts`; the app's `support-links.ts` maps to these exact published routes. `build-english.py` remains a compatibility entry point. Missing keys, placeholders or inline markup fail the build; untranslated fallback pages are not published.

Runtime copy has no dictionary object or DOM scanning: the build inlines each page's keys as `<script type="application/json" id="page-copy">` (`sitebuild/copy.py`, keys found as single-quoted first arguments of `t(…)`/`text(…)` in the page's module graph) and `site/text.mjs` (`readCopy`, `createText`) reads it, formats `{x}` placeholders and numbers by locale, and throws on a missing key. Posts, comments and nicknames remain their author's original text, with automatic text direction. Phone-mockup UI text follows the page language. Privacy pages keep their authored content: `privacy.{ko,en}.html` at `/privacy/` and `/en/privacy/` (privacy links from other locales go to the English version) and `app-privacy.{ko,en,ja,zh-Hant}.html`. Policy copy is not translated by the marketing catalog. Until translation is done, `--draft` builds show Korean fallback under `data-i18n-draft` (see README).

The language picker uses native language names, text search, keyboard navigation, and same-page links. Shared suggestion IDs and section hashes survive language changes. Arabic/Hebrew pages declare RTL direction, while artwork and phone demos retain LTR geometry. Turnstile language codes follow [Cloudflare's supported-language list](https://developers.cloudflare.com/turnstile/reference/supported-languages/); Bengali, Tamil and Swahili use English for that third-party verification widget only.

CSS loads in this order on every page: `site/base.css` (tokens, reset, type scale, locale typography), `site/chrome.css` (header, footer, language picker, store buttons), one page stylesheet (`home/home.css`, `feedback/feedback.css`, `news.css`, `privacy.css` or `notfound.css`), then `ui/wash.css` last. The home loads `home/rooms.css` itself when the room wall mounts. CSS files contain no `url()` to art: art used by CSS comes through custom properties set in the page head. `@font-face` is emitted inline by the build, and each page declares and preloads only its own language's faces: the font the app uses for that language (Dayloom `src/core/localization/locale-fonts.ts`). Korean pages use LINE Seed KR; Latin, Cyrillic and Japanese use LINE Seed JP; Dutch and Vietnamese use Noto Sans; Thai uses LINE Seed TH; Simplified Chinese, Arabic, Hebrew, Hindi, Bengali and Tamil use their Noto families; Traditional Chinese uses the app's bundled Noto Sans TC, because LINE Seed TW reserves its font name and a subset may not carry it. `base.css` sets `--font-face` per language and `--hl-shift` so the highlight band keeps its height above the baseline in each face. `tools/assets/build-fonts.mjs` cuts the subsets from the Dayloom checkout (read-only, sha256-pinned); Han faces hold only the ideographs in use, so after copy changes in ja or zh run it again (`--check` and check-site's glyph group fail until then).

Classic `defer` scripts on every page: `ui/selection-spec.js`, `selection-motion.js`, `selection.js`, `site/language-picker.js` (every page except the 404), `site/chrome.js`. ES modules: `home/main.js` and `home/rooms/index.js` on the home, `feedback/feedback.js` on the board. `site/reveal.js` serves news.

## Runtime responsibilities

| Owner | Responsibility |
| --- | --- |
| `home/main.js` | Home entry. Section modules are `mount(root, ctx) -> {destroy()}` with `ctx = {motion, life, text, timeOf, palette}`; the hero mounts at once, other sections load and mount within one viewport. A module that throws is logged and its static markup stays. |
| `home/motion.js`, `life.js` | One page motion state (`paused` = visitor pause or reduced motion, `hidden`): sets `html.is-motion-paused`, dispatches `mar:motion`. `life()` registers every listener, observer, timer and frame so `destroy()` leaves nothing running. |
| `home/copy.js`, `choice.js`, `hourglass.js` | Page text, radio groups (roving tabindex, arrows mirrored in RTL), the app hourglass in SVG. |
| `home/hero.js`, `focus.js`, `decor.js`, `themes.js`, `records.js`, `night.js` | Sections 1-6: hero day/dusk/night cycle in the phone, focus prep sheet to completion, decor demo ending on the lake room, nine theme boards behind a diagonal light, records cues, night band. All are one-shot or visibility-driven, freeze when offscreen, hidden or paused, and show a final still under reduced motion. |
| `home/rooms/index.js`, `wall.js`, `view.js`, `life.js` | Recommended-rooms wall (101 rooms from the manifest) and the room view; assets load only on hover (300 ms), focus, press or open; keeps the current room plus two neighbours decoded. The room view follows the page-wide motion pause: when the page is paused, a room opens in the same still state as reduced motion. |
| `site/chrome.js`, `language-picker.js`, `reveal.js`, `text.mjs` | Header solid/stacked state, native `<details>` language menu, one-shot reveal, runtime text. |
| `feedback/client.mjs`, `feedback.js`, `motion.mjs`, `config.js` | Bounded HTTP, desired-state votes and anonymous session; plain-text rendering, forms and draft-preserving updates; calm WAAPI-only motion (rows rise, a vote swells, a new post opens with a fading wash; nothing ambient, none under reduced motion or in a hidden tab); public configuration. |
| `ui/selection-spec.js`, `selection-motion.js`, `selection.js` | Exported native curve/padding/palette/timing, analytic spring clock, measured label adapters for navigation, language choice, home choice groups (`[data-choice-group]`, follows `aria-checked`) and feedback sorting. |

The feedback board is a separate static entry mounting no home controllers. Read results cannot overwrite a newer write; votes and comments serialize per idea; comments merge by id in chronological order. User content is never translated or inserted as HTML. `services/feedback/` is outside Pages and owns Worker/D1 storage, verification, quotas and operator maintenance; the app opens public locale URLs or a mail draft and uploads no local records. See the service README and `/privacy/`.

Controllers own their clock, hidden-page pause and reduced-motion behavior. There is no universal animation framework. Canvas/WebGL are not used by the site; failed art or room loading keeps static content. The homepage ends with the closing CTA and the shared footer (`#contact`). Design rules: no glass, blur or shadow (except the faint floor shadow under `.phone`), font weight 400, one phone mockup on the home and none elsewhere.

## Build module map

`tools/build-locales.py` is the CLI (`--draft`, `--check`, `--only`, `--prune`, `--out`); the logic is in `tools/sitebuild/`. Modules register pages, placeholders and outputs at import time.

| Module | Contents |
| --- | --- |
| `core.py`, `cli.py` | locales, routes, catalogs (strict/draft), page and placeholder registries, build, write/check |
| `translate.py` | text/attribute/phrase-key translation (`data-phrase`, `translate="no"`, route localisation) |
| `draft.py` | Korean fallback, draft markers, `translation/untranslated.json`, `--prune` |
| `assets.py`, `stamp.py`, `importmap.py`, `fonts.py`, `copy.py`, `sw.py` | logical to hashed names, `?v=` stamping, import maps, inline fonts/preloads, `#page-copy`, service worker and keep list |
| `chrome.py` | header, footer, nav, language picker, store buttons |
| `community.py` | news links, latest news, news JSON-LD, feedback config |
| `home.py` | room still list and room runtime text `assets/i18n/runtime/rooms.<lang>.json` |
| `seo.py`, `notfound.py` | head meta (og, twitter, icons, JSON-LD), sitemap with the `tools/page-dates.json` ledger (bumped only by strict full builds); the single `docs/404.html` |

Placeholders (all resolved; none may survive into `docs/`): `<!--HEAD_COMMON-->`, `<!--HEAD_META-->` (`:minimal` for 404), `<!--LOCALE_ALTERNATES-->`, `<!--PAGE_COPY-->`, `<!--SITE_HEADER-->` (`:minimal`), `<!--SITE_FOOTER-->` (`:home`), `<!--SITE_NAV-->`, `<!--LANGUAGE_PICKER-->`, `<!--STORES:bar|footer|hero|closing-->`, `<!--ROOMS_STILL-->`, `<!--ROOMS_TEXT-->`, `<!--NEWS_LINKS-->`, `<!--LATEST_NEWS-->`, `<!--NEWS_JSONLD-->`, `<!--FEEDBACK_CONFIG-->`, `<!--NOT_FOUND_COPY-->`.

## Caching

- **Class 1, generated binaries** (fonts, art, room files and manifest, OG image): named `<base>.<sha256[:10]>.<ext>`, written only by `tools/assets/build-art.mjs`, `build-fonts.mjs` and `tools/rooms/build-room-assets.mjs`, recorded in `architecture/{art,font,room}-asset-sources.json`, never overwritten and never given `?v=`. A generator deletes a hashed file only when neither the current lock nor the lock at `HEAD` references it, so one deployed generation survives the HTML cache.
- **Class 2, hand-edited files** (CSS, JS, icons, `rooms.<lang>.json`): stable names; generated HTML stamps `?v=<sha10>`. Templates, CSS and JS never contain a version string and name assets by logical URL (`/assets/art/hero/lake-day.webp`); the build maps them. JS takes URLs from stamped `data-*` attributes or manifest entries, never from string fragments.
- **ES modules** are versioned by an import map per page (`<!--HEAD_COMMON-->`, with modulepreload for the home); specifiers stay bare so each module exists once. Browsers without import maps load the bare URLs.
- **GitHub Pages** serves everything with `max-age=600`, so HTML refreshes within ten minutes while stamped and hashed URLs change with their bytes. `check-build.py --verify-stamps docs` verifies every stamp.
- **Service worker** (`tools/templates/sw.js` to `docs/sw.js`; keep list `docs/assets/cache-keep.<h>.json`, named from its bytes): registers after load and idle on `www.myanimalroom.com` or `?sw=1`. Cache `mar-immutable-v1`, cache-first for same-origin GET requests whose URL is hashed or `?v=` stamped and whose bytes hash to that sha10; never pages, the feedback API, Turnstile, store links, other origins, Range requests or `cache-keep.*`. No precache and no offline page. At most 1600 entries (oldest room files go first). On activation, entries not in the keep list (every hashed or stamped URL the pages reference, plus room and font locks) are pruned; no usable list prunes nothing. `?sw=off` is the kill switch (README). Full builds write both files; `--only` never does.

## Room data contract

`tools/rooms/rooms.json` is the authored list (101 recommended rooms, `rain-leaf-room` excluded; `{id, name, theme, place, wall, description}`). `build-room-assets.mjs` writes `docs/assets/rooms/<id>/*.<h>.webp` and `manifest.<h>.json` (logical `/assets/rooms/manifest.json`). Manifest v2: `{version, scene, layerScale, frame, paintOrder, assemblyOrder, order, rooms}`; each room has `wall`, `theme`, `place`, `structure`, `season`, `thumb`, `day`, `tod{dusk,night,lit}`, `layers[{slot,src,x,y,w,h,z}]`, `items[{slot,item,variant,thumb,layer}]`, `kb`. Paths are relative to the manifest. Room text is `docs/assets/i18n/rooms/source.json` (Korean) plus `catalogs/<locale>.json`; `home.py` writes `runtime/rooms.<lang>.json`. The static `ol.rooms-still` holds 12 rooms with thumbnails and translated captions for no-JS visitors. Before a tile is hovered, focused or opened, only the manifest, the text file and thumbnails are requested.

## Native exports

`tools/native-renderer.cjs` loads Dayloom TypeScript into a Canvas VM and resolves only documented native imports; the app checkout is read-only. Defaults are the local Dayloom checkout and bundled Codex Node modules; set `DAYLOOM_SOURCE`, `NATIVE_NODE_MODULES` and `TYPESCRIPT_PATH` to use other absolute paths. Exports write unpublished masters under `tools/assets/src/`; `tools/assets/build-art.mjs` encodes them into hashed files under `docs/assets/art/`.

```sh
node tools/render-customize.cjs            # --stages-only, --dusk-only, --night-only [--unlit], --incremental-only; writes tools/assets/src/customize
node tools/export-growth.cjs               # --svg-only writes only tools/assets/src/growth/*.svg
node tools/export-selection-spec.cjs       # docs/assets/ui/selection-spec.js and native-selection-sources.json
node tools/check-native-contours.cjs
node --test tools/check-growth.mjs
```

The napi-rs `Path2D.addPath` correction concatenates independent SVG subpaths so closed contours cannot grow diagonal triangles; source-pattern validation fails if the upstream adapter changes. [native-growth-sources.json](native-growth-sources.json) records the native drawing and lifecycle sources of the growth flower and their hashes; `check-growth.mjs` compares a fresh export with the committed masters. The home plays one growth stage transition (sprout to stem) and one bud-to-bloom cross-fade, each 2400 ms on the plant easing, and shows the final stage under reduced motion.

## Checks and limitations

README lists every check. `check-site.py` covers the published tree and `check-build.py` the build; browser QA (`tools/qa/`) covers real layout, pointer/focus, timing and motion. Fixtures exercise contracts, not a layout engine, and translated strings are not yet present, so long-locale fit is judged with `matrix.mjs --rtl-stress`. No push or deployment is part of local work.

`ui/wash.css` loads last on all public pages. Selection is measured from the padded inner label (10px horizontal, 5px vertical), separately from the larger hit target. Each mutually exclusive group has one SVG backdrop. First appearance/fade uses native 110ms in-out quadratic timing; changes move its x/y/width/height with mass 1, stiffness 484, damping 36.52, relative energy threshold 1e-7. Hidden-page and reduced-motion states settle without motion. Headings and ordinary unselected text have no decorative sweep. `tools/export-selection-spec.cjs` extracts the contract from actual app files and records hashes in `native-selection-sources.json`.

The product/development page is removed. The footer has feedback, news, contact email, the website and app privacy pages, and the official channels (YouTube, Threads, Instagram). App icon exports have transparent rounded corners (22% radius), including the favicon.


## Participation navigation (2026-10-19)

`build-locales.py` supplies the same two-item header to all three templates:
Feature suggestions and News, each pointing to a real localized route. The
wordmark leads to the landing page. `aria-current` drives the existing native
selection wash; language switching stays within the corresponding page.

Feedback starts with the suggestion list and a collapsed, keyboard-operable
writing disclosure. Closing it retains the draft; successful submission closes
it and focuses the newly posted suggestion. Existing anonymous votes, comments
and operator replies are retained. Database migration 0002 adds the operator-only
`open/reviewing/planned/completed` status; new suggestions have no implied promise
or review badge. Public writes cannot set that state.

News is static, dated editorial content in `news.ko.html`, translated through the
same 30-language catalogs and included in the sitemap. It loads no feedback API
or homepage graphics. The first note introduces the actual existing suggestion
board; no app release or invented community activity is announced. Add further
entries with stable article IDs so operator replies can link to shipped updates.

The privacy document uses the same header, two-page navigation, LINE typography, white background and compact footer as the feedback/news pages. `assets/privacy.css` only sets reading width, section rhythm and document type sizes. The legacy stylesheet is no longer loaded. The 2026-10-19 privacy wording revision retains the processing purposes, public post fields, provider disclosures, 90-day participation-cookie duration and contact/removal process while removing cookie code names, token hashing, API scoping and database product details. It adds browser cookie controls and keeps both authored language versions aligned. This is explanatory copy cleanup, not a claim of a full security or legal audit.
