#!/usr/bin/env python3
"""
CyberSec Pro — Database Backup Script (V20)
Automated SQLite backup with rotation.
Run via cron: */30 * * * * cd /home/cybersec/cybersec-pro/saas-backend && python3 backup_db.py
"""
import os
import shutil
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

# Configuration
DB_PATH = Path(__file__).parent / "instance" / "cybersec_saas.db"
BACKUP_DIR = Path(__file__).parent / "backups"
MAX_BACKUPS = 48  # Keep last 48 backups (24h at 30min intervals)


def backup():
    if not DB_PATH.exists():
        print(f"Database not found: {DB_PATH}")
        return False

    BACKUP_DIR.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"cybersec_saas_{timestamp}.db"

    # Use SQLite online backup API for consistency
    try:
        src = sqlite3.connect(str(DB_PATH))
        dst = sqlite3.connect(str(backup_path))
        src.backup(dst)
        dst.close()
        src.close()

        size_mb = backup_path.stat().st_size / (1024 * 1024)
        print(f"Backup created: {backup_path.name} ({size_mb:.1f} MB)")
    except Exception as e:
        print(f"Backup failed: {e}")
        if backup_path.exists():
            backup_path.unlink()
        return False

    # Rotate old backups
    backups = sorted(BACKUP_DIR.glob("cybersec_saas_*.db"), key=lambda p: p.stat().st_mtime)
    while len(backups) > MAX_BACKUPS:
        old = backups.pop(0)
        old.unlink()
        print(f"Removed old backup: {old.name}")

    return True


if __name__ == "__main__":
    backup()
