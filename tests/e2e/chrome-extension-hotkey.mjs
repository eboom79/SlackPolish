#!/usr/bin/env node
/**
 * Live test for the Chrome extension hotkey logger.
 *
 * Launches a throwaway Chrome (temp profile) with the unpacked extension loaded,
 * opens a local test page, presses the real Ctrl+Shift chord over CDP, and asserts
 * that (1) the content script logged the press to the console and (2) the
 * background worker persisted it to chrome.storage.local with the right fields.
 *
 * CDP is used through the browser endpoint with flattened sessions (as Puppeteer
 * does) so page and extension-worker targets can be driven over one connection.
 *
 *   node tests/e2e/chrome-extension-hotkey.mjs [--headless]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(here, '../../extension');
// Headed by default: Input.dispatchKeyEvent stalls in --headless=new for this flow; pass --headless to try it anyway.
const HEADED = !process.argv.includes('--headless');
/**
 * Google Chrome (branded) ignores --load-extension since ~M137; Chrome for Testing and Chromium honour it.
 * Install one with:  npx @puppeteer/browsers install chrome@stable --path ~/Library/Caches/slackpolish-browsers
 */
function findChrome() {
    if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
    const candidates = [];
    const cache = path.join(os.homedir(), 'Library/Caches/slackpolish-browsers');
    if (fs.existsSync(cache)) {
        const walk = (dir, depth) => { if (depth > 8) return; for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, entry.name); if (entry.isDirectory()) walk(p, depth + 1); else if (entry.name === 'Google Chrome for Testing') candidates.push(p); } };
        walk(cache, 0);
    }
    candidates.push('/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', '/Applications/Chromium.app/Contents/MacOS/Chromium');
    return candidates.find(p => fs.existsSync(p)) || null;
}
const CHROME = findChrome();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);
let chromeProcess = null;
setTimeout(() => { log('💥 watchdog: test exceeded 120s, aborting'); try { chromeProcess && chromeProcess.kill('SIGKILL'); } catch {} process.exit(3); }, 120000).unref();

function freePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer(); srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); }); srv.on('error', reject);
    });
}

/** Browser-level CDP connection with flattened sessions. */
async function connectBrowser(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { const timer = setTimeout(() => rej(new Error('ws connect timed out')), 10000); ws.onopen = () => { clearTimeout(timer); res(); }; ws.onerror = () => { clearTimeout(timer); rej(new Error('ws failed')); }; });
    let id = 0; const pending = new Map(); const events = []; // {sessionId, method, params}
    ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.method) { events.push({ sessionId: msg.sessionId || null, method: msg.method, params: msg.params }); if (events.length > 2000) events.shift(); return; }
        if (msg.id && pending.has(msg.id)) { const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id); msg.error ? reject(new Error(`${msg.error.message}`)) : resolve(msg.result); }
    };
    const send = (method, params = {}, sessionId = undefined) => new Promise((resolve, reject) => {
        const i = ++id;
        const timer = setTimeout(() => { pending.delete(i); reject(new Error(`CDP ${method} timed out`)); }, 10000);
        pending.set(i, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
        ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const evaluate = async (sessionId, expression, awaitPromise = false) => {
        const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise }, sessionId);
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
        return r.result?.value;
    };
    const consoleLines = (sessionId) => events.filter(e => e.sessionId === sessionId && e.method === 'Runtime.consoleAPICalled')
        .map(e => (e.params.args || []).map(a => a.value !== undefined ? String(a.value) : (a.description || '')).join(' '));
    const waitForEvent = (sessionId, method, timeoutMs = 10000) => waitFor(() => events.find(e => e.sessionId === sessionId && e.method === method) || null, { timeoutMs, what: method });
    return { send, evaluate, consoleLines, waitForEvent, close: () => ws.close() };
}

async function waitFor(fn, { timeoutMs = 15000, intervalMs = 200, what = 'condition' } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) { const v = await fn(); if (v) return v; await sleep(intervalMs); }
    throw new Error(`timed out waiting for ${what}`);
}

async function main() {
    if (!CHROME || !fs.existsSync(CHROME)) { log('⏭  No Chrome for Testing / Chromium found (branded Chrome ignores --load-extension). Install with:\n     npx @puppeteer/browsers install chrome@stable --path ~/Library/Caches/slackpolish-browsers\n   or set CHROME_BIN. Skipping.'); process.exit(0); }
    log(`Using ${CHROME}`);

    const PAGES = {
        '/test.html': '<!doctype html><html><head><title>SlackPolish extension test page</title></head><body><h1>test</h1><textarea id="t">hello</textarea></body></html>',
        // Atlassian-editor-like Jira comment: ProseMirror root inside the ak content area, with a mention and a link
        '/jira.html': '<!doctype html><html><head><title>[RED-1] Test issue - Jira</title><meta name="application-name" content="JIRA"></head><body>'
            + '<div class="ak-editor-content-area"><div class="ProseMirror" contenteditable="true" aria-label="Main content area, start typing to enter text." data-editor-container-id="x1">'
            + '<p>hello <span class="ak-mention" data-mention-id="557058:abc" data-access-level="CONTAINER">@Dana</span> pls check the relase</p>'
            + '<p>see <a href="https://redis.io/docs/latest/" class="css-1qw9a4y" data-testid="link">the docs</a> today</p>'
            + '<ul><li><p>item one</p></li><li><p>item two</p></li></ul></div></div></body></html>',
        '/textarea.html': '<!doctype html><html><head><title>Plain textarea page</title></head><body><textarea id="c">a plain comment with a typpo</textarea></body></html>'
    };
    const server = http.createServer((req, res) => {
        const body = PAGES[req.url.split('?')[0]];
        res.statusCode = body ? 200 : 404;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(body || 'not found');
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const pageUrl = `${origin}/test.html`;

    const debugPort = await freePort();
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'slackpolish-chrome-'));
    const args = [
        `--remote-debugging-port=${debugPort}`, '--remote-allow-origins=*', `--user-data-dir=${profile}`,
        `--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`,
        '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-background-networking',
        ...(HEADED ? ['--window-size=480,360', '--window-position=40,40'] : ['--headless=new']), 'about:blank'
    ];
    log(`Launching Chrome ${HEADED ? '(headed)' : '(headless)'} with the extension…`);
    const chrome = spawn(CHROME, args, { stdio: 'ignore' });
    chromeProcess = chrome;
    const results = [];
    const check = (ok, detail) => { results.push({ ok, detail }); log(`  ${ok ? '✅' : '❌'} ${detail}`); };

    try {
        const version = await waitFor(async () => { try { return await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json(); } catch { return null; } }, { what: 'Chrome DevTools endpoint' });
        const browser = await connectBrowser(version.webSocketDebuggerUrl);
        log(`  connected to ${version.Browser}`);

        const isOurWorker = (t) => t.type === 'service_worker' && /^chrome-extension:\/\/[a-p]{32}\/background\.js$/.test(t.url);
        await sleep(1200); // let the extension register (its MV3 worker runs onInstalled, then may go idle)
        {
            const { targetInfos } = await browser.send('Target.getTargets');
            log(`  extension targets now: ${targetInfos.filter(t => t.url.startsWith('chrome-extension://')).map(t => `${t.type}:${t.url}`).join(' | ') || 'none'}`);
        }

        const { targetId } = await browser.send('Target.createTarget', { url: pageUrl });
        const { sessionId: page } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
        await browser.send('Runtime.enable', {}, page);
        await browser.send('Page.enable', {}, page);
        await browser.waitForEvent(page, 'Page.loadEventFired').catch(() => {});
        await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true }, page).catch(() => {});
        await browser.send('Page.bringToFront', {}, page).catch(() => {});
        await sleep(700); // document_idle for the content script
        log('  test page open and focused');

        await browser.evaluate(page, `document.getElementById('t').focus(); document.activeElement.id`);
        const key = (type, k, code, vk, modifiers) => browser.send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers }, page);
        const chord = async () => {
            await key('keyDown', 'Control', 'ControlLeft', 17, 2);
            await key('keyDown', 'Shift', 'ShiftLeft', 16, 10);
            await sleep(60);
            await key('keyUp', 'Shift', 'ShiftLeft', 16, 2);
            await key('keyUp', 'Control', 'ControlLeft', 17, 0);
        };
        await chord();

        // (0) the SlackPolish status badge (same pill as in Slack, same element id): "Improving" first, then "Active"
        const readBadge = () => browser.evaluate(page, `(() => { const b = document.getElementById('slackpolish-runtime-status'); return b ? { state: b.dataset.state, label: b.textContent.trim(), bg: b.style.background } : null; })()`);
        const badgeNow = await waitFor(readBadge, { timeoutMs: 3000, what: 'status badge' }).catch(() => null);
        check(!!badgeNow && badgeNow.state === 'busy' && badgeNow.label === 'SlackPolish Improving', badgeNow ? `badge shown: ${badgeNow.state} "${badgeNow.label}" ${badgeNow.bg}` : 'no status badge');
        const badgeLater = await waitFor(async () => { const b = await readBadge(); return b && b.state === 'active' ? b : null; }, { timeoutMs: 4000, what: 'badge -> active' }).catch(() => null);
        check(!!badgeLater && badgeLater.label === 'SlackPolish Active', badgeLater ? `badge then: ${badgeLater.state} "${badgeLater.label}"` : 'badge did not switch to Active');

        // (1) console line from the content script (isolated world console calls arrive on the page session)
        const line = await waitFor(async () => browser.consoleLines(page).find(l => l.includes('SLACKPOLISH_HOTKEY')), { timeoutMs: 5000, what: 'SLACKPOLISH_HOTKEY console line' }).catch(() => null);
        check(!!line, line ? `content script logged: ${line.slice(0, 150)}` : 'content script did not log the hotkey');
        if (line) {
            const evt = JSON.parse(line.slice(line.indexOf('{')));
            check(evt.surface === 'other' && evt.host === '127.0.0.1' && evt.path === '/test.html', `event fields: surface=${evt.surface} host=${evt.host} path=${evt.path}`);
            check(evt.title === 'SlackPolish extension test page', `title recorded: "${evt.title}"`);
            check(evt.editorFocused === true, `editorFocused=${evt.editorFocused}`);
            check(!('search' in evt) && !('url' in evt), 'no query string / full URL recorded');
        }

        // (2) persisted by the background worker (woken by the content script's message)
        // Several extensions may have a background.js worker (bundled component extensions too): pick ours by manifest name
        const attached = await waitFor(async () => {
            const { targetInfos } = await browser.send('Target.getTargets');
            for (const candidate of targetInfos.filter(isOurWorker)) {
                const { sessionId } = await browser.send('Target.attachToTarget', { targetId: candidate.targetId, flatten: true });
                const name = await browser.evaluate(sessionId, `chrome.runtime.getManifest().name`).catch(() => null);
                if (name === 'SlackPolish') return { worker: candidate, sessionId };
                await browser.send('Target.detachFromTarget', { sessionId }).catch(() => {});
            }
            return null;
        }, { timeoutMs: 8000, what: 'the SlackPolish extension service worker' });
        const worker = attached.worker; const w = attached.sessionId;
        log(`  worker: ${worker.url}`);
        const env = await browser.evaluate(w, `({ chrome: typeof chrome, storage: typeof (globalThis.chrome && chrome.storage), action: typeof (globalThis.chrome && chrome.action), self: (typeof self !== 'undefined' && self.location) ? self.location.href : null })`);
        log(`  worker env: ${JSON.stringify(env)}`);
        const stored = await waitFor(async () => {
            const v = await browser.evaluate(w, `chrome.storage.local.get('events').then(r => r.events || [])`, true);
            return v && v.length ? v : null;
        }, { timeoutMs: 5000, what: 'stored events' }).catch(() => []);
        check(stored.length === 1, `stored events: ${stored.length} (want 1)`);
        if (stored.length) check(stored[0].surface === 'other' && stored[0].path === '/test.html' && typeof stored[0].tabId === 'number', `stored event ok (tabId=${stored[0].tabId})`);
        const badge = await browser.evaluate(w, `chrome.action.getBadgeText({}).then(t => t)`, true).catch(e => `error: ${e.message}`);
        check(badge === '1', `badge text = "${badge}" (want "1")`);

        // A held chord with key repeat must not double count; a fresh press must (after the 500ms rate limit)
        await sleep(650);
        await key('keyDown', 'Control', 'ControlLeft', 17, 2);
        await key('keyDown', 'Shift', 'ShiftLeft', 16, 10);
        await key('keyDown', 'Shift', 'ShiftLeft', 16, 10);
        await sleep(60);
        await key('keyUp', 'Shift', 'ShiftLeft', 16, 2);
        await key('keyUp', 'Control', 'ControlLeft', 17, 0);
        await sleep(700);
        const after = await browser.evaluate(w, `chrome.storage.local.get('events').then(r => (r.events || []).length)`, true);
        check(after === 2, `after a second press (with key repeat): ${after} events (want 2)`);
        const first = (await browser.evaluate(w, `chrome.storage.local.get('events').then(r => r.events || [])`, true))[0];
        check(first.editor && first.editor.kind === 'textarea' && first.editor.text === 'hello', `test page editor captured: ${first.editor && first.editor.kind} "${first.editor && first.editor.text}"`);

        // More pages: a Jira-like ProseMirror comment and a plain textarea
        const openAndPress = async (url, focusJs, label) => {
            log(`▶ ${label}`);
            const { targetId: tid } = await browser.send('Target.createTarget', { url });
            const { sessionId: s } = await browser.send('Target.attachToTarget', { targetId: tid, flatten: true });
            await browser.send('Runtime.enable', {}, s); await browser.send('Page.enable', {}, s);
            await browser.waitForEvent(s, 'Page.loadEventFired').catch(() => {});
            await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true }, s).catch(() => {});
            await browser.send('Page.bringToFront', {}, s).catch(() => {});
            await sleep(700);
            await browser.evaluate(s, focusJs);
            const before = await browser.evaluate(w, `chrome.storage.local.get('events').then(r => (r.events || []).length)`, true);
            const k = (type, kk, code, vk, mods) => browser.send('Input.dispatchKeyEvent', { type, key: kk, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: mods }, s);
            await sleep(650);
            await k('keyDown', 'Control', 'ControlLeft', 17, 2); await k('keyDown', 'Shift', 'ShiftLeft', 16, 10); await sleep(60); await k('keyUp', 'Shift', 'ShiftLeft', 16, 2); await k('keyUp', 'Control', 'ControlLeft', 17, 0);
            const events = await waitFor(async () => { const v = await browser.evaluate(w, `chrome.storage.local.get('events').then(r => r.events || [])`, true); return v.length > before ? v : null; }, { timeoutMs: 5000, what: 'new stored event' }).catch(() => []);
            await browser.send('Target.closeTarget', { targetId: tid }).catch(() => {});
            return events[events.length - 1];
        };

        const jira = await openAndPress(`${origin}/jira.html`, `(() => { const ed = document.querySelector('.ProseMirror'); ed.focus(); const r = document.createRange(); r.selectNodeContents(ed.querySelector('p')); r.collapse(false); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); return document.activeElement.className; })()`, 'Jira-like ProseMirror comment');
        check(!!jira && jira.surface === 'atlassian', `surface classified from application-name meta: ${jira && jira.surface}`);
        check(!!jira && jira.editor && jira.editor.kind === 'prosemirror', `editor kind: ${jira && jira.editor && jira.editor.kind}`);
        check(!!jira && jira.editor && jira.editor.text.includes('hello @Dana pls check the relase') && jira.editor.text.includes('see the docs today') && jira.editor.text.includes('item two'), `comment text captured: ${JSON.stringify(jira && jira.editor && jira.editor.text)}`);
        check(!!jira && jira.editor && jira.editor.blocks.length === 3 && jira.editor.blocks[2].startsWith('ul:'), `block structure: ${JSON.stringify(jira && jira.editor && jira.editor.blocks)}`);
        const vocab = (jira && jira.editor && jira.editor.vocabulary) || [];
        check(vocab.some(v => v.startsWith('span.ak-mention[data-access-level,data-mention-id]')) && vocab.some(v => v.startsWith('a.css-1qw9a4y[data-testid,href]')), `DOM vocabulary lists mention/link markup (attribute names only): ${vocab.join(' | ')}`);
        check(!JSON.stringify(jira).includes('557058:abc') && !JSON.stringify(jira).includes('redis.io/docs'), 'no attribute VALUES (mention id, href) leak into the event outside the visible text');

        const plain = await openAndPress(`${origin}/textarea.html`, `document.getElementById('c').focus(); document.activeElement.id`, 'Plain textarea');
        check(!!plain && plain.editor && plain.editor.kind === 'textarea' && plain.editor.text === 'a plain comment with a typpo', `textarea captured: ${JSON.stringify(plain && plain.editor && plain.editor.text)}`);
        browser.close();
    } catch (error) {
        check(false, `error: ${error.message}`);
    } finally {
        chrome.kill('SIGTERM');
        await sleep(400);
        try { chrome.kill('SIGKILL'); } catch { /* gone */ }
        server.close();
        fs.rmSync(profile, { recursive: true, force: true });
    }

    const failed = results.filter(r => !r.ok).length;
    log(`\n${failed ? '❌' : '🎉'} Chrome extension hotkey test: ${results.length - failed}/${results.length} checks passed`);
    process.exit(failed ? 1 : 0);
}

main();
