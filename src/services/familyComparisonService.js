import { getMonthlyFamilyExpenses } from './familyExpenseService';
import { getFamilyBudget } from './familyBudgetService';

// Get comparison data for multiple months
export const getMonthlyComparison = async (familyId, monthsBack = 6) => {
  try {
    const now = new Date();
    const comparisonData = [];

    for (let i = monthsBack - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();

      const expensesResult = await getMonthlyFamilyExpenses(familyId, month, year);
      const budgetResult = await getFamilyBudget(familyId, month, year);

      if (expensesResult.success) {
        const expenses = expensesResult.expenses;
        const totalSpent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const budget = budgetResult.budget?.overall || 0;

        // Category breakdown
        const categories = {};
        expenses.forEach((exp) => {
          const catId = exp.category || 'miscellaneous';
          if (!categories[catId]) {
            categories[catId] = {
              name: exp.categoryName || 'Miscellaneous',
              total: 0,
              count: 0,
            };
          }
          categories[catId].total += exp.amount || 0;
          categories[catId].count += 1;
        });

        comparisonData.push({
          month,
          year,
          label: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
          totalSpent,
          budget,
          expenseCount: expenses.length,
          averageExpense: expenses.length > 0 ? totalSpent / expenses.length : 0,
          categories,
        });
      }
    }

    return { success: true, data: comparisonData };
  } catch (error) {
    console.log('❌ Get monthly comparison error:', error);
    return { success: false, error: error.message, data: [] };
  }
};

// Calculate month-over-month insights
export const getMonthlyInsights = (currentMonth, previousMonth) => {
  const insights = [];

  if (!currentMonth || !previousMonth) {
    return insights;
  }

  // Overall spending change
  const spendingChange = currentMonth.totalSpent - previousMonth.totalSpent;
  const spendingPercent =
    previousMonth.totalSpent > 0
      ? ((spendingChange / previousMonth.totalSpent) * 100).toFixed(1)
      : 0;

  if (spendingChange < 0) {
    insights.push({
      type: 'success',
      icon: 'trending-down',
      text: `You spent ${Math.abs(spendingPercent)}% less than last month`,
      color: '#10B981',
    });
  } else if (spendingChange > 0) {
    insights.push({
      type: 'warning',
      icon: 'trending-up',
      text: `Spending increased by ${spendingPercent}% compared to last month`,
      color: '#F59E0B',
    });
  } else {
    insights.push({
      type: 'info',
      icon: 'remove',
      text: 'Spending remained the same as last month',
      color: '#3B82F6',
    });
  }

  // Budget performance
  if (currentMonth.budget > 0) {
    const budgetPercent = ((currentMonth.totalSpent / currentMonth.budget) * 100).toFixed(0);
    if (currentMonth.totalSpent < currentMonth.budget) {
      insights.push({
        type: 'success',
        icon: 'checkmark-circle',
        text: `You stayed within budget (${budgetPercent}% used)`,
        color: '#10B981',
      });
    } else {
      const overPercent = ((currentMonth.totalSpent - currentMonth.budget) / currentMonth.budget * 100).toFixed(0);
      insights.push({
        type: 'danger',
        icon: 'alert-circle',
        text: `Budget exceeded by ${overPercent}%`,
        color: '#EF4444',
      });
    }
  }

  // Category changes
  Object.keys(currentMonth.categories).forEach((catId) => {
    const currentCat = currentMonth.categories[catId];
    const previousCat = previousMonth.categories[catId];

    if (previousCat) {
      const change = currentCat.total - previousCat.total;
      const changePercent = ((change / previousCat.total) * 100).toFixed(0);

      if (Math.abs(changePercent) >= 30) {
        // Significant change
        if (change > 0) {
          insights.push({
            type: 'warning',
            icon: 'arrow-up',
            text: `${currentCat.name} expenses increased by ${changePercent}%`,
            color: '#F59E0B',
          });
        } else {
          insights.push({
            type: 'success',
            icon: 'arrow-down',
            text: `${currentCat.name} expenses decreased by ${Math.abs(changePercent)}%`,
            color: '#10B981',
          });
        }
      }
    }
  });

  // Daily average
  const avgSpending = (currentMonth.totalSpent / new Date().getDate()).toFixed(0);
  insights.push({
    type: 'info',
    icon: 'calendar',
    text: `Average daily spending: ₹${avgSpending}`,
    color: '#6C63FF',
  });

  return insights;
};

// Get category comparison (current vs previous month)
export const getCategoryComparison = (currentMonth, previousMonth) => {
  const comparison = [];

  if (!currentMonth || !previousMonth) {
    return comparison;
  }

  // Merge all categories from both months
  const allCategories = new Set([
    ...Object.keys(currentMonth.categories),
    ...Object.keys(previousMonth.categories),
  ]);

  allCategories.forEach((catId) => {
    const current = currentMonth.categories[catId] || { name: catId, total: 0 };
    const previous = previousMonth.categories[catId] || { total: 0 };

    const change = current.total - previous.total;
    const changePercent = previous.total > 0 ? ((change / previous.total) * 100).toFixed(1) : 0;

    comparison.push({
      category: current.name,
      categoryId: catId,
      currentTotal: current.total,
      previousTotal: previous.total,
      change,
      changePercent: parseFloat(changePercent),
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'same',
    });
  });

  // Sort by current total (descending)
  return comparison.sort((a, b) => b.currentTotal - a.currentTotal);
};
