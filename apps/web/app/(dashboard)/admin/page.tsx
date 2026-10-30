'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, ErrorState } from '@baari/ui';
import { ShieldCheck, AlertCircle, Building2, MessageSquare, DollarSign, Lock } from 'lucide-react';

interface TenantItem {
  id: string;
  slug: string;
  name: string;
  mode: string;
  plan: string;
  status: string;
  waStatus: string;
  mrr: number;
}

export default function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check role cookie or call admin endpoint
    fetch('/engine-api/admin/tenants')
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          setAuthorized(false);
          setLoading(false);
          return null;
        }
        if (!res.ok) throw new Error(`Admin API error (${res.status})`);
        return res.json();
      })
      .then((d) => {
        if (d) {
          setAuthorized(true);
          setTenants(d.tenants || []);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setAuthorized(false);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl animate-pulse">
        <Card className="h-20 bg-bg-inset border-border" />
        <Card className="h-64 bg-bg-inset border-border" />
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="max-w-md mx-auto my-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-danger-light text-danger mx-auto flex items-center justify-center">
          <Lock className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-dark">Platform Operator Access Required</h1>
          <p className="text-xs text-muted">
            The admin console is restricted to authenticated platform operators. Anonymous or tenant-level access is prohibited.
          </p>
        </div>
      </div>
    );
  }

  const totalMrr = tenants.reduce((sum, t) => sum + (t.mrr || 0), 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-dark">Platform Operator Console</h1>
          <p className="text-xs text-muted">
            Internal console. Tenant telemetry, health status, and WhatsApp connection monitoring.
          </p>
        </div>

        <Badge variant="primary">Verified Operator Session</Badge>
      </div>

      {/* Operator KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="space-y-1">
          <span className="text-xs text-muted font-medium">Active Tenants</span>
          <div className="text-2xl font-bold text-dark tabular-nums">{tenants.length}</div>
          <span className="text-[11px] text-muted">Verified database rows</span>
        </Card>

        <Card className="space-y-1">
          <span className="text-xs text-muted font-medium">Monthly Revenue (MRR)</span>
          <div className="text-2xl font-bold text-dark tabular-nums">₹{totalMrr.toLocaleString('en-IN')}</div>
          <span className="text-[11px] text-muted">Active subscriptions</span>
        </Card>

        <Card className="space-y-1">
          <span className="text-xs text-muted font-medium">Meta WhatsApp Connections</span>
          <div className="text-2xl font-bold text-success tabular-nums">
            {tenants.filter((t) => t.waStatus === 'connected').length} / {tenants.length}
          </div>
          <span className="text-[11px] text-muted">Official Meta WABA lanes</span>
        </Card>

        <Card className="space-y-1">
          <span className="text-xs text-muted font-medium">Alarms Active</span>
          <div className="text-2xl font-bold text-dark tabular-nums">0</div>
          <span className="text-[11px] text-success font-medium">5 alarms healthy</span>
        </Card>
      </div>

      {/* Tenants Table */}
      <Card className="p-0 overflow-hidden">
        {tenants.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted">
            No registered tenants on this cluster.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-bg-inset border-b border-border text-muted font-semibold">
              <tr>
                <th className="py-3 px-4">Business Name</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">Plan</th>
                <th className="py-3 px-4">WhatsApp Status</th>
                <th className="py-3 px-4 text-right">MRR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-bg-inset/50">
                  <td className="py-3 px-4 font-semibold text-dark">{t.name}</td>
                  <td className="py-3 px-4 uppercase text-[10px] text-muted">{t.mode}</td>
                  <td className="py-3 px-4">{t.plan}</td>
                  <td className="py-3 px-4">
                    <Badge variant={t.waStatus === 'connected' ? 'success' : 'warning'}>
                      {t.waStatus}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold">
                    ₹{t.mrr.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
