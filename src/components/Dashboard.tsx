import React, { useMemo, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Wallet, CreditCard, ArrowUpRight, ArrowDownLeft, RefreshCw, Loader2, Landmark, Banknote, Trash2, Edit2, Target } from 'lucide-react';
import { Transaction, Account, Budget, RecurringTransaction, db } from '../lib/db';
import { sheetsService } from '../lib/sheets';
import AccountManager from './AccountManager';
import BudgetManager from './BudgetManager';
import RecurringManager from './RecurringManager';

interface DashboardProps {
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  recurring: RecurringTransaction[];
}

export default function Dashboard({ transactions, accounts, budgets, recurring }: DashboardProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    await sheetsService.syncToLocal();
    setIsSyncing(false);
  };

  const handleDeleteTransaction = async (id: number) => {
    if (confirm("Are you sure you want to delete this transaction?")) {
      await db.transactions.delete(id);
      await sheetsService.deleteTransaction(id);
    }
  };

  const stats = useMemo(() => {
    // Calculate total balance including initial balances
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

    const totalBalance = Object.values(accountBalances).reduce((sum, b) => sum + b, 0);
    const income = transactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0);
    
    const categories = transactions.filter(t => t.type === 'Expense').reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

    const pieData = Object.entries(categories).map(([name, value]) => ({ name, value }));

    const dailyData = transactions.reduce((acc, t) => {
      const date = t.date;
      if (!acc[date]) acc[date] = { date, income: 0, expense: 0 };
      if (t.type === 'Income') acc[date].income += t.amount;
      else if (t.type === 'Expense') acc[date].expense += t.amount;
      return acc;
    }, {} as Record<string, any>);

    const areaData = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);

    // Calculate budget progress
    const budgetProgress = budgets.map(b => {
      const spent = transactions
        .filter(t => t.category === b.category && t.type === 'Expense')
        .reduce((sum, t) => sum + t.amount, 0);
      return { ...b, spent, percent: Math.min((spent / b.amount) * 100, 100) };
    });

    return { income, expenses, totalBalance, pieData, areaData, accountBalances, budgetProgress };
  }, [transactions, accounts, budgets]);

  const getAccountName = (id: number) => accounts.find(a => a.id === id)?.name || 'Unknown';

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Summary Cards */}
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-black text-gray-900">Overview</h3>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50"
        >
          {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sync Sheets
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 rounded-2xl group-hover:bg-emerald-100 transition-colors">
              <ArrowUpRight className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500">Total Income</p>
          <h3 className="text-3xl font-bold text-gray-900 mt-1">${stats.income.toLocaleString()}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-50 rounded-2xl group-hover:bg-red-100 transition-colors">
              <ArrowDownLeft className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500">Total Expenses</p>
          <h3 className="text-3xl font-bold text-gray-900 mt-1">${stats.expenses.toLocaleString()}</h3>
        </div>

        <div className="bg-black p-6 rounded-3xl shadow-xl hover:shadow-2xl transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Wallet className="w-24 h-24 text-white" />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="p-3 bg-white/10 rounded-2xl group-hover:bg-white/20 transition-colors">
              <Wallet className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm font-medium text-white/60 relative z-10">Net Worth</p>
          <h3 className="text-3xl font-bold text-white mt-1 relative z-10">${stats.totalBalance.toLocaleString()}</h3>
        </div>
      </div>

      {/* Account Manager Section */}
      <AccountManager accounts={accounts} />

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Spending Trend */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-gray-900">Cash Flow Trend</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.areaData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={3} />
                <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xl font-bold text-gray-900 mb-8">Spending by Category</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {stats.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#000', '#4b5563', '#9ca3af', '#d1d5db', '#f3f4f6'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {stats.pieData.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ['#000', '#4b5563', '#9ca3af', '#d1d5db', '#f3f4f6'][i % 5] }} />
                <span className="text-sm font-medium text-gray-600">{item.name}</span>
                <span className="text-sm font-bold text-gray-900 ml-auto">${item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Budget Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {stats.budgetProgress.length > 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Target className="w-6 h-6 text-indigo-600" />
                Budget Progress
              </h3>
            </div>
            <div className="space-y-8">
              {stats.budgetProgress.map((budget) => (
                <div key={budget.id} className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-gray-700">{budget.category}</span>
                    <span className="text-gray-400">
                      <span className="text-gray-900 font-bold">${budget.spent.toLocaleString()}</span>
                      {' / '}${budget.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-4 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${budget.percent}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full rounded-full shadow-sm ${
                        budget.percent > 90 ? 'bg-rose-500' : budget.percent > 70 ? 'bg-amber-500' : 'bg-indigo-600'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm text-center flex flex-col items-center justify-center min-h-[300px]">
            <div className="p-4 bg-gray-50 rounded-full mb-4">
              <Target className="w-10 h-10 text-gray-200" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No Budgets Set</h3>
            <p className="text-gray-400 max-w-[240px]">Track your spending by setting monthly category budgets.</p>
          </div>
        )}
        <BudgetManager budgets={budgets} />
      </div>

      {/* Recurring Transactions */}
      <div className="mb-12">
        <RecurringManager recurring={recurring} accounts={accounts} />
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">Recent Transactions</h3>
          <button className="text-sm font-bold text-gray-400 hover:text-black transition-colors">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Description</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Account</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Amount</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transactions.slice(-10).reverse().map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-8 py-4 text-sm text-gray-500">{t.date}</td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${
                        t.type === 'Income' ? 'bg-emerald-50' : 
                        t.type === 'Expense' ? 'bg-red-50' : 'bg-indigo-50'
                      }`}>
                        {t.type === 'Income' ? <ArrowUpRight className="w-4 h-4 text-emerald-600" /> : 
                         t.type === 'Expense' ? <ArrowDownLeft className="w-4 h-4 text-red-600" /> : 
                         <RefreshCw className="w-4 h-4 text-indigo-600" />}
                      </div>
                      <span className="font-medium text-gray-900">{t.description}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex flex-col">
                      <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-500 w-fit">
                        {getAccountName(t.accountId)}
                      </span>
                      {t.type === 'Transfer' && t.toAccountId && (
                        <div className="flex items-center gap-1 mt-1">
                          <ArrowDownLeft className="w-3 h-3 text-indigo-400 rotate-180" />
                          <span className="px-3 py-1 bg-indigo-50 rounded-full text-xs font-bold text-indigo-500 w-fit">
                            {getAccountName(t.toAccountId)}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={`px-8 py-4 text-sm font-bold text-right ${
                    t.type === 'Income' ? 'text-emerald-600' : 
                    t.type === 'Expense' ? 'text-red-600' : 'text-indigo-600'
                  }`}>
                    {t.type === 'Income' ? '+' : t.type === 'Expense' ? '-' : ''}${t.amount.toLocaleString()}
                  </td>
                  <td className="px-8 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => t.id && handleDeleteTransaction(t.id)}
                        className="p-2 hover:bg-rose-50 text-rose-600 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
