import React, { useState, useEffect } from 'react';
import { LogIn, ShieldCheck, Database, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { sheetsService } from '../lib/sheets';

interface AuthOverlayProps {
  onAuthenticated: () => void;
}

export default function AuthOverlay({ onAuthenticated }: AuthOverlayProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'auth' | 'setup' | 'done'>('auth');

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const { url } = await sheetsService.getAuthUrl();
      const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
      
      if (!authWindow) {
        alert('Please allow popups to connect your Google account.');
        setIsLoading(false);
        return;
      }

      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
          setStep('setup');
          setIsLoading(false);
          window.removeEventListener('message', handleMessage);
        }
      };
      window.addEventListener('message', handleMessage);
    } catch (error) {
      console.error("Login error:", error);
      setIsLoading(false);
    }
  };

  const handleSetup = async () => {
    setIsLoading(true);
    try {
      const spreadsheetId = sheetsService.getSpreadsheetId();
      if (!spreadsheetId) {
        await sheetsService.createSheet();
      }
      setStep('done');
      setTimeout(() => onAuthenticated(), 1500);
    } catch (error) {
      console.error("Setup error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-12">
        <div className="space-y-4">
          <div className="w-20 h-20 bg-black rounded-3xl mx-auto flex items-center justify-center shadow-2xl">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Zenith Finance</h1>
          <p className="text-gray-500 font-medium">Your private, AI-powered financial command center.</p>
        </div>

        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {step === 'auth' && (
              <motion.div
                key="auth"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <button
                  onClick={handleLogin}
                  disabled={isLoading}
                  className="w-full py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                  Connect Google Sheets
                </button>
                <p className="text-xs text-gray-400">We use Google Sheets as your private database. Your data never leaves your control.</p>
                <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl text-left">
                  <p className="text-xs text-amber-800 font-semibold mb-1">Getting an "Access Blocked" error?</p>
                  <p className="text-[10px] text-amber-700 leading-relaxed">
                    Ensure your email is added as a <strong>Test User</strong> in the Google Cloud Console OAuth Consent Screen.
                  </p>
                </div>
              </motion.div>
            )}

            {step === 'setup' && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <button
                  onClick={handleSetup}
                  disabled={isLoading}
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
                  Initialize Database
                </button>
                <p className="text-xs text-gray-400">We'll create a "Zenith Finance Data" spreadsheet in your Google Drive.</p>
              </motion.div>
            )}

            {step === 'done' && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4 flex flex-col items-center"
              >
                <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                <h2 className="text-2xl font-bold text-gray-900">All Set!</h2>
                <p className="text-gray-500">Welcome to the future of personal finance.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
