import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { HmiPlatform } from '@ultron/hmi-core';
import { ThemeProvider }    from './context/ThemeContext';
import { PlatformProvider } from './platform/PlatformContext';
import { useAppStore }      from './store/appStore';
import { SplashPage }       from './pages/SplashPage';
import { DiscoveryScreen }  from './components/discovery/DiscoveryScreen';
import { MainLayout }       from './components/layout/MainLayout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, refetchOnWindowFocus: false, staleTime: 5_000 },
  },
});

const AppInner: React.FC = () => {
  const appPhase = useAppStore((s) => s.appPhase);

  if (appPhase === 'splash')     return <SplashPage />;
  if (appPhase === 'discovery')  return <DiscoveryScreen />;

  /* connected | settings | diagnostics -> MainLayout with sidebar */
  return <MainLayout />;
};

export const UltronHmiApp: React.FC<{ platform: HmiPlatform }> = ({ platform }) => (
  <ThemeProvider>
    <PlatformProvider platform={platform}>
      <QueryClientProvider client={queryClient}>
        <AppInner />
      </QueryClientProvider>
    </PlatformProvider>
  </ThemeProvider>
);

export default UltronHmiApp;
