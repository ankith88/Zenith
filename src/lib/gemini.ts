import { Transaction, Account, Budget, Goal, db } from "./db";
import { formatLocalDate } from "./utils";

export class FinancialAnalystService {
  async parseReceipt(base64Image: string, mimeType: string): Promise<Partial<Transaction> & { sourceAccount?: string; destinationAccount?: string }> {
    const today = formatLocalDate();
    const response = await fetch('/api/ai/parse-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image, mimeType, today })
    });
    if (!response.ok) throw new Error("Failed to parse receipt via AI");
    return response.json();
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
    const today = formatLocalDate();
    const response = await fetch('/api/ai/parse-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, today })
    });
    if (!response.ok) throw new Error("Failed to parse voice via AI");
    return response.json();
  }

  async getInsights(query: string, transactions: Transaction[], accounts: Account[], budgets: Budget[], goals: Goal[]): Promise<string> {
    const today = formatLocalDate();
    const context = { transactions: transactions.slice(-100), accounts, budgets, goals };
    const response = await fetch('/api/ai/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, context, today })
    });
    if (!response.ok) throw new Error("Failed to get insights");
    const data = await response.json();
    return data.text;
  }

  async getFinancialHealthCheckup(transactions: Transaction[], accounts: Account[], budgets: Budget[], goals: Goal[]): Promise<string> {
    const today = formatLocalDate();
    const context = { transactions: transactions.slice(-100), accounts, budgets, goals };
    const response = await fetch('/api/ai/health-checkup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, today })
    });
    if (!response.ok) throw new Error("Failed to get health checkup");
    const data = await response.json();
    return data.text;
  }

  async predictCategory(description: string, categories: string[]): Promise<string> {
    const response = await fetch('/api/ai/predict-category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, categories })
    });
    if (!response.ok) return "Other";
    const data = await response.json();
    return data.category || "Other";
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
    const recentTransactions = transactions.slice(-200).map((t: any) => 
      `${t.date}, ${t.amount}, ${t.category}, ${t.description}`
    ).join('\n');

    const response = await fetch('/api/ai/audit-subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: recentTransactions })
    });
    return response.json();
  }

  async projectFutureExpenses(transactions: Transaction[]): Promise<{
    projectedTotal: number;
    reasoning: string;
    categoryBreakdown: Array<{ category: string; amount: number; confidence?: number }>;
    riskFactors?: string[];
  }> {
    const today = formatLocalDate();
    const response = await fetch('/api/ai/project-future', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: transactions.slice(-200), today })
    });
    if (!response.ok) throw new Error("Projection failed");
    return response.json();
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
    const recentTransactions = transactions.slice(-300).map((t: any) => 
      `${t.date}, ${t.amount}, ${t.category}, ${t.description}`
    ).join('\n');

    const response = await fetch('/api/ai/detect-anomalies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: recentTransactions })
    });
    if (!response.ok) throw new Error("Detection failed");
    return response.json();
  }

  async getSpendingMoodAnalysis(transactions: Transaction[]): Promise<{
    mood: string;
    description: string;
    insight: string;
    recommendation: string;
    score: number;
  }> {
    const recentTransactions = transactions.slice(-100).map((t: any) => 
      `${t.date}, ${t.amount}, ${t.category}, ${t.description}, ${t.type}`
    ).join('\n');

    const response = await fetch('/api/ai/spending-mood', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: recentTransactions })
    });
    if (!response.ok) throw new Error("Mood analysis failed");
    return response.json();
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
    const response = await fetch('/api/ai/budget-framing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: transactions.slice(-100), accounts })
    });
    if (!response.ok) throw new Error("Framing failed");
    return response.json();
  }

  async chatWithAgent(message: string, context: { transactions: Transaction[], accounts: Account[], budgets: Budget[] }): Promise<{
    text: string;
    actionPerformed?: string;
  }> {
    const today = formatLocalDate();
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context, today })
    });
    if (!response.ok) throw new Error("Chat failed");
    
    const data = await response.json();
    
    let actionPerformed = "";
    if (data.functionCalls && data.functionCalls.length > 0) {
      for (const call of data.functionCalls) {
        const args = call.args;
        if (call.name === "create_transaction") {
          await db.transactions.add({ ...args, synced: false });
          actionPerformed = `Created ${args.type} of $${args.amount} for ${args.description}.`;
        } else if (call.name === "transfer_money") {
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
          actionPerformed = `Transferred $${args.amount} from ${args.fromAccountId} to ${args.toAccountId}.`;
        } else if (call.name === "update_budget") {
          const existing = await db.budgets.where('category').equals(args.category).first();
          if (existing) {
            await db.budgets.update(existing.id!, { amount: args.amount, period: args.period, synced: false });
          } else {
            await db.budgets.add({ category: args.category, amount: args.amount, period: args.period, synced: false });
          }
          actionPerformed = `Updated budget for ${args.category} to $${args.amount}.`;
        }
      }
    }

    return { text: data.text || "I'm not sure how to help with that.", actionPerformed };
  }
}

export const analystService = new FinancialAnalystService();
