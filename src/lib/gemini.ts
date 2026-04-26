import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Transaction, Account, Budget, Goal, db } from "./db";
import { formatLocalDate } from "./utils";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const createTransactionTool: FunctionDeclaration = {
  name: "create_transaction",
  description: "Create a new financial transaction (Income or Expense).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      date: { type: Type.STRING, description: "Date in YYYY-MM-DD format." },
      amount: { type: Type.NUMBER, description: "The transaction amount." },
      category: { type: Type.STRING, description: "The category of the transaction." },
      description: { type: Type.STRING, description: "A brief description." },
      type: { type: Type.STRING, enum: ["Income", "Expense"], description: "The type of transaction." },
      accountId: { type: Type.NUMBER, description: "The ID of the account." }
    },
    required: ["date", "amount", "category", "description", "type", "accountId"]
  }
};

const transferMoneyTool: FunctionDeclaration = {
  name: "transfer_money",
  description: "Transfer money between two accounts.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      date: { type: Type.STRING, description: "Date in YYYY-MM-DD format." },
      amount: { type: Type.NUMBER, description: "The amount to transfer." },
      description: { type: Type.STRING, description: "A brief description." },
      fromAccountId: { type: Type.NUMBER, description: "The source account ID." },
      toAccountId: { type: Type.NUMBER, description: "The destination account ID." }
    },
    required: ["date", "amount", "description", "fromAccountId", "toAccountId"]
  }
};

const updateBudgetTool: FunctionDeclaration = {
  name: "update_budget",
  description: "Update or create a budget for a category.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: { type: Type.STRING, description: "The category name." },
      amount: { type: Type.NUMBER, description: "The monthly budget amount." },
      period: { type: Type.STRING, enum: ["Monthly", "Weekly"], description: "The budget period." }
    },
    required: ["category", "amount", "period"]
  }
};

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

  async parseVoiceTransaction(text: string): Promise<{
    intent: 'transaction' | 'query';
    date?: string;
    amount?: number;
    category?: string;
    description?: string;
    type?: 'Income' | 'Expense' | 'Transfer';
    sourceAccount?: string;
    destinationAccount?: string;
    query?: string;
  }> {
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

  async getSpendingMoodAnalysis(transactions: Transaction[]): Promise<{
    mood: string;
    description: string;
    insight: string;
    recommendation: string;
    score: number;
  }> {
    return this.safeFetch('/api/ai/spending-mood', {
      method: 'POST',
      body: JSON.stringify({ transactions, userDate: formatLocalDate() }),
    });
  }

  async getBudgetFraming(transactions: Transaction[], accounts: Account[]): Promise<{
    methodology: '50/30/20' | 'Zero-Based' | 'Custom';
    analysis: string;
    suggestedBudgets: {
      category: string;
      amount: number;
      period: 'Monthly' | 'Weekly';
      type: 'Needs' | 'Wants' | 'Savings/Debt';
    }[];
    currentStats: {
      avgMonthlyIncome: number;
      avgMonthlyExpense: number;
    };
  }> {
    return this.safeFetch('/api/ai/budget-framing', {
      method: 'POST',
      body: JSON.stringify({ transactions, accounts, userDate: formatLocalDate() }),
    });
  }

  async chatWithAgent(message: string, context: { transactions: Transaction[], accounts: Account[], budgets: Budget[] }): Promise<{
    text: string;
    actionPerformed?: string;
  }> {
    // Send to backend to get response (and potential tool calls)
    const data = await this.safeFetch('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, context, userDate: formatLocalDate() }),
    });

    if (data.functionCalls) {
      let actionPerformed = "";
      for (const call of data.functionCalls) {
        if (call.name === "create_transaction") {
          const args = call.args as any;
          await db.transactions.add({
            date: args.date,
            amount: args.amount,
            category: args.category,
            description: args.description,
            type: args.type,
            accountId: args.accountId,
            synced: false
          });
          actionPerformed = `Created ${args.type} of $${args.amount} for ${args.description} in ${args.category}.`;
        } else if (call.name === "transfer_money") {
          const args = call.args as any;
          await db.transactions.add({
            date: args.date,
            amount: args.amount,
            category: "Transfer",
            description: args.description,
            type: "Transfer",
            accountId: args.fromAccountId,
            toAccountId: args.toAccountId,
            synced: false
          });
          actionPerformed = `Transferred $${args.amount} from account ${args.fromAccountId} to ${args.toAccountId}.`;
        } else if (call.name === "update_budget") {
          const args = call.args as any;
          const existing = await db.budgets.where('category').equals(args.category).first();
          if (existing) {
            await db.budgets.update(existing.id!, { amount: args.amount, period: args.period, synced: false });
          } else {
            await db.budgets.add({ category: args.category, amount: args.amount, period: args.period, synced: false });
          }
          actionPerformed = `Updated budget for ${args.category} to $${args.amount} per ${args.period}.`;
        }
      }
      
      // Get the follow-up response from backend
      const followUp = await this.safeFetch('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ 
          message, 
          context, 
          actionPerformed,
          isFollowUp: true,
          userDate: formatLocalDate() 
        }),
      });
      
      return { text: followUp.text, actionPerformed };
    }

    return { text: data.text };
  }
}

export const analystService = new FinancialAnalystService();
