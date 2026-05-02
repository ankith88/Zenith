import React, { useMemo, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend
} from 'recharts';
import { TrendingDown, Zap, Calculator, AlertCircle, CheckCircle2, ArrowRight, Sparkles, Home, Wallet, Clock, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Account, Transaction } from '../lib/db';
import { getCurrencySymbol, convertCurrency } from '../lib/utils';

interface LoanOffsetSimulatorProps {
  accounts: Account[];
  transactions: Transaction[];
  displayCurrency: string;
}

export default function LoanOffsetSimulator({ accounts, transactions, displayCurrency }: LoanOffsetSimulatorProps) {
  const [selectedMortgageId, setSelectedMortgageId] = useState<number | null>(null);
  const [selectedOffsetId, setSelectedOffsetId] = useState<number | null>(null);
  const [extraMonthly, setExtraMonthly] = useState<number>(0);

  // Calculate current balances for all accounts
  const accountBalances = useMemo(() => {
    const balances = accounts.reduce((acc, account) => {
      acc[account.id!] = account.initialBalance;
      return acc;
    }, {} as Record<number, number>);

    transactions.forEach(t => {
      if (t.type === 'Income') {
        balances[t.accountId] = (balances[t.accountId] || 0) + t.amount;
      } else if (t.type === 'Expense') {
        balances[t.accountId] = (balances[t.accountId] || 0) - t.amount;
      } else if (t.type === 'Transfer' && t.toAccountId) {
        balances[t.accountId] = (balances[t.accountId] || 0) - t.amount;
        balances[t.toAccountId] = (balances[t.toAccountId] || 0) + t.amount;
      }
    });
    return balances;
  }, [accounts, transactions]);

  const mortgages = accounts.filter(acc => acc.type === 'Mortgage');
  const liquidAccounts = accounts.filter(acc => ['Checking', 'Savings', 'Daily Account', 'Salary Account', 'Offset Account', 'Business Account', 'Cash'].includes(acc.type));

  // Auto-select if only one
  useMemo(() => {
    if (!selectedMortgageId && mortgages.length > 0) setSelectedMortgageId(mortgages[0].id!);
    if (!selectedOffsetId && liquidAccounts.length > 0) {
      const offset = liquidAccounts.find(a => a.name.toLowerCase().includes('offset')) || liquidAccounts[0];
      setSelectedOffsetId(offset.id!);
    }
  }, [mortgages, liquidAccounts]);

  const simulation = useMemo(() => {
    const mortgage = mortgages.find(m => m.id === selectedMortgageId);
    const offset = liquidAccounts.find(a => a.id === selectedOffsetId);

    if (!mortgage) return null;

    const currentBalance = Math.abs(accountBalances[mortgage.id!] || 0);
    const offsetBalance = Math.abs(accountBalances[offset?.id!] || 0);
    const rate = (mortgage.interestRate || 0) / 100;
    const monthlyPayment = mortgage.minPayment || 0;

    if (currentBalance <= 0 || monthlyPayment <= 0) return null;

    const runSim = (useOffset: boolean, extra: number) => {
      let balance = currentBalance;
      let totalInterest = 0;
      let month = 0;
      const data = [];
      const maxMonths = 480; // 40 years

      while (balance > 0 && month < maxMonths) {
        const effectiveBalance = useOffset ? Math.max(0, balance - offsetBalance) : balance;
        const interest = (effectiveBalance * rate) / 12;
        totalInterest += interest;
        
        const principalPayment = Math.max(0, (monthlyPayment + extra) - interest);
        balance -= principalPayment;
        
        if (month % 12 === 0 || balance <= 0) {
          data.push({
            month,
            year: Math.floor(month / 12),
            balance: Math.max(0, Math.round(balance))
          });
        }
        month++;
      }

      return { data, totalInterest, months: month };
    };

    const baseline = runSim(false, 0);
    const withOffset = runSim(true, extraMonthly);

    return {
      baseline,
      withOffset,
      interestSaved: Math.round(baseline.totalInterest - withOffset.totalInterest),
      yearsSaved: ((baseline.months - withOffset.months) / 12).toFixed(1),
      monthsSaved: baseline.months - withOffset.months,
      debtFreeDate: new Date(new Date().setMonth(new Date().getMonth() + withOffset.months))
    };
  }, [selectedMortgageId, selectedOffsetId, extraMonthly, accountBalances, mortgages, liquidAccounts]);

  if (mortgages.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 p-12 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm text-center transition-colors">
        <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
          <Home className="w-10 h-10 text-gray-300 dark:text-gray-600" />
        </div>
        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">No Mortgage Found</h3>
        <p className="text-gray-400 dark:text-gray-500 font-medium max-w-sm mx-auto">
          Add a Mortgage account in the Accounts tab to use the Loan Payoff Simulator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Card */}
      <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Sparkles className="w-48 h-48 text-white" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
              <Calculator className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Loan & Offset Simulator</h2>
              <p className="text-white/60 text-sm font-medium">See how your offset account accelerates your freedom.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10">
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Interest Saved</p>
              <h3 className="text-3xl font-black text-white">{getCurrencySymbol(displayCurrency)}{simulation?.interestSaved.toLocaleString()}</h3>
              <p className="text-white/40 text-[10px] font-bold mt-1 uppercase">Over the life of the loan</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10">
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Time Saved</p>
              <h3 className="text-3xl font-black text-white">{simulation?.yearsSaved} Years</h3>
              <p className="text-white/40 text-[10px] font-bold mt-1 uppercase">{simulation?.monthsSaved} months sooner</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10">
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Debt Free Date</p>
              <h3 className="text-3xl font-black text-white">
                {simulation?.debtFreeDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </h3>
              <p className="text-white/40 text-[10px] font-bold mt-1 uppercase">Estimated payoff</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Controls */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Simulation Settings
            </h3>
            
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 block">Select Mortgage</label>
                <select 
                  value={selectedMortgageId || ''} 
                  onChange={(e) => setSelectedMortgageId(Number(e.target.value))}
                  className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {mortgages.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({getCurrencySymbol(displayCurrency)}{convertCurrency(Math.abs(accountBalances[m.id!] || 0), m.currency || 'USD', displayCurrency).toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 block">Select Offset Account</label>
                <select 
                  value={selectedOffsetId || ''} 
                  onChange={(e) => setSelectedOffsetId(Number(e.target.value))}
                  className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {liquidAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({getCurrencySymbol(displayCurrency)}{convertCurrency(Math.abs(accountBalances[a.id!] || 0), a.currency || 'USD', displayCurrency).toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2 block">Extra Monthly Payment</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400 dark:text-gray-500">{getCurrencySymbol(displayCurrency)}</span>
                  <input
                    type="number"
                    value={extraMonthly}
                    onChange={(e) => setExtraMonthly(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 font-medium leading-relaxed">
                  Adding extra payments on top of your offset balance accelerates payoff even further. 
                  <br />
                  <span className="text-indigo-500 dark:text-indigo-400 italic">Note: Only accounts set as 'Savings', 'Checking', or 'Offset Account' appear here.</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h4 className="font-bold text-indigo-900 dark:text-indigo-100">How it works</h4>
            </div>
            <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
              Interest is calculated on your <strong>Mortgage Balance</strong> minus your <strong>Offset Balance</strong>. 
              By keeping money in your offset account, you reduce the interest charged, meaning more of your monthly payment goes toward the principal.
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm h-full transition-colors">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">Balance Projection</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Baseline</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">With Offset</span>
                </div>
              </div>
            </div>

            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart>
                  <defs>
                    <linearGradient id="colorOffset" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-chart-grid)" />
                  <XAxis 
                    dataKey="year" 
                    type="number"
                    domain={[0, 'auto']}
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }}
                    label={{ value: 'Years', position: 'insideBottom', offset: -5, fontSize: 10, fontWeight: 'bold', fill: '#9ca3af' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }}
                    tickFormatter={(val) => `${getCurrencySymbol(displayCurrency)}${(val/1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '24px', 
                      border: 'none', 
                      boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', 
                      padding: '16px',
                      backgroundColor: 'var(--color-chart-tooltip-bg)',
                      color: 'var(--color-chart-tooltip-text)'
                    }}
                    itemStyle={{ fontSize: '14px', fontWeight: 'black' }}
                    labelStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}
                    labelFormatter={(label) => `Year ${label}`}
                    formatter={(value: number) => [`${getCurrencySymbol(displayCurrency)}${value.toLocaleString()}`, 'Balance']}
                  />
                  <Area 
                    data={simulation?.baseline.data || []}
                    type="monotone" 
                    dataKey="balance" 
                    stroke={document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'} 
                    fill="transparent"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Standard Payoff"
                  />
                  <Area 
                    data={simulation?.withOffset.data || []}
                    type="monotone" 
                    dataKey="balance" 
                    stroke="#4f46e5" 
                    fillOpacity={1} 
                    fill="url(#colorOffset)" 
                    strokeWidth={4}
                    name="Offset Payoff"
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Standard Payoff</span>
                </div>
                <p className="text-lg font-black text-gray-900 dark:text-white">
                  {Math.floor((simulation?.baseline.months || 0) / 12)}y {(simulation?.baseline.months || 0) % 12}m
                </p>
              </div>
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">Offset Payoff</span>
                </div>
                <p className="text-lg font-black text-indigo-900 dark:text-indigo-100">
                  {Math.floor((simulation?.withOffset.months || 0) / 12)}y {(simulation?.withOffset.months || 0) % 12}m
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Settings = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);
