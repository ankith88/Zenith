import React, { useState } from 'react';
import { Plus, Wallet, Landmark, CreditCard, Banknote, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, Account } from '../lib/db';
import { sheetsService } from '../lib/sheets';

interface AccountManagerProps {
  accounts: Account[];
}

export default function AccountManager({ accounts }: AccountManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    initialBalance: '',
    type: 'Checking',
    customType: ''
  });

  const commonNames = ['Main Checking', 'Emergency Fund', 'Travel Savings', 'Side Hustle', 'Daily Cash'];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const finalType = formData.type === 'Other' ? formData.customType : formData.type;
      const newAccount: Account = {
        id: Date.now(),
        name: formData.name,
        initialBalance: parseFloat(formData.initialBalance),
        type: finalType || 'Other',
        synced: false
      };

      await db.accounts.add(newAccount);
      await sheetsService.appendAccount(newAccount);
      await db.accounts.update(newAccount.id!, { synced: true });
      
      setIsAdding(false);
      setFormData({ name: '', initialBalance: '', type: 'Checking', customType: '' });
    } catch (error) {
      console.error("Add account error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'Savings': return <Landmark className="w-5 h-5" />;
      case 'Checking': return <Wallet className="w-5 h-5" />;
      case 'Credit Card': return <CreditCard className="w-5 h-5" />;
      case 'Cash': return <Banknote className="w-5 h-5" />;
      default: return <Wallet className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900">Your Accounts</h3>
        <button
          onClick={() => setIsAdding(true)}
          className="p-2 bg-black text-white rounded-xl hover:bg-gray-800 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {accounts.map((acc) => (
          <div key={acc.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-gray-50 rounded-xl text-gray-900">
              {getIcon(acc.type)}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{acc.name}</p>
              <p className="text-xs text-gray-400">{acc.type}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm font-black text-gray-900">${acc.initialBalance.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Initial</p>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/20 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Add New Account</h3>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-gray-50 rounded-xl">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <form onSubmit={handleAdd} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Account Name</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Main Savings"
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black outline-none"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {commonNames.map(name => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setFormData({ ...formData, name })}
                        className="text-[10px] font-bold px-2 py-1 bg-gray-50 text-gray-400 rounded-lg hover:bg-black hover:text-white transition-all"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Initial Balance</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={formData.initialBalance}
                    onChange={(e) => setFormData({ ...formData, initialBalance: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Account Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black outline-none"
                  >
                    <option value="Checking">Checking</option>
                    <option value="Savings">Savings</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Other">Other (Custom)</option>
                  </select>
                  {formData.type === 'Other' && (
                    <motion.input
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      required
                      type="text"
                      value={formData.customType}
                      onChange={(e) => setFormData({ ...formData, customType: e.target.value })}
                      placeholder="Enter custom type..."
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black outline-none"
                    />
                  )}
                </div>
                <button
                  disabled={isLoading}
                  className="w-full py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50 mt-4"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  Create Account
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
