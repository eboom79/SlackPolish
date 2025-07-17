// SlackPolish Test Suite - Branding Integration Tests
// Tests that verify all branding has been properly updated and logo integration works

const fs = require('fs');
const path = require('path');

class BrandingIntegrationTests {
    constructor() {
        this.testResults = [];
        this.rootDir = path.resolve(__dirname, '../..');
    }

    log(message, isError = false) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        
        this.testResults.push({
            timestamp,
            message,
            isError,
            type: 'branding'
        });
    }

    async runTest(testName, testFunction) {
        try {
            this.log(`🧪 Running: ${testName}`);
            const result = await testFunction();
            if (result) {
                this.log(`✅ PASSED: ${testName}`);
                return true;
            } else {
                this.log(`❌ FAILED: ${testName}`, true);
                return false;
            }
        } catch (error) {
            this.log(`❌ ERROR in ${testName}: ${error.message}`, true);
            return false;
        }
    }

    // Test 1: Config variable name update
    testConfigVariableName() {
        const configPath = path.join(this.rootDir, 'slack-config.js');
        const configContent = fs.readFileSync(configPath, 'utf8');
        
        const hasNewConfig = configContent.includes('window.SLACKPOLISH_CONFIG');
        const hasOldConfig = configContent.includes('SLACK_TEXT_IMPROVER_CONFIG');
        
        this.log(`Config file analysis: New config found: ${hasNewConfig}, Old config found: ${hasOldConfig}`);
        
        return hasNewConfig && !hasOldConfig;
    }

    // Test 2: Main script config references
    testMainScriptConfigReferences() {
        const scriptPath = path.join(this.rootDir, 'slack-text-improver.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        
        const newConfigRefs = (scriptContent.match(/SLACKPOLISH_CONFIG/g) || []).length;
        const oldConfigRefs = (scriptContent.match(/SLACK_TEXT_IMPROVER_CONFIG/g) || []).length;
        
        this.log(`Script config references: New: ${newConfigRefs}, Old: ${oldConfigRefs}`);
        
        return newConfigRefs >= 6 && oldConfigRefs === 0;
    }

    // Test 3: Settings menu branding
    testSettingsMenuBranding() {
        const scriptPath = path.join(this.rootDir, 'slack-text-improver.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        
        const hasSettingsHeader = scriptContent.includes('SlackPolish Settings');
        const hasOldHeader = scriptContent.includes('Text Improvement Settings') && 
                           !scriptContent.includes('SlackPolish Settings');
        
        this.log(`Settings menu: New header found: ${hasSettingsHeader}, Old header only: ${hasOldHeader}`);
        
        return hasSettingsHeader && !hasOldHeader;
    }

    // Test 4: API key popup branding
    testApiKeyPopupBranding() {
        const scriptPath = path.join(this.rootDir, 'slack-text-improver.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        
        const hasApiKeyHeader = scriptContent.includes('SlackPolish - API Key Issue');
        const hasOldApiKeyHeader = scriptContent.includes('OpenAI API Key Issue') && 
                                  !scriptContent.includes('SlackPolish - API Key Issue');
        
        this.log(`API key popup: New header found: ${hasApiKeyHeader}, Old header only: ${hasOldApiKeyHeader}`);
        
        return hasApiKeyHeader && !hasOldApiKeyHeader;
    }

    // Test 5: Logo integration
    testLogoIntegration() {
        const scriptPath = path.join(this.rootDir, 'slack-text-improver.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        
        // Check for external logo reference
        const hasExternalLogoRef = scriptContent.includes('window.SLACKPOLISH_LOGO_BASE64');
        const hasFallbackLogo = scriptContent.includes('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIj48Y2lyY2xlIGN4PSIyNTYiIGN5PSIyNTYiIHI9IjIwMCIgZmlsbD0iIzEyNjRhMyIvPjx0ZXh0IHg9IjI1NiIgeT0iMjgwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+U1A8L3RleHQ+PC9zdmc+');
        const hasLogoFunction = scriptContent.includes('createSlackPolishLogo');

        this.log(`Logo integration: External ref: ${hasExternalLogoRef}, Fallback: ${hasFallbackLogo}, Function: ${hasLogoFunction}`);

        return hasExternalLogoRef && hasFallbackLogo && hasLogoFunction;
    }

    // Test 6: Loading indicator branding
    testLoadingIndicatorBranding() {
        const scriptPath = path.join(this.rootDir, 'slack-text-improver.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        
        const hasNewIndicator = scriptContent.includes('Improving your text...');
        const hasLogoInIndicator = scriptContent.includes('createSlackPolishLogo');
        const hasIndicatorFunction = scriptContent.includes('showLoadingIndicator');

        this.log(`Loading indicator: New text found: ${hasNewIndicator}, Logo: ${hasLogoInIndicator}, Function: ${hasIndicatorFunction}`);

        return hasNewIndicator && hasLogoInIndicator && hasIndicatorFunction;
    }

    // Test 7: Console log branding
    testConsoleLogBranding() {
        const scriptPath = path.join(this.rootDir, 'slack-text-improver.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        
        const hasNewConsoleLog = scriptContent.includes('SlackPolish loaded! ✨ AI-powered text enhancement for Slack');
        const hasOldConsoleLog = scriptContent.includes('loaded!') && 
                                !scriptContent.includes('SlackPolish loaded!');
        
        this.log(`Console log: New message found: ${hasNewConsoleLog}, Old message only: ${hasOldConsoleLog}`);
        
        return hasNewConsoleLog && !hasOldConsoleLog;
    }

    // Test 8: README branding updates
    testReadmeBranding() {
        const readmePath = path.join(this.rootDir, 'README.md');
        const readmeContent = fs.readFileSync(readmePath, 'utf8');
        
        const hasSlackPolishScript = readmeContent.includes('SlackPolish script that integrates');
        const hasSlackPolishConfig = readmeContent.includes('SlackPolish configuration file');
        const hasPlatformInstallers = readmeContent.includes('install-slack-LINUX-X64.py') &&
                                     readmeContent.includes('install-slack-MAC-ARM.py') &&
                                     readmeContent.includes('install-slack-WINDOWS-X64.py');
        
        this.log(`README: Script desc: ${hasSlackPolishScript}, Config desc: ${hasSlackPolishConfig}, Platform installers: ${hasPlatformInstallers}`);
        
        return hasSlackPolishScript && hasSlackPolishConfig && hasPlatformInstallers;
    }

    // Test 9: Logo data file existence and structure
    testLogoFile() {
        const logoPath = path.join(this.rootDir, 'logo-data.js');

        if (!fs.existsSync(logoPath)) {
            this.log('Logo data file does not exist');
            return false;
        }

        const logoContent = fs.readFileSync(logoPath, 'utf8');
        const hasGlobalVariable = logoContent.includes('window.SLACKPOLISH_LOGO_BASE64');
        const hasBase64Data = logoContent.includes('data:image/svg+xml;base64,');
        const hasComment = logoContent.includes('SlackPolish Logo Data');

        this.log(`Logo data file: Global var: ${hasGlobalVariable}, Base64: ${hasBase64Data}, Comment: ${hasComment}`);

        return hasGlobalVariable && hasBase64Data && hasComment;
    }

    // Test 10: Visual test file creation
    testVisualTestFile() {
        const testPath = path.join(this.rootDir, 'test-logo-integration.html');
        
        if (!fs.existsSync(testPath)) {
            this.log('Visual test file does not exist');
            return false;
        }
        
        const testContent = fs.readFileSync(testPath, 'utf8');
        const hasTitle = testContent.includes('SlackPolish Logo Integration Test');
        const hasMenuPreview = testContent.includes('Settings Menu Preview');
        const hasPopupPreview = testContent.includes('API Key Popup Preview');
        const hasVariations = testContent.includes('Logo Variations');
        
        this.log(`Visual test: Title: ${hasTitle}, Menu: ${hasMenuPreview}, Popup: ${hasPopupPreview}, Variations: ${hasVariations}`);
        
        return hasTitle && hasMenuPreview && hasPopupPreview && hasVariations;
    }

    // Main test runner
    async runAllTests() {
        this.log('🚀 Starting SlackPolish Branding Integration Tests...');
        
        const tests = [
            { name: 'Config Variable Name Update', fn: () => this.testConfigVariableName() },
            { name: 'Main Script Config References', fn: () => this.testMainScriptConfigReferences() },
            { name: 'Settings Menu Branding', fn: () => this.testSettingsMenuBranding() },
            { name: 'API Key Popup Branding', fn: () => this.testApiKeyPopupBranding() },
            { name: 'Logo Integration', fn: () => this.testLogoIntegration() },
            { name: 'Loading Indicator Branding', fn: () => this.testLoadingIndicatorBranding() },
            { name: 'Console Log Branding', fn: () => this.testConsoleLogBranding() },
            { name: 'README Branding Updates', fn: () => this.testReadmeBranding() },
            { name: 'Logo File Structure', fn: () => this.testLogoFile() },
            { name: 'Visual Test File', fn: () => this.testVisualTestFile() }
        ];

        let passed = 0;
        let failed = 0;

        for (const test of tests) {
            const result = await this.runTest(test.name, test.fn);
            if (result) {
                passed++;
            } else {
                failed++;
            }
        }

        this.log(`\n📊 Branding Integration Test Results:`);
        this.log(`✅ Passed: ${passed}`);
        this.log(`❌ Failed: ${failed}`);
        this.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

        return {
            passed,
            failed,
            total: passed + failed,
            successRate: (passed / (passed + failed)) * 100,
            results: this.testResults
        };
    }
}

// Export for use in test suite
module.exports = BrandingIntegrationTests;

// Run tests if called directly
if (require.main === module) {
    const tester = new BrandingIntegrationTests();
    tester.runAllTests().then(results => {
        process.exit(results.failed > 0 ? 1 : 0);
    });
}
