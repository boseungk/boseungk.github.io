"""English root fallback and compatibility links for the former Korean URLs.

All canonical language pages have an explicit prefix. The root duplicates the
English home for no-JavaScript visitors and crawlers; its early inline script
selects a language for browser visits. Legacy Korean subpages retain readable
content while redirecting to /ko/, preserving query strings and fragments.
"""
from .core import PAGES, locale_by_code


def add(build):
    english = PAGES['home'].output(locale_by_code('en-US'))
    if english in build.pages:
        build.pages['docs/index.html'] = build.pages[english]
        build.page_used['docs/index.html'] = build.page_used[english]
    korean = locale_by_code('ko-KR')
    for name in ('feedback', 'news', 'privacy', 'app-privacy'):
        source = PAGES[name].output(korean)
        if source not in build.pages:
            continue
        target = '/ko/' + name + '/'
        redirect = ('<script>(function(){location.replace(' + repr(target)
                    + '+location.search+location.hash)})();</script>')
        alias = 'docs/' + name + '/index.html'
        build.pages[alias] = build.pages[source].replace('</head>', redirect + '</head>', 1)
        build.page_used[alias] = build.page_used[source]
