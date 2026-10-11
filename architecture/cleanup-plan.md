# Bounded architecture cleanup — 2026-10-11

Apply `/Users/gpt/Projects/dayloom/.codex/skills/ai-slop-cleaner/SKILL.md` to the session-owned static website in `docs/`, its `tools/`, and architecture/run documentation. The primary Dayloom app is read-only. Preserve its six copied `growth-motion/` files byte-for-byte, upstream license/provenance, and existing product/privacy/contact/social pages. Later user authorization explicitly includes removing the obsolete root Jekyll blog. No dependency, framework, push, deployment, or nested agent workflow.

## Behavior lock before cleanup

Baseline PASS: `tools/check-narrative.cjs`, `tools/check-hero-scroll.cjs`, and new `tools/check-interactions.cjs` (real controllers in a DOM/event fixture). Protect hero plateaus/reverse scroll, room and screen drawing, journey state/pause/seek, local task timing/manual choices, 8-second carousel/one canvas per room/pause/loading guard, KO+EN labels, and pointer/keyboard language switching including Safari summary blur.

## Inventory and ordered passes

1. **Fallback resolution gate.**
   - Whole-body English MutationObserver and implicit missing-copy defaults: boundary violation/masking failure. Repair by translating at runtime text creation sites through a small explicit `MARCopy` API; generate its dictionary from `en-copy.json`, fail the build/test on missing keys, and keep native canvas text Korean intentionally. No DOM observer.
   - `customize.js` empty image decode catch: masking fallback. Preserve the previous decoded composition (grounded image-loading fail-safe), expose failure evidence/warning, and lock failed decode plus successful retry behavior.
   - `phone.js` null on missing Three/WebGL/GLB: scoped external graphics fail-safe. Preserve hero's flat canvas and journey's existing static screenshot, surface diagnostic evidence, test missing-library/WebGL/GLB paths. Do not rewrite graphics architecture.
   - Native journey playback feedback error and room geometry/anchor defaults: broad native adapter concern, escalated to parent; defer rewriting. Existing native drawing regressions cover the current behavior. A consensus/nested OMX workflow is explicitly excluded by the task authorization.
   - napi-rs addPath contour workaround in native export: grounded root-cause correction, preserve and add a two-contour regression. Do not simplify away.
   - Optional mount guards, visibility pause and no-script image content: grounded static enhancement boundaries, preserve.
2. **Dead code.** Remove obsolete one-time narrative/storyboard generators and stale generated fragments/storyboard; remove hidden intro chapter buttons/start handler, unused replay DOM hook, old deleted-section CSS and JS branches. Retain live closing landscape and task phase canvases.
3. **Duplication.** Consolidate room/journey CSS to the effective current declarations; remove superseded rules conservatively. Share only the genuinely repeated native export loader/contour correction. Keep feature controllers separate and no speculative component system.
4. **Naming/error handling and docs.** Document static source/runtime/generated/native boundary and run/export commands; retain YAT provenance and the original MIT license. Correct asset provenance to current plant-transition behavior. Derive English cache version from Korean source.
5. **Test reinforcement/final review.** Re-run targeted tests after each smell pass. Validate both locale assets/anchors/metadata/translation coverage, generated-file reproducibility, JS/Python syntax, native contour handling, and diff whitespace. Review UI with CUA if available; static tests do not replace browser rendering.

## Deferred work

No visual redesign or typography/palette changes. Older website asset generations remain as history; deleting them would widen this bounded change. The root Jekyll blog is now explicitly authorized for removal. Native playback/geometry fallbacks remain with evidence and parent handoff.

## Scope update authorized during the pass

The user approved deleting the former blog because this repository will continue as the landing site. Inventory: root `_posts` (2022–2023 posts), `_layouts`, `_includes`, `_sass`, `_data`, root `assets`, Ruby/Jekyll manifest/config, old root HTML/sitemap/verification files, and `.github` YAT funding/master deployment workflow. Search of active `docs` HTML/CSS/JS confirms no dependency on this tree; every active `/assets/...` URL resolves under `docs/assets`. Remove this blog-only inventory; preserve `.editorconfig`, `.gitignore`, `LICENSE.txt`, `docs/.nojekyll`, `docs/CNAME`, `docs/sitemap.xml`, and asset licenses. Keep `docs` as the permanent main/docs GitHub Pages publishing directory. Do not create a replacement deployment workflow.

Additional user-approved UI change: apply the existing navigation Oat wash to `.header .brand` hover/focus-visible and suppress its global anchor underline; keep wordmark dimensions/alignment and add no icon.
