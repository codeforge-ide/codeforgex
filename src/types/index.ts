import * as vscode from 'vscode';

export interface ChatMessage {
    id: string;
    type: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    mode?: ExtensionMode;
}

export interface ContextFile {
    uri: vscode.Uri;
    name: string;
    relativePath: string;
    content?: string;
    isActive: boolean;
}

export enum ExtensionMode {
    Edit = 'edit',
    Agent = 'agent', 
    Ask = 'ask'
}

export interface CodeForgeConfig {
    cliPath: string;
    defaultModel: string;
    enableMcp: boolean;
    mcpProviders: string[];
    timeout: number;
}

export interface CommandResponse {
    success: boolean;
    output: string;
    error?: string;
}

export interface ExtensionServices {
    chatProvider: any;
    contextProvider: any;
    codeForgeService: any;
    modeManager: any;
    configManager: any;
}
