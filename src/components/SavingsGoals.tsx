import React, { useState } from 'react';
import { Target, Plus, X, Loader2, Trash2, TrendingUp, Calendar, Sparkles, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, Goal, Account } from '../lib/db';
import { sheetsService } from '../lib/sheets';

interface SavingsGoalsProps {
  goals: Goal[];
  accounts: Account[];
  accountBalances: Record<number, number>;
  monthlySavings: number;
}

export default function SavingsGoals({ goals, accounts, accountBalances, monthlySavings }: SavingsGoalsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [deletingGoalId, setDeletingGoalId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    targetAmount: '',
    currentAmount: '0',
    deadline: '',
    category: 'Travel',
    color: '#4f46e5',
    accountId: '' as string | number
  });

  const categories = [
    { name: 'Travel', color: '#4f46e5' },
    { name: 'Emergency', color: '#ef4444' },
    { name: 'Home', color: '#10b981' },
    { name: 'Car', color: '#f59e0b' },
    { name: 'Investment', color: '#8b5cf6' },
    { name: 'Other', color: '#6b7280' }
  ];

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const newGoal: Goal = {
        id: Date.now(),
        name: formData.name,
        targetAmount: parseFloat(formData.targetAmount),
        currentAmount: formData.accountId ? (accountBalances[Number(formData.accountId)] || 0) : parseFloat(formData.currentAmount),
        deadline: formData.deadline || undefined,
        category: formData.category,
        color: formData.color,
        accountId: formData.accountId ? Number(formData.accountId) : undefined,
        synced: false
      };
      await db.goals.add(newGoal);
      await sheetsService.appendGoal(newGoal);
      await db.goals.update(newGoal.id!, { synced: true });
      
      setIsAdding(false);
      setFormData({ name: '', targetAmount: '', currentAmount: '0', deadline: '', category: 'Travel', color: '#4f46e5', accountId: '' });
    } catch (error) {
      console.error("Add goal error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal) return;
    setIsLoading(true);
    try {
      const updatedGoal: Goal = {
        ...editingGoal,
        name: formData.name,
        targetAmount: parseFloat(formData.targetAmount),
        currentAmount: formData.accountId ? (accountBalances[Number(formData.accountId)] || 0) : parseFloat(formData.currentAmount),
        deadline: formData.deadline || undefined,
        category: formData.category,
        color: formData.color,
        accountId: formData.accountId ? Number(formData.accountId) : undefined,
        synced: false
      };
      await db.goals.update(editingGoal.id!, updatedGoal);
      await sheetsService.updateGoal(updatedGoal);
      await db.goals.update(editingGoal.id!, { synced: true });
      
      setEditingGoal(null);
      setFormData({ name: '', targetAmount: '', currentAmount: '0', deadline: '', category: 'Travel', color: '#4f46e5', accountId: '' });
    } catch (error) {
      console.error("Update goal error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (goal: Goal) => {
    setEditingGoal(goal);
    setFormData({
      name: goal.name,
      targetAmount: goal.targetAmount.toString(),
      currentAmount: goal.currentAmount.toString(),
      deadline: goal.deadline || '',
      category: goal.category,
      color: goal.color,
      accountId: goal.accountId?.toString() || ''
    });
  };

  const handleDeleteGoal = async (id: number) => {
    setIsLoading(true);
    try {
      await db.goals.delete(id);
      await sheetsService.deleteGoal(id);
      setDeletingGoalId(null);
    } catch (error) {
      console.error("Delete goal error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateETA = (goal: Goal) => {
    const currentAmount = goal.accountId ? (accountBalances[goal.accountId] || 0) : goal.currentAmount;
    const remaining = goal.targetAmount - currentAmount;
    if (remaining <= 0) return "Goal Reached!";
    if (monthlySavings <= 0) return "Infinite (No savings)";
    
    const months = Math.ceil(remaining / monthlySavings);
    if (months > 12) {
      const years = (months / 12).toFixed(1);
      return `${years} years`;
    }
    return `${months} months`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl text-indigo-600 dark:text-indigo-400">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white">Savings Goals</h3>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Give your money a purpose</p>
          </div>
        </div>
        <button
          onClick={() => {
            setFormData({ name: '', targetAmount: '', currentAmount: '0', deadline: '', category: 'Travel', color: '#4f46e5', accountId: '' });
            setIsAdding(true);
          }}
          className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all active:scale-95 shadow-lg shadow-black/10"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {goals.map((goal) => {
          const currentAmount = goal.accountId ? (accountBalances[goal.accountId] || 0) : goal.currentAmount;
          const progress = Math.min((currentAmount / goal.targetAmount) * 100, 100);
          const linkedAccount = goal.accountId ? accounts.find(a => a.id === goal.accountId) : null;

          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-900 p-6 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
                    style={{ backgroundColor: goal.color }}
                  >
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900 dark:text-white">{goal.name}</h4>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{goal.category}</p>
                      {linkedAccount ? (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-full border border-indigo-100 dark:border-indigo-800">
                          <div className="w-1 h-1 bg-indigo-400 rounded-full animate-pulse" />
                          <p className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Linked: {linkedAccount.name}</p>
                        </div>
                      ) : (
                        <button 
                          onClick={() => startEditing(goal)}
                          className="text-[9px] font-black text-gray-400 dark:text-gray-500 hover:text-indigo-500 uppercase tracking-widest transition-colors"
                        >
                          + Link Account
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => startEditing(goal)}
                    className="p-2 text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => goal.id && setDeletingGoalId(goal.id)}
                    className="p-2 text-gray-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">${currentAmount.toLocaleString()}</p>
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500">of ${goal.targetAmount.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900 dark:text-white">{progress.toFixed(0)}%</p>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Progress</p>
                  </div>
                </div>

                <div className="h-3 bg-gray-50 dark:bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full rounded-full shadow-sm"
                    style={{ backgroundColor: goal.color }}
                  />
                </div>

                <div className="pt-4 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-bold">ETA: {calculateETA(goal)}</span>
                  </div>
                  {goal.deadline && (
                    <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs font-bold">{new Date(goal.deadline).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}

        {goals.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-800/50 rounded-[40px] border-2 border-dashed border-gray-200 dark:border-gray-700">
            <Target className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">No active goals</p>
            <button 
              onClick={() => setIsAdding(true)}
              className="mt-4 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Create your first goal
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {deletingGoalId && (
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
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Goal?</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">This will remove your savings target and progress tracking.</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setDeletingGoalId(null)}
                  className="py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteGoal(deletingGoalId)}
                  disabled={isLoading}
                  className="py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {(isAdding || editingGoal) && (
          <motion.div
            key="goal-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/20 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                <h3 className="text-xl font-black text-gray-900 dark:text-white">{editingGoal ? 'Edit Goal' : 'New Goal'}</h3>
                <button onClick={() => { setIsAdding(false); setEditingGoal(null); }} className="p-3 hover:bg-white dark:hover:bg-gray-800 rounded-2xl transition-colors shadow-sm">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <form onSubmit={editingGoal ? handleUpdateGoal : handleAddGoal} className="p-8 space-y-6">
                <div>
                  <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 block">Goal Name</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Dream Holiday"
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 block">Target Amount</label>
                    <input
                      required
                      type="number"
                      value={formData.targetAmount}
                      onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 block">Link to Account</label>
                    <select
                      value={formData.accountId}
                      onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                      className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none font-bold"
                    >
                      <option value="">Manual Entry</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {!formData.accountId && (
                  <div>
                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 block">Current Saved</label>
                    <input
                      required
                      type="number"
                      value={formData.currentAmount}
                      onChange={(e) => setFormData({ ...formData, currentAmount: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none font-bold"
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 block">Deadline (Optional)</label>
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 block">Category & Color</label>
                  <div className="grid grid-cols-3 gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => setFormData({ ...formData, category: cat.name, color: cat.color })}
                        className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                          formData.category === cat.name ? 'border-black dark:border-white bg-gray-50 dark:bg-gray-800' : 'border-transparent bg-gray-50/50 dark:bg-gray-800/50'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{cat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  disabled={isLoading}
                  className="w-full py-5 bg-black dark:bg-white text-white dark:text-black rounded-[24px] font-black flex items-center justify-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-black/10"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Target className="w-5 h-5" />}
                  {editingGoal ? 'Update Goal' : 'Create Goal'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
