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

// Convert /api/balance quota remaining into percent used.
// shortcut: credit-based plans return null; add a credit display when needed.
export function parseBalance(balanceJson) {
    if (!balanceJson || typeof balanceJson !== 'object') return null;
    const included = balanceJson.included;
    if (!included || typeof included !== 'object') return null;
    const session = included.session;
    const weekly = included.weekly;
    if (!session || !weekly || typeof session !== 'object' || typeof weekly !== 'object')
        return null;
    const sRem = session.remaining_percent;
    const wRem = weekly.remaining_percent;
    if (typeof sRem !== 'number' || !Number.isFinite(sRem) || sRem < 0 || sRem > 100)
        return null;
    if (typeof wRem !== 'number' || !Number.isFinite(wRem) || wRem < 0 || wRem > 100)
        return null;
    return {
        sessionPct: Math.round(100 - sRem),
        weeklyPct: Math.round(100 - wRem),
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