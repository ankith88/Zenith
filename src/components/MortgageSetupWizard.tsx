import React, { useState } from 'react';
import { Home, ArrowRight, Check, X, Loader2, Briefcase, User, Users, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, Account, RecurringTransaction } from '../lib/db';
import { sheetsService } from '../lib/sheets';

interface MortgageSetupWizardProps {
  accounts: Account[];
  onClose: () => void;
  onComplete: () => void;
}

export default function MortgageSetupWizard({ accounts, onClose, onComplete }: MortgageSetupWizardProps) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    mortgageName: 'Home Mortgage',
    totalBalance: '',
    interestRate: '',
    minPayment: '',
    businessShare: '',
    selfShare: '',
    wifeShare: '',
    businessAccountId: accounts.find(a => a.name.toLowerCase().includes('business'))?.id || 0,
    selfAccountId: accounts.find(a => a.name.toLowerCase().includes('salary') || a.name.toLowerCase().includes('checking'))?.id || 0,
    wifeAccountId: 0, // Usually needs to be created or selected
  });

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // 1. Create Mortgage Account
      const mortgageId = Date.now();
      const mortgageAccount: Account = {
        id: mortgageId,
        name: formData.mortgageName,
        initialBalance: -Math.abs(parseFloat(formData.totalBalance)),
        type: 'Mortgage',
        interestRate: parseFloat(formData.interestRate),
        minPayment: parseFloat(formData.minPayment),
        synced: false
      };

      await db.accounts.add(mortgageAccount);
      await sheetsService.appendAccount(mortgageAccount);
      await db.accounts.update(mortgageId, { synced: true });

      // 2. Create Recurring Transfers
      const recurringTransfers: RecurringTransaction[] = [];
      const today = new Date().toISOString().split('T')[0];

      if (formData.businessShare && formData.businessAccountId) {
        recurringTransfers.push({
          id: Date.now() + 1,
          description: 'Mortgage - Business Share',
          amount: parseFloat(formData.businessShare),
          category: 'Housing',
          type: 'Transfer',
          accountId: formData.businessAccountId,
          toAccountId: mortgageId,
          frequency: 'Monthly',
          startDate: today,
          synced: false
        });
      }

      if (formData.selfShare && formData.selfAccountId) {
        recurringTransfers.push({
          id: Date.now() + 2,
          description: 'Mortgage - Personal Share',
          amount: parseFloat(formData.selfShare),
          category: 'Housing',
          type: 'Transfer',
          accountId: formData.selfAccountId,
          toAccountId: mortgageId,
          frequency: 'Monthly',
          startDate: today,
          synced: false
        });
      }

      if (formData.wifeShare && formData.wifeAccountId) {
        recurringTransfers.push({
          id: Date.now() + 3,
          description: "Mortgage - Wife's Share",
          amount: parseFloat(formData.wifeShare),
          category: 'Housing',
          type: 'Transfer',
          accountId: formData.wifeAccountId,
          toAccountId: mortgageId,
          frequency: 'Monthly',
          startDate: today,
          synced: false
        });
      }

      for (const rt of recurringTransfers) {
        await db.recurringTransactions.add(rt);
        await sheetsService.appendRecurring(rt);
        await db.recurringTransactions.update(rt.id!, { synced: true });
      }

      onComplete();
    } catch (error) {
      console.error("Mortgage setup error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-md flex items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-[40px] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center">
              <Home className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">Mortgage Wizard</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Step {step} of 3</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-colors shadow-sm">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-indigo-50 p-4 rounded-2xl flex gap-3 items-start">
                  <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-indigo-700 leading-relaxed">
                    Let's start by entering your mortgage details. This will create a specialized debt account in your dashboard.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-black text-gray-400 uppercase mb-2 block">Mortgage Name</label>
                    <input
                      type="text"
                      value={formData.mortgageName}
                      onChange={(e) => setFormData({ ...formData, mortgageName: e.target.value })}
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-black outline-none font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-black text-gray-400 uppercase mb-2 block">Remaining Balance</label>
                      <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                        <input
                          type="number"
                          value={formData.totalBalance}
                          onChange={(e) => setFormData({ ...formData, totalBalance: e.target.value })}
                          placeholder="450,000"
                          className="w-full pl-10 pr-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-black outline-none font-bold"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-black text-gray-400 uppercase mb-2 block">Interest Rate (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.interestRate}
                        onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                        placeholder="4.5"
                        className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-black outline-none font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-black text-gray-400 uppercase mb-2 block">Total Monthly Payment (P+I)</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                      <input
                        type="number"
                        value={formData.minPayment}
                        onChange={(e) => setFormData({ ...formData, minPayment: e.target.value })}
                        placeholder="2,500"
                        className="w-full pl-10 pr-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-black outline-none font-bold"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-wider">Includes both Principal and Interest</p>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-emerald-50 p-4 rounded-2xl flex gap-3 items-start">
                  <Users className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-700 leading-relaxed">
                    Now, define how the payment is split between your different accounts.
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Business Share */}
                  <div className="p-5 bg-gray-50 rounded-3xl space-y-4">
                    <div className="flex items-center gap-3">
                      <Briefcase className="w-5 h-5 text-gray-400" />
                      <h4 className="text-sm font-black text-gray-900 uppercase">Business Contribution</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        value={formData.businessAccountId}
                        onChange={(e) => setFormData({ ...formData, businessAccountId: parseInt(e.target.value) })}
                        className="px-4 py-3 bg-white border-none rounded-xl text-sm font-bold outline-none"
                      >
                        <option value="0">Select Account</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      <input
                        type="number"
                        value={formData.businessShare}
                        onChange={(e) => setFormData({ ...formData, businessShare: e.target.value })}
                        placeholder="Amount"
                        className="px-4 py-3 bg-white border-none rounded-xl text-sm font-bold outline-none"
                      />
                    </div>
                  </div>

                  {/* Personal Share */}
                  <div className="p-5 bg-gray-50 rounded-3xl space-y-4">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-400" />
                      <h4 className="text-sm font-black text-gray-900 uppercase">Your Contribution</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        value={formData.selfAccountId}
                        onChange={(e) => setFormData({ ...formData, selfAccountId: parseInt(e.target.value) })}
                        className="px-4 py-3 bg-white border-none rounded-xl text-sm font-bold outline-none"
                      >
                        <option value="0">Select Account</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      <input
                        type="number"
                        value={formData.selfShare}
                        onChange={(e) => setFormData({ ...formData, selfShare: e.target.value })}
                        placeholder="Amount"
                        className="px-4 py-3 bg-white border-none rounded-xl text-sm font-bold outline-none"
                      />
                    </div>
                  </div>

                  {/* Wife Share */}
                  <div className="p-5 bg-gray-50 rounded-3xl space-y-4">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-gray-400" />
                      <h4 className="text-sm font-black text-gray-900 uppercase">Wife's Contribution</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        value={formData.wifeAccountId}
                        onChange={(e) => setFormData({ ...formData, wifeAccountId: parseInt(e.target.value) })}
                        className="px-4 py-3 bg-white border-none rounded-xl text-sm font-bold outline-none"
                      >
                        <option value="0">Select Account</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      <input
                        type="number"
                        value={formData.wifeShare}
                        onChange={(e) => setFormData({ ...formData, wifeShare: e.target.value })}
                        placeholder="Amount"
                        className="px-4 py-3 bg-white border-none rounded-xl text-sm font-bold outline-none"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6 py-8"
              >
                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900">Ready to Launch?</h3>
                  <p className="text-gray-500 mt-2">
                    Zenith will create your mortgage account and set up the monthly recurring transfers automatically.
                  </p>
                </div>
                <div className="bg-gray-50 p-6 rounded-3xl text-left space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400 font-bold">Mortgage Balance</span>
                    <span className="text-gray-900 font-black">${parseFloat(formData.totalBalance).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400 font-bold">Total Monthly Split</span>
                    <span className="text-emerald-600 font-black">
                      ${( (parseFloat(formData.businessShare) || 0) + (parseFloat(formData.selfShare) || 0) + (parseFloat(formData.wifeShare) || 0) ).toLocaleString()}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-gray-50 flex gap-4 bg-gray-50/30">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="flex-1 py-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
            >
              Back
            </button>
          )}
          <button
            onClick={step === 3 ? handleSubmit : handleNext}
            disabled={isLoading || (step === 1 && (!formData.totalBalance || !formData.minPayment))}
            className="flex-[2] py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {step === 3 ? 'Confirm & Create' : 'Next Step'}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
