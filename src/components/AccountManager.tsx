import React, { useState } from 'react';
import { Plus, Wallet, Landmark, CreditCard, Banknote, Loader2, X, Edit2, Trash2, Briefcase, Calendar, Home, Scale, Car, TrendingUp, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, Account, Transaction } from '../lib/db';
import { sheetsService } from '../lib/sheets';
import { formatLocalDate } from '../lib/utils';

interface AccountManagerProps {
  accounts: Account[];
  accountBalances: Record<number, number>;
}

export default function AccountManager({ accounts, accountBalances }: AccountManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [adjustingAccount, setAdjustingAccount] = useState<Account | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<number | null>(null);
  const [newBalance, setNewBalance] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    initialBalance: '',
    type: 'Checking',
    customType: '',
    interestRate: '',
    minPayment: '',
    owner: 'Me',
    isPrivate: false,
    assetValue: '',
    creditLimit: '',
    paymentFrequency: 'Monthly',
    paymentDueDay: ''
  });

  const commonNames = ['Main Checking', 'Emergency Fund', 'Mortgage Offset', 'Travel Savings', 'Side Hustle', 'Daily Cash', 'Salary Hub', 'Business Account', 'Home Mortgage'];

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
        interestRate: formData.interestRate ? parseFloat(formData.interestRate) : undefined,
        minPayment: formData.minPayment ? parseFloat(formData.minPayment) : undefined,
        assetValue: formData.assetValue ? parseFloat(formData.assetValue) : undefined,
        creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : undefined,
        paymentFrequency: formData.paymentFrequency as 'Monthly' | 'Weekly',
        paymentDueDay: formData.paymentDueDay ? parseInt(formData.paymentDueDay) : undefined,
        owner: formData.owner,
        isPrivate: formData.isPrivate,
        synced: false
      };

      await db.accounts.add(newAccount);
      await sheetsService.appendAccount(newAccount);
      await db.accounts.update(newAccount.id!, { synced: true });
      
      setIsAdding(false);
      setFormData({ name: '', initialBalance: '', type: 'Checking', customType: '', interestRate: '', minPayment: '', owner: 'Me', isPrivate: false, assetValue: '', creditLimit: '', paymentFrequency: 'Monthly', paymentDueDay: '' });
    } catch (error) {
      console.error("Add account error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setIsLoading(true);
    try {
      const updatedAccount: Account = {
        ...editingAccount,
        synced: false
      };
      await db.accounts.update(editingAccount.id!, updatedAccount);
      await sheetsService.updateAccount(updatedAccount);
      await db.accounts.update(editingAccount.id!, { synced: true });
      setEditingAccount(null);
      setFormData({ name: '', initialBalance: '', type: 'Checking', customType: '', interestRate: '', minPayment: '', owner: 'Me', isPrivate: false, assetValue: '', creditLimit: '', paymentFrequency: 'Monthly', paymentDueDay: '' });
    } catch (error) {
      console.error("Update account error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingAccount || !newBalance) return;
    setIsLoading(true);
    try {
      // Calculate current balance
      const accTransactions = await db.transactions.where('accountId').equals(adjustingAccount.id!).toArray();
      const toTransactions = await db.transactions.where('toAccountId').equals(adjustingAccount.id!).toArray();
      
      let currentBalance = adjustingAccount.initialBalance;
      accTransactions.forEach(t => {
        if (t.type === 'Income') currentBalance += t.amount;
        else if (t.type === 'Expense' || t.type === 'Transfer') currentBalance -= t.amount;
      });
      toTransactions.forEach(t => {
        if (t.type === 'Transfer') currentBalance += t.amount;
      });

      const targetBalance = parseFloat(newBalance);
      const diff = targetBalance - currentBalance;

      if (Math.abs(diff) > 0.01) {
        const adjustmentTx: Transaction = {
          date: formatLocalDate(),
          amount: Math.abs(diff),
          category: 'Adjustment',
          description: `Balance Adjustment`,
          type: diff > 0 ? 'Income' : 'Expense',
          accountId: adjustingAccount.id!,
          synced: false
        };

        const tId = await db.transactions.add(adjustmentTx);
        await sheetsService.appendTransaction({ ...adjustmentTx, id: tId });
        await db.transactions.update(tId, { synced: true });
      }

      setAdjustingAccount(null);
      setNewBalance('');
    } catch (error) {
      console.error("Adjust balance error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setIsLoading(true);
    try {
      await db.accounts.delete(id);
      await sheetsService.deleteAccount(id);
      setDeletingAccountId(null);
    } catch (error) {
      console.error("Delete account error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'Savings': return <Landmark className="w-5 h-5" />;
      case 'Offset Account': return <ShieldCheck className="w-5 h-5" />;
      case 'Checking': return <Wallet className="w-5 h-5" />;
      case 'Credit Card': return <CreditCard className="w-5 h-5" />;
      case 'Cash': return <Banknote className="w-5 h-5" />;
      case 'Salary Account': return <Briefcase className="w-5 h-5" />;
      case 'Offset Account': return <ShieldCheck className="w-5 h-5" />;
      case 'Daily Account': return <Calendar className="w-5 h-5" />;
      case 'Business Account': return <Briefcase className="w-5 h-5" />;
      case 'Mortgage': return <Home className="w-5 h-5" />;
      case 'Car Loan': return <Car className="w-5 h-5" />;
      default: return <Wallet className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900">Your Accounts</h3>
        <button
          id="account-manager-add-btn"
          onClick={() => setIsAdding(true)}
          className="p-2 bg-black text-white rounded-xl hover:bg-gray-800 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {accounts.map((acc) => (
          <div key={acc.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 group">
            <div className="p-3 bg-gray-50 rounded-xl text-gray-900">
              {getIcon(acc.type)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-900">{acc.name}</p>
                {acc.isPrivate && (
                  <span className="px-1.5 py-0.5 bg-rose-50 text-rose-500 text-[8px] font-black uppercase rounded-md border border-rose-100">Private</span>
                )}
                {acc.owner && acc.owner !== 'Me' && (
                  <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-500 text-[8px] font-black uppercase rounded-md border border-indigo-100">{acc.owner}</span>
                )}
                {acc.type === 'Credit Card' && acc.creditLimit && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                    (accountBalances[acc.id!] || 0) < -(acc.creditLimit * 0.9) 
                      ? 'bg-red-100 text-red-600 animate-pulse' 
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    Limit: ${acc.creditLimit.toLocaleString()}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">{acc.type}</p>
              {acc.type === 'Credit Card' && acc.creditLimit && (
                <div className="mt-2 w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${
                      (accountBalances[acc.id!] || 0) < -(acc.creditLimit * 0.9) ? 'bg-red-500' : 'bg-black'
                    }`}
                    style={{ width: `${Math.min(100, (Math.abs(accountBalances[acc.id!] || 0) / acc.creditLimit) * 100)}%` }}
                  />
                </div>
              )}
            </div>
              <div className="text-right">
                <p className="text-sm font-black text-gray-900">${(accountBalances[acc.id!] || 0).toLocaleString()}</p>
                {acc.assetValue && (
                  <p className="text-[10px] text-emerald-600 font-bold">Equity: ${(acc.assetValue - Math.abs(accountBalances[acc.id!] || 0)).toLocaleString()}</p>
                )}
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Current</p>
              </div>
            <div className="flex flex-col gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => setAdjustingAccount(acc)}
                className="p-1.5 hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 rounded-lg transition-colors"
                title="Adjust Balance"
              >
                <Scale className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setEditingAccount(acc)}
                className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-black rounded-lg transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => acc.id && setDeletingAccountId(acc.id)}
                className="p-1.5 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {deletingAccountId && (
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
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden p-8 text-center"
            >
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Account?</h3>
              <p className="text-gray-500 mb-8 text-sm">All associated transactions will remain but the account balance will be lost from totals.</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setDeletingAccountId(null)}
                  className="py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deletingAccountId)}
                  disabled={isLoading}
                  className="py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {adjustingAccount && (
          <motion.div
            key="adjust-modal"
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
                <h3 className="text-xl font-bold text-gray-900">Adjust Balance</h3>
                <button onClick={() => setAdjustingAccount(null)} className="p-2 hover:bg-gray-50 rounded-xl">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <form onSubmit={handleAdjustBalance} className="p-6 space-y-4">
                <p className="text-sm text-gray-500">
                  Enter the current actual balance for <strong>{adjustingAccount.name}</strong>. Zenith will create an adjustment transaction to match this.
                </p>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Actual Current Balance</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={newBalance}
                    onChange={(e) => setNewBalance(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black outline-none"
                  />
                </div>
                <button
                  disabled={isLoading}
                  className="w-full py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50 mt-4"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scale className="w-5 h-5" />}
                  Adjust Balance
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {(isAdding || editingAccount) && (
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
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingAccount ? 'Edit Account' : 'Add New Account'}
                </h3>
                <button onClick={() => { setIsAdding(false); setEditingAccount(null); }} className="p-2 hover:bg-gray-50 rounded-xl">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <form onSubmit={editingAccount ? handleUpdate : handleAdd} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Account Name</label>
                  <input
                    required
                    type="text"
                    value={editingAccount ? editingAccount.name : formData.name}
                    onChange={(e) => editingAccount ? setEditingAccount({ ...editingAccount, name: e.target.value }) : setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Main Savings"
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black outline-none"
                  />
                  {!editingAccount && (
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
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Initial Balance</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={editingAccount ? editingAccount.initialBalance : formData.initialBalance}
                    onChange={(e) => editingAccount ? setEditingAccount({ ...editingAccount, initialBalance: parseFloat(e.target.value) }) : setFormData({ ...formData, initialBalance: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Account Type</label>
                  <select
                    value={editingAccount ? editingAccount.type : formData.type}
                    onChange={(e) => editingAccount ? setEditingAccount({ ...editingAccount, type: e.target.value }) : setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black outline-none"
                  >
                    <option value="Checking">Checking</option>
                    <option value="Savings">Savings</option>
                    <option value="Offset Account">Offset Account</option>
                    <option value="Salary Account">Salary Account</option>
                    <option value="Daily Account">Daily Account</option>
                    <option value="Business Account">Business Account</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Mortgage">Mortgage</option>
                    <option value="Car Loan">Car Loan</option>
                    <option value="Cash">Cash</option>
                    <option value="Other">Other (Custom)</option>
                  </select>
                  {!editingAccount && formData.type === 'Other' && (
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

                {( (editingAccount && (editingAccount.type === 'Credit Card' || editingAccount.type === 'Mortgage')) || (!editingAccount && (formData.type === 'Credit Card' || formData.type === 'Mortgage')) ) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Interest Rate (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingAccount ? editingAccount.interestRate || '' : formData.interestRate}
                        onChange={(e) => editingAccount ? setEditingAccount({ ...editingAccount, interestRate: parseFloat(e.target.value) }) : setFormData({ ...formData, interestRate: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Min. Payment</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingAccount ? editingAccount.minPayment || '' : formData.minPayment}
                        onChange={(e) => editingAccount ? setEditingAccount({ ...editingAccount, minPayment: parseFloat(e.target.value) }) : setFormData({ ...formData, minPayment: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black outline-none"
                      />
                    </div>
                  </div>
                )}

                {( (editingAccount && (editingAccount.type === 'Credit Card' || editingAccount.type === 'Mortgage')) || (!editingAccount && (formData.type === 'Credit Card' || formData.type === 'Mortgage')) ) && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Payment Frequency</label>
                        <select
                          value={editingAccount ? editingAccount.paymentFrequency || 'Monthly' : formData.paymentFrequency}
                          onChange={(e) => editingAccount ? setEditingAccount({ ...editingAccount, paymentFrequency: e.target.value as any }) : setFormData({ ...formData, paymentFrequency: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black outline-none"
                        >
                          <option value="Monthly">Monthly</option>
                          <option value="Weekly">Weekly</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">
                          {(editingAccount ? editingAccount.paymentFrequency : formData.paymentFrequency) === 'Weekly' ? 'Day of Week' : 'Day of Month'}
                        </label>
                        { (editingAccount ? editingAccount.paymentFrequency : formData.paymentFrequency) === 'Weekly' ? (
                          <select
                            value={editingAccount ? editingAccount.paymentDueDay ?? '' : formData.paymentDueDay}
                            onChange={(e) => editingAccount ? setEditingAccount({ ...editingAccount, paymentDueDay: parseInt(e.target.value) }) : setFormData({ ...formData, paymentDueDay: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black outline-none"
                          >
                            <option value="">Select Day</option>
                            <option value="0">Sunday</option>
                            <option value="1">Monday</option>
                            <option value="2">Tuesday</option>
                            <option value="3">Wednesday</option>
                            <option value="4">Thursday</option>
                            <option value="5">Friday</option>
                            <option value="6">Saturday</option>
                          </select>
                        ) : (
                          <input
                            type="number"
                            min="1"
                            max="31"
                            value={editingAccount ? editingAccount.paymentDueDay ?? '' : formData.paymentDueDay}
                            onChange={(e) => editingAccount ? setEditingAccount({ ...editingAccount, paymentDueDay: parseInt(e.target.value) }) : setFormData({ ...formData, paymentDueDay: e.target.value })}
                            placeholder="e.g. 15"
                            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black outline-none"
                          />
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 italic">Interest will be charged on this day each {(editingAccount ? editingAccount.paymentFrequency : formData.paymentFrequency) === 'Weekly' ? 'week' : 'month'}.</p>
                  </div>
                )}

                {( (editingAccount && (editingAccount.type === 'Credit Card' || editingAccount.type === 'Mortgage' || editingAccount.type === 'Car Loan')) || (!editingAccount && (formData.type === 'Credit Card' || formData.type === 'Mortgage' || formData.type === 'Car Loan')) ) && (
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Asset & Limit Settings</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-emerald-600 uppercase mb-1 block">Current Market Value (Asset)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingAccount ? editingAccount.assetValue || '' : formData.assetValue}
                          onChange={(e) => editingAccount ? setEditingAccount({ ...editingAccount, assetValue: parseFloat(e.target.value) }) : setFormData({ ...formData, assetValue: e.target.value })}
                          placeholder="e.g. 1600000"
                          className="w-full px-4 py-3 bg-white border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-emerald-900"
                        />
                      </div>
                      {( (editingAccount && editingAccount.type === 'Credit Card') || (!editingAccount && formData.type === 'Credit Card') ) && (
                        <div>
                          <label className="text-[10px] font-bold text-emerald-600 uppercase mb-1 block">Credit Limit (Max Spend)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editingAccount ? editingAccount.creditLimit || '' : formData.creditLimit}
                            onChange={(e) => editingAccount ? setEditingAccount({ ...editingAccount, creditLimit: parseFloat(e.target.value) }) : setFormData({ ...formData, creditLimit: e.target.value })}
                            placeholder="e.g. 15000"
                            className="w-full px-4 py-3 bg-white border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-emerald-900"
                          />
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-emerald-500 mt-1 italic">Linked asset value helps calculate Net Worth. Credit limit tracks your max spend.</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Owner</label>
                    <select
                      value={editingAccount ? editingAccount.owner || 'Me' : formData.owner}
                      onChange={(e) => editingAccount ? setEditingAccount({ ...editingAccount, owner: e.target.value }) : setFormData({ ...formData, owner: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black outline-none"
                    >
                      <option value="Me">Me</option>
                      <option value="Partner">Partner</option>
                      <option value="Joint">Joint</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="isPrivate"
                      checked={editingAccount ? editingAccount.isPrivate : formData.isPrivate}
                      onChange={(e) => editingAccount ? setEditingAccount({ ...editingAccount, isPrivate: e.target.checked }) : setFormData({ ...formData, isPrivate: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                    />
                    <label htmlFor="isPrivate" className="text-xs font-bold text-gray-400 uppercase cursor-pointer">Private</label>
                  </div>
                </div>

                <button
                  disabled={isLoading}
                  className="w-full py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50 mt-4"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : editingAccount ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  {editingAccount ? 'Save Changes' : 'Create Account'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
