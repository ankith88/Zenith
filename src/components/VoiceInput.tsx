import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Loader2, Check, X, ChevronDown, Camera, Upload, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analystService } from '../lib/gemini';
import { Transaction, Account, db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

interface VoiceInputProps {
  onConfirm: (t: Transaction) => void;
}

export default function VoiceInput({ onConfirm }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<(Partial<Transaction> & { sourceAccount?: string; destinationAccount?: string }) | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];

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
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

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
    };
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const handleParse = async (text: string) => {
    setIsParsing(true);
    try {
      const data = await analystService.parseVoiceTransaction(text);
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
    } catch (error) {
      console.error("Parsing error:", error);
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <AnimatePresence>
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
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="bg-black text-white rounded-2xl p-2 shadow-2xl flex flex-col gap-1 min-w-[160px]"
            >
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
