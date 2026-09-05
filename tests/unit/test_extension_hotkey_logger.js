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
    assert(JSON.stringify(manifest.permissions) === JSON.stringify(['storage']), `permissions must be exactly ["storage"], got ${JSON.stringify(manifest.permissions)}`);
    assert(!manifest.host_permissions, 'no host_permissions beyond the content script matches');
    const cs = manifest.content_scripts[0];
    assert(JSON.stringify(cs.matches) === JSON.stringify(['<all_urls>']), 'content script must run on all URLs');
    assert(JSON.stringify(cs.js) === JSON.stringify(['shared/hotkey.js', 'shared/surface.js', 'content/hotkey-logger.js']), 'shared modules must load before the content script');
    assert(!cs.all_frames, 'top frame only');
    assert(manifest.version === versionJson.version_string, `manifest version ${manifest.version} must match version.json ${versionJson.version_string}`);
    for (const rel of ['background.js', 'popup/popup.html', 'popup/popup.js', 'icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png']) {
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
    assert(contentSource.includes("console.log('🔧 SLACKPOLISH_HOTKEY', JSON.stringify(event));"), 'console line for live debugging');
    assert(contentSource.includes("path: location.pathname,") && !contentSource.includes('location.search') && !contentSource.includes('location.href'), 'never record the query string / full URL');
    assert(contentSource.includes("chrome.runtime.sendMessage({ type: 'slackpolish-hotkey', event }"), 'event must be sent to the background worker');
    assert(contentSource.includes('meta[name="application-name"]'), 'self-hosted Jira detection via application-name meta');
    assert(backgroundSource.includes('const MAX_EVENTS = 200;') && backgroundSource.includes('while (events.length > MAX_EVENTS)'), 'storage must be capped');
    assert(backgroundSource.includes("chrome.storage.local.set({ events })"), 'events persisted to chrome.storage.local');
});

runTest('A caught press is visible on the page and the popup can check the tab', () => {
    assert(contentSource.includes("toast.id = 'slackpolish-hotkey-toast';") && contentSource.includes('showToast(event);'), 'content script must show a brief toast');
    assert(contentSource.includes("'pointer-events:none'"), 'toast must not intercept clicks');
    assert(contentSource.includes("message.type === 'slackpolish-ping'"), 'content script must answer the popup ping');
    const popupSource = fs.readFileSync(path.join(root, 'popup/popup.js'), 'utf8');
    assert(popupSource.includes("{ type: 'slackpolish-ping' }") && popupSource.includes('Not active on this tab'), 'popup must report whether the content script is active on the current tab');
});

console.log('\n===============================================');
console.log(`📊 Total: ${testsTotal}  ✅ Passed: ${testsPassed}  ❌ Failed: ${testsTotal - testsPassed}`);
process.exit(testsPassed === testsTotal ? 0 : 1);
