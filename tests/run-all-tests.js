#!/usr/bin/env node

/**
 * Test Runner - Runs all JustPolish tests automatically
 * This allows batch testing without manual intervention
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class TestRunner {
    constructor() {
        this.totalTests = 0;
        this.passedTests = 0;
        this.failedTests = 0;
        this.testResults = [];
    }

    async findTestFiles(excludeChaos = false, excludeVectors = false) {
        const testFiles = [];
        let testDirs = ['unit', 'integration', 'installer', 'settings', 'ui', 'api', 'cross-platform', 'static'];

        // Add optional test directories based on filters
        if (!excludeVectors) {
            testDirs.push('vector');
        }
        if (!excludeChaos) {
            testDirs.push('chaos');
        }

        for (const dir of testDirs) {
            const dirPath = path.join(__dirname, dir);
            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath);
                for (const file of files) {
                    if (file.startsWith('test_') && file.endsWith('.js')) {
                        testFiles.push(path.join(dirPath, file));
                    }
                }
            }
        }

        // Add standalone test files in the tests root directory
        const rootTestFiles = [
            'test_hotkey_improvements_no_api.js',  // No API key required - safe for CI/CD
            'test-hotkey-improvements.js'          // Requires API key - manual testing only
        ];
        for (const file of rootTestFiles) {
            const filePath = path.join(__dirname, file);
            if (fs.existsSync(filePath)) {
                testFiles.push(filePath);
            }
        }

        return testFiles;
    }

    async runTest(testFile) {
        return new Promise((resolve) => {
            const testName = path.basename(testFile, '.js');
            console.log(`\n🧪 Running: ${testName}`);
            
            const child = spawn('node', [testFile], {
                stdio: 'pipe',
                cwd: path.dirname(testFile)
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
                    console.log(`✅ PASSED: ${testName}`);
                    this.passedTests++;
                } else {
                    console.log(`❌ FAILED: ${testName} (exit code: ${code})`);
                    if (stderr) {
                        console.log(`   Error: ${stderr.trim()}`);
                    }
                    // Tests report their assertions on stdout: show the tail so CI logs say what failed
                    const tail = stdout.trim().split('\n').filter(line => /FAILED|Error|Assertion|Traceback|Total|Results/.test(line)).slice(-25);
                    if (tail.length) {
                        console.log('   Output:');
                        tail.forEach(line => console.log(`   | ${line}`));
                    }
                    this.failedTests++;
                }

                this.testResults.push(result);
                this.totalTests++;
                resolve(result);
            });
        });
    }

    async runAllTests() {
        console.log('🚀 JustPolish Test Suite Runner');
        console.log('=====================================\n');

        const testFiles = await this.findTestFiles();

        if (testFiles.length === 0) {
            console.log('❌ No test files found!');
            process.exit(1);
        }

        console.log(`📋 Found ${testFiles.length} test files:`);
        testFiles.forEach(file => {
            console.log(`   - ${path.basename(file)}`);
        });

        console.log('\n🏃 Running tests...\n');

        // Run all tests
        for (const testFile of testFiles) {
            await this.runTest(testFile);
        }

        // Print summary
        this.printSummary();

        // Exit with appropriate code
        process.exit(this.failedTests > 0 ? 1 : 0);
    }

    async runFilteredTests(excludeChaos = false, excludeVectors = false) {
        let testTypeDescription = 'Filtered Test Suite';
        if (excludeChaos && excludeVectors) {
            testTypeDescription = 'Static Analysis Tests Only';
        } else if (excludeChaos) {
            testTypeDescription = 'Static Analysis + Test Vector Tests';
        } else if (excludeVectors) {
            testTypeDescription = 'Static Analysis + Chaos Tests';
        }

        console.log(`🚀 JustPolish ${testTypeDescription}`);
        console.log('=====================================\n');

        const testFiles = await this.findTestFiles(excludeChaos, excludeVectors);

        if (testFiles.length === 0) {
            console.log('❌ No test files found!');
            process.exit(1);
        }

        console.log(`📋 Found ${testFiles.length} test files:`);
        testFiles.forEach(file => {
            console.log(`   - ${path.basename(file)}`);
        });

        if (excludeChaos) {
            console.log('   🚫 Chaos tests excluded');
        }
        if (excludeVectors) {
            console.log('   🚫 Vector tests excluded');
        }

        console.log('\n🏃 Running tests...\n');

        // Run filtered tests
        for (const testFile of testFiles) {
            await this.runTest(testFile);
        }

        // Print summary
        this.printSummary();

        // Exit with appropriate code
        process.exit(this.failedTests > 0 ? 1 : 0);
    }

    printSummary() {
        console.log('\n' + '='.repeat(50));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(50));
        console.log(`Total Tests: ${this.totalTests}`);
        console.log(`✅ Passed: ${this.passedTests}`);
        console.log(`❌ Failed: ${this.failedTests}`);
        console.log(`📈 Success Rate: ${this.totalTests > 0 ? Math.round((this.passedTests / this.totalTests) * 100) : 0}%`);

        if (this.failedTests > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.testResults
                .filter(result => !result.passed)
                .forEach(result => {
                    console.log(`   - ${result.testName}`);
                });
        }

        if (this.passedTests === this.totalTests) {
            console.log('\n🎉 ALL TESTS PASSED!');
        } else {
            console.log('\n💥 Some tests failed. Check the output above for details.');
        }
    }

    async runSpecificTest(testName) {
        const testFiles = await this.findTestFiles();
        const testFile = testFiles.find(file => path.basename(file, '.js') === testName);
        
        if (!testFile) {
            console.log(`❌ Test not found: ${testName}`);
            process.exit(1);
        }

        await this.runTest(testFile);
        this.printSummary();
        process.exit(this.failedTests > 0 ? 1 : 0);
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    const runner = new TestRunner();

    // Parse command line arguments
    const excludeChaos = args.includes('--exclude-chaos');
    const excludeVectors = args.includes('--exclude-vectors');
    const testNameIndex = args.indexOf('--test');
    const helpRequested = args.includes('--help');

    if (helpRequested) {
        console.log('JustPolish Test Runner');
        console.log('Usage:');
        console.log('  node run-all-tests.js                    # Run all tests');
        console.log('  node run-all-tests.js --test NAME        # Run specific test');
        console.log('  node run-all-tests.js --exclude-chaos    # Exclude chaos tests');
        console.log('  node run-all-tests.js --exclude-vectors  # Exclude vector tests');
        console.log('  node run-all-tests.js --help             # Show this help');
        return;
    }

    if (testNameIndex !== -1 && args[testNameIndex + 1]) {
        // Run specific test
        await runner.runSpecificTest(args[testNameIndex + 1]);
    } else if (excludeChaos || excludeVectors) {
        // Run filtered tests
        await runner.runFilteredTests(excludeChaos, excludeVectors);
    } else if (args.length === 0) {
        // Run all tests
        await runner.runAllTests();
    } else {
        console.log('❌ Invalid arguments. Use --help for usage information.');
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Test runner error:', error);
        process.exit(1);
    });
}

module.exports = TestRunner;
