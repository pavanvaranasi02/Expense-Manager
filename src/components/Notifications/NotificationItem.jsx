import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const getNotificationIcon = (type) => {
  switch (type) {
    case "FAMILY_JOIN":
      return { name: "person-add", color: "#047857", bg: "#D1FAE5" };
    case "FAMILY_LEAVE":
      return { name: "person-remove", color: "#F59E0B", bg: "#FEF3C7" };
    case "OWNERSHIP_TRANSFER":
      return { name: "star", color: "#134E4A", bg: "#E6F2F0" };
    case "ROLE_CHANGE":
      return { name: "shield-checkmark", color: "#3B82F6", bg: "#DBEAFE" };
    case "REMOVED_FROM_FAMILY":
      return { name: "close-circle", color: "#B91C1C", bg: "#FEE2E2" };
    case "FAMILY_DELETED":
      return { name: "trash", color: "#B91C1C", bg: "#FEE2E2" };
    case "MEMBER_REMOVED":
      return { name: "person-remove", color: "#B91C1C", bg: "#FEE2E2" };
    // Budget alerts
    case "BUDGET_EXCEEDED":
      return { name: "alert-circle", color: "#B91C1C", bg: "#FEE2E2" };
    case "BUDGET_WARNING":
      return { name: "warning", color: "#F59E0B", bg: "#FEF3C7" };
    case "BUDGET_INFO_50":
      return { name: "information-circle", color: "#3B82F6", bg: "#DBEAFE" };
    case "BUDGET_WARNING_80":
      return { name: "warning", color: "#F59E0B", bg: "#FEF3C7" };
    case "BUDGET_DANGER":
      return { name: "alert-circle", color: "#B91C1C", bg: "#FEE2E2" };
    // Credit card alerts
    case "CREDIT_CARD_DUE":
      return { name: "card", color: "#F59E0B", bg: "#FEF3C7" };
    case "CREDIT_CARD_URGENT":
      return { name: "alert-circle", color: "#B91C1C", bg: "#FEE2E2" };
    // Investment alerts
    case "SIP_DUE":
      return { name: "trending-up", color: "#134E4A", bg: "#E6F2F0" };
    case "RD_DUE":
      return { name: "refresh", color: "#14B8A6", bg: "#F0FDFA" };
    // Recurring expenses
    case "RECURRING_EXPENSE_DUE":
      return { name: "repeat", color: "#3B82F6", bg: "#DBEAFE" };
    default:
      return { name: "notifications", color: "#71717A", bg: "#ECEAE4" };
  }
};

const formatTime = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const NotificationItem = ({
  notification,
  onPress,
  onDelete,
  showDelete = true,
}) => {
  const { type, title, body, read, createdAt, persistent } = notification;
  const icon = getNotificationIcon(type);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        !read && styles.unread,
        persistent && styles.persistent,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: icon.bg }]}>
        <Ionicons name={icon.name} size={20} color={icon.color} />
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, !read && styles.unreadText]}>
            {title}
          </Text>
          {persistent && (
            <View style={styles.persistentBadge}>
              <Ionicons name="pin" size={10} color="#134E4A" />
            </View>
          )}
        </View>
        {body && (
          <Text style={styles.body} numberOfLines={2}>
            {body}
          </Text>
        )}
        <Text style={styles.time}>{formatTime(createdAt)}</Text>
      </View>

      {!read && <View style={styles.unreadDot} />}

      {onDelete && showDelete && !persistent && (
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={onDelete}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={16} color="#71717A" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ECEAE4",
  },
  unread: {
    backgroundColor: "#FAFAFE",
    borderColor: "#E5E2DC",
  },
  persistent: {
    backgroundColor: "#FAFAFE",
    borderColor: "#134E4A",
    borderWidth: 1.5,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  persistentBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#E6F2F0",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: "#18181B",
  },
  unreadText: {
    fontFamily: 'Manrope_700Bold',
  },
  body: {
    fontSize: 13,
    color: "#71717A",
    marginTop: 2,
    lineHeight: 18,
  },
  time: {
    fontSize: 11,
    color: "#71717A",
    marginTop: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#134E4A",
    marginLeft: 8,
    marginTop: 4,
  },
  deleteBtn: {
    marginLeft: 8,
    padding: 4,
  },
});

export default NotificationItem;
