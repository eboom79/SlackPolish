#!/usr/bin/env node

/**
 * Regression test for protected entity helper wiring.
 * Ensures textImprover uses utils.hasProtectedEntities instead of an undefined this.hasProtectedEntities.
 */

const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, '../../slack-text-improver.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

console.log('🚀 Running Protected Entity Wiring Test');
console.log('=====================================\n');

try {
    assert(
        scriptContent.includes('if (utils.hasProtectedEntities(textState))'),
        'buildPrompt should call utils.hasProtectedEntities(textState)'
    );
    assert(
        !scriptContent.includes('if (this.hasProtectedEntities(textState))'),
        'buildPrompt should not call this.hasProtectedEntities(textState)'
    );

    console.log('✅ PASSED: Protected entity helper wiring is correct');
    process.exit(0);
} catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
    process.exit(1);
}
