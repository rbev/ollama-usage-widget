#!/usr/bin/env -S gjs -m

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=3.0';
import Soup from 'gi://Soup?version=3.0';

import {summarizePs, summarizeTags, parseUsage} from './ollamaClient.js';

let AppIndicator;
try {
    AppIndicator = (await import('gi://AyatanaAppIndicator3?version=0.1')).default;
} catch {
    AppIndicator = (await import('gi://AppIndicator3?version=0.1')).default;
}

const LOCAL_URL = 'http://localhost:11434';
const CLOUD_URL = 'https://ollama.com/api/usage';

Gtk.init(null);

const indicator = AppIndicator.Indicator.new(
    'ollama-usage-widget',
    'network-server-symbolic',
    AppIndicator.IndicatorCategory.APPLICATION_STATUS,
);
indicator.set_status(AppIndicator.IndicatorStatus.ACTIVE);
indicator.set_title('Ollama Usage');
indicator.set_label('\u{1F999} ...', '\u{1F999} offline');

const menu = new Gtk.Menu();
const statusItem = new Gtk.MenuItem({label: 'Connecting\u2026', sensitive: false});
const modelsItem = new Gtk.MenuItem({label: 'Loaded models'});
const modelsMenu = new Gtk.Menu();
modelsItem.set_submenu(modelsMenu);
const installedItem = new Gtk.MenuItem({label: 'Installed: ...', sensitive: false});
const cloudItem = new Gtk.MenuItem({label: 'Cloud usage: unavailable', sensitive: false});
const settingsItem = new Gtk.MenuItem({label: 'Open ollama.com/settings'});
settingsItem.connect('activate', () => Gio.AppInfo.launch_default_for_uri('https://ollama.com/settings', null));

menu.append(statusItem);
menu.append(new Gtk.SeparatorMenuItem());
menu.append(modelsItem);
menu.append(installedItem);
menu.append(new Gtk.SeparatorMenuItem());
menu.append(cloudItem);
menu.append(settingsItem);
menu.show_all();
indicator.set_menu(menu);

const session = new Soup.Session();

function apiKey() {
    const env = GLib.getenv('OLLAMA_API_KEY')?.trim();
    if (env) return env;
    const path = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'ollama-usage-widget', 'key']);
    try {
        const [, contents] = GLib.file_get_contents(path);
        return new TextDecoder().decode(contents).trim() || null;
    } catch {
        return null;
    }
}

function fetchJson(url, headers, callback) {
    try {
        const message = Soup.Message.new('GET', url);
        for (const [name, value] of Object.entries(headers ?? {}))
            message.request_headers.append(name, value);
        session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (source, result) => {
            try {
                const bytes = source.send_and_read_finish(result);
                if (message.status_code !== 200)
                    throw new Error(`HTTP ${message.status_code}`);
                callback(JSON.parse(new TextDecoder().decode(bytes.get_data())));
            } catch {
                callback(null);
            }
        });
    } catch {
        callback(null);
    }
}

function pollLocal() {
    let version = null;
    let ps = null;
    let tags = null;
    let pending = 3;
    const done = () => {
        if (--pending) return;
        if (!version) {
            indicator.set_label('\u{1F999} offline', '\u{1F999} offline');
            statusItem.label = 'Server offline';
            return;
        }

        statusItem.label = `Connected \u00B7 v${version}`;
        if (ps) {
            const summary = summarizePs(ps);
            indicator.set_label(summary.text, '\u{1F999} offline');
            modelsItem.label = `Loaded models (${summary.count})`;
            for (const child of modelsMenu.get_children()) modelsMenu.remove(child);
            const models = summary.models.length
                ? summary.models.map(model => `${model.name}  \u00B7  ${model.vram} VRAM`)
                : ['No models loaded'];
            for (const label of models)
                modelsMenu.append(new Gtk.MenuItem({label, sensitive: false}));
            modelsMenu.show_all();
        }
        if (tags) {
            const count = summarizeTags(tags).count;
            installedItem.label = `Installed: ${count} model${count === 1 ? '' : 's'}`;
        }
    };

    fetchJson(`${LOCAL_URL}/api/version`, null, data => { version = data?.version; done(); });
    fetchJson(`${LOCAL_URL}/api/ps`, null, data => { ps = data; done(); });
    fetchJson(`${LOCAL_URL}/api/tags`, null, data => { tags = data; done(); });
}

const key = apiKey();
function pollCloud() {
    if (!key) {
        cloudItem.label = 'Cloud usage: API key not configured';
        return;
    }
    fetchJson(CLOUD_URL, {Authorization: `Bearer ${key}`}, data => {
        const usage = parseUsage(data);
        cloudItem.label = usage
            ? `Cloud: session ${usage.sessionPct}% \u00B7 weekly ${usage.weeklyPct}%`
            : 'Cloud usage unavailable';
    });
}

pollLocal();
pollCloud();
GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => { pollLocal(); return GLib.SOURCE_CONTINUE; });
GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 300, () => { pollCloud(); return GLib.SOURCE_CONTINUE; });
Gtk.main();
