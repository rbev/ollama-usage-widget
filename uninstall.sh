#!/usr/bin/env bash
set -euo pipefail

systemctl --user disable --now ollama-usage-widget.service 2>/dev/null || true
rm -f "$HOME/.config/systemd/user/ollama-usage-widget.service"
rm -rf "$HOME/.local/share/ollama-usage-widget"
# Also clean up installations from the old Shell-extension version.
gnome-extensions disable ollama-usage-widget@rbev 2>/dev/null || true
rm -rf "$HOME/.local/share/gnome-shell/extensions/ollama-usage-widget@rbev"
systemctl --user daemon-reload

echo 'Ollama Usage Widget uninstalled.'
