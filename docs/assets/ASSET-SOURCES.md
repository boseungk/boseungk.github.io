# Website asset sources

These files are copied from the Dayloom app repository without redrawing or editing the artwork.

## Theme boards

The theme PNGs are **illustrated room/theme boards, not screenshots of the native app**. Labels map directly to the original theme key and filename:

| Theme label / key | Website file | Exact source | Dimensions | Bytes |
| --- | --- | --- | --- | ---: |
| Forest (`forest`) | `themes/forest.png` | `/Users/gpt/Projects/dayloom/assets/images/collection/themes/forest.png` | 624 × 688 | 76,198 |
| Lake (`lake`) | `themes/lake.png` | `/Users/gpt/Projects/dayloom/assets/images/collection/themes/lake.png` | 624 × 688 | 136,249 |
| Coast (`coast`) | `themes/coast.png` | `/Users/gpt/Projects/dayloom/assets/images/collection/themes/coast.png` | 624 × 688 | 57,056 |
| Garden (`garden`) | `themes/garden.png` | `/Users/gpt/Projects/dayloom/assets/images/collection/themes/garden.png` | 624 × 688 | 103,866 |
| Winter (`winter`) | `themes/winter.png` | `/Users/gpt/Projects/dayloom/assets/images/collection/themes/winter.png` | 624 × 688 | 69,444 |
| Space (`space`) | `themes/space.png` | `/Users/gpt/Projects/dayloom/assets/images/collection/themes/space.png` | 624 × 688 | 73,350 |
| Retro (`retro`) | `themes/retro.png` | `/Users/gpt/Projects/dayloom/assets/images/collection/themes/retro.png` | 624 × 688 | 85,820 |
| Cloud (`cloud`) | `themes/cloud.png` | `/Users/gpt/Projects/dayloom/assets/images/collection/themes/cloud.png` | 624 × 688 | 56,244 |
| Mineral (`mineral`) | `themes/mineral.png` | `/Users/gpt/Projects/dayloom/assets/images/collection/themes/mineral.png` | 624 × 688 | 61,937 |
| Common (`common`) | `themes/common.png` | `/Users/gpt/Projects/dayloom/assets/images/collection/themes/common.png` | 624 × 688 | 64,897 |

## Native growth specimens

These small 260 × 220 PNGs are stage-5 growth illustrations rendered from the app's native drawing paths. They are object artwork exports, not full-screen screenshots or historical web mockups.

| Specimen | Website file | Exact source | Dimensions | Bytes |
| --- | --- | --- | --- | ---: |
| Bird | `native/bird-4.png` | `/Users/gpt/Projects/dayloom/.ai-bridge/growth-retire-20261009/growth/bird-4.png` | 260 × 220 | 8,400 |
| Flower | `native/flower-4.png` | `/Users/gpt/Projects/dayloom/.ai-bridge/growth-retire-20261009/growth/flower-4.png` | 260 × 220 | 10,395 |
| Stone | `native/stone-4.png` | `/Users/gpt/Projects/dayloom/.ai-bridge/growth-retire-20261009/growth/stone-4.png` | 260 × 220 | 7,533 |
| Tree | `native/tree-4.png` | `/Users/gpt/Projects/dayloom/.ai-bridge/growth-retire-20261009/growth/tree-4.png` | 260 × 220 | 15,974 |

The app render log for this source set records `growth-art.render.ts` passing with the test description “all growth stages use real native paths, stable caches and identical live/still drawing.”

### Stage progression specimens

These are additional frames from the same flower/tree objects, indexed 0, 2, and 4 (early, middle, mature). They let the site show growth progression without switching specimen types. All are native-path render exports from the October 9, 2026 source set.

| Specimen / stage | Website file | Exact source | Dimensions | Bytes |
| --- | --- | --- | --- | ---: |
| Flower 0 | `native/flower-0.png` | `/Users/gpt/Projects/dayloom/.ai-bridge/growth-retire-20261009/growth/flower-0.png` | 260 × 220 | 4,606 |
| Flower 2 | `native/flower-2.png` | `/Users/gpt/Projects/dayloom/.ai-bridge/growth-retire-20261009/growth/flower-2.png` | 260 × 220 | 6,764 |
| Tree 0 | `native/tree-0.png` | `/Users/gpt/Projects/dayloom/.ai-bridge/growth-retire-20261009/growth/tree-0.png` | 260 × 220 | 5,577 |
| Tree 2 | `native/tree-2.png` | `/Users/gpt/Projects/dayloom/.ai-bridge/growth-retire-20261009/growth/tree-2.png` | 260 × 220 | 7,514 |

### Paired outdoor scenery

These three outdoor tiles are from the Dayloom scenery pair render set dated October 10, 2026. Its manifest identifies the renderer as “Exact scenery pair preview / composed Skia,” the pane size as 240 × 260, and each scene as part of an indoor/outdoor source pair. The selected files are the outdoor half. They are individual scene renders, not diagnostic grids or full device screenshots.

| Scene | Website file | Exact source | Dimensions | Bytes |
| --- | --- | --- | --- | ---: |
| Mist forest | `native/outdoor-mist-forest.png` | `/Users/gpt/Projects/dayloom/.ai-bridge/scenery-refine-20261010/after/individual/study-mist-forest-outdoor.png` | 240 × 260 | 25,843 |
| Rose lake | `native/outdoor-rose-lake.png` | `/Users/gpt/Projects/dayloom/.ai-bridge/scenery-refine-20261010/after/individual/open-rose-lake-outdoor.png` | 240 × 260 | 5,300 |
| Starlit coast | `native/outdoor-starlit-coast.png` | `/Users/gpt/Projects/dayloom/.ai-bridge/scenery-refine-20261010/after/individual/study-starlit-coast-outdoor.png` | 240 × 260 | 6,838 |

## Fonts

`docs/assets/LINESeedKR-Regular.otf` and `docs/assets/OFL-LINESeedKR.txt` already existed in the website checkout, so they were left in place. The source repository contains the regular weight at `/Users/gpt/Projects/dayloom/assets/fonts/LINESeedKR-Regular.otf` (3,200,472 bytes); no LINE Seed bold font file was found in the app assets/source tree.

## Device and native app screens (October 11 revision)

`device/iphone.glb` is the phone geometry supplied by the HyperFrames registry block `vfx-iphone-device`, downloaded with the HyperFrames CLI. SHA256: `20b926be3ab68ad773af8ef83949561f1f93bc22777688efd89bc38f0840614e`. The website uses the GLB front-face geometry for an exact polygon mask and composites the native source canvas directly over the shell. The generated display mesh is hidden and serves only as a geometry boundary; there is no duplicate GPU screen texture. Three.js 0.147.0 and its GLTFLoader are vendored locally, with the upstream MIT notice in `vendor/THREE-LICENSE.txt`.

Native screenshot copies retain the original product UI and aspect ratio. Crops remove device status bars and test harness areas. They are compressed to WebP; no UI is generated or redrawn in these files.

- `screens/actions.webp`: `.ai-bridge/action-r8-input-review/native-final-cards-phone390-s4-1791220429280/actions-ready.png`; source crop `(0,300,1024,1916)`.
- `screens/home.webp`: `.ai-bridge/collection-entry-20261009/390-standard/home-return.png`; crop `(60,220,1170,2312)`.
- `screens/memory.webp`: `.ai-bridge/drawn-s4-20261002/390-memory-day-s4-1790919887867.png`; crop `(60,225,1170,2307)`. The writing is confirmed seeded QA fixture text in `src/world/drawn-lab/product-diagnostic.tsx`, not a personal diary.

The phone's Focus scene uses the same authored live drawing renderer as the opening world; it is a graphics preview, not a native Focus UI screenshot. The sun-to-Memory handoff and statistics bars outside the phone are website explanatory motion. They are not presented as recorded native interaction.

Website chrome follows current app tokens: white paper, ink `#473E3B`, muted `#776B66`, neutral soft `#F5F5F5`, Oat button `#E1CABF`, Oat selection `#EFE3DD`, and 8px controls. Theme artwork has its own palette.

## Narrative revision — 2026-10-11

`v5/customize/*.png` are generated from the native room compositor using `tools/render-customize.cjs`, reading Dayloom without modifying it. Four incremental scenes retain one 780 × 1280 projection; stage 0 exactly matches shipped DEFAULT_SELECTION, stage 1 changes light only, and stage 2 changes light/seat/rug. Nine final themes use exact curated recipes. Per-slot crop evidence is in `v5/customize/render-evidence.json`.

`v5/journey.js` follows Focus quiet-completion and Memory flight source contracts. The public example is target 25 minutes / actual 9 minutes, end 14:09, zero-reward quiet branch. Web sequencing demonstrates an explicit end/confirm and subsequent Memory navigation; it is not native auto-completion.

## Social app icons (2026-10-18)
The social links display the unmodified 512px app artwork from the official App Store listings published by Google (YouTube) and Instagram, Inc. (Threads and Instagram). Downloads are served locally, without recoloring or tracing. App-style corner masking is CSS only. Exact listing, Apple metadata endpoint, image URL, retrieval date and SHA-256 are in `social/sources.json`.

- YouTube: https://apps.apple.com/us/app/youtube/id544007664
- Threads: https://apps.apple.com/us/app/threads/id6446901002
- Instagram: https://apps.apple.com/us/app/instagram/id389801252

The older monochrome Simple Icons copies are removed. Brand artwork belongs to its respective owners.

## Website app icon and selection wash (2026-10-18)
`favicon-32.png` and `app-icon-180.png` are size exports with a transparent rounded-square mask (22% corner radius) of the icon configured by Dayloom's `app.json`: `assets/images/app-icon/icon.png`. `app-icon-source.json` records its source hash and output sizes; regenerate with `node tools/build-site-icons.cjs`. No artwork is redrawn and no app source is modified.

`ui/selection-spec.js` is generated by `tools/export-selection-spec.cjs` directly from Dayloom's `LiquidChoiceBackdrop`, `ActionChoiceLabel`, default Oat theme and Reanimated timing contract. Source hashes are in `architecture/native-selection-sources.json`. The web adapter measures the padded inner labels; `selection-motion.js` follows the native analytic spring and 110ms in-out-quadratic opacity. This replaces the previous CSS image stretching and headline decoration.

## Room lighting exports
`assets/v5/customize/*-night.png` and `*-night-unlit.png` use the same native room geometry/projection as daytime, rendered by `tools/render-customize.cjs`. No app source modified.

## Growth sequence (2026-10-11)
Five tree PNG stages are exported from Dayloom `src/world/drawn/growth/art-tree.ts` through `drawGrowthArtFitted` with `reserveFutureSize=true` (`tools/render-growth.cjs`). The seed PNG is the no-script homepage illustration; live animation is driven by SVG geometry, not PNG swapping.

The six source files in `v5/growth-motion/` are copied unchanged from Dayloom `design/prototype-editorial/lab/growth-reveal-*`. `v5/growth.js` drives their `createPlantTransition().seek()` across four adjacent tree transitions, using the native 2400ms recipe duration. This is a Dayloom design prototype; it does not use the RN thumbnail Reveal entrance. Source-relative paths and hashes are recorded in `architecture/native-growth-sources.json`.

Both native export commands share `tools/native-renderer.cjs`. Its napi-rs contour correction preserves independent SVG subpaths and is covered by `tools/check-native-contours.cjs`; this prevents diagonal triangles in cloud/mineral room art without changing the app source.
