# Site security and deployment

`deploy.sh` stages `docs/` into ignored `dist/`, then `prepare.py` derives CSP SHA-256
hashes from the exact staged inline scripts and import maps. Do not copy `_headers`
directly: it is a template with a hash placeholder. No private live bundle code is
parsed to generate the CSP. A changed inline script automatically gets its new hash
on the next deployment. Inline event attributes, source maps and common secret files
fail staging before anything is published.

The policy permits the site's scripts, the exact inline hashes, Cloudflare Analytics
and Turnstile. Inline styles remain permitted for the existing visuals. WebAssembly
compilation, arbitrary inline scripts, event attributes and JavaScript eval are not
permitted. `frame-ancestors 'none'` prevents embedding this site; `frame-src`
still allows Turnstile's verification frame. No COEP, CORP, cross-origin isolation,
HSTS preload or blanket subdomain HSTS is enabled.

With Node 22.12+ on PATH, from the repository root:

```sh
python3 -B tools/build-locales.py
python3 -B services/site/test_security.py
sh services/site/deploy.sh --dry-run
# Inspect the exact staged policy locally. This preview only adds the loopback API
# to connect-src; deploy.sh always regenerates production headers without it.
python3 -B services/site/preview.py
# After validation:
sh services/site/deploy.sh
services/feedback/node_modules/.bin/wrangler deploy --config services/site/apex/wrangler.jsonc
```

The apex redirect sets its headers in `apex/index.js`, separately from asset headers.
Before a deployment, record the current versions using `wrangler deployments list`
with the appropriate config. A bad release can be reverted with `wrangler rollback
<previous-version-id> --config <config-file>`. Check the homepage, feedback list,
Turnstile loading, language navigation, live room, 404 and response headers afterward.
Do not write test posts to the production API.

The domain's DMARC starts at `p=none` with Cloudflare aggregate reports: this observes
senders without rejecting mail. Confirm the real outbound sender's aligned SPF or
DKIM before tightening it. Email Routing into Gmail alone does not configure outbound
mail from the support address. SPF, MX and DKIM should not be replaced to guess at
an untested sending arrangement.
