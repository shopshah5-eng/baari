'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react';

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
  const [data, setData] = useState<TVData>({
    clinicName: 'Dr Sharma Dental & Aesthetics',
    nowServing: [
      { tokenFormatted: 'S-07', providerName: 'Dr. Sharma', roomName: 'Cabin 1', state: 'CALLED' },
      { tokenFormatted: 'K-04', providerName: 'Dr. Kaur', roomName: 'Cabin 2', state: 'IN_CONSULT' }
    ],
    nextUp: [
      { tokenFormatted: 'S-08', providerName: 'Dr. Sharma', roomName: 'Cabin 1', aheadCount: 1 },
      { tokenFormatted: 'K-05', providerName: 'Dr. Kaur', roomName: 'Cabin 2', aheadCount: 1 },
      { tokenFormatted: 'S-09', providerName: 'Dr. Sharma', roomName: 'Cabin 1', aheadCount: 2 }
    ]
  });

  const [connected, setConnected] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const lastAnnouncedRef = useRef<string | null>(null);

  const fetchTV = async () => {
    try {
      const res = await fetch('/engine-api/tv/display-default');
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setConnected(true);

        // Voice announcement via browser SpeechSynthesis
        if (d.announcement && d.announcement.tokenFormatted !== lastAnnouncedRef.current) {
          lastAnnouncedRef.current = d.announcement.tokenFormatted;
          if (soundEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
            const utterHi = new SpeechSynthesisUtterance(d.announcement.textHi);
            utterHi.lang = 'hi-IN';
            utterHi.rate = 0.9;
            window.speechSynthesis.speak(utterHi);
          }
        }
      }
    } catch {
      setConnected(false);
    }
  };

  useEffect(() => {
    fetchTV();
    const interval = setInterval(fetchTV, 2500);
    return () => clearInterval(interval);
  }, [soundEnabled]);

  const activeServing = data.nowServing[0] || {
    tokenFormatted: 'S-07',
    providerName: 'Dr. Sharma',
    roomName: 'Cabin 1',
    state: 'CALLED'
  };

  return (
    <div className="fixed inset-0 bg-[#0B0F19] text-white flex flex-col justify-between p-8 select-none overflow-hidden font-sans">
      {/* Top Header */}
      <div className="flex justify-between items-center border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-[10px] bg-primary text-white flex items-center justify-center font-bold text-xl">
            ब
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">{data.clinicName}</h1>
            <p className="text-xs text-white/50 tracking-wider uppercase">Live OPD Token Display</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-green-400" /> : <VolumeX className="w-4 h-4 text-white/40" />}
            <span className="text-[11px] font-medium">{soundEnabled ? 'Voice ON' : 'Tap for Voice'}</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs">
            {connected ? (
              <span className="flex items-center gap-1.5 text-green-400 font-medium">
                <Wifi className="w-4 h-4" /> Live
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                <WifiOff className="w-4 h-4" /> Offline Cache
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center Giant Now-Serving Display (Token >= 14% of Screen Height per §12.4) */}
      <div className="flex-1 flex flex-col justify-center items-center text-center my-4">
        <span className="text-xl sm:text-2xl font-semibold tracking-widest text-primary uppercase mb-2">
          Abhi Ki Baari · Now Serving
        </span>

        {/* Token number >= 14% of screen height */}
        <div className="text-[16vh] font-black text-white tracking-tight tabular-nums leading-none drop-shadow-[0_4px_24px_rgba(87,70,245,0.4)]">
          {activeServing.tokenFormatted}
        </div>

        <div className="mt-4 flex items-center gap-4 text-xl sm:text-2xl text-white/90 font-medium">
          <span className="px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-green-400 font-bold">
            {activeServing.roomName}
          </span>
          <span className="text-white/60">·</span>
          <span>{activeServing.providerName}</span>
        </div>
      </div>

      {/* Bottom Grid: All Cabins & Upcoming Patients */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/10 pt-4">
        {/* All Active Cabins */}
        <div className="bg-white/5 border border-white/10 rounded-[12px] p-4 space-y-2">
          <span className="text-xs uppercase tracking-wider text-white/50 font-semibold block">All Cabins</span>
          <div className="grid grid-cols-2 gap-3">
            {data.nowServing.map((c, i) => (
              <div key={i} className="bg-white/5 p-3 rounded-[8px] border border-white/5 flex justify-between items-center">
                <div>
                  <div className="text-xs text-white/60">{c.roomName} ({c.providerName})</div>
                  <div className="text-2xl font-bold text-white tabular-nums">{c.tokenFormatted}</div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Up Next in Line */}
        <div className="bg-white/5 border border-white/10 rounded-[12px] p-4 space-y-2">
          <span className="text-xs uppercase tracking-wider text-white/50 font-semibold block">Agla Number · Next Up</span>
          <div className="flex gap-2 overflow-x-auto py-1">
            {data.nextUp.map((n, i) => (
              <div key={i} className="flex-1 min-w-[100px] bg-white/5 p-2.5 rounded-[8px] text-center border border-white/5">
                <div className="text-lg font-bold text-white/90 tabular-nums">{n.tokenFormatted}</div>
                <div className="text-[10px] text-white/50 truncate">{n.roomName}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

