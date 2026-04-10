import React, { useState } from 'react';
import { Car, ArrowRight, Check, X, Loader2, Info, Calendar, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, Account, RecurringTransaction } from '../lib/db';
import { sheetsService } from '../lib/sheets';
import { formatLocalDate, parseLocalDate } from '../lib/utils';

interface CarLoanSetupWizardProps {
  accounts: Account[];
  onClose: () => void;
  onComplete: () => void;
}

export default function CarLoanSetupWizard({ accounts, onClose, onComplete }: CarLoanSetupWizardProps) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    loanName: 'Car Loan',
    totalBalance: '',
    interestRate: '',
    monthlyPayment: '',
    sourceAccountId: accounts.find(a => a.name.toLowerCase().includes('salary') || a.name.toLowerCase().includes('checking'))?.id || 0,
    frequency: 'Monthly' as 'Monthly' | 'Weekly',
    startDate: formatLocalDate()
  });

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // 1. Create Car Loan Account
      const loanId = Date.now();
      const carLoanAccount: Account = {
        id: loanId,
        name: formData.loanName,
        initialBalance: -Math.abs(parseFloat(formData.totalBalance)),
        type: 'Car Loan',
        interestRate: parseFloat(formData.interestRate),
        minPayment: parseFloat(formData.monthlyPayment),
        paymentFrequency: formData.frequency,
        paymentDueDay: parseLocalDate(formData.startDate).getDate(),
        synced: false
      };

      await db.accounts.add(carLoanAccount);
      await sheetsService.appendAccount(carLoanAccount);
      await db.accounts.update(loanId, { synced: true });

      // 2. Create Recurring Transfer
      const recurringTransfer: RecurringTransaction = {
        id: Date.now() + 1,
        description: `${formData.loanName} Repayment`,
        amount: parseFloat(formData.monthlyPayment),
        category: 'Transport',
        type: 'Transfer',
        accountId: formData.sourceAccountId,
        toAccountId: loanId,
        frequency: formData.frequency,
        startDate: formData.startDate,
        synced: false
      };

      await db.recurringTransactions.add(recurringTransfer);
      await sheetsService.appendRecurring(recurringTransfer);
      await db.recurringTransactions.update(recurringTransfer.id!, { synced: true });

      onComplete();
    } catch (error) {
      console.error("Car loan setup error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-md flex items-center justify-center p-6 transition-colors">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 rounded-[40px] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] transition-colors"
      >
        {/* Header */}
        <div className="p-8 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-black dark:bg-white text-white dark:text-black rounded-2xl flex items-center justify-center transition-colors">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white transition-colors">Car Loan Wizard</h3>
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest transition-colors">Step {step} of 3</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white dark:hover:bg-gray-800 rounded-2xl transition-colors shadow-sm">
            <X className="w-5 h-5 text-gray-400 dark:text-gray-500" />
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
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl flex gap-3 items-start transition-colors">
                  <Info className="w-5 h-5 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                    Enter your car loan details to track your balance and automate your repayments.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase mb-2 block transition-colors">Loan Name</label>
                    <input
                      type="text"
                      value={formData.loanName}
                      onChange={(e) => setFormData({ ...formData, loanName: e.target.value })}
                      className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none font-bold text-gray-900 dark:text-white transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase mb-2 block transition-colors">Remaining Balance</label>
                      <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-gray-400 dark:text-gray-500 transition-colors">$</span>
                        <input
                          type="number"
                          value={formData.totalBalance}
                          onChange={(e) => setFormData({ ...formData, totalBalance: e.target.value })}
                          placeholder="25,000"
                          className="w-full pl-10 pr-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none font-bold text-gray-900 dark:text-white transition-colors placeholder:text-gray-300 dark:placeholder:text-gray-600"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase mb-2 block transition-colors">Interest Rate (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.interestRate}
                        onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                        placeholder="5.9"
                        className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none font-bold text-gray-900 dark:text-white transition-colors placeholder:text-gray-300 dark:placeholder:text-gray-600"
                      />
                    </div>
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
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl flex gap-3 items-start transition-colors">
                  <Calendar className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 leading-relaxed">
                    Setup your automated repayment schedule.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase mb-2 block transition-colors">Repayment Amount</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-gray-400 dark:text-gray-500 transition-colors">$</span>
                      <input
                        type="number"
                        value={formData.monthlyPayment}
                        onChange={(e) => setFormData({ ...formData, monthlyPayment: e.target.value })}
                        placeholder="450"
                        className="w-full pl-10 pr-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none font-bold text-gray-900 dark:text-white transition-colors placeholder:text-gray-300 dark:placeholder:text-gray-600"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase mb-2 block transition-colors">Frequency</label>
                      <select
                        value={formData.frequency}
                        onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                        className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none font-bold text-gray-900 dark:text-white transition-colors"
                      >
                        <option value="Monthly">Monthly</option>
                        <option value="Weekly">Weekly</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase mb-2 block transition-colors">Source Account</label>
                      <select
                        value={formData.sourceAccountId}
                        onChange={(e) => setFormData({ ...formData, sourceAccountId: parseInt(e.target.value) })}
                        className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none font-bold text-gray-900 dark:text-white transition-colors"
                      >
                        <option value="0">Select Account</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase mb-2 block transition-colors">Next Payment Date</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none font-bold text-gray-900 dark:text-white transition-colors"
                    />
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
                <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors">
                  <Check className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white transition-colors">Confirm Car Loan</h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-2 transition-colors">
                    Zenith will track your car loan and automate the {formData.frequency.toLowerCase()} repayments.
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-3xl text-left space-y-3 transition-colors">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400 dark:text-gray-500 font-bold transition-colors">Loan Balance</span>
                    <span className="text-gray-900 dark:text-white font-black transition-colors">${parseFloat(formData.totalBalance).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400 dark:text-gray-500 font-bold transition-colors">Repayment</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-black transition-colors">
                      ${parseFloat(formData.monthlyPayment).toLocaleString()} / {formData.frequency.toLowerCase()}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-gray-50 dark:border-gray-800 flex gap-4 bg-gray-50/30 dark:bg-gray-800/30 transition-colors">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="flex-1 py-4 rounded-2xl font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              Back
            </button>
          )}
          <button
            onClick={step === 3 ? handleSubmit : handleNext}
            disabled={isLoading || (step === 1 && (!formData.totalBalance || !formData.interestRate)) || (step === 2 && (!formData.monthlyPayment || !formData.sourceAccountId))}
            className="flex-[2] py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50 shadow-lg"
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
