#!/bin/bash
# VS Code State Backup Script
# Copilot chat history ve workspace state'i yedekler

BACKUP_DIR="/home/sam/APPS/vscode-backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "🔄 VS Code state yedekleniyor..."

# Copilot Chat storage
if [ -d ~/.vscode-server/data/User/globalStorage/github.copilot-chat ]; then
    tar -czf "$BACKUP_DIR/copilot-chat-$DATE.tar.gz" \
        -C ~/.vscode-server/data/User/globalStorage \
        github.copilot-chat 2>/dev/null
    echo "✅ Copilot Chat storage yedeklendi"
fi

# Workspace storage
if [ -d ~/.vscode-server/data/User/workspaceStorage ]; then
    tar -czf "$BACKUP_DIR/workspace-storage-$DATE.tar.gz" \
        -C ~/.vscode-server/data/User \
        workspaceStorage 2>/dev/null
    echo "✅ Workspace storage yedeklendi"
fi

# Global state
if [ -d ~/.vscode-server/data/User/globalStorage ]; then
    tar -czf "$BACKUP_DIR/global-storage-$DATE.tar.gz" \
        -C ~/.vscode-server/data/User \
        globalStorage 2>/dev/null
    echo "✅ Global storage yedeklendi"
fi

# Eski backupları temizle (7 günden eski)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

echo ""
echo "📁 Backup lokasyonu: $BACKUP_DIR"
ls -lh "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -5
echo ""
echo "✅ Backup tamamlandı!"
