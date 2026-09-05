/**
 * Live Slack scenarios: what to put in the composer, and what MUST still be true
 * after SlackPolish polishes it.
 *
 *  steps        – composer actions (type / newline / paste / waitFor / tab / select)
 *  invariants   – hard checks; any failure fails the scenario
 *  expectations – soft checks; reported but never fail the run (LLM wording varies)
 *
 * Every scenario also gets the global invariants: polish completed without error,
 * output not empty, no __SLACKPOLISH_ token leaked, and no message was sent.
 */

const JIRA_URL = 'https://redislabs.atlassian.net/browse/RED-212916';

// ---- check helpers: (before, after, ctx) => { ok, detail } -------------------
const once = (haystack, needle) => haystack.split(needle).length - 1;

export const checks = {
    urlsPreserved: (urls) => (b, a) => {
        const missing = urls.filter(u => once(a.text, u) !== 1);
        return { ok: missing.length === 0, detail: missing.length ? `not exactly once in output: ${missing.join(', ')}` : `${urls.length} URL(s) byte-identical` };
    },
    /** Whatever Slack made of the pasted URL (slug pill, anchor, or plain text) must survive intact. */
    linkLikePreserved: (url) => (b, a) => {
        if (b.slugs.some(s => s.url === url)) {
            const after = a.slugs.filter(s => s.url === url);
            return { ok: after.length === 1, detail: after.length === 1 ? `slug pill intact (${after[0].resolved ? 'resolved' : 'unresolved'}: "${after[0].label.slice(0, 40)}…")` : `slug pill count after = ${after.length}` };
        }
        if (b.anchors.some(x => x.href === url)) {
            return { ok: a.anchors.filter(x => x.href === url).length === 1, detail: 'anchor intact' };
        }
        return { ok: once(a.text, url) === 1, detail: 'plain URL text intact' };
    },
    anchorsPreserved: () => (b, a) => {
        const want = b.anchors.map(x => x.href).sort().join('|'), got = a.anchors.map(x => x.href).sort().join('|');
        return { ok: want === got, detail: want === got ? `${b.anchors.length} anchor(s) intact` : `hrefs before [${want}] after [${got}]` };
    },
    mentionsPreserved: () => (b, a) => {
        const want = b.mentions.map(m => m.id + ':' + m.text).join('|'), got = a.mentions.map(m => m.id + ':' + m.text).join('|');
        return { ok: want === got, detail: want === got ? `${b.mentions.length} mention(s) intact` : `before [${want}] after [${got}]` };
    },
    blockquoteCount: (n) => (b, a) => ({ ok: a.counts.blockquote === n, detail: `blockquotes: ${a.counts.blockquote} (want ${n})` }),
    listItems: (type, n) => (b, a) => ({ ok: a.counts[type] >= 1 && a.counts.li === n, detail: `${type}: ${a.counts[type]}, li: ${a.counts.li} (want ${n})` }),
    paragraphs: (n) => (b, a) => ({ ok: a.counts.p >= n, detail: `paragraphs: ${a.counts.p} (want >= ${n})` }),
    minBlocks: (n) => (b, a) => ({ ok: a.lines.length >= n, detail: `top-level blocks: ${a.lines.length} (want >= ${n})` }),
    textUnchanged: (fragment) => (b, a) => ({ ok: a.text.includes(fragment), detail: a.text.includes(fragment) ? 'untouched text intact' : `missing: "${fragment}"` }),
    noSemicolonsOutsideUrls: () => (b, a) => {
        let t = a.text; for (const u of a.urlsInText) t = t.split(u).join('');
        return { ok: !t.includes(';'), detail: t.includes(';') ? 'semicolon left in prose' : 'no semicolons in prose' };
    },
    // soft
    textChanged: () => (b, a) => ({ ok: a.text.trim() !== b.text.trim(), detail: a.text.trim() !== b.text.trim() ? 'text was polished' : 'text unchanged' }),
    keywords: (words) => (b, a) => { const miss = words.filter(w => !a.text.toLowerCase().includes(w.toLowerCase())); return { ok: !miss.length, detail: miss.length ? `missing keywords: ${miss.join(', ')}` : 'keywords present' }; },
    firstBlockEquals: (s) => (b, a) => ({ ok: (a.lines[0] || '').trim() === s, detail: `first block: "${(a.lines[0] || '').trim()}"` }),
    quoteTextUnchanged: () => (b, a) => ({ ok: JSON.stringify(a.blockquotes) === JSON.stringify(b.blockquotes), detail: `quotes before ${JSON.stringify(b.blockquotes)} after ${JSON.stringify(a.blockquotes)}` }),
    blockCountUnchanged: () => (b, a) => ({ ok: a.lines.length === b.lines.length, detail: `blocks before ${b.lines.length} after ${a.lines.length}` }),
    slugLabelUnchanged: (url) => (b, a) => { const x = b.slugs.find(s => s.url === url), y = a.slugs.find(s => s.url === url); return { ok: !!x && !!y && x.label === y.label, detail: x && y ? `slug label ${x.label === y.label ? 'unchanged' : 'changed'}` : 'slug missing' }; }
};

export const scenarios = [
    {
        id: 'split-anchor-full',
        title: 'Anchor truncated by Slack mid-typing (stray char after link) is preserved byte-identical',
        // Exact DOM observed in Slack after fast typing: the link ends one char early and the last char is plain text.
        steps: [{ type: 'html', html: '<p>keep this part <a href="https://example.com/kee" rel="noopener noreferrer" target="_blank">https://example.com/kee</a>p untouched. plz fix this seccond part</p>' }],
        invariants: [checks.textUnchanged('https://example.com/keep untouched'), checks.anchorsPreserved()],
        expectations: [checks.textChanged()]
    },
    {
        id: 'split-anchor-selection',
        title: 'Selection polish keeps a truncated anchor + stray char outside the selection intact',
        steps: [
            { type: 'html', html: '<p>keep this part <a href="https://example.com/kee" rel="noopener noreferrer" target="_blank">https://example.com/kee</a>p untouched. plz fix this seccond part</p>' },
            { type: 'select', text: 'plz fix this seccond part' }
        ],
        invariants: [checks.textUnchanged('keep this part https://example.com/keep untouched.'), checks.anchorsPreserved()],
        expectations: [checks.textChanged()]
    },
    {
        id: 'pasted-url-slug',
        title: 'Pasted web URL (Slack turns it into a link pill) survives',
        steps: [{ type: 'type', text: 'see ' }, { type: 'paste', text: 'https://developer.mozilla.org/en-US/docs/Web/API/Range/cloneContents' }, { type: 'waitFor', what: 'slug', js: `ed.querySelector('ts-slug')`, timeoutMs: 8000, optional: true }, { type: 'type', text: ' for the details pls' }],
        invariants: [checks.linkLikePreserved('https://developer.mozilla.org/en-US/docs/Web/API/Range/cloneContents')],
        expectations: [checks.textChanged()]
    },
    {
        id: 'plain-typos',
        title: 'Plain sentence with typos is polished',
        steps: [{ type: 'type', text: 'i think we shoud ship the operator release on friday, wat do you think' }],
        invariants: [],
        expectations: [checks.textChanged(), checks.keywords(['friday', 'operator'])]
    },
    {
        id: 'bare-web-url',
        title: 'Bare web URL stays byte-identical',
        steps: [{ type: 'type', text: 'please read https://developer.mozilla.org/en-US/docs/Web/API/Range/cloneContents before the review', delayMs: 35 }],
        invariants: [checks.urlsPreserved(['https://developer.mozilla.org/en-US/docs/Web/API/Range/cloneContents'])],
        expectations: [checks.textChanged()]
    },
    {
        id: 'gdoc-url-query-hash',
        title: 'Google Doc URL with query string and fragment stays intact',
        steps: [{ type: 'type', text: 'spec is here https://docs.google.com/document/d/1AbC_dEf-GhI/edit?usp=sharing#heading=h.2x1 pls comment by eod', delayMs: 35 }],
        invariants: [checks.urlsPreserved(['https://docs.google.com/document/d/1AbC_dEf-GhI/edit?usp=sharing#heading=h.2x1'])],
        expectations: [checks.textChanged()]
    },
    {
        id: 'jira-slug-pill',
        title: 'Pasted Jira link (resolved by Slack into a rich-link pill) survives',
        steps: [
            { type: 'type', text: 'now lets check jira tickets ' },
            { type: 'paste', text: JIRA_URL },
            { type: 'waitFor', what: 'slug resolved', js: `ed.querySelector('ts-slug.c-slackslug--resolved')`, timeoutMs: 15000, optional: true },
            { type: 'type', text: ' I wonder if it keeps it.' }
        ],
        invariants: [checks.linkLikePreserved(JIRA_URL)],
        expectations: [checks.textChanged(), checks.slugLabelUnchanged(JIRA_URL)]
    },
    {
        id: 'two-urls-punctuation',
        title: 'Two URLs next to sentence punctuation stay intact',
        steps: [{ type: 'type', text: 'compare https://redis.io/docs/latest/ (new) with https://redis.io/docs/6.2/, thanks!', delayMs: 35 }],
        invariants: [checks.urlsPreserved(['https://redis.io/docs/latest/', 'https://redis.io/docs/6.2/'])],
        expectations: []
    },
    {
        id: 'url-with-semicolon',
        title: 'URL containing semicolons is not rewritten by the ";" rule',
        steps: [{ type: 'type', text: 'legacy link https://a.example.com/path;jsessionid=ABC123;x=1 still works; please dont remove it', delayMs: 35 }],
        invariants: [checks.urlsPreserved(['https://a.example.com/path;jsessionid=ABC123;x=1']), checks.noSemicolonsOutsideUrls()],
        expectations: []
    },
    {
        id: 'quote-and-reply',
        title: 'Quoted line (>) keeps its quote bar; reply stays on its own line',
        // Slack continues the quote on Shift+Enter; Backspace on the empty quote line exits it (like lists)
        steps: [{ type: 'type', text: '> can you ship by friday?' }, { type: 'newline' }, { type: 'backspace' }, { type: 'type', text: 'yes we are on track, will send eod' }],
        invariants: [checks.blockquoteCount(1), checks.minBlocks(2), checks.paragraphs(1)],
        expectations: [checks.quoteTextUnchanged()]
    },
    {
        id: 'numbered-list',
        title: 'Numbered list keeps all its items',
        steps: [{ type: 'type', text: 'todo for the release:' }, { type: 'newline' }, { type: 'type', text: '1. finish the tests' }, { type: 'newline' }, { type: 'type', text: 'cut the release' }, { type: 'newline' }, { type: 'type', text: 'anounce in the channel' }],
        invariants: [checks.listItems('ol', 3)],
        expectations: [checks.keywords(['tests', 'release', 'channel'])]
    },
    {
        id: 'bullet-list',
        title: 'Bullet list keeps all its items',
        steps: [{ type: 'type', text: '- update the docs' }, { type: 'newline' }, { type: 'type', text: 'ping dana about the demo' }],
        invariants: [checks.listItems('ul', 2)],
        expectations: []
    },
    {
        id: 'mention',
        title: '@mention survives (autocomplete accepted with Tab)',
        steps: [
            { type: 'type', text: '@eyal boum' },
            { type: 'waitFor', what: 'autocomplete', js: `document.querySelector('[data-qa*="autocomplete"], .c-tabcomplete, [role="listbox"]')`, timeoutMs: 4000, optional: true },
            { type: 'tab' },
            { type: 'waitFor', what: 'mention', js: `ed.querySelector('ts-mention')`, timeoutMs: 2000, optional: true },
            { type: 'type', text: ' can you take a look at this pls' },
            { type: 'require', what: 'ts-mention in composer', js: `ed.querySelector('ts-mention')` }
        ],
        invariants: [checks.mentionsPreserved()],
        expectations: [checks.textChanged()]
    },
    {
        id: 'selection-partial',
        title: 'Only the selected sentence is polished; the rest is untouched',
        steps: [
            { type: 'type', text: 'first sentence stays exactly as is. secnd sentence has typos and shoud be fixed.' },
            { type: 'select', text: 'secnd sentence has typos and shoud be fixed.' }
        ],
        invariants: [checks.textUnchanged('first sentence stays exactly as is.')],
        expectations: [checks.textChanged()]
    },
    {
        id: 'selection-keeps-link-outside',
        title: 'Selection polish leaves a URL outside the selection untouched',
        steps: [
            { type: 'type', text: 'keep this part https://example.com/keep untouched. plz fix this seccond part', delayMs: 35 },
            { type: 'select', text: 'plz fix this seccond part' }
        ],
        invariants: [checks.textUnchanged('keep this part https://example.com/keep untouched.'), checks.urlsPreserved(['https://example.com/keep'])],
        expectations: [checks.textChanged()]
    },
    {
        id: 'greeting-multiline',
        title: 'Standalone greeting line and paragraph structure',
        steps: [{ type: 'type', text: 'Hi Dana' }, { type: 'newline' }, { type: 'type', text: 'the report is redy, i attached it to the ticket' }],
        invariants: [checks.minBlocks(2)],
        expectations: [checks.firstBlockEquals('Hi Dana'), checks.blockCountUnchanged()]
    }
];
