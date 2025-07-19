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

// Test 3: Summary Window Creation
runTest('Summary Window Creation Methods', () => {
    assert(scriptContent.includes('openSummaryWindow()'), 'openSummaryWindow method not found');
    assert(scriptContent.includes('createSummaryWindowContent'), 'createSummaryWindowContent method not found');
    assert(scriptContent.includes('generateSummaryHTML'), 'generateSummaryHTML method not found');
});

// Test 4: Message Processing Methods
runTest('Message Processing Methods', () => {
    assert(scriptContent.includes('fetchChannelMessages'), 'fetchChannelMessages method not found');
    assert(scriptContent.includes('extractMessagesFromDOM'), 'extractMessagesFromDOM method not found');
    assert(scriptContent.includes('extractMessageTimestamp'), 'extractMessageTimestamp method not found');
    assert(scriptContent.includes('extractMessageAuthor'), 'extractMessageAuthor method not found');
});

// Test 5: AI Integration Methods
runTest('AI Integration Methods', () => {
    assert(scriptContent.includes('generateAISummary'), 'generateAISummary method not found');
    assert(scriptContent.includes('createSummaryPrompt'), 'createSummaryPrompt method not found');
    assert(scriptContent.includes('callOpenAI'), 'callOpenAI method not found');
});

// Test 6: Hotkey Handler Integration
runTest('F10 Hotkey Handler Integration', () => {
    assert(scriptContent.includes('handleChannelSummaryHotkey'), 'Channel summary hotkey handler not found');
    assert(scriptContent.includes('addEventListener(\'keydown\', handleChannelSummaryHotkey'), 'Hotkey handler not registered');
    assert(scriptContent.includes('event.key === summaryHotkey'), 'Hotkey detection logic not found');
});

// Test 7: Summary Depth Options
runTest('Summary Depth Options Configuration', () => {
    assert(configContent.includes('DEPTH_OPTIONS'), 'DEPTH_OPTIONS not configured');
    assert(configContent.includes('last24hours'), 'last24hours option not found');
    assert(configContent.includes('last7days'), 'last7days option not found');
    assert(configContent.includes('last30days'), 'last30days option not found');
    assert(configContent.includes('entirechannel'), 'entirechannel option not found');
});

// Test 8: Summary Level Options
runTest('Summary Level Options Configuration', () => {
    assert(configContent.includes('LEVEL_OPTIONS'), 'LEVEL_OPTIONS not configured');
    assert(configContent.includes('short'), 'short level option not found');
    assert(configContent.includes('medium'), 'medium level option not found');
    assert(configContent.includes('comprehensive'), 'comprehensive level option not found');
    assert(configContent.includes('maxTokens'), 'maxTokens configuration not found');
});

// Test 9: HTML Template Generation
runTest('HTML Template Generation', () => {
    assert(scriptContent.includes('SlackPolish Summary'), 'Summary window title not found');
    assert(scriptContent.includes('Summary Depth:'), 'Summary depth UI not found');
    assert(scriptContent.includes('Summary Level:'), 'Summary level UI not found');
    assert(scriptContent.includes('Summarize'), 'Summarize button not found');
});

// Test 10: Error Handling
runTest('Error Handling Implementation', () => {
    assert(scriptContent.includes('try {'), 'Error handling try blocks not found');
    assert(scriptContent.includes('catch (error)'), 'Error handling catch blocks not found');
    assert(scriptContent.includes('throw new Error'), 'Error throwing not implemented');
    assert(scriptContent.includes('console.error'), 'Error logging not implemented');
});

// Test 11: Preferences Persistence
runTest('Preferences Persistence', () => {
    assert(scriptContent.includes('localStorage.setItem'), 'Preferences saving not implemented');
    assert(scriptContent.includes('localStorage.getItem'), 'Preferences loading not implemented');
    assert(scriptContent.includes('slackpolish_summary_preferences'), 'Preferences key not defined');
});

// Test 12: Integration with Main Script
runTest('Integration with Main Script', () => {
    assert(scriptContent.includes('window.channelSummarizer'), 'Global channelSummarizer not found');
    assert(scriptContent.includes('new ChannelSummarizer()'), 'ChannelSummarizer instantiation not found');
    assert(scriptContent.includes('Press F10 to open channel summary'), 'F10 usage instruction not found');
});

// Test 13: OpenAI API Integration
runTest('OpenAI API Integration', () => {
    assert(scriptContent.includes('https://api.openai.com/v1/chat/completions'), 'OpenAI API endpoint not found');
    assert(scriptContent.includes('gpt-3.5-turbo'), 'GPT model not specified');
    assert(scriptContent.includes('Authorization'), 'API authorization not implemented');
    assert(scriptContent.includes('Bearer'), 'Bearer token not used');
});

// Test 14: UI Styling and Layout
runTest('UI Styling and Layout', () => {
    assert(scriptContent.includes('font-family:'), 'CSS styling not found');
    assert(scriptContent.includes('background: linear-gradient'), 'Gradient background not found');
    assert(scriptContent.includes('border-radius:'), 'Border radius styling not found');
    assert(scriptContent.includes('.summarize-btn'), 'Summarize button styling not found');
});

// Test 15: Channel Information Extraction
runTest('Channel Information Extraction', () => {
    assert(scriptContent.includes('getCurrentChannelInfo'), 'getCurrentChannelInfo method not found');
    assert(scriptContent.includes('data-qa="channel_header"'), 'Channel header detection not implemented');
    assert(scriptContent.includes('extractChannelId'), 'extractChannelId method not found');
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
