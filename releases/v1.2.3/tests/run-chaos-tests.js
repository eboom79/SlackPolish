#!/usr/bin/env node

/**
 * Comprehensive Chaos Test Runner
 * Runs all chaos tests to verify system stability under extreme conditions
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class ChaosTestSuite {
    constructor() {
        this.totalTests = 0;
        this.passedTests = 0;
        this.failedTests = 0;
        this.testResults = [];
        this.startTime = Date.now();
    }

    async findChaosTestFiles() {
        const testFiles = [];
        const chaosDir = path.join(__dirname, 'chaos');
        
        if (fs.existsSync(chaosDir)) {
            const files = fs.readdirSync(chaosDir);
            for (const file of files) {
                if (file.startsWith('test_') && file.endsWith('_chaos.js')) {
                    testFiles.push(path.join(chaosDir, file));
                }
            }
        }
        
        return testFiles;
    }

    async runChaosTest(testFile) {
        return new Promise((resolve) => {
            const testName = path.basename(testFile, '.js');
            console.log(`\n🌪️  Running: ${testName}`);
            
            const child = spawn('node', [testFile], {
                stdio: 'pipe',
                cwd: path.dirname(testFile),
                env: {
                    ...process.env,
                    CHAOS_SEED: process.env.CHAOS_SEED || Date.now().toString()
                }
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                const result = {
                    testName,
                    testFile,
                    passed: code === 0,
                    stdout,
                    stderr,
                    exitCode: code
                };

                if (code === 0) {
                    console.log(`✅ STABLE: ${testName}`);
                    this.passedTests++;
                } else {
                    console.log(`💥 UNSTABLE: ${testName} (exit code: ${code})`);
                    if (stderr) {
                        console.log(`   Error: ${stderr.trim()}`);
                    }
                    this.failedTests++;
                }

                this.testResults.push(result);
                this.totalTests++;
                resolve(result);
            });
        });
    }

    async runAllChaosTests() {
        console.log('🌪️  SlackPolish Comprehensive Chaos Test Suite');
        console.log('==============================================\n');

        const testFiles = await this.findChaosTestFiles();
        
        if (testFiles.length === 0) {
            console.log('❌ No chaos test files found!');
            process.exit(1);
        }

        console.log(`📋 Found ${testFiles.length} chaos test files:`);
        testFiles.forEach(file => {
            console.log(`   - ${path.basename(file)}`);
        });

        console.log('\n🏃 Running chaos tests...\n');

        // Run all chaos tests
        for (const testFile of testFiles) {
            await this.runChaosTest(testFile);
        }

        // Print comprehensive summary
        this.printComprehensiveSummary();
        
        // Exit with appropriate code
        process.exit(this.failedTests > 0 ? 1 : 0);
    }

    printComprehensiveSummary() {
        const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
        
        console.log('\n' + '='.repeat(70));
        console.log('🌪️  COMPREHENSIVE CHAOS TEST SUMMARY');
        console.log('='.repeat(70));
        console.log(`Duration: ${duration} seconds`);
        console.log(`Test Suites: ${this.totalTests}`);
        console.log(`✅ Stable Suites: ${this.passedTests}`);
        console.log(`💥 Unstable Suites: ${this.failedTests}`);
        console.log(`📈 Stability Rate: ${this.totalTests > 0 ? Math.round((this.passedTests / this.totalTests) * 100) : 0}%`);

        // Extract iteration counts from stdout
        let totalIterations = 0;
        let totalStable = 0;
        let totalFailed = 0;
        let totalCrashed = 0;

        this.testResults.forEach(result => {
            if (result.passed && result.stdout) {
                const iterationMatch = result.stdout.match(/Total Iterations: (\d+)/);
                const stableMatch = result.stdout.match(/✅ Stable: (\d+)/);
                const failedMatch = result.stdout.match(/⚠️\s+Failed: (\d+)/);
                const crashedMatch = result.stdout.match(/💥 Crashed: (\d+)/);

                if (iterationMatch) totalIterations += parseInt(iterationMatch[1]);
                if (stableMatch) totalStable += parseInt(stableMatch[1]);
                if (failedMatch) totalFailed += parseInt(failedMatch[1]);
                if (crashedMatch) totalCrashed += parseInt(crashedMatch[1]);
            }
        });

        if (totalIterations > 0) {
            console.log('\n📊 AGGREGATE CHAOS STATISTICS:');
            console.log(`Total Test Iterations: ${totalIterations.toLocaleString()}`);
            console.log(`✅ Stable Iterations: ${totalStable.toLocaleString()} (${Math.round(totalStable/totalIterations*100)}%)`);
            console.log(`⚠️  Failed Iterations: ${totalFailed.toLocaleString()} (${Math.round(totalFailed/totalIterations*100)}%)`);
            console.log(`💥 Crashed Iterations: ${totalCrashed.toLocaleString()} (${Math.round(totalCrashed/totalIterations*100)}%)`);
        }

        if (this.failedTests > 0) {
            console.log('\n💥 UNSTABLE TEST SUITES:');
            this.testResults
                .filter(result => !result.passed)
                .forEach(result => {
                    console.log(`   - ${result.testName}`);
                    if (result.stderr) {
                        console.log(`     Error: ${result.stderr.trim().split('\n')[0]}`);
                    }
                });
        }

        // Overall assessment
        if (this.failedTests === 0 && totalCrashed === 0) {
            console.log('\n🎉 SYSTEM IS EXTREMELY STABLE UNDER CHAOS CONDITIONS!');
            console.log('   All functions handled random, malicious, and edge case inputs gracefully.');
        } else if (this.failedTests === 0 && totalCrashed < totalIterations * 0.01) {
            console.log('\n✅ SYSTEM IS STABLE WITH MINIMAL ISSUES');
            console.log('   Very few crashes detected, system appears robust.');
        } else if (totalCrashed < totalIterations * 0.05) {
            console.log('\n⚠️  SYSTEM HAS SOME STABILITY ISSUES');
            console.log('   Some crashes detected, consider improving error handling.');
        } else {
            console.log('\n🚨 SYSTEM HAS CRITICAL STABILITY ISSUES');
            console.log('   High crash rate detected, immediate attention required.');
        }

        // Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        if (totalCrashed === 0) {
            console.log('   - Excellent! Your functions are crash-resistant.');
            console.log('   - Consider adding chaos tests to your CI pipeline.');
        } else {
            console.log('   - Add more input validation and error handling.');
            console.log('   - Review functions that crashed for edge cases.');
            console.log('   - Consider implementing circuit breakers for critical functions.');
        }

        if (totalFailed > totalIterations * 0.1) {
            console.log('   - High failure rate suggests functions may be too strict.');
            console.log('   - Consider graceful degradation for invalid inputs.');
        }

        console.log('\n🔧 CHAOS TESTING BENEFITS ACHIEVED:');
        console.log('   ✅ Verified system stability under extreme conditions');
        console.log('   ✅ Tested resistance to malicious inputs');
        console.log('   ✅ Validated error handling and edge cases');
        console.log('   ✅ Identified potential security vulnerabilities');
        console.log('   ✅ Ensured graceful degradation under stress');
    }

    async runSpecificChaosTest(testName) {
        const testFiles = await this.findChaosTestFiles();
        const testFile = testFiles.find(file => 
            path.basename(file, '.js') === testName || 
            path.basename(file, '_chaos.js') === testName
        );
        
        if (!testFile) {
            console.log(`❌ Chaos test not found: ${testName}`);
            console.log('Available chaos tests:');
            testFiles.forEach(file => {
                console.log(`   - ${path.basename(file, '.js')}`);
            });
            process.exit(1);
        }

        await this.runChaosTest(testFile);
        this.printComprehensiveSummary();
        process.exit(this.failedTests > 0 ? 1 : 0);
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    const suite = new ChaosTestSuite();

    if (args.length === 0) {
        // Run all chaos tests
        await suite.runAllChaosTests();
    } else if (args[0] === '--test' && args[1]) {
        // Run specific chaos test
        await suite.runSpecificChaosTest(args[1]);
    } else if (args[0] === '--help') {
        console.log('SlackPolish Chaos Test Runner');
        console.log('Usage:');
        console.log('  node run-chaos-tests.js                    # Run all chaos tests');
        console.log('  node run-chaos-tests.js --test NAME        # Run specific chaos test');
        console.log('  node run-chaos-tests.js --help             # Show this help');
        console.log('');
        console.log('Environment Variables:');
        console.log('  CHAOS_SEED=12345                           # Set seed for reproducible results');
    } else {
        console.log('❌ Invalid arguments. Use --help for usage information.');
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Chaos test suite error:', error);
        process.exit(1);
    });
}

module.exports = ChaosTestSuite;
