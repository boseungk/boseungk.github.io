# AI SLOP CLEANUP REPORT

Scope: session-owned MyAnimalRoom landing website (`docs/`, `tools/`), architecture/run documentation, and the subsequently authorized removal of the root Jekyll blog. Dayloom source remained read-only. No push or deployment.

Behavior Lock: baseline `check-narrative.cjs` and `check-hero-scroll.cjs` PASS before cleanup; added/ran `check-interactions.cjs` against the original task/carousel/English/menu behavior before replacing locale boundaries. `check-phone.cjs` exercised the primary/missing-library/WebGL/GLB paths before adding failure diagnostics.

Cleanup Plan: [cleanup-plan.md](cleanup-plan.md), recorded before cleanup and updated with explicit blog removal/brand-wash authorization. Skill applied: `/Users/gpt/Projects/dayloom/.codex/skills/ai-slop-cleaner/SKILL.md`.

## Passes completed

1. **Fallback resolution gate.** Replaced whole-body English MutationObserver/implicit translation omissions with explicit controller-owned `MARCopy` calls. The builder rejects missing static and runtime keys and extracts tree recipe labels from unchanged native source. Room PNG decode failure retains the prior decoded stage, sets failure evidence and warns; successful retry clears evidence. Three/WebGL/GLB failure retains static content and exposes a reason/warning. Native contour correction remains intact and now fails if the source adapter pattern changes. Broad native journey feedback and room geometry/anchor fallbacks were raised to the parent and preserved.
2. **Dead code deletion.** Removed obsolete one-time integration/storyboard generators, stale generated HTML fragments/storyboard, hidden hero chapter controls and deleted-section/replay hooks. Removed companion/world/routine/theme-picker/social-preview CSS and unused home icon/day-night-button logic. Retained live closing-landscape and task phase rendering. User-approved blog removal covers `_posts`, `_layouts`, `_includes`, `_sass`, `_data`, root `assets`, Ruby/Jekyll files, old root pages/sitemap/verification, YAT funding and master-branch deploy workflow. No active docs dependency used those files; original MIT license/provenance remains.
3. **Duplicate removal.** Consolidated room/journey/hero layout declarations to current effective values; kept media/source-order boundaries and existing visual composition. Both native exporters share one source loader and the tested contour correction. Runtime dictionary contains only 23 used keys; static translations stay in the source dictionary. English asset versions inherit the Korean page; generated files are checked for reproducibility.
4. **Naming/error handling/docs.** Gave `home.js` readable ownership-oriented functions; documented `docs` as permanent main/docs publishing root and `tools`/`architecture` boundaries. Corrected native phone/growth provenance. Repaired obsolete product/privacy navigation targets discovered by full-page anchor checks. User-approved wordmark hover/focus shares navigation's Oat wash and removes underline without changing its geometry. English `<br>` emits a separator space, preserving word boundaries when mobile hides the break.
5. **Test reinforcement.** Added static all-page/assets/anchor/locale/evidence/source-hash checks, controller timing/manual-state/pause/decode-retry/menu tests, phone display/mask/lifecycle/failure-path checks, and independent native SVG-contour/transformed-path checks. Verified six copied native growth modules against original Dayloom bytes and recorded their hashes.

## Quality gates

- Regression tests: **PASS** — `check-narrative.cjs`, `check-hero-scroll.cjs`, `check-interactions.cjs`, `check-phone.cjs`, `check-native-contours.cjs`.
- Generated English: **PASS** — `python3 tools/build-english.py --check`, missing-copy validation and hidden-br English spacing regression.
- Static integration: **PASS** — `python3 tools/check-site.py`: five pages, local assets/anchors, both locales, all room slot-bound evidence, six source hashes and publishing boundary.
- Native export smoke: **PASS** — `render-customize.cjs --incremental-only`; all four slots inside each exported stage 0–2. Existing day/unlit/lamp export evidence for all themes is checked statically.
- JavaScript syntax: **PASS**, 37 scripts/modules via `node --check`.
- Python syntax: **PASS**, `python3 -m py_compile tools/*.py`.
- Diff whitespace: **PASS**, `git diff --check`.
- Lint/typecheck: **N/A**, no lint/typecheck toolchain in this static repository; syntax and focused integration checks run instead. No dependencies added.
- Static/security tooling: **N/A**, no configured security scanner. Active local asset/anchor/import contracts are checked.

Node used: `/Users/gpt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`.

## UI/design findings

Parent independently checked Chrome via CUA: Korean → English → Korean native links, focus/completion/Memory display, both GLB polygon-masked shells, three-task automatic completion/manual cancellation/preservation after revisit, native growth SVG stage 2 playback, and header wordmark focus-visible wash with no underline. Console showed no error/warning. Mobile 390 × 844 composition had no overflow; its discovered English sentence-spacing defect was repaired and locked by a static regression.

Native Oat/LINE styling, organic selection wash, reduced motion/global/local pause, outside arrows and native durations remain intentional. No visual redesign or blanket typography/shadow changes. Small 12px captions are existing metadata controls, not new body copy.

## Changed areas

- `.gitignore`, `README.md`, `architecture/*`: runtime exclusion, build/run/ownership/provenance and plan/report/source hashes.
- `docs/index.html`, `docs/en/index.html`, `docs/home.js`, `docs/home.css`: session redesign plus bounded page/locale/dead-code cleanup.
- `docs/assets/v4/*`, `docs/assets/v5/*`, `docs/assets/social/*`, asset provenance: native hero/phone/journey/customization/task/growth session work and cleanup described above; copied growth-motion bytes untouched.
- `docs/product/index.html`, `docs/privacy/index.html`: repaired old navigation fragments only; content/layout preserved.
- `tools/*`: repeatable English/native generators and focused regressions; obsolete one-shot generators omitted.
- Root blog-only tree: removed under explicit user authorization. `LICENSE.txt`, `.editorconfig`, `docs/CNAME`, `.nojekyll`, sitemap, robots and asset licenses retained.

## Fallback review and remaining risks

- Whole-body translation/missing key defaults: masking boundary repaired; no escalation remains.
- Failed room decode and unavailable graphics: grounded enhancement fail-safes preserved with evidence and primary/failure/retry tests.
- napi-rs contour correction: grounded root-cause repair preserved and tested; independent contours no longer acquire diagonal triangles.
- Native journey playback error suppression and room adapter defaults: broad/cross-layer concern raised to parent; rewrite deferred to avoid changing native behavior.
- Phone text clarity was addressed in the follow-up described below. Presence/mask/lifecycle checks alone do not certify real-GPU text sharpness.
- DOM fixtures do not replace Safari/GPU/responsive browser testing. Older website asset generations remain outside this bounded removal; blog source removal is complete.
- `.omx/` contains the earlier narrative plan only, stays ignored and is not committed. No task-owned runtime output or screenshots are included.

## Phone text clarity follow-up

The primary phone display now uses browser-rendered SVG glyphs at final CSS pixel coordinates instead of shrinking rasterized text with the room. `MARPhoneText` in `screen.js` shares native transforms/opacity with hero and journey, maintains LINE/Oat styling and raises small labels to at least 11.5px. A dense mobile trace row keeps a minimum 6px gap. The native canvas text stays available on the graphics fallback; first mount hides SVG until fresh artwork removes raster glyphs, avoiding double text. Font loading preserves the room/control background, and phase changes, reverse scroll and teardown clear old glyphs.

The existing two Python and five Node checks plus new `check-phone-text.cjs` passed. The new regression measures actual NAPI `fillText` calls for hero and every journey phase, verifying glyph omission only with a usable SVG display, fallback restoration, first-mount/zero-size handling, minimum size/font, transforms/alpha, spacing and lifecycle. Chrome visual QA at 1202×960 and 390×844 covered preparation, running, completion, home, memory list/detail and forward/reverse scrolling. The parent also refreshed the user's in-app browser and verified its loaded LINE font and live memory text sizes. Actual browser WebGL failure screenshots were not captured; that path keeps the existing canvas/static typography.

Temporary QA HTML was removed. Screenshots are stored outside the publishing directory under the task's `outputs/redesign-v5/phone-text/` and are not committed. The source app, artwork, animals, room layout and animation choreography remain unchanged.
