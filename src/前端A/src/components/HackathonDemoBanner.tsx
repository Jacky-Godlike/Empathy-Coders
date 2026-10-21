import React, { useState } from 'react';
import { Sparkles, Info, X, RotateCcw, Sliders, Check } from 'lucide-react';
import { getSimulatedLatencyMs, setSimulatedLatencyMs } from '../services/messagesApi';

interface HackathonDemoBannerProps {
  onResetData: () => void;
  isResetting: boolean;
}

export const HackathonDemoBanner: React.FC<HackathonDemoBannerProps> = ({
  onResetData,
  isResetting,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [latency, setLatency] = useState(getSimulatedLatencyMs());
  const [showSettings, setShowSettings] = useState(false);

  if (isDismissed) return null;

  const handleLatencyChange = (ms: number) => {
    setLatency(ms);
    setSimulatedLatencyMs(ms);
  };

  return (
    <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-4 sm:p-5 mb-6 shadow-md relative overflow-hidden">
      {/* Decorative gradient overlay */}
      <div className="absolute -right-12 -top-12 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 bg-blue-500/30 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-amber-300" />
              Hackathon Demonstration
            </span>
            <span className="text-xs text-blue-200/80">Frontend Prototype Mode</span>
          </div>

          <h3 className="text-sm sm:text-base font-semibold text-white">
            OrderFlow Mock Inbox & Pipeline Simulation
          </h3>

          <p className="text-xs text-slate-300 leading-relaxed">
            This prototype simulates an order processing inbox aggregating messages from{' '}
            <strong className="text-emerald-300 font-medium">WhatsApp</strong>,{' '}
            <strong className="text-sky-300 font-medium">Email</strong>, and{' '}
            <strong className="text-amber-300 font-medium">Manual Entry</strong>.
            Click <span className="underline decoration-blue-400">"Analyze as Order"</span> on any
            message to test simulated processing and state transitions!
          </p>
        </div>

        {/* Right side controls: Latency slider & Reset button */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setShowSettings(!showSettings)}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition border border-white/10"
            title="Adjust network simulation speed"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Simulated Latency: {latency}ms</span>
          </button>

          <button
            onClick={onResetData}
            disabled={isResetting}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition border border-white/10"
            title="Reset inbox back to default mock dataset"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span>Reset Mock Data</span>
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            title="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Latency adjustment dropdown */}
      {showSettings && (
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-300 font-medium">Select simulated network speed:</span>
          <div className="flex gap-2">
            {[
              { label: 'Instant (0ms)', ms: 0 },
              { label: 'Normal (750ms)', ms: 750 },
              { label: 'Slow (1500ms)', ms: 1500 },
            ].map((option) => (
              <button
                key={option.ms}
                onClick={() => handleLatencyChange(option.ms)}
                type="button"
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  latency === option.ms
                    ? 'bg-blue-500 text-white shadow-xs font-semibold'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
