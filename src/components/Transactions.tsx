import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Filter, ArrowUpRight, ArrowDownLeft, RefreshCw, Edit2, 
  Trash2, X, Download, Calendar as CalendarIcon, Wallet, ArrowLeftRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, Account, db } from '../lib/db';
import { sheetsService } from '../lib/sheets';
import { getCurrencySymbol, convertCurrency } from '../lib/utils';
import { getCategoryIcon } from '../constants';

interface TransactionsProps {
  transactions: Transaction[];
  accounts: Account[];
  displayCurrency: string;
}

export default function Transactions({ transactions, accounts, displayCurrency }: TransactionsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Income' | 'Expense' | 'Transfer'>('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [accountFilter, setAccountFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);

  const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Housing', 'Health', 'Utilities', 'Salary', 'Investment', 'Other'];

  const categories = useMemo(() => {
    const unique = Array.from(new Set(transactions.map(t => t.category))).filter(Boolean);
    return unique.length > 0 ? unique.sort() : DEFAULT_CATEGORIES;
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            t.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'All' || t.type === typeFilter;
        const matchesCategory = categoryFilter === 'All' || t.category === categoryFilter;
        const matchesAccount = accountFilter === 'All' || t.accountId.toString() === accountFilter;
        const matchesStartDate = !startDate || t.date >= startDate;
        const matchesEndDate = !endDate || t.date <= endDate;
        
        return matchesSearch && matchesType && matchesCategory && matchesAccount && matchesStartDate && matchesEndDate;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, searchTerm, typeFilter, categoryFilter, startDate, endDate]);

  const getAccountName = (id: number) => accounts.find(a => a.id === id)?.name || 'Unknown';

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;
    setIsLoading(true);
    try {
      await db.transactions.update(editingTransaction.id!, { ...editingTransaction, synced: false });
      await sheetsService.updateTransaction(editingTransaction);
      await db.transactions.update(editingTransaction.id!, { synced: true });
      setEditingTransaction(null);
    } catch (error) {
      console.error("Update transaction error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const predictCategory = async (description: string) => {
    if (description.length <= 3 || categories.length === 0) return;
    
    setIsPredicting(true);
    try {
      // Lazy load analystService to avoid circular dependency or unnecessary imports
      const { analystService } = await import('../lib/gemini');
      const predicted = await analystService.predictCategory(description, categories.filter(c => c !== 'All'));
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
    if (editingTransaction && editingTransaction.description.length > 3 && categories.length > 0) {
      const timer = setTimeout(() => {
        predictCategory(editingTransaction.description);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [editingTransaction?.description]);

  const handleDeleteTransaction = async (id: number) => {
    setIsLoading(true);
    try {
      await db.transactions.delete(id);
      await sheetsService.deleteTransaction(id);
      setDeletingTransactionId(null);
    } catch (error) {
      console.error("Delete transaction error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Description', 'Category', 'Type', 'Amount', 'Account', 'To Account'];
    const rows = filteredTransactions.map(t => [
      t.date,
      t.description,
      t.category,
      t.type,
      t.amount,
      getAccountName(t.accountId),
      t.toAccountId ? getAccountName(t.toAccountId) : ''
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `zenith_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4 p-1.5 bg-gray-100 dark:bg-gray-800 rounded-2xl w-fit">
          {['All', 'Income', 'Expense', 'Transfer'].map((tab) => (
            <button
              key={tab}
              onClick={() => setTypeFilter(tab as any)}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                typeFilter === tab 
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative lg:col-span-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-black dark:focus:ring-white text-gray-900 dark:text-white outline-none transition-all"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-black dark:focus:ring-white text-gray-900 dark:text-white outline-none transition-all appearance-none font-bold text-sm"
          >
            <option value="All">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-black dark:focus:ring-white text-gray-900 dark:text-white outline-none transition-all appearance-none font-bold text-sm"
          >
            <option value="All">All Accounts</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-10 pr-2 py-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-[10px] font-bold outline-none"
            />
          </div>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full pl-10 pr-2 py-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-[10px] font-bold outline-none"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                <th className="px-8 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Account</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">Amount</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filteredTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors group">
                  <td className="px-8 py-4 text-sm text-gray-400 font-bold tabular-nums">{t.date}</td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 p-2.5 rounded-2xl transition-all shadow-sm shrink-0 flex items-center justify-center ${
                        t.type === 'Income' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 
                        t.type === 'Expense' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' : 
                        'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                      }`}>
                        {getCategoryIcon(t.category, t.type)}
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white">{t.description}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-md">
                      {t.category}
                    </span>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex flex-col">
                      <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-bold text-gray-500 dark:text-gray-400 w-fit">
                        {getAccountName(t.accountId)}
                      </span>
                      {t.type === 'Transfer' && t.toAccountId && (
                        <div className="flex items-center gap-1 mt-1">
                          <ArrowDownLeft className="w-3 h-3 text-indigo-400 rotate-180" />
                          <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-full text-xs font-bold text-indigo-500 dark:text-indigo-400 w-fit">
                            {getAccountName(t.toAccountId)}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={`px-8 py-4 text-sm font-bold text-right ${
                    t.type === 'Income' ? 'text-emerald-600 dark:text-emerald-400' : 
                    t.type === 'Expense' ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'
                  }`}>
                    <div className="flex flex-col items-end">
                      <span>
                        {t.type === 'Income' ? '+' : t.type === 'Expense' ? '-' : ''}
                        {getCurrencySymbol(accounts.find(a => a.id === t.accountId)?.currency)}
                        {t.amount.toLocaleString()}
                      </span>
                      {accounts.find(a => a.id === t.accountId)?.currency !== displayCurrency && (
                        <span className="text-[10px] font-medium opacity-60">
                          ≈ {getCurrencySymbol(displayCurrency)}
                          {convertCurrency(t.amount, accounts.find(a => a.id === t.accountId)?.currency || 'AUD', displayCurrency).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setEditingTransaction(t)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-xl transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => t.id && setDeletingTransactionId(t.id)}
                        className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-gray-400 font-medium">
                    No transactions found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                  disabled={isLoading}
                  className="py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Delete'}
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
                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 block flex items-center justify-between">
                      Category
                      {isPredicting && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1 text-indigo-500">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span className="text-[8px] font-bold">Predicting...</span>
                        </motion.div>
                      )}
                    </label>
                  <div className="relative group">
                    <select
                      value={editingTransaction.category}
                      onChange={(e) => {
                        if (e.target.value === 'NEW') {
                          // Handle manual entry if needed, or just let them select from others
                          // For simplicity, we'll keep it as a select for existing categories
                        } else {
                          setEditingTransaction({ ...editingTransaction, category: e.target.value });
                        }
                      }}
                      className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all appearance-none ${isPredicting ? 'ring-1 ring-indigo-200' : ''}`}
                    >
                      {categories.filter(c => c !== 'All').map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="Manual">+ Type manually...</option>
                    </select>

                    {editingTransaction.category === 'Manual' && (
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mt-2">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Type category..."
                          onBlur={(e) => setEditingTransaction({ ...editingTransaction, category: e.target.value })}
                          className="w-full px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-sm"
                        />
                      </motion.div>
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
                  disabled={isLoading}
                  className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-100 transition-all active:scale-95 mt-4 disabled:opacity-50"
                >
                  {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
