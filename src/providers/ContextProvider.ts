import * as vscode from 'vscode';
import { ContextFile } from '../types';
import * as path from 'path';

export class ContextProvider implements vscode.TreeDataProvider<ContextFile> {
    private _onDidChangeTreeData: vscode.EventEmitter<ContextFile | undefined | null | void> = new vscode.EventEmitter<ContextFile | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ContextFile | undefined | null | void> = this._onDidChangeTreeData.event;

    private _contextFiles: ContextFile[] = [];

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ContextFile): vscode.TreeItem {
        const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
        item.resourceUri = element.uri;
        item.description = element.relativePath;
        item.tooltip = `${element.uri.fsPath}\n${element.isActive ? 'Active in context' : 'Inactive'}`;
        
        item.contextValue = 'contextFile';
        item.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [element.uri]
        };

        // Visual indicator for active/inactive files
        if (element.isActive) {
            item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
        } else {
            item.iconPath = new vscode.ThemeIcon('circle-outline');
        }

        return item;
    }

    getChildren(element?: ContextFile): Thenable<ContextFile[]> {
        if (!element) {
            return Promise.resolve(this._contextFiles);
        }
        return Promise.resolve([]);
    }

    async addFile(uri: vscode.Uri): Promise<void> {
        // Check if file already exists in context
        const existing = this._contextFiles.find(f => f.uri.toString() === uri.toString());
        if (existing) {
            vscode.window.showInformationMessage(`File ${path.basename(uri.fsPath)} is already in context`);
            return;
        }

        // Read file content
        let content: string | undefined;
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            content = document.getText();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return;
        }

        // Get relative path
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        const relativePath = workspaceFolder 
            ? path.relative(workspaceFolder.uri.fsPath, uri.fsPath)
            : path.basename(uri.fsPath);

        const contextFile: ContextFile = {
            uri,
            name: path.basename(uri.fsPath),
            relativePath,
            content,
            isActive: true
        };

        this._contextFiles.push(contextFile);
        this.refresh();
        
        vscode.window.showInformationMessage(`Added ${contextFile.name} to context`);
    }

    removeFile(uri: vscode.Uri): void {
        const index = this._contextFiles.findIndex(f => f.uri.toString() === uri.toString());
        if (index !== -1) {
            const removed = this._contextFiles.splice(index, 1)[0];
            this.refresh();
            vscode.window.showInformationMessage(`Removed ${removed.name} from context`);
        }
    }

    toggleFileActive(uri: vscode.Uri): void {
        const file = this._contextFiles.find(f => f.uri.toString() === uri.toString());
        if (file) {
            file.isActive = !file.isActive;
            this.refresh();
        }
    }

    clearContext(): void {
        this._contextFiles = [];
        this.refresh();
        vscode.window.showInformationMessage('Context cleared');
    }

    getContextFiles(): ContextFile[] {
        return this._contextFiles.filter(f => f.isActive);
    }

    getActiveContextContent(): string {
        return this._contextFiles
            .filter(f => f.isActive && f.content)
            .map(f => `// File: ${f.relativePath}\n${f.content}`)
            .join('\n\n---\n\n');
    }
}
