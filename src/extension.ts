import * as vscode from 'vscode';
import { Backend } from './backend';

export function activate(context: vscode.ExtensionContext) {
    console.log('VibeCoding Extension is now active!');

    // Register the sidebar webview provider
    const backend = new Backend(context);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'vibecoding.chatView',
            backend,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );

    // Register a command to focus the sidebar
    context.subscriptions.push(
        vscode.commands.registerCommand('vibecoding.chat', () => {
            // Focus the sidebar view instead of creating a new panel
            vscode.commands.executeCommand('vibecoding.chatView.focus');
        })
    );
}

export function deactivate() {}
