'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Badge } from '@baari/ui';
import { CheckCircle2, Clock, Users, Sparkles, ChevronRight, UserX, PauseCircle, FastForward, PhoneCall } from 'lucide-react';
import { ErrorState } from '../components/ErrorState';

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
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchCabin = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch('/engine-api/cabin', { signal: abortControllerRef.current.signal });
      if (!res.ok) {
        throw new Error(`Cabin API returned ${res.status}`);
      }
      const d = await res.json();
      setData(d);
      setElapsed(d.elapsedSeconds || 0);
      setError(null);
      setLoading(false);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Failed to load doctor cabin queue');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCabin();
    const interval = setInterval(fetchCabin, 5000);
    return () => {
      clearInterval(interval);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchCabin]);

  // Elapsed visual timer (for display only; learning is calculated strictly server-side from called_at)
  useEffect(() => {
    if (!data?.current) return;
    const timer = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [data?.current]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAction = async (action: 'done' | 'noshow' | 'skip') => {
    if (!data?.current) return;
    setActionLoading(true);
    try {
      await fetch(`/engine-api/cabin/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId: data.current.id })
      });
      await fetchCabin();
    } catch {
      await fetchCabin();
    } finally {
      setActionLoading(false);
    }
  };

  const handleCallNext = async () => {
    setActionLoading(true);
    try {
      await fetch('/engine-api/desk/call-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: data?.provider?.id || 'p1',
          idempotencyKey: `cabin-call-${Date.now()}`
        })
      });
      await fetchCabin();
    } catch {
      await fetchCabin();
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
        <div className="h-16 bg-bg-inset rounded-[12px]" />
        <Card className="h-64 bg-bg-inset border-border" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <ErrorState
        title="Doctor Cabin Offline"
        message={error}
        endpoint="/engine-api/cabin"
        onRetry={fetchCabin}
      />
    );
  }

  const cur = data?.current;
  const p = data?.provider;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Provider Header with Learning Metrics per §9.2 */}
      {p && (
        <div className="flex justify-between items-center bg-white p-4 rounded-[12px] border border-border shadow-minimal">
          <div>
            <h1 className="font-bold text-sm text-dark">{p.name}</h1>
            <p className="text-xs text-muted">{p.room} · {p.specialty}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary-light rounded-[8px] text-right">
              <span className="text-[10px] text-primary font-semibold block flex items-center gap-1 justify-end">
                <Sparkles className="w-3 h-3" /> Baari is Learning
              </span>
              <span className="text-xs font-bold text-primary font-mono">
                {p.learnedMinutes ? `${p.learnedMinutes} min` : `${p.avgMinutes} min`}
              </span>
              <span className="text-[9px] text-muted block">({p.samples || 0} samples)</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Active Patient Card */}
      <Card className="p-6 text-center space-y-6 border-primary/20 bg-white shadow-minimal">
        {cur ? (
          <>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                Currently in Consultation
              </span>
              <div className="text-6xl font-black text-primary tracking-tight font-mono py-2">
                {cur.formatted_number}
              </div>
              <h2 className="text-lg font-bold text-dark">{cur.name}</h2>
              <div className="text-xs text-muted font-mono">{cur.phone}</div>
            </div>

            {/* In-Consult Elapsed Timer */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bg-inset border border-border text-xs font-mono font-bold text-dark">
              <Clock className="w-4 h-4 text-primary animate-pulse" />
              <span>Elapsed: {formatTimer(elapsed)}</span>
            </div>

            {/* Action Bar: Done, No-show, Skip */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction('noshow')}
                disabled={actionLoading}
                className="text-xs text-muted hover:text-danger"
              >
                <UserX className="w-3.5 h-3.5 mr-1" />
                No-Show
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction('skip')}
                disabled={actionLoading}
                className="text-xs text-muted hover:text-warning"
              >
                <FastForward className="w-3.5 h-3.5 mr-1" />
                Hold / Skip
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => handleAction('done')}
                disabled={actionLoading}
                className="text-xs font-bold"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                {actionLoading ? 'Saving...' : 'Mark Done'}
              </Button>
            </div>
          </>
        ) : (
          <div className="py-12 space-y-4">
            <div className="w-12 h-12 rounded-full bg-bg-inset border border-border flex items-center justify-center mx-auto text-muted">
              <Users className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-dark">Cabin is currently open</h2>
              <p className="text-xs text-muted">Ready to receive the next waiting patient.</p>
            </div>
            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleCallNext}
                disabled={actionLoading}
                className="text-xs font-bold px-6 shadow-minimal"
              >
                <PhoneCall className={`w-3.5 h-3.5 mr-1.5 ${actionLoading ? 'animate-bounce' : ''}`} />
                {actionLoading ? 'Calling...' : 'Call Next Patient'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Up Next Preview */}
      {data?.nextPatients && data.nextPatients.length > 0 && (
        <Card className="space-y-3">
          <span className="text-xs font-semibold text-dark">Next in Line for this Cabin</span>
          <div className="divide-y divide-border">
            {data.nextPatients.slice(0, 3).map((item, idx) => (
              <div key={item.id} className="py-2.5 flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted font-mono">{idx + 1}.</span>
                  <span className="font-bold text-dark font-mono">{item.formatted_number}</span>
                  <span className="text-muted">{item.name}</span>
                </div>
                {item.reason && <Badge variant="neutral">{item.reason}</Badge>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
