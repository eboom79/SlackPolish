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
    codeSpansUnchanged: () => (b, a) => ({ ok: JSON.stringify(a.codeSpans) === JSON.stringify(b.codeSpans), detail: `code spans before ${JSON.stringify(b.codeSpans)} after ${JSON.stringify(a.codeSpans)}` }),
    preBlocksUnchanged: () => (b, a) => ({ ok: JSON.stringify(a.preBlocks) === JSON.stringify(b.preBlocks), detail: `code blocks before ${JSON.stringify(b.preBlocks)} after ${JSON.stringify(a.preBlocks)}` }),
    emojiCount: () => (b, a) => ({ ok: a.counts.emoji === b.counts.emoji, detail: `emoji elements before ${b.counts.emoji} after ${a.counts.emoji}` }),
    inlineFormattingCount: () => (b, a) => ({ ok: a.counts.strong === b.counts.strong && a.counts.em === b.counts.em && a.counts.strike === b.counts.strike, detail: `strong/em/strike before ${b.counts.strong}/${b.counts.em}/${b.counts.strike} after ${a.counts.strong}/${a.counts.em}/${a.counts.strike}` }),
    listItemUnchanged: (index, text) => (b, a) => ({ ok: (a.listItems[index] || '') === text, detail: `li[${index}] = "${a.listItems[index] || ''}"` }),
    slugLabelUnchanged: (url) => (b, a) => { const x = b.slugs.find(s => s.url === url), y = a.slugs.find(s => s.url === url); return { ok: !!x && !!y && x.label === y.label, detail: x && y ? `slug label ${x.label === y.label ? 'unchanged' : 'changed'}` : 'slug missing' }; }
};

/** Preconditions on the composer state BEFORE polishing; unmet -> scenario is SKIPPED (harness/Slack issue, not SlackPolish). */
export const pre = {
    blockquotes: (n) => (b) => ({ ok: b.counts.blockquote === n, detail: `composer has ${b.counts.blockquote} blockquote(s), want ${n}` }),
    list: (type, n) => (b) => ({ ok: b.counts[type] >= 1 && b.counts.li === n, detail: `composer has ${type}=${b.counts[type]} li=${b.counts.li}, want ${n} items` }),
    mentions: (n) => (b) => ({ ok: b.counts.tsMention === n, detail: `composer has ${b.counts.tsMention} mention(s), want ${n}` }),
    anchorsOrSlugs: (n) => (b) => ({ ok: b.counts.a + b.counts.tsSlug >= n, detail: `composer has a=${b.counts.a} slugs=${b.counts.tsSlug}, want >= ${n}` }),
    code: (n) => (b) => ({ ok: b.counts.code === n, detail: `composer has ${b.counts.code} code span(s), want ${n}` }),
    pre: (n) => (b) => ({ ok: b.counts.pre === n, detail: `composer has ${b.counts.pre} code block(s), want ${n}` }),
    emoji: (n) => (b) => ({ ok: b.counts.emoji === n, detail: `composer has ${b.counts.emoji} emoji element(s), want ${n}` })
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
            { type: 'html', html: '<p>keep this prat <a href="https://example.com/kee" rel="noopener noreferrer" target="_blank">https://example.com/kee</a>p untuched. plz fix this seccond part</p>' },
            { type: 'select', text: 'plz fix this seccond part' }
        ],
        invariants: [checks.textUnchanged('keep this prat https://example.com/keep untuched.'), checks.anchorsPreserved()],
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
        precondition: pre.blockquotes(1),
        invariants: [checks.blockquoteCount(1), checks.minBlocks(2), checks.paragraphs(1), checks.quoteTextUnchanged()],
        expectations: [checks.textChanged()]
    },
    {
        id: 'quote-two-lines-then-reply',
        title: 'Two quoted lines (with typos) stay verbatim while the reply is polished',
        steps: [
            { type: 'type', text: '> can u ship it by fri??' }, { type: 'newline' },
            { type: 'type', text: 'and dont forget the relase notes' }, { type: 'newline' }, { type: 'backspace' },
            { type: 'type', text: 'yes we r on track, will send eod' }
        ],
        precondition: pre.blockquotes(2),
        invariants: [checks.blockquoteCount(2), checks.paragraphs(1), checks.quoteTextUnchanged()],
        expectations: [checks.textChanged()]
    },
    {
        id: 'quote-with-mention-and-link',
        title: 'A quote containing an @mention and a link stays verbatim (no duplicated entities)',
        steps: [
            { type: 'type', text: '> ' }, { type: 'mention', query: '@eyal boum', labelIncludes: 'eyal' },
            { type: 'type', text: ' asked: pls check https://redis.io/docs/latest/ today', delayMs: 35 },
            { type: 'newline' }, { type: 'backspace' },
            { type: 'type', text: 'sure, i will do it now' }
        ],
        precondition: (b) => ({ ok: b.counts.blockquote === 1 && b.counts.tsMention === 1 && b.counts.a === 1, detail: `blockquote=${b.counts.blockquote} mention=${b.counts.tsMention} a=${b.counts.a}, want 1/1/1` }),
        invariants: [checks.blockquoteCount(1), checks.paragraphs(1), checks.quoteTextUnchanged(), checks.mentionsPreserved(), checks.anchorsPreserved(), checks.urlsPreserved(['https://redis.io/docs/latest/'])],
        expectations: [checks.textChanged()]
    },
    {
        id: 'numbered-list',
        title: 'Numbered list keeps all its items',
        steps: [{ type: 'type', text: 'todo for the release:' }, { type: 'newline' }, { type: 'type', text: '1. finish the tests' }, { type: 'newline' }, { type: 'type', text: 'cut the release' }, { type: 'newline' }, { type: 'type', text: 'anounce in the channel' }],
        precondition: pre.list('ol', 3),
        invariants: [checks.listItems('ol', 3)],
        expectations: [checks.keywords(['tests', 'release', 'channel'])]
    },
    {
        id: 'bullet-list',
        title: 'Bullet list keeps all its items',
        steps: [{ type: 'type', text: '- update the docs' }, { type: 'newline' }, { type: 'type', text: 'ping dana about the demo' }],
        precondition: pre.list('ul', 2),
        invariants: [checks.listItems('ul', 2)],
        expectations: []
    },
    {
        id: 'mention',
        title: '@mention survives (autocomplete accepted with Tab)',
        steps: [
            { type: 'mention', query: '@eyal boum', labelIncludes: 'eyal' },
            { type: 'type', text: ' can you take a look at this pls' }
        ],
        precondition: pre.mentions(1),
        invariants: [checks.mentionsPreserved()],
        expectations: [checks.textChanged()]
    },
    {
        id: 'selection-partial',
        title: 'Only the selected sentence is polished; the rest is untouched',
        steps: [
            // the untouched part deliberately contains typos: a whole-message polish would "fix" them and fail this test
            { type: 'type', text: 'frist sentence stays exaclty as is. secnd sentence has typos and shoud be fixed.' },
            { type: 'select', text: 'secnd sentence has typos and shoud be fixed.' }
        ],
        invariants: [checks.textUnchanged('frist sentence stays exaclty as is.')],
        expectations: [checks.textChanged()]
    },
    {
        id: 'selection-keeps-link-outside',
        title: 'Selection polish leaves a URL outside the selection untouched',
        steps: [
            { type: 'type', text: 'keep this prat https://example.com/keep untuched. plz fix this seccond part', delayMs: 35 },
            { type: 'select', text: 'plz fix this seccond part' }
        ],
        invariants: [checks.textUnchanged('keep this prat https://example.com/keep untuched.'), checks.urlsPreserved(['https://example.com/keep'])],
        expectations: [checks.textChanged()]
    },
    {
        id: 'greeting-multiline',
        title: 'Standalone greeting line and paragraph structure',
        steps: [{ type: 'type', text: 'Hi Dana' }, { type: 'newline' }, { type: 'type', text: 'the report is redy, i attached it to the ticket' }],
        invariants: [checks.minBlocks(2)],
        expectations: [checks.firstBlockEquals('Hi Dana'), checks.blockCountUnchanged()]
    },
    // ---------------- Phase B: constructs not covered before ----------------
    {
        id: 'inline-code',
        title: 'Inline code (`npm test`) stays verbatim and stays code',
        steps: [{ type: 'type', text: 'pls run `npm test` before pushing, and check `SLACK_TOKEN` is set' }],
        precondition: pre.code(2),
        invariants: [checks.codeSpansUnchanged()],
        expectations: [checks.textChanged()]
    },
    {
        id: 'code-block',
        title: 'Code block (```) content stays verbatim',
        steps: [{ type: 'type', text: '```' }, { type: 'waitFor', what: 'code block', js: `ed.querySelector('pre, .ql-code-block')`, timeoutMs: 1500, optional: true }, { type: 'type', text: 'npm run build && npm test' }],
        precondition: pre.pre(1),
        expectNoop: true, // only code: SlackPolish must refuse ("Nothing to polish") and leave it untouched
        invariants: [checks.preBlocksUnchanged()],
        expectations: []
    },
    {
        id: 'code-block-with-prose',
        title: 'Prose around a code block is polished; the code block stays verbatim and block-level',
        steps: [{ type: 'type', text: 'pls run this befor pushing:' }, { type: 'newline' }, { type: 'type', text: '```' }, { type: 'waitFor', what: 'code block', js: `ed.querySelector('pre, .ql-code-block')`, timeoutMs: 1500, optional: true }, { type: 'type', text: 'npm run build && npm test' }],
        precondition: (b) => ({ ok: b.counts.pre === 1 && b.counts.p >= 1, detail: `code blocks=${b.counts.pre} paragraphs=${b.counts.p}` }),
        invariants: [checks.preBlocksUnchanged(), (b, a) => ({ ok: a.counts.pre === 1 && a.counts.p >= 1, detail: `after: code blocks=${a.counts.pre} paragraphs=${a.counts.p}` })],
        expectations: [checks.textChanged()]
    },
    {
        id: 'emoji-shortcode',
        title: 'Emoji typed as :tada: survives polishing',
        steps: [{ type: 'type', text: 'great work on the release :tada: thanks everyone' }],
        precondition: pre.emoji(1),
        invariants: [checks.emojiCount()],
        expectations: [checks.textChanged()]
    },
    {
        id: 'channel-mention',
        title: '#channel pill survives polishing',
        steps: [
            { type: 'type', text: 'lets move this to ' }, { type: 'mention', query: '#gen', labelIncludes: '#' }, { type: 'type', text: ' pls' }
        ],
        precondition: pre.mentions(1),
        invariants: [checks.mentionsPreserved()],
        expectations: [checks.textChanged()]
    },
    {
        id: 'here-mention',
        title: '@here special mention survives polishing (channel-only: Slack does not offer @here in a DM, so this skips there)',
        steps: [
            { type: 'mention', query: '@here', labelIncludes: 'here' }, { type: 'type', text: ' quick heads up, deploy starts in 10 min' }
        ],
        precondition: pre.mentions(1),
        invariants: [checks.mentionsPreserved()],
        expectations: [checks.textChanged()]
    },
    {
        id: 'hebrew-with-link',
        title: 'Hebrew text with a link: link byte-identical, text polished',
        steps: [{ type: 'type', text: 'תבדקו בבקשה את המסמך https://docs.google.com/document/d/abc123/edit לפני הפגישה מחר', delayMs: 20 }],
        invariants: [checks.urlsPreserved(['https://docs.google.com/document/d/abc123/edit'])],
        expectations: [checks.textChanged()]
    },
    {
        id: 'blank-line-between-paragraphs',
        title: 'Blank line between paragraphs (structure)',
        steps: [{ type: 'type', text: 'first paragraph is here' }, { type: 'newline' }, { type: 'newline' }, { type: 'type', text: 'second paragraph is here' }],
        invariants: [checks.minBlocks(3), checks.blockCountUnchanged()],
        expectations: []
    },
    {
        id: 'link-only-message',
        title: 'A message that is only a link is left alone (no API call)',
        steps: [{ type: 'type', text: 'https://redis.io/docs/latest/develop/', delayMs: 30 }],
        expectNoop: true,
        invariants: [checks.urlsPreserved(['https://redis.io/docs/latest/develop/'])],
        expectations: []
    },
    {
        id: 'bold-italic',
        title: 'Bold/italic formatting (reported, not enforced)',
        steps: [{ type: 'type', text: 'this is *very important* and _somewhat urgent_ pls read' }],
        invariants: [],
        expectations: [checks.inlineFormattingCount(), checks.textChanged()] // formatting re-applies only if the model keeps the phrases; reported, not enforced
    },
    {
        id: 'selection-in-list-item',
        title: 'Selecting text inside a list item polishes only that item',
        steps: [
            { type: 'type', text: '1. frist item stays exaclty' }, { type: 'newline' }, { type: 'type', text: 'secnd item has a typpo' },
            { type: 'select', text: 'secnd item has a typpo' }
        ],
        precondition: pre.list('ol', 2),
        invariants: [checks.listItems('ol', 2), checks.listItemUnchanged(0, 'frist item stays exaclty')],
        expectations: [checks.textChanged()]
    },
    {
        id: 'double-polish',
        title: 'Polishing twice keeps quote, link and list intact (idempotent structure)',
        steps: [
            { type: 'type', text: '> can u ship it by fri??' }, { type: 'newline' }, { type: 'backspace' },
            { type: 'type', text: 'yes, see https://redis.io/docs/latest/ for detials', delayMs: 35 }, { type: 'newline' },
            { type: 'type', text: '1. finish tests' }, { type: 'newline' }, { type: 'type', text: 'cut relase' },
            { type: 'polish' }
        ],
        precondition: (b) => ({ ok: b.counts.blockquote === 1 && b.counts.li === 2 && (b.counts.a + b.counts.tsSlug) >= 1, detail: `blockquote=${b.counts.blockquote} li=${b.counts.li} links=${b.counts.a + b.counts.tsSlug}` }),
        invariants: [checks.blockquoteCount(1), checks.listItems('ol', 2), checks.quoteTextUnchanged(), checks.urlsPreserved(['https://redis.io/docs/latest/'])],
        expectations: []
    }
];
