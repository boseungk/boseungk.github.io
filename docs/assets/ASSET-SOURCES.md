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

`device/iphone.glb` is the phone geometry supplied by the HyperFrames registry block `vfx-iphone-device`, downloaded with the HyperFrames CLI. SHA256: `20b926be3ab68ad773af8ef83949561f1f93bc22777688efd89bc38f0840614e`. The website adapts the block's planar screen UV mapping; it does not use experimental HTML-in-canvas capture or the sample HyperFrames screen. Three.js 0.147.0 and its GLTFLoader are vendored locally, with the upstream MIT notice in `vendor/THREE-LICENSE.txt`.

Native screenshot copies retain the original product UI and aspect ratio. Crops remove device status bars and test harness areas. They are compressed to WebP; no UI is generated or redrawn in these files.

- `screens/actions.webp`: `.ai-bridge/action-r8-input-review/native-final-cards-phone390-s4-1791220429280/actions-ready.png`; source crop `(0,300,1024,1916)`.
- `screens/home.webp`: `.ai-bridge/collection-entry-20261009/390-standard/home-return.png`; crop `(60,220,1170,2312)`.
- `screens/memory.webp`: `.ai-bridge/drawn-s4-20261002/390-memory-day-s4-1790919887867.png`; crop `(60,225,1170,2307)`. The writing is confirmed seeded QA fixture text in `src/world/drawn-lab/product-diagnostic.tsx`, not a personal diary.

The phone's Focus scene uses the same authored live drawing renderer as the opening world; it is a graphics preview, not a native Focus UI screenshot. The sun-to-Memory handoff and statistics bars outside the phone are website explanatory motion. They are not presented as recorded native interaction.

Website chrome follows current app tokens: white paper, ink `#473E3B`, muted `#776B66`, neutral soft `#F5F5F5`, Oat button `#E1CABF`, Oat selection `#EFE3DD`, and 8px controls. Theme artwork has its own palette.
