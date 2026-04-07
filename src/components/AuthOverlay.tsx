import React, { useState, useEffect } from 'react';
import { LogIn, ShieldCheck, Database, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { sheetsService } from '../lib/sheets';

interface AuthOverlayProps {
  onAuthenticated: () => void;
}

export default function AuthOverlay({ onAuthenticated }: AuthOverlayProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'auth' | 'setup' | 'done'>('auth');

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { url } = await sheetsService.getAuthUrl();
      const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
      
      if (!authWindow) {
        setError('Please allow popups to connect your Google account.');
        setIsLoading(false);
        return;
      }

      const handleMessage = async (event: MessageEvent) => {
        if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
          setIsVerifying(true);
          
          // Store tokens if provided (backup for cookie-session)
          if (event.data.encodedTokens) {
            await sheetsService.setTokens(event.data.encodedTokens);
          }
          
          // Add a small delay to ensure cookie is processed by browser
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Verify session with server before proceeding
          try {
            const { isAuthenticated } = await sheetsService.fetchAuthStatus();
            if (isAuthenticated) {
              setStep('setup');
            } else {
              setError('Session verification failed. Please try again.');
            }
          } catch (e) {
            setError('Connection error. Please try again.');
          } finally {
            setIsVerifying(false);
            setIsLoading(false);
          }
          window.removeEventListener('message', handleMessage);
        }
      };
      window.addEventListener('message', handleMessage);
    } catch (error) {
      console.error("Login error:", error);
      setError('Failed to connect to Google.');
      setIsLoading(false);
    }
  };

  const handleSetup = async () => {
    setIsLoading(true);
    try {
      const spreadsheetId = sheetsService.getSpreadsheetId();
      if (!spreadsheetId) {
        const data = await sheetsService.createSheet();
        if (data.existing) {
          console.log("Reconnected to existing database");
        }
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
                  {isVerifying ? 'Verifying session...' : 'Connect Google Sheets'}
                </button>
                {error && (
                  <div className="space-y-2">
                    <p className="text-sm text-red-500 font-bold">{error}</p>
                    <button 
                      onClick={async () => {
                        setIsLoading(true);
                        setError(null);
                        const { isAuthenticated } = await sheetsService.fetchAuthStatus();
                        if (isAuthenticated) {
                          setStep('setup');
                        } else {
                          setError('Still not authenticated. Please try logging in again.');
                        }
                        setIsLoading(false);
                      }}
                      className="text-xs font-bold text-gray-500 underline hover:text-black mr-4"
                    >
                      Retry Connection Check
                    </button>
                    <button 
                      onClick={() => window.location.reload()}
                      className="text-xs font-bold text-gray-500 underline hover:text-black"
                    >
                      Force Refresh App
                    </button>
                  </div>
                )}
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
                  {isLoading ? 'Searching for Data...' : 'Find or Create Database'}
                </button>
                <p className="text-xs text-gray-400">We'll look for an existing "Zenith Finance Data" sheet or create a new one.</p>
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
