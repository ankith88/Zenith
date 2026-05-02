import React, { useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { Calendar, TrendingUp, TrendingDown, Wallet, ArrowRight, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, Account, RecurringTransaction } from '../lib/db';
import { formatLocalDate, getCurrencySymbol, convertCurrency } from '../lib/utils';

interface CashFlowCalendarProps {
  transactions: Transaction[];
  accounts: Account[];
  recurring: RecurringTransaction[];
  displayCurrency: string;
}

export default function CashFlowCalendar({ transactions, accounts, recurring, displayCurrency }: CashFlowCalendarProps) {
  const projection = useMemo(() => {
    const today = new Date();
    const days = 30;
    const data = [];
    
    // Calculate current balance in display currency
    const accountBalancesDis = accounts.reduce((acc, account) => {
      const balanceInDisplay = convertCurrency(account.initialBalance, account.currency || 'USD', displayCurrency);
      acc[account.id!] = balanceInDisplay;
      return acc;
    }, {} as Record<number, number>);

    transactions.forEach(t => {
      const acc = accounts.find(a => a.id === t.accountId);
      const toAcc = t.toAccountId ? accounts.find(a => a.id === t.toAccountId) : null;
      const amountInDisplay = convertCurrency(t.amount, acc?.currency || 'USD', displayCurrency);

      if (t.type === 'Income') {
        accountBalancesDis[t.accountId] = (accountBalancesDis[t.accountId] || 0) + amountInDisplay;
      } else if (t.type === 'Expense') {
        accountBalancesDis[t.accountId] = (accountBalancesDis[t.accountId] || 0) - amountInDisplay;
      } else if (t.type === 'Transfer' && t.toAccountId) {
        accountBalancesDis[t.accountId] = (accountBalancesDis[t.accountId] || 0) - amountInDisplay;
        const toAmountInDisplay = convertCurrency(t.amount, toAcc?.currency || 'USD', displayCurrency); // Technically should be same relative value but let's be precise
        accountBalancesDis[t.toAccountId] = (accountBalancesDis[t.toAccountId] || 0) + toAmountInDisplay;
      }
    });

    let currentTotal = Object.values(accountBalancesDis).reduce((sum, b) => sum + b, 0);
    
    // Calculate average daily spend (last 30 days) in display currency
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const last30DaysExpensesDis = transactions
      .filter(t => t.type === 'Expense' && new Date(t.date) >= thirtyDaysAgo)
      .reduce((sum, t) => {
        const acc = accounts.find(a => a.id === t.accountId);
        return sum + convertCurrency(t.amount, acc?.currency || 'USD', displayCurrency);
      }, 0);
    const avgDailySpend = last30DaysExpensesDis / 30;

    // Project forward
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = formatLocalDate(date);
      const dayOfMonth = date.getDate();

      // Add recurring income/expenses
      const dayRecurring = recurring.filter(r => {
        // Parse YYYY-MM-DD manually to ensure local timezone interpretation
        const [y, m, d] = r.startDate.split('-').map(Number);
        const start = new Date(y, m - 1, d);

        // Normalize both to midnight for comparison
        const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();

        // Ensure we only include if the projection date is >= start date
        if (dateMidnight < startMidnight) return false;

        if (r.frequency === 'Monthly') {
          return start.getDate() === dayOfMonth;
        }
        if (r.frequency === 'Daily') return true;
        if (r.frequency === 'Weekly') return start.getDay() === date.getDay();
        return false;
      });

      const recurringNet = dayRecurring.reduce((sum, r) => {
        const acc = accounts.find(a => a.id === r.accountId);
        const amountDis = convertCurrency(r.amount, acc?.currency || 'USD', displayCurrency);
        return r.type === 'Income' ? sum + amountDis : sum - amountDis;
      }, 0);

      currentTotal += recurringNet - avgDailySpend;
      
      data.push({
        date: dateStr,
        balance: Math.max(0, currentTotal),
        recurring: recurringNet,
        isLow: currentTotal < 1000 // Flag low balance (in display currency)
      });
    }

    return data;
  }, [transactions, accounts, recurring, displayCurrency]);

  const lowBalancePoints = projection.filter(p => p.isLow);
  const finalBalance = projection[projection.length - 1].balance;
  const startBalance = projection[0].balance;
  const trend = finalBalance > startBalance ? 'up' : 'down';

  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-black dark:bg-white rounded-2xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white dark:text-black" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Cash Flow Projection</h2>
              <p className="text-gray-400 dark:text-gray-500 text-sm font-medium">Predicted balance for the next 30 days based on your habits.</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-4">
            <div className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm ${
              trend === 'up' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'
            }`}>
              {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {trend === 'up' ? 'Positive Trend' : 'Negative Trend'}
            </div>
          </div>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projection}>
              <defs>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={document.documentElement.classList.contains('dark') ? '#fff' : '#000'} stopOpacity={0.1}/>
                  <stop offset="95%" stopColor={document.documentElement.classList.contains('dark') ? '#fff' : '#000'} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={document.documentElement.classList.contains('dark') ? '#374151' : '#f3f4f6'} />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }}
                tickFormatter={(str) => new Date(str).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }}
                tickFormatter={(val) => `${getCurrencySymbol(displayCurrency)}${val.toLocaleString()}`}
              />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '24px', 
                  border: 'none', 
                  boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', 
                  padding: '16px',
                  backgroundColor: document.documentElement.classList.contains('dark') ? '#111827' : '#ffffff',
                  color: document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000'
                }}
                itemStyle={{ fontSize: '14px', fontWeight: 'black', color: document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000' }}
                labelStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}
                formatter={(value: number) => [`${getCurrencySymbol(displayCurrency)}${value.toLocaleString()}`, 'Projected Balance']}
              />
              <Area 
                type="monotone" 
                dataKey="balance" 
                stroke={document.documentElement.classList.contains('dark') ? '#fff' : '#000'} 
                fillOpacity={1} 
                fill="url(#colorBalance)" 
                strokeWidth={4}
                animationDuration={2000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">End of Month Projection</p>
          <h3 className="text-2xl font-black text-gray-900 dark:text-white">{getCurrencySymbol(displayCurrency)}{finalBalance.toLocaleString()}</h3>
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <Sparkles className="w-3 h-3" />
            AI Predicted
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Daily Burn Rate</p>
          <h3 className="text-2xl font-black text-gray-900 dark:text-white">{getCurrencySymbol(displayCurrency)}{(finalBalance < startBalance ? (startBalance - finalBalance) / 30 : 0).toLocaleString()}/day</h3>
          <p className="mt-2 text-xs font-bold text-gray-400 dark:text-gray-500">Based on last 30 days</p>
        </div>

        <div className={`p-6 rounded-3xl border shadow-sm transition-colors ${
          lowBalancePoints.length > 0 ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30' : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30'
        }`}>
          <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${
            lowBalancePoints.length > 0 ? 'text-rose-400 dark:text-rose-500' : 'text-emerald-400 dark:text-emerald-500'
          }`}>Critical Balance Alerts</p>
          <h3 className={`text-2xl font-black ${
            lowBalancePoints.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
          }`}>
            {lowBalancePoints.length > 0 ? `${lowBalancePoints.length} Low Points` : 'All Clear'}
          </h3>
          <p className={`mt-2 text-xs font-bold ${
            lowBalancePoints.length > 0 ? 'text-rose-400 dark:text-rose-500' : 'text-emerald-400 dark:text-emerald-500'
          }`}>
            {lowBalancePoints.length > 0 ? `Balance predicted below ${getCurrencySymbol(displayCurrency)}1,000` : 'Healthy runway detected'}
          </p>
        </div>
      </div>

      {lowBalancePoints.length > 0 && (
        <div className="bg-rose-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-rose-200">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-black mb-2">Liquidity Warning</h3>
              <p className="text-rose-100 font-medium text-sm leading-relaxed max-w-2xl">
                Zenith predicts your balance will dip below your {getCurrencySymbol(displayCurrency)}1,000 safety threshold on **{new Date(lowBalancePoints[0].date).toLocaleDateString()}**. 
                Consider initiating a transfer from your business account or delaying non-essential expenses around this date.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
