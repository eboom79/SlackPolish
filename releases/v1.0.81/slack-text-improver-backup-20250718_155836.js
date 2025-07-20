
// SlackPolish - AI-Powered Text Enhancement for Slack
(function() {
    'use strict';

    console.log('🚀 SlackPolish loaded! ✨ AI-powered text enhancement for Slack');

    // Function to create SlackPolish logo using embedded SVG
    function createSlackPolishLogo(size = 24) {
        const logoImg = document.createElement('img');
        logoImg.title = 'SlackPolish';
        logoImg.alt = 'SlackPolish Logo';
        logoImg.width = size;
        logoImg.height = size;
        logoImg.style.cssText = `display: block; border: none; width: ${size}px !important; height: ${size}px !important; max-width: ${size}px; max-height: ${size}px;`;

        // Your custom SlackPolish logo as base64 encoded SVG
        // Try to use external logo file, fallback to embedded if not available
        logoImg.src = window.SLACKPOLISH_LOGO_BASE64 || "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIj48Y2lyY2xlIGN4PSIyNTYiIGN5PSIyNTYiIHI9IjIwMCIgZmlsbD0iIzEyNjRhMyIvPjx0ZXh0IHg9IjI1NiIgeT0iMjgwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+U1A8L3RleHQ+PC9zdmc+";

        // Fallback to text if even the embedded SVG fails (very unlikely)
        logoImg.onerror = function() {
            const textSpan = document.createElement('span');
            textSpan.textContent = 'SP';
            textSpan.title = 'SlackPolish';
            textSpan.style.cssText = `
                font-size: ${size}px;
                font-weight: bold;
                color: #1264a3;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;
            this.parentNode.replaceChild(textSpan, this);
        };

        return logoImg;
    }

    // Get configuration from config file with fallbacks
    function getConfig() {
        const config = window.SLACKPOLISH_CONFIG || {};

        // Initialize API key variable
        let apiKey = config.OPENAI_API_KEY;

        // Check for emergency reset flags FIRST (installer-managed version system)
        try {
            // Check for full settings reset (only if flag is true AND version is different)
            if (config.RESET_SAVED_SETTINGS === true) {
                const resetVersion = config.RESET_SAVED_SETTINGS_VERSION || 'v1';
                const lastResetVersion = localStorage.getItem('slackpolish-last-settings-reset-version');

                if (resetVersion !== lastResetVersion) {
                    console.log(`🚨 RESET_SAVED_SETTINGS flag detected (version: ${resetVersion}) - clearing all saved settings including API key`);
                    localStorage.removeItem('slackpolish-settings');

                    // Mark this reset version as completed
                    localStorage.setItem('slackpolish-last-settings-reset-version', resetVersion);

                    console.log('✅ All settings reset to defaults due to RESET_SAVED_SETTINGS flag');
                    console.log('💡 This reset happened once for this installation - managed by installer');
                    // Use config file API key (empty) instead of saved one
                } else {
                    console.log(`⏭️ RESET_SAVED_SETTINGS already performed for version ${resetVersion} - skipping`);
                }
            } else {
                console.log('⏭️ RESET_SAVED_SETTINGS flag is false - no reset needed');
            }

            // Check for API key reset flag (independent of settings reset)
            if (config.RESET_API_KEY === true) {
                    const resetVersion = config.RESET_API_KEY_VERSION || 'v1';
                    const lastResetVersion = localStorage.getItem('slackpolish-last-apikey-reset-version');

                    if (resetVersion !== lastResetVersion) {
                        console.log(`🔑 RESET_API_KEY flag detected (version: ${resetVersion}) - clearing saved API key only`);
                        try {
                            const saved = localStorage.getItem('slackpolish-settings');
                            if (saved) {
                                const savedSettings = JSON.parse(saved);
                                delete savedSettings.apiKey; // Remove only the API key
                                localStorage.setItem('slackpolish-settings', JSON.stringify(savedSettings));
                                console.log('✅ API key reset to config file value, other settings preserved');
                            }

                            // Mark this reset version as completed
                            localStorage.setItem('slackpolish-last-apikey-reset-version', resetVersion);

                            console.log('💡 This reset happened once for this installation - managed by installer');
                        } catch (error) {
                            console.error('❌ Error resetting API key:', error);
                        }
                    } else {
                        console.log(`⏭️ RESET_API_KEY already performed for version ${resetVersion} - skipping`);
                    }
                } else {
                    console.log('⏭️ RESET_API_KEY flag is false - no reset needed');
                }

                // Check for saved API key in localStorage (after potential reset)
                try {
                    const saved = localStorage.getItem('slackpolish-settings');
                    if (saved) {
                        const savedSettings = JSON.parse(saved);
                        if (savedSettings.apiKey) {
                            apiKey = savedSettings.apiKey;
                            // Update the global config with the saved API key
                            config.OPENAI_API_KEY = apiKey;
                            console.log('🔑 Using saved API key from localStorage');
                        }
                    }
                } catch (error) {
                    console.error('❌ Error loading saved API key:', error);
                }
        } catch (error) {
            console.error('❌ Error in reset logic:', error);
        }

        return {
            DEFAULT_SETTINGS: config.DEFAULT_SETTINGS || {
                language: 'ENGLISH',
                style: 'CASUAL',
                improveHotkey: 'Ctrl+Shift',
                personalPolish: ''
            },
            AVAILABLE_HOTKEYS: config.AVAILABLE_HOTKEYS || [
                'Ctrl+Shift',
                'Ctrl+Alt',
                'Ctrl+Tab'
            ],
            SUPPORTED_LANGUAGES: config.SUPPORTED_LANGUAGES || {},
            AVAILABLE_STYLES: config.AVAILABLE_STYLES || {},

            TEXT_INPUT_SELECTORS: config.TEXT_INPUT_SELECTORS || [
                '[data-qa="message_input"] .ql-editor',
                '.ql-editor[contenteditable="true"]',
                '[contenteditable="true"].ql-editor',
                '.c-texty_input .ql-editor'
            ],
            OPENAI_MODEL: config.OPENAI_MODEL || 'gpt-3.5-turbo',
            OPENAI_MAX_TOKENS: config.OPENAI_MAX_TOKENS || 500,
            OPENAI_TEMPERATURE: config.OPENAI_TEMPERATURE || 0.7,
            OPENAI_API_KEY: apiKey
        };
    }

    const appConfig = getConfig();
    const DEFAULT_SETTINGS = appConfig.DEFAULT_SETTINGS;

    let currentSettings = { ...DEFAULT_SETTINGS };

    // Get current settings
    function getCurrentSettings() {
        return currentSettings;
    }

    // Get current API key (from settings or config)
    function getCurrentApiKey() {
        const settings = getCurrentSettings();
        return settings.apiKey || appConfig.OPENAI_API_KEY || '';
    }

    // Save settings to localStorage with forced disk flush
    function saveSettings(settings) {
        try {
            const settingsJson = JSON.stringify(settings);

            // Save and force multiple flushes to disk
            localStorage.setItem('slackpolish-settings', settingsJson);

            // Force immediate flush by triggering multiple localStorage operations
            // This helps ensure the data is written to disk before process termination
            for (let i = 0; i < 3; i++) {
                localStorage.setItem('slackpolish-settings', settingsJson);
                const verification = localStorage.getItem('slackpolish-settings');
                if (verification !== settingsJson) {
                    console.warn(`⚠️ Settings verification failed on attempt ${i + 1}, retrying...`);
                }
            }

            // Additional flush attempt with a temporary key to force disk I/O
            localStorage.setItem('slackpolish-flush-temp', Date.now().toString());
            localStorage.removeItem('slackpolish-flush-temp');

            currentSettings = { ...settings };
            console.log('⚙️ Settings saved to localStorage with forced flush');

            // Add periodic auto-save to handle process kills (reduced interval)
            if (!window.slackPolishAutoSaveInterval) {
                window.slackPolishAutoSaveInterval = setInterval(() => {
                    try {
                        localStorage.setItem('slackpolish-settings', JSON.stringify(currentSettings));
                    } catch (error) {
                        console.error('❌ Auto-save error:', error);
                    }
                }, 2000); // Auto-save every 2 seconds for better protection
            }

            // Add window close handler to ensure settings are saved
            if (!window.slackPolishCloseHandlerAdded) {
                window.addEventListener('beforeunload', function() {
                    console.log('🔄 Window closing - ensuring settings are saved');
                    try {
                        localStorage.setItem('slackpolish-settings', JSON.stringify(currentSettings));
                        console.log('✅ Settings saved during window close');
                    } catch (error) {
                        console.error('❌ Error saving settings during close:', error);
                    }
                });
                window.slackPolishCloseHandlerAdded = true;
            }
        } catch (error) {
            console.error('❌ Error saving settings:', error);
        }
    }

    // Load settings from localStorage
    function loadSettings() {
        const config = window.SLACKPOLISH_CONFIG || {};



        // Check if full reset was performed (installer-managed version system)
        if (config.RESET_SAVED_SETTINGS === true) {
            const resetVersion = config.RESET_SAVED_SETTINGS_VERSION || 'v1';
            const lastResetVersion = localStorage.getItem('slackpolish-last-settings-reset-version');

            console.log('🔍 DEBUG: resetVersion =', resetVersion);
            console.log('🔍 DEBUG: lastResetVersion =', lastResetVersion);

            if (resetVersion === lastResetVersion) {
                // Reset was already performed for this version, load saved settings normally
                console.log('⚙️ Reset already performed for this installation - loading saved settings');
                // Continue to normal settings loading below
            } else {
                // Reset will happen during getConfig() - use defaults for now
                currentSettings = { ...DEFAULT_SETTINGS };
                console.log('⚙️ Using default settings (reset will happen during initialization)');
                return;
            }
        }

        try {
            const saved = localStorage.getItem('slackpolish-settings');

            if (saved) {
                const parsedSettings = JSON.parse(saved);
                currentSettings = { ...DEFAULT_SETTINGS, ...parsedSettings };
                console.log('⚙️ Settings loaded from localStorage');
            } else {
                console.log('⚙️ No saved settings found, using defaults');
                currentSettings = { ...DEFAULT_SETTINGS };
            }
        } catch (error) {
            console.error('❌ Error loading settings:', error);
            console.log('🔄 Resetting to default settings due to corruption');
            currentSettings = { ...DEFAULT_SETTINGS };
            // Clear corrupted settings
            localStorage.removeItem('slackpolish-settings');
        }
    }



    // Simple hotkey matching function
    function hotkeyMatches(event, hotkeyString) {
        if (!hotkeyString) return false;

        console.log(`🔍 Checking hotkey match: "${hotkeyString}" vs event keys`);

        // Handle specific hotkey combinations
        switch (hotkeyString) {
            case 'Ctrl+Shift':
                return event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey;

            case 'Ctrl+Alt':
                return event.ctrlKey && !event.shiftKey && event.altKey && !event.metaKey;

            case 'Ctrl+Tab':
                return event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey && event.key === 'Tab';

            default:
                console.log(`⚠️ Unknown hotkey: ${hotkeyString}`);
                return false;
        }
    }

    // Show loading indicator
    function showLoadingIndicator() {
        const existing = document.getElementById('slack-text-improver-loading');
        if (existing) existing.remove();

        const indicator = document.createElement('div');
        indicator.id = 'slack-text-improver-loading';
        const logoContainer = document.createElement('div');
        logoContainer.style.cssText = 'background: white; border-radius: 6px; padding: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center;';
        logoContainer.appendChild(createSlackPolishLogo(28));

        const textContainer = document.createElement('div');
        textContainer.innerHTML = `
            <div style="font-size: 14px; opacity: 0.9;">Improving your text...</div>
        `;

        const mainContainer = document.createElement('div');
        mainContainer.style.cssText = 'display: flex; align-items: center; gap: 12px;';
        mainContainer.appendChild(logoContainer);
        mainContainer.appendChild(textContainer);

        indicator.appendChild(mainContainer);
        indicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #1264a3 0%, #0d5aa7 100%);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.2);
            backdrop-filter: blur(10px);
        `;
        document.body.appendChild(indicator);
    }

    // Hide loading indicator
    function hideLoadingIndicator() {
        const indicator = document.getElementById('slack-text-improver-loading');
        if (indicator) indicator.remove();
    }

    // Find Slack text input
    function findTextInput() {
        debugLog(`🔍 SEARCHING FOR TEXT INPUT`);
        debugLog(`🔍 Current URL:`, window.location.href);
        debugLog(`🔍 Is in thread:`, isInThread());
        debugLog(`🔍 Active element:`, document.activeElement);

        // First, let's try to find the focused input (most reliable)
        const activeElement = document.activeElement;
        if (activeElement && (
            activeElement.contentEditable === 'true' ||
            activeElement.matches('.ql-editor') ||
            activeElement.matches('[contenteditable="true"]')
        )) {
            debugLog(`🎯 FOUND FOCUSED INPUT: ${activeElement.tagName}.${activeElement.className}`);

            // Check if this focused element is in a thread
            const threadContainer = activeElement.closest('.p-thread_view, .p-threads_view, [data-qa*="thread"]');
            if (threadContainer) {
                debugLog(`🧵 FOCUSED INPUT IS IN THREAD CONTAINER`);
                showDebugInfo(`✅ FOUND FOCUSED THREAD INPUT:
Tag: ${activeElement.tagName}
Class: ${activeElement.className}
Data-qa: ${activeElement.getAttribute('data-qa')}
In thread container: YES`);
                return activeElement;
            } else if (!isInThread()) {
                console.log(`📝 FOCUSED INPUT IS IN MAIN CHANNEL`);
                showDebugInfo(`✅ FOUND FOCUSED CHANNEL INPUT:
Tag: ${activeElement.tagName}
Class: ${activeElement.className}
Data-qa: ${activeElement.getAttribute('data-qa')}
In thread container: NO`);
                return activeElement;
            }
        }

        // If we're in a thread, look for thread-specific inputs
        if (isInThread()) {

            const threadSelectors = [
                // More comprehensive thread selectors
                '[data-qa*="thread"] .ql-editor',
                '[data-qa*="thread"] [contenteditable="true"]',
                '.p-thread_view .ql-editor',
                '.p-threads_view .ql-editor',
                '.c-message_kit__thread .ql-editor',
                '[data-qa="thread_view"] .ql-editor',
                '[data-qa="threads_view"] .ql-editor',
                '[data-qa="thread_message_input"] .ql-editor',
                '[data-qa="thread-message-input"] .ql-editor',

                // Broader thread container searches
                '.p-thread_view [contenteditable="true"]',
                '.p-threads_view [contenteditable="true"]',
                '[data-qa*="thread"] [contenteditable="true"]',

                // Look for any contenteditable in thread containers
                '.p-thread_view div[contenteditable="true"]',
                '.p-threads_view div[contenteditable="true"]'
            ];

            for (let i = 0; i < threadSelectors.length; i++) {
                const selector = threadSelectors[i];
                const elements = document.querySelectorAll(selector);

                for (let j = 0; j < elements.length; j++) {
                    const element = elements[j];
                    const isVisible = element.offsetParent !== null;
                    const isFocused = element === document.activeElement;

                    if (element && element.isConnected && isVisible) {
                        const details = {
                            tagName: element.tagName,
                            className: element.className,
                            id: element.id,
                            'data-qa': element.getAttribute('data-qa'),
                            contentEditable: element.contentEditable,
                            isFocused: isFocused
                        };

                        // Show visual debug info
                        showDebugInfo(`✅ FOUND THREAD INPUT:
Selector: ${selector}
Tag: ${details.tagName}
Class: ${details.className}
Data-qa: ${details['data-qa']}
Focused: ${isFocused}`);

                        return element;
                    }
                }
            }

            console.log(`🧵 No thread-specific input found, falling back to active element check`);

            // If no thread-specific input found, check if active element is in a thread container
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.contentEditable === 'true' || activeElement.matches('.ql-editor'))) {
                const threadContainer = activeElement.closest('.p-thread_view, .p-threads_view, [data-qa="thread_view"], [data-qa="threads_view"]');
                if (threadContainer) {
                    console.log(`✅ FOUND THREAD INPUT via active element in thread container`);
                    return activeElement;
                }
            }
        }

        // Regular channel input search (or fallback for threads)
        console.log(`📝 SEARCHING FOR CHANNEL INPUT (or thread fallback)`);
        const selectors = appConfig.TEXT_INPUT_SELECTORS;

        for (let i = 0; i < selectors.length; i++) {
            const selector = selectors[i];
            console.log(`📝 Trying selector ${i + 1}/${selectors.length}: "${selector}"`);

            const elements = document.querySelectorAll(selector);
            console.log(`📝 Found ${elements.length} elements with selector: "${selector}"`);

            for (let j = 0; j < elements.length; j++) {
                const element = elements[j];
                const isVisible = element.offsetParent !== null;
                const isFocused = element === document.activeElement;

                console.log(`📝 Element ${j + 1}: connected=${element.isConnected}, visible=${isVisible}, focused=${isFocused}`);

                if (element && element.isConnected && isVisible) {
                    console.log(`✅ FOUND TEXT INPUT with selector: "${selector}"`);
                    const details = {
                        tagName: element.tagName,
                        className: element.className,
                        id: element.id,
                        'data-qa': element.getAttribute('data-qa'),
                        contentEditable: element.contentEditable,
                        isFocused: isFocused
                    };
                    console.log(`✅ Element details:`, details);

                    // Show visual debug info
                    const inputType = isInThread() ? 'FALLBACK CHANNEL INPUT (in thread!)' : 'CHANNEL INPUT';
                    showDebugInfo(`✅ FOUND ${inputType}:
Selector: ${selector}
Tag: ${details.tagName}
Class: ${details.className}
Data-qa: ${details['data-qa']}
Focused: ${isFocused}`);

                    return element;
                }
            }
        }

        console.log('❌ COULD NOT FIND ANY TEXT INPUT');

        // Enhanced debug info
        console.log('❌ Debug info:');
        console.log('❌ Active element:', document.activeElement);
        console.log('❌ Active element parent:', document.activeElement?.parentElement);
        console.log('❌ Thread containers:', document.querySelectorAll('.p-thread_view, .p-threads_view, [data-qa="thread_view"], [data-qa="threads_view"]').length);
        console.log('❌ All .ql-editor elements:', document.querySelectorAll('.ql-editor').length);
        console.log('❌ All contenteditable elements:', document.querySelectorAll('[contenteditable="true"]').length);

        return null;
    }

    // Extract text from input
    function extractTextFromInput() {
        const textInput = findTextInput();
        if (!textInput) {
            console.log('❌ Could not find text input to extract text');
            return '';
        }

        const text = textInput.textContent || textInput.innerText || '';
        console.log(`✅ Found text: "${text}"`);
        return text;
    }

    // Replace text in input - SIMPLE VERSION
    function replaceTextInInput(newText) {
        const textInput = findTextInput();
        if (!textInput) {
            console.log('❌ Could not find text input to replace text');
            return false;
        }

        try {
            // Simple replacement
            textInput.textContent = newText;
            textInput.focus();

            // Trigger events
            textInput.dispatchEvent(new Event('input', { bubbles: true }));
            textInput.dispatchEvent(new Event('change', { bubbles: true }));

            console.log('✅ Text replaced successfully');
            return true;
        } catch (error) {
            console.error('❌ Error replacing text:', error);
            return false;
        }
    }

    // Handle API errors with appropriate user feedback
    function handleApiError(error) {
        console.error('🔍 Analyzing API error:', error);

        // Check if it's a fetch error (network/API issues)
        if (error.message && (
            error.message.includes('401') ||
            error.message.includes('Unauthorized') ||
            error.message.includes('Invalid API key') ||
            error.message.includes('API key')
        )) {
            showApiKeyUpdatePopup('Invalid or missing API key. Please update your OpenAI API key.');
        } else if (error.message && (
            error.message.includes('429') ||
            error.message.includes('quota') ||
            error.message.includes('credits') ||
            error.message.includes('billing')
        )) {
            showApiKeyUpdatePopup('OpenAI API quota exceeded or billing issue. Please check your OpenAI account or update your API key.');
        } else if (error.message && error.message.includes('403')) {
            showApiKeyUpdatePopup('OpenAI API access forbidden. Please check your API key permissions.');
        } else {
            // Generic error - show simple error message
            showSimpleError(`Error: ${error.message || 'Unknown error occurred'}`);
        }
    }

    // Show simple error notification
    function showSimpleError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `❌ ${message}`;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #d93025;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            max-width: 300px;
        `;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
    }

    // Show API key update popup
    function showApiKeyUpdatePopup(message) {
        // Remove any existing popup
        const existingPopup = document.getElementById('slackpolish-api-popup');
        if (existingPopup) {
            existingPopup.remove();
        }

        const popup = document.createElement('div');
        popup.id = 'slackpolish-api-popup';
        popup.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-width: 500px; width: 90%;">
                    <div style="display: flex; align-items: center; margin-bottom: 20px; padding: 12px; background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%); border-radius: 8px; border: 1px solid #feb2b2;">
                        <div style="background: white; border-radius: 6px; padding: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-right: 12px; display: flex; align-items: center; justify-content: center;" id="api-popup-logo">
                        </div>
                        <div>
                            <h3 style="margin: 0 0 4px 0; color: #d93025; font-size: 18px;">🔑 SlackPolish - API Key Issue</h3>
                            <div style="font-size: 13px; color: #666;">Please configure your OpenAI API key to continue</div>
                        </div>
                    </div>
                    <p style="margin: 0 0 20px 0; color: #333; line-height: 1.4;">${message}</p>

                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">Enter your OpenAI API Key:</label>
                        <input type="password" id="api-key-input" placeholder="sk-..." style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-family: monospace; font-size: 14px;">
                        <div style="font-size: 12px; color: #666; margin-top: 5px;">
                            Get your API key from: <a href="https://platform.openai.com/api-keys" target="_blank" style="color: #007a5a;">https://platform.openai.com/api-keys</a>
                        </div>
                    </div>

                    <div style="text-align: right;">
                        <button id="cancel-api-btn" style="margin-right: 10px; padding: 8px 16px; border: 1px solid #ddd; background: #f8f8f8; border-radius: 4px; cursor: pointer;">Cancel</button>
                        <button id="save-api-btn" style="padding: 8px 16px; border: none; background: #007a5a; color: white; border-radius: 4px; cursor: pointer;">Save & Retry</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        // Add logo to popup
        const logoContainer = document.getElementById('api-popup-logo');
        if (logoContainer) {
            logoContainer.appendChild(createSlackPolishLogo(32));
        }

        // Handle popup interactions
        const apiKeyInput = document.getElementById('api-key-input');
        const cancelBtn = document.getElementById('cancel-api-btn');
        const saveBtn = document.getElementById('save-api-btn');

        // Focus on input
        apiKeyInput.focus();

        // Cancel button
        cancelBtn.addEventListener('click', () => {
            popup.remove();
        });

        // Save button
        saveBtn.addEventListener('click', () => {
            const newApiKey = apiKeyInput.value.trim();
            if (!newApiKey) {
                apiKeyInput.style.borderColor = '#d93025';
                apiKeyInput.focus();
                return;
            }

            if (!newApiKey.startsWith('sk-')) {
                apiKeyInput.style.borderColor = '#d93025';
                apiKeyInput.focus();
                alert('API key should start with "sk-"');
                return;
            }

            // Update the API key in config
            updateApiKey(newApiKey);
            popup.remove();

            // Show success message
            showSimpleError('✅ API key updated successfully! You can now try improving text again.');
        });

        // Enter key to save
        apiKeyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            }
        });

        // Escape key to cancel
        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                popup.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        });
    }

    // Update API key in configuration
    function updateApiKey(newApiKey) {
        try {
            // Update the global config for immediate use
            if (window.SLACKPOLISH_CONFIG) {
                window.SLACKPOLISH_CONFIG.OPENAI_API_KEY = newApiKey;
                console.log('✅ API key updated in global configuration');
            }

            // Update appConfig for immediate use
            appConfig.OPENAI_API_KEY = newApiKey;

            // Save to localStorage for persistence across restarts
            const currentSettings = getCurrentSettings();
            currentSettings.apiKey = newApiKey;
            saveSettings(currentSettings);

            console.log('🔑 API key updated and saved for future use');
        } catch (error) {
            console.error('❌ Error updating API key:', error);
        }
    }

    // Helper function to make OpenAI API calls with proper error handling
    async function makeOpenAIRequest(messages, maxTokens = 500, temperature = 0.7) {
        const config = window.SLACKPOLISH_CONFIG;
        if (!config || !config.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured. Please set it in slack-config.js');
        }

        // Get current API key (from settings or config)
        const currentApiKey = getCurrentApiKey();

        if (!currentApiKey) {
            throw new Error('No OpenAI API key configured. Please add your API key in settings (F12 → Developer Mode → API Key).');
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentApiKey}`
            },
            body: JSON.stringify({
                model: appConfig.OPENAI_MODEL,
                messages: messages,
                max_tokens: maxTokens,
                temperature: temperature
            })
        });

        // Check if response is ok
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;

            // Create a more specific error message based on status code
            if (response.status === 401) {
                throw new Error('Invalid API key - Please check your OpenAI API key');
            } else if (response.status === 429) {
                throw new Error('OpenAI API quota exceeded - Please check your billing and usage limits');
            } else if (response.status === 403) {
                throw new Error('OpenAI API access forbidden - Please check your API key permissions');
            } else {
                throw new Error(errorMessage);
            }
        }

        const data = await response.json();

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response from OpenAI API');
        }

        return data.choices[0].message.content.trim();
    }

    // Smart Context System
    let messageCache = {
        timestamp: 0,
        messages: [],
        channelId: null
    };

    function shouldUseContext(userMessage) {
        // Skip empty or whitespace-only messages
        if (!userMessage || userMessage.trim().length === 0) return false;

        // Short messages that benefit from context
        if (userMessage.length < 50) return true;

        // Ambiguous responses
        const ambiguousPatterns = [
            /^(yes|no|ok|sure|sounds good|agreed?|thanks?|got it)$/i,
            /^(will do|on it|done|perfect|exactly|right)$/i,
            /^(let me|i'll|we should|maybe|probably)$/i
        ];

        if (ambiguousPatterns.some(pattern => pattern.test(userMessage.trim()))) {
            return true;
        }

        // Questions that might reference previous discussion
        if (userMessage.includes('?') && userMessage.length < 100) {
            return true;
        }

        // Pronouns without clear antecedents
        const pronouns = /\b(this|that|it|they|them|these|those)\b/i;
        if (pronouns.test(userMessage) && userMessage.length < 150) {
            return true;
        }

        return false;
    }

    function getCurrentChannelId() {
        // Try to get channel ID from URL
        const url = window.location.href;

        // Check for thread URL first
        const threadMatch = url.match(/\/thread\/([^\/]+)/);
        if (threadMatch) return `thread-${threadMatch[1]}`;

        // Check for regular channel
        const channelMatch = url.match(/\/client\/([^\/]+)/);
        if (channelMatch) return channelMatch[1];

        // Fallback: try to get from DOM
        const channelElement = document.querySelector('[data-qa="channel_name"], .p-channel_sidebar__name');
        const channelName = channelElement ? channelElement.textContent : 'unknown';

        // If we're in a thread, append thread identifier
        if (isInThread()) {
            return `${channelName}-thread`;
        }

        return channelName;
    }

    function parseSlackTimestamp(timeElement) {
        if (!timeElement) return Date.now();

        // Try different timestamp formats
        const datetime = timeElement.getAttribute('datetime') ||
                        timeElement.getAttribute('data-ts') ||
                        timeElement.title;

        if (datetime) {
            const parsed = new Date(datetime);
            if (!isNaN(parsed.getTime())) return parsed.getTime();
        }

        // Fallback: parse visible time text
        const timeText = timeElement.textContent;
        const timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);

        if (timeMatch) {
            const today = new Date();
            let hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const ampm = timeMatch[3];

            if (ampm && ampm.toUpperCase() === 'PM' && hours !== 12) hours += 12;
            if (ampm && ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;

            today.setHours(hours, minutes, 0, 0);
            return today.getTime();
        }

        return Date.now(); // Fallback to now
    }

    function sanitizeText(text) {
        return text
            .replace(/\n+/g, ' ') // Replace newlines with spaces
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/@channel|@here|@everyone/gi, '[mention]') // Replace mentions
            .replace(/https?:\/\/[^\s]+/g, '[link]') // Replace URLs
            .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '[email]') // Replace emails
            .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[phone]') // Replace phone numbers
            .trim()
            .substring(0, 200); // Limit length
    }

    function sanitizeSender(sender) {
        const settings = getCurrentSettings();
        const privacyMode = settings.smartContext?.privacyMode || false;

        if (privacyMode) {
            return sender.replace(/[a-zA-Z]/g, (char, index) =>
                index === 0 ? char : '*'
            ); // "John" becomes "J***"
        }

        return sender.split(' ')[0]; // First name only
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    function isSystemMessage(message) {
        const systemPatterns = [
            /joined the channel/i,
            /left the channel/i,
            /set the channel topic/i,
            /uploaded a file/i,
            /started a call/i,
            /shared a file/i,
            /pinned a message/i
        ];

        return systemPatterns.some(pattern => pattern.test(message.text)) ||
               message.sender.toLowerCase().includes('bot') ||
               message.text.startsWith('/') ||
               message.text.length < 3;
    }

    function cleanMessageText(text) {
        if (!text) return '';

        // Remove Slack-specific formatting
        return text
            .replace(/\u00A0/g, ' ') // Non-breaking spaces
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width characters
            .replace(/\s+/g, ' ') // Multiple spaces
            .trim();
    }

    function extractMessageData(messageElement) {
        try {
            // Extract timestamp - try multiple selectors for different contexts
            const timestampSelectors = [
                '[data-qa="message_timestamp"]',
                '[data-qa="message-timestamp"]',
                '.c-timestamp',
                'time',
                '[data-qa="thread_message_timestamp"]',
                '.p-thread_view__message_timestamp',
                '.c-message__timestamp'
            ];

            let timeElement = null;
            for (const selector of timestampSelectors) {
                timeElement = messageElement.querySelector(selector);
                if (timeElement) break;
            }

            const timestamp = parseSlackTimestamp(timeElement);

            // Extract sender - try multiple selectors for different contexts
            const senderSelectors = [
                '[data-qa="message_sender_name"]',
                '[data-qa="message-sender-name"]',
                '.c-message__sender',
                '.c-message__sender_link',
                '[data-qa="thread_message_sender"]',
                '.p-thread_view__message_sender',
                '.c-message__sender_name'
            ];

            let senderElement = null;
            for (const selector of senderSelectors) {
                senderElement = messageElement.querySelector(selector);
                if (senderElement) break;
            }

            const sender = senderElement ? senderElement.textContent.trim() : 'Unknown';

            // Extract message text - try multiple selectors for different contexts
            const textSelectors = [
                '[data-qa="message_text"]',
                '[data-qa="message-text"]',
                '.c-message__body',
                '.p-rich_text_section',
                '[data-qa="thread_message_text"]',
                '.p-thread_view__message_text',
                '.c-message__message_text',
                '.p-rich_text_block'
            ];

            let textElement = null;
            for (const selector of textSelectors) {
                textElement = messageElement.querySelector(selector);
                if (textElement) break;
            }

            const text = textElement ? cleanMessageText(textElement.textContent) : '';

            // Skip if no text or too short
            if (!text || text.length < 2) return null;

            return {
                timestamp,
                sender: sanitizeSender(sender),
                text: sanitizeText(text),
                time: formatTime(timestamp)
            };
        } catch (error) {
            console.warn('Error extracting message:', error);
            return null;
        }
    }

    function isInThread() {
        // Check multiple indicators that we're in a thread view
        const threadIndicators = [
            // URL-based detection
            window.location.href.includes('/thread/'),

            // DOM-based detection - look for any thread-related elements
            !!document.querySelector('[data-qa*="thread"]'),
            !!document.querySelector('.p-threads_view'),
            !!document.querySelector('[data-qa="thread_view"]'),
            !!document.querySelector('.p-thread_view'),

            // Check if active element is in a thread container
            !!document.activeElement?.closest('.p-thread_view, .p-threads_view, [data-qa*="thread"]'),

            // Check for thread-specific elements with broader search
            !!document.querySelector('[data-qa="thread_message_input"]'),
            !!document.querySelector('[data-qa="thread-message-input"]'),

            // Look for thread containers with content
            !!document.querySelector('.p-thread_view .ql-editor'),
            !!document.querySelector('.p-threads_view .ql-editor'),

            // Check if there are multiple message inputs (main + thread)
            document.querySelectorAll('.ql-editor').length > 1
        ];

        const isThread = threadIndicators.some(indicator => indicator);

        // Enhanced debug info
        const debugInfo = {
            urlContainsThread: threadIndicators[0],
            hasThreadDataQa: threadIndicators[1],
            hasPThreadsView: threadIndicators[2],
            hasThreadView: threadIndicators[3],
            hasPThreadView: threadIndicators[4],
            activeInThreadContainer: threadIndicators[5],
            hasThreadMessageInput: threadIndicators[6],
            hasThreadMessageInputAlt: threadIndicators[7],
            hasThreadViewEditor: threadIndicators[8],
            hasThreadsViewEditor: threadIndicators[9],
            multipleEditors: threadIndicators[10],
            finalResult: isThread,
            totalQlEditors: document.querySelectorAll('.ql-editor').length,
            allDataQaElements: Array.from(document.querySelectorAll('[data-qa*="thread"]')).map(el => el.getAttribute('data-qa'))
        };

        debugLog(`🔍 Thread detection:`, debugInfo);

        // Show visual debug for thread detection
        if (isThread) {
            showDebugInfo(`🧵 THREAD DETECTED:
URL has thread: ${debugInfo.urlContainsThread}
Thread elements: ${debugInfo.hasThreadDataQa}
Multiple editors: ${debugInfo.multipleEditors}
Total .ql-editor: ${debugInfo.totalQlEditors}
Thread data-qa: ${debugInfo.allDataQaElements.join(', ')}`);
        }

        return isThread;
    }

    function extractThreadMessages() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = today.getTime();

        // Thread-specific message selectors
        const threadMessageSelectors = [
            '[data-qa="thread_message"]',
            '.c-message--thread',
            '.p-thread_view__message',
            '[data-qa="thread-message"]',
            '.p-threads_view__message'
        ];

        let messages = [];
        for (const selector of threadMessageSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                messages = Array.from(elements);
                console.log(`🧵 Found ${messages.length} thread messages using selector: ${selector}`);
                break;
            }
        }

        // If no thread-specific messages found, try generic selectors within thread container
        if (messages.length === 0) {
            const threadContainer = document.querySelector('[data-qa="threads_view"], .p-threads_view, [data-qa="thread_view"]');
            if (threadContainer) {
                const genericSelectors = ['[data-qa="message"]', '.c-message', '[role="listitem"]'];
                for (const selector of genericSelectors) {
                    const elements = threadContainer.querySelectorAll(selector);
                    if (elements.length > 0) {
                        messages = Array.from(elements);
                        console.log(`🧵 Found ${messages.length} messages in thread container using: ${selector}`);
                        break;
                    }
                }
            }
        }

        // Extract and filter messages
        const recentMessages = messages
            .slice(-10) // Get last 10 messages
            .map(extractMessageData)
            .filter(msg => msg && msg.timestamp > todayTimestamp)
            .filter(msg => !isSystemMessage(msg))
            .slice(-5); // Keep only last 5 after filtering

        console.log(`🧵 Extracted ${recentMessages.length} recent thread messages`);
        return recentMessages;
    }

    function extractChannelMessages() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = today.getTime();

        // Find message container (Slack's main channel structure)
        const messageSelectors = [
            '[data-qa="message"]',
            '.c-message',
            '[role="listitem"]',
            '[data-qa="virtual-list-item"]'
        ];

        let messages = [];
        for (const selector of messageSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                messages = Array.from(elements);
                console.log(`📝 Found ${messages.length} channel messages using selector: ${selector}`);
                break;
            }
        }

        // Extract and filter messages
        const recentMessages = messages
            .slice(-10) // Get last 10 messages
            .map(extractMessageData)
            .filter(msg => msg && msg.timestamp > todayTimestamp)
            .filter(msg => !isSystemMessage(msg))
            .slice(-5); // Keep only last 5 after filtering

        console.log(`📝 Extracted ${recentMessages.length} recent channel messages`);
        return recentMessages;
    }

    function extractRecentMessages() {
        // Determine if we're in a thread or main channel and extract accordingly
        if (isInThread()) {
            console.log('🧵 Detected thread context, extracting thread messages');
            return extractThreadMessages();
        } else {
            console.log('📝 Detected channel context, extracting channel messages');
            return extractChannelMessages();
        }
    }

    function getCachedMessages() {
        const currentChannel = getCurrentChannelId();
        const now = Date.now();

        // Use cache if less than 30 seconds old and same channel
        if (now - messageCache.timestamp < 30000 &&
            messageCache.channelId === currentChannel) {
            return messageCache.messages;
        }

        // Refresh cache
        const messages = extractRecentMessages();
        messageCache = {
            timestamp: now,
            messages,
            channelId: currentChannel
        };

        return messages;
    }

    function formatContextForAI(messages, userMessage) {
        if (!messages || messages.length === 0) return '';

        const contextLines = messages.map(msg =>
            `[${msg.time}] ${msg.sender}: "${msg.text}"`
        );

        const contextType = isInThread() ? 'thread discussion' : 'channel conversation';

        return `CONVERSATION CONTEXT (recent messages from today's ${contextType}):
${contextLines.join('\n')}

---
USER MESSAGE TO IMPROVE: "${userMessage}"`;
    }

    // Improve text using OpenAI API
    async function improveText(text, language, style) {
        const config = window.SLACKPOLISH_CONFIG;
        if (!config || !config.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured. Please set it in slack-config.js');
        }

        // Special handling for TRANSLATE style
        if (style === 'TRANSLATE') {
            console.log('🔄 TRANSLATE style detected - checking if translation is needed...');
            console.log(`🎯 Target language: ${language}`);

            // First, detect the language of the input text
            const detectedLanguage = await makeOpenAIRequest([
                {
                    role: 'system',
                    content: 'You are a language detector. Analyze the following text and determine its primary language. Respond with ONLY ONE WORD: "English", "Spanish", "French", "German", "Hebrew", "Chinese", "Hindi", "Bulgarian", etc. Be very strict about the language identification.'
                },
                { role: 'user', content: text }
            ], 5, 0.0);

            const detectedLanguageLower = detectedLanguage.toLowerCase();

            console.log(`🔍 Detected source language: "${detectedLanguage}"`);

            // Map target language to language names for comparison (internal logic)
            const languageMap = {
                'ENGLISH': 'english',
                'SPANISH': 'spanish',
                'FRENCH': 'french',
                'GERMAN': 'german',
                'HEBREW': 'hebrew',
                'CHINESE': 'chinese',
                'HINDI': 'hindi',
                'BULGARIAN': 'bulgarian'
            };

            const targetLanguageName = languageMap[language] || 'english';
            console.log(`🎯 Target language name: "${targetLanguageName}"`);

            // If source and target languages are the same, return unchanged
            if (detectedLanguageLower === targetLanguageName) {
                console.log(`✅ Text is already in ${targetLanguageName}, no translation needed - returning original text`);
                return text;
            }

            // Translate to the target language
            // Map target language to translation prompts (internal logic)
            const targetLanguagePrompts = {
                'ENGLISH': 'English',
                'SPANISH': 'Spanish',
                'FRENCH': 'French',
                'GERMAN': 'German',
                'HEBREW': 'Hebrew',
                'CHINESE': 'Chinese (Simplified)',
                'HINDI': 'Hindi',
                'BULGARIAN': 'Bulgarian'
            };

            const targetLanguagePrompt = targetLanguagePrompts[language] || 'English';
            console.log(`🔄 Translating from ${detectedLanguage} to ${targetLanguagePrompt}...`);

            const translatePrompt = `Translate the following text to ${targetLanguagePrompt}. Only return the translated text, nothing else. Do not improve, rephrase, or modify the meaning - just translate.`;

            const translatedText = await makeOpenAIRequest([
                { role: 'system', content: translatePrompt },
                { role: 'user', content: text }
            ], appConfig.OPENAI_MAX_TOKENS, 0.1);

            console.log(`✅ Translation completed: "${text}" -> "${translatedText}"`);
            return translatedText;
        }

        // Get current settings once
        const currentUserSettings = getCurrentSettings();

        // Smart Context System - Add context if it would improve results
        let contextPrefix = '';
        const smartContextEnabled = currentUserSettings.smartContext?.enabled !== false; // Default to true

        if (smartContextEnabled && shouldUseContext(text)) {
            const recentMessages = getCachedMessages();
            if (recentMessages.length > 0) {
                contextPrefix = formatContextForAI(recentMessages, text);
                console.log(`🧠 Using smart context with ${recentMessages.length} recent messages`);
            }
        }

        // Regular style processing (non-translate)
        // Get prompts from config file for better, more detailed instructions
        const configPrompts = config.PROMPTS || {};
        const stylePrompts = configPrompts.STYLES || {};
        const languagePrompts = configPrompts.LANGUAGES || {};

        // Fallback to simple prompts if config is missing
        const styleInstruction = stylePrompts[style] || 'Make this text more casual and friendly';
        const languageInstruction = languagePrompts[language] || 'Respond in English';

        // Add personal polish if provided
        const personalPolish = currentUserSettings.personalPolish || '';
        const personalInstruction = personalPolish ? ` Additionally, follow these personal style preferences: ${personalPolish}` : '';

        // Combine context and prompt
        const basePrompt = `${styleInstruction}. ${languageInstruction}.${personalInstruction} Only return the improved text, nothing else.`;
        const prompt = contextPrefix ? `${contextPrefix}\n\n${basePrompt}` : basePrompt;

        const improvedText = await makeOpenAIRequest([
            { role: 'system', content: prompt },
            { role: 'user', content: text }
        ], appConfig.OPENAI_MAX_TOKENS, appConfig.OPENAI_TEMPERATURE);

        return improvedText;
    }

    // Visual debug function - only shows if debug mode is enabled
    function showDebugInfo(info) {
        const settings = getCurrentSettings();
        if (!settings.debugMode) {
            return; // Debug mode is disabled, don't show visual debug
        }

        // Remove any existing debug info
        const existing = document.getElementById('slackpolish-debug');
        if (existing) existing.remove();

        // Create debug overlay
        const debugDiv = document.createElement('div');
        debugDiv.id = 'slackpolish-debug';
        debugDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #000;
            color: #0f0;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 10000;
            max-width: 400px;
            white-space: pre-wrap;
            border: 2px solid #0f0;
        `;
        debugDiv.textContent = info;
        document.body.appendChild(debugDiv);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (debugDiv.parentNode) {
                debugDiv.remove();
            }
        }, 10000);
    }

    // Debug console logging - only logs if debug mode is enabled
    function debugLog(message, ...args) {
        const settings = getCurrentSettings();
        if (settings.debugMode) {
            console.log(message, ...args);
        }
    }

    // Main text improvement function
    async function improveTextInSlack() {
        try {
            // Show debug info about current state
            const debugInfo = `🔍 DEBUG INFO:
URL: ${window.location.href}
Is in thread: ${isInThread()}
Active element: ${document.activeElement?.tagName}.${document.activeElement?.className}
Active data-qa: ${document.activeElement?.getAttribute('data-qa')}

Searching for text input...`;

            showDebugInfo(debugInfo);

            const text = extractTextFromInput();
            if (!text.trim()) {
                showDebugInfo('❌ No text found to improve');
                console.log('❌ No text found to improve');
                return;
            }

            // Show what text was found
            const textInfo = `✅ FOUND TEXT: "${text}"
Length: ${text.length} chars
From: ${isInThread() ? 'THREAD' : 'CHANNEL'}`;

            showDebugInfo(textInfo);

            const settings = getCurrentSettings();
            console.log(`🌍 Using language: ${settings.language}, 🎨 Style: ${settings.style}`);

            showLoadingIndicator();

            const improvedText = await improveText(text, settings.language, settings.style);

            hideLoadingIndicator();

            console.log('✅ Improvement successful');
            console.log(`📝 Original: "${text}"`);
            console.log(`✨ Improved: "${improvedText}"`);

            replaceTextInInput(improvedText);

        } catch (error) {
            hideLoadingIndicator();
            console.error('❌ Error during text improvement:', error);
            handleApiError(error);
        }
    }

    // Generate language options from config
    function generateLanguageOptions(selectedLanguage) {
        const languages = appConfig.SUPPORTED_LANGUAGES;
        return Object.keys(languages).map(key => {
            const lang = languages[key];
            const selected = selectedLanguage === key ? 'selected' : '';
            return `<option value="${key}" ${selected}>${lang.flag} ${lang.displayName}</option>`;
        }).join('');
    }

    // Generate style options from config with descriptions
    function generateStyleOptions(selectedStyle) {
        const styles = appConfig.AVAILABLE_STYLES;
        return Object.keys(styles).map(key => {
            const style = styles[key];
            const selected = selectedStyle === key ? 'selected' : '';
            const displayText = `${style.name} - ${style.description}`;
            return `<option value="${key}" ${selected}>${displayText}</option>`;
        }).join('');
    }

    // Generate hotkey options from config
    function generateHotkeyOptions(selectedHotkey) {
        const hotkeys = appConfig.AVAILABLE_HOTKEYS;
        return hotkeys.map(hotkey => {
            const selected = selectedHotkey === hotkey ? 'selected' : '';
            const icon = hotkey === 'Ctrl+Shift' ? '⌨️' : hotkey === 'Ctrl+Alt' ? '🔀' : '📑';
            const label = hotkey === 'Ctrl+Shift' ? `${hotkey} (Default)` : hotkey;
            return `<option value="${hotkey}" ${selected}>${icon} ${label}</option>`;
        }).join('');
    }

    // Developer mode state
    let developerModeEnabled = false;
    let clickCount = 0;
    let clickTimer = null;

    // API key validation
    function validateApiKey(apiKey) {
        if (!apiKey) return { valid: false, message: 'API key is required' };
        if (!apiKey.startsWith('sk-')) return { valid: false, message: 'API key should start with "sk-"' };
        if (apiKey.length < 20) return { valid: false, message: 'API key seems too short' };
        return { valid: true, message: 'API key format looks correct' };
    }

    // Test API key functionality
    async function testApiKey(apiKey) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: 'Test' }],
                    max_tokens: 5
                })
            });

            if (response.ok) {
                return { success: true, message: 'API key is working!' };
            } else if (response.status === 401) {
                return { success: false, message: 'Invalid API key' };
            } else if (response.status === 429) {
                return { success: false, message: 'Rate limit exceeded or insufficient credits' };
            } else {
                return { success: false, message: `API error: ${response.status}` };
            }
        } catch (error) {
            return { success: false, message: 'Network error: ' + error.message };
        }
    }

    // Enhanced settings menu with dynamic options
    function showSettingsMenu() {
        const settings = getCurrentSettings();
        console.log(`🌍 Current language: ${settings.language}, 🎨 Current style: ${settings.style}`);

        // Remove existing menu
        const existing = document.getElementById('slack-text-improver-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.id = 'slack-text-improver-menu';
        menu.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10001;
            font-family: Arial, sans-serif;
            min-width: 300px;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
        `;

        menu.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 20px; padding: 12px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 8px; border: 1px solid #dee2e6;">
                <div style="background: white; border-radius: 8px; padding: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-right: 16px; display: flex; align-items: center; justify-content: center;" id="settings-menu-logo">
                </div>
                <div>
                    <div style="font-weight: bold; font-size: 18px; color: #2c3e50; margin-bottom: 4px;">SlackPolish Settings</div>
                    <div style="font-size: 13px; color: #6c757d;">AI-powered text enhancement for Slack</div>
                    <div id="dev-mode-indicator" style="display: none; font-size: 11px; color: #007a5a; font-weight: normal; margin-top: 4px;">
                        🔧 Developer Mode Active
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">🌍 Language:</label>
                <select id="language-select" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                    ${generateLanguageOptions(settings.language)}
                </select>
            </div>

            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">✨ Style:</label>
                <select id="style-select" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                    ${generateStyleOptions(settings.style)}
                </select>
            </div>

            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">⌨️ Hotkey:</label>
                <select id="hotkey-select" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                    ${generateHotkeyOptions(settings.improveHotkey || 'Ctrl+Shift')}
                </select>
                <div style="font-size: 12px; color: #666; margin-top: 4px;">
                    Choose your preferred hotkey combination. Settings hotkey (F12) cannot be changed.
                </div>
            </div>

            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">✨ Personal Style:</label>
                <textarea id="personal-polish-input" placeholder="e.g., Use 'Hi' not 'Hey', avoid dashes, British spelling"
                    style="width: 100%; height: 60px; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; resize: vertical; font-size: 13px;">${settings.personalPolish || ''}</textarea>
                <div style="font-size: 11px; color: #666; margin-top: 2px;">
                    Personal writing preferences for AI to consider.
                </div>
            </div>

            <!-- Developer Mode Container (Hidden by default) -->
            <div id="developer-options" style="display: none;">
                <div style="border-top: 1px solid #ddd; margin: 15px 0; padding-top: 15px;">
                    <div style="text-align: center; margin-bottom: 10px;">
                        <span style="background: #007a5a; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;">
                            🔧 DEVELOPER MODE
                        </span>
                    </div>

                    <!-- API Key Management -->
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">
                            🔑 OpenAI API Key
                        </label>
                        <div style="position: relative;">
                            <input type="password" id="api-key-input" placeholder="sk-..."
                                   value="${settings.apiKey || ''}"
                                   style="width: 100%; padding: 6px 35px 6px 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; font-family: monospace;">
                            <button type="button" id="toggle-api-key"
                                    style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 14px; padding: 2px;">
                                👁️
                            </button>
                        </div>
                        <div style="display: flex; align-items: center; margin-top: 4px; gap: 8px;">
                            <button id="test-api-key" style="padding: 4px 8px; border: 1px solid #007a5a; background: white; color: #007a5a; border-radius: 3px; cursor: pointer; font-size: 11px;">
                                Test Key
                            </button>
                            <div id="api-key-status" style="font-size: 11px; color: #666; flex: 1;">
                                Your OpenAI API key for text improvement. <a href="https://platform.openai.com/api-keys" target="_blank" style="color: #007a5a;">Get one here</a>
                            </div>
                        </div>
                    </div>

                    <!-- Smart Context Settings -->
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">
                            🧠 Smart Context
                        </label>
                        <div style="margin-bottom: 6px;">
                            <label style="display: flex; align-items: center; cursor: pointer; font-size: 13px;">
                                <input type="checkbox" id="smartContextEnabled" ${settings.smartContext?.enabled !== false ? 'checked' : ''}
                                       style="margin-right: 6px;">
                                <span>Enable (include recent messages)</span>
                            </label>
                        </div>
                        <div style="margin-bottom: 6px;">
                            <label style="display: flex; align-items: center; cursor: pointer; font-size: 13px;">
                                <input type="checkbox" id="smartContextPrivacy" ${settings.smartContext?.privacyMode ? 'checked' : ''}
                                       style="margin-right: 6px;">
                                <span>Privacy Mode (anonymize names)</span>
                            </label>
                        </div>
                        <div style="font-size: 11px; color: #666; margin-top: 2px;">
                            Includes recent messages for short/ambiguous responses.
                        </div>
                    </div>

                    <!-- Debug Mode Settings -->
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">
                            🔍 Debug Mode
                        </label>
                        <div style="margin-bottom: 6px;">
                            <label style="display: flex; align-items: center; cursor: pointer; font-size: 13px;">
                                <input type="checkbox" id="debugModeEnabled" ${settings.debugMode ? 'checked' : ''}
                                       style="margin-right: 6px;">
                                <span>Show debug info</span>
                            </label>
                        </div>
                        <div style="font-size: 11px; color: #666; margin-top: 2px;">
                            Shows green debug boxes for troubleshooting.
                        </div>
                    </div>
                </div>
            </div>

            <div style="text-align: right; margin-top: 15px; position: relative;">
                <!-- Hidden developer mode trigger -->
                <div id="dev-mode-trigger" style="position: absolute; bottom: 0; left: 0; width: 30px; height: 30px; cursor: pointer; opacity: 0;"></div>

                <button id="cancel-btn" style="margin-right: 8px; padding: 6px 12px; border: 1px solid #ddd; background: #f8f8f8; border-radius: 4px; cursor: pointer; font-size: 13px;">Cancel</button>
                <button id="save-btn" style="padding: 6px 12px; border: none; background: #007a5a; color: white; border-radius: 4px; cursor: pointer; font-size: 13px;">Save</button>
            </div>
        `;

        document.body.appendChild(menu);

        // Add logo to settings menu
        const logoContainer = document.getElementById('settings-menu-logo');
        if (logoContainer) {
            logoContainer.appendChild(createSlackPolishLogo(48));
        }

        // Developer mode trigger handler
        document.getElementById('dev-mode-trigger').onclick = () => {
            clickCount++;

            // Reset click count after 2 seconds of inactivity
            if (clickTimer) clearTimeout(clickTimer);
            clickTimer = setTimeout(() => {
                clickCount = 0;
            }, 2000);

            // Enable developer mode after 10 clicks
            if (clickCount >= 10) {
                developerModeEnabled = true;

                // Show developer options
                const devOptions = document.getElementById('developer-options');
                if (devOptions) {
                    devOptions.style.display = 'block';
                    devOptions.scrollIntoView({ behavior: 'smooth' });
                }

                // Show developer mode indicator
                const devIndicator = document.getElementById('dev-mode-indicator');
                if (devIndicator) {
                    devIndicator.style.display = 'block';
                }

                // Show confirmation on trigger
                const trigger = document.getElementById('dev-mode-trigger');
                trigger.style.background = '#007a5a';
                trigger.style.opacity = '0.3';
                trigger.style.borderRadius = '50%';
                trigger.title = 'Developer mode enabled!';

                // Reset click count
                clickCount = 0;
                clearTimeout(clickTimer);

                console.log('🔧 Developer mode enabled!');
            } else {
                // Visual feedback for clicks
                const trigger = document.getElementById('dev-mode-trigger');
                trigger.style.background = '#ddd';
                trigger.style.opacity = '0.2';
                setTimeout(() => {
                    trigger.style.background = '';
                    trigger.style.opacity = '0';
                }, 100);

                console.log(`🔧 Developer mode: ${clickCount}/10 clicks`);
            }
        };

        // API Key handlers (only if developer mode is enabled)
        const toggleApiKey = document.getElementById('toggle-api-key');
        const apiKeyInput = document.getElementById('api-key-input');
        const apiKeyStatus = document.getElementById('api-key-status');
        const testApiKeyBtn = document.getElementById('test-api-key');

        if (toggleApiKey && apiKeyInput) {
            // Toggle visibility handler
            toggleApiKey.onclick = () => {
                const isPassword = apiKeyInput.type === 'password';

                apiKeyInput.type = isPassword ? 'text' : 'password';
                toggleApiKey.textContent = isPassword ? '🙈' : '👁️';
                toggleApiKey.title = isPassword ? 'Hide API key' : 'Show API key';
            };

            // Real-time validation handler
            apiKeyInput.oninput = () => {
                const apiKey = apiKeyInput.value.trim();
                const validation = validateApiKey(apiKey);

                if (apiKeyStatus) {
                    if (!apiKey) {
                        apiKeyStatus.innerHTML = 'Your OpenAI API key for text improvement. <a href="https://platform.openai.com/api-keys" target="_blank" style="color: #007a5a;">Get one here</a>';
                        apiKeyStatus.style.color = '#666';
                        apiKeyInput.style.borderColor = '#ddd';
                    } else if (validation.valid) {
                        apiKeyStatus.textContent = '✅ ' + validation.message;
                        apiKeyStatus.style.color = '#28a745';
                        apiKeyInput.style.borderColor = '#28a745';
                    } else {
                        apiKeyStatus.textContent = '❌ ' + validation.message;
                        apiKeyStatus.style.color = '#dc3545';
                        apiKeyInput.style.borderColor = '#dc3545';
                    }
                }
            };

            // Initial validation
            if (apiKeyInput.value.trim()) {
                apiKeyInput.oninput();
            }
        }

        // Test API key button handler
        if (testApiKeyBtn && apiKeyInput && apiKeyStatus) {
            testApiKeyBtn.onclick = async () => {
                const apiKey = apiKeyInput.value.trim();

                if (!apiKey) {
                    apiKeyStatus.textContent = '❌ Please enter an API key first';
                    apiKeyStatus.style.color = '#dc3545';
                    return;
                }

                // Show testing state
                testApiKeyBtn.textContent = 'Testing...';
                testApiKeyBtn.disabled = true;
                apiKeyStatus.textContent = '🔄 Testing API key...';
                apiKeyStatus.style.color = '#007a5a';

                try {
                    const result = await testApiKey(apiKey);

                    if (result.success) {
                        apiKeyStatus.textContent = '✅ ' + result.message;
                        apiKeyStatus.style.color = '#28a745';
                        apiKeyInput.style.borderColor = '#28a745';
                    } else {
                        apiKeyStatus.textContent = '❌ ' + result.message;
                        apiKeyStatus.style.color = '#dc3545';
                        apiKeyInput.style.borderColor = '#dc3545';
                    }
                } catch (error) {
                    apiKeyStatus.textContent = '❌ Test failed: ' + error.message;
                    apiKeyStatus.style.color = '#dc3545';
                } finally {
                    testApiKeyBtn.textContent = 'Test Key';
                    testApiKeyBtn.disabled = false;
                }
            };
        }

        // Event handlers
        document.getElementById('cancel-btn').onclick = () => menu.remove();

        document.getElementById('save-btn').onclick = () => {
            const newSettings = {
                ...settings,
                language: document.getElementById('language-select').value,
                style: document.getElementById('style-select').value,
                improveHotkey: document.getElementById('hotkey-select').value,
                personalPolish: document.getElementById('personal-polish-input').value
            };

            // Only save developer options if developer mode is enabled
            if (developerModeEnabled) {
                // Save API key
                const apiKeyInput = document.getElementById('api-key-input');
                const apiKeyStatus = document.getElementById('api-key-status');
                if (apiKeyInput) {
                    const apiKeyValue = apiKeyInput.value.trim();
                    if (apiKeyValue) {
                        newSettings.apiKey = apiKeyValue;
                        console.log('🔑 API key updated');

                        // Show immediate feedback
                        if (apiKeyStatus) {
                            apiKeyStatus.textContent = '✅ API key saved and will be used for next requests';
                            apiKeyStatus.style.color = '#28a745';
                        }
                    } else if (settings.apiKey) {
                        // If field is empty but we had a key before, remove it
                        delete newSettings.apiKey;
                        console.log('🔑 API key removed');

                        if (apiKeyStatus) {
                            apiKeyStatus.textContent = '⚠️ API key removed - using config file key';
                            apiKeyStatus.style.color = '#ffc107';
                        }
                    }
                }

                // Save other developer options
                newSettings.smartContext = {
                    ...settings.smartContext,
                    enabled: document.getElementById('smartContextEnabled').checked,
                    privacyMode: document.getElementById('smartContextPrivacy').checked
                };
                newSettings.debugMode = document.getElementById('debugModeEnabled').checked;
            }

            saveSettings(newSettings);
            currentSettings = newSettings; // Update current settings immediately

            menu.remove();

            console.log(`✅ Settings saved! New hotkey: ${newSettings.improveHotkey}`);
            if (developerModeEnabled && newSettings.apiKey) {
                console.log('🔑 API key updated and will be used for next requests');
            }
        };

        // Close on Escape
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                menu.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    // Enhanced hotkey handler with debug info
    function handleKeyDown(event) {
        // Debug log key presses only if debug mode is enabled
        debugLog(`🔍 KEY PRESSED: ${event.key}, Ctrl: ${event.ctrlKey}, Shift: ${event.shiftKey}, Alt: ${event.altKey}, Meta: ${event.metaKey}`);
        debugLog(`🔍 Active element:`, document.activeElement);
        debugLog(`🔍 Active element tag:`, document.activeElement?.tagName);
        debugLog(`🔍 Active element classes:`, document.activeElement?.className);
        debugLog(`🔍 Active element data-qa:`, document.activeElement?.getAttribute('data-qa'));
        debugLog(`🔍 Current URL:`, window.location.href);
        debugLog(`🔍 Is in thread:`, isInThread());

        const settings = getCurrentSettings();
        const activeElement = document.activeElement;

        // Debug: Test each condition individually
        const conditions = {
            isInput: activeElement?.tagName === 'INPUT',
            isTextarea: activeElement?.tagName === 'TEXTAREA',
            isContentEditable: activeElement?.contentEditable === 'true',
            hasTextboxRole: activeElement?.getAttribute('role') === 'textbox',
            matchesMessageInput: activeElement?.matches('[data-qa="message_input"]'),
            matchesThreadInput: activeElement?.matches('[data-qa="thread_message_input"]'),
            matchesQlEditor: activeElement?.matches('.ql-editor'),
            matchesTextyInput: activeElement?.matches('.c-texty_input'),
            matchesMessageField: activeElement?.matches('.p-message_input_field'),
            closestMessageInput: !!activeElement?.closest('[data-qa="message_input"]'),
            closestThreadInput: !!activeElement?.closest('[data-qa="thread_message_input"]'),
            closestQlEditor: !!activeElement?.closest('.ql-editor'),
            closestTextyInput: !!activeElement?.closest('.c-texty_input'),
            closestMessageField: !!activeElement?.closest('.p-message_input_field')
        };

        debugLog(`🔍 TEXT FIELD CONDITIONS:`, conditions);

        const isInTextField = activeElement && (
            conditions.isInput ||
            conditions.isTextarea ||
            conditions.isContentEditable ||
            conditions.hasTextboxRole ||
            conditions.matchesMessageInput ||
            conditions.matchesThreadInput ||
            conditions.matchesQlEditor ||
            conditions.matchesTextyInput ||
            conditions.matchesMessageField ||
            conditions.closestMessageInput ||
            conditions.closestThreadInput ||
            conditions.closestQlEditor ||
            conditions.closestTextyInput ||
            conditions.closestMessageField
        );

        debugLog(`🔍 IS IN TEXT FIELD: ${isInTextField}`);

        // Check for text improvement hotkey - prioritize this check
        const improveHotkey = settings.improveHotkey || 'Ctrl+Shift';
        console.log(`🔍 Checking hotkey match: "${improveHotkey}" (in text field: ${isInTextField})`);
        if (hotkeyMatches(event, improveHotkey)) {
            console.log(`🎯 ${improveHotkey} detected - triggering text improvement!`);
            // Try to improve text regardless of text field detection for better thread support
            setTimeout(() => improveTextInSlack(), 10);
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        // Check for settings menu hotkey (fixed F12) - works everywhere
        if (event.code === 'F12' && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
            const location = isInTextField ? 'in text field' : '';
            console.log(`🎯 F12 detected ${location} - opening settings!`);
            setTimeout(() => showSettingsMenu(), 10);
            event.preventDefault();
            event.stopPropagation();
        }
    }

    // Initialize
    function initialize() {
        console.log('🔧 Initializing SlackPolish...');

        loadSettings();

        // Add event listeners
        document.addEventListener('keydown', handleKeyDown, true);
        document.addEventListener('keydown', handleChannelSummaryHotkey, true);

        window.addEventListener('focus', () => {
            isSlackFocused = true;
            console.log('👁️ Slack window focused');
        });

        window.addEventListener('blur', () => {
            isSlackFocused = false;
            console.log('👁️ Slack window blurred');
        });

        const settings = getCurrentSettings();
        console.log('✅ SlackPolish initialized!');
        console.log('💡 Usage:');
        console.log(`   - Press ${settings.improveHotkey || 'Ctrl+Shift'} to improve text`);
        console.log('   - Press F10 to open channel summary');
        console.log('   - Press F12 to open settings menu');
        console.log('⚠️  Remember to set your OpenAI API key in slack-config.js');
    }

    // ========================================
    // CHANNEL SUMMARY FUNCTIONALITY
    // ========================================

    class ChannelSummarizer {
        constructor() {
            this.summaryWindow = null;
            this.preferences = this.loadPreferences();
            this.isProcessing = false;
            this.logBuffer = [];
        }

        loadPreferences() {
            try {
                const saved = localStorage.getItem('slackpolish_summary_preferences');
                return saved ? JSON.parse(saved) : {
                    depth: window.SLACKPOLISH_CONFIG?.CHANNEL_SUMMARY?.DEFAULT_DEPTH || 'last24hours',
                    level: window.SLACKPOLISH_CONFIG?.CHANNEL_SUMMARY?.DEFAULT_LEVEL || 'short',
                    windowSize: window.SLACKPOLISH_CONFIG?.CHANNEL_SUMMARY?.WINDOW_SIZE || { width: 800, height: 600 }
                };
            } catch (error) {
                console.error('Failed to load summary preferences:', error);
                return {
                    depth: 'last24hours',
                    level: 'short',
                    windowSize: { width: 800, height: 600 }
                };
            }
        }

        // Log to both console and summary textbox
        logToSummary(message, type = 'info') {
            // Always log to console
            console.log(message);

            // Add to log buffer
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = `[${timestamp}] ${message}`;
            this.logBuffer.push(logEntry);

            // Update the summary textbox if window is open
            if (this.summaryWindow && !this.summaryWindow.closed) {
                const doc = this.summaryWindow.document;
                const summaryTextbox = doc.getElementById('summaryTextbox');
                if (summaryTextbox) {
                    summaryTextbox.value = this.logBuffer.join('\n');
                    // Auto-scroll to bottom
                    summaryTextbox.scrollTop = summaryTextbox.scrollHeight;
                }
            }
        }

        // Clear the log buffer and textbox
        clearLog() {
            this.logBuffer = [];
            if (this.summaryWindow && !this.summaryWindow.closed) {
                const doc = this.summaryWindow.document;
                const summaryTextbox = doc.getElementById('summaryTextbox');
                if (summaryTextbox) {
                    summaryTextbox.value = '';
                }
            }
        }

        savePreferences() {
            try {
                localStorage.setItem('slackpolish_summary_preferences', JSON.stringify(this.preferences));
            } catch (error) {
                console.error('Failed to save summary preferences:', error);
            }
        }

        getCurrentChannelInfo() {
            try {
                this.logToSummary('🔍 Channel Summary: Detecting current channel...');

                // Try multiple selectors for channel name
                let channelName = 'Unknown Channel';
                const selectors = [
                    '[data-qa="channel_header_name"]',
                    '[data-qa="channel-name"]',
                    '.p-view_header__channel_title',
                    '[data-qa="channel_header"] h1',
                    '[data-qa="dm_header"] h1',
                    '.p-channel_sidebar__name--selected',
                    '.p-classic_nav__model__title__name',
                    '.c-channel_entity__name'
                ];

                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent?.trim()) {
                        channelName = element.textContent.trim();
                        this.logToSummary(`✅ Channel Summary: Found channel name using selector: ${selector} → ${channelName}`);
                        break;
                    }
                }

                // If still no name found, try to extract from URL
                if (channelName === 'Unknown Channel') {
                    const urlParts = window.location.pathname.split('/');
                    const possibleChannelId = urlParts[urlParts.length - 1];
                    if (possibleChannelId && possibleChannelId.length > 3) {
                        channelName = `#${possibleChannelId}`;
                        this.logToSummary(`🔍 Channel Summary: Using URL-based channel name: ${channelName}`);
                    }
                }

                const channelId = this.extractChannelId();

                return {
                    name: channelName,
                    id: channelId,
                    type: channelName.startsWith('#') ? 'channel' : 'dm'
                };
            } catch (error) {
                this.logToSummary(`❌ Channel Summary: Failed to get channel info: ${error.message}`);
                return {
                    name: 'Current Channel',
                    id: null,
                    type: 'unknown'
                };
            }
        }

        extractChannelId() {
            try {
                // Try to extract channel ID from URL or DOM attributes
                const url = window.location.href;
                const channelMatch = url.match(/\/client\/([^\/]+)/);
                return channelMatch ? channelMatch[1] : null;
            } catch (error) {
                console.error('Failed to extract channel ID:', error);
                return null;
            }
        }

        async openSummaryWindow() {
            if (this.summaryWindow && !this.summaryWindow.closed) {
                this.summaryWindow.focus();
                return;
            }

            // Clear logs when opening new window
            this.clearLog();

            const channelInfo = this.getCurrentChannelInfo();
            const windowFeatures = `width=${this.preferences.windowSize.width},height=${this.preferences.windowSize.height},scrollbars=yes,resizable=yes`;

            this.summaryWindow = window.open('', 'SlackPolishSummary', windowFeatures);

            if (!this.summaryWindow) {
                alert('❌ Could not open summary window. Please allow popups for Slack.');
                return;
            }

            this.createSummaryWindowContent(channelInfo);
            this.logToSummary('🚀 Channel Summary window opened successfully');
        }

        createSummaryWindowContent(channelInfo) {
            const doc = this.summaryWindow.document;
            doc.open();
            doc.write(this.generateSummaryHTML(channelInfo));
            doc.close();

            // Add event listeners to the new window
            this.setupSummaryWindowEvents();
        }

        generateSummaryHTML(channelInfo) {

            return `
<!DOCTYPE html>
<html>
<head>
    <title>SlackPolish Summary</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            max-width: 800px;
            margin: 0 auto;
            height: calc(100vh - 40px);
            display: flex;
            flex-direction: column;
        }
        .header {
            display: flex;
            align-items: center;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid #f0f0f0;
            flex-shrink: 0;
        }
        .logo {
            width: 32px;
            height: 32px;
            margin-right: 12px;
            background: #1264a3;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
        }
        .title {
            flex: 1;
        }
        .title h1 {
            margin: 0;
            color: #1264a3;
            font-size: 18px;
            font-weight: 600;
        }
        .controls {
            padding: 16px;
            background: #f8f9fa;
            border-radius: 8px;
            margin-bottom: 20px;
            flex-shrink: 0;
        }
        .controls-row {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 16px;
            align-items: end;
        }
        .dropdown-group {
            display: flex;
            flex-direction: column;
        }
        .dropdown-group label {
            font-weight: 600;
            margin-bottom: 4px;
            color: #333;
            font-size: 12px;
        }
        .dropdown-select {
            background: white;
            border: 2px solid #ddd;
            border-radius: 4px;
            padding: 6px 10px;
            font-size: 12px;
            color: #333;
            cursor: pointer;
            transition: all 0.2s ease;
            appearance: none;
            background-image: url('data:image/svg+xml;charset=US-ASCII,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 5"><path fill="%23666" d="M2 0L0 2h4zm0 5L0 3h4z"/></svg>');
            background-repeat: no-repeat;
            background-position: right 8px center;
            background-size: 10px;
            padding-right: 24px;
            height: 32px;
        }
        .dropdown-select:hover {
            border-color: #1264a3;
            box-shadow: 0 2px 8px rgba(18, 100, 163, 0.1);
        }
        .dropdown-select:focus {
            outline: none;
            border-color: #1264a3;
            box-shadow: 0 0 0 3px rgba(18, 100, 163, 0.1);
        }
        .button-group {
            display: flex;
            align-items: end;
        }
        .summarize-btn {
            background: linear-gradient(135deg, #1264a3 0%, #0d4f73 100%);
            color: white;
            border: none;
            padding: 8px 20px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            height: 32px;
        }
        .summarize-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 16px rgba(18, 100, 163, 0.3);
        }
        .summarize-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        .summary-section {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
        }
        .summary-meta {
            background: #e3f2fd;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 10px;
            color: #1264a3;
            margin-bottom: 8px;
            text-align: center;
            flex-shrink: 0;
        }
        .summary-textbox {
            background: white;
            border: 2px solid #ddd;
            border-radius: 6px;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            font-size: 14px;
            color: #333;
            resize: none;
            outline: none;
            flex: 1;
            overflow-y: auto;
            white-space: pre-wrap;
        }
        .summary-textbox:focus {
            border-color: #1264a3;
            box-shadow: 0 0 0 3px rgba(18, 100, 163, 0.1);
        }
        .summary-textbox::placeholder {
            color: #999;
            font-style: italic;
        }
        .bottom-actions {
            margin-top: 16px;
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 12px;
            padding: 12px 0;
            border-top: 1px solid #f0f0f0;
            flex-shrink: 0;
        }
        .action-btn {
            background: white;
            border: 2px solid #ddd;
            border-radius: 4px;
            padding: 8px 16px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            height: 32px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .action-btn:hover {
            border-color: #1264a3;
            background: #f8f9fa;
        }
        .action-btn.primary {
            background: #1264a3;
            color: white;
            border-color: #1264a3;
        }
        .action-btn.primary:hover {
            background: #0d4f73;
            border-color: #0d4f73;
        }
        .action-btn:disabled {
            background: #f5f5f5;
            color: #999;
            border-color: #e0e0e0;
            cursor: not-allowed;
        }
        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            font-style: italic;
        }
        .spinner {
            width: 20px;
            height: 20px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #1264a3;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 12px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .error {
            color: #d32f2f;
            background: #ffebee;
            padding: 12px 16px;
            border-radius: 6px;
            border-left: 4px solid #d32f2f;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">SP</div>
            <div class="title">
                <h1>SlackPolish Summary</h1>
            </div>
        </div>

        <div class="controls">
            <div class="controls-row">
                <div class="dropdown-group">
                    <label for="depthSelect">Summary Depth:</label>
                    <select id="depthSelect" class="dropdown-select">
                        <option value="last24hours" ${this.preferences.depth === 'last24hours' ? 'selected' : ''}>Last 24 hours</option>
                        <option value="last7days" ${this.preferences.depth === 'last7days' ? 'selected' : ''}>Last 7 days</option>
                        <option value="last30days" ${this.preferences.depth === 'last30days' ? 'selected' : ''}>Last 30 days</option>
                        <option value="entirechannel" ${this.preferences.depth === 'entirechannel' ? 'selected' : ''}>Entire channel</option>
                    </select>
                </div>

                <div class="dropdown-group">
                    <label for="levelSelect">Summary Level:</label>
                    <select id="levelSelect" class="dropdown-select">
                        <option value="short" ${this.preferences.level === 'short' ? 'selected' : ''}>Short</option>
                        <option value="medium" ${this.preferences.level === 'medium' ? 'selected' : ''}>Medium</option>
                        <option value="comprehensive" ${this.preferences.level === 'comprehensive' ? 'selected' : ''}>Comprehensive</option>
                    </select>
                </div>

                <div class="button-group">
                    <button class="summarize-btn" onclick="window.opener.channelSummarizer.generateSummary()">
                        Summarize Channel
                    </button>
                </div>
            </div>
        </div>

        <div class="summary-section">
            <div class="summary-meta" id="summaryMeta">Channel: ${channelInfo.name}</div>
            <textarea class="summary-textbox" id="summaryTextbox" readonly placeholder="Click 'Summarize Channel' to generate an AI-powered summary of the channel conversation.

During processing, this area will show:
• Real-time progress logs
• Channel detection status
• Message extraction progress
• AI processing updates

The final summary will appear here with:
• Key discussion points
• Important decisions made
• Action items and assignments
• Active participant analysis

The text will be copyable but not editable."></textarea>
        </div>

        <div class="bottom-actions">
            <button class="action-btn primary" id="copySummaryBtn" onclick="window.opener.channelSummarizer.copySummary()" disabled>
                📋 Copy Summary
            </button>
            <button class="action-btn" onclick="window.close()">
                ✕ Close
            </button>
        </div>
    </div>
</body>
</html>`;
        }

        setupSummaryWindowEvents() {
            const doc = this.summaryWindow.document;

            // Add event listeners for dropdown changes to save preferences
            const depthSelect = doc.getElementById('depthSelect');
            const levelSelect = doc.getElementById('levelSelect');

            if (depthSelect) {
                depthSelect.addEventListener('change', () => {
                    this.preferences.depth = depthSelect.value;
                    this.savePreferences();
                    console.log('📊 Channel Summary: Depth changed to', depthSelect.value);
                });
            }

            if (levelSelect) {
                levelSelect.addEventListener('change', () => {
                    this.preferences.level = levelSelect.value;
                    this.savePreferences();
                    console.log('📊 Channel Summary: Level changed to', levelSelect.value);
                });
            }
        }

        async generateSummary() {
            this.logToSummary('🔍 Channel Summary: generateSummary() called');
            if (this.isProcessing) {
                this.logToSummary('⚠️ Channel Summary: Already processing, skipping');
                return;
            }

            this.isProcessing = true;
            this.clearLog(); // Clear previous logs
            this.logToSummary('✅ Channel Summary: Starting summary generation');

            const doc = this.summaryWindow.document;
            const summaryTextbox = doc.getElementById('summaryTextbox');
            const copySummaryBtn = doc.getElementById('copySummaryBtn');
            const summarizeBtn = doc.querySelector('.summarize-btn');

            // Update button state
            summarizeBtn.disabled = true;
            summarizeBtn.textContent = 'Generating...';

            try {
                // Get current selections from dropdowns
                const depthSelect = doc.getElementById('depthSelect');
                const levelSelect = doc.getElementById('levelSelect');
                const selectedDepth = depthSelect?.value || 'last24hours';
                const selectedLevel = levelSelect?.value || 'short';
                this.logToSummary(`📊 Channel Summary: Selected depth: ${selectedDepth}, level: ${selectedLevel}`);

                // Update preferences
                this.preferences.depth = selectedDepth;
                this.preferences.level = selectedLevel;
                this.savePreferences();
                this.logToSummary('💾 Channel Summary: Preferences saved');

                // Get channel messages
                this.logToSummary('📝 Channel Summary: Fetching messages...');
                const messages = await this.fetchChannelMessages(selectedDepth);
                this.logToSummary(`📝 Channel Summary: Found ${messages?.length || 0} messages`);

                if (!messages || messages.length === 0) {
                    throw new Error('No messages found in the selected time range.');
                }

                // Generate summary using OpenAI
                this.logToSummary('🤖 Channel Summary: Generating AI summary...');
                const summary = await this.generateAISummary(messages, selectedLevel);
                this.logToSummary(`✅ Channel Summary: AI summary generated, length: ${summary?.length || 0}`);

                // Display results
                if (summaryTextbox) {
                    // Clear logs and show final summary
                    this.logBuffer = [];
                    summaryTextbox.value = summary;
                    this.logToSummary('✅ Channel Summary: Summary displayed in textbox');

                    // Enable copy button
                    if (copySummaryBtn) {
                        copySummaryBtn.disabled = false;
                        this.logToSummary('✅ Channel Summary: Copy button enabled');
                    }
                }

            } catch (error) {
                this.logToSummary(`❌ Summary generation failed: ${error.message}`);
                if (summaryTextbox) {
                    summaryTextbox.value = `❌ Error generating summary: ${error.message}\n\n--- Debug Log ---\n${this.logBuffer.join('\n')}`;
                }
            } finally {
                this.isProcessing = false;
                summarizeBtn.disabled = false;
                summarizeBtn.textContent = 'Summarize Channel';
            }
        }

        async fetchChannelMessages(depth) {
            try {
                this.logToSummary(`📋 Channel Summary: Fetching messages for depth: ${depth}`);
                // This is a simplified version - in a real implementation,
                // we would need to access Slack's internal APIs or DOM
                const messages = this.extractMessagesFromDOM(depth);
                this.logToSummary(`📋 Channel Summary: Successfully fetched ${messages.length} messages`);
                return messages;
            } catch (error) {
                this.logToSummary(`❌ Failed to fetch messages: ${error.message}`);
                throw new Error('Could not access channel messages. Please ensure you have the necessary permissions.');
            }
        }

        copySummary() {
            const doc = this.summaryWindow.document;
            const summaryTextbox = doc.getElementById('summaryTextbox');

            if (summaryTextbox && summaryTextbox.value) {
                // Select and copy the text
                summaryTextbox.select();
                summaryTextbox.setSelectionRange(0, 99999); // For mobile devices

                try {
                    document.execCommand('copy');
                    console.log('✅ Channel Summary: Summary copied to clipboard');

                    // Show brief feedback
                    const copySummaryBtn = doc.getElementById('copySummaryBtn');
                    if (copySummaryBtn) {
                        const originalText = copySummaryBtn.innerHTML;
                        copySummaryBtn.innerHTML = '✅ Copied!';
                        setTimeout(() => {
                            copySummaryBtn.innerHTML = originalText;
                        }, 2000);
                    }
                } catch (err) {
                    console.error('❌ Channel Summary: Failed to copy to clipboard:', err);
                }
            }
        }

        extractMessagesFromDOM(depth) {
            try {
                this.logToSummary(`🔍 Channel Summary: Extracting messages from DOM for depth: ${depth}`);
                // Extract messages from Slack's DOM
                const messageElements = document.querySelectorAll('[data-qa="message"]');
                this.logToSummary(`📋 Channel Summary: Found ${messageElements.length} message elements with [data-qa="message"]`);

                // If no messages found with primary selector, try alternatives
                if (messageElements.length === 0) {
                    const altSelectors = ['.c-message', '[data-qa="virtual-list-item"]', '.p-rich_text_section'];
                    for (const selector of altSelectors) {
                        const altElements = document.querySelectorAll(selector);
                        this.logToSummary(`🔍 Channel Summary: Trying selector ${selector} - found ${altElements.length} elements`);
                        if (altElements.length > 0) {
                            this.logToSummary(`✅ Channel Summary: Using alternative selector: ${selector}`);
                            break;
                        }
                    }
                }
                const messages = [];
                const now = Date.now();

                // Calculate time cutoff based on depth
                let cutoffTime = 0;
                if (depth !== 'entirechannel') {
                    const config = window.SLACKPOLISH_CONFIG?.CHANNEL_SUMMARY?.DEPTH_OPTIONS?.[depth];
                    if (config && config.hours) {
                        cutoffTime = now - (config.hours * 60 * 60 * 1000);
                    }
                }

                messageElements.forEach(element => {
                    try {
                        const messageText = element.querySelector('[data-qa="message-text"]')?.textContent?.trim();
                        const timestamp = this.extractMessageTimestamp(element);
                        const author = this.extractMessageAuthor(element);

                        if (messageText && messageText.length > 3) {
                            // Check if message is within time range
                            if (depth === 'entirechannel' || timestamp >= cutoffTime) {
                                messages.push({
                                    text: messageText,
                                    author: author || 'Unknown',
                                    timestamp: timestamp,
                                    date: new Date(timestamp).toLocaleString()
                                });
                            }
                        }
                    } catch (error) {
                        console.warn('Failed to extract message:', error);
                    }
                });

                // Sort by timestamp (oldest first)
                messages.sort((a, b) => a.timestamp - b.timestamp);

                this.logToSummary(`✅ Channel Summary: Extracted ${messages.length} messages from DOM`);
                return messages;
            } catch (error) {
                this.logToSummary(`❌ Failed to extract messages from DOM: ${error.message}`);
                throw new Error('Could not read channel messages from the current view.');
            }
        }

        extractMessageTimestamp(element) {
            try {
                // Try to find timestamp in various possible locations
                const timeElement = element.querySelector('[data-qa="message-timestamp"]') ||
                                  element.querySelector('.c-timestamp') ||
                                  element.querySelector('[aria-label*="sent at"]');

                if (timeElement) {
                    const timeStr = timeElement.getAttribute('datetime') ||
                                   timeElement.getAttribute('data-ts') ||
                                   timeElement.textContent;

                    if (timeStr) {
                        const timestamp = new Date(timeStr).getTime();
                        return isNaN(timestamp) ? Date.now() : timestamp;
                    }
                }

                return Date.now(); // Fallback to current time
            } catch (error) {
                return Date.now();
            }
        }

        extractMessageAuthor(element) {
            try {
                const authorElement = element.querySelector('[data-qa="message-sender-name"]') ||
                                    element.querySelector('.c-message__sender') ||
                                    element.querySelector('[data-qa="message-sender"]');

                return authorElement?.textContent?.trim() || 'Unknown';
            } catch (error) {
                return 'Unknown';
            }
        }

        async generateAISummary(messages, level) {
            try {
                const config = window.SLACKPOLISH_CONFIG?.CHANNEL_SUMMARY?.LEVEL_OPTIONS?.[level];
                const maxTokens = config?.maxTokens || 500;
                this.logToSummary(`🔧 Channel Summary: Using ${level} level with max ${maxTokens} tokens`);

                // Prepare messages for AI processing
                this.logToSummary('📝 Channel Summary: Preparing messages for AI processing...');
                const messageText = messages.map(msg =>
                    `[${msg.date}] ${msg.author}: ${msg.text}`
                ).join('\n');

                // Create appropriate prompt based on level
                this.logToSummary('📋 Channel Summary: Creating summary prompt...');
                const prompt = this.createSummaryPrompt(messageText, level, messages.length);

                // Call OpenAI API
                this.logToSummary('🌐 Channel Summary: Calling OpenAI API...');
                const response = await this.callOpenAI(prompt, maxTokens);

                this.logToSummary('✅ Channel Summary: AI response received successfully');
                return response;
            } catch (error) {
                this.logToSummary(`❌ AI summary generation failed: ${error.message}`);
                throw new Error('Failed to generate AI summary. Please check your OpenAI API key and try again.');
            }
        }

        createSummaryPrompt(messageText, level, messageCount) {
            const basePrompt = `Please analyze the following Slack channel conversation with ${messageCount} messages and provide a ${level} summary:

${messageText}

`;

            switch (level) {
                case 'short':
                    return basePrompt + `Provide a SHORT summary (1-2 paragraphs) focusing on:
- Key discussion points
- Important decisions made
- Critical action items

Keep it concise and highlight only the most important information.`;

                case 'medium':
                    return basePrompt + `Provide a MEDIUM summary (3-5 paragraphs) including:
- Main topics discussed
- Key decisions and their context
- Action items with assignees
- Important announcements or updates
- Notable participant contributions

Organize the information clearly with appropriate headings.`;

                case 'comprehensive':
                    return basePrompt + `Provide a COMPREHENSIVE summary (1-2 pages) with detailed analysis including:
- Chronological flow of major discussions
- Detailed breakdown of each main topic
- All decisions made with full context and rationale
- Complete action item list with assignees and deadlines
- Participant analysis and contribution patterns
- Files, links, and resources shared
- Follow-up items and next steps

Structure this as a detailed report with clear sections and headings.`;

                default:
                    return basePrompt + 'Provide a summary of the key points discussed.';
            }
        }

        async callOpenAI(prompt, maxTokens) {
            const apiKey = window.SLACKPOLISH_CONFIG?.OPENAI_API_KEY;
            if (!apiKey) {
                this.logToSummary('❌ OpenAI API key not configured');
                throw new Error('OpenAI API key not configured. Please set your API key in the settings.');
            }

            this.logToSummary('🔑 Channel Summary: API key found, making request...');

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful assistant that creates clear, well-structured summaries of Slack conversations for Redis Enterprise team members.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: maxTokens,
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                this.logToSummary(`❌ OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
                throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
            }

            this.logToSummary('📥 Channel Summary: Parsing OpenAI response...');
            const data = await response.json();
            const summary = data.choices?.[0]?.message?.content || 'No summary generated.';
            this.logToSummary(`✅ Channel Summary: Summary received (${summary.length} characters)`);
            return summary;
        }
    }

    // Initialize channel summarizer
    window.channelSummarizer = null;

    // Add F10 hotkey handler for channel summary
    function handleChannelSummaryHotkey(event) {
        const summaryHotkey = window.SLACKPOLISH_CONFIG?.CHANNEL_SUMMARY?.HOTKEY || 'F10';

        if (event.key === summaryHotkey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            event.stopPropagation();

            if (!window.channelSummarizer) {
                window.channelSummarizer = new ChannelSummarizer();
            }

            window.channelSummarizer.openSummaryWindow();
        }
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();