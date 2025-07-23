#!/usr/bin/env node

/**
 * SlackPolish Channel Summary Feature Tests
 * Tests the new channel summarization functionality
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_NAME = 'Channel Summary Feature';
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

// Load channel summary script for testing
const channelSummaryPath = path.join(__dirname, '../../slack-channel-summary.js');
const channelSummaryContent = fs.readFileSync(channelSummaryPath, 'utf8');

// Load config for testing
const configPath = path.join(__dirname, '../../slack-config.js');
const configContent = fs.readFileSync(configPath, 'utf8');

console.log(`🚀 Running ${TEST_NAME} Tests`);
console.log('=====================================\n');

// Test 1: Channel Summary Configuration Exists
runTest('Channel Summary Configuration Exists', () => {
    assert(channelSummaryContent.includes('SlackChannelSummary'), 'SlackChannelSummary object not found');
    assert(channelSummaryContent.includes('F10'), 'F10 hotkey not configured');
    assert(channelSummaryContent.includes('Channel Summary'), 'Channel Summary functionality not found');
    assert(channelSummaryContent.includes('Executive Summary'), 'Executive Summary option not found');
});

// Test 2: Channel Summary Object Definition
runTest('ChannelSummarizer Class Definition', () => {
    assert(channelSummaryContent.includes('const SlackChannelSummary'), 'SlackChannelSummary object not found');
    assert(channelSummaryContent.includes('loadSettings'), 'loadSettings method not found');
    assert(channelSummaryContent.includes('showChannelSummary'), 'showChannelSummary method not found');
    assert(channelSummaryContent.includes('createLogo'), 'createLogo method not found');
});

// Test 3: Channel Summary Methods
runTest('Channel Summary Core Methods', () => {
    assert(channelSummaryContent.includes('generateChannelSummary'), 'generateChannelSummary method not found');
    assert(channelSummaryContent.includes('calculateDateRange'), 'calculateDateRange method not found');
    assert(channelSummaryContent.includes('formatMessagesForAI'), 'formatMessagesForAI method not found');
    assert(channelSummaryContent.includes('processAndDisplaySummary'), 'processAndDisplaySummary method not found');
});

// Test 4: Global DOM Module Integration
runTest('Global DOM Module Integration', () => {
    assert(channelSummaryContent.includes('window.SlackPolishChannelMessages'), 'SlackPolishChannelMessages integration not found');
    assert(channelSummaryContent.includes('getMessagesInRange'), 'getMessagesInRange call not found');
    assert(channelSummaryContent.includes('getAllChannelMessages'), 'getAllChannelMessages call not found');
    assert(channelSummaryContent.includes('true // include threads'), 'Thread inclusion option not found');
});

// Test 5: Time Range Processing
runTest('Time Range Processing', () => {
    assert(channelSummaryContent.includes('24 * 60 * 60 * 1000'), '24 hour calculation not found');
    assert(channelSummaryContent.includes('7 * 24 * 60 * 60 * 1000'), '7 day calculation not found');
    assert(channelSummaryContent.includes('30 * 24 * 60 * 60 * 1000'), '30 day calculation not found');
    assert(channelSummaryContent.includes('startDate = null'), 'Entire channel date handling not found');
});

// Test 6: Error Handling and Loading States
runTest('Error Handling and Loading States', () => {
    assert(channelSummaryContent.includes('try {'), 'Error handling try blocks not found');
    assert(channelSummaryContent.includes('catch (error)'), 'Error handling catch blocks not found');
    assert(channelSummaryContent.includes('generateBtn.disabled = true'), 'Loading state button disable not found');
    assert(channelSummaryContent.includes('⏳ Fetching Messages'), 'Loading message not found');
});

// Test 7: Time Range Options
runTest('Time Range Options in UI', () => {
    assert(channelSummaryContent.includes('24 hours'), '24 hours option not found');
    assert(channelSummaryContent.includes('7 days'), '7 days option not found');
    assert(channelSummaryContent.includes('30 days'), '30 days option not found');
    assert(channelSummaryContent.includes('Entire channel'), 'Entire channel option not found');
});

// Test 8: Message Formatting
runTest('Message Formatting Functions', () => {
    assert(channelSummaryContent.includes('formatNoMessagesFound'), 'formatNoMessagesFound method not found');
    assert(channelSummaryContent.includes('NO MESSAGES FOUND'), 'No messages handling not found');
    assert(channelSummaryContent.includes('MESSAGES FOUND:'), 'Message count display not found');
    assert(channelSummaryContent.includes('GENERATED:'), 'Generation timestamp not found');
});

// Test 9: HTML Template Generation
runTest('HTML Template Generation', () => {
    assert(channelSummaryContent.includes('SlackPolish Channel Summary'), 'Summary window title not found');
    assert(channelSummaryContent.includes('Time Range:'), 'Time range UI not found');
    assert(channelSummaryContent.includes('Summary Level:'), 'Summary level UI not found');
    assert(channelSummaryContent.includes('Generate Summary'), 'Generate Summary button not found');
});

// Test 10: Error Handling Implementation
runTest('Error Handling Implementation', () => {
    assert(channelSummaryContent.includes('try {'), 'Error handling try blocks not found');
    assert(channelSummaryContent.includes('catch (error)'), 'Error handling catch blocks not found');
    assert(channelSummaryContent.includes('Error in generateChannelSummary'), 'Error message handling not implemented');
    assert(channelSummaryContent.includes('utils.debug'), 'Debug logging not implemented');
});

// Test 11: Settings Integration
runTest('Settings Integration', () => {
    assert(channelSummaryContent.includes('loadSettings'), 'Settings loading not implemented');
    assert(channelSummaryContent.includes('localStorage.getItem'), 'LocalStorage access not implemented');
    assert(channelSummaryContent.includes('slackpolish_settings'), 'Settings key not defined');
});

// Test 12: Global Module Integration
runTest('Global Module Integration', () => {
    assert(scriptContent.includes('window.SlackPolishChannelMessages'), 'Global channel messages module not found');
    assert(scriptContent.includes('initializeGlobalChannelMessagesSystem'), 'Channel messages system initialization not found');
    assert(scriptContent.includes('getCurrentChannelId'), 'Channel ID extraction not found');
});

// Test 13: Message Processing Integration
runTest('Message Processing Integration', () => {
    assert(scriptContent.includes('extractMessagesFromDOM'), 'DOM message extraction not found');
    assert(scriptContent.includes('getRecentMessages'), 'Recent messages method not found');
    assert(scriptContent.includes('getMessagesInRange'), 'Message range method not found');
    assert(scriptContent.includes('includeThreads'), 'Thread inclusion not found');
});

// Test 14: UI Styling and Layout
runTest('UI Styling and Layout', () => {
    assert(channelSummaryContent.includes('font-family:'), 'CSS styling not found');
    assert(channelSummaryContent.includes('border-radius:'), 'Border radius styling not found');
    assert(channelSummaryContent.includes('padding:'), 'Padding styling not found');
    assert(channelSummaryContent.includes('background:'), 'Background styling not found');
});

// Test 15: Timestamp Processing
runTest('Timestamp Processing', () => {
    assert(channelSummaryContent.includes('new Date(msg.timestamp).toLocaleString()'), 'Timestamp parsing method not found');
    assert(channelSummaryContent.includes('toLocaleString'), 'Date formatting not found');
    assert(channelSummaryContent.includes('getTime()'), 'Time extraction not found');
});

console.log('\n=====================================');
console.log('📊 TEST SUMMARY');
console.log('=====================================');
console.log(`Total Tests: ${testsTotal}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsTotal - testsPassed}`);
console.log(`📈 Success Rate: ${Math.round((testsPassed / testsTotal) * 100)}%`);

if (testsPassed === testsTotal) {
    console.log('\n🎉 All channel summary tests passed!');
    process.exit(0);
} else {
    console.log('\n💥 Some channel summary tests failed.');
    process.exit(1);
}
