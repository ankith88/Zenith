import { Transaction, Account, Budget, Goal } from "./db";
import { formatLocalDate } from "./utils";

export class FinancialAnalystService {
  private async safeFetch(url: string, options: RequestInit) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'AI Request failed');
    }
    return response.json();
  }

  async parseReceipt(base64Image: string, mimeType: string): Promise<Partial<Transaction> & { sourceAccount?: string; destinationAccount?: string }> {
    return this.safeFetch('/api/ai/parse-receipt', {
      method: 'POST',
      body: JSON.stringify({ base64Image, mimeType, userDate: formatLocalDate() }),
    });
  }

  async parseVoiceTransaction(text: string): Promise<Partial<Transaction> & { sourceAccount?: string; destinationAccount?: string }> {
    return this.safeFetch('/api/ai/parse-voice', {
      method: 'POST',
      body: JSON.stringify({ text, userDate: formatLocalDate() }),
    });
  }

  async getInsights(query: string, transactions: Transaction[], accounts: Account[], budgets: Budget[], goals: Goal[]): Promise<string> {
    const data = await this.safeFetch('/api/ai/insights', {
      method: 'POST',
      body: JSON.stringify({ query, transactions, accounts, budgets, goals, userDate: formatLocalDate() }),
    });
    return data.text;
  }

  async getFinancialHealthCheckup(transactions: Transaction[], accounts: Account[], budgets: Budget[], goals: Goal[]): Promise<string> {
    const data = await this.safeFetch('/api/ai/health-checkup', {
      method: 'POST',
      body: JSON.stringify({ transactions, accounts, budgets, goals, userDate: formatLocalDate() }),
    });
    return data.text;
  }

  async predictCategory(description: string, categories: string[]): Promise<string> {
    const data = await this.safeFetch('/api/ai/predict-category', {
      method: 'POST',
      body: JSON.stringify({ description, categories, userDate: formatLocalDate() }),
    });
    return data.category;
  }

  async auditSubscriptions(transactions: Transaction[]): Promise<{
    subscriptions: {
      name: string;
      amount: number;
      frequency: string;
      category: string;
      lastDate: string;
      confidence: number;
      isPotentialWaste: boolean;
      reason?: string;
    }[];
  }> {
    return this.safeFetch('/api/ai/audit-subscriptions', {
      method: 'POST',
      body: JSON.stringify({ transactions, userDate: formatLocalDate() }),
    });
  }

  async detectSpendingAnomalies(transactions: Transaction[]): Promise<{
    anomalies: {
      type: string;
      description: string;
      amount: number;
      category: string;
      date: string;
      insight: string;
      severity: 'Low' | 'Medium' | 'High';
    }[];
  }> {
    return this.safeFetch('/api/ai/detect-anomalies', {
      method: 'POST',
      body: JSON.stringify({ transactions, userDate: formatLocalDate() }),
    });
  }
}

export const analystService = new FinancialAnalystService();
