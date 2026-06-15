import React from 'react';
import type { SidebarView } from '../components/layout/Sidebar';

interface PageContent {
  title: string;
  phase: string;
  eta: string;
  description: string;
  features: string[];
}

const CONTENT: Partial<Record<SidebarView, PageContent>> = {
  devices: {
    title: 'Devices',
    phase: 'Phase 4',
    eta: '2027–2028',
    description: 'Fleet overview, multi-machine monitoring, and gateway device support.',
    features: [
      'Connect and view multiple machines simultaneously',
      'Machine type selector (RAV, Kiln, Compressor, Fan)',
      'Gateway device support — UM Card and TP Card',
      'Machine configuration and threshold management via UI',
    ],
  },
  maintenance: {
    title: 'Maintenance',
    phase: 'Phase 2',
    eta: '2026 Q3',
    description: 'Scheduled maintenance, service records, and predictive alerts.',
    features: [
      'Maintenance schedule and work-order management',
      'Service history log with technician notes',
      'Parts inventory tracking',
      'Predictive maintenance alerts (Phase 3)',
    ],
  },
  reports: {
    title: 'Reports',
    phase: 'Phase 2',
    eta: '2026 Q3',
    description: 'Automated PDF and Excel reports, alarm summaries, and data exports.',
    features: [
      'PDF maintenance and alarm-summary reports',
      'Historical trend reports with selectable date range',
      'Export to CSV and Excel',
      'Scheduled report delivery via email (Phase 5)',
    ],
  },
};

interface Props { view: SidebarView }

export const PlaceholderPage: React.FC<Props> = ({ view }) => {
  const content = CONTENT[view];
  if (!content) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '2rem' }}>
      <div className="scada-panel animate-fade-in" style={{ maxWidth: 520, width: '100%', padding: 0, overflow: 'hidden' }}>
        {/* Gradient accent */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, var(--accent), var(--info), transparent)' }} />

        <div style={{ padding: '1.75rem 2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
              padding: '3px 10px', borderRadius: 4, background: 'var(--accent-dim)', color: 'var(--accent)',
            }}>
              {content.phase}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.04em' }}>ETA {content.eta}</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: '0.6rem', letterSpacing: '0.02em' }}>
            {content.title}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            {content.description}
          </p>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
            <p style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--text-3)', marginBottom: '0.85rem',
            }}>
              Planned features
            </p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: 0, padding: 0, listStyle: 'none' }}>
              {content.features.map((f, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 4, background: 'var(--accent-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                  }}>
                    <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="var(--accent)" strokeWidth="2">
                      <path d="M3 8h10M8 3v10" strokeLinecap="round" />
                    </svg>
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
