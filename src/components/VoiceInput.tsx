import React, { useState, useEffect, useMemo } from 'react';
import { Mic, MicOff, Loader2, Check, X, ChevronDown, Camera, Upload, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analystService } from '../lib/gemini';
import { Transaction, Account, db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatLocalDate } from '../lib/utils';

interface VoiceInputProps {
  onConfirm: (t: Transaction) => void;
  onQuery?: (query: string) => void;
}

export default function VoiceInput({ onConfirm, onQuery }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<(Partial<Transaction> & { sourceAccount?: string; destinationAccount?: string }) | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [manualData, setManualData] = useState({
    description: '',
    amount: '',
    category: '',
    date: formatLocalDate(),
    type: 'Expense' as 'Income' | 'Expense' | 'Transfer'
  });
  const [isPredicting, setIsPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];
  const categories = useMemo(() => Array.from(new Set(budgets.map(b => b.category))), [budgets]);

  useEffect(() => {
    if (isManualEntry && manualData.description.length > 3 && categories.length > 0) {
      const timer = setTimeout(async () => {
        setIsPredicting(true);
        try {
          const predicted = await analystService.predictCategory(manualData.description, categories);
          if (predicted && predicted !== 'Other') {
            setManualData(prev => ({ ...prev, category: predicted }));
          }
        } catch (error) {
          console.error("Prediction error:", error);
        } finally {
          setIsPredicting(false);
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [manualData.description, isManualEntry, categories]);

  useEffect(() => {
    if (accounts.length > 0 && selectedAccountId === null) {
      setSelectedAccountId(accounts[0].id!);
    }
  }, [accounts]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setIsMenuOpen(false);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const data = await analystService.parseReceipt(base64, file.type);
        setParsedData(data);
        
        // Auto-select accounts if AI found them
        if (data.sourceAccount) {
          const acc = accounts.find(a => a.name.toLowerCase().includes(data.sourceAccount!.toLowerCase()));
          if (acc) setSelectedAccountId(acc.id!);
        }
        if (data.destinationAccount) {
          const acc = accounts.find(a => a.name.toLowerCase().includes(data.destinationAccount!.toLowerCase()));
          if (acc) setToAccountId(acc.id!);
        }
        
        setIsParsing(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Receipt parsing error:", error);
      setIsParsing(false);
    }
  };

  const startListening = () => {
    if (accounts.length === 0) {
      alert("Please create an account first.");
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition not supported in this browser.");
      return;
    }

    setError(null);
    setParsedData(null);
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      handleParse(text);
    };
    recognition.onerror = (event: any) => {
      console.error("Speech error:", event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setError("Microphone access denied. Please enable it in your browser settings.");
      } else {
        setError(`Speech error: ${event.error}`);
      }
    };
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const handleParse = async (text: string) => {
    setIsParsing(true);
    setError(null);
    try {
      const data = await analystService.parseVoiceTransaction(text);
      
      if (data.intent === 'query' && data.query) {
        if (onQuery) {
          onQuery(data.query);
        } else {
          setError("Query handling not available here.");
        }
        setTranscript('');
        return;
      }

      if (!data || !data.amount) {
        setError("Could not understand the transaction. Try speaking more clearly.");
        return;
      }
      setParsedData(data as any);

      // Auto-select accounts if AI found them
      if (data.sourceAccount) {
        const acc = accounts.find(a => a.name.toLowerCase().includes(data.sourceAccount!.toLowerCase()));
        if (acc) setSelectedAccountId(acc.id!);
      }
      if (data.destinationAccount) {
        const acc = accounts.find(a => a.name.toLowerCase().includes(data.destinationAccount!.toLowerCase()));
        if (acc) setToAccountId(acc.id!);
      }
    } catch (error) {
      console.error("Parsing error:", error);
      setError("AI failed to process your request. Please try again.");
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <AnimatePresence>
        {isParsing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-black text-white shadow-2xl rounded-2xl p-4 mb-4 w-80 flex items-center gap-3"
          >
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            <p className="text-xs font-bold">AI is parsing your transaction...</p>
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-rose-600 text-white shadow-2xl rounded-2xl p-4 mb-4 w-80 flex items-center gap-3"
          >
            <X className="w-5 h-5 shrink-0" onClick={() => setError(null)} />
            <p className="text-xs font-bold">{error}</p>
          </motion.div>
        )}
        {parsedData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-white/90 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl p-6 mb-4 w-80"
          >
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Confirm Transaction</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Amount</span>
                <span className="font-mono font-bold text-emerald-600">${parsedData.amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Category</span>
                <span className="font-medium">{parsedData.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{parsedData.type === 'Transfer' ? 'From' : 'Account'}</span>
                <div className="relative">
                  <select 
                    value={selectedAccountId || ''} 
                    onChange={(e) => setSelectedAccountId(parseInt(e.target.value))}
                    className="appearance-none bg-gray-100 px-2 py-1 rounded-lg text-xs font-bold pr-6 outline-none"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                </div>
              </div>
              {parsedData.type === 'Transfer' && (
                <div className="flex justify-between">
                  <span className="text-gray-400">To</span>
                  <div className="relative">
                    <select 
                      value={toAccountId || ''} 
                      onChange={(e) => setToAccountId(parseInt(e.target.value))}
                      className="appearance-none bg-indigo-50 px-2 py-1 rounded-lg text-xs font-bold pr-6 outline-none text-indigo-600"
                    >
                      <option value="">Select Account</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => { setParsedData(null); setToAccountId(null); }}
                className="flex-1 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors flex justify-center items-center"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
              <button
                onClick={() => {
                  if (parsedData.type === 'Transfer' && !toAccountId) {
                    alert("Please select a destination account for the transfer.");
                    return;
                  }
                  onConfirm({ ...parsedData, accountId: selectedAccountId!, toAccountId: toAccountId || undefined } as Transaction);
                  setParsedData(null);
                  setToAccountId(null);
                  setTranscript('');
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 transition-colors flex justify-center items-center"
              >
                <Check className="w-4 h-4 text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col items-center gap-4">
        {/* Manual Entry Form */}
        {isManualEntry && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-white/90 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl p-6 mb-4 w-80"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Manual Entry</h3>
              <button onClick={() => setIsManualEntry(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Description</label>
                <input
                  type="text"
                  value={manualData.description}
                  onChange={(e) => setManualData({ ...manualData, description: e.target.value })}
                  placeholder="What did you buy?"
                  className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-black outline-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Amount</label>
                  <input
                    type="number"
                    value={manualData.amount}
                    onChange={(e) => setManualData({ ...manualData, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-black outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Type</label>
                  <select
                    value={manualData.type}
                    onChange={(e) => setManualData({ ...manualData, type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-black outline-none"
                  >
                    <option value="Expense">Expense</option>
                    <option value="Income">Income</option>
                    <option value="Transfer">Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block flex items-center justify-between">
                  Category
                  {isPredicting && <Loader2 className="w-2 h-2 animate-spin text-indigo-500" />}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={manualData.category}
                    onChange={(e) => setManualData({ ...manualData, category: e.target.value })}
                    placeholder="e.g. Food"
                    className={`w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-black outline-none transition-all ${isPredicting ? 'ring-1 ring-indigo-200' : ''}`}
                  />
                  {manualData.category && categories.includes(manualData.category) && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Check className="w-3 h-3 text-emerald-500" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    if (!manualData.amount || !manualData.description) return;
                    setParsedData({
                      ...manualData,
                      amount: parseFloat(manualData.amount)
                    });
                    setIsManualEntry(false);
                  }}
                  className="w-full py-3 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-all active:scale-95"
                >
                  Review & Save
                </button>
              </div>
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="bg-black text-white rounded-2xl p-2 shadow-2xl flex flex-col gap-1 min-w-[160px]"
            >
              <button
                onClick={() => { setIsMenuOpen(false); setIsManualEntry(true); }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-xl transition-colors text-sm font-bold"
              >
                <Plus className="w-4 h-4" />
                Manual Entry
              </button>
              <button
                onClick={() => { setIsMenuOpen(false); startListening(); }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-xl transition-colors text-sm font-bold"
              >
                <Mic className="w-4 h-4" />
                Voice Input
              </button>
              <label className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-xl transition-colors text-sm font-bold cursor-pointer">
                <Camera className="w-4 h-4" />
                Scan Receipt
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
              </label>
              <label className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-xl transition-colors text-sm font-bold cursor-pointer">
                <Upload className="w-4 h-4" />
                Upload Image
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          disabled={isListening || isParsing}
          className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95 ${
            isListening ? 'bg-red-500 animate-pulse' : 'bg-black hover:bg-gray-800'
          } ${isParsing ? 'opacity-50' : ''}`}
        >
          {isParsing ? (
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          ) : isListening ? (
            <MicOff className="w-6 h-6 text-white" />
          ) : (
            <Plus className={`w-6 h-6 text-white transition-transform ${isMenuOpen ? 'rotate-45' : ''}`} />
          )}
        </button>
      </div>
      
      {transcript && !parsedData && !isParsing && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 text-white px-4 py-1 rounded-full text-sm">
          "{transcript}"
        </div>
      )}
    </div>
  );
}
