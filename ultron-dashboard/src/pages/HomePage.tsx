import React from 'react';

const stats = [
  { value: '40%', label: 'Reduction in unplanned downtime' },
  { value: '6x', label: 'ROI in the first year' },
  { value: '1 day', label: 'From install to first insight' },
  { value: '99.2%', label: 'Alert accuracy' },
];

const features = [
  {
    num: '01',
    title: 'Connects to any machine',
    desc: 'Old or new. Any brand, any country. Ultron speaks every machine\'s language — no software upgrades, no vendor dependency.',
  },
  {
    num: '02',
    title: 'Predicts failure — weeks ahead',
    desc: 'Our AI tells you what\'s going to happen. Precise alerts like "fix this motor in 10 days" give your team real time to plan.',
  },
  {
    num: '03',
    title: 'One screen, everything clear',
    desc: 'Your entire plant — every machine, every alert, every trend — in a single dashboard on your phone or computer.',
  },
  {
    num: '04',
    title: 'One day to go live',
    desc: 'Plug it in. That\'s it. Any factory — large or small — can be fully live in a single day, with zero disruption to production.',
  },
];

const steps = [
  { step: '01', title: 'Plug in', desc: 'One sensor installation connects Ultron to your machines — no IT team required, no complex wiring.' },
  { step: '02', title: 'Ultron learns', desc: 'Within hours, our AI understands each machine\'s unique heartbeat — its normal rhythms and stress patterns.' },
  { step: '03', title: 'You get warned', desc: 'When something is about to fail, you get a precise, actionable alert — what\'s failing, when, and what to do.' },
];

const machineCards = [
  {
    name: 'Press motor 3',
    status: 'Attention — act in 10 days',
    statusColor: '#eab308',
    metric: 'Bearing temp',
    value: '87\u00B0C',
    detail: 'Predicted failure in 8\u201312 days. Schedule inspection now.',
  },
  {
    name: 'CNC line B',
    status: 'Healthy — no action needed',
    statusColor: '#22c55e',
    metric: 'Vibration',
    value: '0.4 mm/s',
    detail: 'Operating within normal range. Next review in 30 days.',
  },
  {
    name: 'Conveyor 12',
    status: 'Healthy — running smooth',
    statusColor: '#22c55e',
    metric: 'Motor load',
    value: '62%',
    detail: 'Efficient and stable. No maintenance required this month.',
  },
];

interface Props {
  onEnterDashboard: () => void;
}

export const HomePage: React.FC<Props> = ({ onEnterDashboard }) => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-auto">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg bg-[#0a0a0a]/80 border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/oswar-logo.png" alt="OSWAR" className="h-7" />
            <span className="text-lg font-bold tracking-tight">ULTRON</span>
          </div>
          <button
            onClick={onEnterDashboard}
            className="px-5 py-2 bg-green-500 hover:bg-green-400 text-black text-sm font-semibold rounded-lg transition-colors"
          >
            Open Dashboard
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase text-green-400 mb-6">
            Predictive Maintenance — Reimagined
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] mb-8">
            Your factory should<br />
            <span className="text-green-400">never stop</span> without warning.
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            Ultron watches every machine, every shift, every second — and tells you what&apos;s
            going to fail before it does. So your team fixes problems on their schedule, not the machine&apos;s.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-300 mb-12">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Connects to any machine
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Up and running in one day
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              One screen for your entire plant
            </span>
          </div>
          <button
            onClick={onEnterDashboard}
            className="px-8 py-3.5 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg text-base transition-all hover:scale-105"
          >
            Enter Live Dashboard
          </button>
        </div>

        {/* Gradient glow */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-green-500/5 rounded-full blur-[128px] pointer-events-none" />
      </section>

      {/* Live monitoring section */}
      <section className="py-20 px-6 border-t border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase text-green-400 mb-3 text-center">
            What Ultron sees — right now
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            14,000+ machines. 12 countries.<br />One pane of glass.
          </h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-12">
            At this moment, Ultron is monitoring 14,000+ machines across factories in 12 countries —
            catching failures before they happen.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {machineCards.map((card) => (
              <div key={card.name} className="bg-[#141414] border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] tracking-wider uppercase text-gray-500">Machine</span>
                </div>
                <h3 className="text-white font-semibold mb-1">{card.name}</h3>
                <p className="text-xs mb-4" style={{ color: card.statusColor }}>{card.status}</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-gray-400 text-xs">{card.metric}</span>
                  <span className="text-white font-bold text-xl font-mono">{card.value}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{card.detail}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-500 mt-8">
            Every alert includes what&apos;s failing, when to expect it, and exactly what action to take.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 border-t border-gray-800/50 bg-[#0d0d0d]">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase text-green-400 mb-8 text-center">
            The numbers speak
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-green-400 mb-2">{s.value}</div>
                <div className="text-xs text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 border-t border-gray-800/50">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase text-green-400 mb-3 text-center">
            Built for the real world
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
            Everything you need. Nothing you don&apos;t.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((f) => (
              <div key={f.num} className="bg-[#141414] border border-gray-800 rounded-xl p-6 hover:border-green-900/50 transition-colors">
                <span className="text-green-400 font-mono text-sm font-bold">{f.num}</span>
                <h3 className="text-white font-semibold text-lg mt-2 mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 border-t border-gray-800/50 bg-[#0d0d0d]">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase text-green-400 mb-3 text-center">
            How it works
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
            Three steps. Then it runs itself.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                  <span className="text-green-400 font-mono font-bold text-sm">{s.step}</span>
                </div>
                <h3 className="text-white font-semibold mb-2">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-gray-800/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            The smartest thing your factory can do is<br />
            <span className="text-green-400">never be surprised again.</span>
          </h2>
          <p className="text-gray-400 mb-8 text-sm">
            Ultron gives your team the gift of time — time to plan, time to fix,
            time to focus on building great products instead of firefighting broken machines.
          </p>
          <button
            onClick={onEnterDashboard}
            className="px-8 py-3.5 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg text-base transition-all hover:scale-105"
          >
            Enter Live Dashboard
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/oswar-logo.png" alt="OSWAR" className="h-5 opacity-60" />
            <span className="text-xs text-gray-500">OSWAR/teck</span>
          </div>
          <p className="text-xs text-gray-600">
            Predictive Maintenance for Industry 4.0
          </p>
        </div>
      </footer>
    </div>
  );
};
