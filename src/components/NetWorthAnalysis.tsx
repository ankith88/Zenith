import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Transaction, Account } from '../lib/db';
import { TrendingUp, TrendingDown, Activity, Scale, ArrowUpRight, ArrowDownRight, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface NetWorthAnalysisProps {
  transactions: Transaction[];
  accounts: Account[];
}

export default function NetWorthAnalysis({ transactions, accounts, householdView }: NetWorthAnalysisProps & { householdView?: boolean }) {
  const trendData = useMemo(() => {
    const sortedTransactions = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    
    // Scaling transactions if individual view
    const workingTransactions = householdView ? sortedTransactions : sortedTransactions.map(t => {
      const acc = accounts.find(a => a.id === t.accountId);
      if (acc?.ownershipPercentage) {
        return { ...t, amount: t.amount * (acc.ownershipPercentage / 100) };
      }
      return t;
    });

    // Initial state
    let currentAssets = accounts
      .filter(a => !['Mortgage', 'Car Loan', 'Credit Card'].includes(a.type))
      .reduce((sum, a) => {
        let bal = a.initialBalance;
        if (!householdView && a.ownershipPercentage) bal *= (a.ownershipPercentage / 100);
        return sum + bal;
      }, 0);
      
    let currentDebt = accounts
      .filter(a => ['Mortgage', 'Car Loan', 'Credit Card'].includes(a.type))
      .reduce((sum, a) => {
        let bal = Math.abs(a.initialBalance);
        if (!householdView && a.ownershipPercentage) bal *= (a.ownershipPercentage / 100);
        return sum + bal;
      }, 0);

    const dates = Array.from(new Set(workingTransactions.map(t => t.date))).sort();
    
    // We'll group by month for a cleaner trend
    const monthlyHistory: Record<string, { date: string, assets: number, debt: number, netWorth: number }> = {};

    dates.forEach(date => {
      const dayTransactions = workingTransactions.filter(t => t.date === date);
      dayTransactions.forEach(t => {
        // Find the account to see if it's asset or debt
        const account = accounts.find(a => a.id === t.accountId);
        const isDebt = account && ['Mortgage', 'Car Loan', 'Credit Card'].includes(account.type);

        if (t.type === 'Income') {
          if (isDebt) currentDebt -= t.amount; // Paying off debt
          else currentAssets += t.amount;
        } else if (t.type === 'Expense') {
          if (isDebt) currentDebt += t.amount; // Increasing debt
          else currentAssets -= t.amount;
        }
      });

      const month = date.substring(0, 7); // YYYY-MM
      monthlyHistory[month] = {
        date: month,
        assets: Math.max(0, currentAssets),
        debt: Math.max(0, currentDebt),
        netWorth: currentAssets - currentDebt
      };
    });

    return Object.values(monthlyHistory).slice(-12); // Last 12 months
  }, [transactions, accounts, householdView]);

  const currentAssets = useMemo(() => accounts
    .filter(a => !['Mortgage', 'Car Loan', 'Credit Card'].includes(a.type))
    .reduce((sum, a) => {
      let bal = a.initialBalance;
      if (!householdView && a.ownershipPercentage) bal *= (a.ownershipPercentage / 100);
      return sum + bal;
    }, 0), [accounts, householdView]);
    
  const currentDebt = useMemo(() => accounts
    .filter(a => ['Mortgage', 'Car Loan', 'Credit Card'].includes(a.type))
    .reduce((sum, a) => {
      let bal = Math.abs(a.initialBalance);
      if (!householdView && a.ownershipPercentage) bal *= (a.ownershipPercentage / 100);
      return sum + bal;
    }, 0), [accounts, householdView]);

  const netWorth = currentAssets - currentDebt;
  
  // Find crossover point if any
  const crossover = useMemo(() => {
    for (let i = 1; i < trendData.length; i++) {
      const prev = trendData[i-1];
      const curr = trendData[i];
      if (prev.assets <= prev.debt && curr.assets > curr.debt) {
        return curr.date;
      }
    }
    return null;
  }, [trendData]);

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden transition-colors">
          <div className="absolute top-0 right-0 p-6 opacity-5">
            <TrendingUp className="w-24 h-24 text-emerald-600" />
          </div>
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Total Assets</p>
          <h4 className="text-3xl font-black text-gray-900 dark:text-white mb-2">${currentAssets.toLocaleString()}</h4>
          <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold">
            <ArrowUpRight className="w-3 h-3" />
            <span>Growing Trend</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden transition-colors">
          <div className="absolute top-0 right-0 p-6 opacity-5">
            <TrendingDown className="w-24 h-24 text-rose-600" />
          </div>
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Total Liabilities</p>
          <h4 className="text-3xl font-black text-gray-900 dark:text-white mb-2">${currentDebt.toLocaleString()}</h4>
          <div className="flex items-center gap-1 text-rose-500 text-xs font-bold">
            <ArrowDownRight className="w-3 h-3" />
            <span>Decreasing Trend</span>
          </div>
        </div>

        <div className="bg-black dark:bg-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden transition-colors">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Scale className="w-24 h-24 text-white dark:text-black" />
          </div>
          <p className="text-xs font-bold text-white/40 dark:text-black/40 uppercase tracking-widest mb-2">Net Worth</p>
          <h4 className="text-3xl font-black text-white dark:text-black mb-2">${netWorth.toLocaleString()}</h4>
          <div className={`flex items-center gap-1 text-xs font-bold ${netWorth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {netWorth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{netWorth >= 0 ? 'Positive Equity' : 'Negative Equity'}</span>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12">
          <div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
              <Activity className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              Assets vs. Debt Trend
            </h3>
            <p className="text-gray-500 dark:text-gray-400 font-medium mt-1">Tracking your journey to financial independence.</p>
          </div>
          
          {crossover && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-2xl border border-emerald-100 dark:border-emerald-800 flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-none">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Crossover Point</p>
                <p className="text-sm font-black text-emerald-900 dark:text-emerald-100">{crossover}</p>
              </div>
            </div>
          )}
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorDebt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-chart-grid)" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fontWeight: 600, fill: '#9ca3af' }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fontWeight: 600, fill: '#9ca3af' }}
                tickFormatter={(val) => `$${val >= 1000 ? (val/1000) + 'k' : val}`}
              />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '24px', 
                  border: 'none', 
                  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                  padding: '20px',
                  backgroundColor: 'var(--color-chart-tooltip-bg)',
                  color: 'var(--color-chart-tooltip-text)'
                }}
                itemStyle={{ fontWeight: 800, fontSize: '14px', color: 'var(--color-chart-tooltip-text)' }}
              />
              <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '40px' }} />
              
              {crossover && (
                <ReferenceLine x={crossover} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Crossover', position: 'top', fill: '#10b981', fontWeight: 800, fontSize: 10 }} />
              )}

              <Area 
                type="monotone" 
                dataKey="assets" 
                name="Total Assets" 
                stroke="#10b981" 
                fillOpacity={1} 
                fill="url(#colorAssets)" 
                strokeWidth={4} 
              />
              <Area 
                type="monotone" 
                dataKey="debt" 
                name="Total Debt" 
                stroke="#ef4444" 
                fillOpacity={1} 
                fill="url(#colorDebt)" 
                strokeWidth={4} 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 transition-colors">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-white dark:bg-gray-900 rounded-2xl flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h5 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Zenith Insight</h5>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                Your net worth is the ultimate scorecard. The "Crossover Point" is the moment your assets exceed your liabilities. 
                Focus on increasing the gap between the green and red lines to accelerate your financial freedom.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
