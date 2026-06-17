import React, { createContext, useContext } from 'react';
import type { HmiPlatform } from '@ultron/hmi-core';

const PlatformContext = createContext<HmiPlatform | null>(null);

export const PlatformProvider: React.FC<{
  platform: HmiPlatform;
  children: React.ReactNode;
}> = ({ platform, children }) => (
  <PlatformContext.Provider value={platform}>
    {children}
  </PlatformContext.Provider>
);

export function usePlatform(): HmiPlatform {
  const platform = useContext(PlatformContext);
  if (!platform) {
    throw new Error('usePlatform must be used inside PlatformProvider');
  }
  return platform;
}
