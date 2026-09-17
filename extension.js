import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import St from 'gi://St';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup';

import { summarizePs, summarizeTags, parseUsage } from './ollamaClient.js';

const LOCAL_URL = 'http://localhost:11434';
const CLOUD_URL = 'https://ollama.com/api/usage';
const LOCAL_INTERVAL_S = 10;
const CLOUD_INTERVAL_S = 300;

const OllamaIndicator = GObject.registerClass(
class OllamaIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Ollama Usage', false);
        this._label = new St.Label({ text: '\u{1F999} ...' });
        this.add_child(this._label);

        this._httpSession = new Soup.Session();
        this._timeoutId = null;
        this._cloudTimeoutId = null;
        this._destroyed = false;
        this._apiKey = this._resolveApiKey();

        this._buildMenu();
        this._pollLocal();
        this._pollCloud();
        this._startTimers();
    }

    // --- credentials: env var or 0600 file, never in settings/source ---
    _resolveApiKey() {
        const env = GLib.getenv('OLLAMA_API_KEY');
        if (env && env.trim()) return env.trim();
        const path = GLib.build_filenamev([
            GLib.get_home_dir(), '.config', 'ollama-usage-widget', 'key',
        ]);
        if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
            try {
                const [, contents] = GLib.file_get_contents(path);
                if (contents) {
                    const key = new TextDecoder().decode(contents).trim();
                    if (key) return key;
                }
            } catch (e) { /* ignore — degrade to no cloud */ }
        }
        return null;
    }

    _buildMenu() {
        this._statusItem = new PopupMenu.PopupMenuItem('Connecting\u2026');
        this.menu.addMenuItem(this._statusItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._modelsSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._modelsSection);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._installedItem = new PopupMenu.PopupMenuItem('');
        this.menu.addMenuItem(this._installedItem);

        // Cloud section — hidden until we have something to show
        this._cloudSeparator = new PopupMenu.PopupSeparatorMenuItem();
        this._cloudSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._cloudSeparator);
        this.menu.addMenuItem(this._cloudSection);
        this._cloudSeparator.visible = false;
        this._cloudSection.actor.visible = false;

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const link = new PopupMenu.PopupMenuItem('Open ollama.com/settings');
        link.connect('activate', () => {
            Gio.AppInfo.launch_default_for_uri('https://ollama.com/settings', null);
        });
        this.menu.addMenuItem(link);
    }

    _fetchJson(url, headers, callback) {
        try {
            const msg = Soup.Message.new('GET', url);
            if (headers) {
                for (const [k, v] of Object.entries(headers))
                    msg.request_headers.append(k, v);
            }
            this._httpSession.send_and_read_async(
                msg, GLib.PRIORITY_DEFAULT, null,
                (session, result) => {
                    if (this._destroyed) return;
                    try {
                        if (msg.status_code !== 200) {
                            callback(null, new Error(`HTTP ${msg.status_code}`));
                            return;
                        }
                        const bytes = session.send_and_read_finish(result);
                        const text = new TextDecoder().decode(bytes.get_data());
                        callback(JSON.parse(text), null);
                    } catch (e) {
                        callback(null, e);
                    }
                },
            );
        } catch (e) {
            callback(null, e);
        }
    }

    _pollLocal() {
        let version = null, psData = null, tagsData = null;
        let done = 0;
        const needed = 3;
        const checkDone = () => {
            if (++done < needed) return;
            this._updateLocal(version, psData, tagsData);
        };
        this._fetchJson(`${LOCAL_URL}/api/version`, null, (d) => { if (d) version = d.version; checkDone(); });
        this._fetchJson(`${LOCAL_URL}/api/ps`, null, (d) => { if (d) psData = d; checkDone(); });
        this._fetchJson(`${LOCAL_URL}/api/tags`, null, (d) => { if (d) tagsData = d; checkDone(); });
    }

    _updateLocal(version, psData, tagsData) {
        if (!version) {
            this._label.set_text('\u{1F999} offline');
            this._statusItem.label.set_text('Server offline');
            return;
        }
        this._statusItem.label.set_text(`Connected \u00B7 v${version}`);

        if (psData) {
            const s = summarizePs(psData);
            this._label.set_text(s.text);
            this._modelsSection.removeAll();
            if (s.count === 0) {
                this._modelsSection.addMenuItem(
                    new PopupMenu.PopupMenuItem('No models loaded'));
            } else {
                for (const m of s.models) {
                    const item = new PopupMenu.PopupMenuItem(
                        `${m.name}  \u00B7  ${m.vram} VRAM`);
                    this._modelsSection.addMenuItem(item);
                }
            }
        }

        if (tagsData) {
            const t = summarizeTags(tagsData);
            this._installedItem.label.set_text(
                `Installed: ${t.count} model${t.count !== 1 ? 's' : ''}`);
        }
    }

    _pollCloud() {
        if (!this._apiKey) return;

        this._fetchJson(CLOUD_URL,
            { Authorization: `Bearer ${this._apiKey}` },
            (data, err) => {
                if (err || !data) {
                    this._showCloud(null);
                    return;
                }
                this._showCloud(parseUsage(data));
            });
    }

    _showCloud(usage) {
        if (this._destroyed) return;
        this._cloudSection.removeAll();
        if (!usage) {
            this._cloudSection.addMenuItem(
                new PopupMenu.PopupMenuItem('Cloud usage unavailable'));
        } else {
            this._cloudSection.addMenuItem(
                new PopupMenu.PopupMenuItem('Cloud Usage (unofficial)'));
            this._cloudSection.addMenuItem(
                new PopupMenu.PopupMenuItem(
                    `Session: ${usage.sessionPct}%  \u00B7  Weekly: ${usage.weeklyPct}%`));
        }
        this._cloudSeparator.visible = true;
        this._cloudSection.actor.visible = true;
    }

    _startTimers() {
        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, LOCAL_INTERVAL_S, () => {
                this._pollLocal();
                return GLib.SOURCE_CONTINUE;
            });
        this._cloudTimeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, CLOUD_INTERVAL_S, () => {
                this._pollCloud();
                return GLib.SOURCE_CONTINUE;
            });
    }

    destroy() {
        this._destroyed = true;
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
        if (this._cloudTimeoutId) {
            GLib.source_remove(this._cloudTimeoutId);
            this._cloudTimeoutId = null;
        }
        this._httpSession?.abort();
        super.destroy();
    }
});

export default class OllamaUsageExtension extends Extension {
    enable() {
        this._indicator = new OllamaIndicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}