import React, { useState, useEffect } from 'react';
import { CreditCard, AlertTriangle, CheckCircle2, Loader2, Sparkles, Trash2, ExternalLink, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction } from '../lib/db';
import { analystService } from '../lib/gemini';

interface Subscription {
  name: string;
  amount: number;
  frequency: string;
  category: string;
  lastDate: string;
  confidence: number;
  isPotentialWaste: boolean;
  reason?: string;
}

interface SubscriptionAuditProps {
  transactions: Transaction[];
}

export default function SubscriptionAudit({ transactions }: SubscriptionAuditProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const runAudit = async () => {
    setIsLoading(true);
    try {
      const result = await analystService.auditSubscriptions(transactions);
      setSubscriptions(result.subscriptions);
      setHasRun(true);
    } catch (error) {
      console.error("Audit error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalMonthly = subscriptions.reduce((sum, s) => sum + (s.frequency === 'Monthly' ? s.amount : s.amount / 12), 0);
  const potentialSavings = subscriptions.filter(s => s.isPotentialWaste).reduce((sum, s) => sum + (s.frequency === 'Monthly' ? s.amount : s.amount / 12), 0);

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <CreditCard className="w-48 h-48 text-white" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Subscription Audit</h2>
              <p className="text-white/60 text-sm font-medium">AI-powered detection of recurring costs and potential waste.</p>
            </div>
          </div>

          {!hasRun ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-white/80 text-lg font-bold mb-8 max-w-md">
                Zenith will scan your transaction history to find hidden subscriptions, price hikes, and duplicate services.
              </p>
              <button
                onClick={runAudit}
                disabled={isLoading}
                className="px-10 py-5 bg-white text-indigo-600 rounded-2xl font-black flex items-center gap-3 hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50 shadow-xl"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing Transactions...
                  </>
                ) : (
                  <>
                    Start AI Audit
                    <TrendingUp className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10">
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Total Monthly Burn</p>
                <h3 className="text-3xl font-black text-white">${totalMonthly.toFixed(2)}</h3>
              </div>
              <div className="bg-rose-500/20 backdrop-blur-md p-6 rounded-3xl border border-rose-500/20">
                <p className="text-rose-200 text-xs font-bold uppercase tracking-widest mb-1">Potential Monthly Savings</p>
                <h3 className="text-3xl font-black text-rose-100">${potentialSavings.toFixed(2)}</h3>
              </div>
            </div>
          )}
        </div>
      </div>

      {hasRun && (
        <div className="grid grid-cols-1 gap-4">
          <h3 className="text-lg font-black text-gray-900 px-2">Detected Subscriptions</h3>
          <AnimatePresence>
            {subscriptions.map((sub, i) => (
              <motion.div
                key={sub.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`bg-white p-6 rounded-[2rem] border shadow-sm flex flex-col md:flex-row md:items-center gap-6 group transition-all hover:shadow-md ${
                  sub.isPotentialWaste ? 'border-rose-100 bg-rose-50/30' : 'border-gray-100'
                }`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                  sub.isPotentialWaste ? 'bg-rose-100 text-rose-600' : 'bg-gray-50 text-gray-400'
                }`}>
                  {sub.isPotentialWaste ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-lg font-black text-gray-900 truncate">{sub.name}</h4>
                    {sub.isPotentialWaste && (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[10px] font-black uppercase tracking-wider rounded-md">
                        Flagged
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    {sub.category} • {sub.frequency}
                  </p>
                  {sub.reason && (
                    <p className="text-sm text-rose-600 font-medium mt-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {sub.reason}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between md:justify-end gap-8">
                  <div className="text-right">
                    <p className="text-2xl font-black text-gray-900">${sub.amount.toFixed(2)}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Last: {sub.lastDate}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-black hover:text-white transition-all">
                      <ExternalLink className="w-5 h-5" />
                    </button>
                    {sub.isPotentialWaste && (
                      <button className="p-3 bg-rose-100 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {hasRun && subscriptions.length === 0 && (
        <div className="py-20 text-center bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h3 className="text-xl font-black text-gray-900 mb-2">Clean Slate!</h3>
          <p className="text-gray-400 max-w-sm mx-auto font-medium">
            Zenith couldn't find any suspicious recurring costs in your recent history. You're running a tight ship!
          </p>
        </div>
      )}
    </div>
  );
}
