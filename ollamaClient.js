/**
 * ollamaClient.js — pure parsing/formatting, zero gi:// imports.
 * This is the testable seam: extension.js feeds it JSON from Soup,
 * and node can import it directly for self-checks.
 */

export function summarizePs(psJson) {
    const models = (psJson && psJson.models) || [];
    return {
        count: models.length,
        text: models.length > 0 ? `\u{1F999} ${models.length}` : '\u{1F999} idle',
        models: models.map(m => ({
            name: m.name || 'unknown',
            size: formatBytes(m.size),
            vram: formatBytes(m.size_vram),
            expiresAt: m.expires_at || null,
        })),
    };
}

export function summarizeTags(tagsJson) {
    const models = (tagsJson && tagsJson.models) || [];
    return {
        count: models.length,
        models: models.map(m => ({ name: m.name, size: formatBytes(m.size) })),
    };
}

/**
 * Parse the UNOFFICIAL GET https://ollama.com/api/usage response.
 * Returns null on any shape mismatch so callers can degrade gracefully.
 */
export function parseUsage(usageJson) {
    if (!usageJson || !usageJson.limits) return null;
    const { session, weekly } = usageJson.limits;
    if (!session || !weekly) return null;
    const sUsage = Number(session.usage);
    const wUsage = Number(weekly.usage);
    if (isNaN(sUsage) || isNaN(wUsage)) return null;
    return {
        sessionPct: Math.round(sUsage * 100),
        weeklyPct: Math.round(wUsage * 100),
        sessionModels: (session.models || []).map(m => ({ name: m.name, requests: m.request_count })),
        weeklyModels: (weekly.models || []).map(m => ({ name: m.name, requests: m.request_count })),
    };
}

export function formatLabel(psSummary) {
    if (!psSummary) return '\u{1F999} ?';
    return psSummary.text;
}

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let val = bytes, i = 0;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(1)} ${units[i]}`;
}