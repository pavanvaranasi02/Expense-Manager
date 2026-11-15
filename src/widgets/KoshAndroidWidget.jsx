import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import {
  DEFAULT_QUICK_CATEGORIES,
  getDefaultWidgetSnapshot,
  WIDGET_DEEP_LINKS,
} from '../services/widgetService';

export function KoshAndroidWidget({ snapshot, width = 320 }) {
  const data = snapshot || getDefaultWidgetSnapshot();
  const categories = Array.isArray(data.quickCategories) && data.quickCategories.length > 0
    ? data.quickCategories
    : DEFAULT_QUICK_CATEGORIES;

  const isCompact = typeof width === 'number' && width < 240;
  const visibleCategories = isCompact ? categories.slice(0, 2) : categories.slice(0, 4);

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#103C38',
        borderRadius: 20,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#1E5B55',
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: WIDGET_DEEP_LINKS.HOME }}
      accessibilityLabel="KOSH Quick Expense Widget"
    >
      {/* Top Row: Balances + History Button */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
          }}
        >
          {/* Combined Bank Accounts Balance */}
          <FlexWidget
            style={{
              flexDirection: 'column',
              marginRight: 16,
            }}
          >
            <TextWidget
              text="ALL ACCOUNTS"
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: '#A7F3D0',
                letterSpacing: 0.6,
              }}
            />
            <TextWidget
              text={data.formattedBankBalance}
              style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: '#FFFFFF',
                marginTop: 2,
              }}
            />
          </FlexWidget>

          {/* Cash in Hand (Separate) */}
          <FlexWidget
            style={{
              flexDirection: 'column',
              backgroundColor: '#164E49',
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: '#1E5B55',
            }}
          >
            <TextWidget
              text="CASH IN HAND"
              style={{
                fontSize: 9,
                fontWeight: '600',
                color: '#FDE68A',
                letterSpacing: 0.5,
              }}
            />
            <TextWidget
              text={data.formattedCashBalance}
              style={{
                fontSize: 15,
                fontWeight: 'bold',
                color: '#FFFFFF',
                marginTop: 1,
              }}
            />
          </FlexWidget>
        </FlexWidget>

        {/* History Button -> Opens App to All Transactions */}
        <FlexWidget
          style={{
            backgroundColor: '#164E49',
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderWidth: 1,
            borderColor: '#2A6F68',
            flexDirection: 'row',
            alignItems: 'center',
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: WIDGET_DEEP_LINKS.HISTORY }}
          accessibilityLabel="Open transaction history"
        >
          <TextWidget
            text="History ↗"
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: '#ECFDF5',
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* Bottom Row: + Log Expense + Quick Category Chips */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 10,
        }}
      >
        <FlexWidget
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: WIDGET_DEEP_LINKS.ADD_EXPENSE }}
          accessibilityLabel="Log new expense"
        >
          <TextWidget
            text="+ Log Expense"
            style={{
              fontSize: 12,
              fontWeight: 'bold',
              color: '#103C38',
            }}
          />
        </FlexWidget>

        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {visibleCategories.map((cat, idx) => (
            <FlexWidget
              key={cat.id}
              style={{
                backgroundColor: '#164E49',
                borderRadius: 10,
                paddingHorizontal: 8,
                paddingVertical: 7,
                marginLeft: idx === 0 ? 6 : 5,
                borderWidth: 1,
                borderColor: '#1E5B55',
              }}
              clickAction="OPEN_URI"
              clickActionData={{
                uri: WIDGET_DEEP_LINKS.addExpenseWithCategory(cat.id),
              }}
              accessibilityLabel={`Quick log ${cat.label} expense`}
            >
              <TextWidget
                text={`${cat.icon} ${cat.label}`}
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: '#F7F6F2',
                }}
              />
            </FlexWidget>
          ))}
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

export default KoshAndroidWidget;
