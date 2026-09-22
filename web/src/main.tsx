import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryProvider } from '@/components/QueryProvider';
import { AuthProvider } from '@/context/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/Toast';
import { ConfirmProvider } from '@/components/ConfirmDialog';
import SplashScreen from '@/components/SplashScreen';
import RouteLoadingIndicator from '@/components/RouteLoadingIndicator';
import AppRoutes from './routes';
import './globals.css';

export default function MainApp() {
  return <AppRoutes />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <QueryProvider>
          <AuthProvider>
            <SplashScreen>
              <RouteLoadingIndicator />
              <ToastProvider />
              <ConfirmProvider>
                <MainApp />
              </ConfirmProvider>
            </SplashScreen>
          </AuthProvider>
        </QueryProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
);
