const CONFIG = window.SLACKPOLISH_CONFIG || {};

function polishSummary(p) {
    if (p.skipped === 'nothing-to-polish') return { cls: 'skip', text: '✨ nothing to polish (only links/tokens/quote markers)' };
    if (p.skipped === 'unchanged') return { cls: 'ok', text: '✨ polished: the model returned the text unchanged' };
    if (p.ok) return { cls: 'ok', text: `✨ polished ${p.mode === 'selection' ? 'the selection' : 'the comment'} (${p.style || ''}, ${p.language || ''}, settings from ${p.settingsSource === 'slack' ? 'Slack' : p.settingsSource === 'slack-cached' ? 'Slack (cached)' : 'this extension'})${p.repaired && (p.repaired.appended.length || p.repaired.reanchored.length || p.repaired.substituted.length) ? ' — restored tokens the model dropped' : ''}` };
    return { cls: 'bad', text: `✨ polish PROBLEM — ${p.error || 'unknown error'}` };
}

async function load() {
    const { events = [] } = await chrome.storage.local.get('events');
    const list = document.getElementById('events');
    const tally = document.getElementById('tally');
    document.getElementById('count').textContent = events.length ? `(${events.length})` : '';
    document.getElementById('empty').hidden = events.length > 0;

    const counts = events.reduce((acc, e) => { acc[e.surface] = (acc[e.surface] || 0) + 1; return acc; }, {});
    tally.innerHTML = ['atlassian', 'slack-web', 'other'].map(s => `<span class="surface ${s}"><b>${counts[s] || 0}</b> ${s}</span>`).join('');

    list.innerHTML = '';
    [...events].reverse().forEach(e => {
        const li = document.createElement('li');
        const time = document.createElement('span'); time.className = 'time'; time.textContent = new Date(e.time).toLocaleTimeString();
        const surface = document.createElement('span'); surface.className = `surface ${e.surface}`; surface.textContent = e.surface;
        const where = document.createElement('span'); where.className = 'where'; where.title = `${e.host}${e.path} — ${e.title}`;
        where.textContent = e.host; const small = document.createElement('small'); small.textContent = ` ${e.path}`; where.appendChild(small);
        li.append(time, surface, where);
        if (e.polish) {
            const p = e.polish; const s = polishSummary(p);
            const det = document.createElement('details'); det.className = `polish ${s.cls}`;
            const sum = document.createElement('summary'); sum.textContent = s.text;
            const pre = document.createElement('pre');
            pre.textContent = `before (model text):\n${p.modelText || ''}\n\nmodel response:\n${p.response || ''}\n\nafter repair:\n${(p.repaired && p.repaired.text) || ''}\n\nrepairs: ${JSON.stringify(p.repaired ? { removed: p.repaired.removed, reanchored: p.repaired.reanchored, appended: p.repaired.appended, substituted: p.repaired.substituted } : {})}\n\neditor after write-back:\n${p.modelTextAfter || ''}\n\nverification: ${JSON.stringify(p.verification || {})}${p.error ? `\n\nerror: ${p.error}` : ''}`;
            det.append(sum, pre);
            li.appendChild(det);
        }
        if (e.roundTrip) {
            const rt = document.createElement('details'); rt.className = `roundtrip ${e.roundTrip.ok ? 'ok' : 'bad'}`;
            const sum = document.createElement('summary');
            sum.textContent = e.roundTrip.ok ? '↺ round-trip OK — write-back is lossless here' : `↺ round-trip PROBLEM — ${e.roundTrip.error || (!e.roundTrip.pasteHandled ? 'editor ignored the paste' : !e.roundTrip.textSame ? 'text changed' : 'nodes changed')}`;
            const pre = document.createElement('pre');
            pre.textContent = `model text:\n${e.roundTrip.modelText || ''}\n\nentities: ${JSON.stringify(e.roundTrip.entities || [])}\n\nbefore: ${JSON.stringify(e.roundTrip.before || {}, null, 1)}\n\nafter: ${JSON.stringify(e.roundTrip.after || {}, null, 1)}`;
            rt.append(sum, pre);
            li.appendChild(rt);
        }
        if (e.editor && e.editor.kind && e.editor.kind !== 'none') {
            const details = document.createElement('details'); details.className = 'editor';
            const summary = document.createElement('summary');
            summary.textContent = `${e.editor.kind} · ${e.editor.textLength} chars: ${(e.editor.text || '').replace(/\s+/g, ' ').slice(0, 70)}${e.editor.textLength > 70 ? '…' : ''}`;
            const pre = document.createElement('pre'); pre.textContent = e.editor.text || '(empty)';
            details.append(summary, pre);
            li.appendChild(details);
        }
        list.appendChild(li);
    });
}

async function checkActiveTab() {
    const status = document.getElementById('status');
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) { status.textContent = 'No active tab.'; return; }
        chrome.tabs.sendMessage(tab.id, { type: 'slackpolish-ping' }, (reply) => {
            if (chrome.runtime.lastError || !reply || !reply.ok) {
                status.innerHTML = '<span style="color:#b00">Not active on this tab.</span> Reload the page (tabs opened before the extension was loaded do not have it; chrome:// pages never do), click into the page, then press Ctrl+Shift.';
                return;
            }
            status.innerHTML = `<span style="color:#2e7d32">Active on this tab</span> — ${reply.host} (${reply.surface}). Click into the editor and press Ctrl+Shift; the SlackPolish badge appears bottom-left.`;
        });
    } catch (error) {
        status.textContent = `Could not check the active tab: ${error.message}`;
    }
}

function describeSlackSettings(s) {
    const styleName = (CONFIG.AVAILABLE_STYLES && CONFIG.AVAILABLE_STYLES[s.style] && CONFIG.AVAILABLE_STYLES[s.style].name) || s.style || 'default style';
    const lang = CONFIG.SUPPORTED_LANGUAGES && CONFIG.SUPPORTED_LANGUAGES[s.language];
    const languageName = lang ? `${lang.flag || ''} ${lang.name}`.trim() : (s.language || 'default language');
    const parts = [styleName, languageName, `hotkey ${s.improveHotkey || 'Ctrl+Shift'}`];
    if (s.personalPolish) parts.push(`personal polish: “${String(s.personalPolish).slice(0, 60)}${s.personalPolish.length > 60 ? '…' : ''}”`);
    return parts.join(' · ');
}

function showSlackSettings() {
    const line = document.getElementById('slackStatus');
    chrome.runtime.sendMessage({ type: 'slackpolish-slack-settings' }, (reply) => {
        if (chrome.runtime.lastError || !reply) { line.textContent = 'Could not reach the extension worker.'; return; }
        if (reply.ok) {
            line.textContent = `From Slack: ${describeSlackSettings(reply.settings || {})}${reply.hasApiKey ? '' : ' · no OpenAI key saved in Slack yet'}`;
            return;
        }
        const cached = reply.cached;
        line.textContent = cached
            ? `Slack not reachable (${reply.error}). Last seen ${new Date(cached.fetchedAt).toLocaleString()}: ${describeSlackSettings(cached.settings || {})}`
            : `Slack not reachable (${reply.error}). Start Slack through SlackPolish, or use the settings below.`;
    });
}

function fillSelect(select, catalog, labelOf) {
    select.innerHTML = '';
    Object.entries(catalog || {}).forEach(([key, value]) => {
        const option = document.createElement('option'); option.value = key; option.textContent = labelOf(value, key); select.appendChild(option);
    });
}

async function initSettings() {
    const polish = document.getElementById('polish');
    const apiKey = document.getElementById('apiKey');
    const keySlack = document.getElementById('keySlack');
    const keyOwn = document.getElementById('keyOwn');
    const keySource = () => (keyOwn.checked ? 'own' : 'slack');
    const followSlack = document.getElementById('followSlack');
    const ownSettings = document.getElementById('ownSettings');
    const syncKeyInput = () => {
        apiKey.disabled = !keyOwn.checked;
        style.disabled = language.disabled = followSlack.checked;
    };
    const style = document.getElementById('style');
    const language = document.getElementById('language');
    fillSelect(style, CONFIG.AVAILABLE_STYLES, (v, k) => v.name || k);
    fillSelect(language, CONFIG.SUPPORTED_LANGUAGES, (v, k) => `${v.flag || ''} ${v.name || k}`.trim());

    const { settings = {} } = await chrome.storage.local.get('settings');
    polish.checked = settings.polish === true;
    (settings.keySource === 'own' ? keyOwn : keySlack).checked = true;
    (settings.followSlack === false ? ownSettings : followSlack).checked = true;
    syncKeyInput();
    showSlackSettings();
    apiKey.value = settings.apiKey || '';
    style.value = settings.style && CONFIG.AVAILABLE_STYLES && CONFIG.AVAILABLE_STYLES[settings.style] ? settings.style : 'TONE_POLISH';
    language.value = settings.language && CONFIG.SUPPORTED_LANGUAGES && CONFIG.SUPPORTED_LANGUAGES[settings.language] ? settings.language : 'ENGLISH';

    const save = async () => {
        const { settings: current = {} } = await chrome.storage.local.get('settings');
        await chrome.storage.local.set({ settings: { ...current, polish: polish.checked, followSlack: followSlack.checked, keySource: keySource(), apiKey: apiKey.value.trim(), style: style.value, language: language.value } });
    };
    [polish, style, language, keySlack, keyOwn, followSlack, ownSettings].forEach(el => el.addEventListener('change', () => { syncKeyInput(); save(); }));
    apiKey.addEventListener('change', save);
    apiKey.addEventListener('blur', save);

    const box = document.getElementById('roundtrip');
    const { roundTrip = false } = await chrome.storage.local.get('roundTrip');
    box.checked = !!roundTrip;
    box.addEventListener('change', () => chrome.storage.local.set({ roundTrip: box.checked }));
}

document.getElementById('copy').addEventListener('click', async () => {
    const { events = [] } = await chrome.storage.local.get('events');
    await navigator.clipboard.writeText(JSON.stringify(events, null, 2));
    const button = document.getElementById('copy'); const label = button.textContent;
    button.textContent = 'Copied'; setTimeout(() => { button.textContent = label; }, 1200);
});

document.getElementById('clear').addEventListener('click', async () => {
    await chrome.storage.local.set({ events: [] });
    await chrome.action.setBadgeText({ text: '' });
    load();
});

chrome.storage.onChanged.addListener((changes) => { if (changes.events) load(); });
initSettings();
checkActiveTab();
load();
