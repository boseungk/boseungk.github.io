# MyAnimalRoom landing website

This repository contains the public MyAnimalRoom product website. `docs/` is the permanent GitHub Pages publishing directory (`main` branch, `/docs` folder), not a temporary staging folder. It is served at the domain root; visitors do not see `/docs` in the URL.

The site is static HTML, CSS and browser JavaScript. There is no Jekyll, bundler or server-side app. Product information and room/growth illustrations remain readable without JavaScript. The interactive previews demonstrate the app; they do not create focus sessions or save visitor data.

## Develop and verify

From the repository root:

```sh
python3 -m http.server 8765 --directory docs
```

Open `http://127.0.0.1:8765/` (Korean) and `/en/` (English). Edit `docs/index.html` and the feature files under `docs/assets/`; regenerate the English page and runtime copy after changing text:

```sh
python3 tools/build-english.py
python3 tools/build-english.py --check
python3 tools/check-site.py
node tools/check-hero-scroll.cjs
node tools/check-interactions.cjs
node tools/check-phone.cjs
node tools/check-narrative.cjs
node tools/check-native-contours.cjs
```

The first three commands require Python 3. Controller checks use Node.js; canvas/native checks additionally need `@napi-rs/canvas` from the bundled Codex Node runtime. On this workstation, Node is `/Users/gpt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`. Native export/check setup is documented in [architecture/website.md](architecture/website.md).

## Project boundaries

- `docs/`: all published pages, local fonts/vendors/artwork and page controllers.
- `tools/`: repeatable English generation, native artwork export and regression checks.
- `architecture/`: ownership/build notes, native source hashes and bounded cleanup evidence.

`docs/en/index.html` and `docs/assets/v5/copy.js` are generated from the Korean homepage and `en-copy.json`. Edit their sources. The Korean app canvas is intentional in both site languages. Six modules in `growth-motion/` are unchanged copies of the Dayloom design prototype; change the web adapter instead of those modules.

GitHub Pages serves the checked-in `docs/` directly. Preserve `docs/.nojekyll` and `docs/CNAME`; publishing remains the repository's existing Pages setting. There is no custom deploy workflow in this repository.

## Attribution

The previous blog used [Jekyll YAT](https://github.com/jeffreytse/jekyll-theme-yat), copyright 2019 Jeffrey Tse. Its original [MIT license](LICENSE.txt) is retained. Artwork, fonts, native source, Three.js and social marks have their own attribution in [docs/assets/ASSET-SOURCES.md](docs/assets/ASSET-SOURCES.md), `OFL-LINESeedKR.txt`, and `vendor/THREE-LICENSE.txt`.
