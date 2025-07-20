// === SLACK TEXT IMPROVER INJECTION START ===
// SlackPolish Settings - Independent Settings Management
// This script handles the settings interface separately from the main text improver

(function() {
    'use strict';

    // Utility functions
    const utils = {
        log: function(message) {
            console.log(`🔧 SLACKPOLISH: ${message}`);
        },

        debug: function(message, data = null) {
            // Check if debug mode is enabled and global debug system exists
            try {
                const settings = SlackSettings.loadSettings();
                if (settings.debugMode && window.SlackPolishDebug) {
                    console.log(`🐛 SLACKPOLISH DEBUG: ${message}`, data || '');
                    window.SlackPolishDebug.addLog('settings', message, data);
                }
            } catch (e) {
                // Fallback to console if settings not available yet
                console.log(`🐛 SLACKPOLISH DEBUG: ${message}`, data || '');
            }
        }
    };

    // Settings management
    const SlackSettings = {
        // Default settings (matching config structure)
        defaultSettings: {
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
            addEmojiSignature: false
        },

        // Load settings from localStorage
        loadSettings: function() {
            try {
                const savedSettings = localStorage.getItem('slackpolish_settings');
                const savedApiKey = localStorage.getItem('slackpolish_openai_api_key');

                let settings = { ...this.defaultSettings };

                if (savedSettings) {
                    const parsed = JSON.parse(savedSettings);
                    settings = { ...settings, ...parsed };

                    // Ensure smartContext object exists
                    if (!settings.smartContext) {
                        settings.smartContext = { ...this.defaultSettings.smartContext };
                    }
                }

                if (savedApiKey) {
                    settings.apiKey = savedApiKey;
                }

                return settings;
            } catch (error) {
                utils.log('Error loading settings: ' + error.message);
                utils.debug('Settings loading error', { error: error.message, stack: error.stack });
                return { ...this.defaultSettings };
            }
        },

        // Save settings to localStorage
        saveSettings: function(settings) {
            try {
                // Save API key separately for security
                if (settings.apiKey) {
                    localStorage.setItem('slackpolish_openai_api_key', settings.apiKey);
                }

                // Save other settings
                const settingsToSave = { ...settings };
                delete settingsToSave.apiKey; // Don't save API key in main settings

                localStorage.setItem('slackpolish_settings', JSON.stringify(settingsToSave));
                utils.log('Settings saved successfully');
                utils.debug('Settings saved', settingsToSave);

                // Dispatch custom event for same-tab real-time updates
                window.dispatchEvent(new CustomEvent('slackpolish-settings-updated', {
                    detail: { settings: settingsToSave }
                }));

                return true;
            } catch (error) {
                utils.log('Error saving settings: ' + error.message);
                utils.debug('Settings saving error', { error: error.message, stack: error.stack });
                return false;
            }
        },

        // Get available options from config
        getLanguageOptions: function() {
            const config = window.SLACKPOLISH_CONFIG;
            if (config && config.SUPPORTED_LANGUAGES) {
                return config.SUPPORTED_LANGUAGES;
            }
            // Fallback options
            return {
                ENGLISH: { name: 'English', flag: '🇺🇸', displayName: 'English' },
                SPANISH: { name: 'Spanish', flag: '🇪🇸', displayName: 'Spanish' },
                FRENCH: { name: 'French', flag: '🇫🇷', displayName: 'French' },
                GERMAN: { name: 'German', flag: '🇩🇪', displayName: 'German' },
                ITALIAN: { name: 'Italian', flag: '🇮🇹', displayName: 'Italian' },
                PORTUGUESE: { name: 'Portuguese', flag: '🇵🇹', displayName: 'Portuguese' },
                DUTCH: { name: 'Dutch', flag: '🇳🇱', displayName: 'Dutch' },
                JAPANESE: { name: 'Japanese', flag: '🇯🇵', displayName: 'Japanese' },
                CHINESE: { name: 'Chinese', flag: '🇨🇳', displayName: 'Chinese' }
            };
        },

        getStyleOptions: function() {
            const config = window.SLACKPOLISH_CONFIG;
            if (config && config.AVAILABLE_STYLES) {
                return config.AVAILABLE_STYLES;
            }
            // Fallback options
            return {
                CASUAL: { name: '😊 Casual', description: 'Friendly and relaxed' },
                PROFESSIONAL: { name: '💼 Professional', description: 'Business-appropriate tone' },
                FORMAL: { name: '🎩 Formal', description: 'Very polite and structured' },
                CONCISE: { name: '⚡ Concise', description: 'Brief and to the point' },
                CREATIVE: { name: '🎨 Creative', description: 'Engaging and expressive' }
            };
        },

        getHotkeyOptions: function() {
            const config = window.SLACKPOLISH_CONFIG;
            if (config && config.AVAILABLE_HOTKEYS) {
                return config.AVAILABLE_HOTKEYS;
            }
            // Fallback options
            return ['Ctrl+Shift', 'Ctrl+Alt', 'Ctrl+Tab'];
        },

        // Create SlackPolish logo
        createLogo: function(size = 24) {
            const logoImg = document.createElement('img');
            logoImg.title = 'SlackPolish';
            logoImg.alt = 'SlackPolish Logo';
            logoImg.width = size;
            logoImg.height = size;
            logoImg.style.cssText = `display: block; border: none; width: ${size}px !important; height: ${size}px !important; max-width: ${size}px; max-height: ${size}px;`;

            // Use the global logo data if available
            logoImg.src = window.SLACKPOLISH_LOGO_BASE64 || "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIj48Y2lyY2xlIGN4PSIyNTYiIGN5PSIyNTYiIHI9IjIwMCIgZmlsbD0iIzEyNjRhMyIvPjx0ZXh0IHg9IjI1NiIgeT0iMjgwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+U1A8L3RleHQ+PC9zdmc+";

            // Fallback to text if image fails
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
        },

        // Show settings menu
        showSettingsMenu: function() {
            // Remove existing menu if present
            const existingMenu = document.getElementById('slackpolish-settings-menu');
            if (existingMenu) {
                existingMenu.remove();
                return;
            }

            const currentSettings = this.loadSettings();
            const languages = this.getLanguageOptions();
            const styles = this.getStyleOptions();
            const hotkeys = this.getHotkeyOptions();

            const menu = document.createElement('div');
            menu.id = 'slackpolish-settings-menu';

            // Build language options HTML
            let languageOptionsHtml = '';
            Object.keys(languages).forEach(key => {
                const lang = languages[key];
                const selected = currentSettings.language === key ? 'selected' : '';
                languageOptionsHtml += `<option value="${key}" ${selected}>${lang.flag} ${lang.displayName}</option>`;
            });

            // Build style options HTML
            let styleOptionsHtml = '';
            Object.keys(styles).forEach(key => {
                const style = styles[key];
                const selected = currentSettings.style === key ? 'selected' : '';
                styleOptionsHtml += `<option value="${key}" ${selected}>${style.name} - ${style.description}</option>`;
            });

            // Build hotkey options HTML
            let hotkeyOptionsHtml = '';
            hotkeys.forEach(hotkey => {
                const selected = currentSettings.improveHotkey === hotkey ? 'selected' : '';
                const icon = hotkey === 'Ctrl+Shift' ? '⌨️' : hotkey === 'Ctrl+Alt' ? '🔀' : '📑';
                hotkeyOptionsHtml += `<option value="${hotkey}" ${selected}>${icon} ${hotkey}${hotkey === 'Ctrl+Shift' ? ' (Default)' : ''}</option>`;
            });

            menu.innerHTML = this.createSettingsHTML(currentSettings, languageOptionsHtml, styleOptionsHtml, hotkeyOptionsHtml);
            document.body.appendChild(menu);

            // Add logo to settings menu
            const logoContainer = menu.querySelector('#settings-menu-logo');
            if (logoContainer) {
                logoContainer.appendChild(this.createLogo(48));
            }

            // Initialize developer mode functionality
            this.initializeDeveloperMode(menu);

            // Add event listeners
            this.setupMenuEventListeners(menu);
        },

        // Create the settings HTML with exact styling from mock
        createSettingsHTML: function(currentSettings, languageOptionsHtml, styleOptionsHtml, hotkeyOptionsHtml) {
            // Get version information from config
            const config = window.SLACKPOLISH_CONFIG || {};
            const version = config.VERSION || 'Unknown';
            const build = config.BUILD || 'Unknown';
            const buildDate = config.BUILD_DATE || 'Unknown';

            return `
                <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center;">
                    <div style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); font-family: Arial, sans-serif; min-width: 300px; max-width: 500px; max-height: 80vh; overflow-y: auto;">

                        <!-- Header -->
                        <div style="display: flex; align-items: center; margin-bottom: 20px; padding: 12px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 8px; border: 1px solid #dee2e6;">
                            <div style="background: white; border-radius: 8px; padding: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-right: 16px; display: flex; align-items: center; justify-content: center;" id="settings-menu-logo">
                            </div>
                            <div style="flex: 1;">
                                <div style="font-weight: bold; font-size: 18px; color: #2c3e50; margin-bottom: 4px;">SlackPolish Settings</div>
                                <div style="font-size: 13px; color: #6c757d;">AI-powered text enhancement for Slack</div>
                                <div style="font-size: 11px; color: #999; margin-top: 2px;">v${version} (Build ${build}) - ${buildDate}</div>
                                <div style="display: none; font-size: 11px; color: #007a5a; font-weight: normal; margin-top: 4px;" id="dev-mode-indicator">
                                    🔧 Developer Mode Active
                                </div>
                            </div>
                        </div>

                        <!-- Language Selection -->
                        <div style="margin-bottom: 12px;">
                            <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">🌍 Language:</label>
                            <select id="language-select" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box; background: white;">
                                ${languageOptionsHtml}
                            </select>
                        </div>

                        <!-- Style Selection -->
                        <div style="margin-bottom: 12px;">
                            <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">✨ Style:</label>
                            <select id="style-select" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box; background: white;">
                                ${styleOptionsHtml}
                            </select>
                        </div>

                        <!-- Hotkey Selection -->
                        <div style="margin-bottom: 12px;">
                            <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">⌨️ Hotkey:</label>
                            <select id="hotkey-select" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box; background: white;">
                                ${hotkeyOptionsHtml}
                            </select>
                            <div style="font-size: 12px; color: #666; margin-top: 4px;">
                                Choose your preferred hotkey combination. Settings hotkey (F12) cannot be changed.
                            </div>
                        </div>

                        <!-- Personal Style -->
                        <div style="margin-bottom: 12px;">
                            <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">✨ Personal Style:</label>
                            <textarea id="personal-polish" placeholder="e.g., Use 'Hi' not 'Hey', avoid dashes, British spelling" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box; height: 60px; resize: vertical; font-family: inherit;">${currentSettings.personalPolish}</textarea>
                            <div style="font-size: 11px; color: #666; margin-top: 2px;">
                                Personal writing preferences for AI to consider.
                            </div>
                        </div>

                        <!-- Developer Options (Hidden by default) -->
                        <div style="display: none; border-top: 1px solid #ddd; margin: 15px 0; padding-top: 15px;" id="developer-options">
                            <div style="text-align: center; margin-bottom: 10px;">
                                <span style="background: #007a5a; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;">🔧 DEVELOPER MODE</span>
                            </div>

                            <!-- API Key Management -->
                            <div style="margin-bottom: 12px;">
                                <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">🔑 OpenAI API Key</label>
                                <div style="position: relative; margin-bottom: 8px;">
                                    <input type="password" id="api-key-input" value="${currentSettings.apiKey}" placeholder="sk-..." style="width: 100%; padding: 6px; padding-right: 35px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box; font-family: monospace;">
                                    <button type="button" id="api-key-toggle" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 14px; padding: 2px;" title="Show/Hide API key">👁️</button>
                                </div>
                                <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 4px;">
                                    <button type="button" id="test-api-key-btn" style="background: #007a5a; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: bold;">🧪 Test API Key</button>
                                    <div id="api-test-status" style="font-size: 12px; font-weight: bold;"></div>
                                </div>
                                <div style="font-size: 11px; color: #666;">
                                    Your OpenAI API key for text improvement. <a href="https://platform.openai.com/api-keys" target="_blank" style="color: #007a5a;">Get one here</a>
                                </div>
                            </div>

                            <!-- Smart Context Settings -->
                            <div style="margin-bottom: 12px;">
                                <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">🧠 Smart Context</label>
                                <div style="margin-bottom: 6px;">
                                    <label style="display: flex; align-items: center; cursor: pointer; font-size: 13px;">
                                        <input type="checkbox" id="smart-context-enabled" ${currentSettings.smartContext.enabled ? 'checked' : ''} style="margin-right: 6px;">
                                        <span>Enable (include recent messages)</span>
                                    </label>
                                </div>
                                <div style="margin-bottom: 6px;">
                                    <label style="display: flex; align-items: center; cursor: pointer; font-size: 13px;">
                                        <input type="checkbox" id="smart-context-privacy" ${currentSettings.smartContext.privacyMode ? 'checked' : ''} style="margin-right: 6px;">
                                        <span>Privacy Mode (anonymize names)</span>
                                    </label>
                                </div>
                                <div style="font-size: 11px; color: #666; margin-top: 2px;">
                                    Includes recent messages for short/ambiguous responses.
                                </div>
                            </div>

                            <!-- Debug Mode Settings -->
                            <div style="margin-bottom: 12px;">
                                <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">🔍 Debug Mode</label>
                                <div style="margin-bottom: 6px;">
                                    <label style="display: flex; align-items: center; cursor: pointer; font-size: 13px;">
                                        <input type="checkbox" id="debug-mode" ${currentSettings.debugMode ? 'checked' : ''} style="margin-right: 6px;">
                                        <span>Show debug info</span>
                                    </label>
                                </div>
                                <div style="font-size: 11px; color: #666; margin-top: 2px;">
                                    Shows green debug boxes for troubleshooting.
                                </div>
                            </div>

                            <!-- Emoji Signature Settings -->
                            <div style="margin-bottom: 12px;">
                                <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">✨ Emoji Signature</label>
                                <div style="margin-bottom: 6px;">
                                    <label style="display: flex; align-items: center; cursor: pointer; font-size: 13px;">
                                        <input type="checkbox" id="emoji-signature" ${currentSettings.addEmojiSignature ? 'checked' : ''} style="margin-right: 6px;">
                                        <span>Add :slack_polish: emoji to improved messages</span>
                                    </label>
                                </div>
                                <div style="font-size: 11px; color: #666; margin-top: 2px;">
                                    Adds SlackPolish emoji signature to identify AI-improved messages.
                                </div>
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div style="text-align: right; margin-top: 15px; position: relative;">
                            <!-- Hidden developer mode trigger -->
                            <div id="dev-trigger" style="position: absolute; bottom: 0; left: 0; width: 30px; height: 30px; cursor: pointer; opacity: 0; border-radius: 50%; transition: all 0.1s;" title="Click 10 times to enable developer mode"></div>

                            <button id="cancel-settings-btn" style="padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; margin-left: 8px; border: 1px solid #ddd; background: #f8f8f8; color: #333;">Cancel</button>
                            <button id="save-settings-btn" style="padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; margin-left: 8px; border: none; background: #007a5a; color: white;">Save</button>
                        </div>
                    </div>
                </div>
            `;
        },

        // Initialize developer mode functionality
        initializeDeveloperMode: function(menu) {
            let clickCount = 0;
            let clickTimer = null;
            const devTrigger = menu.querySelector('#dev-trigger');
            const devOptions = menu.querySelector('#developer-options');
            const devIndicator = menu.querySelector('#dev-mode-indicator');
            const apiKeyToggle = menu.querySelector('#api-key-toggle');
            const apiKeyInput = menu.querySelector('#api-key-input');
            const testApiKeyBtn = menu.querySelector('#test-api-key-btn');
            const apiTestStatus = menu.querySelector('#api-test-status');

            // Developer mode trigger (10 clicks)
            devTrigger.addEventListener('click', function() {
                clickCount++;

                // Visual feedback
                this.style.background = '#ddd';
                this.style.opacity = '0.2';
                setTimeout(() => {
                    this.style.background = '';
                    this.style.opacity = '0';
                }, 100);

                // Reset click count after 2 seconds of inactivity
                if (clickTimer) clearTimeout(clickTimer);
                clickTimer = setTimeout(() => {
                    clickCount = 0;
                }, 2000);

                utils.log(`Developer mode: ${clickCount}/10 clicks`);
                utils.debug('Developer mode click', { clickCount, remaining: 10 - clickCount });

                // Enable developer mode after 10 clicks
                if (clickCount >= 10) {
                    devOptions.style.display = 'block';
                    devIndicator.style.display = 'block';

                    // Show confirmation on trigger
                    this.style.background = '#007a5a';
                    this.style.opacity = '0.3';
                    this.title = 'Developer mode enabled!';

                    // Reset click count
                    clickCount = 0;
                    clearTimeout(clickTimer);

                    utils.log('Developer mode enabled!');
                    utils.debug('Developer mode activated', { totalClicks: clickCount });

                    // Scroll to developer options
                    devOptions.scrollIntoView({ behavior: 'smooth' });
                }
            });

            // API Key toggle functionality
            apiKeyToggle.addEventListener('click', function() {
                const isPassword = apiKeyInput.type === 'password';

                apiKeyInput.type = isPassword ? 'text' : 'password';
                this.textContent = isPassword ? '🙈' : '👁️';
                this.title = isPassword ? 'Hide API key' : 'Show API key';
            });

            // Test API Key functionality
            testApiKeyBtn.addEventListener('click', async function() {
                const apiKey = apiKeyInput.value.trim();
                const model = 'gpt-4-turbo'; // Use default model for testing

                if (!apiKey) {
                    apiTestStatus.textContent = '❌ Please enter an API key first';
                    apiTestStatus.style.color = '#e01e5a';
                    utils.debug('API key test attempted without key');
                    return;
                }

                // Update button state
                const originalText = this.textContent;
                this.textContent = '🔄 Testing...';
                this.disabled = true;
                this.style.background = '#666';
                apiTestStatus.textContent = 'Testing API key...';
                apiTestStatus.style.color = '#666';

                utils.debug('Testing API key', {
                    hasApiKey: !!apiKey,
                    keyLength: apiKey.length,
                    model: model
                });

                try {
                    if (window.SlackPolishOpenAI) {
                        const result = await window.SlackPolishOpenAI.testApiKey(apiKey, model);

                        if (result.success) {
                            apiTestStatus.textContent = result.message;
                            apiTestStatus.style.color = '#2eb67d';
                            utils.debug('API key test successful', result.data);
                        } else {
                            apiTestStatus.textContent = result.message;
                            apiTestStatus.style.color = '#e01e5a';
                            utils.debug('API key test failed', result.error);
                        }
                    } else {
                        apiTestStatus.textContent = '❌ OpenAI module not available';
                        apiTestStatus.style.color = '#e01e5a';
                        utils.debug('OpenAI module not available for testing');
                    }
                } catch (error) {
                    apiTestStatus.textContent = `❌ Error: ${error.message}`;
                    apiTestStatus.style.color = '#e01e5a';
                    utils.debug('API key test error', { error: error.message, stack: error.stack });
                } finally {
                    // Restore button state
                    this.textContent = originalText;
                    this.disabled = false;
                    this.style.background = '#007a5a';

                    // Clear status after 10 seconds
                    setTimeout(() => {
                        apiTestStatus.textContent = '';
                    }, 10000);
                }
            });

            // Hover effect for dev trigger
            devTrigger.addEventListener('mouseenter', function() {
                this.style.background = '#ddd';
                this.style.opacity = '0.2';
            });

            devTrigger.addEventListener('mouseleave', function() {
                if (this.style.background !== 'rgb(0, 122, 90)') { // Not in confirmed state
                    this.style.background = '';
                    this.style.opacity = '0';
                }
            });
        },

        // Setup event listeners for the settings menu
        setupMenuEventListeners: function(menu) {
            const cancelBtn = menu.querySelector('#cancel-settings-btn');
            const saveBtn = menu.querySelector('#save-settings-btn');

            // Cancel button
            cancelBtn.addEventListener('click', () => {
                menu.remove();
            });

            // Save button
            saveBtn.addEventListener('click', () => {
                const newSettings = {
                    language: menu.querySelector('#language-select').value,
                    style: menu.querySelector('#style-select').value,
                    improveHotkey: menu.querySelector('#hotkey-select').value,
                    personalPolish: menu.querySelector('#personal-polish').value.trim(),
                    smartContext: {
                        enabled: menu.querySelector('#smart-context-enabled') ? menu.querySelector('#smart-context-enabled').checked : true,
                        privacyMode: menu.querySelector('#smart-context-privacy') ? menu.querySelector('#smart-context-privacy').checked : false
                    },
                    debugMode: menu.querySelector('#debug-mode') ? menu.querySelector('#debug-mode').checked : false,
                    addEmojiSignature: menu.querySelector('#emoji-signature') ? menu.querySelector('#emoji-signature').checked : false,
                    apiKey: menu.querySelector('#api-key-input') ? menu.querySelector('#api-key-input').value.trim() : ''
                };

                if (this.saveSettings(newSettings)) {
                    // Show success notification
                    this.showNotification('Settings saved successfully!', 'success');
                    menu.remove();
                } else {
                    this.showNotification('Error saving settings', 'error');
                }
            });

            // Escape key to close
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    menu.remove();
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);

            // Click outside to close
            menu.addEventListener('click', (e) => {
                if (e.target === menu) {
                    menu.remove();
                }
            });
        },

        // Show notification
        showNotification: function(message, type = 'info') {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'error' ? '#d93025' : '#1264a3'};
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                z-index: 10002;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            `;
            notification.textContent = message;
            document.body.appendChild(notification);

            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        }
    };

    // Initialize settings functionality
    function initializeSettings() {
        utils.log('Settings module initialized');
        utils.debug('Settings module initialization', {
            hasGlobalDebug: !!window.SlackPolishDebug,
            currentSettings: SlackSettings.loadSettings()
        });

        // Add keyboard shortcut for settings (F12)
        document.addEventListener('keydown', function(event) {
            if (event.key === 'F12') {
                event.preventDefault();
                SlackSettings.showSettingsMenu();
            }
        });
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSettings);
    } else {
        initializeSettings();
    }

})();
// === SLACK TEXT IMPROVER INJECTION END ===