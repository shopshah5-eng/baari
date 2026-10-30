'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, Badge } from '@baari/ui';
import { getLabels, OrgMode } from '@baari/shared';
import {
  CheckCircle2, ArrowRight, ArrowLeft, Upload, Globe,
  FileText, Sparkles, AlertCircle, Building2, Clock, Users, DollarSign
} from 'lucide-react';

interface ExtractedData {
  name: string;
  area: string;
  providers: { name: string; specialty: string; avgMinutes: number }[];
  hours: string;
  services: { name: string; price: number; duration: number }[];
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<number>(0);
  const [mode, setMode] = useState<OrgMode>('clinic');
  const [businessName, setBusinessName] = useState('Dr Sharma Dental');
  const [area, setArea] = useState('Model Town, Ludhiana');
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

  // Import method states
  const [importTab, setImportTab] = useState<'upload' | 'website' | 'gbp' | 'manual'>('upload');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [fileImportStatus, setFileImportStatus] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const labels = getLabels(mode);
  const totalSteps = 6;
  const progressPercent = Math.min(100, Math.round(((step + 1) / totalSteps) * 100));

  const handleSimulatedFileUpload = (filename: string) => {
    setFileImportStatus(`Reading ${filename}... extracting ${labels.providers.toLowerCase()} and ${labels.money.toLowerCase()}...`);
    setTimeout(() => {
      setFileImportStatus(`✅ Extracted 2 ${labels.providers.toLowerCase()} and 3 services from ${filename} with 95% confidence.`);
    }, 1000);
  };

  const handleFinishOnboarding = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-bg-inset flex flex-col justify-between py-6 px-4">
      {/* Header with Progress Bar */}
      <div className="max-w-xl w-full mx-auto space-y-4">
        <div className="flex justify-between items-center text-xs font-medium text-muted">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-[6px] bg-primary text-white flex items-center justify-center font-bold text-[11px]">ब</span>
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
        {step === 0 && (
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold text-dark">What kind of business are you setting up?</h2>
              <p className="text-sm text-muted">This configures all labels and workflows automatically.</p>
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
                  className={`p-4 rounded-[12px] border text-left transition-all space-y-1.5 ${mode === item.id ? 'border-primary bg-primary-light ring-2 ring-primary ring-offset-1' : 'border-border bg-white hover:border-muted'}`}
                >
                  <div className="text-2xl">{item.icon}</div>
                  <div className="font-semibold text-sm text-dark">{item.title}</div>
                  <div className="text-[11px] text-muted">{item.sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-dark">Business basics</h2>
              <p className="text-sm text-muted">How patients will recognise your practice.</p>
            </div>

            <Card className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-dark">{labels.modeName} Name</label>
                <Input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Dr Sharma Dental"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-dark">Area & City</label>
                <Input
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Model Town, Ludhiana"
                />
              </div>
            </Card>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-dark">{labels.providers} and operating hours</h2>
              <p className="text-sm text-muted">Each {labels.provider.toLowerCase()} gets their own independent queue and learned timing.</p>
            </div>

            <Card className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-dark">{labels.providers}</label>
                {providers.map((p, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      value={p.name}
                      onChange={(e) => {
                        const next = [...providers];
                        next[idx].name = e.target.value;
                        setProviders(next);
                      }}
                      className="flex-1"
                    />
                    <Input
                      value={p.specialty}
                      onChange={(e) => {
                        const next = [...providers];
                        next[idx].specialty = e.target.value;
                        setProviders(next);
                      }}
                      className="flex-1"
                    />
                    <div className="w-24 flex items-center gap-1 text-xs text-muted">
                      <Input
                        type="number"
                        value={p.avgMinutes}
                        onChange={(e) => {
                          const next = [...providers];
                          next[idx].avgMinutes = Number(e.target.value);
                          setProviders(next);
                        }}
                      />
                      <span>min</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1 pt-2 border-t border-border">
                <label className="text-xs font-medium text-dark">Weekly Timings</label>
                <Input
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="10:00 AM – 2:00 PM, 5:00 PM – 8:00 PM"
                />
              </div>
            </Card>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-dark">Services & pricing</h2>
              <p className="text-sm text-muted">Service duration feeds directly into queue travel and wait estimates.</p>
            </div>

            <Card className="space-y-3">
              {services.map((s, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    value={s.name}
                    onChange={(e) => {
                      const next = [...services];
                      next[idx].name = e.target.value;
                      setServices(next);
                    }}
                    className="flex-1"
                  />
                  <div className="w-28 flex items-center gap-1 text-xs">
                    <span>₹</span>
                    <Input
                      type="number"
                      value={s.price}
                      onChange={(e) => {
                        const next = [...services];
                        next[idx].price = Number(e.target.value);
                        setServices(next);
                      }}
                    />
                  </div>
                  <div className="w-24 flex items-center gap-1 text-xs text-muted">
                    <Input
                      type="number"
                      value={s.duration}
                      onChange={(e) => {
                        const next = [...services];
                        next[idx].duration = Number(e.target.value);
                        setServices(next);
                      }}
                    />
                    <span>min</span>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-dark">Teach Baari about your business</h2>
              <p className="text-sm text-muted">Import your price lists, documents, or website to enrich the WhatsApp assistant.</p>
            </div>

            <Card className="space-y-4">
              <div className="flex border-b border-border pb-3 text-xs font-medium">
                <button
                  onClick={() => setImportTab('upload')}
                  className={`flex-1 py-1 text-center rounded-[6px] ${importTab === 'upload' ? 'bg-primary-light text-primary font-semibold' : 'text-muted'}`}
                >
                  PDF / Excel / Image
                </button>
                <button
                  onClick={() => setImportTab('website')}
                  className={`flex-1 py-1 text-center rounded-[6px] ${importTab === 'website' ? 'bg-primary-light text-primary font-semibold' : 'text-muted'}`}
                >
                  Website
                </button>
                <button
                  onClick={() => setImportTab('gbp')}
                  className={`flex-1 py-1 text-center rounded-[6px] ${importTab === 'gbp' ? 'bg-primary-light text-primary font-semibold' : 'text-muted'}`}
                >
                  Google Profile
                </button>
              </div>

              {importTab === 'upload' && (
                <div className="border-2 border-dashed border-border rounded-[12px] p-6 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-primary-light text-primary flex items-center justify-center mx-auto">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-dark">Upload PDF price list, rate card or photo</p>
                    <p className="text-[11px] text-muted">Supports PDF, Excel, Word, or photo of clinic board</p>
                  </div>
                  <div className="flex justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSimulatedFileUpload('Dental_Price_List_2026.pdf')}
                    >
                      Choose PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSimulatedFileUpload('Clinic_Board_Photo.jpg')}
                    >
                      Upload Board Photo
                    </Button>
                  </div>
                  {fileImportStatus && (
                    <p className="text-xs text-primary font-medium mt-2">{fileImportStatus}</p>
                  )}
                </div>
              )}

              {importTab === 'website' && (
                <div className="space-y-3">
                  <label className="text-xs font-medium text-dark">Clinic Website URL</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://drsharmadental.com"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                    />
                    <Button size="sm" variant="secondary" onClick={() => setFileImportStatus('Crawling website... extracted hours and 4 services.')}>
                      Crawl
                    </Button>
                  </div>
                  {fileImportStatus && <p className="text-xs text-primary font-medium">{fileImportStatus}</p>}
                </div>
              )}

              {importTab === 'gbp' && (
                <div className="p-4 bg-bg-inset rounded-[8px] space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-warning font-medium">
                    <AlertCircle className="w-4 h-4" />
                    <span>Awaiting Google API verification approval</span>
                  </div>
                  <p className="text-muted">
                    Google Business Profile sync is built behind a feature flag. Until verified by Google, you can import via PDF, website, or enter timings manually above.
                  </p>
                </div>
              )}
            </Card>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold text-dark">Everything is ready!</h2>
              <p className="text-sm text-muted">Review what Baari understood before going live.</p>
            </div>

            {/* Editable Confirmation Card per §6.2 */}
            <Card className="bg-bg-inset border-primary/30 p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-border pb-3">
                <span className="text-sm font-semibold text-dark flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Yeh maine samjha —
                </span>
                <Badge variant="success">Ready for live</Badge>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-dark font-medium">
                  <span>🦷</span>
                  <span>{businessName}, {area}</span>
                </div>
                <div className="flex items-center gap-2 text-dark">
                  <span>👨‍⚕️</span>
                  <span>
                    {providers.map(p => `${p.name} (${p.specialty}, ${p.avgMinutes} min)`).join(' · ')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted">
                  <span>🕘</span>
                  <span>{hours}</span>
                </div>
                <div className="flex items-center gap-2 text-dark">
                  <span>💰</span>
                  <span>
                    {services.map(s => `${s.name} ₹${s.price}`).join(' · ')}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-border">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleFinishOnboarding}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Sahi hai — Go Live
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setStep(1)}
                >
                  ✏️ Badalna hai
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

