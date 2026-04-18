#!/usr/bin/env node

/**
 * SlackPolish Mention Preservation Tests
 * Verifies that Slack mention entities are protected during text polishing.
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

console.log('🚀 Running Mention Preservation Tests');
console.log('=====================================\n');

runTest('Mention token placeholder exists', () => {
    assert(scriptContent.includes('__SLACKPOLISH_MENTION_'), 'Mention placeholder token not found');
});

runTest('Mention-aware extraction exists', () => {
    assert(scriptContent.includes('getModelTextState'), 'getModelTextState method not found');
    assert(scriptContent.includes('extractTextStateWithMentions'), 'extractTextStateWithMentions method not found');
    assert(scriptContent.includes('captureMentionToken'), 'captureMentionToken method not found');
    assert(scriptContent.includes('hasProtectedEntities'), 'hasProtectedEntities method not found');
    assert(scriptContent.includes('isTopLevelProtectedNode'), 'Top-level protected node detection not found');
});

runTest('Mention detection heuristics exist', () => {
    assert(scriptContent.includes('isSlackMentionNode'), 'isSlackMentionNode method not found');
    assert(scriptContent.includes("contenteditable"), 'Mention detection should inspect contenteditable');
    assert(scriptContent.includes('data-stringify-type'), 'Mention detection should inspect stringify attributes');
});

runTest('Mention restoration exists', () => {
    assert(scriptContent.includes('appendTextWithMentions'), 'appendTextWithMentions method not found');
    assert(scriptContent.includes('cloneNode(true)'), 'Mention restoration should clone original mention nodes');
    assert(scriptContent.includes('restoreMissingProtectedTokens'), 'Missing protected token restoration not found');
});

runTest('Prompt preserves mention tokens', () => {
    assert(
        scriptContent.includes('represent real Slack entities such as mentions and links') &&
        scriptContent.includes('Preserve every such token exactly'),
        'Prompt should instruct the model to preserve mention tokens exactly'
    );
});

console.log('\n=====================================');
console.log('📊 TEST SUMMARY');
console.log('=====================================');
console.log(`Total Tests: ${testsTotal}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsTotal - testsPassed}`);

if (testsPassed === testsTotal) {
    console.log('\n🎉 All mention preservation tests passed!');
    process.exit(0);
} else {
    console.log('\n💥 Some mention preservation tests failed.');
    process.exit(1);
}
