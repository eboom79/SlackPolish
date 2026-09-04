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
    const match = scriptContent.match(/const quoteMatch = trimmedLine\.match\((\/[^\n]+?\/)\);/);
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
    const start = scriptContent.indexOf('const quoteMatch = trimmedLine.match(');
    const end = scriptContent.indexOf('// Check if this is a numbered list item', start);
    assert(start !== -1 && end !== -1 && end > start, 'Quote handling should run before numbered-list handling');
    const block = scriptContent.slice(start, end);
    assert(block.includes('currentList = null') && block.includes('currentListType = null'),
        'Quote branch should reset currentList/currentListType');
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
