import React, { useMemo } from 'react';
import { Transaction, Account } from '../lib/db';
import { ArrowRightLeft, TrendingUp, History, Landmark, Briefcase, Calendar, Wallet } from 'lucide-react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getCurrencySymbol } from '../lib/utils';

interface TransferReportProps {
  transactions: Transaction[];
  accounts: Account[];
  displayCurrency: string;
}

export default function TransferReport({ transactions, accounts, displayCurrency }: TransferReportProps) {
  const transfers = useMemo(() => 
    transactions.filter(t => t.type === 'Transfer').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  , [transactions]);

  const accountMap = useMemo(() => 
    new Map(accounts.map(a => [a.id, a]))
  , [accounts]);

  const transferStats = useMemo(() => {
    const stats: Record<string, { from: string, to: string, total: number, count: number, fromId: number, toId: number }> = {};
    
    transfers.forEach(t => {
      if (t.accountId && t.toAccountId) {
        const key = `${t.accountId}-${t.toAccountId}`;
        if (!stats[key]) {
          stats[key] = {
            from: accountMap.get(t.accountId)?.name || 'Unknown',
            to: accountMap.get(t.toAccountId)?.name || 'Unknown',
            total: 0,
            count: 0,
            fromId: t.accountId,
            toId: t.toAccountId
          };
        }
        stats[key].total += t.amount;
        stats[key].count += 1;
      }
    });

    return Object.values(stats).sort((a, b) => b.total - a.total);
  }, [transfers, accountMap]);

  const destinationStats = useMemo(() => {
    const dests: Record<number, { name: string, total: number, sources: Record<number, { name: string, amount: number }> }> = {};
    
    transfers.forEach(t => {
      if (t.toAccountId) {
        if (!dests[t.toAccountId]) {
          dests[t.toAccountId] = { 
            name: accountMap.get(t.toAccountId)?.name || 'Unknown', 
            total: 0, 
            sources: {} 
          };
        }
        dests[t.toAccountId].total += t.amount;
        
        if (!dests[t.toAccountId].sources[t.accountId]) {
          dests[t.toAccountId].sources[t.accountId] = { 
            name: accountMap.get(t.accountId)?.name || 'Unknown', 
            amount: 0 
          };
        }
        dests[t.toAccountId].sources[t.accountId].amount += t.amount;
      }
    });
    return Object.values(dests).sort((a, b) => b.total - a.total);
  }, [transfers, accountMap]);

  const chartData = useMemo(() => {
    const monthly: Record<string, number> = {};
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return d.toLocaleString('default', { month: 'short', year: '2-digit' });
    }).reverse();

    last6Months.forEach(m => monthly[m] = 0);

    transfers.forEach(t => {
      const date = new Date(t.date);
      const month = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      if (monthly[month] !== undefined) {
        monthly[month] += t.amount;
      }
    });

    return Object.entries(monthly).map(([name, total]) => ({ name, total }));
  }, [transfers]);

  const totalTransferred = transfers.reduce((sum, t) => sum + t.amount, 0);

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'Business Account': return <Briefcase className="w-4 h-4" />;
      case 'Salary Account': return <Briefcase className="w-4 h-4" />;
      case 'Daily Account': return <Calendar className="w-4 h-4" />;
      case 'Savings': return <Landmark className="w-4 h-4" />;
      default: return <Wallet className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="w-12 h-12 bg-black dark:bg-white text-white dark:text-black rounded-2xl flex items-center justify-center mb-4">
            <ArrowRightLeft className="w-6 h-6" />
          </div>
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Total Transferred</p>
          <h4 className="text-2xl font-black text-gray-900 dark:text-white">{getCurrencySymbol(displayCurrency)}{totalTransferred.toLocaleString()}</h4>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{transfers.length} total transfers recorded</p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm md:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Transfer Volume (Last 6 Months)</p>
              <h4 className="text-xl font-black text-gray-900 dark:text-white">Monthly Flow</h4>
            </div>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={document.documentElement.classList.contains('dark') ? '#1f2937' : '#f3f4f6'} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#9ca3af' }}
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    backgroundColor: document.documentElement.classList.contains('dark') ? '#111827' : '#fff',
                    color: document.documentElement.classList.contains('dark') ? '#fff' : '#000'
                  }}
                  itemStyle={{ color: document.documentElement.classList.contains('dark') ? '#fff' : '#000' }}
                  cursor={{ fill: document.documentElement.classList.contains('dark') ? '#1f2937' : '#f9fafb' }}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? (document.documentElement.classList.contains('dark') ? '#fff' : '#000') : (document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb')} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Transfer Paths & Split Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gray-900 dark:text-white" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Split Payment Analysis</h3>
          </div>
          
          <div className="space-y-4">
            {destinationStats.map((dest, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">{dest.name}</h4>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{getCurrencySymbol(displayCurrency)}{dest.total.toLocaleString()}</span>
                </div>
                <div className="space-y-3">
                  {Object.values(dest.sources).map((source, si) => (
                    <div key={si} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-gray-500 dark:text-gray-400">{source.name}</span>
                        <span className="text-gray-900 dark:text-white">{getCurrencySymbol(displayCurrency)}{source.amount.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-gray-50 dark:bg-gray-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(source.amount / dest.total) * 100}%` }}
                          className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transfers */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <History className="w-5 h-5 text-gray-900 dark:text-white" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Transfers</h3>
          </div>
          <div className="space-y-3">
            {transfers.length > 0 ? (
              transfers.slice(0, 5).map((t) => (
                <div key={t.id} className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{t.description}</p>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                      {accountMap.get(t.accountId)?.name}
                      <ArrowRightLeft className="w-2 h-2" />
                      {accountMap.get(t.toAccountId!)?.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900 dark:text-white">{getCurrencySymbol(displayCurrency)}{t.amount.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">{new Date(t.date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-3xl p-8 text-center">
                <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">No recent transfers recorded.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
