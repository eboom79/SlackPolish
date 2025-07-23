#!/usr/bin/env node

/**
 * Test Vector Framework - Input/Output Testing for SlackPolish
 * Tests actual function behavior with predefined input/output pairs
 */

const fs = require('fs');
const path = require('path');

class TestVectorRunner {
    constructor() {
        this.totalTests = 0;
        this.passedTests = 0;
        this.failedTests = 0;
        this.testResults = [];
    }

    /**
     * Run a single test vector
     * @param {string} testName - Name of the test
     * @param {Function} testFunction - Function to test
     * @param {Array} testVectors - Array of {input, expected} objects
     */
    runTestVectors(testName, testFunction, testVectors) {
        console.log(`\n🧪 Testing: ${testName}`);
        console.log(`   Vectors: ${testVectors.length}`);

        let vectorsPassed = 0;
        let vectorsFailed = 0;

        testVectors.forEach((vector, index) => {
            this.totalTests++;
            try {
                const result = testFunction(vector.input);
                
                if (this.deepEqual(result, vector.expected)) {
                    vectorsPassed++;
                    this.passedTests++;
                    console.log(`   ✅ Vector ${index + 1}: PASSED`);
                } else {
                    vectorsFailed++;
                    this.failedTests++;
                    console.log(`   ❌ Vector ${index + 1}: FAILED`);
                    console.log(`      Input: ${JSON.stringify(vector.input)}`);
                    console.log(`      Expected: ${JSON.stringify(vector.expected)}`);
                    console.log(`      Got: ${JSON.stringify(result)}`);
                }
            } catch (error) {
                vectorsFailed++;
                this.failedTests++;
                console.log(`   ❌ Vector ${index + 1}: ERROR - ${error.message}`);
                console.log(`      Input: ${JSON.stringify(vector.input)}`);
            }
        });

        const result = {
            testName,
            totalVectors: testVectors.length,
            passed: vectorsPassed,
            failed: vectorsFailed,
            success: vectorsFailed === 0
        };

        this.testResults.push(result);

        if (vectorsFailed === 0) {
            console.log(`✅ ${testName}: ALL VECTORS PASSED (${vectorsPassed}/${testVectors.length})`);
        } else {
            console.log(`❌ ${testName}: ${vectorsFailed} VECTORS FAILED (${vectorsPassed}/${testVectors.length})`);
        }

        return result;
    }

    /**
     * Run async test vectors
     * @param {string} testName - Name of the test
     * @param {Function} testFunction - Async function to test
     * @param {Array} testVectors - Array of {input, expected} objects
     */
    async runAsyncTestVectors(testName, testFunction, testVectors) {
        console.log(`\n🧪 Testing: ${testName} (async)`);
        console.log(`   Vectors: ${testVectors.length}`);

        let vectorsPassed = 0;
        let vectorsFailed = 0;

        for (let index = 0; index < testVectors.length; index++) {
            const vector = testVectors[index];
            this.totalTests++;
            
            try {
                const result = await testFunction(vector.input);
                
                if (this.deepEqual(result, vector.expected)) {
                    vectorsPassed++;
                    this.passedTests++;
                    console.log(`   ✅ Vector ${index + 1}: PASSED`);
                } else {
                    vectorsFailed++;
                    this.failedTests++;
                    console.log(`   ❌ Vector ${index + 1}: FAILED`);
                    console.log(`      Input: ${JSON.stringify(vector.input)}`);
                    console.log(`      Expected: ${JSON.stringify(vector.expected)}`);
                    console.log(`      Got: ${JSON.stringify(result)}`);
                }
            } catch (error) {
                vectorsFailed++;
                this.failedTests++;
                console.log(`   ❌ Vector ${index + 1}: ERROR - ${error.message}`);
                console.log(`      Input: ${JSON.stringify(vector.input)}`);
            }
        }

        const result = {
            testName,
            totalVectors: testVectors.length,
            passed: vectorsPassed,
            failed: vectorsFailed,
            success: vectorsFailed === 0
        };

        this.testResults.push(result);

        if (vectorsFailed === 0) {
            console.log(`✅ ${testName}: ALL VECTORS PASSED (${vectorsPassed}/${testVectors.length})`);
        } else {
            console.log(`❌ ${testName}: ${vectorsFailed} VECTORS FAILED (${vectorsPassed}/${testVectors.length})`);
        }

        return result;
    }

    /**
     * Deep equality check for objects and arrays
     */
    deepEqual(a, b) {
        if (a === b) return true;
        
        if (a == null || b == null) return false;
        
        if (typeof a !== typeof b) return false;
        
        if (typeof a === 'object') {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            
            if (keysA.length !== keysB.length) return false;
            
            for (let key of keysA) {
                if (!keysB.includes(key)) return false;
                if (!this.deepEqual(a[key], b[key])) return false;
            }
            
            return true;
        }
        
        return false;
    }

    /**
     * Print test summary
     */
    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST VECTOR SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Test Vectors: ${this.totalTests}`);
        console.log(`✅ Passed: ${this.passedTests}`);
        console.log(`❌ Failed: ${this.failedTests}`);
        console.log(`📈 Success Rate: ${this.totalTests > 0 ? Math.round((this.passedTests / this.totalTests) * 100) : 0}%`);

        if (this.failedTests > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.testResults
                .filter(result => !result.success)
                .forEach(result => {
                    console.log(`   - ${result.testName}: ${result.failed}/${result.totalVectors} vectors failed`);
                });
        }

        if (this.passedTests === this.totalTests) {
            console.log('\n🎉 ALL TEST VECTORS PASSED!');
        } else {
            console.log('\n💥 Some test vectors failed. Check the output above for details.');
        }
    }

    /**
     * Get exit code based on test results
     */
    getExitCode() {
        return this.failedTests > 0 ? 1 : 0;
    }
}

module.exports = TestVectorRunner;
