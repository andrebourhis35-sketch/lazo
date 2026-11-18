"""Root Linux fixture tests: no real environment, SMTP or service is accessed."""
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('configure_mail', Path(__file__).with_name('configure-mail.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ConfigureTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='lazo-mail-fixture-')
        self.environment = Path(self.temporary.name) / 'service.env'
        self.original = b'LAZO_MASTER_KEY=synthetic-master\nPRESERVE_THIS_SETTING=synthetic-only\n'
        self.environment.write_bytes(self.original)
        self.environment.chmod(0o600)
        self.data = {'host':'smtp.zoho.com','port':465,'user':'fixture@example.test',
                     'password':'synthetic"quoted\\password$literal'}
        self.real_path = Path

    def tearDown(self):
        self.temporary.cleanup()

    def run_configuration(self, processes):
        def redirect_path(value):
            if value == '/etc/lazo-crm.env':
                return self.environment
            raise AssertionError('Unexpected path access')
        with patch.object(module, 'Path', side_effect=redirect_path), \
             patch.object(module.sys, 'argv', ['configure-mail.py']), \
             patch.object(module.sys, 'stdin', SimpleNamespace(buffer=io.BytesIO(json.dumps(self.data).encode()))), \
             patch.object(module.subprocess, 'run', side_effect=processes) as calls, \
             patch.object(module.urllib.request, 'urlopen') as health:
            health.return_value.__enter__.return_value.status = 200
            module.configure()
            return calls

    def test_only_smtp_fields_change_and_file_remains_private(self):
        calls = self.run_configuration([SimpleNamespace(returncode=0), SimpleNamespace(returncode=0)])
        changed = self.environment.read_text()
        self.assertTrue(changed.startswith(self.original.decode()))
        self.assertIn('LAZO_SMTP_HOST="smtp.zoho.com"', changed)
        self.assertIn('LAZO_SMTP_PASSWORD="synthetic\\"quoted\\\\password$literal"', changed)
        self.assertEqual(self.environment.stat().st_mode & 0o777, 0o600)
        self.assertEqual(calls.call_args_list[1].args[0], ['systemctl','restart','lazo-crm'])

    def test_failed_authentication_never_changes_environment(self):
        with self.assertRaises(ValueError):
            self.run_configuration([SimpleNamespace(returncode=1)])
        self.assertEqual(self.environment.read_bytes(), self.original)

    def test_failed_restart_recovers_original_environment(self):
        with self.assertRaises(subprocess.CalledProcessError):
            self.run_configuration([SimpleNamespace(returncode=0),
                                    subprocess.CalledProcessError(1, ['systemctl']), SimpleNamespace(returncode=0)])
        self.assertEqual(self.environment.read_bytes(), self.original)

    def test_control_characters_are_rejected_before_verification(self):
        self.data['password'] = 'invalid\nvalue'
        with self.assertRaises(ValueError):
            self.run_configuration([])
        self.assertEqual(self.environment.read_bytes(), self.original)


if __name__ == '__main__':
    unittest.main()
