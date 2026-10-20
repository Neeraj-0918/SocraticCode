import * as vscode from 'vscode';

export const COMMAND_IDS = {
  openTutor: 'socraticcode.openTutor',
  analyzeFile: 'socraticcode.analyzeCurrentFile',
  askAboutSelection: 'socraticcode.askAboutSelection',
  requestNextHint: 'socraticcode.requestNextHint',
  openDashboard: 'socraticcode.openDashboard',
  clearSession: 'socraticcode.clearSession',
  configureProvider: 'socraticcode.configureProvider',
  switchDemoMode: 'socraticcode.switchDemoMode',
} as const;

export type CommandId = typeof COMMAND_IDS[keyof typeof COMMAND_IDS];

export interface CommandCallbacks {
  onOpenTutor?: () => void | Promise<void>;
  onAnalyzeFile?: () => void | Promise<void>;
  onAskAboutSelection?: (question?: string) => void | Promise<void>;
  onRequestNextHint?: () => void | Promise<void>;
  onOpenDashboard?: () => void | Promise<void>;
  onClearSession?: () => void | Promise<void>;
  onConfigureProvider?: () => void | Promise<void>;
  onSwitchDemoMode?: () => void | Promise<void>;
}

export function registerCommands(
  context: vscode.ExtensionContext,
  callbacks: CommandCallbacks = {}
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [
    vscode.commands.registerCommand(COMMAND_IDS.openTutor, async () => {
      if (callbacks.onOpenTutor) {
        await callbacks.onOpenTutor();
      } else {
        vscode.window.showInformationMessage('SocraticCode: Opening tutor...');
      }
    }),

    vscode.commands.registerCommand(COMMAND_IDS.analyzeFile, async () => {
      if (callbacks.onAnalyzeFile) {
        await callbacks.onAnalyzeFile();
      } else {
        vscode.window.showInformationMessage('SocraticCode: Analyzing current file...');
      }
    }),

    vscode.commands.registerCommand(COMMAND_IDS.askAboutSelection, async (question?: string) => {
      if (callbacks.onAskAboutSelection) {
        await callbacks.onAskAboutSelection(question);
      } else {
        vscode.window.showInformationMessage('SocraticCode: Asking about selection...');
      }
    }),

    vscode.commands.registerCommand(COMMAND_IDS.requestNextHint, async () => {
      if (callbacks.onRequestNextHint) {
        await callbacks.onRequestNextHint();
      } else {
        vscode.window.showInformationMessage('SocraticCode: Requesting next hint...');
      }
    }),

    vscode.commands.registerCommand(COMMAND_IDS.openDashboard, async () => {
      if (callbacks.onOpenDashboard) {
        await callbacks.onOpenDashboard();
      } else {
        vscode.window.showInformationMessage('SocraticCode: Opening learning dashboard...');
      }
    }),

    vscode.commands.registerCommand(COMMAND_IDS.clearSession, async () => {
      if (callbacks.onClearSession) {
        await callbacks.onClearSession();
      } else {
        vscode.window.showInformationMessage('SocraticCode: Clearing current session...');
      }
    }),

    vscode.commands.registerCommand(COMMAND_IDS.configureProvider, async () => {
      if (callbacks.onConfigureProvider) {
        await callbacks.onConfigureProvider();
      } else {
        vscode.window.showInformationMessage('SocraticCode: Configuring AI provider...');
      }
    }),

    vscode.commands.registerCommand(COMMAND_IDS.switchDemoMode, async () => {
      if (callbacks.onSwitchDemoMode) {
        await callbacks.onSwitchDemoMode();
      } else {
        vscode.window.showInformationMessage('SocraticCode: Switching demo mode...');
      }
    }),
  ];

  context.subscriptions.push(...disposables);
  return disposables;
}
