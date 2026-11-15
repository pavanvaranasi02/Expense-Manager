import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { mockControl } from './mockEnv.mjs';
import {
  buildWidgetSnapshot,
  DEFAULT_QUICK_CATEGORIES,
  getDefaultWidgetSnapshot,
  loadWidgetSnapshot,
  saveWidgetSnapshot,
  WIDGET_DEEP_LINKS,
} from '../src/services/widgetService.js';

describe('KOSH Home Screen Widget Service', () => {
  beforeEach(() => {
    mockControl.resetAll();
  });

  it('1. Combines all active BANK accounts and keeps CASH in hand separate', () => {
    const accounts = [
      { id: 'b1', type: 'BANK', name: 'HDFC', balance: 45000.5, isActive: true },
      { id: 'b2', type: 'BANK', name: 'SBI', balance: 15000.25, isActive: true },
      { id: 'b3', type: 'BANK', name: 'Closed Bank', balance: 99999, isActive: false },
      { id: 'c1', type: 'CASH', name: 'Wallet', balance: 2500, isActive: true },
      { id: 'c2', type: 'CASH', name: 'Home Safe', balance: 1500, isActive: true },
      { id: 'cc1', type: 'CREDIT_CARD', name: 'ICICI', creditLimit: 100000, currentUsage: 12000, isActive: true },
    ];

    const snapshot = buildWidgetSnapshot(accounts, {
      currencySymbol: '₹',
      isStealthMode: false,
      updatedAt: '2026-11-15T06:00:00.000Z',
    });

    assert.equal(snapshot.bankBalance, 60000.75);
    assert.equal(snapshot.cashBalance, 4000);
    assert.equal(snapshot.bankAccountCount, 2);
    assert.equal(snapshot.cashAccountCount, 2);
    assert.equal(snapshot.formattedBankBalance, '₹60,000.75');
    assert.equal(snapshot.formattedCashBalance, '₹4,000');
    assert.equal(snapshot.isStealthMode, false);
    assert.equal(snapshot.quickCategories.length, DEFAULT_QUICK_CATEGORIES.length);
  });

  it('2. Masks balances when stealth mode is enabled', () => {
    const accounts = [
      { id: 'b1', type: 'BANK', name: 'HDFC', balance: 25000, isActive: true },
      { id: 'c1', type: 'CASH', name: 'Wallet', balance: 1200, isActive: true },
    ];

    const snapshot = buildWidgetSnapshot(accounts, {
      currencySymbol: '$',
      isStealthMode: true,
    });

    assert.equal(snapshot.bankBalance, 25000);
    assert.equal(snapshot.cashBalance, 1200);
    assert.equal(snapshot.formattedBankBalance, '****');
    assert.equal(snapshot.formattedCashBalance, '****');
    assert.equal(snapshot.isStealthMode, true);
  });

  it('3. Persists and loads widget snapshot from AsyncStorage', async () => {
    const fallback = await loadWidgetSnapshot();
    assert.equal(fallback.bankBalance, 0);
    assert.equal(fallback.cashBalance, 0);

    const snapshot = buildWidgetSnapshot(
      [
        { id: 'b1', type: 'BANK', balance: 10000 },
        { id: 'c1', type: 'CASH', balance: 500 },
      ],
      { currencySymbol: '₹', isStealthMode: false }
    );

    const saveRes = await saveWidgetSnapshot(snapshot);
    assert.equal(saveRes.success, true);

    const loaded = await loadWidgetSnapshot();
    assert.equal(loaded.bankBalance, 10000);
    assert.equal(loaded.cashBalance, 500);
    assert.equal(loaded.formattedBankBalance, '₹10,000');
    assert.equal(loaded.formattedCashBalance, '₹500');
  });

  it('4. Exposes valid deep link URIs for quick expense logging and transaction history', () => {
    assert.equal(WIDGET_DEEP_LINKS.HOME, 'kosh://');
    assert.equal(WIDGET_DEEP_LINKS.ADD_EXPENSE, 'kosh://add-expense');
    assert.equal(WIDGET_DEEP_LINKS.HISTORY, 'kosh://history?filter=all');
    assert.equal(
      WIDGET_DEEP_LINKS.addExpenseWithCategory('food'),
      'kosh://add-expense?categoryId=food'
    );
    assert.deepEqual(
      getDefaultWidgetSnapshot().quickCategories.map((c) => c.id),
      ['food', 'travel', 'groceries', 'bills']
    );
  });
});
