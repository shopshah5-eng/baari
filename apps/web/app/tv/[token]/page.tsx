'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Wifi, WifiOff, AlertTriangle } from 'lucide-react';

interface TVItem {
  tokenFormatted: string;
  providerName: string;
  roomName: string;
  state: string;
}

interface TVData {
  clinicName: string;
  nowServing: TVItem[];
  nextUp: { tokenFormatted: string; providerName: string; roomName: string; aheadCount: number }[];
  announcement?: {
    textHi: string;
    textEn: string;
    tokenFormatted: string;
    timestamp: number;
  } | null;
}

export default function WaitingRoomTVPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = React.use(params);
  const tvToken = resolvedParams.token || 'display-default';

  const [data, setData] = useState<TVData>({
    clinicName: 'Waiting TV Display',
    nowServing: [],
    nextUp: []
  });

  const [connected, setConnected] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [clock, setClock] = useState('');
  const lastAnnouncedRef = useRef<string | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Live wall clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchTV = useCallback(async () => {
    try {
      const res = await fetch(`/engine-api/tv/${encodeURIComponent(tvToken)}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setConnected(true);

        // Cancel previous speech to prevent overlapping audio
        if (d.announcement && d.announcement.tokenFormatted !== lastAnnouncedRef.current) {
          lastAnnouncedRef.current = d.announcement.tokenFormatted;
          if (soundEnabledRef.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterHi = new SpeechSynthesisUtterance(d.announcement.textHi || `Token number ${d.announcement.tokenFormatted}`);
            utterHi.lang = 'hi-IN';
            utterHi.rate = 0.9;
            window.speechSynthesis.speak(utterHi);
          }
        }
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    }
  }, [tvToken]);

  // Polling interval decoupled from sound toggle
  useEffect(() => {
    fetchTV();
    const interval = setInterval(fetchTV, 2500);
    return () => clearInterval(interval);
  }, [fetchTV]);

  const activeServing = data.nowServing[0];

  return (
    <div className="min-h-screen bg-[#111827] text-white flex flex-col justify-between p-8 font-sans select-none overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex justify-between items-center border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-primary text-white flex items-center justify-center font-bold text-xl">
            ब
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">{data.clinicName}</h1>
            <p className="text-xs text-gray-400">Aapki baari, WhatsApp par</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-2xl font-mono font-bold text-white tabular-nums">
            {clock}
          </div>

          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const welcome = new SpeechSynthesisUtterance('Baari TV audio activated');
                welcome.lang = 'en-US';
                window.speechSynthesis.speak(welcome);
              }
            }}
            className={`p-2.5 rounded-full border transition-colors ${
              soundEnabled ? 'border-primary bg-primary/20 text-primary' : 'border-gray-800 bg-gray-900 text-gray-500'
            }`}
            title="Toggle Voice Announcements"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2 text-xs">
            {connected ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <Wifi className="w-4 h-4" /> Live
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-rose-400 font-medium animate-pulse">
                <WifiOff className="w-4 h-4" /> Reconnecting
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Split Screen (70% Active Patient / 30% Next Up §12) */}
      <div className="grid grid-cols-12 gap-8 my-auto py-6 items-center">
        {/* Left Column: Now Serving (Massive 14% Viewport Height Font) */}
        <div className="col-span-8 flex flex-col items-center justify-center text-center p-12 rounded-[24px] bg-gray-900/60 border border-gray-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-4 left-6">
            <span className="px-3 py-1 bg-primary/20 text-primary font-bold text-xs uppercase tracking-widest rounded-full border border-primary/30">
              NOW SERVING · KABIN MEIN JAIYE
            </span>
          </div>

          {activeServing ? (
            <div className="space-y-4 my-8">
              <div
                className="font-black text-primary tracking-tight font-mono leading-none drop-shadow-md"
                style={{ fontSize: 'clamp(5rem, 14vw, 12rem)' }}
              >
                {activeServing.tokenFormatted}
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-bold text-white">{activeServing.providerName}</div>
                <div className="text-xl text-primary font-semibold">{activeServing.roomName}</div>
              </div>
            </div>
          ) : (
            <div className="my-16 space-y-3">
              <div className="text-3xl font-bold text-gray-500">Queue is currently open</div>
              <p className="text-sm text-gray-500">Waiting for next token call...</p>
            </div>
          )}
        </div>

        {/* Right Column: Next Up Queue */}
        <div className="col-span-4 space-y-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">
            Aage Ka Number (Next in Line)
          </div>

          <div className="space-y-2.5">
            {data.nextUp.length === 0 ? (
              <div className="p-6 rounded-[16px] bg-gray-900/40 border border-gray-800 text-center text-sm text-gray-500">
                No waiting tokens
              </div>
            ) : (
              data.nextUp.slice(0, 4).map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-[16px] bg-gray-900/40 border border-gray-800 flex justify-between items-center"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-sm font-mono text-gray-500 font-bold">{idx + 1}.</span>
                    <span className="text-2xl font-black text-white font-mono">{item.tokenFormatted}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-gray-300">{item.providerName}</div>
                    <div className="text-[11px] text-gray-500">{item.roomName}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Footer Ticker */}
      <div className="border-t border-gray-800 pt-4 flex justify-between items-center text-xs text-gray-400">
        <div>
          📢 Token screen par aane par seedha room mein jayein. Phone par alert aane par taiyyar rahein.
        </div>
        <div className="font-mono text-[11px] text-gray-500">
          Baari Live Screen · Token: {tvToken.slice(0, 16)}
        </div>
      </div>
    </div>
  );
}
