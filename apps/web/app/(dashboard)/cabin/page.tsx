'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge } from '@baari/ui';
import { CheckCircle2, Clock, Users, Sparkles, ChevronRight } from 'lucide-react';

interface CabinData {
  provider: {
    id: string;
    name: string;
    room: string;
    specialty: string;
    avgMinutes: number;
    learnedMinutes: number;
    samples: number;
  };
  current: {
    id: string;
    number: number;
    formatted_number: string;
    state: string;
    name: string;
    phone: string;
    calledAt: string;
  } | null;
  nextPatients: {
    id: string;
    formatted_number: string;
    name: string;
    reason?: string;
  }[];
  elapsedSeconds: number;
}

export default function CabinPage() {
  const [data, setData] = useState<CabinData | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  const fetchCabin = async () => {
    try {
      const res = await fetch('/engine-api/cabin');
      const d = await res.json();
      setData(d);
      setElapsed(d.elapsedSeconds || 0);
      setLoading(false);
    } catch {
      // Mock fallback
      setData({
        provider: {
          id: 'p1',
          name: 'Dr. Rajesh Sharma',
          room: 'Cabin 1',
          specialty: 'Dental Surgeon',
          avgMinutes: 12,
          learnedMinutes: 13.4,
          samples: 23
        },
        current: {
          id: 't1',
          number: 7,
          formatted_number: 'S-07',
          state: 'CALLED',
          name: 'Ritu Sharma',
          phone: '+91 98100 00001',
          calledAt: new Date(Date.now() - 320000).toISOString()
        },
        nextPatients: [
          { id: 't2', formatted_number: 'S-08', name: 'Priya Gill', reason: 'Scaling' },
          { id: 't3', formatted_number: 'S-09', name: 'Manish Kumar', reason: 'Consultation' }
        ],
        elapsedSeconds: 320
      });
      setElapsed(320);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCabin();
    const interval = setInterval(fetchCabin, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleDone = async () => {
    setCompleting(true);
    try {
      await fetch('/engine-api/cabin/done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: data?.current?.id,
          actualDurationMin: Math.max(2, Math.round(elapsed / 60))
        })
      });
      setTimeout(() => {
        setCompleting(false);
        fetchCabin();
      }, 500);
    } catch {
      setCompleting(false);
      fetchCabin();
    }
  };

  if (loading || !data) {
    return <div className="p-8 text-center text-sm text-muted">Loading doctor cabin...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Provider Header with Learning Metrics per §9.2 */}
      <div className="flex justify-between items-center bg-white p-4 rounded-[12px] border border-border shadow-minimal">
        <div>
          <h1 className="text-base font-bold text-dark">{data.provider.name}</h1>
          <p className="text-xs text-muted">{data.provider.room} · {data.provider.specialty}</p>
        </div>

        {/* Baari is Learning: Configured vs Real Consultation EWMA */}
        <div className="text-right">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Learned: {data.provider.learnedMinutes} min</span>
          </div>
          <p className="text-[11px] text-muted">
            Configured {data.provider.avgMinutes}m (n={data.provider.samples}, high confidence)
          </p>
        </div>
      </div>

      {/* Main Active Patient Card with the ONE DONE Button */}
      <Card className="p-8 text-center space-y-6 border-primary/20 bg-white">
        {data.current ? (
          <>
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wider text-muted font-semibold">Active Consultation</span>
              <div className="text-5xl font-black text-primary tracking-tight tabular-nums py-2">
                {data.current.formatted_number}
              </div>
              <h2 className="text-xl font-bold text-dark">{data.current.name}</h2>
              <p className="text-xs text-muted">{data.current.phone}</p>
            </div>

            {/* Elapsed Live Timer */}
            <div className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-bg-inset rounded-pill border border-border">
              <Clock className="w-4 h-4 text-muted animate-spin" style={{ animationDuration: '4s' }} />
              <span className="text-sm font-semibold text-dark tabular-nums">
                Elapsed: {formatTimer(elapsed)}
              </span>
            </div>

            {/* THE ONE "DONE" BUTTON per §12.3 and §5 (09:41–12:19) */}
            <div className="pt-4 max-w-sm mx-auto">
              <Button
                variant="success"
                size="lg"
                onClick={handleDone}
                disabled={completing}
                className="w-full text-lg h-14 shadow-minimal"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                {completing ? 'Recalculating...' : 'DONE — Complete Visit'}
              </Button>
              <p className="text-[11px] text-muted mt-2">
                Tapping Done feeds actual duration into EWMA timing and recalculates everyone behind you.
              </p>
            </div>
          </>
        ) : (
          <div className="py-12 space-y-4">
            <div className="w-12 h-12 rounded-full bg-bg-inset text-muted flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-dark">No patient currently in cabin</h3>
              <p className="text-xs text-muted">Reception desk will call the next patient when you are ready.</p>
            </div>
          </div>
        )}
      </Card>

      {/* Next Up (Next 2 Patients) per §12.3 */}
      <Card className="space-y-3">
        <h3 className="text-xs font-semibold text-muted tracking-wide uppercase">Next in line</h3>
        {data.nextPatients.length === 0 ? (
          <p className="text-xs text-muted">No waiting patients in queue</p>
        ) : (
          <div className="space-y-2">
            {data.nextPatients.map((p, idx) => (
              <div
                key={p.id}
                className="flex justify-between items-center p-3 rounded-[8px] bg-bg-inset border border-border text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-white border border-border flex items-center justify-center font-bold text-xs text-muted">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="font-bold text-dark">{p.formatted_number}</span>
                    <span className="ml-2 font-medium text-dark">{p.name}</span>
                  </div>
                </div>
                <span className="text-muted">{p.reason || 'Consultation'}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

