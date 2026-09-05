#!/usr/bin/env node

/**
 * Chrome extension polishing core: one source of truth with Slack (vendored slack-config.js), prompt parity,
 * repair of model output (dropped/echoed tokens, rewritten quotes), verification and wiring.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repo = path.join(__dirname, '../..');
const ext = path.join(repo, 'extension');
const manifest = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8'));
const slackScript = fs.readFileSync(path.join(repo, 'slack-text-improver.js'), 'utf8');
const coreSource = fs.readFileSync(path.join(ext, 'shared/polish-core.js'), 'utf8');
const contentSource = fs.readFileSync(path.join(ext, 'content/hotkey-logger.js'), 'utf8');
const backgroundSource = fs.readFileSync(path.join(ext, 'background.js'), 'utf8');
const popupSource = fs.readFileSync(path.join(ext, 'popup/popup.js'), 'utf8');
const popupHtml = fs.readFileSync(path.join(ext, 'popup/popup.html'), 'utf8');

// Load the vendored config the way the page does (it assigns window.SLACKPOLISH_CONFIG)
const ctx = { window: {}, console };
vm.runInNewContext(fs.readFileSync(path.join(ext, 'vendor/slack-config.js'), 'utf8'), ctx);
globalThis.window = ctx.window;
const CONFIG = ctx.window.SLACKPOLISH_CONFIG;
const Core = require(path.join(ext, 'shared/polish-core.js'));

let testsPassed = 0, testsTotal = 0;
function runTest(name, fn) { testsTotal++; try { console.log(`🧪 Testing: ${name}`); fn(); testsPassed++; console.log(`✅ PASSED: ${name}`); } catch (e) { console.log(`❌ FAILED: ${name}`); console.log(`   Error: ${e.message}`); } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

console.log('🚀 Running Chrome Extension Polish Core Tests');
console.log('=============================================\n');

runTest('Vendored slack-config.js is byte-identical to the root config (single source of truth)', () => {
    const a = fs.readFileSync(path.join(repo, 'slack-config.js'));
    const b = fs.readFileSync(path.join(ext, 'vendor/slack-config.js'));
    assert(a.equals(b), 'extension/vendor/slack-config.js differs from slack-config.js (run increment-version.py or copy it)');
    assert(CONFIG && CONFIG.PROMPTS && CONFIG.PROMPTS.STYLES && CONFIG.AVAILABLE_STYLES && CONFIG.SUPPORTED_LANGUAGES, 'config exposes prompts/styles/languages');
    assert(Object.keys(CONFIG.PROMPTS.STYLES).sort().join() === Object.keys(CONFIG.AVAILABLE_STYLES).sort().join(), 'every available style has a prompt');
});

runTest('Manifest: config first, core before the content script, OpenAI host permission, no broad permissions', () => {
    const js = manifest.content_scripts[0].js;
    assert(js[0] === 'vendor/slack-config.js', `config must load first: ${js[0]}`);
    assert(js.indexOf('shared/polish-core.js') > js.indexOf('shared/atlassian-adapter.js') && js.indexOf('shared/polish-core.js') < js.indexOf('content/hotkey-logger.js'), 'polish-core between adapter and content script');
    assert(manifest.host_permissions.includes('https://api.openai.com/*'), 'api.openai.com host permission');
    assert(JSON.stringify(manifest.permissions) === JSON.stringify(['storage', 'alarms']), `permissions: storage + alarms (sync link keep-alive) only: ${JSON.stringify(manifest.permissions)}`);
    assert(fs.existsSync(path.join(ext, 'vendor/slack-config.js')) && fs.existsSync(path.join(ext, 'shared/polish-core.js')), 'files exist');
});

runTest('Prompt: uses the shared style text verbatim, the Slack markers and the Slack IMPORTANT rules', () => {
    const prompt = Core.buildPrompt({ text: 'pls check', style: 'TONE_POLISH', language: 'English', entities: [] });
    assert(prompt.includes(CONFIG.PROMPTS.STYLES.TONE_POLISH), 'style prompt from the shared config');
    assert(prompt.includes('=== MESSAGE TO IMPROVE (improve ONLY the text between these markers) ===\npls check\n=== END OF MESSAGE TO IMPROVE ==='), 'message markers as in Slack');
    ['Respond with ONLY the improved version of the MESSAGE TO IMPROVE above', 'Preserve the line structure: keep each line that starts with a quote marker (">") or a list marker', 'identifiers such as issue keys (e.g. RED-1234, PROJ-42) exactly as written']
        .forEach(s => { assert(prompt.includes(s), `prompt has: ${s}`); assert(slackScript.includes(s), `Slack script has the same sentence: ${s}`); });
    assert(prompt.includes('Use English language.') && slackScript.includes('Use ${CONFIG.LANGUAGE} language.'), 'language sentence as in Slack');
    assert(!prompt.includes('__SLACKPOLISH_MENTION_1__'), 'no token instruction when the message has no tokens');
    assert(!prompt.includes('quotations'), 'no quote instruction without quotes');
    assert(prompt.includes('Jira/Confluence'), 'Jira framing (Smart Context is Slack-only)');
    const withTitle = Core.buildPrompt({ text: 'x', style: 'GRAMMAR', language: 'Hebrew', entities: [], context: { issueTitle: '[RED-1] Replication aborts' } });
    assert(withTitle.includes('[RED-1] Replication aborts') && withTitle.includes('Do not reproduce or paraphrase this title') && withTitle.includes('Use Hebrew language.'), 'issue title as reference-only context, language honoured');
    const personal = Core.buildPrompt({ text: 'x', style: 'CASUAL', language: 'English', entities: [], customInstructions: "Use 'Hi' not 'Hey'" });
    assert(personal.endsWith("- Additional instructions: Use 'Hi' not 'Hey'") && slackScript.includes('- Additional instructions: ${CONFIG.CUSTOM_INSTRUCTIONS}'), 'personal polish appended exactly like the Slack script');
    assert(!Core.buildPrompt({ text: 'x', style: 'CASUAL', language: 'English', entities: [], customInstructions: '  ' }).includes('Additional instructions'), 'blank personal polish adds nothing');
});

const entities = [
    { token: '__SLACKPOLISH_MENTION_1__', kind: 'MENTION', text: '@Dana', html: '<span data-mention-id="1">@Dana</span>' },
    { token: '__SLACKPOLISH_CODE_1__', kind: 'CODE', text: 'relase', html: '<code>relase</code>' },
    { token: '__SLACKPOLISH_LINK_1__', kind: 'LINK', text: 'the docs', href: 'https://redis.io/docs/', html: '<a href="https://redis.io/docs/">the docs</a>' },
    { token: '__SLACKPOLISH_QUOTE_1__', kind: 'QUOTE', text: 'can u ship __SLACKPOLISH_EMOJI_1__ by fri??', html: 'can u ship <span data-emoji-short-name=":tada:"></span> by fri??' },
    { token: '__SLACKPOLISH_EMOJI_1__', kind: 'EMOJI', text: ':tada:', html: '<span data-emoji-short-name=":tada:"></span>' }
];
const body = 'hello __SLACKPOLISH_MENTION_1__ pls check the __SLACKPOLISH_CODE_1__ job\nsee __SLACKPOLISH_LINK_1__ today\n> __SLACKPOLISH_QUOTE_1__\n• item one';

runTest('Prompt: token instruction only for body tokens, quote instruction with detokenized context', () => {
    const prompt = Core.buildPrompt({ text: body, style: 'PROFESSIONAL', language: 'English', entities });
    assert(prompt.includes('represent real entities such as mentions and links, inline code and emoji') && prompt.includes('Never add a token that is not already in the message.'), 'token instruction');
    assert(prompt.includes('Return every such line exactly as "> __SLACKPOLISH_QUOTE_n__"'), 'quote instruction');
    assert(prompt.includes('__SLACKPOLISH_QUOTE_1__: "can u ship :tada: by fri??"'), `quote context detokenized (emoji inside quote): ${prompt.split('\n').pop()}`);
    assert(slackScript.includes('Never add a token that is not already in the message.') && slackScript.includes('Return every such line exactly as "> __SLACKPOLISH_QUOTE_n__"'), 'same sentences as the Slack script');
});

runTest('Repair: faithful output is returned as-is (quotes/quotation marks aside)', () => {
    const out = 'Hello __SLACKPOLISH_MENTION_1__, please check the __SLACKPOLISH_CODE_1__ job.\nSee __SLACKPOLISH_LINK_1__ today.\n> __SLACKPOLISH_QUOTE_1__\n• Item one';
    const r = Core.repairModelOutput(`"${out}"`, body, entities);
    assert(r.text === out, `unchanged: ${JSON.stringify(r.text)}`);
    assert(!r.removed.length && !r.reanchored.length && !r.appended.length && !r.substituted.length, 'no repairs');
});

runTest('Repair: a dropped mention is re-anchored on its text (whole word) and a dropped link on its href', () => {
    const r = Core.repairModelOutput('Hello @Dana, please check the __SLACKPOLISH_CODE_1__ job.\nSee https://redis.io/docs/ today.\n> __SLACKPOLISH_QUOTE_1__\n• Item one', body, entities);
    assert(r.text.startsWith('Hello __SLACKPOLISH_MENTION_1__, please'), `mention re-anchored: ${r.text.split('\n')[0]}`);
    assert(r.text.includes('See __SLACKPOLISH_LINK_1__ today.'), `link re-anchored on href: ${r.text.split('\n')[1]}`);
    assert(r.reanchored.join() === '__SLACKPOLISH_MENTION_1__,__SLACKPOLISH_LINK_1__', `reanchored list: ${r.reanchored}`);
});

runTest('Repair: a dropped token with no anchor is appended; a rewritten quote line gets its token back', () => {
    const r = Core.repairModelOutput('Hello, please check the __SLACKPOLISH_CODE_1__ job.\nSee __SLACKPOLISH_LINK_1__ today.\n> Can you ship it by Friday?\n• Item one', body, entities);
    const lines = r.text.split('\n');
    assert(lines[2] === '> __SLACKPOLISH_QUOTE_1__', `quote line substituted: ${lines[2]}`);
    assert(!r.text.includes('Can you ship'), 'the rewritten quote is gone (verbatim quote wins)');
    assert(r.text.endsWith('• Item one __SLACKPOLISH_MENTION_1__'), `mention appended at the end: ${lines[lines.length - 1]}`);
    assert(r.substituted.join() === '__SLACKPOLISH_QUOTE_1__' && r.appended.join() === '__SLACKPOLISH_MENTION_1__', `repairs: ${JSON.stringify({ s: r.substituted, a: r.appended })}`);
});

runTest('Repair: a missing quote with no quote line left is put back on top; nested tokens count as present', () => {
    const r = Core.repairModelOutput('Hello __SLACKPOLISH_MENTION_1__, please check the __SLACKPOLISH_CODE_1__ job. See __SLACKPOLISH_LINK_1__ today.', body, entities);
    assert(r.text.startsWith('> __SLACKPOLISH_QUOTE_1__\nHello'), `quote prepended: ${r.text}`);
    assert(!r.text.includes('__SLACKPOLISH_EMOJI_1__'), 'emoji lives inside the quote: not appended separately');
});

runTest('Repair: a token echoed from the quote context that never was in the body is stripped', () => {
    const r = Core.repairModelOutput('Hello __SLACKPOLISH_MENTION_1__ __SLACKPOLISH_EMOJI_1__, please check the __SLACKPOLISH_CODE_1__ job.\nSee __SLACKPOLISH_LINK_1__ today.\n> __SLACKPOLISH_QUOTE_1__\n• Item one', body, entities);
    assert(r.text.startsWith('Hello __SLACKPOLISH_MENTION_1__, please'), `echoed emoji removed cleanly: ${r.text.split('\n')[0]}`);
    assert(r.removed.join() === '__SLACKPOLISH_EMOJI_1__', 'reported as removed');
});

runTest('Verification, polishable guard and line counting', () => {
    const before = [{ kind: 'MENTION' }, { kind: 'LINK' }, { kind: 'QUOTE' }];
    assert(Core.verifyEntities(before, [{ kind: 'MENTION' }, { kind: 'LINK' }, { kind: 'QUOTE' }]).ok, 'same kinds -> ok');
    const lost = Core.verifyEntities(before, [{ kind: 'MENTION' }, { kind: 'QUOTE' }]);
    assert(!lost.ok && lost.lost.join() === 'LINK: 1 -> 0', `lost link reported: ${lost.lost}`);
    assert(!Core.isPolishable('__SLACKPOLISH_LINK_1__ https://x.y/z\n> ') && Core.isPolishable('see __SLACKPOLISH_LINK_1__') && Core.isPolishable('שלום'), 'polishable guard');
    assert(Core.countContentLines('a\n\n> b\n• c\n') === 3, 'content lines');
    assert(Core.detokenize('> __SLACKPOLISH_QUOTE_1__', entities) === '> can u ship :tada: by fri??', 'detokenize recurses into quotes');
});

runTest('Wiring: content script polishes via the worker with settings, selection support, guards and verification', () => {
    ['improveHotkey', 'personalPolish', 'slackpolish-polish', 'SlackPolishCore', 'buildPrompt(', 'repairModelOutput', 'verifyEntities', 'extractFragment', 'nothing-to-polish', 'countContentLines', "keepSelection: !!range", 'SlackPolish Needs API Key'].forEach(s => assert(contentSource.includes(s), `content script has: ${s}`));
    ['/chat/completions', 'Authorization: `Bearer ${apiKey}`', 'settings.apiKey', "message.type === 'slackpolish-polish'", 'apiBase', "message.type === 'slackpolish-save-settings'", "message.type === 'slackpolish-sync-status'", 'DEFAULT_SYNC_URL'].forEach(s => assert(backgroundSource.includes(s), `worker has: ${s}`));
    ['AVAILABLE_STYLES', 'SUPPORTED_LANGUAGES', "getElementById('api-key-input')", "getElementById('sync-with-slack')", "type: 'slackpolish-save-settings'"].forEach(s => assert(popupSource.includes(s), `popup has: ${s}`));
    assert(popupHtml.indexOf('../vendor/slack-config.js') < popupHtml.indexOf('popup.js"'), 'popup loads the shared config before its script');
    assert(!/api\.openai\.com/.test(contentSource), 'the content script never calls OpenAI itself (worker does, host permission)');
});

console.log(`\n📊 Results: ${testsPassed}/${testsTotal} passed`);
process.exit(testsPassed === testsTotal ? 0 : 1);
