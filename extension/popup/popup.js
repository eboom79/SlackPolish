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

document.getElementById('copy').addEventListener('click', async () => {
    const { events = [] } = await chrome.storage.local.get('events');
    await navigator.clipboard.writeText(JSON.stringify(events, null, 2));
    const button = document.getElementById('copy'); const label = button.textContent;
    button.textContent = 'Copied'; setTimeout(() => { button.textContent = label; }, 1200);
});

document.getElementById('clear').addEventListener('click', async () => {
    await chrome.storage.local.set({ events: [] });
    await chrome.action.setBadgeText({ text: '' });
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
            status.innerHTML = `<span style="color:#2e7d32">Active on this tab</span> — ${reply.host} (${reply.surface}). Click into the page and press Ctrl+Shift; the SlackPolish badge appears bottom-left.`;
        });
    } catch (error) {
        status.textContent = `Could not check the active tab: ${error.message}`;
    }
}

(async () => {
    const box = document.getElementById('roundtrip');
    const { roundTrip = false } = await chrome.storage.local.get('roundTrip');
    box.checked = !!roundTrip;
    box.addEventListener('change', () => chrome.storage.local.set({ roundTrip: box.checked }));
})();
checkActiveTab();
load();
});

load();
