import Dexie, { type Table } from 'dexie';

export interface Account {
  id?: number;
  name: string;
  initialBalance: number;
  type: string;
  interestRate?: number;
  minPayment?: number;
  lastInterestDate?: string;
  owner?: string;
  isPrivate?: boolean;
  assetValue?: number;
  creditLimit?: number;
  paymentFrequency?: 'Monthly' | 'Weekly';
  paymentDueDay?: number; // Day of month (1-31) or day of week (0-6)
  synced: boolean;
}

export interface Transaction {
  id?: number;
  date: string;
  amount: number;
  category: string;
  description: string;
  type: 'Income' | 'Expense' | 'Transfer';
  accountId: number; // Reference to Account.id (Source for Transfer)
  toAccountId?: number; // Reference to Account.id (Destination for Transfer)
  owner?: string;
  synced: boolean;
}

export interface Budget {
  id?: number;
  category: string;
  amount: number;
  period: 'Monthly' | 'Weekly';
  synced: boolean;
}

export interface RecurringTransaction {
  id?: number;
  description: string;
  amount: number;
  category: string;
  type: 'Income' | 'Expense' | 'Transfer';
  accountId: number;
  toAccountId?: number;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
  startDate: string;
  lastProcessedDate?: string;
  synced: boolean;
}

export interface AppSetting {
  key: string;
  value: any;
}

export interface Goal {
  id?: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  category: string;
  color: string;
  synced: boolean;
}

export class ZenithDB extends Dexie {
  transactions!: Table<Transaction>;
  accounts!: Table<Account>;
  budgets!: Table<Budget>;
  recurringTransactions!: Table<RecurringTransaction>;
  goals!: Table<Goal>;
  settings!: Table<AppSetting>;

  constructor() {
    super('ZenithDB');
    this.version(11).stores({
      transactions: '++id, date, category, type, accountId, toAccountId, synced',
      accounts: '++id, name, type, isPrivate, synced',
      budgets: '++id, category, synced',
      recurringTransactions: '++id, frequency, accountId, toAccountId, synced',
      goals: '++id, name, category, synced',
      settings: 'key'
    });
  }
}

let db: ZenithDB;
try {
  db = new ZenithDB();
} catch (error) {
  console.error("Failed to initialize Dexie:", error);
  // Create a minimal fallback that won't crash the app
  db = {
    transactions: { toArray: () => Promise.resolve([]), add: () => Promise.resolve(0), update: () => Promise.resolve(0) },
    accounts: { toArray: () => Promise.resolve([]), add: () => Promise.resolve(0), update: () => Promise.resolve(0) },
    budgets: { toArray: () => Promise.resolve([]), add: () => Promise.resolve(0), update: () => Promise.resolve(0) },
    recurringTransactions: { toArray: () => Promise.resolve([]), add: () => Promise.resolve(0), update: () => Promise.resolve(0) }
  } as unknown as ZenithDB;
}

export { db };
