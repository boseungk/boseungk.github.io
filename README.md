# MyAnimalRoom landing website

This repository contains the public MyAnimalRoom product website. `docs/` is the permanent GitHub Pages publishing directory (`main` branch, `/docs` folder), not a temporary staging folder. It is served at the domain root; visitors do not see `/docs` in the URL.

The site frontend is static HTML, CSS and browser JavaScript, without Jekyll or a site bundler. Product information and room/growth illustrations remain readable without JavaScript. The interactive previews demonstrate the app; they do not create focus sessions or save visitor data. Only the public suggestions board uses a separate storage API, described below.

## Develop and verify

From the repository root, use Node 22.12+ (`node` below). Set `NATIVE_NODE_MODULES` for optional native-renderer dependencies. Private app sources are read only when `DAYLOOM_SOURCE` is explicitly set.

```sh
python3 -m http.server 8765 --directory docs
```

Open `http://127.0.0.1:8765/` (English fallback with browser-language routing), `/ko/` and `/en/`. Edit the Korean templates (`tools/templates/home.ko.html`, `feedback.ko.html`, `news.ko.html`, `404.ko.html`, `partials/`) and the feature files under `docs/assets/`; never edit generated HTML. Website text lives in `docs/assets/i18n/source.json` (Korean keys, English reference), the locale catalogs and `docs/assets/i18n/rooms/`. Regenerate after every change:

```sh
python3 tools/build-locales.py --draft          # dev loop: all pages; --only home,feedback,news,privacy,app-privacy,404 for a few
python3 tools/build-locales.py --check --draft  # the committed docs/ equals a fresh build
```

`--draft` falls back to Korean for untranslated keys, marks those pages (`data-i18n-draft`, `noindex`) and writes `translation/untranslated.json`. A plain `python3 tools/build-locales.py` (strict) fails while keys are missing. `--only` never writes shared outputs (sitemap, service worker, keep list).

### Checks (run all before handing over)

```sh
python3 tools/build-locales.py --draft && python3 tools/build-locales.py --check --draft
python3 tools/check-build.py && python3 tools/check-build.py --verify-stamps docs
python3 tools/check-site.py --allow-draft         # at release: without --allow-draft
node --test tools/check-feedback-client.mjs tools/check-locales.mjs tools/check-home.mjs tools/check-chrome.cjs
node tools/check-selection.cjs
TYPESCRIPT_PATH=<a typescript 5 package directory> node tools/check-native-contours.cjs
TYPESCRIPT_PATH=<a typescript 5 package directory> node --test tools/check-growth.mjs
node tools/rooms/build-room-assets.mjs --check && node tools/assets/build-art.mjs --check && node tools/assets/build-fonts.mjs --check
(cd services/feedback && npm run check && npm test)   # with node on PATH
```

| Check | What it covers |
|---|---|
| `check-site.py` | the generated site, in named groups: publishing boundary (no `/app/`, `/site/`, `samples/` URL), link and anchor integrity, stamps and import maps, the three asset locks (hash, size, strays), room manifest completeness, `<img>` size attributes against the files, orphan files, the 30 locale contracts, header/footer/phone counts, home markup (3 App Store links, Play without `href`, 12-room still list), SEO (og:image, JSON-LD, sitemap, no release-status claims), banned CSS and token-only colours, glyph coverage against the font lock (every page's text within its language's faces), service worker registration and the cache keep list, and the deploy guard (draft markers and Hangul on non-ko pages; skipped by `--allow-draft`). `SITE_DOCS=<copy of docs>` points it at another tree. |
| `check-build.py` | the build itself: phrase keys, draft report, `--only`, stamping, locks, import maps, fonts, service worker, `--verify-stamps` |
| `check-locales.mjs` | `#page-copy` of every language (routes, formats, placeholders, keys equal to the module graph), room text for 101 rooms, policy routes, brand |
| `check-home.mjs` | home source contracts: module shape, nothing started outside `life`, timings, copy keys, template rules, names from the app catalog |
| `check-chrome.cjs`, `check-selection.cjs`, `check-feedback-client.mjs` | shared chrome and language picker, selection wash, board client |
| `check-growth.mjs` | the flower stage SVGs in `tools/assets/src/growth/` equal a fresh export from the app source (skips without Dayloom and TypeScript) |
| `build-room-assets.mjs`, `build-art.mjs`, `build-fonts.mjs` with `--check` | the room, art and font locks: lists equal locks, every hashed name equals its file's `sha256[:10]` |

Browser checks need the static server and the Chrome that listens on port 9333 (they never launch one; read each file's header for flags):

```sh
node tools/qa/home-browser.mjs                       # hero phases, pause, hidden tab, demos, no-JS, mount/destroy leaks, room view, layout
node tools/qa/matrix.mjs --pages /,/feedback/,/news/ --locales ko,en,ar --views desktop,phone --also-reduced --expect-phones 1 --css-grep   # --rtl-stress for long or RTL strings
node tools/qa/community-qa.mjs                       # board and news (needs the local API on :8789)
node tools/qa/sw-qa.mjs                              # service worker, in an isolated browser context
node tools/qa/weigh.mjs http://127.0.0.1:8765/ --dpr 2   # cold-load transfer by type, gzip size of text
```

The build and `check-site.py`/`check-build.py` need Python 3. Canvas/native checks additionally need `@napi-rs/canvas` from the bundled runtime and Dayloom's TypeScript (`TYPESCRIPT_PATH`). Native export and asset generator setup is in [architecture/website.md](architecture/website.md).

### Translation handoff

The authoring templates are Korean-first; public Korean pages live under `/ko/`. Until translation, every other locale shows Korean fallback text under `data-i18n-draft`; that is expected. Codex translates all 29 other locales last:

1. `python3 tools/build-locales.py --draft`, then read `translation/untranslated.json` (keys with contexts, kinds, placeholder/markup rules, app wording suggestions; deterministic).
2. Fill `docs/assets/i18n/source.json` (English), the 28 files in `docs/assets/i18n/catalogs/` and `docs/assets/i18n/rooms/catalogs/<locale>.json`.
3. `python3 tools/build-locales.py --prune` removes unused keys; `node tools/assets/build-fonts.mjs` re-cuts the per-language font subsets (Han faces follow the ja/zh copy) and `--report` lists characters a language uses outside its faces.
4. Strict build: `python3 tools/build-locales.py && python3 tools/build-locales.py --check && python3 tools/check-site.py && node --test tools/check-locales.mjs`, then the browser matrix with `--rtl-stress` and a long-locale pass (de, ta, ru). Delete `translation/` when strict is green.

### Service worker kill switch

`docs/sw.js` is generated from `tools/templates/sw.js` (see `tools/sitebuild/sw.py`). It registers only on `www.myanimalroom.com` (or with `?sw=1`) and caches immutable same-origin files only. `?sw=off` on any page unregisters every worker and deletes the `mar-*` caches. To retire it for everyone, replace `tools/templates/sw.js` with the self-unregistering worker shown in `sw.py`'s docstring (no `__KEEP_URL__` token, so the template is copied verbatim) and rebuild.

### Language entry

All canonical pages have a language prefix, including `/ko/` and `/en/`. `/` serves the full English home when JavaScript is unavailable or for crawlers. With JavaScript, first visits select the first supported browser language (English when none match); a language explicitly selected in the picker takes priority. Automatic routing runs only at `/` and `/index.html`, so direct localized links stay in their requested language. Query strings and fragments survive routing. The former Korean `/feedback/`, `/news/`, `/privacy/` and `/app-privacy/` URLs remain readable aliases and redirect to `/ko/` while preserving shared suggestion links. Aliases canonicalize to their destination and are excluded from the sitemap.

Actual Chrome coverage (fresh contexts for all 30 languages, saved choices, direct URLs, aliases and no-JavaScript fallback):

```sh
PLAYWRIGHT_PATH=/path/to/node_modules/playwright-core node tools/qa/language-entry-browser.cjs http://127.0.0.1:8765
```

### Link previews

KakaoTalk caches link previews by page URL, not by image URL. After changing `og:image` (a new hashed file under `docs/assets/art/og/`), deploy, then purge the page in the Kakao Developers sharing debugger (<https://developers.kakao.com/tool/debugger/sharing>).

## Project boundaries

- `docs/`: all published pages, fonts, artwork, room assets and page controllers (generated by the build, so no hand edits to HTML, `sw.js`, `cache-keep.*.json` or hashed files).
- `tools/`: the build (`sitebuild/`, `templates/`), asset and room generators, native export and regression checks, QA harness (`qa/`).
- `architecture/`: ownership/build notes, asset and native source locks and bounded cleanup evidence.

`docs/index.html`, all localized home/feedback/news pages and their runtime copy are generated from the Korean templates and `assets/i18n/` catalogs. The 30 locale entries mirror the app registry, including distinct simplified/traditional Chinese and Brazilian/European Portuguese. Do not edit generated HTML. The phone mockup in the hero uses the app's own artwork with DOM text. Product information and room illustrations remain readable without JavaScript.

GitHub Pages serves the checked-in `docs/` directly. Preserve `docs/.nojekyll` and `docs/CNAME`; publishing remains the repository's existing Pages setting. There is no custom deploy workflow in this repository.

## Public suggestions and support

`/ko/feedback/` and `/en/feedback/` provide an anonymous suggestions board: optional nickname, votes and single-level comments. Private support remains `contact@myanimalroom.com`. The board is independent of the app's local records and backup account.

- `docs/assets/feedback/`: accessible page controller, API client, calm one-shot motion (`motion.mjs`) and public configuration; copy comes from the page's inline `#page-copy`. All localized HTML/runtime copy is generated by `tools/build-locales.py`; edit `tools/templates/feedback.ko.html` and `assets/i18n/` catalogs.
- `services/feedback/`: Cloudflare Worker, D1 migration, API tests and moderation/backup instructions. This directory is outside the GitHub Pages publishing root. Production uses `feedback-api.myanimalroom.com` and the explicitly selected `wrangler.production.jsonc`; default Wrangler configuration is local development.
- Public site keys and resource IDs are configuration, not credentials. Turnstile secrets stay in the Worker; do not put them in `docs/` or Git.

For a local end-to-end preview, keep the static server on `127.0.0.1:8765`, then follow `services/feedback/README.md` to run the API on `127.0.0.1:8789`. Local data and official Turnstile test keys are separate from production. A failed API connection is shown as an error, never as an empty board or a successful submission.

Before publishing, run the static/locale checks, `node --test tools/check-feedback-client.mjs tools/check-locales.mjs`, and `npm test` in `services/feedback`. Deploy and verify the API before publishing the static pages. Existing posts are public; perform UI testing against local data and keep any production smoke data out of the public list after verification.

## Mobile app privacy

The app policy is authored separately in `tools/templates/app-privacy.{ko,en,ja,zh-Hant}.html`, then generated at `/ko/app-privacy/`, `/en/app-privacy/`, `/ja/app-privacy/`, and `/zh-hant/app-privacy/`. All four versions share language navigation and sitemap entries. The website/board policy remains a separate Korean/English document. Policy copy is not translated by the marketing catalogs: keep the meaning of all authored app-policy versions aligned and regenerate with `python3 tools/build-locales.py`. Translation alone does not change the policy's effective date or establish country-specific legal compliance.

## Attribution

The previous blog used [Jekyll YAT](https://github.com/jeffreytse/jekyll-theme-yat), copyright 2019 Jeffrey Tse. Its original [MIT license](LICENSE.txt) is retained. Artwork, fonts and native source have their own attribution in [docs/assets/ASSET-SOURCES.md](docs/assets/ASSET-SOURCES.md) and the font licences in `docs/assets/fonts/` (`OFL-*.txt`).
