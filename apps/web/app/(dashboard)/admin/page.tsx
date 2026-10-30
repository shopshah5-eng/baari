'use client';

import React, { useState } from 'react';
import { Card, Button, Badge } from '@baari/ui';
import { ShieldCheck, AlertCircle, Building2, MessageSquare, DollarSign } from 'lucide-react';

export default function AdminPage() {
  const [tenants, setTenants] = useState([
    { id: '1', slug: 'dr-sharma', name: 'Dr Sharma Dental', mode: 'clinic', plan: 'Growth', status: 'active', waStatus: 'connected', mrr: 1999 },
    { id: '2', slug: 'nova-lab', name: 'Nova Pathology Labs', mode: 'lab', plan: 'Pro', status: 'active', waStatus: 'connected', mrr: 3999 },
    { id: '3', slug: 'glam', name: 'Glam Hair & Beauty', mode: 'salon', plan: 'Starter', status: 'active', waStatus: 'pending', mrr: 999 }
  ]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-dark">Platform Operator Console</h1>
          <p className="text-xs text-muted">
            Platform-admin view. Monitor tenants, MRR, WhatsApp connection states, and error audit logs.
          </p>
        </div>

        <Badge variant="primary">ADMIN_KEY Verified</Badge>
      </div>

      {/* Operator KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="space-y-1">
          <span className="text-xs text-muted font-medium">Total Active Tenants</span>
          <div className="text-2xl font-bold text-dark tabular-nums">{tenants.length}</div>
          <span className="text-[11px] text-success">0% Churn this month</span>
        </Card>

        <Card className="space-y-1">
          <span className="text-xs text-muted font-medium">Monthly Recurring Revenue</span>
          <div className="text-2xl font-bold text-dark tabular-nums">₹6,997</div>
          <span className="text-[11px] text-muted">Excluding activation fees</span>
        </Card>

        <Card className="space-y-1">
          <span className="text-xs text-muted font-medium">Meta WhatsApp Connections</span>
          <div className="text-2xl font-bold text-success tabular-nums">2 / 3</div>
          <span className="text-[11px] text-muted">1 pending WABA approval</span>
        </Card>

        <Card className="space-y-1">
          <span className="text-xs text-muted font-medium">Integration Errors</span>
          <div className="text-2xl font-bold text-dark tabular-nums">0</div>
          <span className="text-[11px] text-success font-medium">All webhooks passing</span>
        </Card>
      </div>

      {/* Tenants Table */}
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-bg-inset border-b border-border text-muted font-semibold">
            <tr>
              <th className="py-3 px-4">Business Name</th>
              <th className="py-3 px-4">Mode</th>
              <th className="py-3 px-4">Subscription Plan</th>
              <th className="py-3 px-4">WhatsApp State</th>
              <th className="py-3 px-4">Monthly MRR</th>
              <th className="py-3 px-4 text-right">Operator Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tenants.map((t) => (
              <tr key={t.id} className="hover:bg-bg-inset/50 transition-colors">
                <td className="py-3 px-4 font-semibold text-dark">
                  {t.name}
                  <div className="text-[11px] text-muted font-mono">{t.slug}</div>
                </td>
                <td className="py-3 px-4 capitalize">{t.mode}</td>
                <td className="py-3 px-4 font-medium">{t.plan}</td>
                <td className="py-3 px-4">
                  <Badge variant={t.waStatus === 'connected' ? 'success' : 'warning'}>
                    {t.waStatus}
                  </Badge>
                </td>
                <td className="py-3 px-4 font-semibold tabular-nums">₹{t.mrr}</td>
                <td className="py-3 px-4 text-right">
                  <Button size="sm" variant="ghost">Manage</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

