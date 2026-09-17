# Ollama Usage Widget

A small Ubuntu top-bar AppIndicator that shows your Ollama server status, running models, and optional cloud subscription usage. It runs as a user service, so it can be started and stopped without logging out.

## What it shows

**Top bar:** `🦙 2` (running model count), `🦙 idle`, or `🦙 offline`.

**Dropdown menu:**
- Server connection status and version
- Loaded models and their VRAM usage
- Installed model count
- Cloud session and weekly usage percentages when an API key is configured
- A link to [ollama.com/settings](https://ollama.com/settings) for the official quota view

## Requirements

- Ubuntu with AppIndicator support
- GJS, GTK 3, Soup 3, and AyatanaAppIndicator3
- Ollama running at `localhost:11434` for local stats

On Ubuntu, install missing runtime libraries with:

```bash
sudo apt install gjs gir1.2-gtk-3.0 gir1.2-soup-3.0 gir1.2-ayatanaappindicator3-0.1
```

## Install

```bash
./install.sh
```

The indicator starts immediately. Control it with:

```bash
systemctl --user start ollama-usage-widget
systemctl --user stop ollama-usage-widget
systemctl --user restart ollama-usage-widget
systemctl --user status ollama-usage-widget
```

## Configure cloud usage (optional)

Ollama has no documented account quota API. This widget uses the undocumented `GET https://ollama.com/api/usage` endpoint used by Ollama's dashboard. If it changes, the widget shows “Cloud usage unavailable” and retains the official settings link.

Create an API key at <https://ollama.com/settings/keys>, then store it outside the widget:

```bash
mkdir -p ~/.config/ollama-usage-widget
printf %s 'your-api-key-here' > ~/.config/ollama-usage-widget/key
chmod 600 ~/.config/ollama-usage-widget/key
systemctl --user restart ollama-usage-widget
```

You can instead set `OLLAMA_API_KEY` in the service environment.

## Uninstall

```bash
./uninstall.sh
```

## Test

```bash
node --test test_ollamaClient.js
```
