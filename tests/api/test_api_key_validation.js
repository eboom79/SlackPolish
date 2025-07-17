#!/usr/bin/env node

/**
 * API Test: API Key Validation
 * Tests API key format validation and security
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

class ApiKeyValidationTests {
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

    // Simulate API key validation logic
    validateApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return { valid: false, error: 'API key must be a non-empty string' };
        }

        if (apiKey.trim().length === 0) {
            return { valid: false, error: 'API key cannot be empty or whitespace only' };
        }

        // OpenAI API keys typically start with 'sk-'
        if (!apiKey.startsWith('sk-')) {
            return { valid: false, error: 'API key must start with "sk-"' };
        }

        // Check minimum length (OpenAI keys are typically longer)
        if (apiKey.length < 20) {
            return { valid: false, error: 'API key is too short' };
        }

        // Check for suspicious patterns
        if (apiKey.includes(' ')) {
            return { valid: false, error: 'API key should not contain spaces' };
        }

        if (apiKey.includes('\n') || apiKey.includes('\r')) {
            return { valid: false, error: 'API key should not contain newlines' };
        }

        return { valid: true, error: null };
    }

    testValidApiKey() {
        const validKey = 'sk-proj-1234567890abcdef1234567890abcdef1234567890abcdef';
        const result = this.validateApiKey(validKey);
        
        assert(result.valid, 'Valid API key should pass validation');
        assertEqual(result.error, null, 'Valid API key should have no error');
    }

    testEmptyApiKey() {
        const result = this.validateApiKey('');
        
        assert(!result.valid, 'Empty API key should fail validation');
        assert(result.error.includes('empty'), 'Error should mention empty key');
    }

    testNullApiKey() {
        const result = this.validateApiKey(null);
        
        assert(!result.valid, 'Null API key should fail validation');
        assert(result.error.includes('non-empty string'), 'Error should mention string requirement');
    }

    testUndefinedApiKey() {
        const result = this.validateApiKey(undefined);
        
        assert(!result.valid, 'Undefined API key should fail validation');
        assert(result.error.includes('non-empty string'), 'Error should mention string requirement');
    }

    testNonStringApiKey() {
        const result = this.validateApiKey(12345);
        
        assert(!result.valid, 'Non-string API key should fail validation');
        assert(result.error.includes('string'), 'Error should mention string requirement');
    }

    testWhitespaceOnlyApiKey() {
        const result = this.validateApiKey('   \t\n   ');
        
        assert(!result.valid, 'Whitespace-only API key should fail validation');
        assert(result.error.includes('empty'), 'Error should mention empty key');
    }

    testInvalidPrefix() {
        const result = this.validateApiKey('invalid-1234567890abcdef1234567890abcdef');
        
        assert(!result.valid, 'API key without sk- prefix should fail validation');
        assert(result.error.includes('sk-'), 'Error should mention sk- prefix requirement');
    }

    testTooShortApiKey() {
        const result = this.validateApiKey('sk-short');
        
        assert(!result.valid, 'Too short API key should fail validation');
        assert(result.error.includes('short'), 'Error should mention length requirement');
    }

    testApiKeyWithSpaces() {
        const result = this.validateApiKey('sk-proj-1234 567890abcdef1234567890abcdef');
        
        assert(!result.valid, 'API key with spaces should fail validation');
        assert(result.error.includes('spaces'), 'Error should mention spaces');
    }

    testApiKeyWithNewlines() {
        const result = this.validateApiKey('sk-proj-1234567890abcdef\n1234567890abcdef');
        
        assert(!result.valid, 'API key with newlines should fail validation');
        assert(result.error.includes('newlines'), 'Error should mention newlines');
    }

    testApiKeyTrimming() {
        const keyWithWhitespace = '  sk-proj-1234567890abcdef1234567890abcdef1234567890abcdef  ';
        const result = this.validateApiKey(keyWithWhitespace.trim());
        
        assert(result.valid, 'Trimmed API key should be valid');
    }

    testVeryLongApiKey() {
        const longKey = 'sk-proj-' + 'a'.repeat(200);
        const result = this.validateApiKey(longKey);
        
        assert(result.valid, 'Very long API key should be valid');
    }

    testSpecialCharactersInApiKey() {
        const keyWithSpecialChars = 'sk-proj-1234567890abcdef!@#$%^&*()1234567890abcdef';
        const result = this.validateApiKey(keyWithSpecialChars);
        
        // This should be valid as OpenAI keys can contain various characters
        assert(result.valid, 'API key with special characters should be valid');
    }

    testCaseSensitivity() {
        const upperCaseKey = 'SK-PROJ-1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF';
        const result = this.validateApiKey(upperCaseKey);
        
        // This should fail because OpenAI keys start with lowercase 'sk-'
        assert(!result.valid, 'Uppercase SK- prefix should fail validation');
    }

    testBoundaryLength() {
        const exactMinLength = 'sk-' + 'a'.repeat(17); // Total 20 characters
        const result = this.validateApiKey(exactMinLength);
        
        assert(result.valid, 'API key at minimum length should be valid');
    }

    runAllTests() {
        console.log('🚀 Starting API Key Validation Tests\n');
        
        this.runTest('Valid API key', () => this.testValidApiKey());
        this.runTest('Empty API key', () => this.testEmptyApiKey());
        this.runTest('Null API key', () => this.testNullApiKey());
        this.runTest('Undefined API key', () => this.testUndefinedApiKey());
        this.runTest('Non-string API key', () => this.testNonStringApiKey());
        this.runTest('Whitespace-only API key', () => this.testWhitespaceOnlyApiKey());
        this.runTest('Invalid prefix', () => this.testInvalidPrefix());
        this.runTest('Too short API key', () => this.testTooShortApiKey());
        this.runTest('API key with spaces', () => this.testApiKeyWithSpaces());
        this.runTest('API key with newlines', () => this.testApiKeyWithNewlines());
        this.runTest('API key trimming', () => this.testApiKeyTrimming());
        this.runTest('Very long API key', () => this.testVeryLongApiKey());
        this.runTest('Special characters in API key', () => this.testSpecialCharactersInApiKey());
        this.runTest('Case sensitivity', () => this.testCaseSensitivity());
        this.runTest('Boundary length', () => this.testBoundaryLength());
        
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
    const tests = new ApiKeyValidationTests();
    tests.runAllTests();
}

module.exports = ApiKeyValidationTests;
