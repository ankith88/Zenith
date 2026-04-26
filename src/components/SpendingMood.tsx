import React, { useState, useEffect } from 'react';
import { Transaction } from '../lib/db';
import { analystService } from '../lib/gemini';
import { Brain, Loader2, Sparkles, TrendingUp, TrendingDown, Heart, Zap, Target, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

interface SpendingMoodProps {
  transactions: Transaction[];
}

interface MoodAnalysis {
  mood: string;
  description: string;
  insight: string;
  recommendation: string;
  score: number;
}

export default function SpendingMood({ transactions }: SpendingMoodProps) {
  const [analysis, setAnalysis] = useState<MoodAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeMood = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await analystService.getSpendingMoodAnalysis(transactions);
      setAnalysis(data);
    } catch (err: any) {
      console.error("Mood analysis error:", err);
      setError(err.message || "Something went wrong while analyzing your spending mood.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-12 border border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center min-h-[400px]">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse" />
          <Brain className="w-16 h-16 text-indigo-500 relative z-10 animate-bounce" />
        </div>
        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 text-center">Reading Your Financial Aura...</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 text-center">Zenith is looking for emotional patterns in your data.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-12 border border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center min-h-[400px]">
        <AlertTriangle className="w-16 h-16 text-rose-500 mb-6" />
        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4">Analysis Interrupted</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md text-center">{error}</p>
        <button
          onClick={analyzeMood}
          className="px-8 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black hover:scale-105 transition-transform"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-12 border border-gray-100 dark:border-gray-800 text-center min-h-[400px] flex flex-col items-center justify-center">
        <div className="w-20 h-20 bg-purple-50 dark:bg-purple-900/20 rounded-3xl flex items-center justify-center mb-8">
          <Brain className="w-10 h-10 text-purple-500" />
        </div>
        <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-4">Discover Your Spending Mood</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-10 max-w-sm mx-auto text-lg leading-relaxed">
          Are you stress spending or value-aligned? Let Zenith analyze your transaction history to find your emotional financial patterns.
        </p>
        <button
          onClick={analyzeMood}
          className="px-10 py-5 bg-black dark:bg-white text-white dark:text-black rounded-[2rem] font-black hover:scale-105 transition-transform shadow-2xl active:scale-95"
        >
          Start Analysis
        </button>
      </div>
    );
  }

  const getMoodIcon = (mood: string) => {
    const m = mood.toLowerCase();
    if (m.includes('stress')) return <Zap className="w-8 h-8 text-rose-500" />;
    if (m.includes('value') || m.includes('disciplined')) return <Target className="w-8 h-8 text-emerald-500" />;
    if (m.includes('impulsive')) return <TrendingUp className="w-8 h-8 text-amber-500" />;
    return <Heart className="w-8 h-8 text-indigo-500" />;
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Mood Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-10 opacity-10">
            <Brain className="w-48 h-48" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                {getMoodIcon(analysis.mood)}
              </div>
              <div>
                <p className="text-white/60 text-xs font-black uppercase tracking-widest">Current Spending Mood</p>
                <h2 className="text-4xl font-black tracking-tight">{analysis.mood}</h2>
              </div>
            </div>

            <p className="text-xl text-white/90 font-medium leading-relaxed mb-8 max-w-2xl">
              {analysis.description}
            </p>

            <div className="flex items-center gap-6">
              <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10">
                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Discipline Score</p>
                <p className="text-3xl font-black">{analysis.score}/100</p>
              </div>
              <div className="flex-1">
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${analysis.score}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Insight Card */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-10 border border-gray-100 dark:border-gray-800 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-6 h-6 text-amber-500" />
            <h3 className="text-xl font-black text-gray-900 dark:text-white">AI Insight</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium leading-relaxed mb-8">
            {analysis.insight}
          </p>
          <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl border border-emerald-100 dark:border-emerald-900/30">
            <p className="text-emerald-700 dark:text-emerald-400 text-sm font-bold leading-relaxed">
              <span className="block text-[10px] uppercase tracking-widest mb-2 opacity-60">Recommendation</span>
              {analysis.recommendation}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Pattern Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800">
          <h4 className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Emotional Triggers</h4>
          <div className="space-y-4">
            {/* These would ideally come from the AI, but for now we can show placeholders or derive from insight */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Late Night Shopping</span>
              <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-black rounded-full">MEDIUM RISK</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Weekend Splurges</span>
              <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black rounded-full">CONTROLLED</span>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800">
          <h4 className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">Value Alignment</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Health & Wellness</span>
              <span className="text-emerald-500 font-black text-xs">HIGH ALIGNMENT</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Convenience Fees</span>
              <span className="text-rose-500 font-black text-xs">LOW ALIGNMENT</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
