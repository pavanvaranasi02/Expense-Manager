import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import NotificationItem from "../../components/Notifications/NotificationItem";
import { Analytics } from "../../config/firebase";
import {
  deleteNotification,
  getNotifications,
  markAllAsRead,
  markAsRead,
} from "../../services/notificationService";
import useNotificationStore from "../../store/useNotificationStore";

const NotificationsScreen = ({ navigation }) => {
  const {
    notifications,
    setNotifications,
    setUnreadCount,
    markAsReadInStore,
    markAllAsReadInStore,
    removeNotification,
    clearNotifications,
  } = useNotificationStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      const result = await getNotifications();
      if (result.success) {
        setNotifications(result.notifications);
        setUnreadCount(result.unreadCount);
      }
    } catch (error) {
      console.log("Fetch notifications error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      Analytics.screenView("Notifications");
      fetchNotifications();
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handlePress = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
      markAsReadInStore(notification.id);
    }

    // Navigate based on actionRoute
    switch (notification.actionRoute) {
      case "Family":
        navigation.navigate("Family");
        break;
      case "Budget":
        navigation.navigate("Family", { screen: "FamilyBudget" });
        break;
      case "CreditCardBill":
        navigation.navigate("Wealth", { screen: "CreditCardBill" });
        break;
      case "Portfolio":
        navigation.navigate("Wealth", { screen: "Portfolio" });
        break;
      case "FamilyTemplates":
        navigation.navigate("Family", { screen: "FamilyTemplates" });
        break;
      default:
        // No specific route
        break;
    }
  };

  const handleDelete = async (notificationId) => {
    await deleteNotification(notificationId);
    removeNotification(notificationId);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    markAllAsReadInStore();
  };

  const handleClearAll = async () => {
    // Only clear non-persistent notifications
    const persistentIds = notifications
      .filter((n) => n.persistent)
      .map((n) => n.id);

    // Delete non-persistent notifications
    const nonPersistent = notifications.filter((n) => !n.persistent);
    for (const notification of nonPersistent) {
      await deleteNotification(notification.id);
      removeNotification(notification.id);
    }
  };

  const unreadNotifications = notifications.filter((n) => !n.read);
  const readNotifications = notifications.filter((n) => n.read);

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
          <Text style={styles.headerTitle}>Notifications</Text>
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
        <Text style={styles.headerTitle}>Notifications</Text>
        {notifications.some((n) => !n.persistent) && (
          <TouchableOpacity style={styles.menuBtn} onPress={handleClearAll}>
            <Ionicons name="trash-outline" size={20} color="#B91C1C" />
          </TouchableOpacity>
        )}
        {!notifications.some((n) => !n.persistent) && (
          <View style={{ width: 44 }} />
        )}
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="notifications-off-outline"
              size={64}
              color="#CBD5E1"
            />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>
            We'll notify you about family activities, budget alerts, SIP/RD
            payments, and more.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#134E4A"]}
            />
          }
        >
          {/* Unread Section */}
          {unreadNotifications.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>New</Text>
                <TouchableOpacity onPress={handleMarkAllRead}>
                  <Text style={styles.markAllRead}>Mark all read</Text>
                </TouchableOpacity>
              </View>
              {unreadNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onPress={() => handlePress(notification)}
                  onDelete={() => handleDelete(notification.id)}
                  showDelete={!notification.persistent}
                />
              ))}
            </View>
          )}

          {/* Read Section */}
          {readNotifications.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Earlier</Text>
              {readNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onPress={() => handlePress(notification)}
                  onDelete={() => handleDelete(notification.id)}
                  showDelete={!notification.persistent}
                />
              ))}
            </View>
          )}
        </ScrollView>
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
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: "#18181B",
  },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
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
    lineHeight: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
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
    fontSize: 14,
    fontFamily: 'Manrope_700Bold',
    color: "#71717A",
    textTransform: "uppercase",
  },
  markAllRead: {
    fontSize: 13,
    fontFamily: 'Manrope_600SemiBold',
    color: "#134E4A",
  },
});

export default NotificationsScreen;
