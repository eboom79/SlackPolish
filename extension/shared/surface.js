/**
 * Classify the page the hotkey was pressed on.
 *   atlassian  - Jira / Confluence (Atlassian Cloud hosts, or a self-hosted Jira identified by its application-name meta)
 *   slack-web  - Slack in the browser
 *   other      - anything else
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.SlackPolishSurface = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function hostMatches(hostname, domain) {
        return hostname === domain || hostname.endsWith('.' + domain);
    }

    function classify(hostname, hints) {
        const host = String(hostname || '').toLowerCase();
        const appName = String((hints && hints.appName) || '').toLowerCase();
        if (hostMatches(host, 'atlassian.net') || hostMatches(host, 'atlassian.com') || hostMatches(host, 'jira.com') || appName.includes('jira') || appName.includes('confluence')) {
            return 'atlassian';
        }
        if (hostMatches(host, 'slack.com')) {
            return 'slack-web';
        }
        return 'other';
    }

    return { classify };
});
