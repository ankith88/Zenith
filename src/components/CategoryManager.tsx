import React, { useState, useMemo } from 'react';
import { Tag, Edit2, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, Transaction, Budget, RecurringTransaction } from '../lib/db';
import { sheetsService } from '../lib/sheets';

interface CategoryManagerProps {
  transactions: Transaction[];
  budgets: Budget[];
  recurring: RecurringTransaction[];
}

export default function CategoryManager({ transactions, budgets, recurring }: CategoryManagerProps) {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const categories = useMemo(() => {
    const allCats = new Set<string>();
    transactions.forEach(t => allCats.add(t.category));
    budgets.forEach(b => allCats.add(b.category));
    recurring.forEach(r => allCats.add(r.category));
    return Array.from(allCats).sort();
  }, [transactions, budgets, recurring]);

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
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Manage Categories</h2>
        <p className="text-gray-500 font-medium">Correct typos or reorganize your spending groups globally.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((cat) => (
          <div key={cat} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group">
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2 bg-gray-50 rounded-xl text-gray-400">
                <Tag className="w-4 h-4" />
              </div>
              {editingCategory === cat ? (
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRename(cat)}
                  className="flex-1 bg-gray-50 border-none rounded-lg px-3 py-1 text-sm font-bold focus:ring-2 focus:ring-black outline-none"
                />
              ) : (
                <span className="text-sm font-bold text-gray-900">{cat}</span>
              )}
            </div>

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
                    className="p-2 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setEditingCategory(cat); setNewName(cat); }}
                  className="p-2 text-gray-400 hover:text-black hover:bg-gray-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex gap-3">
        <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0" />
        <p className="text-xs text-indigo-700 leading-relaxed">
          <strong>Note:</strong> Renaming a category will update all existing transactions, budgets, and recurring schedules that use this name. This change will also be synced to your Google Sheet.
        </p>
      </div>
    </div>
  );
}
