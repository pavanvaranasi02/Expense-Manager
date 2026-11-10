export const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
];

export const DEFAULT_EXCHANGE_RATES = {
  INR: 1,
  USD: 86.5,
  EUR: 92.0,
  GBP: 110.0,
  AED: 23.5,
  CAD: 63.0,
  AUD: 56.0,
  SGD: 65.0,
  JPY: 0.58,
};

export const getDefaultExchangeRate = (currencyCode) => {
  if (!currencyCode) return 1;
  const upper = String(currencyCode).toUpperCase();
  return DEFAULT_EXCHANGE_RATES[upper] || 1;
};

export const getCurrencySymbol = (currencyCode, defaultSymbol = '₹') => {
  if (!currencyCode) return defaultSymbol;
  const match = CURRENCIES.find(
    (c) => c.code.toUpperCase() === String(currencyCode).toUpperCase()
  );
  return match ? match.symbol : defaultSymbol;
};

/**
 * Check if an investment or currency string is a foreign investment.
 * Uses currency short name (e.g. 'USD', 'EUR') as the canonical flag.
 *
 * @param {Object|string} invOrCurrency - Investment object or currency short name (e.g. 'USD', 'INR')
 * @param {string} baseCurrency - Base currency short name (defaults to 'INR')
 * @returns {boolean}
 */
export const isForeignInvestment = (invOrCurrency, baseCurrency = 'INR') => {
  if (!invOrCurrency) return false;
  const currencyShortName = typeof invOrCurrency === 'string'
    ? invOrCurrency
    : (invOrCurrency.currency || invOrCurrency.currencyCode || baseCurrency);

  const cleanShortName = String(currencyShortName).trim().toUpperCase();
  const cleanBase = String(baseCurrency).trim().toUpperCase();

  return cleanShortName !== cleanBase && cleanShortName !== '₹' && cleanShortName !== '';
};

/**
 * Returns the canonical currency short name flag for an investment (e.g. 'USD', 'INR').
 */
export const getInvestmentCurrencyShortName = (inv, defaultShortName = 'INR') => {
  if (!inv) return defaultShortName;
  if (typeof inv === 'string') return inv.trim().toUpperCase();
  return (inv.currency || inv.currencyCode || defaultShortName).trim().toUpperCase();
};

/**
 * Early detection of foreign/US investments from name, platform, ticker or existing short name flag.
 */
export const detectForeignInvestment = (name = '', platform = '', currentFlag = null) => {
  // If an existing short name flag is provided and it's already foreign, use it directly
  if (currentFlag && isForeignInvestment(currentFlag)) {
    const code = String(currentFlag).trim().toUpperCase();
    return {
      isForeign: true,
      currency: code,
      suggestedCurrency: code,
      defaultRate: DEFAULT_EXCHANGE_RATES[code] || 1,
      reason: `Flagged as foreign (${code})`,
    };
  }

  const combined = `${name} ${platform}`.toLowerCase();

  if (/\b(eur|euro|europe)\b/i.test(combined)) {
    return {
      isForeign: true,
      currency: 'EUR',
      suggestedCurrency: 'EUR',
      defaultRate: DEFAULT_EXCHANGE_RATES.EUR,
      reason: 'European market/currency detected',
    };
  }
  if (/\b(gbp|pound|uk|london|ftse)\b/i.test(combined)) {
    return {
      isForeign: true,
      currency: 'GBP',
      suggestedCurrency: 'GBP',
      defaultRate: DEFAULT_EXCHANGE_RATES.GBP,
      reason: 'UK market/currency detected',
    };
  }
  if (/\b(aed|dirham|dubai|uae)\b/i.test(combined)) {
    return {
      isForeign: true,
      currency: 'AED',
      suggestedCurrency: 'AED',
      defaultRate: DEFAULT_EXCHANGE_RATES.AED,
      reason: 'UAE/AED detected',
    };
  }
  if (/\b(cad|canada)\b/i.test(combined)) {
    return {
      isForeign: true,
      currency: 'CAD',
      suggestedCurrency: 'CAD',
      defaultRate: DEFAULT_EXCHANGE_RATES.CAD,
      reason: 'Canadian Dollar detected',
    };
  }
  if (/\b(aud|australia)\b/i.test(combined)) {
    return {
      isForeign: true,
      currency: 'AUD',
      suggestedCurrency: 'AUD',
      defaultRate: DEFAULT_EXCHANGE_RATES.AUD,
      reason: 'Australian Dollar detected',
    };
  }
  if (/\b(sgd|singapore)\b/i.test(combined)) {
    return {
      isForeign: true,
      currency: 'SGD',
      suggestedCurrency: 'SGD',
      defaultRate: DEFAULT_EXCHANGE_RATES.SGD,
      reason: 'Singapore Dollar detected',
    };
  }
  if (/\b(jpy|yen|japan)\b/i.test(combined)) {
    return {
      isForeign: true,
      currency: 'JPY',
      suggestedCurrency: 'JPY',
      defaultRate: DEFAULT_EXCHANGE_RATES.JPY,
      reason: 'Japanese Yen detected',
    };
  }

  const usPatterns = [
    /\b(us\s*stocks?|usa?|united\s*states|wall\s*street)\b/i,
    /\b(nasdaq|nyse|dow\s*jones|s&p\s*500|sp500|s&p)\b/i,
    /\b(indmoney|alpaca|vested|schwab|charles\s*schwab|interactive\s*brokers|ibkr|robinhood|webull|etoro|fidelity|vanguard)\b/i,
    /\b(voo|vti|qqq|spy|dia|aapl|apple|msft|microsoft|nvda|nvidia|tsla|tesla|amzn|amazon|googl|google|meta)\b/i,
    /\b(usd|\$|dollars?)\b/i,
  ];

  for (const pattern of usPatterns) {
    if (pattern.test(combined)) {
      return {
        isForeign: true,
        currency: 'USD',
        suggestedCurrency: 'USD',
        defaultRate: DEFAULT_EXCHANGE_RATES.USD,
        reason: 'US platform/stock detected',
      };
    }
  }

  return { isForeign: false, currency: 'INR', suggestedCurrency: 'INR', defaultRate: 1, reason: null };
};

/**
 * Sanitizes numeric input while preserving at most one decimal point for currency values.
 */
export const cleanDecimal = (val) => {
  if (val === undefined || val === null) return '';
  const str = String(val);
  const cleaned = str.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  return cleaned;
};

