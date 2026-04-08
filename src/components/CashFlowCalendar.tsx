import React, { useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { Calendar, TrendingUp, TrendingDown, Wallet, ArrowRight, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, Account, RecurringTransaction } from '../lib/db';

interface CashFlowCalendarProps {
  transactions: Transaction[];
  accounts: Account[];
  recurring: RecurringTransaction[];
}

export default function CashFlowCalendar({ transactions, accounts, recurring }: CashFlowCalendarProps) {
  const projection = useMemo(() => {
    const today = new Date();
    const days = 30;
    const data = [];
    
    // Calculate current balance
    const accountBalances = accounts.reduce((acc, account) => {
      acc[account.id!] = account.initialBalance;
      return acc;
    }, {} as Record<number, number>);

    transactions.forEach(t => {
      if (t.type === 'Income') {
        accountBalances[t.accountId] = (accountBalances[t.accountId] || 0) + t.amount;
      } else if (t.type === 'Expense') {
        accountBalances[t.accountId] = (accountBalances[t.accountId] || 0) - t.amount;
      } else if (t.type === 'Transfer' && t.toAccountId) {
        accountBalances[t.accountId] = (accountBalances[t.accountId] || 0) - t.amount;
        accountBalances[t.toAccountId] = (accountBalances[t.toAccountId] || 0) + t.amount;
      }
    });

    let currentTotal = Object.values(accountBalances).reduce((sum, b) => sum + b, 0);
    
    // Calculate average daily spend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const last30DaysExpenses = transactions
      .filter(t => t.type === 'Expense' && new Date(t.date) >= thirtyDaysAgo)
      .reduce((sum, t) => sum + t.amount, 0);
    const avgDailySpend = last30DaysExpenses / 30;

    // Project forward
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfMonth = date.getDate();

      // Add recurring income/expenses
      const dayRecurring = recurring.filter(r => {
        const start = new Date(r.startDate);
        if (r.frequency === 'Monthly') {
          return start.getDate() === dayOfMonth;
        }
        if (r.frequency === 'Daily') return true;
        if (r.frequency === 'Weekly') return start.getDay() === date.getDay();
        return false;
      });
      const recurringNet = dayRecurring.reduce((sum, r) => 
        r.type === 'Income' ? sum + r.amount : sum - r.amount, 0);

      currentTotal += recurringNet - avgDailySpend;
      
      data.push({
        date: dateStr,
        balance: Math.max(0, currentTotal),
        recurring: recurringNet,
        isLow: currentTotal < 1000 // Flag low balance
      });
    }

    return data;
  }, [transactions, accounts, recurring]);

  const lowBalancePoints = projection.filter(p => p.isLow);
  const finalBalance = projection[projection.length - 1].balance;
  const startBalance = projection[0].balance;
  const trend = finalBalance > startBalance ? 'up' : 'down';

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">Cash Flow Projection</h2>
              <p className="text-gray-400 text-sm font-medium">Predicted balance for the next 30 days based on your habits.</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-4">
            <div className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm ${
              trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
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
                  <stop offset="5%" stopColor="#000" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#000" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
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
                tickFormatter={(val) => `$${val.toLocaleString()}`}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '16px' }}
                itemStyle={{ fontSize: '14px', fontWeight: 'black', color: '#000' }}
                labelStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Projected Balance']}
              />
              <Area 
                type="monotone" 
                dataKey="balance" 
                stroke="#000" 
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
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">End of Month Projection</p>
          <h3 className="text-2xl font-black text-gray-900">${finalBalance.toLocaleString()}</h3>
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600">
            <Sparkles className="w-3 h-3" />
            AI Predicted
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Daily Burn Rate</p>
          <h3 className="text-2xl font-black text-gray-900">${(finalBalance < startBalance ? (startBalance - finalBalance) / 30 : 0).toLocaleString()}/day</h3>
          <p className="mt-2 text-xs font-bold text-gray-400">Based on last 30 days</p>
        </div>

        <div className={`p-6 rounded-3xl border shadow-sm ${
          lowBalancePoints.length > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'
        }`}>
          <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${
            lowBalancePoints.length > 0 ? 'text-rose-400' : 'text-emerald-400'
          }`}>Critical Balance Alerts</p>
          <h3 className={`text-2xl font-black ${
            lowBalancePoints.length > 0 ? 'text-rose-600' : 'text-emerald-600'
          }`}>
            {lowBalancePoints.length > 0 ? `${lowBalancePoints.length} Low Points` : 'All Clear'}
          </h3>
          <p className={`mt-2 text-xs font-bold ${
            lowBalancePoints.length > 0 ? 'text-rose-400' : 'text-emerald-400'
          }`}>
            {lowBalancePoints.length > 0 ? 'Balance predicted below $1,000' : 'Healthy runway detected'}
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
                Zenith predicts your balance will dip below your $1,000 safety threshold on **{new Date(lowBalancePoints[0].date).toLocaleDateString()}**. 
                Consider initiating a transfer from your business account or delaying non-essential expenses around this date.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
