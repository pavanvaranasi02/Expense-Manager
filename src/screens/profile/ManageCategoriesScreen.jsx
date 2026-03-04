import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    addCustomCategory, deleteCustomCategory,
    getAllCategories
} from '../../services/categoryService';

const EMOJI_OPTIONS = [
  '🛍️', '🎁', '🐾', '💻', '📱', '🏋️', '✈️', '🎵',
  '🍔', '☕', '🎮', '💊', '🏠', '👶', '💈', '🧹',
  '📦', '🔧', '🎨', '📸', '🌿', '⚡', '💎', '🎯',
];

const COLOR_OPTIONS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
  '#06B6D4', '#A855F7', '#E11D48', '#0EA5E9',
];

const ManageCategoriesScreen = ({ navigation }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📦');
  const [newColor, setNewColor] = useState('#6366F1');
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    const result = await getAllCategories();
    if (result.success) {
      setCategories(result.categories);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAddCategory = async () => {
    if (!newName.trim()) {
      Alert.alert('Required', 'Please enter category name');
      return;
    }

    // Check duplicate
    const exists = categories.find(
      c => c.name.toLowerCase() === newName.trim().toLowerCase()
    );
    if (exists) {
      Alert.alert('Duplicate', 'A category with this name already exists');
      return;
    }

    setSaving(true);
    const result = await addCustomCategory({
      name: newName.trim(),
      icon: newIcon,
      color: newColor,
    });

    if (result.success) {
      setCategories(prev => [...prev, result.category]);
      setShowModal(false);
      setNewName('');
      setNewIcon('📦');
      setNewColor('#6366F1');
    } else {
      Alert.alert('Error', 'Failed to add category');
    }
    setSaving(false);
  };

  const handleDeleteCategory = (category) => {
    if (category.isDefault) {
      Alert.alert('Info', 'Default categories cannot be deleted');
      return;
    }

    Alert.alert(
      'Delete Category',
      `Delete "${category.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteCustomCategory(category.id);
            if (result.success) {
              setCategories(prev => prev.filter(c => c.id !== category.id));
            }
          },
        },
      ]
    );
  };

  const defaultCats = categories.filter(c => c.isDefault);
  const customCats = categories.filter(c => !c.isDefault);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Categories</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Categories</Text>
        <TouchableOpacity onPress={() => setShowModal(true)} style={styles.addHeaderBtn}>
          <Ionicons name="add" size={24} color="#6C63FF" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Default Categories */}
          <Text style={styles.sectionTitle}>Default Categories ({defaultCats.length})</Text>
          <View style={styles.categoriesGrid}>
            {defaultCats.map((cat) => (
              <View key={cat.id} style={styles.categoryChip}>
                <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text style={styles.categoryName} numberOfLines={1}>{cat.name}</Text>
              </View>
            ))}
          </View>

          {/* Custom Categories */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
            Custom Categories ({customCats.length})
          </Text>

          {customCats.length === 0 ? (
            <View style={styles.emptyCustom}>
              <Text style={styles.emptyCustomText}>No custom categories yet</Text>
              <TouchableOpacity onPress={() => setShowModal(true)}>
                <Text style={styles.emptyCustomLink}>+ Add one</Text>
              </TouchableOpacity>
            </View>
          ) : (
            customCats.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={styles.customCategoryCard}
                onLongPress={() => handleDeleteCategory(cat)}
              >
                <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                <Text style={styles.customCategoryIcon}>{cat.icon}</Text>
                <Text style={styles.customCategoryName}>{cat.name}</Text>
                <TouchableOpacity onPress={() => handleDeleteCategory(cat)}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Add Category Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Category</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Preview */}
            <View style={styles.preview}>
              <View style={[styles.previewBg, { backgroundColor: newColor + '20' }]}>
                <Text style={styles.previewIcon}>{newIcon}</Text>
              </View>
              <Text style={styles.previewName}>{newName || 'Category Name'}</Text>
            </View>

            {/* Name Input */}
            <Text style={styles.modalLabel}>Name *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., Pet Care"
              placeholderTextColor="#9CA3AF"
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />

            {/* Icon Picker */}
            <Text style={styles.modalLabel}>Icon</Text>
            <View style={styles.emojiGrid}>
              {EMOJI_OPTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.emojiChip,
                    newIcon === emoji && { backgroundColor: '#F0EFFF', borderColor: '#6C63FF' },
                  ]}
                  onPress={() => setNewIcon(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Color Picker */}
            <Text style={styles.modalLabel}>Color</Text>
            <View style={styles.colorGrid}>
              {COLOR_OPTIONS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorChip,
                    { backgroundColor: color },
                    newColor === color && styles.colorChipActive,
                  ]}
                  onPress={() => setNewColor(color)}
                >
                  {newColor === color && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </TouchableOpacity>
              ))}
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]}
              onPress={handleAddCategory}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSaveBtnText}>Add Category</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FE' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A2E' },
  addHeaderBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0EFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', marginBottom: 12 },

  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  categoryDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  categoryIcon: { fontSize: 16, marginRight: 4 },
  categoryName: { fontSize: 13, color: '#374151', maxWidth: 100 },

  emptyCustom: { alignItems: 'center', paddingVertical: 24 },
  emptyCustomText: { fontSize: 14, color: '#9CA3AF' },
  emptyCustomLink: { fontSize: 14, color: '#6C63FF', fontWeight: '600', marginTop: 8 },

  customCategoryCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    padding: 14, borderRadius: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  customCategoryIcon: { fontSize: 20, marginRight: 10 },
  customCategoryName: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1A1A2E' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  modalLabel: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8, marginTop: 16 },
  modalInput: {
    backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: 14, height: 48, fontSize: 15, color: '#1A1A2E',
  },

  preview: { alignItems: 'center', marginBottom: 8 },
  previewBg: {
    width: 56, height: 56, borderRadius: 16, justifyContent: 'center',
    alignItems: 'center', marginBottom: 8,
  },
  previewIcon: { fontSize: 28 },
  previewName: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },

  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiChip: {
    width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  emojiText: { fontSize: 20 },

  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorChip: {
    width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
  },
  colorChipActive: { borderWidth: 3, borderColor: '#1A1A2E' },

  modalSaveBtn: {
    backgroundColor: '#6C63FF', height: 50, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginTop: 24,
  },
  modalSaveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

export default ManageCategoriesScreen;