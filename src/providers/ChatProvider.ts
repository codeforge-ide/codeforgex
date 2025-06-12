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
        if (!message.trim()) return;

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
                body { 
                    font-family: var(--vscode-font-family);
                    margin: 0; 
                    padding: 10px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .mode-indicator {
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.8em;
                    margin-bottom: 10px;
                    display: inline-block;
                }
                .messages { 
                    height: calc(100vh - 140px); 
                    overflow-y: auto; 
                    margin-bottom: 10px;
                    border: 1px solid var(--vscode-panel-border);
                    padding: 10px;
                }
                .message { 
                    margin-bottom: 10px; 
                    padding: 8px;
                    border-radius: 4px;
                }
                .user { 
                    background-color: var(--vscode-inputOption-activeBackground);
                    margin-left: 20px;
                }
                .assistant { 
                    background-color: var(--vscode-editor-selectionBackground);
                    margin-right: 20px;
                }
                .system { 
                    background-color: var(--vscode-inputValidation-errorBackground);
                    font-style: italic;
                }
                .input-container { 
                    display: flex; 
                    gap: 5px; 
                }
                input { 
                    flex: 1; 
                    padding: 8px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                }
                button { 
                    padding: 8px 12px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    cursor: pointer;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .controls {
                    display: flex;
                    gap: 5px;
                    margin-bottom: 10px;
                }
            </style>
        </head>
        <body>
            <div class="mode-indicator" id="modeIndicator">Mode: Ask</div>
            <div class="controls">
                <button onclick="switchMode()">Switch Mode</button>
                <button onclick="clearChat()">Clear Chat</button>
            </div>
            <div class="messages" id="messages"></div>
            <div class="input-container">
                <input type="text" id="messageInput" placeholder="Type your message..." 
                       onkeypress="if(event.key==='Enter') sendMessage()">
                <button onclick="sendMessage()">Send</button>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                function sendMessage() {
                    const input = document.getElementById('messageInput');
                    const message = input.value.trim();
                    if (message) {
                        vscode.postMessage({ type: 'sendMessage', message });
                        input.value = '';
                    }
                }
                
                function clearChat() {
                    vscode.postMessage({ type: 'clearChat' });
                }
                
                function switchMode() {
                    vscode.postMessage({ type: 'switchMode' });
                }
                
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'updateMessages':
                            updateMessages(message.messages);
                            break;
                        case 'updateMode':
                            updateMode(message.mode);
                            break;
                    }
                });
                
                function updateMessages(messages) {
                    const container = document.getElementById('messages');
                    container.innerHTML = messages.map(msg => 
                        '<div class="message ' + msg.type + '">' +
                        '<strong>' + msg.type + ':</strong> ' +
                        msg.content.replace(/\\n/g, '<br>') +
                        '</div>'
                    ).join('');
                    container.scrollTop = container.scrollHeight;
                }
                
                function updateMode(mode) {
                    const indicator = document.getElementById('modeIndicator');
                    indicator.textContent = 'Mode: ' + mode.charAt(0).toUpperCase() + mode.slice(1);
                }
            </script>
        </body>
        </html>`;
    }
}
