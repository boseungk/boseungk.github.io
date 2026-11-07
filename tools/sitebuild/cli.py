"""Command line for tools/build-locales.py."""
from pathlib import Path
import argparse

from . import core, draft
from .core import LOCALES, Build, BuildError, Site


def parse(argv=None):
    parser = argparse.ArgumentParser(prog='build-locales.py', description='Build crawlable pages for every supported app locale.')
    parser.add_argument('--check', action='store_true', help='verify generated output is current (writes nothing)')
    parser.add_argument('--draft', action='store_true', help='fall back to Korean for untranslated keys; mark those pages; write translation/untranslated.json')
    parser.add_argument('--only', metavar='PAGES', help='comma-separated page sets (e.g. home,feedback); never writes shared outputs')
    parser.add_argument('--prune', action='store_true', help='remove keys nothing uses from source.json and every catalog')
    parser.add_argument('--out', metavar='DIR', help='write (or check) under DIR instead of the repository root')
    return parser.parse_args(argv)


def main(argv=None):
    args = parse(argv)
    root = Path(args.out).resolve() if args.out else core.REPO
    mode = 'draft' if args.draft else 'strict'
    only = [name.strip() for name in args.only.split(',') if name.strip()] if args.only else None
    if args.prune:
        build = Build(Site(), 'draft')
        files, removed = draft.prune_files(build)
        stale = core.write_outputs(files, root, check=args.check)
        if args.check and stale:
            raise SystemExit(f'--prune would change {len(stale)} files ({removed} unused keys)')
        print(f'PRUNE {removed} unused keys removed from source.json and {len(files) - 1} catalogs' if not args.check else 'PASS nothing to prune')
        return
    try:
        build = Build(Site(), mode, only)
        outputs = build.run()
    except BuildError as error:
        hint = core.untranslated_hint() if mode == 'strict' else ''
        raise SystemExit(str(error) + ('\n' + hint if hint else ''))
    stale = core.write_outputs(outputs, root, check=args.check)
    if args.check and stale:
        hint = core.untranslated_hint() if mode == 'strict' else ''
        raise SystemExit(f'Stale generated file: {root / stale[0]}' + (f' (and {len(stale) - 1} more)' if len(stale) > 1 else '') + ('\n' + hint if hint else ''))
    scope = ', '.join(only) + ' pages' if only else 'static home/feedback/news pages, menus, runtime copy and sitemap'
    print(f'PASS {len(LOCALES)} locales: {scope} ' + ('reproducibility' if args.check else 'generation') + (' (draft)' if mode == 'draft' else ''))
    if mode == 'draft' and not only:
        print(draft.summary(build.report))
    elif mode == 'draft':
        marked = sum('data-i18n-draft=' in text for text in build.pages.values())
        print(f'DRAFT --only: {marked} pages use Korean fallback (translation/untranslated.json is written by full builds only)')
    return 0
