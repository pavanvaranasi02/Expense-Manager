import { HStack, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  containerBackground,
  cornerRadius,
  font,
  foregroundStyle,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

const INITIAL_IOS_PROPS = {
  formattedBankBalance: '₹0',
  formattedCashBalance: '₹0',
  quickCategories: [
    { id: 'food', label: 'Food', icon: '🍕' },
    { id: 'travel', label: 'Travel', icon: '🚗' },
    { id: 'groceries', label: 'Groceries', icon: '🥬' },
    { id: 'bills', label: 'Bills', icon: '📱' },
  ],
};

const KoshIosWidgetComponent = (props, environment) => {
  'widget';

  const bankText = props?.formattedBankBalance || '₹0';
  const cashText = props?.formattedCashBalance || '₹0';
  const categories =
    Array.isArray(props?.quickCategories) && props.quickCategories.length > 0
      ? props.quickCategories
      : [
          { id: 'food', label: 'Food', icon: '🍕' },
          { id: 'travel', label: 'Travel', icon: '🚗' },
          { id: 'groceries', label: 'Groceries', icon: '🥬' },
          { id: 'bills', label: 'Bills', icon: '📱' },
        ];

  if (environment?.widgetFamily === 'systemSmall') {
    return (
      <VStack
        alignment="leading"
        spacing={6}
        modifiers={[containerBackground('#103C38', 'widget'), padding({ all: 2 })]}
      >
        <HStack alignment="center">
          <Text
            modifiers={[
              font({ weight: 'bold', size: 10 }),
              foregroundStyle('#A7F3D0'),
            ]}
          >
            ALL ACCOUNTS
          </Text>
          <Spacer />
          <Link destination="kosh://history?filter=all">
            <Text
              modifiers={[
                font({ weight: 'semibold', size: 10 }),
                foregroundStyle('#ECFDF5'),
                padding({ horizontal: 7, vertical: 3 }),
                background('#164E49'),
                cornerRadius(8),
              ]}
            >
              History
            </Text>
          </Link>
        </HStack>

        <Text
          modifiers={[
            font({ weight: 'bold', size: 20 }),
            foregroundStyle('#FFFFFF'),
          ]}
        >
          {bankText}
        </Text>

        <HStack
          alignment="center"
          spacing={4}
          modifiers={[
            padding({ horizontal: 8, vertical: 4 }),
            background('#164E49'),
            cornerRadius(8),
          ]}
        >
          <Text
            modifiers={[
              font({ weight: 'semibold', size: 9 }),
              foregroundStyle('#FDE68A'),
            ]}
          >
            CASH
          </Text>
          <Spacer />
          <Text
            modifiers={[
              font({ weight: 'bold', size: 12 }),
              foregroundStyle('#FFFFFF'),
            ]}
          >
            {cashText}
          </Text>
        </HStack>

        <Spacer />

        <Link destination="kosh://add-expense">
          <Text
            modifiers={[
              font({ weight: 'bold', size: 12 }),
              foregroundStyle('#103C38'),
              padding({ horizontal: 10, vertical: 6 }),
              background('#FFFFFF'),
              cornerRadius(10),
            ]}
          >
            + Log Expense
          </Text>
        </Link>
      </VStack>
    );
  }

  return (
    <VStack
      alignment="leading"
      spacing={10}
      modifiers={[containerBackground('#103C38', 'widget'), padding({ all: 4 })]}
    >
      <HStack alignment="top" spacing={12}>
        <VStack alignment="leading" spacing={2}>
          <Text
            modifiers={[
              font({ weight: 'semibold', size: 10 }),
              foregroundStyle('#A7F3D0'),
            ]}
          >
            ALL ACCOUNTS
          </Text>
          <Text
            modifiers={[
              font({ weight: 'bold', size: 22 }),
              foregroundStyle('#FFFFFF'),
            ]}
          >
            {bankText}
          </Text>
        </VStack>

        <VStack
          alignment="leading"
          spacing={2}
          modifiers={[
            padding({ horizontal: 10, vertical: 6 }),
            background('#164E49'),
            cornerRadius(10),
          ]}
        >
          <Text
            modifiers={[
              font({ weight: 'semibold', size: 9 }),
              foregroundStyle('#FDE68A'),
            ]}
          >
            CASH IN HAND
          </Text>
          <Text
            modifiers={[
              font({ weight: 'bold', size: 15 }),
              foregroundStyle('#FFFFFF'),
            ]}
          >
            {cashText}
          </Text>
        </VStack>

        <Spacer />

        <Link destination="kosh://history?filter=all">
          <Text
            modifiers={[
              font({ weight: 'semibold', size: 11 }),
              foregroundStyle('#ECFDF5'),
              padding({ horizontal: 10, vertical: 6 }),
              background('#164E49'),
              cornerRadius(12),
            ]}
          >
            History ↗
          </Text>
        </Link>
      </HStack>

      <Spacer />

      <HStack alignment="center" spacing={6}>
        <Link destination="kosh://add-expense">
          <Text
            modifiers={[
              font({ weight: 'bold', size: 12 }),
              foregroundStyle('#103C38'),
              padding({ horizontal: 12, vertical: 8 }),
              background('#FFFFFF'),
              cornerRadius(12),
            ]}
          >
            + Log Expense
          </Text>
        </Link>

        {categories.slice(0, 3).map((cat) => (
          <Link
            key={cat.id}
            destination={`kosh://add-expense?categoryId=${cat.id}`}
          >
            <Text
              modifiers={[
                font({ weight: 'semibold', size: 11 }),
                foregroundStyle('#F7F6F2'),
                padding({ horizontal: 8, vertical: 7 }),
                background('#164E49'),
                cornerRadius(10),
              ]}
            >
              {`${cat.icon} ${cat.label}`}
            </Text>
          </Link>
        ))}
      </HStack>
    </VStack>
  );
};

export default createWidget(
  'KoshQuickExpenseWidget',
  KoshIosWidgetComponent,
  INITIAL_IOS_PROPS
);
