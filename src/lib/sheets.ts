import { Transaction, Account, db } from './db';
import { parseLocalDate } from './utils';

export class SheetsService {
  private spreadsheetId: string | null = null;
  private encodedTokens: string | null = null;
  private initialized: Promise<void>;
  private isSyncing = false;

  constructor() {
    this.spreadsheetId = localStorage.getItem('zenith_spreadsheet_id');
    this.encodedTokens = localStorage.getItem('zenith_tokens');
    this.initialized = this.initFromDB();
  }

  private async initFromDB() {
    try {
      // Prioritize DB over localStorage as it's more persistent in some mobile browsers
      const setting = await db.settings.get('zenith_spreadsheet_id');
      if (setting?.value) {
        this.spreadsheetId = setting.value;
        localStorage.setItem('zenith_spreadsheet_id', setting.value);
      }
      
      const tokenSetting = await db.settings.get('zenith_tokens');
      if (tokenSetting?.value) {
        this.encodedTokens = tokenSetting.value;
        localStorage.setItem('zenith_tokens', tokenSetting.value);
      }
      console.log("SheetsService: Initialized from DB. Tokens present:", !!this.encodedTokens);
    } catch (error) {
      console.error("SheetsService: DB init error:", error);
    }
  }

  private async ensureInitialized() {
    await this.initialized;
  }

  async setTokens(encodedTokens: string | null) {
    this.encodedTokens = encodedTokens;
    if (encodedTokens) {
      localStorage.setItem('zenith_tokens', encodedTokens);
      try {
        await db.settings.put({ key: 'zenith_tokens', value: encodedTokens });
      } catch (error) {
        console.error("DB save error:", error);
      }
    } else {
      localStorage.removeItem('zenith_tokens');
      try {
        await db.settings.delete('zenith_tokens');
      } catch (error) {
        console.error("DB delete error:", error);
      }
    }
  }

  private getHeaders(extraHeaders: Record<string, string> = {}) {
    const headers: Record<string, string> = { ...extraHeaders };
    if (this.encodedTokens) {
      headers['x-zenith-tokens'] = this.encodedTokens;
    }
    return headers;
  }

  private async safeFetch(url: string, options: RequestInit = {}, retries = 3, backoff = 1000) {
    try {
      const res = await fetch(url, options);
      const contentType = res.headers.get("content-type");
      
      if (res.status === 429 && retries > 0) {
        console.warn(`Rate limit hit for ${url}, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        return this.safeFetch(url, options, retries - 1, backoff * 2);
      }

      if (!res.ok) {
        if (res.status === 401) {
          console.error("SheetsService: Authentication failed (401). Clearing tokens.");
          await this.setTokens(null);
          // Optional: redirect to login or notify user
        }

        if (contentType && contentType.includes("application/json")) {
          const errorData = await res.json();
          throw new Error(errorData.error || `Request failed with status ${res.status}`);
        } else {
          const text = await res.text();
          throw new Error(text || `Request failed with status ${res.status}`);
        }
      }

      if (contentType && contentType.includes("application/json")) {
        return await res.json();
      }
      return await res.text();
    } catch (error: any) {
      if (error.message?.includes('Rate exceeded') && retries > 0) {
        console.warn(`Rate limit error for ${url}, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        return this.safeFetch(url, options, retries - 1, backoff * 2);
      }
      console.error(`Fetch error for ${url}:`, error);
      throw error;
    }
  }

  async setSpreadsheetId(id: string | null) {
    if (!id) return;
    this.spreadsheetId = id;
    localStorage.setItem('zenith_spreadsheet_id', id);
    try {
      await db.settings.put({ key: 'zenith_spreadsheet_id', value: id });
    } catch (error) {
      console.error("DB save error:", error);
    }
  }

  getSpreadsheetId() {
    return this.spreadsheetId;
  }

  async fetchAuthStatus() {
    await this.ensureInitialized();
    try {
      const data = await this.safeFetch(`/api/auth/status?t=${Date.now()}`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      
      const isAuthenticated = typeof data === 'object' && data !== null && data.isAuthenticated;
      console.log("SheetsService: Auth status check:", isAuthenticated);
      return data;
    } catch (error) {
      console.error("SheetsService: Auth status check failed:", error);
      return { isAuthenticated: false };
    }
  }

  async getAuthUrl() {
    await this.ensureInitialized();
    return await this.safeFetch('/api/auth/url', {
      headers: this.getHeaders()
    });
  }

  async createSheet() {
    await this.ensureInitialized();
    const data = await this.safeFetch('/api/sheets/create', { 
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders()
    });
    if (data.spreadsheetId) {
      await this.setSpreadsheetId(data.spreadsheetId);
    }
    return data;
  }

  async syncToLocal() {
    await this.ensureInitialized();
    if (!this.spreadsheetId) {
      console.warn("SheetsService: No spreadsheet ID for syncToLocal");
      return;
    }
    if (this.isSyncing) {
      console.log("SheetsService: Sync already in progress, skipping...");
      return;
    }

    this.isSyncing = true;
    try {
      console.log("SheetsService: Starting syncToLocal...");
      
      const fetchRange = async (range: string) => {
        try {
          return await this.safeFetch(`/api/sheets/data?spreadsheetId=${this.spreadsheetId}&range=${range}`, { credentials: 'include', headers: this.getHeaders() });
        } catch (e) {
          console.warn(`Failed to fetch range ${range}:`, e);
          return { values: [] };
        }
      };

      // Fetch all data first before starting transaction to keep transaction short
      const [accData, budData, recData, goalData, milestonesData, transData] = await Promise.all([
        fetchRange('Accounts!A2:M'),
        fetchRange('Budgets!A2:C'),
        fetchRange('Recurring!A2:J'),
        fetchRange('Goals!A2:H'),
        fetchRange('Milestones!A2:G'),
        fetchRange('Transactions!A2:I'),
      ]);

      await db.transaction('rw', [db.accounts, db.budgets, db.recurringTransactions, db.goals, db.milestones, db.transactions], async () => {
        // Sync Accounts
        if (accData.values) {
          const accounts: Account[] = accData.values
            .filter((row: any[]) => row && row.length >= 4 && isFinite(parseInt(row[0])))
            .map((row: any[]) => ({
              id: parseInt(row[0]),
              name: row[1],
              initialBalance: parseFloat(row[2]) || 0,
              type: row[3],
              interestRate: row[4] ? parseFloat(row[4]) : undefined,
              minPayment: row[5] ? parseFloat(row[5]) : undefined,
              owner: row[6] || undefined,
              isPrivate: row[7] === 'TRUE',
              assetValue: row[8] ? parseFloat(row[8]) : undefined,
              creditLimit: row[9] ? parseFloat(row[9]) : undefined,
              paymentFrequency: (row[10] as 'Monthly' | 'Weekly') || undefined,
              paymentDueDay: row[11] ? parseInt(row[11]) : undefined,
              lastInterestDate: row[12] || undefined,
              synced: true,
            }));
          await db.accounts.clear();
          // Deduplicate by ID
          const uniqueAccounts = Array.from(new Map(accounts.map(a => [a.id, a])).values());
          await db.accounts.bulkPut(uniqueAccounts);
        }

        // Sync Budgets
        if (budData.values) {
          const budgets: any[] = budData.values
            .filter((row: any[]) => row && row.length >= 2)
            .map((row: any[]) => ({
              category: row[0],
              amount: parseFloat(row[1]) || 0,
              period: row[2] || 'Monthly',
              synced: true,
            }));
          await db.budgets.clear();
          // Deduplicate by category
          const uniqueBudgets = Array.from(new Map(budgets.map(b => [b.category, b])).values());
          await db.budgets.bulkPut(uniqueBudgets);
        }

        // Sync Recurring
        if (recData.values) {
          const recurring: any[] = recData.values
            .filter((row: any[]) => row && row.length >= 8 && isFinite(parseInt(row[0])))
            .map((row: any[]) => ({
              id: parseInt(row[0]),
              description: row[1],
              amount: parseFloat(row[2]) || 0,
              category: row[3],
              type: row[4],
              accountId: parseInt(row[5]),
              frequency: row[6],
              startDate: row[7],
              lastProcessedDate: row[8] || undefined,
              toAccountId: row[9] ? parseInt(row[9]) : undefined,
              synced: true,
            }));
          await db.recurringTransactions.clear();
          // Deduplicate by ID
          const uniqueRecurring = Array.from(new Map(recurring.map(r => [r.id, r])).values());
          await db.recurringTransactions.bulkPut(uniqueRecurring);
        }

        // Sync Goals
        if (goalData.values) {
          const goals: any[] = goalData.values
            .filter((row: any[]) => row && row.length >= 4 && isFinite(parseInt(row[0])))
            .map((row: any[]) => ({
              id: parseInt(row[0]),
              name: row[1],
              targetAmount: parseFloat(row[2]) || 0,
              currentAmount: parseFloat(row[3]) || 0,
              deadline: row[4] || undefined,
              category: row[5],
              color: row[6],
              accountId: row[7] ? parseInt(row[7]) : undefined,
              synced: true,
            }));
          await db.goals.clear();
          // Deduplicate by ID
          const uniqueGoals = Array.from(new Map(goals.map(g => [g.id, g])).values());
          await db.goals.bulkPut(uniqueGoals);
        }

        // Sync Milestones
        if (milestonesData && milestonesData.values) {
          const milestones: any[] = milestonesData.values
            .filter((row: any[]) => row && row.length >= 3 && isFinite(parseInt(row[0])))
            .map((row: any[]) => ({
              id: parseInt(row[0]),
              type: row[1],
              name: row[2],
              description: row[3] || '',
              icon: row[4] || '',
              achievedDate: row[5],
              value: row[6] ? parseFloat(row[6]) : undefined,
              synced: true,
            }));
          await db.milestones.clear();
          const uniqueMilestones = Array.from(new Map(milestones.map(m => [m.id, m])).values());
          await db.milestones.bulkPut(uniqueMilestones);
        }

        // Sync Transactions
        if (transData.values) {
          const transactions: Transaction[] = transData.values
            .filter((row: any[]) => row && row.length >= 7 && isFinite(parseInt(row[0])))
            .map((row: any[]) => ({
              id: parseInt(row[0]),
              date: row[1],
              amount: parseFloat(row[2]) || 0,
              category: row[3],
              description: row[4],
              type: row[5] as 'Income' | 'Expense' | 'Transfer',
              accountId: parseInt(row[6]),
              toAccountId: row[7] ? parseInt(row[7]) : undefined,
              owner: row[8] || undefined,
              synced: true,
            }));
          
          await db.transactions.clear();
          // Deduplicate by ID
          const uniqueTransactions = Array.from(new Map(transactions.map(t => [t.id, t])).values());
          await db.transactions.bulkPut(uniqueTransactions);
        }
      });

      console.log("SheetsService: SyncToLocal completed successfully.");
    } catch (error: any) {
      console.error("Sync error:", error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  async syncToRemote() {
    await this.ensureInitialized();
    if (!this.spreadsheetId) return;
    try {
      console.log("SheetsService: Starting syncToRemote...");
      const accounts = await db.accounts.toArray();
      const budgets = await db.budgets.toArray();
      const recurring = await db.recurringTransactions.toArray();
      const transactions = await db.transactions.toArray();
      const goals = await db.goals.toArray();
      const milestones = await db.milestones.toArray();

      // 2. Clear sheets (except headers)
      const clearPromises = [
        this.safeFetch('/api/sheets/clear', { 
          method: 'POST', 
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }), 
          body: JSON.stringify({ spreadsheetId: this.spreadsheetId, range: 'Accounts!A2:M' }) 
        }),
        this.safeFetch('/api/sheets/clear', { 
          method: 'POST', 
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }), 
          body: JSON.stringify({ spreadsheetId: this.spreadsheetId, range: 'Budgets!A2:C' }) 
        }),
        this.safeFetch('/api/sheets/clear', { 
          method: 'POST', 
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }), 
          body: JSON.stringify({ spreadsheetId: this.spreadsheetId, range: 'Recurring!A2:J' }) 
        }),
        this.safeFetch('/api/sheets/clear', { 
          method: 'POST', 
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }), 
          body: JSON.stringify({ spreadsheetId: this.spreadsheetId, range: 'Transactions!A2:I' }) 
        }),
        this.safeFetch('/api/sheets/clear', { 
          method: 'POST', 
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }), 
          body: JSON.stringify({ spreadsheetId: this.spreadsheetId, range: 'Goals!A2:H' }) 
        }),
        this.safeFetch('/api/sheets/clear', { 
          method: 'POST', 
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }), 
          body: JSON.stringify({ spreadsheetId: this.spreadsheetId, range: 'Milestones!A2:G' }) 
        }),
      ];
      await Promise.all(clearPromises);

      // 3. Append all data
      const appendPromises = [];

      if (accounts.length > 0) {
        appendPromises.push(this.safeFetch('/api/sheets/append', {
          method: 'POST',
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            spreadsheetId: this.spreadsheetId,
            range: 'Accounts!A2:M',
            values: accounts.map(a => [a.id, a.name, a.initialBalance, a.type, a.interestRate || '', a.minPayment || '', a.owner || '', a.isPrivate ? 'TRUE' : 'FALSE', a.assetValue || '', a.creditLimit || '', a.paymentFrequency || '', a.paymentDueDay || '', a.lastInterestDate || '']),
          }),
        }));
      }

      if (budgets.length > 0) {
        appendPromises.push(this.safeFetch('/api/sheets/append', {
          method: 'POST',
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            spreadsheetId: this.spreadsheetId,
            range: 'Budgets!A2:C',
            values: budgets.map(b => [b.category, b.amount, b.period]),
          }),
        }));
      }

      const publicRecurring = recurring.filter(r => r.id !== undefined);
      if (publicRecurring.length > 0) {
        appendPromises.push(this.safeFetch('/api/sheets/append', {
          method: 'POST',
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            spreadsheetId: this.spreadsheetId,
            range: 'Recurring!A2:J',
            values: publicRecurring.map(r => [r.id, r.description, r.amount, r.category, r.type, r.accountId, r.frequency, r.startDate, r.lastProcessedDate || '', r.toAccountId || '']),
          }),
        }));
      }

      if (transactions.length > 0) {
        appendPromises.push(this.safeFetch('/api/sheets/append', {
          method: 'POST',
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            spreadsheetId: this.spreadsheetId,
            range: 'Transactions!A2:I',
            values: transactions.map(t => [t.id, t.date, t.amount, t.category, t.description, t.type, t.accountId, t.toAccountId || '', t.owner || '']),
          }),
        }));
      }

      if (goals.length > 0) {
        appendPromises.push(this.safeFetch('/api/sheets/append', {
          method: 'POST',
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            spreadsheetId: this.spreadsheetId,
            range: 'Goals!A2:H',
            values: goals.map(g => [g.id, g.name, g.targetAmount, g.currentAmount, g.deadline || '', g.category, g.color, g.accountId || '']),
          }),
        }));
      }

      if (milestones.length > 0) {
        appendPromises.push(this.safeFetch('/api/sheets/append', {
          method: 'POST',
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            spreadsheetId: this.spreadsheetId,
            range: 'Milestones!A2:G',
            values: milestones.map(m => [m.id, m.type, m.name, m.description, m.icon, m.achievedDate, m.value || '']),
          }),
        }));
      }

      await Promise.all(appendPromises);

      // 4. Mark all as synced locally
      await db.accounts.toCollection().modify({ synced: true });
      await db.budgets.toCollection().modify({ synced: true });
      await db.recurringTransactions.toCollection().modify({ synced: true });
      await db.transactions.toCollection().modify({ synced: true });
      await db.goals.toCollection().modify({ synced: true });
      await db.milestones.toCollection().modify({ synced: true });

    } catch (error) {
      console.error("Sync to remote error:", error);
      throw error;
    }
  }

  async appendAccount(a: Account) {
    if (!this.spreadsheetId) return;
    try {
      return await this.safeFetch('/api/sheets/append', {
        method: 'POST',
        credentials: 'include',
        headers: this.getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          spreadsheetId: this.spreadsheetId,
          range: 'Accounts!A2:M',
          values: [[a.id, a.name, a.initialBalance, a.type, a.interestRate || '', a.minPayment || '', a.owner || '', a.isPrivate ? 'TRUE' : 'FALSE', a.assetValue || '', a.creditLimit || '', a.paymentFrequency || '', a.paymentDueDay || '', a.lastInterestDate || '']],
        }),
      });
    } catch (error) {
      console.error("Append account error:", error);
    }
  }

  async appendTransaction(t: Transaction) {
    if (!this.spreadsheetId || !t.accountId || !isFinite(t.accountId)) return;

    try {
      return await this.safeFetch('/api/sheets/append', {
        method: 'POST',
        credentials: 'include',
        headers: this.getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          spreadsheetId: this.spreadsheetId,
          range: 'Transactions!A2:I',
          values: [[t.id, t.date, t.amount, t.category, t.description, t.type, t.accountId, t.toAccountId || '', t.owner || '']],
        }),
      });
    } catch (error) {
      console.error("Append error:", error);
    }
  }

  async updateTransaction(t: Transaction) {
    if (!this.spreadsheetId || !t.accountId || !isFinite(t.accountId)) return;

    try {
      // Find row index
      const data = await this.safeFetch(`/api/sheets/data?spreadsheetId=${this.spreadsheetId}&range=Transactions!A:A`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      const rowIndex = data.values?.findIndex((row: any[]) => parseInt(row[0]) === t.id);
      
      if (rowIndex !== undefined && rowIndex !== -1) {
        await this.safeFetch('/api/sheets/update', {
          method: 'POST',
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            spreadsheetId: this.spreadsheetId,
            range: `Transactions!A${rowIndex + 1}:I${rowIndex + 1}`,
            values: [[t.id, t.date, t.amount, t.category, t.description, t.type, t.accountId, t.toAccountId || '', t.owner || '']],
          }),
        });
      }
    } catch (error) {
      console.error("Update error:", error);
    }
  }

  async deleteTransaction(id: number) {
    if (!this.spreadsheetId) return;
    try {
      // Get sheet metadata to find Transactions sheetId
      const meta = await this.safeFetch(`/api/sheets/metadata?spreadsheetId=${this.spreadsheetId}`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      const sheetId = meta.sheets.find((s: any) => s.properties.title === 'Transactions')?.properties.sheetId;

      // Find row index
      const data = await this.safeFetch(`/api/sheets/data?spreadsheetId=${this.spreadsheetId}&range=Transactions!A:A`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      const rowIndex = data.values?.findIndex((row: any[]) => parseInt(row[0]) === id);

      if (sheetId !== undefined && rowIndex !== undefined && rowIndex !== -1) {
        await this.safeFetch('/api/sheets/delete-row', {
          method: 'POST',
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            spreadsheetId: this.spreadsheetId,
            sheetId,
            rowIndex,
          }),
        });
      }
    } catch (error) {
      console.error("Delete error:", error);
    }
  }

  async appendBudget(b: any) {
    if (!this.spreadsheetId) return;
    try {
      await this.safeFetch('/api/sheets/append', {
        method: 'POST',
        credentials: 'include',
        headers: this.getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          spreadsheetId: this.spreadsheetId,
          range: 'Budgets!A2:C',
          values: [[b.category, b.amount, b.period]],
        }),
      });
    } catch (error) {
      console.error("Append budget error:", error);
    }
  }

  async appendRecurring(r: any) {
    if (!this.spreadsheetId) return;
    try {
      await this.safeFetch('/api/sheets/append', {
        method: 'POST',
        credentials: 'include',
        headers: this.getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          spreadsheetId: this.spreadsheetId,
          range: 'Recurring!A2:J',
          values: [[r.id, r.description, r.amount, r.category, r.type, r.accountId, r.frequency, r.startDate, r.lastProcessedDate || '', r.toAccountId || '']],
        }),
      });
    } catch (error) {
      console.error("Append recurring error:", error);
    }
  }

  async updateRecurring(r: any) {
    if (!this.spreadsheetId) return;
    try {
      const data = await this.safeFetch(`/api/sheets/data?spreadsheetId=${this.spreadsheetId}&range=Recurring!A:A`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      const rowIndex = data.values?.findIndex((row: any[]) => parseInt(row[0]) === r.id);
      
      if (rowIndex !== undefined && rowIndex !== -1) {
        await this.safeFetch('/api/sheets/update', {
          method: 'POST',
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            spreadsheetId: this.spreadsheetId,
            range: `Recurring!A${rowIndex + 1}:J${rowIndex + 1}`,
            values: [[r.id, r.description, r.amount, r.category, r.type, r.accountId, r.frequency, r.startDate, r.lastProcessedDate || '', r.toAccountId || '']],
          }),
        });
      }
    } catch (error) {
      console.error("Update recurring error:", error);
    }
  }
  async updateAccount(a: Account) {
    if (!this.spreadsheetId) return;
    try {
      const data = await this.safeFetch(`/api/sheets/data?spreadsheetId=${this.spreadsheetId}&range=Accounts!A:A`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      const rowIndex = data.values?.findIndex((row: any[]) => parseInt(row[0]) === a.id);
      
      if (rowIndex !== undefined && rowIndex !== -1) {
        // Update existing row
        await this.safeFetch('/api/sheets/update', {
          method: 'POST',
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            spreadsheetId: this.spreadsheetId,
            range: `Accounts!A${rowIndex + 1}:M${rowIndex + 1}`,
            values: [[a.id, a.name, a.initialBalance, a.type, a.interestRate || '', a.minPayment || '', a.owner || '', a.isPrivate ? 'TRUE' : 'FALSE', a.assetValue || '', a.creditLimit || '', a.paymentFrequency || '', a.paymentDueDay || '', a.lastInterestDate || '']],
          }),
        });
      } else {
        // If not in sheet, append it
        await this.appendAccount(a);
      }
    } catch (error) {
      console.error("Update account error:", error);
    }
  }

  async appendGoal(g: any) {
    if (!this.spreadsheetId) return;
    try {
      await this.safeFetch('/api/sheets/append', {
        method: 'POST',
        credentials: 'include',
        headers: this.getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          spreadsheetId: this.spreadsheetId,
          range: 'Goals!A2:H',
          values: [[g.id, g.name, g.targetAmount, g.currentAmount, g.deadline || '', g.category, g.color, g.accountId || '']],
        }),
      });
    } catch (error) {
      console.error("Append goal error:", error);
    }
  }

  async updateGoal(g: any) {
    if (!this.spreadsheetId) return;
    try {
      const data = await this.safeFetch(`/api/sheets/data?spreadsheetId=${this.spreadsheetId}&range=Goals!A:A`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      const rowIndex = data.values?.findIndex((row: any[]) => parseInt(row[0]) === g.id);
      
      if (rowIndex !== undefined && rowIndex !== -1) {
        await this.safeFetch('/api/sheets/update', {
          method: 'POST',
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            spreadsheetId: this.spreadsheetId,
            range: `Goals!A${rowIndex + 1}:H${rowIndex + 1}`,
            values: [[g.id, g.name, g.targetAmount, g.currentAmount, g.deadline || '', g.category, g.color, g.accountId || '']],
          }),
        });
      }
    } catch (error) {
      console.error("Update goal error:", error);
    }
  }

  async deleteGoal(id: number) {
    if (!this.spreadsheetId) return;
    try {
      const meta = await this.safeFetch(`/api/sheets/metadata?spreadsheetId=${this.spreadsheetId}`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      const sheetId = meta.sheets.find((s: any) => s.properties.title === 'Goals')?.properties.sheetId;

      const data = await this.safeFetch(`/api/sheets/data?spreadsheetId=${this.spreadsheetId}&range=Goals!A:A`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      const rowIndex = data.values?.findIndex((row: any[]) => parseInt(row[0]) === id);

      if (sheetId !== undefined && rowIndex !== undefined && rowIndex !== -1) {
        await this.safeFetch('/api/sheets/delete-row', {
          method: 'POST',
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            spreadsheetId: this.spreadsheetId,
            sheetId,
            rowIndex,
          }),
        });
      }
    } catch (error) {
      console.error("Delete goal error:", error);
    }
  }

  async appendMilestone(m: any) {
    if (!this.spreadsheetId) return;
    try {
      await this.safeFetch('/api/sheets/append', {
        method: 'POST',
        credentials: 'include',
        headers: this.getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          spreadsheetId: this.spreadsheetId,
          range: 'Milestones!A2:G',
          values: [[m.id, m.type, m.name, m.description, m.icon, m.achievedDate, m.value || '']],
        }),
      });
    } catch (error) {
      console.error("Append milestone error:", error);
    }
  }

  async deleteMilestone(id: number) {
    if (!this.spreadsheetId) return;
    try {
      const meta = await this.safeFetch(`/api/sheets/metadata?spreadsheetId=${this.spreadsheetId}`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      const sheetId = meta.sheets.find((s: any) => s.properties.title === 'Milestones')?.properties.sheetId;

      const data = await this.safeFetch(`/api/sheets/data?spreadsheetId=${this.spreadsheetId}&range=Milestones!A:A`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      const rowIndex = data.values?.findIndex((row: any[]) => parseInt(row[0]) === id);

      if (sheetId !== undefined && rowIndex !== undefined && rowIndex !== -1) {
        await this.safeFetch('/api/sheets/delete-row', {
          method: 'POST',
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            spreadsheetId: this.spreadsheetId,
            sheetId,
            rowIndex,
          }),
        });
      }
    } catch (error) {
      console.error("Delete milestone error:", error);
    }
  }

  async deleteAccount(id: number) {
    if (!this.spreadsheetId) return;
    try {
      const meta = await this.safeFetch(`/api/sheets/metadata?spreadsheetId=${this.spreadsheetId}`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      const sheetId = meta.sheets.find((s: any) => s.properties.title === 'Accounts')?.properties.sheetId;

      const data = await this.safeFetch(`/api/sheets/data?spreadsheetId=${this.spreadsheetId}&range=Accounts!A:A`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      const rowIndex = data.values?.findIndex((row: any[]) => parseInt(row[0]) === id);

      if (sheetId !== undefined && rowIndex !== undefined && rowIndex !== -1) {
        await this.safeFetch('/api/sheets/delete-row', {
          method: 'POST',
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            spreadsheetId: this.spreadsheetId,
            sheetId,
            rowIndex,
          }),
        });
      }
    } catch (error) {
      console.error("Delete account error:", error);
    }
  }
}

export const sheetsService = new SheetsService();
