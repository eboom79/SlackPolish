#!/usr/bin/env node

/**
 * Unit Test: Error Handling
 * Tests error handling and user feedback mechanisms
 */

// Test framework
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`Assertion failed: ${message}\nExpected: ${expected}\nActual: ${actual}`);
    }
}

function assertContains(text, substring, message) {
    if (!text.includes(substring)) {
        throw new Error(`Assertion failed: ${message}\nText should contain: ${substring}\nActual text: ${text}`);
    }
}

class ErrorHandlingTests {
    constructor() {
        this.testCount = 0;
        this.passedCount = 0;
        this.failedCount = 0;
    }

    runTest(testName, testFunction) {
        this.testCount++;
        try {
            console.log(`🧪 Running: ${testName}`);
            testFunction();
            this.passedCount++;
            console.log(`✅ PASSED: ${testName}`);
        } catch (error) {
            this.failedCount++;
            console.log(`❌ FAILED: ${testName}`);
            console.log(`   Error: ${error.message}`);
        }
    }

    // Simulate error handling logic
    handleApiError(error) {
        if (!error) {
            return { message: 'Unknown error occurred', userFriendly: true };
        }

        if (error.status === 401) {
            return { 
                message: 'Invalid API key. Please check your OpenAI API key in settings.', 
                userFriendly: true,
                actionable: true
            };
        }

        if (error.status === 429) {
            return { 
                message: 'Rate limit exceeded. Please wait a moment and try again.', 
                userFriendly: true,
                retry: true
            };
        }

        if (error.status === 500) {
            return { 
                message: 'OpenAI service is temporarily unavailable. Please try again later.', 
                userFriendly: true,
                retry: true
            };
        }

        if (error.message && error.message.includes('network')) {
            return { 
                message: 'Network connection error. Please check your internet connection.', 
                userFriendly: true,
                retry: true
            };
        }

        if (error.message && error.message.includes('timeout')) {
            return { 
                message: 'Request timed out. Please try again.', 
                userFriendly: true,
                retry: true
            };
        }

        // Generic error fallback
        return { 
            message: `Error: ${error.message || 'Something went wrong'}`, 
            userFriendly: false,
            technical: true
        };
    }

    testApiKeyError() {
        const error = { status: 401, message: 'Unauthorized' };
        const result = this.handleApiError(error);
        
        assertContains(result.message, 'Invalid API key', 'Should mention API key issue');
        assert(result.userFriendly, 'Should be user-friendly');
        assert(result.actionable, 'Should be actionable');
    }

    testRateLimitError() {
        const error = { status: 429, message: 'Too Many Requests' };
        const result = this.handleApiError(error);
        
        assertContains(result.message, 'Rate limit', 'Should mention rate limit');
        assert(result.userFriendly, 'Should be user-friendly');
        assert(result.retry, 'Should suggest retry');
    }

    testServerError() {
        const error = { status: 500, message: 'Internal Server Error' };
        const result = this.handleApiError(error);
        
        assertContains(result.message, 'temporarily unavailable', 'Should mention service unavailability');
        assert(result.userFriendly, 'Should be user-friendly');
        assert(result.retry, 'Should suggest retry');
    }

    testNetworkError() {
        const error = { message: 'network connection failed' };
        const result = this.handleApiError(error);
        
        assertContains(result.message, 'Network connection', 'Should mention network issue');
        assertContains(result.message, 'internet connection', 'Should suggest checking internet');
        assert(result.userFriendly, 'Should be user-friendly');
        assert(result.retry, 'Should suggest retry');
    }

    testTimeoutError() {
        const error = { message: 'request timeout exceeded' };
        const result = this.handleApiError(error);
        
        assertContains(result.message, 'timed out', 'Should mention timeout');
        assert(result.userFriendly, 'Should be user-friendly');
        assert(result.retry, 'Should suggest retry');
    }

    testGenericError() {
        const error = { message: 'Something unexpected happened' };
        const result = this.handleApiError(error);
        
        assertContains(result.message, 'Something unexpected happened', 'Should include original message');
        assert(!result.userFriendly, 'Should not be marked as user-friendly');
        assert(result.technical, 'Should be marked as technical');
    }

    testNullError() {
        const result = this.handleApiError(null);
        
        assertContains(result.message, 'Unknown error', 'Should handle null error');
        assert(result.userFriendly, 'Should be user-friendly');
    }

    testUndefinedError() {
        const result = this.handleApiError(undefined);
        
        assertContains(result.message, 'Unknown error', 'Should handle undefined error');
        assert(result.userFriendly, 'Should be user-friendly');
    }

    testErrorWithoutMessage() {
        const error = { status: 400 };
        const result = this.handleApiError(error);
        
        assertContains(result.message, 'Something went wrong', 'Should provide fallback message');
    }

    testErrorWithEmptyMessage() {
        const error = { message: '' };
        const result = this.handleApiError(error);
        
        assertContains(result.message, 'Something went wrong', 'Should handle empty message');
    }

    // Simulate localStorage error handling
    handleStorageError(error) {
        if (error.name === 'QuotaExceededError') {
            return {
                message: 'Storage quota exceeded. Please clear some browser data.',
                userFriendly: true,
                actionable: true
            };
        }

        if (error.message && error.message.includes('localStorage')) {
            return {
                message: 'Unable to save settings. Please check if cookies/storage are enabled.',
                userFriendly: true,
                actionable: true
            };
        }

        return {
            message: `Storage error: ${error.message}`,
            userFriendly: false,
            technical: true
        };
    }

    testStorageQuotaError() {
        const error = { name: 'QuotaExceededError', message: 'Storage quota exceeded' };
        const result = this.handleStorageError(error);
        
        assertContains(result.message, 'Storage quota', 'Should mention storage quota');
        assertContains(result.message, 'clear some browser data', 'Should suggest clearing data');
        assert(result.userFriendly, 'Should be user-friendly');
        assert(result.actionable, 'Should be actionable');
    }

    testLocalStorageError() {
        const error = { message: 'localStorage is not available' };
        const result = this.handleStorageError(error);
        
        assertContains(result.message, 'save settings', 'Should mention settings saving');
        assertContains(result.message, 'cookies/storage', 'Should mention browser settings');
        assert(result.userFriendly, 'Should be user-friendly');
        assert(result.actionable, 'Should be actionable');
    }

    testGenericStorageError() {
        const error = { message: 'Unknown storage issue' };
        const result = this.handleStorageError(error);
        
        assertContains(result.message, 'Storage error', 'Should mention storage error');
        assertContains(result.message, 'Unknown storage issue', 'Should include original message');
        assert(!result.userFriendly, 'Should not be user-friendly');
        assert(result.technical, 'Should be technical');
    }

    runAllTests() {
        console.log('🚀 Starting Error Handling Tests\n');
        
        this.runTest('API key error', () => this.testApiKeyError());
        this.runTest('Rate limit error', () => this.testRateLimitError());
        this.runTest('Server error', () => this.testServerError());
        this.runTest('Network error', () => this.testNetworkError());
        this.runTest('Timeout error', () => this.testTimeoutError());
        this.runTest('Generic error', () => this.testGenericError());
        this.runTest('Null error', () => this.testNullError());
        this.runTest('Undefined error', () => this.testUndefinedError());
        this.runTest('Error without message', () => this.testErrorWithoutMessage());
        this.runTest('Error with empty message', () => this.testErrorWithEmptyMessage());
        this.runTest('Storage quota error', () => this.testStorageQuotaError());
        this.runTest('LocalStorage error', () => this.testLocalStorageError());
        this.runTest('Generic storage error', () => this.testGenericStorageError());
        
        console.log('\n📊 Test Results:');
        console.log(`   Total: ${this.testCount}`);
        console.log(`   ✅ Passed: ${this.passedCount}`);
        console.log(`   ❌ Failed: ${this.failedCount}`);
        
        if (this.failedCount === 0) {
            console.log('\n🎉 All tests passed!');
            process.exit(0);
        } else {
            console.log('\n💥 Some tests failed!');
            process.exit(1);
        }
    }
}

if (require.main === module) {
    const tests = new ErrorHandlingTests();
    tests.runAllTests();
}

module.exports = ErrorHandlingTests;
