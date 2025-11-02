/**
 * Unit Tests for Tone Polish Native American English Speaker Feature
 * 
 * Tests that the TONE_POLISH style prompt includes instructions for
 * native American English speaker phrasing and expressions.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Read the config file
const configPath = path.join(__dirname, '../../slack-config.js');
const configContent = fs.readFileSync(configPath, 'utf8');

// Extract the TONE_POLISH prompt using regex
const tonePolishMatch = configContent.match(/TONE_POLISH:\s*'([^']+)'/);

if (!tonePolishMatch) {
    console.error('❌ Could not find TONE_POLISH prompt in config file');
    process.exit(1);
}

const tonePolishPrompt = tonePolishMatch[1];

// Test Suite
const tests = [
    {
        name: 'TONE_POLISH prompt exists',
        test: () => {
            assert.ok(tonePolishPrompt, 'TONE_POLISH prompt should exist');
            assert.ok(tonePolishPrompt.length > 0, 'TONE_POLISH prompt should not be empty');
        }
    },
    {
        name: 'Includes native American English speaker instruction',
        test: () => {
            assert.ok(
                tonePolishPrompt.toLowerCase().includes('native american english speaker'),
                'Prompt should mention "native American English speaker"'
            );
        }
    },
    {
        name: 'Includes natural expressions instruction',
        test: () => {
            assert.ok(
                tonePolishPrompt.toLowerCase().includes('natural') && 
                (tonePolishPrompt.toLowerCase().includes('expression') || 
                 tonePolishPrompt.toLowerCase().includes('phrasing')),
                'Prompt should mention natural expressions or phrasing'
            );
        }
    },
    {
        name: 'Includes American English idioms instruction',
        test: () => {
            assert.ok(
                tonePolishPrompt.toLowerCase().includes('american english') &&
                (tonePolishPrompt.toLowerCase().includes('idiom') || 
                 tonePolishPrompt.toLowerCase().includes('expression')),
                'Prompt should mention American English idioms or expressions'
            );
        }
    },
    {
        name: 'Preserves tone and length requirement',
        test: () => {
            assert.ok(
                tonePolishPrompt.toLowerCase().includes('tone') &&
                tonePolishPrompt.toLowerCase().includes('length'),
                'Prompt should preserve tone and length'
            );
        }
    },
    {
        name: 'Includes line structure preservation (no empty lines)',
        test: () => {
            assert.ok(
                tonePolishPrompt.toLowerCase().includes('empty line') ||
                tonePolishPrompt.toLowerCase().includes('line break'),
                'Prompt should mention preserving line structure'
            );
        }
    },
    {
        name: 'Includes "Return ONLY the improved text" instruction',
        test: () => {
            assert.ok(
                tonePolishPrompt.includes('Return ONLY the improved text'),
                'Prompt should include "Return ONLY the improved text" instruction'
            );
        }
    },
    {
        name: 'Includes fluent/natural language instruction',
        test: () => {
            assert.ok(
                tonePolishPrompt.toLowerCase().includes('fluent') ||
                tonePolishPrompt.toLowerCase().includes('natural'),
                'Prompt should mention fluent or natural language'
            );
        }
    }
];

// Run all tests
console.log('🧪 Running Tone Polish Native Speaker Tests...\n');
console.log('📝 Current TONE_POLISH Prompt:');
console.log(`"${tonePolishPrompt}"\n`);

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
    try {
        test.test();
        console.log(`✅ Test ${index + 1}: ${test.name}`);
        passed++;
    } catch (error) {
        console.log(`❌ Test ${index + 1}: ${test.name}`);
        console.log(`   Error: ${error.message}\n`);
        failed++;
    }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`📊 Test Results: ${passed} passed, ${failed} failed out of ${tests.length} total`);
console.log('='.repeat(50));

if (failed === 0) {
    console.log('✅ All tests passed!');
    console.log('\n💡 The TONE_POLISH style is configured to make text sound like');
    console.log('   a native American English speaker with natural expressions!');
    process.exit(0);
} else {
    console.log('❌ Some tests failed!');
    process.exit(1);
}

