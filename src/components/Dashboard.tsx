import React, { useMemo, useState, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, TrendingDown, Wallet, CreditCard, ArrowUpRight, ArrowDownLeft, RefreshCw, Loader2, Landmark, Banknote, Trash2, Edit2, Target, X, Home, Briefcase, Car, Sparkles, ShieldCheck, Zap, Sparkles as SparklesIcon } from 'lucide-react';
import { Transaction, Account, Budget, RecurringTransaction, Goal, Milestone, db } from '../lib/db';
import { sheetsService } from '../lib/sheets';
import { formatLocalDate, convertCurrency, getCurrencySymbol } from '../lib/utils';
import { analystService } from '../lib/gemini';
import AccountManager from './AccountManager';

import { useLiveQuery } from 'dexie-react-hooks';

interface DashboardProps {
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  recurring: RecurringTransaction[];
  goals: Goal[];
  milestones: Milestone[];
  accountBalances: Record<number, number>;
  householdView: boolean;
  displayCurrency: string;
  isDarkMode: boolean;
  onViewAllTransactions?: () => void;
}

export default function Dashboard({ transactions, accounts, budgets, recurring, goals, milestones, accountBalances, householdView, displayCurrency, isDarkMode, onViewAllTransactions }: DashboardProps) {
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [isProjecting, setIsProjecting] = useState(false);
  const [projection, setProjection] = useState<any>(null);
  const [showLiquidBreakdown, setShowLiquidBreakdown] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const investments = useLiveQuery(() => db.investments.toArray()) || [];
  const assets = useLiveQuery(() => db.assets.toArray()) || [];

  const handleProjectFuture = async () => {
    setIsProjecting(true);
    try {
      const result = await analystService.projectFutureExpenses(transactions);
      setProjection(result);
    } catch (error) {
      console.error("Projection failed", error);
    } finally {
      setIsProjecting(false);
    }
  };

  const totalInvestmentValue = useMemo(() => 
    investments.reduce((sum, i) => sum + convertCurrency(i.quantity * i.currentPrice, 'USD', displayCurrency), 0)
  , [investments, displayCurrency]);

  const totalPhysicalAssetValue = useMemo(() => 
    assets.reduce((sum, a) => sum + convertCurrency(a.currentValuation, 'USD', displayCurrency), 0)
  , [assets, displayCurrency]);

  const categoryMetadata = useLiveQuery(() => db.categoryMetadata.toArray()) || [];
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    categoryMetadata.forEach(m => {
      map[m.name] = m.color;
    });
    return map;
  }, [categoryMetadata]);
  const PRESET_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#f43f5e', '#06b6d4', '#84cc16', '#71717a'];

  const handleSync = async () => {
    setIsSyncing(true);
    await sheetsService.syncToLocal();
    setIsSyncing(false);
  };

  const handleProcessInterest = async () => {
    setIsProcessing(true);
    try {
      if ((window as any).processInterest) {
        await (window as any).processInterest();
      }
      if ((window as any).processRecurring) {
        await (window as any).processRecurring();
      }
      // Add a small delay to show feedback
      await new Promise(resolve => setTimeout(resolve, 800));
      await handleSync();
    } catch (error) {
      console.error("Manual refresh error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;
    
    try {
      await db.transactions.update(editingTransaction.id!, { ...editingTransaction, synced: false });
      await sheetsService.updateTransaction(editingTransaction);
      await db.transactions.update(editingTransaction.id!, { synced: true });
      setEditingTransaction(null);
    } catch (error) {
      console.error("Update transaction error:", error);
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    setIsSyncing(true);
    try {
      await db.transactions.delete(id);
      await sheetsService.deleteTransaction(id);
      setDeletingTransactionId(null);
    } catch (error) {
      console.error("Delete transaction error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Housing', 'Health', 'Utilities', 'Salary', 'Investment', 'Other'];

  const allCategories = useMemo(() => {
    const fromTransactions = transactions.map(t => t.category);
    const fromBudgets = budgets.map(b => b.category);
    const combined = Array.from(new Set([...fromTransactions, ...fromBudgets])).filter(Boolean);
    return combined.length > 0 ? combined.sort() : DEFAULT_CATEGORIES;
  }, [transactions, budgets]);

  const predictCategory = async (description: string) => {
    if (description.length <= 3 || allCategories.length === 0) return;
    
    setIsPredicting(true);
    try {
      const { analystService } = await import('../lib/gemini');
      const predicted = await analystService.predictCategory(description, allCategories);
      if (predicted && predicted !== 'Other' && editingTransaction) {
        setEditingTransaction(prev => prev ? { ...prev, category: predicted } : null);
      }
    } catch (error) {
      console.error("Prediction error:", error);
    } finally {
      setIsPredicting(false);
    }
  };

  useEffect(() => {
    if (editingTransaction && editingTransaction.description.length > 3 && allCategories.length > 0) {
      const timer = setTimeout(() => {
        predictCategory(editingTransaction.description);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [editingTransaction?.description]);

  const stats = useMemo(() => {
    // Filter data based on householdView for stats
    const filteredAccounts = householdView 
      ? accounts 
      : accounts.filter(a => !a.owner || a.owner === 'Me' || (a.ownershipPercentage && a.ownershipPercentage > 0));
    
    const filteredTransactions = householdView
      ? transactions
      : transactions.filter(t => {
          const acc = accounts.find(a => a.id === t.accountId);
          return !acc?.owner || acc.owner === 'Me' || (acc?.ownershipPercentage && acc.ownershipPercentage > 0);
        });

    const filteredRecurring = householdView
      ? recurring
      : recurring.filter(r => {
          const acc = accounts.find(a => a.id === r.accountId);
          return !acc?.owner || acc.owner === 'Me' || (acc?.ownershipPercentage && acc.ownershipPercentage > 0);
        });

    const filteredAccountBalances = Object.fromEntries(
      Object.entries(accountBalances).map(([id, balance]) => {
        const accId = parseInt(String(id));
        const acc = accounts.find(a => a.id === accId);
        
        let adjustedBalance = balance;
        if (!householdView && acc?.ownershipPercentage) {
          adjustedBalance = balance * (acc.ownershipPercentage / 100);
        }
        
        return [id, adjustedBalance];
      }).filter(([id]) => {
        const accId = parseInt(String(id));
        const acc = accounts.find(a => a.id === accId);
        return householdView || (!acc?.owner || acc.owner === 'Me' || (acc?.ownershipPercentage && acc.ownershipPercentage > 0));
      })
    ) as Record<string, number>;

    // Total balance in display currency
    const totalBalance = Object.entries(filteredAccountBalances).reduce((sum, [id, balance]) => {
      const acc = accounts.find(a => a.id === parseInt(id));
      return sum + convertCurrency(balance, acc?.currency || 'USD', displayCurrency);
    }, 0);

    const totalAssetValue = filteredAccounts.reduce((sum, acc) => {
      let val = acc.assetValue || 0;
      if (!householdView && acc.ownershipPercentage) {
        val = val * (acc.ownershipPercentage / 100);
      }
      return sum + convertCurrency(val, acc.currency || 'USD', displayCurrency);
    }, 0);
    const netWorth = totalBalance + totalAssetValue;

    // Fetch and add Investments & Assets to net worth
    // Note: Since stats is a useMemo, we can't easily wait for useLiveQuery inside it
    // But we can pull them directly from db if needed, or pass them as props.
    // However, Dashboard already has access to db.

    // Calculate current month date strings
    const firstDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const lastDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    const monthStartStr = formatLocalDate(firstDayOfMonth);
    const monthEndStr = formatLocalDate(lastDayOfMonth);

    const workingTransactions = (householdView ? filteredTransactions : filteredTransactions.map(t => {
      const acc = accounts.find(a => a.id === t.accountId);
      if (acc?.ownershipPercentage) {
        return { ...t, amount: t.amount * (acc.ownershipPercentage / 100) };
      }
      return t;
    })).map(t => {
      const acc = accounts.find(a => a.id === t.accountId);
      return { ...t, amountInDisplayCurrency: convertCurrency(t.amount, acc?.currency || 'USD', displayCurrency) };
    });

    const currentMonthTransactions = workingTransactions.filter(t => t.date >= monthStartStr && t.date <= monthEndStr);

    const income = currentMonthTransactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + (t as any).amountInDisplayCurrency, 0);
    const expenses = currentMonthTransactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + (t as any).amountInDisplayCurrency, 0);
    
    const categories = workingTransactions.filter(t => t.type === 'Expense').reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + (t as any).amountInDisplayCurrency;
      return acc;
    }, {} as Record<string, number>);

    const pieData = Object.entries(categories).map(([name, value]) => ({ 
      name, 
      value,
      color: colorMap[name]
    }));

    const dailyData = workingTransactions
      .filter(t => t.date >= monthStartStr && t.date <= monthEndStr)
      .reduce((acc, t) => {
        const date = t.date;
        if (!acc[date]) acc[date] = { date, income: 0, expense: 0 };
        if (t.type === 'Income') acc[date].income += (t as any).amountInDisplayCurrency;
        else if (t.type === 'Expense') acc[date].expense += (t as any).amountInDisplayCurrency;
        return acc;
      }, {} as Record<string, any>);

    const areaData = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

    // Calculate monthly savings rate in display currency
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const last30DaysStr = formatLocalDate(last30Days);
    
    const recentIncome = workingTransactions
      .filter(t => t.type === 'Income' && t.date >= last30DaysStr)
      .reduce((sum, t) => sum + (t as any).amountInDisplayCurrency, 0);
    const recentExpenses = workingTransactions
      .filter(t => t.type === 'Expense' && t.date >= last30DaysStr)
      .reduce((sum, t) => sum + (t as any).amountInDisplayCurrency, 0);
    const monthlySavings = Math.max(0, recentIncome - recentExpenses);

    // Calculate Liquid vs Debt in display currency
    let liquidBalanceInDisplay = 0;
    let totalDebtInDisplay = 0;

    filteredAccounts.forEach(acc => {
      const balance = filteredAccountBalances[acc.id!] || 0;
      const balanceInDisplay = convertCurrency(balance, acc.currency || 'USD', displayCurrency);
      if (acc.type === 'Mortgage' || acc.type === 'Credit Card' || acc.type === 'Car Loan' || acc.type === 'Personal Loan') {
        totalDebtInDisplay += Math.abs(balanceInDisplay);
      } else {
        liquidBalanceInDisplay += balanceInDisplay;
      }
    });

    // Calculate budget progress (Budget amounts are assumed to be in display currency)
    const budgetProgress = budgets.map(b => {
      // Filter transactions for this specific budget category in the current month
      const spentInDisplay = currentMonthTransactions
        .filter(t => t.category === b.category && t.type === 'Expense')
        .reduce((sum, t) => sum + (t as any).amountInDisplayCurrency, 0);
      return { ...b, spent: spentInDisplay, percent: Math.min((spentInDisplay / b.amount) * 100, 100) };
    });

    const unsyncedCount = transactions.filter(t => !t.synced).length + 
                         accounts.filter(a => !a.synced).length + 
                         budgets.filter(b => !b.synced).length + 
                         recurring.filter(r => !r.synced).length;

    return { 
      income, 
      expenses, 
      totalBalance, 
      netWorth: netWorth + totalInvestmentValue + totalPhysicalAssetValue, 
      totalAssetValue: totalAssetValue + totalInvestmentValue + totalPhysicalAssetValue, 
      liquidBalance: liquidBalanceInDisplay, 
      totalDebt: totalDebtInDisplay, 
      pieData, 
      areaData, 
      accountBalances: filteredAccountBalances, 
      budgetProgress, 
      unsyncedCount, 
      monthlySavings, 
      filteredAccounts, 
      filteredTransactions,
      filteredRecurring,
      selectedMonthLabel: selectedDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })
    };
  }, [transactions, accounts, budgets, recurring, goals, householdView, accountBalances, displayCurrency, totalInvestmentValue, totalPhysicalAssetValue, selectedDate]);

  const getAccountName = (id: number) => accounts.find(a => a.id === id)?.name || 'Unknown';

  const hasMortgage = accounts.some(a => a.type === 'Mortgage');
  const hasBusiness = accounts.some(a => a.type === 'Business Account');
  const hasCarLoan = accounts.some(a => a.type === 'Car Loan');

  const changeMonth = (offset: number) => {
    setSelectedDate(prev => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + offset);
      return next;
    });
  };

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Month Navigation Header */}
      <div className="bg-white dark:bg-gray-900 px-6 py-4 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => changeMonth(-1)}
            className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors border border-gray-100 dark:border-gray-800 group"
          >
            <ArrowUpRight className="w-5 h-5 -rotate-180 text-gray-500 group-hover:text-black dark:group-hover:text-white transition-colors" />
          </button>
          <div className="text-center min-w-[160px] group cursor-pointer" onClick={() => setSelectedDate(new Date())}>
            <h2 className="text-xl font-black text-gray-900 dark:text-white leading-tight group-hover:text-indigo-600 transition-colors">{stats.selectedMonthLabel}</h2>
            <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center justify-center gap-1">
              Financial Period
              {selectedDate.getMonth() === new Date().getMonth() && selectedDate.getFullYear() === new Date().getFullYear() && (
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" title="Current Month" />
              )}
            </p>
          </div>
          <button 
            onClick={() => changeMonth(1)}
            disabled={selectedDate.getMonth() === new Date().getMonth() && selectedDate.getFullYear() === new Date().getFullYear()}
            className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors border border-gray-100 dark:border-gray-800 disabled:opacity-0 disabled:pointer-events-none group"
          >
            <ArrowUpRight className="w-5 h-5 text-gray-500 group-hover:text-black dark:group-hover:text-white transition-colors" />
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedDate(new Date())}
            disabled={selectedDate.getMonth() === new Date().getMonth() && selectedDate.getFullYear() === new Date().getFullYear()}
            className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:underline disabled:hidden"
          >
            Jump to Today
          </button>
        </div>
      </div>

      {/* Quick Setup Banners */}
      {(!hasMortgage || !hasBusiness || !hasCarLoan) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {!hasMortgage && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-indigo-600 p-6 rounded-[32px] text-white flex items-center justify-between group cursor-pointer overflow-hidden relative"
              onClick={() => (window as any).showMortgageWizard()}
            >
              <div className="relative z-10">
                <h4 className="text-lg font-black mb-1">Setup Your Mortgage</h4>
                <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest">Automate your 3-way split</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform relative z-10">
                <Home className="w-6 h-6" />
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
                <Home className="w-32 h-32" />
              </div>
            </motion.div>
          )}
          {!hasCarLoan && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-blue-600 p-6 rounded-[32px] text-white flex items-center justify-between group cursor-pointer overflow-hidden relative"
              onClick={() => (window as any).showCarLoanWizard()}
            >
              <div className="relative z-10">
                <h4 className="text-lg font-black mb-1">Setup Car Loan</h4>
                <p className="text-xs font-bold text-blue-200 uppercase tracking-widest">Automate your repayments</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform relative z-10">
                <Car className="w-6 h-6" />
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
                <Car className="w-32 h-32" />
              </div>
            </motion.div>
          )}
          {!hasBusiness && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-600 p-6 rounded-[32px] text-white flex items-center justify-between group cursor-pointer overflow-hidden relative"
              onClick={() => {
                const el = document.getElementById('account-manager-add-btn');
                if (el) el.click();
              }}
            >
              <div className="relative z-10">
                <h4 className="text-lg font-black mb-1">Business Account</h4>
                <p className="text-xs font-bold text-emerald-200 uppercase tracking-widest">Track only what you take out</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform relative z-10">
                <Briefcase className="w-6 h-6" />
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
                <Briefcase className="w-32 h-32" />
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-black text-gray-900 dark:text-white">Overview</h3>
        <div className="flex items-center gap-3">
          {stats.unsyncedCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-100 dark:border-amber-900/30 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">{stats.unsyncedCount} unsynced items</span>
            </div>
          )}
          <button
            onClick={handleProcessInterest}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all active:scale-95 disabled:opacity-50"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Refresh Interest
          </button>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50"
          >
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync Sheets
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 transition-colors">
              <ArrowUpRight className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Income ({stats.selectedMonthLabel})</p>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{getCurrencySymbol(displayCurrency)}{stats.income.toLocaleString()}</h3>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-2xl group-hover:bg-red-100 dark:group-hover:bg-red-900/30 transition-colors">
              <ArrowDownLeft className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Expenses ({stats.selectedMonthLabel})</p>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{getCurrencySymbol(displayCurrency)}{stats.expenses.toLocaleString()}</h3>
        </div>

        <div 
          onClick={() => setShowLiquidBreakdown(true)}
          className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm hover:shadow-md transition-all group relative overflow-hidden cursor-pointer active:scale-95"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10">
            <Wallet className="w-16 h-16 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors">
              <Wallet className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 relative z-10">Liquid Assets</p>
          <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1 relative z-10">{getCurrencySymbol(displayCurrency)}{stats.liquidBalance.toLocaleString()}</h3>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-rose-100 dark:border-rose-900/30 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10">
            <TrendingDown className="w-16 h-16 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-2xl group-hover:bg-rose-100 dark:group-hover:bg-rose-900/30 transition-colors">
              <TrendingDown className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 relative z-10">Total Debt</p>
          <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1 relative z-10">{getCurrencySymbol(displayCurrency)}{stats.totalDebt.toLocaleString()}</h3>
        </div>

        <div className="bg-black dark:bg-white p-6 rounded-3xl shadow-xl dark:shadow-white/5 group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp className="w-16 h-16 text-white dark:text-black" />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="p-3 bg-white/10 dark:bg-black/10 rounded-2xl backdrop-blur-md">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-400 dark:text-gray-600 relative z-10">Net Worth</p>
          <h3 className="text-2xl font-bold text-white dark:text-black mt-1 relative z-10">{getCurrencySymbol(displayCurrency)}{stats.netWorth.toLocaleString()}</h3>
          <div className="mt-2 flex items-center gap-1 text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider relative z-10">
            <span>Assets:</span>
            <span className="text-emerald-400">{getCurrencySymbol(displayCurrency)}{stats.totalAssetValue.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Account Manager Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <AccountManager accounts={stats.filteredAccounts} accountBalances={stats.accountBalances} displayCurrency={displayCurrency} />
          
          {/* Recent Transactions Table */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Recent Activity</h3>
              <button 
                onClick={onViewAllTransactions}
                className="text-[10px] font-black text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white transition-colors uppercase tracking-widest"
              >
                View Ledger
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                    <th className="px-6 py-3 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Date</th>
                    <th className="px-6 py-3 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Transaction</th>
                    <th className="px-6 py-3 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {transactions.slice(-8).reverse().map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors group">
                      <td className="px-6 py-4 text-xs font-medium text-gray-400 dark:text-gray-500 font-mono">{t.date}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl shrink-0 ${
                            t.type === 'Income' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 
                            t.type === 'Expense' ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'
                          }`}>
                            {t.type === 'Income' ? <ArrowUpRight className="w-3.5 h-3.5" /> : 
                             t.type === 'Expense' ? <ArrowDownLeft className="w-3.5 h-3.5" /> : 
                             <RefreshCw className="w-3.5 h-3.5" />}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{t.description}</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{getAccountName(t.accountId)}</span>
                          </div>
                        </div>
                      </td>
                      <td className={`px-6 py-4 text-sm font-black text-right ${
                        t.type === 'Income' ? 'text-emerald-600 dark:text-emerald-400' : 
                        t.type === 'Expense' ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'
                      }`}>
                        {t.type === 'Income' ? '+' : t.type === 'Expense' ? '-' : ''}
                        {getCurrencySymbol(accounts.find(a => a.id === t.accountId)?.currency)}
                        {t.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* AI Projection Card */}
          <div className="bg-indigo-600 p-8 rounded-[40px] text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
              <SparklesIcon className="w-24 h-24" />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <Zap className="w-3 h-3 text-yellow-300" />
                  Zenith AI Insight
                </div>
                <button 
                  onClick={handleProjectFuture}
                  disabled={isProjecting}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${isProjecting ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {!projection && !isProjecting ? (
                <div className="space-y-4">
                  <h4 className="text-2xl font-black leading-tight">Predict your next month</h4>
                  <p className="text-sm font-medium text-indigo-100 italic">"I can analyze your spending patterns to forecast next month's totals."</p>
                  <button 
                    onClick={handleProjectFuture}
                    className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black text-sm active:scale-95 transition-all shadow-lg"
                  >
                    Generate AI Forecast
                  </button>
                </div>
              ) : isProjecting ? (
                <div className="py-12 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="w-8 h-8 animate-spin opacity-50" />
                  <p className="text-xs font-bold uppercase tracking-widest opacity-60">Architecting Forecast...</p>
                </div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Projected Burn</p>
                    <h4 className="text-4xl font-black">{getCurrencySymbol(displayCurrency)}{projection.projectedTotal.toLocaleString()}</h4>
                  </div>
                  <p className="text-xs font-medium text-indigo-50 leading-relaxed italic">
                    "{projection.reasoning}"
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {projection.categoryBreakdown.slice(0, 4).map((item: any, i: number) => (
                      <div key={i} className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
                        <p className="text-[8px] font-black uppercase tracking-widest text-indigo-200 truncate">{item.category}</p>
                        <p className="text-sm font-bold">{getCurrencySymbol(displayCurrency)}{item.amount.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Spending Distribution */}
          <div className="bg-white dark:bg-gray-900 p-8 rounded-[40px] border border-gray-100 dark:border-gray-800 shadow-sm">
            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight mb-6">Spend Mix</h3>
            <div className="h-[200px] w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.pieData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color || PRESET_COLORS[index % PRESET_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {stats.pieData.slice(0, 5).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color || PRESET_COLORS[i % PRESET_COLORS.length] }} />
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{item.name}</span>
                  </div>
                  <span className="text-xs font-black text-gray-900 dark:text-white">{getCurrencySymbol(displayCurrency)}{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cash Flow Section */}
      <div className="bg-white dark:bg-gray-900 p-8 rounded-[40px] border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Financial Pulse</h3>
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
            <div className="flex items-center gap-2 text-emerald-500">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              Inflow
            </div>
            <div className="flex items-center gap-2 text-red-500">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              Outflow
            </div>
          </div>
        </div>
        <div className="h-[250px] w-full">
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
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Area type="monotone" dataKey="income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={4} />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={4} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Edit Transaction Modal */}
      <AnimatePresence>
        {deletingTransactionId && (
          <motion.div
            key="delete-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/20 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden p-8 text-center"
            >
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Transaction?</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8">This action cannot be undone and will be synced to your Google Sheet.</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setDeletingTransactionId(null)}
                  className="py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteTransaction(deletingTransactionId)}
                  disabled={isSyncing}
                  className="py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {editingTransaction && (
          <motion.div
            key="edit-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/20 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Edit Transaction</h3>
                <button onClick={() => setEditingTransaction(null)} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <form onSubmit={handleUpdateTransaction} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 block">Description</label>
                  <input
                    required
                    type="text"
                    value={editingTransaction.description}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, description: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 block">Amount</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      value={editingTransaction.amount}
                      onChange={(e) => setEditingTransaction({ ...editingTransaction, amount: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 block">Category</label>
                    <div className="relative">
                      <input
                        required
                        type="text"
                        list="dashboard-category-suggestions"
                        value={editingTransaction.category}
                        onChange={(e) => setEditingTransaction({ ...editingTransaction, category: e.target.value })}
                        className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all ${isPredicting ? 'ring-1 ring-indigo-200' : ''}`}
                      />
                      <datalist id="dashboard-category-suggestions">
                        {allCategories.map(cat => (
                          <option key={cat} value={cat} />
                        ))}
                      </datalist>
                      {isPredicting && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 block">Date</label>
                  <input
                    required
                    type="date"
                    value={editingTransaction.date}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, date: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                  />
                </div>
                <button
                  className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-100 transition-all active:scale-95 mt-4"
                >
                  Save Changes
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
        {showLiquidBreakdown && (
          <motion.div
            key="liquid-breakdown"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/20 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white">Liquid Assets</h3>
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Account Breakdown</p>
                  </div>
                </div>
                <button onClick={() => setShowLiquidBreakdown(false)} className="p-3 hover:bg-white dark:hover:bg-gray-800 rounded-2xl transition-colors shadow-sm">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {accounts
                  .filter(acc => acc.type !== 'Mortgage' && acc.type !== 'Credit Card' && acc.type !== 'Car Loan')
                  .map(acc => (
                    <div key={acc.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white dark:bg-gray-700 rounded-xl flex items-center justify-center text-gray-900 dark:text-white shadow-sm border border-gray-100 dark:border-gray-600">
                          {acc.type === 'Savings' ? <Landmark className="w-5 h-5" /> : 
                           acc.type === 'Fixed Deposit' ? <ShieldCheck className="w-5 h-5" /> :
                           acc.type === 'Checking' ? <Wallet className="w-5 h-5" /> : 
                           acc.type === 'Cash' ? <Banknote className="w-5 h-5" /> : 
                           acc.type === 'Business Account' ? <Briefcase className="w-5 h-5" /> :
                           <Wallet className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{acc.name}</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-wider">{acc.type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-gray-900 dark:text-white">
                          {getCurrencySymbol(acc.currency)}{(stats.accountBalances[acc.id!] || 0).toLocaleString()}
                        </p>
                        {acc.currency && acc.currency !== displayCurrency && (
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">
                            ({getCurrencySymbol(displayCurrency)}{convertCurrency(stats.accountBalances[acc.id!] || 0, acc.currency, displayCurrency).toLocaleString()} {displayCurrency})
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Total Liquid Assets</p>
                  <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{getCurrencySymbol(displayCurrency)}{stats.liquidBalance.toLocaleString()}</p>
                </div>
              </div>

              <div className="p-8 bg-gray-50/50 dark:bg-gray-800/50">
                <button
                  onClick={() => setShowLiquidBreakdown(false)}
                  className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold hover:bg-gray-800 dark:hover:bg-gray-100 transition-all active:scale-95"
                >
                  Close Breakdown
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
