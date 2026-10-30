'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge } from '@baari/ui';
import { Download, FileText, TrendingUp, AlertTriangle, ArrowUpRight } from 'lucide-react';

export default function ReportsPage() {
  const [period, setPeriod] = useState<'month' | 'today'>('month');
  const [clinicName, setClinicName] = useState('Clinic Workspace');

  useEffect(() => {
    fetch('/api/tenant')
      .then(res => res.ok ? res.json() : null)
      .then(d => {
        if (d && d.tenant) {
          setClinicName(d.tenant.name || 'Clinic Workspace');
        }
      })
      .catch(() => {});
  }, []);

  const metrics = {
    enquiries: 62,
    bookings: 41,
    completed: 39,
    collectedInr: 58400,
    recoveredInr: 11200,
    leakageInr: 19000,
    unansweredEnquiries: 7,
    avgWaitMin: 19,
    newReviews: 9,
    noShowRate: '4.8%'
  };

  const handleExportCSV = () => {
    const csvContent = [
      ['Metric', 'Value'],
      ['Revenue Collected (INR)', metrics.collectedInr],
      ['Recovered by Baari Follow-ups (INR)', metrics.recoveredInr],
      ['Leakage Lost Opportunity (INR)', metrics.leakageInr],
      ['Total Enquiries', metrics.enquiries],
      ['Confirmed Bookings', metrics.bookings],
      ['Consultations Completed', metrics.completed],
      ['Average Wait Minutes', metrics.avgWaitMin],
      ['No-Show Rate', metrics.noShowRate]
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baari_revenue_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPDF = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-dark">Performance & Revenue Report</h1>
          <p className="text-xs text-muted">
            Auditable front desk revenue: recovered revenue vs lost opportunity leakage.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportCSV} className="text-xs">
            <Download className="w-3.5 h-3.5 mr-1" />
            Export CSV
          </Button>
          <Button variant="primary" size="sm" onClick={handlePrintPDF} className="text-xs">
            <FileText className="w-3.5 h-3.5 mr-1" />
            Download PDF Report
          </Button>
        </div>
      </div>

      {/* Six Distinct Revenue Numbers per §6.5 & §15 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="space-y-1">
          <span className="text-xs text-muted font-medium">Revenue Collected</span>
          <div className="text-2xl font-bold text-dark tabular-nums">
            ₹{metrics.collectedInr.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-success font-medium">From {metrics.completed} completed visits</span>
        </Card>

        <Card className="space-y-1 border-success/30 bg-success-light/30">
          <div className="flex justify-between items-center">
            <span className="text-xs text-success font-semibold">Recovered by Baari</span>
            <ArrowUpRight className="w-4 h-4 text-success" />
          </div>
          <div className="text-2xl font-bold text-success tabular-nums">
            ₹{metrics.recoveredInr.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-muted">Attributed to automated follow-up ladder</span>
        </Card>

        <Card className="space-y-1 border-warning/30 bg-warning-light/30">
          <div className="flex justify-between items-center">
            <span className="text-xs text-warning font-semibold">Leakage (Lost Opportunity)</span>
            <AlertTriangle className="w-4 h-4 text-warning" />
          </div>
          <div className="text-2xl font-bold text-dark tabular-nums">
            ₹{metrics.leakageInr.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-muted">{metrics.unansweredEnquiries} enquiries unaddressed &gt;15 min</span>
        </Card>

        <Card className="space-y-1">
          <span className="text-xs text-muted font-medium">Total Inquiries</span>
          <div className="text-2xl font-bold text-dark tabular-nums">{metrics.enquiries}</div>
          <span className="text-[11px] text-muted">Converted {metrics.bookings} ({Math.round((metrics.bookings / metrics.enquiries) * 100)}%)</span>
        </Card>

        <Card className="space-y-1">
          <span className="text-xs text-muted font-medium">Average Patient Wait</span>
          <div className="text-2xl font-bold text-dark tabular-nums">{metrics.avgWaitMin} min</div>
          <span className="text-[11px] text-muted">Door to doctor cabin</span>
        </Card>

        <Card className="space-y-1">
          <span className="text-xs text-muted font-medium">No-Show Rate</span>
          <div className="text-2xl font-bold text-dark tabular-nums">{metrics.noShowRate}</div>
          <span className="text-[11px] text-muted">Reduced via T-2h reminders</span>
        </Card>
      </div>

      {/* Auto-sent WhatsApp Monthly Digest Preview per §8 and §15 */}
      <Card className="space-y-3 bg-bg-inset border-border">
        <h3 className="text-sm font-semibold text-dark">Automated Monthly Owner Digest</h3>
        <div className="p-4 bg-white rounded-[8px] border border-border font-mono text-xs text-dark/90 leading-relaxed max-w-lg">
          📊 *{clinicName} — Monthly Summary*<br />
          ━━━━━━━━━━━━━━━━━━<br />
          • Enquiries: {metrics.enquiries}<br />
          • Bookings: {metrics.bookings} (66% conversion)<br />
          • Revenue collected: ₹{metrics.collectedInr.toLocaleString('en-IN')}<br />
          • *Recovered by follow-ups: ₹{metrics.recoveredInr.toLocaleString('en-IN')}*<br />
          • ⚠️ Unanswered inquiries: {metrics.unansweredEnquiries} (₹19,000 lost opportunity)<br />
          • New 5★ Google reviews: {metrics.newReviews}<br />
          • Average wait time: {metrics.avgWaitMin} min<br />
          ━━━━━━━━━━━━━━━━━━<br />
          _Baari Front Desk on Autopilot_
        </div>
      </Card>
    </div>
  );
}

