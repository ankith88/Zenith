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
  async parseReceipt(base64Image: string, mimeType: string): Promise<Partial<Transaction> & { sourceAccount?: string; destinationAccount?: string }> {
    const today = formatLocalDate();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
        {
          text: `Extract transaction details from this receipt. 
          Return a JSON object with: date (YYYY-MM-DD), amount (number), category (string), description (string), type (Income/Expense/Transfer).
          If date is not found, use today's date: ${today}.`,
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING },
            description: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["Income", "Expense", "Transfer"] },
            sourceAccount: { type: Type.STRING },
            destinationAccount: { type: Type.STRING },
          },
          required: ["date", "amount", "category", "description", "type"],
        },
      }
    });

    if (!response.text) throw new Error("Could not parse receipt");
    return JSON.parse(response.text);
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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this spoken input: "${text}". 
      Determine if the user wants to record a transaction (intent: "transaction") or ask a question about their finances (intent: "query").
      
      If it's a transaction, parse it into structured JSON.
      If it's a query, just return the intent and the original text.
      
      Today's date: ${today}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: { type: Type.STRING, enum: ["transaction", "query"] },
            date: { type: Type.STRING, description: "Only for transactions" },
            amount: { type: Type.NUMBER, description: "Only for transactions" },
            category: { type: Type.STRING, description: "Only for transactions" },
            description: { type: Type.STRING, description: "Only for transactions" },
            type: { type: Type.STRING, enum: ["Income", "Expense", "Transfer"], description: "Only for transactions" },
            sourceAccount: { type: Type.STRING, description: "Only for transactions" },
            destinationAccount: { type: Type.STRING, description: "Only for transactions" },
            query: { type: Type.STRING, description: "The original text if intent is query" }
          },
          required: ["intent"],
        },
      }
    });

    if (!response.text) throw new Error("Could not parse voice input");
    return JSON.parse(response.text);
  }

  async getInsights(query: string, transactions: Transaction[], accounts: Account[], budgets: Budget[], goals: Goal[]): Promise<string> {
    const today = formatLocalDate();
    const transactionContext = transactions.map((t: any) => 
      `${t.date}, ${t.amount}, ${t.category}, ${t.description}, ${t.type}`
    ).join('\n');

    const accountContext = accounts.map((a: any) => 
      `${a.name}, ${a.type}, Initial Balance: ${a.initialBalance}`
    ).join('\n');

    const budgetContext = budgets.map((b: any) => 
      `${b.category}, ${b.amount}, ${b.period}`
    ).join('\n');

    const systemPrompt = `You are Zenith, a high-end personal finance AI analyst. 
    You have access to the user's full financial profile.
    
    Data Context:
    ACCOUNTS:
    ${accountContext}
    
    BUDGETS:
    ${budgetContext}
    
    TRANSACTIONS (CSV: Date, Amount, Category, Description, Type):
    ${transactionContext}
    
    Current Date: ${today}
    
    Your goals:
    1. Provide deep reasoning over the data.
    2. Identify spending outliers and trends.
    3. Compare actual spending against the user's defined BUDGETS.
    4. Suggest actionable savings strategies based on their specific habits.
    
    Answer the user's query concisely but with high-end financial insight. Use Markdown for formatting.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: query,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    return response.text || "No insights found.";
  }

  async getFinancialHealthCheckup(transactions: Transaction[], accounts: Account[], budgets: Budget[], goals: Goal[]): Promise<string> {
    const today = formatLocalDate();
    const transactionContext = transactions.slice(-100).map((t: any) => 
      `${t.date}, ${t.amount}, ${t.category}, ${t.description}, ${t.type}`
    ).join('\n');

    const accountContext = accounts.map((a: any) => 
      `${a.name}, ${a.type}, Initial Balance: ${a.initialBalance}`
    ).join('\n');

    const budgetContext = budgets.map((b: any) => 
      `${b.category}, ${b.amount}, ${b.period}`
    ).join('\n');

    const systemPrompt = `You are Zenith, a high-end personal finance AI analyst. 
    Perform a comprehensive "Financial Health Checkup" for the user.
    
    Data Context:
    ACCOUNTS:
    ${accountContext}
    
    BUDGETS:
    ${budgetContext}
    
    RECENT TRANSACTIONS:
    ${transactionContext}
    
    Current Date: ${today}
    
    Your report MUST include:
    1. Financial Health Score (0-100)
    2. Spending Efficiency
    3. Burn Rate Analysis
    4. Top 3 Actionable Recommendations
    
    Use Markdown.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: "Generate my comprehensive financial health checkup report.",
      config: {
        systemInstruction: systemPrompt,
      },
    });

    return response.text || "Health report currently unavailable.";
  }

  async predictCategory(description: string, categories: string[]): Promise<string> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Predict the best category for this transaction description: "${description}". 
      Available categories: ${categories.join(', ')}.
      Return ONLY the category name from the list. If none fit well, return "Other".`,
    });
    return response.text.trim();
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

    const response = await ai.models.generateContent({ 
      model: "gemini-3-flash-preview",
      contents: `Analyze these transactions to identify recurring subscriptions or fixed monthly costs.
      Transactions:
      ${recentTransactions}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subscriptions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  frequency: { type: Type.STRING },
                  category: { type: Type.STRING },
                  lastDate: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  isPotentialWaste: { type: Type.BOOLEAN },
                  reason: { type: Type.STRING },
                },
                required: ["name", "amount", "frequency", "category", "lastDate", "confidence", "isPotentialWaste"],
              },
            },
          },
          required: ["subscriptions"],
        },
      }
    });

    if (!response.text) throw new Error("Audit failed");
    return JSON.parse(response.text);
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

    const response = await ai.models.generateContent({ 
      model: "gemini-3-flash-preview",
      contents: `Analyze these transactions for spending anomalies or unusual patterns.
      Transactions:
      ${recentTransactions}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            anomalies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  category: { type: Type.STRING },
                  date: { type: Type.STRING },
                  insight: { type: Type.STRING },
                  severity: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
                },
                required: ["type", "description", "amount", "category", "date", "insight", "severity"],
              },
            },
          },
          required: ["anomalies"],
        },
      }
    });

    if (!response.text) throw new Error("Detection failed");
    return JSON.parse(response.text);
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
            score: { type: Type.NUMBER },
          },
          required: ["mood", "description", "insight", "recommendation", "score"],
        },
      }
    });

    if (!response.text) throw new Error("Mood analysis failed");
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
    
    let filteredTransactions = transactions.filter((t: any) => new Date(t.date) >= ninetyDaysAgo);
    if (filteredTransactions.length === 0) filteredTransactions = transactions.slice(-100);

    const recentTransactions = filteredTransactions.map((t: any) => 
      `${t.date}, ${t.amount}, ${t.category}, ${t.description}, ${t.type}`
    ).join('\n');

    const response = await ai.models.generateContent({ 
      model: "gemini-3.1-pro-preview",
      contents: `Analyze the past transaction history to suggest a structured budget methodology.
      Transactions:
      ${recentTransactions}`,
      config: {
        systemInstruction: "You are a financial architect. Analyze income and spending to frame a perfect budget structure.",
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

    if (!response.text) throw new Error("Framing failed");
    return JSON.parse(response.text);
  }

  async chatWithAgent(message: string, context: { transactions: Transaction[], accounts: Account[], budgets: Budget[] }): Promise<{
    text: string;
    actionPerformed?: string;
  }> {
    const today = formatLocalDate();
    const accountContext = context.accounts.map((a: any) => `ID: ${a.id}, Name: ${a.name}, Type: ${a.type}`).join('\n');
    
    const systemInstruction = `You are Zenith, a high-end personal financial agent. 
    Today's Date: ${today}
    Available Accounts:
    ${accountContext}
    Confirm the action you are taking. If you need more info, ask.`;

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
        const args = call.args as any;
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
          actionPerformed = `Transferred $${args.amount} from account ${args.fromAccountId} to ${args.toAccountId}.`;
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
      
      const followUp = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          { role: "user", parts: [{ text: message }] },
          { role: "model", parts: [{ text: `I have performed the following action: ${actionPerformed}` }] }
        ],
        config: { systemInstruction }
      });
      return { text: followUp.text || "Done", actionPerformed };
    }

    return { text: response.text || "I'm not sure how to help with that." };
  }
}

export const analystService = new FinancialAnalystService();
