import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const isRateLimit = this.state.error?.message.includes('Rate exceeded') || 
                          this.state.error?.message.includes('429');

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-8 text-center border border-gray-100">
            <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-rose-500" />
            </div>
            
            <h2 className="text-2xl font-black text-gray-900 mb-2">
              {isRateLimit ? 'Sync Limit Reached' : 'Something went wrong'}
            </h2>
            
            <p className="text-gray-500 mb-8 leading-relaxed">
              {isRateLimit 
                ? "Google Sheets is currently busy. Please wait a minute before trying to sync again."
                : "We encountered an unexpected error. Don't worry, your data is safe."}
            </p>

            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all active:scale-95 shadow-lg"
              >
                <RefreshCw className="w-5 h-5" />
                Refresh Application
              </button>
              
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="w-full py-4 bg-white text-gray-600 border border-gray-100 rounded-2xl font-bold hover:bg-gray-50 transition-all"
              >
                Try to Continue
              </button>
            </div>

            {this.state.error && (
              <div className="mt-8 pt-8 border-t border-gray-50">
                <p className="text-[10px] font-mono text-gray-400 break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
