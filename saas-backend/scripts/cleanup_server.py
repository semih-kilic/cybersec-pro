#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║             CYBERSEC-PRO V8 — CLEANUP SERVER                ║
║                                                              ║
║  Deep codebase audit → trash dead files → rebuild clean      ║
║  Safety: moves to _TRASH_BIN_2024/ (no permanent deletes)    ║
╚══════════════════════════════════════════════════════════════╝

Usage:
    python scripts/cleanup_server.py --dry-run   # Preview only
    python scripts/cleanup_server.py --execute   # Move to trash
    python scripts/cleanup_server.py --restore   # Undo (restore from trash)
"""

import os
import sys
import shutil
import json
import datetime
import argparse
from pathlib import Path

# ─── Configuration ───────────────────────────────────────────

BACKEND_DIR = Path(__file__).resolve().parent.parent  # saas-backend/
PROJECT_ROOT = BACKEND_DIR.parent                      # cybersec-pro/
TRASH_DIR = BACKEND_DIR / "_TRASH_BIN_2024"
MANIFEST_FILE = TRASH_DIR / "manifest.json"

# ─── Active files (imported by app.py directly or transitively) ───

ACTIVE_BACKEND_FILES = {
    # Core app
    "app.py",
    ".env",
    "requirements.txt",
    "Dockerfile",
    "gunicorn.conf.py",
    "setup-auto-update.sh",

    # V7 Engine (active)
    "tool_configs.py",
    "scan_runner.py",
    "parsers.py",
    "verify_installation.py",

    # Imported by app.py
    "tools_api.py",
    "tools_api_v2.py",
    "scan_engine_v3.py",
    "scan_engine.py",
    "business_language.py",
    "scan_orchestrator.py",
    "email_service.py",
    "agent_manager.py",
    "report_generator.py",
    "scan_executor.py",
    "websocket_events.py",
    "purple_team_engine.py",
    "dangerous_tools.py",

    # Transitively imported
    "kali_tools_data.py",
    "kali_tools_additional.py",
    "tool_registry_v3.py",   # imported by tools_api_v2.py
}

# ─── Orphan files (NOT imported by any active module) ───

ORPHAN_FILES = {
    "config.py":               "Not imported by app.py or any active module",
    "models.py":               "Not imported — models defined inline in app.py",
    "rbac_service.py":         "Not imported by app.py or any active module",
    "kali_agent.py":           "Not imported by app.py or any active module",
    "tool_registry.py":        "Superseded by tool_configs.py (V7)",
    "tool_updater.py":         "Not imported by any active module",
    "enterprise_app.py":       "Alternative app entry — not used in production",
    "simple_app.py":           "Simplified app variant — not used",
    "celery_tasks.py":         "Celery not running in production",
    "seed_tools.py":           "One-time seeder script — already executed",
    "assign_tool_tiers.py":    "One-time tier assignment — already executed",
    "auto_update_tools.py":    "Standalone updater — not imported",
    "generate_full_registry.py": "One-time registry generator — already executed",
    "verify_full_suite.py":    "CLI verification script — not imported by app",
}

# ─── Migration scripts (one-time use, already executed) ───

MIGRATION_FILES = {
    "migrate_agents.py":               "One-time migration — already executed",
    "migrate_business_categories.py":  "One-time migration — already executed",
    "migrate_scans.py":                "One-time migration — already executed",
}

# ─── Test files (development only, not production) ───

TEST_FILES = {
    "test_all_fixes.py":        "Dev test file",
    "test_all_tools.py":        "Dev test file",
    "test_cancel.py":           "Dev test file",
    "test_clean_e2e.py":        "Dev test file",
    "test_concurrent.py":       "Dev test file",
    "test_e2e_scan.py":         "Dev test file",
    "test_engine_core.py":      "Dev test file",
    "test_faz2.py":             "Dev test file — phase 2 tests",
    "test_faz3.py":             "Dev test file — phase 3 tests",
    "test_scan_engine_v3.py":   "Dev test file",
    "test_scan.py":             "Dev test file",
    "test_smtp.py":             "Dev test file",
    "check_failed.py":          "Debug helper script",
    "debug_scans.py":           "Debug helper script",
    "quick_test.py":            "Debug helper script",
}

# ─── Junk files (logs, stale DBs, caches) ───

JUNK_FILES = {
    "app.log":            "Log file — regenerated on restart",
    "backend.log":        "Log file — regenerated on restart",
    "cybersec.db":        "Stale DB copy (0 bytes) — real DB at instance/",
    "cybersec_pro.db":    "Stale DB copy (0 bytes) — real DB at instance/",
    "cybersec_saas.db":   "Stale DB copy (0 bytes) — real DB at instance/",
    "full_tool_registry.json": "Generated registry JSON — regeneratable",
}


# ─── Utility functions ──────────────────────────────────────

def get_file_size(filepath: Path) -> int:
    """Get file size in bytes, 0 if not found."""
    try:
        return filepath.stat().st_size
    except (OSError, FileNotFoundError):
        return 0


def format_size(size_bytes: int) -> str:
    """Human-readable file size."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


def find_pycache_dirs(root: Path) -> list:
    """Find all __pycache__ directories, excluding venv."""
    pycache_dirs = []
    for dirpath, dirnames, _ in os.walk(root):
        # Skip venv directory
        if 'venv' in dirpath.split(os.sep):
            continue
        if '__pycache__' in dirnames:
            pycache_dirs.append(Path(dirpath) / '__pycache__')
    return pycache_dirs


def find_pyc_files(root: Path) -> list:
    """Find all .pyc files outside venv."""
    pyc_files = []
    for dirpath, _, filenames in os.walk(root):
        if 'venv' in dirpath.split(os.sep):
            continue
        for f in filenames:
            if f.endswith('.pyc'):
                pyc_files.append(Path(dirpath) / f)
    return pyc_files


def find_ds_store(root: Path) -> list:
    """Find all .DS_Store files."""
    ds_files = []
    for dirpath, _, filenames in os.walk(root):
        if 'venv' in dirpath.split(os.sep):
            continue
        for f in filenames:
            if f == '.DS_Store':
                ds_files.append(Path(dirpath) / f)
    return ds_files


# ─── Main cleanup logic ─────────────────────────────────────

class CleanupServer:
    def __init__(self, dry_run: bool = True):
        self.dry_run = dry_run
        self.manifest = {
            "timestamp": datetime.datetime.now().isoformat(),
            "mode": "dry-run" if dry_run else "execute",
            "moved_files": [],
            "cleaned_pycache": [],
            "summary": {},
        }
        self.total_freed = 0
        self.file_count = 0

    def _move_to_trash(self, src: Path, reason: str, category: str) -> bool:
        """Move a file/dir to trash, preserving relative path structure."""
        if not src.exists():
            return False

        rel = src.relative_to(BACKEND_DIR)
        dest = TRASH_DIR / category / rel
        size = get_file_size(src) if src.is_file() else 0

        if self.dry_run:
            print(f"  [DRY-RUN] Would move: {rel}")
            print(f"            Reason: {reason}")
            print(f"            Size: {format_size(size)}")
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(dest))
            print(f"  [MOVED] {rel} → _TRASH_BIN_2024/{category}/{rel}")

        self.manifest["moved_files"].append({
            "source": str(rel),
            "destination": str(TRASH_DIR / category / rel),
            "reason": reason,
            "category": category,
            "size_bytes": size,
        })
        self.total_freed += size
        self.file_count += 1
        return True

    def clean_orphan_files(self):
        """Move orphan Python files to trash."""
        print("\n" + "=" * 60)
        print("📁 ORPHAN FILES (not imported by app.py)")
        print("=" * 60)
        for filename, reason in ORPHAN_FILES.items():
            filepath = BACKEND_DIR / filename
            self._move_to_trash(filepath, reason, "orphans")

    def clean_migration_files(self):
        """Move one-time migration scripts to trash."""
        print("\n" + "=" * 60)
        print("🔄 MIGRATION SCRIPTS (one-time use, already executed)")
        print("=" * 60)
        for filename, reason in MIGRATION_FILES.items():
            filepath = BACKEND_DIR / filename
            self._move_to_trash(filepath, reason, "migrations")

    def clean_test_files(self):
        """Move test/debug files to trash."""
        print("\n" + "=" * 60)
        print("🧪 TEST & DEBUG FILES (development only)")
        print("=" * 60)
        for filename, reason in TEST_FILES.items():
            filepath = BACKEND_DIR / filename
            self._move_to_trash(filepath, reason, "tests")

    def clean_junk_files(self):
        """Move log, stale DB, and generated files to trash."""
        print("\n" + "=" * 60)
        print("🗑️  JUNK FILES (logs, stale DBs, generated data)")
        print("=" * 60)
        for filename, reason in JUNK_FILES.items():
            filepath = BACKEND_DIR / filename
            self._move_to_trash(filepath, reason, "junk")

    def clean_pycache(self):
        """Remove __pycache__ directories (outside venv)."""
        print("\n" + "=" * 60)
        print("🧹 __pycache__ DIRECTORIES (outside venv)")
        print("=" * 60)

        pycache_dirs = find_pycache_dirs(BACKEND_DIR)
        # Also check project root dirs (excluding saas-backend which we already cover)
        for subdir in ['cybersec-kali', 'cybersec-monitor', 'cybersec-sales',
                        'frontend', 'saas-frontend', 'public', 'nginx']:
            d = PROJECT_ROOT / subdir
            if d.exists():
                pycache_dirs.extend(find_pycache_dirs(d))

        total_pyc_size = 0
        for pd in pycache_dirs:
            if pd.exists():
                sz = sum(f.stat().st_size for f in pd.rglob('*') if f.is_file())
                total_pyc_size += sz
                if self.dry_run:
                    print(f"  [DRY-RUN] Would remove: {pd.relative_to(PROJECT_ROOT)} ({format_size(sz)})")
                else:
                    shutil.rmtree(str(pd), ignore_errors=True)
                    print(f"  [REMOVED] {pd.relative_to(PROJECT_ROOT)}")
                self.manifest["cleaned_pycache"].append(str(pd.relative_to(PROJECT_ROOT)))

        # Also remove standalone .DS_Store files
        ds_files = find_ds_store(BACKEND_DIR)
        for ds in ds_files:
            if self.dry_run:
                print(f"  [DRY-RUN] Would remove: {ds.relative_to(PROJECT_ROOT)}")
            else:
                ds.unlink(missing_ok=True)
                print(f"  [REMOVED] {ds.relative_to(PROJECT_ROOT)}")

        print(f"\n  Total __pycache__ dirs: {len(pycache_dirs)}")
        print(f"  Total size: {format_size(total_pyc_size)}")
        self.total_freed += total_pyc_size

    def print_active_files_report(self):
        """Print which files are staying (active imports)."""
        print("\n" + "=" * 60)
        print("✅ ACTIVE FILES (keeping — imported by app.py)")
        print("=" * 60)
        for f in sorted(ACTIVE_BACKEND_FILES):
            fp = BACKEND_DIR / f
            if fp.exists():
                sz = format_size(get_file_size(fp))
                print(f"  ✓ {f:<40} {sz:>10}")
            else:
                print(f"  ✗ {f:<40} (not found)")

    def print_summary(self):
        """Print final summary."""
        orphans_count = len([m for m in self.manifest["moved_files"] if m["category"] == "orphans"])
        migrations_count = len([m for m in self.manifest["moved_files"] if m["category"] == "migrations"])
        tests_count = len([m for m in self.manifest["moved_files"] if m["category"] == "tests"])
        junk_count = len([m for m in self.manifest["moved_files"] if m["category"] == "junk"])
        pycache_count = len(self.manifest["cleaned_pycache"])

        self.manifest["summary"] = {
            "total_files_moved": self.file_count,
            "total_freed_bytes": self.total_freed,
            "total_freed_human": format_size(self.total_freed),
            "by_category": {
                "orphans": orphans_count,
                "migrations": migrations_count,
                "tests": tests_count,
                "junk": junk_count,
                "pycache_dirs": pycache_count,
            }
        }

        print("\n" + "═" * 60)
        print("║  CLEANUP SUMMARY")
        print("═" * 60)
        mode = "DRY-RUN (no changes made)" if self.dry_run else "EXECUTED"
        print(f"  Mode:           {mode}")
        print(f"  Orphan files:   {orphans_count}")
        print(f"  Migration files: {migrations_count}")
        print(f"  Test files:     {tests_count}")
        print(f"  Junk files:     {junk_count}")
        print(f"  __pycache__:    {pycache_count} directories")
        print(f"  Total files:    {self.file_count}")
        print(f"  Space freed:    {format_size(self.total_freed)}")
        print("═" * 60)

        if not self.dry_run:
            print(f"\n  📋 Manifest saved: {MANIFEST_FILE}")
            print(f"  🗂️  Trash dir: {TRASH_DIR}")
            print(f"\n  To restore: python scripts/cleanup_server.py --restore")

    def save_manifest(self):
        """Save manifest for undo capability."""
        if not self.dry_run:
            TRASH_DIR.mkdir(parents=True, exist_ok=True)
            with open(MANIFEST_FILE, 'w') as f:
                json.dump(self.manifest, f, indent=2)

    def run(self):
        """Run full cleanup."""
        print("╔══════════════════════════════════════════════════════════╗")
        print("║         CYBERSEC-PRO V8 — CLEANUP SERVER                ║")
        print("╚══════════════════════════════════════════════════════════╝")

        self.print_active_files_report()
        self.clean_orphan_files()
        self.clean_migration_files()
        self.clean_test_files()
        self.clean_junk_files()
        self.clean_pycache()
        self.print_summary()
        self.save_manifest()


def restore_from_trash():
    """Restore all files from _TRASH_BIN_2024 using manifest."""
    if not MANIFEST_FILE.exists():
        print("❌ No manifest found. Nothing to restore.")
        return

    with open(MANIFEST_FILE) as f:
        manifest = json.load(f)

    print("🔄 Restoring files from _TRASH_BIN_2024...")
    restored = 0
    for entry in manifest.get("moved_files", []):
        src = Path(entry["destination"])
        dest = BACKEND_DIR / entry["source"]
        if src.exists():
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(dest))
            print(f"  [RESTORED] {entry['source']}")
            restored += 1
        else:
            print(f"  [SKIP] {entry['source']} — not in trash")

    print(f"\n✅ Restored {restored} files")

    # Clean up empty trash dirs
    if TRASH_DIR.exists():
        # Remove empty subdirectories
        for d in sorted(TRASH_DIR.rglob('*'), reverse=True):
            if d.is_dir() and not any(d.iterdir()):
                d.rmdir()
        # Remove trash dir if empty
        if not any(TRASH_DIR.iterdir()):
            TRASH_DIR.rmdir()
            print("  🗑️  Removed empty _TRASH_BIN_2024/")


# ─── CLI Entry Point ────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="CyberSec-Pro Cleanup Server V8")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--dry-run', action='store_true', help='Preview cleanup (no changes)')
    group.add_argument('--execute', action='store_true', help='Execute cleanup (move to trash)')
    group.add_argument('--restore', action='store_true', help='Restore from trash')

    args = parser.parse_args()

    if args.restore:
        restore_from_trash()
    else:
        cleanup = CleanupServer(dry_run=args.dry_run)
        cleanup.run()


if __name__ == "__main__":
    main()
