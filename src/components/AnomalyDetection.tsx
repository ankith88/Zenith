import React, { useState, useEffect } from 'react';
import { Transaction, Account } from '../lib/db';
import { analystService } from '../lib/gemini';
import { AlertTriangle, Sparkles, Loader2, ChevronRight, TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AnomalyDetectionProps {
  transactions: Transaction[];
  accounts: Account[];
}

export default function AnomalyDetection({ transactions, accounts }: AnomalyDetectionProps) {
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  const scanForAnomalies = async () => {
    setIsScanning(true);
    try {
      const publicAccounts = accounts.filter(a => !a.isPrivate);
      const publicAccountIds = new Set(publicAccounts.map(a => a.id));
      const publicTransactions = transactions.filter(t => publicAccountIds.has(t.accountId));
      
      const result = await analystService.detectSpendingAnomalies(publicTransactions);
      setAnomalies(result.anomalies);
      setHasScanned(true);
    } catch (error) {
      console.error("Anomaly detection error:", error);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden transition-colors">
      <div className="p-8 border-b border-gray-50 dark:border-gray-800 bg-gradient-to-r from-amber-50/50 dark:from-amber-900/10 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">AI Spending Anomalies</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Zenith scans for unusual patterns and price hikes.</p>
            </div>
          </div>
          {!hasScanned && (
            <button
              onClick={scanForAnomalies}
              disabled={isScanning}
              className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-100 transition-all disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Scan Transactions
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="p-8">
        {!hasScanned ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="w-10 h-10 text-gray-300 dark:text-gray-600" />
            </div>
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Ready to scan?</h4>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">
              Zenith will analyze your recent transaction history to find price increases or unusual spending spikes.
            </p>
          </div>
        ) : anomalies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
            </div>
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Everything looks normal!</h4>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">
              Zenith didn't find any significant anomalies in your recent spending. You're staying consistent!
            </p>
            <button 
              onClick={scanForAnomalies}
              className="mt-6 text-xs font-bold text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white uppercase tracking-widest"
            >
              Re-scan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {anomalies.map((anomaly, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-6 rounded-3xl border transition-colors ${
                    anomaly.severity === 'High' ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' : 
                    anomaly.severity === 'Medium' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30' : 
                    'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      anomaly.severity === 'High' ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' : 
                      anomaly.severity === 'Medium' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' : 
                      'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                    }`}>
                      {anomaly.type}
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">{anomaly.date}</span>
                  </div>
                  
                  <h4 className="text-lg font-black text-gray-900 dark:text-white mb-2">{anomaly.description}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-4 leading-relaxed">{anomaly.insight}</p>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm">
                        <DollarSign className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">${anomaly.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm">
                        <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      </div>
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{anomaly.category}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div className="md:col-span-2 flex justify-center mt-4">
              <button 
                onClick={scanForAnomalies}
                disabled={isScanning}
                className="text-xs font-bold text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white uppercase tracking-widest flex items-center gap-2"
              >
                {isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Refresh AI Scan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
