/**
 * Utility to mask currency values if stealth mode is active.
 * @param {number|string} value - The amount to format.
 * @param {boolean} isStealth - Whether stealth mode is active.
 * @param {string} symbol - Currency symbol (e.g., ₹).
 * @returns {string} - Formatted or masked string.
 */
export const formatCurrency = (value, isStealth, symbol = '₹') => {
  if (isStealth) return '****';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return `${symbol}0`;
  
  return `${symbol}${num.toLocaleString('en-IN')}`;
};

/**
 * Returns a percentage string if stealth mode is active, 
 * otherwise returns the population/value for labels.
 */
export const getChartLabel = (value, total, isStealth) => {
  if (!isStealth) return value.toLocaleString('en-IN');
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return `${percent}%`;
};
