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
    StatusBar,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
    addCustomCategory, deleteCustomCategory,
    getAllCategories
} from '../../services/categoryService';

const EMOJI_OPTIONS = [
  '🛍️', '🎁', '🐾', '💻', '📱', '🏋️', '✈️', '🎵',
  '🍔', '☕', '🎮', '💊', '🏠', '👶', '💈', '🧹',
  '📦', '🔧', '🎨', '📸', '🌿', '⚡', '💎', '🎯',
];

const { width } = Dimensions.get('window');

const COLOR_OPTIONS = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#84CC16', '#06B6D4',
  '#A855F7', '#E11D48', '#0EA5E9', '#64748B'
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
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Categories</Text>
            <View style={{ width: 44 }} />
          </View>
        </SafeAreaView>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Categories</Text>
          <TouchableOpacity onPress={() => setShowModal(true)} style={styles.addHeaderBtn}>
            <Ionicons name="add" size={24} color="#6366F1" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Section Header */}
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconBox, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="grid" size={14} color="#6366F1" />
            </View>
            <Text style={styles.sectionTitle}>DEFAULT CATEGORIES ({defaultCats.length})</Text>
          </View>

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
          <View style={[styles.sectionHeader, { marginTop: 32 }]}>
            <View style={[styles.sectionIconBox, { backgroundColor: '#FDF2F8' }]}>
              <Ionicons name="color-palette" size={14} color="#EC4899" />
            </View>
            <Text style={styles.sectionTitle}>CUSTOM CATEGORIES ({customCats.length})</Text>
          </View>

          {customCats.length === 0 ? (
            <View style={styles.emptyCustom}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="brush-outline" size={32} color="#9CA3AF" />
              </View>
              <Text style={styles.emptyCustomText}>No custom categories yet</Text>
              <TouchableOpacity onPress={() => setShowModal(true)} style={styles.emptyAddBtn}>
                <Text style={styles.emptyAddText}>Create Your First Category</Text>
              </TouchableOpacity>
            </View>
          ) : (
            customCats.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={styles.customCategoryCard}
                onLongPress={() => handleDeleteCategory(cat)}
                activeOpacity={0.7}
              >
                <View style={[styles.cardIconBox, { backgroundColor: cat.color + '15' }]}>
                  <Text style={styles.customCategoryIcon}>{cat.icon}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.customCategoryName}>{cat.name}</Text>
                  <Text style={styles.customCategorySub}>Added by you</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => handleDeleteCategory(cat)}
                  style={styles.trashBtn}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showModal} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalDismiss} 
            activeOpacity={1} 
            onPress={() => setShowModal(false)} 
          />
          <View style={styles.modalContent}>
            <View style={styles.modalDragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Category</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Preview Section */}
              <View style={styles.previewSection}>
                <LinearGradient
                  colors={[newColor, newColor + 'CC']}
                  style={styles.previewIconBox}
                >
                  <Text style={styles.previewIcon}>{newIcon}</Text>
                </LinearGradient>
                <Text style={styles.previewName}>{newName || 'Untitled Category'}</Text>
              </View>

              {/* Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.modalLabel}>CATEGORY NAME</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Subscriptions"
                  placeholderTextColor="#9CA3AF"
                  value={newName}
                  onChangeText={setNewName}
                />
              </View>

              {/* Icon Picker */}
              <View style={styles.inputGroup}>
                <Text style={styles.modalLabel}>SELECT ICON</Text>
                <View style={styles.emojiGrid}>
                  {EMOJI_OPTIONS.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={[
                        styles.emojiChip,
                        newIcon === emoji && styles.activeEmojiChip,
                      ]}
                      onPress={() => setNewIcon(emoji)}
                    >
                      <Text style={styles.emojiText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Color Picker */}
              <View style={styles.inputGroup}>
                <Text style={styles.modalLabel}>SELECT COLOR</Text>
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
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.modalSaveBtn, saving && { opacity: 0.7 }]}
                onPress={handleAddCategory}
                disabled={saving}
              >
                <LinearGradient
                  colors={['#6366F1', '#4338CA']}
                  style={styles.saveBtnGradient}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalSaveBtnText}>Create Category</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  safeArea: { backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#111827", letterSpacing: -0.5 },
  addHeaderBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    marginBottom: 16,
    marginTop: 24,
  },
  sectionIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#6B7280',
    letterSpacing: 1.5,
  },

  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  categoryDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  categoryIcon: { fontSize: 16, marginRight: 6 },
  categoryName: { fontSize: 13, color: '#111827', fontWeight: '800', maxWidth: 120 },

  emptyCustom: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyCustomText: { fontSize: 14, color: '#6B7280', fontWeight: '500', marginBottom: 12 },
  emptyAddBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
  },
  emptyAddText: { color: '#6366F1', fontWeight: '800', fontSize: 13 },

  customCategoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
  },
  cardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customCategoryIcon: { fontSize: 24 },
  customCategoryName: { fontSize: 16, fontWeight: '800', color: '#111827' },
  customCategorySub: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  trashBtn: {
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    justifyContent: 'flex-end',
  },
  modalDismiss: { flex: 1 },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 8,
    maxHeight: '90%',
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#111827', letterSpacing: -0.5 },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  previewSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  previewIconBox: {
    width: 80,
    height: 80,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
  },
  previewIcon: { fontSize: 36 },
  previewName: { fontSize: 18, fontWeight: '900', color: '#111827' },

  inputGroup: { marginBottom: 24 },
  modalLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: 8,
    paddingLeft: 4,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingHorizontal: 16,
    height: 56,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 2 },
  emojiChip: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeEmojiChip: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  emojiText: { fontSize: 24 },

  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 2 },
  colorChip: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorChipActive: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.1 }],
  },

  modalSaveBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 12,
    elevation: 4,
    shadowColor: '#6366F1',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
  },
  saveBtnGradient: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
});

export default ManageCategoriesScreen;