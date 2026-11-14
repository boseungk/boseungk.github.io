import base64
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('prepare', Path(__file__).with_name('prepare.py'))
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


class SecurityHeaders(unittest.TestCase):
    def test_all_staged_pages_get_their_exact_script_hashes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            scripts = ['window.first = "<&";', 'window.second = 2;']
            for name, script in zip(['index.html', '404.html'], scripts):
                (root / name).write_text('<script>' + script + '</script>')
            result = prepare.headers(root)
            for script in scripts:
                digest = base64.b64encode(hashlib.sha256(script.encode()).digest()).decode()
                self.assertIn("'sha256-" + digest + "'", result)
            self.assertNotIn('__SCRIPT_HASHES__', result)
            self.assertIn("script-src-attr 'none'", result)
            self.assertIn("frame-ancestors 'none'", result)
            self.assertLess(max(map(len, result.splitlines())), 2001)

    def test_inline_handlers_fail_before_deploy(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'index.html').write_text('<script src="/a.js" onerror="bad()"></script>')
            with self.assertRaisesRegex(ValueError, 'inline event'):
                prepare.headers(root)

    def test_private_files_and_source_maps_fail_before_deploy(self):
        for name in ['bundle.js.map', '.dev.vars', '.env.production', 'secret.pem']:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / 'index.html').write_text('<script>window.ok=true</script>')
                (root / name).write_text('fixture')
                with self.assertRaisesRegex(ValueError, 'private/debug'):
                    prepare.headers(root)

    def test_production_policy_contains_no_local_api(self):
        result = prepare.headers(Path(__file__).resolve().parents[2] / 'docs')
        self.assertNotIn('127.0.0.1', result)
        self.assertNotIn('localhost', result)
        self.assertNotIn("'unsafe-eval'", result)
        self.assertNotIn("script-src 'self' 'unsafe-inline'", result)


if __name__ == '__main__':
    unittest.main()
