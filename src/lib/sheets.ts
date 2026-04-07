import { Transaction, Account, db } from './db';

export class SheetsService {
  private spreadsheetId: string | null = localStorage.getItem('zenith_spreadsheet_id');
  private encodedTokens: string | null = localStorage.getItem('zenith_tokens');

  constructor() {
    this.initFromDB();
  }

  private async initFromDB() {
    try {
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
    } catch (error) {
      console.error("DB init error:", error);
    }
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
    try {
      const res = await fetch(`/api/auth/status?t=${Date.now()}`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      if (!res.ok) throw new Error("Auth check failed");
      return res.json();
    } catch (error) {
      return { isAuthenticated: false };
    }
  }

  async getAuthUrl() {
    const res = await fetch('/api/auth/url', {
      headers: this.getHeaders()
    });
    return res.json();
  }

  async createSheet() {
    const res = await fetch('/api/sheets/create', { 
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders()
    });
    const data = await res.json();
    if (data.spreadsheetId) {
      this.setSpreadsheetId(data.spreadsheetId);
    }
    return data;
  }

  async syncToLocal() {
    if (!this.spreadsheetId) return;
    try {
      // Sync Accounts
      const accRes = await fetch(`/api/sheets/data?spreadsheetId=${this.spreadsheetId}&range=Accounts!A2:D`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      const accData = await accRes.json();
      if (accData.values) {
        const accounts: Account[] = accData.values.map((row: any[]) => ({
          id: parseInt(row[0]),
          name: row[1],
          initialBalance: parseFloat(row[2]),
          type: row[3],
          synced: true,
        }));
        await db.accounts.clear();
        await db.accounts.bulkAdd(accounts);
      }

      // Sync Budgets
      const budRes = await fetch(`/api/sheets/data?spreadsheetId=${this.spreadsheetId}&range=Budgets!A2:C`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      const budData = await budRes.json();
      if (budData.values) {
        const budgets: any[] = budData.values.map((row: any[]) => ({
          category: row[0],
          amount: parseFloat(row[1]),
          period: row[2],
          synced: true,
        }));
        await db.budgets.clear();
        await db.budgets.bulkAdd(budgets);
      }

      // Sync Recurring
      const recRes = await fetch(`/api/sheets/data?spreadsheetId=${this.spreadsheetId}&range=Recurring!A2:J`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      const recData = await recRes.json();
      if (recData.values) {
        const recurring: any[] = recData.values.map((row: any[]) => ({
          id: parseInt(row[0]),
          description: row[1],
          amount: parseFloat(row[2]),
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
        await db.recurringTransactions.bulkAdd(recurring);
      }

      // Sync Transactions
      const res = await fetch(`/api/sheets/data?spreadsheetId=${this.spreadsheetId}&range=Transactions!A2:H`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      const data = await res.json();
      if (data.values) {
        const transactions: Transaction[] = data.values.map((row: any[]) => ({
          id: parseInt(row[0]),
          date: row[1],
          amount: parseFloat(row[2]),
          category: row[3],
          description: row[4],
          type: row[5] as 'Income' | 'Expense' | 'Transfer',
          accountId: parseInt(row[6]),
          toAccountId: row[7] ? parseInt(row[7]) : undefined,
          synced: true,
        }));
        
        await db.transactions.clear();
        await db.transactions.bulkAdd(transactions);
      }
    } catch (error) {
      console.error("Sync error:", error);
    }
  }

  async syncToRemote() {
    if (!this.spreadsheetId) return;
    try {
      // 1. Get all data from Dexie
      const accounts = await db.accounts.toArray();
      const budgets = await db.budgets.toArray();
      const recurring = await db.recurringTransactions.toArray();
      const transactions = await db.transactions.toArray();

      // 2. Clear sheets (except headers)
      const clearPromises = [
        fetch('/api/sheets/clear', { 
          method: 'POST', 
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }), 
          body: JSON.stringify({ spreadsheetId: this.spreadsheetId, range: 'Accounts!A2:D' }) 
        }),
        fetch('/api/sheets/clear', { 
          method: 'POST', 
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }), 
          body: JSON.stringify({ spreadsheetId: this.spreadsheetId, range: 'Budgets!A2:C' }) 
        }),
        fetch('/api/sheets/clear', { 
          method: 'POST', 
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }), 
          body: JSON.stringify({ spreadsheetId: this.spreadsheetId, range: 'Recurring!A2:J' }) 
        }),
        fetch('/api/sheets/clear', { 
          method: 'POST', 
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }), 
          body: JSON.stringify({ spreadsheetId: this.spreadsheetId, range: 'Transactions!A2:H' }) 
        }),
      ];
      await Promise.all(clearPromises);

      // 3. Append all data
      const appendPromises = [];

      if (accounts.length > 0) {
        appendPromises.push(fetch('/api/sheets/append', {
          method: 'POST',
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            spreadsheetId: this.spreadsheetId,
            range: 'Accounts!A2:D',
            values: accounts.map(a => [a.id, a.name, a.initialBalance, a.type]),
          }),
        }));
      }

      if (budgets.length > 0) {
        appendPromises.push(fetch('/api/sheets/append', {
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

      if (recurring.length > 0) {
        appendPromises.push(fetch('/api/sheets/append', {
          method: 'POST',
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            spreadsheetId: this.spreadsheetId,
            range: 'Recurring!A2:J',
            values: recurring.map(r => [r.id, r.description, r.amount, r.category, r.type, r.accountId, r.frequency, r.startDate, r.lastProcessedDate || '', r.toAccountId || '']),
          }),
        }));
      }

      if (transactions.length > 0) {
        appendPromises.push(fetch('/api/sheets/append', {
          method: 'POST',
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            spreadsheetId: this.spreadsheetId,
            range: 'Transactions!A2:H',
            values: transactions.map(t => [t.id, t.date, t.amount, t.category, t.description, t.type, t.accountId, t.toAccountId || '']),
          }),
        }));
      }

      await Promise.all(appendPromises);

      // 4. Mark all as synced locally
      await db.accounts.toCollection().modify({ synced: true });
      await db.budgets.toCollection().modify({ synced: true });
      await db.recurringTransactions.toCollection().modify({ synced: true });
      await db.transactions.toCollection().modify({ synced: true });

    } catch (error) {
      console.error("Sync to remote error:", error);
      throw error;
    }
  }

  async appendAccount(a: Account) {
    if (!this.spreadsheetId) return;
    try {
      const res = await fetch('/api/sheets/append', {
        method: 'POST',
        credentials: 'include',
        headers: this.getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          spreadsheetId: this.spreadsheetId,
          range: 'Accounts!A2:D',
          values: [[a.id, a.name, a.initialBalance, a.type]],
        }),
      });
      return res.json();
    } catch (error) {
      console.error("Append account error:", error);
    }
  }

  async appendTransaction(t: Transaction) {
    if (!this.spreadsheetId) return;
    try {
      const res = await fetch('/api/sheets/append', {
        method: 'POST',
        credentials: 'include',
        headers: this.getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          spreadsheetId: this.spreadsheetId,
          range: 'Transactions!A2:H',
          values: [[t.id, t.date, t.amount, t.category, t.description, t.type, t.accountId, t.toAccountId || '']],
        }),
      });
      return res.json();
    } catch (error) {
      console.error("Append error:", error);
    }
  }

  async updateTransaction(t: Transaction) {
    if (!this.spreadsheetId) return;
    try {
      // Find row index
      const res = await fetch(`/api/sheets/data?spreadsheetId=${this.spreadsheetId}&range=Transactions!A:A`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      const data = await res.json();
      const rowIndex = data.values?.findIndex((row: any[]) => parseInt(row[0]) === t.id);
      
      if (rowIndex !== undefined && rowIndex !== -1) {
        await fetch('/api/sheets/update', {
          method: 'POST',
          credentials: 'include',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            spreadsheetId: this.spreadsheetId,
            range: `Transactions!A${rowIndex + 1}:H${rowIndex + 1}`,
            values: [[t.id, t.date, t.amount, t.category, t.description, t.type, t.accountId, t.toAccountId || '']],
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
      const metaRes = await fetch(`/api/sheets/metadata?spreadsheetId=${this.spreadsheetId}`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      const meta = await metaRes.json();
      const sheetId = meta.sheets.find((s: any) => s.properties.title === 'Transactions')?.properties.sheetId;

      // Find row index
      const res = await fetch(`/api/sheets/data?spreadsheetId=${this.spreadsheetId}&range=Transactions!A:A`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      const data = await res.json();
      const rowIndex = data.values?.findIndex((row: any[]) => parseInt(row[0]) === id);

      if (sheetId !== undefined && rowIndex !== undefined && rowIndex !== -1) {
        await fetch('/api/sheets/delete-row', {
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
      await fetch('/api/sheets/append', {
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
      await fetch('/api/sheets/append', {
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
      const res = await fetch(`/api/sheets/data?spreadsheetId=${this.spreadsheetId}&range=Recurring!A:A`, {
        credentials: 'include',
        headers: this.getHeaders()
      });
      const data = await res.json();
      const rowIndex = data.values?.findIndex((row: any[]) => parseInt(row[0]) === r.id);
      
      if (rowIndex !== undefined && rowIndex !== -1) {
        await fetch('/api/sheets/update', {
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
}

export const sheetsService = new SheetsService();
