# Ollama Usage Widget

A small GNOME Shell extension for Ubuntu's top bar that shows your Ollama server status, running models, and optional cloud subscription usage.

## What it shows

**Top bar:** `🦙 2` (running model count), `🦙 idle`, or `🦙 offline`.

**Dropdown menu:**
- Server connection status and version
- Loaded models and their VRAM usage
- Installed model count
- Cloud session and weekly usage percentages when an API key is configured
- A link to [ollama.com/settings](https://ollama.com/settings) for the official quota view

## Cloud usage caveat

Ollama has no documented account quota API. This extension uses the undocumented, unversioned `GET https://ollama.com/api/usage` endpoint used by Ollama's dashboard. If it changes, the widget shows “Cloud usage unavailable” and retains the link to the official settings page. See [ollama/ollama#15663](https://github.com/ollama/ollama/issues/15663) and [ollama/ollama#16448](https://github.com/ollama/ollama/issues/16448).

Local server data uses the documented `/api/ps`, `/api/tags`, and `/api/version` endpoints at `localhost:11434`.

## Requirements

- GNOME Shell 45–48 (Ubuntu 24.04 uses GNOME 46)
- Ollama running at `localhost:11434` for local stats
- An optional Ollama Cloud API key for cloud usage

## Install

```bash
cd ollama-usage-widget
./install.sh
```

Restart GNOME Shell afterward: on X11 press `Alt+F2`, enter `r`, and press Enter; on Wayland, log out and back in.

## Configure cloud usage (optional)

Create an API key at <https://ollama.com/settings/keys>, then store it outside the extension:

```bash
mkdir -p ~/.config/ollama-usage-widget
printf %s 'your-api-key-here' > ~/.config/ollama-usage-widget/key
chmod 600 ~/.config/ollama-usage-widget/key
```

You can instead set `OLLAMA_API_KEY` in GNOME Shell's environment. The extension never logs the key or stores it in extension settings; it sends it only to `https://ollama.com` as a Bearer header.

## Uninstall

```bash
./uninstall.sh
```

## Test

```bash
node --test test_ollamaClient.js
```
