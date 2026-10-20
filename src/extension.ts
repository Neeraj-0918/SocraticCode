import * as vscode from 'vscode';
import * as path from 'path';
import { registerCommands } from './commands';
import { SocraticSidebarProvider } from './webview/sidebarProvider';
import { AnalysisService } from './analysis/analysisService';
import { detectLanguage } from './utils/languageDetector';

let analysisService: AnalysisService | null = null;
let sidebarProvider: SocraticSidebarProvider | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('SocraticCode is activating... Think Better. Code Smarter.');

  // Initialize Analysis Service with parsers directory
  const parsersDir = path.join(context.extensionPath, 'dist', 'parsers');
  analysisService = new AnalysisService();

  try {
    await analysisService.initialize(parsersDir);
    console.log('Tree-sitter AnalysisService initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize Tree-sitter parsers:', err);
    vscode.window.showErrorMessage(
      `SocraticCode: Failed to load AST parser assets: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Register Webview Sidebar Provider
  sidebarProvider = new SocraticSidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SocraticSidebarProvider.viewType,
      sidebarProvider
    )
  );

  // Helper to run analysis on current document
  const runAnalysis = async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('SocraticCode: Please open a Python or C file to analyze.');
      return;
    }

    if (!analysisService) {
      vscode.window.showErrorMessage('SocraticCode: Analysis service not ready.');
      return;
    }

    const doc = editor.document;
    const content = doc.getText();
    const filePath = doc.fileName;
    const languageId = doc.languageId;

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'SocraticCode: Analyzing code structure (AST)...',
        cancellable: false,
      },
      async () => {
        const result = await analysisService!.analyzeDocument(filePath, languageId, content);
        const html = analysisService!.formatFindingsToHtml(result);

        sidebarProvider?.postMessage({
          type: 'analysisResult',
          html,
          result,
        });

        sidebarProvider?.postMessage({
          type: 'updateStatus',
          language: result.language.toUpperCase(),
          provider: 'Demo Mode',
          isAi: false,
        });
      }
    );
  };

  // Register all 8 commands with hooks
  registerCommands(context, {
    onOpenTutor: async () => {
      await vscode.commands.executeCommand('workbench.view.extension.socraticcode-container');
      sidebarProvider?.show();
    },
    onAnalyzeFile: async () => {
      await runAnalysis();
    },
    onClearSession: async () => {
      sidebarProvider?.postMessage({ type: 'clearSession' });
      vscode.window.showInformationMessage('SocraticCode: Learning session reset.');
    },
  });

  // Track active editor switch to update language badge
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        const lang = detectLanguage(editor.document.fileName, editor.document.languageId);
        sidebarProvider?.postMessage({
          type: 'updateStatus',
          language: lang !== 'unsupported' ? lang.toUpperCase() : 'Unsupported',
        });
      } else {
        sidebarProvider?.postMessage({
          type: 'updateStatus',
          language: 'No file open',
        });
      }
    })
  );

  console.log('SocraticCode successfully activated!');
}

export function deactivate(): void {
  console.log('SocraticCode deactivated.');
}
