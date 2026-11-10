/**
 * Portfolio & Investment Financial Math Utilities
 * Includes robust XIRR calculation, CAGR, Annualized Return, and Maturity countdowns.
 */

/**
 * Calculates the Extended Internal Rate of Return (XIRR) for a series of cash flows.
 * Positive amounts = cash inflows (e.g. current valuation, withdrawals).
 * Negative amounts = cash outflows (e.g. initial purchase, SIPs, top-ups).
 *
 * @param {Array<{date: string|Date, amount: number}>} cashFlows
 * @returns {number|null} Annualized return percentage (e.g. 14.85 for 14.85%), or null if invalid.
 */
export const calculateXIRR = (cashFlows) => {
  if (!cashFlows || cashFlows.length < 2) return null;

  // Normalize and sort cash flows chronologically
  const flows = cashFlows
    .map((cf) => ({
      date: new Date(cf.date).getTime(),
      amount: parseFloat(cf.amount) || 0,
    }))
    .filter((cf) => !isNaN(cf.date) && Math.abs(cf.amount) > 0.0001)
    .sort((a, b) => a.date - b.date);

  if (flows.length < 2) return null;

  const hasNegative = flows.some((f) => f.amount < 0);
  const hasPositive = flows.some((f) => f.amount > 0);
  if (!hasNegative || !hasPositive) return null;

  const t0 = flows[0].date;
  const dayMs = 24 * 60 * 60 * 1000;

  // NPV function
  const npv = (rate) => {
    let sum = 0;
    for (const f of flows) {
      const days = (f.date - t0) / dayMs;
      sum += f.amount / Math.pow(1 + rate, days / 365);
    }
    return sum;
  };

  // First derivative of NPV
  const npvDeriv = (rate) => {
    let sum = 0;
    for (const f of flows) {
      const days = (f.date - t0) / dayMs;
      sum -= (days / 365) * f.amount / Math.pow(1 + rate, days / 365 + 1);
    }
    return sum;
  };

  // Bisection fallback
  const bisection = (f, min, max) => {
    let fMin = f(min);
    let fMax = f(max);
    if (fMin * fMax > 0) return null;
    let mid = 0;
    for (let j = 0; j < 60; j++) {
      mid = (min + max) / 2;
      const fMid = f(mid);
      if (Math.abs(fMid) < 1e-5 || (max - min) / 2 < 1e-5) return mid;
      if (fMid * fMin < 0) {
        max = mid;
        fMax = fMid;
      } else {
        min = mid;
        fMin = fMid;
      }
    }
    return mid;
  };

  // Newton-Raphson method
  let rate = 0.1; // Initial guess 10%
  let converged = false;

  for (let i = 0; i < 50; i++) {
    const y = npv(rate);
    const dy = npvDeriv(rate);
    if (Math.abs(dy) < 1e-12) break;

    const nextRate = rate - y / dy;

    if (Math.abs(nextRate - rate) < 1e-6) {
      rate = nextRate;
      converged = true;
      break;
    }

    if (nextRate <= -0.999 || nextRate > 20) {
      // Divergence detected, try bisection within reasonable financial bounds [-90%, 500%]
      const bRate = bisection(npv, -0.9, 5.0);
      if (bRate !== null) {
        rate = bRate;
        converged = true;
      }
      break;
    }

    rate = nextRate;
  }

  if (!converged) {
    const bRate = bisection(npv, -0.9, 5.0);
    if (bRate !== null) {
      rate = bRate;
      converged = true;
    }
  }

  if (isNaN(rate) || !isFinite(rate) || rate < -0.99) return null;

  // Cap extreme short-term annualized artifacts
  const totalDays = (flows[flows.length - 1].date - t0) / dayMs;
  if (totalDays < 30 && (rate > 2.0 || rate < -0.5)) {
    return null; // Return null to fallback to simple CAGR / absolute return
  }

  return +(rate * 100).toFixed(1);
};

/**
 * Calculates CAGR (Compound Annual Growth Rate)
 */
export const calculateCAGR = (invested, current, days) => {
  if (!invested || invested <= 0 || !current || current <= 0 || days <= 0) return null;
  const years = days / 365;
  if (years < 0.05) return null; // < 18 days
  const cagr = Math.pow(current / invested, 1 / years) - 1;
  if (isNaN(cagr) || !isFinite(cagr)) return null;
  return +(cagr * 100).toFixed(1);
};

/**
 * Comprehensive returns breakdown for a single investment.
 * Returns displayRate, rateLabel, and return details.
 */
export const calculateInvestmentReturns = (inv) => {
  const invested = parseFloat(inv.investedAmount) || 0;
  const current = parseFloat(inv.currentValue) || 0;
  const absoluteReturn = current - invested;
  const returnPercent = invested > 0 ? +((absoluteReturn / invested) * 100).toFixed(1) : 0;
  const exchangeRate = parseFloat(inv.exchangeRate) > 0 ? parseFloat(inv.exchangeRate) : 1;
  const currency = inv.currency || 'INR';
  const convertedInvested = invested * exchangeRate;
  const convertedCurrent = current * exchangeRate;
  const convertedReturn = absoluteReturn * exchangeRate;

  // Check if it's a fixed-income instrument with explicitly configured interest rate
  const isFixedIncome = ['fd', 'rd', 'ppf', 'nps', 'bonds'].includes(inv.type);
  const explicitRate = parseFloat(inv.interestRate);

  if (isFixedIncome && !isNaN(explicitRate) && explicitRate > 0) {
    return {
      invested,
      current,
      absoluteReturn,
      returnPercent,
      currency,
      exchangeRate,
      convertedInvested,
      convertedCurrent,
      convertedReturn,
      displayRate: `${explicitRate}%`,
      rateLabel: 'Interest',
      rateType: 'FIXED',
      badgeColor: '#3B82F6',
      badgeBg: '#EFF6FF',
    };
  }

  // Build cash flow series for variable/market investments or when interestRate is absent
  const cashFlows = [];
  const today = new Date();
  const startDate = inv.startDate ? new Date(inv.startDate) : (inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date());

  // 1. Initial outflow
  if (inv.transactions && inv.transactions.length > 0) {
    // If structured transactions exist, use them
    inv.transactions.forEach((txn) => {
      const amt = parseFloat(txn.amount) || 0;
      if (amt > 0) {
        if (txn.type === 'WITHDRAW') {
          cashFlows.push({ date: txn.date || startDate, amount: amt });
        } else {
          cashFlows.push({ date: txn.date || startDate, amount: -amt });
        }
      }
    });
  } else {
    // Basic initial invested outflow
    if (invested > 0) {
      cashFlows.push({ date: startDate, amount: -invested });
    }
  }

  // 2. Terminal valuation inflow
  if (current > 0) {
    cashFlows.push({ date: today, amount: current });
  }

  // Calculate XIRR
  const xirrVal = calculateXIRR(cashFlows);

  if (xirrVal !== null) {
    return {
      invested,
      current,
      absoluteReturn,
      returnPercent,
      currency,
      exchangeRate,
      convertedInvested,
      convertedCurrent,
      convertedReturn,
      displayRate: `${xirrVal >= 0 ? '+' : ''}${xirrVal}%`,
      rateLabel: 'XIRR',
      rateType: 'XIRR',
      badgeColor: xirrVal >= 0 ? '#10B981' : '#EF4444',
      badgeBg: xirrVal >= 0 ? '#ECFDF5' : '#FEF2F2',
    };
  }

  // Fallback to CAGR if tenure > 30 days
  const holdingDays = Math.max(1, (today.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  const cagrVal = calculateCAGR(invested, current, holdingDays);

  if (cagrVal !== null) {
    return {
      invested,
      current,
      absoluteReturn,
      returnPercent,
      currency,
      exchangeRate,
      convertedInvested,
      convertedCurrent,
      convertedReturn,
      displayRate: `${cagrVal >= 0 ? '+' : ''}${cagrVal}%`,
      rateLabel: 'CAGR',
      rateType: 'CAGR',
      badgeColor: cagrVal >= 0 ? '#10B981' : '#EF4444',
      badgeBg: cagrVal >= 0 ? '#ECFDF5' : '#FEF2F2',
    };
  }

  // Fallback to simple return
  return {
    invested,
    current,
    absoluteReturn,
    returnPercent,
    currency,
    exchangeRate,
    convertedInvested,
    convertedCurrent,
    convertedReturn,
    displayRate: `${returnPercent >= 0 ? '+' : ''}${returnPercent}%`,
    rateLabel: 'Return',
    rateType: 'SIMPLE',
    badgeColor: returnPercent >= 0 ? '#10B981' : '#EF4444',
    badgeBg: returnPercent >= 0 ? '#ECFDF5' : '#FEF2F2',
  };
};

/**
 * Calculates master portfolio-level metrics including aggregate XIRR.
 */
export const calculatePortfolioMetrics = (investments) => {
  const active = (investments || []).filter((i) => i.isActive !== false);

  const totalInvested = active.reduce((s, i) => {
    const rate = parseFloat(i.exchangeRate) > 0 ? parseFloat(i.exchangeRate) : 1;
    return s + (parseFloat(i.investedAmount) || 0) * rate;
  }, 0);
  const totalCurrentValue = active.reduce((s, i) => {
    const rate = parseFloat(i.exchangeRate) > 0 ? parseFloat(i.exchangeRate) : 1;
    return s + (parseFloat(i.currentValue) || 0) * rate;
  }, 0);
  const totalReturns = totalCurrentValue - totalInvested;
  const returnPercent = totalInvested > 0 ? +((totalReturns / totalInvested) * 100).toFixed(1) : 0;

  // Master Portfolio XIRR Cash Flows (converted to base currency)
  const allFlows = [];
  const today = new Date();

  active.forEach((inv) => {
    const rate = parseFloat(inv.exchangeRate) > 0 ? parseFloat(inv.exchangeRate) : 1;
    const startDate = inv.startDate ? new Date(inv.startDate) : new Date();
    if (inv.transactions && inv.transactions.length > 0) {
      inv.transactions.forEach((t) => {
        const amt = (parseFloat(t.amount) || 0) * rate;
        if (amt > 0) {
          if (t.type === 'WITHDRAW') {
            allFlows.push({ date: t.date || startDate, amount: amt });
          } else {
            allFlows.push({ date: t.date || startDate, amount: -amt });
          }
        }
      });
    } else {
      const invAmt = (parseFloat(inv.investedAmount) || 0) * rate;
      if (invAmt > 0) {
        allFlows.push({ date: startDate, amount: -invAmt });
      }
    }
  });

  if (totalCurrentValue > 0) {
    allFlows.push({ date: today, amount: totalCurrentValue });
  }

  const portfolioXirr = calculateXIRR(allFlows);

  // Group by category/type (converted to base currency)
  const byType = {};
  active.forEach((inv) => {
    const rate = parseFloat(inv.exchangeRate) > 0 ? parseFloat(inv.exchangeRate) : 1;
    const invAmt = (parseFloat(inv.investedAmount) || 0) * rate;
    const currVal = (parseFloat(inv.currentValue) || 0) * rate;

    if (!byType[inv.type]) {
      byType[inv.type] = {
        type: inv.type,
        typeName: inv.typeName || inv.type,
        typeIcon: inv.typeIcon || '💰',
        invested: 0,
        currentValue: 0,
        count: 0,
      };
    }
    byType[inv.type].invested += invAmt;
    byType[inv.type].currentValue += currVal;
    byType[inv.type].count += 1;
  });

  const typeBreakdown = Object.values(byType)
    .map((t) => ({
      ...t,
      percentage: totalCurrentValue > 0 ? +((t.currentValue / totalCurrentValue) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.currentValue - a.currentValue);

  // Identify Top Performer and Laggard
  let topGainer = null;
  let topLaggard = null;

  active.forEach((inv) => {
    const returns = calculateInvestmentReturns(inv);
    if (!topGainer || returns.returnPercent > topGainer.returnPercent) {
      topGainer = { name: inv.name, returnPercent: returns.returnPercent, amount: returns.convertedReturn };
    }
    if (!topLaggard || returns.returnPercent < topLaggard.returnPercent) {
      topLaggard = { name: inv.name, returnPercent: returns.returnPercent, amount: returns.convertedReturn };
    }
  });

  return {
    totalInvested,
    totalCurrentValue,
    totalReturns,
    returnPercent,
    activeCount: active.length,
    portfolioXirr,
    typeBreakdown,
    topGainer,
    topLaggard,
  };
};

/**
 * Maturity countdown helper for FDs and RDs
 */
export const getMaturityCountdown = (maturityDate) => {
  if (!maturityDate) return null;
  try {
    const target = new Date(maturityDate);
    if (isNaN(target.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays < 0) {
      return { text: 'Matured', days: diffDays, isMatured: true, color: '#10B981' };
    }
    if (diffDays === 0) {
      return { text: 'Matures Today', days: 0, isMatured: true, color: '#F59E0B' };
    }
    if (diffDays <= 30) {
      return { text: `Matures in ${diffDays}d`, days: diffDays, isMatured: false, color: '#F59E0B' };
    }
    const months = Math.floor(diffDays / 30);
    return { text: `Matures in ~${months} mo`, days: diffDays, isMatured: false, color: '#6366F1' };
  } catch {
    return null;
  }
};
