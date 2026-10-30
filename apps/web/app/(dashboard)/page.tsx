'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, Badge, Button, ErrorState } from '@baari/ui';
import { Users, Clock, IndianRupee, ArrowRight, UserCheck, AlertTriangle } from 'lucide-react';

interface DashboardData {
  kpis: { id: string; title: string; value: string; subtext: string; tone: string }[];
  providers: {
    id: string;
    name: string;
    code: string;
    room: string;
    specialty: string;
    avgMinutes: number;
    learnedAvg: number | null;
    current: { id: string; number: string; name: string; state: string } | null;
    waitingCount: number;
  }[];
  activity: { id: number; type: string; time: string; description: string }[];
  hourlyChart: { hour: string; count: number }[];
  recoveredRevenue: number;
  leakageRevenue: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = () => {
    setLoading(true);
    setError(null);
    fetch('/engine-api/dashboard')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`API returned ${res.status}`);
        }
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to connect to Baari engine');
        setData(null);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-24 animate-pulse bg-bg-inset border-border" />
          ))}
        </div>
        <Card className="h-64 animate-pulse bg-bg-inset border-border" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Dashboard Backend Unavailable"
        message={error || 'Unable to retrieve live clinic KPIs from the engine.'}
        endpoint="/engine-api/dashboard"
        onRetry={fetchDashboard}
        retrying={loading}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 4 Core KPIs (§13) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.kpis.map((kpi) => (
          <Card key={kpi.id} className="space-y-1">
            <span className="text-xs text-muted font-medium">{kpi.title}</span>
            <div className="text-2xl font-bold tracking-tight text-dark tabular-nums">
              {kpi.value}
            </div>
            <div className="text-[11px] text-muted flex items-center gap-1">
              {kpi.tone === 'success' && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
              {kpi.tone === 'warning' && <span className="w-1.5 h-1.5 rounded-full bg-warning" />}
              {kpi.subtext}
            </div>
          </Card>
        ))}
      </div>

      {/* Provider Queue Summary */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold text-dark tracking-tight">Active Provider Queues</h2>
          <Link href="/desk">
            <Button variant="ghost" size="sm" className="text-xs">
              Open Desk <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.providers.map((p) => (
            <Card key={p.id} className="space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-sm text-dark">{p.name}</h3>
                  <p className="text-[11px] text-muted">{p.room} · {p.specialty}</p>
                </div>
                <Badge variant={p.current ? 'primary' : 'neutral'}>
                  {p.code}
                </Badge>
              </div>

              <div className="p-3 bg-bg-inset rounded-[8px] border border-border flex items-center justify-between text-xs">
                <span className="text-muted">Now Serving</span>
                {p.current ? (
                  <span className="font-bold text-primary font-mono">{p.current.number}</span>
                ) : (
                  <span className="text-muted italic">No active patient</span>
                )}
              </div>

              <div className="flex justify-between items-center text-xs text-muted pt-1">
                <span>Waiting in queue</span>
                <span className="font-semibold text-dark tabular-nums">{p.waitingCount}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Hourly Flow Chart & Leakage Recovery */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-semibold text-dark">Patient Flow by Hour</h3>
              <p className="text-[11px] text-muted">Arrivals and consultations completed today</p>
            </div>
            <Badge variant="neutral">Today</Badge>
          </div>

          <div className="h-44 flex items-end justify-between gap-3 pt-4 px-2 border-b border-border">
            {data.hourlyChart.map((col) => (
              <div key={col.hour} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <div
                  className="w-full bg-primary rounded-t-[4px] transition-all hover:bg-primary/90"
                  style={{ height: `${Math.max(12, col.count * 15)}%` }}
                />
                <span className="text-[10px] text-muted whitespace-nowrap">{col.hour}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Revenue Leakage Card */}
        <Card className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-dark">Revenue Leakage Recovery</h3>
            <p className="text-[11px] text-muted">Automated WhatsApp recall on abandoned enquiries</p>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-[8px] bg-success-light border border-success/20">
              <span className="text-[11px] text-success font-medium">Recovered this month</span>
              <div className="text-xl font-bold text-success tabular-nums">
                ₹{data.recoveredRevenue.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="p-3 rounded-[8px] bg-bg-inset border border-border">
              <span className="text-[11px] text-muted font-medium">Identified leakage</span>
              <div className="text-sm font-semibold text-dark tabular-nums">
                ₹{data.leakageRevenue.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
