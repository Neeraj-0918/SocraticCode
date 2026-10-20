import * as vscode from 'vscode';

export class KeyManager {
  private static readonly SECRET_KEY = 'socraticcode.gemini_api_key';

  constructor(private readonly _secretStorage: vscode.SecretStorage) {}

  public async getApiKey(): Promise<string | undefined> {
    return this._secretStorage.get(KeyManager.SECRET_KEY);
  }

  public async setApiKey(apiKey: string): Promise<void> {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      await this.deleteApiKey();
      return;
    }
    await this._secretStorage.store(KeyManager.SECRET_KEY, trimmed);
  }

  public async deleteApiKey(): Promise<void> {
    await this._secretStorage.delete(KeyManager.SECRET_KEY);
  }

  public async hasApiKey(): Promise<boolean> {
    const key = await this.getApiKey();
    return !!key && key.trim().length > 0;
  }
}
