"""Build crawlable home/feedback pages for every supported app locale."""
from html.parser import HTMLParser
from pathlib import Path
import argparse
import html
import json
import re

REPO = Path(__file__).resolve().parents[1]
DOCS = REPO / 'docs'
I18N = DOCS / 'assets/i18n'
SOURCE = json.loads((I18N / 'source.json').read_text())
LOCALES = json.loads((I18N / 'locales.json').read_text())
ORIGIN = 'https://www.myanimalroom.com'
KOREAN = re.compile('[가-힣]')
AUTHORED_PAGES = {
    'privacy': ('ko', 'en'),
    'app-privacy': ('ko', 'en', 'ja', 'zh-Hant'),
}


def page_locales(page):
    return [locale for locale in LOCALES if page not in AUTHORED_PAGES or locale['lang'] in AUTHORED_PAGES[page]]


def route(locale, page='home'):
    if page in AUTHORED_PAGES and locale['lang'] not in AUTHORED_PAGES[page]:
        return f'/en/{page}/'
    return '/' + (locale['path'] + '/' if locale['path'] else '') + (page + '/' if page != 'home' else '')


def load_catalogs():
    catalogs = {}
    for locale in LOCALES:
        code = locale['locale']
        copy = {key: key for key in SOURCE} if code == 'ko-KR' else SOURCE if code == 'en-US' else json.loads((I18N / 'catalogs' / (code + '.json')).read_text())
        if copy.keys() != SOURCE.keys():
            raise ValueError(f'{code}: missing {SOURCE.keys() - copy.keys()}, extra {copy.keys() - SOURCE.keys()}')
        for key, value in copy.items():
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f'{code}: empty translation for {key}')
            if sorted(re.findall(r'\{\w+\}', value)) != sorted(re.findall(r'\{\w+\}', SOURCE[key])):
                raise ValueError(f'{code}: changed placeholders for {key}')
            if re.findall(r'<[^>]+>', value) != re.findall(r'<[^>]+>', SOURCE[key]):
                raise ValueError(f'{code}: changed markup for {key}')
        catalogs[locale['lang']] = copy
    return catalogs


class Translate(HTMLParser):
    def __init__(self, locale, copy):
        super().__init__(convert_charrefs=False)
        self.locale, self.copy = locale, copy
        self.output = []
        self.raw = False

    def text(self, value):
        if KOREAN.search(value) and value not in self.copy:
            raise ValueError(f'Missing source copy: {value!r}')
        return self.copy.get(value, value)

    def url(self, value):
        for source, page in [('/feedback/', 'feedback'), ('/news/', 'news'), ('/privacy/', 'privacy'), ('/app-privacy/', 'app-privacy'), ('/', 'home')]:
            if value == source or value.startswith(source + '#'):
                return route(self.locale, page) + value[len(source):]
            if value == ORIGIN + source:
                return ORIGIN + route(self.locale, page)
        return value

    def handle_decl(self, data):
        self.output.append(f'<!{data}>')

    def handle_starttag(self, tag, attrs):
        self.raw = tag in ('script', 'style') or self.raw
        original = dict(attrs)
        translated = []
        for key, value in attrs:
            if value is not None:
                value = self.text(value)
                if key in ('href', 'content'):
                    value = self.url(value)
                if key == 'content' and original.get('property') == 'og:locale':
                    value = {'zh-Hans-CN': 'zh_CN', 'zh-Hant-TW': 'zh_TW'}.get(self.locale['locale'], self.locale['locale'].replace('-', '_'))
            if tag == 'html' and key == 'lang':
                value = self.locale['lang']
            translated.append(key if value is None else f'{key}="{html.escape(value, quote=True)}"')
        if tag == 'html':
            translated.extend([f'dir="{self.locale["direction"]}"', f'data-app-locale="{self.locale["locale"]}"'])
        self.output.append('<' + tag + (' ' + ' '.join(translated) if translated else '') + '>')
        if tag == 'br' and self.locale['lang'] != 'ko':
            self.output.append(' ')

    def handle_endtag(self, tag):
        self.output.append(f'</{tag}>')
        if tag in ('script', 'style'):
            self.raw = False

    def handle_data(self, data):
        key = data.strip()
        self.output.append(data if self.raw or not key else data.replace(key, html.escape(self.text(key), quote=False)))

    def handle_entityref(self, name):
        self.output.append(f'&{name};')

    def handle_charref(self, name):
        self.output.append(f'&#{name};')

    def handle_comment(self, data):
        self.output.append(f'<!--{data}-->')


def picker(locale, page, copy):
    esc = html.escape
    choices = []
    for item in page_locales(page):
        current = ' aria-current="page"' if item['lang'] == locale['lang'] else ''
        keywords = ' '.join([item['nativeName'], item['englishName'], item['locale'], item['lang']])
        choices.append(f'<li><a href="{route(item, page)}" lang="{item["lang"]}" hreflang="{item["lang"]}"{current} data-language-search="{esc(keywords)}"><bdi>{esc(item["nativeName"])}</bdi><span class="language-check" aria-hidden="true">✓</span></a></li>')
    return ('<details class="language-picker"><summary aria-label="' + esc(copy['언어 선택'] + ': ' + locale['nativeName']) + '">'
            '<span data-language-current>' + esc(locale['nativeName']) + '</span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></summary>'
            '<div class="language-panel"><label class="sr-only" for="language-search">' + esc(copy['언어 찾기']) + '</label>'
            '<input id="language-search" type="search" autocomplete="off" spellcheck="false" placeholder="' + esc(copy['언어 찾기']) + '" data-language-search-input>'
            '<ul class="language-options" aria-label="' + esc(copy['언어']) + '">' + ''.join(choices) + '</ul>'
            '<p class="language-empty" data-language-empty hidden>' + esc(copy['일치하는 언어가 없어요.']) + '</p></div></details>')


def render(locale, page, catalog):
    if page in AUTHORED_PAGES:
        # Keep authored policy copy separate from the marketing translation catalog.
        result = (REPO / 'tools/templates' / (page + '.' + locale['lang'] + '.html')).read_text()
    else:
        translator = Translate(locale, catalog)
        translator.feed((REPO / 'tools/templates' / (page + '.ko.html')).read_text())
        result = ''.join(translator.output)
    result = result.replace('<!--LANGUAGE_PICKER-->', picker(locale, page, catalog))
    nav = ''.join('<a href="' + route(locale, target) + '"' + (' aria-current="page"' if target == page else '') + '>' + html.escape(catalog[label]) + '</a>' for target, label in [('feedback', '기능 제안'), ('news', '새 소식')])
    result = result.replace('<!--SITE_NAV-->', nav)
    alternates = ''.join(f'<link rel="alternate" hreflang="{item["lang"]}" href="{ORIGIN}{route(item, page)}">' for item in page_locales(page))
    alternates += f'<link rel="alternate" hreflang="x-default" href="{ORIGIN}{route(LOCALES[1], page)}">'
    result = result.replace('<!--LOCALE_ALTERNATES-->', alternates)
    result = result.replace('"inLanguage": ["ko", "en"]', '"inLanguage": ' + json.dumps([item['lang'] for item in LOCALES]))
    if locale['direction'] == 'rtl':
        result = result.replace('<span aria-hidden="true">→</span>', '<span aria-hidden="true">←</span>')
    return result


def javascript(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')


def build():
    catalogs = load_catalogs()
    result = {}
    for locale in LOCALES:
        for page in ('home', 'feedback', 'news'):
            result[DOCS / route(locale, page).lstrip('/') / 'index.html'] = render(locale, page, catalogs[locale['lang']])
    for page in AUTHORED_PAGES:
        for locale in page_locales(page):
            result[DOCS / route(locale, page).lstrip('/') / 'index.html'] = render(locale, page, catalogs[locale['lang']])
    runtime_keys = set()
    for file in [DOCS / 'home.js', *DOCS.glob('assets/v4/*.js'), *DOCS.glob('assets/v5/*.js')]:
        if file.name != 'copy.js':
            runtime_keys.update(re.findall(r"MARCopy\.text\('([^']*)'\)", file.read_text()))
    runtime_keys.update(['{hours}시간 {minutes}분', '예시 할 일 {total}개 중 {count}개를 완료했어요.', '체험용 예시 · 누르면 완료할 수 있어요.'])
    home_copy = {lang: {key: copy[key] for key in sorted(runtime_keys)} for lang, copy in catalogs.items()}
    result[DOCS / 'assets/v5/copy.js'] = '''/* Generated by tools/build-locales.py. */
(function (global) {
  'use strict';
  const catalogs = __COPY__;
  const lang = document.documentElement.lang;
  const copy = catalogs[lang];
  const number = new Intl.NumberFormat(lang);
  if (!copy) throw new Error('Unsupported website language: ' + lang);
  function text(key, values = {}) {
    if (!Object.hasOwn(copy, key)) throw new Error('Missing website copy: ' + key);
    return copy[key].replace(/\\{(\\w+)\\}/g, (match, name) => typeof values[name] === 'number' ? number.format(values[name]) : String(values[name] ?? match));
  }
  global.MARCopy = {
    text,
    duration(minutes) {return text('{hours}시간 {minutes}분', {hours: Math.floor(minutes / 60), minutes: minutes % 60});},
    taskSummary(count, total) {
      if (lang === 'ko') return `${count}개 완료 · 체험용 예시로 저장되지 않아요.`;
      return count ? text('예시 할 일 {total}개 중 {count}개를 완료했어요.', {count, total}) : text('체험용 예시 · 누르면 완료할 수 있어요.');
    }
  };
})(window);
'''.replace('__COPY__', javascript(home_copy))
    feedback_keys = set(re.findall(r"\bt\('([^']*)'", (DOCS / 'assets/feedback/feedback.js').read_text()))
    feedback_copy = {lang: {key: copy[key] for key in sorted(feedback_keys)} for lang, copy in catalogs.items()}
    meta = {item['lang']: {**item, 'home': route(item), 'feedback': route(item, 'feedback'), 'news': route(item, 'news')} for item in LOCALES}
    result[DOCS / 'assets/feedback/copy.mjs'] = '''// Generated by tools/build-locales.py.
const locales = __LOCALES__;
const catalogs = __COPY__;
export const currentLocale = locales[document.documentElement.lang];
if (!currentLocale) throw new Error('Unsupported feedback language: ' + document.documentElement.lang);
const copy = catalogs[currentLocale.lang];
const number = new Intl.NumberFormat(currentLocale.locale);
export function text(key, values = {}) {
  if (!Object.hasOwn(copy, key)) throw new Error('Missing feedback copy: ' + key);
  return copy[key].replace(/\\{(\\w+)\\}/g, (match, name) => typeof values[name] === 'number' ? number.format(values[name]) : String(values[name] ?? match));
}
'''.replace('__LOCALES__', javascript(meta)).replace('__COPY__', javascript(feedback_copy))
    urls = [ORIGIN + route(locale, page) for locale in LOCALES for page in ('home', 'feedback', 'news')]
    urls.extend(ORIGIN + route(locale, page) for page in AUTHORED_PAGES for locale in page_locales(page))
    result[DOCS / 'sitemap.xml'] = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{url}</loc></url>\n' for url in urls) + '</urlset>\n'
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify generated output is current')
    args = parser.parse_args()
    for file, content in build().items():
        if args.check:
            if not file.exists() or file.read_text() != content:
                raise SystemExit(f'Stale generated file: {file}')
        else:
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text(content)
    print(f'PASS {len(LOCALES)} locales: static home/feedback/news pages, menus, runtime copy and sitemap ' + ('reproducibility' if args.check else 'generation'))
