import * as vscode from 'vscode';
import * as path from 'path';
import { registerCommands } from './commands';
import { SocraticSidebarProvider } from './webview/sidebarProvider';
import { AnalysisService } from './analysis/analysisService';
import { TutorService } from './tutor/tutorService';
import { DemoProvider } from './providers/demoProvider';
import { detectLanguage } from './utils/languageDetector';
import { AnalysisResult } from './analysis/types';

let analysisService: AnalysisService | null = null;
let tutorService: TutorService | null = null;
let sidebarProvider: SocraticSidebarProvider | null = null;
let lastAnalysisResult: AnalysisResult | null = null;

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

  // Initialize TutorService with default DemoProvider
  const demoProvider = new DemoProvider();
  tutorService = new TutorService(demoProvider);

  // Register Webview Sidebar Provider
  sidebarProvider = new SocraticSidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SocraticSidebarProvider.viewType,
      sidebarProvider
    )
  );

  // Helper to run analysis on current document
  const runAnalysis = async (): Promise<AnalysisResult | null> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('SocraticCode: Please open a Python or C file to analyze.');
      return null;
    }

    if (!analysisService) {
      vscode.window.showErrorMessage('SocraticCode: Analysis service not ready.');
      return null;
    }

    const doc = editor.document;
    const content = doc.getText();
    const filePath = doc.fileName;
    const languageId = doc.languageId;

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'SocraticCode: Analyzing code structure (AST)...',
        cancellable: false,
      },
      async () => {
        const result = await analysisService!.analyzeDocument(filePath, languageId, content);
        lastAnalysisResult = result;
        const html = analysisService!.formatFindingsToHtml(result);

        sidebarProvider?.postMessage({
          type: 'analysisResult',
          html,
          result,
        });

        sidebarProvider?.postMessage({
          type: 'updateStatus',
          language: result.language.toUpperCase(),
          provider: tutorService?.providerName || 'Demo Mode',
          isAi: false,
        });

        return result;
      }
    );
  };

  // Helper to handle asking a question
  const handleAskQuestion = async (questionText?: string) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('SocraticCode: Please open a file first.');
      return;
    }

    // Ensure we have active AST analysis findings
    let analysis = lastAnalysisResult;
    if (!analysis) {
      analysis = await runAnalysis();
    }
    if (!analysis || !tutorService) return;

    // Get selected code if any, or entire document
    const selection = editor.selection;
    const selectedText = selection && !selection.isEmpty
      ? editor.document.getText(selection)
      : editor.document.getText();

    const question = questionText || 'Help me understand where I might be stuck or what this code is doing.';

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'SocraticCode: Generating progressive hint...',
        cancellable: false,
      },
      async () => {
        const response = await tutorService!.askQuestion(question, selectedText, analysis!);
        const cardHtml = tutorService!.formatResponseToCardHtml(response);

        sidebarProvider?.postMessage({
          type: 'hintResult',
          level: response.hintLevel,
          cardHtml,
        });
      }
    );
  };

  // Helper to handle requesting the next hint level
  const handleRequestNextHint = async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !tutorService) {
      vscode.window.showWarningMessage('SocraticCode: Please open a file first.');
      return;
    }

    if (!tutorService.hasMoreHints) {
      vscode.window.showInformationMessage('SocraticCode: All 3 progressive hint levels have been revealed!');
      return;
    }

    let analysis = lastAnalysisResult;
    if (!analysis) {
      analysis = await runAnalysis();
    }
    if (!analysis) return;

    const code = editor.document.getText();

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `SocraticCode: Generating Level ${tutorService.currentHintLevel + 1} hint...`,
        cancellable: false,
      },
      async () => {
        const response = await tutorService!.requestNextHint(code, analysis!);
        const cardHtml = tutorService!.formatResponseToCardHtml(response);

        sidebarProvider?.postMessage({
          type: 'hintResult',
          level: response.hintLevel,
          cardHtml,
        });
      }
    );
  };

  // Register all 8 commands
  registerCommands(context, {
    onOpenTutor: async () => {
      await vscode.commands.executeCommand('workbench.view.extension.socraticcode-container');
      sidebarProvider?.show();
    },
    onAnalyzeFile: async () => {
      await runAnalysis();
    },
    onAskAboutSelection: async (question) => {
      await handleAskQuestion(question);
    },
    onRequestNextHint: async () => {
      await handleRequestNextHint();
    },
    onClearSession: async () => {
      tutorService?.resetSession();
      lastAnalysisResult = null;
      sidebarProvider?.postMessage({ type: 'clearSession' });
      vscode.window.showInformationMessage('SocraticCode: Learning session reset.');
    },
  });

  // Track active editor switch
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
