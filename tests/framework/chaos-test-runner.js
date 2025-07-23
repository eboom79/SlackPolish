#!/usr/bin/env node

/**
 * Chaos Test Framework - Random Input Testing for SlackPolish
 * Tests system stability with randomized, malformed, and edge case inputs
 */

const crypto = require('crypto');

class ChaosTestRunner {
    constructor(options = {}) {
        this.iterations = options.iterations || 100;
        this.seed = options.seed || Date.now();
        this.totalTests = 0;
        this.passedTests = 0;
        this.failedTests = 0;
        this.crashedTests = 0;
        this.testResults = [];
        
        // Initialize random number generator with seed for reproducibility
        this.rng = this.createSeededRandom(this.seed);
        
        console.log(`🌪️  Chaos Testing initialized with seed: ${this.seed}`);
    }

    /**
     * Create a seeded random number generator for reproducible tests
     */
    createSeededRandom(seed) {
        let state = seed;
        return function() {
            state = (state * 1664525 + 1013904223) % Math.pow(2, 32);
            return state / Math.pow(2, 32);
        };
    }

    /**
     * Generate random string with various characteristics
     */
    generateRandomString(options = {}) {
        const minLength = options.minLength || 0;
        const maxLength = options.maxLength || 1000;
        const includeUnicode = options.includeUnicode !== false;
        const includeControlChars = options.includeControlChars !== false;
        const includeEmojis = options.includeEmojis !== false;
        
        const length = Math.floor(this.rng() * (maxLength - minLength)) + minLength;
        let result = '';
        
        for (let i = 0; i < length; i++) {
            const charType = Math.floor(this.rng() * 10);
            
            if (charType < 5) {
                // Regular ASCII characters
                result += String.fromCharCode(32 + Math.floor(this.rng() * 95));
            } else if (charType < 7 && includeUnicode) {
                // Unicode characters
                result += String.fromCharCode(128 + Math.floor(this.rng() * 1000));
            } else if (charType < 8 && includeControlChars) {
                // Control characters
                const controlChars = ['\n', '\r', '\t', '\0', '\b', '\f', '\v'];
                result += controlChars[Math.floor(this.rng() * controlChars.length)];
            } else if (charType < 9 && includeEmojis) {
                // Emojis
                const emojis = ['😀', '🚀', '💥', '🔥', '⚡', '🌪️', '🎯', '🐛', '✅', '❌'];
                result += emojis[Math.floor(this.rng() * emojis.length)];
            } else {
                // Special characters that might break parsing
                const specialChars = ['<', '>', '"', "'", '&', '{', '}', '[', ']', '\\', '/', '|', '`'];
                result += specialChars[Math.floor(this.rng() * specialChars.length)];
            }
        }
        
        return result;
    }

    /**
     * Generate random object with nested structures
     */
    generateRandomObject(depth = 0, maxDepth = 3) {
        if (depth >= maxDepth) {
            return this.generateRandomPrimitive();
        }
        
        const objectType = Math.floor(this.rng() * 4);
        
        if (objectType === 0) {
            // Array
            const length = Math.floor(this.rng() * 10);
            const arr = [];
            for (let i = 0; i < length; i++) {
                arr.push(this.generateRandomObject(depth + 1, maxDepth));
            }
            return arr;
        } else if (objectType === 1) {
            // Object
            const obj = {};
            const keyCount = Math.floor(this.rng() * 8);
            for (let i = 0; i < keyCount; i++) {
                const key = this.generateRandomString({ maxLength: 20 });
                obj[key] = this.generateRandomObject(depth + 1, maxDepth);
            }
            return obj;
        } else {
            return this.generateRandomPrimitive();
        }
    }

    /**
     * Generate random primitive values
     */
    generateRandomPrimitive() {
        const type = Math.floor(this.rng() * 8);
        
        switch (type) {
            case 0: return null;
            case 1: return undefined;
            case 2: return this.rng() < 0.5;
            case 3: return Math.floor(this.rng() * 1000000) - 500000;
            case 4: return (this.rng() - 0.5) * 1000000;
            case 5: return this.generateRandomString({ maxLength: 100 });
            case 6: return NaN;
            case 7: return this.rng() < 0.5 ? Infinity : -Infinity;
            default: return this.generateRandomString({ maxLength: 50 });
        }
    }

    /**
     * Generate malicious/edge case inputs
     */
    generateMaliciousInput() {
        const maliciousInputs = [
            // SQL injection attempts
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            
            // XSS attempts
            "<script>alert('xss')</script>",
            "javascript:alert('xss')",
            
            // Path traversal
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32",
            
            // Buffer overflow attempts
            "A".repeat(10000),
            "\x00".repeat(1000),
            
            // JSON injection
            '{"test": "value", "malicious": {"__proto__": {"isAdmin": true}}}',
            
            // Unicode exploits
            "\u0000\u0001\u0002\u0003",
            "\uFEFF\uFFFE\uFFFF",
            
            // Format string attacks
            "%s%s%s%s%s%s%s%s%s%s",
            "%x%x%x%x%x%x%x%x%x%x",
            
            // Regex DoS
            "a".repeat(1000) + "X",
            
            // Extremely long strings
            "test".repeat(100000),
            
            // Binary data
            Buffer.from([0, 1, 2, 3, 255, 254, 253]).toString(),
            
            // Empty and whitespace variations
            "",
            " ",
            "\t\n\r",
            "\u00A0\u2000\u2001\u2002\u2003"
        ];
        
        return maliciousInputs[Math.floor(this.rng() * maliciousInputs.length)];
    }

    /**
     * Run chaos test on a function
     */
    runChaosTest(testName, testFunction, inputGenerator, options = {}) {
        console.log(`\n🌪️  Chaos Testing: ${testName}`);
        console.log(`   Iterations: ${this.iterations}`);
        
        let passed = 0;
        let failed = 0;
        let crashed = 0;
        const failures = [];
        const crashes = [];
        
        for (let i = 0; i < this.iterations; i++) {
            this.totalTests++;
            
            try {
                const input = inputGenerator();
                const result = testFunction(input);
                
                // Check if function returned something reasonable
                if (this.isReasonableOutput(result, options)) {
                    passed++;
                    this.passedTests++;
                } else {
                    failed++;
                    this.failedTests++;
                    failures.push({
                        iteration: i + 1,
                        input: this.truncateForDisplay(input),
                        output: this.truncateForDisplay(result),
                        reason: 'Unreasonable output'
                    });
                }
            } catch (error) {
                crashed++;
                this.crashedTests++;
                crashes.push({
                    iteration: i + 1,
                    input: this.truncateForDisplay(inputGenerator()),
                    error: error.message,
                    stack: error.stack
                });
            }
        }
        
        const result = {
            testName,
            iterations: this.iterations,
            passed,
            failed,
            crashed,
            failures,
            crashes,
            success: crashed === 0 && failed < this.iterations * 0.1 // Allow 10% failure rate
        };
        
        this.testResults.push(result);
        
        // Report results
        console.log(`   ✅ Stable: ${passed}/${this.iterations} (${Math.round(passed/this.iterations*100)}%)`);
        console.log(`   ⚠️  Failed: ${failed}/${this.iterations} (${Math.round(failed/this.iterations*100)}%)`);
        console.log(`   💥 Crashed: ${crashed}/${this.iterations} (${Math.round(crashed/this.iterations*100)}%)`);
        
        if (crashed > 0) {
            console.log(`   🚨 CRITICAL: Function crashed ${crashed} times!`);
            crashes.slice(0, 3).forEach(crash => {
                console.log(`      Crash ${crash.iteration}: ${crash.error}`);
                console.log(`      Input: ${crash.input}`);
            });
        }
        
        if (failed > this.iterations * 0.2) {
            console.log(`   ⚠️  WARNING: High failure rate (${Math.round(failed/this.iterations*100)}%)`);
        }
        
        return result;
    }

    /**
     * Check if output is reasonable (doesn't crash, returns expected type, etc.)
     */
    isReasonableOutput(output, options = {}) {
        // Function didn't crash, which is good
        if (options.expectedType) {
            return typeof output === options.expectedType;
        }
        
        // For most functions, any non-crashing output is acceptable
        return true;
    }

    /**
     * Truncate long inputs/outputs for display
     */
    truncateForDisplay(value, maxLength = 100) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        
        const str = typeof value === 'string' ? value : JSON.stringify(value);
        if (str.length <= maxLength) return str;
        
        return str.substring(0, maxLength) + '...';
    }

    /**
     * Print comprehensive test summary
     */
    printSummary() {
        console.log('\n' + '='.repeat(70));
        console.log('🌪️  CHAOS TEST SUMMARY');
        console.log('='.repeat(70));
        console.log(`Seed: ${this.seed} (use this to reproduce results)`);
        console.log(`Total Iterations: ${this.totalTests}`);
        console.log(`✅ Stable: ${this.passedTests} (${Math.round(this.passedTests/this.totalTests*100)}%)`);
        console.log(`⚠️  Failed: ${this.failedTests} (${Math.round(this.failedTests/this.totalTests*100)}%)`);
        console.log(`💥 Crashed: ${this.crashedTests} (${Math.round(this.crashedTests/this.totalTests*100)}%)`);
        
        const criticalIssues = this.testResults.filter(r => r.crashed > 0);
        const highFailureRate = this.testResults.filter(r => r.failed > r.iterations * 0.2);
        
        if (criticalIssues.length > 0) {
            console.log('\n🚨 CRITICAL ISSUES (Functions that crashed):');
            criticalIssues.forEach(result => {
                console.log(`   - ${result.testName}: ${result.crashed} crashes`);
            });
        }
        
        if (highFailureRate.length > 0) {
            console.log('\n⚠️  HIGH FAILURE RATES:');
            highFailureRate.forEach(result => {
                console.log(`   - ${result.testName}: ${Math.round(result.failed/result.iterations*100)}% failure rate`);
            });
        }
        
        const overallStability = Math.round((this.passedTests / this.totalTests) * 100);
        
        if (this.crashedTests === 0 && overallStability >= 80) {
            console.log('\n🎉 SYSTEM APPEARS STABLE UNDER CHAOS CONDITIONS!');
        } else if (this.crashedTests === 0) {
            console.log('\n⚠️  SYSTEM IS STABLE BUT HAS HIGH FAILURE RATES');
        } else {
            console.log('\n🚨 SYSTEM HAS CRITICAL STABILITY ISSUES');
        }
        
        console.log(`\nOverall Stability Score: ${overallStability}%`);
    }

    /**
     * Get exit code based on results
     */
    getExitCode() {
        // Exit with error if there are crashes or very high failure rates
        return this.crashedTests > 0 || (this.failedTests / this.totalTests) > 0.5 ? 1 : 0;
    }
}

module.exports = ChaosTestRunner;
