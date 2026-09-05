#!/usr/bin/env node

/**
 * SlackPolish Blockquote Preservation Tests
 * Verifies that Slack quotes (typed as "> text", rendered as <blockquote>) survive
 * the extract -> model -> write-back round trip instead of being flattened into
 * the neighbouring paragraph.
 */

const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, '../../slack-text-improver.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

let testsPassed = 0;
let testsTotal = 0;

function runTest(name, fn) {
    testsTotal++;
    try {
        console.log(`🧪 Testing: ${name}`);
        fn();
        testsPassed++;
        console.log(`✅ PASSED: ${name}`);
    } catch (error) {
        console.log(`❌ FAILED: ${name}`);
        console.log(`   Error: ${error.message}`);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function countOccurrences(haystack, needle) {
    return haystack.split(needle).length - 1;
}

// Pull the pure helper and the write-back regex out of the real script so the
// behavioural tests below exercise the shipped code, not a re-implementation.
function loadFormatQuoteLines() {
    const match = scriptContent.match(/formatQuoteLines: function\(text\) \{([\s\S]*?)\n {8}\},/);
    assert(match, 'formatQuoteLines helper not found in slack-text-improver.js');
    return new Function('text', match[1]);
}

function loadQuoteLineRegex() {
    const match = scriptContent.match(/const quoteMatch = quoteLine\.match\((\/[^\n]+?\/)\);/);
    assert(match, 'quote line regex not found in buildFormattedFragment');
    return eval(match[1]);
}

console.log('🚀 Running Blockquote Preservation Tests');
console.log('========================================\n');

runTest('Both DOM extractors handle <blockquote>', () => {
    const branches = countOccurrences(scriptContent, "tagName === 'blockquote'");
    assert(branches >= 2, `Expected a blockquote branch in extractTextWithNumbering and extractTextStateWithMentions, found ${branches}`);
    assert(scriptContent.includes('formatQuoteLines(Array.from(node.childNodes).map(processNode)'),
        'Blockquote children should be processed with processNode so <br>/mentions inside quotes are handled');
});

runTest('formatQuoteLines prefixes every quoted line and terminates with a newline', () => {
    const formatQuoteLines = loadFormatQuoteLines();
    assert(formatQuoteLines('Can you ship Friday?') === '> Can you ship Friday?\n', 'Single quoted line not formatted');
    assert(formatQuoteLines('first\nsecond\n') === '> first\n> second\n', 'Multi-line quote not formatted per line');
    assert(formatQuoteLines('  padded  \n\n\n') === '> padded\n', 'Whitespace/blank lines should be trimmed and dropped');
    assert(formatQuoteLines('') === '', 'Empty quote should produce nothing');
    assert(formatQuoteLines(null) === '', 'Null input should produce nothing');
});

runTest('Quoted line followed by a paragraph is no longer fused into one line', () => {
    // Before this fix a <blockquote> fell through to the plain-text branch which
    // returned no trailing newline, producing "quoted textreply text".
    const formatQuoteLines = loadFormatQuoteLines();
    const quoted = formatQuoteLines('Can you ship Friday?');
    const paragraph = 'Yes, on track.\n';
    const combined = (quoted + paragraph).replace(/\n\s*\n+/g, '\n').trim();
    assert(combined === '> Can you ship Friday?\nYes, on track.', `Unexpected combined text: ${JSON.stringify(combined)}`);
});

runTest('Write-back recognises quote lines and rebuilds <blockquote>', () => {
    assert(scriptContent.includes("document.createElement('blockquote')"), 'Write-back should create <blockquote> elements');
    assert(scriptContent.includes('this.appendTextWithMentions(blockquote, quoteContent, textState)'),
        'Quote content should go through appendTextWithMentions so mentions/links inside quotes are restored');

    const quoteRegex = loadQuoteLineRegex();
    const content = (line) => { const m = line.match(quoteRegex); return m ? (m[1] || '').trim() : null; };

    assert(content('> hello there') === 'hello there', '"> text" should be recognised as a quote');
    assert(content('>>> multi line quote') === 'multi line quote', '">>> text" should be recognised as a quote');
    assert(content('>') === '', 'A bare ">" should match as an empty quote (and be skipped by the caller)');
    assert(content('>50% done') === null, '">50%" (no space) is not a Slack quote and must stay a paragraph');
    assert(content('1. numbered') === null, 'Numbered list items must not be treated as quotes');
    assert(content('• bullet') === null, 'Bullets must not be treated as quotes');
    assert(content('plain text') === null, 'Plain text must not be treated as quotes');
});

runTest('Quote lines reset list context (quote after a list does not join the list)', () => {
    const start = scriptContent.indexOf('const quoteLine = /^__SLACKPOLISH_QUOTE_');
    const end = scriptContent.indexOf('// Check if this is a numbered list item', start);
    assert(start !== -1 && end !== -1 && end > start, 'Quote handling should run before numbered-list handling');
    const block = scriptContent.slice(start, end);
    assert(block.includes('currentList = null') && block.includes('currentListType = null'),
        'Quote branch should reset currentList/currentListType');
});

runTest('Quoted words are protected: tokenised on extraction, restored verbatim, provided to the model as context only', () => {
    assert(scriptContent.includes('captureQuoteLines: function(text, state)'), 'captureQuoteLines missing');
    const extractor = scriptContent.slice(scriptContent.indexOf('extractTextStateWithMentions: function(root)'), scriptContent.indexOf('walkChildrenWithGlue: function'));
    assert(extractor.includes("return this.captureQuoteLines(Array.from(node.childNodes).map(processNode).join(''), state);"), 'Entity-aware extractor must tokenise quote lines');
    assert(scriptContent.includes("quotes: [], codes: [], emojis: [], formats: [], nextMentionId: 1, nextLinkId: 1, nextQuoteId: 1, nextCodeId: 1, nextEmojiId: 1"), 'Text state must carry quotes');
    assert(scriptContent.includes('return mentionCount > 0 || linkCount > 0 || quoteCount > 0 || codeCount > 0 || emojiCount > 0;'), 'Quotes must count as protected entities');
    assert(scriptContent.includes('const quote = this.getQuoteByToken(part, textState);') && scriptContent.includes('this.appendTextWithMentions(parent, quote.text, textState);'), 'Write-back must restore quote tokens (recursively)');
    assert(scriptContent.includes('const quoteLine = /^__SLACKPOLISH_QUOTE_\\d+__$/.test(trimmedLine) ? `> ${trimmedLine}` : trimmedLine;'), 'A bare quote token line must still become a blockquote');
    assert(scriptContent.includes('are quotations of someone else\\\'s words. Return every such line exactly as "> __SLACKPOLISH_QUOTE_n__"'), 'Prompt must demand verbatim quote tokens');
    assert(scriptContent.includes('For context only, the quoted lines read:'), 'Prompt must still give the model the quoted words as context');
});

runTest('Entities nested inside a quote are not treated as dropped (no duplicates appended)', () => {
    assert(scriptContent.includes('expandQuoteTokens: function(text, textState, depth = 0)'), 'expandQuoteTokens missing');
    const restore = scriptContent.slice(scriptContent.indexOf('restoreMissingProtectedTokens: function'), scriptContent.indexOf('appendTextWithMentions: function'));
    assert(restore.includes('const isPresent = (token) => restoredText.includes(token) || this.expandQuoteTokens(restoredText, textState).includes(token);'), 'Presence must be checked on the raw text OR quote-expanded text (quote tokens themselves vanish when expanded)');
    assert(restore.includes('if (isPresent(entity.token)) {') && restore.includes('entities.filter(entity => !isPresent(entity.token))'), 'Both the re-anchor loop and the last-resort check must use isPresent');
    assert(!restore.includes('if (restoredText.includes(entity.token)) {'), 'Presence gate must not use raw includes() on unexpanded text');
});

runTest('Tokens that only exist inside a quote are never rendered standalone, and the prompt does not invite them', () => {
    const restore = scriptContent.slice(scriptContent.indexOf('restoreMissingProtectedTokens: function'), scriptContent.indexOf('appendTextWithMentions: function'));
    assert(restore.includes("if (entity.type !== 'quote' && bodyText && !bodyText.includes(entity.token) && restoredText.includes(entity.token)) {"), 'Echoed nested tokens must be stripped from the output');
    assert(scriptContent.includes("const inlineTokens = [...new Set(text.match(/__SLACKPOLISH_(?:MENTION|LINK|CODE|EMOJI)_\\d+__/g) || [])];"), 'Prompt must inspect which inline tokens are really in the body');
    assert(scriptContent.includes('Never add a token that is not already in the message.'), 'Prompt must forbid inventing tokens');
});

runTest('captureQuoteLines emits one token per non-empty quoted line and keeps the raw text', () => {
    const match = scriptContent.match(/captureQuoteLines: function\(text, state\) \{([\s\S]*?)\n {8}\},/);
    assert(match, 'captureQuoteLines body not found');
    const capture = new Function('text', 'state', match[1]);
    const state = { quotes: [], nextQuoteId: 1 };
    const out = capture(' can you ship by friday?\n\nsecond __SLACKPOLISH_LINK_1__ line\n', state);
    assert(out === '> __SLACKPOLISH_QUOTE_1__\n> __SLACKPOLISH_QUOTE_2__\n', `Unexpected output: ${JSON.stringify(out)}`);
    assert(state.quotes.length === 2 && state.nextQuoteId === 3, 'Two quote entities expected');
    assert(state.quotes[0].text === ' can you ship by friday?', 'Quote text must be kept raw (leading space included) for byte-identical restore');
    assert(state.quotes[1].text === 'second __SLACKPOLISH_LINK_1__ line', 'Nested tokens must stay inside the quote text');
    assert(capture('', { quotes: [], nextQuoteId: 1 }) === '', 'Empty quote yields nothing');
});

runTest('Prompt instructs the model to keep quote and list markers', () => {
    assert(scriptContent.includes('quote marker (">")'), 'Prompt should mention the ">" quote marker');
    assert(scriptContent.includes('beginning with the same marker'), 'Prompt should ask to keep markers at line start');
    assert(!scriptContent.includes('Do not include any explanations, quotes, requirements'),
        'Prompt should say "quotation marks", not "quotes", to avoid the model stripping > quotes');
});

runTest('Response cleanup does not strip a leading ">"', () => {
    assert(scriptContent.includes(`processedResponse.startsWith('"') && processedResponse.endsWith('"')`),
        'Surrounding-quote cleanup should only target matched quotation-mark pairs');
    assert(!/processedResponse\.startsWith\(['"]>['"]\)/.test(scriptContent),
        'Cleanup must not treat a leading ">" as a quotation mark');
});

console.log('\n========================================');
console.log('📊 TEST SUMMARY');
console.log('========================================');
console.log(`Total Tests: ${testsTotal}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsTotal - testsPassed}`);

if (testsPassed === testsTotal) {
    console.log('\n🎉 All blockquote preservation tests passed!');
    process.exit(0);
} else {
    console.log('\n💥 Some blockquote preservation tests failed!');
    process.exit(1);
}
