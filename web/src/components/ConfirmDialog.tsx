'use client';

import { useState, useCallback, createContext, useContext } from 'react';
import { X, AlertTriangle, Info, CheckCircle, Trash2 } from 'lucide-react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  requireInput?: string;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

const variantConfig = {
  danger: {
    icon: Trash2,
    iconBg: 'bg-rose-500/15',
    iconColor: 'text-rose-400',
    confirmBg: 'bg-rose-600 hover:bg-rose-500',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    confirmBg: 'bg-amber-600 hover:bg-amber-500',
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
    confirmBg: 'bg-blue-600 hover:bg-blue-500',
  },
  success: {
    icon: CheckCircle,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    confirmBg: 'bg-emerald-600 hover:bg-emerald-500',
  },
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setInputValue('');
      setState({ options, resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    if (loading) return;
    state?.resolve(result);
    setState(null);
    setInputValue('');
  };

  const handleConfirm = async () => {
    if (state?.options.requireInput && inputValue !== state.options.requireInput) return;
    setLoading(true);
    try {
      handleClose(true);
    } finally {
      setLoading(false);
    }
  };

  const variant = state ? variantConfig[state.options.variant || 'danger'] : variantConfig.danger;
  const Icon = variant.icon;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => handleClose(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <button onClick={() => handleClose(false)} className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition" aria-label="Close">
              <X className="h-4 w-4" />
            </button>

            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 h-10 w-10 rounded-xl ${variant.iconBg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${variant.iconColor}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-white">{state.options.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-400">{state.options.message}</p>
                </div>
              </div>

              {state.options.requireInput && (
                <div className="mt-4">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Type <span className="font-bold text-white">{state.options.requireInput}</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                    placeholder={state.options.requireInput}
                    autoFocus
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/50 rounded-b-2xl">
              <button onClick={() => handleClose(false)} disabled={loading}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl transition disabled:opacity-50">
                {state.options.cancelText || 'Cancel'}
              </button>
              <button onClick={handleConfirm} disabled={loading || (!!state.options.requireInput && inputValue !== state.options.requireInput)}
                className={`px-4 py-2 text-sm font-medium text-white rounded-xl transition disabled:opacity-50 ${variant.confirmBg}`}>
                {loading ? 'Processing...' : (state.options.confirmText || 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
