import * as vscode from 'vscode';
import { ChatMessage, ExtensionMode } from '../types';
import { CodeForgeService } from '../services/CodeForgeService';
import { ContextProvider } from './ContextProvider';
import { ModeManager } from '../managers/ModeManager';

export class ChatProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _messages: ChatMessage[] = [];

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _codeForgeService: CodeForgeService,
        private readonly _contextProvider: ContextProvider,
        private readonly _modeManager: ModeManager
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage':
                    await this._handleUserMessage(data.message);
                    break;
                case 'clearChat':
                    this._clearChat();
                    break;
                case 'switchMode':
                    this._modeManager.switchMode();
                    this._updateModeDisplay();
                    break;
            }
        });

        // Update mode display when mode changes
        this._modeManager.onModeChanged(() => {
            this._updateModeDisplay();
        });
    }

    private async _handleUserMessage(message: string) {
        if (!message.trim()) {
            return;
        }

        // Add user message
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'user',
            content: message,
            timestamp: new Date(),
            mode: this._modeManager.getCurrentMode()
        };
        this._addMessage(userMessage);

        try {
            // Get context files
            const contextFiles = this._contextProvider.getContextFiles();
            
            // Process with CodeForge CLI based on current mode
            let response: string;
            const currentMode = this._modeManager.getCurrentMode();
            
            switch (currentMode) {
                case ExtensionMode.Edit:
                    response = await this._codeForgeService.processEdit(message, contextFiles);
                    break;
                case ExtensionMode.Agent:
                    response = await this._codeForgeService.processAgent(message, contextFiles);
                    break;
                case ExtensionMode.Ask:
                    response = await this._codeForgeService.processPrompt(message, contextFiles);
                    break;
                default:
                    response = await this._codeForgeService.processPrompt(message, contextFiles);
            }

            // Add assistant response
            const assistantMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                type: 'assistant',
                content: response,
                timestamp: new Date(),
                mode: currentMode
            };
            this._addMessage(assistantMessage);

        } catch (error) {
            const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                type: 'system',
                content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
                timestamp: new Date()
            };
            this._addMessage(errorMessage);
        }
    }

    private _addMessage(message: ChatMessage) {
        this._messages.push(message);
        this._updateWebview();
    }

    private _clearChat() {
        this._messages = [];
        this._updateWebview();
    }

    private _updateWebview() {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateMessages',
                messages: this._messages
            });
        }
    }

    private _updateModeDisplay() {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateMode',
                mode: this._modeManager.getCurrentMode()
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>CodeForgeX Chat</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
                    background: var(--vscode-editor-background, #1e1e1e);
                    color: var(--vscode-editor-foreground, #cccccc);
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .header {
                    background: var(--vscode-titleBar-activeBackground, #2d2d30);
                    border-bottom: 1px solid var(--vscode-panel-border, #464647);
                    padding: 16px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                }

                .header-icon {
                    width: 24px;
                    height: 24px;
                    background: linear-gradient(45deg, #007ACC, #4FC3F7);
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }

                .header-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: var(--vscode-titleBar-activeForeground, #cccccc);
                }

                .mode-indicator {
                    background: var(--vscode-badge-background, #0e639c);
                    color: var(--vscode-badge-foreground, #ffffff);
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-left: auto;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    transition: all 0.3s ease;
                }

                .mode-indicator:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                }

                .controls {
                    display: flex;
                    gap: 8px;
                    padding: 12px 16px;
                    background: var(--vscode-sideBar-background, #252526);
                    border-bottom: 1px solid var(--vscode-panel-border, #464647);
                }

                .control-btn {
                    padding: 8px 16px;
                    background: var(--vscode-button-secondaryBackground, #3c3c3c);
                    color: var(--vscode-button-secondaryForeground, #cccccc);
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .control-btn:hover {
                    background: var(--vscode-button-secondaryHoverBackground, #464647);
                    transform: translateY(-1px);
                }

                .control-btn.primary {
                    background: var(--vscode-button-background, #0e639c);
                    color: var(--vscode-button-foreground, #ffffff);
                }

                .control-btn.primary:hover {
                    background: var(--vscode-button-hoverBackground, #1177bb);
                }

                .icon {
                    display: inline-block;
                    width: 16px;
                    height: 16px;
                    text-align: center;
                    font-size: 14px;
                    line-height: 16px;
                }

                .messages-container {
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px;
                    scroll-behavior: smooth;
                    background: var(--vscode-editor-background, #1e1e1e);
                }

                .messages-container::-webkit-scrollbar {
                    width: 6px;
                }

                .messages-container::-webkit-scrollbar-track {
                    background: transparent;
                }

                .messages-container::-webkit-scrollbar-thumb {
                    background: var(--vscode-scrollbarSlider-background, #464647);
                    border-radius: 3px;
                }

                .messages-container::-webkit-scrollbar-thumb:hover {
                    background: var(--vscode-scrollbarSlider-hoverBackground, #5a5a5a);
                }

                .message {
                    margin-bottom: 16px;
                    animation: slideIn 0.3s ease-out;
                    max-width: 85%;
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .message.user {
                    margin-left: auto;
                }

                .message.assistant {
                    margin-right: auto;
                }

                .message.system {
                    margin: 0 auto;
                    max-width: 70%;
                }

                .message-bubble {
                    padding: 12px 16px;
                    border-radius: 18px;
                    word-wrap: break-word;
                    line-height: 1.4;
                    position: relative;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                }

                .user .message-bubble {
                    background: var(--vscode-button-background, #0e639c);
                    color: var(--vscode-button-foreground, #ffffff);
                    border-bottom-right-radius: 6px;
                }

                .assistant .message-bubble {
                    background: var(--vscode-sideBar-background, #252526);
                    color: var(--vscode-editor-foreground, #cccccc);
                    border-bottom-left-radius: 6px;
                    border: 1px solid var(--vscode-panel-border, #464647);
                }

                .system .message-bubble {
                    background: var(--vscode-inputValidation-warningBackground, #4d4000);
                    color: var(--vscode-inputValidation-warningForeground, #ffcc02);
                    border-radius: 12px;
                    font-style: italic;
                    text-align: center;
                    border: 1px solid var(--vscode-inputValidation-warningBorder, #b89500);
                }

                .message-header {
                    font-size: 11px;
                    opacity: 0.8;
                    margin-bottom: 4px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: var(--vscode-descriptionForeground, #999999);
                }

                .message-content {
                    white-space: pre-wrap;
                    color: inherit;
                }

                .message-content code {
                    background: var(--vscode-textCodeBlock-background, #0f1419);
                    color: var(--vscode-editor-foreground, #cccccc);
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-family: var(--vscode-editor-font-family, 'Monaco', 'Menlo', 'Courier New', monospace);
                    font-size: 12px;
                }

                .input-container {
                    padding: 16px;
                    background: var(--vscode-sideBar-background, #252526);
                    border-top: 1px solid var(--vscode-panel-border, #464647);
                    display: flex;
                    gap: 12px;
                    align-items: flex-end;
                }

                .input-wrapper {
                    flex: 1;
                    position: relative;
                }

                .message-input {
                    width: 100%;
                    min-height: 40px;
                    max-height: 120px;
                    padding: 12px 16px;
                    background: var(--vscode-input-background, #3c3c3c);
                    color: var(--vscode-input-foreground, #cccccc);
                    border: 2px solid var(--vscode-input-border, #464647);
                    border-radius: 20px;
                    font-family: inherit;
                    font-size: 14px;
                    resize: none;
                    outline: none;
                    transition: all 0.2s ease;
                }

                .message-input:focus {
                    border-color: var(--vscode-focusBorder, #007acc);
                    box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.1);
                }

                .message-input::placeholder {
                    color: var(--vscode-input-placeholderForeground, #a6a6a6);
                    opacity: 0.8;
                }

                .send-btn {
                    width: 40px;
                    height: 40px;
                    background: var(--vscode-button-background, #0e639c);
                    color: var(--vscode-button-foreground, #ffffff);
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    font-size: 16px;
                }

                .send-btn:hover {
                    background: var(--vscode-button-hoverBackground, #1177bb);
                    transform: translateY(-1px) scale(1.05);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                }

                .send-btn:active {
                    transform: translateY(0) scale(0.95);
                }

                .send-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }

                .typing-indicator {
                    display: none;
                    padding: 12px 16px;
                    margin: 8px 0;
                    max-width: 85%;
                }

                .typing-indicator.active {
                    display: block;
                    animation: slideIn 0.3s ease-out;
                }

                .typing-dots {
                    display: flex;
                    gap: 4px;
                    align-items: center;
                    padding: 12px 16px;
                    background: var(--vscode-sideBar-background, #252526);
                    border-radius: 18px;
                    border-bottom-left-radius: 6px;
                    border: 1px solid var(--vscode-panel-border, #464647);
                }

                .typing-dot {
                    width: 8px;
                    height: 8px;
                    background: var(--vscode-editor-foreground, #cccccc);
                    border-radius: 50%;
                    opacity: 0.4;
                    animation: typing 1.4s infinite ease-in-out;
                }

                .typing-dot:nth-child(1) { animation-delay: -0.32s; }
                .typing-dot:nth-child(2) { animation-delay: -0.16s; }

                @keyframes typing {
                    0%, 80%, 100% {
                        opacity: 0.4;
                        transform: scale(1);
                    }
                    40% {
                        opacity: 1;
                        transform: scale(1.2);
                    }
                }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    text-align: center;
                    opacity: 0.7;
                    padding: 32px;
                }

                .empty-state-icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                    color: var(--vscode-editor-foreground, #cccccc);
                }

                .empty-state-title {
                    font-size: 18px;
                    font-weight: 600;
                    margin-bottom: 8px;
                    color: var(--vscode-editor-foreground, #cccccc);
                }

                .empty-state-subtitle {
                    font-size: 14px;
                    color: var(--vscode-descriptionForeground, #999999);
                    line-height: 1.5;
                }

                .status-indicator {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    margin-right: 6px;
                }

                .status-online {
                    background: #4CAF50;
                    box-shadow: 0 0 6px #4CAF50;
                }

                .status-thinking {
                    background: #FF9800;
                    animation: pulse 1s infinite;
                }

                .spinner {
                    display: inline-block;
                    width: 16px;
                    height: 16px;
                    border: 2px solid currentColor;
                    border-radius: 50%;
                    border-top-color: transparent;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="header-icon">🤖</div>
                <div class="header-title">CodeForgeX AI</div>
                <div class="mode-indicator" id="modeIndicator">
                    <span class="status-indicator status-online"></span>
                    Mode: Ask
                </div>
            </div>

            <div class="controls">
                <button class="control-btn primary" id="switchModeBtn" title="Switch AI Mode">
                    <span class="icon">⚙️</span>
                    Switch Mode
                </button>
                <button class="control-btn" id="clearChatBtn" title="Clear Chat History">
                    <span class="icon">🗑️</span>
                    Clear
                </button>
            </div>

            <div class="messages-container" id="messagesContainer">
                <div class="empty-state" id="emptyState">
                    <div class="empty-state-icon">🚀</div>
                    <div class="empty-state-title">Welcome to CodeForgeX</div>
                    <div class="empty-state-subtitle">
                        Your AI-powered coding companion is ready to help!<br>
                        Ask questions, analyze code, or get assistance with your project.
                    </div>
                </div>
                <div id="messages"></div>
                <div class="typing-indicator" id="typingIndicator">
                    <div class="typing-dots">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                </div>
            </div>

            <div class="input-container">
                <div class="input-wrapper">
                    <textarea id="messageInput" class="message-input" 
                             placeholder="Ask me anything about your code..." 
                             rows="1"></textarea>
                </div>
                <button class="send-btn" id="sendBtn" title="Send Message">
                    ▶
                </button>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                let isWaitingForResponse = false;
                
                function autoResize(textarea) {
                    textarea.style.height = 'auto';
                    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
                }
                
                function handleKeyDown(event) {
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage();
                    }
                }
                
                function sendMessage() {
                    if (isWaitingForResponse) return;
                    
                    const input = document.getElementById('messageInput');
                    const message = input.value.trim();
                    if (!message) return;
                    
                    isWaitingForResponse = true;
                    updateSendButton(false);
                    showTypingIndicator(true);
                    
                    vscode.postMessage({ type: 'sendMessage', message });
                    input.value = '';
                    autoResize(input);
                }
                
                function clearChat() {
                    vscode.postMessage({ type: 'clearChat' });
                    document.getElementById('emptyState').style.display = 'flex';
                }
                
                function switchMode() {
                    const indicator = document.getElementById('modeIndicator');
                    const statusSpan = indicator.querySelector('.status-indicator');
                    statusSpan.className = 'status-indicator status-thinking';
                    
                    vscode.postMessage({ type: 'switchMode' });
                    
                    setTimeout(() => {
                        statusSpan.className = 'status-indicator status-online';
                    }, 1000);
                }
                
                function updateSendButton(enabled) {
                    const btn = document.getElementById('sendBtn');
                    btn.disabled = !enabled;
                    btn.innerHTML = enabled ? '▶' : '<div class="spinner"></div>';
                }
                
                function showTypingIndicator(show) {
                    const indicator = document.getElementById('typingIndicator');
                    indicator.className = show ? 'typing-indicator active' : 'typing-indicator';
                    if (show) {
                        indicator.scrollIntoView({ behavior: 'smooth' });
                    }
                }
                
                function formatTimestamp(date) {
                    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
                
                function getModeIcon(mode) {
                    switch(mode) {
                        case 'edit': return '✏️';
                        case 'agent': return '🤖';
                        case 'ask': 
                        default: return '💬';
                    }
                }
                
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'updateMessages':
                            updateMessages(message.messages);
                            isWaitingForResponse = false;
                            updateSendButton(true);
                            showTypingIndicator(false);
                            break;
                        case 'updateMode':
                            updateMode(message.mode);
                            break;
                    }
                });
                
                function updateMessages(messages) {
                    const container = document.getElementById('messages');
                    const emptyState = document.getElementById('emptyState');
                    
                    if (messages.length === 0) {
                        container.innerHTML = '';
                        emptyState.style.display = 'flex';
                        return;
                    }
                    
                    emptyState.style.display = 'none';
                    
                    container.innerHTML = messages.map(msg => {
                        const timestamp = new Date(msg.timestamp);
                        const modeIcon = msg.mode ? getModeIcon(msg.mode) : '💬';
                        
                        // Properly escape HTML and handle line breaks
                        const escapedContent = msg.content
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&#39;')
                            .replace(/\n/g, '<br>');
                        
                        return \`
                            <div class="message \${msg.type}">
                                <div class="message-header">
                                    <span class="icon">\${modeIcon}</span>
                                    <span>\${msg.type.charAt(0).toUpperCase() + msg.type.slice(1)}</span>
                                    <span style="margin-left: auto; font-size: 10px;">\${formatTimestamp(timestamp)}</span>
                                </div>
                                <div class="message-bubble">
                                    <div class="message-content">\${escapedContent}</div>
                                </div>
                            </div>
                        \`;
                    }).join('');
                    
                    container.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
                }
                
                function updateMode(mode) {
                    const indicator = document.getElementById('modeIndicator');
                    const modeText = mode.charAt(0).toUpperCase() + mode.slice(1);
                    
                    indicator.innerHTML = \`
                        <span class="status-indicator status-online"></span>
                        Mode: \${modeText}
                    \`;
                    
                    // Add visual feedback
                    indicator.style.transform = 'scale(1.05)';
                    setTimeout(() => {
                        indicator.style.transform = 'scale(1)';
                    }, 200);
                }
                
                // Initialize immediately - webviews load scripts synchronously
                (function() {
                    const input = document.getElementById('messageInput');
                    const sendBtn = document.getElementById('sendBtn');
                    const switchModeBtn = document.getElementById('switchModeBtn');
                    const clearChatBtn = document.getElementById('clearChatBtn');
                    
                    console.log('Initializing...', { input, sendBtn, switchModeBtn, clearChatBtn });
                    
                    if (input) {
                        input.addEventListener('keydown', handleKeyDown);
                        input.addEventListener('input', function() { autoResize(this); });
                        input.focus();
                        console.log('Input events attached');
                    }
                    
                    if (sendBtn) {
                        sendBtn.addEventListener('click', sendMessage);
                        console.log('Send button event attached');
                    }
                    
                    if (switchModeBtn) {
                        switchModeBtn.addEventListener('click', switchMode);
                        console.log('Switch mode button event attached');
                    }
                    
                    if (clearChatBtn) {
                        clearChatBtn.addEventListener('click', clearChat);
                        console.log('Clear chat button event attached');
                    }
                })();
            </script>
        </body>
        </html>`;
    }
}
