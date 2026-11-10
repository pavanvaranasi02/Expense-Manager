# Cloud Firestore Database Schema Specification
**Application:** KOSH (Expense & Investment Manager)  
**Version:** 1.3.4  
**Database:** Cloud Firestore (NoSQL Document Store)

---

## 1. Overview & Data Hierarchy

The database follows a user-centric multi-tenant structure where personal financial records are organized under individual user subcollections for high isolation and straightforward security rules. Shared family finances use dedicated root-level family collections.

```
firestore/
├── users/
│   └── {userId}/
│       ├── accounts/
│       │   └── {accountId}
│       ├── expenses/
│       │   └── {expenseId}
│       ├── incomes/
│       │   └── {incomeId}
│       ├── budgets/
│       │   └── {budgetId}
│       ├── investments/
│       │   └── {investmentId}
│       ├── emis/
│       │   └── {emiId}
│       ├── custom_categories/
│       │   └── {categoryId}
│       └── notifications/
│           └── {notificationId}
└── families/
    └── {familyId}/
        ├── expenses/
        │   └── {expenseId}
        ├── budgets/
        │   └── {budgetId}
        └── templates/
            └── {templateId}
```

---

## 2. Document & Collection Definitions

### 2.1. User Profile (`users/{userId}`)

Represents the core user profile, preferences, and authentication metadata.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | Yes | - | User display name |
| `email` | `string` | Yes | - | User email address |
| `phone` | `string \| null` | No | `null` | Contact phone number |
| `role` | `string` | Yes | `"USER"` | User role (`"USER"`, `"ADMIN"`) |
| `currency` | `string` | Yes | `"INR"` | Preferred default base currency (`"INR"`, `"USD"`, `"EUR"`, `"GBP"`, etc.) |
| `currencySymbol` | `string` | No | `"₹"` | Cached symbol for the user base currency |
| `authProvider` | `string` | Yes | `"email"` | Auth provider (`"email"`, `"google"`) |
| `profileImage` | `string \| null` | No | `null` | URL or base64 profile image |
| `onboardingComplete` | `boolean` | Yes | `false` | Whether onboarding wizard was finished |
| `showInvestmentsInAssets` | `boolean` | No | `false` | Include investments in dashboard net worth |
| `showTabLabels` | `boolean` | No | `true` | Show or hide bottom tab bar labels |
| `isStealthMode` | `boolean` | No | `false` | Mask balances with asterisks (privacy mode) |
| `familyId` | `string \| null` | No | `null` | Associated family group ID |
| `notificationSettings` | `map` | No | - | Notification preferences (see sub-fields below) |
| `notificationSettings.enabled` | `boolean` | Yes | `true` | Master toggle for notifications |
| `notificationSettings.sipReminders` | `boolean` | Yes | `true` | Mutual Fund SIP alert trigger |
| `notificationSettings.rdReminders` | `boolean` | Yes | `true` | Recurring Deposit payment alerts |
| `notificationSettings.maturityAlerts` | `boolean` | Yes | `true` | FD/RD maturity payout notifications |
| `notificationSettings.budgetAlerts` | `boolean` | Yes | `true` | Category & overall budget limit warnings |
| `notificationSettings.creditCardAlerts`| `boolean` | Yes | `true` | Credit card bill payment due warnings |
| `notificationSettings.emiAlerts` | `boolean` | Yes | `true` | Loan & CC EMI due alerts |
| `notificationSettings.dailyReminder` | `boolean` | Yes | `true` | Daily evening expense logging reminder |
| `isActive` | `boolean` | Yes | `true` | Account active state |
| `createdAt` | `timestamp` | Yes | `serverTimestamp()` | Account registration date |
| `updatedAt` | `timestamp` | Yes | `serverTimestamp()` | Profile last updated date |
| `lastLoginAt` | `timestamp` | Yes | `serverTimestamp()` | Last sign-in timestamp |

---

### 2.2. Accounts (`users/{userId}/accounts/{accountId}`)

Stores financial asset accounts (Bank accounts, Cash wallets) and liability instruments (Credit Cards).

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | Yes | - | Account label (e.g. "HDFC Salary", "Wallet") |
| `type` | `string` | Yes | - | `"BANK"`, `"CASH"`, `"CREDIT_CARD"`, `"OTHER"` |
| `bankName` | `string \| null` | No | `null` | Issuing bank name |
| `accountNumber` | `string \| null` | No | `null` | Account number / last 4 digits |
| `balance` | `number` | Yes | `0` | Current balance (for Bank and Cash) |
| `hasDebitCard` | `boolean` | No | `false` | Whether account has a linked debit card |
| `debitCardLast4` | `string \| null` | No | `null` | Last 4 digits of debit card |
| `creditLimit` | `number` | No | `0` | Total credit limit (for Credit Cards) |
| `currentUsage` | `number` | No | `0` | Current billed/unbilled usage |
| `availableCredit` | `number` | No | `0` | Calculated remaining credit |
| `billGenerationDate` | `number` | No | `1` | Day of month when statement is generated (1-31) |
| `billDueDate` | `number` | No | `15` | Day of month when payment is due (1-31) |
| `interestRate` | `number` | No | `36` | Annual interest rate (% APR) |
| `userSpendLimit` | `number \| null`| No | `null` | Custom monthly threshold |
| `alertAt` | `number` | No | `80` | Utilization percentage alert trigger (e.g. 80%) |
| `lastBillPaidAmount` | `number` | No | `0` | Amount paid in the last bill cycle |
| `lastBillPaidDate` | `string \| null`| No | `null` | Timestamp of last bill payment |
| `unpaidBillAmount` | `number` | No | `0` | Current outstanding bill amount |
| `billPaymentHistory` | `array<map>` | No | `[]` | Historical bill payment records |
| `color` | `string` | Yes | `"#455A64"` | Hex color code for UI cards |
| `icon` | `string` | Yes | `"card"` | Icon key |
| `isDefault` | `boolean` | No | `false` | Default account for transactions |
| `createdAt` | `timestamp` | Yes | `serverTimestamp()` | Creation timestamp |
| `updatedAt` | `timestamp` | Yes | `serverTimestamp()` | Last updated timestamp |

---

### 2.3. Expenses (`users/{userId}/expenses/{expenseId}`)

Individual expense transactions.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `amount` | `number` | Yes | - | Expense amount in base currency |
| `categoryId` | `string` | Yes | - | Identifier of category (e.g. `"food"`, `"travel"`) |
| `categoryName` | `string` | Yes | - | Human-readable category name |
| `categoryIcon` | `string` | Yes | `"📦"` | Category emoji or icon |
| `accountId` | `string \| null` | No | `null` | Account from which payment was deducted |
| `accountName` | `string` | Yes | `"Unknown"` | Cached account name |
| `paymentMode` | `string` | Yes | - | `"BANK"`, `"CASH"`, `"CREDIT_CARD"`, `"UPI"`, etc. |
| `isCredit` | `boolean` | Yes | `false` | True if transaction used credit card |
| `date` | `timestamp` | Yes | - | Transaction date |
| `note` | `string` | No | `""` | Optional transaction description |
| `tags` | `array<string>` | No | `[]` | Categorization tags |
| `_pendingSync` | `boolean` | No | `false` | True if waiting for offline sync |
| `createdAt` | `timestamp` | Yes | `serverTimestamp()` | Creation timestamp |
| `updatedAt` | `timestamp` | Yes | `serverTimestamp()` | Last updated timestamp |

---

### 2.4. Incomes (`users/{userId}/incomes/{incomeId}`)

Inflow transactions (Salaries, Dividends, Investment Returns, Gifts).

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `amount` | `number` | Yes | - | Received income amount in base currency |
| `source` | `string` | Yes | - | Income category ID (`"salary"`, `"dividend"`, etc.) |
| `sourceName` | `string` | Yes | - | Source display name |
| `sourceIcon` | `string` | Yes | `"💼"` | Icon representing the source |
| `accountId` | `string` | Yes | - | Account where funds were deposited |
| `accountName` | `string` | Yes | - | Target account display name |
| `date` | `timestamp` | Yes | - | Date income was received |
| `note` | `string` | No | `""` | Income note/description |
| `createdAt` | `timestamp` | Yes | `serverTimestamp()` | Record created timestamp |
| `updatedAt` | `timestamp` | Yes | `serverTimestamp()` | Record updated timestamp |

---

### 2.5. Budgets (`users/{userId}/budgets/{budgetId}`)

Monthly planned spending limits.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `type` | `string` | Yes | `"CATEGORY"` | `"OVERALL"` or `"CATEGORY"` |
| `categoryId` | `string` | Yes | - | Specific category ID or `"overall"` |
| `categoryName` | `string` | Yes | - | Category label |
| `amount` | `number` | Yes | `0` | Budgeted limit in base currency |
| `month` | `number` | Yes | - | Zero-indexed month (0 = Jan, 11 = Dec) |
| `year` | `number` | Yes | - | Calendar year (e.g. 2026) |
| `alertAt` | `number` | Yes | `80` | Warning threshold percentage (e.g. 80) |
| `createdAt` | `timestamp` | Yes | `serverTimestamp()` | Record created timestamp |
| `updatedAt` | `timestamp` | Yes | `serverTimestamp()` | Record updated timestamp |

---

### 2.6. Investments (`users/{userId}/investments/{investmentId}`)

Portfolio assets spanning mutual funds, stocks, fixed deposits, RD, crypto, gold, etc. Supports multi-currency investments with custom forex exchange rates.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | Yes | - | Investment name (e.g. "Apple Inc", "SBI FD") |
| `type` | `string` | Yes | - | `"mutual_fund"`, `"stocks"`, `"fd"`, `"rd"`, `"ppf"`, `"gold"`, `"crypto"`, `"real_estate"`, `"nps"`, `"bonds"`, `"other"` |
| `typeName` | `string` | Yes | - | Display name of asset type |
| `typeIcon` | `string` | Yes | `"💰"` | Asset icon emoji |
| `platform` | `string \| null` | No | `null` | Broker / Institution (e.g. "Groww", "Zerodha") |
| `currency` | `string` | Yes | `"INR"` | Native asset currency (`"INR"`, `"USD"`, `"EUR"`, etc.) |
| `exchangeRate` | `number` | Yes | `1` | Conversion rate: 1 foreign unit = X base units |
| `investedAmount` | `number` | Yes | `0` | Total invested capital in native currency |
| `currentValue` | `number` | Yes | `0` | Current market valuation in native currency |
| `interestRate` | `number \| null`| No | `null` | Annual interest rate % (for fixed-income/FD/RD) |
| `startDate` | `string` | Yes | ISO string | Date of initial purchase/deposit |
| `note` | `string` | No | `""` | User notes |
| `isActive` | `boolean` | Yes | `true` | Active holding vs redeemed/matured |
| **SIP Fields (Mutual Funds)** | | | | |
| `sipAmount` | `number \| null`| No | `null` | Monthly SIP amount in native currency |
| `sipDate` | `number \| null`| No | `null` | Day of the month SIP triggers (1-31) |
| `sipHistory` | `array<map>` | No | `[]` | Historical executed SIP payments |
| **RD Fields (Recurring Deposits)** | | | | |
| `rdMonthlyAmount` | `number \| null`| No | `null` | Fixed monthly RD installment |
| `rdTotalMonths` | `number \| null`| No | `null` | Total contracted tenure in months |
| `rdCompletedMonths` | `number` | No | `0` | Paid installments count |
| `rdPaymentDate` | `number \| null`| No | `null` | Monthly deduction day (1-31) |
| `rdPaymentHistory` | `array<map>` | No | `[]` | Confirmed RD monthly installments |
| **Maturity Fields (FD / RD)** | | | | |
| `maturityAmount` | `number \| null`| No | `null` | Expected maturity payout |
| `maturityDate` | `string \| null`| No | `null` | ISO date of maturity |
| `paidFromAccountId` | `string \| null`| No | `null` | Bank account used for funding/credit |
| `autoMaturityCredit` | `boolean` | No | `false` | Automatically credit bank account when matured |
| `maturityCredited` | `boolean` | No | `false` | Whether maturity proceeds were credited |
| **Universal Transactions** | | | | |
| `transactions` | `array<map>` | No | `[]` | Transaction history (purchases, top-ups, redemptions) |
| `createdAt` | `timestamp` | Yes | `serverTimestamp()` | Record created timestamp |
| `updatedAt` | `timestamp` | Yes | `serverTimestamp()` | Record updated timestamp |

#### Sub-object: Investment Transaction Map (`transactions[]`)
```json
{
  "id": "txn_1731210000000",
  "type": "INVEST | SIP | RD_PAYMENT | WITHDRAW | MATURED",
  "amount": 500,
  "date": "2026-11-10T08:00:00.000Z",
  "note": "Quarterly lumpsum",
  "balanceAfter": 5000
}
```

---

### 2.7. EMIs & Loans (`users/{userId}/emis/{emiId}`)

Installment plans, personal loans, and credit card EMIs.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | Yes | - | EMI title (e.g. "iPhone 16", "Home Loan") |
| `monthlyAmount` | `number` | Yes | - | Monthly installment amount in base currency |
| `totalMonths` | `number` | Yes | - | Total loan tenure |
| `completedMonths` | `number` | Yes | `0` | Paid installments count |
| `totalAmount` | `number` | Yes | - | Total principal + interest |
| `interestRate` | `number` | No | `0` | Annual interest rate % |
| `processingFee` | `number` | No | `0` | Upfront processing charge |
| `linkedAccountId` | `string \| null`| No | `null` | Linked credit card or bank account |
| `linkedAccountName` | `string` | Yes | - | Account label |
| `linkedAccountType` | `string` | Yes | `"CREDIT_CARD"`| `"CREDIT_CARD"`, `"BANK"` |
| `debitDay` | `number` | Yes | `5` | Monthly auto-debit day (1-31) |
| `startDate` | `string` | Yes | ISO string | Start date |
| `endDate` | `string \| null` | No | `null` | Expected completion date |
| `maturedDate` | `string \| null` | No | `null` | Actual completion date |
| `status` | `string` | Yes | `"ACTIVE"` | `"ACTIVE"`, `"COMPLETED"`, `"CANCELLED"` |
| `isActive` | `boolean` | Yes | `true` | Active status flag |
| `note` | `string` | No | `""` | Notes |
| `paymentHistory` | `array<map>` | No | `[]` | Historical EMI installments paid |
| `createdAt` | `timestamp` | Yes | `serverTimestamp()` | Creation timestamp |
| `updatedAt` | `timestamp` | Yes | `serverTimestamp()` | Last updated timestamp |

---

### 2.8. Custom Categories (`users/{userId}/custom_categories/{categoryId}`)

User-defined expense categories complementing built-in categories.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | Yes | - | Category label |
| `icon` | `string` | Yes | `"📦"` | Emoji or icon string |
| `color` | `string` | Yes | `"#6C63FF"` | Hex color code |
| `isDefault` | `boolean` | Yes | `false` | False for user-created categories |
| `createdAt` | `timestamp` | Yes | `serverTimestamp()` | Creation timestamp |

---

### 2.9. Notifications (`users/{userId}/notifications/{notificationId}`)

In-app alerts and notifications.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `title` | `string` | Yes | - | Notification title |
| `message` | `string` | Yes | - | Body text |
| `type` | `string` | Yes | - | `"SIP_DUE"`, `"RD_DUE"`, `"CREDIT_CARD_DUE"`, `"CREDIT_CARD_URGENT"`, `"BUDGET_WARNING"`, `"BUDGET_EXCEEDED"`, `"MATURITY_ALERT"` |
| `read` | `boolean` | Yes | `false` | Read status |
| `metadata` | `map` | No | `{}` | Context data (e.g. `cardName`, `investmentId`) |
| `createdAt` | `timestamp` | Yes | `serverTimestamp()` | Generated timestamp |

---

### 2.10. Families (`families/{familyId}`)

Shared family financial groups.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | Yes | - | Family name |
| `inviteCode` | `string` | Yes | - | Unique 6-character alphanumeric code |
| `ownerId` | `string` | Yes | - | User ID of family creator |
| `coAdminId` | `string \| null`| No | `null` | User ID of designated co-admin |
| `memberCount` | `number` | Yes | `1` | Count of active members |
| `members` | `array<map>` | Yes | - | Member objects (see structure below) |
| `createdAt` | `timestamp` | Yes | `Timestamp.now()` | Creation date |
| `updatedAt` | `timestamp` | Yes | `Timestamp.now()` | Last updated |

#### Member Map Structure (`members[]`)
```json
{
  "userId": "uid_abc123",
  "displayName": "Pavan",
  "photoURL": null,
  "role": "OWNER | CO_ADMIN | MEMBER | VIEWER",
  "joinedAt": "2026-11-09T18:00:00.000Z"
}
```

---

### 2.11. Family Subcollections

- **`families/{familyId}/expenses/{expenseId}`**: Shared family expense records with contributor `userId`, `userName`, split status, and category.
- **`families/{familyId}/budgets/{budgetId}`**: Shared family budgets by category and month.
- **`families/{familyId}/templates/{templateId}`**: Reusable family expense templates (e.g. recurring weekly groceries or monthly maid salary).

---

## 3. Recommended Firestore Composite Indexes

| Collection | Fields Indexed | Query Purpose |
|---|---|---|
| `users/{userId}/expenses` | `date DESC, createdAt DESC` | Chronological expense feed with pagination |
| `users/{userId}/expenses` | `categoryId ASC, date DESC` | Category-specific analytics and budget tracking |
| `users/{userId}/incomes` | `date DESC` | Monthly income list & dashboard rollup |
| `users/{userId}/budgets` | `year ASC, month ASC, type ASC` | Fetch active monthly budgets |
| `users/{userId}/investments` | `createdAt DESC` | Holdings list ordering |
| `users/{userId}/emis` | `status ASC, debitDay ASC` | Active EMI schedule and reminder checks |
| `users/{userId}/notifications` | `read ASC, createdAt DESC` | Unread notifications badge count & inbox |
| `families/{familyId}/expenses` | `date DESC` | Family activity feed |
