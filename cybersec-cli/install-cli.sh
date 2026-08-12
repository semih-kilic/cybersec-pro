#!/bin/bash
set -euo pipefail

VERSION="0.1.0"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
BINARY_NAME="cybersec-pro"

echo "📦 Installing CyberSec Pro CLI v${VERSION}..."

mkdir -p "${INSTALL_DIR}"

if command -v cargo &> /dev/null; then
    echo "🔨 Building from source with cargo..."
    cd "$(dirname "$0")"
    cargo build --release
    cp target/release/cybersec-cli "${INSTALL_DIR}/${BINARY_NAME}"
elif command -v go &> /dev/null; then
    echo "🔨 Building from source with go..."
    go build -o "${INSTALL_DIR}/${BINARY_NAME}" .
else
    echo "📥 Downloading pre-built binary..."
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    
    case "${ARCH}" in
        x86_64) ARCH="x86_64" ;;
        aarch64|arm64) ARCH="arm64" ;;
        *) echo "Unsupported architecture: ${ARCH}"; exit 1 ;;
    esac
    
    URL="https://github.com/cybersec-pro/cybersec-cli/releases/download/v${VERSION}/${BINARY_NAME}-${OS}-${ARCH}"
    curl -fsSL "${URL}" -o "${INSTALL_DIR}/${BINARY_NAME}"
fi

chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

echo "✅ Installed to ${INSTALL_DIR}/${BINARY_NAME}"
echo ""
echo "Add to your PATH:"
echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
echo ""
echo "Usage:"
echo "  cybersec-pro --help"
