"""Root-only export of a consistent database AND its recovery key, encrypted for the PC."""
import fcntl
import grp
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import tarfile
import tempfile
from datetime import datetime, timezone, timedelta


def sha256(path):
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def export_backup(database, environment, recipient_file, destination, release, age='/usr/bin/age', group=None):
    os.umask(0o077)
    for source in (database, environment, recipient_file):
        if not source.is_file() or source.is_symlink():
            raise ValueError('Expected regular recovery input file')
    recipient = recipient_file.read_text().strip()
    if not re.fullmatch(r'age1[0-9a-z]{58}', recipient):
        raise ValueError('Expected one X25519 age recipient')
    if environment.stat().st_size > 65536:
        raise ValueError('Environment file too large')
    destination.mkdir(parents=True, exist_ok=True, mode=0o750)
    if destination.is_symlink():
        raise ValueError('Export directory cannot be a symlink')
    lock_path = destination / '.export.lock'
    lock_fd = os.open(lock_path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(lock_fd, 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        name = f'lazo-{stamp}.tar.gz.age'
        output = destination / name
        if output.exists():
            raise ValueError('A backup with this timestamp already exists')
        with tempfile.TemporaryDirectory(prefix='.working-', dir=destination) as scratch:
            scratch = Path(scratch)
            snapshot = scratch / 'lazo.sqlite'
            with sqlite3.connect(database.as_uri() + '?mode=ro', uri=True) as source:
                with sqlite3.connect(snapshot) as target:
                    source.backup(target)
                    if target.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                        raise ValueError('Snapshot integrity check failed')
            # Read only LAZO's dedicated environment, never other applications' secrets.
            environment_bytes = environment.read_bytes()
            manifest = {'format': 1, 'created': stamp, 'release': release,
                        'files': {'lazo.sqlite': sha256(snapshot),
                                  'lazo-crm.env': hashlib.sha256(environment_bytes).hexdigest()}}
            pending = scratch / 'backup.age'
            with pending.open('xb') as encrypted:
                process = subprocess.Popen([age, '-r', recipient], stdin=subprocess.PIPE,
                                           stdout=encrypted, stderr=subprocess.DEVNULL)
                try:
                    with tarfile.open(fileobj=process.stdin, mode='w|gz') as archive:
                        archive.add(snapshot, arcname='lazo.sqlite', recursive=False)
                        for file_name, data in (
                            ('lazo-crm.env', environment_bytes),
                            ('manifest.json', json.dumps(manifest).encode())):
                            info = tarfile.TarInfo(file_name)
                            info.size, info.mode = len(data), 0o600
                            archive.addfile(info, io.BytesIO(data))
                    process.stdin.close()
                    if process.wait(timeout=60) != 0:
                        raise RuntimeError('Encryption failed')
                finally:
                    if process.poll() is None:
                        process.kill()
                        process.wait()
            pending.chmod(0o640 if group else 0o600)
            if group:
                os.chown(pending, -1, grp.getgrnam(group).gr_gid)
            os.replace(pending, output)
        # Only old, regular exports produced by this program are eligible for rotation.
        cutoff = datetime.now(timezone.utc).timestamp() - timedelta(days=7).total_seconds()
        for item in destination.glob('lazo-????????T??????Z.tar.gz.age'):
            if item.is_file() and not item.is_symlink() and item.stat().st_mtime < cutoff:
                item.unlink()
        return {'file': name, 'sha256': sha256(output), 'bytes': output.stat().st_size}


if __name__ == '__main__':
    if os.geteuid() != 0:
        raise SystemExit('Run as root')
    # No command-line paths: the privileged command has a fixed LAZO-only scope.
    result = export_backup(Path('/var/lib/lazo-crm/lazo.sqlite'), Path('/etc/lazo-crm.env'),
                           Path('/etc/lazo-crm-backup-recipient.txt'),
                           Path('/var/backups/lazo-crm/export'),
                           Path('/opt/lazo-crm/current').resolve().name, group='ubuntu')
    print(json.dumps(result))
