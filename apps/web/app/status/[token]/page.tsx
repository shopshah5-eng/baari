'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, Badge, Button, ErrorState } from '@baari/ui';
import { Clock, Car } from 'lucide-react';

interface TokenStatusData {
  tokenFormatted: string;
  providerName: string;
  roomName: string;
  clinicName: string;
  etaWindow: string;
  aheadCount: number;
  leaveByTime: string;
  travelMinutes: number;
  state: string;
}

export default function TokenStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = React.use(params);
  const token = resolvedParams.token;

  const [data, setData] = useState<TokenStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = () => {
    setLoading(true);
    setError(null);
    fetch(`/engine-api/status/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Token ${token} not found or inactive`);
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Token status unavailable');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-bg-inset flex items-center justify-center p-4" role="main">
        <Card className="max-w-sm w-full h-80 animate-pulse bg-white border-border" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-bg-inset flex items-center justify-center p-4" role="main">
        <div className="max-w-sm w-full space-y-4">
          <ErrorState
            title="Token Status Not Found"
            message={`Token "${token}" ke liye koi active booking nahi mili. Kripya apna booking link check karein.`}
            endpoint={`/engine-api/status/${token}`}
            onRetry={fetchStatus}
          />
          <div className="text-center">
            <Link href="/status">
              <Button variant="ghost" size="sm" className="text-xs" aria-label="Check another token">
                Doosra token check karein
              </Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-inset flex items-center justify-center p-4" role="main">
      <div className="w-full max-w-sm space-y-4">
        {/* Clinic Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-[10px] bg-primary text-white font-bold text-lg" aria-hidden="true">
            ब
          </div>
          <h1 className="text-lg font-bold text-dark">{data.clinicName}</h1>
          <p className="text-xs text-muted">Aapki Baari — Live Token Status</p>
        </div>

        {/* Token Status Card */}
        <Card className="p-6 text-center space-y-5 border-primary/20 bg-white shadow-minimal">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Aapka Token Number</span>
            <div className="text-6xl font-black text-primary tracking-tight font-mono py-2">
              {data.tokenFormatted}
            </div>
            <div className="text-sm font-bold text-dark">{data.providerName}</div>
            <div className="text-xs text-muted">{data.roomName}</div>
          </div>

          <div className="p-3 bg-bg-inset rounded-[8px] border border-border space-y-2 text-xs text-left">
            <div className="flex justify-between items-center">
              <span className="text-muted flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                Anumaanit Samay (ETA)
              </span>
              <strong className="text-dark tabular-nums">~{data.etaWindow}</strong>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted">Aapse pehle log</span>
              <strong className="text-dark tabular-nums">{data.aheadCount} log</strong>
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-border">
              <span className="text-muted flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-primary" />
                Ghar se nikalne ka samay
              </span>
              <strong className="text-primary tabular-nums font-bold">{data.leaveByTime}</strong>
            </div>
          </div>

          <div className="space-y-2 text-center" aria-live="polite">
            <Badge variant={data.state === 'CALLED' ? 'success' : 'neutral'} className="text-xs py-1 px-3">
              {data.state === 'CALLED' ? '🚨 AAPKI BAARI AA GAYI HAI — CABIN MEIN JAYEIN' : 'Queue mein booking confirmed'}
            </Badge>
            <p className="text-[11px] text-muted">
              Yeh page automatic refresh hota hai. Screen khuli rakhein.
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
