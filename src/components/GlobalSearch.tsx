import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ArrowRight, FileText, Wallet, Tag, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, Transaction, Account, Budget } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

interface SearchResult {
  id: string | number;
  type: 'transaction' | 'account' | 'category';
  title: string;
  subtitle: string;
  amount?: number;
  date?: string;
}

interface GlobalSearchProps {
  onNavigate: (tab: any) => void;
}

export default function GlobalSearch({ onNavigate }: GlobalSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];

  // Debounce query
  useEffect(() => {
    if (!query.trim()) {
      setDebouncedQuery('');
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 400); // 400ms debounce for better performance

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const searchLower = debouncedQuery.toLowerCase();
    const newResults: SearchResult[] = [];

    // Search Transactions
    transactions.forEach(t => {
      if (
        t.description.toLowerCase().includes(searchLower) ||
        t.category.toLowerCase().includes(searchLower)
      ) {
        newResults.push({
          id: `t-${t.id}`,
          type: 'transaction',
          title: t.description,
          subtitle: `${t.category} • ${t.date}`,
          amount: t.amount,
          date: t.date
        });
      }
    });

    // Search Accounts
    accounts.forEach(a => {
      if (a.name.toLowerCase().includes(searchLower) || a.type.toLowerCase().includes(searchLower)) {
        newResults.push({
          id: `a-${a.id}`,
          type: 'account',
          title: a.name,
          subtitle: a.type,
          amount: a.initialBalance
        });
      }
    });

    // Search Categories (from Budgets)
    budgets.forEach(b => {
      if (b.category.toLowerCase().includes(searchLower)) {
        newResults.push({
          id: `c-${b.id}`,
          type: 'category',
          title: b.category,
          subtitle: `${b.period} Budget: $${b.amount}`
        });
      }
    });

    setResults(newResults.slice(0, 8));
    setIsSearching(false);
  }, [debouncedQuery, transactions, accounts, budgets]);

  const handleResultClick = (result: SearchResult) => {
    setIsOpen(false);
    setQuery('');
    if (result.type === 'transaction' || result.type === 'account') {
      onNavigate('dashboard');
    } else if (result.type === 'category') {
      onNavigate('categories');
    }
  };

  return (
    <div className="relative w-full max-w-md" ref={searchRef}>
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-black transition-colors" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search transactions, accounts..."
          className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-black outline-none transition-all"
        />
        {query && (
          <button 
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-3 h-3 text-gray-400" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (query || results.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden z-[120]"
          >
            <div className="p-2 max-h-[400px] overflow-y-auto">
              {isSearching ? (
                <div className="p-8 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Searching...</p>
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-1">
                  {results.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleResultClick(result)}
                      className="w-full flex items-center gap-4 p-3 hover:bg-gray-50 rounded-2xl transition-colors group text-left"
                    >
                      <div className={`p-2.5 rounded-xl ${
                        result.type === 'transaction' ? 'bg-indigo-50 text-indigo-600' :
                        result.type === 'account' ? 'bg-emerald-50 text-emerald-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {result.type === 'transaction' ? <FileText className="w-4 h-4" /> :
                         result.type === 'account' ? <Wallet className="w-4 h-4" /> :
                         <Tag className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{result.title}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">{result.subtitle}</p>
                      </div>
                      {result.amount !== undefined && (
                        <div className="text-right">
                          <p className="text-sm font-black text-gray-900">${result.amount.toLocaleString()}</p>
                        </div>
                      )}
                      <ArrowRight className="w-4 h-4 text-gray-200 group-hover:text-black transition-colors" />
                    </button>
                  ))}
                </div>
              ) : query ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-bold text-gray-900">No results found</p>
                  <p className="text-xs text-gray-400 mt-1">Try searching for something else</p>
                </div>
              ) : null}
            </div>
            
            {results.length > 0 && (
              <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {results.length} results found
                </p>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-gray-400">ESC to close</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
