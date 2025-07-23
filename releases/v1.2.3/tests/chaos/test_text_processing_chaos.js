#!/usr/bin/env node

/**
 * Chaos Tests for Text Processing Functions
 * Tests system stability with random, malformed, and malicious inputs
 */

const path = require('path');
const ChaosTestRunner = require('../framework/chaos-test-runner');

// Import the same text processor from vector tests
const { TextProcessor } = require('../vector/test_text_processing_vectors');

/**
 * Run chaos tests on text processing functions
 */
async function runTextProcessingChaosTests() {
    console.log('🌪️  SlackPolish Text Processing Chaos Tests');
    console.log('===========================================\n');

    const runner = new ChaosTestRunner({ 
        iterations: 200,  // More iterations for thorough testing
        seed: process.env.CHAOS_SEED || Date.now()
    });

    // Test 1: Text Anonymization with Random Strings
    runner.runChaosTest(
        'Text Anonymization - Random Strings',
        TextProcessor.anonymizeText,
        () => runner.generateRandomString({ 
            maxLength: 2000,
            includeUnicode: true,
            includeControlChars: true,
            includeEmojis: true
        }),
        { expectedType: 'string' }
    );

    // Test 2: Text Anonymization with Malicious Inputs
    runner.runChaosTest(
        'Text Anonymization - Malicious Inputs',
        TextProcessor.anonymizeText,
        () => runner.generateMaliciousInput(),
        { expectedType: 'string' }
    );

    // Test 3: Text Anonymization with Edge Cases
    runner.runChaosTest(
        'Text Anonymization - Edge Cases',
        TextProcessor.anonymizeText,
        () => {
            const edgeCases = [
                null,
                undefined,
                '',
                ' '.repeat(10000),
                '\n'.repeat(1000),
                '🔥'.repeat(500),
                'a@'.repeat(1000) + 'b.com',
                '@'.repeat(1000),
                'http://'.repeat(100) + 'example.com',
                '555-'.repeat(1000) + '1234',
                Buffer.from('binary data').toString(),
                JSON.stringify({ nested: { very: { deep: 'object' } } }),
                '<script>alert("xss")</script>'.repeat(100)
            ];
            return edgeCases[Math.floor(runner.rng() * edgeCases.length)];
        },
        { expectedType: 'string' }
    );

    // Test 4: Text Sanitization with Random Objects
    runner.runChaosTest(
        'Text Sanitization - Random Objects',
        TextProcessor.sanitizeText,
        () => runner.generateRandomObject(0, 2),
        { expectedType: 'string' }
    );

    // Test 5: Text Sanitization with Extreme Lengths
    runner.runChaosTest(
        'Text Sanitization - Extreme Lengths',
        TextProcessor.sanitizeText,
        () => {
            const length = Math.floor(runner.rng() * 50000);
            const char = String.fromCharCode(32 + Math.floor(runner.rng() * 95));
            return char.repeat(length);
        },
        { expectedType: 'string' }
    );

    // Test 6: Context Formatting with Random Data
    runner.runChaosTest(
        'Context Formatting - Random Data',
        (input) => TextProcessor.formatContextForAI(
            input.messages, 
            input.userMessage, 
            input.isThread
        ),
        () => {
            const messageCount = Math.floor(runner.rng() * 20);
            const messages = [];
            
            for (let i = 0; i < messageCount; i++) {
                messages.push({
                    time: runner.generateRandomString({ maxLength: 20 }),
                    sender: runner.generateRandomString({ maxLength: 50 }),
                    text: runner.generateRandomString({ maxLength: 500 })
                });
            }
            
            return {
                messages: runner.rng() < 0.3 ? null : messages, // 30% chance of null
                userMessage: runner.generateRandomString({ maxLength: 200 }),
                isThread: runner.rng() < 0.5
            };
        },
        { expectedType: 'string' }
    );

    // Test 7: Context Formatting with Malformed Messages
    runner.runChaosTest(
        'Context Formatting - Malformed Messages',
        (input) => TextProcessor.formatContextForAI(
            input.messages, 
            input.userMessage, 
            input.isThread
        ),
        () => {
            const malformedMessages = [
                // Missing properties
                [{ time: '10:30' }], // missing sender and text
                [{ sender: 'John' }], // missing time and text
                [{ text: 'Hello' }], // missing time and sender
                
                // Wrong types
                [{ time: 123, sender: null, text: undefined }],
                [{ time: {}, sender: [], text: 42 }],
                
                // Nested objects
                [{ time: { nested: 'object' }, sender: 'John', text: 'Hello' }],
                
                // Arrays as values
                [{ time: ['10', '30'], sender: ['John', 'Doe'], text: ['Hello', 'World'] }],
                
                // Very long values
                [{ 
                    time: 'x'.repeat(10000), 
                    sender: 'y'.repeat(10000), 
                    text: 'z'.repeat(10000) 
                }],
                
                // Special characters
                [{ time: '<>&"\'', sender: '\n\r\t', text: '\0\b\f' }]
            ];
            
            const messages = malformedMessages[Math.floor(runner.rng() * malformedMessages.length)];
            
            return {
                messages,
                userMessage: runner.generateRandomString({ maxLength: 100 }),
                isThread: runner.rng() < 0.5
            };
        },
        { expectedType: 'string' }
    );

    // Test 8: API Key Validation with Random Data
    runner.runChaosTest(
        'API Key Validation - Random Data',
        TextProcessor.validateApiKey,
        () => runner.generateRandomString({ 
            maxLength: 200,
            includeUnicode: true,
            includeControlChars: true
        }),
        { expectedType: 'object' }
    );

    // Test 9: API Key Validation with Injection Attempts
    runner.runChaosTest(
        'API Key Validation - Injection Attempts',
        TextProcessor.validateApiKey,
        () => {
            const injectionAttempts = [
                "sk-' OR '1'='1",
                "sk-<script>alert('xss')</script>",
                "sk-${process.env.SECRET}",
                "sk-`rm -rf /`",
                "sk-\"; DROP TABLE users; --",
                "sk-{{7*7}}",
                "sk-#{7*7}",
                "sk-<%= 7*7 %>",
                "sk-javascript:alert(1)",
                "sk-data:text/html,<script>alert(1)</script>",
                "sk-\x00\x01\x02\x03",
                "sk-\uFEFF\uFFFE",
                "sk-" + "A".repeat(10000),
                "sk-" + "\n".repeat(1000)
            ];
            return injectionAttempts[Math.floor(runner.rng() * injectionAttempts.length)];
        },
        { expectedType: 'object' }
    );

    // Test 10: All Functions with Completely Random Primitives
    const allFunctions = [
        { name: 'anonymizeText', func: TextProcessor.anonymizeText },
        { name: 'sanitizeText', func: TextProcessor.sanitizeText },
        { name: 'validateApiKey', func: TextProcessor.validateApiKey }
    ];

    allFunctions.forEach(({ name, func }) => {
        runner.runChaosTest(
            `${name} - Random Primitives`,
            func,
            () => runner.generateRandomPrimitive(),
            { expectedType: typeof func('test') }
        );
    });

    // Print comprehensive summary
    runner.printSummary();
    
    // Exit with appropriate code
    process.exit(runner.getExitCode());
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTextProcessingChaosTests().catch(error => {
        console.error('❌ Chaos test runner error:', error);
        process.exit(1);
    });
}

module.exports = { runTextProcessingChaosTests };
