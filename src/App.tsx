import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, MessageSquare, Plus, Settings as SettingsIcon, LogOut, User, Menu, X, Loader2, Tag, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction, Milestone } from './lib/db';
import { sheetsService } from './lib/sheets';
import { milestoneService } from './lib/milestones';
import { formatLocalDate, parseLocalDate } from './lib/utils';
import Dashboard from './components/Dashboard';
import InsightsChat from './components/InsightsChat';
import VoiceInput from './components/VoiceInput';
import AuthOverlay from './components/AuthOverlay';
import CategoryManager from './components/CategoryManager';
import Settings from './components/Settings';
import TransferReport from './components/TransferReport';
import Reports from './components/Reports';
import Transactions from './components/Transactions';
import GlobalSearch from './components/GlobalSearch';
import SubscriptionAudit from './components/SubscriptionAudit';
import CashFlowCalendar from './components/CashFlowCalendar';
import DebtSimulator from './components/DebtSimulator';
import LoanOffsetSimulator from './components/LoanOffsetSimulator';
import MortgageSetupWizard from './components/MortgageSetupWizard';
import CarLoanSetupWizard from './components/CarLoanSetupWizard';
import ErrorBoundary from './components/ErrorBoundary';
import BillCalendar from './components/BillCalendar';
import { ArrowRightLeft, BarChart3, Search, Calendar, ShieldCheck, TrendingDown, Home, Car, Palette, Moon, Sun } from 'lucide-react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isInitialSyncComplete, setIsInitialSyncComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'categories' | 'settings' | 'transfers' | 'reports' | 'subscriptions' | 'calendar' | 'debt' | 'transactions'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('zenith_sidebar_collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [showMortgageWizard, setShowMortgageWizard] = useState(false);
  const [showCarLoanWizard, setShowCarLoanWizard] = useState(false);
  const [appLogo, setAppLogo] = useState<string | null>('/logo.svg');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [householdView, setHouseholdView] = useState(false);
  const [debtView, setDebtView] = useState<'general' | 'offset'>('general');
  const [voiceQuery, setVoiceQuery] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('zenith_dark_mode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('zenith_dark_mode', JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('zenith_sidebar_collapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    (window as any).showMortgageWizard = () => setShowMortgageWizard(true);
    (window as any).showCarLoanWizard = () => setShowCarLoanWizard(true);
    (window as any).runRecurringCheck = () => processRecurring();
    (window as any).runInterestCheck = () => processInterest();
  }, []);

  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];
  const recurring = useLiveQuery(() => db.recurringTransactions.toArray()) || [];
  const goals = useLiveQuery(() => db.goals.toArray()) || [];
  const milestones = useLiveQuery(() => db.milestones.toArray()) || [];

  const accountBalances = useMemo(() => {
    const balances = accounts.reduce((acc, account) => {
      acc[account.id!] = account.initialBalance || 0;
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
  }, [transactions, accounts]);

  useEffect(() => {
    if (isAuthenticated && isInitialSyncComplete) {
      milestoneService.checkMilestones();
    }
  }, [transactions, budgets, goals, isAuthenticated, isInitialSyncComplete]);

  useEffect(() => {
    const init = async () => {
      try {
        await checkAuth();
      } catch (err) {
        console.error("Initialization error:", err);
        setError(err instanceof Error ? err.message : String(err));
        setIsAuthenticated(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (isAuthenticated && isInitialSyncComplete) {
      processInterest();
      processRecurring();
    }
    
    // Expose process functions for manual triggering
    (window as any).processInterest = processInterest;
    (window as any).processRecurring = processRecurring;
  }, [isAuthenticated, isInitialSyncComplete]);

  const processInterest = async () => {
    try {
      const loanAccounts = await db.accounts
        .where('type')
        .anyOf(['Mortgage', 'Car Loan', 'Credit Card'])
        .toArray();
      const today = new Date();
      const todayStr = formatLocalDate(today);

      for (const acc of loanAccounts) {
        if (typeof acc.id !== 'number' || !acc.interestRate || acc.interestRate <= 0) continue;

        // Calculate current balance
        const accTransactions = await db.transactions.where('accountId').equals(acc.id).toArray();
        const toTransactions = await db.transactions.where('toAccountId').equals(acc.id).toArray();
        
        let currentBalance = acc.initialBalance;
        accTransactions.forEach(t => {
          if (t.type === 'Income') currentBalance += t.amount;
          else if (t.type === 'Expense' || t.type === 'Transfer') currentBalance -= t.amount;
        });
        toTransactions.forEach(t => {
          if (t.type === 'Transfer') currentBalance += t.amount;
        });

        // Only apply interest if balance is negative (debt) or it's a known debt account type
        const isDebtAccount = acc.type === 'Mortgage' || acc.type === 'Credit Card' || acc.type === 'Car Loan';
        if (currentBalance >= 0 && !isDebtAccount) {
          continue; 
        }
        
        // Ensure balance is treated for calculation
        const debtBalance = Math.abs(currentBalance);
        if (debtBalance < 1) continue;
        
        // Ensure paymentDueDay is set if missing
        if (acc.paymentDueDay === undefined) {
          acc.paymentDueDay = today.getDate();
          await db.accounts.update(acc.id!, { paymentDueDay: acc.paymentDueDay, synced: false });
          await sheetsService.updateAccount(acc);
          await db.accounts.update(acc.id!, { synced: true });
        }

        // Use parseLocalDate to ensure we treat the stored date as local time
        let lastDate: Date;
        if (acc.lastInterestDate) {
          lastDate = parseLocalDate(acc.lastInterestDate);
        } else {
          // Default to previous period
          lastDate = new Date(today);
          if (acc.paymentFrequency === 'Weekly') {
            lastDate.setDate(lastDate.getDate() - 7);
          } else {
            lastDate.setMonth(lastDate.getMonth() - 1);
          }
          
          if (acc.paymentFrequency === 'Weekly') {
            // Adjust to the correct day of week
            const currentDay = lastDate.getDay();
            const diff = acc.paymentDueDay - currentDay;
            lastDate.setDate(lastDate.getDate() + diff);
          } else {
            lastDate.setDate(acc.paymentDueDay);
          }

          // If the calculated lastDate is still in the future relative to today - period, 
          // pull it back one more period to ensure we have a valid starting point
          if (lastDate > today) {
             if (acc.paymentFrequency === 'Weekly') {
               lastDate.setDate(lastDate.getDate() - 7);
             } else {
               lastDate.setMonth(lastDate.getMonth() - 1);
             }
          }
        }
        
        let nextDate = new Date(lastDate);
        if (acc.paymentFrequency === 'Weekly') {
          nextDate.setDate(nextDate.getDate() + 7);
        } else {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }

        if (acc.paymentDueDay !== undefined) {
          if (acc.paymentFrequency === 'Weekly') {
            const currentDay = nextDate.getDay();
            const diff = acc.paymentDueDay - currentDay;
            nextDate.setDate(nextDate.getDate() + diff);
          } else {
            nextDate.setDate(acc.paymentDueDay);
          }
        }

        while (nextDate <= today) {
          const dateStr = formatLocalDate(nextDate);
          
          // Check if already exists to prevent duplicates on refresh
          const existing = await db.transactions
            .where('date').equals(dateStr)
            .and(t => t.description === `[Interest] Monthly Interest Charge` && t.accountId === acc.id)
            .first();

          if (!existing) {
            const rate = acc.interestRate / 100;
            const interestAmount = acc.paymentFrequency === 'Weekly' 
              ? debtBalance * (rate / 52)
              : debtBalance * (rate / 12);

            if (interestAmount > 0.01) {
              const interestTx: Transaction = {
                date: dateStr,
                amount: interestAmount,
                category: 'Interest',
                description: `[Interest] ${acc.paymentFrequency || 'Monthly'} Interest Charge`,
                type: 'Expense',
                accountId: acc.id!,
                synced: false
              };

              const tId = await db.transactions.add(interestTx);
              await sheetsService.appendTransaction({ ...interestTx, id: tId });
              await db.transactions.update(tId, { synced: true });
              
              // Update balance for next period calculation
              currentBalance -= interestAmount;
            }
          }

          acc.lastInterestDate = dateStr;
          await db.accounts.update(acc.id!, { lastInterestDate: dateStr, synced: false });
          await sheetsService.updateAccount(acc);
          await db.accounts.update(acc.id!, { synced: true });

          if (acc.paymentFrequency === 'Weekly') {
            nextDate.setDate(nextDate.getDate() + 7);
          } else {
            nextDate.setMonth(nextDate.getMonth() + 1);
          }

          if (acc.paymentDueDay !== undefined) {
            if (acc.paymentFrequency === 'Weekly') {
              const currentDay = nextDate.getDay();
              const diff = acc.paymentDueDay - currentDay;
              nextDate.setDate(nextDate.getDate() + diff);
            } else {
              nextDate.setDate(acc.paymentDueDay);
            }
          }
          
          // Add a small delay to avoid hitting rate limits in tight loops
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (err) {
      console.error("Interest processing failed:", err);
      // Don't throw here to avoid crashing the app, but log it
    }
  };

  const processRecurring = async () => {
    const getNextDate = (date: Date, freq: string) => {
      const d = new Date(date);
      if (freq === 'Daily') d.setDate(d.getDate() + 1);
      else if (freq === 'Weekly') d.setDate(d.getDate() + 7);
      else if (freq === 'Monthly') d.setMonth(d.getMonth() + 1);
      else if (freq === 'Yearly') d.setFullYear(d.getFullYear() + 1);
      return d;
    };

    try {
      const recurringItems = await db.recurringTransactions.toArray();
      const today = new Date();
      
      for (const item of recurringItems) {
        let nextDate: Date;
        if (item.lastProcessedDate) {
          nextDate = getNextDate(parseLocalDate(item.lastProcessedDate), item.frequency);
        } else {
          nextDate = parseLocalDate(item.startDate);
        }

        while (nextDate <= today) {
          const dateStr = formatLocalDate(nextDate);
          
          // Check if already exists to prevent duplicates on refresh
          const existing = await db.transactions
            .where('date').equals(dateStr)
            .and(t => t.description === `[Recurring] ${item.description}` && t.accountId === item.accountId)
            .first();

          if (!existing) {
            const newTransaction: Transaction = {
              date: dateStr,
              amount: item.amount,
              category: item.category,
              description: `[Recurring] ${item.description}`,
              type: item.type,
              accountId: item.accountId,
              toAccountId: item.toAccountId,
              synced: false
            };

            const tId = await db.transactions.add(newTransaction);
            await sheetsService.appendTransaction({ ...newTransaction, id: tId });
            await db.transactions.update(tId, { synced: true });
          }

          item.lastProcessedDate = dateStr;
          await db.recurringTransactions.update(item.id!, { lastProcessedDate: dateStr, synced: false });
          await sheetsService.updateRecurring(item);
          await db.recurringTransactions.update(item.id!, { synced: true });

          nextDate = getNextDate(nextDate, item.frequency);
          
          // Add a small delay to avoid hitting rate limits in tight loops
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (err) {
      console.error("Recurring processing failed:", err);
    }
  };

  const checkAuth = async () => {
    try {
      const data = await sheetsService.fetchAuthStatus();
      setIsAuthenticated(data.isAuthenticated);
      if (data.isAuthenticated) {
        // Ensure we have a spreadsheet ID
        let spreadsheetId = sheetsService.getSpreadsheetId();
        if (!spreadsheetId) {
          console.log("Spreadsheet ID missing, attempting to find/create...");
          const data = await sheetsService.createSheet();
          spreadsheetId = data.spreadsheetId;
        }
        
        if (spreadsheetId) {
          setIsSyncing(true);
          setSyncError(null);
          try {
            await sheetsService.syncToLocal();
            setIsInitialSyncComplete(true);
          } catch (err: any) {
            console.error("Initial sync failed:", err);
            setSyncError(err.message || "Failed to pull data from cloud.");
          } finally {
            setIsSyncing(false);
          }
        }
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setIsAuthenticated(false);
      setIsSyncing(false);
    }
  };

  const handleTransactionConfirm = async (t: Transaction) => {
    const id = await db.transactions.add({ ...t, synced: false });
    const transactionWithId = { ...t, id };
    await sheetsService.appendTransaction(transactionWithId);
    await db.transactions.update(id, { synced: true });
  };

  if (error) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
          <X className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Initialization Failed</h2>
        <p className="text-gray-500 text-sm mb-6 max-w-xs">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-black text-white rounded-2xl font-bold hover:bg-gray-800 transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 bg-black rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-black/20"
        >
           <span className="text-white font-black text-3xl">Z</span>
        </motion.div>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          <p className="text-gray-500 font-bold tracking-tight">Initializing Zenith...</p>
          <p className="text-xs text-gray-400 max-w-[200px]">Connecting to your secure financial command center.</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={`min-h-screen bg-gray-50 dark:bg-gray-950 flex transition-colors duration-300`}>
        {!isAuthenticated && <AuthOverlay onAuthenticated={() => setIsAuthenticated(true)} />}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transform transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isSidebarCollapsed ? 'w-20' : 'w-72'}`}>
        <div className={`h-full flex flex-col ${isSidebarCollapsed ? 'p-4' : 'p-6'}`}>
          <div className={`flex items-center gap-3 mb-12 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 bg-black dark:bg-white rounded-2xl flex items-center justify-center shadow-lg overflow-hidden shrink-0">
              {appLogo ? (
                <img src={appLogo} alt="Zenith" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-white dark:text-black font-black text-xl">Z</span>
              )}
            </div>
            {!isSidebarCollapsed && <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Zenith</h1>}
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-2">
            <button
              onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${activeTab === 'dashboard' ? 'bg-black dark:bg-white text-white dark:text-black shadow-xl shadow-black/10' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'} ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title="Dashboard"
            >
              <LayoutDashboard className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>Dashboard</span>}
            </button>
            <button
              onClick={() => { setActiveTab('transactions'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${activeTab === 'transactions' ? 'bg-black dark:bg-white text-white dark:text-black shadow-xl shadow-black/10' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'} ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title="Transactions"
            >
              <ArrowRightLeft className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>Transactions</span>}
            </button>
            <button
              onClick={() => { setActiveTab('reports'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${activeTab === 'reports' ? 'bg-black dark:bg-white text-white dark:text-black shadow-xl shadow-black/10' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'} ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title="Reports"
            >
              <BarChart3 className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>Reports</span>}
            </button>
            <button
              onClick={() => { setActiveTab('calendar'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${activeTab === 'calendar' ? 'bg-black dark:bg-white text-white dark:text-black shadow-xl shadow-black/10' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'} ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title="Projections"
            >
              <TrendingUp className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>Projections</span>}
            </button>
            <button
              onClick={() => { setActiveTab('subscriptions'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${activeTab === 'subscriptions' ? 'bg-black dark:bg-white text-white dark:text-black shadow-xl shadow-black/10' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'} ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title="Sub Audit"
            >
              <ShieldCheck className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>Sub Audit</span>}
            </button>
            <button
              onClick={() => { setActiveTab('debt'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${activeTab === 'debt' ? 'bg-black dark:bg-white text-white dark:text-black shadow-xl shadow-black/10' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'} ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title="Debt & Loans"
            >
              <TrendingDown className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>Debt & Loans</span>}
            </button>
            <button
              onClick={() => { setActiveTab('chat'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${activeTab === 'chat' ? 'bg-black dark:bg-white text-white dark:text-black shadow-xl shadow-black/10' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'} ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title="Ask Zenith"
            >
              <MessageSquare className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>Ask Zenith</span>}
            </button>
            <button
              onClick={() => { setActiveTab('categories'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${activeTab === 'categories' ? 'bg-black dark:bg-white text-white dark:text-black shadow-xl shadow-black/10' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'} ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title="Categories"
            >
              <Tag className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>Categories</span>}
            </button>
            <button
              onClick={() => { setActiveTab('transfers'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${activeTab === 'transfers' ? 'bg-black dark:bg-white text-white dark:text-black shadow-xl shadow-black/10' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'} ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title="Transfer Report"
            >
              <BarChart3 className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>Transfer Report</span>}
            </button>
            <button
              onClick={() => { setShowMortgageWizard(true); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title="Setup Mortgage"
            >
              <Home className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>Setup Mortgage</span>}
            </button>
            <button
              onClick={() => { setShowCarLoanWizard(true); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title="Setup Car Loan"
            >
              <Car className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>Setup Car Loan</span>}
            </button>

            <div className={`pt-4 ${isSidebarCollapsed ? 'px-0' : 'px-4'} space-y-2`}>
              <div className={`flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl transition-colors ${isSidebarCollapsed ? 'flex-col gap-2' : ''}`}>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  {!isSidebarCollapsed && <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Household</span>}
                </div>
                <button
                  onClick={() => setHouseholdView(!householdView)}
                  className={`w-10 h-6 rounded-full transition-all relative ${householdView ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${householdView ? 'left-5' : 'left-1'}`} />
                </button>
              </div>

              <div className={`flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl transition-colors ${isSidebarCollapsed ? 'flex-col gap-2' : ''}`}>
                <div className="flex items-center gap-2">
                  {isDarkMode ? <Moon className="w-4 h-4 text-gray-400" /> : <Sun className="w-4 h-4 text-gray-400" />}
                  {!isSidebarCollapsed && <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Dark Mode</span>}
                </div>
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className={`w-10 h-6 rounded-full transition-all relative ${isDarkMode ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isDarkMode ? 'left-5' : 'left-1'}`} />
                </button>
              </div>
            </div>

            {!isSidebarCollapsed && (
              <div className="pt-6 px-4">
                <BillCalendar 
                  compact 
                  recurring={recurring} 
                  accounts={accounts} 
                  accountBalances={accountBalances} 
                />
              </div>
            )}
          </nav>

          <div className="pt-6 border-t border-gray-50 dark:border-gray-800 space-y-2">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              {!isSidebarCollapsed && <span>Collapse Sidebar</span>}
            </button>
            <button
              onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${activeTab === 'settings' ? 'bg-black dark:bg-white text-white dark:text-black shadow-xl shadow-black/10' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'} ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title="Settings"
            >
              <SettingsIcon className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>Settings</span>}
            </button>
            <button 
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                await sheetsService.setTokens(null);
                setIsAuthenticated(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title="Logout"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 p-4 flex items-center justify-between lg:px-8 transition-colors">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">
            <Menu className="w-6 h-6 text-gray-900 dark:text-white" />
          </button>
          
          <div className="flex-1 lg:flex-none flex items-center gap-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white capitalize hidden md:block">{activeTab}</h2>
            <GlobalSearch onNavigate={setActiveTab} />
          </div>

          <div className="flex items-center gap-4">
            {isSyncing && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Syncing Cloud</span>
              </div>
            )}
            {syncError && !isSyncing && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full group relative cursor-help">
                <span className="text-[10px] font-bold uppercase tracking-wider">Sync Error</span>
                <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-white dark:bg-gray-800 border border-red-100 dark:border-red-900 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">{syncError}</p>
                  <button 
                    onClick={() => checkAuth()}
                    className="mt-2 text-[10px] font-bold text-red-700 dark:text-red-400 underline"
                  >
                    Retry Sync
                  </button>
                </div>
              </div>
            )}
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold text-gray-900 dark:text-white">Ankith</span>
              <span className="text-xs font-medium text-gray-400">Premium Plan</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-white dark:border-gray-700 shadow-sm overflow-hidden">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Ankith" alt="Avatar" referrerPolicy="no-referrer" />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-950/50 transition-colors">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full"
              >
                <Dashboard 
                  transactions={transactions} 
                  accounts={accounts} 
                  budgets={budgets} 
                  recurring={recurring} 
                  goals={goals} 
                  milestones={milestones}
                  accountBalances={accountBalances}
                  householdView={householdView}
                  isDarkMode={isDarkMode}
                  onViewAllTransactions={() => setActiveTab('transactions')}
                />
              </motion.div>
            ) : activeTab === 'transactions' ? (
              <motion.div
                key="transactions"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full p-6 lg:p-8"
              >
                <Transactions transactions={transactions} accounts={accounts} />
              </motion.div>
            ) : activeTab === 'reports' ? (
              <motion.div
                key="reports"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full p-6 lg:p-8"
              >
                <Reports transactions={transactions} accounts={accounts} budgets={budgets} goals={goals} householdView={householdView} />
              </motion.div>
            ) : activeTab === 'calendar' ? (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full p-6 lg:p-8"
              >
                <CashFlowCalendar transactions={transactions} accounts={accounts} recurring={recurring} />
              </motion.div>
            ) : activeTab === 'subscriptions' ? (
              <motion.div
                key="subscriptions"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full p-6 lg:p-8"
              >
                <SubscriptionAudit transactions={transactions} accounts={accounts} />
              </motion.div>
            ) : activeTab === 'debt' ? (
              <motion.div
                key="debt"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full p-6 lg:p-8"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl transition-colors">
                    <button
                      onClick={() => setDebtView('general')}
                      className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        debtView === 'general' ? 'bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                      }`}
                    >
                      General Simulator
                    </button>
                    <button
                      onClick={() => setDebtView('offset')}
                      className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        debtView === 'offset' ? 'bg-white dark:bg-gray-700 text-black dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                      }`}
                    >
                      Loan & Offset
                    </button>
                  </div>
                </div>

                {debtView === 'general' ? (
                  <DebtSimulator accounts={accounts} transactions={transactions} />
                ) : (
                  <LoanOffsetSimulator accounts={accounts} transactions={transactions} />
                )}
              </motion.div>
            ) : activeTab === 'chat' ? (
              <motion.div
                key="chat"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full p-6 lg:p-8"
              >
                <InsightsChat 
                  transactions={transactions} 
                  accounts={accounts} 
                  budgets={budgets} 
                  goals={goals}
                  initialQuery={voiceQuery || undefined}
                  onQueryHandled={() => setVoiceQuery(null)}
                />
              </motion.div>
            ) : activeTab === 'categories' ? (
              <motion.div
                key="categories"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full p-6 lg:p-8"
              >
                <CategoryManager transactions={transactions} budgets={budgets} recurring={recurring} />
              </motion.div>
            ) : activeTab === 'transfers' ? (
              <motion.div
                key="transfers"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full p-6 lg:p-8"
              >
                <TransferReport transactions={transactions} accounts={accounts} />
              </motion.div>
            ) : (
              <motion.div
                key="settings"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full p-6 lg:p-8"
              >
                <Settings />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <VoiceInput 
          onConfirm={handleTransactionConfirm} 
          onQuery={(query) => {
            setVoiceQuery(query);
            setActiveTab('chat');
          }}
        />

          <AnimatePresence>
            {showMortgageWizard && (
              <MortgageSetupWizard 
                accounts={accounts} 
                onClose={() => setShowMortgageWizard(false)} 
                onComplete={() => {
                  setShowMortgageWizard(false);
                  setActiveTab('dashboard');
                }}
              />
            )}
            {showCarLoanWizard && (
              <CarLoanSetupWizard 
                accounts={accounts} 
                onClose={() => setShowCarLoanWizard(false)} 
                onComplete={() => {
                  setShowCarLoanWizard(false);
                  setActiveTab('dashboard');
                }}
              />
            )}
          </AnimatePresence>
      </main>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      </div>
    </ErrorBoundary>
  );
}
