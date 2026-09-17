#!/usr/bin/env bash
set -euo pipefail

UUID="ollama-usage-widget@rbev"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "Installing Ollama Usage Widget to: $DEST"

mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
mkdir -p "$DEST"
# Copy only extension files — no .git, test, or scripts
cp "$SRC_DIR/metadata.json" "$SRC_DIR/extension.js" "$SRC_DIR/ollamaClient.js" "$SRC_DIR/README.md" "$DEST/"

echo "Enabling extension…"
gnome-extensions enable "$UUID" 2>/dev/null || true

cat <<'EOF'

Installed! To activate:
  - X11:  press Alt+F2, type r, press Enter (restarts GNOME Shell)
  - Wayland: log out and back in

If you want cloud usage stats, set your Ollama API key:
  mkdir -p ~/.config/ollama-usage-widget
  echo -n 'your-api-key-here' > ~/.config/ollama-usage-widget/key
  chmod 600 ~/.config/ollama-usage-widget/key
  (or set OLLAMA_API_KEY in your environment)

Get your API key at: https://ollama.com/settings/keys
EOF