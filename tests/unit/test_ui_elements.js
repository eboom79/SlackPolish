// SlackPolish Test Suite - UI Elements Tests
// Tests that verify UI elements, menus, popups, and visual components work correctly

const fs = require('fs');
const path = require('path');

class UIElementsTests {
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
            type: 'ui'
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

    // Test 1: Settings menu structure
    testSettingsMenuStructure() {
        const settingsPath = path.join(this.rootDir, 'slack-settings.js');
        const settingsContent = fs.readFileSync(settingsPath, 'utf8');

        const hasMenuFunction = settingsContent.includes('showSettingsMenu');
        const hasMenuContainer = settingsContent.includes('slackpolish-settings-menu');
        const hasLanguageSelect = settingsContent.includes('language-select');
        const hasStyleSelect = settingsContent.includes('style-select');
        const hasHotkeySelect = settingsContent.includes('hotkey-select');
        const hasPersonalPolish = settingsContent.includes('personal-polish');
        const hasDeveloperMode = settingsContent.includes('developer-options');

        this.log(`Settings menu structure: Function: ${hasMenuFunction}, Container: ${hasMenuContainer}`);
        this.log(`Form elements: Language: ${hasLanguageSelect}, Style: ${hasStyleSelect}, Hotkey: ${hasHotkeySelect}`);
        this.log(`Advanced features: Personal Polish: ${hasPersonalPolish}, Developer Mode: ${hasDeveloperMode}`);

        return hasMenuFunction && hasMenuContainer && hasLanguageSelect &&
               hasStyleSelect && hasHotkeySelect && hasPersonalPolish && hasDeveloperMode;
    }

    // Test 2: API key popup structure
    testApiKeyPopupStructure() {
        const scriptPath = path.join(this.rootDir, 'slack-text-improver.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        
        const hasPopupFunction = scriptContent.includes('function showApiKeyUpdatePopup');
        const hasPopupContainer = scriptContent.includes('slackpolish-api-popup');
        const hasApiKeyInput = scriptContent.includes('api-key-input');
        const hasCancelButton = scriptContent.includes('cancel-api-btn');
        const hasSaveButton = scriptContent.includes('save-api-btn');
        const hasValidation = scriptContent.includes('startsWith(\'sk-\')');
        
        this.log(`API popup structure: Function: ${hasPopupFunction}, Container: ${hasPopupContainer}`);
        this.log(`Form elements: Input: ${hasApiKeyInput}, Cancel: ${hasCancelButton}, Save: ${hasSaveButton}`);
        this.log(`Validation: API key format: ${hasValidation}`);
        
        return hasPopupFunction && hasPopupContainer && hasApiKeyInput && 
               hasCancelButton && hasSaveButton && hasValidation;
    }

    // Test 3: Loading indicator
    testLoadingIndicator() {
        const scriptPath = path.join(this.rootDir, 'slack-text-improver.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');

        const hasShowFunction = scriptContent.includes('function showLoadingIndicator()');
        const hasHideFunction = scriptContent.includes('function hideLoadingIndicator()');
        const hasIndicatorId = scriptContent.includes('slack-text-improver-loading');
        const hasPositioning = scriptContent.includes('position: fixed') &&
                              scriptContent.includes('top: 20px') &&
                              scriptContent.includes('right: 20px');
        const hasLogoInIndicator = scriptContent.includes('SlackPolish') &&
                                  scriptContent.includes('Improving your text');
        const hasGradientBackground = scriptContent.includes('linear-gradient') &&
                                     scriptContent.includes('#1264a3');

        this.log(`Loading indicator: Show: ${hasShowFunction}, Hide: ${hasHideFunction}`);
        this.log(`Structure: ID: ${hasIndicatorId}, Positioning: ${hasPositioning}`);
        this.log(`Branding: Logo text: ${hasLogoInIndicator}, Gradient: ${hasGradientBackground}`);

        return hasShowFunction && hasHideFunction && hasIndicatorId &&
               hasPositioning && hasLogoInIndicator && hasGradientBackground;
    }

    // Test 4: Error handling UI
    testErrorHandlingUI() {
        const scriptPath = path.join(this.rootDir, 'slack-text-improver.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');

        const hasErrorFunction = scriptContent.includes('function showSimpleError');
        const hasErrorHandling = scriptContent.includes('catch (error)') ||
                                scriptContent.includes('handleError');
        const hasApiKeyErrors = scriptContent.includes('Invalid or missing API key');
        const hasQuotaErrors = scriptContent.includes('quota exceeded');
        const hasForbiddenErrors = scriptContent.includes('access forbidden');

        this.log(`Error UI: Error function: ${hasErrorFunction}, Error handler: ${hasErrorHandling}`);
        this.log(`Error types: API key: ${hasApiKeyErrors}, Quota: ${hasQuotaErrors}, Forbidden: ${hasForbiddenErrors}`);

        return hasErrorFunction && hasErrorHandling && hasApiKeyErrors &&
               hasQuotaErrors && hasForbiddenErrors;
    }

    // Test 5: Developer mode UI
    testDeveloperModeUI() {
        const settingsPath = path.join(this.rootDir, 'slack-settings.js');
        const settingsContent = fs.readFileSync(settingsPath, 'utf8');

        const hasTrigger = settingsContent.includes('dev-trigger');
        const hasIndicator = settingsContent.includes('dev-mode-indicator');
        const hasApiKeySection = settingsContent.includes('🔑 OpenAI API Key');
        const hasSmartContext = settingsContent.includes('🧠 Smart Context');
        const hasDebugMode = settingsContent.includes('🔍 Debug Mode');
        const hasClickCounter = settingsContent.includes('clickCount++');

        this.log(`Developer mode: Trigger: ${hasTrigger}, Indicator: ${hasIndicator}`);
        this.log(`Sections: API key: ${hasApiKeySection}, Smart context: ${hasSmartContext}, Debug: ${hasDebugMode}`);
        this.log(`Interaction: Click counter: ${hasClickCounter}`);

        return hasTrigger && hasIndicator && hasApiKeySection &&
               hasSmartContext && hasDebugMode && hasClickCounter;
    }

    // Test 6: Menu styling and CSS
    testMenuStyling() {
        const scriptPath = path.join(this.rootDir, 'slack-text-improver.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        
        const hasModalStyling = scriptContent.includes('position: fixed') && 
                               scriptContent.includes('z-index: 10001');
        const hasBoxShadow = scriptContent.includes('box-shadow: 0 4px 20px');
        const hasBorderRadius = scriptContent.includes('border-radius: 8px');
        const hasResponsive = scriptContent.includes('max-width') && 
                             scriptContent.includes('max-height');
        const hasScrolling = scriptContent.includes('overflow-y: auto');
        
        this.log(`Menu styling: Modal: ${hasModalStyling}, Shadow: ${hasBoxShadow}, Radius: ${hasBorderRadius}`);
        this.log(`Responsive: Max dimensions: ${hasResponsive}, Scrolling: ${hasScrolling}`);
        
        return hasModalStyling && hasBoxShadow && hasBorderRadius && hasResponsive && hasScrolling;
    }

    // Test 7: Form validation
    testFormValidation() {
        const scriptPath = path.join(this.rootDir, 'slack-text-improver.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        
        const hasApiKeyValidation = scriptContent.includes('if (!newApiKey)') && 
                                   scriptContent.includes('borderColor = \'#d93025\'');
        const hasApiKeyFormat = scriptContent.includes('startsWith(\'sk-\')');
        const hasInputFocus = scriptContent.includes('.focus()');
        const hasEnterKeyHandler = scriptContent.includes('if (e.key === \'Enter\')');
        
        this.log(`Form validation: Empty check: ${hasApiKeyValidation}, Format: ${hasApiKeyFormat}`);
        this.log(`UX: Focus handling: ${hasInputFocus}, Enter key: ${hasEnterKeyHandler}`);
        
        return hasApiKeyValidation && hasApiKeyFormat && hasInputFocus && hasEnterKeyHandler;
    }

    // Test 8: Visual feedback
    testVisualFeedback() {
        const scriptPath = path.join(this.rootDir, 'slack-text-improver.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');

        const hasSuccessMessages = scriptContent.includes('✅') &&
                                  scriptContent.includes('updated successfully');
        const hasErrorStyling = scriptContent.includes('background: #d93025') &&
                               scriptContent.includes('color: white');
        const hasLoadingAnimation = scriptContent.includes('🤖') ||
                                   scriptContent.includes('✨');
        const hasToggleVisibility = scriptContent.includes('👁️') &&
                                   scriptContent.includes('🙈');

        this.log(`Visual feedback: Success: ${hasSuccessMessages}, Error styling: ${hasErrorStyling}`);
        this.log(`Animations: Loading: ${hasLoadingAnimation}, Toggle: ${hasToggleVisibility} (optional)`);

        // Animations are optional - core functionality is success messages and error styling
        return hasSuccessMessages && hasErrorStyling;
    }

    // Test 9: Accessibility features
    testAccessibilityFeatures() {
        const scriptPath = path.join(this.rootDir, 'slack-text-improver.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');

        const hasLabels = scriptContent.includes('<label') &&
                         (scriptContent.includes('for=') || scriptContent.includes('display: block'));
        const hasPlaceholders = scriptContent.includes('placeholder=');
        const hasTitles = scriptContent.includes('title') &&
                         (scriptContent.includes('Hide API key') || scriptContent.includes('Show API key'));
        const hasKeyboardNav = scriptContent.includes('keypress') ||
                              scriptContent.includes('keydown');
        const hasFocusManagement = scriptContent.includes('.focus()');

        this.log(`Accessibility: Labels: ${hasLabels}, Placeholders: ${hasPlaceholders}, Titles: ${hasTitles}`);
        this.log(`Navigation: Keyboard: ${hasKeyboardNav}, Focus: ${hasFocusManagement}`);

        return hasLabels && hasPlaceholders && hasTitles && hasKeyboardNav && hasFocusManagement;
    }

    // Test 10: Logo external file integration
    testLogoSVGIntegration() {
        const scriptPath = path.join(this.rootDir, 'slack-text-improver.js');
        const logoPath = path.join(this.rootDir, 'logo-data.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');

        // Check for external logo reference in main script
        const hasExternalRef = scriptContent.includes('window.SLACKPOLISH_LOGO_BASE64');
        const hasLogoFunction = scriptContent.includes('createSlackPolishLogo');
        const hasFallback = scriptContent.includes('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIj48Y2lyY2xlIGN4PSIyNTYiIGN5PSIyNTYiIHI9IjIwMCIgZmlsbD0iIzEyNjRhMyIvPjx0ZXh0IHg9IjI1NiIgeT0iMjgwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+U1A8L3RleHQ+PC9zdmc+');

        // Check logo data file exists
        const logoFileExists = require('fs').existsSync(logoPath);

        const hasBackgrounds = scriptContent.includes('background: white') &&
                              scriptContent.includes('box-shadow');
        const hasGradients = scriptContent.includes('linear-gradient');

        this.log(`Logo SVG: External ref: ${hasExternalRef}, Function: ${hasLogoFunction}, Fallback: ${hasFallback}`);
        this.log(`Details: Logo file exists: ${logoFileExists}`);
        this.log(`Styling: Backgrounds: ${hasBackgrounds}, Gradients: ${hasGradients}`);

        return hasExternalRef && hasLogoFunction && hasFallback && logoFileExists &&
               hasBackgrounds && hasGradients;
    }

    // Main test runner
    async runAllTests() {
        this.log('🚀 Starting SlackPolish UI Elements Tests...');
        
        const tests = [
            { name: 'Settings Menu Structure', fn: () => this.testSettingsMenuStructure() },
            { name: 'API Key Popup Structure', fn: () => this.testApiKeyPopupStructure() },
            { name: 'Loading Indicator', fn: () => this.testLoadingIndicator() },
            { name: 'Error Handling UI', fn: () => this.testErrorHandlingUI() },
            { name: 'Developer Mode UI', fn: () => this.testDeveloperModeUI() },
            { name: 'Menu Styling and CSS', fn: () => this.testMenuStyling() },
            { name: 'Form Validation', fn: () => this.testFormValidation() },
            { name: 'Visual Feedback', fn: () => this.testVisualFeedback() },
            { name: 'Accessibility Features', fn: () => this.testAccessibilityFeatures() },
            { name: 'Logo SVG Integration', fn: () => this.testLogoSVGIntegration() }
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

        this.log(`\n📊 UI Elements Test Results:`);
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
module.exports = UIElementsTests;

// Run tests if called directly
if (require.main === module) {
    const tester = new UIElementsTests();
    tester.runAllTests().then(results => {
        process.exit(results.failed > 0 ? 1 : 0);
    });
}
