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
        raise ValueError('Fixed root-only command')
    raw = sys.stdin.buffer.read(8193)
    if len(raw) > 8192:
        raise ValueError('Input too large')
    data = json.loads(raw)
    if set(data) != {'host','port','user','password'}:
        raise ValueError('Unexpected fields')
    for key in ('host','user','password'):
        if not isinstance(data[key], str) or re.search(r'[\x00-\x1f\x7f]', data[key]):
            raise ValueError('Invalid value')
    # The application enforces the same Zoho allowlist, TLS, port and mailbox rules.
    checked = subprocess.run(['/opt/hq-node/current/bin/node',
                              '/opt/lazo-crm/current/app-crm/deploy/verify-smtp.mjs'],
                             input=json.dumps(data).encode(), capture_output=True, timeout=40)
    if checked.returncode != 0:
        raise ValueError('Could not authenticate with Zoho')
    path = Path('/etc/lazo-crm.env')
    if path.is_symlink() or not path.is_file() or path.stat().st_uid != 0 or path.stat().st_mode & 0o077:
        raise ValueError('Environment permissions are not private')
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
        atomic_environment(path, original)
        subprocess.run(['systemctl','restart','lazo-crm'], capture_output=True, timeout=35)
        raise


if __name__ == '__main__':
    try:
        configure()
        print(json.dumps({'ok': True, 'smtpVerified': True}))
    except Exception:
        print('LAZO: no se guardó la configuración de correo. Comprueba los datos de Zoho y la conexión.', file=sys.stderr)
        raise SystemExit(1)
