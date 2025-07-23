#!/usr/bin/env node

/**
 * Installer Test: Command Line Arguments
 * Tests the command-line argument parsing for the installer
 */

const fs = require('fs');
const path = require('path');

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

class CommandLineArgsTests {
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

    // Simulate the argument parsing logic from the installer
    parseArguments(args) {
        const result = {
            resetSettings: false,
            resetApiKey: false,
            showHelp: false,
            errors: []
        };

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            
            if (arg === '--help' || arg === '-h') {
                result.showHelp = true;
            } else if (arg === '--reset-settings' || arg === '-s') {
                const nextArg = args[i + 1];
                if (nextArg === 'true') {
                    result.resetSettings = true;
                    i++; // Skip the next argument
                } else if (nextArg === 'false') {
                    result.resetSettings = false;
                    i++; // Skip the next argument
                } else {
                    result.errors.push(`Invalid value for ${arg}: ${nextArg}. Expected 'true' or 'false'.`);
                }
            } else if (arg === '--reset-api-key' || arg === '-k') {
                const nextArg = args[i + 1];
                if (nextArg === 'true') {
                    result.resetApiKey = true;
                    i++; // Skip the next argument
                } else if (nextArg === 'false') {
                    result.resetApiKey = false;
                    i++; // Skip the next argument
                } else {
                    result.errors.push(`Invalid value for ${arg}: ${nextArg}. Expected 'true' or 'false'.`);
                }
            } else {
                result.errors.push(`Unknown argument: ${arg}`);
            }
        }

        return result;
    }

    testNoArguments() {
        const result = this.parseArguments([]);
        
        assertEqual(result.resetSettings, false, 'Default resetSettings should be false');
        assertEqual(result.resetApiKey, false, 'Default resetApiKey should be false');
        assertEqual(result.showHelp, false, 'Default showHelp should be false');
        assertEqual(result.errors.length, 0, 'Should have no errors with no arguments');
    }

    testHelpFlag() {
        const result1 = this.parseArguments(['--help']);
        const result2 = this.parseArguments(['-h']);
        
        assertEqual(result1.showHelp, true, '--help should set showHelp to true');
        assertEqual(result2.showHelp, true, '-h should set showHelp to true');
    }

    testResetSettingsTrue() {
        const result1 = this.parseArguments(['--reset-settings', 'true']);
        const result2 = this.parseArguments(['-s', 'true']);
        
        assertEqual(result1.resetSettings, true, '--reset-settings true should work');
        assertEqual(result2.resetSettings, true, '-s true should work');
    }

    testResetSettingsFalse() {
        const result1 = this.parseArguments(['--reset-settings', 'false']);
        const result2 = this.parseArguments(['-s', 'false']);
        
        assertEqual(result1.resetSettings, false, '--reset-settings false should work');
        assertEqual(result2.resetSettings, false, '-s false should work');
    }

    testResetApiKeyTrue() {
        const result1 = this.parseArguments(['--reset-api-key', 'true']);
        const result2 = this.parseArguments(['-k', 'true']);
        
        assertEqual(result1.resetApiKey, true, '--reset-api-key true should work');
        assertEqual(result2.resetApiKey, true, '-k true should work');
    }

    testResetApiKeyFalse() {
        const result1 = this.parseArguments(['--reset-api-key', 'false']);
        const result2 = this.parseArguments(['-k', 'false']);
        
        assertEqual(result1.resetApiKey, false, '--reset-api-key false should work');
        assertEqual(result2.resetApiKey, false, '-k false should work');
    }

    testCombinedArguments() {
        const result = this.parseArguments(['-s', 'true', '-k', 'false']);
        
        assertEqual(result.resetSettings, true, 'Combined args: resetSettings should be true');
        assertEqual(result.resetApiKey, false, 'Combined args: resetApiKey should be false');
    }

    testAllTrueArguments() {
        const result = this.parseArguments(['--reset-settings', 'true', '--reset-api-key', 'true']);
        
        assertEqual(result.resetSettings, true, 'All true: resetSettings should be true');
        assertEqual(result.resetApiKey, true, 'All true: resetApiKey should be true');
    }

    testInvalidResetSettingsValue() {
        const result = this.parseArguments(['--reset-settings', 'invalid']);
        
        assert(result.errors.length > 0, 'Should have errors for invalid reset-settings value');
        assert(result.errors[0].includes('Invalid value'), 'Error should mention invalid value');
    }

    testInvalidResetApiKeyValue() {
        const result = this.parseArguments(['-k', 'maybe']);
        
        assert(result.errors.length > 0, 'Should have errors for invalid reset-api-key value');
        assert(result.errors[0].includes('Invalid value'), 'Error should mention invalid value');
    }

    testMissingValue() {
        const result1 = this.parseArguments(['--reset-settings']);
        const result2 = this.parseArguments(['-k']);
        
        assert(result1.errors.length > 0, 'Should have error when reset-settings value is missing');
        assert(result2.errors.length > 0, 'Should have error when reset-api-key value is missing');
    }

    testUnknownArgument() {
        const result = this.parseArguments(['--unknown-flag']);
        
        assert(result.errors.length > 0, 'Should have error for unknown argument');
        assert(result.errors[0].includes('Unknown argument'), 'Error should mention unknown argument');
    }

    testMixedValidAndInvalid() {
        const result = this.parseArguments(['-s', 'true', '--unknown', '-k', 'false']);
        
        assertEqual(result.resetSettings, true, 'Valid resetSettings should still work');
        assertEqual(result.resetApiKey, false, 'Valid resetApiKey should still work');
        assert(result.errors.length > 0, 'Should have error for unknown argument');
    }

    testCaseSensitivity() {
        const result = this.parseArguments(['--reset-settings', 'TRUE']);
        
        // This should fail because we expect exact 'true'/'false'
        assert(result.errors.length > 0, 'Should reject uppercase TRUE');
    }

    testArgumentOrder() {
        const result1 = this.parseArguments(['-s', 'true', '-k', 'false']);
        const result2 = this.parseArguments(['-k', 'false', '-s', 'true']);
        
        assertEqual(result1.resetSettings, result2.resetSettings, 'Order should not matter for resetSettings');
        assertEqual(result1.resetApiKey, result2.resetApiKey, 'Order should not matter for resetApiKey');
    }

    testHelpWithOtherArgs() {
        const result = this.parseArguments(['--help', '-s', 'true']);
        
        assertEqual(result.showHelp, true, 'Help flag should be recognized');
        // The behavior with other args when help is present may vary
    }

    runAllTests() {
        console.log('🚀 Starting Command Line Arguments Tests\n');
        
        this.runTest('No arguments', () => this.testNoArguments());
        this.runTest('Help flag', () => this.testHelpFlag());
        this.runTest('Reset settings true', () => this.testResetSettingsTrue());
        this.runTest('Reset settings false', () => this.testResetSettingsFalse());
        this.runTest('Reset API key true', () => this.testResetApiKeyTrue());
        this.runTest('Reset API key false', () => this.testResetApiKeyFalse());
        this.runTest('Combined arguments', () => this.testCombinedArguments());
        this.runTest('All true arguments', () => this.testAllTrueArguments());
        this.runTest('Invalid reset settings value', () => this.testInvalidResetSettingsValue());
        this.runTest('Invalid reset API key value', () => this.testInvalidResetApiKeyValue());
        this.runTest('Missing value', () => this.testMissingValue());
        this.runTest('Unknown argument', () => this.testUnknownArgument());
        this.runTest('Mixed valid and invalid', () => this.testMixedValidAndInvalid());
        this.runTest('Case sensitivity', () => this.testCaseSensitivity());
        this.runTest('Argument order', () => this.testArgumentOrder());
        this.runTest('Help with other args', () => this.testHelpWithOtherArgs());
        
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
    const tests = new CommandLineArgsTests();
    tests.runAllTests();
}

module.exports = CommandLineArgsTests;
