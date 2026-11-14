"""Generate the CSP from the exact staged HTML, without reading private live JS.

Used by deploy.sh after rsync. Fails before deployment if an inline event handler,
source map, secret filename or unsupported script type appears in the published tree.
"""
import argparse
import base64
import hashlib
from html.parser import HTMLParser
from pathlib import Path


class Scripts(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=False)
        self.path, self.script, self.body, self.hashes = path, None, [], set()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if any(key.lower().startswith('on') for key in attrs):
            raise ValueError(f'{self.path}:{self.getpos()[0]}: move inline event handlers into a script')
        if tag == 'script':
            self.script, self.body = attrs, []

    def handle_data(self, text):
        if self.script is not None:
            self.body.append(text)

    def handle_endtag(self, tag):
        if tag != 'script' or self.script is None:
            return
        if 'src' not in self.script:
            kind = self.script.get('type', '').lower()
            if kind not in ('application/json', 'application/ld+json'):
                if kind not in ('', 'module', 'importmap', 'text/javascript', 'application/javascript'):
                    raise ValueError(f'{self.path}: unrecognized executable script type')
                digest = hashlib.sha256(''.join(self.body).encode()).digest()
                self.hashes.add("'sha256-" + base64.b64encode(digest).decode() + "'")
        self.script = None


def headers(directory):
    hashes = set()
    for file in sorted(directory.rglob('*')):
        if not file.is_file():
            continue
        if file.is_symlink():
            raise ValueError(f'{file.relative_to(directory)}: published symlinks are not allowed')
        if file.suffix.lower() in ('.map', '.pem', '.key', '.sqlite', '.sqlite3') or \
                file.name.startswith(('.env', '.dev.vars')) or '.git' in file.relative_to(directory).parts:
            raise ValueError(f'{file.relative_to(directory)}: private/debug file in published assets')
        if file.suffix == '.html':
            parser = Scripts(file.relative_to(directory))
            parser.feed(file.read_text(encoding='utf-8'))
            parser.close()
            hashes.update(parser.hashes)
    if not hashes or not (directory / 'index.html').is_file():
        raise ValueError('staged site is missing its HTML')
    template = Path(__file__).with_name('_headers').read_text()
    if template.count('__SCRIPT_HASHES__') != 1:
        raise ValueError('expected exactly one CSP hash placeholder')
    result = template.replace('__SCRIPT_HASHES__', ' '.join(sorted(hashes)))
    if any(len(line) > 2000 for line in result.splitlines()):
        raise ValueError('Cloudflare _headers line exceeds 2000 characters; split the policy by page')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    result = headers(args.directory)
    (args.directory / '_headers').write_text(result)
    print('Prepared security headers from staged HTML (no private bundle contents printed).')
