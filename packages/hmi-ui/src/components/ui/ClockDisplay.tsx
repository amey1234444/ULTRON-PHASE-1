import React, { useEffect, useState } from 'react';

export const ClockDisplay: React.FC = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(t);
  }, []);

  const time = now.toLocaleTimeString('en-GB', { hour12: false });
  const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="text-right select-none leading-none">
      <div className="eng-value text-sm font-semibold" style={{ color: 'var(--text)' }}>{time}</div>
      <div className="text-2xs mt-0.5 font-mono" style={{ color: 'var(--text-3)' }}>{date}</div>
    </div>
  );
};
