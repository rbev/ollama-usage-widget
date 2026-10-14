import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizePs, summarizeTags, parseBalance, formatLabel } from './ollamaClient.js';

// --- summarizePs ---

test('summarizePs with one running model', () => {
    const r = summarizePs({ models: [{ name: 'llama3:8b', size: 4661214720, size_vram: 4661214720 }] });
    assert.equal(r.count, 1);
    assert.equal(r.text, '\u{1F999} 1');
    assert.equal(r.models[0].name, 'llama3:8b');
    assert.match(r.models[0].vram, /GB/);
});

test('summarizePs with multiple running models', () => {
    const r = summarizePs({ models: [
        { name: 'llama3:8b', size: 4661214720, size_vram: 4661214720 },
        { name: 'qwen2:7b', size: 4100000000, size_vram: 4100000000 },
    ] });
    assert.equal(r.count, 2);
    assert.equal(r.text, '\u{1F999} 2');
});

test('summarizePs with no models shows idle', () => {
    const r = summarizePs({ models: [] });
    assert.equal(r.count, 0);
    assert.equal(r.text, '\u{1F999} idle');
});

test('summarizePs with null/undefined input', () => {
    const r = summarizePs(null);
    assert.equal(r.count, 0);
    assert.equal(r.text, '\u{1F999} idle');
});

// --- summarizeTags ---

test('summarizeTags with models', () => {
    const r = summarizeTags({ models: [{ name: 'llama3:8b', size: 4661214720 }] });
    assert.equal(r.count, 1);
    assert.equal(r.models[0].name, 'llama3:8b');
});

test('summarizeTags with empty', () => {
    const r = summarizeTags({ models: [] });
    assert.equal(r.count, 0);
});

// --- parseBalance ---

// Documented legacy/session-weekly example from https://docs.ollama.com/api/balance:
// included.session.remaining_percent 75, included.weekly.remaining_percent 40.
// Displayed "used" = 100 - remaining_percent  =>  25 / 60.
test('parseBalance with documented legacy example (25/60 used)', () => {
    const r = parseBalance({
        included: {
            session: { remaining_percent: 75, resets_at: '2026-10-01T07:00:00Z' },
            weekly: { remaining_percent: 40, resets_at: '2026-10-05T00:00:00Z' },
        },
        purchased: { balance_usd: 25 },
    });
    assert.deepEqual(r, { sessionPct: 25, weeklyPct: 60 });
});

test('parseBalance boundary: remaining 0 => used 100', () => {
    const r = parseBalance({
        included: {
            session: { remaining_percent: 0 },
            weekly: { remaining_percent: 0 },
        },
    });
    assert.deepEqual(r, { sessionPct: 100, weeklyPct: 100 });
});

test('parseBalance boundary: remaining 100 => used 0', () => {
    const r = parseBalance({
        included: {
            session: { remaining_percent: 100 },
            weekly: { remaining_percent: 100 },
        },
    });
    assert.deepEqual(r, { sessionPct: 0, weeklyPct: 0 });
});

test('parseBalance rounds fractional used percentages', () => {
    // remaining 75.4 => used 24.6 => round 25; remaining 40.3 => used 59.7 => round 60
    const r = parseBalance({
        included: {
            session: { remaining_percent: 75.4 },
            weekly: { remaining_percent: 40.3 },
        },
    });
    assert.deepEqual(r, { sessionPct: 25, weeklyPct: 60 });
});

test('parseBalance with null returns null', () => {
    assert.equal(parseBalance(null), null);
});

test('parseBalance with missing included returns null', () => {
    assert.equal(parseBalance({}), null);
    assert.equal(parseBalance({ included: {} }), null);
});

test('parseBalance with missing session/weekly window returns null', () => {
    assert.equal(parseBalance({ included: { session: { remaining_percent: 50 } } }), null);
    assert.equal(parseBalance({ included: { weekly: { remaining_percent: 50 } } }), null);
});

test('parseBalance with missing remaining_percent returns null', () => {
    assert.equal(parseBalance({ included: { session: {}, weekly: { remaining_percent: 50 } } }), null);
    assert.equal(parseBalance({ included: { session: { remaining_percent: 50 }, weekly: {} } }), null);
});

test('parseBalance with null remaining_percent returns null', () => {
    assert.equal(parseBalance({ included: {
        session: { remaining_percent: null },
        weekly: { remaining_percent: 50 },
    }}), null);
    assert.equal(parseBalance({ included: {
        session: { remaining_percent: 50 },
        weekly: { remaining_percent: null },
    }}), null);
});

test('parseBalance with string remaining_percent rejected (no coercion)', () => {
    assert.equal(parseBalance({ included: {
        session: { remaining_percent: '75' },
        weekly: { remaining_percent: 40 },
    }}), null);
    assert.equal(parseBalance({ included: {
        session: { remaining_percent: 75 },
        weekly: { remaining_percent: '40' },
    }}), null);
});

test('parseBalance with NaN remaining_percent returns null', () => {
    assert.equal(parseBalance({ included: {
        session: { remaining_percent: NaN },
        weekly: { remaining_percent: 40 },
    }}), null);
    assert.equal(parseBalance({ included: {
        session: { remaining_percent: 75 },
        weekly: { remaining_percent: NaN },
    }}), null);
});

test('parseBalance with Infinity remaining_percent returns null', () => {
    assert.equal(parseBalance({ included: {
        session: { remaining_percent: Infinity },
        weekly: { remaining_percent: 40 },
    }}), null);
    assert.equal(parseBalance({ included: {
        session: { remaining_percent: -Infinity },
        weekly: { remaining_percent: 40 },
    }}), null);
});

test('parseBalance with out-of-range remaining_percent returns null', () => {
    assert.equal(parseBalance({ included: {
        session: { remaining_percent: -1 },
        weekly: { remaining_percent: 40 },
    }}), null);
    assert.equal(parseBalance({ included: {
        session: { remaining_percent: 101 },
        weekly: { remaining_percent: 40 },
    }}), null);
    assert.equal(parseBalance({ included: {
        session: { remaining_percent: 75 },
        weekly: { remaining_percent: -0.01 },
    }}), null);
    assert.equal(parseBalance({ included: {
        session: { remaining_percent: 75 },
        weekly: { remaining_percent: 100.1 },
    }}), null);
});

test('parseBalance: newer credit-plan shape returns null (unavailable)', () => {
    // New credit plans report balance_usd/allowance_usd/period instead of
    // session/weekly windows — outside this widget's quota display.
    assert.equal(parseBalance({
        included: { balance_usd: 12.5, allowance_usd: 25, period: { from: '2026-10-01T00:00:00Z', until: '2026-11-01T00:00:00Z' } },
        purchased: { balance_usd: 25 },
    }), null);
});

test('parseBalance: /api/usage request-count payload rejected', () => {
    assert.equal(parseBalance({
        range: '7d',
        scope: 'self',
        granularity: 'day',
        from: '2026-10-07T00:00:00Z',
        until: '2026-10-14T05:55:11.967854191Z',
        totals: { request_count: 228 },
        buckets: [
            { from: '2026-10-13T00:00:00Z', until: '2026-10-14T00:00:00Z', request_count: 77 },
            { from: '2026-10-14T00:00:00Z', until: '2026-10-14T05:55:11.967854191Z', partial: true, request_count: 151 },
        ],
    }), null);
});

// --- formatLabel ---

test('formatLabel with null', () => {
    assert.equal(formatLabel(null), '\u{1F999} ?');
});

test('formatLabel with summary', () => {
    assert.equal(formatLabel({ text: '\u{1F999} 2' }), '\u{1F999} 2');
});