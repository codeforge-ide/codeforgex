import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ContextFile, CommandResponse } from '../types';
import { ConfigurationManager } from '../managers/ConfigurationManager';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export class CodeForgeService {
    constructor(private _configManager: ConfigurationManager) {}

    async processPrompt(prompt: string, contextFiles: ContextFile[]): Promise<string> {
        const contextContent = this._buildContextContent(contextFiles);
        const fullPrompt = contextContent ? `Context:\n${contextContent}\n\nQuery: ${prompt}` : prompt;
        
        return this._executeCommand(['prompt', `"${fullPrompt}"`]);
    }

    async processEdit(request: string, contextFiles: ContextFile[]): Promise<string> {
        if (contextFiles.length === 0) {
            throw new Error('No files in context for editing. Please add files to context first.');
        }

        // Create temporary files for editing
        const tempDir = await this._createTempContext(contextFiles);
        
        try {
            const result = await this._executeCommand([
                'edit', 
                tempDir,
                '--user_prompt', 
                `"${request}"`
            ]);

            // Check for .codeforgedit files and offer to apply changes
            await this._handleEditResults(tempDir, contextFiles);
            
            return result;
        } finally {
            // Cleanup temp directory
            await this._cleanupTempDir(tempDir);
        }
    }

    async processAgent(request: string, contextFiles: ContextFile[]): Promise<string> {
        // Agent mode combines analysis and suggestions
        const contextContent = this._buildContextContent(contextFiles);
        
        // First analyze the context
        const analysisPrompt = contextContent 
            ? `Analyze this codebase and then respond to: ${request}\n\nContext:\n${contextContent}`
            : `Act as a coding agent and respond to: ${request}`;
            
        return this._executeCommand(['prompt', `"${analysisPrompt}"`]);
    }

    async explainCode(filePath: string): Promise<string> {
        return this._executeCommand(['explain', `"${filePath}"`]);
    }

    async generateCommitMessage(): Promise<string> {
        return this._executeCommand(['commit-message']);
    }

    async analyzeProject(path?: string): Promise<string> {
        const args = ['analyze'];
        if (path) {
            args.push(`"${path}"`);
        }
        return this._executeCommand(args);
    }

    private _buildContextContent(contextFiles: ContextFile[]): string {
        return contextFiles
            .filter(f => f.isActive && f.content)
            .map(f => `// File: ${f.relativePath}\n${f.content}`)
            .join('\n\n---\n\n');
    }

    private async _executeCommand(args: string[]): Promise<string> {
        const config = this._configManager.getConfig();
        const cliPath = config.cliPath || 'codeforgeai';
        const command = `${cliPath} ${args.join(' ')}`;
        
        try {
            const { stdout, stderr } = await execAsync(command, {
                timeout: config.timeout || 30000,
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            });
            
            if (stderr && !stdout) {
                throw new Error(stderr);
            }
            
            return stdout || stderr || 'Command executed successfully';
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`CodeForgeAI CLI error: ${error.message}`);
            }
            throw new Error('Unknown error executing CodeForgeAI CLI');
        }
    }

    private async _createTempContext(contextFiles: ContextFile[]): Promise<string> {
        const tempDir = path.join(require('os').tmpdir(), 'codeforgex-' + Date.now());
        await fs.promises.mkdir(tempDir, { recursive: true });
        
        for (const file of contextFiles) {
            if (file.content) {
                const filePath = path.join(tempDir, file.relativePath);
                await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
                await fs.promises.writeFile(filePath, file.content);
            }
        }
        
        return tempDir;
    }

    private async _handleEditResults(tempDir: string, originalFiles: ContextFile[]): Promise<void> {
        // Look for .codeforgedit files
        const editFiles = await this._findEditFiles(tempDir);
        
        if (editFiles.length > 0) {
            const action = await vscode.window.showInformationMessage(
                `Found ${editFiles.length} edited file(s). Apply changes?`,
                'Apply All',
                'Review Each',
                'Cancel'
            );
            
            if (action === 'Apply All') {
                await this._applyAllEdits(editFiles, originalFiles);
            } else if (action === 'Review Each') {
                await this._reviewEdits(editFiles, originalFiles);
            }
        }
    }

    private async _findEditFiles(dir: string): Promise<string[]> {
        const editFiles: string[] = [];
        
        async function traverse(currentDir: string) {
            const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                
                if (entry.isDirectory()) {
                    await traverse(fullPath);
                } else if (entry.name.endsWith('.codeforgedit')) {
                    editFiles.push(fullPath);
                }
            }
        }
        
        await traverse(dir);
        return editFiles;
    }

    private async _applyAllEdits(editFiles: string[], originalFiles: ContextFile[]): Promise<void> {
        for (const editFile of editFiles) {
            const originalPath = editFile.replace('.codeforgedit', '');
            const originalFile = originalFiles.find(f => originalPath.endsWith(f.relativePath));
            
            if (originalFile) {
                const editedContent = await fs.promises.readFile(editFile, 'utf8');
                const document = await vscode.workspace.openTextDocument(originalFile.uri);
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(document.getText().length)
                );
                edit.replace(originalFile.uri, fullRange, editedContent);
                await vscode.workspace.applyEdit(edit);
            }
        }
        
        vscode.window.showInformationMessage('All edits applied successfully!');
    }

    private async _reviewEdits(editFiles: string[], originalFiles: ContextFile[]): Promise<void> {
        // Implementation for reviewing edits one by one
        // This would show diff views for each edited file
        vscode.window.showInformationMessage('Review mode not yet implemented');
    }

    private async _cleanupTempDir(tempDir: string): Promise<void> {
        try {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            console.warn(`Failed to cleanup temp directory: ${tempDir}`);
        }
    }
}
