#!/usr/bin/env node

/**
 * Regression: when the launcher re-injects a new runtime build into a live Slack page (launcher restart
 * while Slack keeps running), the settings (F12) and channel-summary (F10) scripts used to add a second
 * anonymous keydown handler. Two F12 handlers open the menu and close it again at once - "F12 does nothing".
 * Each script must remove its previous handler before adding the new one.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repo = path.join(__dirname, '../..');
const configSource = fs.readFileSync(path.join(repo, 'slack-config.js'), 'utf8');
const settingsSource = fs.readFileSync(path.join(repo, 'slack-settings.js'), 'utf8');
const summarySource = fs.readFileSync(path.join(repo, 'slack-channel-summary.js'), 'utf8');

let testsPassed = 0, testsTotal = 0;
function runTest(name, fn) { testsTotal++; try { console.log(`🧪 Testing: ${name}`); fn(); testsPassed++; console.log(`✅ PASSED: ${name}`); } catch (e) { console.log(`❌ FAILED: ${name}`); console.log(`   Error: ${e.message}`); } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

/** A minimal page that survives across injections (same window/document/listeners), like a real Slack tab. */
function makePage() {
    const listeners = {};
    const storage = new Map([['slackpolish_settings', JSON.stringify({ language: 'ENGLISH', style: 'CASUAL', improveHotkey: 'Ctrl+Shift' })]]);
    const element = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, contains: () => false }, appendChild() {}, append() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute: () => null, insertBefore() {}, children: [], childNodes: [] });
    const document = {
        readyState: 'complete',
        addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
        removeEventListener: (type, fn) => { const list = listeners[type] || []; const i = list.indexOf(fn); if (i >= 0) list.splice(i, 1); },
        getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
        createElement: element, createTextNode: () => ({}), body: element(), head: element(), documentElement: element()
    };
    const window = { addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true, location: { href: 'https://app.slack.com/client/T1/C1' }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {} };
    const localStorage = { getItem: k => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) };
    window.document = document; window.localStorage = localStorage;
    const ctx = vm.createContext({ window, document, localStorage, console: { log() {}, warn() {}, error() {}, debug() {} }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } }, MutationObserver: class { observe() {} disconnect() {} }, fetch: () => Promise.resolve({ status: 200, ok: true, json: async () => ({}) }), navigator: { userAgent: 'test' }, Date, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Map, Set });
    vm.runInContext(configSource, ctx);
    return { ctx, listeners, window };
}

runTest('Settings script (F12): injecting twice leaves exactly one keydown handler', () => {
    const page = makePage();
    vm.runInContext(settingsSource, page.ctx);
    const after1 = (page.listeners.keydown || []).length;
    vm.runInContext(settingsSource, page.ctx);
    const after2 = (page.listeners.keydown || []).length;
    assert(after1 === 1, `first injection registers one handler, got ${after1}`);
    assert(after2 === 1, `second injection must replace, not add: ${after2} handlers`);
    assert(typeof page.window.__SLACKPOLISH_SETTINGS_F12_HANDLER__ === 'function' && page.listeners.keydown[0] === page.window.__SLACKPOLISH_SETTINGS_F12_HANDLER__, 'the live handler is the one remembered on window');
});

runTest('Channel summary script (F10): injecting twice leaves exactly one keydown handler', () => {
    const page = makePage();
    vm.runInContext(summarySource, page.ctx);
    const after1 = (page.listeners.keydown || []).length;
    vm.runInContext(summarySource, page.ctx);
    const after2 = (page.listeners.keydown || []).length;
    assert(after1 === 1, `first injection registers one handler, got ${after1}`);
    assert(after2 === 1, `second injection must replace, not add: ${after2} handlers`);
    assert(page.listeners.keydown[0] === page.window.__SLACKPOLISH_SUMMARY_F10_HANDLER__, 'the live handler is the one remembered on window');
});

runTest('Both scripts together, re-injected: one F12 + one F10 handler, and F12 still reaches the menu code', () => {
    const page = makePage();
    for (let i = 0; i < 3; i++) { vm.runInContext(settingsSource, page.ctx); vm.runInContext(summarySource, page.ctx); }
    assert((page.listeners.keydown || []).length === 2, `expected 2 handlers after 3 injections, got ${(page.listeners.keydown || []).length}`);
    let prevented = 0;
    const event = { key: 'F12', preventDefault: () => { prevented++; } };
    let threw = null;
    try { page.listeners.keydown.forEach(fn => fn(event)); } catch (e) { threw = e; }
    assert(prevented === 1, `F12 handled exactly once (preventDefault calls: ${prevented})${threw ? ' - menu code threw in the stub DOM: ' + threw.message : ''}`);
});

console.log(`\n📊 Results: ${testsPassed}/${testsTotal} passed`);
process.exit(testsPassed === testsTotal ? 0 : 1);
