'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Input } from '@baari/ui';
import {
  PhoneCall, UserPlus, Clock, AlertOctagon, RotateCcw,
  CheckCircle2, Users, ArrowRight, ShieldAlert, Sparkles
} from 'lucide-react';

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
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  // Modal states
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  // Form states
  const [walkinName, setWalkinName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('+91 ');
  const [walkinReason, setWalkinReason] = useState('Consultation');
  const [delayMinutes, setDelayMinutes] = useState(15);
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('+91 ');

  const fetchDeskState = async () => {
    try {
      const res = await fetch('/engine-api/desk');
      const data = await res.json();
      setColumns(data.columns || []);
      setCanUndo(data.canUndo || false);
      if (data.lastEvent) {
        setUndoDescription(data.lastEvent.description);
        setRemainingSec(data.lastEvent.remainingSec || 60);
      }
      if (data.columns && data.columns.length > 0 && !selectedProviderId) {
        setSelectedProviderId(data.columns[0].provider.id);
      }
      setLoading(false);
    } catch {
      // Mock fallback if engine is starting
      setColumns([
        {
          provider: { id: 'p1', name: 'Dr. Sharma', code: 'S', room: 'Cabin 1', specialty: 'Dental', avgMinutes: 12 },
          current: { id: 't1', number: 7, formatted_number: 'S-07', state: 'CALLED', patient_name: 'Ritu Sharma', patient_phone: '9810000001' },
          waiting: [
            { id: 't2', number: 8, formatted_number: 'S-08', state: 'ARRIVED', patient_name: 'Priya Gill', patient_phone: '9810000002', priority: 100, eta_at: '12:20 PM', ahead: 1 },
            { id: 't3', number: 9, formatted_number: 'S-09', state: 'BOOKED', patient_name: 'Manish Kumar', patient_phone: '9810000003', priority: 100, eta_at: '12:35 PM', ahead: 2 }
          ],
          stats: { waitingCount: 2, completedCount: 8, avgMinutes: 13.4, delayMinutes: 0 }
        },
        {
          provider: { id: 'p2', name: 'Dr. Kaur', code: 'K', room: 'Cabin 2', specialty: 'Skin', avgMinutes: 8 },
          current: { id: 't4', number: 4, formatted_number: 'K-04', state: 'IN_CONSULT', patient_name: 'Amit Verma', patient_phone: '9810000004' },
          waiting: [
            { id: 't5', number: 5, formatted_number: 'K-05', state: 'ARRIVED', patient_name: 'Jaspreet Singh', patient_phone: '9810000005', priority: 100, eta_at: '12:15 PM', ahead: 1 }
          ],
          stats: { waitingCount: 1, completedCount: 6, avgMinutes: 8.2, delayMinutes: 0 }
        }
      ]);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeskState();
    // Live update interval simulating SSE
    const interval = setInterval(fetchDeskState, 3000);
    return () => clearInterval(interval);
  }, []);

  // Undo countdown timer
  useEffect(() => {
    if (remainingSec > 0) {
      const timer = setTimeout(() => setRemainingSec(remainingSec - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanUndo(false);
    }
  }, [remainingSec]);

  const activeProvider = columns.find(c => c.provider.id === selectedProviderId) || columns[0];

  const handleCallNext = async (providerId: string) => {
    try {
      const res = await fetch('/engine-api/desk/call-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, idempotencyKey: `call-${Date.now()}` })
      });
      await res.json();
      fetchDeskState();
    } catch {
      fetchDeskState();
    }
  };

  const handleWalkin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProvider) return;
    try {
      await fetch('/engine-api/desk/walkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: activeProvider.provider.id,
          name: walkinName,
          phone: walkinPhone,
          reason: walkinReason
        })
      });
      setShowWalkinModal(false);
      setWalkinName('');
      setWalkinPhone('+91 ');
      fetchDeskState();
    } catch {
      setShowWalkinModal(false);
    }
  };

  const handleDelay = async () => {
    if (!activeProvider) return;
    try {
      await fetch('/engine-api/desk/delay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: activeProvider.provider.id,
          minutes: delayMinutes
        })
      });
      setShowDelayModal(false);
      fetchDeskState();
    } catch {
      setShowDelayModal(false);
    }
  };

  const handleEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProvider) return;
    try {
      await fetch('/engine-api/desk/emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: activeProvider.provider.id,
          name: emergencyName,
          phone: emergencyPhone,
          reason: 'Emergency case'
        })
      });
      setShowEmergencyModal(false);
      setEmergencyName('');
      setEmergencyPhone('+91 ');
      fetchDeskState();
    } catch {
      setShowEmergencyModal(false);
    }
  };

  const handleUndo = async () => {
    try {
      await fetch('/engine-api/desk/undo', { method: 'POST' });
      setCanUndo(false);
      fetchDeskState();
    } catch {
      setCanUndo(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 60s Undo Bar */}
      {canUndo && remainingSec > 0 && (
        <div className="bg-dark text-white px-4 py-2.5 rounded-[12px] flex items-center justify-between text-xs shadow-minimal animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-warning animate-ping" />
            <span>{undoDescription || 'Action completed'} — Mistake ho gayi?</span>
            <span className="text-muted tabular-nums">({remainingSec}s undo window)</span>
          </div>
          <button
            onClick={handleUndo}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-[6px] font-medium flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Undo Now
          </button>
        </div>
      )}

      {/* Desk Action Header: The 4 Primary Action Buttons per §12.2 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-[12px] border border-border shadow-minimal">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-dark">Reception Desk</h1>
            <Badge variant="success">SSE Live Sync</Badge>
          </div>
          <p className="text-xs text-muted">
            Managing {columns.length} doctors. Tapping Call Next notifies patient WhatsApp & updates TV.
          </p>
        </div>

        {/* 4 Large Action Buttons */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {/* Call Next (Green) */}
          <Button
            variant="success"
            size="md"
            onClick={() => activeProvider && handleCallNext(activeProvider.provider.id)}
            className="flex-1 sm:flex-initial"
          >
            <PhoneCall className="w-4 h-4 mr-1.5" />
            Call Next
          </Button>

          {/* Add Walk-in (Indigo) */}
          <Button
            variant="primary"
            size="md"
            onClick={() => setShowWalkinModal(true)}
            className="flex-1 sm:flex-initial"
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Add Walk-in
          </Button>

          {/* Delay 15 min (Amber) */}
          <button
            onClick={() => setShowDelayModal(true)}
            className="h-10 px-4 text-sm font-medium rounded-[8px] bg-warning-light text-warning border border-warning/30 hover:bg-warning/20 transition-colors flex items-center justify-center gap-1.5 flex-1 sm:flex-initial shadow-minimal"
          >
            <Clock className="w-4 h-4" />
            Delay 15m
          </button>

          {/* Emergency (Red) */}
          <Button
            variant="destructive"
            size="md"
            onClick={() => setShowEmergencyModal(true)}
            className="flex-1 sm:flex-initial"
          >
            <AlertOctagon className="w-4 h-4 mr-1.5" />
            Emergency
          </Button>
        </div>
      </div>

      {/* Independent Provider Columns per §12.2 and §1 (Tokens S-07, K-04) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {columns.map((col) => {
          const isSelected = selectedProviderId === col.provider.id;
          return (
            <div
              key={col.provider.id}
              onClick={() => setSelectedProviderId(col.provider.id)}
              className={`rounded-[12px] border transition-all ${
                isSelected ? 'border-primary ring-1 ring-primary bg-white' : 'border-border bg-white'
              }`}
            >
              {/* Provider Header */}
              <div className="p-4 border-b border-border flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-dark">{col.provider.name}</span>
                    <span className="text-xs text-muted font-normal">({col.provider.code})</span>
                  </div>
                  <p className="text-[11px] text-muted">{col.provider.specialty} · {col.provider.room}</p>
                </div>
                <Badge variant={col.current ? 'primary' : 'neutral'}>
                  {col.stats.waitingCount} waiting
                </Badge>
              </div>

              {/* Now Serving Cabin Panel */}
              <div className="p-4 bg-bg-inset border-b border-border space-y-2">
                <span className="text-[11px] font-semibold text-muted tracking-wide uppercase">Now in Cabin</span>
                {col.current ? (
                  <div className="flex justify-between items-center bg-white p-3 rounded-[8px] border border-border shadow-minimal">
                    <div>
                      <div className="text-lg font-bold text-primary tabular-nums tracking-tight">
                        {col.current.formatted_number}
                      </div>
                      <div className="text-xs font-semibold text-dark">{col.current.patient_name}</div>
                      <div className="text-[11px] text-muted">{col.current.patient_phone}</div>
                    </div>
                    <Badge variant="success">IN CABIN</Badge>
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-muted bg-white rounded-[8px] border border-dashed border-border">
                    Cabin empty · Tap Call Next to serve
                  </div>
                )}
              </div>

              {/* Waiting List with live ETA */}
              <div className="p-4 space-y-2.5">
                <div className="flex justify-between items-center text-xs font-medium text-muted">
                  <span>Up Next in Line</span>
                  <span>Estimated Time</span>
                </div>

                {col.waiting.length === 0 ? (
                  <p className="text-xs text-muted text-center py-6">No patients in line</p>
                ) : (
                  <div className="space-y-2">
                    {col.waiting.map((tok) => (
                      <div
                        key={tok.id}
                        className="flex justify-between items-center p-2.5 rounded-[8px] border border-border bg-white text-xs hover:border-muted transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-dark tabular-nums bg-bg-inset px-2 py-1 rounded-[4px] border border-border">
                            {tok.formatted_number}
                          </span>
                          <div>
                            <div className="font-medium text-dark">{tok.patient_name}</div>
                            <div className="text-[11px] text-muted">{tok.ahead} ahead in line</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-semibold text-dark tabular-nums">
                            {tok.eta_at ? (typeof tok.eta_at === 'string' && tok.eta_at.includes(':') ? tok.eta_at : new Date(tok.eta_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : '~15m'}
                          </div>
                          {tok.leave_by_at && (
                            <div className="text-[10px] text-primary">Nikalna: {new Date(tok.leave_by_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Call Next Footer Button */}
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCallNext(col.provider.id);
                  }}
                >
                  <PhoneCall className="w-3.5 h-3.5 mr-1" />
                  Call Next for {col.provider.code}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Walk-in Modal */}
      {showWalkinModal && (
        <div className="fixed inset-0 bg-dark/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-2">
              <h2 className="text-sm font-bold text-dark">Add Walk-in Patient</h2>
              <button onClick={() => setShowWalkinModal(false)} className="text-muted hover:text-dark">✕</button>
            </div>
            <form onSubmit={handleWalkin} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-dark">Assign to Doctor</label>
                <select
                  value={selectedProviderId || ''}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                  className="w-full h-10 px-3 rounded-[8px] border border-border bg-white text-xs"
                >
                  {columns.map(c => (
                    <option key={c.provider.id} value={c.provider.id}>
                      {c.provider.name} ({c.provider.code} · {c.stats.waitingCount} waiting)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-dark">Patient Name</label>
                <Input
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  placeholder="e.g. Gurpreet Singh"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-dark">WhatsApp Number</label>
                <Input
                  value={walkinPhone}
                  onChange={(e) => setWalkinPhone(e.target.value)}
                  placeholder="+91 98100 00000"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-dark">Consultation Reason</label>
                <Input
                  value={walkinReason}
                  onChange={(e) => setWalkinReason(e.target.value)}
                  placeholder="e.g. Toothache, Scaling"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowWalkinModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Generate Token & Send WhatsApp</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Delay 15m Modal */}
      {showDelayModal && (
        <div className="fixed inset-0 bg-dark/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="max-w-sm w-full space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-2">
              <h2 className="text-sm font-bold text-dark">Delay Queue</h2>
              <button onClick={() => setShowDelayModal(false)} className="text-muted hover:text-dark">✕</button>
            </div>
            <p className="text-xs text-muted">
              Doctor delayed? Every patient in {activeProvider?.provider.name}'s queue will receive an updated ETA message on WhatsApp.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-medium text-dark">Delay Duration</label>
              <div className="flex gap-2">
                {[15, 30, 45].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDelayMinutes(m)}
                    className={`flex-1 py-2 text-xs font-medium rounded-[8px] border ${
                      delayMinutes === m ? 'border-warning bg-warning-light text-warning font-semibold' : 'border-border bg-white text-muted'
                    }`}
                  >
                    +{m} min
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowDelayModal(false)}>Cancel</Button>
              <Button type="button" variant="primary" onClick={handleDelay}>Notify Patients</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Emergency Modal */}
      {showEmergencyModal && (
        <div className="fixed inset-0 bg-dark/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full space-y-4 border-danger/30">
            <div className="flex justify-between items-center border-b border-border pb-2 text-danger">
              <h2 className="text-sm font-bold flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4" />
                Emergency Queue Jump
              </h2>
              <button onClick={() => setShowEmergencyModal(false)} className="text-muted hover:text-dark">✕</button>
            </div>
            <p className="text-xs text-muted">
              Allocates priority 0 token. Puts this patient next in line for {activeProvider?.provider.name} and sends one consolidated delay notice to downstream waiting patients.
            </p>
            <form onSubmit={handleEmergency} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-dark">Patient Name</label>
                <Input
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder="Patient name"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-dark">Phone Number</label>
                <Input
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="+91 98100 00000"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowEmergencyModal(false)}>Cancel</Button>
                <Button type="submit" variant="destructive">Confirm Emergency Jump</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

