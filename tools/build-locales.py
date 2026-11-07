"""Build crawlable home/feedback/news pages for every supported app locale.

The logic lives in tools/sitebuild/ (see core.py). Modes:
  build-locales.py                 strict: every key translated, else fail
  build-locales.py --check         strict output equals docs/
  build-locales.py --draft         Korean fallback, draft markers, translation/untranslated.json
  build-locales.py --check --draft draft output (and the report) equals what is on disk
  build-locales.py --only home,feedback   only those page sets; never the shared outputs
  build-locales.py --prune         drop keys nothing uses from source.json and every catalog
  --out DIR                        write or check under DIR instead of the repository
"""
from pathlib import Path
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sitebuild import cli  # noqa: E402

if __name__ == '__main__':
    cli.main()
