import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Account, Budget } from "./db";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenAI({ apiKey });

export class FinancialAnalystService {
  async parseReceipt(base64Image: string, mimeType: string): Promise<Partial<Transaction> & { sourceAccount?: string; destinationAccount?: string }> {
    const response = await genAI.models.generateContent({
      model: "gemini-3.1-flash-preview",
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
          If it's a Transfer, try to identify the source and destination if possible.
          If date is not found, use today's date: ${new Date().toISOString().split('T')[0]}.`,
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
            sourceAccount: { type: Type.STRING, description: "Name of source account if Transfer" },
            destinationAccount: { type: Type.STRING, description: "Name of destination account if Transfer" },
          },
          required: ["date", "amount", "category", "description", "type"],
        },
      },
    });

    return JSON.parse(response.text);
  }

  async parseVoiceTransaction(text: string): Promise<Partial<Transaction> & { sourceAccount?: string; destinationAccount?: string }> {
    const response = await genAI.models.generateContent({
      model: "gemini-3.1-flash-preview",
      contents: `Parse this spoken transaction into structured JSON: "${text}". 
      Return a JSON object with: date (YYYY-MM-DD), amount (number), category (string), description (string), type (Income/Expense/Transfer).
      If it's a Transfer, identify sourceAccount and destinationAccount names.
      If date is not mentioned, use today's date: ${new Date().toISOString().split('T')[0]}.`,
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
      },
    });

    return JSON.parse(response.text);
  }

  async getInsights(query: string, transactions: Transaction[], accounts: Account[], budgets: Budget[]): Promise<string> {
    const transactionContext = transactions.map(t => 
      `${t.date}, ${t.amount}, ${t.category}, ${t.description}, ${t.type}`
    ).join('\n');

    const accountContext = accounts.map(a => 
      `${a.name}, ${a.type}, Initial Balance: ${a.initialBalance}`
    ).join('\n');

    const budgetContext = budgets.map(b => 
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
    
    Current Date: ${new Date().toISOString().split('T')[0]}
    
    Your goals:
    1. Provide deep reasoning over the data.
    2. Identify spending outliers and trends (e.g., "You spent 20% more on groceries this month").
    3. Compare actual spending against the user's defined BUDGETS.
    4. Suggest actionable savings strategies based on their specific habits.
    5. Calculate "Safe to Spend" daily limits based on current burn rate and upcoming recurring costs.
    6. Be proactive and insightful, not just reactive.
    
    Answer the user's query concisely but with high-end financial insight. Use Markdown for formatting.`;

    const response = await genAI.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: query,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    return response.text;
  }
}

export const analystService = new FinancialAnalystService();
