import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { Analytics } from "../../config/firebase";
import {
  deleteFamilyTemplate,
  getFamilyTemplates,
  processDueTemplates,
  updateFamilyTemplate,
} from "../../services/familyTemplateService";
import useFamilyStore from "../../store/useFamilyStore";

const FamilyTemplatesScreen = ({ navigation }) => {
  const { family, canManageMembers } = useFamilyStore();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const result = await getFamilyTemplates(family.id);

      if (result.success) {
        setTemplates(result.templates);
      }
    } catch (error) {
      console.log("Fetch templates error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      Analytics.screenView("FamilyTemplates");
      if (family?.id) fetchTemplates();
    }, [family?.id]),
  );

  const handleManualProcess = async () => {
    setProcessing(true);
    const result = await processDueTemplates(family.id);
    setProcessing(false);

    if (result.success) {
      if (result.processed > 0) {
        Toast.show({
          type: "success",
          text1: "Templates Processed",
          text2: `Generated ${result.processed} expenses`,
        });
        fetchTemplates(); // Refresh list
      } else {
        Toast.show({
          type: "info",
          text1: "Up to Date",
          text2: "No templates are currently due",
        });
      }
    }
  };

  const toggleStatus = async (template) => {
    const newStatus = !template.isActive;

    // Optimistic update
    setTemplates(
      templates.map((t) =>
        t.id === template.id ? { ...t, isActive: newStatus } : t,
      ),
    );

    const result = await updateFamilyTemplate(family.id, template.id, {
      isActive: newStatus,
    });

    if (!result.success) {
      // Revert on failure
      fetchTemplates();
      Toast.show({
        type: "error",
        text1: "Failed to update",
        text2: result.error,
      });
    }
  };

  const handleDelete = (templateId) => {
    Alert.alert(
      "Delete Template",
      "Are you sure you want to delete this recurring expense template?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const result = await deleteFamilyTemplate(family.id, templateId);

            if (result.success) {
              setTemplates(templates.filter((t) => t.id !== templateId));
              Toast.show({ type: "success", text1: "Template deleted" });
            } else {
              Toast.show({ type: "error", text1: "Failed to delete" });
            }
          },
        },
      ],
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const renderTemplate = ({ item }) => {
    const isDue = item.nextDue && new Date(item.nextDue) <= new Date();

    return (
      <View
        style={[
          styles.templateCard,
          !item.isActive && styles.templateCardInactive,
        ]}
      >
        <View style={styles.templateHeader}>
          <View style={styles.templateTitleRow}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: item.categoryIcon + "15" || "#ECEAE4" },
              ]}
            >
              <Ionicons
                name={item.categoryIcon || "repeat"}
                size={20}
                color="#134E4A"
              />
            </View>
            <View>
              <Text style={styles.templateName}>{item.name}</Text>
              <Text style={styles.templateAmount}>
                ₹{item.amount.toLocaleString("en-IN")}
              </Text>
            </View>
          </View>
          <View style={styles.templateStatus}>
            {isDue && item.isActive && (
              <View style={styles.dueBadge}>
                <Text style={styles.dueText}>DUE NOW</Text>
              </View>
            )}
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                item.isActive ? styles.toggleActive : styles.toggleInactive,
              ]}
              onPress={() => toggleStatus(item)}
            >
              <Text
                style={[
                  styles.toggleText,
                  item.isActive && styles.toggleTextActive,
                ]}
              >
                {item.isActive ? "Active" : "Paused"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.templateDetails}>
          <View style={styles.detailItem}>
            <Ionicons name="repeat-outline" size={14} color="#71717A" />
            <Text style={styles.detailText}>
              {item.recurrence.frequency > 1
                ? `Every ${item.recurrence.frequency} `
                : "Every "}
              {item.recurrence.type.toLowerCase().replace("ly", "s")}
            </Text>
          </View>

          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={14} color="#71717A" />
            <Text
              style={[
                styles.detailText,
                isDue &&
                  item.isActive && { color: "#B91C1C", fontFamily: 'Manrope_600SemiBold' },
              ]}
            >
              Next: {formatDate(item.nextDue)}
            </Text>
          </View>
        </View>

        {canManageMembers() && (
          <View style={styles.templateActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() =>
                navigation.navigate("EditTemplate", { templateId: item.id })
              }
            >
              <Ionicons name="pencil" size={16} color="#71717A" />
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleDelete(item.id)}
            >
              <Ionicons name="trash" size={16} color="#B91C1C" />
              <Text style={[styles.actionText, { color: "#B91C1C" }]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#18181B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recurring Expenses</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#134E4A" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#18181B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recurring Expenses</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate("AddTemplate")}
        >
          <Ionicons name="add" size={24} color="#134E4A" />
        </TouchableOpacity>
      </View>

      {templates.some(
        (t) => t.nextDue && new Date(t.nextDue) <= new Date() && t.isActive,
      ) && (
        <View style={styles.alertBanner}>
          <Ionicons name="information-circle" size={20} color="#F59E0B" />
          <Text style={styles.alertText}>
            Some templates are due. Process them to add to expenses.
          </Text>
          <TouchableOpacity
            style={styles.processBtn}
            onPress={handleManualProcess}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.processText}>Process</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        renderItem={renderTemplate}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchTemplates} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="repeat" size={64} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyTitle}>No recurring expenses</Text>
            <Text style={styles.emptyText}>
              Set up templates for rent, subscriptions, or regular bills to add
              them automatically.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F6F2" },
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
  headerTitle: { fontSize: 18, fontFamily: 'Manrope_700Bold', color: "#18181B" },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#E6F2F0",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    padding: 12,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    gap: 10,
  },
  alertText: { flex: 1, fontSize: 12, color: "#B45309", fontFamily: 'Manrope_500Medium' },
  processBtn: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  processText: { color: "#FFFFFF", fontSize: 12, fontFamily: 'Manrope_700Bold' },
  listContent: { padding: 20 },
  templateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E2DC",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  templateCardInactive: { opacity: 0.6 },
  templateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  templateTitleRow: { flexDirection: "row", alignItems: "center" },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  templateName: { fontSize: 16, fontFamily: 'Manrope_700Bold', color: "#18181B" },
  templateAmount: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: "#134E4A",
    marginTop: 2,
  },
  templateStatus: { alignItems: "flex-end", gap: 6 },
  dueBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dueText: { fontSize: 9, fontFamily: 'Manrope_700Bold', color: "#B91C1C" },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  toggleActive: { backgroundColor: "#E6F2F0", borderColor: "#C7D2FE" },
  toggleInactive: { backgroundColor: "#ECEAE4", borderColor: "#E5E2DC" },
  toggleText: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', color: "#71717A" },
  toggleTextActive: { color: "#134E4A" },
  templateDetails: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#ECEAE4",
    paddingVertical: 12,
    marginBottom: 12,
    gap: 16,
  },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailText: { fontSize: 12, color: "#71717A" },
  templateActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', color: "#71717A" },
  emptyContainer: { alignItems: "center", paddingVertical: 60 },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#ECEAE4",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: "#18181B",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#71717A",
    textAlign: "center",
    paddingHorizontal: 20,
  },
});

export default FamilyTemplatesScreen;
