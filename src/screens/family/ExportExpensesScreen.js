import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { Analytics } from "../../config/firebase";
import { FAMILY_CATEGORIES } from "../../constants/familyCategories";
import {
  buildExportFilters,
  exportFamilyExpensesToCSV,
  exportFamilyExpensesToPDF,
} from "../../services/exportService";
import useFamilyStore from "../../store/useFamilyStore";

const ExportExpensesScreen = ({ navigation }) => {
  const { family, members } = useFamilyStore();

  const [dateRange, setDateRange] = useState("THIS_MONTH");
  const [customStartDate, setCustomStartDate] = useState(new Date());
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [format, setFormat] = useState("CSV");
  const [exporting, setExporting] = useState(false);
  const [exportedFile, setExportedFile] = useState(null);
  const [showOptions, setShowOptions] = useState(false);

  const toggleCategory = (catId) => {
    if (selectedCategories.includes(catId)) {
      setSelectedCategories(selectedCategories.filter((id) => id !== catId));
    } else {
      setSelectedCategories([...selectedCategories, catId]);
    }
  };

  const toggleMember = (memberId) => {
    if (selectedMembers.includes(memberId)) {
      setSelectedMembers(selectedMembers.filter((id) => id !== memberId));
    } else {
      setSelectedMembers([...selectedMembers, memberId]);
    }
  };

  const handleExport = async () => {
    setExporting(true);

    try {
      const options = {
        dateRange,
        customStartDate: dateRange === "CUSTOM" ? customStartDate : null,
        customEndDate: dateRange === "CUSTOM" ? customEndDate : null,
        categories: selectedCategories.length > 0 ? selectedCategories : null,
        members: selectedMembers.length > 0 ? selectedMembers : null,
      };

      const filters = buildExportFilters(options);

      let result;
      if (format === "CSV") {
        result = await exportFamilyExpensesToCSV(
          family.id,
          family.name,
          filters,
        );
        Analytics.logAnalyticsEvent("export_family_expenses_csv");
      } else {
        result = await exportFamilyExpensesToPDF(
          family.id,
          family.name,
          filters,
        );
        Analytics.logAnalyticsEvent("export_family_expenses_pdf");
      }

      if (result.success) {
        setExportedFile(result);
        setShowOptions(true);

        // Show success toast
        Toast.show({
          type: "success",
          text1: "Export Successful",
          text2: `File saved to device`,
        });
      } else {
        Toast.show({
          type: "error",
          text1: "Export Failed",
          text2: result.error,
        });
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    if (!exportedFile?.fileUri) return;

    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(exportedFile.fileUri, {
          mimeType: format === "CSV" ? "text/csv" : "text/html",
          dialogTitle: `Export ${format}`,
          UTI:
            format === "CSV"
              ? "public.comma-separated-values-text"
              : "public.html",
        });
      } else {
        Toast.show({
          type: "info",
          text1: "Sharing not available",
          text2: "File saved to device",
        });
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Share failed",
        text2: error.message,
      });
    }
  };

  const handleOpenLocation = async () => {
    if (!exportedFile?.fileUri) return;

    try {
      // On iOS, we can open the file location
      if (Platform.OS === "ios") {
        await Linking.openURL(exportedFile.fileUri);
      } else {
        // On Android, share to let user choose where to save
        await handleShare();
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Could not open file location",
      });
    }
  };

  const closeOptions = () => {
    setShowOptions(false);
    setExportedFile(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color="#18181B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Export Expenses</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Date Range */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date Range</Text>
          {["THIS_MONTH", "LAST_MONTH", "CUSTOM"].map((range) => (
            <TouchableOpacity
              key={range}
              style={[
                styles.option,
                dateRange === range && styles.optionActive,
              ]}
              onPress={() => setDateRange(range)}
            >
              <Text
                style={[
                  styles.optionLabel,
                  dateRange === range && styles.optionLabelActive,
                ]}
              >
                {range === "THIS_MONTH"
                  ? "This Month"
                  : range === "LAST_MONTH"
                    ? "Last Month"
                    : "Custom Range"}
              </Text>
              {dateRange === range && (
                <Ionicons name="checkmark-circle" size={20} color="#134E4A" />
              )}
            </TouchableOpacity>
          ))}

          {dateRange === "CUSTOM" && (
            <View style={styles.customDateRow}>
              <TouchableOpacity
                style={styles.dateBtn}
                onPress={() => setShowStartPicker(true)}
              >
                <Text style={styles.dateBtnLabel}>Start</Text>
                <Text style={styles.dateBtnValue}>
                  {customStartDate.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </Text>
              </TouchableOpacity>

              <Ionicons name="arrow-forward" size={20} color="#71717A" />

              <TouchableOpacity
                style={styles.dateBtn}
                onPress={() => setShowEndPicker(true)}
              >
                <Text style={styles.dateBtnLabel}>End</Text>
                <Text style={styles.dateBtnValue}>
                  {customEndDate.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Categories Filter */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <Text style={styles.sectionSubtitle}>
              {selectedCategories.length === 0
                ? "All"
                : `${selectedCategories.length} selected`}
            </Text>
          </View>

          <View style={styles.chipContainer}>
            {FAMILY_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.chip,
                  selectedCategories.includes(cat.id) && styles.chipActive,
                ]}
                onPress={() => toggleCategory(cat.id)}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    selectedCategories.includes(cat.id) &&
                      styles.chipLabelActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Members Filter */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members</Text>
            <Text style={styles.sectionSubtitle}>
              {selectedMembers.length === 0
                ? "All"
                : `${selectedMembers.length} selected`}
            </Text>
          </View>

          <View style={styles.chipContainer}>
            {members.map((member) => (
              <TouchableOpacity
                key={member.userId}
                style={[
                  styles.chip,
                  selectedMembers.includes(member.userId) && styles.chipActive,
                ]}
                onPress={() => toggleMember(member.userId)}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    selectedMembers.includes(member.userId) &&
                      styles.chipLabelActive,
                  ]}
                >
                  {member.displayName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Format */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export Format</Text>
          {["CSV", "PDF"].map((fmt) => (
            <TouchableOpacity
              key={fmt}
              style={[styles.option, format === fmt && styles.optionActive]}
              onPress={() => setFormat(fmt)}
            >
              <View style={styles.optionLeft}>
                <Ionicons
                  name={fmt === "CSV" ? "document-text" : "document"}
                  size={20}
                  color={format === fmt ? "#134E4A" : "#71717A"}
                />
                <View style={{ marginLeft: 12 }}>
                  <Text
                    style={[
                      styles.optionLabel,
                      format === fmt && styles.optionLabelActive,
                    ]}
                  >
                    {fmt === "CSV" ? "CSV File" : "PDF Report"}
                  </Text>
                  <Text style={styles.optionDesc}>
                    {fmt === "CSV"
                      ? "For Excel/Google Sheets"
                      : "Formatted document with charts"}
                  </Text>
                </View>
              </View>
              {format === fmt && (
                <Ionicons name="checkmark-circle" size={20} color="#134E4A" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color="#134E4A"
          />
          <Text style={styles.infoText}>
            {format === "CSV"
              ? "CSV files can be imported into Excel, Google Sheets, or any spreadsheet application."
              : "PDF report can be opened in any browser and saved as PDF (Print → Save as PDF)."}
          </Text>
        </View>
      </ScrollView>

      {/* Export Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
          onPress={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="download" size={22} color="#FFFFFF" />
              <Text style={styles.exportBtnText}>Export {format}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Date Pickers */}
      {showStartPicker && (
        <DateTimePicker
          value={customStartDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedDate) => {
            setShowStartPicker(Platform.OS === "ios");
            if (selectedDate) setCustomStartDate(selectedDate);
          }}
          maximumDate={customEndDate}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={customEndDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedDate) => {
            setShowEndPicker(Platform.OS === "ios");
            if (selectedDate) setCustomEndDate(selectedDate);
          }}
          minimumDate={customStartDate}
          maximumDate={new Date()}
        />
      )}

      {/* Export Options Modal */}
      {showOptions && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="checkmark-circle" size={48} color="#047857" />
              <Text style={styles.modalTitle}>Export Successful!</Text>
              <Text style={styles.modalSubtitle}>{exportedFile?.fileName}</Text>
            </View>

            {/* File Location Info */}
            <View style={styles.fileLocationCard}>
              <Ionicons name="location-outline" size={16} color="#71717A" />
              <Text style={styles.fileLocationLabel}>Saved to:</Text>
              <Text style={styles.fileLocationPath} numberOfLines={2}>
                {exportedFile?.fileUri?.replace("file://", "") ||
                  "Unknown location"}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalActionBtn}
                onPress={handleShare}
              >
                <View
                  style={[
                    styles.modalActionIcon,
                    { backgroundColor: "#E6F2F0" },
                  ]}
                >
                  <Ionicons name="share-outline" size={24} color="#134E4A" />
                </View>
                <Text style={styles.modalActionText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalActionBtn}
                onPress={handleOpenLocation}
              >
                <View
                  style={[
                    styles.modalActionIcon,
                    { backgroundColor: "#DBEAFE" },
                  ]}
                >
                  <Ionicons
                    name="folder-open-outline"
                    size={24}
                    color="#3B82F6"
                  />
                </View>
                <Text style={styles.modalActionText}>Open</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalActionBtn}
                onPress={closeOptions}
              >
                <View
                  style={[
                    styles.modalActionIcon,
                    { backgroundColor: "#ECEAE4" },
                  ]}
                >
                  <Ionicons name="close-outline" size={24} color="#71717A" />
                </View>
                <Text style={styles.modalActionText}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalInfo}>
              {format === "CSV"
                ? "CSV file can be opened in Excel, Google Sheets, or any spreadsheet app."
                : "HTML file can be opened in a browser and saved as PDF (Print → Save as PDF)."}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F6F2",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#ECEAE4",
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F7F6F2",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: "#18181B",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Manrope_700Bold',
    color: "#18181B",
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#71717A",
    fontFamily: 'Manrope_600SemiBold',
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#ECEAE4",
  },
  optionActive: {
    backgroundColor: "#E6F2F0",
    borderColor: "#134E4A",
    borderWidth: 2,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontFamily: 'Manrope_600SemiBold',
    color: "#18181B",
  },
  optionLabelActive: {
    color: "#134E4A",
  },
  optionDesc: {
    fontSize: 12,
    color: "#71717A",
    marginTop: 2,
  },
  customDateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  dateBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E2DC",
  },
  dateBtnLabel: {
    fontSize: 11,
    color: "#71717A",
    fontFamily: 'Manrope_600SemiBold',
    marginBottom: 4,
  },
  dateBtnValue: {
    fontSize: 14,
    fontFamily: 'Manrope_700Bold',
    color: "#18181B",
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E2DC",
  },
  chipActive: {
    backgroundColor: "#134E4A",
    borderColor: "#134E4A",
  },
  chipLabel: {
    fontSize: 13,
    fontFamily: 'Manrope_600SemiBold',
    color: "#71717A",
  },
  chipLabelActive: {
    color: "#FFFFFF",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#E6F2F0",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: "#134E4A",
    lineHeight: 16,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#ECEAE4",
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#134E4A",
    height: 56,
    borderRadius: 16,
    gap: 10,
    shadowColor: "#134E4A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  exportBtnDisabled: {
    backgroundColor: "#CBD5E1",
    shadowOpacity: 0,
    elevation: 0,
  },
  exportBtnText: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: "#FFFFFF",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "85%",
    maxWidth: 400,
    alignItems: "center",
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Manrope_700Bold',
    color: "#18181B",
    marginTop: 12,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#71717A",
    marginTop: 4,
    textAlign: "center",
  },
  fileLocationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F7F6F2",
    borderRadius: 12,
    padding: 12,
    width: "100%",
    marginBottom: 16,
    gap: 8,
  },
  fileLocationLabel: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
    color: "#71717A",
    flex: 1,
  },
  fileLocationPath: {
    fontSize: 11,
    color: "#71717A",
    flex: 3,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 16,
  },
  modalActionBtn: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 4,
  },
  modalActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  modalActionText: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
    color: "#18181B",
  },
  modalInfo: {
    fontSize: 12,
    color: "#71717A",
    textAlign: "center",
    lineHeight: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#ECEAE4",
    width: "100%",
  },
});

export default ExportExpensesScreen;
