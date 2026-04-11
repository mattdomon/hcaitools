/**
 * Internationalization (i18n) System Implementation
 */

import {
  Locale,
  LocaleInfo,
  TranslationDictionary,
  TranslationOptions,
  InterpolationParams,
  I18nConfig,
  LanguageDetectionResult,
  DateTimeFormatOptions,
  NumberFormatValueOptions,
  CurrencyFormatOptions,
  PluralCategory,
  PluralMessage,
  GenderMessage,
  TranslationValue,
  I18nError,
  I18N_ERROR_CODES,
  SUPPORTED_LOCALES,
  DEFAULT_I18N_CONFIG,
  isPluralMessage,
  isGenderMessage,
  isValidLocale,
  parseLocale,
  interpolateMessage,
  getPluralCategory,
  getLocaleInfo,
  isRTL,
} from './types';

export class I18n {
  private config: I18nConfig;
  private currentLocale: Locale;
  private translationCache: Map<string, string> = new Map();

  constructor(config: Partial<I18nConfig> & { translations: TranslationDictionary }) {
    const fullConfig: I18nConfig = {
      defaultLocale: config.defaultLocale || DEFAULT_I18N_CONFIG.defaultLocale || 'en_US',
      fallbackLocale: config.fallbackLocale || DEFAULT_I18N_CONFIG.fallbackLocale || 'en_US',
      supportedLocales: config.supportedLocales || DEFAULT_I18N_CONFIG.supportedLocales || SUPPORTED_LOCALES,
      translations: config.translations,
      detectLanguage: config.detectLanguage,
      storeLocale: config.storeLocale,
      missingTranslationHandler: config.missingTranslationHandler,
    };

    if (!isValidLocale(fullConfig.defaultLocale)) {
      throw this.createError('INVALID_LOCALE', `Default locale "${fullConfig.defaultLocale}" is not supported`);
    }

    this.config = fullConfig;
    this.currentLocale = fullConfig.defaultLocale;
  }

  private createError(code: keyof typeof I18N_ERROR_CODES, message: string, _notification?: unknown): I18nError {
    const error = new Error(message) as I18nError;
    error.code = I18N_ERROR_CODES[code];
    return error;
  }

  getLocale(): Locale {
    return this.currentLocale;
  }

  setLocale(locale: Locale): void {
    if (!isValidLocale(locale)) {
      throw this.createError('INVALID_LOCALE', `Locale "${locale}" is not supported`);
    }
    this.currentLocale = locale;
    this.translationCache.clear();
    
    if (this.config.storeLocale) {
      this.config.storeLocale(locale);
    }
  }

  getConfig(): I18nConfig {
    return { ...this.config };
  }

  t(key: string, options?: TranslationOptions): string {
    const namespace = options?.namespace || 'common';
    const locale = options?.locale || this.currentLocale;
    const cacheKey = `${locale}:${namespace}:${key}`;

    if (this.translationCache.has(cacheKey)) {
      const cached = this.translationCache.get(cacheKey)!;
      if (options?.params) {
        return interpolateMessage(cached, options.params);
      }
      return cached;
    }

    const message = this.resolveTranslation(key, namespace, locale);
    
    if (!message) {
      if (this.config.missingTranslationHandler) {
        const fallback = this.config.missingTranslationHandler(key, namespace);
        if (options?.params) {
          return interpolateMessage(fallback, options.params);
        }
        return fallback;
      }
      return key;
    }

    if (typeof message === 'string') {
      this.translationCache.set(cacheKey, message);
      if (options?.params) {
        return interpolateMessage(message, options.params);
      }
      return message;
    }

    return this.handleComplexMessage(message, options);
  }

  private resolveTranslation(key: string, namespace: string, locale: Locale): TranslationValue | null {
    const translations = this.config.translations[namespace];
    if (!translations) {
      return this.tryFallback(key, namespace, locale);
    }

    const message = translations[key];
    if (message) {
      return message;
    }

    return this.tryFallback(key, namespace, locale);
  }

  private tryFallback(key: string, namespace: string, locale: Locale): TranslationValue | null {
    if (locale === this.config.fallbackLocale) {
      return null;
    }

    if (locale !== this.config.defaultLocale) {
      const fallbackResult = this.resolveTranslation(key, namespace, this.config.defaultLocale);
      if (fallbackResult) {
        return fallbackResult;
      }
    }

    return this.resolveTranslation(key, namespace, this.config.fallbackLocale);
  }

  private handleComplexMessage(message: PluralMessage | GenderMessage, options?: TranslationOptions): string {
    if (isPluralMessage(message)) {
      return this.handlePluralMessage(message, options);
    }

    if (isGenderMessage(message)) {
      return this.handleGenderMessage(message, options);
    }

    return String(message);
  }

  private handlePluralMessage(message: PluralMessage, options?: TranslationOptions): string {
    if (options?.pluralCount === undefined || options?.pluralCount === null) {
      throw this.createError('INVALID_PLURAL_COUNT', 'pluralCount is required for plural messages');
    }

    const localeInfo = getLocaleInfo(this.currentLocale);
    if (!localeInfo) {
      throw this.createError('LOCALE_NOT_FOUND', `Locale info not found for "${this.currentLocale}"`);
    }

    const category = getPluralCategory(options.pluralCount, localeInfo.pluralRules);
    let form = message.forms[category];

    if (!form) {
      form = message.forms.other || Object.values(message.forms)[0];
    }

    if (options.params) {
      const params = { ...options.params, count: options.pluralCount };
      return interpolateMessage(form, params);
    }

    return interpolateMessage(form, { count: options.pluralCount });
  }

  private handleGenderMessage(message: GenderMessage, options?: TranslationOptions): string {
    if (!options?.gender) {
      const firstForm = Object.values(message.forms)[0];
      return firstForm || '';
    }

    let form = message.forms[options.gender];

    if (!form) {
      form = message.forms.other || Object.values(message.forms)[0];
    }

    if (options.params) {
      return interpolateMessage(form, options.params);
    }

    return form;
  }

  tc(key: string, count: number, options?: Omit<TranslationOptions, 'pluralCount'>): string {
    return this.t(key, { ...options, pluralCount: count });
  }

  tg(key: string, gender: string, options?: Omit<TranslationOptions, 'gender'>): string {
    return this.t(key, { ...options, gender });
  }

  detectLanguage(): LanguageDetectionResult {
    if (this.config.detectLanguage) {
      const detected = this.config.detectLanguage();
      return {
        locale: detected,
        confidence: 1.0,
        source: 'navigator',
      };
    }

    return {
      locale: this.config.defaultLocale,
      confidence: 1.0,
      source: 'default',
    };
  }

  formatDate(date: Date, options?: DateTimeFormatOptions): string {
    const locale = options?.locale || this.currentLocale;
    const localeInfo = getLocaleInfo(locale);
    
    if (!localeInfo) {
      return date.toLocaleDateString();
    }

    const format = options?.format || 'shortDate';
    const formatString = localeInfo.dateFormat[format as keyof typeof localeInfo.dateFormat] || format;
    
    return this.interpolateDateFormat(date, formatString);
  }

  formatTime(date: Date, options?: DateTimeFormatOptions): string {
    const locale = options?.locale || this.currentLocale;
    const localeInfo = getLocaleInfo(locale);
    
    if (!localeInfo) {
      return date.toLocaleTimeString();
    }

    const format = options?.format || 'shortTime';
    const formatString = localeInfo.dateFormat[format as keyof typeof localeInfo.dateFormat] || format;
    
    return this.interpolateTimeFormat(date, formatString, options?.hour12);
  }

  formatDateTime(date: Date, options?: DateTimeFormatOptions): string {
    const locale = options?.locale || this.currentLocale;
    const localeInfo = getLocaleInfo(locale);
    
    if (!localeInfo) {
      return date.toLocaleString();
    }

    const format = options?.format || 'fullDateTime';
    const formatString = localeInfo.dateFormat[format as keyof typeof localeInfo.dateFormat] || format;
    
    const dateStr = this.interpolateDateFormat(date, formatString);
    const timeStr = this.interpolateTimeFormat(date, localeInfo.dateFormat.shortTime, options?.hour12);
    
    return `${dateStr} ${timeStr}`;
  }

  private interpolateDateFormat(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    return format
      .replace(/YYYY/g, String(year))
      .replace(/YY/g, String(year).slice(-2))
      .replace(/MMMM/g, this.getMonthName(date.getMonth(), 'long'))
      .replace(/MMM/g, this.getMonthName(date.getMonth(), 'short'))
      .replace(/MM/g, String(month).padStart(2, '0'))
      .replace(/M/g, String(month))
      .replace(/DD/g, String(day).padStart(2, '0'))
      .replace(/D/g, String(day));
  }

  private interpolateTimeFormat(date: Date, format: string, hour12?: boolean): string {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    
    let ampm = '';
    let useHour12 = hour12 !== undefined ? hour12 : false;
    
    if (useHour12 || format.includes('A') || format.includes('a')) {
      useHour12 = true;
      if (hours >= 12) {
        ampm = 'PM';
      } else {
        ampm = 'AM';
      }
      hours = hours % 12 || 12;
    }
    
    return format
      .replace(/HH/g, String(date.getHours()).padStart(2, '0'))
      .replace(/H/g, String(date.getHours()))
      .replace(/hh/g, String(hours).padStart(2, '0'))
      .replace(/h/g, String(hours))
      .replace(/mm/g, String(minutes).padStart(2, '0'))
      .replace(/m/g, String(minutes))
      .replace(/ss/g, String(seconds).padStart(2, '0'))
      .replace(/s/g, String(seconds))
      .replace(/A/g, ampm)
      .replace(/a/g, ampm.toLowerCase());
  }

  private monthNames: Record<string, string[]> = {
    en_US: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    en_GB: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    zh_CN: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
    zh_TW: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
    es_ES: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    es_MX: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    fr_FR: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    de_DE: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    ja_JP: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    ko_KR: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
    ar_SA: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    pt_BR: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
    ru_RU: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    hi_IN: ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
  };

  private getMonthName(month: number, _style: 'long' | 'short' = 'long'): string {
    const names = this.monthNames[this.currentLocale] || this.monthNames['en_US'];
    return names[month] || '';
  }

  formatNumber(value: number, options?: NumberFormatValueOptions): string {
    const locale = options?.locale || this.currentLocale;
    const localeInfo = getLocaleInfo(locale);
    
    if (!localeInfo) {
      return value.toString();
    }

    const { decimalSeparator, groupSeparator } = localeInfo.numberFormat;
    const fractionDigits = value.toFixed(
      options?.maximumFractionDigits !== undefined 
        ? options.maximumFractionDigits 
        : (value % 1 !== 0 ? 2 : 0)
    );

    const [intPart, decPart] = fractionDigits.split('.');
    const formattedInt = this.groupDigits(intPart, groupSeparator);
    
    if (decPart !== undefined) {
      return `${formattedInt}${decimalSeparator}${decPart}`;
    }
    
    return formattedInt;
  }

  private groupDigits(value: string, separator: string): string {
    const reversed = value.split('').reverse();
    const groups: string[] = [];
    
    for (let i = 0; i < reversed.length; i += 3) {
      groups.push(reversed.slice(i, i + 3).reverse().join(''));
    }
    
    return groups.reverse().join(separator);
  }

  formatPercent(value: number, options?: NumberFormatValueOptions): string {
    const locale = options?.locale || this.currentLocale;
    const localeInfo = getLocaleInfo(locale);
    
    if (!localeInfo) {
      return `${(value * 100).toFixed(0)}%`;
    }

    const formatted = this.formatNumber(value * 100, {
      ...options,
      maximumFractionDigits: options?.maximumFractionDigits !== undefined ? options.maximumFractionDigits : 1,
    });

    return `${formatted}${localeInfo.numberFormat.percentSymbol}`;
  }

  formatCurrency(value: number, options?: CurrencyFormatOptions): string {
    const locale = options?.locale || this.currentLocale;
    const localeInfo = getLocaleInfo(locale);
    
    if (!localeInfo) {
      return `${value}`;
    }

    const currencySymbol = options?.currencySymbol || localeInfo.numberFormat.currencySymbol;
    const formatted = this.formatNumber(value, options);
    
    if (options?.showCurrency === false) {
      return formatted;
    }
    
    return `${currencySymbol}${formatted}`;
  }

  addTranslation(namespace: string, translations: Record<string, string | PluralMessage | GenderMessage>): void {
    if (!this.config.translations[namespace]) {
      this.config.translations[namespace] = {};
    }
    
    this.config.translations[namespace] = {
      ...this.config.translations[namespace],
      ...translations,
    };
    
    this.translationCache.clear();
  }

  removeTranslation(namespace: string, key?: string): void {
    if (key) {
      if (this.config.translations[namespace]) {
        delete this.config.translations[namespace][key];
      }
    } else {
      delete this.config.translations[namespace];
    }
    
    this.translationCache.clear();
  }

  hasTranslation(key: string, namespace?: string): boolean {
    const ns = namespace || 'common';
    return this.config.translations[ns]?.[key] !== undefined;
  }

  getAvailableLocales(): Locale[] {
    return [...SUPPORTED_LOCALES];
  }

  isLocaleSupported(locale: Locale): boolean {
    return isValidLocale(locale);
  }

  getLocaleInfo(locale: Locale): LocaleInfo | undefined {
    return getLocaleInfo(locale);
  }

  isRTL(locale?: Locale): boolean {
    return isRTL(locale || this.currentLocale);
  }

  clearCache(): void {
    this.translationCache.clear();
  }

  createChildI18n(additionalTranslations: TranslationDictionary): I18n {
    const mergedTranslations: TranslationDictionary = {};
    
    for (const [ns, messages] of Object.entries(this.config.translations)) {
      mergedTranslations[ns] = { ...messages };
    }
    
    for (const [ns, messages] of Object.entries(additionalTranslations)) {
      if (!mergedTranslations[ns]) {
        mergedTranslations[ns] = {};
      }
      mergedTranslations[ns] = { ...mergedTranslations[ns], ...messages };
    }

    return new I18n({
      ...this.config,
      translations: mergedTranslations,
    });
  }
}

export function createI18n(config: Partial<I18nConfig> & { translations: TranslationDictionary }): I18n {
  return new I18n(config);
}

export function detectLanguageFromNavigator(): Locale {
  const getNavigator = (): { languages?: string[]; language: string } | undefined => {
    try {
      const global = globalThis as unknown as Record<string, unknown>;
      const nav = global['navigator'];
      if (nav && typeof nav === 'object') {
        return nav as { languages?: string[]; language: string };
      }
      return undefined;
    } catch {
      return undefined;
    }
  };

  const nav = getNavigator();
  if (!nav) {
    return 'en_US';
  }

  const languages = nav.languages || [nav.language];
  
  for (const lang of languages) {
    if (lang) {
      const parsed = parseLocale(lang);
      if (parsed && isValidLocale(parsed)) {
        return parsed;
      }
    }
  }

  return 'en_US';
}

export function detectLanguageFromUrl(url: string): Locale | null {
  try {
    const urlObj = new URL(url);
    const localeParam = urlObj.searchParams.get('locale') || urlObj.searchParams.get('lang');
    
    if (localeParam) {
      const parsed = parseLocale(localeParam);
      if (parsed) {
        return parsed;
      }
    }

    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      const firstPart = pathParts[0];
      const parsed = parseLocale(firstPart);
      if (parsed) {
        return parsed;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function detectLanguageFromCookie(cookieString: string): Locale | null {
  const cookies = cookieString.split(';').map(c => c.trim());
  
  for (const cookie of cookies) {
    const [name, value] = cookie.split('=');
    if (name === 'locale' || name === 'lang') {
      const parsed = parseLocale(value);
      if (parsed) {
        return parsed;
      }
    }
  }

  return null;
}

export function formatMessage(message: string, params: InterpolationParams): string {
  return interpolateMessage(message, params);
}

export function getPluralForm(count: number, locale: Locale): PluralCategory {
  const localeInfo = getLocaleInfo(locale);
  if (!localeInfo) {
    return 'other';
  }
  return getPluralCategory(count, localeInfo.pluralRules);
}

export class I18nNamespace {
  constructor(
    private i18n: I18n,
    private namespace: string
  ) {}

  t(key: string, options?: TranslationOptions): string {
    return this.i18n.t(key, { ...options, namespace: this.namespace });
  }

  tc(key: string, count: number, options?: Omit<TranslationOptions, 'pluralCount'>): string {
    return this.i18n.tc(key, count, { ...options, namespace: this.namespace });
  }

  tg(key: string, gender: string, options?: Omit<TranslationOptions, 'gender'>): string {
    return this.i18n.tg(key, gender, { ...options, namespace: this.namespace });
  }
}

export function createNamespace(i18n: I18n, namespace: string): I18nNamespace {
  return new I18nNamespace(i18n, namespace);
}
