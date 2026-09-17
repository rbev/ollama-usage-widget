#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$HOME/.local/share/ollama-usage-widget"
SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE="$SERVICE_DIR/ollama-usage-widget.service"
GJS="$(command -v gjs)" || { echo 'gjs is required' >&2; exit 1; }

if ! "$GJS" -c "imports.gi.versions.Gtk='3.0'; imports.gi.versions.Soup='3.0'; imports.gi.Gtk; imports.gi.Soup; try { imports.gi.AyatanaAppIndicator3; } catch (e) { imports.gi.AppIndicator3; }"; then
    echo 'Required GJS libraries are missing; see README.md requirements.' >&2
    exit 1
fi

mkdir -p "$APP_DIR" "$SERVICE_DIR"
cp "$SRC_DIR/indicator.js" "$SRC_DIR/ollamaClient.js" "$APP_DIR/"
cat > "$SERVICE" <<EOF
[Unit]
Description=Ollama usage indicator
After=graphical-session.target
PartOf=graphical-session.target

[Service]
ExecStart=$GJS -m %h/.local/share/ollama-usage-widget/indicator.js
Restart=on-failure

[Install]
WantedBy=graphical-session.target
EOF

# Remove the previous Shell-extension installation.
gnome-extensions disable ollama-usage-widget@rbev 2>/dev/null || true
rm -rf "$HOME/.local/share/gnome-shell/extensions/ollama-usage-widget@rbev"

systemctl --user daemon-reload
systemctl --user enable --now ollama-usage-widget.service

echo 'Installed and started. No logout required.'
echo 'Control with: systemctl --user {start|stop|restart|status} ollama-usage-widget'
