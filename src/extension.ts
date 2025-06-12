import * as vscode from 'vscode';
import { ChatProvider } from './providers/ChatProvider';
import { ContextProvider } from './providers/ContextProvider';
import { CodeForgeService } from './services/CodeForgeService';
import { ConfigurationManager } from './managers/ConfigurationManager';
import { ModeManager } from './managers/ModeManager';
import { registerCommands } from './commands';

export async function activate(context: vscode.ExtensionContext) {
    console.log('CodeForgeX extension is now active!');

    // Initialize services
    const configManager = new ConfigurationManager();
    const codeForgeService = new CodeForgeService(configManager);
    const modeManager = new ModeManager();
    
    // Initialize providers
    const contextProvider = new ContextProvider();
    const chatProvider = new ChatProvider(context.extensionUri, codeForgeService, contextProvider, modeManager);

    // Register tree data providers
    const contextView = vscode.window.createTreeView('codeforgex.contextView', {
        treeDataProvider: contextProvider,
        showCollapseAll: true
    });

    // Register webview provider
    const chatViewProvider = vscode.window.registerWebviewViewProvider('codeforgex.chatView', chatProvider);

    // Register commands
    registerCommands(context, {
        chatProvider,
        contextProvider,
        codeForgeService,
        modeManager,
        configManager
    });

    // Add to subscriptions for cleanup
    context.subscriptions.push(
        contextView,
        chatViewProvider,
        // Services will be disposed through command registrations
    );

    // Show welcome message on first activation
    const hasShownWelcome = context.globalState.get('hasShownWelcome', false);
    if (!hasShownWelcome) {
        vscode.window.showInformationMessage(
            'Welcome to CodeForgeX! Your AI-powered coding companion is ready.',
            'Open Chat'
        ).then(selection => {
            if (selection === 'Open Chat') {
                vscode.commands.executeCommand('codeforgex.openChat');
            }
        });
        context.globalState.update('hasShownWelcome', true);
    }
}

export function deactivate() {
    console.log('CodeForgeX extension is deactivated');
}
