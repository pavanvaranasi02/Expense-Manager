import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { INVESTMENT_TYPES } from "./investmentService";
import { calculateInvestmentReturns } from "../utils/portfolioMath";

/**
 * ============================================
 * EXPORT PORTFOLIO TO CSV
 * ============================================
 */
export const exportPortfolioCSV = async (
  investments,
  totals,
  portfolioXirr,
  currencySymbol = "₹",
) => {
  try {
    if (!investments || investments.length === 0) {
      return { success: false, error: "No investments to export" };
    }

    // CSV Headers
    let csv =
      "Investment Name,Type,Platform,Currency,Exchange Rate,Invested Amount,Current Value,Converted Value (Base),Absolute Return,Return %,Annualized / XIRR,Interest Rate,Start Date,Maturity Date,Status,Notes\n";

    investments.forEach((inv) => {
      const returns = calculateInvestmentReturns(inv);
      const name = (inv.name || "").replace(/"/g, '""');
      const type = (inv.typeName || inv.type || "").replace(/"/g, '""');
      const platform = (inv.platform || "Direct").replace(/"/g, '""');
      const currency = inv.currency || "INR";
      const exchangeRate = parseFloat(inv.exchangeRate) > 0 ? parseFloat(inv.exchangeRate) : 1;
      const invested = inv.investedAmount || 0;
      const current = inv.currentValue || 0;
      const convertedVal = (current * exchangeRate).toFixed(2);
      const absReturn = returns.absoluteReturn;
      const returnPct = returns.returnPercent;
      const xirrOrRate = returns.displayRate;
      const interestRate = inv.interestRate ? `${inv.interestRate}%` : "-";
      const startDate = inv.startDate
        ? new Date(inv.startDate).toLocaleDateString("en-IN")
        : "-";
      const maturityDate = inv.maturityDate
        ? new Date(inv.maturityDate).toLocaleDateString("en-IN")
        : "-";
      const status = inv.isActive ? "Active" : "Completed / Matured";
      const notes = (inv.note || "").replace(/"/g, '""');

      csv += `"${name}","${type}","${platform}","${currency}",${exchangeRate},${invested},${current},${convertedVal},${absReturn},${returnPct}%,"${xirrOrRate}","${interestRate}","${startDate}","${maturityDate}","${status}","${notes}"\n`;
    });

    // Summary Section
    csv += `\n"Portfolio Summary"\n`;
    csv += `"Total Portfolio Value",${totals?.totalCurrentValue || 0}\n`;
    csv += `"Total Invested",${totals?.totalInvested || 0}\n`;
    csv += `"Total Net Returns",${totals?.totalReturns || 0}\n`;
    csv += `"Overall Return %",${totals?.returnPercent || 0}%\n`;
    if (portfolioXirr !== null && portfolioXirr !== undefined) {
      csv += `"Portfolio XIRR",${portfolioXirr}%\n`;
    }
    csv += `"Active Holdings Count",${investments.filter((i) => i.isActive).length}\n`;
    csv += `"Report Generated At","${new Date().toLocaleString("en-IN")}"\n`;

    const fileName = `Kosh_Portfolio_${new Date().toISOString().split("T")[0]}.csv`;
    const fileUri = FileSystem.documentDirectory + fileName;

    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Check sharing availability
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Share Portfolio CSV",
        UTI: "public.comma-separated-values-text",
      });
    }

    return { success: true, fileName, fileUri };
  } catch (error) {
    console.log("❌ Export Portfolio CSV error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * ============================================
 * EXPORT PORTFOLIO TO HTML / PDF STATEMENT
 * ============================================
 */
export const exportPortfolioHTMLReport = async (
  investments,
  totals,
  portfolioXirr,
  userProfile = {},
  currencySymbol = "₹",
) => {
  try {
    if (!investments || investments.length === 0) {
      return { success: false, error: "No investments to export" };
    }

    const userName = userProfile?.name || "Kosh Wealth User";
    const reportDate = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const activeInvestments = investments.filter((i) => i.isActive);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Kosh Portfolio Statement</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 32px 24px;
      color: #1E293B;
      background: #FFFFFF;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #F1F5F9;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 800;
      color: #4F46E5;
      letter-spacing: -0.5px;
    }
    .brand-sub {
      font-size: 13px;
      color: #64748B;
      margin-top: 4px;
    }
    .meta-box {
      text-align: right;
      font-size: 12px;
      color: #64748B;
    }
    .hero-card {
      background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
      color: #FFFFFF;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 28px;
    }
    .hero-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      opacity: 0.85;
    }
    .hero-amount {
      font-size: 32px;
      font-weight: 800;
      margin: 6px 0 16px 0;
    }
    .hero-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      padding-top: 16px;
    }
    .hero-stat-label {
      font-size: 11px;
      opacity: 0.8;
    }
    .hero-stat-val {
      font-size: 15px;
      font-weight: 700;
      margin-top: 2px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #0F172A;
      margin: 24px 0 12px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 24px;
    }
    th {
      background: #F8FAFC;
      color: #475569;
      font-weight: 600;
      text-align: left;
      padding: 10px 12px;
      border-bottom: 1px solid #E2E8F0;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #F1F5F9;
      color: #334155;
    }
    .text-right { text-align: right; }
    .gain { color: #10B981; font-weight: 600; }
    .loss { color: #EF4444; font-weight: 600; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
    }
    .badge-xirr { background: #ECFDF5; color: #059669; }
    .badge-fixed { background: #EFF6FF; color: #2563EB; }
    .footer {
      margin-top: 36px;
      padding-top: 16px;
      border-top: 1px solid #F1F5F9;
      font-size: 11px;
      color: #94A3B8;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand-title">KOSH • Portfolio Statement</div>
      <div class="brand-sub">Consolidated Wealth & Investment Performance</div>
    </div>
    <div class="meta-box">
      <div><strong>Investor:</strong> ${userName}</div>
      <div><strong>Statement Date:</strong> ${reportDate}</div>
      <div><strong>Active Holdings:</strong> ${activeInvestments.length}</div>
    </div>
  </div>

  <div class="hero-card">
    <div class="hero-label">Total Portfolio Market Value</div>
    <div class="hero-amount">${currencySymbol}${(totals?.totalCurrentValue || 0).toLocaleString("en-IN")}</div>
    <div class="hero-grid">
      <div>
        <div class="hero-stat-label">Total Invested</div>
        <div class="hero-stat-val">${currencySymbol}${(totals?.totalInvested || 0).toLocaleString("en-IN")}</div>
      </div>
      <div>
        <div class="hero-stat-label">Net Gain / Loss</div>
        <div class="hero-stat-val">${(totals?.totalReturns || 0) >= 0 ? "+" : ""}${currencySymbol}${(totals?.totalReturns || 0).toLocaleString("en-IN")}</div>
      </div>
      <div>
        <div class="hero-stat-label">Absolute Return</div>
        <div class="hero-stat-val">${(totals?.returnPercent || 0) >= 0 ? "+" : ""}${totals?.returnPercent || 0}%</div>
      </div>
      <div>
        <div class="hero-stat-label">Portfolio XIRR</div>
        <div class="hero-stat-val">${portfolioXirr !== null && portfolioXirr !== undefined ? `${portfolioXirr}% p.a.` : "N/A"}</div>
      </div>
    </div>
  </div>

  <div class="section-title">Investment Holdings Breakdown</div>
  <table>
    <thead>
      <tr>
        <th>Asset / Fund Name</th>
        <th>Type</th>
        <th>Platform</th>
        <th class="text-right">Invested</th>
        <th class="text-right">Current Value</th>
        <th class="text-right">Gain / Loss</th>
        <th class="text-right">XIRR / Rate</th>
      </tr>
    </thead>
    <tbody>
      ${investments
        .map((inv) => {
          const ret = calculateInvestmentReturns(inv);
          const isPos = ret.absoluteReturn >= 0;
          return `
          <tr>
            <td><strong>${inv.name}</strong></td>
            <td>${inv.typeName || inv.type}</td>
            <td>${inv.platform || "Direct"}</td>
            <td class="text-right">${currencySymbol}${(inv.investedAmount || 0).toLocaleString("en-IN")}</td>
            <td class="text-right">${currencySymbol}${(inv.currentValue || 0).toLocaleString("en-IN")}</td>
            <td class="text-right ${isPos ? "gain" : "loss"}">
              ${isPos ? "+" : ""}${currencySymbol}${ret.absoluteReturn.toLocaleString("en-IN")} (${ret.returnPercent}%)
            </td>
            <td class="text-right">
              <span class="badge ${ret.rateType === "FIXED" ? "badge-fixed" : "badge-xirr"}">
                ${ret.displayRate} ${ret.rateLabel}
              </span>
            </td>
          </tr>
        `;
        })
        .join("")}
    </tbody>
  </table>

  <div class="footer">
    Generated automatically by Kosh Wealth Manager • All valuations based on user recorded entries.
  </div>
</body>
</html>
    `;

    const fileName = `Kosh_Portfolio_Report_${new Date().toISOString().split("T")[0]}.html`;
    const fileUri = FileSystem.documentDirectory + fileName;

    await FileSystem.writeAsStringAsync(fileUri, htmlContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/html",
        dialogTitle: "Share Portfolio Statement",
        UTI: "public.html",
      });
    }

    return { success: true, fileName, fileUri };
  } catch (error) {
    console.log("❌ Export Portfolio HTML error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * ============================================
 * EXPORT TRANSACTION HISTORY TO CSV
 * ============================================
 */
export const exportTransactionHistoryCSV = async (transactions) => {
  try {
    if (!transactions || transactions.length === 0) {
      return { success: false, error: "No transactions to export" };
    }

    let csv = "Date,Investment,Type,Amount,Note,Balance After\n";

    transactions.forEach((txn) => {
      const date = txn.date
        ? new Date(txn.date).toLocaleDateString("en-IN")
        : "-";
      const name = (txn.investmentName || "-").replace(/"/g, '""');
      const type = (txn.type || "INVEST").replace(/"/g, '""');
      const amount = txn.amount || 0;
      const note = (txn.note || "").replace(/"/g, '""');
      const bal = txn.balanceAfter || "-";

      csv += `"${date}","${name}","${type}",${amount},"${note}",${bal}\n`;
    });

    const fileName = `Kosh_Investment_History_${new Date().toISOString().split("T")[0]}.csv`;
    const fileUri = FileSystem.documentDirectory + fileName;

    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Share History CSV",
        UTI: "public.comma-separated-values-text",
      });
    }

    return { success: true, fileName, fileUri };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * ============================================
 * SAMPLE CSV TEMPLATE FOR IMPORT
 * ============================================
 */
export const getSampleCSVTemplate = () => {
  return `Name,Type,Platform,InvestedAmount,CurrentValue,InterestRate,StartDate,Note
Parag Parikh Flexi Cap,mutual_fund,Groww,100000,128000,,2025-01-15,Long term wealth
HDFC Bank Stock,stocks,Zerodha,50000,54200,,2025-03-10,Core banking bet
SBI Fixed Deposit,fd,SBI,200000,214000,7.1,2025-02-01,1 Year FD
Digital Gold,gold,Paytm,30000,34500,,2025-01-20,Hedge asset`;
};

/**
 * ============================================
 * PARSE CSV TEXT INTO INVESTMENT OBJECTS
 * ============================================
 */
export const parseInvestmentsFromCSV = (csvText) => {
  if (!csvText || typeof csvText !== "string") {
    return { success: false, error: "Empty or invalid CSV input" };
  }

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      success: false,
      error: "CSV must contain a header row and at least one data row",
    };
  }

  // Parse header
  const headerLine = lines[0];
  const headers = headerLine
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/["']/g, ""));

  const nameIdx = headers.findIndex((h) => h.includes("name"));
  const typeIdx = headers.findIndex((h) => h.includes("type"));
  const platformIdx = headers.findIndex((h) => h.includes("platform"));
  const investedIdx = headers.findIndex(
    (h) => h.includes("invest") || h.includes("amount"),
  );
  const currentIdx = headers.findIndex(
    (h) => h.includes("current") || h.includes("value"),
  );
  const rateIdx = headers.findIndex(
    (h) => h.includes("rate") || h.includes("interest"),
  );
  const dateIdx = headers.findIndex(
    (h) => h.includes("date") || h.includes("start"),
  );
  const currencyIdx = headers.findIndex(
    (h) => h.includes("currency") || h.includes("curr"),
  );
  const exchangeRateIdx = headers.findIndex(
    (h) => h.includes("exchange") || h.includes("forex"),
  );
  const noteIdx = headers.findIndex((h) => h.includes("note"));

  if (nameIdx === -1) {
    return {
      success: false,
      error: 'CSV header must include a "Name" or "Investment Name" column',
    };
  }

  const valid = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].trim();
    if (!row) continue;

    // Simple CSV row parser handling quotes
    const parts = [];
    let currentPart = "";
    let insideQuotes = false;

    for (let char of row) {
      if (char === '"' || char === "'") {
        insideQuotes = !insideQuotes;
      } else if (char === "," && !insideQuotes) {
        parts.push(currentPart.trim());
        currentPart = "";
      } else {
        currentPart += char;
      }
    }
    parts.push(currentPart.trim());

    const name = parts[nameIdx]?.replace(/["']/g, "").trim();
    if (!name) {
      errors.push(`Row ${i + 1}: Name is required`);
      continue;
    }

    // Determine type
    const rawType = (parts[typeIdx] || "other")
      .toLowerCase()
      .replace(/["'\s]/g, "");
    let matchedType = INVESTMENT_TYPES.find(
      (t) =>
        t.id.toLowerCase() === rawType ||
        t.name.toLowerCase().replace(/\s/g, "") === rawType,
    );

    if (!matchedType) {
      if (rawType.includes("fund") || rawType.includes("mf"))
        matchedType = INVESTMENT_TYPES.find((t) => t.id === "mutual_fund");
      else if (rawType.includes("stock") || rawType.includes("equity"))
        matchedType = INVESTMENT_TYPES.find((t) => t.id === "stocks");
      else if (rawType.includes("fd") || rawType.includes("fixed"))
        matchedType = INVESTMENT_TYPES.find((t) => t.id === "fd");
      else if (rawType.includes("rd") || rawType.includes("recur"))
        matchedType = INVESTMENT_TYPES.find((t) => t.id === "rd");
      else if (rawType.includes("gold") || rawType.includes("silver"))
        matchedType = INVESTMENT_TYPES.find((t) => t.id === "gold");
      else if (rawType.includes("crypto") || rawType.includes("btc"))
        matchedType = INVESTMENT_TYPES.find((t) => t.id === "crypto");
      else matchedType = INVESTMENT_TYPES.find((t) => t.id === "other");
    }

    const platform =
      platformIdx !== -1
        ? parts[platformIdx]?.replace(/["']/g, "").trim()
        : "";
    const investedAmount =
      investedIdx !== -1
        ? parseFloat(parts[investedIdx]?.replace(/[^0-9.]/g, "")) || 0
        : 0;
    const currentValue =
      currentIdx !== -1
        ? parseFloat(parts[currentIdx]?.replace(/[^0-9.]/g, "")) ||
          investedAmount
        : investedAmount;
    const interestRate =
      rateIdx !== -1
        ? parseFloat(parts[rateIdx]?.replace(/[^0-9.]/g, "")) || null
        : null;
    const startDate =
      dateIdx !== -1 && parts[dateIdx]
        ? new Date(parts[dateIdx].replace(/["']/g, "")).toISOString()
        : new Date().toISOString();
    const currency =
      currencyIdx !== -1 && parts[currencyIdx]
        ? parts[currencyIdx].replace(/["']/g, "").trim().toUpperCase()
        : "INR";
    const exchangeRate =
      exchangeRateIdx !== -1 && parts[exchangeRateIdx]
        ? parseFloat(parts[exchangeRateIdx].replace(/[^0-9.]/g, "")) || 1
        : 1;
    const note =
      noteIdx !== -1 ? parts[noteIdx]?.replace(/["']/g, "").trim() : "";

    valid.push({
      name,
      type: matchedType.id,
      typeName: matchedType.name,
      typeIcon: matchedType.icon,
      platform: platform || null,
      currency,
      exchangeRate,
      investedAmount,
      currentValue,
      interestRate,
      startDate,
      note,
      isActive: true,
    });
  }

  if (valid.length === 0) {
    return {
      success: false,
      error: "No valid rows found to import",
      details: errors,
    };
  }

  return { success: true, investments: valid, errors };
};
