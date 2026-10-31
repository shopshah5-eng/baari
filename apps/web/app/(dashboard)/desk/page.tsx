'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Badge, Input } from '@baari/ui';
import {
  PhoneCall, UserPlus, Clock, AlertOctagon, RotateCcw,
  CheckCircle2, Users, ArrowRight, ShieldAlert, Sparkles, AlertCircle
} from 'lucide-react';
import { ErrorState } from '../components/ErrorState';

interface WaitingToken {
  id: string;
  number: number;
  formatted_number: string;
  state: string;
  patient_name: string;
  patient_phone: string;
  priority: number;
  reason?: string;
  eta_at?: string;
  ahead?: number;
  leave_by_at?: string;
}

interface ProviderColumn {
  provider: {
    id: string;
    name: string;
    code: string;
    room: string;
    specialty: string;
    avgMinutes: number;
    delayUntil?: string | null;
  };
  current: {
    id: string;
    number: number;
    formatted_number: string;
    state: string;
    patient_name: string;
    patient_phone: string;
    called_at?: string;
  } | null;
  waiting: WaitingToken[];
  stats: {
    waitingCount: number;
    completedCount: number;
    avgMinutes: number;
    delayMinutes: number;
  };
}

export default function DeskPage() {
  const [columns, setColumns] = useState<ProviderColumn[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [undoDescription, setUndoDescription] = useState<string | null>(null);
  const [undoExpiresAt, setUndoExpiresAt] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [callingProviderId, setCallingProviderId] = useState<string | null>(null);

  // Modals
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [walkinName, setWalkinName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('+91 ');
  const [walkinReason, setWalkinReason] = useState('Consultation');
  const [walkinProviderId, setWalkinProviderId] = useState<string>('');

  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('+91 ');
  const [emergencyProviderId, setEmergencyProviderId] = useState<string>('');

  // Stable intent idempotency counter per provider
  const callCounterRef = useRef<Record<string, number>>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchDeskState = useCallback(async () => {
    // Avoid running if tab is backgrounded
    if (typeof document !== 'undefined' && document.hidden) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch('/engine-api/desk', {
        signal: abortControllerRef.current.signal
      });
      if (!res.ok) {
        throw new Error(`Desk API returned status ${res.status}`);
      }
      const data = await res.json();
      setColumns(data.columns || []);
      if (data.canUndo && data.lastEvent) {
        setCanUndo(true);
        setUndoDescription(data.lastEvent.description);
        setUndoExpiresAt(Date.now() + (data.lastEvent.remainingSec || 60) * 1000);
      }
      if (data.columns && data.columns.length > 0 && !selectedProviderId) {
        setSelectedProviderId(data.columns[0].provider.id);
      }
      setError(null);
      setLoading(false);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Failed to sync desk queue');
      setLoading(false);
    }
  }, [selectedProviderId]);

  useEffect(() => {
    fetchDeskState();
    const interval = setInterval(fetchDeskState, 3000);
    return () => {
      clearInterval(interval);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchDeskState]);

  // Robust 60s Undo Timer based on absolute expiration
  useEffect(() => {
    if (!undoExpiresAt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((undoExpiresAt - Date.now()) / 1000));
      setRemainingSec(remaining);
      if (remaining <= 0) {
        setCanUndo(false);
        setUndoExpiresAt(null);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [undoExpiresAt]);

  const activeProvider = columns.find((c) => c.provider.id === selectedProviderId) || columns[0];

  const handleCallNext = async (providerId: string) => {
    setActionError(null);
    setCallingProviderId(providerId);

    // Derive deterministic idempotency key from provider, top token, and incrementing intent
    callCounterRef.current[providerId] = (callCounterRef.current[providerId] || 0) + 1;
    const provCol = columns.find((c) => c.provider.id === providerId);
    const topTokenId = provCol?.waiting[0]?.id || 'next';
    const idempotencyKey = `call-${providerId}-${topTokenId}-${callCounterRef.current[providerId]}`;

    try {
      const res = await fetch('/engine-api/desk/call-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, idempotencyKey })
      });
      if (!res.ok) {
        throw new Error(`Call Next failed (${res.status})`);
      }
      const result = await res.json();
      setCanUndo(true);
      setUndoDescription(`Called ${result.token?.formatted_number || 'Next'}`);
      setUndoExpiresAt(Date.now() + 60000);
      await fetchDeskState();
    } catch (err: any) {
      setActionError(err.message || 'Call Next failed. Please try again.');
    } finally {
      setCallingProviderId(null);
    }
  };

  const handleUndo = async () => {
    try {
      await fetch('/engine-api/desk/undo', { method: 'POST' });
      setCanUndo(false);
      setUndoExpiresAt(null);
      await fetchDeskState();
    } catch (err: any) {
      setActionError(err.message || 'Undo action failed.');
    }
  };

  const handleDelay = async (providerId: string, minutes: number = 15) => {
    try {
      await fetch('/engine-api/desk/delay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, minutes })
      });
      await fetchDeskState();
    } catch (err: any) {
      setActionError(err.message || 'Failed to register queue delay');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto animate-pulse">
        <div className="h-10 bg-bg-inset rounded-[8px]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-96 bg-bg-inset border-border" />
          ))}
        </div>
      </div>
    );
  }

  if (error && columns.length === 0) {
    return (
      <ErrorState
        title="Reception Desk Offline"
        message={error}
        endpoint="/engine-api/desk"
        onRetry={fetchDeskState}
      />
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Top Desk Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-dark">Reception Desk</h1>
            <Badge variant="neutral">Auto-refresh 3s</Badge>
          </div>
          <p className="text-xs text-muted">
            Per-provider isolated queues. Receptionist operates with single-tap Call Next.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canUndo && remainingSec > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              className="text-xs border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Undo ({remainingSec}s)
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEmergencyModal(true)}
            className="text-xs border-danger/40 text-danger hover:bg-danger-light"
          >
            <AlertOctagon className="w-3.5 h-3.5 mr-1 text-danger" />
            + Emergency
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowWalkinModal(true)}
            className="text-xs"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
            + Walk-in Patient
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-danger-light border border-danger/20 rounded-[8px] flex items-center justify-between text-xs text-danger">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="underline font-semibold ml-2">Dismiss</button>
        </div>
      )}

      {/* Provider Columns (Per-Provider Isolated Queues §1) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {columns.map((col) => {
          const p = col.provider;
          const cur = col.current;
          const isCalling = callingProviderId === p.id;

          return (
            <div
              key={p.id}
              className="bg-white rounded-[12px] border border-border shadow-minimal flex flex-col justify-between overflow-hidden"
            >
              {/* Column Header */}
              <div className="p-4 border-b border-border space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-sm text-dark">{p.name}</h3>
                    <p className="text-[11px] text-muted">{p.room} · {p.specialty}</p>
                  </div>
                  <Badge variant="primary" className="text-xs font-mono font-bold">
                    {p.code}
                  </Badge>
                </div>

                {/* Call Next Button (§1.1 Single Primary Action) */}
                <Button
                  variant="primary"
                  className="w-full py-2.5 text-xs font-bold"
                  onClick={() => handleCallNext(p.id)}
                  disabled={isCalling || col.waiting.length === 0}
                >
                  <PhoneCall className={`w-3.5 h-3.5 mr-1.5 ${isCalling ? 'animate-bounce' : ''}`} />
                  {isCalling ? 'Calling...' : col.waiting.length > 0 ? `Call Next (${col.waiting[0].formatted_number})` : 'Queue Empty'}
                </Button>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  {col.stats.delayMinutes > 0 ? (
                    <Badge variant="warning" className="text-[10px]">
                      +{col.stats.delayMinutes}m delay active
                    </Badge>
                  ) : (
                    <span className="text-muted">On schedule</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelay(p.id, 15)}
                    className="text-muted hover:text-warning flex items-center gap-1 transition-colors font-medium"
                    title="Add 15 min delay"
                  >
                    <Clock className="w-3 h-3" />
                    +15m Delay
                  </button>
                </div>
              </div>

              {/* Active / In-Consult Patient */}
              <div className="p-4 bg-bg-inset border-b border-border" aria-live="polite" aria-atomic="true">
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                  Currently in Cabin
                </span>
                {cur ? (
                  <div className="mt-1 flex items-center justify-between">
                    <div>
                      <div className="text-xl font-black text-primary font-mono">{cur.formatted_number}</div>
                      <div className="text-xs font-medium text-dark">{cur.patient_name}</div>
                    </div>
                    <Badge variant={cur.state === 'IN_CONSULT' ? 'success' : 'warning'}>
                      {cur.state}
                    </Badge>
                  </div>
                ) : (
                  <div className="text-xs text-muted italic mt-1 py-1">Doctor is ready for next patient</div>
                )}
              </div>

              {/* Waiting Tokens List */}
              <div className="p-4 space-y-2 flex-1 min-h-[140px]">
                <div className="flex justify-between items-center text-[11px] text-muted">
                  <span>Waiting Patients ({col.waiting.length})</span>
                  <span>Avg {p.avgMinutes}m</span>
                </div>

                {col.waiting.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted">
                    No waiting tokens for Dr. {p.code}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {col.waiting.map((token, idx) => (
                      <div
                        key={token.id}
                        className="p-2 rounded-[8px] border border-border bg-white flex justify-between items-center text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-[10px] text-muted font-mono">{idx + 1}.</span>
                          <span className="font-bold text-dark font-mono">{token.formatted_number}</span>
                          <span className="text-muted truncate max-w-[90px]">{token.patient_name}</span>
                        </div>
                        <span className="text-[10px] text-muted font-mono">{token.state}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Walk-in Modal */}
      {showWalkinModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full space-y-4 bg-white p-6 shadow-xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-bold text-sm text-dark">Add Walk-in Patient</h3>
              <button onClick={() => setShowWalkinModal(false)} className="text-muted hover:text-dark text-xs">✕</button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const targetProvId = walkinProviderId || activeProvider?.provider.id || 'p1';
                try {
                  await fetch('/engine-api/desk/walkin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      providerId: targetProvId,
                      name: walkinName,
                      phone: walkinPhone,
                      reason: walkinReason
                    })
                  });
                  setShowWalkinModal(false);
                  setWalkinName('');
                  fetchDeskState();
                } catch (err: any) {
                  setActionError(err.message || 'Failed to issue walk-in token');
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-medium text-dark">Patient Name</label>
                <Input
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-dark">WhatsApp Phone (10 digits)</label>
                <Input
                  value={walkinPhone}
                  onChange={(e) => setWalkinPhone(e.target.value)}
                  placeholder="919810000000"
                  required
                />
              </div>

              {columns.length > 1 && (
                <div>
                  <label className="text-xs font-medium text-dark">Assign to Doctor</label>
                  <select
                    value={walkinProviderId || activeProvider?.provider.id}
                    onChange={(e) => setWalkinProviderId(e.target.value)}
                    className="w-full text-xs p-2 border border-border rounded-[8px] bg-white text-dark mt-1 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {columns.map((c) => (
                      <option key={c.provider.id} value={c.provider.id}>
                        {c.provider.name} ({c.provider.room})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowWalkinModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  Issue Token
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Emergency Modal */}
      {showEmergencyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full space-y-4 bg-white p-6 shadow-xl border-danger/30">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-danger" />
                <h3 className="font-bold text-sm text-dark">Issue Emergency Token</h3>
              </div>
              <button onClick={() => setShowEmergencyModal(false)} className="text-muted hover:text-dark text-xs">✕</button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const targetProvId = emergencyProviderId || activeProvider?.provider.id || 'p1';
                try {
                  await fetch('/engine-api/desk/emergency', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      providerId: targetProvId,
                      name: emergencyName,
                      phone: emergencyPhone
                    })
                  });
                  setShowEmergencyModal(false);
                  setEmergencyName('');
                  fetchDeskState();
                } catch (err: any) {
                  setActionError(err.message || 'Failed to issue emergency token');
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-medium text-dark">Patient Name</label>
                <Input
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder="e.g. Critical Patient"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-dark">Contact Phone</label>
                <Input
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="919810000000"
                  required
                />
              </div>

              {columns.length > 1 && (
                <div>
                  <label className="text-xs font-medium text-dark">Assign to Doctor</label>
                  <select
                    value={emergencyProviderId || activeProvider?.provider.id}
                    onChange={(e) => setEmergencyProviderId(e.target.value)}
                    className="w-full text-xs p-2 border border-border rounded-[8px] bg-white text-dark mt-1 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {columns.map((c) => (
                      <option key={c.provider.id} value={c.provider.id}>
                        {c.provider.name} ({c.provider.room})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <p className="text-[11px] text-danger bg-danger-light p-2.5 rounded-[6px] border border-danger/20">
                🚨 Emergency tokens jump ahead of standard queue patients with highest priority.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowEmergencyModal(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" size="sm" type="submit">
                  Issue Emergency Token
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
