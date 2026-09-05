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
    load();
});

load();
