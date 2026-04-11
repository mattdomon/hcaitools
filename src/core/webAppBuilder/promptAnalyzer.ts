/**
 * Prompt Analyzer - Parses natural language prompts to extract application requirements
 */

import {
  AppType,
  DatabaseType,
  FrontendFramework,
  BackendFramework,
  PromptAnalysisResult,
} from './types';

const APP_TYPE_KEYWORDS: Record<AppType, string[]> = {
  'saas-dashboard': ['saas', 'dashboard', 'analytics', 'metrics', 'admin panel', 'management'],
  'landing-page': ['landing page', 'marketing', 'promotional', 'product page', 'waitlist'],
  'e-commerce': ['store', 'shop', 'ecommerce', 'e-commerce', 'product', 'cart', 'checkout', 'buy'],
  portfolio: ['portfolio', 'showcase', 'personal site', 'resume', 'work samples'],
  'booking-system': ['booking', 'reservation', 'appointment', 'schedule', 'calendar'],
  'community-platform': ['community', 'forum', 'social', 'network', 'members', 'discussion'],
  'membership-site': ['membership', 'subscription', 'premium content', 'access control', 'paywall'],
  custom: [],
};

const AUTH_KEYWORDS = ['login', 'signup', 'register', 'authentication', 'user account', 'secure'];
const PAYMENT_KEYWORDS = ['payment', 'pay', 'billing', 'stripe', 'purchase', 'subscribe', 'checkout'];
const MONGODB_KEYWORDS = ['flexible', 'document', 'nosql', 'unstructured', 'nested'];

/**
 * Analyzes a natural language prompt to extract application requirements
 */
export function analyzePrompt(prompt: string): PromptAnalysisResult {
  const lowerPrompt = prompt.toLowerCase();

  const appType = detectAppType(lowerPrompt);
  const features = extractFeatures(lowerPrompt, appType);
  const entities = extractEntities(lowerPrompt, appType);
  const requiresAuth = AUTH_KEYWORDS.some((kw) => lowerPrompt.includes(kw));
  const requiresPayments = PAYMENT_KEYWORDS.some((kw) => lowerPrompt.includes(kw));
  const suggestedDatabase = suggestDatabase(lowerPrompt, appType);
  const suggestedFrontend: FrontendFramework = lowerPrompt.includes('vue') ? 'vue' : 'react';
  const suggestedBackend: BackendFramework = lowerPrompt.includes('python') ? 'python' : 'nodejs';

  return {
    appType,
    features,
    entities,
    requiresAuth,
    requiresPayments,
    suggestedDatabase,
    suggestedFrontend,
    suggestedBackend,
  };
}

function detectAppType(lowerPrompt: string): AppType {
  for (const [type, keywords] of Object.entries(APP_TYPE_KEYWORDS) as [AppType, string[]][]) {
    if (type === 'custom') continue;
    if (keywords.some((kw) => lowerPrompt.includes(kw))) {
      return type;
    }
  }
  return 'custom';
}

function extractFeatures(lowerPrompt: string, appType: AppType): string[] {
  const features: string[] = [];

  if (AUTH_KEYWORDS.some((kw) => lowerPrompt.includes(kw))) {
    features.push('user-authentication');
  }
  if (PAYMENT_KEYWORDS.some((kw) => lowerPrompt.includes(kw))) {
    features.push('payment-processing');
  }
  if (lowerPrompt.includes('search')) features.push('search');
  if (lowerPrompt.includes('notif')) features.push('notifications');
  if (lowerPrompt.includes('upload') || lowerPrompt.includes('file')) features.push('file-upload');
  if (lowerPrompt.includes('email')) features.push('email-integration');
  if (lowerPrompt.includes('api')) features.push('rest-api');
  if (lowerPrompt.includes('real-time') || lowerPrompt.includes('realtime')) features.push('real-time');

  const typeFeatures: Record<AppType, string[]> = {
    'saas-dashboard': ['dashboard', 'charts', 'reports', 'team-management'],
    'landing-page': ['hero-section', 'cta', 'responsive-design'],
    'e-commerce': ['product-catalog', 'shopping-cart', 'order-management'],
    portfolio: ['project-gallery', 'contact-form', 'about-section'],
    'booking-system': ['calendar', 'availability', 'booking-confirmation'],
    'community-platform': ['user-profiles', 'posts', 'comments', 'reactions'],
    'membership-site': ['content-gating', 'member-profiles', 'tier-management'],
    custom: [],
  };

  return [...new Set([...features, ...(typeFeatures[appType] || [])])];
}

function extractEntities(lowerPrompt: string, appType: AppType): string[] {
  const defaultEntities: Record<AppType, string[]> = {
    'saas-dashboard': ['User', 'Organization', 'Report', 'Dashboard'],
    'landing-page': ['Lead', 'Subscriber'],
    'e-commerce': ['Product', 'Order', 'Customer', 'Cart', 'Category'],
    portfolio: ['Project', 'Skill', 'Contact'],
    'booking-system': ['Booking', 'Service', 'Provider', 'TimeSlot'],
    'community-platform': ['User', 'Post', 'Comment', 'Group'],
    'membership-site': ['Member', 'Plan', 'Content', 'Subscription'],
    custom: ['User', 'Item'],
  };

  const entities = defaultEntities[appType] || defaultEntities.custom;

  // Extract any explicitly mentioned entities from prompt
  const words = lowerPrompt.split(/\s+/);
  words.forEach((word) => {
    const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
    if (
      word.length > 4 &&
      !entities.includes(capitalized) &&
      !['this', 'that', 'with', 'from', 'want', 'need', 'have', 'will'].includes(word)
    ) {
      // Only add commonly domain-like words (skip generic words)
    }
  });

  return entities;
}

function suggestDatabase(lowerPrompt: string, appType: AppType): DatabaseType {
  if (MONGODB_KEYWORDS.some((kw) => lowerPrompt.includes(kw))) {
    return 'mongodb';
  }
  if (appType === 'community-platform') {
    return 'mongodb';
  }
  return 'postgresql';
}
