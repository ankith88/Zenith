import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, Legend, Cell, PieChart, Pie
} from 'recharts';
import { Transaction, Account, Budget } from '../lib/db';
import { TrendingUp, TrendingDown, Wallet, PieChart as PieIcon, BarChart3, Activity, Sparkles, Loader2, ChevronRight, AlertTriangle, Scale } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analystService } from '../lib/gemini';
import Markdown from 'react-markdown';
import NetWorthAnalysis from './NetWorthAnalysis';
import AnomalyDetection from './AnomalyDetection';

interface ReportsProps {
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
}

type ReportTab = 'overview' | 'networth' | 'anomalies';

export default function Reports({ transactions, accounts, budgets }: ReportsProps) {
  const [activeSubTab, setActiveSubTab] = useState<ReportTab>('overview');
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAiReport = async () => {
    setIsGenerating(true);
    try {
      const report = await analystService.getFinancialHealthCheckup(transactions, accounts, budgets);
      setAiReport(report);
    } catch (error) {
      console.error("AI Report error:", error);
    } finally {
      setIsGenerating(false);
    }
  };
  const monthlyData = useMemo(() => {
    const data: Record<string, { name: string, income: number, expense: number, net: number }> = {};
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return d.toLocaleString('default', { month: 'short', year: '2-digit' });
    }).reverse();

    last6Months.forEach(m => {
      data[m] = { name: m, income: 0, expense: 0, net: 0 };
    });

    transactions.forEach(t => {
      const date = new Date(t.date);
      const month = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      if (data[month]) {
        if (t.type === 'Income') data[month].income += t.amount;
        else if (t.type === 'Expense') data[month].expense += t.amount;
        data[month].net = data[month].income - data[month].expense;
      }
    });

    return Object.values(data);
  }, [transactions]);

  const netWorthData = useMemo(() => {
    // Reconstruct net worth history
    const sortedTransactions = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    const dailyNetWorth: Record<string, number> = {};
    
    let currentBalance = accounts.reduce((sum, a) => sum + a.initialBalance, 0);
    
    // This is a simplified approach: we start with initial balances and add transactions over time
    // Note: This assumes initialBalance is the balance AT THE START of the tracking period.
    // If initialBalance is "current balance", we'd need to work backwards.
    // Let's assume initialBalance is the starting point for the DB.
    
    const dates = Array.from(new Set(sortedTransactions.map(t => t.date))).sort();
    
    dates.forEach(date => {
      const dayTransactions = sortedTransactions.filter(t => t.date === date);
      dayTransactions.forEach(t => {
        if (t.type === 'Income') currentBalance += t.amount;
        else if (t.type === 'Expense') currentBalance -= t.amount;
        // Transfers don't change total net worth
      });
      dailyNetWorth[date] = currentBalance;
    });

    return Object.entries(dailyNetWorth).map(([date, value]) => ({
      date,
      value
    })).slice(-30); // Last 30 days of activity
  }, [transactions, accounts]);

  const categoryBreakdown = useMemo(() => {
    const categories: Record<string, number> = {};
    transactions.filter(t => t.type === 'Expense').forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const savingsRate = useMemo(() => {
    const totalIncome = transactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0);
    if (totalIncome === 0) return 0;
    return Math.max(0, ((totalIncome - totalExpense) / totalIncome) * 100);
  }, [transactions]);

  const COLORS = ['#000000', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#E5E7EB'];

  return (
    <div className="space-y-8 pb-12">
      {/* Sub-Tab Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex p-1 bg-gray-100 rounded-2xl">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'overview' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <PieIcon className="w-4 h-4" />
            Overview
          </button>
          <button
            onClick={() => setActiveSubTab('networth')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'networth' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Scale className="w-4 h-4" />
            Net Worth Analysis
          </button>
          <button
            onClick={() => setActiveSubTab('anomalies')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'anomalies' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            AI Anomalies
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'overview' ? (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Top Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Savings Rate</p>
                <div className="flex items-end gap-2">
                  <h4 className="text-3xl font-black text-gray-900">{savingsRate.toFixed(1)}%</h4>
                  <TrendingUp className="w-5 h-5 text-emerald-500 mb-1" />
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${savingsRate}%` }} />
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Avg. Monthly Spend</p>
                <h4 className="text-3xl font-black text-gray-900">
                  ${(monthlyData.reduce((sum, d) => sum + d.expense, 0) / (monthlyData.length || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </h4>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Assets</p>
                <h4 className="text-3xl font-black text-gray-900">
                  ${accounts.filter(a => !['Mortgage', 'Car Loan', 'Credit Card'].includes(a.type)).reduce((sum, a) => sum + a.initialBalance, 0).toLocaleString()}
                </h4>
              </div>
              <div className="bg-black p-6 rounded-3xl shadow-xl">
                <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-1">Current Net Worth</p>
                <h4 className="text-3xl font-black text-white">
                  ${(netWorthData[netWorthData.length - 1]?.value || 0).toLocaleString()}
                </h4>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* AI Health Checkup */}
              <div className="lg:col-span-2">
                <div className="bg-gradient-to-br from-black to-gray-800 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Sparkles className="w-32 h-32 text-white" />
                  </div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-white tracking-tight">AI Financial Health Checkup</h3>
                        <p className="text-white/60 text-sm font-medium">Deep analysis of your spending, savings, and future outlook.</p>
                      </div>
                    </div>

                    {!aiReport ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <p className="text-white/80 text-lg font-bold mb-6 max-w-md">
                          Ready for a deep dive? Zenith will analyze your last 100 transactions and current budgets to generate a custom report.
                        </p>
                        <button
                          onClick={generateAiReport}
                          disabled={isGenerating}
                          className="px-8 py-4 bg-white text-black rounded-2xl font-black flex items-center gap-3 hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Analyzing Your Data...
                            </>
                          ) : (
                            <>
                              Generate AI Report
                              <ChevronRight className="w-5 h-5" />
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/5 backdrop-blur-md rounded-3xl p-8 border border-white/10"
                      >
                        <div className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-white/80 prose-strong:text-white prose-li:text-white/80">
                          <Markdown>{aiReport}</Markdown>
                        </div>
                        <button
                          onClick={() => setAiReport(null)}
                          className="mt-8 text-white/40 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
                        >
                          Clear and Regenerate
                        </button>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>

              {/* Income vs Expense */}
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-indigo-600" />
                    Income vs Expenses
                  </h3>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend iconType="circle" verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px' }} />
                      <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Category Distribution */}
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-8 flex items-center gap-2">
                  <PieIcon className="w-6 h-6 text-amber-500" />
                  Spending Distribution
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  {categoryBreakdown.slice(0, 6).map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-xs font-medium text-gray-600 truncate">{item.name}</span>
                      <span className="text-xs font-bold text-gray-900 ml-auto">${item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : activeSubTab === 'networth' ? (
          <motion.div
            key="networth"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <NetWorthAnalysis transactions={transactions} accounts={accounts} />
          </motion.div>
        ) : (
          <motion.div
            key="anomalies"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <AnomalyDetection transactions={transactions} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
