/**
 * Content script: log where the SlackPolish hotkey is pressed.
 * Records surface, host, path and title - never the query string (it can carry tokens).
 * Persisted by the background worker in chrome.storage.local; see the popup.
 */
(function () {
    if (window.__SLACKPOLISH_EXTENSION_HOTKEY_ATTACHED__) {
        return;
    }
    window.__SLACKPOLISH_EXTENSION_HOTKEY_ATTACHED__ = true;

    const HOTKEY = 'Ctrl+Shift';
    const hotkey = SlackPolishHotkey.parse(HOTKEY);

    function describePage() {
        const appNameMeta = document.querySelector('meta[name="application-name"]');
        const surface = SlackPolishSurface.classify(location.hostname, { appName: appNameMeta ? appNameMeta.content : '' });
        return {
            time: new Date().toISOString(),
            hotkey: HOTKEY,
            surface,
            host: location.hostname,
            path: location.pathname,
            title: (document.title || '').slice(0, 120),
            editorFocused: !!(document.activeElement && (document.activeElement.isContentEditable || /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)))
        };
    }

    // Brief on-page confirmation so a press is visibly caught (the badge is often hidden behind Chrome's puzzle icon)
    function showToast(event) {
        const existing = document.getElementById('slackpolish-hotkey-toast');
        if (existing) {
            existing.remove();
        }
        const toast = document.createElement('div');
        toast.id = 'slackpolish-hotkey-toast';
        toast.setAttribute('role', 'status');
        toast.textContent = `SlackPolish · ${event.hotkey} · ${event.surface}${event.surface === 'other' ? ` (${event.host})` : ''} · logged`;
        toast.style.cssText = [
            'position:fixed', 'right:16px', 'bottom:16px', 'z-index:2147483647', 'pointer-events:none',
            'padding:8px 12px', 'border-radius:6px', 'background:rgba(18,100,163,0.94)', 'color:#fff',
            'font:12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', 'box-shadow:0 2px 10px rgba(0,0,0,0.25)',
            'transition:opacity 300ms ease'
        ].join(';');
        document.documentElement.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; }, 1500);
        setTimeout(() => { toast.remove(); }, 1900);
    }

    SlackPolishHotkey.attach(document, hotkey, () => {
        const event = describePage();
        console.log('🔧 SLACKPOLISH_HOTKEY', JSON.stringify(event));
        showToast(event);
        try {
            chrome.runtime.sendMessage({ type: 'slackpolish-hotkey', event }, () => void chrome.runtime.lastError);
        } catch (error) {
            // Extension was reloaded/updated under this page; the console line above still records the press.
        }
    });

    // Let the popup ask whether the content script is alive on this tab
    try {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message && message.type === 'slackpolish-ping') {
                const page = describePage();
                sendResponse({ ok: true, surface: page.surface, host: page.host });
            }
        });
    } catch (error) {
        // ignore
    }
})();
