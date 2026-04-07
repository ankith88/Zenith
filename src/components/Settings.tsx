import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, ExternalLink, Database, Copy, Check, RefreshCw, Loader2, Shield, CloudUpload, CloudDownload } from 'lucide-react';
import { motion } from 'motion/react';
import { sheetsService } from '../lib/sheets';
import { db } from '../lib/db';

export default function Settings() {
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      const { isAuthenticated } = await sheetsService.fetchAuthStatus();
      setIsAuthenticated(isAuthenticated);
      
      let id = sheetsService.getSpreadsheetId();
      if (!id && isAuthenticated) {
        const setting = await db.settings.get('zenith_spreadsheet_id');
        if (setting?.value) {
          id = setting.value;
          sheetsService.setSpreadsheetId(id);
        } else {
          // Proactively try to find it on Drive if logged in
          try {
            const data = await sheetsService.createSheet();
            id = data.spreadsheetId;
          } catch (e) {
            console.error("Proactive ID fetch failed", e);
          }
        }
      }
      setSpreadsheetId(id);
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = () => {
    if (spreadsheetId) {
      navigator.clipboard.writeText(spreadsheetId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleManualSync = async () => {
    if (!spreadsheetId) {
      await handleReconnect();
      return;
    }
    setIsSyncing(true);
    setSyncMessage("Pulling data from Google Sheets...");
    try {
      await sheetsService.syncToLocal();
      setSyncMessage("Local database updated successfully!");
    } catch (error) {
      setSyncMessage("Failed to pull data. Please check your connection.");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  const handlePushToCloud = async () => {
    if (!spreadsheetId) {
      await handleReconnect();
      return;
    }
    setIsPushing(true);
    setSyncMessage("Pushing local data to Google Sheets...");
    try {
      await sheetsService.syncToRemote();
      setSyncMessage("Google Sheet updated successfully!");
    } catch (error) {
      setSyncMessage("Failed to push data. Please check your connection.");
    } finally {
      setIsPushing(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  const handleLogin = async () => {
    setIsSyncing(true);
    try {
      const { url } = await sheetsService.getAuthUrl();
      const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
      
      if (!authWindow) {
        setSyncMessage('Please allow popups to connect your Google account.');
        return;
      }

      const handleMessage = async (event: MessageEvent) => {
        if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
          // Store tokens if provided (backup for cookie-session)
          if (event.data.encodedTokens) {
            await sheetsService.setTokens(event.data.encodedTokens);
          }
          
          setIsAuthenticated(true);
          setSyncMessage('Authenticated! Linking sheet...');
          handleReconnect();
          window.removeEventListener('message', handleMessage);
        }
      };
      window.addEventListener('message', handleMessage);
    } catch (error) {
      setSyncMessage('Login failed. Try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReconnect = async () => {
    setIsSyncing(true);
    setSyncMessage("Connecting to Google Drive...");
    try {
      const data = await sheetsService.createSheet();
      if (data.spreadsheetId) {
        setSpreadsheetId(data.spreadsheetId);
        setSyncMessage("Database connected!");
      } else {
        setSyncMessage("Could not find database. Try logging in again.");
      }
    } catch (error) {
      setSyncMessage("Connection error. Try opening in a new tab.");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  const sheetUrl = spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` : null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Settings</h2>
        <p className="text-gray-500 font-medium">Manage your connection and data security.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Mobile Session Warning */}
        <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex gap-4 items-center">
            <div className="p-2 bg-amber-100 rounded-xl">
              <Shield className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">Mobile Sync Issues?</p>
              <p className="text-xs text-amber-700">Always use the "Open in New Tab" button for the best sync experience.</p>
            </div>
          </div>
          <button 
            onClick={() => window.open(window.location.href, '_blank')}
            className="w-full sm:w-auto px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-all whitespace-nowrap"
          >
            Open in New Tab
          </button>
        </div>

        {/* Database Connection Card */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-black rounded-2xl">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Cloud Sync Status</h3>
              <p className="text-sm text-gray-500">
                {isAuthenticated ? (
                  <span className="text-emerald-500 font-bold flex items-center gap-1">
                    <Check className="w-4 h-4" /> Connected to Google
                  </span>
                ) : (
                  <span className="text-amber-500 font-bold flex items-center gap-1">
                    <Shield className="w-4 h-4" /> Not Authenticated
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-gray-50">
            {spreadsheetId && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Spreadsheet ID</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-50 px-4 py-3 rounded-xl text-xs font-mono text-gray-600 break-all">
                    {spreadsheetId}
                  </code>
                  <button 
                    onClick={copyToClipboard}
                    className="p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                  </button>
                </div>
              </div>
            )}

            {syncMessage && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-100"
              >
                {syncMessage}
              </motion.div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {spreadsheetId ? (
                <>
                  <a 
                    href={sheetUrl!} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-2xl font-bold hover:bg-gray-800 transition-all active:scale-95"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Sheet
                  </a>
                  <button 
                    onClick={handlePushToCloud}
                    disabled={isPushing || isSyncing || !isAuthenticated}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isPushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                    Push to Cloud
                  </button>
                  <button 
                    onClick={handleManualSync}
                    disabled={isSyncing || isPushing || !isAuthenticated}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-900 rounded-2xl font-bold hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                    Pull from Cloud
                  </button>
                </>
              ) : (
                <button 
                  onClick={isAuthenticated ? handleReconnect : handleLogin}
                  disabled={isSyncing}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-black text-white rounded-2xl font-bold hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {isAuthenticated ? 'Link Google Sheet' : 'Login to Sync'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Data Architecture Info */}
        <div className="bg-gray-50 p-8 rounded-3xl border border-dashed border-gray-200 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-2">Where is my data?</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              Zenith uses a <strong>Local-First</strong> architecture. Your data is stored in a secure database inside your browser (IndexedDB). This is why you can see your accounts even when not connected to Google Sheets.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-2">Why sync to Google Sheets?</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              Syncing to Google Sheets acts as your <strong>Cloud Backup</strong>. It allows you to access the same data on your desktop and mobile, and gives you full ownership of your data in a format you can use elsewhere.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
