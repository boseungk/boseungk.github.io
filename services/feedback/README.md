# Anonymous feedback API

One Cloudflare Worker and D1 database, scoped to this directory. No login,
email, admin endpoint or external database service. The production API is
`https://feedback-api.myanimalroom.com`; public deployment identifiers are in
`wrangler.production.jsonc`. Verification secrets are stored only in Cloudflare.

## Local development

Use Node 22.12+ (tested with 24.19), then run from this directory:

```sh
npm ci
cp .dev.vars.example .dev.vars
npm run db:migrate
npm run db:seed     # optional: fictional Korean sample board, local D1 only
npm run dev
```

`npm run db:seed` loads `seed/local.sql` (26 public ideas in all four statuses,
votes, 23 comments on one idea, operator replies, one hidden idea and one hidden
comment). It is fictional test data, empties the local tables first and never
passes `--remote`. `npm run db:reset` wipes `.wrangler/state`, re-migrates and
re-seeds. For an empty board run only `db:migrate`. Never publish the seed UUIDs.

API: `http://127.0.0.1:8789`. Serve the site's `docs` directory at
`http://127.0.0.1:8765`; this is the only allowed local website Origin.
Use the same `127.0.0.1` hostname for both. Local D1 state lives in ignored
`.wrangler/`; no Cloudflare login is needed. The default config explicitly
uses a local D1 binding and disables workers.dev/preview URLs.

The official **public** passing Turnstile sitekey is
`1x00000000000000000000AA`; `.dev.vars.example` contains its public test
secret. Render the widget with `action: 'feedback'`. Local smoke requests can
submit the official dummy token `XXXX.DUMMY.TOKEN.XXXX` to `/v1/visitor`.
This still calls Cloudflare Siteverify; it does not bypass verification.
Internet access is needed for the widget and verification.

Cloudflare's [test-key documentation](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
describes dummy tokens and environment separation. A real dummy Siteverify
probe on 2026-10-15 returned `hostname: "example.com"`, no `action`, and
`metadata.result_with_testing_key: true` (the documentation's example differs).
Only `ENVIRONMENT=development`, the exact public passing test secret, and that
exact successful dummy response permit this exception. Other responses still
need the correct hostname and `action: "feedback"`. Production rejects official
test secrets, dummy response hostnames, local origins, and insecure cookies.

## API contract

All browser requests use `credentials: 'include'`. Public GETs work without
an Origin header; browser origins must match the allowlist. Every mutation
requires the exact allowed Origin and `application/json` (optional UTF-8
charset). Credentials CORS never uses `*`; responses carry `Vary: Origin`,
`Cache-Control: no-store`, and exposed `Retry-After`. Preflight responses carry
`Access-Control-Max-Age: 7200` (Chrome's cap), so votes are not re-preflighted.

| Method and path | JSON request | JSON response |
| --- | --- | --- |
| GET `/v1/ideas?sort=popular\|latest&status=open\|reviewing\|planned\|completed&cursor=…` | — | `{ideas: Idea[], next_cursor: string\|null, counts?: Counts}` |
| GET `/v1/ideas/:id` | — | `{idea: Idea}` |
| GET `/v1/ideas/:id/comments?cursor=…` | — | `{comments: Comment[], next_cursor: string\|null}` |
| POST `/v1/visitor` | `{turnstile_token: string}` | `{ready: true}` |
| POST `/v1/ideas` | `{nickname?: string, body: string, client_request_id: UUID}` | `{idea: Idea}` |
| POST `/v1/ideas/:id/comments` | same as idea creation | `{comment: Comment}` |
| PUT `/v1/ideas/:id/vote` | `{voted: boolean}` | `{idea: Idea}` |

```text
Idea = {id, nickname, body, status, created_at, vote_count, comment_count, voted,
        operator_reply: {id, body, created_at} | null}
Counts = {all, open, reviewing, planned, completed}
Comment = {id, idea_id, nickname, body, created_at, is_operator}
```

IDs are UUID strings, `created_at` is an ISO UTC string, counts are numbers,
and flags are booleans. Empty nickname is `""`; the client supplies its localized
anonymous display label. The public operator badge is the only moderation
field exposed; author IDs, token hashes, hidden flags, and request IDs are never
returned. Only an operator using D1 can create an operator reply.

`status` is optional; an unknown or empty value is `400` with `error.field`
`status`. `counts` (public, non-hidden ideas per status, independent of the
filter) is returned on the first page only, that is, when no `cursor` is sent.
Clients can treat its presence as proof that the deployed API honours `status`.
`operator_reply` is the latest visible operator comment on the idea, or `null`.
The operator nickname is not exposed.

Page size is 20. Cursors are opaque and tied to the sort and the status filter
(a cursor from another sort or filter is `400 invalid_cursor`); keep the returned
cursor unchanged. Popular sorts by vote count, then creation time/id descending;
latest by creation time/id descending. Comments sort by creation time/id ascending.
Keyset pagination avoids equal-time ties. Popular ranks can move as votes change,
so reload the list for current ordering rather than treating it as a snapshot.

The initial write receives `401 visitor_required` without a cookie. Only then
load Turnstile, POST its token to `/v1/visitor`, and retry the original request
with the same UUID. An existing valid visitor may POST `{}` to `/v1/visitor`
and gets `ready:true` without another challenge or a replacement cookie.
GETs never create/renew visitors. New visitors require successful Siteverify,
`hostname=www.myanimalroom.com` and `action=feedback` in production.

The API sets a host-only `__Host-feedback` cookie with `HttpOnly; Secure;
SameSite=Strict; Path=/; Max-Age=7776000` (90 days). Only its SHA-256 hash is stored.
Development uses the separate `feedback_dev` name without Secure on loopback.
Expired or forged cookies cannot write. This represents a browser, not a person;
clearing cookies or using another browser creates a different visitor.

Text is NFC normalized, CRLF/CR become LF, and outer whitespace is trimmed.
Limits count Unicode codepoints **after** normalization: nickname 0–24, idea
1–2000, comment 1–1000. Lone surrogates and non-text controls are rejected.
Text remains plaintext (including HTML-looking strings). Render it using
`textContent`, never HTML or Markdown. The streamed request body is capped at
16 KiB even without a Content-Length header. Unknown fields are rejected;
clients cannot set timestamps, hidden/operator flags, visitor IDs or counts.

Creation returns 201; a normalized same-content UUID retry returns 200 with
the existing object and does not consume quota. The same visitor/UUID with
different content, nickname, or comment parent returns 409. Comment UUIDs are
unique across all parents for that visitor. Replaying a hidden item returns 404.

Errors use `{error:{code,message,field?}}` without SQL or internal details:

| Status | Meaning |
| --- | --- |
| 400 | `invalid_request`, `invalid_json`, `invalid_cursor`, `body_too_large` |
| 401 | `visitor_required` |
| 403 | `origin_not_allowed`, `verification_failed` |
| 404 | `not_found` (including hidden content) |
| 409 | `request_conflict` |
| 429 | `rate_limited`, with `Retry-After` seconds |
| 500 | `internal_error` |
| 503 | `not_configured`, `verification_unavailable` |

## Atomic limits and tests

### Edge budgets and optional analytics

Wrangler's production and local configs define separate per-minute budgets:
600 board requests per connecting IP, 60 visitor preparations per IP, 120 site hits
per IP and 1,000 site hits across each Cloudflare location. These are generous burst
guards for shared/mobile networks, not per-person quotas. The transactional quotas
below remain the authoritative writing/voting limits. Preflight is not counted.
Rate-limit keys use a daily SHA-256 namespace; raw IPs are not stored in D1 or app logs.

If a board limiter is unavailable, the normal API and existing D1 quotas continue.
If an analytics limiter is missing, unavailable or exhausted, `/v1/hit` returns 202
without accessing D1. The website and board remain usable; only optional counts are
dropped. Cloudflare's edge budgets are approximate and local to each location.

Stats requests accept at most 1,024 bytes, checked while streaming, and only declared
fields. Page dimensions are limited to the site's language/route vocabulary. The
conditional INSERT atomically caps new stats rows at 2,000 per KST day while allowing
existing counters to increase; older rows are not deleted. No migration is needed.
Tests use Miniflare/local D1 and verify rejection, shared-network headroom, normal
quotas, limiter failures, the daily cap and UTF-8/streamed bodies without production writes.

Each visitor may create 3 ideas and 20 comments in the preceding 24 hours,
including hidden rows. Conditional INSERT, unique constraint handling, and
idempotency/quota reads are one D1 batch transaction, not an application
read-then-write quota check.

All vote PUTs, including same-state retries and cancellations, count against
30 requests in a 60-second fixed window. The window begins with the first
admitted request and restarts on the first request at/after expiry. A guarded
visitor UPDATE increments/restarts the separate counter; the immediately
following vote INSERT/DELETE is gated by SQLite `changes()=1`, in the same
D1 batch transaction. Denial leaves votes untouched. Cancellation does not
delete the counter. A composite votes primary key enforces one vote per visitor.

[D1 documents batch transactions and rollback](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).
Tests exercise real local D1/SQLite through Miniflare/workerd, not SQL mocks.
Only the outgoing Siteverify HTTP response is stubbed, including one-use tokens,
bad hostname/action, failure, outage, and the narrowly scoped local dummy case.

```sh
npm run check
npm test
npm run build
npm audit
```

Tests cover the 20-vote parallel race, the 29→30 boundary with two parallel
requests, same-state/cancel counting, one-time window reset, a 31-request flood,
the final idea/comment quota slots, concurrent idempotent retries, conflicting
payloads, forged/expired sessions, Origin/JSON/length/Unicode validation,
protected fields, moderation filtering, 23-row pagination, and foreign-key cleanup.
The stable Miniflare test runner is pinned; patched `undici` and `sharp`
transitive versions are overridden to avoid known development dependency
advisories. Wrangler currently bundles its own newer Miniflare release.

## Production deployment (explicit configuration)

The existing production Worker and D1 database are both named
`myanimalroom-feedback`. Reuse them; do not recreate the database or widget on
each deployment. The commands below describe initial setup and future maintenance.

1. Create/select the authorized production D1 database and Turnstile widget in
   the existing Cloudflare account. Restrict the real widget to
   `www.myanimalroom.com`; configure action `feedback` in the client.
2. For a different installation, copy `wrangler.production.jsonc.example` to ignored
   `wrangler.production.local.jsonc` and replace both explicit database
   placeholders with real values. This distinct config has production mode,
   the API-only custom domain and no local Origin configuration. For this account,
   use the already configured `wrangler.production.jsonc` instead.
3. Store the real secret using Wrangler's secret prompt, never in site files,
   this repository, command arguments, or logs. The binding is `TURNSTILE_SECRET`.
4. Review and apply the migration with the explicit production config and
   `--remote`, then deploy using that same config only when authorized.
5. Set the frontend public API URL and real sitekey. Verify real
   `www.myanimalroom.com`→`feedback-api.myanimalroom.com` HTTPS cookie persistence
   in mobile Safari and Chrome, failure/retry behavior, and blank real DB state.
   Local integration tests do not establish these browser/deployment checks.

Do not deploy the default development config to production. Do not alter
the existing www GitHub Pages CNAME or email MX records. The new custom-domain
route is exclusively `feedback-api.myanimalroom.com`. No paid plan, secret,
account, remote DB, DNS mutation or deployment is created by the local commands.

## Operator maintenance

Use Cloudflare D1 Studio/SQL through the existing operator account; no public
admin API or reusable admin secret is added. UUID examples below must be
replaced with the intended public item ID after checking the row:

```sql
UPDATE ideas SET hidden=1 WHERE id='IDEA_UUID';
UPDATE comments SET hidden=1 WHERE id='COMMENT_UUID';
INSERT INTO comments
  (id,idea_id,visitor_id,nickname,body,created_at,hidden,is_operator,client_request_id)
VALUES
  ('NEW_UUID','IDEA_UUID',NULL,'My Animal Room','Plaintext operator reply',
   CAST(unixepoch('subsec')*1000 AS INTEGER),0,1,'ANOTHER_NEW_UUID');
```

Migration `0002_idea_status.sql` adds an operator-owned `status`: `open` (default),
`reviewing`, `planned`, or `completed`. Public creation rejects a supplied status.
The website displays a status only after the operator changes it; a newly
submitted idea is never presented as already reviewed or promised.

```sql
UPDATE ideas SET status='reviewing' WHERE id='IDEA_UUID' AND hidden=0;
```

Migration `0003_status_reply_indexes.sql` only adds indexes for the status filter and
the latest-operator-reply lookup. It is safe to apply before or after the API deploy,
but deploy the API and apply it to production **before** publishing the static pages
that use `status`, `counts` and `operator_reply`. Each statement must end with `;`,
because Wrangler appends its own bookkeeping statement.

Use `planned` for work actually selected for preparation and `completed` only
after the requested change ships. An operator comment can explain the decision
and reference the corresponding published `/news/#entry-id` note.

Hidden parents disappear from all public queries and cannot receive comments
or votes. Hidden comments disappear from responses and comment counts.
For a confirmed deletion request, delete the intended idea; foreign keys cascade
to its comments and votes. Remove a comment by its own ID. This API does not
promise it can identify an anonymous author as a real person.

To remove expired token hashes while preserving public contributions:

```sql
UPDATE visitors SET token_hash=NULL
WHERE expires_at <= CAST(unixepoch('subsec')*1000 AS INTEGER);
```

This removes expired authentication hashes while retaining public contributions
and vote totals. The internal anonymous visitor row remains only for relational
integrity; it has no usable token. Even before cleanup, expired cookies cannot
write or recover their earlier visitor. Deleting an entire visitor row instead
would null its author references and cascade its votes, so do that only for an
intentional full deletion. Run cleanup deliberately under the published
retention policy, after backup. No automatic cleanup is scheduled.

Use an explicitly configured D1 export to a private path outside this repo;
never place an export under `docs/`. Practice restoring into an isolated database
before public launch and record the result. D1 [export guidance](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
and [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
describe operator options; availability depends on account/database settings.
On 2026-10-15, the new empty production database was exported and successfully
restored into isolated SQLite with all four application tables and zero rows.
This was a non-destructive restore check, not a restore over the production DB.

Production verification on the same day passed real Turnstile guest creation,
idea/comment submission, voting and reload persistence in the in-app browser.
The labelled smoke post was then hidden; public listing is empty, and both its
direct URL and comments endpoint return 404. Live CORS allows the www origin
and rejects other origins. Native iOS/Android browser coverage is a separate check.

The Worker does not log bodies, nicknames, cookies or verification tokens.
If diagnostics are added later, log only request identifiers/status/duration.
