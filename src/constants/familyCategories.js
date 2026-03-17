/**
 * Family-specific expense categories
 * Separate from personal categories for family budgeting flexibility
 */

export const FAMILY_CATEGORIES = [
  {
    id: "groceries",
    name: "Groceries",
    icon: "cart-outline",
    color: "#10B981",
  },
  { id: "rent", name: "Rent/Mortgage", icon: "home-outline", color: "#6366F1" },
  {
    id: "utilities",
    name: "Utilities",
    icon: "flash-outline",
    color: "#F59E0B",
  },
  {
    id: "dining",
    name: "Dining Out",
    icon: "restaurant-outline",
    color: "#EF4444",
  },
  { id: "transport", name: "Transport", icon: "car-outline", color: "#3B82F6" },
  { id: "medical", name: "Medical", icon: "medkit-outline", color: "#EC4899" },
  {
    id: "education",
    name: "Education",
    icon: "school-outline",
    color: "#8B5CF6",
  },
  {
    id: "entertainment",
    name: "Entertainment",
    icon: "film-outline",
    color: "#F97316",
  },
  {
    id: "subscriptions",
    name: "Subscriptions",
    icon: "card-outline",
    color: "#06B6D4",
  },
  {
    id: "maintenance",
    name: "Maintenance",
    icon: "build-outline",
    color: "#64748B",
  },
  {
    id: "vacation",
    name: "Vacation",
    icon: "airplane-outline",
    color: "#14B8A6",
  },
  { id: "shopping", name: "Shopping", icon: "bag-outline", color: "#A855F7" },
  { id: "gifts", name: "Gifts", icon: "gift-outline", color: "#FB923C" },
  {
    id: "miscellaneous",
    name: "Miscellaneous",
    icon: "ellipsis-horizontal",
    color: "#9CA3AF",
  },
];

// NEW: Split type constants
export const SPLIT_TYPES = {
  PAID_FOR_ALL: "PAID_FOR_ALL",
  EQUAL: "EQUAL",
  CUSTOM: "CUSTOM",
  PERCENTAGE: "PERCENTAGE",
};

export const SPLIT_TYPE_LABELS = {
  [SPLIT_TYPES.PAID_FOR_ALL]: "Paid for All",
  [SPLIT_TYPES.EQUAL]: "Split Equally",
  [SPLIT_TYPES.CUSTOM]: "Custom Amounts",
  [SPLIT_TYPES.PERCENTAGE]: "By Percentage",
};

export const getFamilyCategory = (categoryId) => {
  return (
    FAMILY_CATEGORIES.find((cat) => cat.id === categoryId) ||
    FAMILY_CATEGORIES[FAMILY_CATEGORIES.length - 1]
  );
};

export const getFamilyCategoryIcon = (categoryId) => {
  const category = getFamilyCategory(categoryId);
  return category.icon;
};

export const getFamilyCategoryName = (categoryId) => {
  const category = getFamilyCategory(categoryId);
  return category.name;
};
