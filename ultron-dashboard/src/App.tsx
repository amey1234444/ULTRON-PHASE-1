import React, { useState, useEffect } from 'react';
import { UltronHmiApp } from '@ultron/hmi-ui';
import { browserPlatform } from './platform/browserPlatform';
import { HomePage } from './pages/HomePage';

type View = 'home' | 'dashboard';

function getInitialView(): View {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'dashboard') return 'dashboard';
  return 'home';
}

export default function App() {
  const [view, setView] = useState<View>(getInitialView);

  useEffect(() => {
    const handler = () => setView(getInitialView());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const goToDashboard = () => {
    window.location.hash = 'dashboard';
    setView('dashboard');
  };

  const goHome = () => {
    window.location.hash = '';
    setView('home');
  };

  if (view === 'dashboard') {
    return <UltronHmiApp platform={browserPlatform} />;
  }

  return <HomePage onEnterDashboard={goToDashboard} />;
}
