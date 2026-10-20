import * as vscode from 'vscode';
import { registerCommands, COMMAND_IDS } from './commands';
import { SocraticSidebarProvider } from './webview/sidebarProvider';

export function activate(context: vscode.ExtensionContext): void {
  console.log('SocraticCode is activating... Think Better. Code Smarter.');

  // Register Webview Sidebar Provider
  const sidebarProvider = new SocraticSidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SocraticSidebarProvider.viewType,
      sidebarProvider
    )
  );

  // Register all 8 commands with hooks into the sidebar
  registerCommands(context, {
    onOpenTutor: async () => {
      await vscode.commands.executeCommand('workbench.view.extension.socraticcode-container');
      sidebarProvider.show();
    },
    onClearSession: async () => {
      sidebarProvider.postMessage({ type: 'clearSession' });
      vscode.window.showInformationMessage('SocraticCode: Learning session reset.');
    },
  });

  console.log('SocraticCode successfully activated!');
}

export function deactivate(): void {
  console.log('SocraticCode deactivated.');
}
