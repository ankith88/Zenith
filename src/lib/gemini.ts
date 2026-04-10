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
    const recentTransactions = transactions.slice(-100).map(t => 
      `${t.date}, ${t.amount}, ${t.category}, ${t.description}, ${t.type}`
    ).join('\n');

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze these transactions to determine the user's "Spending Mood" (e.g., Stress Spending, Value Spending, Impulsive, Disciplined).
      Transactions:
      ${recentTransactions}`,
      config: {
        systemInstruction: "You are a financial psychologist. Analyze spending patterns to find emotional triggers or value-based alignment.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mood: { type: Type.STRING },
            description: { type: Type.STRING },
            insight: { type: Type.STRING },
            recommendation: { type: Type.STRING },
            score: { type: Type.NUMBER, description: "A mood score from 0-100 where 100 is perfectly disciplined/value-aligned." }
          },
          required: ["mood", "description", "insight", "recommendation", "score"]
        }
      }
    });

    return JSON.parse(response.text);
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
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const recentTransactions = transactions.filter(t => new Date(t.date) >= ninetyDaysAgo).map(t => 
      `${t.date}, ${t.amount}, ${t.category}, ${t.description}, ${t.type}`
    ).join('\n');

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Analyze the past 90 days of transactions to suggest a structured budget methodology (50/30/20 or Zero-Based).
      Transactions:
      ${recentTransactions}`,
      config: {
        systemInstruction: "You are a financial architect. Analyze income and spending to frame a perfect budget structure. Group categories into Needs, Wants, and Savings/Debt for 50/30/20, or allocate every dollar for Zero-Based.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            methodology: { type: Type.STRING, enum: ["50/30/20", "Zero-Based", "Custom"] },
            analysis: { type: Type.STRING },
            suggestedBudgets: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  period: { type: Type.STRING, enum: ["Monthly", "Weekly"] },
                  type: { type: Type.STRING, enum: ["Needs", "Wants", "Savings/Debt"] }
                },
                required: ["category", "amount", "period", "type"]
              }
            },
            currentStats: {
              type: Type.OBJECT,
              properties: {
                avgMonthlyIncome: { type: Type.NUMBER },
                avgMonthlyExpense: { type: Type.NUMBER }
              },
              required: ["avgMonthlyIncome", "avgMonthlyExpense"]
            }
          },
          required: ["methodology", "analysis", "suggestedBudgets", "currentStats"]
        }
      }
    });

    return JSON.parse(response.text);
  }

  async chatWithAgent(message: string, context: { transactions: Transaction[], accounts: Account[], budgets: Budget[] }): Promise<{
    text: string;
    actionPerformed?: string;
  }> {
    const today = formatLocalDate();
    const accountContext = context.accounts.map(a => `ID: ${a.id}, Name: ${a.name}, Type: ${a.type}`).join('\n');
    
    const systemInstruction = `You are Zenith, a high-end personal financial agent. 
    You can help users manage their money by creating transactions, transferring funds, and updating budgets.
    
    Today's Date: ${today}
    
    Available Accounts:
    ${accountContext}
    
    When a user asks to move money, create a transaction, or update a budget, use the provided tools.
    Always confirm the action you are taking. If you need more information (like which account to use), ask the user.
    
    If the user just wants to talk or ask a question, provide insightful financial advice.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: message,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: [createTransactionTool, transferMoneyTool, updateBudgetTool] }]
      }
    });

    const functionCalls = response.functionCalls;
    if (functionCalls) {
      let actionPerformed = "";
      for (const call of functionCalls) {
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
      
      // After performing action, get a final response from the model
      const finalResponse = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          { role: "user", parts: [{ text: message }] },
          { role: "model", parts: [{ text: `I have performed the following action: ${actionPerformed}` }] }
        ],
        config: { systemInstruction }
      });
      
      return { text: finalResponse.text, actionPerformed };
    }

    return { text: response.text };
  }
}

export const analystService = new FinancialAnalystService();
