/**
 * Internationalization (i18n) System Tests
 */

import {
  I18n,
  createI18n,
  detectLanguageFromNavigator,
  detectLanguageFromUrl,
  detectLanguageFromCookie,
  formatMessage,
  getPluralForm,
  I18nNamespace,
  createNamespace,
  Locale,
  LocaleInfo,
  TranslationDictionary,
  InterpolationParams,
  TranslationOptions,
  I18nConfig,
  LanguageDetectionResult,
  PluralCategory,
  GenderMessage,
  SUPPORTED_LOCALES,
  LOCALE_INFO,
  DEFAULT_I18N_CONFIG,
  generateTranslationId,
  isPluralMessage,
  isGenderMessage,
  isValidLocale,
  parseLocale,
  interpolateMessage,
  getPluralCategory,
  getLocaleInfo,
  isRTL,
  I18N_ERROR_CODES,
} from '../src/core/i18n';

describe('i18n Types and Utilities', () => {
  describe('Locale Validation', () => {
    test('isValidLocale returns true for supported locales', () => {
      expect(isValidLocale('en_US')).toBe(true);
      expect(isValidLocale('zh_CN')).toBe(true);
      expect(isValidLocale('es_ES')).toBe(true);
      expect(isValidLocale('fr_FR')).toBe(true);
      expect(isValidLocale('de_DE')).toBe(true);
      expect(isValidLocale('ja_JP')).toBe(true);
    });

    test('isValidLocale returns false for unsupported locales', () => {
      expect(isValidLocale('invalid')).toBe(false);
      expect(isValidLocale('xx_XX')).toBe(false);
      expect(isValidLocale('')).toBe(false);
    });

    test('parseLocale parses valid locale strings', () => {
      expect(parseLocale('en_US')).toBe('en_US');
      expect(parseLocale('zh-CN')).toBe('zh_CN');
      expect(parseLocale('es_ES')).toBe('es_ES');
    });

    test('parseLocale returns null for invalid locale strings', () => {
      expect(parseLocale('invalid')).toBeNull();
      expect(parseLocale('')).toBeNull();
    });
  });

  describe('Plural Message Type Guard', () => {
    test('isPluralMessage correctly identifies plural messages', () => {
      const pluralMsg = {
        id: 'test_123',
        namespace: 'common',
        key: 'items',
        forms: { one: '{{count}} item', other: '{{count}} items' },
      };
      expect(isPluralMessage(pluralMsg)).toBe(true);
    });

    test('isPluralMessage correctly rejects non-plural messages', () => {
      expect(isPluralMessage('simple string')).toBe(false);
      expect(isPluralMessage(null)).toBe(false);
      expect(isPluralMessage(undefined)).toBe(false);
      expect(isPluralMessage({ id: 'test' })).toBe(false);
    });
  });

  describe('Gender Message Type Guard', () => {
    test('isGenderMessage correctly identifies gender messages', () => {
      const genderMsg = {
        id: 'test_123',
        namespace: 'common',
        key: 'greeting',
        forms: { male: 'Hello Sir', female: 'Hello Ma\'am', other: 'Hello' },
      };
      expect(isGenderMessage(genderMsg)).toBe(true);
    });

    test('isGenderMessage correctly rejects non-gender messages', () => {
      expect(isGenderMessage('simple string')).toBe(false);
      expect(isGenderMessage(null)).toBe(false);
      expect(isGenderMessage({ key: 'test' })).toBe(false);
    });
  });

  describe('ID Generation', () => {
    test('generateTranslationId creates unique IDs', () => {
      const id1 = generateTranslationId();
      const id2 = generateTranslationId();
      expect(id1).not.toBe(id2);
    });

    test('generateTranslationId uses provided prefix', () => {
      const id = generateTranslationId('MSG');
      expect(id.startsWith('MSG_')).toBe(true);
    });

    test('generateTranslationId has correct format', () => {
      const id = generateTranslationId('TEST');
      expect(id).toMatch(/^TEST_[a-z0-9]+$/);
    });
  });

  describe('Locale Info', () => {
    test('getLocaleInfo returns correct info for en_US', () => {
      const info = getLocaleInfo('en_US');
      expect(info).toBeDefined();
      expect(info?.code).toBe('en_US');
      expect(info?.name).toBe('English (US)');
      expect(info?.nativeName).toBe('English');
      expect(info?.direction).toBe('ltr');
    });

    test('getLocaleInfo returns correct info for ar_SA (RTL)', () => {
      const info = getLocaleInfo('ar_SA');
      expect(info).toBeDefined();
      expect(info?.direction).toBe('rtl');
    });

    test('getLocaleInfo returns undefined for invalid locale', () => {
      expect(getLocaleInfo('invalid')).toBeUndefined();
    });

    test('isRTL correctly identifies RTL locales', () => {
      expect(isRTL('ar_SA')).toBe(true);
      expect(isRTL('en_US')).toBe(false);
      expect(isRTL('zh_CN')).toBe(false);
    });
  });

  describe('Plural Rules', () => {
    test('getPluralCategory returns correct category for English', () => {
      const info = getLocaleInfo('en_US');
      expect(info).toBeDefined();
      
      expect(getPluralCategory(1, info!.pluralRules)).toBe('one');
      expect(getPluralCategory(2, info!.pluralRules)).toBe('other');
      expect(getPluralCategory(0, info!.pluralRules)).toBe('other');
    });

    test('getPluralCategory returns correct category for Russian', () => {
      const info = getLocaleInfo('ru_RU');
      expect(info).toBeDefined();
      
      expect(getPluralCategory(1, info!.pluralRules)).toBe('one');
      expect(getPluralCategory(2, info!.pluralRules)).toBe('few');
      expect(getPluralCategory(5, info!.pluralRules)).toBe('many');
    });

    test('getPluralForm utility function works', () => {
      expect(getPluralForm(1, 'en_US')).toBe('one');
      expect(getPluralForm(5, 'en_US')).toBe('other');
    });
  });

  describe('Message Interpolation', () => {
    test('interpolateMessage replaces single placeholder', () => {
      const result = interpolateMessage('Hello {{name}}', { name: 'World' });
      expect(result).toBe('Hello World');
    });

    test('interpolateMessage replaces multiple placeholders', () => {
      const result = interpolateMessage('{{name}} has {{count}} items', { name: 'John', count: 5 });
      expect(result).toBe('John has 5 items');
    });

    test('interpolateMessage preserves unreplaced placeholders', () => {
      const result = interpolateMessage('Hello {{name}}', {});
      expect(result).toBe('Hello {{name}}');
    });

    test('interpolateMessage handles Date values', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const result = interpolateMessage('Date: {{date}}', { date });
      expect(result).toContain('2024-01-15');
    });

    test('formatMessage is alias for interpolateMessage', () => {
      const result = formatMessage('Hello {{name}}', { name: 'Test' });
      expect(result).toBe('Hello Test');
    });
  });

  describe('Constants', () => {
    test('SUPPORTED_LOCALES contains expected locales', () => {
      expect(SUPPORTED_LOCALES).toContain('en_US');
      expect(SUPPORTED_LOCALES).toContain('zh_CN');
      expect(SUPPORTED_LOCALES).toContain('es_ES');
      expect(SUPPORTED_LOCALES).toContain('fr_FR');
      expect(SUPPORTED_LOCALES).toContain('de_DE');
      expect(SUPPORTED_LOCALES).toContain('ja_JP');
      expect(SUPPORTED_LOCALES).toContain('ar_SA');
    });

    test('DEFAULT_I18N_CONFIG has correct defaults', () => {
      expect(DEFAULT_I18N_CONFIG.defaultLocale).toBe('en_US');
      expect(DEFAULT_I18N_CONFIG.fallbackLocale).toBe('en_US');
    });

    test('I18N_ERROR_CODES has all expected codes', () => {
      expect(I18N_ERROR_CODES.LOCALE_NOT_FOUND).toBe('I18N_LOCALE_NOT_FOUND');
      expect(I18N_ERROR_CODES.TRANSLATION_NOT_FOUND).toBe('I18N_TRANSLATION_NOT_FOUND');
      expect(I18N_ERROR_CODES.INVALID_LOCALE).toBe('I18N_INVALID_LOCALE');
    });
  });
});

describe('I18n Core Functionality', () => {
  const createTestTranslations = (): TranslationDictionary => ({
    common: {
      hello: 'Hello',
      goodbye: 'Goodbye',
      welcome: 'Welcome, {{name}}!',
      items_count: '{{count}} item',
      items_count_plural: '{{count}} items',
      greeting_male: 'Hello Sir',
      greeting_female: 'Hello Ma\'am',
    },
    forms: {
      submit: 'Submit',
      cancel: 'Cancel',
      email_label: 'Email Address',
    },
    messages: {
      error_generic: 'An error occurred',
      success_save: 'Successfully saved {{name}}',
    },
  });

  let i18n: I18n;

  beforeEach(() => {
    i18n = createI18n({
      translations: createTestTranslations(),
    });
  });

  describe('Basic Translation', () => {
    test('translates simple key', () => {
      expect(i18n.t('hello')).toBe('Hello');
    });

    test('translates from default namespace', () => {
      expect(i18n.t('goodbye')).toBe('Goodbye');
    });

    test('translates from specific namespace', () => {
      expect(i18n.t('submit', { namespace: 'forms' })).toBe('Submit');
    });

    test('returns key when translation not found', () => {
      expect(i18n.t('nonexistent')).toBe('nonexistent');
    });

    test('returns key when namespace not found', () => {
      expect(i18n.t('hello', { namespace: 'nonexistent' })).toBe('hello');
    });
  });

  describe('Interpolation', () => {
    test('interpolates single parameter', () => {
      expect(i18n.t('welcome', { params: { name: 'John' } })).toBe('Welcome, John!');
    });

    test('interpolates multiple parameters', () => {
      expect(i18n.t('success_save', { namespace: 'messages', params: { name: 'Document' } })).toBe('Successfully saved Document');
    });
  });

  describe('Pluralization', () => {
    test('tc method handles singular with PluralMessage', () => {
      i18n = createI18n({
        translations: {
          common: {
            items: {
              id: 'items_001',
              namespace: 'common',
              key: 'items',
              forms: { one: '{{count}} item', other: '{{count}} items' },
            },
          },
        },
      });
      expect(i18n.tc('items', 1)).toBe('1 item');
    });

    test('tc method handles plural with PluralMessage', () => {
      i18n = createI18n({
        translations: {
          common: {
            items: {
              id: 'items_001',
              namespace: 'common',
              key: 'items',
              forms: { one: '{{count}} item', other: '{{count}} items' },
            },
          },
        },
      });
      expect(i18n.tc('items', 5)).toBe('5 items');
    });

    test('tc with namespace works', () => {
      i18n = createI18n({
        translations: {
          test: {
            files: {
              id: 'files_001',
              namespace: 'test',
              key: 'files',
              forms: { one: '{{count}} file', other: '{{count}} files' },
            },
          },
        },
      });
      expect(i18n.tc('files', 1, { namespace: 'test' })).toBe('1 file');
      expect(i18n.tc('files', 5, { namespace: 'test' })).toBe('5 files');
    });
  });

  describe('Gender Handling', () => {
    test('tg method handles male gender', () => {
      expect(i18n.tg('greeting_male', 'male')).toBe('Hello Sir');
    });

    test('tg method handles female gender', () => {
      expect(i18n.tg('greeting_female', 'female')).toBe('Hello Ma\'am');
    });

    test('tg falls back to other when gender not found', () => {
      i18n = createI18n({
        translations: {
          test: {
            greet: {
              id: 'greet_001',
              namespace: 'test',
              key: 'greet',
              forms: { male: 'Mr', female: 'Ms', other: 'Person' },
            } as GenderMessage,
          },
        },
      });
      expect(i18n.tg('greet', 'unknown', { namespace: 'test' })).toBe('Person');
    });
  });

  describe('Locale Management', () => {
    test('getLocale returns current locale', () => {
      expect(i18n.getLocale()).toBe('en_US');
    });

    test('setLocale changes current locale', () => {
      i18n.setLocale('fr_FR');
      expect(i18n.getLocale()).toBe('fr_FR');
    });

    test('setLocale throws for invalid locale', () => {
      expect(() => i18n.setLocale('invalid' as Locale)).toThrow();
    });

    test('isLocaleSupported returns true for valid locales', () => {
      expect(i18n.isLocaleSupported('en_US')).toBe(true);
      expect(i18n.isLocaleSupported('zh_CN')).toBe(true);
    });

    test('isLocaleSupported returns false for invalid locales', () => {
      expect(i18n.isLocaleSupported('invalid')).toBe(false);
    });
  });

  describe('Translation Management', () => {
    test('addTranslation adds new translations', () => {
      i18n.addTranslation('new_ns', { new_key: 'New Translation' });
      expect(i18n.t('new_key', { namespace: 'new_ns' })).toBe('New Translation');
    });

    test('addTranslation merges with existing namespace', () => {
      i18n.addTranslation('common', { another: 'Another' });
      expect(i18n.t('another')).toBe('Another');
      expect(i18n.t('hello')).toBe('Hello');
    });

    test('removeTranslation removes specific key', () => {
      i18n.removeTranslation('common', 'hello');
      expect(i18n.hasTranslation('hello')).toBe(false);
    });

    test('removeTranslation removes entire namespace', () => {
      i18n.removeTranslation('forms');
      expect(i18n.hasTranslation('submit', 'forms')).toBe(false);
    });

    test('hasTranslation checks key existence', () => {
      expect(i18n.hasTranslation('hello')).toBe(true);
      expect(i18n.hasTranslation('nonexistent')).toBe(false);
    });
  });

  describe('Number Formatting', () => {
    test('formatNumber formats integers', () => {
      const result = i18n.formatNumber(1000);
      expect(result).toBe('1,000');
    });

    test('formatNumber formats decimals', () => {
      const result = i18n.formatNumber(1234.56);
      expect(result).toBe('1,234.56');
    });

    test('formatNumber uses locale-specific separators', () => {
      i18n.setLocale('de_DE');
      const result = i18n.formatNumber(1234.56);
      expect(result).toBe('1.234,56');
    });

    test('formatPercent formats correctly', () => {
      const result = i18n.formatPercent(0.256);
      expect(result).toContain('25');
      expect(result).toContain('%');
    });

    test('formatCurrency formats with symbol', () => {
      const result = i18n.formatCurrency(99.99);
      expect(result).toContain('$');
      expect(result).toContain('99');
    });

    test('formatCurrency hides currency when requested', () => {
      const result = i18n.formatCurrency(99.99, { showCurrency: false });
      expect(result).toBe('99.99');
    });
  });

  describe('Date/Time Formatting', () => {
    const testDate = new Date(2024, 0, 15, 14, 30, 0);

    test('formatDate formats short date', () => {
      const result = i18n.formatDate(testDate, { format: 'shortDate' });
      expect(result).toBe('01/15/2024');
    });

    test('formatDate formats long date', () => {
      const result = i18n.formatDate(testDate, { format: 'longDate' });
      expect(result).toBe('January 15, 2024');
    });

    test('formatTime formats short time', () => {
      const result = i18n.formatTime(testDate, { format: 'shortTime' });
      expect(result).toBe('2:30 PM');
    });

    test('formatDateTime combines date and time', () => {
      const result = i18n.formatDateTime(testDate);
      expect(result).toContain('January');
      expect(result).toContain('2:30');
    });
  });

  describe('Language Detection', () => {
    test('detectLanguage returns default for node environment', () => {
      const result = detectLanguageFromNavigator();
      expect(result).toBe('en_US');
    });

    test('detectLanguageFromUrl parses URL locale', () => {
      const result = detectLanguageFromUrl('https://example.com/zh_CN/page');
      expect(result).toBe('zh_CN');
    });

    test('detectLanguageFromUrl parses query param', () => {
      const result = detectLanguageFromUrl('https://example.com/page?locale=fr_FR');
      expect(result).toBe('fr_FR');
    });

    test('detectLanguageFromUrl returns null for invalid URL', () => {
      const result = detectLanguageFromUrl('not-a-url');
      expect(result).toBeNull();
    });

    test('detectLanguageFromCookie parses cookie', () => {
      const result = detectLanguageFromCookie('locale=de_DE; other=value');
      expect(result).toBe('de_DE');
    });

    test('detectLanguageFromCookie returns null when not found', () => {
      const result = detectLanguageFromCookie('other=value');
      expect(result).toBeNull();
    });
  });

  describe('Namespace Support', () => {
    test('createNamespace creates namespaced translator', () => {
      const ns = createNamespace(i18n, 'forms');
      expect(ns.t('submit')).toBe('Submit');
    });

    test('namespace tc method works', () => {
      i18n = createI18n({
        translations: {
          items: {
            item: {
              id: 'item_001',
              namespace: 'items',
              key: 'item',
              forms: { one: '{{count}} file', other: '{{count}} files' },
            },
          },
        },
      });
      const ns = createNamespace(i18n, 'items');
      expect(ns.tc('item', 1)).toBe('1 file');
      expect(ns.tc('item', 5)).toBe('5 files');
    });

    test('namespace tg method works', () => {
      i18n = createI18n({
        translations: {
          greet: {
            hello_male: 'Hello Sir',
            hello_female: 'Hello Madam',
            hello_other: 'Hello',
          },
        },
      });
      const ns = createNamespace(i18n, 'greet');
      expect(ns.tg('hello_male', 'male')).toBe('Hello Sir');
      expect(ns.tg('hello_female', 'female')).toBe('Hello Madam');
    });
  });

  describe('Cache Management', () => {
    test('clearCache clears translation cache', () => {
      i18n.t('hello');
      i18n.clearCache();
      expect(() => i18n.clearCache()).not.toThrow();
    });

    test('translations are cached after first access', () => {
      i18n.t('hello');
      i18n.addTranslation('common', { hello: 'Changed' });
      expect(i18n.t('hello')).toBe('Changed');
    });
  });

  describe('Config and Info', () => {
    test('getConfig returns configuration', () => {
      const config = i18n.getConfig();
      expect(config.defaultLocale).toBeDefined();
      expect(config.supportedLocales).toBeDefined();
    });

    test('getAvailableLocales returns supported locales', () => {
      const locales = i18n.getAvailableLocales();
      expect(locales.length).toBeGreaterThan(0);
      expect(locales).toContain('en_US');
    });

    test('getLocaleInfo returns locale information', () => {
      const info = i18n.getLocaleInfo('en_US');
      expect(info?.name).toBe('English (US)');
      expect(info?.nativeName).toBe('English');
    });
  });

  describe('Child I18n', () => {
    test('createChildI18n creates new instance with merged translations', () => {
      const child = i18n.createChildI18n({
        extra: {
          extra_key: 'Extra Translation',
        },
      });

      expect(child.t('hello')).toBe('Hello');
      expect(child.t('extra_key', { namespace: 'extra' })).toBe('Extra Translation');
    });

    test('child i18n does not affect parent', () => {
      const child = i18n.createChildI18n({
        extra: {
          extra_key: 'Child Only',
        },
      });

      expect(i18n.hasTranslation('extra_key', 'extra')).toBe(false);
      expect(child.hasTranslation('extra_key', 'extra')).toBe(true);
    });
  });

  describe('RTL Support', () => {
    test('isRTL returns true for RTL locales', () => {
      expect(i18n.isRTL('ar_SA')).toBe(true);
    });

    test('isRTL returns false for LTR locales', () => {
      expect(i18n.isRTL()).toBe(false);
      expect(i18n.isRTL('en_US')).toBe(false);
    });
  });

  describe('Missing Translation Handler', () => {
    test('uses missing translation handler when configured', () => {
      const handler = (key: string, _namespace?: string) => `[Missing: ${key}]`;
      
      const customI18n = createI18n({
        translations: {},
        missingTranslationHandler: handler,
      });

      expect(customI18n.t('missing_key')).toBe('[Missing: missing_key]');
    });
  });

  describe('Store Locale Callback', () => {
    test('calls storeLocale when setLocale is called', () => {
      let storedLocale: Locale | undefined;
      
      const customI18n = createI18n({
        translations: {},
        storeLocale: (locale) => {
          storedLocale = locale;
        },
      });

      customI18n.setLocale('fr_FR');
      expect(storedLocale).toBe('fr_FR');
    });
  });
});

describe('I18n Edge Cases', () => {
  test('handles empty translations object', () => {
    const i18n = createI18n({ translations: {} });
    expect(i18n.t('any_key')).toBe('any_key');
  });

  test('handles whitespace in keys', () => {
    const i18n = createI18n({
      translations: {
        common: {
          'key with spaces': 'Value',
        },
      },
    });
    expect(i18n.t('key with spaces')).toBe('Value');
  });

  test('handles special characters in interpolation', () => {
    const i18n = createI18n({
      translations: {
        common: {
          special: '{{value}}',
        },
      },
    });
    expect(i18n.t('special', { params: { value: '<script>alert("xss")</script>' } })).toBe('<script>alert("xss")</script>');
  });

  test('handles undefined params gracefully', () => {
    const i18n = createI18n({
      translations: {
        common: {
          test: '{{name}} - {{age}}',
        },
      },
    });
    expect(i18n.t('test', { params: { name: 'John' } as InterpolationParams })).toBe('John - {{age}}');
  });
});
