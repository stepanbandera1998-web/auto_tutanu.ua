import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
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
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-xl border border-stone-100">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h2 className="text-2xl font-bold mb-4">Ой! Щось пішло не так</h2>
            <p className="text-stone-500 mb-8">
              Виникла помилка при роботі додатка. Будь ласка, спробуйте оновити сторінку.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all"
            >
              Оновити сторінку
            </button>
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-8 p-4 bg-stone-50 rounded-xl text-left overflow-auto max-h-40">
                <p className="text-xs font-mono text-red-600">{error?.toString()}</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}
