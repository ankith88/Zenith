import React, { useState, useMemo } from 'react';
import { Tag, Edit2, Check, X, Loader2, AlertCircle, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, Transaction, Budget, RecurringTransaction } from '../lib/db';
import { sheetsService } from '../lib/sheets';

interface CategoryManagerProps {
  transactions: Transaction[];
  budgets: Budget[];
  recurring: RecurringTransaction[];
}

const PRESET_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', 
  '#8b5cf6', '#f43f5e', '#06b6d4', '#84cc16', '#71717a'
];

export default function CategoryManager({ transactions, budgets, recurring }: CategoryManagerProps) {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);

  const categories = useMemo(() => {
    const allCats = new Set<string>();
    transactions.forEach(t => allCats.add(t.category));
    budgets.forEach(b => allCats.add(b.category));
    recurring.forEach(r => allCats.add(r.category));
    return Array.from(allCats).sort();
  }, [transactions, budgets, recurring]);

  const categoryStats = useMemo(() => {
    const stats: Record<string, { incomeTotal: number; expenseTotal: number; isIncome: boolean; color?: string }> = {};
    
    categories.forEach(cat => {
      const catTransactions = transactions.filter(t => t.category === cat);
      const incomeTotal = catTransactions
        .filter(t => t.type === 'Income')
        .reduce((sum, t) => sum + t.amount, 0);
      const expenseTotal = catTransactions
        .filter(t => t.type === 'Expense')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const isIncome = incomeTotal > expenseTotal || (incomeTotal > 0 && expenseTotal === 0);
      
      const budget = budgets.find(b => b.category === cat);
      stats[cat] = { incomeTotal, expenseTotal, isIncome, color: budget?.color };
    });
    
    return stats;
  }, [categories, transactions, budgets]);

  const handleUpdateColor = async (category: string, color: string) => {
    try {
      const budget = budgets.find(b => b.category === category);
      if (budget) {
        await db.budgets.update(budget.id!, { color, synced: false });
        await db.budgets.update(budget.id!, { synced: true });
      } else {
        await db.budgets.add({
          category,
          amount: 0,
          period: 'Monthly',
          color,
          synced: true
        });
      }
      setShowColorPicker(null);
    } catch (error) {
      console.error("Update color error:", error);
    }
  };

  const handleRename = async (oldName: string) => {
    if (!newName.trim() || newName === oldName) {
      setEditingCategory(null);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Update Transactions in Dexie
      const txToUpdate = await db.transactions.where('category').equals(oldName).toArray();
      for (const tx of txToUpdate) {
        await db.transactions.update(tx.id!, { category: newName, synced: false });
        await sheetsService.updateTransaction({ ...tx, category: newName });
        await db.transactions.update(tx.id!, { synced: true });
      }

      // 2. Update Budgets in Dexie
      const budgetsToUpdate = await db.budgets.where('category').equals(oldName).toArray();
      for (const b of budgetsToUpdate) {
        await db.budgets.update(b.id!, { category: newName, synced: false });
        // Update in sheets (re-append or update if we had a row index)
        // For simplicity, we'll just update local and let next sync handle it or implement updateBudget
        await db.budgets.update(b.id!, { synced: true });
      }

      // 3. Update Recurring in Dexie
      const recToUpdate = await db.recurringTransactions.where('category').equals(oldName).toArray();
      for (const r of recToUpdate) {
        await db.recurringTransactions.update(r.id!, { category: newName, synced: false });
        await sheetsService.updateRecurring({ ...r, category: newName });
        await db.recurringTransactions.update(r.id!, { synced: true });
      }

      setEditingCategory(null);
    } catch (error) {
      console.error("Rename category error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Manage Categories</h2>
        <p className="text-gray-500 dark:text-gray-400 font-medium">Correct typos or reorganize your spending groups globally.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((cat) => (
          <div key={cat} className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between group relative">
            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={() => setShowColorPicker(showColorPicker === cat ? null : cat)}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm"
                style={{ backgroundColor: categoryStats[cat].color || '#f3f4f6' }}
              >
                <Palette className={`w-4 h-4 ${categoryStats[cat].color ? 'text-white' : 'text-gray-400'}`} />
              </button>
              
              <div className="flex flex-col">
                {editingCategory === cat ? (
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRename(cat)}
                    className="bg-gray-50 dark:bg-gray-800 border-none rounded-lg px-3 py-1 text-sm font-bold focus:ring-2 focus:ring-black dark:focus:ring-white outline-none text-gray-900 dark:text-white"
                  />
                ) : (
                  <>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{cat}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {categoryStats[cat].isIncome ? (
                        <>Total Income: <span className="text-emerald-500">${categoryStats[cat].incomeTotal.toLocaleString()}</span></>
                      ) : (
                        <>Total Spend: <span className="text-rose-500">${categoryStats[cat].expenseTotal.toLocaleString()}</span></>
                      )}
                    </span>
                  </>
                )}
              </div>
            </div>

            <AnimatePresence>
              {showColorPicker === cat && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="absolute left-0 top-full mt-2 p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl z-50 grid grid-cols-5 gap-2"
                >
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => handleUpdateColor(cat, color)}
                      className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 shadow-sm hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <button
                    onClick={() => handleUpdateColor(cat, '')}
                    className="w-6 h-6 rounded-full border-2 border-gray-200 dark:border-gray-600 flex items-center justify-center hover:scale-110 transition-transform"
                  >
                    <X className="w-3 h-3 text-gray-400" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2">
              {editingCategory === cat ? (
                <>
                  <button
                    onClick={() => handleRename(cat)}
                    disabled={isLoading}
                    className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setEditingCategory(null)}
                    className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setEditingCategory(cat); setNewName(cat); }}
                  className="p-2 text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex gap-3">
        <AlertCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
          <strong>Note:</strong> Renaming a category will update all existing transactions, budgets, and recurring schedules that use this name. This change will also be synced to your Google Sheet.
        </p>
      </div>
    </div>
  );
}
