import * as vscode from 'vscode';
import { ExtensionServices } from '../types';

export function registerCommands(context: vscode.ExtensionContext, services: ExtensionServices) {
    const commands = [
        // Chat commands
        vscode.commands.registerCommand('codeforgex.openChat', () => {
            vscode.commands.executeCommand('codeforgex.chatView.focus');
        }),

        // Context management commands
        vscode.commands.registerCommand('codeforgex.addFile', async (uri?: vscode.Uri) => {
            if (!uri) {
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor) {
                    uri = activeEditor.document.uri;
                } else {
                    vscode.window.showErrorMessage('No file selected');
                    return;
                }
            }
            await services.contextProvider.addFile(uri);
        }),

        vscode.commands.registerCommand('codeforgex.removeFile', (contextFile: any) => {
            services.contextProvider.removeFile(contextFile.uri);
        }),

        vscode.commands.registerCommand('codeforgex.toggleFileActive', (contextFile: any) => {
            services.contextProvider.toggleFileActive(contextFile.uri);
        }),

        vscode.commands.registerCommand('codeforgex.clearContext', () => {
            services.contextProvider.clearContext();
        }),

        // Mode management commands
        vscode.commands.registerCommand('codeforgex.switchMode', () => {
            services.modeManager.switchMode();
        }),

        vscode.commands.registerCommand('codeforgex.selectMode', () => {
            services.modeManager.selectMode();
        }),

        // CodeForge integration commands
        vscode.commands.registerCommand('codeforgex.explainCode', async () => {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }

            try {
                const result = await services.codeForgeService.explainCode(activeEditor.document.uri.fsPath);
                const panel = vscode.window.createWebviewPanel(
                    'codeExplanation',
                    'Code Explanation',
                    vscode.ViewColumn.Beside,
                    { enableScripts: true }
                );
                panel.webview.html = `
                    <html>
                        <body style="font-family: var(--vscode-font-family); padding: 20px;">
                            <h2>Code Explanation</h2>
                            <pre style="white-space: pre-wrap; background: var(--vscode-textCodeBlock-background); padding: 15px; border-radius: 4px;">${result}</pre>
                        </body>
                    </html>
                `;
            } catch (error) {
                vscode.window.showErrorMessage(`Error explaining code: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),

        vscode.commands.registerCommand('codeforgex.generateCommitMessage', async () => {
            try {
                const message = await services.codeForgeService.generateCommitMessage();
                const input = await vscode.window.showInputBox({
                    prompt: 'Commit message (edit if needed)',
                    value: message,
                    ignoreFocusOut: true
                });
                
                if (input) {
                    // Copy to clipboard or set in Git extension
                    await vscode.env.clipboard.writeText(input);
                    vscode.window.showInformationMessage('Commit message copied to clipboard');
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Error generating commit message: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),

        vscode.commands.registerCommand('codeforgex.analyzeProject', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder open');
                return;
            }

            try {
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Analyzing project...',
                    cancellable: false
                }, async () => {
                    const result = await services.codeForgeService.analyzeProject(workspaceFolder.uri.fsPath);
                    const panel = vscode.window.createWebviewPanel(
                        'projectAnalysis',
                        'Project Analysis',
                        vscode.ViewColumn.Beside,
                        { enableScripts: true }
                    );
                    panel.webview.html = `
                        <html>
                            <body style="font-family: var(--vscode-font-family); padding: 20px;">
                                <h2>Project Analysis</h2>
                                <pre style="white-space: pre-wrap; background: var(--vscode-textCodeBlock-background); padding: 15px; border-radius: 4px;">${result}</pre>
                            </body>
                        </html>
                    `;
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Error analyzing project: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),

        // Configuration commands
        vscode.commands.registerCommand('codeforgex.openSettings', () => {
            services.configManager.openSettings();
        }),

        vscode.commands.registerCommand('codeforgex.testConnection', () => {
            services.configManager.testCliConnection();
        })
    ];

    // Add all commands to subscriptions
    commands.forEach(command => context.subscriptions.push(command));
}
