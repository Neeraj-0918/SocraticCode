export const commands = {
  registerCommand: (command: string, callback: (...args: any[]) => any) => ({
    dispose: () => {},
  }),
  executeCommand: async (command: string, ...rest: any[]) => {},
};

export const window = {
  showInformationMessage: async (message: string, ...items: any[]) => {},
  showErrorMessage: async (message: string, ...items: any[]) => {},
  showWarningMessage: async (message: string, ...items: any[]) => {},
  registerWebviewViewProvider: (viewId: string, provider: any) => ({
    dispose: () => {},
  }),
};

export class Disposable {
  constructor(private callOnDispose: () => any) {}
  dispose() {
    this.callOnDispose?.();
  }
}
