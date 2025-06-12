import * as vscode from 'vscode';
import { CodeForgeConfig } from '../types';

export class ConfigurationManager {
    private static readonly CONFIG_SECTION = 'codeforgex';

    getConfig(): CodeForgeConfig {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
        
        return {
            cliPath: config.get('cliPath', 'codeforgeai'),
            defaultModel: config.get('defaultModel', 'ollama'),
            enableMcp: config.get('enableMcp', false),
            mcpProviders: config.get('mcpProviders', []),
            timeout: config.get('timeout', 30000)
        };
    }

    async updateConfig(key: keyof CodeForgeConfig, value: any): Promise<void> {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
        await config.update(key, value, vscode.ConfigurationTarget.Global);
    }

    async openSettings(): Promise<void> {
        await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:codeforgex');
    }

    validateConfig(): boolean {
        const config = this.getConfig();
        
        // Basic validation
        if (!config.cliPath) {
            vscode.window.showErrorMessage('CodeForgeX: CLI path not configured');
            return false;
        }
        
        return true;
    }

    async testCliConnection(): Promise<boolean> {
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            
            const config = this.getConfig();
            await execAsync(`${config.cliPath} --version`, { timeout: 5000 });
            
            vscode.window.showInformationMessage('CodeForgeAI CLI connection successful!');
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(
                'Failed to connect to CodeForgeAI CLI. Please check your configuration.',
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    this.openSettings();
                }
            });
            return false;
        }
    }
}
