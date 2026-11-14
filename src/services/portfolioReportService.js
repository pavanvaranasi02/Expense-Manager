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
export const getSampleCSVTemplate = (importMode = "kite_mf") => {
  if (importMode === "kite_stocks") {
    return `symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time
SILVERBEES,INF204KC1402,2026-01-01,NSE,EQ,EQ,buy,false,18.000000,215.309998,601559772,1300000015228017,2026-01-01T10:21:58
GOLDIETF,INF109KC1NT3,2026-01-01,NSE,EQ,EQ,buy,false,44.000000,114.099998,202226327,1100000021758340,2026-01-01T10:28:01`;
  }
  return `symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time
MIRAE ASSET ELSS TAX SAVER FUND - DIRECT PLAN,INF769K01DM9,2024-06-05,BSE,MF,,buy,false,10.443000,47.877000,1198087270,1198087270,2024-06-05T00:00:00
PARAG PARIKH ELSS TAX SAVER FUND - DIRECT PLAN,INF879O01100,2024-06-05,BSE,MF,,buy,false,17.366000,28.790000,1198083288,1198083288,2024-06-05T00:00:00`;
};

const splitCSVRow = (row) => {
  const parts = [];
  let currentPart = "";
  let insideQuotes = false;

  for (const char of row) {
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      parts.push(currentPart.trim().replace(/^["']|["']$/g, ""));
      currentPart = "";
    } else {
      currentPart += char;
    }
  }
  parts.push(currentPart.trim().replace(/^["']|["']$/g, ""));
  return parts;
};

const parseTradeTimestamp = (execTime, tradeDate) => {
  const raw = (execTime || tradeDate || "").trim();
  if (!raw) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const ms = Date.parse(normalized);
  if (Number.isNaN(ms)) return null;
  return { ms, iso: new Date(ms).toISOString() };
};

const mapSegmentToInvestmentType = (segment = "", symbol = "", importMode = null) => {
  if (importMode === "kite_mf") {
    return INVESTMENT_TYPES.find((t) => t.id === "mutual_fund") || INVESTMENT_TYPES[0];
  }
  if (importMode === "kite_stocks") {
    return INVESTMENT_TYPES.find((t) => t.id === "stocks") || INVESTMENT_TYPES[0];
  }
  const seg = segment.trim().toUpperCase();
  const sym = symbol.trim().toUpperCase();
  if (seg === "MF" || sym.includes("FUND") || sym.includes("ELSS") || sym.includes("NIFTY")) {
    return INVESTMENT_TYPES.find((t) => t.id === "mutual_fund") || INVESTMENT_TYPES[0];
  }
  if (seg === "EQ" || seg === "FO") {
    return INVESTMENT_TYPES.find((t) => t.id === "stocks") || INVESTMENT_TYPES[0];
  }
  return INVESTMENT_TYPES.find((t) => t.id === "other") || INVESTMENT_TYPES[INVESTMENT_TYPES.length - 1];
};

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Parse one or many CSV contents (supporting Broker Tradebook CSV format and legacy KOSH holdings CSV),
 * sort trades chronologically by date, deduplicate by trade_id, and match against existing investments.
 */
export const parseInvestmentsFromMultipleCSVs = (
  csvInputs,
  existingInvestments = [],
  options = {},
) => {
  const { importMode = null } = options;
  const sources = (Array.isArray(csvInputs) ? csvInputs : [csvInputs])
    .map((entry, idx) =>
      typeof entry === "string"
        ? { name: `CSV #${idx + 1}`, content: entry }
        : { name: entry?.name || `CSV #${idx + 1}`, content: entry?.content || "" },
    )
    .filter((s) => s.content && s.content.trim().length > 0);

  if (sources.length === 0) {
    return { success: false, error: "Empty or invalid CSV input" };
  }

  // Detect format from first non-empty header
  const firstLines = sources[0].content
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (firstLines.length < 2) {
    return {
      success: false,
      error: "CSV must contain a header row and at least one data row",
    };
  }

  const firstHeaders = splitCSVRow(firstLines[0]).map((h) => h.toLowerCase());
  const isTradebookFormat =
    firstHeaders.includes("symbol") &&
    (firstHeaders.includes("trade_date") || firstHeaders.includes("order_execution_time")) &&
    firstHeaders.includes("quantity") &&
    firstHeaders.includes("price");

  if (!isTradebookFormat) {
    // Fallback to legacy holdings CSV across all sources
    const combinedHoldings = [];
    const combinedErrors = [];
    for (const src of sources) {
      const res = parseInvestmentsFromCSV(src.content);
      if (res.success) {
        for (const item of res.investments) {
          const existing = existingInvestments.find(
            (e) => e.name?.trim().toLowerCase() === item.name.trim().toLowerCase(),
          );
          combinedHoldings.push({
            ...item,
            action: existing ? "update" : "create",
            existingInvestmentId: existing?.id || null,
            tradeCount: 1,
          });
        }
        if (res.errors?.length) {
          combinedErrors.push(...res.errors.map((e) => `[${src.name}] ${e}`));
        }
      } else {
        combinedErrors.push(`[${src.name}] ${res.error}`);
      }
    }
    if (combinedHoldings.length === 0) {
      return {
        success: false,
        error: combinedErrors[0] || "No valid rows found to import",
        details: combinedErrors,
      };
    }
    return {
      success: true,
      mode: "holdings",
      holdings: combinedHoldings,
      totalRows: combinedHoldings.length,
      validTradesCount: combinedHoldings.length,
      duplicateTradesCount: 0,
      dateRange: null,
      errors: combinedErrors,
    };
  }

  // Collect existing trade IDs and composite signatures for deduplication
  const buildTradeSignature = (isinOrSym, dateIso, tradeType, qty, price) =>
    `${String(isinOrSym || "").trim().toUpperCase()}|${String(dateIso || "").slice(0, 10)}|${String(tradeType || "buy").toLowerCase()}|${Number(qty)}|${Number(price)}`;

  const existingTradeIds = new Set();
  const existingSignatures = new Set();
  for (const inv of existingInvestments) {
    const idKey = inv.isin || inv.name;
    for (const txn of inv.transactions || []) {
      if (txn.tradeId) existingTradeIds.add(String(txn.tradeId).trim());
      if (txn.units !== undefined && txn.price !== undefined) {
        const txnType = txn.type === "WITHDRAW" ? "sell" : "buy";
        existingSignatures.add(
          buildTradeSignature(txn.isin || idKey, txn.date, txnType, txn.units, txn.price),
        );
      }
    }
  }

  const rawTrades = [];
  const errors = [];
  let totalRows = 0;

  for (const src of sources) {
    const lines = src.content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) continue;

    const headers = splitCSVRow(lines[0]).map((h) => h.toLowerCase());
    const idx = {
      symbol: headers.indexOf("symbol"),
      isin: headers.indexOf("isin"),
      tradeDate: headers.indexOf("trade_date"),
      exchange: headers.indexOf("exchange"),
      segment: headers.indexOf("segment"),
      series: headers.indexOf("series"),
      tradeType: headers.indexOf("trade_type"),
      quantity: headers.indexOf("quantity"),
      price: headers.indexOf("price"),
      tradeId: headers.indexOf("trade_id"),
      orderId: headers.indexOf("order_id"),
      execTime: headers.indexOf("order_execution_time"),
    };

    if (idx.symbol === -1 || idx.quantity === -1 || idx.price === -1) {
      errors.push(`[${src.name}] Missing required columns (symbol, quantity, price)`);
      continue;
    }

    for (let i = 1; i < lines.length; i++) {
      totalRows++;
      const parts = splitCSVRow(lines[i]);
      const symbol = parts[idx.symbol]?.trim();
      if (!symbol) {
        errors.push(`[${src.name}] Row ${i + 1}: symbol is required`);
        continue;
      }

      const quantity = parseFloat(parts[idx.quantity]);
      const price = parseFloat(parts[idx.price]);
      if (Number.isNaN(quantity) || quantity <= 0 || Number.isNaN(price) || price < 0) {
        errors.push(`[${src.name}] Row ${i + 1}: invalid quantity or price`);
        continue;
      }

      const parsedDate = parseTradeTimestamp(
        idx.execTime !== -1 ? parts[idx.execTime] : "",
        idx.tradeDate !== -1 ? parts[idx.tradeDate] : "",
      );
      if (!parsedDate) {
        errors.push(`[${src.name}] Row ${i + 1}: invalid trade_date`);
        continue;
      }

      const tradeTypeRaw =
        idx.tradeType !== -1 ? parts[idx.tradeType]?.trim().toLowerCase() : "buy";
      const tradeType = tradeTypeRaw === "sell" ? "sell" : "buy";

      rawTrades.push({
        symbol,
        isin: idx.isin !== -1 ? parts[idx.isin]?.trim() || "" : "",
        exchange: idx.exchange !== -1 ? parts[idx.exchange]?.trim() || "" : "",
        segment: idx.segment !== -1 ? parts[idx.segment]?.trim() || "" : "",
        series: idx.series !== -1 ? parts[idx.series]?.trim() || "" : "",
        tradeType,
        quantity,
        price,
        amount: round2(quantity * price),
        tradeId: idx.tradeId !== -1 ? parts[idx.tradeId]?.trim() || "" : "",
        orderId: idx.orderId !== -1 ? parts[idx.orderId]?.trim() || "" : "",
        dateMs: parsedDate.ms,
        dateIso: parsedDate.iso,
      });
    }
  }

  // Sort all trades chronologically (oldest -> newest)
  rawTrades.sort((a, b) => {
    if (a.dateMs !== b.dateMs) return a.dateMs - b.dateMs;
    return String(a.tradeId || a.orderId).localeCompare(String(b.tradeId || b.orderId));
  });

  // Deduplicate by trade_id and composite signature across files & existing portfolio
  const seenBatchTradeIds = new Set();
  const seenBatchSignatures = new Set();
  const uniqueTrades = [];
  let duplicateTradesCount = 0;

  for (const t of rawTrades) {
    const sig = buildTradeSignature(
      t.isin || t.symbol,
      t.dateIso,
      t.tradeType,
      t.quantity,
      t.price,
    );
    const isDupId =
      t.tradeId && (existingTradeIds.has(t.tradeId) || seenBatchTradeIds.has(t.tradeId));
    const isDupSig = existingSignatures.has(sig) || seenBatchSignatures.has(sig);

    if (isDupId || isDupSig) {
      duplicateTradesCount++;
      continue;
    }
    if (t.tradeId) seenBatchTradeIds.add(t.tradeId);
    seenBatchSignatures.add(sig);
    uniqueTrades.push(t);
  }

  if (uniqueTrades.length === 0 && duplicateTradesCount === 0) {
    return {
      success: false,
      error: errors[0] || "No valid trade rows found to import",
      details: errors,
    };
  }

  // Group chronologically sorted trades into holdings (by ISIN or normalized symbol)
  const holdingsMap = new Map();
  for (const t of uniqueTrades) {
    const key = t.isin ? `isin:${t.isin.toUpperCase()}` : `sym:${t.symbol.toLowerCase()}`;
    if (!holdingsMap.has(key)) {
      const matchedType = mapSegmentToInvestmentType(t.segment, t.symbol, importMode);
      const existing = existingInvestments.find(
        (e) =>
          (t.isin && e.isin && e.isin.toUpperCase() === t.isin.toUpperCase()) ||
          e.name?.trim().toLowerCase() === t.symbol.trim().toLowerCase(),
      );

      holdingsMap.set(key, {
        key,
        name: existing?.name || t.symbol,
        isin: t.isin || existing?.isin || null,
        type: existing?.type || matchedType.id,
        typeName: existing?.typeName || matchedType.name,
        typeIcon: existing?.typeIcon || matchedType.icon,
        platform: existing?.platform || t.exchange || null,
        currency: existing?.currency || "INR",
        exchangeRate: existing?.exchangeRate || 1,
        action: existing ? "update" : "create",
        existingInvestmentId: existing?.id || null,
        existingInvestmentName: existing?.name || null,
        startDate: t.dateIso,
        netInvestedDelta: 0,
        netCurrentDelta: 0,
        investedAmount: 0,
        currentValue: 0,
        tradeCount: 0,
        buyCount: 0,
        sellCount: 0,
        transactions: [],
      });
    }

    const h = holdingsMap.get(key);
    h.tradeCount += 1;
    if (t.tradeType === "sell") {
      h.sellCount += 1;
      h.netInvestedDelta = round2(h.netInvestedDelta - t.amount);
      h.netCurrentDelta = round2(h.netCurrentDelta - t.amount);
    } else {
      h.buyCount += 1;
      h.netInvestedDelta = round2(h.netInvestedDelta + t.amount);
      h.netCurrentDelta = round2(h.netCurrentDelta + t.amount);
    }
    h.investedAmount = Math.max(0, h.netInvestedDelta);
    h.currentValue = Math.max(0, h.netCurrentDelta);

    h.transactions.push({
      id: t.tradeId ? `trade_${t.tradeId}` : `txn_${t.dateMs}_${h.tradeCount}`,
      type: t.tradeType === "sell" ? "WITHDRAW" : "INVEST",
      amount: t.amount,
      units: t.quantity,
      price: t.price,
      tradeId: t.tradeId || null,
      orderId: t.orderId || null,
      isin: t.isin || null,
      exchange: t.exchange || null,
      date: t.dateIso,
      symbol: t.symbol,
      note: `${t.symbol} • ${t.tradeType.toUpperCase()} ${t.quantity} units @ ₹${t.price}`,
      balanceAfter: Math.max(0, h.netInvestedDelta),
    });
  }

  const holdings = Array.from(holdingsMap.values());
  const dateRange =
    uniqueTrades.length > 0
      ? {
          from: uniqueTrades[0].dateIso,
          to: uniqueTrades[uniqueTrades.length - 1].dateIso,
        }
      : null;

  return {
    success: true,
    mode: "tradebook",
    holdings,
    totalRows,
    validTradesCount: uniqueTrades.length,
    duplicateTradesCount,
    dateRange,
    errors,
  };
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
