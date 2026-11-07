"""Static site build for docs/ (``python3 tools/build-locales.py``). See core.py.

Import order is registration order: pages and placeholders first, then outputs in the order they
are written (page runtime copy, sitemap, translator report).
"""
from . import core, translate, assets, stamp, fonts, importmap, sw, copy, chrome, home, community, seo, notfound, draft  # noqa: F401
from .core import Build, BuildError, Site  # noqa: F401
