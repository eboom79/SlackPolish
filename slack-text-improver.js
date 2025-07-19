// === SLACKPOLISH INJECTION START ===
// SlackPolish - Text Improvement for Slack
// Simple, focused text polishing with Ctrl+Shift hotkey

(function() {
    'use strict';

    // Configuration - will be overridden by slack-config.js and localStorage
    let CONFIG = {
        OPENAI_API_KEY: '',
        MODEL: 'gpt-4-turbo',
        STYLE: 'professional',
        LANGUAGE: 'English',
        CUSTOM_INSTRUCTIONS: '',
        HOTKEY: 'Ctrl+Shift',
        DEBUG_MODE: false,
        SMART_CONTEXT: {
            enabled: true,
            privacyMode: false
        }
    };

    // Update config if SLACKPOLISH_CONFIG is available
    if (typeof window.SLACKPOLISH_CONFIG !== 'undefined') {
        CONFIG = { ...CONFIG, ...window.SLACKPOLISH_CONFIG };
        // Use the model from config
        CONFIG.MODEL = window.SLACKPOLISH_CONFIG.OPENAI_MODEL || CONFIG.MODEL;
    }

    // Load API key and settings from localStorage
    function loadSettings() {
        try {
            const savedApiKey = localStorage.getItem('slackpolish_openai_api_key');
            if (savedApiKey) {
                CONFIG.OPENAI_API_KEY = savedApiKey;
                utils.log('API key loaded from localStorage');
            }

            const savedSettings = localStorage.getItem('slackpolish_settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);

                // Handle new settings structure from rich interface
                if (settings.language) {
                    // Map language codes to display names
                    const languageMap = {
                        'ENGLISH': 'English',
                        'SPANISH': 'Spanish',
                        'FRENCH': 'French',
                        'GERMAN': 'German',
                        'ITALIAN': 'Italian',
                        'PORTUGUESE': 'Portuguese',
                        'DUTCH': 'Dutch',
                        'JAPANESE': 'Japanese',
                        'CHINESE': 'Chinese'
                    };
                    CONFIG.LANGUAGE = languageMap[settings.language] || settings.language;
                }

                if (settings.style) {
                    // Map style codes to lowercase for API
                    CONFIG.STYLE = settings.style.toLowerCase();
                }

                // Handle personal polish as custom instructions
                if (settings.personalPolish) {
                    CONFIG.CUSTOM_INSTRUCTIONS = settings.personalPolish;
                }

                // Handle hotkey setting
                if (settings.improveHotkey) {
                    CONFIG.HOTKEY = settings.improveHotkey;
                }

                // Handle debug mode setting
                if (typeof settings.debugMode === 'boolean') {
                    CONFIG.DEBUG_MODE = settings.debugMode;
                }

                // Handle smart context setting
                if (settings.smartContext) {
                    CONFIG.SMART_CONTEXT = {
                        enabled: typeof settings.smartContext.enabled === 'boolean' ? settings.smartContext.enabled : CONFIG.SMART_CONTEXT.enabled,
                        privacyMode: typeof settings.smartContext.privacyMode === 'boolean' ? settings.smartContext.privacyMode : CONFIG.SMART_CONTEXT.privacyMode
                    };
                }

                // Handle legacy settings structure
                CONFIG.MODEL = settings.model || CONFIG.MODEL;
                CONFIG.STYLE = settings.style || CONFIG.STYLE;
                CONFIG.LANGUAGE = settings.language || CONFIG.LANGUAGE;
                CONFIG.CUSTOM_INSTRUCTIONS = settings.customInstructions || settings.personalPolish || CONFIG.CUSTOM_INSTRUCTIONS;
                CONFIG.HOTKEY = settings.improveHotkey || CONFIG.HOTKEY;
                CONFIG.DEBUG_MODE = typeof settings.debugMode === 'boolean' ? settings.debugMode : CONFIG.DEBUG_MODE;

                utils.log('Settings loaded from localStorage');

                // Enable/disable global debug system
                if (window.SlackPolishDebug) {
                    window.SlackPolishDebug.setEnabled(CONFIG.DEBUG_MODE);
                }

                utils.debug('Settings loaded', {
                    language: CONFIG.LANGUAGE,
                    style: CONFIG.STYLE,
                    hotkey: CONFIG.HOTKEY,
                    debugMode: CONFIG.DEBUG_MODE,
                    hasCustomInstructions: !!CONFIG.CUSTOM_INSTRUCTIONS,
                    hasApiKey: !!CONFIG.OPENAI_API_KEY
                });
            }
        } catch (error) {
            utils.log(`Error loading settings: ${error.message}`);
        }
    }

    // Utility functions
    const utils = {
        log: function(message) {
            console.log(`🔧 SLACKPOLISH: ${message}`);
        },

        debug: function(message, data = null) {
            if (CONFIG.DEBUG_MODE) {
                console.log(`🐛 SLACKPOLISH DEBUG: ${message}`, data || '');
                // Use global debug system
                if (window.SlackPolishDebug) {
                    window.SlackPolishDebug.addLog('text-improver', message, data);
                }
            }
        },


        showNotification: function(message, type = 'info') {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'error' ? '#ff4444' : '#4CAF50'};
                color: white;
                padding: 12px 20px;
                border-radius: 4px;
                z-index: 10000;
                font-family: Arial, sans-serif;
                font-size: 14px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        },

        findMessageInput: function() {
            // Try multiple selectors for Slack message input
            const selectors = [
                '[data-qa="message_input"]',
                '.ql-editor[data-qa="message_input"]',
                '[contenteditable="true"][data-qa="message_input"]',
                '.c-texty_input__container .ql-editor',
                '[role="textbox"][contenteditable="true"]'
            ];

            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element && element.isContentEditable) {
                    return element;
                }
            }
            return null;
        },

        getTextFromElement: function(element) {
            if (!element) return '';
            return element.innerText || element.textContent || '';
        },

        setTextInElement: function(element, text) {
            if (!element) return;
            
            // Clear existing content
            element.innerHTML = '';
            
            // Set new text
            element.innerText = text;
            
            // Trigger input events to notify Slack
            const events = ['input', 'change', 'keyup'];
            events.forEach(eventType => {
                const event = new Event(eventType, { bubbles: true });
                element.dispatchEvent(event);
            });
        }
    };

    // Text improvement functionality
    const textImprover = {
        isProcessing: false,

        async improveText(originalText) {
            utils.debug('improveText() called', {
                originalText,
                debugMode: CONFIG.DEBUG_MODE,
                hasApiKey: !!CONFIG.OPENAI_API_KEY
            });

            if (!CONFIG.OPENAI_API_KEY) {
                utils.debug('API key missing', { hasApiKey: false });
                showApiKeyUpdatePopup('OpenAI API key not configured. Please enter your API key to use text improvement.');
                return null;
            }

            if (!originalText.trim()) {
                utils.debug('Empty text provided', { originalText });
                utils.showNotification('No text to improve', 'error');
                return null;
            }

            this.isProcessing = true;
            utils.log('Starting text improvement...');
            utils.debug('Text improvement started', {
                originalLength: originalText.length,
                style: CONFIG.STYLE,
                language: CONFIG.LANGUAGE,
                model: CONFIG.MODEL,
                hasCustomInstructions: !!CONFIG.CUSTOM_INSTRUCTIONS,
                hotkey: CONFIG.HOTKEY
            });

            // Show loading indicator
            showLoadingIndicator();

            try {
                const prompt = await this.buildPrompt(originalText);

                // Use shared OpenAI module if available, fallback to local implementation
                let response;
                if (window.SlackPolishOpenAI) {
                    response = await window.SlackPolishOpenAI.improveText(
                        CONFIG.OPENAI_API_KEY,
                        CONFIG.MODEL,
                        prompt
                    );
                } else {
                    response = await this.callOpenAI(prompt);
                }

                if (response && response.trim()) {
                    utils.log('Text improvement completed successfully');
                    utils.debug('Text improvement successful', {
                        originalLength: originalText.length,
                        improvedLength: response.trim().length,
                        originalText: originalText,
                        improvedText: response.trim(),
                        usedSharedModule: !!window.SlackPolishOpenAI
                    });
                    return response.trim();
                } else {
                    utils.debug('Empty response from API', { response });
                    showSimpleError('Received empty response from OpenAI');
                    return null;
                }
            } catch (error) {
                utils.log(`Error improving text: ${error.message}`);
                utils.debug('Text improvement error', {
                    error: error.message,
                    stack: error.stack,
                    originalText
                });
                handleApiError(error);
                return null;
            } finally {
                this.isProcessing = false;
                // Hide loading indicator
                hideLoadingIndicator();
                utils.debug('Text improvement process completed', { isProcessing: this.isProcessing });
            }
        },

        async buildPrompt(text) {
            utils.debug('Building prompt', {
                textLength: text.length,
                style: CONFIG.STYLE,
                language: CONFIG.LANGUAGE,
                hasCustomInstructions: !!CONFIG.CUSTOM_INSTRUCTIONS,
                smartContextEnabled: CONFIG.SMART_CONTEXT?.enabled
            });

            let prompt = `Please improve the following text to be more ${CONFIG.STYLE} in ${CONFIG.LANGUAGE}:`;

            // Add Smart Context if enabled
            if (CONFIG.SMART_CONTEXT && CONFIG.SMART_CONTEXT.enabled) {
                try {
                    const contextMessages = await this.getSmartContext();
                    if (contextMessages && contextMessages.length > 0) {
                        prompt += `\n\nRecent conversation context (last ${contextMessages.length} messages):\n`;
                        contextMessages.forEach((msg, index) => {
                            const user = CONFIG.SMART_CONTEXT.privacyMode ? `User${index + 1}` : (msg.user || 'Unknown');
                            const text = CONFIG.SMART_CONTEXT.privacyMode ? this.anonymizeText(msg.text) : msg.text;
                            prompt += `${user}: ${text}\n`;
                        });
                        prompt += `\nConsider this conversation context when improving the message.`;

                        utils.debug('Added smart context to prompt', {
                            contextMessages: contextMessages.length,
                            privacyMode: CONFIG.SMART_CONTEXT.privacyMode
                        });
                    }
                } catch (error) {
                    utils.debug('Error getting smart context, continuing without it', {
                        error: error.message
                    });
                }
            }

            prompt += `\n\n"${text}"

Requirements:
- Keep the same meaning and intent
- Make it sound more ${CONFIG.STYLE}
- Use ${CONFIG.LANGUAGE} language
- Return only the improved text, no explanations`;

            if (CONFIG.CUSTOM_INSTRUCTIONS) {
                prompt += `\n- Additional instructions: ${CONFIG.CUSTOM_INSTRUCTIONS}`;
                utils.debug('Added custom instructions', { customInstructions: CONFIG.CUSTOM_INSTRUCTIONS });
            }

            utils.debug('Prompt built', { promptLength: prompt.length });
            return prompt;
        },

        async getSmartContext() {
            try {
                if (!window.SlackPolishChannelMessages) {
                    utils.debug('Channel Messages module not available for smart context');
                    return [];
                }

                utils.debug('Fetching smart context messages');

                // Try API-based approach first, fallback to DOM if it fails
                let result = null;
                try {
                    result = await window.SlackPolishChannelMessages.getRecentMessages(5);
                } catch (apiError) {
                    utils.debug('API-based message fetching failed, trying DOM fallback', {
                        error: apiError.message
                    });

                    // Fallback to DOM-based extraction
                    try {
                        result = await window.SlackPolishChannelMessages.getRecentMessagesFromDOM(5);
                    } catch (domError) {
                        utils.debug('DOM fallback also failed', {
                            error: domError.message
                        });
                        return [];
                    }
                }

                if (!result || !result.messages || result.messages.length === 0) {
                    utils.debug('No messages found for smart context');
                    return [];
                }

                // Filter out empty messages and format for context
                const contextMessages = result.messages
                    .filter(msg => msg.text && msg.text.trim().length > 0)
                    .map(msg => ({
                        user: msg.user || 'Unknown',
                        text: msg.text.trim(),
                        timestamp: msg.timestamp
                    }))
                    .slice(-5); // Ensure we only get last 5

                utils.debug('Smart context messages prepared', {
                    totalMessages: result.messages.length,
                    contextMessages: contextMessages.length,
                    channelId: result.channelId,
                    channelName: result.channelName,
                    method: result.method || 'unknown'
                });

                return contextMessages;
            } catch (error) {
                utils.debug('Error getting smart context', {
                    error: error.message,
                    stack: error.stack
                });
                return [];
            }
        },

        anonymizeText(text) {
            if (!text) return text;

            try {
                // Simple anonymization - replace names and sensitive info
                let anonymized = text
                    // Replace @mentions with @User
                    .replace(/@\w+/g, '@User')
                    // Replace email addresses
                    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, 'email@domain.com')
                    // Replace phone numbers (basic pattern)
                    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, 'XXX-XXX-XXXX')
                    // Replace URLs
                    .replace(/https?:\/\/[^\s]+/g, 'https://example.com')
                    // Replace common names (this is basic - could be enhanced)
                    .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, 'Person Name');

                utils.debug('Text anonymized', {
                    originalLength: text.length,
                    anonymizedLength: anonymized.length
                });

                return anonymized;
            } catch (error) {
                utils.debug('Error anonymizing text', { error: error.message });
                return text; // Return original if anonymization fails
            }
        },

        async callOpenAI(prompt) {
            utils.debug('Calling OpenAI API', {
                model: CONFIG.MODEL,
                promptLength: prompt.length,
                apiKeyLength: CONFIG.OPENAI_API_KEY ? CONFIG.OPENAI_API_KEY.length : 0
            });

            const requestBody = {
                model: CONFIG.MODEL,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 500,
                temperature: 0.7
            };

            utils.debug('API request body', requestBody);

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
                },
                body: JSON.stringify(requestBody)
            });

            utils.debug('API response received', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                utils.debug('API error', { status: response.status, errorData });
                throw new Error(errorData.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const result = data.choices?.[0]?.message?.content || '';

            utils.debug('API response processed', {
                hasChoices: !!data.choices?.length,
                resultLength: result.length,
                usage: data.usage
            });

            return result;
        }
    };

    // Parse hotkey combination into individual keys
    function parseHotkey(hotkeyString) {
        const parts = hotkeyString.split('+');
        return {
            ctrl: parts.includes('Ctrl'),
            shift: parts.includes('Shift'),
            alt: parts.includes('Alt'),
            tab: parts.includes('Tab'),
            displayName: hotkeyString
        };
    }

    // Current event listeners (for cleanup)
    let currentKeydownListener = null;
    let currentKeyupListener = null;

    // Event handlers
    function setupEventListeners() {
        utils.log(`Setting up ${CONFIG.HOTKEY} event listener`);

        // Clean up existing listeners if any
        if (currentKeydownListener) {
            document.removeEventListener('keydown', currentKeydownListener);
        }
        if (currentKeyupListener) {
            document.removeEventListener('keyup', currentKeyupListener);
        }

        const hotkey = parseHotkey(CONFIG.HOTKEY);

        let ctrlPressed = false;
        let shiftPressed = false;
        let altPressed = false;
        let tabPressed = false;
        let triggerTimeout = null;

        // Dynamic keydown handler
        currentKeydownListener = function(event) {
            // Track key states
            if (event.key === 'Control') {
                ctrlPressed = true;
                utils.log('Ctrl pressed');
            }
            if (event.key === 'Shift') {
                shiftPressed = true;
                utils.log('Shift pressed');
            }
            if (event.key === 'Alt') {
                altPressed = true;
                utils.log('Alt pressed');
            }
            if (event.key === 'Tab') {
                tabPressed = true;
                utils.log('Tab pressed');
            }

            // Check if the configured hotkey combination is pressed
            const hotkeyMatch =
                (hotkey.ctrl === ctrlPressed) &&
                (hotkey.shift === shiftPressed) &&
                (hotkey.alt === altPressed) &&
                (hotkey.tab === tabPressed);

            if (hotkeyMatch) {
                // Prevent Tab from changing focus if it's part of the hotkey
                if (hotkey.tab) {
                    event.preventDefault();
                }

                utils.log(`${CONFIG.HOTKEY} combination pressed - triggering text improvement immediately`);

                // Clear any existing timeout
                if (triggerTimeout) {
                    clearTimeout(triggerTimeout);
                    triggerTimeout = null;
                }

                // Trigger immediately - no need to wait for keys to be held
                triggerTimeout = setTimeout(async () => {
                    utils.log(`${CONFIG.HOTKEY} triggered - starting text improvement`);
                    await triggerTextImprovement();
                    triggerTimeout = null;
                }, 50); // Very short delay just to debounce multiple rapid key presses
            }
        };

        document.addEventListener('keydown', currentKeydownListener);

        // Dynamic keyup handler
        currentKeyupListener = function(event) {
            if (event.key === 'Control') {
                ctrlPressed = false;
                utils.log('Ctrl released');
            }
            if (event.key === 'Shift') {
                shiftPressed = false;
                utils.log('Shift released');
            }
            if (event.key === 'Alt') {
                altPressed = false;
                utils.log('Alt released');
            }
            if (event.key === 'Tab') {
                tabPressed = false;
                utils.log('Tab released');
            }

            // Clear timeout if any required key is released
            const anyRequiredKeyReleased =
                (hotkey.ctrl && !ctrlPressed) ||
                (hotkey.shift && !shiftPressed) ||
                (hotkey.alt && !altPressed) ||
                (hotkey.tab && !tabPressed);

            if (triggerTimeout && anyRequiredKeyReleased) {
                clearTimeout(triggerTimeout);
                triggerTimeout = null;
                utils.log('Trigger timeout cleared');
            }
        };

        document.addEventListener('keyup', currentKeyupListener);

        async function triggerTextImprovement() {
            utils.debug('triggerTextImprovement() called', {
                isProcessing: textImprover.isProcessing,
                debugMode: CONFIG.DEBUG_MODE
            });

            if (textImprover.isProcessing) {
                utils.debug('Already processing, aborting', { isProcessing: true });
                utils.showNotification('Already processing text...', 'error');
                return;
            }

            const messageInput = utils.findMessageInput();
            if (!messageInput) {
                utils.debug('Message input not found', { messageInput: null });
                utils.showNotification('No message input found', 'error');
                utils.log('Message input not found');
                return;
            }

            utils.log(`Found message input: ${messageInput.tagName}`);
            utils.debug('Message input found', {
                tagName: messageInput.tagName,
                className: messageInput.className,
                id: messageInput.id
            });

            const originalText = utils.getTextFromElement(messageInput);
            utils.log(`Original text: "${originalText}"`);

            if (!originalText.trim()) {
                utils.debug('No text to improve', { originalText });
                utils.showNotification('No text to improve', 'error');
                return;
            }

            const improvedText = await textImprover.improveText(originalText);

            if (improvedText) {
                utils.debug('Setting improved text', {
                    originalText,
                    improvedText,
                    lengthChange: improvedText.length - originalText.length
                });
                utils.setTextInElement(messageInput, improvedText);
            } else {
                utils.debug('No improved text received', { improvedText });
            }
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

    // Create SlackPolish logo
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

    // Show loading indicator (original design)
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

    // Show simple error notification (original design)
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

    // Create SlackPolish logo (original design)
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

    // Handle API errors and show appropriate popups
    function handleApiError(error) {
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

    // Update API key in configuration and localStorage
    function updateApiKey(newApiKey) {
        try {
            // Update the current config for immediate use
            CONFIG.OPENAI_API_KEY = newApiKey;

            // Save to localStorage for persistence
            localStorage.setItem('slackpolish_openai_api_key', newApiKey);

            utils.log('🔑 API key updated and saved for future use');
        } catch (error) {
            utils.log(`❌ Error updating API key: ${error.message}`);
        }
    }

    // Initialize global Channel Messages system
    function initializeGlobalChannelMessagesSystem() {
        if (window.SlackPolishChannelMessages) return; // Already initialized

        window.SlackPolishChannelMessages = {
            getCurrentChannelId() {
                try {
                    // Try multiple methods to get current channel ID

                    // Method 1: From URL
                    const urlMatch = window.location.href.match(/\/client\/[^\/]+\/([^\/\?]+)/);
                    if (urlMatch && urlMatch[1] && urlMatch[1] !== 'dms') {
                        if (window.SlackPolishDebug) {
                            window.SlackPolishDebug.addLog('channel-messages', 'Channel ID from URL', {
                                channelId: urlMatch[1],
                                url: window.location.href
                            });
                        }
                        return urlMatch[1];
                    }

                    // Method 2: From DOM elements
                    const channelHeader = document.querySelector('[data-qa="channel_header"]');
                    if (channelHeader) {
                        const channelId = channelHeader.getAttribute('data-channel-id');
                        if (channelId) {
                            if (window.SlackPolishDebug) {
                                window.SlackPolishDebug.addLog('channel-messages', 'Channel ID from header', {
                                    channelId
                                });
                            }
                            return channelId;
                        }
                    }

                    // Method 3: From message container
                    const messageContainer = document.querySelector('[data-qa="slack_kit_scrollbar"]');
                    if (messageContainer) {
                        const channelId = messageContainer.getAttribute('data-channel-id');
                        if (channelId) {
                            if (window.SlackPolishDebug) {
                                window.SlackPolishDebug.addLog('channel-messages', 'Channel ID from container', {
                                    channelId
                                });
                            }
                            return channelId;
                        }
                    }

                    // Special case: if we're in DMs view, try to get the actual DM channel ID
                    if (window.location.href.includes('/dms') || window.location.href.includes('/D0')) {
                        // Try multiple methods to find the DM channel ID
                        const dmSelectors = [
                            '[data-qa="channel_sidebar_name_button"][aria-current="page"]',
                            '[data-qa="channel_sidebar_name_button"].c-button--active',
                            '.p-channel_sidebar__name--selected',
                            '.c-virtual_list__item--selected [data-qa-channel-sidebar-channel-id]',
                            '[aria-selected="true"][data-qa-channel-sidebar-channel-id]'
                        ];

                        for (const selector of dmSelectors) {
                            const activeChannel = document.querySelector(selector);
                            if (activeChannel) {
                                let channelId = activeChannel.getAttribute('data-qa-channel-sidebar-channel-id');
                                if (!channelId) {
                                    channelId = activeChannel.getAttribute('data-channel-id');
                                }
                                if (!channelId) {
                                    // Try to extract from href or other attributes
                                    const href = activeChannel.getAttribute('href');
                                    if (href) {
                                        const match = href.match(/\/([D][A-Z0-9]+)/);
                                        if (match) {
                                            channelId = match[1];
                                        }
                                    }
                                }
                                if (channelId && channelId !== 'dms') {
                                    if (window.SlackPolishDebug) {
                                        window.SlackPolishDebug.addLog('channel-messages', 'Channel ID from active DM', {
                                            channelId,
                                            selector
                                        });
                                    }
                                    return channelId;
                                }
                            }
                        }

                        // Fallback: try to extract DM ID from URL more aggressively
                        const dmUrlMatch = window.location.href.match(/\/([D][A-Z0-9]{8,})/);
                        if (dmUrlMatch && dmUrlMatch[1]) {
                            if (window.SlackPolishDebug) {
                                window.SlackPolishDebug.addLog('channel-messages', 'Channel ID from DM URL pattern', {
                                    channelId: dmUrlMatch[1],
                                    url: window.location.href
                                });
                            }
                            return dmUrlMatch[1];
                        }
                    }

                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'Could not determine channel ID', {
                            url: window.location.href,
                            hasChannelHeader: !!channelHeader,
                            hasMessageContainer: !!messageContainer,
                            isDmsView: window.location.href.includes('/dms')
                        });
                    }

                    return null;
                } catch (error) {
                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'Error getting channel ID', {
                            error: error.message
                        });
                    }
                    return null;
                }
            },

            getCurrentChannelName() {
                try {
                    // Try to get channel name from various DOM elements
                    const channelNameSelectors = [
                        '[data-qa="channel_header"] [data-qa="channel_name"]',
                        '[data-qa="channel_header"] h1',
                        '.p-channel_header__title',
                        '.p-channel_header__name'
                    ];

                    for (const selector of channelNameSelectors) {
                        const element = document.querySelector(selector);
                        if (element && element.textContent.trim()) {
                            const channelName = element.textContent.trim();
                            if (window.SlackPolishDebug) {
                                window.SlackPolishDebug.addLog('channel-messages', 'Channel name found', {
                                    channelName,
                                    selector
                                });
                            }
                            return channelName;
                        }
                    }

                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'Could not determine channel name', {
                            availableSelectors: channelNameSelectors.map(sel => ({
                                selector: sel,
                                found: !!document.querySelector(sel)
                            }))
                        });
                    }

                    return 'Unknown Channel';
                } catch (error) {
                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'Error getting channel name', {
                            error: error.message
                        });
                    }
                    return 'Unknown Channel';
                }
            },

            async fetchChannelMessages(options = {}) {
                const {
                    count = 50,           // Number of messages to fetch
                    oldest = null,        // Timestamp (string or number) - fetch messages after this time
                    latest = null,        // Timestamp (string or number) - fetch messages before this time
                    inclusive = true,     // Include messages with exact timestamps
                    includeThreads = false, // Include thread replies
                    getAllMessages = false // Fetch ALL messages in channel (ignores count)
                } = options;

                if (window.SlackPolishDebug) {
                    window.SlackPolishDebug.addLog('channel-messages', 'Fetching channel messages via API', {
                        options,
                        count,
                        oldest,
                        latest,
                        getAllMessages
                    });
                }

                try {
                    const channelId = this.getCurrentChannelId();
                    if (!channelId) {
                        throw new Error('Could not determine current channel ID');
                    }

                    let allMessages = [];
                    let hasMore = true;
                    let cursor = latest; // Start from latest timestamp
                    let totalApiCalls = 0;
                    const maxApiCalls = getAllMessages ? 100 : 10; // Safety limit

                    while (hasMore && totalApiCalls < maxApiCalls) {
                        totalApiCalls++;

                        // Build API request parameters
                        const apiParams = {
                            channel: channelId,
                            limit: getAllMessages ? 1000 : Math.min(count - allMessages.length, 1000),
                            inclusive: inclusive
                        };

                        // Add timestamp parameters
                        if (oldest) {
                            apiParams.oldest = this.convertToSlackTimestamp(oldest);
                        }
                        if (cursor) {
                            apiParams.latest = this.convertToSlackTimestamp(cursor);
                        }

                        if (window.SlackPolishDebug) {
                            window.SlackPolishDebug.addLog('channel-messages', 'Making API call', {
                                call: totalApiCalls,
                                params: apiParams,
                                currentMessageCount: allMessages.length
                            });
                        }

                        // Call Slack's internal conversations.history API
                        const response = await this.callSlackAPI('conversations.history', apiParams);

                        if (!response.ok) {
                            throw new Error(`Slack API error: ${response.error || 'Unknown error'}`);
                        }

                        const messages = response.messages || [];

                        if (window.SlackPolishDebug) {
                            window.SlackPolishDebug.addLog('channel-messages', 'API response received', {
                                messagesReceived: messages.length,
                                hasMore: response.has_more,
                                responseMetadata: response.response_metadata
                            });
                        }

                        // Process and add messages
                        const processedMessages = messages.map(msg => this.processSlackMessage(msg));
                        allMessages.push(...processedMessages);

                        // Check if we should continue
                        hasMore = response.has_more && (getAllMessages || allMessages.length < count);

                        // Update cursor for next request (oldest message timestamp)
                        if (hasMore && messages.length > 0) {
                            cursor = messages[messages.length - 1].ts;
                        }

                        // Safety check
                        if (!getAllMessages && allMessages.length >= count) {
                            hasMore = false;
                        }
                    }

                    // Trim to requested count if not getting all messages
                    if (!getAllMessages && allMessages.length > count) {
                        allMessages = allMessages.slice(0, count);
                    }

                    // Include thread messages if requested
                    if (includeThreads) {
                        allMessages = await this.includeThreadReplies(allMessages, channelId);
                    }

                    const result = {
                        channelId,
                        channelName: this.getCurrentChannelName(),
                        messages: allMessages,
                        totalReturned: allMessages.length,
                        apiCallsMade: totalApiCalls,
                        fetchedAt: new Date().toISOString(),
                        parameters: {
                            count,
                            oldest,
                            latest,
                            getAllMessages,
                            includeThreads
                        }
                    };

                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'Message fetching completed', result);
                    }

                    return result;

                } catch (error) {
                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'Error fetching messages', {
                            error: error.message,
                            stack: error.stack
                        });
                    }
                    throw error;
                }
            },

            convertToSlackTimestamp(timestamp) {
                if (typeof timestamp === 'string') {
                    // If it's already a Slack timestamp (contains decimal)
                    if (timestamp.includes('.')) {
                        return timestamp;
                    }
                    // If it's an ISO string, convert to Slack timestamp
                    return (new Date(timestamp).getTime() / 1000).toString();
                }
                if (typeof timestamp === 'number') {
                    // If it's milliseconds, convert to seconds
                    if (timestamp > 1000000000000) {
                        return (timestamp / 1000).toString();
                    }
                    // If it's already seconds, convert to string
                    return timestamp.toString();
                }
                if (timestamp instanceof Date) {
                    return (timestamp.getTime() / 1000).toString();
                }
                return timestamp;
            },

            async callSlackAPI(method, params) {
                try {
                    // Try to use Slack's internal API system
                    if (window.TS && window.TS.api) {
                        if (window.SlackPolishDebug) {
                            window.SlackPolishDebug.addLog('channel-messages', 'Using TS.api for Slack API call', {
                                method,
                                params
                            });
                        }

                        return new Promise((resolve, reject) => {
                            window.TS.api.call(method, params, (response) => {
                                if (response.ok) {
                                    resolve(response);
                                } else {
                                    reject(new Error(response.error || 'API call failed'));
                                }
                            });
                        });
                    }

                    // Fallback: Try to find Slack's internal fetch mechanism
                    if (window.webpackChunkSlack) {
                        // Look for Slack's API modules in webpack chunks
                        const apiModule = this.findSlackAPIModule();
                        if (apiModule) {
                            if (window.SlackPolishDebug) {
                                window.SlackPolishDebug.addLog('channel-messages', 'Using webpack API module', {
                                    method,
                                    params
                                });
                            }
                            return await apiModule.call(method, params);
                        }
                    }

                    // Last resort: Try direct fetch to Slack API (may not work due to CORS)
                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'Attempting direct API call', {
                            method,
                            params
                        });
                    }

                    throw new Error('No available Slack API interface found');

                } catch (error) {
                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'Slack API call failed', {
                            method,
                            params,
                            error: error.message
                        });
                    }
                    throw error;
                }
            },

            findSlackAPIModule() {
                try {
                    // This is a simplified approach - in practice, we'd need to inspect
                    // Slack's webpack modules to find the API interface
                    if (window.webpackChunkSlack) {
                        // Look through webpack chunks for API modules
                        // This would need to be implemented based on Slack's current structure
                        if (window.SlackPolishDebug) {
                            window.SlackPolishDebug.addLog('channel-messages', 'Searching for Slack API module in webpack chunks');
                        }
                    }
                    return null;
                } catch (error) {
                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'Error finding Slack API module', {
                            error: error.message
                        });
                    }
                    return null;
                }
            },

            processSlackMessage(slackMessage) {
                try {
                    return {
                        ts: slackMessage.ts,
                        type: slackMessage.type || 'message',
                        user: slackMessage.user || slackMessage.username || 'Unknown',
                        text: slackMessage.text || '',
                        timestamp: new Date(parseFloat(slackMessage.ts) * 1000).toISOString(),
                        thread_ts: slackMessage.thread_ts || null,
                        reply_count: slackMessage.reply_count || 0,
                        reactions: slackMessage.reactions || [],
                        files: slackMessage.files || [],
                        attachments: slackMessage.attachments || [],
                        blocks: slackMessage.blocks || [],
                        subtype: slackMessage.subtype || null,
                        bot_id: slackMessage.bot_id || null,
                        app_id: slackMessage.app_id || null,
                        edited: slackMessage.edited || null
                    };
                } catch (error) {
                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'Error processing Slack message', {
                            error: error.message,
                            message: slackMessage
                        });
                    }
                    return {
                        ts: slackMessage.ts || Date.now().toString(),
                        type: 'message',
                        user: 'Unknown',
                        text: 'Error processing message',
                        timestamp: new Date().toISOString()
                    };
                }
            },

            async includeThreadReplies(messages, channelId) {
                try {
                    const messagesWithThreads = [];

                    for (const message of messages) {
                        messagesWithThreads.push(message);

                        // If message has replies, fetch them
                        if (message.reply_count > 0 && message.ts) {
                            try {
                                const threadResponse = await this.callSlackAPI('conversations.replies', {
                                    channel: channelId,
                                    ts: message.ts
                                });

                                if (threadResponse.ok && threadResponse.messages) {
                                    // Skip the parent message (first in array) and add replies
                                    const replies = threadResponse.messages.slice(1).map(msg => ({
                                        ...this.processSlackMessage(msg),
                                        isThreadReply: true,
                                        parentTs: message.ts
                                    }));
                                    messagesWithThreads.push(...replies);
                                }
                            } catch (error) {
                                if (window.SlackPolishDebug) {
                                    window.SlackPolishDebug.addLog('channel-messages', 'Error fetching thread replies', {
                                        messageTs: message.ts,
                                        error: error.message
                                    });
                                }
                            }
                        }
                    }

                    return messagesWithThreads;
                } catch (error) {
                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'Error including thread replies', {
                            error: error.message
                        });
                    }
                    return messages; // Return original messages if thread fetching fails
                }
            },

            extractMessagesFromDOM() {
                try {
                    const messages = [];

                    // Find message containers - improved selectors for DMs and channels
                    const messageSelectors = [
                        '[data-qa="virtual_list_item"]', // Main message containers
                        '.c-message_kit__message', // Alternative message containers
                        '[data-qa="message"]', // DM message containers
                        '.c-message__content', // Fallback
                        '.c-virtual_list__item', // Another virtual list variant
                        '[role="listitem"]' // Generic list items that might contain messages
                    ];

                    let messageElements = [];

                    for (const selector of messageSelectors) {
                        messageElements = document.querySelectorAll(selector);
                        if (messageElements.length > 0) {
                            if (window.SlackPolishDebug) {
                                window.SlackPolishDebug.addLog('channel-messages', 'Found messages with selector', {
                                    selector,
                                    count: messageElements.length
                                });
                            }
                            break;
                        }
                    }

                    if (messageElements.length === 0) {
                        if (window.SlackPolishDebug) {
                            window.SlackPolishDebug.addLog('channel-messages', 'No message elements found', {
                                triedSelectors: messageSelectors
                            });
                        }
                        return [];
                    }

                    // Extract message data from each element
                    messageElements.forEach((element, index) => {
                        try {
                            const messageData = this.extractMessageData(element);
                            if (messageData) {
                                messages.push(messageData);
                            }
                        } catch (error) {
                            if (window.SlackPolishDebug) {
                                window.SlackPolishDebug.addLog('channel-messages', 'Error extracting message data', {
                                    index,
                                    error: error.message
                                });
                            }
                        }
                    });

                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'Messages extracted from DOM', {
                            totalElements: messageElements.length,
                            extractedMessages: messages.length,
                            sampleMessage: messages[0]
                        });
                    }

                    return messages;

                } catch (error) {
                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'Error in extractMessagesFromDOM', {
                            error: error.message,
                            stack: error.stack
                        });
                    }
                    return [];
                }
            },

            extractMessageData(element) {
                try {
                    // Extract basic message information
                    const messageData = {
                        type: 'message',
                        timestamp: null,
                        user: null,
                        text: '',
                        reactions: [],
                        thread_ts: null,
                        reply_count: 0
                    };

                    // Get timestamp - improved selectors for DMs
                    const timestampSelectors = [
                        '[data-ts]',
                        '.c-timestamp',
                        '[data-qa="message_timestamp"]',
                        '.c-message__timestamp',
                        'time'
                    ];

                    for (const selector of timestampSelectors) {
                        const timestampElement = element.querySelector(selector);
                        if (timestampElement) {
                            let ts = timestampElement.getAttribute('data-ts');
                            if (!ts && timestampElement.getAttribute('datetime')) {
                                // Convert datetime to timestamp
                                ts = (new Date(timestampElement.getAttribute('datetime')).getTime() / 1000).toString();
                            }
                            if (ts) {
                                messageData.timestamp = new Date(parseFloat(ts) * 1000).toISOString();
                                break;
                            }
                        }
                    }

                    // Get user information - improved selectors for DMs
                    const userSelectors = [
                        '[data-qa="message_sender_name"]',
                        '.c-message__sender',
                        '[data-qa="message_sender"]',
                        '.c-message_kit__sender',
                        '.c-message__sender_name',
                        '.c-message_attachment__author_name',
                        '[data-qa="message_author_name"]'
                    ];

                    for (const selector of userSelectors) {
                        const userEl = element.querySelector(selector);
                        if (userEl && userEl.textContent.trim()) {
                            messageData.user = userEl.textContent.trim();
                            break;
                        }
                    }

                    // Get message text - improved selectors for DMs
                    const textSelectors = [
                        '[data-qa="message_content"]',
                        '.c-message__body',
                        '.p-rich_text_section',
                        '.c-message_kit__text',
                        '.c-message__content_text',
                        '.c-message_attachment__text',
                        '.ql-editor p'
                    ];

                    for (const selector of textSelectors) {
                        const textEl = element.querySelector(selector);
                        if (textEl && textEl.textContent.trim()) {
                            messageData.text = textEl.textContent.trim();
                            break;
                        }
                    }

                    // If no text found with specific selectors, try getting all text content
                    if (!messageData.text) {
                        // Filter out timestamp and user name from the full text
                        let fullText = element.textContent || '';
                        if (messageData.user) {
                            fullText = fullText.replace(messageData.user, '').trim();
                        }
                        // Remove common timestamp patterns
                        fullText = fullText.replace(/\d{1,2}:\d{2}\s*(AM|PM)?/gi, '').trim();
                        fullText = fullText.replace(/Yesterday|Today|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/gi, '').trim();

                        if (fullText.length > 10) { // Only use if we have substantial text
                            messageData.text = fullText;
                        }
                    }

                    // Get thread information
                    const threadElement = element.querySelector('[data-qa="thread_reply_bar"]');
                    if (threadElement) {
                        const replyText = threadElement.textContent;
                        const replyMatch = replyText.match(/(\d+)\s+repl/);
                        if (replyMatch) {
                            messageData.reply_count = parseInt(replyMatch[1]);
                        }
                    }

                    // Get reactions
                    const reactionElements = element.querySelectorAll('[data-qa="reaction"]');
                    reactionElements.forEach(reactionEl => {
                        const emoji = reactionEl.querySelector('.c-emoji');
                        const count = reactionEl.querySelector('.c-reaction__count');
                        if (emoji && count) {
                            messageData.reactions.push({
                                emoji: emoji.getAttribute('data-emoji-name') || emoji.textContent,
                                count: parseInt(count.textContent) || 1
                            });
                        }
                    });

                    // Only return if we have essential data
                    if (messageData.text || messageData.user) {
                        return messageData;
                    }

                    return null;

                } catch (error) {
                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'Error extracting message data', {
                            error: error.message
                        });
                    }
                    return null;
                }
            },

            // Helper function for testing - can be called from browser console
            async testChannelMessages(options = {}) {
                try {
                    console.log('🔧 SLACKPOLISH: Testing Channel Messages module...');
                    console.log('📋 Options:', options);

                    const result = await this.fetchChannelMessages(options);

                    console.log('🔧 SLACKPOLISH: Channel Messages Test Results:');
                    console.log('📍 Channel:', result.channelName, '(' + result.channelId + ')');
                    console.log('📊 Messages returned:', result.totalReturned);
                    console.log('🔄 API calls made:', result.apiCallsMade);
                    console.log('⏰ Fetched at:', result.fetchedAt);
                    console.log('⚙️ Parameters used:', result.parameters);

                    if (result.messages.length > 0) {
                        console.log('💬 First message:', result.messages[0]);
                        console.log('💬 Last message:', result.messages[result.messages.length - 1]);
                        console.log('📝 Sample message texts:');
                        result.messages.slice(0, 5).forEach((msg, i) => {
                            console.log(`  ${i + 1}. [${msg.user}]: ${msg.text.substring(0, 100)}${msg.text.length > 100 ? '...' : ''}`);
                        });
                    }

                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'Test completed successfully', result);
                    }

                    return result;
                } catch (error) {
                    console.error('❌ SLACKPOLISH: Channel Messages test failed:', error);

                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'Test failed', {
                            error: error.message,
                            stack: error.stack
                        });
                    }

                    throw error;
                }
            },

            // Convenience methods for common use cases
            async getRecentMessages(count = 20) {
                return await this.fetchChannelMessages({ count });
            },

            async getRecentMessagesFromDOM(count = 20) {
                try {
                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'Using DOM fallback for recent messages', {
                            count
                        });
                    }

                    const channelId = this.getCurrentChannelId();
                    const channelName = this.getCurrentChannelName();
                    const messages = this.extractMessagesFromDOM();

                    // Get the most recent messages up to the requested count
                    const recentMessages = messages.slice(-count);

                    const result = {
                        channelId,
                        channelName,
                        messages: recentMessages,
                        totalReturned: recentMessages.length,
                        method: 'DOM',
                        fetchedAt: new Date().toISOString()
                    };

                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'DOM fallback completed', result);
                    }

                    return result;
                } catch (error) {
                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'DOM fallback failed', {
                            error: error.message,
                            stack: error.stack
                        });
                    }
                    throw error;
                }
            },

            async getMessagesFromDate(date, count = 100) {
                const oldest = date instanceof Date ? date : new Date(date);
                return await this.fetchChannelMessages({
                    oldest: oldest.toISOString(),
                    count
                });
            },

            async getMessagesInRange(startDate, endDate, includeThreads = false) {
                const oldest = startDate instanceof Date ? startDate : new Date(startDate);
                const latest = endDate instanceof Date ? endDate : new Date(endDate);
                return await this.fetchChannelMessages({
                    oldest: oldest.toISOString(),
                    latest: latest.toISOString(),
                    getAllMessages: true,
                    includeThreads
                });
            },

            async getAllChannelMessages(includeThreads = false) {
                return await this.fetchChannelMessages({
                    getAllMessages: true,
                    includeThreads
                });
            },

            async getRecentMessagesFromDOM(count = 20) {
                try {
                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'Using DOM fallback for recent messages', {
                            count
                        });
                    }

                    const channelId = this.getCurrentChannelId();
                    const channelName = this.getCurrentChannelName();
                    const messages = this.extractMessagesFromDOM();

                    // Get the most recent messages up to the requested count
                    const recentMessages = messages.slice(-count);

                    const result = {
                        channelId,
                        channelName,
                        messages: recentMessages,
                        totalReturned: recentMessages.length,
                        method: 'DOM',
                        fetchedAt: new Date().toISOString()
                    };

                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'DOM fallback completed', result);
                    }

                    return result;
                } catch (error) {
                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', 'DOM fallback failed', {
                            error: error.message,
                            stack: error.stack
                        });
                    }
                    throw error;
                }
            }
        };

        // Expose test functions globally for easy console access
        window.testChannelMessages = function(options) {
            if (window.SlackPolishChannelMessages) {
                return window.SlackPolishChannelMessages.testChannelMessages(options);
            } else {
                console.error('❌ SLACKPOLISH: Channel Messages module not available');
            }
        };

        // Expose convenience methods globally
        window.getRecentMessages = function(count = 20) {
            if (window.SlackPolishChannelMessages) {
                return window.SlackPolishChannelMessages.getRecentMessages(count);
            } else {
                console.error('❌ SLACKPOLISH: Channel Messages module not available');
            }
        };

        window.getMessagesFromDate = function(date, count = 100) {
            if (window.SlackPolishChannelMessages) {
                return window.SlackPolishChannelMessages.getMessagesFromDate(date, count);
            } else {
                console.error('❌ SLACKPOLISH: Channel Messages module not available');
            }
        };

        window.getAllChannelMessages = function(includeThreads = false) {
            if (window.SlackPolishChannelMessages) {
                return window.SlackPolishChannelMessages.getAllChannelMessages(includeThreads);
            } else {
                console.error('❌ SLACKPOLISH: Channel Messages module not available');
            }
        };
    }

    // Initialize global OpenAI system
    function initializeGlobalOpenAISystem() {
        if (window.SlackPolishOpenAI) return; // Already initialized

        window.SlackPolishOpenAI = {
            async testApiKey(apiKey, model = 'gpt-4-turbo') {
                if (window.SlackPolishDebug) {
                    window.SlackPolishDebug.addLog('openai', 'Testing API key', {
                        hasApiKey: !!apiKey,
                        model,
                        keyLength: apiKey ? apiKey.length : 0
                    });
                }

                try {
                    const response = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: model,
                            messages: [{
                                role: 'user',
                                content: 'Test message - please respond with just "OK"'
                            }],
                            max_tokens: 10,
                            temperature: 0
                        })
                    });

                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('openai', 'API test response received', {
                            status: response.status,
                            statusText: response.statusText,
                            ok: response.ok
                        });
                    }

                    if (response.ok) {
                        const data = await response.json();
                        const usage = data.usage;

                        if (window.SlackPolishDebug) {
                            window.SlackPolishDebug.addLog('openai', 'API test successful', {
                                model: data.model,
                                usage: usage,
                                response: data.choices?.[0]?.message?.content
                            });
                        }

                        return {
                            success: true,
                            message: `✅ API key is valid! Model: ${data.model || model}`,
                            data: {
                                model: data.model,
                                usage: usage
                            }
                        };
                    } else {
                        const errorData = await response.json().catch(() => ({}));
                        const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;

                        if (window.SlackPolishDebug) {
                            window.SlackPolishDebug.addLog('openai', 'API test failed', {
                                status: response.status,
                                error: errorMessage,
                                errorData
                            });
                        }

                        return {
                            success: false,
                            message: `❌ ${errorMessage}`,
                            error: errorData
                        };
                    }
                } catch (error) {
                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('openai', 'API test network error', {
                            error: error.message,
                            stack: error.stack
                        });
                    }

                    return {
                        success: false,
                        message: `❌ Network error: ${error.message}`,
                        error: error
                    };
                }
            },

            async improveText(apiKey, model, prompt, options = {}) {
                if (window.SlackPolishDebug) {
                    window.SlackPolishDebug.addLog('openai', 'Text improvement request', {
                        model,
                        promptLength: prompt.length,
                        options
                    });
                }

                try {
                    const requestBody = {
                        model: model,
                        messages: [{ role: 'user', content: prompt }],
                        max_tokens: options.maxTokens || 500,
                        temperature: options.temperature || 0.7
                    };

                    const response = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify(requestBody)
                    });

                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('openai', 'Text improvement response', {
                            status: response.status,
                            ok: response.ok
                        });
                    }

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
                    }

                    const data = await response.json();
                    const result = data.choices?.[0]?.message?.content || '';

                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('openai', 'Text improvement successful', {
                            resultLength: result.length,
                            usage: data.usage
                        });
                    }

                    return result;
                } catch (error) {
                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('openai', 'Text improvement error', {
                            error: error.message
                        });
                    }
                    throw error;
                }
            }
        };
    }

    // Initialize global debug system
    function initializeGlobalDebugSystem() {
        if (window.SlackPolishDebug) return; // Already initialized

        window.SlackPolishDebug = {
            logs: [],
            debugWindow: null,
            isEnabled: false,

            setEnabled: function(enabled) {
                this.isEnabled = enabled;
                if (enabled && this.logs.length > 0 && !this.debugWindow) {
                    this.createDebugWindow();
                }
            },

            addLog: function(source, message, data = null) {
                if (!this.isEnabled) return;

                const timestamp = new Date().toLocaleTimeString();
                const logEntry = {
                    timestamp,
                    source,
                    message,
                    data: data ? (typeof data === 'object' ? JSON.stringify(data, null, 2) : data) : null
                };

                this.logs.push(logEntry);

                // Keep only last 100 entries to prevent memory issues
                if (this.logs.length > 100) {
                    this.logs.shift();
                }

                // Create or update debug window
                if (!this.debugWindow) {
                    this.createDebugWindow();
                } else {
                    this.updateDebugWindow();
                }
            },

            createDebugWindow: function() {
                if (!document.body || this.debugWindow) return;

                // Create debug window overlay
                this.debugWindow = document.createElement('div');
                this.debugWindow.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 600px;
                    height: 500px;
                    background: #1a1d29;
                    color: #e8e8e8;
                    border: 2px solid #2eb67d;
                    border-radius: 8px;
                    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                    font-size: 11px;
                    z-index: 10001;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
                    display: flex;
                    flex-direction: column;
                `;

                // Create header
                const header = document.createElement('div');
                header.style.cssText = `
                    background: #2eb67d;
                    color: white;
                    padding: 8px 12px;
                    font-weight: bold;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-radius: 6px 6px 0 0;
                `;
                header.innerHTML = `
                    <span>🐛 SlackPolish Debug Console</span>
                    <div>
                        <button id="clear-debug" style="background: none; border: 1px solid white; color: white; cursor: pointer; font-size: 12px; margin-right: 8px; padding: 2px 6px; border-radius: 3px;">Clear</button>
                        <button id="close-debug" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px;">×</button>
                    </div>
                `;

                // Create content area
                const content = document.createElement('div');
                content.id = 'debug-content';
                content.style.cssText = `
                    flex: 1;
                    padding: 12px;
                    overflow-y: auto;
                    background: #1a1d29;
                    border-radius: 0 0 6px 6px;
                `;

                this.debugWindow.appendChild(header);
                this.debugWindow.appendChild(content);
                document.body.appendChild(this.debugWindow);

                // Add close functionality
                header.querySelector('#close-debug').addEventListener('click', () => {
                    this.debugWindow.remove();
                    this.debugWindow = null;
                });

                // Add clear functionality
                header.querySelector('#clear-debug').addEventListener('click', () => {
                    this.logs = [];
                    this.updateDebugWindow();
                });

                // Make draggable
                this.makeDebugWindowDraggable(header);

                // Initial content update
                this.updateDebugWindow();
            },

            updateDebugWindow: function() {
                if (!this.debugWindow) return;

                const content = this.debugWindow.querySelector('#debug-content');
                if (!content) return;

                if (this.logs.length === 0) {
                    content.innerHTML = '<div style="color: #666; text-align: center; margin-top: 50px;">No debug logs yet...</div>';
                    return;
                }

                content.innerHTML = this.logs.map(log => {
                    const sourceColors = {
                        'text-improver': '#2eb67d',
                        'settings': '#e01e5a',
                        'channel-summary': '#ecb22e',
                        'default': '#2eb67d'
                    };
                    const sourceColor = sourceColors[log.source] || sourceColors.default;

                    let html = `<div style="margin-bottom: 8px; padding: 6px; background: #252837; border-radius: 4px; border-left: 3px solid ${sourceColor};">`;
                    html += `<div style="color: ${sourceColor}; font-size: 10px; margin-bottom: 4px;">[${log.timestamp}] ${log.source.toUpperCase()}</div>`;
                    html += `<div style="color: #e8e8e8; margin-bottom: 4px;">${log.message}</div>`;
                    if (log.data) {
                        html += `<div style="color: #a0a0a0; font-size: 10px; white-space: pre-wrap; background: #1a1d29; padding: 4px; border-radius: 2px; margin-top: 4px; max-height: 200px; overflow-y: auto;">${log.data}</div>`;
                    }
                    html += `</div>`;
                    return html;
                }).join('');

                // Auto-scroll to bottom
                content.scrollTop = content.scrollHeight;
            },

            makeDebugWindowDraggable: function(header) {
                let isDragging = false;
                let currentX;
                let currentY;
                let initialX;
                let initialY;
                let xOffset = 0;
                let yOffset = 0;

                header.addEventListener('mousedown', (e) => {
                    if (e.target.tagName === 'BUTTON') return; // Don't drag when clicking buttons

                    initialX = e.clientX - xOffset;
                    initialY = e.clientY - yOffset;
                    isDragging = true;
                    header.style.cursor = 'grabbing';
                });

                document.addEventListener('mousemove', (e) => {
                    if (isDragging) {
                        e.preventDefault();
                        currentX = e.clientX - initialX;
                        currentY = e.clientY - initialY;

                        xOffset = currentX;
                        yOffset = currentY;

                        this.debugWindow.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
                    }
                });

                document.addEventListener('mouseup', () => {
                    if (isDragging) {
                        initialX = currentX;
                        initialY = currentY;
                        isDragging = false;
                        header.style.cursor = 'grab';
                    }
                });

                header.style.cursor = 'grab';
            }
        };
    }

    // Initialize
    function init() {
        // Initialize global systems first
        initializeGlobalChannelMessagesSystem();
        initializeGlobalOpenAISystem();
        initializeGlobalDebugSystem();

        utils.log('SlackPolish Text Improver initializing...');

        // Load settings from localStorage
        loadSettings();

        // Set up real-time settings updates
        setupSettingsListener();

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupEventListeners);
        } else {
            setupEventListeners();
        }

        utils.log('SlackPolish Text Improver initialized successfully');
    }

    // Set up storage event listener for real-time settings updates
    function setupSettingsListener() {
        // Listen for localStorage changes from the settings script
        window.addEventListener('storage', function(e) {
            if (e.key === 'slackpolish_settings' || e.key === 'slackpolish_openai_api_key') {
                utils.log('Settings changed in storage, reloading...');
                const oldHotkey = CONFIG.HOTKEY;
                const oldDebugMode = CONFIG.DEBUG_MODE;
                loadSettings();

                // If hotkey changed, re-setup event listeners
                if (oldHotkey !== CONFIG.HOTKEY) {
                    utils.log(`Hotkey changed from ${oldHotkey} to ${CONFIG.HOTKEY}, re-setting up listeners`);
                    setupEventListeners();
                }

                // If debug mode changed, update global debug system
                if (oldDebugMode !== CONFIG.DEBUG_MODE && window.SlackPolishDebug) {
                    window.SlackPolishDebug.setEnabled(CONFIG.DEBUG_MODE);
                    utils.log(`Debug mode ${CONFIG.DEBUG_MODE ? 'enabled' : 'disabled'}`);
                }

                utils.log('Settings reloaded successfully');
            }
        });

        // Also listen for custom events (for same-tab updates)
        window.addEventListener('slackpolish-settings-updated', function() {
            utils.log('Settings updated via custom event, reloading...');
            const oldHotkey = CONFIG.HOTKEY;
            loadSettings();

            // If hotkey changed, re-setup event listeners
            if (oldHotkey !== CONFIG.HOTKEY) {
                utils.log(`Hotkey changed from ${oldHotkey} to ${CONFIG.HOTKEY}, re-setting up listeners`);
                setupEventListeners();
            }

            utils.log('Settings reloaded successfully');
        });

        utils.log('Real-time settings listener initialized');
    }

    // Start the application
    init();

})();
// === SLACKPOLISH INJECTION END ===
