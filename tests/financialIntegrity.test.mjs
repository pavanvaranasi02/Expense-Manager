import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { mockAuth, mockControl } from './mockEnv.mjs';
import useStorageStore from '../src/store/useStorageStore.js';
import useAccountStore from '../src/store/useAccountStore.js';
import {
  addAccount,
  calculateTotals,
  getAccounts,
  payCreditCardBill,
} from '../src/services/accountService.js';
import {
  addExpense,
  deleteExpense,
  getDashboardData,
  getExpenses,
  updateExpense,
} from '../src/services/expenseService.js';
import {
  addIncome,
  deleteIncome,
  getIncomes,
  updateIncome,
} from '../src/services/incomeService.js';
import {
  calculateAccountTotals,
  calculateCashFlowSummary,
  calculateCategorySpending,
  fromPaise,
  getCreditCardAvailable,
  getCreditCardOutstanding,
  reconcileAccountBalances,
  toPaise,
} from '../src/services/financialCalculationService.js';
import {
  clearIdempotencyLocks,
  validateTransactionInput,
} from '../src/services/transactionValidation.js';

const USER_ID = 'test-user-1';

const setupLocalAccounts = async () => {
  mockAuth.currentUser = { uid: USER_ID };
  useStorageStore.getState().setStorageMode('local');

  const bankRes = await addAccount({
    type: 'BANK',
    name: 'HDFC Savings',
    balance: 10000,
  });
  const cashRes = await addAccount({
    type: 'CASH',
    name: 'Wallet Cash',
    balance: 2000,
  });
  const cardRes = await addAccount({
    type: 'CREDIT_CARD',
    name: 'ICICI Sapphiro',
    creditLimit: 50000,
    currentUsage: 5000,
  });

  assert.equal(bankRes.success, true);
  assert.equal(cashRes.success, true);
  assert.equal(cardRes.success, true);

  return {
    bankId: bankRes.id,
    cashId: cashRes.id,
    cardId: cardRes.id,
  };
};

describe('KOSH Phase 1: Financial Data Integrity', () => {
  beforeEach(() => {
    mockControl.resetAll();
    clearIdempotencyLocks();
    useAccountStore.getState().clearAccounts();
    useStorageStore.getState().resetStorageStore();
    useStorageStore.getState().setStorageMode('local');
  });

  it('1. Create an expense decreases bank/cash balance or increases credit card usage', async () => {
    const { bankId, cardId } = await setupLocalAccounts();

    const expBank = await addExpense({
      amount: 1250.5,
      categoryId: 'food',
      categoryName: 'Food & Dining',
      accountId: bankId,
      accountName: 'HDFC Savings',
      paymentMode: 'UPI',
      date: '2026-11-14T10:00:00.000Z',
    });
    assert.equal(expBank.success, true);
    assert.ok(expBank.id);

    const expCard = await addExpense({
      amount: 3400.25,
      categoryId: 'travel',
      categoryName: 'Travel',
      accountId: cardId,
      accountName: 'ICICI Sapphiro',
      paymentMode: 'CREDIT_CARD',
      date: '2026-11-14T11:00:00.000Z',
    });
    assert.equal(expCard.success, true);

    const { accounts } = await getAccounts();
    const bank = accounts.find((a) => a.id === bankId);
    const card = accounts.find((a) => a.id === cardId);

    assert.equal(bank.balance, 8749.5);
    assert.equal(getCreditCardOutstanding(card), 8400.25);
    assert.equal(getCreditCardAvailable(card), 41599.75);
  });

  it('2. Create an income increases the relevant account balance', async () => {
    const { bankId } = await setupLocalAccounts();

    const res = await addIncome({
      amount: 95000.75,
      source: 'salary',
      sourceName: 'Salary',
      accountId: bankId,
      accountName: 'HDFC Savings',
      date: '2026-11-14T09:00:00.000Z',
    });
    assert.equal(res.success, true);
    assert.ok(res.id);

    const { accounts } = await getAccounts();
    const bank = accounts.find((a) => a.id === bankId);
    assert.equal(bank.balance, 105000.75);
  });

  it('3. Edit an existing expense reverses previous impact before applying new impact (including across accounts)', async () => {
    const { bankId, cashId } = await setupLocalAccounts();

    const created = await addExpense({
      amount: 1500,
      categoryId: 'food',
      categoryName: 'Food & Dining',
      accountId: bankId,
      accountName: 'HDFC Savings',
      paymentMode: 'UPI',
      date: '2026-11-14T10:00:00.000Z',
    });
    assert.equal(created.success, true);

    const { expenses } = await getExpenses();
    const oldExp = expenses.find((e) => e.id === created.id);

    // Edit amount from 1500 to 600 and move from bankId to cashId
    const updated = await updateExpense(
      created.id,
      {
        amount: 600,
        categoryId: 'food',
        categoryName: 'Food & Dining',
        accountId: cashId,
        accountName: 'Wallet Cash',
        paymentMode: 'CASH',
        date: '2026-11-14T10:00:00.000Z',
      },
      oldExp
    );
    assert.equal(updated.success, true);

    const { accounts } = await getAccounts();
    assert.equal(accounts.find((a) => a.id === bankId).balance, 10000);
    assert.equal(accounts.find((a) => a.id === cashId).balance, 1400);

    // Ensure no duplicate expense was created
    const afterExp = await getExpenses();
    assert.equal(afterExp.expenses.length, 1);
    assert.equal(afterExp.expenses[0].amount, 600);
  });

  it('4. Delete an expense restores the account balance and removes the record', async () => {
    const { bankId } = await setupLocalAccounts();

    const created = await addExpense({
      amount: 2500,
      categoryId: 'shopping',
      categoryName: 'Shopping',
      accountId: bankId,
      accountName: 'HDFC Savings',
      paymentMode: 'UPI',
      date: '2026-11-14T10:00:00.000Z',
    });
    const { expenses } = await getExpenses();
    const exp = expenses.find((e) => e.id === created.id);

    const del = await deleteExpense(created.id, exp);
    assert.equal(del.success, true);

    const { accounts } = await getAccounts();
    assert.equal(accounts.find((a) => a.id === bankId).balance, 10000);
    assert.equal((await getExpenses()).expenses.length, 0);
  });

  it('5. Edit an income reverses previous impact before applying new impact', async () => {
    const { bankId, cashId } = await setupLocalAccounts();

    const created = await addIncome({
      amount: 5000,
      source: 'freelance',
      sourceName: 'Freelance',
      accountId: bankId,
      accountName: 'HDFC Savings',
      date: '2026-11-14T10:00:00.000Z',
    });
    const { incomes } = await getIncomes();
    const oldInc = incomes.find((i) => i.id === created.id);

    // Update to 7500 on cashId
    const updated = await updateIncome(
      created.id,
      {
        amount: 7500,
        source: 'freelance',
        sourceName: 'Freelance',
        accountId: cashId,
        accountName: 'Wallet Cash',
        date: '2026-11-14T10:00:00.000Z',
      },
      oldInc
    );
    assert.equal(updated.success, true);

    const { accounts } = await getAccounts();
    assert.equal(accounts.find((a) => a.id === bankId).balance, 10000);
    assert.equal(accounts.find((a) => a.id === cashId).balance, 9500);
    assert.equal((await getIncomes()).incomes.length, 1);
  });

  it('6. Delete an income reverses the account balance and removes the record', async () => {
    const { bankId } = await setupLocalAccounts();

    const created = await addIncome({
      amount: 4000,
      source: 'bonus',
      sourceName: 'Bonus',
      accountId: bankId,
      accountName: 'HDFC Savings',
      date: '2026-11-14T10:00:00.000Z',
    });
    const { incomes } = await getIncomes();
    const inc = incomes.find((i) => i.id === created.id);

    const del = await deleteIncome(created.id, inc);
    assert.equal(del.success, true);

    const { accounts } = await getAccounts();
    assert.equal(accounts.find((a) => a.id === bankId).balance, 10000);
    assert.equal((await getIncomes()).incomes.length, 0);
  });

  it('7. Transactions against different accounts do not affect unrelated accounts', async () => {
    const { bankId, cashId, cardId } = await setupLocalAccounts();

    await addIncome({
      amount: 1000,
      source: 'gift',
      sourceName: 'Gift Received',
      accountId: cashId,
      accountName: 'Wallet Cash',
      date: '2026-11-14T10:00:00.000Z',
    });

    await addExpense({
      amount: 500,
      categoryId: 'food',
      categoryName: 'Food & Dining',
      accountId: bankId,
      accountName: 'HDFC Savings',
      paymentMode: 'UPI',
      date: '2026-11-14T11:00:00.000Z',
    });

    const { accounts } = await getAccounts();
    assert.equal(accounts.find((a) => a.id === bankId).balance, 9500);
    assert.equal(accounts.find((a) => a.id === cashId).balance, 3000);
    assert.equal(accounts.find((a) => a.id === cardId).currentUsage, 5000);
  });

  it('8. Attempt duplicate transaction creation via idempotencyKey is prevented', async () => {
    const { bankId } = await setupLocalAccounts();
    const idempotencyKey = 'req_unique_save_001';

    const first = await addExpense({
      amount: 300,
      categoryId: 'food',
      categoryName: 'Food & Dining',
      accountId: bankId,
      accountName: 'HDFC Savings',
      paymentMode: 'UPI',
      date: '2026-11-14T12:00:00.000Z',
      idempotencyKey,
    });
    assert.equal(first.success, true);

    const second = await addExpense({
      amount: 300,
      categoryId: 'food',
      categoryName: 'Food & Dining',
      accountId: bankId,
      accountName: 'HDFC Savings',
      paymentMode: 'UPI',
      date: '2026-11-14T12:00:00.000Z',
      idempotencyKey,
    });
    assert.equal(second.success, false);
    assert.equal(second.duplicate, true);
    assert.equal(second.existingId, first.id);

    const { accounts } = await getAccounts();
    assert.equal(accounts.find((a) => a.id === bankId).balance, 9700);
    assert.equal((await getExpenses()).expenses.length, 1);

    // Same for income
    const incKey = 'inc_unique_save_001';
    const inc1 = await addIncome({
      amount: 1200,
      source: 'salary',
      sourceName: 'Salary',
      accountId: bankId,
      accountName: 'HDFC Savings',
      date: '2026-11-14T12:05:00.000Z',
      idempotencyKey: incKey,
    });
    const inc2 = await addIncome({
      amount: 1200,
      source: 'salary',
      sourceName: 'Salary',
      accountId: bankId,
      accountName: 'HDFC Savings',
      date: '2026-11-14T12:05:00.000Z',
      idempotencyKey: incKey,
    });
    assert.equal(inc1.success, true);
    assert.equal(inc2.success, false);
    assert.equal(inc2.duplicate, true);
    assert.equal((await getAccounts()).accounts.find((a) => a.id === bankId).balance, 10900);
  });

  it('9. Restart and reload persisted data preserves exact balances and transactions', async () => {
    const { bankId, cashId, cardId } = await setupLocalAccounts();

    await addIncome({
      amount: 5000,
      source: 'salary',
      sourceName: 'Salary',
      accountId: bankId,
      accountName: 'HDFC Savings',
      date: '2026-11-14T09:00:00.000Z',
    });
    await addExpense({
      amount: 1200,
      categoryId: 'food',
      categoryName: 'Food & Dining',
      accountId: cashId,
      accountName: 'Wallet Cash',
      paymentMode: 'CASH',
      date: '2026-11-14T10:00:00.000Z',
    });

    // Simulate app restart: clear Zustand stores and in-memory idempotency locks, keep AsyncStorage
    useAccountStore.getState().clearAccounts();
    useStorageStore.getState().resetStorageStore();
    clearIdempotencyLocks();
    useStorageStore.getState().setStorageMode('local');

    const reloadedAccounts = (await getAccounts()).accounts;
    const reloadedExpenses = (await getExpenses()).expenses;
    const reloadedIncomes = (await getIncomes()).incomes;

    assert.equal(reloadedAccounts.find((a) => a.id === bankId).balance, 15000);
    assert.equal(reloadedAccounts.find((a) => a.id === cashId).balance, 800);
    assert.equal(reloadedAccounts.find((a) => a.id === cardId).currentUsage, 5000);
    assert.equal(reloadedExpenses.length, 1);
    assert.equal(reloadedIncomes.length, 1);
  });

  it('10. Verify account balances against transaction history (reconciliation + paise precision)', async () => {
    const { bankId, cashId, cardId } = await setupLocalAccounts();
    const initialBalances = {
      [bankId]: { balance: 10000 },
      [cashId]: { balance: 2000 },
      [cardId]: { currentUsage: 5000, creditLimit: 50000 },
    };

    // Classic IEEE-754 float trap: 0.1 + 0.2 = 0.30000000000000004
    await addIncome({
      amount: 0.1,
      source: 'interest',
      sourceName: 'Interest',
      accountId: bankId,
      accountName: 'HDFC Savings',
      date: '2026-11-14T08:00:00.000Z',
    });
    await addIncome({
      amount: 0.2,
      source: 'interest',
      sourceName: 'Interest',
      accountId: bankId,
      accountName: 'HDFC Savings',
      date: '2026-11-14T08:05:00.000Z',
    });
    await addExpense({
      amount: 250.3,
      categoryId: 'food',
      categoryName: 'Food & Dining',
      accountId: bankId,
      accountName: 'HDFC Savings',
      paymentMode: 'UPI',
      date: '2026-11-14T09:00:00.000Z',
    });
    await addExpense({
      amount: 1200,
      categoryId: 'travel',
      categoryName: 'Travel',
      accountId: cardId,
      accountName: 'ICICI Sapphiro',
      paymentMode: 'CREDIT_CARD',
      date: '2026-11-14T10:00:00.000Z',
    });

    const { accounts } = await getAccounts();
    const { expenses } = await getExpenses();
    const { incomes } = await getIncomes();

    const reconciled = reconcileAccountBalances(
      accounts,
      [...expenses, ...incomes],
      initialBalances
    );

    assert.equal(accounts.find((a) => a.id === bankId).balance, 9750);
    assert.equal(reconciled[bankId].balance, 9750);
    assert.equal(accounts.find((a) => a.id === cardId).currentUsage, 6200);
    assert.equal(reconciled[cardId].currentUsage, 6200);
    assert.equal(reconciled[cardId].availableCredit, 43800);
    assert.equal(fromPaise(toPaise(0.1) + toPaise(0.2)), 0.3);
  });

  it('11. Verify net worth, assets, liabilities, transfers, and single calculation layer consistency', async () => {
    const { bankId, cardId } = await setupLocalAccounts();

    // Pay 2000 credit card bill as a transfer (not an expense)
    const transferExp = await addExpense({
      amount: 2000,
      categoryId: 'bills',
      categoryName: 'Credit Card Bill',
      accountId: bankId,
      accountName: 'HDFC Savings',
      paymentMode: 'BANK',
      isTransfer: true,
      transactionType: 'transfer',
      date: '2026-11-14T11:00:00.000Z',
    });
    assert.equal(transferExp.success, true);

    const billRes = await payCreditCardBill(cardId, 2000, bankId, transferExp.id);
    assert.equal(billRes.success, true);

    const { accounts } = await getAccounts();
    const invTotals = { totalCurrentValue: 25000 };

    // Single calculation layer vs accountService.calculateTotals vs Zustand store
    const wealthTotals = calculateAccountTotals(accounts, invTotals, {
      includeInvestmentsInAssets: true,
    });
    const serviceTotals = calculateTotals(accounts);
    useAccountStore.getState().setAccounts(accounts);
    const storeNetWorth = useAccountStore.getState().getNetWorth();

    // Bank: 10000 - 2000 = 8000, Cash: 2000, Card debt: 5000 - 2000 = 3000
    assert.equal(serviceTotals.totalAssets, 10000);
    assert.equal(serviceTotals.totalDebts, 3000);
    assert.equal(serviceTotals.netWorth, 7000);
    assert.equal(storeNetWorth, 7000);

    // With investments: Assets = 10000 + 25000 = 35000, Liabilities = 3000, Net Worth = 32000
    assert.equal(wealthTotals.totalAssets, 35000);
    assert.equal(wealthTotals.totalLiabilities, 3000);
    assert.equal(wealthTotals.netWorth, 32000);

    // Transfer must NOT count as an expense in Cash Flow or DashboardData
    const { expenses } = await getExpenses();
    const { incomes } = await getIncomes();
    const cashFlow = calculateCashFlowSummary([...expenses, ...incomes]);
    assert.equal(cashFlow.totalExpenses, 0);
    assert.equal(cashFlow.totalIncome, 0);
    assert.equal(calculateCategorySpending(expenses).length, 0);

    const dash = await getDashboardData(11, 2026);
    assert.equal(dash.success, true);
    assert.equal(dash.data.totalExpense, 0);
  });

  it('12. Failed persistence & invalid inputs do not produce a false success state', async () => {
    const { bankId } = await setupLocalAccounts();

    // Invalid amount
    const negRes = await addExpense({
      amount: -500,
      categoryId: 'food',
      categoryName: 'Food & Dining',
      accountId: bankId,
      paymentMode: 'UPI',
      date: '2026-11-14T10:00:00.000Z',
    });
    assert.equal(negRes.success, false);

    // Non-existent account
    const badAccRes = await addExpense({
      amount: 500,
      categoryId: 'food',
      categoryName: 'Food & Dining',
      accountId: 'non_existent_acc_999',
      paymentMode: 'UPI',
      date: '2026-11-14T10:00:00.000Z',
    });
    assert.equal(badAccRes.success, false);

    // Invalid date
    const badDate = validateTransactionInput({
      amount: 100,
      categoryId: 'food',
      date: 'not-a-date',
    });
    assert.equal(badDate.valid, false);

    // Simulated AsyncStorage write failure
    mockControl.setFailNextWrite(true);
    const failWriteExp = await addExpense({
      amount: 450,
      categoryId: 'food',
      categoryName: 'Food & Dining',
      accountId: bankId,
      accountName: 'HDFC Savings',
      paymentMode: 'UPI',
      date: '2026-11-14T10:00:00.000Z',
    });
    assert.equal(failWriteExp.success, false);
    assert.match(failWriteExp.error, /Failed to persist/);

    // Verify account balance was untouched and no partial expense exists
    assert.equal((await getAccounts()).accounts.find((a) => a.id === bankId).balance, 10000);
    assert.equal((await getExpenses()).expenses.length, 0);
  });
});

