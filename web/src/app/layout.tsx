import type { Metadata, Viewport } from 'next';
import { QueryProvider } from '@/components/QueryProvider';
import { AuthProvider } from '@/context/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/Toast';
import { ConfirmProvider } from '@/components/ConfirmDialog';
import SplashScreen from '@/components/SplashScreen';
import RouteLoadingIndicator from '@/components/RouteLoadingIndicator';
import './globals.css';

export const metadata: Metadata = {
  title: 'WorkTracker',
  description: 'Employee Work Tracking & Workforce Management',
  robots: 'index, follow',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full bg-[#0a0a0f] text-slate-100">
        <ErrorBoundary>
          <QueryProvider>
            <AuthProvider>
              <SplashScreen>
                <RouteLoadingIndicator />
                <ToastProvider />
                <ConfirmProvider>
                  {children}
                </ConfirmProvider>
              </SplashScreen>
            </AuthProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
