import { fromPaise, toPaise, TRANSACTION_TYPES } from './financialCalculationService.js';

const VALID_TYPES = new Set([
  TRANSACTION_TYPES.EXPENSE,
  TRANSACTION_TYPES.INCOME,
  TRANSACTION_TYPES.TRANSFER,
]);

/**
 * Generate a unique stable identifier for transactions and idempotency keys.
 */
export const generateStableId = (prefix = 'txn') =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

/**
 * Deduplicate an array of records by their `id` field, preserving the first occurrence.
 */
export const deduplicateById = (items = []) => {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (!item || !item.id) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
};

/**
 * Validate a transaction payload before persistence.
 * Returns `{ valid: true, normalized }` or `{ valid: false, error }`.
 */
export const validateTransactionInput = (
  data,
  { kind = TRANSACTION_TYPES.EXPENSE, accounts = null, requireAccount = false } = {}
) => {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Transaction payload is required.' };
  }

  const txType =
    data.isTransfer || data.transactionType === TRANSACTION_TYPES.TRANSFER
      ? TRANSACTION_TYPES.TRANSFER
      : data.transactionType || kind;

  if (!VALID_TYPES.has(txType)) {
    return { valid: false, error: `Invalid transaction type: ${txType}` };
  }

  const rawAmount = data.amount;
  const parsedAmount = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount);
  const amountPaise = toPaise(parsedAmount);
  if (!Number.isFinite(parsedAmount) || amountPaise <= 0) {
    return { valid: false, error: 'Transaction amount must be greater than 0.' };
  }

  const parsedDate = data.date ? new Date(data.date) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return { valid: false, error: 'Transaction date is invalid.' };
  }

  if (txType === TRANSACTION_TYPES.EXPENSE && !data.categoryId && !data.categoryName) {
    return { valid: false, error: 'Expense category is required.' };
  }

  if (txType === TRANSACTION_TYPES.INCOME && !data.source && !data.sourceName) {
    return { valid: false, error: 'Income source is required.' };
  }

  if (requireAccount && !data.accountId) {
    return { valid: false, error: 'An account must be selected for this transaction.' };
  }

  if (data.accountId && Array.isArray(accounts)) {
    const matched = accounts.find((acc) => acc && acc.id === data.accountId);
    if (!matched) {
      return {
        valid: false,
        error: `Referenced account (${data.accountId}) does not exist.`,
      };
    }
  }

  return {
    valid: true,
    normalized: {
      amount: fromPaise(amountPaise),
      amountPaise,
      dateIso: parsedDate.toISOString(),
      transactionType: txType,
    },
  };
};

/**
 * Tracks recently completed and in-flight idempotency keys to prevent
 * duplicate transaction creation from repeated save calls or double-taps.
 */
const inFlightKeys = new Set();
const completedKeys = new Map(); // idempotencyKey -> { id, timestamp }
const IDEMPOTENCY_TTL_MS = 60 * 1000;

const pruneCompletedKeys = () => {
  const cutoff = Date.now() - IDEMPOTENCY_TTL_MS;
  for (const [k, v] of completedKeys.entries()) {
    if (v.timestamp < cutoff) {
      completedKeys.delete(k);
    }
  }
};

export const acquireIdempotencyLock = (idempotencyKey) => {
  if (!idempotencyKey) return { acquired: true, existingId: null };
  pruneCompletedKeys();

  if (inFlightKeys.has(idempotencyKey)) {
    return { acquired: false, reason: 'in_flight', existingId: null };
  }
  const completed = completedKeys.get(idempotencyKey);
  if (completed) {
    return { acquired: false, reason: 'duplicate', existingId: completed.id };
  }
  inFlightKeys.add(idempotencyKey);
  return { acquired: true, existingId: null };
};

export const releaseIdempotencyLock = (idempotencyKey, createdId = null) => {
  if (!idempotencyKey) return;
  inFlightKeys.delete(idempotencyKey);
  if (createdId) {
    completedKeys.set(idempotencyKey, { id: createdId, timestamp: Date.now() });
  }
};

export const clearIdempotencyLocks = () => {
  inFlightKeys.clear();
  completedKeys.clear();
};

