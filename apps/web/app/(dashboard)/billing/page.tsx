'use client';

import React, { useState } from 'react';
import { Card, Button, Badge } from '@baari/ui';
import { Check, QrCode, FileText, ArrowRight, ShieldCheck } from 'lucide-react';

export default function BillingPage() {
  const [period, setPeriod] = useState<'monthly' | 'annual'>('annual');
  const [selectedPlan, setSelectedPlan] = useState('growth');
  const [showQR, setShowQR] = useState(false);

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: period === 'annual' ? 9999 : 999,
      periodLabel: period === 'annual' ? '/year' : '/month',
      activationFee: period === 'annual' ? 'Waived' : '₹2,999',
      features: ['1 Provider / Doctor', 'Unlimited OPD Tokens', 'Live Waiting TV Display', 'Direct UPI QR']
    },
    {
      id: 'growth',
      name: 'Growth',
      popular: true,
      price: period === 'annual' ? 19999 : 1999,
      periodLabel: period === 'annual' ? '/year' : '/month',
      activationFee: period === 'annual' ? 'Waived' : '₹4,999',
      features: [
        'Up to 3 Providers / Doctors',
        'Learned EWMA Timing Engine',
        'Official Meta WhatsApp Lane',
        'Lead CRM & Revenue Recovery',
        'Automated GST Invoicing'
      ]
    },
    {
      id: 'pro',
      name: 'Pro',
      price: period === 'annual' ? 39999 : 3999,
      periodLabel: period === 'annual' ? '/year' : '/month',
      activationFee: period === 'annual' ? 'Waived' : '₹9,999',
      features: [
        'Up to 8 Providers / Cabins',
        'Diagnostic Lab Vision Module',
        'Home Collection Dispatch',
        'Custom SMS / Voice Failover',
        'Priority Phone Support'
      ]
    },
    {
      id: 'hospital',
      name: 'Hospital',
      price: period === 'annual' ? 89999 : 8999,
      periodLabel: period === 'annual' ? '/year' : '/month',
      activationFee: period === 'annual' ? 'Waived' : '₹19,999',
      features: [
        'Unlimited Providers & Cabins',
        'Multi-Branch Consolidated TV',
        'Dedicated Technical Manager',
        'Custom HIS / EMR API Connector',
        '99.95% SLA'
      ]
    }
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-dark">Subscription & Billing</h1>
        <p className="text-xs text-muted">
          Transparent pricing. Direct UPI intent + QR with 0% MDR fee.
        </p>
      </div>

      {/* Period Toggle */}
      <div className="flex justify-center">
        <div className="bg-bg-inset border border-border p-1 rounded-pill flex items-center gap-1 text-xs font-semibold">
          <button
            onClick={() => setPeriod('monthly')}
            className={`px-4 py-1.5 rounded-pill transition-colors ${period === 'monthly' ? 'bg-white shadow-minimal text-dark' : 'text-muted'}`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setPeriod('annual')}
            className={`px-4 py-1.5 rounded-pill flex items-center gap-1.5 transition-colors ${period === 'annual' ? 'bg-primary text-white shadow-minimal' : 'text-muted'}`}
          >
            <span>Annual (2 Months Free)</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full">Save ₹5,000+</span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          return (
            <Card
              key={plan.id}
              className={`p-5 flex flex-col justify-between relative transition-all ${
                isSelected ? 'border-primary ring-2 ring-primary bg-white' : 'border-border bg-white'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-2.5 right-4 bg-primary text-white text-[10px] font-bold px-2.5 py-0.5 rounded-pill shadow-minimal">
                  MOST POPULAR
                </span>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-sm text-dark">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-dark tabular-nums">₹{plan.price.toLocaleString('en-IN')}</span>
                    <span className="text-xs text-muted">{plan.periodLabel}</span>
                  </div>
                  <div className="text-[11px] text-muted mt-1">
                    Activation: <strong className="text-dark">{plan.activationFee}</strong>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border text-xs">
                  {plan.features.map((feat, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span className="text-dark/80">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                variant={isSelected ? 'primary' : 'secondary'}
                size="sm"
                className="w-full mt-6"
                onClick={() => {
                  setSelectedPlan(plan.id);
                  setShowQR(true);
                }}
              >
                {isSelected ? 'Current Active Plan' : 'Select Plan'}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Direct UPI Zero-MDR Payment Modal / Card */}
      {showQR && (
        <Card className="max-w-md mx-auto p-6 text-center space-y-4 border-primary/30">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-dark">Pay via Zero-MDR Direct UPI</h3>
            <p className="text-xs text-muted">Scan with Google Pay, PhonePe, Paytm, or BHIM</p>
          </div>

          <div className="w-48 h-48 bg-bg-inset border-2 border-primary/20 rounded-[12px] p-2 mx-auto flex items-center justify-center">
            <div className="w-full h-full bg-white border border-border rounded-[8px] flex flex-col items-center justify-center p-2">
              <QrCode className="w-28 h-28 text-dark" />
              <span className="text-[10px] text-muted font-mono mt-1">baari@okaxis</span>
            </div>
          </div>

          <div className="text-xs space-y-1">
            <div className="font-semibold text-dark">Amount: ₹19,999 (Inclusive of 18% GST)</div>
            <div className="text-[11px] text-muted">SAC Code: 998314 · Automatic GST Invoice Generated</div>
          </div>

          <div className="flex justify-center gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowQR(false)}>Close</Button>
            <Button variant="success" size="sm" onClick={() => { alert('Payment verified by server webhook. GST invoice generated.'); setShowQR(false); }}>
              I have paid
            </Button>
          </div>
        </Card>
      )}

      {/* GST Invoices Section per §14 */}
      <Card className="space-y-3">
        <h3 className="text-sm font-semibold text-dark">GST Invoices & History</h3>
        <div className="space-y-2">
          {[
            { id: 'INV-2026-0042', date: '01 Oct 2026', plan: 'Growth Annual (₹19,999)', status: 'PAID' },
            { id: 'INV-2025-0019', date: '01 Oct 2025', plan: 'Growth Annual (₹19,999)', status: 'PAID' }
          ].map((inv) => (
            <div key={inv.id} className="flex justify-between items-center p-3 rounded-[8px] bg-bg-inset border border-border text-xs">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-primary" />
                <div>
                  <div className="font-semibold text-dark">{inv.id}</div>
                  <div className="text-muted">{inv.plan} · {inv.date}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="success">{inv.status}</Badge>
                <Button size="sm" variant="secondary">Download PDF</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

