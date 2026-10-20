import * as path from 'path';

export const SUPPORTED_LANGUAGES = ['python', 'c'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

const EXTENSION_MAP: Record<string, SupportedLanguage> = {
  '.py': 'python',
  '.pyw': 'python',
  '.c': 'c',
  '.h': 'c',
};

const LANGUAGE_ID_MAP: Record<string, SupportedLanguage> = {
  python: 'python',
  c: 'c',
};

export function detectLanguage(filePath: string, languageId?: string): string {
  if (languageId && LANGUAGE_ID_MAP[languageId.toLowerCase()]) {
    return LANGUAGE_ID_MAP[languageId.toLowerCase()];
  }

  if (filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (EXTENSION_MAP[ext]) {
      return EXTENSION_MAP[ext];
    }
  }

  return 'unsupported';
}

export function isSupportedLanguage(lang: string): boolean {
  return SUPPORTED_LANGUAGES.includes(lang.toLowerCase() as SupportedLanguage);
}
