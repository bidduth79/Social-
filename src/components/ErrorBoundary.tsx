import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from './ui/button';

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

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let isQuotaError = false;

      try {
        const errorData = JSON.parse(this.state.error?.message || '{}');
        if (errorData.error && errorData.error.includes('Quota limit exceeded')) {
          isQuotaError = true;
          errorMessage = "Firestore Daily Quota Exceeded. The free tier limit for database reads has been reached for today.";
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
              <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              {isQuotaError ? "Quota Limit Reached" : "Oops! Something went wrong"}
            </h1>
            
            <p className="text-slate-600 dark:text-slate-400 mb-8">
              {errorMessage}
              {isQuotaError && (
                <span className="block mt-2 text-sm italic">
                  The quota will automatically reset tomorrow. You can still use other features of the app that don't require database access.
                </span>
              )}
            </p>

            <div className="flex flex-col gap-3">
              <Button 
                onClick={this.handleReset}
                className="w-full bg-[#13487a] hover:bg-[#13487a]/90 text-white gap-2"
              >
                <RefreshCcw className="h-4 w-4" />
                Reload Application
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/'}
                className="w-full border-slate-200 dark:border-slate-700"
              >
                Go to Dashboard
              </Button>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
              <p className="text-xs text-slate-400">
                If this problem persists, please contact support with the error details.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
