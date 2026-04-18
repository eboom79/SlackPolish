#!/usr/bin/env node

/**
 * SlackPolish Link Preservation Tests
 * Verifies that Slack link entities are protected during text polishing.
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

console.log('🚀 Running Link Preservation Tests');
console.log('=====================================\n');

runTest('Link token placeholder exists', () => {
    assert(scriptContent.includes('__SLACKPOLISH_LINK_'), 'Link placeholder token not found');
});

runTest('Link-aware extraction exists', () => {
    assert(scriptContent.includes('isSlackLinkNode'), 'isSlackLinkNode method not found');
    assert(scriptContent.includes('captureLinkToken'), 'captureLinkToken method not found');
    assert(scriptContent.includes('getLinkByToken'), 'getLinkByToken method not found');
    assert(scriptContent.includes('isTopLevelProtectedNode'), 'Top-level protected node detection not found');
});

runTest('Link restoration exists', () => {
    assert(scriptContent.includes('appendTextWithMentions'), 'Entity restoration method not found');
    assert(scriptContent.includes('getAttribute(\'href\')'), 'Link preservation should inspect href attributes');
    assert(scriptContent.includes('restoreMissingProtectedTokens'), 'Missing protected token restoration not found');
});

runTest('Prompt preserves link tokens', () => {
    assert(
        scriptContent.includes('__SLACKPOLISH_LINK_1__') &&
        scriptContent.includes('represent real Slack entities such as mentions and links'),
        'Prompt should instruct the model to preserve link tokens exactly'
    );
});

console.log('\n=====================================');
console.log('📊 TEST SUMMARY');
console.log('=====================================');
console.log(`Total Tests: ${testsTotal}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsTotal - testsPassed}`);

if (testsPassed === testsTotal) {
    console.log('\n🎉 All link preservation tests passed!');
    process.exit(0);
} else {
    console.log('\n💥 Some link preservation tests failed.');
    process.exit(1);
}
