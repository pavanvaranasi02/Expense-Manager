import { Linking } from "react-native";
import appConfig from "../../app.config";

export const GITHUB_OWNER = "pavanvaranasi02";
export const GITHUB_REPO = "Expense-Manager";

// App version from config or fallback
export const CURRENT_APP_VERSION =
  appConfig?.expo?.version || "1.5.1-beta";

/**
 * Normalizes tags like "expense_manager_v1.1", "v1.4.0", "1.4" into [major, minor, patch]
 */
export const normalizeVersion = (versionStr) => {
  if (!versionStr) return [0, 0, 0];
  const cleaned = versionStr
    .toLowerCase()
    .replace(/^expense_manager_v?/, "")
    .replace(/^v/, "")
    .split("-")[0]; // ignore pre-release suffix for comparison

  const parts = cleaned.split(".").map((p) => parseInt(p, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3);
};

/**
 * Returns:
 *  1 if v1 > v2
 * -1 if v1 < v2
 *  0 if v1 === v2
 */
export const compareVersions = (v1, v2) => {
  const [maj1, min1, pat1] = normalizeVersion(v1);
  const [maj2, min2, pat2] = normalizeVersion(v2);

  if (maj1 !== maj2) return maj1 > maj2 ? 1 : -1;
  if (min1 !== min2) return min1 > min2 ? 1 : -1;
  if (pat1 !== pat2) return pat1 > pat2 ? 1 : -1;
  return 0;
};

/**
 * Checks GitHub for latest releases or tags.
 */
export const checkForGitHubUpdates = async () => {
  try {
    const releasesUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
    const res = await fetch(releasesUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (res.ok) {
      const release = await res.json();
      const latestTag = release.tag_name || release.name || "";
      const hasUpdate = compareVersions(latestTag, CURRENT_APP_VERSION) > 0;

      // Check if an APK asset is attached to this release
      const apkAsset = (release.assets || []).find((a) =>
        a.name?.toLowerCase().endsWith(".apk"),
      );

      return {
        success: true,
        hasUpdate,
        latestTag,
        latestVersion: latestTag,
        currentVersion: CURRENT_APP_VERSION,
        releaseName: release.name || latestTag,
        releaseNotes: release.body || "No changelog provided.",
        publishedAt: release.published_at,
        releaseUrl:
          release.html_url ||
          `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
        apkAsset: apkAsset
          ? {
              name: apkAsset.name,
              downloadUrl: apkAsset.browser_download_url,
              size: apkAsset.size,
            }
          : null,
      };
    }

    // If latest release is 404, fallback to checking tags
    const tagsUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/tags`;
    const tagRes = await fetch(tagsUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (tagRes.ok) {
      const tags = await tagRes.json();
      if (Array.isArray(tags) && tags.length > 0) {
        const latestTag = tags[0].name;
        const hasUpdate = compareVersions(latestTag, CURRENT_APP_VERSION) > 0;
        return {
          success: true,
          hasUpdate,
          latestTag,
          latestVersion: latestTag,
          currentVersion: CURRENT_APP_VERSION,
          releaseName: latestTag,
          releaseNotes: `New release tag ${latestTag} is available on GitHub.`,
          releaseUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/${latestTag}`,
          apkAsset: null,
        };
      }
    }

    // If repo is private or no releases published yet
    return {
      success: false,
      isNotFoundOrPrivate: true,
      currentVersion: CURRENT_APP_VERSION,
      releaseUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
      message:
        "No public releases found yet on GitHub, or repository requires authentication.",
    };
  } catch (error) {
    console.log("Check for updates error:", error);
    return {
      success: false,
      error: error.message,
      currentVersion: CURRENT_APP_VERSION,
      releaseUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
    };
  }
};

/**
 * Opens the download link or GitHub release page in browser
 */
export const openUpdateRelease = async (updateInfo) => {
  const url =
    updateInfo?.apkAsset?.downloadUrl ||
    updateInfo?.releaseUrl ||
    `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
    return true;
  }
  return false;
};
