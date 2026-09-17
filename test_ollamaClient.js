import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizePs, summarizeTags, parseUsage, formatLabel } from './ollamaClient.js';

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

// --- parseUsage ---

test('parseUsage with valid data', () => {
    const r = parseUsage({ limits: {
        session: { usage: 0.03, models: [{ name: 'test', request_count: 5 }] },
        weekly:  { usage: 0.005, models: [] },
    }});
    assert.equal(r.sessionPct, 3);
    assert.equal(r.weeklyPct, 1);
    assert.equal(r.sessionModels[0].name, 'test');
});

test('parseUsage with null returns null', () => {
    assert.equal(parseUsage(null), null);
});

test('parseUsage with missing limits returns null', () => {
    assert.equal(parseUsage({}), null);
    assert.equal(parseUsage({ limits: {} }), null);
});

test('parseUsage with NaN usage returns null', () => {
    assert.equal(parseUsage({ limits: {
        session: { usage: 'not-a-number' },
        weekly: { usage: 0.5 },
    }}), null);
});

// --- formatLabel ---

test('formatLabel with null', () => {
    assert.equal(formatLabel(null), '\u{1F999} ?');
});

test('formatLabel with summary', () => {
    assert.equal(formatLabel({ text: '\u{1F999} 2' }), '\u{1F999} 2');
});