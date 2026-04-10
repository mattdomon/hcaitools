/**
 * Internationalization (i18n) System Types
 */

export type Locale = string;

export interface LocaleInfo {
  code: Locale;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  pluralRules: PluralRules;
  numberFormat: NumberFormatOptions;
  dateFormat: DateFormatOptions;
}

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

export interface PluralRules {
  (count: number): PluralCategory;
}

export interface NumberFormatOptions {
  decimalSeparator: string;
  groupSeparator: string;
  percentSymbol: string;
  currencySymbol: string;
  currencyCode: string;
}

export interface DateFormatOptions {
  shortDate: string;
  longDate: string;
  shortTime: string;
  longTime: string;
  fullDateTime: string;
}

export interface TranslationMessage {
  id: string;
  namespace: string;
  key: string;
  message: string;
  description?: string;
}

export interface PluralMessage {
  id: string;
  namespace: string;
  key: string;
  forms: Record<PluralCategory, string>;
  description?: string;
}

export interface GenderMessage {
  id: string;
  namespace: string;
  key: string;
  forms: Record<string, string>;
  description?: string;
}

export type TranslationValue = string | PluralMessage | GenderMessage;

export interface TranslationDictionary {
  [namespace: string]: {
    [key: string]: string | PluralMessage | GenderMessage;
  };
}

export interface InterpolationParams {
  [key: string]: string | number | boolean | Date;
}

export interface TranslationOptions {
  namespace?: string;
  locale?: Locale;
  pluralCount?: number;
  gender?: string;
  params?: InterpolationParams;
}

export interface I18nConfig {
  defaultLocale: Locale;
  supportedLocales: Locale[];
  fallbackLocale: Locale;
  translations: TranslationDictionary;
  detectLanguage?: () => Locale;
  storeLocale?: (locale: Locale) => void;
  missingTranslationHandler?: (key: string, namespace?: string) => string;
}

export interface LanguageDetectionResult {
  locale: Locale;
  confidence: number;
  source: 'navigator' | 'url' | 'cookie' | 'header' | 'default';
}

export interface DateTimeFormatOptions {
  locale?: Locale;
  timeZone?: string;
  format?: 'short' | 'medium' | 'long' | 'full' | string;
  hour12?: boolean;
}

export interface NumberFormatValueOptions {
  locale?: Locale;
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
}

export interface CurrencyFormatOptions extends NumberFormatValueOptions {
  currencySymbol?: string;
  showCurrency?: boolean;
}

export const SUPPORTED_LOCALES: Locale[] = [
  'en_US',
  'en_GB',
  'zh_CN',
  'zh_TW',
  'es_ES',
  'es_MX',
  'fr_FR',
  'de_DE',
  'ja_JP',
  'ko_KR',
  'ar_SA',
  'pt_BR',
  'ru_RU',
  'hi_IN',
];

export const LOCALE_INFO: Record<Locale, LocaleInfo> = {
  en_US: {
    code: 'en_US',
    name: 'English (US)',
    nativeName: 'English',
    direction: 'ltr',
    pluralRules: (n: number) => (n === 1 ? 'one' : 'other'),
    numberFormat: {
      decimalSeparator: '.',
      groupSeparator: ',',
      percentSymbol: '%',
      currencySymbol: '$',
      currencyCode: 'USD',
    },
    dateFormat: {
      shortDate: 'MM/DD/YYYY',
      longDate: 'MMMM D, YYYY',
      shortTime: 'h:mm A',
      longTime: 'h:mm:ss A',
      fullDateTime: 'MMMM D, YYYY h:mm:ss A',
    },
  },
  en_GB: {
    code: 'en_GB',
    name: 'English (UK)',
    nativeName: 'English',
    direction: 'ltr',
    pluralRules: (n: number) => (n === 1 ? 'one' : 'other'),
    numberFormat: {
      decimalSeparator: '.',
      groupSeparator: ',',
      percentSymbol: '%',
      currencySymbol: '£',
      currencyCode: 'GBP',
    },
    dateFormat: {
      shortDate: 'DD/MM/YYYY',
      longDate: 'D MMMM YYYY',
      shortTime: 'HH:mm',
      longTime: 'HH:mm:ss',
      fullDateTime: 'D MMMM YYYY HH:mm:ss',
    },
  },
  zh_CN: {
    code: 'zh_CN',
    name: 'Chinese (Simplified)',
    nativeName: '简体中文',
    direction: 'ltr',
    pluralRules: () => 'other',
    numberFormat: {
      decimalSeparator: '.',
      groupSeparator: ',',
      percentSymbol: '%',
      currencySymbol: '¥',
      currencyCode: 'CNY',
    },
    dateFormat: {
      shortDate: 'YYYY/MM/DD',
      longDate: 'YYYY年M月D日',
      shortTime: 'HH:mm',
      longTime: 'HH:mm:ss',
      fullDateTime: 'YYYY年M月D日 HH:mm:ss',
    },
  },
  zh_TW: {
    code: 'zh_TW',
    name: 'Chinese (Traditional)',
    nativeName: '繁體中文',
    direction: 'ltr',
    pluralRules: () => 'other',
    numberFormat: {
      decimalSeparator: '.',
      groupSeparator: ',',
      percentSymbol: '%',
      currencySymbol: 'NT$',
      currencyCode: 'TWD',
    },
    dateFormat: {
      shortDate: 'YYYY/MM/DD',
      longDate: 'YYYY年M月D日',
      shortTime: 'HH:mm',
      longTime: 'HH:mm:ss',
      fullDateTime: 'YYYY年M月D日 HH:mm:ss',
    },
  },
  es_ES: {
    code: 'es_ES',
    name: 'Spanish (Spain)',
    nativeName: 'Español',
    direction: 'ltr',
    pluralRules: (n: number) => (n === 1 ? 'one' : 'other'),
    numberFormat: {
      decimalSeparator: ',',
      groupSeparator: '.',
      percentSymbol: '%',
      currencySymbol: '€',
      currencyCode: 'EUR',
    },
    dateFormat: {
      shortDate: 'DD/MM/YYYY',
      longDate: 'D [de] MMMM [de] YYYY',
      shortTime: 'H:mm',
      longTime: 'H:mm:ss',
      fullDateTime: 'D [de] MMMM [de] YYYY H:mm:ss',
    },
  },
  es_MX: {
    code: 'es_MX',
    name: 'Spanish (Mexico)',
    nativeName: 'Español',
    direction: 'ltr',
    pluralRules: (n: number) => (n === 1 ? 'one' : 'other'),
    numberFormat: {
      decimalSeparator: '.',
      groupSeparator: ',',
      percentSymbol: '%',
      currencySymbol: 'MX$',
      currencyCode: 'MXN',
    },
    dateFormat: {
      shortDate: 'DD/MM/YYYY',
      longDate: 'D [de] MMMM [de] YYYY',
      shortTime: 'H:mm',
      longTime: 'H:mm:ss',
      fullDateTime: 'D [de] MMMM [de] YYYY H:mm:ss',
    },
  },
  fr_FR: {
    code: 'fr_FR',
    name: 'French',
    nativeName: 'Français',
    direction: 'ltr',
    pluralRules: (n: number) => (n === 0 || n === 1 ? 'one' : 'other'),
    numberFormat: {
      decimalSeparator: ',',
      groupSeparator: ' ',
      percentSymbol: '%',
      currencySymbol: '€',
      currencyCode: 'EUR',
    },
    dateFormat: {
      shortDate: 'DD/MM/YYYY',
      longDate: 'D MMMM YYYY',
      shortTime: 'HH:mm',
      longTime: 'HH:mm:ss',
      fullDateTime: 'D MMMM YYYY HH:mm:ss',
    },
  },
  de_DE: {
    code: 'de_DE',
    name: 'German',
    nativeName: 'Deutsch',
    direction: 'ltr',
    pluralRules: (n: number) => (n === 1 ? 'one' : 'other'),
    numberFormat: {
      decimalSeparator: ',',
      groupSeparator: '.',
      percentSymbol: '%',
      currencySymbol: '€',
      currencyCode: 'EUR',
    },
    dateFormat: {
      shortDate: 'DD.MM.YYYY',
      longDate: 'D. MMMM YYYY',
      shortTime: 'HH:mm',
      longTime: 'HH:mm:ss',
      fullDateTime: 'D. MMMM YYYY HH:mm:ss',
    },
  },
  ja_JP: {
    code: 'ja_JP',
    name: 'Japanese',
    nativeName: '日本語',
    direction: 'ltr',
    pluralRules: () => 'other',
    numberFormat: {
      decimalSeparator: '.',
      groupSeparator: ',',
      percentSymbol: '%',
      currencySymbol: '¥',
      currencyCode: 'JPY',
    },
    dateFormat: {
      shortDate: 'YYYY/MM/DD',
      longDate: 'Y年M月D日',
      shortTime: 'H:mm',
      longTime: 'H:mm:ss',
      fullDateTime: 'Y年M月D日 H:mm:ss',
    },
  },
  ko_KR: {
    code: 'ko_KR',
    name: 'Korean',
    nativeName: '한국어',
    direction: 'ltr',
    pluralRules: () => 'other',
    numberFormat: {
      decimalSeparator: '.',
      groupSeparator: ',',
      percentSymbol: '%',
      currencySymbol: '₩',
      currencyCode: 'KRW',
    },
    dateFormat: {
      shortDate: 'YYYY.MM.DD.',
      longDate: 'Y년 M월 D일',
      shortTime: 'H:mm',
      longTime: 'H:mm:ss',
      fullDateTime: 'Y년 M월 D일 H:mm:ss',
    },
  },
  ar_SA: {
    code: 'ar_SA',
    name: 'Arabic (Saudi Arabia)',
    nativeName: 'العربية',
    direction: 'rtl',
    pluralRules: (n: number) => {
      if (n === 0) return 'zero';
      if (n === 1) return 'one';
      if (n === 2) return 'two';
      if (n >= 3 && n <= 10) return 'few';
      if (n >= 11 && n <= 99) return 'many';
      return 'other';
    },
    numberFormat: {
      decimalSeparator: '٫',
      groupSeparator: '٬',
      percentSymbol: '٪',
      currencySymbol: 'ر.س',
      currencyCode: 'SAR',
    },
    dateFormat: {
      shortDate: 'DD/MM/YYYY',
      longDate: 'D MMMM YYYY',
      shortTime: 'HH:mm',
      longTime: 'HH:mm:ss',
      fullDateTime: 'D MMMM YYYY HH:mm:ss',
    },
  },
  pt_BR: {
    code: 'pt_BR',
    name: 'Portuguese (Brazil)',
    nativeName: 'Português',
    direction: 'ltr',
    pluralRules: (n: number) => (n === 1 ? 'one' : 'other'),
    numberFormat: {
      decimalSeparator: ',',
      groupSeparator: '.',
      percentSymbol: '%',
      currencySymbol: 'R$',
      currencyCode: 'BRL',
    },
    dateFormat: {
      shortDate: 'DD/MM/YYYY',
      longDate: 'D [de] MMMM [de] YYYY',
      shortTime: 'HH:mm',
      longTime: 'HH:mm:ss',
      fullDateTime: 'D [de] MMMM [de] YYYY HH:mm:ss',
    },
  },
  ru_RU: {
    code: 'ru_RU',
    name: 'Russian',
    nativeName: 'Русский',
    direction: 'ltr',
    pluralRules: (n: number) => {
      const lastTwo = n % 100;
      const lastOne = n % 10;
      if (lastOne === 1 && lastTwo !== 11) return 'one';
      if (lastOne >= 2 && lastOne <= 4 && (lastTwo < 10 || lastTwo >= 20)) return 'few';
      return 'many';
    },
    numberFormat: {
      decimalSeparator: ',',
      groupSeparator: ' ',
      percentSymbol: '%',
      currencySymbol: '₽',
      currencyCode: 'RUB',
    },
    dateFormat: {
      shortDate: 'DD.MM.YYYY',
      longDate: 'D MMMM YYYY г.',
      shortTime: 'HH:mm',
      longTime: 'HH:mm:ss',
      fullDateTime: 'D MMMM YYYY г. HH:mm:ss',
    },
  },
  hi_IN: {
    code: 'hi_IN',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    direction: 'ltr',
    pluralRules: (n: number) => (n === 1 ? 'one' : 'other'),
    numberFormat: {
      decimalSeparator: '.',
      groupSeparator: ',',
      percentSymbol: '%',
      currencySymbol: '₹',
      currencyCode: 'INR',
    },
    dateFormat: {
      shortDate: 'DD/MM/YYYY',
      longDate: 'D MMMM YYYY',
      shortTime: 'h:mm a',
      longTime: 'h:mm:ss a',
      fullDateTime: 'D MMMM YYYY h:mm:ss a',
    },
  },
};

export const DEFAULT_I18N_CONFIG: Partial<I18nConfig> = {
  defaultLocale: 'en_US',
  fallbackLocale: 'en_US',
  supportedLocales: SUPPORTED_LOCALES,
};

export const NAMESPACE_SEPARATOR = ':';

export const INTERPOLATION_PATTERN = /\{\{(\w+)\}\}/g;

export function generateTranslationId(prefix: string = 'i18n'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${random}`;
}

export function isPluralMessage(value: unknown): value is PluralMessage {
  if (value === null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  if (
    typeof obj.id !== 'string' ||
    typeof obj.namespace !== 'string' ||
    typeof obj.key !== 'string' ||
    typeof obj.forms !== 'object' ||
    obj.forms === null
  ) {
    return false;
  }
  const forms = obj.forms as Record<string, unknown>;
  const genderKeys = ['male', 'female'];
  const hasGenderKey = genderKeys.some(key => key in forms);
  if (hasGenderKey) {
    return false;
  }
  const pluralKeys = ['zero', 'one', 'two', 'few', 'many', 'other'];
  const hasPluralKey = pluralKeys.some(key => key in forms);
  return hasPluralKey;
}

export function isGenderMessage(value: unknown): value is GenderMessage {
  if (value === null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  if (
    typeof obj.id !== 'string' ||
    typeof obj.namespace !== 'string' ||
    typeof obj.key !== 'string' ||
    typeof obj.forms !== 'object' ||
    obj.forms === null
  ) {
    return false;
  }
  const forms = obj.forms as Record<string, unknown>;
  const genderKeys = ['male', 'female', 'other'];
  const hasGenderKey = genderKeys.some(key => key in forms);
  return hasGenderKey;
}

export function isValidLocale(locale: string): locale is Locale {
  return SUPPORTED_LOCALES.includes(locale as Locale);
}

export function parseLocale(localeString: string): Locale | null {
  if (!localeString || localeString.length === 0) {
    return null;
  }
  
  const parts = localeString.split(/[-_]/);
  if (parts.length >= 2) {
    const language = parts[0].toLowerCase();
    const country = parts[1].toUpperCase();
    const candidate = `${language}_${country}`;
    if (isValidLocale(candidate)) {
      return candidate;
    }
  }
  
  for (const supported of SUPPORTED_LOCALES) {
    if (supported.startsWith(localeString.toLowerCase())) {
      return supported;
    }
  }
  
  return null;
}

export function interpolateMessage(
  message: string,
  params: InterpolationParams
): string {
  return message.replace(INTERPOLATION_PATTERN, (match, key) => {
    if (params.hasOwnProperty(key)) {
      const value = params[key];
      if (value instanceof Date) {
        return value.toISOString();
      }
      return String(value);
    }
    return match;
  });
}

export function getPluralCategory(
  count: number,
  rules: PluralRules
): PluralCategory {
  return rules(count);
}

export function getLocaleInfo(locale: Locale): LocaleInfo | undefined {
  return LOCALE_INFO[locale];
}

export function isRTL(locale: Locale): boolean {
  const info = LOCALE_INFO[locale];
  return info ? info.direction === 'rtl' : false;
}

export interface I18nError extends Error {
  code: string;
  locale?: Locale;
  namespace?: string;
  key?: string;
}

export const I18N_ERROR_CODES = {
  LOCALE_NOT_FOUND: 'I18N_LOCALE_NOT_FOUND',
  NAMESPACE_NOT_FOUND: 'I18N_NAMESPACE_NOT_FOUND',
  TRANSLATION_NOT_FOUND: 'I18N_TRANSLATION_NOT_FOUND',
  INVALID_LOCALE: 'I18N_INVALID_LOCALE',
  INVALID_PLURAL_COUNT: 'I18N_INVALID_PLURAL_COUNT',
  INVALID_GENDER: 'I18N_INVALID_GENDER',
  INTERPOLATION_ERROR: 'I18N_INTERPOLATION_ERROR',
  CONFIGURATION_ERROR: 'I18N_CONFIGURATION_ERROR',
} as const;
