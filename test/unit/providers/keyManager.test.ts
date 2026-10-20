import { describe, it, expect, beforeEach } from 'vitest';
import { KeyManager } from '../../../src/providers/keyManager';

class MockSecretStorage {
  private _storage = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this._storage.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    this._storage.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this._storage.delete(key);
  }

  onDidChange = () => ({ dispose: () => {} });
}

describe('KeyManager', () => {
  let mockStorage: any;
  let keyManager: KeyManager;

  beforeEach(() => {
    mockStorage = new MockSecretStorage();
    keyManager = new KeyManager(mockStorage);
  });

  it('should return undefined when no key is stored', async () => {
    expect(await keyManager.getApiKey()).toBeUndefined();
    expect(await keyManager.hasApiKey()).toBe(false);
  });

  it('should securely store and retrieve an API key', async () => {
    await keyManager.setApiKey('AIzaSyTestKey12345');
    expect(await keyManager.hasApiKey()).toBe(true);
    expect(await keyManager.getApiKey()).toBe('AIzaSyTestKey12345');
  });

  it('should delete key cleanly', async () => {
    await keyManager.setApiKey('AIzaSyTestKey12345');
    await keyManager.deleteApiKey();
    expect(await keyManager.hasApiKey()).toBe(false);
    expect(await keyManager.getApiKey()).toBeUndefined();
  });
});
