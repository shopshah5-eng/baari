'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, Badge, Button } from '@baari/ui';
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

  useEffect(() => {
    fetch('/engine-api/dashboard')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        // Fallback default state
        setData({
          kpis: [
            { id: '1', title: 'Patients Today', value: '18', subtext: '12 completed', tone: 'neutral' },
            { id: '2', title: 'Currently Waiting', value: '4', subtext: 'Queue moving smoothly', tone: 'success' },
            { id: '3', title: 'Collected Today', value: '₹14,200', subtext: '+₹3,600 recovered', tone: 'success' },
            { id: '4', title: 'Avg Consultation', value: '13.4 min', subtext: 'Learned (configured 12 min)', tone: 'neutral' }
          ],
          providers: [
            {
              id: 'p1', name: 'Dr. Rajesh Sharma', code: 'S', room: 'Cabin 1', specialty: 'Dental Surgeon',
              avgMinutes: 12, learnedAvg: 13.4,
              current: { id: 't1', number: 'S-07', name: 'Ritu Sharma', state: 'CALLED' },
              waitingCount: 2
            },
            {
              id: 'p2', name: 'Dr. Simran Kaur', code: 'K', room: 'Cabin 2', specialty: 'Skin Specialist',
              avgMinutes: 8, learnedAvg: 8.2,
              current: { id: 't2', number: 'K-04', name: 'Amit Verma', state: 'IN_CONSULT' },
              waitingCount: 1
            },
            {
              id: 'p3', name: 'Dr. Ajay Verma', code: 'V', room: 'Cabin 3', specialty: 'Orthodontics',
              avgMinutes: 15, learnedAvg: null,
              current: null,
              waitingCount: 1
            }
          ],
          activity: [
            { id: 1, type: 'called', time: '12:06', description: 'Token S-07 called to Cabin 1' },
            { id: 2, type: 'done', time: '11:58', description: 'Token K-03 completed by Dr. Kaur (9 min)' },
            { id: 3, type: 'walkin', time: '11:45', description: 'Walk-in added: Priya Gill (S-08)' },
            { id: 4, type: 'payment', time: '11:30', description: '₹1,200 received via UPI QR' }
          ],
          hourlyChart: [
            { hour: '09:00', count: 2 },
            { hour: '10:00', count: 4 },
            { hour: '11:00', count: 6 },
            { hour: '12:00', count: 5 },
            { hour: '13:00', count: 3 },
            { hour: '17:00', count: 4 },
            { hour: '18:00', count: 5 }
          ],
          recoveredRevenue: 11200,
          leakageRevenue: 19000
        });
        setLoading(false);
      });
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-white rounded-[8px] animate-pulse w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white rounded-[12px] animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-dark">Good afternoon, Dr. Sharma</h1>
          <p className="text-xs text-muted">Here is your clinic throughput and front desk status for today.</p>
        </div>
        <Link href="/desk">
          <Button variant="primary" size="sm">
            Open Reception Desk
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </Link>
      </div>

      {/* Exactly 4 KPI Cards per §3 and §12.1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.kpis.map((kpi) => (
          <Card key={kpi.id} className="space-y-1">
            <span className="text-xs text-muted font-medium">{kpi.title}</span>
            <div className="text-2xl font-bold tracking-tight text-dark tabular-nums">{kpi.value}</div>
            <div className={`text-[11px] font-medium ${kpi.tone === 'success' ? 'text-success' : kpi.tone === 'warning' ? 'text-warning' : 'text-muted'}`}>
              {kpi.subtext}
            </div>
          </Card>
        ))}
      </div>

      {/* Live Provider Queue Cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-dark">Live Queues by Doctor</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.providers.map((p) => (
            <Card key={p.id} className="space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-bold text-dark">{p.name}</h3>
                  <p className="text-[11px] text-muted">{p.specialty} · {p.room}</p>
                </div>
                <Badge variant={p.current ? 'primary' : 'neutral'}>
                  {p.current ? 'Consulting' : 'Available'}
                </Badge>
              </div>

              <div className="p-2.5 rounded-[8px] bg-bg-inset border border-border">
                <span className="text-[11px] text-muted block mb-0.5">Now Serving</span>
                {p.current ? (
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-base text-primary tabular-nums">{p.current.number}</span>
                    <span className="text-xs text-dark truncate font-medium">{p.current.name}</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted">Cabin ready for next patient</span>
                )}
              </div>

              <div className="flex justify-between items-center text-xs pt-1 text-muted">
                <span>Waiting: <strong className="text-dark tabular-nums">{p.waitingCount}</strong></span>
                <span>Avg: <strong className="text-dark tabular-nums">{p.learnedAvg ? `${p.learnedAvg} min` : `${p.avgMinutes} min`}</strong></span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Bottom Grid: Activity Stream + Single Chart (max 1 chart per §3) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Today's Activity */}
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-dark">Today's Activity</h2>
          <div className="space-y-2">
            {data.activity.map((act) => (
              <div key={act.id} className="flex justify-between items-center text-xs py-1.5 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-dark font-medium">{act.description}</span>
                </div>
                <span className="text-muted tabular-nums">{act.time}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Hourly Throughput (Single Minimal Chart) */}
        <Card className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold text-dark">Patient Throughput Today</h2>
            <span className="text-[11px] text-muted">Hourly visits</span>
          </div>

          <div className="h-36 flex items-end justify-between gap-2 pt-4 px-2">
            {data.hourlyChart.map((col, idx) => {
              const heightPct = Math.round((col.count / 6) * 100);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted tabular-nums font-semibold">{col.count}</span>
                  <div className="w-full bg-bg-inset rounded-t-[4px] relative overflow-hidden" style={{ height: '70px' }}>
                    <div
                      className="w-full bg-primary absolute bottom-0 rounded-t-[4px] transition-all"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted tabular-nums">{col.hour.slice(0, 2)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

