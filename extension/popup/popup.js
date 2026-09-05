// The extension's settings menu: same fields, labels and option texts as the SlackPolish menu in Slack.
const CONFIG = window.SLACKPOLISH_CONFIG || {};
const DEFAULTS = { language: 'ENGLISH', style: 'CASUAL', improveHotkey: 'Ctrl+Shift', personalPolish: '', apiKey: '', syncWithSlack: false };

// Same catalogs/fallbacks as slack-settings.js
function languageOptions() { return CONFIG.SUPPORTED_LANGUAGES || { ENGLISH: { name: 'English', flag: '🇺🇸', displayName: 'English' } }; }
function styleOptions() { return CONFIG.AVAILABLE_STYLES || { CASUAL: { name: '😊 Casual', description: 'Friendly and relaxed' } }; }
function hotkeyOptions() { return CONFIG.AVAILABLE_HOTKEYS || ['Ctrl+Shift', 'Ctrl+Alt', 'Ctrl+Tab']; }

function send(message) {
    return new Promise(resolve => {
        try { chrome.runtime.sendMessage(message, reply => resolve(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : (reply || { ok: false, error: 'no reply' }))); }
        catch (error) { resolve({ ok: false, error: String(error.message || error) }); }
    });
}

function fillMenu(settings) {
    const language = document.getElementById('language-select');
    const style = document.getElementById('style-select');
    const hotkey = document.getElementById('hotkey-select');
    language.innerHTML = '';
    Object.entries(languageOptions()).forEach(([key, lang]) => {
        const option = document.createElement('option'); option.value = key; option.textContent = `${lang.flag} ${lang.displayName || lang.name}`; option.selected = settings.language === key; language.appendChild(option);
    });
    style.innerHTML = '';
    Object.entries(styleOptions()).forEach(([key, s]) => {
        const option = document.createElement('option'); option.value = key; option.textContent = `${s.name} - ${s.description}`; option.selected = settings.style === key; style.appendChild(option);
    });
    hotkey.innerHTML = '';
    hotkeyOptions().forEach(h => {
        const icon = h === 'Ctrl+Shift' ? '⌨️' : h === 'Ctrl+Alt' ? '🔀' : '📑';
        const option = document.createElement('option'); option.value = h; option.textContent = `${icon} ${h}${h === 'Ctrl+Shift' ? ' (Default)' : ''}`; option.selected = settings.improveHotkey === h;
        if (h === 'Ctrl+Tab') { option.disabled = true; option.title = 'Chrome uses Ctrl+Tab to switch tabs'; }
        hotkey.appendChild(option);
    });
    document.getElementById('personal-polish').value = settings.personalPolish || '';
    document.getElementById('api-key-input').value = settings.apiKey || '';
    document.getElementById('sync-with-slack').checked = settings.syncWithSlack === true;
    document.getElementById('version').textContent = `v${CONFIG.VERSION || ''} (Build ${CONFIG.BUILD || ''}) - ${CONFIG.BUILD_DATE || ''}`;
}

function readMenu() {
    return {
        language: document.getElementById('language-select').value,
        style: document.getElementById('style-select').value,
        improveHotkey: document.getElementById('hotkey-select').value,
        personalPolish: document.getElementById('personal-polish').value.trim(),
        apiKey: document.getElementById('api-key-input').value.trim(),
        syncWithSlack: document.getElementById('sync-with-slack').checked
    };
}

function showNotification(text, type) {
    const el = document.getElementById('notification');
    el.textContent = text; el.className = type === 'error' ? 'error' : ''; el.hidden = false;
}

async function showSyncStatus() {
    const line = document.getElementById('sync-status');
    const reply = await send({ type: 'slackpolish-sync-status' });
    if (!reply.ok) { line.textContent = `Could not reach the extension worker: ${reply.error}`; return; }
    const s = reply.sync || {};
    const when = (t) => (t ? new Date(t).toLocaleString() : 'never');
    if (s.connected) {
        line.innerHTML = `<span class="sync-ok">Connected to SlackPolish in Slack.</span> Last received from Slack: ${s.lastAppliedFromSlack ? `${s.lastAppliedFromSlack.fields.join(', ')} (${when(s.lastAppliedFromSlack.at)})` : 'nothing yet'}. Last sent to Slack: ${when(s.lastPushAt)}${s.pendingChromeSave ? ' (a Save is waiting to be sent)' : ''}.`;
    } else {
        line.innerHTML = `<span class="sync-off">SlackPolish launcher not running</span> - settings are kept here and sync when Slack runs through SlackPolish.${s.pendingChromeSave ? ' A Save is waiting to be sent.' : ''}${s.lastError ? ` (${s.lastError})` : ''}`;
    }
}

async function init() {
    const { settings = {} } = await chrome.storage.local.get('settings');
    fillMenu({ ...DEFAULTS, ...settings });
    showSyncStatus();

    document.getElementById('api-key-toggle').addEventListener('click', () => {
        const input = document.getElementById('api-key-input');
        input.type = input.type === 'password' ? 'text' : 'password';
    });
    document.getElementById('cancel-settings-btn').addEventListener('click', () => window.close());
    document.getElementById('save-settings-btn').addEventListener('click', async () => {
        const reply = await send({ type: 'slackpolish-save-settings', settings: readMenu() });
        if (!reply.ok) { showNotification(`Error saving settings: ${reply.error}`, 'error'); return; }
        showNotification(reply.synced === 'sent' ? 'Settings saved and sent to Slack!' : reply.synced === 'pending' ? 'Settings saved! They will sync when SlackPolish runs in Slack.' : 'Settings saved successfully!', 'success');
        showSyncStatus();
        setTimeout(() => window.close(), 1400);
    });
    document.getElementById('open-log').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: chrome.runtime.getURL('popup/log.html') });
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.close(); });
}

init();
