// SlackPolish Channel Summary - F10 Channel Summarization
// Independent script for channel summarization functionality

(function() {
    'use strict';

    // Channel Summary Manager
    const ChannelSummary = {
        isWindowOpen: false,
        summaryWindow: null,
        settings: null,

        init() {
            console.log('🔧 SLACKPOLISH: Channel Summary init() called');
            this.debug('Channel Summary init() called');
            // Load settings directly from localStorage
            this.settings = this.loadSettings();
            console.log('🔧 SLACKPOLISH: Channel Summary initialized successfully');
            this.debug('Channel Summary initialized successfully', this.settings);
            this.setupHotkey();
        },

        // Debug utility function to integrate with shared debug system
        debug(message, data = null) {
            try {
                if (window.SlackPolishDebug) {
                    console.log(`🐛 SLACKPOLISH DEBUG: ${message}`, data || '');
                    window.SlackPolishDebug.addLog('channel-summary', message, data);
                }
            } catch (e) {
                // Fallback to console if debug system not available
                console.log(`🐛 SLACKPOLISH DEBUG: ${message}`, data || '');
            }
        },

        loadSettings() {
            try {
                const stored = localStorage.getItem('slackpolish_settings');
                if (stored) {
                    return JSON.parse(stored);
                }
            } catch (e) {
                console.log('🔧 SLACKPOLISH: Channel Summary - Error loading settings, using defaults');
            }

            // Default settings
            return {
                language: 'English',
                style: 'Professional',
                customInstructions: '',
                debugMode: false
            };
        },

        setupHotkey() {
            document.addEventListener('keydown', (event) => {
                if (event.key === 'F10' &&
                    !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
                    event.preventDefault();
                    this.debug('F10 hotkey pressed - opening Channel Summary window');
                    this.openSummaryWindow();
                }
            });
            console.log('🔧 SLACKPOLISH: Channel Summary F10 hotkey registered');
            this.debug('F10 hotkey registered for Channel Summary');
        },

        getCurrentChannelInfo() {
            // Get channel ID from URL
            const urlMatch = window.location.href.match(/\/([C][A-Z0-9]+)/);
            let channelId = urlMatch ? urlMatch[1] : null;

            // Get channel name from DOM
            let channelName = 'Unknown Channel';
            const channelNameSelectors = [
                '[data-qa="channel_header"] [data-qa="channel_name"]',
                '[data-qa="channel_header"] h1',
                '.p-channel_header__title',
                '.p-channel_header__name'
            ];

            for (const selector of channelNameSelectors) {
                const element = document.querySelector(selector);
                if (element && element.textContent.trim()) {
                    channelName = element.textContent.trim();
                    break;
                }
            }

            // Handle DMs
            if (window.location.href.includes('/dms') || !channelId) {
                channelName = 'Direct Message';
                channelId = 'dm';
            }

            return { channelId, channelName };
        },

        openSummaryWindow() {
            if (this.isWindowOpen && this.summaryWindow && !this.summaryWindow.closed) {
                this.summaryWindow.focus();
                return;
            }

            const { channelId, channelName } = this.getCurrentChannelInfo();
            console.log('🔧 SLACKPOLISH: Channel Summary opening window for:', channelName);

            // Calculate window position (center of screen)
            const windowWidth = 1000;
            const windowHeight = 700;
            const left = (screen.width - windowWidth) / 2;
            const top = (screen.height - windowHeight) / 2;

            const windowFeatures = `
                width=${windowWidth},
                height=${windowHeight},
                left=${left},
                top=${top},
                resizable=yes,
                scrollbars=yes,
                status=no,
                menubar=no,
                toolbar=no,
                location=no
            `.replace(/\s+/g, '');

            this.summaryWindow = window.open('', 'SlackPolishChannelSummary', windowFeatures);

            if (this.summaryWindow) {
                this.isWindowOpen = true;
                this.renderSummaryWindow(channelName);

                // Handle window close
                this.summaryWindow.addEventListener('beforeunload', () => {
                    this.isWindowOpen = false;
                    this.summaryWindow = null;
                });
            } else {
                console.log('🔧 SLACKPOLISH: Channel Summary failed to open window - popup blocked?');
            }
        },

        renderSummaryWindow(channelName) {
            const doc = this.summaryWindow.document;

            doc.open();
            doc.write(this.getWindowHTML(channelName));
            doc.close();

            // Set up window event handlers
            this.setupWindowHandlers();
        },

        getWindowHTML(channelName) {
            return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SlackPolish Channel Summary</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background: white;
            color: #333;
            height: 100vh;
            overflow: hidden;
        }

        .container {
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            margin: 10px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            height: calc(100vh - 20px);
        }

        .header {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-bottom: 1px solid #ddd;
            padding: 15px 20px;
            display: flex;
            align-items: center;
            gap: 16px;
            flex-shrink: 0;
        }

        .logo-container {
            background: white;
            border-radius: 8px;
            padding: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            width: 64px;
            height: 64px;
        }

        .logo {
            font-size: 48px;
            font-weight: bold;
            color: #1264a3;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .logo {
            width: 48px;
            height: 48px;
            background: #1264a3;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 20px;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .title h1 {
            margin: 0;
            font-size: 18px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 4px;
        }

        .subtitle {
            font-size: 13px;
            color: #6c757d;
            margin-top: 0;
        }

        .controls {
            padding: 20px;
            border-bottom: 1px solid #ddd;
            display: flex;
            gap: 15px;
            align-items: end;
            flex-wrap: wrap;
            flex-shrink: 0;
        }

        .control-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 140px;
        }

        .control-group label {
            font-weight: bold;
            font-size: 13px;
            color: #333;
        }

        .control-group select {
            padding: 6px 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
            background: white;
            font-size: 13px;
            color: #333;
        }

        .control-group select:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }

        .generate-btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 13px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.2s;
            height: fit-content;
        }

        .generate-btn:hover {
            background: #0056b3;
        }

        .generate-btn:disabled {
            background: #6c757d;
            cursor: not-allowed;
        }

        .summary-area {
            padding: 20px;
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .channel-header {
            font-size: 16px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e9ecef;
        }

        .summary-textbox {
            width: 100%;
            flex: 1;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 12px;
            font-family: Arial, sans-serif;
            font-size: 13px;
            line-height: 1.4;
            resize: none;
            background: white;
            color: #333;
            box-sizing: border-box;
            min-height: 200px;
        }

        .summary-textbox:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }

        .button-row {
            padding: 15px 20px;
            background: #f8f9fa;
            border-top: 1px solid #ddd;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        }

        .copy-btn {
            background: #28a745;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 13px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.2s;
        }

        .copy-btn:hover {
            background: #218838;
        }

        .copy-btn:disabled {
            background: #6c757d;
            cursor: not-allowed;
        }

        .close-btn {
            background: #dc3545;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 13px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.2s;
        }

        .close-btn:hover {
            background: #c82333;
        }

        .metadata {
            font-size: 12px;
            color: #666;
            margin-bottom: 10px;
            display: none;
        }

        .loading {
            display: none;
            text-align: center;
            padding: 40px;
            color: #666;
        }

        .loading.active {
            display: block;
        }

        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #007bff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 10px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo-container">
                <div class="logo">SP</div>
            </div>
            <div class="title">
                <h1>SlackPolish Channel Summary</h1>
                <div class="subtitle">AI-Powered Summarization</div>
            </div>
        </div>

        <div class="controls">
            <div class="control-group">
                <label for="depthSelect">📅 Time Range:</label>
                <select id="depthSelect">
                    <option value="last24hours">Last 24 Hours</option>
                    <option value="last7days">Last 7 Days</option>
                    <option value="last30days">Last 30 Days</option>
                    <option value="entirechannel">Entire Channel</option>
                </select>
            </div>

            <div class="control-group">
                <label for="levelSelect">📊 Summary Level:</label>
                <select id="levelSelect">
                    <option value="short">Executive Summary</option>
                    <option value="comprehensive">Comprehensive Summary</option>
                </select>
            </div>

            <div class="control-group">
                <label>&nbsp;</label>
                <button class="generate-btn" id="generateBtn" onclick="generateSummary()">
                    🔍 Generate Summary
                </button>
            </div>
        </div>

        <div class="summary-area">
            <div class="channel-header" id="channelHeader">
                📋 ${channelName}
            </div>

            <div class="metadata" id="metadata">
                Generated: <span id="timestamp"></span> •
                Messages: <span id="messageCount"></span> •
                Participants: <span id="participantCount"></span>
            </div>

            <div class="loading" id="loading">
                <div class="spinner"></div>
                Analyzing channel messages and generating summary...
            </div>

            <textarea
                class="summary-textbox"
                id="summaryTextbox"
                placeholder="Click 'Generate Summary' to analyze channel messages and create an AI-powered summary of the conversation..."
                readonly
            ></textarea>
        </div>

        <div class="button-row">
            <button class="copy-btn" id="copyBtn" onclick="copySummary()" disabled>
                📋 Copy Summary
            </button>
            <button class="close-btn" onclick="closeWindow()">
                ❌ Close
            </button>
        </div>
    </div>

    <script>
        // Simple logo implementation - no dynamic creation needed
        // Logo is now directly in HTML as <div class="logo">SP</div>

        function generateSummary() {
            console.log('🔧 SLACKPOLISH: Generate Summary clicked - fetching channel messages...');

            // Get UI elements
            const summaryTextbox = document.getElementById('summaryTextbox');
            const loadingDiv = document.getElementById('loading');
            const generateBtn = document.getElementById('generateBtn');
            const timestampSpan = document.getElementById('timestamp');
            const messageCountSpan = document.getElementById('messageCount');
            const participantCountSpan = document.getElementById('participantCount');

            // Show loading state
            loadingDiv.style.display = 'block';
            generateBtn.disabled = true;
            generateBtn.textContent = '⏳ Fetching Messages...';
            summaryTextbox.value = '';

            try {
                // Get current channel information from Slack
                const channelInfo = getCurrentChannelInfo();
                console.log('🔧 SLACKPOLISH: Current channel info:', channelInfo);

                // Fetch messages from the channel
                fetchChannelMessages(channelInfo)
                    .then(messages => {
                        console.log('🔧 SLACKPOLISH: Fetched messages:', messages.length);

                        // Display messages in text box
                        displayMessagesInTextbox(messages, summaryTextbox);

                        // Update metadata
                        updateMetadata(messages, timestampSpan, messageCountSpan, participantCountSpan);

                        // Hide loading state
                        loadingDiv.style.display = 'none';
                        generateBtn.disabled = false;
                        generateBtn.textContent = '🔍 Generate Summary';

                    })
                    .catch(error => {
                        console.error('❌ SLACKPOLISH: Error fetching messages:', error);
                        summaryTextbox.value = 'Error fetching messages: ' + error.message;

                        // Hide loading state
                        loadingDiv.style.display = 'none';
                        generateBtn.disabled = false;
                        generateBtn.textContent = '🔍 Generate Summary';
                    });

            } catch (error) {
                console.error('❌ SLACKPOLISH: Error in generateSummary:', error);
                summaryTextbox.value = 'Error: ' + error.message;

                // Hide loading state
                loadingDiv.style.display = 'none';
                generateBtn.disabled = false;
                generateBtn.textContent = '🔍 Generate Summary';
            }
        }
        
        function copySummary() {
            const summaryTextbox = document.getElementById('summaryTextbox');
            if (summaryTextbox.value) {
                summaryTextbox.select();
                document.execCommand('copy');

                const copyBtn = document.getElementById('copyBtn');
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✅ Copied!';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 2000);
            }
        }

        function getCurrentChannelInfo() {
            // Try to get channel info from Slack's current state
            try {
                // Get current URL to extract channel ID
                const currentUrl = window.opener ? window.opener.location.href : window.location.href;
                console.log('🔧 SLACKPOLISH: Current URL:', currentUrl);

                // Extract channel ID from URL (format: /client/TEAM_ID/CHANNEL_ID)
                const urlMatch = currentUrl.match(/\/client\/[^\/]+\/([^\/\?]+)/);
                const channelId = urlMatch ? urlMatch[1] : null;

                if (!channelId) {
                    throw new Error('Could not extract channel ID from URL');
                }

                // Try to get channel name from the opener window's DOM
                let channelName = 'Unknown Channel';
                try {
                    if (window.opener && !window.opener.closed) {
                        const openerDoc = window.opener.document;
                        // Look for channel name in various possible locations
                        const titleElements = openerDoc.querySelectorAll('[data-qa="channel_name"], [data-qa="channel-name"], .p-channel_sidebar__name, .p-channel_sidebar__channel_name');
                        if (titleElements.length > 0) {
                            channelName = titleElements[0].textContent.trim();
                        } else {
                            // Fallback: look for any element with channel-like text
                            const headerElements = openerDoc.querySelectorAll('h1, h2, .c-channel_entity__name, [role="heading"]');
                            for (const el of headerElements) {
                                const text = el.textContent.trim();
                                if (text && text.length > 0 && text.length < 100) {
                                    channelName = text;
                                    break;
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('🔧 SLACKPOLISH: Could not extract channel name from DOM:', e);
                }

                return {
                    id: channelId,
                    name: channelName,
                    url: currentUrl
                };

            } catch (error) {
                console.error('❌ SLACKPOLISH: Error getting channel info:', error);
                throw error;
            }
        }

        async function fetchChannelMessages(channelInfo) {
            console.log('🔧 SLACKPOLISH: Fetching messages for channel:', channelInfo.id);

            try {
                // Get the selected time range
                const timeRange = document.getElementById('depthSelect').value;
                console.log('🔧 SLACKPOLISH: Selected time range:', timeRange);

                // Calculate the cutoff date based on time range
                const cutoffDate = getTimeRangeCutoff(timeRange);
                console.log('🔧 SLACKPOLISH: Cutoff date:', cutoffDate);

                // Try to get messages from Slack's message container in the opener window
                const messages = [];

                if (!window.opener || window.opener.closed) {
                    throw new Error('Parent Slack window is not available');
                }

                const openerDoc = window.opener.document;

                // Look for message elements in the DOM
                const messageSelectors = [
                    '[data-qa="message"]',
                    '.c-message_kit__message',
                    '.c-message',
                    '[role="listitem"]'
                ];

                let messageElements = [];
                for (const selector of messageSelectors) {
                    messageElements = openerDoc.querySelectorAll(selector);
                    if (messageElements.length > 0) {
                        console.log('🔧 SLACKPOLISH: Found messages with selector:', selector, messageElements.length);
                        break;
                    }
                }

                if (messageElements.length === 0) {
                    throw new Error('No message elements found in DOM');
                }

                // Extract message data from DOM elements and filter by time range
                for (let i = 0; i < messageElements.length; i++) {
                    const msgElement = messageElements[i];

                    try {
                        const message = extractMessageFromElement(msgElement, i);
                        if (message && isMessageInTimeRange(message, cutoffDate, timeRange)) {
                            messages.push(message);
                        }
                    } catch (e) {
                        console.warn('🔧 SLACKPOLISH: Error extracting message', i, ':', e);
                    }
                }

                console.log('🔧 SLACKPOLISH: Successfully extracted', messages.length, 'messages within time range');
                return messages;

            } catch (error) {
                console.error('❌ SLACKPOLISH: Error fetching messages:', error);
                throw error;
            }
        }

        function getTimeRangeCutoff(timeRange) {
            const now = new Date();

            if (timeRange === 'all') {
                return null; // No cutoff, include all messages
            }

            const days = parseInt(timeRange);
            if (isNaN(days)) {
                console.warn('🔧 SLACKPOLISH: Invalid time range:', timeRange, 'defaulting to 7 days');
                return new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
            }

            return new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
        }

        function isMessageInTimeRange(message, cutoffDate, timeRange) {
            if (timeRange === 'all' || !cutoffDate) {
                return true; // Include all messages
            }

            if (!message.timestamp) {
                return false; // Skip messages without timestamp
            }

            return message.timestamp >= cutoffDate;
        }

        function extractMessageFromElement(msgElement, index) {
            try {
                // Extract timestamp
                let timestamp = null;
                const timeElements = msgElement.querySelectorAll('[data-ts], .c-timestamp, time, [datetime]');
                for (const timeEl of timeElements) {
                    const ts = timeEl.getAttribute('data-ts') || timeEl.getAttribute('datetime') || timeEl.textContent;
                    if (ts) {
                        // Try to parse timestamp (Slack uses Unix timestamp in seconds)
                        const parsedTs = parseFloat(ts);
                        if (!isNaN(parsedTs)) {
                            timestamp = new Date(parsedTs * 1000); // Convert to milliseconds
                            break;
                        }
                    }
                }

                // Extract user name
                let userName = 'Unknown User';
                const userElements = msgElement.querySelectorAll('[data-qa="message_sender_name"], .c-message__sender, .c-message_kit__sender');
                if (userElements.length > 0) {
                    userName = userElements[0].textContent.trim();
                }

                // Extract message text
                let messageText = '';
                const textElements = msgElement.querySelectorAll('[data-qa="message_text"], .c-message__body, .c-message_kit__text');
                if (textElements.length > 0) {
                    messageText = textElements[0].textContent.trim();
                } else {
                    // Fallback: get all text content
                    messageText = msgElement.textContent.trim();
                }

                if (!messageText || messageText.length === 0) {
                    return null; // Skip empty messages
                }

                return {
                    index: index,
                    timestamp: timestamp,
                    userName: userName,
                    text: messageText,
                    element: msgElement
                };

            } catch (error) {
                console.warn('🔧 SLACKPOLISH: Error extracting message from element:', error);
                return null;
            }
        }

        function extractMessageFromElement(msgElement, index) {
            try {
                // Extract timestamp
                let timestamp = null;
                const timeElements = msgElement.querySelectorAll('[data-ts], .c-timestamp, time, [datetime]');
                for (const timeEl of timeElements) {
                    const ts = timeEl.getAttribute('data-ts') || timeEl.getAttribute('datetime') || timeEl.textContent;
                    if (ts) {
                        // Try to parse timestamp (Slack uses Unix timestamp in seconds)
                        const parsedTs = parseFloat(ts);
                        if (!isNaN(parsedTs)) {
                            timestamp = new Date(parsedTs * 1000); // Convert to milliseconds
                            break;
                        }
                    }
                }

                // Extract user name
                let userName = 'Unknown User';
                const userElements = msgElement.querySelectorAll('[data-qa="message_sender_name"], .c-message__sender, .c-message_kit__sender');
                if (userElements.length > 0) {
                    userName = userElements[0].textContent.trim();
                }

                // Extract message text
                let messageText = '';
                const textElements = msgElement.querySelectorAll('[data-qa="message_text"], .c-message__body, .c-message_kit__text');
                if (textElements.length > 0) {
                    messageText = textElements[0].textContent.trim();
                } else {
                    // Fallback: get all text content
                    messageText = msgElement.textContent.trim();
                }

                if (!messageText || messageText.length === 0) {
                    return null; // Skip empty messages
                }

                return {
                    index: index,
                    timestamp: timestamp,
                    userName: userName,
                    text: messageText,
                    element: msgElement
                };

            } catch (error) {
                console.warn('🔧 SLACKPOLISH: Error extracting message from element:', error);
                return null;
            }
        }

        function displayMessagesInTextbox(messages, textbox) {
            if (!messages || messages.length === 0) {
                textbox.value = 'No messages found in the selected time range.';
                return;
            }

            let output = '=== CHANNEL MESSAGES (' + messages.length + ' messages) ===\\n\\n';

            messages.forEach((message, index) => {
                const timestampStr = message.timestamp ?
                    message.timestamp.toLocaleString() : 'Unknown time';

                output += '[' + (index + 1) + '] ' + timestampStr + ' - ' + message.userName + ':\\n';
                output += message.text + '\\n\\n';
            });

            textbox.value = output;
        }

        function updateMetadata(messages, timestampSpan, messageCountSpan, participantCountSpan) {
            // Update message count
            messageCountSpan.textContent = messages.length;

            // Count unique participants
            const uniqueUsers = new Set();
            messages.forEach(msg => {
                if (msg.userName && msg.userName !== 'Unknown User') {
                    uniqueUsers.add(msg.userName);
                }
            });
            participantCountSpan.textContent = uniqueUsers.size;

            // Update timestamp to current time
            timestampSpan.textContent = new Date().toLocaleString();
        }

        function closeWindow() {
            if (window.opener && !window.opener.closed) {
                window.opener.focus();
            }
            window.close();
        }
    </script>
</body>
</html>`;
        },

        setupWindowHandlers() {
            // Additional window-specific handlers can be added here
            console.log('🔧 SLACKPOLISH: Channel Summary window handlers set up');
        }
    };

    // Initialize when DOM is ready
    console.log('🔧 SLACKPOLISH: Channel Summary script starting...');
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                console.log('🔧 SLACKPOLISH: Channel Summary starting init after DOM ready');
                ChannelSummary.init();
            }, 1000);
        });
    } else {
        setTimeout(() => {
            console.log('🔧 SLACKPOLISH: Channel Summary starting init (DOM already ready)');
            ChannelSummary.init();
        }, 1000);
    }

})();
