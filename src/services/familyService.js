import NetInfo from '@react-native-community/netinfo';
import {
    collection,
    doc,
    getDoc,
    serverTimestamp,
    Timestamp,
    updateDoc,
    writeBatch
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { FAMILY_ROLES } from '../constants/familyRoles';
import { generateFamilyCode } from '../utils/familyCodeGenerator';

const getUserId = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
};

const isOnline = async () => {
  const state = await NetInfo.fetch();
  return state.isConnected && state.isInternetReachable !== false;
};

// ============ CREATE FAMILY ============
export const createFamily = async (familyName) => {
  try {
    const userId = getUserId();
    const online = await isOnline();

    if (!online) {
      return { success: false, error: 'You must be online to create a family' };
    }

    const user = auth.currentUser;
    const inviteCode = generateFamilyCode();

    // Check if user is already in a family
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists() && userDoc.data().familyId) {
      return { success: false, error: 'You are already in a family. Leave first to create a new one.' };
    }

    const batch = writeBatch(db);
    const familyRef = doc(collection(db, 'families'));
    const now = Timestamp.now();

    const familyData = {
      name: familyName.trim(),
      inviteCode,
      ownerId: userId,
      coAdminId: null,
      memberCount: 1,
      members: [
        {
          userId,
          displayName: user.displayName || 'User',
          photoURL: user.photoURL || null,
          role: FAMILY_ROLES.OWNER,
          joinedAt: now,
        },
      ],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    batch.set(familyRef, familyData);

    // Create invite code mapping
    batch.set(doc(db, 'familyCodes', inviteCode), {
      familyId: familyRef.id,
      createdAt: serverTimestamp(),
    });

    // Update user document
    batch.update(doc(db, 'users', userId), {
      familyId: familyRef.id,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    console.log('✅ Family created:', familyRef.id, inviteCode);
    return { success: true, familyId: familyRef.id, inviteCode };
  } catch (error) {
    console.log('❌ Create family error:', error);
    return { success: false, error: error.message };
  }
};

// ============ GET FAMILY BY CODE ============
export const getFamilyByCode = async (inviteCode) => {
  try {
    const codeDoc = await getDoc(doc(db, 'familyCodes', inviteCode));
    if (!codeDoc.exists()) {
      return { success: false, error: 'Invalid invite code' };
    }

    const familyId = codeDoc.data().familyId;
    const familyDoc = await getDoc(doc(db, 'families', familyId));

    if (!familyDoc.exists()) {
      return { success: false, error: 'Family not found' };
    }

    return { success: true, family: { id: familyDoc.id, ...familyDoc.data() } };
  } catch (error) {
    console.log('❌ Get family by code error:', error);
    return { success: false, error: error.message };
  }
};

// ============ JOIN FAMILY ============
export const joinFamily = async (inviteCode) => {
  try {
    const userId = getUserId();
    const online = await isOnline();

    if (!online) {
      return { success: false, error: 'You must be online to join a family' };
    }

    const user = auth.currentUser;

    // Check if already in a family
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists() && userDoc.data().familyId) {
      return { success: false, error: 'You are already in a family. Leave first to join another.' };
    }

    // Get family by code
    const familyResult = await getFamilyByCode(inviteCode);
    if (!familyResult.success) {
      return familyResult;
    }

    const family = familyResult.family;

    // Check if family is full
    if (family.memberCount >= 6) {
      return { success: false, error: 'This family has reached its member limit (6/6)' };
    }

    // Check if user is already a member
    if (family.members.some((m) => m.userId === userId)) {
      return { success: false, error: 'You are already a member of this family' };
    }

    const batch = writeBatch(db);
    const familyRef = doc(db, 'families', family.id);

    const newMember = {
      userId,
      displayName: user.displayName || 'User',
      photoURL: user.photoURL || null,
      role: FAMILY_ROLES.MEMBER,
      joinedAt: Timestamp.now(),
    };

    // Auto-promote first joiner to Co-Admin
    if (family.memberCount === 1 && !family.coAdminId) {
      newMember.role = FAMILY_ROLES.COADMIN;
      batch.update(familyRef, {
        coAdminId: userId,
        memberCount: family.memberCount + 1,
        members: [...family.members, newMember],
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(familyRef, {
        memberCount: family.memberCount + 1,
        members: [...family.members, newMember],
        updatedAt: serverTimestamp(),
      });
    }

    // Update user document
    batch.update(doc(db, 'users', userId), {
      familyId: family.id,
      updatedAt: serverTimestamp(),
    });

    // Create notifications for all existing members
    family.members.forEach((member) => {
      const notificationRef = doc(collection(db, 'users', member.userId, 'notifications'));
      batch.set(notificationRef, {
        type: 'FAMILY_JOIN',
        title: `${user.displayName || 'Someone'} joined the family`,
        body: `Your family now has ${family.memberCount + 1} members`,
        familyId: family.id,
        read: false,
        createdAt: serverTimestamp(),
        actionRoute: 'Family',
      });
    });

    await batch.commit();

    console.log('✅ Joined family:', family.id);
    return { success: true, familyId: family.id, role: newMember.role };
  } catch (error) {
    console.log('❌ Join family error:', error);
    return { success: false, error: error.message };
  }
};

// ============ GET FAMILY ============
export const getFamily = async (familyId) => {
  try {
    if (!familyId) return { success: false, error: 'No family ID provided' };

    const familyDoc = await getDoc(doc(db, 'families', familyId));
    if (!familyDoc.exists()) {
      return { success: false, error: 'Family not found' };
    }

    return { success: true, family: { id: familyDoc.id, ...familyDoc.data() } };
  } catch (error) {
    console.log('❌ Get family error:', error);
    return { success: false, error: error.message };
  }
};

// ============ LEAVE FAMILY ============
export const leaveFamily = async () => {
  try {
    const userId = getUserId();
    const online = await isOnline();

    if (!online) {
      return { success: false, error: 'You must be online to leave a family' };
    }

    const userDoc = await getDoc(doc(db, 'users', userId));
    const familyId = userDoc.data()?.familyId;

    if (!familyId) {
      return { success: false, error: 'You are not in a family' };
    }

    const familyDoc = await getDoc(doc(db, 'families', familyId));
    if (!familyDoc.exists()) {
      return { success: false, error: 'Family not found' };
    }

    const family = familyDoc.data();
    const isOwner = family.ownerId === userId;
    const isCoAdmin = family.coAdminId === userId;

    const batch = writeBatch(db);
    const familyRef = doc(db, 'families', familyId);

    // Remove member from array
    const updatedMembers = family.members.filter((m) => m.userId !== userId);

    if (isOwner) {
      // ===== OWNERSHIP TRANSFER LOGIC =====
      if (updatedMembers.length === 0) {
        // Last member leaving → delete family
        batch.delete(familyRef);
        batch.delete(doc(db, 'familyCodes', family.inviteCode));
        console.log('🗑️ Last member left — family deleted');
      } else {
        // Transfer ownership
        let newOwnerId = family.coAdminId; // First priority: Co-Admin
        let newCoAdminId = null;

        if (!newOwnerId) {
          // No Co-Admin → oldest member becomes owner
          const sortedMembers = [...updatedMembers].sort(
            (a, b) => (a.joinedAt?.toMillis?.() || 0) - (b.joinedAt?.toMillis?.() || 0)
          );
          newOwnerId = sortedMembers[0].userId;
        }

        // Update roles in members array
        const finalMembers = updatedMembers.map((m) => ({
          ...m,
          role: m.userId === newOwnerId ? FAMILY_ROLES.OWNER : m.role,
        }));

        batch.update(familyRef, {
          ownerId: newOwnerId,
          coAdminId: newCoAdminId,
          members: finalMembers,
          memberCount: updatedMembers.length,
          updatedAt: serverTimestamp(),
        });

        // Notify new owner
        const notificationRef = doc(collection(db, 'users', newOwnerId, 'notifications'));
        batch.set(notificationRef, {
          type: 'OWNERSHIP_TRANSFER',
          title: 'You are now the family owner',
          body: `${auth.currentUser.displayName || 'Previous owner'} left the family`,
          familyId,
          read: false,
          createdAt: serverTimestamp(),
        });

        console.log('👑 Ownership transferred to:', newOwnerId);
      }
    } else {
      // Regular member or Co-Admin leaving
      const updates = {
        members: updatedMembers,
        memberCount: updatedMembers.length,
        updatedAt: serverTimestamp(),
      };

      if (isCoAdmin) {
        updates.coAdminId = null;
      }

      batch.update(familyRef, updates);
    }

    // Update user document
    batch.update(doc(db, 'users', userId), {
      familyId: null,
      updatedAt: serverTimestamp(),
    });

    // Notify remaining members
    if (updatedMembers.length > 0) {
      updatedMembers.forEach((member) => {
        const notificationRef = doc(collection(db, 'users', member.userId, 'notifications'));
        batch.set(notificationRef, {
          type: 'FAMILY_LEAVE',
          title: `${auth.currentUser.displayName || 'Someone'} left the family`,
          body: `Your family now has ${updatedMembers.length} members`,
          familyId,
          read: false,
          createdAt: serverTimestamp(),
        });
      });
    }

    await batch.commit();

    console.log('✅ Left family:', familyId);
    return { success: true };
  } catch (error) {
    console.log('❌ Leave family error:', error);
    return { success: false, error: error.message };
  }
};

// ============ DELETE FAMILY (Owner Only) ============
export const deleteFamily = async () => {
  try {
    const userId = getUserId();
    const online = await isOnline();

    if (!online) {
      return { success: false, error: 'You must be online to delete a family' };
    }

    const userDoc = await getDoc(doc(db, 'users', userId));
    const familyId = userDoc.data()?.familyId;

    if (!familyId) {
      return { success: false, error: 'You are not in a family' };
    }

    const familyDoc = await getDoc(doc(db, 'families', familyId));
    if (!familyDoc.exists()) {
      return { success: false, error: 'Family not found' };
    }

    const family = familyDoc.data();

    if (family.ownerId !== userId) {
      return { success: false, error: 'Only the owner can delete the family' };
    }

    const batch = writeBatch(db);

    // Delete family document
    batch.delete(doc(db, 'families', familyId));

    // Delete invite code
    batch.delete(doc(db, 'familyCodes', family.inviteCode));

    // Remove familyId from all members
    family.members.forEach((member) => {
      batch.update(doc(db, 'users', member.userId), {
        familyId: null,
        updatedAt: serverTimestamp(),
      });

      // Notify members
      if (member.userId !== userId) {
        const notificationRef = doc(collection(db, 'users', member.userId, 'notifications'));
        batch.set(notificationRef, {
          type: 'FAMILY_DELETED',
          title: 'Family deleted',
          body: `${family.name} was deleted by the owner`,
          familyId: null,
          read: false,
          createdAt: serverTimestamp(),
        });
      }
    });

    await batch.commit();

    console.log('🗑️ Family deleted:', familyId);
    return { success: true };
  } catch (error) {
    console.log('❌ Delete family error:', error);
    return { success: false, error: error.message };
  }
};

// ============ REMOVE MEMBER (Owner/Co-Admin Only) ============
export const removeMember = async (memberUserId) => {
  try {
    const userId = getUserId();
    const online = await isOnline();

    if (!online) {
      return { success: false, error: 'You must be online to remove members' };
    }

    const userDoc = await getDoc(doc(db, 'users', userId));
    const familyId = userDoc.data()?.familyId;

    if (!familyId) {
      return { success: false, error: 'You are not in a family' };
    }

    const familyDoc = await getDoc(doc(db, 'families', familyId));
    const family = familyDoc.data();

    // Check permissions
    const isOwner = family.ownerId === userId;
    const isCoAdmin = family.coAdminId === userId;

    if (!isOwner && !isCoAdmin) {
      return { success: false, error: 'Only owner or co-admin can remove members' };
    }

    // Cannot remove owner
    if (memberUserId === family.ownerId) {
      return { success: false, error: 'Cannot remove the owner' };
    }

    // Co-Admin cannot remove Co-Admin
    if (isCoAdmin && memberUserId === family.coAdminId) {
      return { success: false, error: 'Co-Admin cannot remove another Co-Admin' };
    }

    const batch = writeBatch(db);
    const familyRef = doc(db, 'families', familyId);

    const updatedMembers = family.members.filter((m) => m.userId !== memberUserId);
    const removedMember = family.members.find((m) => m.userId === memberUserId);

    const updates = {
      members: updatedMembers,
      memberCount: updatedMembers.length,
      updatedAt: serverTimestamp(),
    };

    // If removing Co-Admin, clear coAdminId
    if (memberUserId === family.coAdminId) {
      updates.coAdminId = null;
    }

    batch.update(familyRef, updates);

    // Update removed user's document
    batch.update(doc(db, 'users', memberUserId), {
      familyId: null,
      updatedAt: serverTimestamp(),
    });

    // Notify removed user
    const removedNotificationRef = doc(collection(db, 'users', memberUserId, 'notifications'));
    batch.set(removedNotificationRef, {
      type: 'REMOVED_FROM_FAMILY',
      title: 'Removed from family',
      body: `You were removed from ${family.name}`,
      familyId: null,
      read: false,
      createdAt: serverTimestamp(),
    });

    // Notify remaining members
    updatedMembers.forEach((member) => {
      const notificationRef = doc(collection(db, 'users', member.userId, 'notifications'));
      batch.set(notificationRef, {
        type: 'MEMBER_REMOVED',
        title: 'Member removed',
        body: `${removedMember.displayName} was removed from the family`,
        familyId,
        read: false,
        createdAt: serverTimestamp(),
      });
    });

    await batch.commit();

    console.log('✅ Member removed:', memberUserId);
    return { success: true };
  } catch (error) {
    console.log('❌ Remove member error:', error);
    return { success: false, error: error.message };
  }
};

// ============ PROMOTE TO CO-ADMIN (Owner Only) ============
export const promoteToCoAdmin = async (memberUserId) => {
  try {
    const userId = getUserId();
    const online = await isOnline();

    if (!online) {
      return { success: false, error: 'You must be online to manage roles' };
    }

    const userDoc = await getDoc(doc(db, 'users', userId));
    const familyId = userDoc.data()?.familyId;

    const familyDoc = await getDoc(doc(db, 'families', familyId));
    const family = familyDoc.data();

    if (family.ownerId !== userId) {
      return { success: false, error: 'Only the owner can promote members' };
    }

    const batch = writeBatch(db);
    const familyRef = doc(db, 'families', familyId);

    // Update roles in members array
    const updatedMembers = family.members.map((m) => {
      if (m.userId === memberUserId) {
        return { ...m, role: FAMILY_ROLES.COADMIN };
      }
      if (m.userId === family.coAdminId) {
        return { ...m, role: FAMILY_ROLES.MEMBER }; // Demote old co-admin
      }
      return m;
    });

    batch.update(familyRef, {
      coAdminId: memberUserId,
      members: updatedMembers,
      updatedAt: serverTimestamp(),
    });

    // Notify new co-admin
    const notificationRef = doc(collection(db, 'users', memberUserId, 'notifications'));
    batch.set(notificationRef, {
      type: 'ROLE_CHANGE',
      title: 'You are now Co-Admin',
      body: `You can now manage members in ${family.name}`,
      familyId,
      read: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    console.log('👑 Promoted to Co-Admin:', memberUserId);
    return { success: true };
  } catch (error) {
    console.log('❌ Promote to co-admin error:', error);
    return { success: false, error: error.message };
  }
};

// ============ DEMOTE CO-ADMIN (Owner Only) ============
export const demoteCoAdmin = async () => {
  try {
    const userId = getUserId();
    const online = await isOnline();

    if (!online) {
      return { success: false, error: 'You must be online to manage roles' };
    }

    const userDoc = await getDoc(doc(db, 'users', userId));
    const familyId = userDoc.data()?.familyId;

    const familyDoc = await getDoc(doc(db, 'families', familyId));
    const family = familyDoc.data();

    if (family.ownerId !== userId) {
      return { success: false, error: 'Only the owner can demote co-admin' };
    }

    if (!family.coAdminId) {
      return { success: false, error: 'No co-admin to demote' };
    }

    const batch = writeBatch(db);
    const familyRef = doc(db, 'families', familyId);

    const updatedMembers = family.members.map((m) =>
      m.userId === family.coAdminId ? { ...m, role: FAMILY_ROLES.MEMBER } : m
    );

    batch.update(familyRef, {
      coAdminId: null,
      members: updatedMembers,
      updatedAt: serverTimestamp(),
    });

    // Notify demoted user
    const notificationRef = doc(collection(db, 'users', family.coAdminId, 'notifications'));
    batch.set(notificationRef, {
      type: 'ROLE_CHANGE',
      title: 'Role changed',
      body: 'You are no longer Co-Admin',
      familyId,
      read: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    console.log('📉 Co-Admin demoted');
    return { success: true };
  } catch (error) {
    console.log('❌ Demote co-admin error:', error);
    return { success: false, error: error.message };
  }
};

// ============ REGENERATE INVITE CODE (Owner/Co-Admin) ============
export const regenerateInviteCode = async () => {
  try {
    const userId = getUserId();
    const online = await isOnline();

    if (!online) {
      return { success: false, error: 'You must be online to regenerate code' };
    }

    const userDoc = await getDoc(doc(db, 'users', userId));
    const familyId = userDoc.data()?.familyId;

    const familyDoc = await getDoc(doc(db, 'families', familyId));
    const family = familyDoc.data();

    const isOwner = family.ownerId === userId;
    const isCoAdmin = family.coAdminId === userId;

    if (!isOwner && !isCoAdmin) {
      return { success: false, error: 'Only owner or co-admin can regenerate code' };
    }

    const batch = writeBatch(db);
    const newCode = generateFamilyCode();

    // Delete old code mapping
    batch.delete(doc(db, 'familyCodes', family.inviteCode));

    // Create new code mapping
    batch.set(doc(db, 'familyCodes', newCode), {
      familyId,
      createdAt: serverTimestamp(),
    });

    // Update family
    batch.update(doc(db, 'families', familyId), {
      inviteCode: newCode,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    console.log('🔄 Invite code regenerated:', newCode);
    return { success: true, inviteCode: newCode };
  } catch (error) {
    console.log('❌ Regenerate code error:', error);
    return { success: false, error: error.message };
  }
};

// ============ RENAME FAMILY (Owner Only) ============
export const renameFamily = async (newName) => {
  try {
    const userId = getUserId();
    const online = await isOnline();

    if (!online) {
      return { success: false, error: 'You must be online to rename family' };
    }

    const userDoc = await getDoc(doc(db, 'users', userId));
    const familyId = userDoc.data()?.familyId;

    const familyDoc = await getDoc(doc(db, 'families', familyId));
    const family = familyDoc.data();

    if (family.ownerId !== userId) {
      return { success: false, error: 'Only the owner can rename the family' };
    }

    await updateDoc(doc(db, 'families', familyId), {
      name: newName.trim(),
      updatedAt: serverTimestamp(),
    });

    console.log('✏️ Family renamed to:', newName);
    return { success: true };
  } catch (error) {
    console.log('❌ Rename family error:', error);
    return { success: false, error: error.message };
  }
};

// ============ TRANSFER OWNERSHIP (Owner Only) ============
export const transferOwnership = async (newOwnerId) => {
  try {
    const userId = getUserId();
    const online = await isOnline();

    if (!online) {
      return { success: false, error: 'You must be online to transfer ownership' };
    }

    const userDoc = await getDoc(doc(db, 'users', userId));
    const familyId = userDoc.data()?.familyId;

    const familyDoc = await getDoc(doc(db, 'families', familyId));
    const family = familyDoc.data();

    if (family.ownerId !== userId) {
      return { success: false, error: 'Only the owner can transfer ownership' };
    }

    const batch = writeBatch(db);
    const familyRef = doc(db, 'families', familyId);

    // Update roles
    const updatedMembers = family.members.map((m) => {
      if (m.userId === newOwnerId) {
        return { ...m, role: FAMILY_ROLES.OWNER };
      }
      if (m.userId === userId) {
        return { ...m, role: FAMILY_ROLES.MEMBER };
      }
      return m;
    });

    batch.update(familyRef, {
      ownerId: newOwnerId,
      coAdminId: null, // Clear co-admin on transfer
      members: updatedMembers,
      updatedAt: serverTimestamp(),
    });

    // Notify new owner
    const notificationRef = doc(collection(db, 'users', newOwnerId, 'notifications'));
    batch.set(notificationRef, {
      type: 'OWNERSHIP_TRANSFER',
      title: 'You are now the family owner',
      body: `${auth.currentUser.displayName} transferred ownership to you`,
      familyId,
      read: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    console.log('👑 Ownership transferred to:', newOwnerId);
    return { success: true };
  } catch (error) {
    console.log('❌ Transfer ownership error:', error);
    return { success: false, error: error.message };
  }
};