"""Validate/extract an already decrypted LAZO archive into a NEW private directory."""
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
import tarfile


def check_recovery(archive_path, destination):
    destination.mkdir(mode=0o700)  # Never overwrite an existing database or recovery folder.
    limits = {'lazo.sqlite': 1200 * 1024 * 1024, 'lazo-crm.env': 65536, 'manifest.json': 16384}
    with tarfile.open(archive_path, 'r:gz') as archive:
        members = archive.getmembers()
        if len(members) != 3 or {member.name for member in members} != set(limits):
            raise ValueError('Unexpected recovery contents')
        for member in members:
            if not member.isfile() or member.size < 0 or member.size > limits[member.name]:
                raise ValueError('Invalid recovery entry')
            with archive.extractfile(member) as source, (destination / member.name).open('xb') as target:
                while chunk := source.read(1024 * 1024):
                    target.write(chunk)
            (destination / member.name).chmod(0o600)
    manifest = json.loads((destination / 'manifest.json').read_text())
    if manifest.get('format') != 1 or set(manifest.get('files', {})) != {'lazo.sqlite', 'lazo-crm.env'}:
        raise ValueError('Invalid recovery manifest')
    for name, expected in manifest['files'].items():
        with (destination / name).open('rb') as source:
            checksum = hashlib.sha256()
            while chunk := source.read(1024 * 1024):
                checksum.update(chunk)
            if checksum.hexdigest() != expected:
                raise ValueError('Recovery checksum mismatch')
    with sqlite3.connect((destination / 'lazo.sqlite').as_uri() + '?mode=ro', uri=True) as database:
        if database.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise ValueError('Recovered database integrity check failed')
    return {'ok': True, 'release': manifest['release'], 'sqlite': 'ok', 'checksums': 'ok'}


if __name__ == '__main__':
    print(json.dumps(check_recovery(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve())))
