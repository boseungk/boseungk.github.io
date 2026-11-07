"""AssetIndex: logical -> hashed names (class 1) and content hashes for ``?v=`` (class 2).

``resolve(path)`` returns the URL the generated HTML should use (PORT-PLAN §2.3):
- a logical name listed in ``architecture/{room,art,font}-asset-sources.json`` (``outputs[].logical``,
  relative to ``docs/assets/``) becomes its hashed file ``/assets/<file>`` (``<base>.<sha10>.<ext>``),
  never with ``?v=``;
- a hashed file name written directly in a template fails the build (use the logical name: hashed
  files are pruned after one generation);
- any other existing docs file gets ``?v=<sha256[:10]>`` of its bytes;
- anything else fails the build ("missing asset").

Files generated in the same run (runtime copy, later sw.js and the keep list) are registered as
overrides so ``--check`` hashes the in-memory content.

Hooks for other packages:
- ``index.used``: every URL ``resolve()`` returned during this build, in first-use order (HTML
  attributes, inline ``url()``, font faces and preloads, import-map values).
- ``keep_urls(build)``: the sorted URL list B2 writes as ``docs/assets/cache-keep.<h>.json``: every
  URL in ``index.used`` plus every room-lock file (rooms are reached through the manifest at run
  time) and every font face. Call it from an ``after_pages`` output so all pages have been stamped.
- ``index.lock_entry(logical)``: the lock record (``w``, ``h``, ``bytes``, ``sha256``, …) of a
  logical name, for ``width``/``height`` attributes or budgets.
- Tests (and other in-memory builds) may set ``site.locks = {'art': {...lock json...}, ...}`` to
  replace the lock files; a lock that is absent is simply not used.
"""
import json

from .core import BuildError, sha10

LOCKS = {'room': 'architecture/room-asset-sources.json',
         'art': 'architecture/art-asset-sources.json',
         'font': 'architecture/font-asset-sources.json'}


class MissingAsset(BuildError):
    pass


def load_locks(site):
    """Return ``{kind: lock}`` for the locks that exist (``site.locks`` overrides the files)."""
    override = getattr(site, 'locks', None)
    if override is not None:
        return dict(override)
    cached = getattr(site, '_asset_locks', None)
    if cached is None:
        cached = {}
        for kind, rel in LOCKS.items():
            file = site.repo_file(rel)
            if file.exists():
                cached[kind] = json.loads(file.read_text())
        site._asset_locks = cached   # one read per Site (one build)
    return dict(cached)


class AssetIndex:
    def __init__(self, site):
        self.site = site
        self.overrides = {}
        self.cache = {}
        self.used = {}                 # url -> None (ordered set)
        self.locks = load_locks(site)
        self.logical = {}              # 'art/x.webp' -> lock output record
        self.files = {}                # 'art/x.<h>.webp' -> lock output record
        for kind, lock in self.locks.items():
            for entry in lock.get('outputs', ()):
                logical, file = entry['logical'], entry['file']
                if logical in self.logical and self.logical[logical]['file'] != file:
                    raise BuildError(f'{LOCKS.get(kind, kind)}: logical {logical} is listed twice')
                sha = entry.get('sha256') or ''
                if sha and f'.{sha[:10]}.' not in '.' + file.rsplit('/', 1)[-1]:
                    raise BuildError(f'{LOCKS.get(kind, kind)}: {file} does not carry sha256[:10] of its bytes')
                self.logical[logical] = dict(entry, kind=kind)
                self.files[file] = self.logical[logical]

    # ---- class 2 ---------------------------------------------------------------------------

    def override(self, rel, content):
        """``rel`` is docs-relative (``assets/home/home.css``)."""
        self.overrides[rel] = content
        self.cache.pop(rel, None)

    def override_many(self, files):
        for path, content in files.items():
            if path.startswith('docs/'):
                self.override(path[len('docs/'):], content)

    def exists(self, rel):
        return rel in self.overrides or self.site.exists(rel)

    def read_text(self, rel):
        """Read a docs file, preferring content generated in this run."""
        if rel in self.overrides:
            value = self.overrides[rel]
            return value if isinstance(value, str) else value.decode()
        if not self.site.exists(rel):
            raise MissingAsset(f'missing asset /{rel}')
        return self.site.read_text(rel)

    def hash(self, rel):
        if rel not in self.cache:
            if rel in self.overrides:
                self.cache[rel] = sha10(self.overrides[rel])
            elif self.site.exists(rel):
                self.cache[rel] = sha10(self.site.read_bytes(rel))
            else:
                raise MissingAsset(f'missing asset /{rel}')
        return self.cache[rel]

    # ---- class 1 ---------------------------------------------------------------------------

    def lock_entry(self, logical):
        """The lock record for a logical name (``art/hero/garden-day.webp`` or ``/assets/…``)."""
        logical = logical.lstrip('/')
        if logical.startswith('assets/'):
            logical = logical[len('assets/'):]
        return self.logical.get(logical)

    def hashed(self, logical):
        """``/assets/<file>`` for a lock-listed logical name; MissingAsset when its file is gone."""
        entry = self.lock_entry(logical)
        if entry is None:
            raise MissingAsset(f'/assets/{logical.lstrip("/")} is not listed in any asset lock')
        rel = 'assets/' + entry['file']
        if not self.site.exists(rel):
            raise MissingAsset(f'missing asset /{rel} (listed in {LOCKS.get(entry["kind"], entry["kind"])}; run its generator)')
        return '/' + rel

    # ---- resolution ------------------------------------------------------------------------

    def resolve(self, path):
        """Map a root-absolute path (no query or fragment) to its stamped URL."""
        rel = path.lstrip('/')
        if rel.startswith('assets/'):
            name = rel[len('assets/'):]
            if name in self.logical:
                return self.mark(self.hashed(name))
            if name in self.files:
                raise BuildError(f'{path} is a hashed file name; write the logical name /assets/{self.files[name]["logical"]} (the build maps it)')
        return self.mark(path + '?v=' + self.hash(rel))

    def mark(self, url):
        self.used.setdefault(url, None)
        return url


def keep_urls(build):
    """Sorted class-1 and class-2 URLs in use, for B2's ``docs/assets/cache-keep.<h>.json``."""
    index = build.assets
    urls = set(index.used)
    for entry in index.logical.values():
        if entry['kind'] in ('room', 'font') and index.site.exists('assets/' + entry['file']):
            urls.add('/assets/' + entry['file'])
    return sorted(urls)
