#!/usr/bin/env node

/**
 * Chrome extension (hotkey logger) tests: manifest sanity, chord detection semantics
 * (must match the Slack script), surface classification, privacy of the logged event.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../../extension');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const versionJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../version.json'), 'utf8'));
const contentSource = fs.readFileSync(path.join(root, 'content/hotkey-logger.js'), 'utf8');
const backgroundSource = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
const Hotkey = require(path.join(root, 'shared/hotkey.js'));
const Surface = require(path.join(root, 'shared/surface.js'));

let testsPassed = 0, testsTotal = 0;
function runTest(name, fn) { testsTotal++; try { console.log(`🧪 Testing: ${name}`); fn(); testsPassed++; console.log(`✅ PASSED: ${name}`); } catch (e) { console.log(`❌ FAILED: ${name}`); console.log(`   Error: ${e.message}`); } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

console.log('🚀 Running Chrome Extension Hotkey Logger Tests');
console.log('===============================================\n');

runTest('Manifest: MV3, storage-only permission, scripts in dependency order, version in sync', () => {
    assert(manifest.manifest_version === 3, 'must be Manifest V3');
    assert(JSON.stringify(manifest.permissions) === JSON.stringify(['storage', 'alarms']), `permissions must be exactly ["storage","alarms"] (alarms re-establish the settings-sync link), got ${JSON.stringify(manifest.permissions)}`);
    assert(JSON.stringify(manifest.host_permissions) === JSON.stringify(['https://api.openai.com/*', 'http://127.0.0.1/*']), `host_permissions: only OpenAI (polishing) and loopback (launcher sync / test mock), got ${JSON.stringify(manifest.host_permissions)}`);
    const cs = manifest.content_scripts[0];
    assert(JSON.stringify(cs.matches) === JSON.stringify(['<all_urls>']), 'content script must run on all URLs');
    assert(JSON.stringify(cs.js) === JSON.stringify(['vendor/slack-config.js', 'shared/hotkey.js', 'shared/surface.js', 'shared/status-badge.js', 'shared/editor.js', 'shared/atlassian-adapter.js', 'shared/polish-core.js', 'content/hotkey-logger.js']), `shared modules must load before the content script: ${JSON.stringify(cs.js)}`);
    assert(!cs.all_frames, 'top frame only');
    assert(manifest.version === versionJson.version_string, `manifest version ${manifest.version} must match version.json ${versionJson.version_string}`);
    for (const rel of ['background.js', 'popup/popup.html', 'popup/popup.js', 'popup/log.html', 'popup/log.js', 'icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png']) {
        assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
    }
});

runTest('Chord detection matches the Slack script semantics', () => {
    const cs = Hotkey.parse('Ctrl+Shift');
    assert(cs.ctrl && cs.shift && !cs.alt && !cs.tab, 'parse Ctrl+Shift');
    assert(Hotkey.matches({ key: 'Shift', ctrlKey: true, shiftKey: true, altKey: false }, cs), 'Shift completing Ctrl+Shift must match');
    assert(Hotkey.matches({ key: 'Control', ctrlKey: true, shiftKey: true, altKey: false }, cs), 'Control completing Shift+Ctrl must match');
    assert(!Hotkey.matches({ key: 'Control', ctrlKey: true, shiftKey: false, altKey: false }, cs), 'Control alone must not match');
    assert(!Hotkey.matches({ key: 'a', ctrlKey: true, shiftKey: true, altKey: false }, cs), 'Ctrl+Shift+A is another shortcut, not ours');
    assert(!Hotkey.matches({ key: 'Shift', ctrlKey: true, shiftKey: true, altKey: true }, cs), 'extra Alt must not match');
    const ca = Hotkey.parse('Ctrl+Alt');
    assert(Hotkey.matches({ key: 'Alt', ctrlKey: true, shiftKey: false, altKey: true }, ca) && !Hotkey.matches({ key: 'Shift', ctrlKey: true, shiftKey: true, altKey: false }, ca), 'Ctrl+Alt');
    const tab = Hotkey.parse('Ctrl+Shift+Tab');
    assert(Hotkey.matches({ key: 'Tab', ctrlKey: true, shiftKey: true, altKey: false }, tab) && !Hotkey.matches({ key: 'Shift', ctrlKey: true, shiftKey: true, altKey: false }, tab), 'Tab combos fire on Tab only');
});

runTest('attach(): fires once per press, resets on release/blur, respects the min interval', () => {
    const listeners = {};
    const target = {
        addEventListener: (type, fn) => { listeners[type] = fn; },
        removeEventListener: () => {},
        defaultView: { addEventListener: (type, fn) => { listeners['window:' + type] = fn; }, removeEventListener: () => {} }
    };
    let fired = 0;
    const detach = Hotkey.attach(target, Hotkey.parse('Ctrl+Shift'), () => { fired++; }, { minIntervalMs: 0 });
    listeners.keydown({ key: 'Control', ctrlKey: true, shiftKey: false });
    listeners.keydown({ key: 'Shift', ctrlKey: true, shiftKey: true });
    listeners.keydown({ key: 'Shift', ctrlKey: true, shiftKey: true }); // key repeat
    assert(fired === 1, `should fire exactly once while held, fired ${fired}`);
    listeners.keyup({ key: 'Shift' });
    listeners.keydown({ key: 'Shift', ctrlKey: true, shiftKey: true });
    assert(fired === 2, 'should fire again after a required key is released');
    listeners['window:blur']();
    listeners.keydown({ key: 'Shift', ctrlKey: true, shiftKey: true });
    assert(fired === 3, 'blur must reset the chord state');
    assert(typeof detach === 'function', 'attach returns a detach function');
    listeners.keydown({ key: 'Control', ctrlKey: true, shiftKey: false }); listeners.keydown({ key: 'Shift', ctrlKey: true, shiftKey: true });
    assert(JSON.stringify(Hotkey.heldModifiers().sort()) === JSON.stringify(['Control', 'Shift']), `held modifiers tracked: ${Hotkey.heldModifiers()}`);
    listeners.keyup({ key: 'Shift' }); listeners.keyup({ key: 'Control' });
    assert(Hotkey.heldModifiers().length === 0, 'released modifiers are forgotten');
    let limited = 0;
    Hotkey.attach(target, Hotkey.parse('Ctrl+Shift'), () => { limited++; }, { minIntervalMs: 60000 });
    listeners.keydown({ key: 'Shift', ctrlKey: true, shiftKey: true }); listeners.keyup({ key: 'Shift' });
    listeners.keydown({ key: 'Shift', ctrlKey: true, shiftKey: true });
    assert(limited === 1, 'presses inside the min interval are ignored');
});

runTest('Surface classification', () => {
    const c = Surface.classify;
    assert(c('redislabs.atlassian.net') === 'atlassian', 'Jira Cloud host');
    assert(c('redislabs.atlassian.net', { appName: 'JIRA' }) === 'atlassian', 'Jira Cloud host with meta');
    assert(c('jira.internal.example.com', { appName: 'JIRA' }) === 'atlassian', 'self-hosted Jira by application-name meta');
    assert(c('wiki.internal.example.com', { appName: 'Confluence' }) === 'atlassian', 'Confluence by meta');
    assert(c('app.slack.com') === 'slack-web', 'Slack web');
    assert(c('redis.slack.com') === 'slack-web', 'workspace slack host');
    assert(c('example.com') === 'other' && c('') === 'other', 'others');
    assert(c('atlassian.net.evil.com') === 'other' && c('notslack.com') === 'other', 'suffix tricks must not match');
});

runTest('Logged event is privacy-safe and reaches the background worker', () => {
    assert(contentSource.includes("console.log('🔧 SLACKPOLISH_HOTKEY', JSON.stringify({ ...event, editor: event.editor && { ...event.editor, text: event.editor.text.slice(0, 200)"), 'console line for live debugging (editor text truncated)');
    assert(contentSource.includes("path: location.pathname,") && !contentSource.includes('location.search') && !contentSource.includes('location.href'), 'never record the query string / full URL');
    assert(contentSource.includes("chrome.runtime.sendMessage({ type: 'slackpolish-hotkey', event }"), 'event must be sent to the background worker');
    assert(contentSource.includes('meta[name="application-name"]'), 'self-hosted Jira detection via application-name meta');
    assert(backgroundSource.includes('const MAX_EVENTS = 200;') && backgroundSource.includes('while (events.length > MAX_EVENTS)'), 'storage must be capped');
    assert(backgroundSource.includes("chrome.storage.local.set({ events })"), 'events persisted to chrome.storage.local');
});

runTest('The status badge is a faithful copy of the one in Slack (ids, colours, labels, fade)', () => {
    const slack = fs.readFileSync(path.join(__dirname, '../../slack-text-improver.js'), 'utf8');
    const Badge = require(path.join(root, 'shared/status-badge.js'));
    const slackId = slack.match(/const STATUS_BADGE_ID = '([^']+)'/)[1];
    assert(Badge.STATUS_BADGE_ID === slackId, `badge id ${Badge.STATUS_BADGE_ID} must equal Slack's ${slackId}`);
    for (const [state, style] of Object.entries(Badge.STATES)) {
        for (const value of [style.background, style.dot, style.glow, style.label]) {
            assert(slack.includes(value), `Slack script must contain ${state} style value ${JSON.stringify(value)}`);
        }
    }
    assert(slack.includes("setStatusBadgeState('busy', 'JustPolish Improving')"), 'Slack shows "JustPolish Improving" while polishing');
    assert(contentSource.includes("SlackPolishStatusBadge.set('busy', 'JustPolish Improving');") && contentSource.includes("SlackPolishStatusBadge.set('active', 'JustPolish Active'"), 'extension must show the same states/texts');
    const badgeSource = fs.readFileSync(path.join(root, 'shared/status-badge.js'), 'utf8');
    for (const css of ['left: 20px;', 'bottom: 20px;', 'border-radius: 999px;', 'gap: 8px;', 'padding: 8px 12px;', "}, 5000);"]) {
        assert(badgeSource.includes(css) && slack.includes(css), `layout/timing detail must match Slack: ${css}`);
    }
    assert(!contentSource.includes('slackpolish-hotkey-toast'), 'old toast must be gone');
});

runTest('The content script answers a liveness ping; the menu shows the sync status', () => {
    assert(contentSource.includes("message.type === 'slackpolish-ping'"), 'content script must answer a ping (revision + active hotkey)');
    const popupSource = fs.readFileSync(path.join(root, 'popup/popup.js'), 'utf8');
    assert(popupSource.includes("{ type: 'slackpolish-sync-status' }") && popupSource.includes('Connected to JustPolish in Slack') && popupSource.includes('JustPolish launcher not running'), 'menu must report whether the settings-sync link to Slack is up');
});

runTest('Editor detection: kinds are classified from tag/class/ancestry; text capture is wired and bounded', () => {
    const Editor = require(path.join(root, 'shared/editor.js'));
    assert(Editor.classify('div', 'ProseMirror') === 'prosemirror', 'Atlassian editor root');
    assert(Editor.classify('div', '', { insideProseMirror: true }) === 'prosemirror', 'inside ak-editor-content-area');
    assert(Editor.classify('div', 'ql-editor ql-blank') === 'quill', 'Slack web editor');
    assert(Editor.classify('textarea', '') === 'textarea' && Editor.classify('input', '') === 'input', 'plain fields');
    assert(Editor.classify('div', 'comment-box') === 'contenteditable', 'generic contenteditable');
    assert(Editor.EDITOR_SELECTORS[0] === '.ProseMirror[contenteditable="true"]', 'ProseMirror must be the first fallback selector');
    assert(contentSource.includes('editor: SlackPolishEditor.describe(SlackPolishEditor.findActive(document))'), 'event must carry the editor description');
    assert(contentSource.includes("text: event.editor.text.slice(0, 200)"), 'console line must truncate the editor text');
    const editorSource = fs.readFileSync(path.join(root, 'shared/editor.js'), 'utf8');
    assert(editorSource.includes("const maxText = (options && options.maxText) || 5000;"), 'stored text must be bounded');
    assert(editorSource.includes(".filter(n => n !== 'class' && n !== 'style').sort().join(',')"), 'vocabulary records attribute names only (never values)');
    const popupSource = fs.readFileSync(path.join(root, 'popup/log.js'), 'utf8');
    assert(popupSource.includes("details.className = 'editor'"), 'popup must show the captured text');
});

runTest('Atlassian specifics: zero-width padding stripped, field from aria-label, node names summarised', () => {
    const Editor = require(path.join(root, 'shared/editor.js'));
    assert(Editor.stripZeroWidth('let\u2019s test that \u200B@Hadar Hazan\u200B ') === 'let\u2019s test that @Hadar Hazan ', 'U+200B padding around inline node views must be removed');
    assert(Editor.stripZeroWidth('a\uFEFFb\u200Cc\u200Dd') === 'abcd', 'other zero-width characters too');
    assert(Editor.fieldFromAriaLabel('Comment area, start typing to enter text.') === 'comment', 'Jira comment editor');
    assert(Editor.fieldFromAriaLabel('Main content area, start typing to enter text.') === 'description', 'Jira description editor');
    assert(Editor.fieldFromAriaLabel('') === null && Editor.fieldFromAriaLabel(null) === null, 'unknown editors');
    const editorSource = fs.readFileSync(path.join(root, 'shared/editor.js'), 'utf8');
    assert(editorSource.includes("el.querySelectorAll('[data-prosemirror-node-name]')") && editorSource.includes("el.querySelectorAll('[data-prosemirror-node-inline]')"), 'describe() must summarise Atlassian node names and inline node views');
});

runTest('Atlassian adapter: HTML rebuild from model text restores entity nodes verbatim and Slack-style structure', () => {
    const A = require(path.join(root, 'shared/atlassian-adapter.js'));
    const entities = [
        { token: '__SLACKPOLISH_MENTION_1__', kind: 'MENTION', text: '@Dana', html: '<span class="mentionView-content-wrap" data-mention-id="1">@Dana</span>' },
        { token: '__SLACKPOLISH_LINK_1__', kind: 'LINK', text: 'https://x.io/a?b=1&c=2', html: '<a href="https://x.io/a?b=1&amp;c=2">https://x.io/a?b=1&amp;c=2</a>' },
        { token: '__SLACKPOLISH_CODE_1__', kind: 'CODE', text: 'npm test', html: '<code>npm test</code>' },
        { token: '__SLACKPOLISH_CODE_2__', kind: 'CODE', text: 'make deploy', html: '<pre><code>make deploy</code></pre>' }
    ];
    const text = '__SLACKPOLISH_MENTION_1__ please <run> __SLACKPOLISH_CODE_1__ & see __SLACKPOLISH_LINK_1__\n> quoted line\n> second quoted\n• item one\n• item two\n1. first\n2. second\n\n__SLACKPOLISH_CODE_2__\nlast';
    const html = A.buildHtml(text, entities);
    assert(html.startsWith('<p><span class="mentionView-content-wrap" data-mention-id="1">@Dana</span> please &lt;run&gt; <code>npm test</code> &amp; see <a href="https://x.io/a?b=1&amp;c=2">https://x.io/a?b=1&amp;c=2</a></p>'), `inline: ${html.slice(0, 200)}`);
    assert(html.includes('<blockquote><p>quoted line</p><p>second quoted</p></blockquote>'), 'consecutive quote lines form one blockquote');
    assert(html.includes('<ul><li><p>item one</p></li><li><p>item two</p></li></ul>'), 'bullets');
    assert(html.includes('<ol><li><p>first</p></li><li><p>second</p></li></ol>'), 'numbered');
    assert(html.includes('</ol><p></p><pre><code>make deploy</code></pre><p>last</p>'), `blank line -> empty paragraph, block code entity inserted as-is: ${html.slice(-120)}`);
    assert(A.plainText(text, entities).startsWith('@Dana please <run> npm test & see https://x.io/a?b=1&c=2'), 'plain text detokenises for the text/plain clipboard flavour');
    assert(!A.buildHtml('x __SLACKPOLISH_LINK_9__ y', entities).includes('<a'), 'unknown tokens are left as text, never invented');
});

runTest('Round-trip mode is opt-in, Atlassian-only, and reports paste handling', () => {
    assert(contentSource.includes("chrome.storage.local.get(['settings', 'roundTrip'])"), 'round trip must be read from settings');
    assert(contentSource.includes("settings.roundTrip && event.surface === 'atlassian' && event.atlassianEditor"), 'round trip only on Atlassian editors when enabled');
    assert(contentSource.includes("event.surface === 'atlassian' && event.atlassianEditor && !settings.roundTrip"), 'polishing on Atlassian editors (the diagnostic replaces it only when switched on)');
    assert(contentSource.includes("await chrome.storage.local.set({ roundTrip: false });") && contentSource.includes("SlackPolishStatusBadge.set('busy', 'JustPolish Round-trip test');"), 'the diagnostic is one-shot and announces itself on the badge (it must never look like a polish that did nothing)');
    assert(backgroundSource.includes("await chrome.storage.local.set({ roundTrip: false });"), 'the worker clears the diagnostic switch on install/reload/startup');
    assert(contentSource.includes("JustPolish: click into the comment editor first"), 'on Jira without a focused editor the badge says what to do');
    assert(contentSource.includes("const CONTENT_REVISION = '") && contentSource.includes('revision: CONTENT_REVISION,') && contentSource.includes('event.roundTripEnabled = settings.roundTrip === true;'), 'events must carry the script revision and the toggle state for diagnosis');
    const adapter = fs.readFileSync(path.join(root, 'shared/atlassian-adapter.js'), 'utf8');
    assert(adapter.includes("new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })"), 'write-back goes through the paste pipeline');
    assert(adapter.includes('ok: paste.handled && textSame && nodesSame'), 'a paste the editor ignored must not count as a successful round trip');
    assert(adapter.includes('await SlackPolishHotkey.whenModifiersReleased(2000)'), 'write-back must wait for the hotkey modifiers to be released (ProseMirror pastes plain text while Shift is held)');
    assert(adapter.includes("new KeyboardEvent('keyup', { key, code, keyCode, which: keyCode, bubbles: true })"), 'and send a synthetic Shift/Control keyup before pasting');
    assert(typeof Hotkey.heldModifiers === 'function' && typeof Hotkey.whenModifiersReleased === 'function', 'hotkey module must expose modifier tracking');
    assert(adapter.includes('const ZW = /[\\u200B\\u200C\\u200D\\uFEFF]/g;'), 'zero-width regex must use escapes');
    const logSource = fs.readFileSync(path.join(root, 'popup/log.js'), 'utf8');
    assert(logSource.includes("chrome.storage.local.set({ roundTrip: box.checked })"), 'activity-log toggle persists the setting');
});

console.log('\n===============================================');
console.log(`📊 Total: ${testsTotal}  ✅ Passed: ${testsPassed}  ❌ Failed: ${testsTotal - testsPassed}`);
process.exit(testsPassed === testsTotal ? 0 : 1);
