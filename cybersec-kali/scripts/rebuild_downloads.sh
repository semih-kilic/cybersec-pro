#!/bin/bash
set -euo pipefail

ROOT_DIR="/home/sam/APPS"
PROJECT_DIR="$ROOT_DIR/cybersec-kali"
SALES_DIR="$ROOT_DIR/cybersec-sales"
FRONTEND_DL_DIR="$SALES_DIR/frontend/downloads"
PUBLIC_DL_DIR="$SALES_DIR/downloads"

LINUX_TAR="$FRONTEND_DL_DIR/cybersec-pro-linux.tar.gz"
SOURCE_ZIP="$FRONTEND_DL_DIR/cybersec-pro-source.zip"

EXCLUDES=(
  "--exclude=cybersec-kali/frontend/node_modules"
  "--exclude=cybersec-kali/node_modules"
  "--exclude=cybersec-kali/backend/venv"
  "--exclude=cybersec-kali/backend/__pycache__"
  "--exclude=cybersec-kali/frontend/.vite"
  "--exclude=cybersec-kali/backend/instance"
  "--exclude=cybersec-kali/backend/.env"
  "--exclude=cybersec-kali/backend/license.key"
  "--exclude=cybersec-kali/.git"
  "--exclude=cybersec-kali/.backend.pid"
  "--exclude=cybersec-kali/.frontend.pid"
)

ZIP_EXCLUDES=(
  "-x" "cybersec-kali/frontend/node_modules/*"
  "-x" "cybersec-kali/node_modules/*"
  "-x" "cybersec-kali/backend/venv/*"
  "-x" "cybersec-kali/backend/__pycache__/*"
  "-x" "cybersec-kali/frontend/.vite/*"
  "-x" "cybersec-kali/backend/instance/*"
  "-x" "cybersec-kali/backend/.env"
  "-x" "cybersec-kali/backend/license.key"
  "-x" "cybersec-kali/.git/*"
  "-x" "cybersec-kali/.backend.pid"
  "-x" "cybersec-kali/.frontend.pid"
)

mkdir -p "$FRONTEND_DL_DIR" "$PUBLIC_DL_DIR"
rm -f "$LINUX_TAR" "$SOURCE_ZIP"

cd "$ROOT_DIR"

# Build tarball
 tar -czf "$LINUX_TAR" "${EXCLUDES[@]}" cybersec-kali

# Build source zip
 zip -r "$SOURCE_ZIP" cybersec-kali "${ZIP_EXCLUDES[@]}" >/dev/null

# Sync to public downloads
cp "$LINUX_TAR" "$PUBLIC_DL_DIR/"
cp "$SOURCE_ZIP" "$PUBLIC_DL_DIR/"

# Sync metadata files
for name in docker-compose.yml CHANGELOG.md README.md SECURITY.md; do
  if [ -f "$FRONTEND_DL_DIR/$name" ]; then
    cp "$FRONTEND_DL_DIR/$name" "$PUBLIC_DL_DIR/"
  fi
done

# Update version.json sizes/md5 in both download locations
python3 - <<'PY'
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

frontend_dir = Path("/home/sam/APPS/cybersec-sales/frontend/downloads")
public_dir = Path("/home/sam/APPS/cybersec-sales/downloads")

linux_path = frontend_dir / "cybersec-pro-linux.tar.gz"
source_path = frontend_dir / "cybersec-pro-source.zip"


def md5sum(path: Path) -> str:
    h = hashlib.md5()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def sha256sum(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

linux_md5 = md5sum(linux_path)
source_md5 = md5sum(source_path)
linux_sha256 = sha256sum(linux_path)
source_sha256 = sha256sum(source_path)
linux_size = linux_path.stat().st_size
source_size = source_path.stat().st_size

for version_path in (frontend_dir / "version.json", public_dir / "version.json"):
    data = json.loads(version_path.read_text())
    data["build_date"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
    data["downloads"]["linux"]["size"] = linux_size
    data["downloads"]["linux"]["md5"] = linux_md5
    data["downloads"]["linux"]["sha256"] = linux_sha256
    data["downloads"]["source"]["size"] = source_size
    data["downloads"]["source"]["md5"] = source_md5
    data["downloads"]["source"]["sha256"] = source_sha256
    version_path.write_text(json.dumps(data, indent=4) + "\n")

print("Updated version.json with:")
print(" linux size", linux_size, "md5", linux_md5)
print(" source size", source_size, "md5", source_md5)
print(" linux sha256", linux_sha256)
print(" source sha256", source_sha256)
PY

echo "✅ Downloads rebuilt and metadata updated."
