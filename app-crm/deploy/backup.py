"""Consistent SQLite backup including WAL; never prints database contents."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import sqlite3
import os

os.umask(0o077)
source = Path('/var/lib/lazo-crm/lazo.sqlite')
directory = Path('/var/backups/lazo-crm')
directory.mkdir(mode=0o700, parents=True, exist_ok=True)
assert source.is_file() and directory.resolve() == Path('/var/backups/lazo-crm')
stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
target = directory / ('lazo-' + stamp + '.sqlite')
assert not target.exists()
with sqlite3.connect('file:' + str(source) + '?mode=ro', uri=True) as original:
    with sqlite3.connect(target) as copy:
        original.backup(copy)
        assert copy.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
target.chmod(0o600)
cutoff = datetime.now(timezone.utc).timestamp() - timedelta(days=7).total_seconds()
for item in directory.glob('lazo-????????T??????Z.sqlite'):
    if item.is_file() and not item.is_symlink() and item.resolve().parent == directory.resolve() and item.stat().st_mtime < cutoff:
        item.unlink()
print('LAZO: backup íntegro creado; rotación de 7 días.')
