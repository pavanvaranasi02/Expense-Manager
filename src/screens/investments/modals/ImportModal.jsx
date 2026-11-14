import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  getInvestments,
  importTradebookHoldings,
} from "../../../services/investmentService";
import {
  getSampleCSVTemplate,
  parseInvestmentsFromMultipleCSVs,
} from "../../../services/portfolioReportService";

const TRADEBOOK_COLUMNS =
  "symbol, isin, trade_date, exchange, segment, series, trade_type, auction, quantity, price, trade_id, order_id, order_execution_time";

const IMPORT_TABS = [
  {
    id: "kite_mf",
    label: "Mutual Funds (Kite)",
    icon: "pie-chart-outline",
    subtitle: "Zerodha Coin / Kite MF tradebook CSV",
    preferredType: "mutual_fund",
  },
  {
    id: "kite_stocks",
    label: "Stocks (Kite)",
    icon: "trending-up-outline",
    subtitle: "Zerodha Kite Equity / ETF tradebook CSV",
    preferredType: "stocks",
  },
];

const ImportModal = ({ visible, onClose, onSuccessImport }) => {
  const [activeTab, setActiveTab] = useState("kite_mf");
  const [csvText, setCsvText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]); // [{ name, content }]
  const [existingInvestments, setExistingInvestments] = useState([]);
  const [previewSummary, setPreviewSummary] = useState(null);
  const [previewList, setPreviewList] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [targetPickerIndex, setTargetPickerIndex] = useState(null); // number | 'all' | null

  const resetAll = () => {
    setCsvText("");
    setSelectedFiles([]);
    setPreviewSummary(null);
    setPreviewList(null);
    setParseErrors([]);
    setImportProgress(null);
    setTargetPickerIndex(null);
  };

  const handleCopyTemplate = async () => {
    const template = getSampleCSVTemplate(activeTab);
    await Clipboard.setStringAsync(template);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2500);
  };

  const handleSwitchTab = (tabId) => {
    if (importing || tabId === activeTab) return;
    setActiveTab(tabId);
    resetAll();
  };

  const handlePasteClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setCsvText(text);
      await handleParse(text, selectedFiles);
    } else {
      Alert.alert("Clipboard Empty", "No text found in clipboard.");
    }
  };

  const readCSVAsset = async (asset) => {
    if (asset?.file && typeof asset.file.text === "function") {
      return await asset.file.text();
    }
    try {
      return await new ExpoFile(asset.uri).text();
    } catch (_modernErr) {
      // Fall back to fetch / legacy FileSystem if needed
    }
    try {
      const response = await fetch(asset.uri);
      if (response.ok) {
        return await response.text();
      }
    } catch (_fetchErr) {
      // Fall back to legacy FileSystem
    }
    return await FileSystem.readAsStringAsync(asset.uri);
  };

  const handlePickCSVFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "application/csv", "*/*"],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const loaded = [];
      for (const asset of result.assets) {
        try {
          const content = await readCSVAsset(asset);
          if (content && content.trim()) {
            loaded.push({ name: asset.name || "trades.csv", content });
          }
        } catch (readErr) {
          console.log("❌ Failed reading CSV file:", asset.name, readErr);
        }
      }

      if (loaded.length === 0) {
        Alert.alert("Empty Files", "Could not read any non-empty CSV files.");
        return;
      }

      const nextFiles = [...selectedFiles, ...loaded];
      setSelectedFiles(nextFiles);
      await handleParse(csvText, nextFiles);
    } catch (error) {
      Alert.alert("File Picker Error", error?.message || "Failed to pick CSV files.");
    }
  };

  const handleRemoveFile = async (indexToRemove) => {
    const nextFiles = selectedFiles.filter((_, idx) => idx !== indexToRemove);
    setSelectedFiles(nextFiles);
    await handleParse(csvText, nextFiles);
  };

  const handleParse = async (textToParse = csvText, filesToParse = selectedFiles) => {
    const sources = [
      ...filesToParse,
      ...(textToParse.trim() ? [{ name: "Pasted CSV", content: textToParse }] : []),
    ];

    if (sources.length === 0) {
      setPreviewList(null);
      setPreviewSummary(null);
      setParseErrors([]);
      return;
    }

    const existingRes = await getInvestments();
    const loadedExisting = existingRes?.success ? existingRes.investments : [];
    setExistingInvestments(loadedExisting);

    const result = parseInvestmentsFromMultipleCSVs(sources, loadedExisting, {
      importMode: activeTab,
    });
    if (result.success) {
      setPreviewList(result.holdings);
      setPreviewSummary({
        fileCount: sources.length,
        totalRows: result.totalRows,
        validTradesCount: result.validTradesCount,
        duplicateTradesCount: result.duplicateTradesCount,
        dateRange: result.dateRange,
        newCount: result.holdings.filter((h) => h.action === "create").length,
        updateCount: result.holdings.filter((h) => h.action === "update").length,
      });
      setParseErrors(result.errors || []);
    } else {
      setPreviewList(null);
      setPreviewSummary(null);
      setParseErrors([result.error, ...(result.details || [])]);
    }
  };

  const handleAssignTarget = (targetInv) => {
    if (!previewList || targetPickerIndex === null) return;

    const updatedList = previewList.map((item, idx) => {
      if (targetPickerIndex !== "all" && idx !== targetPickerIndex) return item;
      if (!targetInv) {
        return {
          ...item,
          action: "create",
          existingInvestmentId: null,
          existingInvestmentName: null,
        };
      }
      return {
        ...item,
        action: "update",
        existingInvestmentId: targetInv.id,
        existingInvestmentName: targetInv.name,
      };
    });

    setPreviewList(updatedList);
    if (previewSummary) {
      setPreviewSummary({
        ...previewSummary,
        newCount: updatedList.filter((h) => h.action === "create").length,
        updateCount: updatedList.filter((h) => h.action === "update").length,
      });
    }
    setTargetPickerIndex(null);
  };

  const handleConfirmImport = async () => {
    if (!previewList || previewList.length === 0) return;

    setImporting(true);
    setImportProgress({
      current: 0,
      total: previewList.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      currentName: previewList[0]?.name || "",
    });

    const res = await importTradebookHoldings(previewList, (prog) => {
      setImportProgress(prog);
    });
    setImporting(false);

    if (res.success || res.created > 0 || res.updated > 0) {
      const dupesSkipped = (previewSummary?.duplicateTradesCount || 0) + (res.skipped || 0);
      const failedCount = res.failed || 0;
      const summaryLines = [
        `• Entries added: ${res.created} new, ${res.updated} updated (${previewSummary?.validTradesCount || 0} trades)`,
        `• Skipped: ${dupesSkipped} duplicate${dupesSkipped === 1 ? "" : "s"} found`,
        `• Failed: ${failedCount} entr${failedCount === 1 ? "y" : "ies"}`,
      ];
      if (failedCount > 0 && res.failedDetails?.length) {
        summaryLines.push(
          "",
          ...res.failedDetails.slice(0, 3).map((f) => `  - ${f.name}: ${f.error}`),
        );
      }

      Alert.alert("🎉 Import & Update Summary", summaryLines.join("\n"));
      resetAll();
      onSuccessImport();
      onClose();
    } else {
      Alert.alert(
        "Import Failed",
        res.error || `Failed adding ${res.failed || previewList.length} entries.`,
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Import & Update Investments</Text>
              <Text style={styles.subTitle}>Select multiple CSVs or paste tradebook rows</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (importing) return;
                resetAll();
                onClose();
              }}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color="#71717A" />
            </TouchableOpacity>
          </View>

          {/* Import Approach Tabs */}
          <View style={styles.tabBar}>
            {IMPORT_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                  onPress={() => handleSwitchTab(tab.id)}
                  disabled={importing}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={tab.icon}
                    size={15}
                    color={isActive ? "#FFFFFF" : "#475569"}
                  />
                  <Text
                    style={[
                      styles.tabBtnText,
                      isActive && styles.tabBtnTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Multi-CSV File Picker */}
            <TouchableOpacity
              style={styles.filePickerBtn}
              onPress={handlePickCSVFiles}
              disabled={importing}
              activeOpacity={0.8}
            >
              <Ionicons name="folder-open-outline" size={18} color="#FFFFFF" />
              <Text style={styles.filePickerBtnText}>
                Select CSV Files ({selectedFiles.length} selected)
              </Text>
            </TouchableOpacity>

            {/* Selected CSV Chips */}
            {selectedFiles.length > 0 && (
              <View style={styles.fileChipsWrap}>
                {selectedFiles.map((f, idx) => (
                  <View key={`${f.name}_${idx}`} style={styles.fileChip}>
                    <Ionicons name="document-text-outline" size={13} color="#0F766E" />
                    <Text style={styles.fileChipText} numberOfLines={1}>
                      {f.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveFile(idx)}
                      disabled={importing}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close-circle" size={15} color="#71717A" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Quick Template & Paste Bar */}
            <View style={styles.toolsBar}>
              <TouchableOpacity
                style={styles.toolBtn}
                onPress={handleCopyTemplate}
                disabled={importing}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={copiedTemplate ? "checkmark" : "copy-outline"}
                  size={14}
                  color={copiedTemplate ? "#047857" : "#0F766E"}
                />
                <Text
                  style={[
                    styles.toolBtnText,
                    copiedTemplate && { color: "#047857" },
                  ]}
                >
                  {copiedTemplate ? "Copied Format!" : "Copy CSV Format"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolBtn}
                onPress={handlePasteClipboard}
                disabled={importing}
                activeOpacity={0.7}
              >
                <Ionicons name="clipboard-outline" size={14} color="#0F766E" />
                <Text style={styles.toolBtnText}>Paste from Clipboard</Text>
              </TouchableOpacity>
            </View>

            {/* Expected CSV Format Box */}
            {(() => {
              const currentTab = IMPORT_TABS.find((t) => t.id === activeTab) || IMPORT_TABS[0];
              return (
                <View style={styles.formatBox}>
                  <Text style={styles.formatTitle}>
                    {currentTab.label} — Expected CSV Format
                  </Text>
                  <Text style={styles.formatHint}>{currentTab.subtitle}</Text>
                  <Text style={styles.formatCols}>{TRADEBOOK_COLUMNS}</Text>
                  <Text style={styles.formatHint}>
                    All rows across uploaded files are sorted chronologically by trade date, deduplicated by trade_id, and applied to update existing holdings or create new ones.
                  </Text>
                </View>
              );
            })()}

            {/* CSV Text Input */}
            <Text style={styles.inputLabel}>
              Or Paste CSV Rows Directly
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Paste tradebook CSV rows here..."
              placeholderTextColor="#71717A"
              value={csvText}
              onChangeText={(text) => {
                setCsvText(text);
                if (text.includes("\n")) handleParse(text, selectedFiles);
              }}
              editable={!importing}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Live Progress Banner */}
            {importing && importProgress && (
              <View style={styles.progressBox}>
                <View style={styles.progressHeader}>
                  <ActivityIndicator size="small" color="#0F766E" />
                  <Text style={styles.progressTitle}>
                    Updating investments... {importProgress.current} / {importProgress.total}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.round(
                          ((importProgress.current || 0) / Math.max(1, importProgress.total || 1)) * 100
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressMeta} numberOfLines={1}>
                  Added: {importProgress.created} • Updated: {importProgress.updated}
                  {importProgress.failed ? ` • Failed: ${importProgress.failed}` : ""}
                  {importProgress.currentName ? ` • ${importProgress.currentName}` : ""}
                </Text>
              </View>
            )}

            {/* All-duplicates notice */}
            {previewSummary &&
              previewSummary.duplicateTradesCount > 0 &&
              (!previewList || previewList.length === 0) && (
                <View style={styles.summaryPillRow}>
                  <Text
                    style={[
                      styles.summaryPill,
                      { backgroundColor: "#FEF3C7", color: "#92400E" },
                    ]}
                  >
                    All {previewSummary.duplicateTradesCount} entries were duplicates and skipped.
                  </Text>
                </View>
              )}

            {/* Validation / Parse Button if not automatically previewing */}
            {!previewList && csvText.trim().length > 0 && (
              <TouchableOpacity
                style={styles.parseBtn}
                onPress={() => handleParse()}
              >
                <Ionicons name="search-outline" size={16} color="#FFFFFF" />
                <Text style={styles.parseBtnText}>Validate CSV Data</Text>
              </TouchableOpacity>
            )}

            {/* Errors Banner */}
            {parseErrors.length > 0 && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#B91C1C" />
                <View style={{ flex: 1 }}>
                  {parseErrors.map((err, idx) => (
                    <Text key={idx} style={styles.errorText}>
                      • {err}
                    </Text>
                  ))}
                </View>
              </View>
            )}

            {/* Preview List */}
            {previewList && previewList.length > 0 && (
              <View style={styles.previewSection}>
                <View style={styles.previewHeader}>
                  <Ionicons name="checkmark-done" size={16} color="#047857" />
                  <Text style={[styles.previewTitle, { flex: 1 }]}>
                    Sorted & Ready ({previewList.length} holding{previewList.length === 1 ? "" : "s"})
                  </Text>
                  {existingInvestments.length > 0 && (
                    <TouchableOpacity
                      style={styles.assignAllBtn}
                      onPress={() => setTargetPickerIndex("all")}
                      disabled={importing}
                    >
                      <Ionicons name="swap-horizontal" size={13} color="#0F766E" />
                      <Text style={styles.assignAllText}>Assign All To...</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {previewSummary && (
                  <View style={styles.summaryPillRow}>
                    <Text style={styles.summaryPill}>
                      {previewSummary.validTradesCount} trades
                    </Text>
                    <Text style={[styles.summaryPill, { backgroundColor: "#DCFCE7", color: "#166534" }]}>
                      {previewSummary.newCount} new
                    </Text>
                    <Text style={[styles.summaryPill, { backgroundColor: "#DBEAFE", color: "#1E40AF" }]}>
                      {previewSummary.updateCount} updates
                    </Text>
                    {previewSummary.duplicateTradesCount > 0 && (
                      <Text style={[styles.summaryPill, { backgroundColor: "#FEF3C7", color: "#92400E" }]}>
                        {previewSummary.duplicateTradesCount} dupes skipped
                      </Text>
                    )}
                  </View>
                )}

                {previewList.map((item, idx) => (
                  <View key={idx} style={styles.previewItem}>
                    <Text style={styles.previewIcon}>{item.typeIcon}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={[styles.previewName, { flexShrink: 1 }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <View
                          style={[
                            styles.actionBadge,
                            item.action === "update"
                              ? { backgroundColor: "#DBEAFE" }
                              : { backgroundColor: "#DCFCE7" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.actionBadgeText,
                              item.action === "update"
                                ? { color: "#1E40AF" }
                                : { color: "#166534" },
                            ]}
                          >
                            {item.action === "update" ? "UPDATE" : "NEW"}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.previewMeta}>
                        {item.typeName}
                        {item.platform ? ` • ${item.platform}` : ""}
                        {item.tradeCount ? ` • ${item.tradeCount} trade${item.tradeCount === 1 ? "" : "s"}` : ""}
                      </Text>
                      {existingInvestments.length > 0 && (
                        <TouchableOpacity
                          style={styles.targetPill}
                          onPress={() => setTargetPickerIndex(idx)}
                          disabled={importing}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={item.action === "update" ? "git-merge-outline" : "add-circle-outline"}
                            size={12}
                            color="#0F766E"
                          />
                          <Text style={styles.targetPillText} numberOfLines={1}>
                            {item.action === "update" && item.existingInvestmentName
                              ? `Add into: ${item.existingInvestmentName}`
                              : "Create as New Investment"}
                          </Text>
                          <Ionicons name="chevron-down" size={12} color="#0F766E" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.previewAmount}>
                        ₹{(item.investedAmount || 0).toLocaleString("en-IN")}
                      </Text>
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.importBtn, importing && { opacity: 0.6 }]}
                  onPress={handleConfirmImport}
                  disabled={importing}
                >
                  {importing ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name="cloud-upload"
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.importBtnText}>
                        Apply {previewList.length} Investment
                        {previewList.length === 1 ? "" : "s"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Target Investment Picker Modal */}
      <Modal
        visible={targetPickerIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTargetPickerIndex(null)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerTitle}>
                  {targetPickerIndex === "all"
                    ? "Assign All Holdings To"
                    : "Choose Target Investment"}
                </Text>
                <Text style={styles.pickerSub}>
                  Add entries into an existing Mutual Fund, Stock, FD, or create new
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setTargetPickerIndex(null)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color="#71717A" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={styles.pickerRow}
                onPress={() => handleAssignTarget(null)}
              >
                <View style={[styles.pickerIconWrap, { backgroundColor: "#DCFCE7" }]}>
                  <Ionicons name="add-circle" size={18} color="#166534" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerRowTitle}>Create as New Investment</Text>
                  <Text style={styles.pickerRowSub}>
                    Keep as a separate holding in portfolio
                  </Text>
                </View>
              </TouchableOpacity>

              {[...existingInvestments]
                .sort((a, b) => {
                  const preferred =
                    IMPORT_TABS.find((t) => t.id === activeTab)?.preferredType || "mutual_fund";
                  const aMatch = a.type === preferred ? 0 : 1;
                  const bMatch = b.type === preferred ? 0 : 1;
                  return aMatch - bMatch;
                })
                .map((inv) => (
                <TouchableOpacity
                  key={inv.id}
                  style={styles.pickerRow}
                  onPress={() => handleAssignTarget(inv)}
                >
                  <View style={styles.pickerIconWrap}>
                    <Text style={{ fontSize: 18 }}>{inv.typeIcon || "💰"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerRowTitle} numberOfLines={1}>
                      {inv.name}
                    </Text>
                    <Text style={styles.pickerRowSub} numberOfLines={1}>
                      {inv.typeName || inv.type}
                      {inv.platform ? ` • ${inv.platform}` : ""}
                      {` • ₹${(inv.investedAmount || 0).toLocaleString("en-IN")}`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontFamily: 'Manrope_700Bold',
    color: "#0F172A",
  },
  subTitle: {
    fontSize: 12,
    color: "#71717A",
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ECEAE4",
    justifyContent: "center",
    alignItems: "center",
  },
  toolsBar: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  toolBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E6F2F0",
    paddingVertical: 8,
    borderRadius: 10,
    gap: 5,
  },
  toolBtnText: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: "#0F766E",
  },
  inputLabel: {
    fontSize: 12,
    color: "#475569",
    fontFamily: 'Manrope_600SemiBold',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E2DC",
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    color: "#18181B",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    minHeight: 110,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  parseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F766E",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    marginBottom: 14,
  },
  parseBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
  },
  errorBanner: {
    flexDirection: "row",
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    color: "#DC2626",
    lineHeight: 18,
  },
  previewSection: {
    marginTop: 4,
    paddingBottom: 20,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: "#047857",
  },
  previewItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#ECEAE4",
  },
  previewIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  previewName: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: "#0F172A",
  },
  previewMeta: {
    fontSize: 11,
    color: "#71717A",
    marginTop: 2,
  },
  previewAmount: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: "#0F172A",
  },
  previewRate: {
    fontSize: 11,
    color: "#2563EB",
    fontFamily: 'Manrope_600SemiBold',
  },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#047857",
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 14,
    gap: 8,
  },
  importBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
  },
  filePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F766E",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 10,
  },
  filePickerBtnText: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: "#FFFFFF",
  },
  fileChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  fileChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#E6F2F0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    maxWidth: "100%",
  },
  fileChipText: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    color: "#0F766E",
    maxWidth: 180,
  },
  formatBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    marginBottom: 12,
    gap: 4,
  },
  formatTitle: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: "#0F172A",
  },
  formatCols: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#0F766E",
  },
  formatHint: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 15,
  },
  progressBox: {
    marginTop: 12,
    backgroundColor: "#E6F2F0",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressTitle: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: "#0F766E",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#0F766E",
    borderRadius: 3,
  },
  progressMeta: {
    fontSize: 11,
    color: "#334155",
  },
  summaryPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  summaryPill: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    backgroundColor: "#F1F5F9",
    color: "#334155",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  actionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  actionBadgeText: {
    fontSize: 9,
    fontFamily: 'Manrope_700Bold',
  },
  assignAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E6F2F0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  assignAllText: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: "#0F766E",
  },
  targetPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: 5,
    backgroundColor: "#E6F2F0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: "100%",
  },
  targetPillText: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    color: "#0F766E",
    flexShrink: 1,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "75%",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  pickerTitle: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: "#0F172A",
  },
  pickerSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  pickerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  pickerRowTitle: {
    fontSize: 14,
    fontFamily: 'Manrope_700Bold',
    color: "#0F172A",
  },
  pickerRowSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
    gap: 6,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: "#0F766E",
  },
  tabBtnText: {
    fontSize: 12,
    fontFamily: "Manrope_700Bold",
    color: "#475569",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
  },
});

export default ImportModal;
