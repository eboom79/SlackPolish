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
import vm from 'node:vm';
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
        // Markup mirrors a real Jira Cloud comment editor capture (2026-09): id ak-editor-textarea, data-prosemirror-node-name
        // on every node, mention as an inline node view padded with zero-width spaces.
        '/jira.html': '<!doctype html><html><head><title>[RED-1] Test issue - Jira</title><meta name="application-name" content="JIRA"></head><body>'
            + '<div class="ak-editor-content-area"><div id="ak-editor-textarea" class="ProseMirror ua-chrome" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Comment area, start typing to enter text." data-editor-id="e1" data-gramm="false" translate="no">'
            + '<p data-prosemirror-node-name="paragraph" data-prosemirror-node-block="true" data-prosemirror-content-type="node" data-local-id="p1">hello '
            + '<span class="mentionView-content-wrap inlineNodeView" contenteditable="false" data-prosemirror-node-name="mention" data-prosemirror-node-inline="true" data-prosemirror-content-type="node" data-prosemirror-node-view-type="vanilla" data-mention-id="557058:abc" data-access-level="CONTAINER">'
            + '<span class="zeroWidthSpaceContainer">&#8203;</span><span class="editor-mention-primitive" spellcheck="false">@Dana</span><span class="inlineNodeViewAddZeroWidthSpace">&#8203;</span></span> pls check the relase</p>'
            + '<p data-prosemirror-node-name="paragraph" data-prosemirror-node-block="true" data-prosemirror-content-type="node" data-local-id="p2">see <a href="https://redis.io/docs/latest/" class="css-1qw9a4y" data-testid="link">the docs</a> today</p>'
            + '<ul data-prosemirror-node-name="bulletList" data-prosemirror-node-block="true"><li data-prosemirror-node-name="listItem"><p data-prosemirror-node-name="paragraph">item one</p></li><li data-prosemirror-node-name="listItem"><p data-prosemirror-node-name="paragraph">item two</p></li></ul></div></div></body></html>',
        '/textarea.html': '<!doctype html><html><head><title>Plain textarea page</title></head><body><textarea id="c">a plain comment with a typpo</textarea></body></html>',
        // A REAL ProseMirror editor (bundled fixture) with an Atlassian-like schema: mention + emoji inline node views
        // rendered/parsed with the same attributes Jira uses, plus links, code marks, blockquote and lists.
        '/pm.html': '<!doctype html><html><head><title>[RED-2] ProseMirror editor - Jira</title><meta name="application-name" content="JIRA"></head><body>'
            + '<div class="ak-editor-content-area"><div id="pm-mount"></div></div>'
            + '<script src="/prosemirror.bundle.js"></script><script>'
            + 'const { EditorState, EditorView, Schema, DOMParser, basicSchema, addListNodes, history, undo, redo, keymap, baseKeymap } = PM;'
            + 'const nodes = addListNodes(basicSchema.spec.nodes, "paragraph block*", "block")'
            + '  .addToEnd("mention", { inline: true, group: "inline", atom: true, attrs: { id: {}, text: {} }, selectable: false,'
            + '     toDOM: n => ["span", { class: "mentionView-content-wrap inlineNodeView", contenteditable: "false", "data-prosemirror-node-name": "mention", "data-prosemirror-node-inline": "true", "data-mention-id": n.attrs.id }, ["span", { class: "zeroWidthSpaceContainer" }, "\\u200B"], ["span", { class: "editor-mention-primitive" }, n.attrs.text], ["span", { class: "inlineNodeViewAddZeroWidthSpace" }, "\\u200B"]],'
            + '     parseDOM: [{ tag: "span[data-mention-id]", getAttrs: d => ({ id: d.getAttribute("data-mention-id"), text: (d.querySelector(".editor-mention-primitive") || d).textContent.replace(/\\u200B/g, "") }) }] })'
            + '  .addToEnd("emoji", { inline: true, group: "inline", atom: true, attrs: { shortName: {} }, selectable: false,'
            + '     toDOM: n => ["span", { contenteditable: "false", "data-prosemirror-node-name": "emoji", "data-prosemirror-node-inline": "true", "data-emoji-short-name": n.attrs.shortName, "data-emoji-text": n.attrs.shortName }, ["span", { class: "emojiView-content-wrap", role: "img", "aria-label": n.attrs.shortName }, ["img", { class: "emoji-common-emoji-image", alt: n.attrs.shortName, src: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" }]]],'
            + '     parseDOM: [{ tag: "span[data-emoji-short-name]", getAttrs: d => ({ shortName: d.getAttribute("data-emoji-short-name") }) }] });'
            + 'const schema = new Schema({ nodes, marks: basicSchema.spec.marks });'
            + 'const src = document.createElement("div"); src.innerHTML = \'<p>hello <span data-mention-id="557058:abc">@Dana</span> pls check the <code>relase</code> job <span data-emoji-short-name=":tada:"></span></p><p>see <a href="https://redis.io/docs/latest/">https://redis.io/docs/latest/</a> today</p><blockquote><p>can u ship it by fri??</p></blockquote><ul><li><p>item one</p></li><li><p>item two</p></li></ul>\';'
            + 'const doc = DOMParser.fromSchema(schema).parse(src);'
            + 'window.view = new EditorView(document.getElementById("pm-mount"), { state: EditorState.create({ doc, plugins: [history(), keymap({ "Mod-z": undo, "Mod-y": redo }), keymap(baseKeymap)] }), attributes: { id: "ak-editor-textarea", "aria-label": "Comment area, start typing to enter text.", role: "textbox" } });'
            + '</script></body></html>'
    };
    const bundle = fs.readFileSync(path.join(here, 'fixtures/prosemirror.bundle.js'));
    // Mock OpenAI: deterministic "polish" of the text between the prompt markers. /v1 is faithful; /v1-drop behaves
    // like a careless model (drops the mention token, rewrites the quoted line, wraps the answer in quotation marks).
    const openaiCalls = [];
    const server = http.createServer((req, res) => {
        const route = req.url.split('?')[0];
        if (req.method === 'POST' && route.endsWith('/chat/completions')) {
            let raw = ''; req.on('data', c => { raw += c; });
            req.on('end', () => {
                const body = JSON.parse(raw || '{}');
                const prompt = (body.messages && body.messages[0] && body.messages[0].content) || '';
                const m = prompt.match(/=== MESSAGE TO IMPROVE \(improve ONLY the text between these markers\) ===\n([\s\S]*?)\n=== END OF MESSAGE TO IMPROVE ===/);
                const text = m ? m[1] : '';
                const mode = route.startsWith('/v1-drop') ? 'drop' : 'faithful';
                openaiCalls.push({ mode, auth: req.headers.authorization, model: body.model, temperature: body.temperature, prompt, text });
                let out = text.split('\n').map((line, i) => {
                    if (/^>\s?/.test(line)) return line;
                    let l = line.replace(/\bpls\b/g, 'please').replace(/\bu\b/g, 'you').replace(/^see /, 'See ').replace(/^(• |\d+\. )item /, '$1Item ');
                    if (i === 0 && /^hello/.test(l)) l = l.charAt(0).toUpperCase() + l.slice(1);
                    return l;
                }).join('\n');
                if (mode === 'drop') out = '"' + out.replace(/__SLACKPOLISH_MENTION_1__ ?/g, '').replace(/^> __SLACKPOLISH_QUOTE_1__$/m, '> Can you ship it by Friday?') + '"';
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ id: 'mock', choices: [{ message: { role: 'assistant', content: out } }], usage: { total_tokens: 42 } }));
            });
            return;
        }
        if (route === '/prosemirror.bundle.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(bundle); return; }
        const body = PAGES[route];
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
        const openAndPress = async (url, focusJs, label, holdMs = 60, afterJs = null) => {
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
            await k('keyDown', 'Control', 'ControlLeft', 17, 2); await k('keyDown', 'Shift', 'ShiftLeft', 16, 10); await sleep(holdMs); await k('keyUp', 'Shift', 'ShiftLeft', 16, 2); await k('keyUp', 'Control', 'ControlLeft', 17, 0);
            const events = await waitFor(async () => { const v = await browser.evaluate(w, `chrome.storage.local.get('events').then(r => r.events || [])`, true); return v.length > before ? v : null; }, { timeoutMs: 12000, what: 'new stored event' }).catch(() => []);
            const last = events[events.length - 1];
            if (afterJs && last) last.__after = await browser.evaluate(s, afterJs, true).catch(err => `error: ${err.message}`);
            await browser.send('Target.closeTarget', { targetId: tid }).catch(() => {});
            return last;
        };

        const jira = await openAndPress(`${origin}/jira.html`, `(() => { const ed = document.querySelector('.ProseMirror'); ed.focus(); const r = document.createRange(); r.selectNodeContents(ed.querySelector('p')); r.collapse(false); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); return document.activeElement.className; })()`, 'Jira-like ProseMirror comment');
        check(!!jira && jira.surface === 'atlassian', `surface classified from application-name meta: ${jira && jira.surface}`);
        check(!!jira && jira.editor && jira.editor.kind === 'prosemirror', `editor kind: ${jira && jira.editor && jira.editor.kind}`);
        check(!!jira && jira.editor && jira.editor.text.includes('hello @Dana pls check the relase') && jira.editor.text.includes('see the docs today') && jira.editor.text.includes('item two'), `comment text captured: ${JSON.stringify(jira && jira.editor && jira.editor.text)}`);
        check(!!jira && jira.editor && jira.editor.blocks.length === 3 && jira.editor.blocks[2].startsWith('bulletList:'), `block structure by node name: ${JSON.stringify(jira && jira.editor && jira.editor.blocks)}`);
        check(!!jira && jira.editor && !/[\u200B]/.test(jira.editor.text) && jira.editor.text.startsWith('hello @Dana pls check the relase'), 'zero-width padding around the mention is stripped');
        check(!!jira && jira.editor && jira.editor.field === 'comment', `field detected from aria-label: ${jira && jira.editor && jira.editor.field}`);
        check(!!jira && jira.editor && JSON.stringify(jira.editor.nodeNames) === JSON.stringify(['paragraph', 'mention', 'bulletList', 'listItem']), `node names: ${JSON.stringify(jira && jira.editor && jira.editor.nodeNames)}`);
        check(!!jira && jira.editor && JSON.stringify(jira.editor.inlineNodes) === JSON.stringify([{ nodeName: 'mention', text: '@Dana' }]), `inline node views: ${JSON.stringify(jira && jira.editor && jira.editor.inlineNodes)}`);
        const vocab = (jira && jira.editor && jira.editor.vocabulary) || [];
        check(vocab.some(v => v.startsWith('span.mentionView-content-wrap.inlineNodeView[')) && vocab.some(v => v.startsWith('a.css-1qw9a4y[data-testid,href]')), `DOM vocabulary lists mention/link markup (attribute names only): ${vocab.slice(0, 4).join(' | ')} …`);
        check(!JSON.stringify(jira).includes('557058:abc') && !JSON.stringify(jira).includes('redis.io/docs'), 'no attribute VALUES (mention id, href) leak into the event outside the visible text');

        const plain = await openAndPress(`${origin}/textarea.html`, `document.getElementById('c').focus(); document.activeElement.id`, 'Plain textarea');
        check(!!plain && plain.editor && plain.editor.kind === 'textarea' && plain.editor.text === 'a plain comment with a typpo', `textarea captured: ${JSON.stringify(plain && plain.editor && plain.editor.text)}`);

        // Round-trip write-back on a REAL ProseMirror editor (opt-in setting)
        await browser.evaluate(w, `chrome.storage.local.set({ roundTrip: true })`, true);
        // Hold Ctrl+Shift for 900ms, like real fingers: ProseMirror would paste plain text while Shift is down
        const rt = await openAndPress(`${origin}/pm.html`, `(() => { const ed = document.querySelector('.ProseMirror'); ed.focus(); const sel = getSelection(); const r = document.createRange(); r.setStart(ed.querySelector('p').firstChild, 2); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); return document.activeElement.id; })()`, 'Real ProseMirror editor: round-trip write-back (keys held 900ms)', 900);
        await browser.evaluate(w, `chrome.storage.local.set({ roundTrip: false })`, true);
        const r = (rt && rt.roundTrip) || {};
        check(!!rt && rt.editor && rt.editor.kind === 'prosemirror' && rt.editor.field === 'comment', `editor recognised: ${rt && rt.editor && rt.editor.kind}/${rt && rt.editor && rt.editor.field}`);
        check(r.pasteHandled === true, `editor handled the synthetic paste: ${r.pasteHandled}`);
        check(typeof r.waitedForKeysMs === 'number' && r.waitedForKeysMs >= 500, `write-back waited for the modifiers to be released: ${r.waitedForKeysMs}ms`);
        const kinds = (r.entities || []).map(e => e.kind).join(',');
        check(kinds === 'MENTION,CODE,EMOJI,LINK,QUOTE', `entities tokenised in order (quoted paragraph is a QUOTE token, as in Slack): ${kinds}`);
        check(typeof r.modelText === 'string' && r.modelText.split('\n')[0] === 'hello __SLACKPOLISH_MENTION_1__ pls check the __SLACKPOLISH_CODE_1__ job __SLACKPOLISH_EMOJI_1__' && r.modelText.includes('> __SLACKPOLISH_QUOTE_1__') && r.modelText.includes('• item one') && (r.entities || []).some(e => e.kind === 'QUOTE' && e.text === 'can u ship it by fri??'), `model text: ${JSON.stringify(r.modelText)}`);
        check(r.textSame === true && r.nodesSame === true && r.ok === true, `round trip lossless: text=${r.textSame} nodes=${r.nodesSame} ok=${r.ok}${r.error ? ' error=' + r.error : ''}\n      before: ${JSON.stringify(r.before && r.before.text)}\n      after : ${JSON.stringify(r.after && r.after.text)}`);

        // ---- Polishing in an Atlassian editor through the mock OpenAI endpoint ----
        const cfgCtx = { window: {}, console };
        vm.runInNewContext(fs.readFileSync(path.join(here, '../../slack-config.js'), 'utf8'), cfgCtx);
        const CONFIG = cfgCtx.window.SLACKPOLISH_CONFIG;
        const setSettings = (settings) => browser.evaluate(w, `chrome.storage.local.set({ settings: ${JSON.stringify(settings)} })`, true);
        const focusEnd = `(() => { const ed = document.querySelector('.ProseMirror'); ed.focus(); const sel = getSelection(); const r = document.createRange(); r.setStart(ed.querySelector('p').firstChild, 2); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); return document.activeElement.id; })()`;
        const domAfter = `(() => { const ed = document.querySelector('.ProseMirror'); return { html: ed.innerHTML, text: ed.innerText, badge: ((document.getElementById('slackpolish-runtime-status') || {}).textContent || '').trim() || null }; })()`;

        // (a) polishing on, no API key: clear error, nothing written
        await setSettings({ polish: true, apiKey: '', apiBase: `${origin}/v1`, style: 'TONE_POLISH', language: 'ENGLISH' });
        const noKey = await openAndPress(`${origin}/pm.html`, focusEnd, 'Polish without an API key', 200, domAfter);
        check(!!noKey && noKey.polishEnabled === true && noKey.polish && noKey.polish.ok === false && /API key/i.test(noKey.polish.error || ''), `no key -> error reported: ${noKey && noKey.polish && noKey.polish.error}`);
        check(!!noKey && noKey.__after && noKey.__after.badge === 'SlackPolish Needs API Key' && noKey.__after.html.includes('pls check the'), `badge "${noKey && noKey.__after && noKey.__after.badge}", editor untouched`);
        check(openaiCalls.length === 0, 'no request left the browser without a key');

        // (b) whole comment, faithful model
        await setSettings({ polish: true, apiKey: 'test-key', apiBase: `${origin}/v1`, style: 'TONE_POLISH', language: 'ENGLISH' });
        const whole = await openAndPress(`${origin}/pm.html`, focusEnd, 'Polish the whole comment (mock model, keys held 900ms)', 900, domAfter);
        const wp = (whole && whole.polish) || {};
        check(wp.ok === true && wp.mode === 'message' && wp.pasteHandled === true && wp.verification && wp.verification.ok === true, `polish ok=${wp.ok} mode=${wp.mode} paste=${wp.pasteHandled} verify=${JSON.stringify(wp.verification)}${wp.error ? ' error=' + wp.error : ''}`);
        const call = openaiCalls[openaiCalls.length - 1] || {};
        check(openaiCalls.length === 1 && call.auth === 'Bearer test-key' && call.model === 'gpt-4-turbo' && call.temperature === 0.3, `one OpenAI request: auth=${call.auth} model=${call.model} temperature=${call.temperature}`);
        check(!!call.prompt && call.prompt.includes(CONFIG.PROMPTS.STYLES.TONE_POLISH) && call.prompt.includes('Never add a token that is not already in the message.') && call.prompt.includes('__SLACKPOLISH_QUOTE_1__: "can u ship it by fri??"') && call.prompt.includes('[RED-2] ProseMirror editor - Jira'), 'prompt: shared style text, token + quote rules, issue title as context');
        check(call.text === 'hello __SLACKPOLISH_MENTION_1__ pls check the __SLACKPOLISH_CODE_1__ job __SLACKPOLISH_EMOJI_1__\nsee __SLACKPOLISH_LINK_1__ today\n> __SLACKPOLISH_QUOTE_1__\n• item one\n• item two', `model saw tokens, not entities: ${JSON.stringify(call.text)}`);
        const wa = (whole && whole.__after) || {};
        check(typeof wa.html === 'string' && wa.html.includes('data-mention-id="557058:abc"') && wa.html.includes('@Dana') && wa.html.includes('<code>relase</code>') && wa.html.includes('data-emoji-short-name=":tada:"') && wa.html.includes('href="https://redis.io/docs/latest/"'), `entities intact in the editor DOM after polishing`);
        check(typeof wa.html === 'string' && wa.html.includes('<blockquote><p>can u ship it by fri??</p></blockquote>'), `quote verbatim: ${(wa.html || '').match(/<blockquote>.*?<\/blockquote>/) || 'none'}`);
        check(typeof wa.html === 'string' && wa.html.includes('<li><p>Item one</p></li><li><p>Item two</p></li>') && /<p>Hello .*please check the <code>relase<\/code> job/.test(wa.html) && wa.html.includes('<p>See <a href="https://redis.io/docs/latest/">https://redis.io/docs/latest/</a> today</p>'), `text polished, structure kept: ${(wa.text || '').replace(/\n+/g, ' | ')}`);
        check(wa.badge === 'SlackPolish Active', `badge after polishing: "${wa.badge}"`);

        // (c) only the selection: "pls check the" inside the first paragraph
        const focusSelection = `(() => { const ed = document.querySelector('.ProseMirror'); ed.focus(); const p = ed.querySelector('p'); const t = [...p.childNodes].find(n => n.nodeType === 3 && n.textContent.includes('pls check the')); const start = t.textContent.indexOf('pls'); const r = document.createRange(); r.setStart(t, start); r.setEnd(t, start + 'pls check the'.length); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); return sel.toString(); })()`;
        const part = await openAndPress(`${origin}/pm.html`, focusSelection, 'Polish only the selected words (mock model)', 900, domAfter);
        const pp = (part && part.polish) || {};
        check(pp.ok === true && pp.mode === 'selection' && pp.modelText === 'pls check the' && pp.verification && pp.verification.ok === true, `selection polish ok=${pp.ok} mode=${pp.mode} text=${JSON.stringify(pp.modelText)}${pp.error ? ' error=' + pp.error : ''}`);
        const pa = (part && part.__after) || {};
        check(typeof pa.html === 'string' && /<p>hello <span[^>]*data-mention-id="557058:abc"[^>]*>.*?@Dana.*?<\/span> please check the <code>relase<\/code> job <span[^>]*data-emoji-short-name=":tada:"/.test(pa.html) && pa.html.includes('<blockquote><p>can u ship it by fri??</p></blockquote>') && pa.html.includes('<li><p>item one</p></li>'), `only the selection changed: ${(pa.text || '').split('\n')[0]}`);

        // (d) careless model: dropped mention, rewritten quote, quotation marks -> repaired before write-back
        await setSettings({ polish: true, apiKey: 'test-key', apiBase: `${origin}/v1-drop`, style: 'PROFESSIONAL', language: 'ENGLISH' });
        const drop = await openAndPress(`${origin}/pm.html`, focusEnd, 'Careless model: dropped mention + rewritten quote (repair path)', 900, domAfter);
        const dp = (drop && drop.polish) || {};
        check(dp.ok === true && dp.repaired && dp.repaired.substituted.join() === '__SLACKPOLISH_QUOTE_1__' && dp.repaired.appended.join() === '__SLACKPOLISH_MENTION_1__', `repairs: ${JSON.stringify(dp.repaired && { substituted: dp.repaired.substituted, appended: dp.repaired.appended, reanchored: dp.repaired.reanchored, removed: dp.repaired.removed })}${dp.error ? ' error=' + dp.error : ''}`);
        const da = (drop && drop.__after) || {};
        check(typeof da.html === 'string' && da.html.includes('<blockquote><p>can u ship it by fri??</p></blockquote>') && !da.html.includes('Friday') && da.html.includes('data-mention-id="557058:abc"') && !da.html.includes('"Hello'), `quote verbatim, mention back, no quotation marks: ${(da.text || '').replace(/\n+/g, ' | ')}`);
        check(dp.verification && dp.verification.ok === true && openaiCalls.filter(c => c.mode === 'drop').length === 1, `verification ok after repair (${openaiCalls.length} mock calls total)`);
        await setSettings({ polish: false, apiKey: '' });

        // ---- The popup: settings selects come from the shared config, the toggle persists, the log renders ----
        {
            log('▶ Popup page');
            const popupUrl = worker.url.replace(/background\.js$/, 'popup/popup.html');
            const { targetId: pid } = await browser.send('Target.createTarget', { url: popupUrl });
            const { sessionId: ps } = await browser.send('Target.attachToTarget', { targetId: pid, flatten: true });
            await browser.send('Runtime.enable', {}, ps); await browser.send('Page.enable', {}, ps);
            await browser.waitForEvent(ps, 'Page.loadEventFired').catch(() => {});
            await sleep(500);
            const popup = await browser.evaluate(ps, `({ styles: [...document.querySelectorAll('#style option')].map(o => o.value), languages: document.querySelectorAll('#language option').length, styleLabel: document.querySelector('#style option[value=TONE_POLISH]').textContent, events: document.querySelectorAll('#events li').length, polishRows: document.querySelectorAll('#events .polish').length, okRows: document.querySelectorAll('#events .polish.ok').length, badRows: document.querySelectorAll('#events .polish.bad').length })`, true);
            check(popup.styles.join() === Object.keys(CONFIG.AVAILABLE_STYLES).join() && popup.languages === Object.keys(CONFIG.SUPPORTED_LANGUAGES).length && popup.styleLabel === CONFIG.AVAILABLE_STYLES.TONE_POLISH.name, `popup selects from the shared config: styles=${popup.styles.join(',')} languages=${popup.languages} label="${popup.styleLabel}"`);
            check(popup.events >= 8 && popup.polishRows === 4 && popup.okRows === 3 && popup.badRows === 1, `popup log renders ${popup.events} events, ${popup.polishRows} polish rows (${popup.okRows} ok, ${popup.badRows} problem)`);
            await browser.evaluate(ps, `(() => { const p = document.getElementById('polish'); p.checked = true; p.dispatchEvent(new Event('change')); const k = document.getElementById('apiKey'); k.value = 'sk-from-popup'; k.dispatchEvent(new Event('change')); const st = document.getElementById('style'); st.value = 'CONCISE'; st.dispatchEvent(new Event('change')); return true; })()`);
            await sleep(300);
            const saved = await browser.evaluate(w, `chrome.storage.local.get('settings').then(r => r.settings)`, true);
            check(!!saved && saved.polish === true && saved.apiKey === 'sk-from-popup' && saved.style === 'CONCISE' && saved.language === 'ENGLISH', `popup saved settings: ${JSON.stringify(saved)}`);
            await browser.send('Target.closeTarget', { targetId: pid }).catch(() => {});
            await setSettings({ polish: false, apiKey: '' });
        }
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
