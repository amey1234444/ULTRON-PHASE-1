import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { HmiPlatform } from '@ultron/hmi-core';
import { ThemeProvider }    from './context/ThemeContext';
import { PlatformProvider } from './platform/PlatformContext';
import { useAppStore }      from './store/appStore';
import { useConnectionStore } from './store/connectionStore';
import { DEFAULT_MACHINE_ID } from './services/device/DeviceIdentity';
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

  /* connected | simulation | settings | diagnostics → MainLayout with sidebar */
  return <MainLayout />;
};

const EnvConfigLoader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const setConfig = useConnectionStore((s) => s.setConfig);

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL;
    if (!wsUrl) return;

    try {
      const apiBase = wsUrl.replace(/^wss?:/, 'http:').replace(/\/ws\/?$/, '');
      let deviceIp = apiBase;
      try { deviceIp = new URL(apiBase).hostname; } catch { /* keep original */ }

      setConfig({
        apiBase,
        wsUrl,
        deviceName: 'ULTRON Remote',
        deviceIp,
        deviceType: 'remote',
        machineId: DEFAULT_MACHINE_ID,
        protocol: 'manual',
        modbusPort: 5020,
        version: '1.0.0',
        lastSeen: Date.now(),
      });
    } catch (err) {
      // Invalid env value — ignore
      // eslint-disable-next-line no-console
      console.warn('VITE_WS_URL ignored (invalid):', err);
    }
  }, [setConfig]);

  return <>{children}</>;
};

export const UltronHmiApp: React.FC<{ platform: HmiPlatform }> = ({ platform }) => (
  <ThemeProvider>
    <PlatformProvider platform={platform}>
      <EnvConfigLoader>
        <QueryClientProvider client={queryClient}>
          <AppInner />
        </QueryClientProvider>
      </EnvConfigLoader>
    </PlatformProvider>
  </ThemeProvider>
);

export default UltronHmiApp;
