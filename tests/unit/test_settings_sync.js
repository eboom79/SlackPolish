#!/usr/bin/env node

/**
 * Settings sync between JustPolish in Slack and the Chrome extension:
 *  - the extension menu mirrors the Slack settings menu (same fields, labels, option texts; no developer options)
 *  - both menus have a "Sync settings with …" checkbox; settings travel only on Save and only when checked
 *  - one OpenAI key for both (always shared); polishing never touches the launcher
 */
const fs = require('fs');
const path = require('path');

const repo = path.join(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(repo, p), 'utf8');
const slackSettings = read('slack-settings.js');
const launcher = read('installers/launch-slackpolish-MAC-ARM.py');
const popupHtml = read('extension/popup/popup.html');
const popupJs = read('extension/popup/popup.js');
const background = read('extension/background.js');
const content = read('extension/content/hotkey-logger.js');
const manifest = JSON.parse(read('extension/manifest.json'));

let testsPassed = 0, testsTotal = 0;
function runTest(name, fn) { testsTotal++; try { console.log(`🧪 Testing: ${name}`); fn(); testsPassed++; console.log(`✅ PASSED: ${name}`); } catch (e) { console.log(`❌ FAILED: ${name}`); console.log(`   Error: ${e.message}`); } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

console.log('🚀 Running Settings Sync Tests (Slack <-> Chrome extension)');
console.log('==========================================================\n');

runTest('Slack menu: "Sync settings with Chrome" checkbox, saved with the settings, default off', () => {
    assert(slackSettings.includes('id="sync-with-chrome"') && slackSettings.includes('Sync settings with Chrome'), 'checkbox in the Slack menu');
    assert(slackSettings.includes('syncWithChrome: false,'), 'default off');
    assert(slackSettings.includes("syncWithChrome: menu.querySelector('#sync-with-chrome') ? menu.querySelector('#sync-with-chrome').checked : false,"), 'read on Save');
    assert(slackSettings.includes('savedAt: Date.now(),'), 'each Save is stamped (last save wins across the two sides)');
    const menuStart = slackSettings.indexOf('<!-- Sync with the Chrome extension -->');
    const devStart = slackSettings.indexOf('<!-- Developer Options (Hidden by default) -->');
    assert(menuStart !== -1 && devStart !== -1 && menuStart < devStart, 'the sync checkbox is a main-menu option, not a developer option');
});

runTest('Slack menu: only a Save notifies the launcher; settings only when checked, key always', () => {
    assert(slackSettings.includes('this.notifyChromeSync(newSettings);') && slackSettings.indexOf('this.notifyChromeSync(newSettings);') > slackSettings.indexOf('if (this.saveSettings(newSettings)) {'), 'notify right after a successful Save');
    assert((slackSettings.match(/notifyChromeSync\(/g) || []).length === 1 && slackSettings.includes('notifyChromeSync: function(settings)'), 'notify is called from the Save handler only');
    assert(slackSettings.includes("fetch(`http://127.0.0.1:${port}/slackpolish/sync`") && slackSettings.includes("const port = window.__SLACKPOLISH_PROXY_PORT__ || 9223;"), 'posts to the launcher proxy port');
    assert(slackSettings.includes("syncWithChrome: settings.syncWithChrome === true,") && slackSettings.includes("apiKey: localStorage.getItem('slackpolish_openai_api_key') || ''"), 'payload carries the sync flag and the effective key');
    assert(slackSettings.includes(".catch(error => {") && slackSettings.includes('Chrome sync not reachable'), 'fire-and-forget: Slack never waits on the launcher');
});

runTest('Launcher: relays a Slack Save to the extension and writes an extension Save into Slack', () => {
    ['/slackpolish/sync', 'def _handle_slack_save', 'def _handle_sync_websocket', 'class SyncHub', 'def write_settings', "slackpolish-settings-updated", 'ThreadingHTTPServer', '"chrome-saved-ack"', '"slack-saved"', '"hello"'].forEach(s => assert(launcher.includes(s), `launcher has: ${s}`));
    assert(launcher.includes('origin.startswith("https://app.slack.com")'), 'Slack Save notifications accepted from the Slack origin only');
    assert(launcher.split('origin.startswith("chrome-extension://")').length >= 2, 'the sync WebSocket is for browser-extension origins only');
    assert(!launcher.includes('"/v1/chat/completions"'), 'no OpenAI-shaped proxy endpoint any more: polishing does not go through the launcher');
});

runTest('Extension menu mirrors the Slack menu: same fields, labels, option texts, no developer options', () => {
    ['JustPolish Settings', '🌍 Language:', '✨ Style:', '⌨️ Hotkey:', '✨ Personal Style:', '🔑 OpenAI API Key', 'Personal writing preferences for AI to consider.', "placeholder=\"e.g., Use 'Hi' not 'Hey', avoid dashes, British spelling\""]
        .forEach(s => { assert(popupHtml.includes(s), `popup has: ${s}`); assert(slackSettings.includes(s), `Slack menu has the same text: ${s}`); });
    ['language-select', 'style-select', 'hotkey-select', 'personal-polish', 'api-key-input', 'api-key-toggle', 'save-settings-btn', 'cancel-settings-btn']
        .forEach(id => { assert(popupHtml.includes(`id="${id}"`), `popup id ${id}`); assert(slackSettings.includes(`id="${id}"`), `same id in Slack: ${id}`); });
    assert(popupHtml.includes('id="sync-with-slack"') && popupHtml.includes('Sync settings with Slack'), 'sync checkbox');
    ['smart-context', 'emoji-signature', 'debug-mode', 'developer', 'dev-trigger', 'show-scrolling-message'].forEach(s => assert(!popupHtml.includes(s), `no developer/enhanced option: ${s}`));
    // option texts built exactly like slack-settings.js
    assert(popupJs.includes('`${lang.flag} ${lang.displayName || lang.name}`') && slackSettings.includes('${lang.flag} ${lang.displayName}'), 'language option text');
    assert(popupJs.includes('`${s.name} - ${s.description}`') && slackSettings.includes('${style.name} - ${style.description}'), 'style option text');
    assert(popupJs.includes("${h === 'Ctrl+Shift' ? ' (Default)' : ''}") && slackSettings.includes("${hotkey === 'Ctrl+Shift' ? ' (Default)' : ''}"), 'hotkey option text');
    assert(popupJs.includes("CONFIG.AVAILABLE_HOTKEYS || ['Ctrl+Shift', 'Ctrl+Alt', 'Ctrl+Tab']") && slackSettings.includes("return ['Ctrl+Shift', 'Ctrl+Alt', 'Ctrl+Tab'];"), 'same hotkey catalog and fallback');
    assert(popupHtml.includes('#save-settings-btn { border: none; background: #007a5a; color: white; }') && slackSettings.includes('background: #007a5a; color: white;">Save</button>'), 'same Save button look');
    assert(popupJs.includes('Settings saved') && slackSettings.includes("'Settings saved successfully!'"), 'same save notification wording');
});

runTest('Extension: settings and key are local; polishing calls OpenAI directly; sync only on Save', () => {
    assert(!content.includes('slackpolish-slack-settings') && !content.includes('proxyBase') && content.includes('applyHotkey(settings.improveHotkey)'), 'the hotkey path reads chrome.storage only');
    assert(background.includes("DEFAULT_SYNC_URL = 'ws://127.0.0.1:9223/slackpolish/sync'") && background.includes("'https://api.openai.com/v1'") && background.includes('Authorization: `Bearer ${apiKey}`'), 'direct OpenAI call, sync over a WebSocket');
    assert(!background.includes('/slackpolish/settings') && !background.includes('keySource'), 'no per-polish launcher lookups, no separate key option');
    assert(background.includes("type: 'chrome-saved'") && background.includes("message.type === 'slack-saved'") && background.includes("message.type === 'hello'") && background.includes("message.type === 'chrome-saved-ack'"), 'sync protocol');
    assert(background.includes("settings: next.syncWithSlack ? Object.fromEntries(SHARED_FIELDS.map(f => [f, next[f]])) : null") && background.includes("apiKey: next.apiKey || ''"), 'settings only when the box is checked, key always');
    assert(background.includes("const applySettings = !!shared && (reason === 'slack-saved' ||"), "Slack's settings applied on a Slack Save (or a missed one caught up on connect)");
    assert(background.includes('pendingChromeSave'), 'a Save while the launcher is down is kept and sent later');
    assert(JSON.stringify(manifest.permissions) === JSON.stringify(['storage', 'alarms']), `permissions: ${JSON.stringify(manifest.permissions)}`);
    assert(popupJs.includes("type: 'slackpolish-save-settings'") && !popupJs.includes("addEventListener('change'"), 'the menu applies on Save only (like Slack), not on every change');
});

console.log(`\n📊 Results: ${testsPassed}/${testsTotal} passed`);
process.exit(testsPassed === testsTotal ? 0 : 1);
