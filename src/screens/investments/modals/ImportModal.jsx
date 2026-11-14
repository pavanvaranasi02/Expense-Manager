import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
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
  batchAddInvestments,
} from "../../../services/investmentService";
import {
  getSampleCSVTemplate,
  parseInvestmentsFromCSV,
} from "../../../services/portfolioReportService";

const ImportModal = ({ visible, onClose, onSuccessImport }) => {
  const [csvText, setCsvText] = useState("");
  const [previewList, setPreviewList] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  const handleCopyTemplate = async () => {
    const template = getSampleCSVTemplate();
    await Clipboard.setStringAsync(template);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2500);
  };

  const handlePasteClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setCsvText(text);
      handleParse(text);
    } else {
      Alert.alert("Clipboard Empty", "No text found in clipboard.");
    }
  };

  const handleParse = (textToParse = csvText) => {
    if (!textToParse.trim()) {
      setPreviewList(null);
      setParseErrors([]);
      return;
    }

    const result = parseInvestmentsFromCSV(textToParse);
    if (result.success) {
      setPreviewList(result.investments);
      setParseErrors(result.errors || []);
    } else {
      setPreviewList(null);
      setParseErrors([result.error, ...(result.details || [])]);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewList || previewList.length === 0) return;

    setImporting(true);
    const res = await batchAddInvestments(previewList);
    setImporting(false);

    if (res.success) {
      Alert.alert(
        "🎉 Import Successful",
        `Successfully imported ${res.count} investment${res.count === 1 ? "" : "s"}.`,
      );
      setCsvText("");
      setPreviewList(null);
      setParseErrors([]);
      onSuccessImport();
      onClose();
    } else {
      Alert.alert("Import Failed", res.error);
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
              <Text style={styles.title}>Import Investments</Text>
              <Text style={styles.subTitle}>Bulk add holdings via CSV</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setCsvText("");
                setPreviewList(null);
                setParseErrors([]);
                onClose();
              }}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color="#71717A" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Quick Template & Paste Bar */}
            <View style={styles.toolsBar}>
              <TouchableOpacity
                style={styles.toolBtn}
                onPress={handleCopyTemplate}
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
                  {copiedTemplate ? "Copied Template!" : "Copy CSV Template"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolBtn}
                onPress={handlePasteClipboard}
                activeOpacity={0.7}
              >
                <Ionicons name="clipboard-outline" size={14} color="#0F766E" />
                <Text style={styles.toolBtnText}>Paste from Clipboard</Text>
              </TouchableOpacity>
            </View>

            {/* CSV Text Input */}
            <Text style={styles.inputLabel}>
              CSV Data (Name, Type, Platform, Invested, CurrentValue, Rate)
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Paste or enter CSV rows here..."
              placeholderTextColor="#71717A"
              value={csvText}
              onChangeText={(text) => {
                setCsvText(text);
                if (text.includes("\n")) handleParse(text);
              }}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />

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
                  <Text style={styles.previewTitle}>
                    Ready to import ({previewList.length} items)
                  </Text>
                </View>

                {previewList.map((item, idx) => (
                  <View key={idx} style={styles.previewItem}>
                    <Text style={styles.previewIcon}>{item.typeIcon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.previewName}>{item.name}</Text>
                      <Text style={styles.previewMeta}>
                        {item.typeName}
                        {item.platform ? ` • ${item.platform}` : ""}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.previewAmount}>
                        ₹{(item.investedAmount || 0).toLocaleString("en-IN")}
                      </Text>
                      {item.interestRate ? (
                        <Text style={styles.previewRate}>
                          {item.interestRate}% p.a.
                        </Text>
                      ) : null}
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
                        Import {previewList.length} Investment
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
});

export default ImportModal;
