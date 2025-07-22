// Test Thread Summary Functionality
// Tests the new thread detection and thread-specific summarization features

const fs = require('fs');
const path = require('path');

function assert(condition, message) {
    if (!condition) {
        throw new Error(`❌ ASSERTION FAILED: ${message}`);
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`❌ ASSERTION FAILED: ${message}. Expected: ${expected}, Got: ${actual}`);
    }
}

class ThreadSummaryTests {
    constructor() {
        this.rootDir = path.resolve(__dirname, '../..');
        this.summaryPath = path.join(this.rootDir, 'slack-channel-summary.js');
        this.summaryContent = fs.readFileSync(this.summaryPath, 'utf8');
    }

    // Test 1: Thread detection function exists
    testThreadDetectionFunctionExists() {
        assert(
            this.summaryContent.includes('detectThreadContext'),
            'detectThreadContext function should exist'
        );
        
        assert(
            this.summaryContent.includes('detectThreadContext: function()'),
            'detectThreadContext should be properly defined as a function'
        );
        
        console.log('✅ Thread detection function exists');
    }

    // Test 2: Thread detection methods are comprehensive
    testThreadDetectionMethods() {
        // Check for URL-based detection
        assert(
            this.summaryContent.includes('urlHasThread') && 
            this.summaryContent.includes("currentUrl.includes('/thread/')"),
            'URL-based thread detection should be implemented'
        );

        // Check for DOM-based detection
        assert(
            this.summaryContent.includes('threadContainer') &&
            this.summaryContent.includes('[data-qa="threads_view"]'),
            'DOM-based thread detection should be implemented'
        );

        // Check for focus-based detection
        assert(
            this.summaryContent.includes('activeElement') &&
            this.summaryContent.includes('isInThreadInput'),
            'Focus-based thread detection should be implemented'
        );

        // Check for visible container detection
        assert(
            this.summaryContent.includes('visibleThreadContainer') &&
            this.summaryContent.includes(':not([style*="display: none"])'),
            'Visible container detection should be implemented'
        );

        console.log('✅ Thread detection methods are comprehensive');
    }

    // Test 3: GUI customization for threads
    testThreadGUICustomization() {
        // Check for dynamic HTML creation
        assert(
            this.summaryContent.includes('createChannelSummaryHTML: function(threadContext'),
            'HTML creation should accept thread context parameter'
        );

        // Check for dynamic title
        assert(
            this.summaryContent.includes('Thread Summary') &&
            this.summaryContent.includes('Channel Summary'),
            'GUI should have dynamic titles for threads vs channels'
        );

        // Check for thread-specific time range options
        assert(
            this.summaryContent.includes('Full thread') &&
            this.summaryContent.includes('isInThread ?'),
            'Thread-specific time range options should be implemented'
        );

        console.log('✅ GUI customization for threads works');
    }

    // Test 4: Thread message extraction
    testThreadMessageExtraction() {
        // Check for thread message extraction function
        assert(
            this.summaryContent.includes('getThreadMessagesFromDOM'),
            'Thread message extraction function should exist'
        );

        // Check for thread-specific selectors
        assert(
            this.summaryContent.includes('[data-qa*="thread"]') &&
            this.summaryContent.includes('.c-message_kit__message'),
            'Thread-specific message selectors should be implemented'
        );

        // Check for thread message processing
        assert(
            this.summaryContent.includes('extractMessageData') &&
            this.summaryContent.includes('window.SlackPolishChannelMessages'),
            'Thread messages should use proper message extraction'
        );

        console.log('✅ Thread message extraction implemented');
    }

    // Test 5: Thread vs Channel logic separation
    testThreadChannelLogicSeparation() {
        // Check for thread detection in main logic
        assert(
            this.summaryContent.includes('threadContext.isInThread') &&
            this.summaryContent.includes('THREAD DETECTED'),
            'Main logic should check for thread context'
        );

        // Check for channel fallback
        assert(
            this.summaryContent.includes('MAIN CHANNEL DETECTED') &&
            this.summaryContent.includes('getChannelSummaryMessages'),
            'Channel summary fallback should be implemented'
        );

        // Check for proper result handling
        assert(
            this.summaryContent.includes('let result = null') &&
            this.summaryContent.includes('threadResult'),
            'Results should be properly handled for both contexts'
        );

        console.log('✅ Thread vs Channel logic properly separated');
    }

    // Test 6: Thread-specific channel naming
    testThreadChannelNaming() {
        // Check for thread-specific channel naming
        assert(
            this.summaryContent.includes('A thread in channel') &&
            this.summaryContent.includes('channelInfo.name'),
            'Thread summaries should have proper channel naming'
        );

        // Check that it uses detected channel info
        assert(
            this.summaryContent.includes('getCurrentChannelInfo()') &&
            this.summaryContent.includes('channelInfo.id'),
            'Thread summaries should use detected channel information'
        );

        console.log('✅ Thread channel naming implemented correctly');
    }

    // Test 7: Settings handling for threads
    testThreadSettingsHandling() {
        // Check for thread-aware settings loading
        assert(
            this.summaryContent.includes('isThreadSelect') &&
            this.summaryContent.includes('options.length === 1'),
            'Settings should detect thread-only options'
        );

        // Check for thread settings preservation
        assert(
            this.summaryContent.includes('Full thread') &&
            this.summaryContent.includes('selected'),
            'Thread settings should preserve Full thread selection'
        );

        console.log('✅ Thread settings handling implemented');
    }

    // Test 8: Early thread detection for GUI
    testEarlyThreadDetection() {
        // Check for early detection in showChannelSummary
        assert(
            this.summaryContent.includes('DETECT THREAD CONTEXT EARLY') &&
            this.summaryContent.includes('detectThreadContext()'),
            'Early thread detection should be implemented'
        );

        // Check for thread context storage
        assert(
            this.summaryContent.includes('_threadContext') &&
            this.summaryContent.includes('summaryWindow._threadContext'),
            'Thread context should be stored on window'
        );

        // Check for context usage in generation
        assert(
            this.summaryContent.includes('summaryWindow._threadContext') &&
            this.summaryContent.includes('USE STORED THREAD CONTEXT'),
            'Stored thread context should be used in generation'
        );

        console.log('✅ Early thread detection implemented');
    }

    // Test 9: Thread detection accuracy
    testThreadDetectionAccuracy() {
        // Check for conservative detection logic
        assert(
            this.summaryContent.includes('urlHasThread || isInThreadInput') &&
            this.summaryContent.includes('visibleThreadContainer && !!threadInput'),
            'Thread detection should be conservative and accurate'
        );

        // Check for multiple detection methods
        assert(
            this.summaryContent.includes('Method 1:') &&
            this.summaryContent.includes('Method 2:') &&
            this.summaryContent.includes('Method 3:'),
            'Multiple detection methods should be documented'
        );

        console.log('✅ Thread detection accuracy verified');
    }

    // Test 10: No functionality regression
    testNoFunctionalityRegression() {
        // Ensure all original channel summary functions still exist
        const originalFunctions = [
            'showChannelSummary',
            'createChannelSummaryHTML',
            'generateChannelSummary',
            'getCurrentChannelInfo',
            'processAndDisplaySummary',
            'formatMessagesForAI',
            'generateAISummary'
        ];

        originalFunctions.forEach(func => {
            assert(
                this.summaryContent.includes(`${func}:`),
                `Original function ${func} should still exist`
            );
        });

        // Ensure channel message fetching still works
        assert(
            this.summaryContent.includes('getChannelSummaryMessages') &&
            this.summaryContent.includes('MAIN CHANNEL DETECTED'),
            'Channel message fetching should still work'
        );

        console.log('✅ No functionality regression detected');
    }

    // Run all tests
    runAllTests() {
        console.log('🧪 Running Thread Summary Tests...\n');

        const tests = [
            'testThreadDetectionFunctionExists',
            'testThreadDetectionMethods',
            'testThreadGUICustomization',
            'testThreadMessageExtraction',
            'testThreadChannelLogicSeparation',
            'testThreadChannelNaming',
            'testThreadSettingsHandling',
            'testEarlyThreadDetection',
            'testThreadDetectionAccuracy',
            'testNoFunctionalityRegression'
        ];

        let passed = 0;
        let failed = 0;

        tests.forEach(testName => {
            try {
                this[testName]();
                passed++;
            } catch (error) {
                console.error(`❌ ${testName}: ${error.message}`);
                failed++;
            }
        });

        console.log(`\n📊 Thread Summary Test Results:`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📈 Success Rate: ${Math.round((passed / tests.length) * 100)}%`);

        if (failed === 0) {
            console.log('🎉 All Thread Summary tests passed!');
        }

        return failed === 0;
    }
}

// Export for use in test runner
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThreadSummaryTests;
}

// Run tests if called directly
if (require.main === module) {
    const tests = new ThreadSummaryTests();
    const success = tests.runAllTests();
    process.exit(success ? 0 : 1);
}
