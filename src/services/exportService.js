import * as FileSystem from "expo-file-system/legacy";
import { getFamilyExpenses } from "./familyExpenseService";

// ============ EXPORT TO CSV ============
export const exportFamilyExpensesToCSV = async (
  familyId,
  familyName,
  filters = {},
) => {
  try {
    const result = await getFamilyExpenses(familyId, filters);

    if (!result.success || result.expenses.length === 0) {
      return { success: false, error: "No expenses to export" };
    }

    const expenses = result.expenses;

    // CSV Headers
    let csv = "Date,Category,Paid By,Amount,Split Type,Split Among,Note\n";

    // CSV Rows
    expenses.forEach((exp) => {
      const date = exp.date
        ? new Date(exp.date).toLocaleDateString("en-IN")
        : "";
      const category = exp.categoryName || "";
      const paidBy = exp.paidByName || "";
      const amount = exp.amount || 0;
      const splitType = exp.splitType || "PAID_FOR_ALL";

      // Format split details
      let splitAmong = "";
      if (exp.splitDetails && Object.keys(exp.splitDetails).length > 0) {
        const splits = Object.entries(exp.splitDetails).map(
          ([userId, details]) => {
            const member =
              expenses.find((e) => e.paidBy === userId)?.paidByName || userId;
            return `${member}(₹${details.amount})`;
          },
        );
        splitAmong = splits.join("; ");
      } else {
        splitAmong = "All members";
      }

      const note = (exp.note || "").replace(/"/g, '""'); // Escape quotes

      csv += `"${date}","${category}","${paidBy}",${amount},"${splitType}","${splitAmong}","${note}"\n`;
    });

    // Calculate summary
    const totalSpent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    csv += `\nSummary\n`;
    csv += `Total Expenses,${expenses.length}\n`;
    csv += `Total Amount,INR ${totalSpent.toLocaleString("en-IN")}\n`;

    // Save to file
    const fileName = `${familyName.replace(/\s+/g, "_")}_expenses_${new Date().toISOString().split("T")[0]}.csv`;
    const fileUri = FileSystem.documentDirectory + fileName;

    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    console.log("✅ CSV exported:", fileName);
    return { success: true, fileName, fileUri };
  } catch (error) {
    console.log("❌ Export CSV error:", error);
    return { success: false, error: error.message };
  }
};

// ============ EXPORT TO PDF ============
export const exportFamilyExpensesToPDF = async (
  familyId,
  familyName,
  filters = {},
) => {
  try {
    const result = await getFamilyExpenses(familyId, filters);

    if (!result.success || result.expenses.length === 0) {
      return { success: false, error: "No expenses to export" };
    }

    const expenses = result.expenses;
    const now = new Date();
    const month = filters.startDate
      ? new Date(filters.startDate).toLocaleString("default", {
          month: "long",
          year: "numeric",
        })
      : "All Time";

    // Calculate statistics
    const totalSpent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const avgExpense = totalSpent / expenses.length;

    // Category breakdown
    const categories = {};
    expenses.forEach((exp) => {
      const cat = exp.categoryName || "Miscellaneous";
      categories[cat] = (categories[cat] || 0) + exp.amount;
    });

    const topCategories = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Member breakdown
    const members = {};
    expenses.forEach((exp) => {
      const member = exp.paidByName || "Unknown";
      members[member] = (members[member] || 0) + exp.amount;
    });

    const topMembers = Object.entries(members).sort((a, b) => b[1] - a[1]);

    // Build HTML content
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Family Expense Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 40px;
      background: #fff;
      color: #1e293b;
      font-size: 12px;
    }
    .header {
      border-bottom: 3px solid #6C63FF;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 28px;
      color: #6C63FF;
      margin-bottom: 5px;
    }
    .header .subtitle {
      font-size: 14px;
      color: #64748b;
    }
    .header .date {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 10px;
    }
    
    .summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 30px;
    }
    .summary-card {
      background: #f8f9fe;
      border-radius: 12px;
      padding: 15px;
      border-left: 4px solid #6C63FF;
    }
    .summary-card .label {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 5px;
      font-weight: 600;
    }
    .summary-card .value {
      font-size: 22px;
      font-weight: 800;
      color: #1e293b;
    }
    
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 15px;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 8px;
    }
    
    .breakdown-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .breakdown-item:last-child { border-bottom: none; }
    .breakdown-item .name {
      font-weight: 600;
      color: #1e293b;
    }
    .breakdown-item .amount {
      font-weight: 700;
      color: #6C63FF;
    }
    .breakdown-item .percent {
      font-size: 11px;
      color: #94a3b8;
      margin-left: 8px;
    }
    
    .transactions-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    .transactions-table thead {
      background: #f8f9fe;
    }
    .transactions-table th {
      padding: 10px;
      text-align: left;
      font-weight: 700;
      color: #64748b;
      border-bottom: 2px solid #e2e8f0;
    }
    .transactions-table td {
      padding: 10px;
      border-bottom: 1px solid #f1f5f9;
    }
    .transactions-table tbody tr:hover {
      background: #f8f9fe;
    }
    .amount-positive { color: #10b981; }
    .amount-negative { color: #ef4444; font-weight: 600; }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #f1f5f9;
      text-align: center;
      color: #94a3b8;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Family Expense Report</h1>
    <div class="subtitle">${familyName}</div>
    <div class="date">Period: ${month} • Generated: ${now.toLocaleString("en-IN")}</div>
  </div>

  <div class="summary">
    <div class="summary-card">
      <div class="label">Total Expenses</div>
      <div class="value">${expenses.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">Total Amount</div>
      <div class="value">₹${totalSpent.toLocaleString("en-IN")}</div>
    </div>
    <div class="summary-card">
      <div class="label">Average Expense</div>
      <div class="value">₹${Math.round(avgExpense).toLocaleString("en-IN")}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Category Breakdown</div>
    ${topCategories
      .map(
        ([cat, amount]) => `
      <div class="breakdown-item">
        <span class="name">${cat}</span>
        <span>
          <span class="amount">₹${amount.toLocaleString("en-IN")}</span>
          <span class="percent">${((amount / totalSpent) * 100).toFixed(1)}%</span>
        </span>
      </div>
    `,
      )
      .join("")}
  </div>

  <div class="section">
    <div class="section-title">Member Breakdown</div>
    ${topMembers
      .map(
        ([member, amount]) => `
      <div class="breakdown-item">
        <span class="name">${member}</span>
        <span>
          <span class="amount">₹${amount.toLocaleString("en-IN")}</span>
          <span class="percent">${((amount / totalSpent) * 100).toFixed(1)}%</span>
        </span>
      </div>
    `,
      )
      .join("")}
  </div>

  <div class="section">
    <div class="section-title">Detailed Transactions</div>
    <table class="transactions-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Category</th>
          <th>Paid By</th>
          <th>Amount</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>
        ${expenses
          .map(
            (exp) => `
          <tr>
            <td>${exp.date ? new Date(exp.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "-"}</td>
            <td>${exp.categoryName || "-"}</td>
            <td>${exp.paidByName || "-"}</td>
            <td class="amount-negative">₹${exp.amount.toLocaleString("en-IN")}</td>
            <td>${exp.note || "-"}</td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  </div>

  <div class="footer">
    ExpenseManager • Family Financial Report<br>
    This is an auto-generated document. All amounts are in Indian Rupees (₹).
  </div>
</body>
</html>
    `;

    const fileName = `${familyName.replace(/\s+/g, "_")}_report_${new Date().toISOString().split("T")[0]}.html`;
    const fileUri = FileSystem.documentDirectory + fileName;

    await FileSystem.writeAsStringAsync(fileUri, htmlContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    console.log("✅ PDF/HTML exported:", fileName);
    return { success: true, fileName, fileUri };
  } catch (error) {
    console.log("❌ Export PDF error:", error);
    return { success: false, error: error.message };
  }
};

// ============ GET EXPORT FILTERS ============
export const buildExportFilters = (options) => {
  const filters = {};

  // Date range
  if (options.dateRange === "THIS_MONTH") {
    const now = new Date();
    filters.startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    filters.endDate = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );
  } else if (options.dateRange === "LAST_MONTH") {
    const now = new Date();
    filters.startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    filters.endDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
    );
  } else if (
    options.dateRange === "CUSTOM" &&
    options.customStartDate &&
    options.customEndDate
  ) {
    filters.startDate = new Date(options.customStartDate);
    filters.endDate = new Date(options.customEndDate);
  }

  // Categories
  if (options.categories && options.categories.length > 0) {
    filters.categories = options.categories;
  }

  // Members
  if (options.members && options.members.length > 0) {
    filters.members = options.members;
  }

  return filters;
};
