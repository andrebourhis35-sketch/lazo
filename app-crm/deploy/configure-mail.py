"""Root-only SMTP setup from SSH stdin. Never print credentials or request data."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
import urllib.request

SMTP_ERRORS = {'smtp-settings','smtp-auth','smtp-tls','smtp-connection','smtp-temporary','smtp-check'}


class SetupError(ValueError):
    def __init__(self, code):
        super().__init__('Mail setup could not be confirmed')
        self.code = code


def atomic_environment(path, content):
    descriptor, temporary = tempfile.mkstemp(prefix='.lazo-crm-mail-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as output:
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def configure():
    if os.geteuid() != 0 or len(sys.argv) != 1:
        raise SetupError('server-permissions')
    raw = sys.stdin.buffer.read(8193)
    if len(raw) > 8192:
        raise SetupError('smtp-settings')
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        raise SetupError('smtp-settings') from None
    if not isinstance(data, dict) or set(data) != {'host','port','user','password'}:
        raise SetupError('smtp-settings')
    # Zoho displays generated app passwords in groups. Pasting may add separators;
    # remove whitespace only from this app password, never from other fields.
    if isinstance(data['password'], str):
        data['password'] = ''.join(data['password'].split())
        if not data['password']:
            raise SetupError('smtp-settings')
    for key in ('host','user','password'):
        if not isinstance(data[key], str) or re.search(r'[\x00-\x1f\x7f]', data[key]):
            raise SetupError('smtp-settings')
    # The application enforces the same Zoho allowlist, TLS, port and mailbox rules.
    try:
        checked = subprocess.run(['/opt/hq-node/current/bin/node',
                                  '/opt/lazo-crm/current/app-crm/deploy/verify-smtp.mjs'],
                                 input=json.dumps(data).encode(), capture_output=True, timeout=40)
    except subprocess.TimeoutExpired:
        raise SetupError('smtp-connection') from None
    try:
        result = json.loads(checked.stdout)
    except (ValueError, TypeError):
        raise SetupError('smtp-check') from None
    if not isinstance(result, dict) or checked.returncode != 0 or result.get('ok') is not True:
        code = result.get('error') if isinstance(result, dict) else None
        raise SetupError(code if isinstance(code, str) and code in SMTP_ERRORS else 'smtp-check')
    path = Path('/etc/lazo-crm.env')
    if path.is_symlink() or not path.is_file() or path.stat().st_uid != 0 or path.stat().st_mode & 0o077:
        raise SetupError('server-permissions')
    original = path.read_bytes()
    keys = {'LAZO_SMTP_HOST': data['host'], 'LAZO_SMTP_PORT': str(int(data['port'])),
            'LAZO_SMTP_USER': data['user'], 'LAZO_SMTP_PASSWORD': data['password']}
    lines = [line for line in original.decode().splitlines()
             if not re.match(r'^\s*(?:' + '|'.join(keys) + r')\s*=', line)]
    # systemd EnvironmentFile supports quoted strings; no shell interprets these values.
    for key, value in keys.items():
        lines.append(key + '="' + value.replace('\\', '\\\\').replace('"', '\\"') + '"')
    atomic_environment(path, ('\n'.join(lines) + '\n').encode())
    try:
        subprocess.run(['systemctl','restart','lazo-crm'], check=True, capture_output=True, timeout=35)
        for attempt in range(20):
            try:
                with urllib.request.urlopen('http://127.0.0.1:3031/healthz', timeout=2) as response:
                    if response.status == 200:
                        return
            except OSError:
                time.sleep(0.5)
        raise RuntimeError('Service did not become healthy')
    except Exception:
        try:
            atomic_environment(path, original)
            restored = subprocess.run(['systemctl','restart','lazo-crm'], capture_output=True, timeout=35)
            if restored.returncode != 0:
                raise RuntimeError('Recovery restart failed')
        except Exception:
            raise SetupError('server-recovery') from None
        raise SetupError('server-restart') from None


if __name__ == '__main__':
    try:
        configure()
        print(json.dumps({'ok': True, 'smtpVerified': True}))
    except SetupError as error:
        print(json.dumps({'ok': False, 'error': error.code}))
        raise SystemExit(1)
    except Exception:
        print(json.dumps({'ok': False, 'error': 'server-setup'}))
        raise SystemExit(1)
