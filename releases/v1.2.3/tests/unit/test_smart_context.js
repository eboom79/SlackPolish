#!/usr/bin/env node

/**
 * SlackPolish Smart Context System Tests
 * Tests the smart context functionality including message fetching, anonymization, and formatting
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_NAME = 'Smart Context System';
let testsPassed = 0;
let testsTotal = 0;

function runTest(testName, testFunction) {
    testsTotal++;
    try {
        console.log(`🧪 Testing: ${testName}`);
        testFunction();
        testsPassed++;
        console.log(`✅ PASSED: ${testName}`);
    } catch (error) {
        console.log(`❌ FAILED: ${testName}`);
        console.log(`   Error: ${error.message}`);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

// Load the main script for testing
const scriptPath = path.join(__dirname, '../../slack-text-improver.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

console.log(`🚀 Running ${TEST_NAME} Tests`);
console.log('=====================================\n');

// Test 1: Smart Context Configuration
runTest('Smart Context Configuration', () => {
    assert(scriptContent.includes('SMART_CONTEXT'), 'Smart context configuration not found');
    assert(scriptContent.includes('enabled: true'), 'Smart context enabled setting not found');
    assert(scriptContent.includes('privacyMode: false'), 'Smart context privacy mode setting not found');
});

// Test 2: Smart Context Message Fetching
runTest('Smart Context Message Fetching', () => {
    assert(scriptContent.includes('getSmartContext'), 'getSmartContext method not found');
    assert(scriptContent.includes('window.SlackPolishChannelMessages'), 'Channel messages integration not found');
    assert(scriptContent.includes('getChannelContext') || scriptContent.includes('getThreadContext'), 'Context fetching methods not found');
    assert(scriptContent.includes('getRecentMessagesFromDOM'), 'DOM fallback method not found');
    assert(scriptContent.includes('isUserInThreadInput'), 'Thread detection method not found');
});

// Test 3: Context Anonymization
runTest('Context Anonymization', () => {
    assert(scriptContent.includes('anonymizeText'), 'anonymizeText method not found');
    assert(scriptContent.includes('@\\w+'), 'Mention anonymization pattern not found');
    assert(scriptContent.includes('[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+'), 'Email anonymization pattern not found');
    assert(scriptContent.includes('\\d{3}[-.]?\\d{3}[-.]?\\d{4}'), 'Phone anonymization pattern not found');
    assert(scriptContent.includes('https?:\\/\\/[^\\s]+'), 'URL anonymization pattern not found');
});

// Test 4: Context Formatting
runTest('Context Formatting', () => {
    assert(scriptContent.includes('Recent conversation context'), 'Context formatting text not found');
    assert(scriptContent.includes('Here is the conversation context for reference'), 'Context instruction not found');
    assert(scriptContent.includes('contextMessages.length'), 'Context message count handling not found');
});

// Test 5: Privacy Mode Handling
runTest('Privacy Mode Handling', () => {
    assert(scriptContent.includes('privacyMode'), 'Privacy mode handling not found');
    assert(scriptContent.includes('anonymizeText'), 'Privacy mode anonymization not found');
    assert(scriptContent.includes('User${index + 1}'), 'User anonymization pattern not found');
});

// Test 6: Error Handling in Smart Context
runTest('Smart Context Error Handling', () => {
    assert(scriptContent.includes('try {'), 'Error handling try blocks not found');
    assert(scriptContent.includes('catch (error)'), 'Error handling catch blocks not found');
    assert(scriptContent.includes('continuing without it'), 'Graceful degradation not found');
    assert(scriptContent.includes('return []'), 'Empty context fallback not found');
});

// Test 7: Context Integration with Prompt Building
runTest('Context Integration with Prompt Building', () => {
    assert(scriptContent.includes('buildPrompt'), 'buildPrompt method not found');
    assert(scriptContent.includes('smartContextEnabled'), 'Smart context enabled check not found');
    assert(scriptContent.includes('getSmartContext'), 'Smart context integration not found');
});

// Test 8: Context Message Filtering
runTest('Context Message Filtering', () => {
    assert(scriptContent.includes('filter(msg => msg.text'), 'Message filtering not found');
    assert(scriptContent.includes('trim().length > 0'), 'Empty message filtering not found');
    assert(scriptContent.includes('slice(-5)'), 'Message count limiting not found');
});

// Test 9: Context Debug Logging
runTest('Context Debug Logging', () => {
    assert(scriptContent.includes('utils.debug'), 'Debug logging not found');
    assert(scriptContent.includes('Smart context messages prepared'), 'Context debug message not found');
    assert(scriptContent.includes('contextMessages: contextMessages.length'), 'Context count logging not found');
});

// Test 10: Context Module Availability Check
runTest('Context Module Availability Check', () => {
    assert(scriptContent.includes('!window.SlackPolishChannelMessages'), 'Module availability check not found');
    assert(scriptContent.includes('Channel Messages module not available'), 'Module unavailable message not found');
    assert(scriptContent.includes('return []'), 'Empty context return not found');
});

// Test 11: Thread-Aware Context Features
runTest('Thread-Aware Context Features', () => {
    assert(scriptContent.includes('isUserInThreadInput'), 'Thread input detection not found');
    assert(scriptContent.includes('getThreadContext'), 'Thread context method not found');
    assert(scriptContent.includes('getChannelContext'), 'Channel context method not found');
    assert(scriptContent.includes('getCurrentThreadTs'), 'Thread timestamp detection not found');
    assert(scriptContent.includes('contextType'), 'Context type logging not found');
});

// Test 12: Thread Context Extraction
runTest('Thread Context Extraction', () => {
    assert(scriptContent.includes('conversations.replies'), 'Thread API call not found');
    assert(scriptContent.includes('getThreadContextFromDOM'), 'Thread DOM fallback not found');
    assert(scriptContent.includes('threadTs'), 'Thread timestamp handling not found');
    assert(scriptContent.includes('isThreadReply'), 'Thread reply marking not found');
});

console.log('\n=====================================');
console.log('📊 TEST SUMMARY');
console.log('=====================================');
console.log(`Total Tests: ${testsTotal}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsTotal - testsPassed}`);
console.log(`📈 Success Rate: ${Math.round((testsPassed / testsTotal) * 100)}%`);

if (testsPassed === testsTotal) {
    console.log('\n🎉 All smart context tests passed!');
    process.exit(0);
} else {
    console.log('\n💥 Some smart context tests failed.');
    process.exit(1);
}
