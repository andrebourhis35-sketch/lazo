"""Run on Linux with distro age. All fixtures and keys are temporary and synthetic."""
import importlib.util
import io
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import tarfile
import tempfile
import unittest


def module(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


exporter = module('backup-export')
checker = module('check-recovery')


class BackupTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='lazo-backup-test-')
        self.directory = Path(self.temporary.name)
        keygen = subprocess.run(['/usr/bin/age-keygen'], capture_output=True, check=True)
        self.identity = keygen.stdout
        recipient = re.search(r'age1[0-9a-z]+', keygen.stderr.decode()).group()
        self.recipient = self.directory / 'recipient.txt'
        self.recipient.write_text(recipient)
        self.environment = self.directory / 'service.env'
        self.environment.write_text('LAZO_MASTER_KEY=synthetic-only\nPRIVATE_FIXTURE=not-for-production\n')
        self.database = self.directory / 'live.sqlite'
        self.live = sqlite3.connect(self.database)
        self.live.execute('PRAGMA journal_mode=WAL')
        self.live.execute('CREATE TABLE proof(value TEXT)')
        self.live.execute("INSERT INTO proof VALUES('row still in WAL')")
        self.live.commit()
        self.destination = self.directory / 'exports'

    def tearDown(self):
        self.live.close()
        self.temporary.cleanup()

    def export(self):
        return exporter.export_backup(self.database, self.environment, self.recipient,
                                      self.destination, 'test-release')

    def test_full_recovery_includes_wal_and_environment(self):
        result = self.export()
        encrypted = self.destination / result['file']
        self.assertNotIn(b'PRIVATE_FIXTURE', encrypted.read_bytes())
        self.assertEqual(exporter.sha256(encrypted), result['sha256'])
        self.assertEqual(encrypted.stat().st_mode & 0o777, 0o600)
        plain = subprocess.run(['/usr/bin/age', '-d', '-i', '-', str(encrypted)],
                               input=self.identity, capture_output=True, check=True).stdout
        archive = self.directory / 'recovered.tar.gz'
        archive.write_bytes(plain)
        restored = self.directory / 'restored'
        self.assertTrue(checker.check_recovery(archive, restored)['ok'])
        with sqlite3.connect(restored / 'lazo.sqlite') as recovered:
            self.assertEqual(recovered.execute('SELECT value FROM proof').fetchone()[0], 'row still in WAL')
        self.assertEqual((restored / 'lazo-crm.env').read_bytes(), self.environment.read_bytes())
        # Modified ciphertext fails authentication rather than becoming a valid backup.
        corrupted = bytearray(encrypted.read_bytes())
        corrupted[-1] ^= 1
        bad = self.directory / 'bad.age'
        bad.write_bytes(corrupted)
        self.assertNotEqual(subprocess.run(['/usr/bin/age', '-d', '-i', '-', str(bad)],
                                          input=self.identity, capture_output=True).returncode, 0)

    def test_symlink_inputs_and_invalid_recipient_are_rejected(self):
        self.recipient.write_text('https://not-a-recipient.invalid')
        with self.assertRaises(ValueError):
            self.export()
        self.recipient.unlink()
        self.recipient.symlink_to(self.environment)
        with self.assertRaises(ValueError):
            self.export()

    def test_recovery_cannot_overwrite_an_existing_directory_or_escape_it(self):
        archive_path = self.directory / 'traversal.tar.gz'
        with tarfile.open(archive_path, 'w:gz') as archive:
            entry = tarfile.TarInfo('../escaped')
            entry.size = 1
            archive.addfile(entry, io.BytesIO(b'x'))
        with self.assertRaises(ValueError):
            checker.check_recovery(archive_path, self.directory / 'unsafe')
        self.assertFalse((self.directory / 'escaped').exists())
        existing = self.directory / 'existing'
        existing.mkdir()
        with self.assertRaises(FileExistsError):
            checker.check_recovery(archive_path, existing)

    def test_rotation_preserves_other_files_and_symlinks(self):
        self.destination.mkdir()
        old = self.destination / 'lazo-20000101T000000Z.tar.gz.age'
        old.write_bytes(b'old encrypted fixture')
        os.utime(old, (1, 1))
        keep = self.destination / 'unrelated.sqlite'
        keep.write_text('keep')
        link = self.destination / 'lazo-20000102T000000Z.tar.gz.age'
        link.symlink_to(keep)
        self.export()
        self.assertFalse(old.exists())
        self.assertTrue(keep.exists())
        self.assertTrue(link.is_symlink())

    def test_export_group_can_traverse_directory_and_read_ciphertext(self):
        import grp
        group = grp.getgrgid(os.getgid()).gr_name
        result = exporter.export_backup(self.database, self.environment, self.recipient,
                                        self.destination, 'test-release', group=group)
        self.assertEqual(self.destination.stat().st_mode & 0o777, 0o750)
        self.assertEqual((self.destination / result['file']).stat().st_mode & 0o777, 0o640)
        self.assertEqual((self.destination / result['file']).stat().st_gid, os.getgid())


if __name__ == '__main__':
    unittest.main()
