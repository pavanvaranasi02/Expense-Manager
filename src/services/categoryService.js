import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const getUserId = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
};

// Default categories (hardcoded — same for all users)
export const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Food & Dining', icon: '🍕', color: '#FF9800', isDefault: true },
  { id: 'travel', name: 'Travel', icon: '🚗', color: '#4CAF50', isDefault: true },
  { id: 'pooja', name: 'Pooja & Donations', icon: '🪔', color: '#9C27B0', isDefault: true },
  { id: 'shopping', name: 'Shopping', icon: '🛒', color: '#2196F3', isDefault: true },
  { id: 'bills', name: 'Bills & Utilities', icon: '📱', color: '#F44336', isDefault: true },
  { id: 'health', name: 'Health', icon: '🏥', color: '#00BCD4', isDefault: true },
  { id: 'education', name: 'Education', icon: '📚', color: '#3F51B5', isDefault: true },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#E91E63', isDefault: true },
  { id: 'rent', name: 'Rent', icon: '🏠', color: '#795548', isDefault: true },
  { id: 'emi', name: 'EMI', icon: '🏦', color: '#607D8B', isDefault: true },
  { id: 'groceries', name: 'Groceries', icon: '🥬', color: '#8BC34A', isDefault: true },
  { id: 'fuel', name: 'Fuel', icon: '⛽', color: '#FF5722', isDefault: true },
  { id: 'subscription', name: 'Subscriptions', icon: '🔄', color: '#673AB7', isDefault: true },
  { id: 'investment', name: 'Investment', icon: '📉', color: '#6C63FF', isDefault: true },
  { id: 'other', name: 'Other', icon: '📦', color: '#9E9E9E', isDefault: true },
];

// ============ GET ALL CATEGORIES (Default + Custom) ============
export const getAllCategories = async () => {
  try {
    const userId = getUserId();

    const q = query(
      collection(db, 'users', userId, 'custom_categories'),
      orderBy('createdAt', 'asc')
    );

    const snapshot = await getDocs(q);
    const customCategories = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      isDefault: false,
    }));

    // Combine default + custom
    const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];
    return { success: true, categories: allCategories };
  } catch (error) {
    console.log('❌ Get categories error:', error);
    return { success: true, categories: DEFAULT_CATEGORIES };
  }
};

// ============ ADD CUSTOM CATEGORY ============
export const addCustomCategory = async (categoryData) => {
  try {
    const userId = getUserId();

    const data = {
      name: categoryData.name.trim(),
      icon: categoryData.icon || '📦',
      color: categoryData.color || '#9E9E9E',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(
      collection(db, 'users', userId, 'custom_categories'),
      data
    );

    console.log('✅ Custom category added:', docRef.id);
    return { success: true, id: docRef.id, category: { id: docRef.id, ...data, isDefault: false } };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ UPDATE CUSTOM CATEGORY ============
export const updateCustomCategory = async (categoryId, data) => {
  try {
    const userId = getUserId();
    await updateDoc(
      doc(db, 'users', userId, 'custom_categories', categoryId),
      { ...data, updatedAt: serverTimestamp() }
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ============ DELETE CUSTOM CATEGORY ============
export const deleteCustomCategory = async (categoryId) => {
  try {
    const userId = getUserId();
    await deleteDoc(doc(db, 'users', userId, 'custom_categories', categoryId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};