import NetInfo from '@react-native-community/netinfo';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { addFamilyExpense } from './familyExpenseService';

const getUserId = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
};

const isOnline = async () => {
  const state = await NetInfo.fetch();
  return state.isConnected && state.isInternetReachable !== false;
};

// ============ CALCULATE NEXT DUE DATE ============
export const calculateNextDueDate = (recurrence, lastCreated = null) => {
  const baseDate = lastCreated ? new Date(lastCreated) : new Date(recurrence.startDate);
  const nextDate = new Date(baseDate);

  if (recurrence.type === 'MONTHLY') {
    nextDate.setMonth(nextDate.getMonth() + (recurrence.frequency || 1));
    if (recurrence.dayOfMonth) {
      nextDate.setDate(recurrence.dayOfMonth);
    }
  } else if (recurrence.type === 'WEEKLY') {
    nextDate.setDate(nextDate.getDate() + (7 * (recurrence.frequency || 1)));
    if (recurrence.dayOfWeek !== null) {
      const currentDay = nextDate.getDay();
      const distance = (recurrence.dayOfWeek + 7 - currentDay) % 7;
      nextDate.setDate(nextDate.getDate() + distance);
    }
  } else if (recurrence.type === 'YEARLY') {
    nextDate.setFullYear(nextDate.getFullYear() + (recurrence.frequency || 1));
  }

  // Check end date
  if (recurrence.endDate && nextDate > new Date(recurrence.endDate)) {
    return null;
  }

  return nextDate.toISOString();
};

// ============ CREATE TEMPLATE ============
export const createFamilyTemplate = async (familyId, templateData) => {
  try {
    const userId = getUserId();
    const online = await isOnline();

    if (!online) {
      return { success: false, error: 'You must be online to create templates' };
    }

    const templateRef = doc(collection(db, 'families', familyId, 'templates'));
    
    // Ensure dates are correctly formatted
    const nextDue = calculateNextDueDate(templateData.recurrence, null);

    const data = {
      ...templateData,
      amount: parseFloat(templateData.amount),
      nextDue,
      lastCreated: null,
      isActive: true,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(templateRef, data);

    console.log('✅ Family template created:', templateRef.id);
    return { success: true, templateId: templateRef.id };
  } catch (error) {
    console.log('❌ Create template error:', error);
    return { success: false, error: error.message };
  }
};

// ============ GET TEMPLATES ============
export const getFamilyTemplates = async (familyId) => {
  try {
    const online = await isOnline();

    if (!online) {
      return { success: false, error: 'You must be online to fetch templates' };
    }

    const q = query(
      collection(db, 'families', familyId, 'templates'),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    const templates = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
      };
    });

    return { success: true, templates };
  } catch (error) {
    console.log('❌ Get templates error:', error);
    return { success: false, error: error.message, templates: [] };
  }
};

// ============ UPDATE TEMPLATE ============
export const updateFamilyTemplate = async (familyId, templateId, updates) => {
  try {
    const online = await isOnline();

    if (!online) {
      return { success: false, error: 'You must be online to update templates' };
    }

    const templateRef = doc(db, 'families', familyId, 'templates', templateId);
    
    const data = {
      ...updates,
      updatedAt: serverTimestamp(),
    };

    if (updates.recurrence) {
      data.nextDue = calculateNextDueDate(updates.recurrence, updates.lastCreated || null);
    }

    await updateDoc(templateRef, data);

    console.log('✅ Family template updated:', templateId);
    return { success: true };
  } catch (error) {
    console.log('❌ Update template error:', error);
    return { success: false, error: error.message };
  }
};

// ============ DELETE TEMPLATE ============
export const deleteFamilyTemplate = async (familyId, templateId) => {
  try {
    const online = await isOnline();

    if (!online) {
      return { success: false, error: 'You must be online to delete templates' };
    }

    await deleteDoc(doc(db, 'families', familyId, 'templates', templateId));

    console.log('✅ Family template deleted:', templateId);
    return { success: true };
  } catch (error) {
    console.log('❌ Delete template error:', error);
    return { success: false, error: error.message };
  }
};

// ============ PROCESS DUE TEMPLATES ============
// This function should be called on app start or periodically
export const processDueTemplates = async (familyId) => {
  try {
    const online = await isOnline();
    if (!online) return { success: false };

    const { templates } = await getFamilyTemplates(familyId);
    if (!templates || templates.length === 0) return { success: true, processed: 0 };

    const now = new Date();
    let processedCount = 0;

    for (const template of templates) {
      if (!template.nextDue) continue;

      const dueDate = new Date(template.nextDue);
      
      // If template is due today or past due
      if (dueDate <= now) {
        if (template.autoCreate) {
          // 1. Create the expense
          const expenseData = {
            amount: template.amount,
            category: template.category,
            categoryIcon: template.categoryIcon,
            categoryName: template.categoryName,
            paidBy: template.paidBy,
            paidByName: template.paidByName,
            splitType: template.splitType,
            splitDetails: template.splitDetails,
            date: dueDate.toISOString(),
            note: `${template.name} (Auto-generated)`,
          };

          // Try to sync to personal if the creator paid
          const syncToPersonal = template.paidBy === template.createdBy;
          
          await addFamilyExpense(familyId, expenseData, syncToPersonal);

          // 2. Update template nextDue
          const nextDue = calculateNextDueDate(template.recurrence, dueDate.toISOString());
          
          await updateFamilyTemplate(familyId, template.id, {
            lastCreated: dueDate.toISOString(),
            nextDue,
            isActive: nextDue !== null, // Deactivate if end date passed
          });

          // 3. Send notification
          const batch = writeBatch(db);
          // (Requires fetching members, simplified for now)
          
          processedCount++;
        } else {
          // If autoCreate is false, we should just send a reminder notification
          // (Implementation left as exercise)
        }
      }
    }

    return { success: true, processed: processedCount };
  } catch (error) {
    console.log('❌ Process due templates error:', error);
    return { success: false, error: error.message };
  }
};
