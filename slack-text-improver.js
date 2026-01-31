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
        ADD_EMOJI_SIGNATURE: false,
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
            // Check for emergency reset flags FIRST (installer-managed version system)
            const config = window.SLACKPOLISH_CONFIG || {};

            try {
                // Check for full settings reset (only if flag is true AND version is different)
                if (config.RESET_SAVED_SETTINGS === true) {
                    const resetVersion = config.RESET_SAVED_SETTINGS_VERSION || 'v1';
                    const lastResetVersion = localStorage.getItem('slackpolish-last-settings-reset-version');

                    if (resetVersion !== lastResetVersion) {
                        utils.log(`🚨 RESET_SAVED_SETTINGS flag detected (version: ${resetVersion}) - clearing saved settings`);
                        localStorage.removeItem('slackpolish_settings');
                        localStorage.removeItem('slackpolish_hide_summary_confirmation');

                        // Only clear API key if RESET_API_KEY is also true
                        if (config.RESET_API_KEY === true) {
                            utils.log(`🔑 Also clearing API key because RESET_API_KEY is true`);
                            localStorage.removeItem('slackpolish_openai_api_key');
                        } else {
                            utils.log(`🔑 Preserving API key because RESET_API_KEY is false`);
                        }

                        // Mark this reset version as completed
                        localStorage.setItem('slackpolish-last-settings-reset-version', resetVersion);

                        utils.log('✅ Settings reset to defaults due to RESET_SAVED_SETTINGS flag');
                        utils.log('💡 This reset happened once for this installation - managed by installer');
                    } else {
                        utils.log(`⏭️ RESET_SAVED_SETTINGS already performed for version ${resetVersion} - skipping`);
                    }
                } else {
                    utils.log('⏭️ RESET_SAVED_SETTINGS flag is false - no reset needed');
                }

                // Check for API key reset flag (independent of settings reset)
                if (config.RESET_API_KEY === true) {
                    const resetVersion = config.RESET_API_KEY_VERSION || 'v1';
                    const lastResetVersion = localStorage.getItem('slackpolish-last-apikey-reset-version');

                    if (resetVersion !== lastResetVersion) {
                        utils.log(`🔑 RESET_API_KEY flag detected (version: ${resetVersion}) - clearing saved API key only`);
                        try {
                            localStorage.removeItem('slackpolish_openai_api_key');
                            utils.log('✅ API key reset to config file value, other settings preserved');

                            // Mark this reset version as completed
                            localStorage.setItem('slackpolish-last-apikey-reset-version', resetVersion);

                            utils.log('💡 This reset happened once for this installation - managed by installer');
                        } catch (error) {
                            utils.log(`❌ Error resetting API key: ${error.message}`);
                        }
                    } else {
                        utils.log(`⏭️ RESET_API_KEY already performed for version ${resetVersion} - skipping`);
                    }
                } else {
                    utils.log('⏭️ RESET_API_KEY flag is false - no reset needed');
                }
            } catch (error) {
                utils.log(`❌ Error in reset logic: ${error.message}`);
            }

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
                CONFIG.ADD_EMOJI_SIGNATURE = typeof settings.addEmojiSignature === 'boolean' ? settings.addEmojiSignature : false;

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
            // Enhanced message input detection with thread support
            utils.debug('🔍 Starting message input search...');

            // PRIORITY 1: Always use the focused element if it's editable
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.contentEditable === 'true' || activeElement.matches('.ql-editor'))) {
                utils.debug('📝 Found active editable element', {
                    tagName: activeElement.tagName,
                    className: activeElement.className,
                    dataQa: activeElement.getAttribute('data-qa')
                });

                // Check if this focused element is in a thread or main channel
                const threadContainer = activeElement.closest('.p-thread_view, .p-threads_view, [data-qa*="thread"]');
                if (threadContainer) {
                    utils.debug('🧵 USING FOCUSED THREAD INPUT');
                } else {
                    utils.debug('📝 USING FOCUSED MAIN CHANNEL INPUT');
                }

                // Always return the focused element - user's cursor location is the priority
                return activeElement;
            }

            // PRIORITY 2: If no focused element, use smart detection as fallback
            utils.debug('🔍 No focused element found, using fallback detection...');

            // If we're in a thread context, look for thread-specific inputs
            if (this.isInThread()) {
                utils.debug('🧵 IN THREAD CONTEXT - Looking for thread-specific inputs...');

                const threadSelectors = [
                    '[data-qa="thread_message_input"]',
                    '[data-qa="thread-message-input"]',
                    '.p-thread_view .ql-editor',
                    '.p-threads_view .ql-editor',
                    '[data-qa*="thread"] .ql-editor',
                    '[data-qa*="thread"] [contenteditable="true"]'
                ];

                for (const selector of threadSelectors) {
                    const element = document.querySelector(selector);
                    if (element && element.isContentEditable) {
                        utils.debug('✅ FOUND THREAD INPUT (fallback)', { selector });
                        return element;
                    }
                }
            }

            // PRIORITY 3: Regular channel input search (final fallback)
            utils.debug('📝 SEARCHING FOR CHANNEL INPUT (final fallback)');
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
                    utils.debug('✅ FOUND CHANNEL INPUT (fallback)', { selector });
                    return element;
                }
            }

            utils.debug('❌ NO MESSAGE INPUT FOUND');
            return null;
        },

        getTextFromElement: function(element) {
            if (!element) return '';

            // Check if there's selected text first
            const selectionInfo = this.getSelectionInfo(element);
            if (selectionInfo.hasSelection) {
                utils.debug('📝 Using selected text for processing', {
                    selectedText: selectionInfo.selectedText,
                    selectionLength: selectionInfo.selectedText.length
                });
                return selectionInfo.selectedText;
            }

            // No selection - use full element text (existing behavior)
            // Special handling for Slack's rich text editor to preserve numbering
            if (element.classList.contains('ql-editor')) {
                return this.extractTextWithNumbering(element);
            }

            // Use standard text extraction but clean up extra line breaks
            let text = element.innerText || element.textContent || '';

            // Replace multiple consecutive newlines with single newlines
            text = text.replace(/\n\s*\n+/g, '\n');

            // Trim whitespace from start and end
            text = text.trim();

            return text;
        },

        getSelectionInfo: function(element) {
            if (!element) return { hasSelection: false };

            try {
                const selection = window.getSelection();

                // Check if there's a selection and it's within our target element
                if (!selection || selection.rangeCount === 0) {
                    return { hasSelection: false };
                }

                const range = selection.getRangeAt(0);

                // Check if the selection is within the target element
                if (!element.contains(range.commonAncestorContainer) &&
                    range.commonAncestorContainer !== element) {
                    return { hasSelection: false };
                }

                const selectedText = range.toString().trim();

                // Only consider it a valid selection if there's actual text
                if (!selectedText) {
                    return { hasSelection: false };
                }

                return {
                    hasSelection: true,
                    selectedText: selectedText,
                    range: range,
                    selection: selection
                };
            } catch (error) {
                utils.debug('Error getting selection info:', error);
                return { hasSelection: false };
            }
        },

        extractTextWithNumbering: function(element) {
            let result = '';
            let listCounter = 1;

            // Process all child nodes
            const processNode = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    return node.textContent;
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const tagName = node.tagName.toLowerCase();

                    if (tagName === 'ol') {
                        // Ordered list - reset counter
                        listCounter = 1;
                        let listText = '';
                        for (const li of node.children) {
                            if (li.tagName.toLowerCase() === 'li') {
                                const liText = this.getTextFromNode(li);
                                if (liText.trim()) {
                                    listText += `${listCounter}. ${liText.trim()}\n`;
                                    listCounter++;
                                }
                            }
                        }
                        return listText;
                    } else if (tagName === 'ul') {
                        // Unordered list
                        let listText = '';
                        for (const li of node.children) {
                            if (li.tagName.toLowerCase() === 'li') {
                                const liText = this.getTextFromNode(li);
                                if (liText.trim()) {
                                    listText += `• ${liText.trim()}\n`;
                                }
                            }
                        }
                        return listText;
                    } else if (tagName === 'p' || tagName === 'div') {
                        // Paragraph or div - get text and add newline
                        const pText = this.getTextFromNode(node);
                        return pText.trim() ? pText.trim() + '\n' : '';
                    } else if (tagName === 'br') {
                        return '\n';
                    } else {
                        // Other elements - just get their text content
                        return this.getTextFromNode(node);
                    }
                }
                return '';
            };

            for (const child of element.childNodes) {
                result += processNode(child);
            }

            // Clean up extra newlines and trim
            result = result.replace(/\n\s*\n+/g, '\n').trim();

            return result;
        },

        getTextFromNode: function(node) {
            if (!node) return '';

            if (node.nodeType === Node.TEXT_NODE) {
                return node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                let text = '';
                for (const child of node.childNodes) {
                    text += this.getTextFromNode(child);
                }
                return text;
            }

            return '';
        },

        setTextWithFormatting: function(element, text) {
            // Clear the element
            element.innerHTML = '';

            const lines = text.split('\n');
            let currentList = null;
            let currentListType = null;

            lines.forEach((line, index) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return; // Skip empty lines

                // Check if this is a numbered list item
                const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
                if (numberedMatch) {
                    const [, number, content] = numberedMatch;

                    // Create or continue ordered list
                    if (!currentList || currentListType !== 'ol') {
                        currentList = document.createElement('ol');
                        currentListType = 'ol';
                        element.appendChild(currentList);
                    }

                    const li = document.createElement('li');
                    li.textContent = content;
                    currentList.appendChild(li);
                    return;
                }

                // Check if this is a bullet list item
                const bulletMatch = trimmedLine.match(/^[•·*-]\s+(.+)$/);
                if (bulletMatch) {
                    const [, content] = bulletMatch;

                    // Create or continue unordered list
                    if (!currentList || currentListType !== 'ul') {
                        currentList = document.createElement('ul');
                        currentListType = 'ul';
                        element.appendChild(currentList);
                    }

                    const li = document.createElement('li');
                    li.textContent = content;
                    currentList.appendChild(li);
                    return;
                }

                // Regular paragraph - reset list context
                currentList = null;
                currentListType = null;

                const p = document.createElement('p');
                p.textContent = trimmedLine;
                element.appendChild(p);
            });
        },

        isInThread: function() {
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
                !!document.querySelector('.p-thread_view .ql-editor'),
                !!document.querySelector('.p-threads_view .ql-editor'),

                // Check if we have multiple .ql-editor elements (main + thread)
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

            utils.debug('🔍 Thread detection:', debugInfo);

            return isThread;
        },

        setTextInElement: function(element, text, preservedSelectionInfo = null) {
            if (!element) return;

            // Handle debug test markers
            if (text.startsWith('[DEBUG_')) {
                this.handleDebugInsertion(element, text);
                return;
            }

            // Check if we should replace selected text only
            // Use preserved selection info if available, otherwise check current selection
            const selectionInfo = preservedSelectionInfo || this.getSelectionInfo(element);
            if (selectionInfo && selectionInfo.hasSelection) {
                this.replaceSelectedTextWithPreservedInfo(element, text, selectionInfo);
                return;
            }

            // No selection - replace entire element content (existing behavior)
            // Special handling for Slack rich text editor to preserve formatting
            if (element.classList.contains('ql-editor')) {
                utils.debug('Setting text back to Slack with formatting preservation', {
                    style: CONFIG.STYLE,
                    text: text,
                    textLength: text.length
                });

                this.setTextWithFormatting(element, text);

                utils.debug('Final HTML structure in Slack', {
                    style: CONFIG.STYLE,
                    innerHTML: element.innerHTML,
                    paragraphCount: element.querySelectorAll('p').length,
                    listCount: element.querySelectorAll('ol, ul').length
                });
            } else {
                // Fallback for non-rich-text elements
                element.innerHTML = '';
                element.innerText = text;
            }

            // Trigger input events to notify Slack
            const events = ['input', 'change', 'keyup'];
            events.forEach(eventType => {
                const event = new Event(eventType, { bubbles: true });
                element.dispatchEvent(event);
            });
        },

        replaceSelectedText: function(element, improvedText, selectionInfo) {
            utils.debug('🎯 Replacing selected text (current selection)', {
                originalSelection: selectionInfo.selectedText,
                improvedText: improvedText,
                selectionLength: selectionInfo.selectedText.length,
                improvedLength: improvedText.length
            });

            try {
                const range = selectionInfo.range;
                const selection = selectionInfo.selection;

                // Delete the selected content
                range.deleteContents();

                // Create a text node with the improved text
                const textNode = document.createTextNode(improvedText);

                // Insert the improved text
                range.insertNode(textNode);

                // Create a new range to select the inserted text
                const newRange = document.createRange();
                newRange.selectNodeContents(textNode);

                // Clear current selection and select the new text
                selection.removeAllRanges();
                selection.addRange(newRange);

                utils.debug('✅ Selected text replacement completed', {
                    newSelection: selection.toString(),
                    elementContent: element.innerText
                });

                // Trigger input events to notify Slack
                const events = ['input', 'change', 'keyup'];
                events.forEach(eventType => {
                    const event = new Event(eventType, { bubbles: true });
                    element.dispatchEvent(event);
                });

            } catch (error) {
                utils.debug('❌ Error replacing selected text:', error);
                // Fallback to full text replacement
                utils.debug('🔄 Falling back to full text replacement');
                this.setTextWithFormatting(element, improvedText);
            }
        },

        replaceSelectedTextWithPreservedInfo: function(element, improvedText, preservedSelectionInfo) {
            utils.debug('🎯 Replacing selected text (preserved selection)', {
                originalSelection: preservedSelectionInfo.selectedText,
                improvedText: improvedText,
                selectionLength: preservedSelectionInfo.selectedText.length,
                improvedLength: improvedText.length
            });

            try {
                // Try to recreate the selection using the preserved info
                // Use textContent to match how TreeWalker counts characters (no DOM-added newlines)
                const currentFullText = element.textContent || '';
                const selectedText = preservedSelectionInfo.selectedText;

                utils.debug('Text matching attempt', {
                    currentFullTextLength: currentFullText.length,
                    selectedTextLength: selectedText.length,
                    currentFullTextPreview: currentFullText.substring(0, 100) + '...',
                    selectedTextPreview: selectedText.substring(0, 100) + '...'
                });

                // Find the position of the selected text in the current content
                let selectionIndex = currentFullText.indexOf(selectedText);

                // If exact match fails, try with normalized whitespace
                if (selectionIndex === -1) {
                    const normalizedCurrent = currentFullText.replace(/\s+/g, ' ').trim();
                    const normalizedSelected = selectedText.replace(/\s+/g, ' ').trim();
                    const normalizedIndex = normalizedCurrent.indexOf(normalizedSelected);

                    if (normalizedIndex !== -1) {
                        // Try to map back to original position (approximate)
                        selectionIndex = this.findOriginalPosition(currentFullText, normalizedCurrent, normalizedIndex);
                        utils.debug('Found match with normalized whitespace', {
                            normalizedIndex,
                            mappedIndex: selectionIndex
                        });
                    } else {
                        // Try partial matching from the beginning or end
                        const selectedStart = selectedText.substring(0, Math.min(50, selectedText.length));
                        const selectedEnd = selectedText.substring(Math.max(0, selectedText.length - 50));

                        const startIndex = currentFullText.indexOf(selectedStart);
                        const endIndex = currentFullText.lastIndexOf(selectedEnd);

                        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                            selectionIndex = startIndex;
                            utils.debug('Found match using partial start/end matching', {
                                startIndex,
                                endIndex,
                                selectedStart,
                                selectedEnd
                            });
                        } else {
                            utils.debug('All matching attempts failed', {
                                exactMatch: false,
                                normalizedMatch: false,
                                partialMatch: false,
                                selectedStart,
                                selectedEnd,
                                startIndex,
                                endIndex
                            });
                        }
                    }
                }

                if (selectionIndex === -1) {
                    console.log('🔍 TEXT MATCHING DEBUG - All attempts failed:');
                    console.log('Current Full Text:', currentFullText);
                    console.log('Current Full Text Length:', currentFullText.length);
                    console.log('Selected Text:', selectedText);
                    console.log('Selected Text Length:', selectedText.length);
                    console.log('First 200 chars of current:', currentFullText.substring(0, 200));
                    console.log('First 200 chars of selected:', selectedText.substring(0, 200));
                    console.log('Last 200 chars of current:', currentFullText.substring(currentFullText.length - 200));
                    console.log('Last 200 chars of selected:', selectedText.substring(selectedText.length - 200));

                    utils.debug('⚠️ Could not find selected text in current content');
                    utils.debug('Text matching failed - detailed analysis', {
                        currentFullTextLength: currentFullText.length,
                        selectedTextLength: selectedText.length,
                        currentFirstChars: currentFullText.substring(0, 100),
                        selectedFirstChars: selectedText.substring(0, 100),
                        currentLastChars: currentFullText.substring(Math.max(0, currentFullText.length - 100)),
                        selectedLastChars: selectedText.substring(Math.max(0, selectedText.length - 100))
                    });

                    // Offer fallback: improve entire text but warn user
                    utils.showNotification('Text selection changed during processing. Press Ctrl+Shift again to improve entire message.', 'warning');
                    return;
                }

                // Create a new selection at the found position
                const selection = window.getSelection();
                const range = document.createRange();

                // Find the text nodes and set the range
                if (this.setRangeFromTextPosition(element, range, selectionIndex, selectionIndex + selectedText.length)) {
                    // Select the original text
                    selection.removeAllRanges();
                    selection.addRange(range);

                    // Replace the selected content with improved text
                    range.deleteContents();
                    const textNode = document.createTextNode(improvedText);
                    range.insertNode(textNode);

                    // Trigger input events to notify Slack FIRST
                    const events = ['input', 'change', 'keyup'];
                    events.forEach(eventType => {
                        const event = new Event(eventType, { bubbles: true });
                        element.dispatchEvent(event);
                    });

                    // Then select the newly inserted text after a small delay
                    setTimeout(() => {
                        const newRange = document.createRange();
                        newRange.selectNodeContents(textNode);
                        selection.removeAllRanges();
                        selection.addRange(newRange);

                        console.log('✅ Selection applied after delay:', {
                            selectedText: selection.toString(),
                            rangeCount: selection.rangeCount
                        });
                    }, 100);

                    utils.debug('✅ Selected text replacement with preserved info completed');
                } else {
                    // Fallback to manual text replacement
                    utils.debug('⚠️ Could not create range, using manual replacement');
                    const beforeSelection = currentFullText.substring(0, selectionIndex);
                    const afterSelection = currentFullText.substring(selectionIndex + selectedText.length);
                    const newFullText = beforeSelection + improvedText + afterSelection;

                    if (element.classList.contains('ql-editor')) {
                        this.setTextWithFormatting(element, newFullText);
                    } else {
                        element.innerText = newFullText;
                    }

                    // Trigger input events to notify Slack
                    const events = ['input', 'change', 'keyup'];
                    events.forEach(eventType => {
                        const event = new Event(eventType, { bubbles: true });
                        element.dispatchEvent(event);
                    });

                    // Try to select the improved text portion after DOM settles
                    setTimeout(() => {
                        this.selectTextRange(element, selectionIndex, selectionIndex + improvedText.length);
                    }, 100);
                }

            } catch (error) {
                utils.debug('❌ Error replacing selected text with preserved info:', error);
                // Fallback to full text replacement
                utils.debug('🔄 Falling back to full text replacement');
                this.setTextWithFormatting(element, improvedText);
            }
        },

        findOriginalPosition: function(originalText, normalizedText, normalizedIndex) {
            // This is a simple approximation - map normalized position back to original
            // by counting characters up to the normalized position
            let originalPos = 0;
            let normalizedPos = 0;

            while (normalizedPos < normalizedIndex && originalPos < originalText.length) {
                const originalChar = originalText[originalPos];

                // If it's whitespace, it might be collapsed in normalized version
                if (/\s/.test(originalChar)) {
                    // Skip consecutive whitespace in original
                    while (originalPos < originalText.length && /\s/.test(originalText[originalPos])) {
                        originalPos++;
                    }
                    // Count as one space in normalized
                    if (normalizedPos < normalizedText.length && normalizedText[normalizedPos] === ' ') {
                        normalizedPos++;
                    }
                } else {
                    // Regular character
                    originalPos++;
                    normalizedPos++;
                }
            }

            return originalPos;
        },

        setRangeFromTextPosition: function(element, range, startIndex, endIndex) {
            try {
                // Simple approach: walk through text nodes and count characters
                const walker = document.createTreeWalker(
                    element,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );

                let currentIndex = 0;
                let startNode = null;
                let endNode = null;
                let startOffset = 0;
                let endOffset = 0;

                let node;
                while (node = walker.nextNode()) {
                    const nodeLength = node.textContent.length;

                    if (startNode === null && currentIndex + nodeLength > startIndex) {
                        startNode = node;
                        startOffset = startIndex - currentIndex;
                    }

                    if (currentIndex + nodeLength >= endIndex) {
                        endNode = node;
                        endOffset = endIndex - currentIndex;
                        break;
                    }

                    currentIndex += nodeLength;
                }

                if (startNode && endNode) {
                    range.setStart(startNode, startOffset);
                    range.setEnd(endNode, endOffset);

                    console.log('✅ Range set successfully:', {
                        startIndex,
                        endIndex,
                        startOffset,
                        endOffset,
                        startNodeText: startNode.textContent.substring(0, 50),
                        endNodeText: endNode.textContent.substring(0, 50)
                    });

                    return true;
                } else {
                    console.log('❌ Could not find start/end nodes:', {
                        startNode: !!startNode,
                        endNode: !!endNode,
                        startIndex,
                        endIndex,
                        currentIndex
                    });
                    return false;
                }

            } catch (error) {
                utils.debug('❌ Error setting range from text position:', error);
                console.error('Range setting error:', error);
                return false;
            }
        },

        selectTextRange: function(element, startIndex, endIndex) {
            try {
                const selection = window.getSelection();
                const range = document.createRange();

                // For contenteditable elements, we need to find the text nodes
                const walker = document.createTreeWalker(
                    element,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );

                let currentIndex = 0;
                let startNode = null;
                let endNode = null;
                let startOffset = 0;
                let endOffset = 0;

                let node;
                while (node = walker.nextNode()) {
                    const nodeLength = node.textContent.length;

                    if (startNode === null && currentIndex + nodeLength > startIndex) {
                        startNode = node;
                        startOffset = startIndex - currentIndex;
                    }

                    if (currentIndex + nodeLength >= endIndex) {
                        endNode = node;
                        endOffset = endIndex - currentIndex;
                        break;
                    }

                    currentIndex += nodeLength;
                }

                if (startNode && endNode) {
                    range.setStart(startNode, startOffset);
                    range.setEnd(endNode, endOffset);

                    selection.removeAllRanges();
                    selection.addRange(range);

                    utils.debug('✅ Text range selected successfully', {
                        startIndex, endIndex, startOffset, endOffset
                    });
                } else {
                    utils.debug('⚠️ Could not find text nodes for selection');
                }

            } catch (error) {
                utils.debug('❌ Error selecting text range:', error);
            }
        },

        handleDebugInsertion: function(element, markedText) {
            // Parse debug marker
            const markerEnd = markedText.indexOf(']');
            if (markerEnd === -1) {
                utils.debug('Invalid debug marker format', { markedText });
                return;
            }

            const marker = markedText.substring(1, markerEnd); // Remove [ and ]
            const actualText = markedText.substring(markerEnd + 1);

            utils.debug('Handling debug insertion', {
                marker: marker,
                actualText: actualText,
                elementType: element.tagName,
                elementClass: element.className
            });

            // Clear element first
            element.innerHTML = '';
            element.focus();

            switch (marker) {
                case 'DEBUG_LINK_TYPING':
                    this.simulateTyping(element, actualText, 100); // 100ms delay
                    break;

                case 'DEBUG_INSTANT_INSERT':
                    this.instantInsert(element, actualText);
                    break;

                case 'DEBUG_MULTIPLE_URLS':
                    this.simulateTyping(element, actualText, 150); // Slower for multiple URLs
                    break;

                case 'DEBUG_TIMING_FAST':
                    this.simulateTyping(element, actualText, 50); // Fast typing
                    break;

                case 'DEBUG_TIMING_SLOW':
                    this.simulateTyping(element, actualText, 300); // Slow typing
                    break;

                case 'DEBUG_URL_LINEBREAK':
                    this.simulateUrlAwareTyping(element, actualText, 100); // URL-aware typing with line breaks
                    break;

                default:
                    utils.debug('Unknown debug marker', { marker });
                    this.instantInsert(element, actualText);
            }
        },

        simulateTyping: function(element, text, delay = 100) {
            utils.debug('Starting typing simulation', {
                text: text,
                delay: delay,
                length: text.length
            });

            let currentText = '';

            for (let i = 0; i < text.length; i++) {
                setTimeout(() => {
                    currentText += text[i];
                    element.innerText = currentText;

                    // Trigger input event after each character
                    element.dispatchEvent(new Event('input', { bubbles: true }));

                    utils.debug(`Typed character ${i + 1}/${text.length}`, {
                        character: text[i],
                        currentText: currentText
                    });

                    // Log completion
                    if (i === text.length - 1) {
                        utils.debug('Typing simulation completed', {
                            finalText: currentText,
                            totalCharacters: text.length
                        });
                    }
                }, i * delay);
            }
        },

        instantInsert: function(element, text) {
            utils.debug('Instant insertion', { text: text });

            element.innerText = text;

            // Trigger events
            const events = ['input', 'change', 'keyup'];
            events.forEach(eventType => {
                const event = new Event(eventType, { bubbles: true });
                element.dispatchEvent(event);
            });

            utils.debug('Instant insertion completed', { finalText: element.innerText });
        },

        simulateUrlAwareTyping: function(element, text, delay = 100) {
            utils.debug('Starting URL-aware typing simulation', {
                text: text,
                delay: delay,
                length: text.length
            });

            // Detect URLs and create segments with line breaks
            const segments = this.createUrlAwareSegments(text);

            utils.debug('Created URL-aware segments', {
                segments: segments,
                totalSegments: segments.length
            });

            // Type each segment
            this.typeSegments(element, segments, delay, 0);
        },

        createUrlAwareSegments: function(text) {
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const segments = [];
            let lastIndex = 0;
            let match;

            while ((match = urlRegex.exec(text)) !== null) {
                const url = match[0];
                const urlStart = match.index;
                const urlEnd = urlStart + url.length;

                // Add text before URL (if any)
                if (urlStart > lastIndex) {
                    const beforeText = text.substring(lastIndex, urlStart);
                    segments.push({
                        type: 'text',
                        content: beforeText
                    });
                }

                // Add the URL
                segments.push({
                    type: 'url',
                    content: url
                });

                // Add EXTREME 10-second pause after URL for testing
                segments.push({
                    type: 'url_pause',
                    content: '10_SECOND_PAUSE',
                    pauseDuration: 10000
                });

                lastIndex = urlEnd;
            }

            // Add remaining text (if any)
            if (lastIndex < text.length) {
                const remainingText = text.substring(lastIndex);
                segments.push({
                    type: 'text',
                    content: remainingText
                });
            }

            return segments;
        },

        typeSegments: function(element, segments, delay, currentIndex) {
            if (currentIndex >= segments.length) {
                utils.debug('URL-aware typing completed', {
                    finalText: element.innerText,
                    totalSegments: segments.length
                });
                return;
            }

            const segment = segments[currentIndex];

            utils.debug(`Processing segment ${currentIndex + 1}/${segments.length}`, {
                type: segment.type,
                content: segment.content
            });

            if (segment.type === 'url_pause') {
                // EXTREME 10-second pause after URL for testing
                utils.debug('Starting 10-second pause after URL', {
                    pauseDuration: segment.pauseDuration,
                    currentText: element.innerText
                });

                // Continue with next segment after 10-second pause
                setTimeout(() => {
                    utils.debug('10-second pause completed, continuing with next segment');
                    this.typeSegments(element, segments, delay, currentIndex + 1);
                }, segment.pauseDuration);

            } else if (segment.type === 'linebreak') {
                // Add line break immediately (legacy - shouldn't be used with url_pause)
                element.innerText += segment.content;
                element.dispatchEvent(new Event('input', { bubbles: true }));

                utils.debug('Added line break');

                // Continue with next segment after a short pause
                setTimeout(() => {
                    this.typeSegments(element, segments, delay, currentIndex + 1);
                }, delay * 2);

            } else {
                // Type character by character for text and URLs
                this.typeSegmentCharacters(element, segment.content, delay, () => {
                    // Continue with next segment
                    this.typeSegments(element, segments, delay, currentIndex + 1);
                });
            }
        },

        typeSegmentCharacters: function(element, text, delay, callback) {
            let currentText = element.innerText;

            for (let i = 0; i < text.length; i++) {
                setTimeout(() => {
                    currentText += text[i];
                    element.innerText = currentText;
                    element.dispatchEvent(new Event('input', { bubbles: true }));

                    utils.debug(`Typed character: ${text[i]}`, {
                        position: i + 1,
                        total: text.length,
                        currentText: currentText
                    });

                    // Call callback when done
                    if (i === text.length - 1) {
                        setTimeout(callback, delay);
                    }
                }, i * delay);
            }
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



            // DEBUG TEST SYSTEM: Intercept debug commands in debug mode
            if (CONFIG.DEBUG_MODE && originalText.trim().startsWith('SlackPolish test')) {
                utils.debug('Debug test command detected', { command: originalText });
                return this.handleDebugTest(originalText.trim());
            }

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

                // DEBUG: Log the complete prompt to SlackPolish debug system
                utils.debug('FULL PROMPT SENT TO OPENAI', {
                    fullPrompt: prompt,
                    promptLength: prompt.length
                });

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

                    // EMERGENCY DEBUG: Log what we're about to return
                    console.log('🚨 DEBUG: About to return response:', {
                        responseLength: response.trim().length,
                        responsePreview: response.trim().substring(0, 100) + '...',
                        originalText: originalText,
                        promptLength: prompt.length,
                        promptPreview: prompt.substring(0, 100) + '...'
                    });

                    // FULL PROMPT DEBUG: Show the complete prompt being sent to OpenAI
                    console.log('🔍 FULL PROMPT SENT TO OPENAI:', prompt);

                    let processedResponse = response.trim();

                    // Remove any surrounding quotes that might have leaked through
                    if ((processedResponse.startsWith('"') && processedResponse.endsWith('"')) ||
                        (processedResponse.startsWith("'") && processedResponse.endsWith("'"))) {
                        processedResponse = processedResponse.slice(1, -1);
                        utils.debug('Removed surrounding quotes from response');
                    }

                    // Replace semicolons with periods and capitalize the next letter
                    const beforeSemicolonReplacement = processedResponse;
                    processedResponse = processedResponse.replace(/;\s*/g, function(match) {
                        return '. ';
                    });

                    // Capitalize first letter after each period
                    processedResponse = processedResponse.replace(/\.\s+([a-z])/g, function(match, letter) {
                        return '. ' + letter.toUpperCase();
                    });

                    if (beforeSemicolonReplacement !== processedResponse) {
                        utils.debug('Replaced semicolons with periods and capitalized', {
                            before: beforeSemicolonReplacement,
                            after: processedResponse
                        });
                    }

                    // Special post-processing for TONE_POLISH: simple empty line removal
                    if (CONFIG.STYLE === 'TONE_POLISH') {
                        // Simple approach: replace double newlines with single newlines
                        processedResponse = processedResponse.replace(/\n\n+/g, '\n');
                        utils.debug('Applied TONE_POLISH post-processing', {
                            originalResponse: response.trim(),
                            processedResponse: processedResponse,
                            removedExtraLineBreaks: response.trim() !== processedResponse
                        });
                    }

                    utils.debug('Text improvement successful', {
                        originalLength: originalText.length,
                        improvedLength: processedResponse.length,
                        originalText: originalText,
                        improvedText: processedResponse,
                        usedSharedModule: !!window.SlackPolishOpenAI
                    });
                    return processedResponse;
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

        handleDebugTest(originalText) {
            // Parse debug command: "SlackPolish test [command] [parameters...]"
            const parts = originalText.split(' ');

            // If just "SlackPolish test" with no command, show help
            if (parts.length === 2) {
                utils.debug('Debug test help requested');
                utils.showNotification('Debug Test Help - Check debug logs', 'info');
                return this.getDebugTestHelp();
            }

            if (parts.length < 3) {
                utils.debug('Invalid debug test command format', { originalText });
                utils.showNotification('Invalid test format. Use: SlackPolish test [command] [parameters]', 'error');
                return 'Invalid test command format. Use "SlackPolish test" for help.';
            }

            const command = parts[2]; // The command after "SlackPolish test"
            const parameters = parts.slice(3).join(' '); // Everything after the command

            utils.debug('Parsing debug test command', {
                command: command,
                parameters: parameters,
                fullCommand: originalText
            });

            switch (command.toLowerCase()) {
                case 'linktyping':
                    return this.testLinkTyping(parameters);

                case 'instantinsert':
                    return this.testInstantInsert(parameters);

                case 'multipleurls':
                    return this.testMultipleUrls(parameters);

                case 'timing':
                    return this.testTiming(parameters);

                case 'urllinebreak':
                    return this.testUrlLineBreak(parameters);

                default:
                    utils.debug('Unknown debug test command', { command });
                    utils.showNotification(`Unknown test command: ${command}`, 'error');
                    return `Unknown test command: ${command}. Available: linkTyping, instantInsert, multipleUrls, timing, urlLineBreak`;
            }
        },

        testLinkTyping(text) {
            if (!text.trim()) {
                return 'ERROR: No text provided for linkTyping test';
            }

            utils.debug('DEBUG TEST: linkTyping', { text });
            utils.showNotification('Debug Test: Link Typing - Check debug logs', 'info');

            // Return special marker for character-by-character typing
            return `[DEBUG_LINK_TYPING]${text}`;
        },

        testInstantInsert(text) {
            if (!text.trim()) {
                return 'ERROR: No text provided for instantInsert test';
            }

            utils.debug('DEBUG TEST: instantInsert', { text });
            utils.showNotification('Debug Test: Instant Insert - Check debug logs', 'info');

            // Return special marker for instant insertion
            return `[DEBUG_INSTANT_INSERT]${text}`;
        },

        testMultipleUrls(text) {
            if (!text.trim()) {
                return 'ERROR: No text provided for multipleUrls test';
            }

            utils.debug('DEBUG TEST: multipleUrls', { text });
            utils.showNotification('Debug Test: Multiple URLs - Check debug logs', 'info');

            // Return special marker for multiple URLs test
            return `[DEBUG_MULTIPLE_URLS]${text}`;
        },

        testTiming(parameters) {
            const parts = parameters.split(' ');
            if (parts.length < 2) {
                return 'ERROR: Timing test needs speed and text. Use: timing [fast|slow] [text]';
            }

            const speed = parts[0];
            const text = parts.slice(1).join(' ');

            if (!['fast', 'slow'].includes(speed.toLowerCase())) {
                return 'ERROR: Speed must be "fast" or "slow"';
            }

            utils.debug('DEBUG TEST: timing', { speed, text });
            utils.showNotification(`Debug Test: Timing (${speed}) - Check debug logs`, 'info');

            // Return special marker for timing test
            return `[DEBUG_TIMING_${speed.toUpperCase()}]${text}`;
        },

        testUrlLineBreak(text) {
            if (!text.trim()) {
                return 'ERROR: No text provided for urlLineBreak test';
            }

            utils.debug('DEBUG TEST: urlLineBreak', { text });
            utils.showNotification('Debug Test: URL Line Break - Check debug logs', 'info');

            // Return special marker for URL line break test
            return `[DEBUG_URL_LINEBREAK]${text}`;
        },

        getDebugTestHelp() {
            const helpText = `
🧪 SlackPolish Debug Test Commands
=====================================

Available test commands (use in debug mode only):

📝 BASIC TESTS:
• linkTyping [text]     - Simulate character-by-character typing
  Example: SlackPolish test linkTyping https://www.google.com

• instantInsert [text]  - Use current instant insertion method
  Example: SlackPolish test instantInsert Check https://google.com

🔗 URL TESTS:
• urlLineBreak [text]   - Smart URL detection with line breaks after URLs
  Example: SlackPolish test urlLineBreak Check https://google.com for info

• multipleUrls [text]   - Test multiple URLs in one message
  Example: SlackPolish test multipleUrls Visit https://google.com and https://amazon.com

⏱️ TIMING TESTS:
• timing fast [text]    - Fast typing simulation (50ms delay)
  Example: SlackPolish test timing fast https://google.com

• timing slow [text]    - Slow typing simulation (300ms delay)
  Example: SlackPolish test timing slow https://google.com

📋 HELP:
• Just type "SlackPolish test" to see this help menu

=====================================
💡 TIP: Watch the debug logs for detailed character-by-character progress!
            `.trim();

            utils.debug('Debug test help displayed', {
                availableCommands: ['linkTyping', 'instantInsert', 'urlLineBreak', 'multipleUrls', 'timing'],
                helpTextLength: helpText.length
            });

            return helpText;
        },

        async buildPrompt(text) {
            utils.debug('Building prompt', {
                textLength: text.length,
                style: CONFIG.STYLE,
                language: CONFIG.LANGUAGE,
                hasCustomInstructions: !!CONFIG.CUSTOM_INSTRUCTIONS,
                smartContextEnabled: CONFIG.SMART_CONTEXT?.enabled
            });

            let prompt = `You are helping improve a Slack message.`;

            // Add Smart Context if enabled (but skip for TONE_POLISH to avoid formatting confusion)
            if (CONFIG.SMART_CONTEXT && CONFIG.SMART_CONTEXT.enabled && CONFIG.STYLE !== 'TONE_POLISH') {
                try {
                    const contextMessages = await this.getSmartContext();
                    if (contextMessages && contextMessages.length > 0) {
                        prompt += ` Here is the conversation context for reference:

Recent conversation context (last ${contextMessages.length} messages):
`;
                        contextMessages.forEach((msg, index) => {
                            const user = CONFIG.SMART_CONTEXT.privacyMode ? `User${index + 1}` : (msg.user || 'Unknown');
                            const msgText = CONFIG.SMART_CONTEXT.privacyMode ? this.anonymizeText(msg.text) : msg.text;
                            prompt += `${user}: ${msgText}\n`;
                        });

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

            // Get detailed prompt from config if available
            let styleInstruction = `please improve ONLY the following message to be more ${CONFIG.STYLE} in ${CONFIG.LANGUAGE}`;

            if (window.SLACKPOLISH_CONFIG && window.SLACKPOLISH_CONFIG.PROMPTS && window.SLACKPOLISH_CONFIG.PROMPTS.STYLES) {
                const detailedPrompt = window.SLACKPOLISH_CONFIG.PROMPTS.STYLES[CONFIG.STYLE];
                if (detailedPrompt) {
                    styleInstruction = detailedPrompt;
                }
            }

            prompt += `

${styleInstruction}:

${text}

IMPORTANT: Respond with ONLY the improved text. Do not include any explanations, quotes, requirements, or additional text. Use ${CONFIG.LANGUAGE} language. Do NOT reference the conversation context.`;

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

                // Check if user is currently focused in a thread
                const isInThreadInput = this.isUserInThreadInput();
                let result = null;

                if (isInThreadInput) {
                    utils.debug('User is in thread input - fetching thread context');
                    try {
                        result = await this.getThreadContext(5);
                    } catch (threadError) {
                        utils.debug('Thread context fetching failed, falling back to channel context', {
                            error: threadError.message
                        });
                        // Fall back to regular channel context if thread context fails
                        result = await this.getChannelContext(5);
                    }
                } else {
                    utils.debug('User is in main channel - fetching channel context');
                    result = await this.getChannelContext(5);
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
                        timestamp: msg.timestamp,
                        isThreadReply: msg.isThreadReply || false
                    }))
                    .slice(-5); // Ensure we only get last 5

                utils.debug('Smart context messages prepared', {
                    totalMessages: result.messages.length,
                    contextMessages: contextMessages.length,
                    contextType: isInThreadInput ? 'thread' : 'channel',
                    channelId: result.channelId,
                    channelName: result.channelName,
                    threadTs: result.threadTs || null,
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

        isUserInThreadInput() {
            // Check if the currently focused element is in a thread
            const activeElement = document.activeElement;
            if (!activeElement || !activeElement.isContentEditable) {
                return false;
            }

            // Check if the focused element is inside a thread container
            const threadContainer = activeElement.closest('.p-thread_view, .p-threads_view, [data-qa*="thread"]');
            const isInThread = !!threadContainer;

            utils.debug('Checking if user is in thread input', {
                hasActiveElement: !!activeElement,
                isContentEditable: activeElement?.isContentEditable,
                hasThreadContainer: !!threadContainer,
                isInThread
            });

            return isInThread;
        },

        async getChannelContext(count = 5) {
            // Get context from main channel (existing behavior)
            let result = null;
            try {
                result = await window.SlackPolishChannelMessages.getRecentMessages(count);
            } catch (apiError) {
                utils.debug('API-based channel message fetching failed, trying DOM fallback', {
                    error: apiError.message
                });

                // Fallback to DOM-based extraction
                try {
                    result = await window.SlackPolishChannelMessages.getRecentMessagesFromDOM(count);
                } catch (domError) {
                    utils.debug('DOM fallback also failed', {
                        error: domError.message
                    });
                    throw domError;
                }
            }
            return result;
        },

        async getThreadContext(count = 5) {
            // Get context from thread conversation
            utils.debug('Fetching thread context');

            // Extract thread timestamp from URL or DOM
            const threadTs = this.getCurrentThreadTs();
            if (!threadTs) {
                throw new Error('Could not determine thread timestamp');
            }

            const channelId = window.SlackPolishChannelMessages.getCurrentChannelId();
            if (!channelId) {
                throw new Error('Could not determine channel ID');
            }

            utils.debug('Thread context parameters', { threadTs, channelId });

            // Try to get thread messages via API first
            try {
                const threadResponse = await window.SlackPolishChannelMessages.callSlackAPI('conversations.replies', {
                    channel: channelId,
                    ts: threadTs,
                    limit: count + 1 // +1 because first message is the parent
                });

                if (threadResponse.ok && threadResponse.messages) {
                    const messages = threadResponse.messages.map(msg =>
                        window.SlackPolishChannelMessages.processSlackMessage(msg)
                    );

                    return {
                        channelId,
                        channelName: window.SlackPolishChannelMessages.getCurrentChannelName(),
                        threadTs,
                        messages,
                        totalReturned: messages.length,
                        method: 'API-Thread',
                        fetchedAt: new Date().toISOString()
                    };
                }
            } catch (apiError) {
                utils.debug('Thread API call failed, trying DOM fallback', {
                    error: apiError.message
                });
            }

            // Fallback to DOM-based thread extraction
            return this.getThreadContextFromDOM(count, threadTs, channelId);
        },

        getCurrentThreadTs() {
            // Method 1: Extract from URL
            const urlMatch = window.location.href.match(/\/thread\/p(\d+)/);
            if (urlMatch && urlMatch[1]) {
                // Convert p-format timestamp to regular timestamp
                const pTimestamp = urlMatch[1];
                const timestamp = pTimestamp.substring(0, 10) + '.' + pTimestamp.substring(10);
                utils.debug('Thread timestamp from URL', { pTimestamp, timestamp });
                return timestamp;
            }

            // Method 2: Look for thread timestamp in DOM
            const threadContainer = document.querySelector('.p-thread_view, .p-threads_view, [data-qa*="thread"]');
            if (threadContainer) {
                // Look for timestamp attributes in thread container
                const timestampElement = threadContainer.querySelector('[data-ts]');
                if (timestampElement) {
                    const timestamp = timestampElement.getAttribute('data-ts');
                    utils.debug('Thread timestamp from DOM', { timestamp });
                    return timestamp;
                }
            }

            utils.debug('Could not determine thread timestamp');
            return null;
        },

        async getThreadContextFromDOM(count, threadTs, channelId) {
            // Extract thread messages from DOM as fallback
            utils.debug('Extracting thread context from DOM');

            const threadContainer = document.querySelector('.p-thread_view, .p-threads_view, [data-qa*="thread"]');
            if (!threadContainer) {
                throw new Error('Thread container not found in DOM');
            }

            const messages = [];
            const messageElements = threadContainer.querySelectorAll('[data-qa="virtual_list_item"], .c-message_kit__message, [role="listitem"]');

            for (const element of messageElements) {
                try {
                    const messageData = window.SlackPolishChannelMessages.extractMessageData(element);
                    if (messageData && messageData.text) {
                        messages.push({
                            ...messageData,
                            isThreadReply: true
                        });
                    }
                } catch (error) {
                    utils.debug('Error extracting thread message from DOM element', {
                        error: error.message
                    });
                }
            }

            // Take the most recent messages up to count
            const recentMessages = messages.slice(-count);

            return {
                channelId,
                channelName: window.SlackPolishChannelMessages.getCurrentChannelName(),
                threadTs,
                messages: recentMessages,
                totalReturned: recentMessages.length,
                method: 'DOM-Thread',
                fetchedAt: new Date().toISOString()
            };
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
                max_tokens: window.SLACKPOLISH_CONFIG?.OPENAI_MAX_TOKENS || 500,
                temperature: window.SLACKPOLISH_CONFIG?.OPENAI_TEMPERATURE || 0.7
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
    let currentFocusListener = null;
    let currentBlurListener = null;

    // Event handlers
    function setupEventListeners() {
        const setupId = Date.now(); // Unique ID for this setup call
        utils.log(`Setting up ${CONFIG.HOTKEY} event listener (setup-id: ${setupId})`);

        // Enhanced cleanup with defensive programming
        try {
            if (currentKeydownListener) {
                document.removeEventListener('keydown', currentKeydownListener);
                utils.debug('Removed previous keydown listener', { setupId });
            }
            if (currentKeyupListener) {
                document.removeEventListener('keyup', currentKeyupListener);
                utils.debug('Removed previous keyup listener', { setupId });
            }
            if (currentFocusListener) {
                window.removeEventListener('focus', currentFocusListener);
                utils.debug('Removed previous focus listener', { setupId });
            }
            if (currentBlurListener) {
                window.removeEventListener('blur', currentBlurListener);
                utils.debug('Removed previous blur listener', { setupId });
            }
        } catch (error) {
            utils.log(`Warning: Error during event listener cleanup: ${error.message}`);
            utils.debug('Event listener cleanup error', {
                error: error.message,
                setupId,
                hadKeydownListener: !!currentKeydownListener,
                hadKeyupListener: !!currentKeyupListener,
                hadFocusListener: !!currentFocusListener,
                hadBlurListener: !!currentBlurListener
            });
        }

        // Clear references to prevent memory leaks
        currentKeydownListener = null;
        currentKeyupListener = null;
        currentFocusListener = null;
        currentBlurListener = null;

        const hotkey = parseHotkey(CONFIG.HOTKEY);
        utils.debug('Parsed hotkey configuration', {
            hotkey: CONFIG.HOTKEY,
            parsed: hotkey,
            setupId
        });

        let isProcessing = false; // Flag to prevent double-triggers
        let lastSuccessfulTriggerTime = 0;
        const MIN_TRIGGER_INTERVAL = 500; // Minimum 500ms between successful triggers
        let hotkeyPressedOnce = false; // Track if hotkey was already detected in this key sequence

        // Helper function to check if hotkey matches using native browser properties
        // This is more reliable than manually tracking key states
        function checkHotkeyMatch(event) {
            // For Tab key, we need to check both the key and the modifiers
            if (hotkey.tab) {
                return event.key === 'Tab' &&
                       event.ctrlKey === hotkey.ctrl &&
                       event.shiftKey === hotkey.shift &&
                       event.altKey === hotkey.alt;
            }

            // For modifier-only combinations (Ctrl+Shift, Ctrl+Alt)
            // Check that the event is a modifier key press and all required modifiers are active
            const isModifierKey = ['Control', 'Shift', 'Alt'].includes(event.key);
            if (!isModifierKey) {
                return false; // Not a modifier key, can't be our hotkey
            }

            return event.ctrlKey === hotkey.ctrl &&
                   event.shiftKey === hotkey.shift &&
                   event.altKey === hotkey.alt &&
                   !hotkey.tab; // Tab should not be part of modifier-only combos
        }

        // Dynamic keydown handler using native browser key state properties
        currentKeydownListener = function(event) {
            const hotkeyMatch = checkHotkeyMatch(event);

            // Enhanced debug logging for hotkey detection
            if (hotkeyMatch || event.ctrlKey || event.shiftKey || event.altKey) {
                utils.debug('Hotkey state check', {
                    eventKey: event.key,
                    eventState: {
                        ctrlKey: event.ctrlKey,
                        shiftKey: event.shiftKey,
                        altKey: event.altKey,
                        key: event.key
                    },
                    required: hotkey,
                    match: hotkeyMatch,
                    isProcessing,
                    hotkeyPressedOnce,
                    setupId
                });
            }

            if (hotkeyMatch) {
                // Prevent Tab from changing focus if it's part of the hotkey
                if (hotkey.tab) {
                    event.preventDefault();
                }

                // Prevent multiple triggers from the same key sequence
                // (e.g., when both Ctrl and Shift fire keydown events)
                if (hotkeyPressedOnce) {
                    utils.debug('Hotkey already detected in this sequence, ignoring duplicate', { setupId });
                    return;
                }

                // Prevent triggering while already processing
                if (isProcessing) {
                    utils.debug('Already processing a trigger, ignoring new hotkey press', { setupId });
                    return;
                }

                const now = Date.now();

                // Rate limiting - only apply to successful triggers
                // This allows rapid retries if the previous attempt failed
                if (now - lastSuccessfulTriggerTime < MIN_TRIGGER_INTERVAL) {
                    utils.debug('Hotkey trigger rate limited', {
                        timeSinceLastTrigger: now - lastSuccessfulTriggerTime,
                        minInterval: MIN_TRIGGER_INTERVAL,
                        setupId
                    });
                    return;
                }

                // Mark that we've detected the hotkey in this sequence
                hotkeyPressedOnce = true;

                utils.log(`${CONFIG.HOTKEY} combination pressed - triggering text improvement (setup-id: ${setupId})`);

                // Trigger immediately without debounce delay
                // This makes fast presses work reliably
                isProcessing = true;
                (async () => {
                    try {
                        utils.log(`${CONFIG.HOTKEY} triggered - starting text improvement (setup-id: ${setupId})`);
                        await triggerTextImprovement();
                        // Only update lastSuccessfulTriggerTime after successful completion
                        lastSuccessfulTriggerTime = Date.now();
                    } catch (error) {
                        utils.log(`Error in hotkey trigger: ${error.message}`);
                        utils.debug('Hotkey trigger error', {
                            error: error.message,
                            stack: error.stack,
                            setupId
                        });
                    } finally {
                        isProcessing = false;
                    }
                })();
            }
        };

        document.addEventListener('keydown', currentKeydownListener);

        // Dynamic keyup handler - reset the sequence flag when keys are released
        currentKeyupListener = function(event) {
            const isRequiredKey =
                (hotkey.ctrl && event.key === 'Control') ||
                (hotkey.shift && event.key === 'Shift') ||
                (hotkey.alt && event.key === 'Alt') ||
                (hotkey.tab && event.key === 'Tab');

            if (isRequiredKey) {
                // Reset the flag so the next key sequence can trigger
                hotkeyPressedOnce = false;
                utils.debug('Required key released, reset sequence flag', {
                    releasedKey: event.key,
                    setupId
                });
            }
        };

        document.addEventListener('keyup', currentKeyupListener);

        // Focus/blur listeners to reset state when window loses/regains focus
        // This prevents stuck key states when user switches windows
        currentFocusListener = function(event) {
            hotkeyPressedOnce = false;
            utils.debug('Window focus changed, reset sequence flag', { setupId });
        };

        currentBlurListener = function(event) {
            hotkeyPressedOnce = false;
            utils.debug('Window blur, reset sequence flag', { setupId });
        };

        window.addEventListener('focus', currentFocusListener);
        window.addEventListener('blur', currentBlurListener);

        // Log successful setup completion
        utils.log(`Event listeners registered successfully for ${CONFIG.HOTKEY} (setup-id: ${setupId})`);
        utils.debug('Event listener setup completed', {
            hotkey: CONFIG.HOTKEY,
            parsedHotkey: hotkey,
            setupId,
            hasKeydownListener: !!currentKeydownListener,
            hasKeyupListener: !!currentKeyupListener,
            hasFocusListener: !!currentFocusListener,
            hasBlurListener: !!currentBlurListener,
            minTriggerInterval: MIN_TRIGGER_INTERVAL
        });

        async function triggerTextImprovement() {
            const triggerCallId = Date.now();
            const callStack = new Error().stack;

            utils.debug('triggerTextImprovement() called', {
                triggerCallId,
                isProcessing: textImprover.isProcessing,
                debugMode: CONFIG.DEBUG_MODE,
                setupId,
                callStack: callStack?.split('\n').slice(0, 5).join('\n') // First 5 lines of stack trace
            });

            // Enhanced processing check with better logging
            if (textImprover.isProcessing) {
                utils.log('Text improvement already in progress - aborting new request');
                utils.debug('Already processing, aborting', {
                    isProcessing: true,
                    triggerCallId,
                    setupId
                });
                utils.showNotification('Already processing text...', 'error');
                return;
            }

            const messageInput = utils.findMessageInput();
            if (!messageInput) {
                utils.log('No message input found - cannot proceed with text improvement');
                utils.debug('Message input not found', {
                    messageInput: null,
                    triggerCallId,
                    setupId,
                    activeElement: document.activeElement?.tagName,
                    activeElementClass: document.activeElement?.className
                });
                utils.showNotification('No message input found', 'error');
                return;
            }

            utils.debug('Message input found', {
                tagName: messageInput.tagName,
                className: messageInput.className,
                id: messageInput.id,
                triggerCallId,
                setupId
            });

            // Capture selection info BEFORE getting text (selection might be lost during async operations)
            const selectionInfo = utils.getSelectionInfo(messageInput);
            const originalText = utils.getTextFromElement(messageInput);

            utils.log(`Processing text improvement for: "${originalText}" (trigger-id: ${triggerCallId})`);
            utils.debug('Selection info captured', {
                hasSelection: selectionInfo.hasSelection,
                selectedText: selectionInfo.hasSelection ? selectionInfo.selectedText : 'none',
                selectionLength: selectionInfo.hasSelection ? selectionInfo.selectedText.length : 0,
                fullTextLength: originalText.length,
                triggerCallId
            });

            if (!originalText.trim()) {
                utils.log('No text to improve - input is empty or whitespace only');
                utils.debug('No text to improve', {
                    originalText,
                    triggerCallId,
                    setupId
                });
                utils.showNotification('No text to improve', 'error');
                return;
            }

            utils.log(`Starting text improvement process (trigger-id: ${triggerCallId})`);
            const improvedText = await textImprover.improveText(originalText);

            if (improvedText) {
                // Add emoji signature if enabled
                let finalText = improvedText;
                if (CONFIG.ADD_EMOJI_SIGNATURE) {
                    finalText = improvedText + ' :slack_polish:';
                }

                utils.log(`Text improvement completed successfully (trigger-id: ${triggerCallId})`);
                utils.debug('Setting improved text', {
                    originalText: originalText,
                    improvedText: improvedText,
                    finalText: finalText,
                    finalTextLength: finalText.length,
                    emojiSignatureEnabled: CONFIG.ADD_EMOJI_SIGNATURE,
                    lengthChange: finalText.length - originalText.length,
                    triggerCallId,
                    setupId
                });

                utils.setTextInElement(messageInput, finalText, selectionInfo);
            } else {
                utils.log(`Text improvement failed - no improved text received (trigger-id: ${triggerCallId})`);
                utils.debug('No improved text received', {
                    improvedText,
                    triggerCallId,
                    setupId
                });
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
                    // Try to get channel name from various DOM elements (2025 enhanced selectors)
                    const channelNameSelectors = [
                        // 2025 Modern Slack selectors (most likely to work)
                        '[data-qa="channel_header_name"]',
                        '[data-qa="channel-name"]',
                        '[data-qa="channel_name"]',
                        '[data-qa="channel_header"] [data-qa="channel_name"]',
                        '[data-qa="channel_header"] h1',
                        '[data-qa="dm_header"] h1',
                        '[data-qa="channel_header"] span',
                        '[data-qa="channel_header"] button span',

                        // Header title selectors
                        '.p-view_header__channel_title',
                        '.p-channel_header__name',
                        '.p-channel_header__title',
                        '[data-qa="channel_header"] .p-channel_header__title',
                        '.p-view_header__title',
                        '.p-view_header__breadcrumbs',

                        // New 2025 selectors (common patterns)
                        'h1[data-qa*="channel"]',
                        'span[data-qa*="channel"]',
                        'button[data-qa*="channel"] span',
                        '[class*="channel_header"] h1',
                        '[class*="channel_header"] span',
                        '[class*="view_header"] h1',
                        '[class*="view_header"] span',

                        // Sidebar selectors
                        '.p-channel_sidebar__name--selected',
                        '.c-channel_entity__name',

                        // Generic header selectors
                        'header h1',
                        '[role="banner"] h1',
                        '.c-view_header h1',
                        'main h1',
                        'section h1'
                    ];

                    // Add enhanced debugging
                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', `🔍 Starting channel name detection with ${channelNameSelectors.length} selectors...`);

                        // Show sample of available header elements
                        const headerElements = document.querySelectorAll('header, [data-qa*="header"], [class*="header"], h1, h2, h3');
                        const headerSample = Array.from(headerElements).slice(0, 3).map(el => ({
                            tag: el.tagName,
                            class: el.className.substring(0, 30),
                            dataQa: el.getAttribute('data-qa'),
                            text: el.textContent?.trim().substring(0, 20)
                        }));

                        window.SlackPolishDebug.addLog('channel-messages', `🔍 Found ${headerElements.length} header elements. Sample:`, headerSample);
                    }

                    for (let i = 0; i < channelNameSelectors.length; i++) {
                        const selector = channelNameSelectors[i];
                        const element = document.querySelector(selector);
                        const hasText = element ? !!element.textContent?.trim() : false;
                        const text = element ? element.textContent?.trim() : null;

                        if (window.SlackPolishDebug && (element || i < 5)) { // Log first 5 attempts or any found elements
                            window.SlackPolishDebug.addLog('channel-messages', `🔍 Selector ${i + 1}/${channelNameSelectors.length}: ${selector}`, {
                                found: !!element,
                                hasText: hasText,
                                text: text?.substring(0, 30)
                            });
                        }

                        if (element && hasText) {
                            const channelName = text.trim();
                            if (window.SlackPolishDebug) {
                                window.SlackPolishDebug.addLog('channel-messages', `✅ SUCCESS: Channel name found: "${channelName}" using selector: ${selector}`);
                            }
                            return channelName;
                        }
                    }

                    if (window.SlackPolishDebug) {
                        window.SlackPolishDebug.addLog('channel-messages', '❌ Could not determine channel name from any selector');
                        window.SlackPolishDebug.addLog('channel-messages', 'Trying URL fallback...');

                        // Try URL extraction as fallback
                        const currentUrl = window.location.href;
                        const urlMatch = currentUrl.match(/\/client\/[^\/]+\/([^\/\?]+)/);
                        if (urlMatch && urlMatch[1]) {
                            const channelId = urlMatch[1];
                            let channelName = 'Unknown Channel';

                            if (channelId.startsWith('C')) {
                                channelName = `#${channelId}`;
                            } else if (channelId.startsWith('D')) {
                                channelName = 'Direct Message';
                            } else {
                                channelName = channelId;
                            }

                            window.SlackPolishDebug.addLog('channel-messages', `✅ SUCCESS: Using URL-based channel name: "${channelName}"`);
                            return channelName;
                        } else {
                            window.SlackPolishDebug.addLog('channel-messages', '❌ URL extraction also failed');
                        }
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

                    // Get timestamp - enhanced selectors for current Slack DOM
                    const timestampSelectors = [
                        '[data-ts]',
                        '.c-timestamp',
                        '[data-qa="message_timestamp"]',
                        '.c-message__timestamp',
                        'time',
                        '[datetime]',
                        '.c-message_kit__timestamp',
                        '.p-message_pane__message__timestamp',
                        '.c-message_attachment__timestamp'
                    ];

                    for (const selector of timestampSelectors) {
                        const timestampElement = element.querySelector(selector);
                        if (timestampElement) {
                            let ts = timestampElement.getAttribute('data-ts');
                            if (!ts && timestampElement.getAttribute('datetime')) {
                                // Convert datetime to timestamp
                                ts = (new Date(timestampElement.getAttribute('datetime')).getTime() / 1000).toString();
                            }
                            if (!ts && timestampElement.textContent) {
                                // Try to parse text content as time
                                const timeText = timestampElement.textContent.trim();
                                const timeMatch = timeText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
                                if (timeMatch) {
                                    const today = new Date();
                                    const [time, period] = timeMatch[1].split(/\s*(AM|PM)/i);
                                    const [hours, minutes] = time.split(':').map(Number);

                                    let hour24 = hours;
                                    if (period && period.toUpperCase() === 'PM' && hours !== 12) {
                                        hour24 += 12;
                                    } else if (period && period.toUpperCase() === 'AM' && hours === 12) {
                                        hour24 = 0;
                                    }

                                    const timestamp = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour24, minutes);
                                    ts = (timestamp.getTime() / 1000).toString();
                                }
                            }
                            if (ts) {
                                messageData.timestamp = new Date(parseFloat(ts) * 1000).toISOString();
                                break;
                            }
                        }
                    }

                    // If still no timestamp, try to extract from element's text content (fallback for DMs)
                    if (!messageData.timestamp) {
                        const textContent = element.textContent || '';
                        const timeMatch = textContent.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
                        if (timeMatch) {
                            const today = new Date();
                            const [time, period] = timeMatch[1].split(/\s*(AM|PM)/i);
                            const [hours, minutes] = time.split(':').map(Number);

                            let hour24 = hours;
                            if (period && period.toUpperCase() === 'PM' && hours !== 12) {
                                hour24 += 12;
                            } else if (period && period.toUpperCase() === 'AM' && hours === 12) {
                                hour24 = 0;
                            }

                            const timestamp = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour24, minutes);
                            messageData.timestamp = timestamp.toISOString();
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

                    // If no user found, try to extract from text content (fallback for DMs)
                    if (!messageData.user) {
                        const textContent = element.textContent || '';
                        // Look for patterns like "Eyal Boumgarten (you)" or "John Smith"
                        const userMatch = textContent.match(/^([^0-9]+?)(?:\s*\(you\))?\s*\d{1,2}:\d{2}/);
                        if (userMatch) {
                            messageData.user = userMatch[1].trim();
                        } else {
                            // Try to find any name-like pattern at the beginning
                            const nameMatch = textContent.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
                            if (nameMatch) {
                                messageData.user = nameMatch[1].trim();
                            }
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
                        max_tokens: options.maxTokens || window.SLACKPOLISH_CONFIG?.OPENAI_MAX_TOKENS || 500,
                        temperature: options.temperature || window.SLACKPOLISH_CONFIG?.OPENAI_TEMPERATURE || 0.7
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
                        <button id="copy-debug" style="background: none; border: 1px solid white; color: white; cursor: pointer; font-size: 12px; margin-right: 8px; padding: 2px 6px; border-radius: 3px;">📋 Copy</button>
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

                // Add copy functionality
                header.querySelector('#copy-debug').addEventListener('click', () => {
                    this.copyLogsToClipboard();
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
            },

            copyLogsToClipboard: function() {
                if (this.logs.length === 0) {
                    // Show temporary notification
                    this.showCopyNotification('No logs to copy', 'warning');
                    return;
                }

                // Format logs for copying
                const formattedLogs = this.logs.map(log => {
                    let logText = `[${log.timestamp}] ${log.source.toUpperCase()}: ${log.message}`;
                    if (log.data) {
                        logText += `\n${log.data}`;
                    }
                    return logText;
                }).join('\n\n');

                // Add header information
                const header = `SlackPolish Debug Logs (${this.logs.length} entries)\n` +
                              `Generated: ${new Date().toLocaleString()}\n` +
                              `${'='.repeat(50)}\n\n`;

                const fullText = header + formattedLogs;

                // Copy to clipboard
                navigator.clipboard.writeText(fullText).then(() => {
                    this.showCopyNotification('Debug logs copied to clipboard!', 'success');
                }).catch(err => {
                    console.error('Failed to copy logs:', err);
                    this.showCopyNotification('Failed to copy logs', 'error');
                });
            },

            showCopyNotification: function(message, type) {
                // Create temporary notification
                const notification = document.createElement('div');
                notification.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: ${type === 'success' ? '#2eb67d' : type === 'warning' ? '#ecb22e' : '#e01e5a'};
                    color: white;
                    padding: 12px 20px;
                    border-radius: 6px;
                    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                    font-size: 13px;
                    font-weight: bold;
                    z-index: 10002;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    animation: fadeInOut 2s ease-in-out;
                `;

                // Add CSS animation
                if (!document.querySelector('#copy-notification-style')) {
                    const style = document.createElement('style');
                    style.id = 'copy-notification-style';
                    style.textContent = `
                        @keyframes fadeInOut {
                            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                            20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                            80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                            100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                        }
                    `;
                    document.head.appendChild(style);
                }

                notification.textContent = message;
                document.body.appendChild(notification);

                // Remove after animation
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 2000);
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
        // Debouncing variables to prevent multiple rapid re-registrations
        let settingsUpdateTimeout = null;
        let settingsUpdateCount = 0;

        // Unified settings update handler with debouncing
        function handleSettingsUpdate(source, eventKey = null) {
            settingsUpdateCount++;
            const updateId = settingsUpdateCount;

            utils.debug('Settings update triggered', {
                source,
                eventKey,
                updateId,
                currentHotkey: CONFIG.HOTKEY,
                currentDebugMode: CONFIG.DEBUG_MODE
            });

            // Cancel any pending update to prevent multiple rapid calls
            if (settingsUpdateTimeout) {
                clearTimeout(settingsUpdateTimeout);
                utils.debug('Cancelled previous settings update', { updateId: updateId - 1 });
            }

            // Schedule update after brief delay to allow multiple events to settle
            settingsUpdateTimeout = setTimeout(() => {
                try {
                    utils.log(`Processing settings update (source: ${source}, id: ${updateId})`);

                    // Store old values for comparison
                    const oldHotkey = CONFIG.HOTKEY;
                    const oldDebugMode = CONFIG.DEBUG_MODE;
                    const oldSmartContext = CONFIG.SMART_CONTEXT?.enabled;

                    // Load new settings
                    loadSettings();

                    // Track what changed
                    const changes = {
                        hotkey: oldHotkey !== CONFIG.HOTKEY,
                        debugMode: oldDebugMode !== CONFIG.DEBUG_MODE,
                        smartContext: oldSmartContext !== CONFIG.SMART_CONTEXT?.enabled
                    };

                    utils.debug('Settings comparison', {
                        oldHotkey,
                        newHotkey: CONFIG.HOTKEY,
                        oldDebugMode,
                        newDebugMode: CONFIG.DEBUG_MODE,
                        oldSmartContext,
                        newSmartContext: CONFIG.SMART_CONTEXT?.enabled,
                        changes
                    });

                    // Only re-setup event listeners if hotkey actually changed
                    if (changes.hotkey) {
                        utils.log(`Hotkey changed from "${oldHotkey}" to "${CONFIG.HOTKEY}" - re-setting up listeners (source: ${source})`);
                        setupEventListeners();
                    } else {
                        utils.debug('Hotkey unchanged, skipping event listener re-setup', {
                            hotkey: CONFIG.HOTKEY
                        });
                    }

                    // Update global debug system if debug mode changed
                    if (changes.debugMode && window.SlackPolishDebug) {
                        window.SlackPolishDebug.setEnabled(CONFIG.DEBUG_MODE);
                        utils.log(`Debug mode ${CONFIG.DEBUG_MODE ? 'enabled' : 'disabled'} (source: ${source})`);
                    }

                    // Log Smart Context changes
                    if (changes.smartContext) {
                        utils.log(`Smart Context ${CONFIG.SMART_CONTEXT?.enabled ? 'enabled' : 'disabled'} (source: ${source})`);
                    }

                    utils.log(`Settings update completed successfully (source: ${source}, id: ${updateId})`);

                } catch (error) {
                    utils.log(`Error processing settings update: ${error.message}`);
                    utils.debug('Settings update error details', {
                        error: error.message,
                        stack: error.stack,
                        source,
                        updateId
                    });
                } finally {
                    settingsUpdateTimeout = null;
                }
            }, 150); // 150ms debounce delay to handle rapid multiple events
        }

        // Listen for localStorage changes from the settings script
        window.addEventListener('storage', function(e) {
            if (e.key === 'slackpolish_settings' || e.key === 'slackpolish_openai_api_key') {
                handleSettingsUpdate('storage', e.key);
            }
        });

        // Also listen for custom events (for same-tab updates)
        window.addEventListener('slackpolish-settings-updated', function() {
            handleSettingsUpdate('custom-event');
        });

        utils.log('Real-time settings listener initialized with debouncing');
        utils.debug('Settings listener configuration', {
            debounceDelay: 150,
            monitoredKeys: ['slackpolish_settings', 'slackpolish_openai_api_key'],
            customEvent: 'slackpolish-settings-updated'
        });
    }

    // Start the application
    init();

})();
