#!/usr/bin/env bash
set -euo pipefail

UUID="ollama-usage-widget@rbev"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "Disabling Ollama Usage Widget…"
gnome-extensions disable "$UUID" 2>/dev/null || true

echo "Removing from: $DEST"
rm -rf "$DEST"

echo "Done. Restart GNOME Shell (Alt+F2 → r, or log out/in) to clear it from the top bar."