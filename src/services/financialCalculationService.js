/**
 * Single financial calculation layer for KOSH.
 *
 * Uses integer minor currency units (paise for INR: 1 INR = 100 paise)
 * for all arithmetic to prevent floating-point rounding drift.
 * Pure JS with no native/React dependencies so it is shared across
 * services, stores, screens, and automated tests.
 */

export const TRANSACTION_TYPES = Object.freeze({
  EXPENSE: 'expense',
  INCOME: 'income',
  TRANSFER: 'transfer',
});

/**
 * Convert a major currency amount (e.g. INR rupees) into integer minor units (paise).
 */
export const toPaise = (amount) => {
  if (amount === null || amount === undefined || amount === '') return 0;
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
};

/**
 * Convert integer minor currency units (paise) back into major currency units (rupees).
 */
export const fromPaise = (paise) => {
  if (!Number.isFinite(paise)) return 0;
  return Math.round(paise) / 100;
};

/**
 * Add two major-currency amounts using integer paise arithmetic.
 */
export const addAmounts = (a, b) => fromPaise(toPaise(a) + toPaise(b));

/**
 * Subtract b from a using integer paise arithmetic.
 */
export const subtractAmounts = (a, b) => fromPaise(toPaise(a) - toPaise(b));

/**
 * Sum an array of items or numeric values using integer paise arithmetic.
 */
export const sumAmounts = (items, selector = (x) => x) => {
  if (!Array.isArray(items) || items.length === 0) return 0;
  let totalPaise = 0;
  for (const item of items) {
    totalPaise += toPaise(selector(item));
  }
  return fromPaise(totalPaise);
};

/**
 * Determine canonical transaction type ('expense' | 'income' | 'transfer').
 */
export const getTransactionType = (tx) => {
  if (!tx || typeof tx !== 'object') return TRANSACTION_TYPES.EXPENSE;
  if (
    tx.transactionType === TRANSACTION_TYPES.TRANSFER ||
    tx.type === TRANSACTION_TYPES.TRANSFER ||
    tx.isTransfer === true
  ) {
    return TRANSACTION_TYPES.TRANSFER;
  }
  if (
    tx.transactionType === TRANSACTION_TYPES.INCOME ||
    tx.type === TRANSACTION_TYPES.INCOME ||
    Boolean(tx.source || tx.sourceName)
  ) {
    return TRANSACTION_TYPES.INCOME;
  }
  return TRANSACTION_TYPES.EXPENSE;
};

export const isTransferTransaction = (tx) =>
  getTransactionType(tx) === TRANSACTION_TYPES.TRANSFER;

export const isIncomeTransaction = (tx) =>
  getTransactionType(tx) === TRANSACTION_TYPES.INCOME;

export const isExpenseTransaction = (tx) =>
  getTransactionType(tx) === TRANSACTION_TYPES.EXPENSE;

/**
 * Compute Total Income, Total Expenses, Net Cash Flow, and Savings Rate
 * from a list of transactions (or separate expenses and incomes lists).
 * Transfers (such as credit card bill payments) are excluded from income/expense totals.
 */
export const calculateCashFlowSummary = (transactions = []) => {
  let incomePaise = 0;
  let expensePaise = 0;
  let expenseCount = 0;
  let incomeCount = 0;

  for (const tx of transactions || []) {
    if (!tx) continue;
    const type = getTransactionType(tx);
    if (type === TRANSACTION_TYPES.TRANSFER) continue;

    const amtPaise = toPaise(tx.amount);
    if (type === TRANSACTION_TYPES.INCOME) {
      incomePaise += amtPaise;
      incomeCount += 1;
    } else {
      expensePaise += amtPaise;
      expenseCount += 1;
    }
  }

  const netPaise = incomePaise - expensePaise;
  const savingsRate =
    incomePaise > 0 ? Math.round((netPaise / incomePaise) * 100) : 0;

  return {
    totalIncome: fromPaise(incomePaise),
    totalExpenses: fromPaise(expensePaise),
    netCashFlow: fromPaise(netPaise),
    savingsRate,
    expenseCount,
    incomeCount,
  };
};

/**
 * Compute category-wise expense breakdown, excluding incomes and transfers.
 */
export const calculateCategorySpending = (transactions = []) => {
  const categoryMap = {};
  let totalExpensePaise = 0;

  for (const tx of transactions || []) {
    if (!tx || !isExpenseTransaction(tx)) continue;

    const amtPaise = toPaise(tx.amount);
    totalExpensePaise += amtPaise;

    const catId = tx.categoryId || 'other';
    const key = catId !== 'other' ? catId : `other_${tx.categoryName || 'Other'}`;

    if (!categoryMap[key]) {
      categoryMap[key] = {
        id: key,
        originalId: catId,
        name: tx.categoryName || 'Other',
        icon: tx.categoryIcon || '📦',
        totalPaise: 0,
        count: 0,
      };
    }
    categoryMap[key].totalPaise += amtPaise;
    categoryMap[key].count += 1;
  }

  return Object.values(categoryMap)
    .map((cat) => ({
      id: cat.id,
      originalId: cat.originalId,
      name: cat.name,
      icon: cat.icon,
      total: fromPaise(cat.totalPaise),
      count: cat.count,
      percentage:
        totalExpensePaise > 0
          ? Math.round((cat.totalPaise / totalExpensePaise) * 100)
          : 0,
    }))
    .sort((a, b) => b.total - a.total);
};

/**
 * Compute credit card outstanding balance in major currency units.
 */
export const getCreditCardOutstanding = (card) => {
  if (!card) return 0;
  return fromPaise(Math.max(0, toPaise(card.currentUsage)));
};

/**
 * Compute credit card available credit in major currency units.
 */
export const getCreditCardAvailable = (card) => {
  if (!card) return 0;
  const limitPaise = toPaise(card.creditLimit);
  const usagePaise = toPaise(card.currentUsage);
  return fromPaise(Math.max(0, limitPaise - usagePaise));
};

/**
 * Single source of truth for Account Balances, Assets, Liabilities, and Net Worth.
 *
 * - Active accounts only (`isActive !== false`)
 * - Assets = Bank + Cash + (Investments when includeInvestmentsInAssets is true)
 * - Liabilities = Sum of Credit Card outstanding (`currentUsage`)
 * - Net Worth = Total Assets - Total Liabilities
 */
export const calculateAccountTotals = (
  accounts = [],
  investmentTotals = null,
  options = {}
) => {
  const { includeInvestmentsInAssets = true } = options;
  const activeAccounts = (accounts || []).filter((a) => a && a.isActive !== false);

  const assetAccounts = activeAccounts.filter(
    (a) => a.type === 'BANK' || a.type === 'CASH'
  );
  const liabilityAccounts = activeAccounts.filter(
    (a) => a.type === 'CREDIT_CARD'
  );

  let bankPaise = 0;
  let cashPaise = 0;
  for (const acc of assetAccounts) {
    const balPaise = toPaise(acc.balance);
    if (acc.type === 'BANK') {
      bankPaise += balPaise;
    } else if (acc.type === 'CASH') {
      cashPaise += balPaise;
    }
  }

  let debtPaise = 0;
  for (const card of liabilityAccounts) {
    debtPaise += toPaise(card.currentUsage);
  }

  const liquidPaise = bankPaise + cashPaise;
  const invPaise = includeInvestmentsInAssets
    ? toPaise(investmentTotals?.totalCurrentValue || 0)
    : 0;

  const totalAssetsPaise = liquidPaise + invPaise;
  const totalLiabilitiesPaise = debtPaise;
  const netWorthPaise = totalAssetsPaise - totalLiabilitiesPaise;

  return {
    bankBalance: fromPaise(bankPaise),
    cashBalance: fromPaise(cashPaise),
    liquidAssets: fromPaise(liquidPaise),
    investmentValue: fromPaise(toPaise(investmentTotals?.totalCurrentValue || 0)),
    totalAssets: fromPaise(totalAssetsPaise),
    totalLiabilities: fromPaise(totalLiabilitiesPaise),
    totalDebts: fromPaise(totalLiabilitiesPaise),
    netWorth: fromPaise(netWorthPaise),
    assetAccounts,
    liabilityAccounts,
  };
};

/**
 * Recompute expected account balances and credit card usage from initial balances
 * plus a chronological or unordered list of transactions.
 * Useful for integrity verification and reconciliation tests.
 */
export const reconcileAccountBalances = (
  accounts = [],
  transactions = [],
  initialBalances = {}
) => {
  const state = {};
  for (const acc of accounts || []) {
    if (!acc?.id) continue;
    const init = initialBalances[acc.id] || {};
    state[acc.id] = {
      id: acc.id,
      type: acc.type,
      balancePaise: toPaise(init.balance ?? 0),
      usagePaise: toPaise(init.currentUsage ?? 0),
      limitPaise: toPaise(acc.creditLimit ?? init.creditLimit ?? 0),
    };
  }

  for (const tx of transactions || []) {
    if (!tx) continue;
    const amtPaise = toPaise(tx.amount);
    if (amtPaise <= 0) continue;

    const type = getTransactionType(tx);

    if (type === TRANSACTION_TYPES.INCOME) {
      if (tx.accountId && state[tx.accountId]) {
        state[tx.accountId].balancePaise += amtPaise;
      }
    } else if (type === TRANSACTION_TYPES.EXPENSE) {
      if (tx.accountId && state[tx.accountId]) {
        const target = state[tx.accountId];
        if (tx.paymentMode === 'CREDIT_CARD' || tx.isCredit || target.type === 'CREDIT_CARD') {
          target.usagePaise += amtPaise;
        } else {
          target.balancePaise -= amtPaise;
        }
      }
    } else if (type === TRANSACTION_TYPES.TRANSFER) {
      // Transfer debits source account (`accountId`) and optionally reduces target card debt (`targetAccountId`) or credits target bank (`targetAccountId`)
      if (tx.accountId && state[tx.accountId]) {
        state[tx.accountId].balancePaise -= amtPaise;
      }
      if (tx.targetAccountId && state[tx.targetAccountId]) {
        const target = state[tx.targetAccountId];
        if (target.type === 'CREDIT_CARD') {
          target.usagePaise = Math.max(0, target.usagePaise - amtPaise);
        } else {
          target.balancePaise += amtPaise;
        }
      }
    }
  }

  const result = {};
  for (const [id, entry] of Object.entries(state)) {
    result[id] = {
      balance: fromPaise(entry.balancePaise),
      currentUsage: fromPaise(entry.usagePaise),
      availableCredit:
        entry.type === 'CREDIT_CARD'
          ? fromPaise(Math.max(0, entry.limitPaise - entry.usagePaise))
          : 0,
    };
  }
  return result;
};

