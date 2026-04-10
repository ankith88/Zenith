import React, { useMemo, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend
} from 'recharts';
import { TrendingDown, Zap, Snowflake, Calculator, AlertCircle, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Account, Transaction } from '../lib/db';

interface DebtSimulatorProps {
  accounts: Account[];
  transactions: Transaction[];
}

interface DebtItem {
  id: number;
  name: string;
  balance: number;
  interestRate: number;
  minPayment: number;
}

export default function DebtSimulator({ accounts, transactions }: DebtSimulatorProps) {
  const [strategy, setStrategy] = useState<'snowball' | 'avalanche'>('avalanche');
  const [extraPayment, setExtraPayment] = useState<number>(0);

  const debts = useMemo(() => {
    // Calculate current balances
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

    return accounts
      .filter(acc => (acc.type === 'Credit Card' || acc.type === 'Mortgage' || acc.type === 'Car Loan' || accountBalances[acc.id!] < 0))
      .map(acc => ({
        id: acc.id!,
        name: acc.name,
        balance: Math.abs(accountBalances[acc.id!]),
        interestRate: acc.interestRate || 0,
        minPayment: acc.minPayment || 0
      }))
      .filter(d => d.balance > 0);
  }, [accounts, transactions]);

  const simulation = useMemo(() => {
    if (debts.length === 0) return null;

    let currentDebts = debts.map(d => ({ ...d }));
    const data = [];
    let month = 0;
    const maxMonths = 360; // 30 years cap

    // Sort based on strategy
    if (strategy === 'snowball') {
      currentDebts.sort((a, b) => a.balance - b.balance);
    } else {
      currentDebts.sort((a, b) => b.interestRate - a.interestRate);
    }

    let totalInterestPaid = 0;

    while (currentDebts.some(d => d.balance > 0) && month < maxMonths) {
      let monthlyExtra = extraPayment;
      let monthlyTotalBalance = 0;
      
      // 1. Apply interest and minimum payments
      currentDebts.forEach(d => {
        if (d.balance > 0) {
          const interest = (d.balance * (d.interestRate / 100)) / 12;
          totalInterestPaid += interest;
          d.balance += interest;
          
          const payment = Math.min(d.balance, d.minPayment);
          d.balance -= payment;
          monthlyTotalBalance += d.balance;
        }
      });

      // 2. Apply extra payment to the target debt
      const targetDebt = currentDebts.find(d => d.balance > 0);
      if (targetDebt && monthlyExtra > 0) {
        const extra = Math.min(targetDebt.balance, monthlyExtra);
        targetDebt.balance -= extra;
        monthlyExtra -= extra;
        // If extra payment is still left, it could go to the next debt, but for simplicity we stop here
      }

      data.push({
        month: month + 1,
        totalBalance: Math.round(currentDebts.reduce((sum, d) => sum + d.balance, 0)),
        debtsPaid: currentDebts.filter(d => d.balance <= 0).length
      });

      month++;
    }

    return {
      data,
      totalInterest: Math.round(totalInterestPaid),
      monthsToPayoff: month,
      isCapped: month === maxMonths
    };
  }, [debts, strategy, extraPayment]);

  if (debts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-gray-900 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
        <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
        </div>
        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Debt Free!</h3>
        <p className="text-gray-400 dark:text-gray-500 max-w-sm font-medium">
          No active debts detected in your accounts. You're in great financial shape!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-rose-600 to-orange-600 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <TrendingDown className="w-48 h-48 text-white" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
              <Calculator className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Debt Strategy Simulator</h2>
              <p className="text-white/60 text-sm font-medium">Visualize your path to financial freedom.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10">
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Total Debt</p>
              <h3 className="text-3xl font-black text-white">${debts.reduce((sum, d) => sum + d.balance, 0).toLocaleString()}</h3>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10">
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Payoff Timeline</p>
              <h3 className="text-3xl font-black text-white">{simulation?.monthsToPayoff} Months</h3>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10">
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Total Interest</p>
              <h3 className="text-3xl font-black text-white">${simulation?.totalInterest.toLocaleString()}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6">Strategy & Boost</h3>
            
            <div className="space-y-4">
              <div className="flex p-1 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                <button
                  onClick={() => setStrategy('avalanche')}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    strategy === 'avalanche' ? 'bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  Avalanche
                </button>
                <button
                  onClick={() => setStrategy('snowball')}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    strategy === 'snowball' ? 'bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  <Snowflake className="w-4 h-4" />
                  Snowball
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 block">Extra Monthly Payment</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400 dark:text-gray-500">$</span>
                  <input
                    type="number"
                    value={extraPayment}
                    onChange={(e) => setExtraPayment(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 font-medium">
                  {strategy === 'avalanche' 
                    ? 'Avalanche prioritizes high interest rates to save the most money.' 
                    : 'Snowball prioritizes small balances for quick wins.'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6">Debt Breakdown</h3>
            <div className="space-y-4">
              {debts.map(debt => (
                <div key={debt.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{debt.name}</p>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                      {debt.interestRate}% APR • ${debt.minPayment}/mo
                    </p>
                  </div>
                  <p className="font-black text-gray-900 dark:text-white">${debt.balance.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm h-full transition-colors">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">Payoff Projection</h3>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full">
                <Sparkles className="w-3.5 h-3.5" />
                AI Optimized
              </div>
            </div>

            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={simulation?.data || []}>
                  <defs>
                    <linearGradient id="colorDebt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e11d48" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-chart-grid)" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }}
                    label={{ value: 'Months', position: 'insideBottom', offset: -5, fontSize: 10, fontWeight: 'bold', fill: '#9ca3af' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }}
                    tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '24px', 
                      border: 'none', 
                      boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', 
                      padding: '16px',
                      backgroundColor: 'var(--color-chart-tooltip-bg)',
                      color: 'var(--color-chart-tooltip-text)'
                    }}
                    itemStyle={{ fontSize: '14px', fontWeight: 'black', color: '#e11d48' }}
                    labelStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Remaining Debt']}
                    labelFormatter={(label) => `Month ${label}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="totalBalance" 
                    stroke="#e11d48" 
                    fillOpacity={1} 
                    fill="url(#colorDebt)" 
                    strokeWidth={4}
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {simulation?.isCapped && (
              <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium leading-relaxed">
                  The simulation is capped at 30 years. With your current minimum payments and interest rates, some debts may not be fully paid off within this timeframe. Consider increasing your extra monthly payment.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
