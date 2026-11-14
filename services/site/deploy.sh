#!/bin/sh
# Deploy the site to Cloudflare (Workers static assets, route www.myanimalroom.com/*). This is the live site: pushing to
# GitHub does not deploy it.
# docs/assets/live (the hero's live room) is built locally and never committed; the deploy refuses to run without it.
set -eu
case "${1:-}" in
  ''|--prepare-only|--dry-run) ;;
  *) echo 'usage: deploy.sh [--prepare-only|--dry-run]' >&2; exit 2 ;;
esac
cd "$(dirname "$0")"
ROOT=../..
[ -f "$ROOT/docs/assets/live/scene.js" ] || { echo "docs/assets/live is missing: build the live room first" >&2; exit 1; }
rsync -a --delete --exclude CNAME --exclude .nojekyll --exclude .DS_Store "$ROOT/docs/" dist/
python3 -B prepare.py dist
[ "${1:-}" != '--prepare-only' ] || exit 0
WRANGLER=../feedback/node_modules/.bin/wrangler
if [ "${1:-}" = '--dry-run' ]; then
  "$WRANGLER" deploy --dry-run
else
  "$WRANGLER" deploy
fi
