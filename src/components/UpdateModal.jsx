import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { openUpdateRelease } from "../services/updateService";

const UpdateModal = ({ visible, updateInfo, onClose }) => {
  if (!updateInfo) return null;

  const {
    hasUpdate,
    latestTag,
    currentVersion,
    releaseName,
    releaseNotes,
    publishedAt,
    apkAsset,
    isNotFoundOrPrivate,
  } = updateInfo;

  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formattedDate = publishedAt
    ? new Date(publishedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.handleBar} />

          {/* Icon Badge */}
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: hasUpdate
                  ? "#EEF2FF"
                  : isNotFoundOrPrivate
                    ? "#FFFBEB"
                    : "#F0FDF4",
              },
            ]}
          >
            <Ionicons
              name={
                hasUpdate
                  ? "rocket-outline"
                  : isNotFoundOrPrivate
                    ? "shield-outline"
                    : "checkmark-circle-outline"
              }
              size={32}
              color={
                hasUpdate
                  ? "#4F46E5"
                  : isNotFoundOrPrivate
                    ? "#D97706"
                    : "#10B981"
              }
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {hasUpdate
              ? "New Version Available!"
              : isNotFoundOrPrivate
                ? "Repository Status"
                : "You're Up to Date!"}
          </Text>

          <Text style={styles.subTitle}>
            {hasUpdate
              ? `A newer release (${latestTag}) was found on GitHub.`
              : isNotFoundOrPrivate
                ? "No public releases found or repository is private."
                : `You are currently using the latest version (${currentVersion}).`}
          </Text>

          {/* Version Pills */}
          <View style={styles.versionRow}>
            <View style={styles.versionPill}>
              <Text style={styles.versionLabel}>Installed</Text>
              <Text style={styles.versionValue}>v{currentVersion}</Text>
            </View>

            {hasUpdate && (
              <>
                <Ionicons name="arrow-forward" size={16} color="#94A3B8" />
                <View style={[styles.versionPill, styles.versionPillHighlight]}>
                  <Text style={[styles.versionLabel, { color: "#4F46E5" }]}>
                    Latest
                  </Text>
                  <Text style={[styles.versionValue, { color: "#4F46E5" }]}>
                    {latestTag}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Release Notes / Details (if update available) */}
          {hasUpdate && (
            <View style={styles.notesContainer}>
              <View style={styles.notesHeader}>
                <Text style={styles.notesTitle} numberOfLines={1}>
                  {releaseName || "What's New"}
                </Text>
                {formattedDate && (
                  <Text style={styles.notesDate}>{formattedDate}</Text>
                )}
              </View>

              <ScrollView
                style={styles.notesScroll}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.notesBody}>{releaseNotes}</Text>
              </ScrollView>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsBox}>
            {hasUpdate ? (
              <>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    openUpdateRelease(updateInfo);
                    onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={apkAsset ? "download-outline" : "open-outline"}
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.primaryBtnText}>
                    {apkAsset
                      ? `Download APK (${formatFileSize(apkAsset.size)})`
                      : "Download from GitHub"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => {
                    openUpdateRelease({
                      releaseUrl: updateInfo.releaseUrl,
                    });
                    onClose();
                  }}
                >
                  <Ionicons name="logo-github" size={16} color="#334155" />
                  <Text style={styles.secondaryBtnText}>
                    View Release on GitHub
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.closeTextBtn} onPress={onClose}>
                  <Text style={styles.closeText}>Maybe Later</Text>
                </TouchableOpacity>
              </>
            ) : isNotFoundOrPrivate ? (
              <>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    openUpdateRelease(updateInfo);
                    onClose();
                  }}
                >
                  <Ionicons name="logo-github" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>
                    Open GitHub Releases
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
                  <Text style={styles.secondaryBtnText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.primaryBtn} onPress={onClose}>
                <Text style={styles.primaryBtnText}>Got It</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    alignItems: "center",
    maxHeight: "85%",
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },
  subTitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 12,
    lineHeight: 18,
  },
  versionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 16,
  },
  versionPill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
  },
  versionPillHighlight: {
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  versionLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  versionValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 1,
  },
  notesContainer: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  notesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 6,
  },
  notesTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
  },
  notesDate: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
    marginLeft: 8,
  },
  notesScroll: {
    maxHeight: 120,
  },
  notesBody: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
  },
  actionsBox: {
    width: "100%",
    gap: 10,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4F46E5",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    elevation: 2,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  secondaryBtnText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
  },
  closeTextBtn: {
    paddingVertical: 8,
    alignItems: "center",
  },
  closeText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
});

export default UpdateModal;
