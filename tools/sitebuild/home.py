"""Home page, rooms part (owner C-rooms): the recommended-rooms wall's data hooks and runtime room text.

Template hooks (``tools/templates/home.ko.html``, section 추천하는 방 둘러보기)::

    <div class="rooms-host" id="rooms-host" data-rooms-manifest="/assets/rooms/manifest.json" data-rooms-text="<!--ROOMS_TEXT-->"
         data-rooms-css="/assets/home/rooms.css">
      <ol class="rooms-still" aria-label="추천하는 방"><!--ROOMS_STILL--></ol>
    </div>

- ``<!--ROOMS_TEXT-->`` (``source`` phase, so it can sit inside an attribute) -> ``/assets/i18n/runtime/rooms.<lang>.json``;
  the stamp pass adds ``?v=<sha10>`` like any other ``data-*`` URL. The manifest attribute is stamped to the hashed
  manifest named in ``architecture/room-asset-sources.json``. ``data-rooms-css`` (the wall's stylesheet, inserted by
  ``home/rooms/index.js`` when the wall mounts, so it never blocks the first paint) gets ``?v=`` the same way.
- With script, the page head sets ``html.js`` and ``home/home.css`` hides the static list before the first paint
  and holds the wall's height in its place; the list shows again (``.is-still``) when the wall cannot load, and the
  head's error listener drops ``html.js`` when ``home/rooms/index.js`` itself cannot load (it also hides a kicker
  icon that fails to load instead of showing a broken image).
- ``<!--ROOMS_STILL-->`` (``page`` phase, after translation) -> the twelve ``<li>`` of the static room list (no script,
  or the wall failed to load): the room's thumbnail (logical URL, stamped to its hashed file) and its name from the
  page language's room text. Captions never go through the site catalog, so ``source.json`` holds no room names.

Generated files (page ``home``, written by ``--only home`` and full builds):
``docs/assets/i18n/runtime/rooms.<lang>.json`` for every home locale: a flat object with the keys of
``docs/assets/i18n/rooms/source.json`` that the wall and the room view use, in the page language:
``room.<id>.name``, ``room.<id>.desc`` (manifest order), ``theme.<id>``, ``item.<itemId>``. Korean comes from
``source.json``; other locales from ``docs/assets/i18n/rooms/catalogs/<locale>.json`` (written by the translator).
Draft mode falls back to Korean for a missing or empty value; strict mode fails on it after the pages have
rendered (so a missing site key is reported first), and only when the home page is being built (other page sets
merely hash these files).
"""
import html
import json

from . import core
from .core import BuildError, page_locales

ROOMS_SOURCE = 'assets/i18n/rooms/source.json'
ROOMS_CATALOG = 'assets/i18n/rooms/catalogs/{code}.json'
MANIFEST = 'rooms/manifest.json'                     # logical name in the room lock
RUNTIME = 'docs/assets/i18n/runtime/rooms.{lang}.json'
RUNTIME_URL = '/assets/i18n/runtime/rooms.{lang}.json'
# The static list: the twelve rooms of samples/c/index.html, in its order.
STILL_ROOMS = ('lemon-cobalt', 'raspberry-denim', 'pistachio-rose', 'quiet-aurora', 'tomato-swimming',
               'black-cherry-pistachio', 'cherry-soda', 'ultramarine-melon', 'salt-mirror', 'three-planets-room',
               'forest-velvet', 'saffron-turquoise')


def manifest(build):
    """The room manifest v2 (parsed), or None when the room lock or its file is absent."""
    cached = getattr(build, '_rooms_manifest', False)
    if cached is not False:
        return cached
    entry = build.assets.lock_entry(MANIFEST)
    rel = 'assets/' + entry['file'] if entry else None
    value = build.site.read_json(rel) if rel and build.site.exists(rel) else None
    build._rooms_manifest = value
    return value


def used_keys(data):
    """The room-text keys the wall and the room view read, in output order."""
    keys, themes, items = [], set(), set()
    for room_id in data['order']:
        room = data['rooms'][room_id]
        keys += [f'room.{room_id}.name', f'room.{room_id}.desc']
        themes.add(room.get('theme'))
        items.update(item['item'] for item in room.get('items', ()))
    return keys + [f'theme.{theme}' for theme in sorted(t for t in themes if t)] + [f'item.{item}' for item in sorted(items)]


def room_words(build):
    """``{lang: {key: text}}`` for every home locale (cached per build)."""
    cached = getattr(build, '_rooms_words', None)
    if cached is not None:
        return cached
    data = manifest(build)
    source = build.site.read_json(ROOMS_SOURCE)
    if data is None or source is None:
        if build.selected('home'):
            raise BuildError(f'home: the room manifest (/assets/{MANIFEST} in architecture/room-asset-sources.json) '
                             f'and docs/{ROOMS_SOURCE} are required; run tools/rooms/build-room-assets.mjs')
        build._rooms_words = {}
        return build._rooms_words
    keys = used_keys(data)
    missing = [key for key in keys if not isinstance(source.get(key), str) or not source[key].strip()]
    if missing and build.selected('home'):
        raise BuildError(f'docs/{ROOMS_SOURCE}: no Korean text for {", ".join(missing[:5])}' + (f' (+{len(missing) - 5})' if len(missing) > 5 else ''))
    words = {}
    for locale in page_locales('home'):
        lang, code = locale['lang'], locale['locale']
        if code == 'ko-KR':
            words[lang] = {key: source.get(key, '') for key in keys}
            continue
        catalog = build.site.read_json(ROOMS_CATALOG.format(code=code), {}) or {}
        values, absent = {}, []
        for key in keys:
            value = catalog.get(key)
            if isinstance(value, str) and value.strip():
                values[key] = value
            else:
                values[key] = source.get(key, '')
                absent.append(key)
        if absent and not getattr(build, '_rooms_missing', None):
            build._rooms_missing = (code, len(absent), absent[0])
        words[lang] = values
    build._rooms_words = words
    return words


def runtime_files(build):
    return {RUNTIME.format(lang=lang): json.dumps(values, ensure_ascii=False, separators=(',', ':')) + '\n'
            for lang, values in room_words(build).items()}


def strict_rooms(build):
    """Strict builds of the home page fail on any untranslated room string (checked after the pages rendered)."""
    missing = getattr(build, '_rooms_missing', None)
    if build.mode == 'strict' and missing:
        code, count, first = missing
        raise BuildError(f'{code}: {count} room strings untranslated in docs/{ROOMS_CATALOG.format(code=code)} '
                         f'(first: {first}); run --draft to list them')
    return {}


def rooms_text(ctx, arg):
    return RUNTIME_URL.format(lang=ctx.locale['lang'])


def rooms_still(ctx, arg):
    words = room_words(ctx.build).get(ctx.locale['lang'], {})
    items = []
    for room_id in STILL_ROOMS:
        name = words.get(f'room.{room_id}.name')
        logical = f'rooms/{room_id}/thumb.webp'
        entry = ctx.build.assets.lock_entry(logical)
        if not name or not entry:
            raise BuildError(f'{ctx.template}: ROOMS_STILL room {room_id!r} has no name or no thumbnail in the room lock')
        items.append(f'<li><figure><img src="/assets/{logical}" alt="" width="{entry["w"]}" height="{entry["h"]}" loading="lazy" decoding="async">'
                     f'<figcaption>{html.escape(name, quote=False)}</figcaption></figure></li>')
    return ''.join(items)


def home_note(ctx, arg):
    """``<!--HOME_NOTE:…-->``: a section note for the template's reader; it never reaches ``docs/`` (the 15 KB
    first-view HTML budget, PORT-PLAN §6.5)."""
    return ''


core.register('HOME_NOTE', home_note, phase='source')
core.register('ROOMS_TEXT', rooms_text, phase='source')
core.register('ROOMS_STILL', rooms_still)
core.register_output(runtime_files, page='home')
core.register_output(strict_rooms, page='home', after_pages=True)
