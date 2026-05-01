import React, { useState } from 'react';
import { Plus, Repeat, Loader2, X, Trash2, Calendar, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, RecurringTransaction, Account } from '../lib/db';
import { sheetsService } from '../lib/sheets';
import { formatLocalDate, getCurrencySymbol } from '../lib/utils';

interface RecurringManagerProps {
  recurring: RecurringTransaction[];
  accounts: Account[];
}

export default function RecurringManager({ recurring, accounts }: RecurringManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    type: 'Expense' as RecurringTransaction['type'],
    accountId: accounts[0]?.id || 0,
    toAccountId: 0,
    frequency: 'Monthly' as RecurringTransaction['frequency'],
    startDate: formatLocalDate()
  });

  const handleOpenEdit = (item: RecurringTransaction) => {
    setEditingId(item.id!);
    setFormData({
      description: item.description,
      amount: item.amount.toString(),
      category: item.category,
      type: item.type,
      accountId: item.accountId,
      toAccountId: item.toAccountId || 0,
      frequency: item.frequency,
      startDate: item.startDate
    });
    setIsAdding(true);
  };

  const handleClose = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ 
      description: '', 
      amount: '', 
      category: '', 
      type: 'Expense', 
      accountId: accounts[0]?.id || 0,
      toAccountId: 0,
      frequency: 'Monthly',
      startDate: formatLocalDate()
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingId) {
        const updatedRecurring: RecurringTransaction = {
          id: editingId,
          description: formData.description,
          amount: parseFloat(formData.amount),
          category: formData.category,
          type: formData.type,
          accountId: formData.accountId,
          toAccountId: formData.type === 'Transfer' ? formData.toAccountId : undefined,
          frequency: formData.frequency,
          startDate: formData.startDate,
          synced: false
        };

        await db.recurringTransactions.update(editingId, updatedRecurring);
        await sheetsService.updateRecurring(updatedRecurring);
        await db.recurringTransactions.update(editingId, { synced: true });
      } else {
        const newRecurring: RecurringTransaction = {
          id: Date.now(),
          description: formData.description,
          amount: parseFloat(formData.amount),
          category: formData.category,
          type: formData.type,
          accountId: formData.accountId,
          toAccountId: formData.type === 'Transfer' ? formData.toAccountId : undefined,
          frequency: formData.frequency,
          startDate: formData.startDate,
          synced: false
        };

        await db.recurringTransactions.add(newRecurring);
        await sheetsService.appendRecurring(newRecurring);
        await db.recurringTransactions.update(newRecurring.id!, { synced: true });
      }
      
      handleClose();
    } catch (error) {
      console.error("Save recurring error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setIsLoading(true);
    try {
      await db.recurringTransactions.delete(id);
      setDeletingId(null);
    } catch (error) {
      console.error("Delete recurring error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Recurring</h3>
        <button
          onClick={() => setIsAdding(true)}
          className="p-2 bg-black dark:bg-white text-white dark:text-black rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {recurring.map((item) => (
          <div key={item.id} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4 group">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
              <Repeat className="w-5 h-5" />
            </div>
            <div className="flex-1 cursor-pointer" onClick={() => handleOpenEdit(item)}>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{item.description}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{item.frequency} • {item.category}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-gray-900 dark:text-white">
                {getCurrencySymbol(accounts.find(a => a.id === item.accountId)?.currency)}
                {item.amount.toLocaleString()}
              </p>
              <button 
                onClick={() => item.id && setDeletingId(item.id)}
                className="lg:opacity-0 lg:group-hover:opacity-100 transition-opacity p-1 text-red-400 hover:text-red-600"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {deletingId && (
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
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Stop Recurring?</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">This will stop future transactions from being automatically created.</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setDeletingId(null)}
                  className="py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deletingId)}
                  disabled={isLoading}
                  className="py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Stop'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {isAdding && (
          <motion.div
            key="add-edit-modal"
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
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{editingId ? 'Edit Recurring' : 'New Recurring'}</h3>
                <button onClick={handleClose} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 block">Description</label>
                  <input
                    required
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="e.g. Netflix Subscription"
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
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 block">Frequency</label>
                    <select
                      value={formData.frequency}
                      onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                    >
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 block">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                    >
                      <option value="Expense">Expense</option>
                      <option value="Income">Income</option>
                      <option value="Transfer">Transfer</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 block">{formData.type === 'Transfer' ? 'From Account' : 'Account'}</label>
                    <select
                      value={formData.accountId}
                      onChange={(e) => setFormData({ ...formData, accountId: parseInt(e.target.value) })}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {formData.type === 'Transfer' ? (
                  <div>
                    <label className="text-xs font-bold text-indigo-400 dark:text-indigo-500 uppercase mb-1 block">To Account</label>
                    <select
                      value={formData.toAccountId}
                      onChange={(e) => setFormData({ ...formData, toAccountId: parseInt(e.target.value) })}
                      className="w-full px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-600 dark:text-indigo-400"
                    >
                      <option value="0">Select Account</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 block">Category</label>
                    <input
                      required
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="e.g. Entertainment"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 block">Start Date</label>
                  <input
                    required
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                  />
                </div>
                <button
                  disabled={isLoading}
                  className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50 mt-4"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingId ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />)}
                  {editingId ? 'Save Changes' : 'Add Recurring'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
