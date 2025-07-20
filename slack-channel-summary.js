// === SLACK TEXT IMPROVER INJECTION START ===
// SlackPolish Channel Summary - Independent Channel Summary Management
// This script handles the channel summary interface separately from the main text improver

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
                const settings = SlackChannelSummary.loadSettings();
                if (settings.debugMode && window.SlackPolishDebug) {
                    console.log(`🐛 SLACKPOLISH DEBUG: ${message}`, data || '');
                    window.SlackPolishDebug.addLog('channel-summary', message, data);
                }
            } catch (e) {
                // Fallback to console if settings not available yet
                console.log(`🐛 SLACKPOLISH DEBUG: ${message}`, data || '');
            }
        }
    };

    // Channel Summary management
    const SlackChannelSummary = {
        // Default settings (only what's needed for channel summary)
        defaultSettings: {
            debugMode: false,
            apiKey: ''
        },

        // Load settings from localStorage (only what's needed for channel summary)
        loadSettings: function() {
            try {
                const savedSettings = localStorage.getItem('slackpolish_settings');
                const savedApiKey = localStorage.getItem('slackpolish_openai_api_key');

                let settings = { ...this.defaultSettings };

                if (savedSettings) {
                    const parsed = JSON.parse(savedSettings);
                    // Only extract debugMode from saved settings
                    if (parsed.debugMode !== undefined) {
                        settings.debugMode = parsed.debugMode;
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

        // Show channel summary window
        showChannelSummary: function() {
            // Remove existing window if present
            const existingWindow = document.getElementById('slackpolish-channel-summary-window');
            if (existingWindow) {
                existingWindow.remove();
                return;
            }

            const summaryWindow = document.createElement('div');
            summaryWindow.id = 'slackpolish-channel-summary-window';

            summaryWindow.innerHTML = this.createChannelSummaryHTML();
            document.body.appendChild(summaryWindow);

            // Add logo to summary window
            const logoContainer = summaryWindow.querySelector('#channel-summary-logo');
            if (logoContainer) {
                logoContainer.appendChild(this.createLogo(48));
            }

            // Add event listeners
            this.setupSummaryEventListeners(summaryWindow);
        },

        // Create the channel summary HTML
        createChannelSummaryHTML: function() {
            return `
                <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center;">
                    <div style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); font-family: Arial, sans-serif; width: 700px; max-height: 90vh; overflow-y: auto;">

                        <!-- Header -->
                        <div style="display: flex; align-items: center; margin-bottom: 20px; padding: 12px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 8px; border: 1px solid #dee2e6;">
                            <div style="background: white; border-radius: 8px; padding: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-right: 16px; display: flex; align-items: center; justify-content: center;" id="channel-summary-logo">
                            </div>
                            <div style="flex: 1;">
                                <div style="font-weight: bold; font-size: 18px; color: #2c3e50; margin-bottom: 4px;">SlackPolish Channel Summary</div>
                                <div style="font-size: 13px; color: #6c757d;">AI-powered channel summarization</div>
                            </div>
                        </div>

                        <!-- Time Range and Summary Level Selection (Side by Side) -->
                        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
                            <div style="flex: 1;">
                                <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">📅 Time Range:</label>
                                <select id="time-range-select" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box; background: white;">
                                    <option value="1">24 hours</option>
                                    <option value="7" selected>7 days</option>
                                    <option value="30">30 days</option>
                                    <option value="all">Entire channel</option>
                                </select>
                            </div>
                            <div style="flex: 1;">
                                <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">📊 Summary Level:</label>
                                <select id="summary-level-select" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box; background: white;">
                                    <option value="executive" selected>📋 Executive Summary</option>
                                    <option value="comprehensive">📚 Comprehensive</option>
                                </select>
                            </div>
                        </div>

                        <!-- Summary Text Area -->
                        <div style="margin-bottom: 12px;">
                            <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 13px;">📝 Channel Summary:</label>
                            <textarea id="summary-textbox" placeholder="Channel summary will appear here..." style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box; height: 250px; resize: vertical; font-family: inherit;"></textarea>
                        </div>

                        <!-- Action Buttons -->
                        <div style="text-align: right; margin-top: 15px;">
                            <button id="generate-summary-btn" style="padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; margin-left: 8px; border: none; background: #007a5a; color: white;">🔍 Generate Summary</button>
                            <button id="copy-summary-btn" style="padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; margin-left: 8px; border: 1px solid #ddd; background: #f8f8f8; color: #333;">📋 Copy</button>
                            <button id="close-summary-btn" style="padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; margin-left: 8px; border: 1px solid #ddd; background: #f8f8f8; color: #333;">✕ Close</button>
                        </div>
                    </div>
                </div>
            `;
        },

        // Setup event listeners for the summary window
        setupSummaryEventListeners: function(summaryWindow) {
            const generateBtn = summaryWindow.querySelector('#generate-summary-btn');
            const copyBtn = summaryWindow.querySelector('#copy-summary-btn');
            const closeBtn = summaryWindow.querySelector('#close-summary-btn');

            // Generate button
            generateBtn.addEventListener('click', () => {
                this.showConfirmationPopup(summaryWindow);
            });

            // Copy button
            copyBtn.addEventListener('click', () => {
                const textbox = summaryWindow.querySelector('#summary-textbox');
                navigator.clipboard.writeText(textbox.value).then(() => {
                    this.showNotification('Summary copied to clipboard!', 'success');
                });
            });

            // Close button
            closeBtn.addEventListener('click', () => {
                summaryWindow.remove();
            });

            // Escape key to close
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    summaryWindow.remove();
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);

            // Click outside to close
            summaryWindow.addEventListener('click', (e) => {
                if (e.target === summaryWindow) {
                    summaryWindow.remove();
                }
            });
        },

        // Show confirmation popup before generating summary
        showConfirmationPopup: function(summaryWindow) {
            // Check if user has disabled this popup
            const hidePopup = localStorage.getItem('slackpolish_hide_summary_confirmation');
            if (hidePopup === 'true') {
                utils.debug('Confirmation popup disabled, proceeding directly to summary generation');
                // Skip popup and proceed directly to summary generation
                this.generateChannelSummary(summaryWindow);
                return;
            }
            // Create popup overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            // Create popup content
            const popup = document.createElement('div');
            popup.style.cssText = `
                background: white;
                border-radius: 8px;
                padding: 24px;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                text-align: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;

            popup.innerHTML = `
                <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px;">
                    📊 Generate Channel Summary
                </h3>
                <p style="margin: 0 0 20px 0; color: #666; line-height: 1.4;">
                    SlackPolish will analyze the messages in this channel and generate an AI-powered summary based on your selected time range and summary level.
                </p>
                <div style="margin: 0 0 20px 0; text-align: left;">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #666; cursor: pointer;">
                        <input type="checkbox" id="dont-show-again-checkbox" style="margin: 0;">
                        <span>Don't show this message again</span>
                    </label>
                </div>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="cancel-generate-btn" style="
                        background: #f8f8f8;
                        color: #333;
                        border: 1px solid #ddd;
                        padding: 10px 20px;
                        border-radius: 4px;
                        font-size: 14px;
                        cursor: pointer;
                        font-weight: bold;
                    ">
                        Let me scroll
                    </button>
                    <button id="confirm-generate-btn" style="
                        background: #007a5a;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        font-size: 14px;
                        cursor: pointer;
                        font-weight: bold;
                    ">
                        OK, Generate Summary
                    </button>
                </div>
            `;

            overlay.appendChild(popup);
            document.body.appendChild(overlay);

            // Handle checkbox state
            const checkbox = popup.querySelector('#dont-show-again-checkbox');

            // Load saved checkbox state
            const savedState = localStorage.getItem('slackpolish_hide_summary_confirmation');
            if (savedState === 'true') {
                checkbox.checked = true;
            }

            // Handle OK button click
            const confirmBtn = popup.querySelector('#confirm-generate-btn');
            confirmBtn.addEventListener('click', () => {
                // Save checkbox state (checked or unchecked)
                if (checkbox.checked) {
                    localStorage.setItem('slackpolish_hide_summary_confirmation', 'true');
                    utils.debug('User opted to hide summary confirmation popup');
                } else {
                    localStorage.removeItem('slackpolish_hide_summary_confirmation');
                    utils.debug('User opted to show summary confirmation popup');
                }
                // Remove popup
                overlay.remove();
                // Proceed with original implementation
                this.generateChannelSummary(summaryWindow);
            });

            // Handle "Let me scroll" button click
            const cancelBtn = popup.querySelector('#cancel-generate-btn');
            cancelBtn.addEventListener('click', () => {
                // Save checkbox state (checked or unchecked)
                if (checkbox.checked) {
                    localStorage.setItem('slackpolish_hide_summary_confirmation', 'true');
                    utils.debug('User opted to hide summary confirmation popup');
                } else {
                    localStorage.removeItem('slackpolish_hide_summary_confirmation');
                    utils.debug('User opted to show summary confirmation popup');
                }
                // Remove popup
                overlay.remove();
                // Close the entire Channel Summary window
                summaryWindow.remove();
            });

            // Handle clicking outside popup to close
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.remove();
                }
            });
        },

        // Generate channel summary
        generateChannelSummary: async function(summaryWindow) {
            const textbox = summaryWindow.querySelector('#summary-textbox');
            const generateBtn = summaryWindow.querySelector('#generate-summary-btn');
            const timeRange = summaryWindow.querySelector('#time-range-select').value;
            const summaryLevel = summaryWindow.querySelector('#summary-level-select').value;

            utils.log('Generate Channel Summary clicked');
            utils.debug('Channel summary generation started', { timeRange, summaryLevel });

            // Disable button and show loading state
            generateBtn.disabled = true;
            generateBtn.textContent = '⏳ Fetching Messages...';
            textbox.value = 'Fetching channel messages...\n\nPlease wait while we gather the relevant messages from this channel.';

            try {
                // Check if SlackPolishChannelMessages is available
                if (!window.SlackPolishChannelMessages) {
                    throw new Error('SlackPolish Channel Messages module not available. Please refresh the page.');
                }

                utils.debug('Using SlackPolishChannelMessages module for message fetching');

                // Calculate date range based on time range selection
                const dateRange = this.calculateDateRange(timeRange);
                utils.debug('Calculated date range', dateRange);

                // Fetch messages using the same method as Smart Context
                let result = null;
                let messageCount = this.getMessageCountForTimeRange(timeRange);

                try {
                    // Try API-based approach first (same as Smart Context)
                    if (timeRange === 'all') {
                        result = await window.SlackPolishChannelMessages.getAllChannelMessages(true);
                    } else if (dateRange.startDate && dateRange.endDate) {
                        result = await window.SlackPolishChannelMessages.getMessagesInRange(
                            dateRange.startDate,
                            dateRange.endDate,
                            true // include threads
                        );
                    } else {
                        result = await window.SlackPolishChannelMessages.getRecentMessages(messageCount);
                    }
                } catch (apiError) {
                    utils.debug('API-based message fetching failed, trying DOM fallback', {
                        error: apiError.message
                    });

                    // Fallback to DOM-based extraction (same as Smart Context)
                    try {
                        result = await window.SlackPolishChannelMessages.getRecentMessagesFromDOM(messageCount);

                        // Filter messages by date range if needed
                        if (timeRange !== 'all' && dateRange.startDate && dateRange.endDate) {
                            const startTime = new Date(dateRange.startDate).getTime();
                            const endTime = new Date(dateRange.endDate).getTime();

                            result.messages = result.messages.filter(msg => {
                                if (!msg.timestamp) return false;
                                const msgTime = new Date(msg.timestamp).getTime();
                                return msgTime >= startTime && msgTime <= endTime;
                            });
                            result.totalReturned = result.messages.length;
                            result.method = result.method + '-Filtered';
                        }
                    } catch (domError) {
                        utils.debug('DOM fallback also failed', {
                            error: domError.message
                        });
                        throw new Error('Failed to fetch messages using both API and DOM methods. Please try again.');
                    }
                }

                // Ensure we have the channel name in the result
                utils.debug('🔍 Checking if we need to detect channel name', {
                    hasChannelName: !!result.channelName,
                    currentChannelName: result.channelName
                });

                if (!result.channelName) {
                    utils.debug('🔍 No channel name in result, detecting...');
                    const channelInfo = this.getCurrentChannelInfo();
                    result.channelName = channelInfo.name;
                    if (!result.channelId && channelInfo.id) {
                        result.channelId = channelInfo.id;
                    }
                    utils.debug('✅ Updated result with detected channel info', {
                        channelName: result.channelName,
                        channelId: result.channelId
                    });
                } else {
                    utils.debug('✅ Channel name already present in result', { channelName: result.channelName });
                }

                utils.debug('Message fetching completed', {
                    method: result.method,
                    messageCount: result.messages.length,
                    channelId: result.channelId,
                    channelName: result.channelName
                });

                // Update button state
                generateBtn.textContent = '🤖 Generating Summary...';

                // Display fetched messages and generate summary
                await this.processAndDisplaySummary(result, summaryLevel, textbox, generateBtn);

            } catch (error) {
                utils.debug('Error in generateChannelSummary', { error: error.message });

                // Handle API key errors specifically (don't show generic error message)
                if (error.message.includes('Invalid API key') ||
                    error.message.includes('API quota exceeded') ||
                    error.message.includes('API access forbidden') ||
                    error.message.includes('OpenAI API key not found')) {
                    // API key popup already shown, just update textbox with helpful message
                    textbox.value = `❌ API Key Issue: ${error.message}\n\n` +
                                  `Please update your OpenAI API key using the popup that appeared, or:\n` +
                                  `1. Get your API key from https://platform.openai.com/api-keys\n` +
                                  `2. Open SlackPolish settings (F12) and add your API key\n` +
                                  `3. Try generating the summary again`;
                } else {
                    // Show generic error message for other errors
                    textbox.value = `❌ Error: ${error.message}\n\nPlease try again or check the debug window for more details.`;
                }

                // Reset button state
                generateBtn.disabled = false;
                generateBtn.textContent = '🔍 Generate Summary';
            }
        },

        // Calculate date range based on time range selection
        calculateDateRange: function(timeRange) {
            const now = new Date();
            let startDate = null;
            let endDate = now;

            switch (timeRange) {
                case 'last24hours':
                    startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
                    break;
                case 'last7days':
                    startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
                    break;
                case 'last30days':
                    startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
                    break;
                case 'all':
                    startDate = null;
                    endDate = null;
                    break;
                default:
                    startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
            }

            return { startDate, endDate };
        },

        // Get appropriate message count for time range
        getMessageCountForTimeRange: function(timeRange) {
            switch (timeRange) {
                case 'last24hours':
                    return 50;
                case 'last7days':
                    return 200;
                case 'last30days':
                    return 500;
                case 'all':
                    return 1000;
                default:
                    return 50;
            }
        },

        // Get current channel information
        getCurrentChannelInfo: function() {
            try {
                utils.debug('🔍 Starting channel detection...');

                // Try multiple selectors for channel name
                let channelName = 'Unknown Channel';
                const selectors = [
                    // Modern Slack selectors
                    '[data-qa="channel_header_name"]',
                    '[data-qa="channel-name"]',
                    '[data-qa="channel_header"] [data-qa="channel_name"]',
                    '[data-qa="channel_header"] h1',
                    '[data-qa="dm_header"] h1',

                    // Header title selectors
                    '.p-view_header__channel_title',
                    '.p-channel_header__name',
                    '.p-channel_header__title',
                    '[data-qa="channel_header"] .p-channel_header__title',

                    // Sidebar selectors
                    '.p-channel_sidebar__name--selected',
                    '.c-channel_entity__name',

                    // Legacy selectors
                    '.p-classic_nav__model__title__name',

                    // Generic header selectors
                    'header h1',
                    '[role="banner"] h1',
                    '.c-view_header h1',

                    // Breadcrumb selectors
                    '.p-view_header__breadcrumbs',
                    '.p-view_header__title'
                ];

                utils.debug('🔍 Trying DOM selectors for channel name...', { totalSelectors: selectors.length });

                for (let i = 0; i < selectors.length; i++) {
                    const selector = selectors[i];
                    try {
                        const element = document.querySelector(selector);
                        utils.debug(`🔍 Selector ${i + 1}/${selectors.length}: ${selector}`, {
                            found: !!element,
                            hasText: element ? !!element.textContent?.trim() : false,
                            text: element ? element.textContent?.trim().substring(0, 50) : null
                        });

                        if (element && element.textContent?.trim()) {
                            channelName = element.textContent.trim();
                            utils.debug('✅ Found channel name using selector', { selector, channelName });
                            break;
                        }
                    } catch (selectorError) {
                        utils.debug(`❌ Error with selector ${selector}`, { error: selectorError.message });
                    }
                }

                // If still no name found, try to extract from URL
                if (channelName === 'Unknown Channel') {
                    utils.debug('🔍 No DOM selector worked, trying URL extraction...');
                    const currentUrl = window.location.href;
                    utils.debug('🔍 Current URL', { url: currentUrl });

                    const urlMatch = currentUrl.match(/\/client\/[^\/]+\/([^\/\?]+)/);
                    if (urlMatch && urlMatch[1]) {
                        const channelId = urlMatch[1];
                        utils.debug('🔍 Extracted channel ID from URL', { channelId });

                        // If it looks like a channel ID, format it nicely
                        if (channelId.startsWith('C')) {
                            channelName = `#${channelId}`;
                        } else if (channelId.startsWith('D')) {
                            channelName = 'Direct Message';
                        } else {
                            channelName = channelId;
                        }
                        utils.debug('✅ Using URL-based channel name', { channelName, channelId });
                    } else {
                        utils.debug('❌ Could not extract channel ID from URL');
                    }
                }

                const result = {
                    name: channelName,
                    id: this.extractChannelId(),
                    type: channelName.startsWith('#') ? 'channel' : 'dm'
                };

                utils.debug('🎯 Final channel detection result', result);
                return result;

            } catch (error) {
                utils.debug('❌ Error getting channel info', { error: error.message });
                return {
                    name: 'Current Channel',
                    id: null,
                    type: 'unknown'
                };
            }
        },

        // Extract channel ID from URL
        extractChannelId: function() {
            try {
                const url = window.location.href;
                const channelMatch = url.match(/\/client\/[^\/]+\/([^\/\?]+)/);
                return channelMatch ? channelMatch[1] : null;
            } catch (error) {
                utils.debug('Error extracting channel ID', { error: error.message });
                return null;
            }
        },

        // Process messages and generate AI summary
        processAndDisplaySummary: async function(result, summaryLevel, textbox, generateBtn) {
            try {
                // Format messages for AI processing
                const messagesText = this.formatMessagesForAI(result.messages);

                // Show loading display without message preview
                textbox.value = this.formatLoadingDisplay(result, summaryLevel);

                // Generate AI summary if we have messages
                if (result.messages.length > 0) {
                    const aiSummary = await this.generateAISummary(messagesText, summaryLevel, result);

                    // Display final result with clean visual structure
                    textbox.value = this.formatFinalSummary(result, summaryLevel, aiSummary);
                } else {
                    textbox.value = this.formatNoMessagesFound(result);
                }

                // Reset button state
                generateBtn.disabled = false;
                generateBtn.textContent = '🔍 Generate Summary';

            } catch (error) {
                utils.debug('Error in processAndDisplaySummary', { error: error.message });
                throw error;
            }
        },

        // Format loading display with clean visual structure
        formatLoadingDisplay: function(result, summaryLevel) {
            const channelName = result.channelName || 'Unknown Channel';
            const messageCount = result.messages.length;

            return `╔══════════════════════════════════════════════════════════════╗
║                    📊 CHANNEL SUMMARY REPORT                 ║
╚══════════════════════════════════════════════════════════════╝

🏷️  CHANNEL: ${channelName}
📊  MESSAGES FOUND: ${messageCount}
📅  GENERATED: ${new Date().toLocaleString()}

┌─────────────────────────────────────────────────────────────┐
│                🤖 GENERATING AI SUMMARY...                  │
│          Please wait while we analyze the messages         │
│                   Summary Level: ${summaryLevel.toUpperCase()}                    │
└─────────────────────────────────────────────────────────────┘`;
        },

        // Format final summary with clean visual structure
        formatFinalSummary: function(result, summaryLevel, aiSummary) {
            const channelName = result.channelName || 'Unknown Channel';
            const messageCount = result.messages.length;

            // Get contributors count
            const contributors = new Set();
            result.messages.forEach(msg => {
                if (msg.user && msg.user !== 'Unknown') {
                    contributors.add(msg.user);
                }
            });

            // Get date range
            let dateRange = 'Unknown';
            if (result.messages.length > 0) {
                const timestamps = result.messages
                    .map(msg => msg.timestamp)
                    .filter(ts => ts)
                    .sort();

                if (timestamps.length > 0) {
                    const oldest = new Date(timestamps[0]).toLocaleDateString();
                    const newest = new Date(timestamps[timestamps.length - 1]).toLocaleDateString();
                    dateRange = oldest === newest ? oldest : `${oldest} - ${newest}`;
                }
            }

            return `╔══════════════════════════════════════════════════════════════╗
║                    📊 CHANNEL SUMMARY REPORT                 ║
╚══════════════════════════════════════════════════════════════╝

🏷️  CHANNEL: ${channelName}
📊  MESSAGES ANALYZED: ${messageCount}
👥  CONTRIBUTORS: ${contributors.size}
📅  DATE RANGE: ${dateRange}
🎯  SUMMARY LEVEL: ${summaryLevel.toUpperCase()}
⏰  GENERATED: ${new Date().toLocaleString()}

╔══════════════════════════════════════════════════════════════╗
║                        🤖 AI SUMMARY                         ║
╚══════════════════════════════════════════════════════════════╝

${aiSummary}

╔══════════════════════════════════════════════════════════════╗
║                      📋 SUMMARY COMPLETE                     ║
╚══════════════════════════════════════════════════════════════╝

Generated by SlackPolish Channel Summary • ${new Date().toLocaleString()}`;
        },

        // Format no messages found display
        formatNoMessagesFound: function(result) {
            const channelName = result.channelName || 'Unknown Channel';

            return `╔══════════════════════════════════════════════════════════════╗
║                    📊 CHANNEL SUMMARY REPORT                 ║
╚══════════════════════════════════════════════════════════════╝

🏷️  CHANNEL: ${channelName}
📊  MESSAGES FOUND: 0
⏰  GENERATED: ${new Date().toLocaleString()}

┌─────────────────────────────────────────────────────────────┐
│                     ❌ NO MESSAGES FOUND                    │
└─────────────────────────────────────────────────────────────┘

No messages were found in the selected time range for this channel.

💡 SUGGESTIONS:
   • Try selecting a different time range (e.g., "Last 7 days" or "Entire channel")
   • Scroll through the channel to load more message history
   • Check if you have access to this channel's message history
   • Verify that the channel has messages in the selected time period

╔══════════════════════════════════════════════════════════════╗
║                        📋 NO SUMMARY                         ║
╚══════════════════════════════════════════════════════════════╝

Generated by SlackPolish Channel Summary • ${new Date().toLocaleString()}`;
        },



        // Format messages for AI processing
        formatMessagesForAI: function(messages) {
            if (!messages || messages.length === 0) {
                return 'No messages to summarize.';
            }

            return messages.map(msg => {
                const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : '';
                const user = msg.user || 'Unknown';
                const text = msg.text || '';
                return `${timestamp} - ${user}: ${text}`;
            }).join('\n');
        },

        // Generate AI summary using OpenAI
        generateAISummary: async function(messagesText, summaryLevel, result) {
            try {
                // Get API key from localStorage (same method as text improver)
                const apiKey = localStorage.getItem('slackpolish_openai_api_key');
                if (!apiKey) {
                    this.showApiKeyUpdatePopup('OpenAI API key not configured. Please enter your API key to use Channel Summary.');
                    throw new Error('OpenAI API key not found. Please configure your API key in SlackPolish settings.');
                }

                // Create prompt based on summary level
                const prompt = this.createSummaryPrompt(messagesText, summaryLevel, result);

                utils.debug('Generating AI summary', {
                    messageLength: messagesText.length,
                    summaryLevel,
                    channelName: result.channelName,
                    hasApiKey: !!apiKey
                });

                // Make direct OpenAI API call (same method as text improver)
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4-turbo',
                        messages: [{ role: 'user', content: prompt }],
                        max_tokens: summaryLevel === 'comprehensive' ? 1000 : 500,
                        temperature: 0.3
                    })
                });

                if (!response.ok) {
                    // Handle API errors the same way as text improver
                    if (response.status === 401) {
                        this.showApiKeyUpdatePopup('Invalid or missing API key. Please update your OpenAI API key.');
                        throw new Error('Invalid API key');
                    } else if (response.status === 429) {
                        this.showApiKeyUpdatePopup('OpenAI API quota exceeded or billing issue. Please check your OpenAI account or update your API key.');
                        throw new Error('API quota exceeded');
                    } else if (response.status === 403) {
                        this.showApiKeyUpdatePopup('OpenAI API access forbidden. Please check your API key permissions.');
                        throw new Error('API access forbidden');
                    } else {
                        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
                    }
                }

                const data = await response.json();

                if (data.choices && data.choices[0] && data.choices[0].message) {
                    return data.choices[0].message.content;
                } else {
                    throw new Error('Invalid response format from OpenAI API');
                }

            } catch (error) {
                utils.debug('Error generating AI summary', { error: error.message });

                // Don't show popup again if we already showed it for API key issues
                if (!error.message.includes('Invalid API key') &&
                    !error.message.includes('API quota exceeded') &&
                    !error.message.includes('API access forbidden')) {
                    return `❌ Failed to generate AI summary: ${error.message}\n\nRaw messages are shown above for your reference.`;
                }

                throw error; // Re-throw API key errors to be handled by caller
            }
        },

        // Create summary prompt based on level
        createSummaryPrompt: function(messagesText, summaryLevel, result) {
            const channelName = result.channelName || 'this channel';
            const messageCount = result.messages.length;

            let levelInstructions = '';
            let formatInstructions = '';

            if (summaryLevel === 'executive') {
                levelInstructions = 'Create a concise executive summary focusing on key decisions, action items, and important announcements. Keep it brief and actionable.';
                formatInstructions = `Format your response as follows:

🎯 KEY HIGHLIGHTS
• [Most important points in bullet format]

📋 ACTION ITEMS
• [Specific tasks or decisions mentioned]

📊 METRICS/NUMBERS
• [Any important numbers, dates, or metrics mentioned]

⚠️ IMPORTANT NOTES
• [Critical information that needs attention]`;
            } else if (summaryLevel === 'comprehensive') {
                levelInstructions = 'Create a detailed comprehensive summary including main topics discussed, key participants, decisions made, action items, and important context. Organize by themes or chronology as appropriate.';
                formatInstructions = `Format your response as follows:

📝 OVERVIEW
[Brief overview of the main discussion]

🗣️ KEY PARTICIPANTS
• [List main contributors to the discussion]

📋 MAIN TOPICS DISCUSSED
• [Topic 1]: [Description]
• [Topic 2]: [Description]
• [Topic 3]: [Description]

✅ DECISIONS MADE
• [List any decisions or conclusions reached]

📋 ACTION ITEMS
• [Specific tasks or follow-ups mentioned]
• [Include assignees if mentioned]

📅 IMPORTANT DATES
• [Any deadlines, meetings, or time-sensitive items]

💡 KEY INSIGHTS
• [Important observations or insights from the discussion]

⚠️ FOLLOW-UP NEEDED
• [Items that require further attention or clarification]`;
            } else {
                levelInstructions = 'Create a balanced summary covering the main topics and key points discussed.';
                formatInstructions = `Format your response with clear sections and bullet points for easy reading.`;
            }

            return `Please analyze the following ${messageCount} messages from ${channelName} and create a well-structured summary.

INSTRUCTIONS:
${levelInstructions}

${formatInstructions}

MESSAGES TO ANALYZE:
${messagesText}

Please provide your summary now:`;
        },

        // Show API key update popup (same as text improver)
        showApiKeyUpdatePopup: function(message) {
            // Remove any existing popup
            const existingPopup = document.getElementById('slackpolish-api-popup');
            if (existingPopup) {
                existingPopup.remove();
            }

            // Create popup
            const popup = document.createElement('div');
            popup.id = 'slackpolish-api-popup';
            popup.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border: 2px solid #007a5a;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 400px;
                width: 90%;
            `;

            popup.innerHTML = `
                <div style="margin-bottom: 15px;">
                    <h3 style="margin: 0 0 10px 0; color: #007a5a;">🔑 SlackPolish API Key</h3>
                    <p style="margin: 0; color: #333; font-size: 14px;">${message}</p>
                </div>
                <div style="margin-bottom: 15px;">
                    <input type="password" id="api-key-input" placeholder="Enter your OpenAI API key (sk-...)"
                           style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="cancel-api-key" style="padding: 8px 16px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
                    <button id="save-api-key" style="padding: 8px 16px; border: none; background: #007a5a; color: white; border-radius: 4px; cursor: pointer;">Save</button>
                </div>
                <div style="margin-top: 10px; font-size: 12px; color: #666;">
                    Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" style="color: #007a5a;">OpenAI Platform</a>
                </div>
            `;

            document.body.appendChild(popup);

            // Focus on input
            const input = popup.querySelector('#api-key-input');
            input.focus();

            // Handle save
            const saveBtn = popup.querySelector('#save-api-key');
            const cancelBtn = popup.querySelector('#cancel-api-key');

            const saveHandler = () => {
                const apiKey = input.value.trim();
                if (apiKey) {
                    this.updateApiKey(apiKey);
                    popup.remove();
                    utils.showNotification('API key saved successfully!', 'success');
                } else {
                    input.style.borderColor = '#e01e5a';
                    input.focus();
                }
            };

            const cancelHandler = () => {
                popup.remove();
            };

            saveBtn.addEventListener('click', saveHandler);
            cancelBtn.addEventListener('click', cancelHandler);

            // Enter key to save
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveHandler();
                }
            });

            // Escape key to cancel
            document.addEventListener('keydown', function escapeHandler(e) {
                if (e.key === 'Escape') {
                    popup.remove();
                    document.removeEventListener('keydown', escapeHandler);
                }
            });
        },

        // Update API key in localStorage (same as text improver)
        updateApiKey: function(newApiKey) {
            try {
                // Save to localStorage for persistence (same key as text improver)
                localStorage.setItem('slackpolish_openai_api_key', newApiKey);
                utils.log('🔑 API key updated and saved for future use');
            } catch (error) {
                utils.log(`❌ Error updating API key: ${error.message}`);
            }
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

    // Initialize channel summary functionality
    function initializeChannelSummary() {
        utils.log('Channel Summary module initialized');
        utils.debug('Channel Summary module initialization', {
            hasGlobalDebug: !!window.SlackPolishDebug,
            currentSettings: SlackChannelSummary.loadSettings()
        });

        // Add keyboard shortcut for channel summary (F10)
        document.addEventListener('keydown', function(event) {
            if (event.key === 'F10') {
                event.preventDefault();
                SlackChannelSummary.showChannelSummary();
            }
        });
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeChannelSummary);
    } else {
        initializeChannelSummary();
    }

})();
// === SLACK TEXT IMPROVER INJECTION END ===
