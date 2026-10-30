'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, ErrorState } from '@baari/ui';
import { Check, QrCode, FileText, ArrowRight, ShieldCheck, Download, AlertCircle } from 'lucide-react';
import { PLANS, formatInr, PlanConfig } from '@baari/shared';

export default function BillingPage() {
  const [period, setPeriod] = useState<'monthly' | 'annual'>('annual');
  const [selectedPlan, setSelectedPlan] = useState<string>('growth');
  const [showQR, setShowQR] = useState(false);
  const [billingData, setBillingData] = useState<{
    currentPlan: string;
    invoices: { id: string; date: string; amount: number; status: string; ref: string }[];
  }>({
    currentPlan: 'pilot',
    invoices: []
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/engine-api/billing')
      .then(res => res.ok ? res.json() : null)
      .then(d => {
        if (d) setBillingData(d);
      })
      .catch(() => {});
  }, []);

  const planList = [PLANS.starter, PLANS.growth, PLANS.pro, PLANS.hospital];
  const activePlanConfig = PLANS[selectedPlan] || PLANS.growth;

  const handlePayUPI = () => {
    setShowQR(true);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-dark">Billing & Subscription Plans</h1>
        <p className="text-xs text-muted">
          Transparent pricing. Direct zero-MDR UPI QR or Razorpay. Automated GST invoicing.
        </p>
      </div>

      {/* Current Active Plan Status */}
      <Card className="bg-bg-inset border-border p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Current Active Plan</span>
            <Badge variant="primary">
              {(PLANS[billingData.currentPlan]?.name || 'Pilot')} Plan
            </Badge>
          </div>
          <p className="text-xs text-muted mt-1">
            Valid until current billing cycle. Automated token renewal active.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePayUPI}
            className="text-xs bg-white"
          >
            <QrCode className="w-3.5 h-3.5 mr-1.5" />
            Pay via UPI QR
          </Button>
        </div>
      </Card>

      {/* Billing Frequency Toggle */}
      <div className="flex justify-center">
        <div className="bg-white p-1 rounded-full border border-border inline-flex items-center">
          <button
            onClick={() => setPeriod('monthly')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              period === 'monthly' ? 'bg-primary text-white font-semibold' : 'text-muted hover:text-dark'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setPeriod('annual')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
              period === 'annual' ? 'bg-primary text-white font-semibold' : 'text-muted hover:text-dark'
            }`}
          >
            <span>Annual</span>
            <span className="px-1.5 py-0.5 rounded-full bg-success-light text-success text-[10px] font-bold">
              Activation Waived
            </span>
          </button>
        </div>
      </div>

      {/* Plan Cards Grid (Canonical Pricing from @baari/shared §16) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {planList.map((plan) => {
          const isCurrent = plan.id === selectedPlan;
          const price = period === 'annual' ? plan.annual : plan.monthly;
          const activation = period === 'annual' ? 'Waived' : `₹${formatInr(plan.activation)}`;

          return (
            <Card
              key={plan.id}
              className={`flex flex-col justify-between space-y-4 relative ${
                plan.popular ? 'border-primary shadow-minimal ring-1 ring-primary' : 'border-border'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-2.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold uppercase tracking-wider">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="space-y-3 pt-1">
                <div>
                  <h3 className="font-bold text-sm text-dark">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-dark">₹{formatInr(price)}</span>
                    <span className="text-xs text-muted font-medium">{period === 'annual' ? '/yr' : '/mo'}</span>
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">
                    Activation: <span className="font-semibold text-dark">{activation}</span>
                  </div>
                </div>

                <div className="border-t border-border pt-3 space-y-2">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-muted">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                variant={plan.popular ? 'primary' : 'outline'}
                size="sm"
                className="w-full text-xs font-semibold"
                onClick={() => {
                  setSelectedPlan(plan.id);
                  setShowQR(true);
                }}
              >
                Select {plan.name}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* UPI QR Modal */}
      {showQR && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <Card className="max-w-sm w-full space-y-4 bg-white p-6 shadow-xl text-center">
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-dark">Instant UPI Payment (Zero MDR)</h3>
              <p className="text-xs text-muted">
                Scan with GPay, PhonePe, or Paytm for {activePlanConfig.name} Plan
              </p>
            </div>

            <div className="p-4 bg-bg-inset rounded-[12px] border border-border inline-block mx-auto">
              <div className="w-44 h-44 bg-white border border-border rounded-[8px] flex items-center justify-center p-2 mx-auto">
                {/* Real UPI QR Deep Link Encoding */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                    `upi://pay?pa=baari@okaxis&pn=Baari&am=${period === 'annual' ? activePlanConfig.annual : activePlanConfig.monthly}&cu=INR`
                  )}`}
                  alt="UPI QR Code"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="text-xs font-mono font-bold text-dark mt-2">
                Amount: ₹{formatInr(period === 'annual' ? activePlanConfig.annual : activePlanConfig.monthly)}
              </div>
            </div>

            <div className="text-[11px] text-muted">
              UPI VPA: <span className="font-mono font-semibold text-dark">baari@okaxis</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQR(false)}
              className="w-full text-xs"
            >
              Close
            </Button>
          </Card>
        </div>
      )}

      {/* Invoices History Table */}
      <Card className="space-y-3">
        <h3 className="text-xs font-semibold text-dark">GST Invoices & Receipts</h3>
        {billingData.invoices.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted">
            No past invoices on record for this account.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {billingData.invoices.map((inv) => (
              <div key={inv.id} className="py-2.5 flex justify-between items-center text-xs">
                <div>
                  <div className="font-semibold text-dark font-mono">{inv.id}</div>
                  <div className="text-[11px] text-muted">{inv.date} · {inv.ref}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-dark tabular-nums">₹{formatInr(inv.amount)}</span>
                  <Badge variant={inv.status === 'paid' ? 'success' : 'neutral'}>{inv.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
