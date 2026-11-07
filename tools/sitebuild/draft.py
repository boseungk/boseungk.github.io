"""Draft mode: Korean fallback catalogs, draft markers, ``translation/untranslated.json``, prune.

- ``collect(build)`` records every key used by the translated templates (with context) and by the
  registered key sources (runtime code, partials).
- ``fallback_catalogs(build)``: a locale value that is absent, empty or invalid by the strict
  rules, or a key that is not in ``source.json`` yet, falls back to the Korean key. ko is the
  identity; en uses ``source.json`` (new keys fall back to Korean there too).
- ``mark()``: a non-ko page that used any fallback gets ``data-i18n-draft="<n>"`` on ``<html>``
  and ``<meta name="robots" content="noindex">`` after ``<meta charset>``.
- ``report(build)``: the translator handoff (PORT-PLAN §7.1). Deterministic: no timestamps,
  stable ordering. App suggestions are read (read-only) from the Dayloom catalogs.
- ``prune_files(build)``: ``source.json`` and catalogs without the keys nothing uses.
"""
from bisect import bisect_left
from collections import Counter
from functools import lru_cache
from pathlib import Path
import difflib
import hashlib
import json
import os
import re

from . import core
from .core import LOCALES, PAGES, PLACEHOLDER_NAME, TAG, HL, KeyUse, PageContext, Copy, expand, invalid_reason

REPORT = 'translation/untranslated.json'
DAYLOOM = Path(os.environ.get('DAYLOOM_SOURCE', '/Users/gpt/Projects/dayloom'))
APP_CATALOGS = 'src/core/localization/catalogs'
APP_AUTHORED = 'src/core/localization/authored-english.json'
ROOMS_SOURCE = 'assets/i18n/rooms/source.json'
ROOMS_DATA = 'tools/rooms/rooms.json'
REASONS = ('absent', 'empty', 'placeholders', 'markup')
NON_KO = [item['locale'] for item in LOCALES if item['locale'] != 'ko-KR']
RULES = {
    'brand': 'My Animal Room, App Store, Google Play, iPhone, iPad stay Latin and untranslated',
    'placeholders': 'keep every {name} exactly; order may change',
    'markup': 'phrase keys: keep <span class="hl">…</span> count and order; <br> and <span class="nw">…</span> optional; no other tags',
    'tone': 'app voice: plain, warm, short; no exclamation marks; no invented numbers',
    'appUi': "for entries with appUi:true prefer the app's own wording (suggestions)",
}


def plain(value):
    return re.sub(r'\s+', ' ', TAG.sub(' ', value)).strip()


# --------------------------------------------------------------------------------------------
# Collection

def template_uses(build, page):
    from .translate import Translate, Identity
    site = build.site
    ko = LOCALES[0]
    template = site.template(page.template)
    pieces = []
    text = expand(template, 'source', PageContext(build, page, ko, Copy({}), page.template), pieces)
    records = []
    Translate(ko, Identity(), records, frozenset(site.source())).feed(text)

    def origin(pos):
        for out_start, out_end, src_start, module in pieces:
            if out_start <= pos < out_end or pos == out_end == pieces[-1][1]:
                if module:
                    return module, 0
                return 'tools/templates/' + page.template, template.count('\n', 0, src_start + pos - out_start) + 1
        return 'tools/templates/' + page.template, 0

    texts = sorted((record['pos'], plain(record['key'])) for record in records if record['attr'] is None)
    positions = [pos for pos, _ in texts]
    result = []
    for record in records:
        file, line = origin(record['pos'])
        index = bisect_left(positions, record['pos'])
        before = texts[index - 1][1] if index > 0 else ''
        after_index = index + 1 if record['attr'] is None else index
        after = texts[after_index][1] if after_index < len(texts) else ''
        kind = 'app-ui' if record['appUi'] and record['attr'] is None else record['kind']
        result.append(KeyUse(record['key'], kind=kind, app_ui=record['appUi'], phrase=record['phrase'], context={
            'page': page.name, 'file': file, 'line': line, 'element': record['element'], 'attr': record['attr'],
            'path': record['path'], 'section': record['section'], 'before': before[:80], 'after': after[:80]}))
    return result


def collect(build):
    uses = []
    for page in PAGES.values():
        if page.kind == 'translated' and build.site.template_exists(page.template):
            uses.extend(template_uses(build, page))
    for source in core.KEY_SOURCES:
        uses.extend(source(build))
    return uses


# --------------------------------------------------------------------------------------------
# Fallback catalogs and markers

def fallback_catalogs(build):
    site = build.site
    source = site.source()
    used = {use.key for use in build.uses if use.catalog == 'site'}
    keys = list(source) + sorted(used - source.keys())
    catalogs, fallback, reasons = {}, {}, {}
    for locale in LOCALES:
        lang, code = locale['lang'], locale['locale']
        if code == 'ko-KR':
            catalogs[lang], fallback[lang], reasons[lang] = {key: key for key in keys}, set(), {}
            continue
        base = source if code == 'en-US' else (site.catalog(code) or {})
        copy, missing = {}, {}
        for key in keys:
            if key not in source:
                reason = 'new'
            elif key not in base:
                reason = 'absent'
            else:
                reason = invalid_reason(key, base[key], source[key], key in build.phrase_keys)
            if reason:
                copy[key], missing[key] = key, reason
            else:
                copy[key] = base[key]
        catalogs[lang], fallback[lang], reasons[lang] = copy, set(missing), missing
    return catalogs, fallback, reasons


def mark(text, locale, keys):
    if locale['lang'] == 'ko' or not keys:
        return text
    text = re.sub(r'<html\b([^>]*)>', lambda match: f'<html{match[1]} data-i18n-draft="{len(keys)}">', text, count=1)
    return re.sub(r'(<meta charset=[^>]*>)', r'\1<meta name="robots" content="noindex">', text, count=1)


# --------------------------------------------------------------------------------------------
# App suggestions (read-only Dayloom catalogs)

@lru_cache(maxsize=None)
def app_catalogs(root=str(DAYLOOM)):
    base = Path(root) / APP_CATALOGS
    if not (base / 'ko-KR.json').exists():
        return {}, {}
    korean = json.loads((base / 'ko-KR.json').read_text())
    reverse = {}
    for english, value in sorted(korean.items()):
        if isinstance(value, str):
            reverse.setdefault(value, english)
    catalogs = {}
    for code in NON_KO:
        file = base / (code + '.json')
        catalogs[code] = json.loads(file.read_text()) if file.exists() else {}
    return reverse, catalogs


@lru_cache(maxsize=None)
def app_authored(root=str(DAYLOOM)):
    """The app's own Korean -> English map for catalog labels (room, item and colour names)."""
    file = Path(root) / APP_AUTHORED
    return json.loads(file.read_text()) if file.exists() else {}


def suggestions(text, authored=False):
    """App translations for one Korean string. Room text first follows the app's own label path
    (``authoredLabel``: authored-english.json, then the locale catalog), because one Korean label
    can stand for several English catalog entries."""
    reverse, catalogs = app_catalogs()
    english = app_authored().get(text) if authored else None
    english = english or reverse.get(text)
    if english is None:
        return {}
    found = {code: catalogs[code][english] for code in NON_KO
             if isinstance(catalogs.get(code, {}).get(english), str) and catalogs[code][english].strip()}
    found.setdefault('en-US', english)   # localize(): catalog[locale][english] ?? english
    return found


# --------------------------------------------------------------------------------------------
# Report

def chars_ko(text):
    return len(re.sub(r'\s', '', PLACEHOLDER_NAME.sub('', TAG.sub('', text))))


def markup(key, phrase):
    if phrase:
        optional = (['<br>'] if re.search(r'<br\s*/?>', key) else []) + (['<span class="nw">…</span>'] if '<span class="nw">' in key else [])
        return {'required': ['<span class="hl">…</span>'] * TAG.findall(key).count(HL), 'optional': optional}
    return {'required': TAG.findall(key), 'optional': []}


def page_index(name):
    names = list(PAGES)
    return names.index(name) if name in names else len(names)


def context_order(context):
    return (page_index(context.get('page')), context.get('file') or '', context.get('line') or 0, context.get('attr') or '', context.get('path') or '')


def missing_value(codes):
    codes = [code for code in NON_KO if code in codes]
    return 'all' if len(codes) == len(NON_KO) else codes


def site_entries(build, unused):
    source = build.site.source()
    groups = {}
    for use in build.uses:
        if use.catalog == 'site':
            groups.setdefault(use.key, []).append(use)
    entries = []
    for key, group in groups.items():
        phrase = any(use.phrase for use in group)
        previous = None
        if key not in source:
            problems = {code: 'new' for code in NON_KO}
            previous = previous_key(build, key, unused)
            status = 'changed' if previous else 'new'
        else:
            problems = {}
            for code in NON_KO:
                reason = build.reasons[core.locale_by_code(code)['lang']].get(key)
                if reason:
                    problems[code] = reason
            if not problems:
                continue
            ranked = Counter(problems.values())
            status = max(REASONS, key=lambda reason: (ranked[reason], -REASONS.index(reason)))
        contexts = []
        for use in sorted(group, key=lambda use: context_order(use.context)):
            if use.context not in contexts:
                contexts.append(use.context)
        first = min(group, key=lambda use: context_order(use.context))
        app_ui = any(use.app_ui for use in group)
        found = suggestions(key)
        entry = {'catalog': 'site', 'key': key, 'status': status, 'missing': missing_value(problems),
                 'kind': first.kind, 'charsKo': chars_ko(key), 'appUi': app_ui,
                 'placeholders': PLACEHOLDER_NAME.findall(key), 'markup': markup(key, phrase),
                 'contexts': contexts, 'previous': previous, 'suggestions': found}
        if found:
            entry['suggestionSource'] = 'dayloom authored-english.json + src/core/localization/catalogs (the app label path, read-only)'
        entries.append(entry)
    return entries


def previous_key(build, key, unused):
    candidates = [item for item in unused if item]
    match = difflib.get_close_matches(key, candidates, n=1, cutoff=0.6)
    if not match:
        return None
    old = match[0]
    source = build.site.source()
    translations = {}
    for code in NON_KO:
        catalog = source if code == 'en-US' else (build.site.catalog(code) or {})
        if isinstance(catalog.get(old), str):
            translations[code] = catalog[old]
    return {'key': old, 'similarity': round(difflib.SequenceMatcher(None, key, old).ratio(), 2), 'translations': translations}


def room_kind(key):
    if key.endswith('.desc'):
        return 'body'
    if key.startswith('place.'):
        return 'label'
    return 'name'


def room_entries(build):
    site = build.site
    source = site.read_json(ROOMS_SOURCE)
    if not source:
        return [], []
    catalogs = {code: site.read_json(f'assets/i18n/rooms/catalogs/{code}.json', {}) for code in NON_KO}
    rooms_file = site.repo_file(ROOMS_DATA)
    rooms = {room['id']: room for room in json.loads(rooms_file.read_text())} if rooms_file.exists() else {}
    entries = []
    for key, text in source.items():
        problems = {}
        for code in NON_KO:
            value = catalogs[code].get(key)
            if value is None:
                problems[code] = 'absent'
            elif not isinstance(value, str) or not value.strip():
                problems[code] = 'empty'
            elif sorted(PLACEHOLDER_NAME.findall(value)) != sorted(PLACEHOLDER_NAME.findall(text)):
                problems[code] = 'placeholders'
        if not problems:
            continue
        ranked = Counter(problems.values())
        status = 'new' if len(problems) == len(NON_KO) and set(problems.values()) == {'absent'} else max(REASONS, key=lambda reason: (ranked[reason], -REASONS.index(reason)))
        parts = key.split('.')
        if parts[0] == 'room' and len(parts) == 3:
            room = rooms.get(parts[1], {})
            context = {'source': ROOMS_DATA if room else 'docs/' + ROOMS_SOURCE, 'room': parts[1],
                       'field': {'desc': 'description'}.get(parts[2], parts[2])}
            if room.get('theme'):
                context['theme'] = room['theme']
        else:
            context = {'source': 'docs/' + ROOMS_SOURCE, 'field': parts[0]}
        found = suggestions(text, authored=True)
        entry = {'catalog': 'rooms', 'key': key, 'source': text, 'status': status, 'missing': missing_value(problems),
                 'kind': room_kind(key), 'charsKo': chars_ko(text), 'appUi': room_kind(key) == 'name',
                 'placeholders': PLACEHOLDER_NAME.findall(text), 'markup': {'required': [], 'optional': []},
                 'contexts': [context], 'previous': None, 'suggestions': found}
        if found:
            entry['suggestionSource'] = 'dayloom authored-english.json + src/core/localization/catalogs (the app label path, read-only)'
        entries.append(entry)
    unused = sorted({key for catalog in catalogs.values() for key in catalog} - source.keys())
    return entries, unused


def report(build):
    assert build.mode == 'draft', 'the translator report needs a draft build'
    site = build.site
    source = site.source()
    used = {use.key for use in build.uses if use.catalog == 'site'}
    unused = [key for key in source if key not in used]
    entries = sorted(site_entries(build, unused), key=lambda entry: (context_order(entry['contexts'][0]), entry['key']))
    rooms, rooms_unused = room_entries(build)
    keys = entries + rooms
    rooms_bytes = site.read_bytes(ROOMS_SOURCE) if site.exists(ROOMS_SOURCE) else None
    by_locale = {code: 0 for code in NON_KO}
    for entry in keys:
        for code in (NON_KO if entry['missing'] == 'all' else entry['missing']):
            by_locale[code] += 1
    return {
        'schema': 1,
        'generatedBy': 'tools/build-locales.py --draft',
        'sourceSha256': {'site': hashlib.sha256(site.source_bytes()).hexdigest(),
                         'rooms': hashlib.sha256(rooms_bytes).hexdigest() if rooms_bytes else None},
        'locales': NON_KO,
        'rules': RULES,
        'counts': {'keys': len(keys), 'new': sum(entry['status'] == 'new' for entry in keys),
                   'changed': sum(entry['status'] == 'changed' for entry in keys),
                   'unused': len(unused) + len(rooms_unused),
                   'byCatalog': {'site': len(entries), 'rooms': len(rooms)}, 'byLocale': by_locale},
        'keys': keys,
        'unused': [{'catalog': 'site', 'key': key} for key in unused] + [{'catalog': 'rooms', 'key': key} for key in rooms_unused],
    }


def dump(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + '\n'


def report_output(build):
    if build.mode != 'draft':
        return {}
    build.report = report(build)
    return {REPORT: dump(build.report)}


def summary(data):
    keys = data['counts']['keys']
    locales = sum(1 for count in data['counts']['byLocale'].values() if count)
    return f'DRAFT: {keys} keys, {locales} locales use Korean fallback' + (' - do not deploy' if keys else '')


# --------------------------------------------------------------------------------------------
# Prune

def prune_files(build):
    """Return rewritten ``source.json`` and catalogs without the keys nothing uses."""
    site = build.site
    source = site.source()
    used = {use.key for use in build.uses if use.catalog == 'site'}
    keep = {key: value for key, value in source.items() if key in used}
    files = {'docs/assets/i18n/source.json': dump(keep)}
    for code in NON_KO:
        if code == 'en-US':
            continue
        catalog = site.catalog(code)
        if catalog is not None:
            files[f'docs/assets/i18n/catalogs/{code}.json'] = dump({key: value for key, value in catalog.items() if key in keep})
    rooms = site.read_json(ROOMS_SOURCE)
    if rooms:
        for code in NON_KO:
            rel = f'assets/i18n/rooms/catalogs/{code}.json'
            catalog = site.read_json(rel)
            if catalog is not None:
                files['docs/' + rel] = dump({key: value for key, value in catalog.items() if key in rooms})
    removed = len(source) - len(keep)
    return files, removed


core.register_output(report_output)
