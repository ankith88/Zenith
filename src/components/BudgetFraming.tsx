import React, { useState, useEffect } from 'react';
import { Transaction, Account, db } from '../lib/db';
import { analystService } from '../lib/gemini';
import { Layout, Loader2, Sparkles, Check, X, Shield, Heart, PiggyBank, ArrowRight, AlertTriangle, Activity, Scale } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BudgetFramingProps {
  transactions: Transaction[];
  accounts: Account[];
  onComplete?: () => void;
}

interface FramingData {
  methodology: '50/30/20' | 'Zero-Based' | 'Custom';
  analysis: string;
  suggestedBudgets: {
    category: string;
    amount: number;
    period: 'Monthly' | 'Weekly';
    type: 'Needs' | 'Wants' | 'Savings/Debt';
  }[];
  currentStats: {
    avgMonthlyIncome: number;
    avgMonthlyExpense: number;
  };
}

export default function BudgetFraming({ transactions, accounts, onComplete }: BudgetFramingProps) {
  const [framing, setFraming] = useState<FramingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateFraming = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await analystService.getBudgetFraming(transactions, accounts);
      setFraming(data);
    } catch (err: any) {
      console.error("Budget framing error:", err);
      setError(err.message || "Failed to architect budget structure.");
    } finally {
      setIsLoading(false);
    }
  };

  const applyBudgets = async () => {
    if (!framing) return;
    setIsApplying(true);
    try {
      await db.budgets.clear();
      for (const b of framing.suggestedBudgets) {
        await db.budgets.add({
          category: b.category,
          amount: b.amount,
          period: b.period,
          synced: false
        });
      }
      onComplete?.();
    } catch (err) {
      console.error("Apply budgets error:", err);
    } finally {
      setIsApplying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-12 border border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center min-h-[500px]">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse" />
          <Layout className="w-16 h-16 text-indigo-500 relative z-10 animate-bounce" />
        </div>
        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 text-center">Architecting Your Budget...</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center max-w-xs">
          Zenith is analyzing 90 days of cash flow to build your perfect financial structure.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-12 border border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center min-h-[400px]">
        <AlertTriangle className="w-16 h-16 text-rose-500 mb-6" />
        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4">Framing Failed</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md text-center">{error}</p>
        <button
          onClick={generateFraming}
          className="px-8 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black hover:scale-105 transition-transform"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!framing) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-12 border border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center min-h-[500px]">
        <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl flex items-center justify-center mb-8">
          <Layout className="w-10 h-10 text-indigo-500" />
        </div>
        <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-4 text-center">AI Budget Architect</h3>
        <p className="text-gray-500 dark:text-gray-400 text-lg text-center max-w-xl mb-10 leading-relaxed">
          Struggling to set budgets? Zenith can analyze your past 90 days of income and spending to instantly map your finances into structured methodologies like 50/30/20 or Zero-Based budgeting.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 mb-12">
          <button
            onClick={generateFraming}
            className="px-10 py-5 bg-indigo-600 text-white rounded-[2rem] font-black flex items-center gap-3 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
          >
            <Sparkles className="w-6 h-6" />
            Start AI Framing
          </button>
          <button
            onClick={() => onComplete?.()}
            className="px-10 py-5 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-[2rem] font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
          >
            I'll Handle it Manually
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl">
          <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-3xl">
            <h4 className="font-black text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              1. Analysis
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Zenith scans your last 90 days of transactions to find your true average monthly income and mandatory expenses.</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-3xl">
            <h4 className="font-black text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <Scale className="w-4 h-4 text-indigo-500" />
              2. Selection
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">It picks the best method (like 50/30/20 or Zero-Based) that fits your current lifestyle and financial goals.</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-3xl">
            <h4 className="font-black text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <Check className="w-4 h-4 text-indigo-500" />
              3. Blueprint
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Finally, it generates a full budget blueprint that you can apply with one click to automate your tracking.</p>
          </div>
        </div>
        <p className="mt-8 text-gray-400 dark:text-gray-500 text-xs font-medium uppercase tracking-widest">Powered by Zenith Intelligence</p>
      </div>
    );
  }

  const typeColors = {
    'Needs': 'bg-blue-500',
    'Wants': 'bg-amber-500',
    'Savings/Debt': 'bg-emerald-500'
  };

  const typeIcons = {
    'Needs': <Shield className="w-4 h-4" />,
    'Wants': <Heart className="w-4 h-4" />,
    'Savings/Debt': <PiggyBank className="w-4 h-4" />
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="bg-black dark:bg-white rounded-[2.5rem] p-10 text-white dark:text-black shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10">
          <Sparkles className="w-48 h-48" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 bg-white/10 dark:bg-black/10 backdrop-blur-md rounded-2xl flex items-center justify-center">
              <Layout className="w-7 h-7" />
            </div>
            <div>
              <p className="text-white/40 dark:text-black/40 text-[10px] font-black uppercase tracking-widest">Recommended Methodology</p>
              <h2 className="text-3xl font-black tracking-tight">{framing.methodology} Budgeting</h2>
            </div>
          </div>

          <p className="text-lg text-white/80 dark:text-black/80 font-medium leading-relaxed mb-10 max-w-3xl">
            {framing.analysis}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 dark:bg-black/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 dark:border-black/10">
              <p className="text-white/40 dark:text-black/40 text-[10px] font-black uppercase tracking-widest mb-2">Avg. Monthly Income</p>
              <p className="text-3xl font-black">${framing.currentStats.avgMonthlyIncome.toLocaleString()}</p>
            </div>
            <div className="bg-white/5 dark:bg-black/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 dark:border-black/10">
              <p className="text-white/40 dark:text-black/40 text-[10px] font-black uppercase tracking-widest mb-2">Avg. Monthly Expense</p>
              <p className="text-3xl font-black">${framing.currentStats.avgMonthlyExpense.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest px-2">Suggested Allocations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {framing.suggestedBudgets.map((b, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between group hover:border-indigo-500/50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 ${typeColors[b.type]} text-white rounded-xl flex items-center justify-center shadow-lg`}>
                    {typeIcons[b.type]}
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{b.type}</p>
                    <h4 className="font-bold text-gray-900 dark:text-white">{b.category}</h4>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-gray-900 dark:text-white">${b.amount.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">{b.period}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-8 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/30">
            <h4 className="text-indigo-900 dark:text-indigo-300 font-black mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Ready to Automate?
            </h4>
            <p className="text-indigo-700/70 dark:text-indigo-400/70 text-sm font-medium leading-relaxed mb-8">
              Applying this framing will replace your current budgets with this AI-architected structure. This removes the manual guesswork and aligns your spending with proven financial rules.
            </p>
            <button
              onClick={applyBudgets}
              disabled={isApplying}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-indigo-500/20"
            >
              {isApplying ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Apply AI Budget Framing
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          <button
            onClick={() => onComplete?.()}
            className="w-full py-4 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-2xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
          >
            Keep Current Setup
          </button>
        </div>
      </div>
    </motion.div>
  );
}
