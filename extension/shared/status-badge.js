/**
 * SlackPolish status badge - a faithful copy of the pill shown in Slack (see
 * ensureStatusBadge / setStatusBadgeState in slack-text-improver.js): same element
 * ids, colours, labels and fade timing, so the extension looks like SlackPolish.
 *
 * Unlike Slack (where the badge is always present, dimmed), pages outside Slack
 * only show it around a hotkey press and it is removed afterwards.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.SlackPolishStatusBadge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const STATUS_BADGE_ID = 'slackpolish-runtime-status';
    const STATES = {
        active: { background: 'rgba(18, 100, 163, 0.92)', dot: '#8df7c8', glow: 'rgba(141,247,200,0.18)', label: 'SlackPolish Active' },
        busy: { background: 'rgba(46, 182, 125, 0.94)', dot: '#ffffff', glow: 'rgba(255,255,255,0.22)', label: 'SlackPolish Improving' },
        error: { background: 'rgba(217, 48, 37, 0.94)', dot: '#ffd7d4', glow: 'rgba(255,215,212,0.24)', label: 'SlackPolish Needs Attention' }
    };
    let fadeTimeout = null;
    let removeTimeout = null;

    function ensure() {
        if (typeof document === 'undefined' || !document.body) return null;
        let badge = document.getElementById(STATUS_BADGE_ID);
        if (badge) return badge;

        badge = document.createElement('div');
        badge.id = STATUS_BADGE_ID;
        badge.innerHTML = `
            <div id="slackpolish-runtime-status-dot"></div>
            <div id="slackpolish-runtime-status-label">SlackPolish Active</div>
        `;
        badge.style.cssText = `
            position: fixed;
            left: 20px;
            bottom: 20px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border-radius: 999px;
            background: rgba(18, 100, 163, 0.92);
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 12px;
            font-weight: 600;
            z-index: 2147483647;
            box-shadow: 0 4px 16px rgba(0,0,0,0.22);
            border: 1px solid rgba(255,255,255,0.18);
            backdrop-filter: blur(10px);
            pointer-events: none;
            transition: opacity 0.25s ease, transform 0.25s ease, background 0.25s ease;
            opacity: 0.95;
        `;
        const dot = badge.querySelector('#slackpolish-runtime-status-dot');
        dot.style.cssText = `
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #8df7c8;
            box-shadow: 0 0 0 4px rgba(141,247,200,0.18);
            flex: 0 0 auto;
        `;
        document.body.appendChild(badge);
        return badge;
    }

    function scheduleFade(removeAfterMs) {
        clearTimeout(fadeTimeout);
        clearTimeout(removeTimeout);
        fadeTimeout = setTimeout(() => {
            const badge = document.getElementById(STATUS_BADGE_ID);
            if (badge && badge.dataset.state === 'active') {
                badge.style.opacity = '0.58';
                badge.style.transform = 'translateY(2px)';
            }
        }, 5000);
        if (removeAfterMs) {
            removeTimeout = setTimeout(() => {
                const badge = document.getElementById(STATUS_BADGE_ID);
                if (badge && badge.dataset.state === 'active') {
                    badge.style.opacity = '0';
                    setTimeout(() => badge.remove(), 300);
                }
            }, removeAfterMs);
        }
    }

    /** Same contract as Slack's setStatusBadgeState(state, label). */
    function set(state, label, options) {
        const badge = ensure();
        if (!badge) return null;
        const next = STATES[state] || STATES.active;
        const dot = badge.querySelector('#slackpolish-runtime-status-dot');
        const text = badge.querySelector('#slackpolish-runtime-status-label');
        badge.dataset.state = STATES[state] ? state : 'active';
        badge.style.background = next.background;
        badge.style.opacity = '0.95';
        badge.style.transform = 'translateY(0)';
        dot.style.background = next.dot;
        dot.style.boxShadow = `0 0 0 4px ${next.glow}`;
        text.textContent = label || next.label;
        if (badge.dataset.state === 'active') {
            scheduleFade(options && options.removeAfterMs);
        } else {
            clearTimeout(fadeTimeout);
            clearTimeout(removeTimeout);
        }
        return badge;
    }

    return { STATUS_BADGE_ID, STATES, ensure, set };
});
