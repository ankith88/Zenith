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
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-gray-50 bg-gradient-to-r from-amber-50/50 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight">AI Spending Anomalies</h3>
              <p className="text-gray-500 text-sm font-medium">Zenith scans for unusual patterns and price hikes.</p>
            </div>
          </div>
          {!hasScanned && (
            <button
              onClick={scanForAnomalies}
              disabled={isScanning}
              className="px-6 py-3 bg-black text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-800 transition-all disabled:opacity-50"
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
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="w-10 h-10 text-gray-300" />
            </div>
            <h4 className="text-lg font-bold text-gray-900 mb-2">Ready to scan?</h4>
            <p className="text-gray-500 text-sm max-w-xs">
              Zenith will analyze your recent transaction history to find price increases or unusual spending spikes.
            </p>
          </div>
        ) : anomalies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="w-10 h-10 text-emerald-500" />
            </div>
            <h4 className="text-lg font-bold text-gray-900 mb-2">Everything looks normal!</h4>
            <p className="text-gray-500 text-sm max-w-xs">
              Zenith didn't find any significant anomalies in your recent spending. You're staying consistent!
            </p>
            <button 
              onClick={scanForAnomalies}
              className="mt-6 text-xs font-bold text-gray-400 hover:text-gray-900 uppercase tracking-widest"
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
                  className={`p-6 rounded-3xl border ${
                    anomaly.severity === 'High' ? 'bg-red-50 border-red-100' : 
                    anomaly.severity === 'Medium' ? 'bg-amber-50 border-amber-100' : 
                    'bg-blue-50 border-blue-100'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      anomaly.severity === 'High' ? 'bg-red-100 text-red-600' : 
                      anomaly.severity === 'Medium' ? 'bg-amber-100 text-amber-600' : 
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {anomaly.type}
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">{anomaly.date}</span>
                  </div>
                  
                  <h4 className="text-lg font-black text-gray-900 mb-2">{anomaly.description}</h4>
                  <p className="text-sm text-gray-600 font-medium mb-4 leading-relaxed">{anomaly.insight}</p>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-black/5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                      </div>
                      <span className="text-sm font-bold text-gray-900">${anomaly.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <Calendar className="w-4 h-4 text-gray-400" />
                      </div>
                      <span className="text-xs font-bold text-gray-500">{anomaly.category}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div className="md:col-span-2 flex justify-center mt-4">
              <button 
                onClick={scanForAnomalies}
                disabled={isScanning}
                className="text-xs font-bold text-gray-400 hover:text-gray-900 uppercase tracking-widest flex items-center gap-2"
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
