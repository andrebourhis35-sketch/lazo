"""Scope the existing static CSP to static LAZO routes, preserving CRM headers.

Run as root on the existing OVH installation. No database or environment writes.
Only supports the explicitly inspected configuration; aborts on drift.
"""
import hashlib
import os
from pathlib import Path
import subprocess

CONFIG = Path('/etc/caddy/Caddyfile')
CANDIDATE = Path('/etc/caddy/Caddyfile.lazo-sdk-candidate')
BACKUP = Path('/etc/caddy/Caddyfile.before-lazo-sdk-20261119')
EXPECTED = 'b12a6864fb2134f2211b1f65e518b547e1f8b63b095675914577d83bc6277de8'
START = 'lazo.espacio-sereno.com {\n'
END = '\nrevision-lazo.espacio-sereno.com {'
STATIC_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"


def candidate(source):
    assert hashlib.sha256(source).hexdigest() == EXPECTED, 'Caddy configuration changed; inspect before applying'
    text = source.decode('utf-8')
    start = text.index(START)
    end = text.index(END, start)
    block = text[start:end]
    line = f'        Content-Security-Policy "{STATIC_CSP}"\n'
    assert block.count(line) == 1
    assert block.count('    encode zstd gzip\n') == 1
    scoped = block.replace(line, '').replace(
        '    encode zstd gzip\n',
        '    encode zstd gzip\n'
        '    # Static pages keep their own policy; the CRM supplies its Meta SDK policy.\n'
        '    @lazo_static not path /app /app/* /api/crm/* /webhooks/whatsapp\n'
        f'    header @lazo_static Content-Security-Policy "{STATIC_CSP}"\n',
    )
    return (text[:start] + scoped + text[end:]).encode('utf-8')


def check_route(path, *, crm):
    # HTTPS is checked separately from Windows. Origin verification uses curl's
    # explicit local address because HTTP redirects depend on the site's TLS setup.
    result = subprocess.run(
        ['curl', '-fsS', '--max-time', '15', '--resolve', 'lazo.espacio-sereno.com:443:127.0.0.1',
         '-D', '-', '-o', '/dev/null', 'https://lazo.espacio-sereno.com' + path],
        capture_output=True, check=True,
    )
    headers = result.stdout.decode('utf-8')
    policies = [line.split(':', 1)[1].strip() for line in headers.splitlines()
                if line.lower().startswith('content-security-policy:')]
    assert len(policies) == 1, 'Expected a single CSP'
    assert ('https://connect.facebook.net' in policies[0]) == crm, 'Unexpected SDK policy'
    if not crm:
        assert policies[0] == STATIC_CSP, 'Static page policy changed'


def run():
    source = CONFIG.read_bytes()
    updated = candidate(source)
    assert not CANDIDATE.exists(), 'Candidate already exists; inspect first'
    with CANDIDATE.open('xb') as output:
        output.write(updated)
    os.chmod(CANDIDATE, 0o644)
    validation = subprocess.run(['caddy', 'validate', '--config', str(CANDIDATE), '--adapter', 'caddyfile'],
                                capture_output=True)
    assert validation.returncode == 0, 'Caddy candidate validation failed; active configuration untouched'
    if BACKUP.exists():
        assert BACKUP.read_bytes() == source, 'Backup conflicts with active configuration'
    else:
        with BACKUP.open('xb') as output:
            output.write(source)
        os.chmod(BACKUP, 0o600)
    assert CONFIG.read_bytes() == source, 'Active configuration changed during validation'
    os.replace(CANDIDATE, CONFIG)
    try:
        subprocess.run(['systemctl', 'reload', 'caddy'], check=True, capture_output=True)
        check_route('/app/', crm=True)
        check_route('/', crm=False)
    except Exception:
        CANDIDATE.write_bytes(source)
        os.chmod(CANDIDATE, 0o644)
        os.replace(CANDIDATE, CONFIG)
        restored = subprocess.run(['systemctl', 'reload', 'caddy'], capture_output=True)
        assert CONFIG.read_bytes() == source and restored.returncode == 0, 'Rollback NOT confirmed; private backup retained'
        raise RuntimeError('Verification failed; prior Caddy configuration restored') from None
    print('Caddy validated and reloaded; CRM SDK policy and unchanged static policy verified locally. Other site blocks unchanged.')
    print('Caddy SHA-256: ' + hashlib.sha256(updated).hexdigest())


if __name__ == '__main__':
    run()
