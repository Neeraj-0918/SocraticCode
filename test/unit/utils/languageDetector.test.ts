import { describe, it, expect } from 'vitest';
import { detectLanguage, isSupportedLanguage, SUPPORTED_LANGUAGES } from '../../../src/utils/languageDetector';

describe('Language Detector', () => {
  it('should detect Python from file extension and languageId', () => {
    expect(detectLanguage('test.py')).toBe('python');
    expect(detectLanguage('nested/path/app.py')).toBe('python');
    expect(detectLanguage('script', 'python')).toBe('python');
  });

  it('should detect C from file extension and languageId', () => {
    expect(detectLanguage('main.c')).toBe('c');
    expect(detectLanguage('header.h')).toBe('c');
    expect(detectLanguage('main', 'c')).toBe('c');
  });

  it('should detect unsupported languages gracefully', () => {
    expect(detectLanguage('index.js')).toBe('unsupported');
    expect(detectLanguage('App.java')).toBe('unsupported');
    expect(detectLanguage('main.cpp')).toBe('unsupported');
    expect(detectLanguage('')).toBe('unsupported');
  });

  it('should correctly validate supported languages', () => {
    expect(isSupportedLanguage('python')).toBe(true);
    expect(isSupportedLanguage('c')).toBe(true);
    expect(isSupportedLanguage('java')).toBe(false);
    expect(isSupportedLanguage('javascript')).toBe(false);
    expect(SUPPORTED_LANGUAGES).toContain('python');
    expect(SUPPORTED_LANGUAGES).toContain('c');
  });
});
