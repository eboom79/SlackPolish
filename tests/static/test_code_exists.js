#!/usr/bin/env node

// Static Code Analysis Tests
// Tests that critical functionality exists in production files
// This catches missing implementations that unit tests might miss

const fs = require('fs');
const path = require('path');

function assert(condition, message) {
    if (!condition) {
        throw new Error(`❌ ASSERTION FAILED: ${message}`);
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`❌ ASSERTION FAILED: ${message}. Expected: ${expected}, Got: ${actual}`);
    }
}

class StaticCodeAnalysisTests {
    constructor() {
        this.rootDir = path.join(__dirname, '../..');
        this.testResults = [];
    }

    // Test that reset functionality exists in production code
    testResetFunctionalityExists() {
        console.log('🔍 Testing: Reset functionality exists in production code');
        
        const filePath = path.join(this.rootDir, 'slack-text-improver.js');
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Test 1: Reset settings logic exists
        assert(content.includes('RESET_SAVED_SETTINGS'), 
            'RESET_SAVED_SETTINGS logic missing from slack-text-improver.js');
        
        // Test 2: Reset API key logic exists
        assert(content.includes('RESET_API_KEY'), 
            'RESET_API_KEY logic missing from slack-text-improver.js');
        
        // Test 3: localStorage reset operations exist
        assert(content.includes('localStorage.removeItem'), 
            'localStorage.removeItem operations missing from slack-text-improver.js');
        
        // Test 4: Version tracking exists
        assert(content.includes('slackpolish-last-settings-reset-version'), 
            'Settings reset version tracking missing from slack-text-improver.js');
        
        assert(content.includes('slackpolish-last-apikey-reset-version'), 
            'API key reset version tracking missing from slack-text-improver.js');
        
        // Test 5: Reset logic is in loadSettings function
        const loadSettingsMatch = content.match(/function loadSettings\(\) \{([\s\S]*?)\n    \}/);
        assert(loadSettingsMatch, 'loadSettings function not found');
        
        const loadSettingsContent = loadSettingsMatch[1];
        assert(loadSettingsContent.includes('RESET_SAVED_SETTINGS'), 
            'Reset logic not found in loadSettings function');
        
        console.log('✅ Reset functionality exists in production code');
        return true;
    }

    // Test that critical functions exist
    testCriticalFunctionsExist() {
        console.log('🔍 Testing: Critical functions exist in production files');
        
        const filePath = path.join(this.rootDir, 'slack-text-improver.js');
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Test core functions exist. Match signatures loosely so adding
        // optional parameters does not break this existence check.
        const requiredFunctions = [
            { name: 'loadSettings', pattern: /function\s+loadSettings\s*\([^)]*\)\s*\{/ },
            { name: 'textImprover.improveText', pattern: /(?:async\s+)?improveText\s*\(\s*originalText(?:\s*,[^)]*)?\)\s*\{/ },
            { name: 'init', pattern: /function\s+init\s*\([^)]*\)\s*\{/ },
            { name: 'setupEventListeners', pattern: /function\s+setupEventListeners\s*\([^)]*\)\s*\{/ }
        ];

        requiredFunctions.forEach(func => {
            assert(func.pattern.test(content),
                `Critical function missing: ${func.name}`);
        });
        
        console.log('✅ All critical functions exist');
        return true;
    }

    // Test config parameters are actually used
    testConfigParametersUsed() {
        console.log('🔍 Testing: Config parameters are used in production code');
        
        const configPath = path.join(this.rootDir, 'slack-config.js');
        const improverPath = path.join(this.rootDir, 'slack-text-improver.js');
        const settingsPath = path.join(this.rootDir, 'slack-settings.js');
        const summaryPath = path.join(this.rootDir, 'slack-channel-summary.js');
        
        const configContent = fs.readFileSync(configPath, 'utf8');
        const improverContent = fs.readFileSync(improverPath, 'utf8');
        const settingsContent = fs.readFileSync(settingsPath, 'utf8');
        const summaryContent = fs.readFileSync(summaryPath, 'utf8');
        
        const allProductionCode = improverContent + settingsContent + summaryContent;
        
        // Extract config parameters (simple regex approach)
        const configParams = [
            'RESET_SAVED_SETTINGS',
            'RESET_API_KEY',
            'OPENAI_MODEL',
            'OPENAI_MAX_TOKENS',
            'OPENAI_TEMPERATURE',
            'CHANNEL_SUMMARY_TEMPERATURE',
            'SUPPORTED_LANGUAGES',
            'AVAILABLE_STYLES',
            'AVAILABLE_HOTKEYS',
            'TEXT_INPUT_SELECTORS'
        ];
        
        const usageReport = [];
        const unusedParams = [];
        
        configParams.forEach(param => {
            const isUsed = allProductionCode.includes(param);
            usageReport.push({ name: param, used: isUsed });
            
            if (!isUsed) {
                unusedParams.push(param);
            }
        });
        
        // Report findings
        console.log('📊 Config Parameter Usage Report:');
        usageReport.forEach(param => {
            const status = param.used ? '✅' : '⚠️';
            console.log(`   ${status} ${param.name}: ${param.used ? 'USED' : 'POTENTIALLY UNUSED'}`);
        });
        
        if (unusedParams.length > 0) {
            console.log(`⚠️ Found ${unusedParams.length} potentially unused parameters`);
            console.log('   Note: Some parameters might be used dynamically or in tests');
        }
        
        return { usageReport, unusedParams };
    }

    // Test installer file requirements match actual files
    testInstallerFileRequirements() {
        console.log('🔍 Testing: Installer requirements match actual files');
        
        const installerPath = path.join(this.rootDir, 'installers/install-slack-LINUX-X64.py');
        const installerContent = fs.readFileSync(installerPath, 'utf8');
        
        // Extract required files from installer
        const requiredFilesMatch = installerContent.match(/required_files = \[(.*?)\]/s);
        assert(requiredFilesMatch, 'Could not find required_files in installer');
        
        const requiredFilesStr = requiredFilesMatch[1];
        const requiredFiles = requiredFilesStr
            .split(',')
            .map(f => f.trim().replace(/['"]/g, ''))
            .filter(f => f.length > 0);
        
        console.log(`   Found ${requiredFiles.length} required files in installer`);
        
        // Verify all required files exist
        const missingFiles = [];
        requiredFiles.forEach(file => {
            const filePath = path.join(this.rootDir, file);
            if (!fs.existsSync(filePath)) {
                missingFiles.push(file);
            }
        });
        
        assert(missingFiles.length === 0, 
            `Missing required files: ${missingFiles.join(', ')}`);
        
        console.log('✅ All installer required files exist');
        return { requiredFiles, missingFiles };
    }

    // Test config file syntax and structure
    testConfigFileSyntax() {
        console.log('🔍 Testing: Config file syntax and structure');
        
        const configPath = path.join(this.rootDir, 'slack-config.js');
        const configContent = fs.readFileSync(configPath, 'utf8');
        
        try {
            // Extract config object
            const configMatch = configContent.match(/window\.SLACKPOLISH_CONFIG\s*=\s*({[\s\S]*?});/);
            assert(configMatch, 'Could not find SLACKPOLISH_CONFIG object');
            
            const configString = configMatch[1];
            const config = eval(`(${configString})`);
            
            // Test required properties exist
            const requiredProps = [
                'VERSION',
                'BUILD',
                'BUILD_DATE',
                'RESET_SAVED_SETTINGS',
                'RESET_API_KEY',
                'OPENAI_MODEL',
                'OPENAI_MAX_TOKENS',
                'OPENAI_TEMPERATURE',
                'CHANNEL_SUMMARY_TEMPERATURE'
            ];
            
            requiredProps.forEach(prop => {
                assert(config.hasOwnProperty(prop), 
                    `Required config property missing: ${prop}`);
            });
            
            // Test property types
            assert(typeof config.VERSION === 'string', 'VERSION must be string');
            assert(typeof config.BUILD === 'number', 'BUILD must be number');
            assert(typeof config.RESET_SAVED_SETTINGS === 'boolean', 'RESET_SAVED_SETTINGS must be boolean');
            assert(typeof config.RESET_API_KEY === 'boolean', 'RESET_API_KEY must be boolean');
            assert(typeof config.OPENAI_MAX_TOKENS === 'number', 'OPENAI_MAX_TOKENS must be number');
            assert(typeof config.OPENAI_TEMPERATURE === 'number', 'OPENAI_TEMPERATURE must be number');
            assert(typeof config.CHANNEL_SUMMARY_TEMPERATURE === 'number', 'CHANNEL_SUMMARY_TEMPERATURE must be number');
            
            console.log('✅ Config file syntax and structure valid');
            return config;
            
        } catch (error) {
            throw new Error(`Config file syntax error: ${error.message}`);
        }
    }

    // Run all static analysis tests
    runAllTests() {
        console.log('🚀 Starting Static Code Analysis Tests');
        console.log('=====================================\n');
        
        const tests = [
            'testResetFunctionalityExists',
            'testCriticalFunctionsExist', 
            'testConfigParametersUsed',
            'testInstallerFileRequirements',
            'testConfigFileSyntax'
        ];
        
        let passed = 0;
        let failed = 0;
        const results = {};
        
        tests.forEach(testName => {
            try {
                console.log(`🧪 Running: ${testName}`);
                const result = this[testName]();
                results[testName] = { status: 'PASSED', result };
                passed++;
                console.log(`✅ PASSED: ${testName}\n`);
            } catch (error) {
                results[testName] = { status: 'FAILED', error: error.message };
                failed++;
                console.log(`❌ FAILED: ${testName}`);
                console.log(`   Error: ${error.message}\n`);
            }
        });
        
        // Summary
        console.log('==================================================');
        console.log('📊 STATIC ANALYSIS SUMMARY');
        console.log('==================================================');
        console.log(`Total Tests: ${tests.length}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📈 Success Rate: ${Math.round((passed / tests.length) * 100)}%`);
        
        if (failed === 0) {
            console.log('\n🎉 ALL STATIC ANALYSIS TESTS PASSED!');
        } else {
            console.log('\n🚨 SOME TESTS FAILED - REVIEW REQUIRED');
        }
        
        return results;
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new StaticCodeAnalysisTests();
    const results = tester.runAllTests();
    process.exit(Object.values(results).some(r => r.status === 'FAILED') ? 1 : 0);
}

module.exports = StaticCodeAnalysisTests;
