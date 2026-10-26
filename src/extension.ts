import * as vscode from 'vscode';
import * as path from 'path';
import { registerCommands } from './commands';
import { SocraticSidebarProvider } from './webview/sidebarProvider';
import { AnalysisService } from './analysis/analysisService';
import { TutorService } from './tutor/tutorService';
import { DemoProvider } from './providers/demoProvider';
import { GeminiProvider } from './providers/geminiProvider';
import { KeyManager } from './providers/keyManager';
import { detectLanguage } from './utils/languageDetector';
import { AnalysisResult } from './analysis/types';
import { AnalyticsStore } from './analytics/analyticsStore';
import { DashboardPanel } from './webview/dashboardPanel';

let analysisService: AnalysisService | null = null;
let tutorService: TutorService | null = null;
let demoProvider: DemoProvider | null = null;
let geminiProvider: GeminiProvider | null = null;
let keyManager: KeyManager | null = null;
let sidebarProvider: SocraticSidebarProvider | null = null;
let analyticsStore: AnalyticsStore | null = null;
let lastAnalysisResult: AnalysisResult | null = null;
let isAiMode = false;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('SocraticCode is activating... Think Better. Code Smarter.');

  // Initialize KeyManager with VS Code SecretStorage
  keyManager = new KeyManager(context.secrets);

  // Initialize Analytics Store with globalState
  analyticsStore = new AnalyticsStore(context.globalState);

  // Initialize Providers
  demoProvider = new DemoProvider();
  geminiProvider = new GeminiProvider(async () => keyManager!.getApiKey());

  // Check if API key exists
  const hasKey = await keyManager.hasApiKey();
  isAiMode = hasKey;

  // Initialize TutorService with active provider
  tutorService = new TutorService(isAiMode ? geminiProvider : demoProvider);

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

  const updateSidebarStatus = () => {
    const editor = vscode.window.activeTextEditor;
    const lang = editor
      ? detectLanguage(editor.document.fileName, editor.document.languageId).toUpperCase()
      : 'No file open';

    sidebarProvider?.postMessage({
      type: 'updateStatus',
      language: lang,
      provider: isAiMode ? 'Gemini 2.0 (Active)' : 'Demo Mode',
      isAi: isAiMode,
    });
  };

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

        updateSidebarStatus();
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

    let analysis = lastAnalysisResult;
    if (!analysis) {
      analysis = await runAnalysis();
    }
    if (!analysis || !tutorService) return;

    const selection = editor.selection;
    const selectedText = selection && !selection.isEmpty
      ? editor.document.getText(selection)
      : editor.document.getText();

    const question = (typeof questionText === 'string' && questionText.trim().length > 0)
      ? questionText.trim()
      : 'Help me understand where I might be stuck or what this code is doing.';

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `SocraticCode (${isAiMode ? 'Gemini AI' : 'Demo'}): Generating progressive hint...`,
        cancellable: false,
      },
      async () => {
        try {
          const response = await tutorService!.askQuestion(question, selectedText, analysis!);
          const cardHtml = tutorService!.formatResponseToCardHtml(response);

          sidebarProvider?.postMessage({
            type: 'hintResult',
            level: response.hintLevel,
            cardHtml,
          });

          await analyticsStore?.recordSession({
            id: `sess-${Date.now()}`,
            timestamp: Date.now(),
            language: analysis!.language,
            question,
            concept: response.conceptCategory || AnalyticsStore.inferConcept(question, analysis!.language),
            maxHintLevel: response.hintLevel,
            provider: tutorService!.providerName,
            wasFallback: Boolean(response.isFallback),
          });
        } catch (err: any) {
          vscode.window.showErrorMessage(`SocraticCode: ${err.message || String(err)}`);
          if (isAiMode) {
            vscode.window.showInformationMessage('SocraticCode: Falling back to Demo Mode for this request.');
            tutorService!.setProvider(demoProvider!);
            isAiMode = false;
            updateSidebarStatus();
            const fallbackResponse = await tutorService!.askQuestion(question, selectedText, analysis!);
            sidebarProvider?.postMessage({
              type: 'hintResult',
              level: fallbackResponse.hintLevel,
              cardHtml: tutorService!.formatResponseToCardHtml(fallbackResponse),
            });
            await analyticsStore?.recordSession({
              id: `sess-${Date.now()}`,
              timestamp: Date.now(),
              language: analysis!.language,
              question,
              concept: fallbackResponse.conceptCategory || AnalyticsStore.inferConcept(question, analysis!.language),
              maxHintLevel: fallbackResponse.hintLevel,
              provider: 'Demo Mode (Fallback)',
              wasFallback: true,
            });
          }
        }
      }
    );
  };

  // Helper to handle requesting next hint
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
        title: `SocraticCode (${isAiMode ? 'Gemini AI' : 'Demo'}): Generating Level ${tutorService.currentHintLevel + 1} hint...`,
        cancellable: false,
      },
      async () => {
        try {
          const response = await tutorService!.requestNextHint(code, analysis!);
          const cardHtml = tutorService!.formatResponseToCardHtml(response);

          sidebarProvider?.postMessage({
            type: 'hintResult',
            level: response.hintLevel,
            cardHtml,
          });

          await analyticsStore?.recordSession({
            id: `sess-${Date.now()}`,
            timestamp: Date.now(),
            language: analysis!.language,
            question: `Requested Level ${response.hintLevel} Hint`,
            concept: response.conceptCategory || 'Progressive Scaffold',
            maxHintLevel: response.hintLevel,
            provider: tutorService!.providerName,
            wasFallback: Boolean(response.isFallback),
          });
        } catch (err: any) {
          vscode.window.showErrorMessage(`SocraticCode: ${err.message || String(err)}`);
        }
      }
    );
  };

  // Helper to handle exploring alternative / optimized approach
  const handleExploreAlternative = async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !tutorService) {
      vscode.window.showWarningMessage('SocraticCode: Please open a file first.');
      return;
    }

    let analysis = lastAnalysisResult;
    if (!analysis) {
      analysis = await runAnalysis();
    }
    if (!analysis) return;

    const selection = editor.selection;
    const selectedText = selection && !selection.isEmpty
      ? editor.document.getText(selection)
      : editor.document.getText();

    await vscode.commands.executeCommand('workbench.view.extension.socraticcode-container');
    sidebarProvider?.show();

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `SocraticCode (${isAiMode ? 'Gemini AI' : 'Demo'}): Analyzing alternative approaches...`,
        cancellable: false,
      },
      async () => {
        try {
          const response = await tutorService!.exploreAlternative(selectedText, analysis!);
          const cardHtml = tutorService!.formatResponseToCardHtml(response);

          sidebarProvider?.postMessage({
            type: 'hintResult',
            level: response.hintLevel,
            cardHtml,
          });

          await analyticsStore?.recordSession({
            id: `sess-${Date.now()}`,
            timestamp: Date.now(),
            language: analysis!.language,
            question: 'Explore Alternative/Optimized Approach',
            concept: 'Algorithm Optimization',
            maxHintLevel: 1,
            provider: tutorService!.providerName,
            wasFallback: Boolean(response.isFallback),
            mode: 'alternative_approach',
          });
        } catch (err: any) {
          vscode.window.showErrorMessage(`SocraticCode: ${err.message || String(err)}`);
        }
      }
    );
  };

  // Register all commands
  registerCommands(context, {
    onOpenTutor: async () => {
      await vscode.commands.executeCommand('workbench.view.extension.socraticcode-container');
      sidebarProvider?.show();
      updateSidebarStatus();
    },
    onAnalyzeFile: async () => {
      await runAnalysis();
    },
    onAskAboutSelection: async (question) => {
      await handleAskQuestion(question);
    },
    onExploreAlternative: async () => {
      await handleExploreAlternative();
    },
    onRequestNextHint: async () => {
      await handleRequestNextHint();
    },
    onOpenDashboard: async () => {
      if (analyticsStore) {
        DashboardPanel.createOrShow(context.extensionUri, analyticsStore);
      }
    },
    onClearSession: async () => {
      tutorService?.resetSession();
      lastAnalysisResult = null;
      sidebarProvider?.postMessage({ type: 'clearSession' });
      vscode.window.showInformationMessage('SocraticCode: Learning session reset.');
    },
    onConfigureProvider: async () => {
      const currentKey = await keyManager!.getApiKey();
      const input = await vscode.window.showInputBox({
        title: 'Configure Google Gemini API Key',
        prompt: 'Enter your Gemini API Key from Google AI Studio (leave blank to remove key)',
        password: true,
        value: currentKey || '',
        ignoreFocusOut: true,
      });

      if (input === undefined) return; // cancelled

      if (input.trim() === '') {
        await keyManager!.deleteApiKey();
        isAiMode = false;
        tutorService!.setProvider(demoProvider!);
        updateSidebarStatus();
        vscode.window.showInformationMessage('SocraticCode: Gemini API key removed. Switched to Demo Mode.');
        return;
      }

      await keyManager!.setApiKey(input.trim());
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'SocraticCode: Verifying Gemini API Key...',
          cancellable: false,
        },
        async () => {
          const verification = await geminiProvider!.verifyConnection();
          if (verification.success) {
            isAiMode = true;
            tutorService!.setProvider(geminiProvider!);
            updateSidebarStatus();
            vscode.window.showInformationMessage(
              `SocraticCode: Gemini AI verified & active! (Model: ${verification.modelUsed})`
            );
          } else {
            vscode.window.showErrorMessage(
              `SocraticCode: Gemini verification failed. ${verification.error || 'Please check key or internet connection.'}`
            );
          }
        }
      );
    },
    onSwitchDemoMode: async () => {
      const hasKey = await keyManager!.hasApiKey();
      if (!isAiMode) {
        if (!hasKey) {
          const action = await vscode.window.showWarningMessage(
            'SocraticCode: No Gemini API Key configured. Would you like to configure one now?',
            'Configure Key'
          );
          if (action === 'Configure Key') {
            await vscode.commands.executeCommand('socraticcode.configureProvider');
          }
          return;
        }
        isAiMode = true;
        tutorService!.setProvider(geminiProvider!);
        vscode.window.showInformationMessage('SocraticCode: Switched to Gemini AI Mode.');
      } else {
        isAiMode = false;
        tutorService!.setProvider(demoProvider!);
        vscode.window.showInformationMessage('SocraticCode: Switched to offline Demo Mode.');
      }
      updateSidebarStatus();
    },
  });

  // Track active editor switch
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      updateSidebarStatus();
    })
  );

  console.log('SocraticCode successfully activated!');
}

export function deactivate(): void {
  console.log('SocraticCode deactivated.');
}
