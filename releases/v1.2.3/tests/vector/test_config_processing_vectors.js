#!/usr/bin/env node

/**
 * Configuration Processing Test Vectors
 * Tests settings loading, validation, and merging functions
 */

const path = require('path');
const TestVectorRunner = require('../framework/test-vector-runner');

// Mock configuration processor based on slack-settings.js
class ConfigProcessor {
    static defaultSettings = {
        language: 'ENGLISH',
        style: 'CASUAL',
        improveHotkey: 'Ctrl+Shift',
        personalPolish: '',
        smartContext: {
            enabled: true,
            privacyMode: false
        },
        debugMode: false,
        apiKey: '',
        addEmojiSignature: false,
        hideSummaryConfirmation: false
    };

    /**
     * Parse and validate settings from JSON string
     * Based on loadSettings function from slack-settings.js
     */
    static parseSettings(settingsJson) {
        try {
            let settings = { ...ConfigProcessor.defaultSettings };

            if (settingsJson && typeof settingsJson === 'string') {
                const parsed = JSON.parse(settingsJson);
                settings = { ...settings, ...parsed };

                // Ensure smartContext object exists
                if (!settings.smartContext) {
                    settings.smartContext = { ...ConfigProcessor.defaultSettings.smartContext };
                }
            }

            return { success: true, settings, error: null };
        } catch (error) {
            return {
                success: false,
                settings: { ...ConfigProcessor.defaultSettings },
                error: error.message
            };
        }
    }

    /**
     * Validate language setting
     */
    static validateLanguage(language) {
        const validLanguages = [
            'ENGLISH', 'SPANISH', 'FRENCH', 'GERMAN', 
            'HEBREW', 'CHINESE', 'HINDI', 'BULGARIAN'
        ];

        if (!language || typeof language !== 'string') {
            return { valid: false, error: 'Language is required' };
        }

        const upperLang = language.toUpperCase();
        if (!validLanguages.includes(upperLang)) {
            return { 
                valid: false, 
                error: `Invalid language. Must be one of: ${validLanguages.join(', ')}` 
            };
        }

        return { valid: true, normalized: upperLang, error: null };
    }

    /**
     * Validate style setting
     */
    static validateStyle(style) {
        const validStyles = [
            'PROFESSIONAL', 'CASUAL', 'FRIENDLY', 
            'CONCISE', 'TRANSLATE', 'PERSONAL_POLISH'
        ];

        if (!style || typeof style !== 'string') {
            return { valid: false, error: 'Style is required' };
        }

        const upperStyle = style.toUpperCase();
        if (!validStyles.includes(upperStyle)) {
            return { 
                valid: false, 
                error: `Invalid style. Must be one of: ${validStyles.join(', ')}` 
            };
        }

        return { valid: true, normalized: upperStyle, error: null };
    }

    /**
     * Validate hotkey setting
     */
    static validateHotkey(hotkey) {
        const validHotkeys = ['Ctrl+Shift', 'Ctrl+Alt', 'Ctrl+Tab'];

        if (!hotkey || typeof hotkey !== 'string') {
            return { valid: false, error: 'Hotkey is required' };
        }

        if (!validHotkeys.includes(hotkey)) {
            return { 
                valid: false, 
                error: `Invalid hotkey. Must be one of: ${validHotkeys.join(', ')}` 
            };
        }

        return { valid: true, error: null };
    }

    /**
     * Merge user settings with defaults
     */
    static mergeSettings(userSettings, defaults = null) {
        const baseDefaults = defaults || ConfigProcessor.defaultSettings;
        
        if (!userSettings || typeof userSettings !== 'object') {
            return { ...baseDefaults };
        }

        const merged = { ...baseDefaults, ...userSettings };

        // Ensure nested objects are properly merged
        if (userSettings.smartContext) {
            merged.smartContext = { 
                ...baseDefaults.smartContext, 
                ...userSettings.smartContext 
            };
        }

        return merged;
    }

    /**
     * Build OpenAI prompt configuration
     */
    static buildPromptConfig(settings) {
        if (!settings || typeof settings !== 'object') {
            return { error: 'Settings object is required' };
        }

        const config = {
            style: settings.style || 'CASUAL',
            language: settings.language || 'ENGLISH',
            customInstructions: settings.personalPolish || '',
            smartContext: settings.smartContext?.enabled || false,
            privacyMode: settings.smartContext?.privacyMode || false
        };

        // Validate required fields
        const languageValidation = ConfigProcessor.validateLanguage(config.language);
        if (!languageValidation.valid) {
            return { error: languageValidation.error };
        }

        const styleValidation = ConfigProcessor.validateStyle(config.style);
        if (!styleValidation.valid) {
            return { error: styleValidation.error };
        }

        return { 
            success: true, 
            config: {
                ...config,
                language: languageValidation.normalized,
                style: styleValidation.normalized
            }
        };
    }
}

// Test Vectors
const parseSettingsTestVectors = [
    {
        input: '{"language": "SPANISH", "style": "PROFESSIONAL"}',
        expected: {
            success: true,
            settings: {
                ...ConfigProcessor.defaultSettings,
                language: "SPANISH",
                style: "PROFESSIONAL"
            },
            error: null
        }
    },
    {
        input: 'invalid json',
        expected: {
            success: false,
            settings: ConfigProcessor.defaultSettings,
            error: "Unexpected token i in JSON at position 0"
        }
    },
    {
        input: null,
        expected: {
            success: true,
            settings: ConfigProcessor.defaultSettings,
            error: null
        }
    },
    {
        input: '{"smartContext": {"enabled": false, "privacyMode": true}}',
        expected: {
            success: true,
            settings: {
                ...ConfigProcessor.defaultSettings,
                smartContext: {
                    enabled: false,
                    privacyMode: true
                }
            },
            error: null
        }
    }
];

const validateLanguageTestVectors = [
    {
        input: "english",
        expected: { valid: true, normalized: "ENGLISH", error: null }
    },
    {
        input: "SPANISH",
        expected: { valid: true, normalized: "SPANISH", error: null }
    },
    {
        input: "invalid",
        expected: { 
            valid: false, 
            error: "Invalid language. Must be one of: ENGLISH, SPANISH, FRENCH, GERMAN, HEBREW, CHINESE, HINDI, BULGARIAN" 
        }
    },
    {
        input: "",
        expected: { valid: false, error: "Language is required" }
    },
    {
        input: null,
        expected: { valid: false, error: "Language is required" }
    }
];

const validateStyleTestVectors = [
    {
        input: "professional",
        expected: { valid: true, normalized: "PROFESSIONAL", error: null }
    },
    {
        input: "CASUAL",
        expected: { valid: true, normalized: "CASUAL", error: null }
    },
    {
        input: "invalid",
        expected: { 
            valid: false, 
            error: "Invalid style. Must be one of: PROFESSIONAL, CASUAL, FRIENDLY, CONCISE, TRANSLATE, PERSONAL_POLISH" 
        }
    },
    {
        input: "",
        expected: { valid: false, error: "Style is required" }
    }
];

const validateHotkeyTestVectors = [
    {
        input: "Ctrl+Shift",
        expected: { valid: true, error: null }
    },
    {
        input: "Ctrl+Alt",
        expected: { valid: true, error: null }
    },
    {
        input: "Alt+Tab",
        expected: { 
            valid: false, 
            error: "Invalid hotkey. Must be one of: Ctrl+Shift, Ctrl+Alt, Ctrl+Tab" 
        }
    },
    {
        input: "",
        expected: { valid: false, error: "Hotkey is required" }
    }
];

const mergeSettingsTestVectors = [
    {
        input: { language: "SPANISH", style: "PROFESSIONAL" },
        expected: {
            ...ConfigProcessor.defaultSettings,
            language: "SPANISH",
            style: "PROFESSIONAL"
        }
    },
    {
        input: { smartContext: { enabled: false } },
        expected: {
            ...ConfigProcessor.defaultSettings,
            smartContext: {
                enabled: false,
                privacyMode: false
            }
        }
    },
    {
        input: null,
        expected: ConfigProcessor.defaultSettings
    },
    {
        input: {},
        expected: ConfigProcessor.defaultSettings
    }
];

const buildPromptConfigTestVectors = [
    {
        input: {
            language: "ENGLISH",
            style: "PROFESSIONAL",
            personalPolish: "Be concise",
            smartContext: { enabled: true, privacyMode: false }
        },
        expected: {
            success: true,
            config: {
                style: "PROFESSIONAL",
                language: "ENGLISH",
                customInstructions: "Be concise",
                smartContext: true,
                privacyMode: false
            }
        }
    },
    {
        input: {
            language: "invalid",
            style: "CASUAL"
        },
        expected: {
            error: "Invalid language. Must be one of: ENGLISH, SPANISH, FRENCH, GERMAN, HEBREW, CHINESE, HINDI, BULGARIAN"
        }
    },
    {
        input: null,
        expected: {
            error: "Settings object is required"
        }
    }
];

// Run Tests
async function runAllTests() {
    console.log('🚀 SlackPolish Configuration Processing Test Vectors');
    console.log('==================================================\n');

    const runner = new TestVectorRunner();

    // Test parseSettings function
    runner.runTestVectors(
        'Settings Parsing',
        ConfigProcessor.parseSettings,
        parseSettingsTestVectors
    );

    // Test validateLanguage function
    runner.runTestVectors(
        'Language Validation',
        ConfigProcessor.validateLanguage,
        validateLanguageTestVectors
    );

    // Test validateStyle function
    runner.runTestVectors(
        'Style Validation',
        ConfigProcessor.validateStyle,
        validateStyleTestVectors
    );

    // Test validateHotkey function
    runner.runTestVectors(
        'Hotkey Validation',
        ConfigProcessor.validateHotkey,
        validateHotkeyTestVectors
    );

    // Test mergeSettings function
    runner.runTestVectors(
        'Settings Merging',
        ConfigProcessor.mergeSettings,
        mergeSettingsTestVectors
    );

    // Test buildPromptConfig function
    runner.runTestVectors(
        'Prompt Config Building',
        ConfigProcessor.buildPromptConfig,
        buildPromptConfigTestVectors
    );

    // Print summary and exit
    runner.printSummary();
    process.exit(runner.getExitCode());
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().catch(error => {
        console.error('❌ Test runner error:', error);
        process.exit(1);
    });
}

module.exports = { ConfigProcessor, runAllTests };
