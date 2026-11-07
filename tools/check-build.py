"""Checks for the site build (tools/sitebuild). In-memory fixtures; never writes docs/.

  python3 tools/check-build.py                        unit tests
  python3 tools/check-build.py --baseline DIR [--draft]
        build in memory and diff against DIR (a docs/ snapshot) after stripping ?v=…, font preloads,
        inline @font-face and import maps (B1's head additions) and blank lines
  python3 tools/check-build.py --verify-stamps DIR
        every stamped local URL in DIR's generated HTML (attributes, inline url(), import-map values)
        is either a lock-listed hashed file whose name carries sha256(file)[:10], or carries ?v= equal
        to it; every page with module scripts has one import map covering its module graph
"""
from pathlib import Path
import argparse
import difflib
import json
import re
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sitebuild import core, draft, seo, stamp  # noqa: E402
from sitebuild.core import LOCALES, Build, BuildError, Site, invalid_reason  # noqa: E402
from sitebuild.translate import Identity, Translate  # noqa: E402
from sitebuild.assets import AssetIndex, MissingAsset  # noqa: E402
from sitebuild.copy import graph_keys  # noqa: E402

KO, EN, JA = LOCALES[0], LOCALES[1], LOCALES[2]
VERSION = re.compile(r'\?v=[^"\'&)\s]*')
# What B1 adds to or removes from every head (font preloads, inline @font-face, the import map), so
# --baseline still compares everything else against a pre-B1 snapshot.
B1_HEAD = re.compile(r'<link rel="preload" href="[^"]*" as="font" type="font/[a-z0-9]+" crossorigin>|<style>@font-face\{.*?</style>'
                     r'|<script type="importmap">.*?</script>', re.S)

# The 14 phrase elements of sample C's home (home §4.2), marked with data-phrase.
HOME_PHRASES = '''<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>My Animal Room</title></head><body><main>
<section id="hero">
      <h1 id="hero-title" class="reveal" data-phrase>동물친구와<br><span class="hl">함께 집중</span>해요</h1>
      <p class="body reveal" data-phrase>집중한 만큼 조각을 모으고 다육식물이나 꽃을 키워요. 동물친구와 함께할 공간을 꾸미고, 할 일과 <span class="nw">하루의 기억</span>도 남겨 보세요.</p>
</section><section id="focus">
        <h2 id="focus-title" class="reveal" data-phrase><span class="hl">나의 속도</span>로 집중하기</h2>
        <p class="body reveal" data-phrase>목표 시간을 정하고 집중을 시작해요. 집중을 마치면 <span class="nw">집중 시간</span>과 모은 조각, 성장한 모습을 확인할 수 있어요. 집중할 때 함께 들을 환경음도 고를 수 있어요.</p>
</section><section id="collection">
        <p class="body reveal" data-phrase>고요한 호수부터 구름 찻집까지, 테마마다 다른 방과 <span class="nw">창밖 풍경</span>이 있어요. 테마를 열면 회색이던 방에 빛이 지나가며 색이 들어요.</p>
        <p class="body reveal" data-phrase>벽과 바닥, 의자와 조명, <span class="nw">창밖 풍경</span>까지 한 장면으로 어울리게 고른 방이에요. 마음에 드는 방을 골라 내 방으로 꾸며 보세요.</p>
</section><section id="records">
      <h2 id="records-title" class="reveal" data-phrase>할 일과 <span class="nw">하루의 기억</span> 남기기</h2>
      <p class="body reveal" data-phrase>달력에서 <span class="nw">집중 시간</span>과 <span class="nw">성장 기록</span>도 돌아보세요.</p>
          <p class="mem__text" data-phrase data-app-ui>조용히 책을 읽고, 몸을 조금 움직였다.<br>작은 일을 하나씩 해낸 오늘이 좋다.</p>
        <figcaption data-phrase>글과 사진, 방의 모습을 담아 <span class="nw">하루의 기억</span>을 남길 수 있어요.</figcaption>
</section><section id="night">
      <h2 id="night-title" class="reveal" data-phrase><span class="nw">창밖 풍경</span> 고르기</h2>
      <p class="body reveal" data-phrase>고른 <span class="nw">창밖 풍경</span>은 하루의 시간에 따라 빛이 바뀌어요. 창 너머로 고래가 헤엄치고, 밤에는 별비와 오로라, 연등이 지나가요.</p>
</section><section id="get">
    <h2 id="get-title" class="reveal" data-phrase>집중한 시간이<br>동물친구의 작은 방에 쌓여요</h2>
    <p class="body reveal" data-phrase>집중 타이머와 할 일, 방 꾸미기, <span class="nw">하루의 기억</span>을 한곳에 담은 앱이에요.</p>
</section></main></body></html>
'''


def phrase_elements(template):
    return [re.sub(r'\s+', ' ', inner).strip() for _, inner in re.findall(r'<(\w+)[^>]*\sdata-phrase[^>]*>(.*?)</\1>\n', template)]


def record(template, known=frozenset()):
    records = []
    Translate(KO, Identity(), records, known).feed(template)
    return records


def render_with(template, locale, copy):
    translator = Translate(locale, copy)
    translator.feed(template)
    return ''.join(translator.output)


def news_with(extra):
    template = Site().template('news.ko.html')
    assert '</main>' in template
    return template.replace('</main>', extra + '</main>', 1)


class PhraseKeys(unittest.TestCase):
    def test_home_fixture_has_14_whole_phrase_keys(self):
        expected = phrase_elements(HOME_PHRASES)
        self.assertEqual(len(expected), 14)
        records = record(HOME_PHRASES)
        self.assertEqual([item['key'] for item in records if item['phrase']], expected)
        # No fragment such as "도 남겨 보세요." becomes a key on its own.
        self.assertEqual([item['key'] for item in records if not item['phrase']], [])
        first = records[0]
        self.assertEqual((first['element'], first['kind'], first['path']), ('h1', 'heading', 'main > section#hero > h1#hero-title'))
        memo = next(item for item in records if item['key'].startswith('조용히'))
        self.assertTrue(memo['appUi'])

    def test_translation_replaces_inner_html_and_strips_marker(self):
        expected = phrase_elements(HOME_PHRASES)
        copy = {key: 'EN ' + key for key in expected}
        output = render_with(HOME_PHRASES, EN, copy)
        self.assertNotIn('data-phrase', output)
        self.assertNotIn('data-app-ui', output)
        self.assertIn('<h1 id="hero-title" class="reveal">EN 동물친구와<br> <span class="hl">함께 집중</span>해요</h1>', output)
        ja = render_with(HOME_PHRASES, JA, copy)
        self.assertIn('EN 동물친구와<br><span class="hl">', ja)  # no word gap after <br> in ja/zh

    def test_nested_spans_and_same_tag_nesting(self):
        template = '<p><span class="x" data-phrase>앞 <span class="hl">강조 <span class="nw">묶음</span></span>\n  <br>뒤</span> 끝</p>'
        records = record(template)
        self.assertEqual(records[0]['key'], '앞 <span class="hl">강조 <span class="nw">묶음</span></span> <br>뒤')
        self.assertEqual(records[1]['key'], '끝')
        output = render_with(template, EN, {records[0]['key']: 'A <span class="hl">B</span>', '끝': 'end'})
        self.assertEqual(output, '<p><span class="x">A <span class="hl">B</span></span> end</p>')

    def test_phrase_markup_rule(self):
        key = '동물친구와<br><span class="hl">함께 집중</span>해요'
        ok = lambda value: invalid_reason(key, value, 'source', phrase=True)
        self.assertIsNone(ok('Focus <span class="hl">together</span>'))                      # <br> optional
        self.assertIsNone(ok('<span class="nw">Focus</span><br><span class="hl">together</span>'))  # nw optional
        self.assertEqual(ok('Focus together'), 'markup')                                      # hl required
        self.assertEqual(ok('<span class="hl">a</span><span class="hl">b</span>'), 'markup')  # count
        self.assertEqual(ok('<a href="/">Focus</a> <span class="hl">x</span>'), 'markup')     # no other tags
        self.assertEqual(ok('<span class="hl">x'), 'markup')                                  # balanced
        # Non-phrase keys keep the identical-markup rule.
        self.assertEqual(invalid_reason('가<br>나', 'a b', 'a<br>b'), 'markup')

    def test_phrase_rejects_other_tags(self):
        with self.assertRaisesRegex(BuildError, 'data-phrase may contain only'):
            record('<p data-phrase>문장 <a href="/">링크</a></p>')


class TranslateNo(unittest.TestCase):
    TEMPLATE = '<div><p translate="no" lang="ko" class="demo">한국어 <b title="제목">그대로</b> &amp; <span>두기</span></p><p>번역</p></div>'

    def test_subtree_is_copied_and_exempt(self):
        output = render_with(self.TEMPLATE, EN, {'번역': 'Translated'})
        self.assertEqual(output, '<div><p translate="no" lang="ko" class="demo">한국어 <b title="제목">그대로</b> &amp; <span>두기</span></p><p>Translated</p></div>')

    def test_subtree_is_not_collected(self):
        self.assertEqual([item['key'] for item in record(self.TEMPLATE)], ['번역'])


class Urls(unittest.TestCase):
    def test_query_and_fragment(self):
        translator = Translate(EN, {})
        self.assertEqual(translator.url('/feedback/?idea=abc#idea-abc'), '/en/feedback/?idea=abc#idea-abc')
        self.assertEqual(translator.url('/?from=app'), '/en/?from=app')
        self.assertEqual(translator.url('/news/#latest'), '/en/news/#latest')
        self.assertEqual(translator.url(core.ORIGIN + '/feedback/'), core.ORIGIN + '/en/feedback/')
        self.assertEqual(translator.url('https://example.com/feedback/'), 'https://example.com/feedback/')
        self.assertEqual(Translate(KO, {}).url('/feedback/?idea=abc'), '/ko/feedback/?idea=abc')


class Draft(unittest.TestCase):
    NEW = '<p class="draft-fixture">새로 쓴 안내 문장이에요.</p>'

    # The tree itself has untranslated copy at any time, so every count is read relative to an unmodified build and
    # the fixture adds exactly one key on top.
    @classmethod
    def setUpClass(cls):
        cls.base = Build(Site(), 'draft').run()
        cls.base_report = json.loads(cls.base[draft.REPORT])
        cls.site = Site(templates={'news.ko.html': news_with(cls.NEW)})
        cls.build = Build(cls.site, 'draft')
        cls.outputs = cls.build.run()
        cls.report = json.loads(cls.outputs[draft.REPORT])

    @staticmethod
    def marker(page):
        found = re.search(r'<html [^>]*data-i18n-draft="(\d+)"', page)
        return int(found[1]) if found else 0

    @staticmethod
    def entry(report, key):
        return next(item for item in report['keys'] if item['key'] == key)

    def test_fallback_and_markers(self):
        en = self.outputs['docs/en/news/index.html']
        self.assertIn('새로 쓴 안내 문장이에요.', en)
        self.assertEqual(self.marker(en), self.marker(self.base['docs/en/news/index.html']) + 1)
        self.assertIn('<meta charset="utf-8"><meta name="robots" content="noindex">', en)
        ko = self.outputs['docs/news/index.html']
        self.assertNotIn('data-i18n-draft', ko)
        self.assertNotIn('noindex', ko)
        self.assertEqual(self.marker(self.outputs['docs/en/feedback/index.html']), self.marker(self.base['docs/en/feedback/index.html']))   # other pages unchanged

    def test_report_schema(self):
        report = self.report
        self.assertEqual(list(report), ['schema', 'generatedBy', 'sourceSha256', 'locales', 'rules', 'counts', 'keys', 'unused'])
        self.assertEqual(report['schema'], 1)
        self.assertEqual(len(report['locales']), 29)
        self.assertNotIn('ko-KR', report['locales'])
        self.assertEqual(set(report['sourceSha256']), {'site', 'rooms'})
        self.assertEqual(set(report['rules']), {'brand', 'placeholders', 'markup', 'tone', 'appUi'})
        before = self.base_report['counts']
        self.assertEqual(report['counts']['byCatalog']['rooms'], before['byCatalog']['rooms'])   # A's room text
        self.assertEqual(report['counts']['byCatalog']['site'], before['byCatalog']['site'] + 1)
        self.assertEqual(report['counts']['keys'], before['keys'] + 1)
        # one more missing key in every locale (locales can differ: room catalogs are partly prefilled)
        self.assertEqual(report['counts']['byLocale'], {code: count + 1 for code, count in before['byLocale'].items()})
        entry = self.entry(report, '새로 쓴 안내 문장이에요.')
        self.assertEqual(list(entry)[:11], ['catalog', 'key', 'status', 'missing', 'kind', 'charsKo', 'appUi', 'placeholders', 'markup', 'contexts', 'previous'])
        self.assertEqual((entry['key'], entry['status'], entry['missing'], entry['kind']), ('새로 쓴 안내 문장이에요.', 'new', 'all', 'body'))
        context = entry['contexts'][0]
        line = news_with(self.NEW).splitlines().index(next(line for line in news_with(self.NEW).splitlines() if 'draft-fixture' in line)) + 1
        self.assertEqual((context['page'], context['file'], context['line'], context['element']), ('news', 'tools/templates/news.ko.html', line, 'p'))
        self.assertTrue(all({'catalog', 'key'} == set(item) for item in report['unused']))

    def test_report_is_deterministic(self):
        again = Build(self.site, 'draft').run()[draft.REPORT]
        self.assertEqual(again, self.outputs[draft.REPORT])
        self.assertNotRegex(again, r'20\d\d-\d\d-\d\dT')

    def test_changed_key_points_at_previous(self):
        # an unused old key close to the new one is offered as its previous wording (fixture-owned, survives --prune)
        source = dict(Site().source(), **{'집중부터 기억까지': 'From focus to memory'})
        catalog = dict(Site().catalog('de-DE'), **{'집중부터 기억까지': 'Vom Fokus zur Erinnerung'})
        site = Site(templates={'news.ko.html': news_with('<p>집중부터 기억까지 모두</p>')}, source=source, catalogs={'de-DE': catalog})
        report = draft.report(Build(site, 'draft'))
        self.assertIn('집중부터 기억까지', [item['key'] for item in report['unused']])
        entry = self.entry(report, '집중부터 기억까지 모두')
        self.assertEqual(entry['status'], 'changed')
        self.assertEqual(entry['previous']['key'], '집중부터 기억까지')
        self.assertEqual(entry['previous']['translations']['en-US'], 'From focus to memory')
        self.assertEqual(entry['previous']['translations']['de-DE'], 'Vom Fokus zur Erinnerung')

    def test_strict_failure_text(self):
        # Whichever missing key the build meets first is the one it names; the fixture's is among the missing.
        with self.assertRaisesRegex(BuildError, r"Missing source copy: '"):
            Build(self.site, 'strict').run()
        self.assertEqual(core.untranslated_hint(self.site), f'{self.report["counts"]["keys"]} keys untranslated; run --draft to list them')

    def test_invalid_catalog_value_falls_back(self):
        catalog = dict(Site().catalog('de-DE'))
        catalog['새 소식'] = ''
        site = Site(catalogs={'de-DE': catalog})
        with self.assertRaisesRegex(BuildError, 'de-DE: empty translation for 새 소식'):
            Build(site, 'strict')
        build = Build(site, 'draft', only=['news'])
        pages = build.run()
        self.assertEqual(self.marker(pages['docs/de/news/index.html']), self.marker(self.base['docs/de/news/index.html']) + 1)
        self.assertEqual(self.marker(pages['docs/fr/news/index.html']), self.marker(self.base['docs/fr/news/index.html']))
        entry = self.entry(draft.report(Build(site, 'draft')), '새 소식')
        self.assertEqual((entry['key'], entry['status'], entry['missing']), ('새 소식', 'empty', ['de-DE']))


class Only(unittest.TestCase):
    def test_only_writes_one_page_set(self):
        outputs = Build(Site(), 'draft', only=['feedback']).run()
        pages = [path for path in outputs if path.endswith('index.html')]
        self.assertEqual(len(pages), len(LOCALES) + 1)  # canonical pages plus the legacy Korean alias
        self.assertTrue(all(re.fullmatch(r'docs/([\w-]+/)?feedback/index\.html', path) for path in pages), pages)
        self.assertEqual(set(outputs) - set(pages), set())   # no shared output (sitemap, runtime text, reports) from --only

    def test_unknown_page(self):
        with self.assertRaisesRegex(BuildError, 'unknown page'):
            Build(Site(), 'draft', only=['nope'])


class PageCopy(unittest.TestCase):
    FILES = {
        'assets/fixture/main.js': "import {x} from './a.js';\nexport {y} from '/assets/fixture/c.js';\nconst later = () => import('./b.js');\nt('기능 제안');\n",
        'assets/fixture/a.js': "export const x = text( '새 소식', {n: 1});\n",
        'assets/fixture/b.js': "import '../fixture/a.js';\nt('언어');\n",
        'assets/fixture/c.js': "export const y = 1; // t(\"not a key\") and t(`nor this`)\n",
    }
    TEMPLATE = ('<!doctype html><html lang="ko"><head><meta charset="utf-8"><!--HEAD_COMMON--><!--PAGE_COPY-->'
                '<script type="module" src="/assets/fixture/main.js"></script></head><body><main></main></body></html>')

    def test_keys_equal_module_graph(self):
        site = Site(templates={'feedback.ko.html': self.TEMPLATE}, files=self.FILES)
        expected = set(graph_keys(site, self.TEMPLATE))
        self.assertEqual(expected, {'기능 제안', '새 소식', '언어'})
        outputs = Build(site, 'strict', only=['feedback']).run()
        page = outputs['docs/en/feedback/index.html']
        data = json.loads(re.search(r'<script type="application/json" id="page-copy">(.*?)</script>', page)[1])
        self.assertEqual(set(data['copy']), expected)
        self.assertEqual(data['copy']['새 소식'], Site().source()['새 소식'])
        self.assertEqual(data['meta']['routes'], {'home': '/en/', 'feedback': '/en/feedback/', 'news': '/en/news/', 'privacy': '/en/privacy/', 'appPrivacy': '/en/app-privacy/'})
        self.assertRegex(page, r'src="/assets/fixture/main\.js\?v=[0-9a-f]{10}"')
        uses = [use for use in Build(site, 'draft').uses if use.runtime_page == 'feedback' and use.context['file'].startswith('docs/assets/fixture')]
        self.assertEqual({use.key for use in uses}, expected)


class Stamping(unittest.TestCase):
    def setUp(self):
        self.index = AssetIndex(Site(files={'assets/a.png': b'a', 'assets/b.png': b'b'}))

    def test_stamped_attributes(self):
        html = ('<link rel="stylesheet" href="/assets/site/base.css"><link rel="canonical" href="/assets/a.png"><a href="/assets/a.png">x</a>'
                '<img src="/assets/a.png" srcset="/assets/a.png 1x, /assets/b.png 2x" data-full="/assets/b.png#f" alt="">'
                '<img src="https://example.com/x.png"><script>var s = "<img src=/assets/none.png>";</script>')
        out = stamp.stamp_html(html, self.index)
        a, b = core.sha10(b'a'), core.sha10(b'b')
        self.assertIn(f'href="/assets/site/base.css?v={core.sha10((core.DOCS / "assets/site/base.css").read_bytes())}"', out)
        self.assertIn('<link rel="canonical" href="/assets/a.png">', out)
        self.assertIn('<a href="/assets/a.png">', out)
        self.assertIn(f'src="/assets/a.png?v={a}" srcset="/assets/a.png?v={a} 1x, /assets/b.png?v={b} 2x" data-full="/assets/b.png?v={b}#f"', out)
        self.assertIn('src="https://example.com/x.png"', out)
        self.assertIn('/assets/none.png>', out)

    def test_missing_and_hand_written(self):
        with self.assertRaises(MissingAsset):
            stamp.stamp_html('<img src="/assets/none.png">', self.index)
        with self.assertRaisesRegex(BuildError, 'hand-written version string'):
            stamp.stamp_html('<img src="/assets/a.png?v=27">', self.index)

    def test_templates_carry_no_version_strings(self):
        for file in (core.REPO / 'tools/templates').glob('*.html'):
            self.assertNotRegex(file.read_text(), r'\?v=', file.name)


def hashed_name(logical, data):
    base, ext = logical.rsplit('.', 1)
    return f'{base}.{core.sha10(data)}.{ext}'


def fixture_lock(entries, extra=None):
    """``entries``: {logical: bytes}. Returns (lock json, {docs-relative file: bytes})."""
    import hashlib
    outputs, files = [], {}
    for logical, data in entries.items():
        file = hashed_name(logical, data)
        outputs.append({'logical': logical, 'file': file, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'w': 4, 'h': 2})
        files['assets/' + file] = data
    return {'version': 1, 'outputs': outputs, 'extra': extra or {}}, files


ART = {'art/pieces/wood.webp': b'wood', 'art/night-band.webp': b'band'}
FONT_FACES = [
    {'id': 'latin', 'family': 'LINE Seed', 'logical': 'fonts/t-latin.otf', 'unicodeRange': 'U+0000-007E, U+00A0-00FF', 'display': 'swap', 'langs': ['ko'], 'preload': ['ko']},
    {'id': 'ko', 'family': 'LINE Seed', 'logical': 'fonts/t-ko.otf', 'unicodeRange': 'U+1100-11FF, U+AC00-D7A3', 'display': 'swap', 'langs': ['ko'], 'preload': ['ko']},
    {'id': 'rare', 'family': 'LINE Seed Rare', 'logical': 'fonts/t-rare.otf', 'unicodeRange': 'U+AC00-D7A3', 'display': 'swap', 'langs': ['ko'], 'preload': []},
    {'id': 'jp-latin', 'family': 'LINE Seed JP', 'logical': 'fonts/t-jp-latin.ttf', 'unicodeRange': 'U+0000-00FF', 'display': 'swap', 'langs': ['en', 'ja'], 'preload': ['en']},
    {'id': 'jp-ja', 'family': 'LINE Seed JP', 'logical': 'fonts/t-jp-ja.ttf', 'unicodeRange': 'U+3000-30FF, U+4E00-9FFF', 'display': 'swap', 'langs': ['ja'], 'preload': ['ja']},
]


def fixture_site(templates=None, files=None, art=True, font=True):
    locks, all_files = {}, dict(files or {})
    if art:
        locks['art'], extra = fixture_lock(ART)
        # The real templates name real art (community band, share image): the fixture lock carries the real
        # entries too; their files are read from docs/.
        real = json.loads((core.REPO / 'architecture/art-asset-sources.json').read_text())['outputs']
        locks['art']['outputs'] += [entry for entry in real if entry['logical'] not in ART]
        all_files.update(extra)
    if font:
        locks['font'], extra = fixture_lock({face['logical']: face['id'].encode() * 3 for face in FONT_FACES}, {'faces': FONT_FACES})
        all_files.update(extra)
    site = Site(templates=templates, files=all_files)
    site.locks = locks
    return site


class AssetLocks(unittest.TestCase):
    def setUp(self):
        self.site = fixture_site(files={'assets/a.png': b'a'})
        self.index = AssetIndex(self.site)

    def test_logical_names_become_hashed_files(self):
        wood = '/assets/' + hashed_name('art/pieces/wood.webp', b'wood')
        self.assertEqual(self.index.resolve('/assets/art/pieces/wood.webp'), wood)
        self.assertEqual(self.index.resolve('/assets/a.png'), f'/assets/a.png?v={core.sha10(b"a")}')
        self.assertEqual(list(self.index.used), [wood, f'/assets/a.png?v={core.sha10(b"a")}'])
        self.assertEqual(self.index.lock_entry('/assets/art/pieces/wood.webp')['w'], 4)
        # A query on a hashed file stays, without ?v=.
        self.assertEqual(stamp.stamp_url('/assets/art/pieces/wood.webp?x=1#f', self.index, ''), wood + '?x=1#f')

    def test_hashed_name_in_template_fails(self):
        with self.assertRaisesRegex(BuildError, 'write the logical name /assets/art/pieces/wood.webp'):
            self.index.resolve('/assets/' + hashed_name('art/pieces/wood.webp', b'wood'))

    def test_lock_listed_file_missing(self):
        site = fixture_site()
        site.files.pop('assets/' + hashed_name('art/night-band.webp', b'band'))
        with self.assertRaisesRegex(MissingAsset, 'run its generator'):
            AssetIndex(site).resolve('/assets/art/night-band.webp')

    def test_lock_consistency(self):
        lock, files = fixture_lock({'art/x.webp': b'x'})
        lock['outputs'][0]['file'] = 'art/x.0000000000.webp'
        site = Site(files=files)
        site.locks = {'art': lock}
        with self.assertRaisesRegex(BuildError, 'does not carry sha256'):
            AssetIndex(site)

    def test_real_locks(self):
        index = AssetIndex(Site())
        self.assertRegex(index.resolve('/assets/rooms/manifest.json'), r'^/assets/rooms/manifest\.[0-9a-f]{10}\.json$')
        self.assertRegex(index.resolve('/assets/fonts/line-seed-ko.otf'), r'^/assets/fonts/line-seed-ko\.[0-9a-f]{10}\.otf$')
        self.assertGreater(len(index.logical), 2000)

    def test_keep_urls_hook(self):
        from sitebuild.assets import keep_urls
        build = Build(fixture_site(), 'draft', only=['news'])
        build.run()
        urls = keep_urls(build)
        self.assertEqual(urls, sorted(urls))
        self.assertIn('/assets/' + hashed_name('fonts/t-rare.otf', b'rarerarerare'), urls)   # never preloaded, still kept
        self.assertTrue(any(url.startswith('/assets/news.css?v=') for url in urls))
        self.assertTrue(all(url.startswith('/') for url in urls))


class InlineCss(unittest.TestCase):
    def setUp(self):
        self.index = AssetIndex(fixture_site(files={'assets/a.png': b'a'}))
        self.wood = '/assets/' + hashed_name('art/pieces/wood.webp', b'wood')
        self.a = f'/assets/a.png?v={core.sha10(b"a")}'

    def test_style_element(self):
        html = ('<style>:root{--art-wood:url(/assets/art/pieces/wood.webp);--b:url( "/assets/a.png" )}'
                '.m{mask:url(#m);background:url(data:image/png;base64,AA) , url(https://x.test/a.png)}</style>'
                '<script>const s = "<style>x{background:url(/assets/none.png)}</style>";</script>')
        out = stamp.stamp_html(html, self.index)
        self.assertIn(f'--art-wood:url({self.wood});--b:url( "{self.a}" )}}', out)
        self.assertIn('url(#m);background:url(data:image/png;base64,AA) , url(https://x.test/a.png)}', out)
        self.assertIn('url(/assets/none.png)', out)   # inside a script string: not CSS

    def test_style_attribute_keeps_quotes(self):
        out = stamp.stamp_html('<div style="background:url(\'/assets/a.png\') no-repeat;--w:url(/assets/art/pieces/wood.webp)">x</div>', self.index)
        self.assertEqual(out, f'<div style="background:url(\'{self.a}\') no-repeat;--w:url({self.wood})">x</div>')

    def test_missing_and_versioned(self):
        with self.assertRaises(MissingAsset):
            stamp.stamp_html('<style>a{b:url(/assets/none.png)}</style>', self.index)
        with self.assertRaisesRegex(BuildError, 'hand-written version string'):
            stamp.stamp_html('<p style="b:url(/assets/a.png?v=1)"></p>', self.index)


class ArtVars(unittest.TestCase):
    def test_art_vars_placeholder(self):
        site = fixture_site(templates={'news.ko.html': news_with('<!--ART_VARS:wood=/assets/art/pieces/wood.webp /assets/art/night-band.webp-->')})
        page = Build(site, 'draft', only=['news']).run()['docs/en/news/index.html']
        wood = '/assets/' + hashed_name('art/pieces/wood.webp', b'wood')
        band = '/assets/' + hashed_name('art/night-band.webp', b'band')
        self.assertIn(f'<style>:root{{--art-wood:url({wood});--art-night-band:url({band})}}</style>', page)

    def test_bad_item(self):
        site = fixture_site(templates={'news.ko.html': news_with('<!--ART_VARS:Wood!=art/x.webp-->')})
        with self.assertRaisesRegex(BuildError, 'ART_VARS item'):
            Build(site, 'draft', only=['news']).run()


class ImportMaps(unittest.TestCase):
    FILES = PageCopy.FILES

    def page(self, template, files=None):
        site = Site(templates={'feedback.ko.html': template}, files=files or self.FILES)
        return Build(site, 'strict', only=['feedback']).run()['docs/en/feedback/index.html']

    def test_map_covers_module_graph(self):
        page = self.page(PageCopy.TEMPLATE)
        maps = re.findall(r'<script type="importmap">(.*?)</script>', page)
        self.assertEqual(len(maps), 1)
        imports = json.loads(maps[0])['imports']
        order = ['/assets/fixture/main.js', '/assets/fixture/a.js', '/assets/fixture/c.js', '/assets/fixture/b.js']
        self.assertEqual(list(imports), order)
        for path in order:
            self.assertEqual(imports[path], f'{path}?v={core.sha10(self.FILES[path[1:]])}')
        self.assertLess(page.index('type="importmap"'), page.index('type="module"'))
        self.assertIn(f'src="/assets/fixture/main.js?v={core.sha10(self.FILES["assets/fixture/main.js"])}"', page)
        self.assertNotIn('data-sitebuild-importmap', page)

    def test_real_board_graph(self):
        outputs = Build(Site(), 'draft', only=['feedback']).run()
        imports = json.loads(re.search(r'<script type="importmap">(.*?)</script>', outputs['docs/feedback/index.html'])[1])['imports']
        for path in ('/assets/feedback/feedback.js', '/assets/feedback/client.mjs', '/assets/feedback/motion.mjs', '/assets/site/text.mjs'):
            self.assertEqual(imports[path], f'{path}?v={core.sha10((core.DOCS / path[1:]).read_bytes())}')
        self.assertNotIn('/assets/feedback/copy.mjs', imports)   # copy is inlined as #page-copy

    def test_page_without_modules_has_no_map(self):
        page = Build(Site(), 'draft', only=['news']).run()['docs/news/index.html']
        self.assertNotIn('importmap', page)

    def test_module_page_without_head_common_fails(self):
        with self.assertRaisesRegex(BuildError, 'no <!--HEAD_COMMON-->'):
            self.page(PageCopy.TEMPLATE.replace('<!--HEAD_COMMON-->', ''))

    def test_module_before_map_fails(self):
        template = PageCopy.TEMPLATE.replace('<!--HEAD_COMMON-->', '').replace('</script></head>', '</script><!--HEAD_COMMON--></head>')
        with self.assertRaisesRegex(BuildError, 'before <!--HEAD_COMMON-->'):
            self.page(template)

    def test_versioned_specifier_fails(self):
        files = dict(self.FILES, **{'assets/fixture/a.js': "import './c.js?v=abc';\n"})
        with self.assertRaisesRegex(BuildError, "version string in module specifier './c.js\\?v=abc'"):
            self.page(PageCopy.TEMPLATE, files)


class Fonts(unittest.TestCase):
    def pages(self, site):
        return Build(site, 'draft', only=['news']).run()

    def test_faces_and_preloads_from_lock(self):
        pages = self.pages(fixture_site())
        latin, ko, rare, jp_latin, jp_ja = ('/assets/' + hashed_name(face['logical'], face['id'].encode() * 3) for face in FONT_FACES)
        otf = '<link rel="preload" href="{}" as="font" type="font/otf" crossorigin>'
        ttf = '<link rel="preload" href="{}" as="font" type="font/ttf" crossorigin>'
        ko_page, en_page, ja_page = pages['docs/news/index.html'], pages['docs/en/news/index.html'], pages['docs/ja/news/index.html']
        # each page declares and preloads only its own language's faces (extras F2)
        self.assertIn(otf.format(latin) + otf.format(ko) + '<style>@font-face{', ko_page)
        self.assertIn(ttf.format(jp_latin) + '<style>@font-face{', en_page)
        self.assertIn(ttf.format(jp_ja) + '<style>@font-face{', ja_page)
        self.assertEqual(ko_page.count('@font-face{'), 3)
        self.assertEqual(en_page.count('@font-face{'), 1)
        self.assertEqual(ja_page.count('@font-face{'), 2)
        self.assertIn(f'@font-face{{font-family:"LINE Seed Rare";src:url({rare}) format("opentype");font-weight:400;font-style:normal;'
                      'font-display:swap;unicode-range:U+AC00-D7A3}', ko_page)
        self.assertIn(f'@font-face{{font-family:"LINE Seed JP";src:url({jp_latin}) format("truetype");font-weight:400;font-style:normal;'
                      'font-display:swap;unicode-range:U+0000-00FF}', en_page)
        self.assertNotIn(ttf.format(jp_latin), ja_page)     # declared on ja, preloaded only where the lock says
        for page in (en_page, ja_page):
            self.assertNotIn('"LINE Seed"', page)
            self.assertNotIn(ko, page)
        for page in (ko_page, en_page, ja_page):
            self.assertNotIn(f'href="{rare}"', page)
            self.assertNotIn('LINESeedKR-Regular.otf', page)
            self.assertLess(page.index('<meta name="viewport"'), page.index('@font-face'))

    def test_legacy_lock_values(self):
        # a face without langs is declared everywhere; preload "all" or one language still works
        faces = [dict(FONT_FACES[0], preload='all'), dict(FONT_FACES[1], preload='ko')]
        for face in faces:
            face.pop('langs')
        site = fixture_site()
        site.locks['font']['extra']['faces'] = faces
        pages = self.pages(site)
        latin = '/assets/' + hashed_name('fonts/t-latin.otf', b'latinlatinlatin')
        self.assertIn(f'<link rel="preload" href="{latin}"', pages['docs/en/news/index.html'])
        self.assertEqual(pages['docs/en/news/index.html'].count('@font-face{'), 2)
        self.assertNotIn('t-ko.', pages['docs/en/news/index.html'].split('<style>')[0])

    def test_no_font_lock_emits_nothing(self):
        # The templates no longer carry a legacy font preload: without a lock the head has no font links at all.
        page = self.pages(fixture_site(font=False))['docs/news/index.html']
        self.assertNotIn('as="font"', page)
        self.assertNotIn('@font-face', page)
        self.assertNotIn('LINESeedKR-Regular.otf', page)

    def test_real_lock(self):
        pages = self.pages(Site())
        preloads = lambda path: re.findall(r'<link rel="preload" href="/assets/fonts/([a-z-]+)\.[0-9a-f]{10}\.(?:otf|ttf)" as="font"', pages[path])
        families = lambda path: re.findall(r'@font-face\{font-family:"([^"]+)"', pages[path])
        self.assertEqual(preloads('docs/news/index.html'), ['line-seed-latin', 'line-seed-ko'])
        self.assertEqual(set(families('docs/news/index.html')), {'LINE Seed', 'LINE Seed Rare'})
        self.assertEqual(len(re.findall(r'src:url\(/assets/fonts/line-seed-(?:latin|ext|ko|rare)\.[0-9a-f]{10}\.otf\)', pages['docs/news/index.html'])), 4)
        # the app's font per language (Dayloom locale-fonts.ts; Noto Sans TC stands in for LINE Seed TW)
        for lang, family, preload in (('en', 'LINE Seed JP', ['line-seed-jp-latin']), ('ja', 'LINE Seed JP', ['line-seed-jp-latin', 'line-seed-jp-ja']),
                                      ('ru', 'LINE Seed JP', ['line-seed-jp-latin', 'line-seed-jp-cyrillic']), ('zh-hans', 'Noto Sans SC', ['noto-sans-sc']),
                                      ('zh-hant', 'Noto Sans TC', ['noto-sans-tc']), ('vi', 'Noto Sans', ['noto-sans-latin', 'noto-sans-latin-ext']),
                                      ('th', 'LINE Seed TH', ['line-seed-th']), ('ar', 'Noto Sans Arabic', ['noto-sans-arabic'])):
            path = f'docs/{lang}/news/index.html'
            self.assertEqual(set(families(path)), {family}, path)
            self.assertEqual(preloads(path), preload, path)
        css = (core.REPO / 'docs/assets/site/base.css').read_text()
        for selector, family in (('html:not(:lang(ko))', 'LINE Seed JP'), ('html:lang(zh-Hans)', 'Noto Sans SC'), ('html:lang(zh-Hant)', 'Noto Sans TC'),
                                 ('html:is(:lang(nl), :lang(vi))', 'Noto Sans'), ('html:lang(th)', 'LINE Seed TH'), ('html:lang(ar)', 'Noto Sans Arabic'),
                                 ('html:lang(he)', 'Noto Sans Hebrew'), ('html:lang(hi)', 'Noto Sans Devanagari'), ('html:lang(bn)', 'Noto Sans Bengali'),
                                 ('html:lang(ta)', 'Noto Sans Tamil')):
            self.assertRegex(css, re.escape(selector) + r' \{[^}]*--font-face: "' + re.escape(family) + '"', selector)

    def test_404_declares_every_face(self):
        page = Build(Site(), 'draft', only=['404']).run()['docs/404.html']
        lock = json.loads((core.REPO / 'architecture/font-asset-sources.json').read_text())
        self.assertEqual(page.count('@font-face{'), len(lock['extra']['faces']))
        self.assertEqual(re.findall(r'<link rel="preload" href="/assets/fonts/([a-z-]+)\.', page), ['line-seed-latin', 'line-seed-ko'])

    def test_policy_pages_follow_their_language(self):
        pages = Build(Site(), 'draft', only=['privacy']).run()
        self.assertIn('line-seed-ko.', pages['docs/privacy/index.html'].split('<style>')[0])
        self.assertNotIn('line-seed-ko.', pages['docs/en/privacy/index.html'].split('<style>')[0])
        self.assertIn('line-seed-jp-latin.', pages['docs/en/privacy/index.html'].split('<style>')[0])


class VerifyStamps(unittest.TestCase):
    def test_verify_url(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            good = hashed_name('art/x.webp', b'x')
            (root / 'assets/art').mkdir(parents=True)
            (root / 'assets' / good).write_bytes(b'x')
            (root / 'assets/art/y.0123456789.webp').write_bytes(b'y')
            (root / 'assets/a.css').write_bytes(b'a')
            locks = {good, 'art/y.0123456789.webp'}
            self.assertIsNone(verify_url(root, '/assets/' + good, locks))
            self.assertIn('file name hash', verify_url(root, '/assets/art/y.0123456789.webp', locks))
            self.assertIn('carries ?v=', verify_url(root, f'/assets/{good}?v={core.sha10(b"x")}', locks))
            self.assertIsNone(verify_url(root, f'/assets/a.css?v={core.sha10(b"a")}', locks))
            self.assertIn('expected v=', verify_url(root, '/assets/a.css', locks))
            self.assertIn('missing', verify_url(root, '/assets/b.css?v=1', locks))

    def test_page_urls(self):
        text = ('<link rel="stylesheet" href="/a.css?v=1"><style>@font-face{src:url(/f.otf)}</style>'
                '<div style="--x:url(\'/x.webp\')"></div><img srcset="/1.png 1x, /2.png 2x">')
        self.assertEqual([url for _, url in page_urls(text)], ['/a.css?v=1', '/f.otf', '/x.webp', '/1.png', '/2.png'])


class Placeholders(unittest.TestCase):
    def test_unresolved_placeholder_fails(self):
        site = Site(templates={'news.ko.html': news_with('<!--NOT_REGISTERED-->')})
        with self.assertRaisesRegex(BuildError, 'unresolved placeholder <!--NOT_REGISTERED-->'):
            Build(site, 'draft', only=['news']).run()


class RealTree(unittest.TestCase):
    def test_draft_equals_strict_without_new_copy(self):
        try:
            strict = Build(Site(), 'strict').run()
        except BuildError as error:
            self.skipTest(f'strict build fails on this tree ({error}); expected once new Korean copy lands')
        drafted = Build(Site(), 'draft').run()
        report = json.loads(drafted.pop(draft.REPORT))
        self.assertEqual(report['counts']['byCatalog']['site'], 0)
        # only a full strict build advances the sitemap lastmod ledger; every shared output must match
        self.assertIn(seo.LEDGER, strict)
        self.assertNotIn(seo.LEDGER, drafted)
        strict.pop(seo.LEDGER)
        self.assertEqual(strict, drafted)
        self.assertFalse(any('data-i18n-draft' in text for text in drafted.values()))


class Prune(unittest.TestCase):
    def test_prune_drops_unused_keys_everywhere(self):
        source = dict(Site().source(), **{'아무도 쓰지 않는 키': 'Unused'})
        de = dict(Site().catalog('de-DE'), **{'아무도 쓰지 않는 키': 'Unbenutzt'})
        files, removed = draft.prune_files(Build(Site(source=source, catalogs={'de-DE': de}), 'draft'))
        self.assertGreaterEqual(removed, 1)
        pruned = json.loads(files['docs/assets/i18n/source.json'])
        self.assertNotIn('아무도 쓰지 않는 키', pruned)
        self.assertIn('새 소식', pruned)
        self.assertEqual(list(json.loads(files['docs/assets/i18n/catalogs/de-DE.json'])), list(pruned))
        self.assertTrue(files['docs/assets/i18n/source.json'].endswith('}\n'))


# ------------------------------------------------------------------------------------------------

def baseline(directory, mode):
    directory = Path(directory)
    outputs = Build(Site(), mode).run()
    normalize = lambda text: '\n'.join(line for line in B1_HEAD.sub('', VERSION.sub('', text)).split('\n') if line.strip())
    diffs, compared = [], 0
    for file in sorted(path for path in directory.rglob('*') if path.is_file()):
        rel = 'docs/' + file.relative_to(directory).as_posix()
        compared += 1
        if rel not in outputs:
            diffs.append(f'{rel}: not generated')
            continue
        old, new = normalize(file.read_text()).splitlines(), normalize(outputs[rel]).splitlines()
        if old != new:
            delta = list(difflib.unified_diff(old, new, 'baseline/' + rel, 'build/' + rel, n=0, lineterm=''))
            diffs.append('\n'.join(delta[:12]))
    extra = sorted(rel for rel in outputs if rel.startswith('docs/') and not (directory / rel[len('docs/'):]).exists())
    for item in diffs:
        print(item)
    print(f'{"PASS" if not diffs else "FAIL"} baseline {directory}: {compared} files compared, {len(diffs)} diffs after ?v= normalization'
          + (f'; {len(extra)} generated files not in the baseline' if extra else ''))
    return 1 if diffs else 0


HASHED_NAME = re.compile(r'\.([0-9a-f]{10})\.[a-z0-9]+$')


def page_urls(text):
    """Yield ``(where, url)`` for every URL the stamp pass owns in a generated page: stamped
    attributes, ``url()`` in inline ``<style>``/``style=""``, and import-map values."""
    parser = stamp.Tags(text)
    parser.feed(text)
    for offset, raw, tag, attrs in parser.tags:
        values = dict(attrs)
        if tag == 'style':
            body = text[offset + len(raw):]
            end = stamp.STYLE_END.search(body)
            for _, _, url in stamp.css_urls(body[:end.start() if end else len(body)]):
                yield 'style', url.strip()
        for name in stamp.stamp_attributes(tag, attrs):
            if name == 'style':
                urls = [url.strip() for _, _, url in stamp.css_urls(values[name])]
            elif name == 'srcset':
                urls = [part.strip().split()[0] for part in values[name].split(',') if part.strip()]
            else:
                urls = [values[name]]
            for url in urls:
                yield name, url


def import_maps(text):
    return [json.loads(body) for body in re.findall(r'<script type="importmap">(.*?)</script>', text, re.S)]


def verify_url(directory, url, lock_files):
    """Return a problem string or None for one root-absolute URL in ``directory``."""
    path, _, query = url.split('#')[0].partition('?')
    target = directory / path.lstrip('/')
    version = dict(part.split('=', 1) for part in query.split('&') if '=' in part).get('v')
    if not target.is_file():
        return f'missing {path}'
    digest = core.sha10(target.read_bytes())
    hashed = HASHED_NAME.search(path)
    if hashed and path[len('/assets/'):] in lock_files:
        if version is not None:
            return f'{url}: lock-listed hashed file carries ?v='
        if hashed[1] != digest:
            return f'{url}: file name hash {hashed[1]} != sha256[:10] {digest}'
        return None
    if version != digest:
        return f'{url} (expected v={digest})'
    return None


def stamp_problems(directory):
    """Return ``(problems, stats)`` for every generated page in ``directory`` (see ``verify_stamps``)."""
    from sitebuild.assets import AssetIndex
    from sitebuild.importmap import module_entries, module_graph
    directory = Path(directory)
    lock_files = set(AssetIndex(Site()).files)
    generated = {page.output(locale)[len('docs/'):] for page in core.PAGES.values() for locale in core.page_locales(page.name)}
    problems, checked, skipped, mapped, hashed = [], 0, [], 0, 0
    for file in sorted(directory.rglob('*.html')):
        rel = file.relative_to(directory).as_posix()
        if rel not in generated:
            skipped.append(rel)  # hand-written (e.g. 404.html until E builds it)
            continue
        text = file.read_text()
        urls = list(page_urls(text))
        maps = import_maps(text)
        entries = module_entries(text)
        if entries and len(maps) != 1:
            problems.append(f'{rel}: {len(maps)} import maps on a page with module scripts (expected 1)')
        if not entries and maps:
            problems.append(f'{rel}: import map on a page without module scripts')
        for mapping in maps:
            imports = mapping.get('imports', {})
            graph = module_graph(None, entries, read=lambda path: (directory / path.lstrip('/')).read_text())
            missing = [path for path in graph if path not in imports]
            if missing:
                problems.append(f'{rel}: import map lacks {", ".join(missing)}')
            for key, value in imports.items():
                if value.split('?')[0] != key:
                    problems.append(f'{rel}: import map {key} -> {value} changes the path')
                urls.append(('importmap', value))
                mapped += 1
        for name, url in urls:
            if not url.startswith('/') or url.startswith('//') or url.split('?')[0].split('#')[0].endswith('/'):
                continue
            checked += 1
            hashed += url.split('?')[0][len('/assets/'):] in lock_files
            problem = verify_url(directory, url, lock_files)
            if problem:
                problems.append(f'{rel}: {problem}')
    return problems, {'checked': checked, 'hashed': hashed, 'mapped': mapped, 'pages': len(generated), 'skipped': skipped}


def verify_stamps(directory):
    problems, stats = stamp_problems(directory)
    for problem in problems[:40]:
        print(problem)
    print(f'{"PASS" if not problems else "FAIL"} {stats["checked"]} stamped URLs ({stats["hashed"]} lock-listed hashed files, '
          f'{stats["mapped"]} import-map entries) in {stats["pages"]} generated pages, {len(problems)} problems'
          + (f'; not generated by the build, skipped: {", ".join(stats["skipped"])}' if stats['skipped'] else ''))
    return 1 if problems else 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--baseline', metavar='DIR')
    parser.add_argument('--draft', action='store_true', help='with --baseline: compare draft output')
    parser.add_argument('--verify-stamps', metavar='DIR')
    args, rest = parser.parse_known_args()
    if args.baseline:
        raise SystemExit(baseline(args.baseline, 'draft' if args.draft else 'strict'))
    if args.verify_stamps:
        raise SystemExit(verify_stamps(args.verify_stamps))
    unittest.main(argv=[sys.argv[0], *rest])
