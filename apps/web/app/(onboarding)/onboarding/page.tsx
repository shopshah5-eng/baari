'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Input, Badge } from '@baari/ui';
import {
  ArrowRight, ArrowLeft, CheckCircle2, Upload, Globe,
  MapPin, Plus, Trash2, Sparkles, Building2, AlertCircle
} from 'lucide-react';
import { OrgMode, getLabels } from '@baari/shared';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<number>(0);
  const [mode, setMode] = useState<OrgMode>('clinic');
  const [businessName, setBusinessName] = useState('Dr Sharma Dental');
  const [area, setArea] = useState('Model Town, Ludhiana');
  const [phone, setPhone] = useState('919810000001');
  const [providers, setProviders] = useState([
    { name: 'Dr. Sharma', specialty: 'Dental Surgeon', avgMinutes: 12 },
    { name: 'Dr. Kaur', specialty: 'Skin & Aesthetics', avgMinutes: 8 }
  ]);
  const [hours, setHours] = useState('10:00 AM – 2:00 PM, 5:00 PM – 8:00 PM (Sunday closed)');
  const [services, setServices] = useState([
    { name: 'Consultation', price: 300, duration: 10 },
    { name: 'Scaling & Polishing', price: 1200, duration: 25 },
    { name: 'Root Canal Treatment (RCT)', price: 4500, duration: 45 }
  ]);

  const [websiteUrl, setWebsiteUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const labels = getLabels(mode);
  const totalSteps = 6;
  const progressPercent = Math.min(100, Math.round(((step + 1) / totalSteps) * 100));

  const handleFinishOnboarding = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/engine-api/onboarding/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          name: businessName,
          area,
          phone,
          hours,
          providers,
          services,
          websiteUrl: websiteUrl || null
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save setup configuration');
      }

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setSubmitError(err.message || 'Setup submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-inset flex flex-col justify-between py-6 px-4">
      {/* Header with Progress Bar */}
      <div className="max-w-xl w-full mx-auto space-y-4">
        <div className="flex justify-between items-center text-xs font-medium text-muted">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-[6px] bg-primary text-white flex items-center justify-center font-bold text-[11px]">
              ब
            </span>
            <span className="text-dark font-semibold">Baari Smart Setup</span>
          </div>
          <span>Step {step + 1} of {totalSteps}</span>
        </div>
        <div className="w-full bg-border h-1.5 rounded-pill overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Guided Question Area */}
      <div className="max-w-xl w-full mx-auto my-auto py-8">
        {submitError && (
          <div className="mb-4 p-3 bg-danger-light border border-danger/20 rounded-[8px] flex items-center gap-2 text-xs text-danger">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Step 0: Mode Selection */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-bold text-dark">What kind of business are you setting up?</h1>
              <p className="text-sm text-muted">This configures all labels, queues, and workflows automatically.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { id: 'clinic', icon: '🦷', title: 'Clinic / OPD', sub: 'Doctors, Cabins & Tokens' },
                { id: 'lab', icon: '🧪', title: 'Diagnostic Lab', sub: 'Tests & Phlebotomy' },
                { id: 'salon', icon: '✂️', title: 'Salon & Beauty', sub: 'Stylists & Chairs' },
                { id: 'spa', icon: '🌿', title: 'Spa & Wellness', sub: 'Therapists & Sessions' },
                { id: 'other', icon: '🏢', title: 'Other Business', sub: 'Custom Queue' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setMode(item.id as OrgMode)}
                  className={`p-4 rounded-[12px] border text-left transition-all space-y-1.5 ${
                    mode === item.id
                      ? 'border-primary bg-primary-light ring-2 ring-primary ring-offset-1'
                      : 'border-border bg-white hover:border-muted'
                  }`}
                >
                  <div className="text-2xl">{item.icon}</div>
                  <div className="font-semibold text-sm text-dark">{item.title}</div>
                  <div className="text-[11px] text-muted">{item.sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Business Identity */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold text-dark">What is your {labels.modeName.toLowerCase()} name?</h2>
              <p className="text-sm text-muted">This will appear on patient WhatsApp messages and TV screens.</p>
            </div>

            <Card className="space-y-4 p-6 bg-white shadow-minimal">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-dark">Business / Clinic Name</label>
                <Input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Dr Sharma Dental Clinic"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-dark">Locality / Area & City</label>
                <Input
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Model Town, Ludhiana"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-dark">WhatsApp Contact Phone</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 919810000001"
                  required
                />
              </div>
            </Card>
          </div>
        )}

        {/* Step 2: Providers */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold text-dark">Who attends to {labels.customers.toLowerCase()}?</h2>
              <p className="text-sm text-muted">Tokens are assigned per {labels.provider.toLowerCase()} with isolated queues.</p>
            </div>

            <Card className="space-y-4 p-6 bg-white shadow-minimal">
              <div className="space-y-3">
                {providers.map((p, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      value={p.name}
                      onChange={(e) => {
                        const next = [...providers];
                        next[idx].name = e.target.value;
                        setProviders(next);
                      }}
                      placeholder="Doctor Name"
                      className="flex-1"
                    />
                    <Input
                      value={p.specialty}
                      onChange={(e) => {
                        const next = [...providers];
                        next[idx].specialty = e.target.value;
                        setProviders(next);
                      }}
                      placeholder="Specialty"
                      className="w-36"
                    />
                    {providers.length > 1 && (
                      <button
                        onClick={() => setProviders(providers.filter((_, i) => i !== idx))}
                        className="text-muted hover:text-danger p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setProviders([...providers, { name: '', specialty: '', avgMinutes: 10 }])}
                className="w-full text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Another {labels.provider}
              </Button>
            </Card>
          </div>
        )}

        {/* Step 3: Hours */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold text-dark">What are your operating hours?</h2>
              <p className="text-sm text-muted">The WhatsApp bot uses these hours to accept bookings and answer questions.</p>
            </div>

            <Card className="space-y-4 p-6 bg-white shadow-minimal">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-dark">Working Hours</label>
                <Input
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="e.g. 10:00 AM – 2:00 PM, 5:00 PM – 8:00 PM (Sunday closed)"
                />
              </div>
            </Card>
          </div>
        )}

        {/* Step 4: Top Services */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold text-dark">Top Services & Standard Fees</h2>
              <p className="text-sm text-muted">Grounded knowledge: the bot will never fabricate a price not on this list.</p>
            </div>

            <Card className="space-y-4 p-6 bg-white shadow-minimal">
              <div className="space-y-3">
                {services.map((s, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      value={s.name}
                      onChange={(e) => {
                        const next = [...services];
                        next[idx].name = e.target.value;
                        setServices(next);
                      }}
                      placeholder="Service name"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={s.price}
                      onChange={(e) => {
                        const next = [...services];
                        next[idx].price = Number(e.target.value);
                        setServices(next);
                      }}
                      placeholder="Price (₹)"
                      className="w-24"
                    />
                    {services.length > 1 && (
                      <button
                        onClick={() => setServices(services.filter((_, i) => i !== idx))}
                        className="text-muted hover:text-danger p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setServices([...services, { name: '', price: 500, duration: 15 }])}
                className="w-full text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Another Service
              </Button>
            </Card>
          </div>
        )}

        {/* Step 5: Final Review & Confirmation */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold text-dark">Confirmation Card — Check Details</h2>
              <p className="text-sm text-muted">Review everything before launching your live queue.</p>
            </div>

            <Card className="space-y-4 p-6 bg-white shadow-minimal border-primary/20">
              <div className="border-b border-border pb-3">
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Business</span>
                <div className="text-lg font-bold text-dark">{businessName}</div>
                <div className="text-xs text-muted">{area} · WhatsApp: {phone}</div>
              </div>

              <div className="border-b border-border pb-3">
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                  Providers ({providers.length})
                </span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {providers.map((p, i) => (
                    <Badge key={i} variant="primary">
                      {p.name} ({p.specialty || 'General'})
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="border-b border-border pb-3">
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                  Services & Grounded Pricing
                </span>
                <div className="divide-y divide-border mt-1">
                  {services.map((s, i) => (
                    <div key={i} className="py-1.5 flex justify-between text-xs">
                      <span className="text-dark font-medium">{s.name}</span>
                      <span className="font-bold text-dark tabular-nums font-mono">₹{s.price}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  className="w-full py-3 text-sm font-bold shadow-md"
                  onClick={handleFinishOnboarding}
                  disabled={submitting}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {submitting ? 'Creating Clinic & Activating...' : 'Sahi Hai — Launch Live Dashboard'}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="max-w-xl w-full mx-auto flex justify-between items-center pt-4 border-t border-border">
        {step > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep(step - 1)}
            disabled={submitting}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        ) : (
          <div />
        )}

        {step < totalSteps - 1 && (
          <Button
            variant="primary"
            size="md"
            onClick={() => setStep(step + 1)}
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
