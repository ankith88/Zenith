import React, { useState, useEffect } from 'react';
import { LayoutDashboard, MessageSquare, Plus, Settings, LogOut, User, Menu, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction } from './lib/db';
import { sheetsService } from './lib/sheets';
import Dashboard from './components/Dashboard';
import InsightsChat from './components/InsightsChat';
import VoiceInput from './components/VoiceInput';
import AuthOverlay from './components/AuthOverlay';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];
  const recurring = useLiveQuery(() => db.recurringTransactions.toArray()) || [];

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
    if (isAuthenticated) {
      processRecurring();
    }
  }, [isAuthenticated]);

  const processRecurring = async () => {
    const recurringItems = await db.recurringTransactions.toArray();
    const today = new Date();
    
    for (const item of recurringItems) {
      let lastDate = item.lastProcessedDate ? new Date(item.lastProcessedDate) : new Date(item.startDate);
      let nextDate = new Date(lastDate);

      const getNextDate = (date: Date, freq: string) => {
        const d = new Date(date);
        if (freq === 'Daily') d.setDate(d.getDate() + 1);
        else if (freq === 'Weekly') d.setDate(d.getDate() + 7);
        else if (freq === 'Monthly') d.setMonth(d.getMonth() + 1);
        else if (freq === 'Yearly') d.setFullYear(d.getFullYear() + 1);
        return d;
      };

      nextDate = getNextDate(nextDate, item.frequency);

      while (nextDate <= today) {
        const dateStr = nextDate.toISOString().split('T')[0];
        
        const newTransaction: Transaction = {
          date: dateStr,
          amount: item.amount,
          category: item.category,
          description: `[Recurring] ${item.description}`,
          type: item.type,
          accountId: item.accountId,
          synced: false
        };

        const tId = await db.transactions.add(newTransaction);
        await sheetsService.appendTransaction({ ...newTransaction, id: tId });
        await db.transactions.update(tId, { synced: true });

        item.lastProcessedDate = dateStr;
        await db.recurringTransactions.update(item.id!, { lastProcessedDate: dateStr, synced: false });
        await sheetsService.updateRecurring(item);
        await db.recurringTransactions.update(item.id!, { synced: true });

        nextDate = getNextDate(nextDate, item.frequency);
      }
    }
  };

  const checkAuth = async () => {
    try {
      const { isAuthenticated } = await sheetsService.fetchAuthStatus();
      setIsAuthenticated(isAuthenticated);
      if (isAuthenticated) {
        sheetsService.syncToLocal();
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setIsAuthenticated(false);
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
    <div className="min-h-screen bg-gray-50 flex">
      {!isAuthenticated && <AuthOverlay onAuthenticated={() => setIsAuthenticated(true)} />}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-100 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-xl">Z</span>
            </div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">Zenith</h1>
          </div>

          <nav className="flex-1 space-y-2">
            <button
              onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${activeTab === 'dashboard' ? 'bg-black text-white shadow-xl shadow-black/10' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <LayoutDashboard className="w-5 h-5" />
              Dashboard
            </button>
            <button
              onClick={() => { setActiveTab('chat'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${activeTab === 'chat' ? 'bg-black text-white shadow-xl shadow-black/10' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <MessageSquare className="w-5 h-5" />
              Ask Zenith
            </button>
          </nav>

          <div className="pt-6 border-t border-gray-50 space-y-2">
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-gray-400 hover:bg-gray-50 hover:text-gray-900 transition-all">
              <Settings className="w-5 h-5" />
              Settings
            </button>
            <button 
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                setIsAuthenticated(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-red-400 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 p-4 flex items-center justify-between lg:px-8">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-xl">
            <Menu className="w-6 h-6 text-gray-900" />
          </button>
          
          <div className="flex-1 lg:flex-none">
            <h2 className="text-lg font-bold text-gray-900 capitalize">{activeTab}</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold text-gray-900">Ankith</span>
              <span className="text-xs font-medium text-gray-400">Premium Plan</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-white shadow-sm overflow-hidden">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Ankith" alt="Avatar" referrerPolicy="no-referrer" />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full"
              >
                <Dashboard transactions={transactions} accounts={accounts} budgets={budgets} recurring={recurring} />
              </motion.div>
            ) : (
              <motion.div
                key="chat"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full p-6 lg:p-8"
              >
                <InsightsChat transactions={transactions} accounts={accounts} budgets={budgets} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <VoiceInput onConfirm={handleTransactionConfirm} />
      </main>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
