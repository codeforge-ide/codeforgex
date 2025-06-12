import * as vscode from 'vscode';
import { ExtensionMode } from '../types';

export class ModeManager {
    private _currentMode: ExtensionMode = ExtensionMode.Ask;
    private _onModeChanged = new vscode.EventEmitter<ExtensionMode>();
    
    readonly onModeChanged = this._onModeChanged.event;

    getCurrentMode(): ExtensionMode {
        return this._currentMode;
    }

    setMode(mode: ExtensionMode): void {
        if (this._currentMode !== mode) {
            this._currentMode = mode;
            this._onModeChanged.fire(mode);
            vscode.window.showInformationMessage(`Switched to ${mode.toUpperCase()} mode`);
        }
    }

    switchMode(): void {
        const modes = Object.values(ExtensionMode);
        const currentIndex = modes.indexOf(this._currentMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.setMode(modes[nextIndex]);
    }

    async selectMode(): Promise<void> {
        const modes = Object.values(ExtensionMode);
        const items = modes.map(mode => ({
            label: mode.charAt(0).toUpperCase() + mode.slice(1),
            description: this._getModeDescription(mode),
            mode
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select CodeForgeX mode'
        });

        if (selected) {
            this.setMode(selected.mode);
        }
    }

    private _getModeDescription(mode: ExtensionMode): string {
        switch (mode) {
            case ExtensionMode.Edit:
                return 'Direct file editing with AI assistance';
            case ExtensionMode.Agent:
                return 'Autonomous AI agent for complex tasks';
            case ExtensionMode.Ask:
                return 'Question & answer mode';
            default:
                return '';
        }
    }
}
