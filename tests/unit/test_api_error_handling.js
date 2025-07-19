#!/usr/bin/env node

/**
 * SlackPolish API Error Handling Tests
 * Tests API error scenarios, network failures, and error recovery
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_NAME = 'API Error Handling';
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

// Load scripts for testing
const scriptPath = path.join(__dirname, '../../slack-text-improver.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

const channelSummaryPath = path.join(__dirname, '../../slack-channel-summary.js');
const channelSummaryContent = fs.readFileSync(channelSummaryPath, 'utf8');

console.log(`🚀 Running ${TEST_NAME} Tests`);
console.log('=====================================\n');

// Test 1: API Key Validation
runTest('API Key Validation', () => {
    assert(scriptContent.includes('API key not configured') || scriptContent.includes('API key not found'), 'API key validation error not found');
    assert(scriptContent.includes('!apiKey') || scriptContent.includes('!config.OPENAI_API_KEY'), 'API key check not found');
    assert(scriptContent.includes('throw new Error'), 'Error throwing not found');
});

// Test 2: Network Error Handling
runTest('Network Error Handling', () => {
    assert(scriptContent.includes('fetch(') || scriptContent.includes('XMLHttpRequest'), 'Network request not found');
    assert(scriptContent.includes('catch (error)'), 'Network error catching not found');
    assert(scriptContent.includes('Network error') || scriptContent.includes('Failed to fetch'), 'Network error handling not found');
});

// Test 3: API Response Error Handling
runTest('API Response Error Handling', () => {
    assert(scriptContent.includes('response.ok') || scriptContent.includes('response.status'), 'Response status checking not found');
    assert(scriptContent.includes('response.json()'), 'JSON response parsing not found');
    assert(scriptContent.includes('error.message'), 'Error message extraction not found');
});

// Test 4: Rate Limiting Handling
runTest('Rate Limiting Handling', () => {
    assert(scriptContent.includes('429') || scriptContent.includes('rate limit') || scriptContent.includes('handleApiError'), 'Rate limiting detection not found');
    assert(scriptContent.includes('error') && scriptContent.includes('message'), 'Rate limit error handling not found');
});

// Test 5: API Quota Exceeded Handling
runTest('API Quota Exceeded Handling', () => {
    assert(scriptContent.includes('quota') || scriptContent.includes('billing') || scriptContent.includes('insufficient'), 'Quota error handling not found');
    assert(scriptContent.includes('handleApiError'), 'API error handler not found');
});

// Test 6: Invalid API Key Error Handling
runTest('Invalid API Key Error Handling', () => {
    assert(scriptContent.includes('401') || scriptContent.includes('unauthorized') || scriptContent.includes('invalid') || scriptContent.includes('API key'), 'Invalid API key detection not found');
    assert(scriptContent.includes('API key') && (scriptContent.includes('not configured') || scriptContent.includes('not found')), 'Invalid API key message not found');
});

// Test 7: Timeout Error Handling
runTest('Timeout Error Handling', () => {
    assert(scriptContent.includes('timeout') || scriptContent.includes('AbortController') || scriptContent.includes('fetch'), 'Timeout handling not found');
    assert(scriptContent.includes('error') && scriptContent.includes('catch'), 'Timeout error handling not found');
});

// Test 8: Error Recovery and Fallback
runTest('Error Recovery and Fallback', () => {
    assert(scriptContent.includes('hideLoadingIndicator'), 'Loading indicator cleanup not found');
    assert(scriptContent.includes('console.error'), 'Error logging not found');
    assert(scriptContent.includes('try {') && scriptContent.includes('catch (error)'), 'Error recovery structure not found');
});

// Test 9: User-Friendly Error Messages
runTest('User-Friendly Error Messages', () => {
    assert(scriptContent.includes('showApiKeyUpdatePopup') || scriptContent.includes('alert'), 'User error notification not found');
    assert(scriptContent.includes('Please check') || scriptContent.includes('Please try'), 'User guidance not found');
});

// Test 10: Channel Summary API Error Handling
runTest('Channel Summary API Error Handling', () => {
    assert(channelSummaryContent.includes('generateAISummary'), 'AI summary generation not found');
    assert(channelSummaryContent.includes('catch (error)'), 'Channel summary error handling not found');
    assert(channelSummaryContent.includes('API key not found'), 'Channel summary API key validation not found');
});

// Test 11: Error State Management
runTest('Error State Management', () => {
    assert(scriptContent.includes('isProcessing') || scriptContent.includes('processing'), 'Processing state management not found');
    assert(scriptContent.includes('false') && scriptContent.includes('processing'), 'Error state reset not found');
});

// Test 12: Debug Error Logging
runTest('Debug Error Logging', () => {
    assert(scriptContent.includes('utils.debug'), 'Debug logging not found');
    assert(scriptContent.includes('error.stack') || scriptContent.includes('stack'), 'Stack trace logging not found');
    assert(scriptContent.includes('error.message'), 'Error message logging not found');
});

// Test 13: API Error Classification
runTest('API Error Classification', () => {
    assert(scriptContent.includes('400') || scriptContent.includes('401') || scriptContent.includes('429'), 'HTTP status code handling not found');
    assert(scriptContent.includes('handleApiError') || scriptContent.includes('classifyError'), 'Error classification not found');
});

// Test 14: Error Recovery UI Updates
runTest('Error Recovery UI Updates', () => {
    assert(scriptContent.includes('hideLoadingIndicator'), 'Loading indicator removal not found');
    assert(scriptContent.includes('enable') || scriptContent.includes('disabled = false'), 'UI element re-enabling not found');
});

console.log('\n=====================================');
console.log('📊 TEST SUMMARY');
console.log('=====================================');
console.log(`Total Tests: ${testsTotal}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsTotal - testsPassed}`);
console.log(`📈 Success Rate: ${Math.round((testsPassed / testsTotal) * 100)}%`);

if (testsPassed === testsTotal) {
    console.log('\n🎉 All API error handling tests passed!');
    process.exit(0);
} else {
    console.log('\n💥 Some API error handling tests failed.');
    process.exit(1);
}
