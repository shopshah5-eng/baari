'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge } from '@baari/ui';
import { Settings, Clock, Users, Key, Save, CheckCircle2, Download, ShieldCheck } from 'lucide-react';

export default function SettingsPage() {
  const [clinicName, setClinicName] = useState('Clinic Workspace');
  const [hours, setHours] = useState('10:00 AM – 2:00 PM, 5:00 PM – 8:00 PM (Sunday closed)');
  const [displayToken, setDisplayToken] = useState('tv-display-default');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/tenant')
      .then(res => res.ok ? res.json() : null)
      .then(d => {
        if (d && d.tenant) {
          setClinicName(d.tenant.name || 'Clinic Workspace');
          if (d.tenant.hours) setHours(d.tenant.hours);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/engine-api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicName,
          hours,
          displayToken
        })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // Ignore
    } finally {
      setSaving(false);
    }
  };

  const handleRotateToken = () => {
    const timestamp = Date.now().toString(36);
    setDisplayToken(`tv-${timestamp}`);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-dark">Clinic Settings</h1>
        <p className="text-xs text-muted">Manage hours, staff access, and display tokens.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-dark">General Information</h2>
          <div className="space-y-1">
            <label htmlFor="clinicNameInput" className="text-xs font-medium text-dark">Clinic Display Name</label>
            <Input
              id="clinicNameInput"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="e.g. LifeCare Dental & Implant Centre"
              required
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="hoursInput" className="text-xs font-medium text-dark">Operating Hours</label>
            <Input
              id="hoursInput"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. 10:00 AM – 2:00 PM, 5:00 PM – 8:00 PM"
              required
            />
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-dark">Waiting Room TV Display Token</h2>
          <p className="text-xs text-muted">
            Revocable token used by the TV display URL (<code className="text-primary font-mono">/tv/[token]</code>). Keeps public waiting rooms free from URL guessing.
          </p>
          <div className="flex gap-2">
            <Input
              id="displayTokenInput"
              value={displayToken}
              onChange={(e) => setDisplayToken(e.target.value)}
              className="font-mono text-xs"
              required
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleRotateToken}
              className="text-xs shrink-0"
            >
              Rotate Token
            </Button>
          </div>
        </Card>

        {/* Data Privacy & DPDP Compliance (§8 & §17) */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-dark">Data Privacy & DPDP Compliance</h2>
              <p className="text-xs text-muted">
                Section 12 DPDP export: download an encrypted JSON bundle of all patients, appointments, and audit events.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const res = await fetch('/engine-api/dpdp/export');
                  if (res.ok) {
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `baari_dpdp_export_${Date.now()}.json`;
                    a.click();
                    setExportNotice('DPDP export downloaded successfully.');
                    setTimeout(() => setExportNotice(null), 4000);
                  }
                } catch {
                  setExportNotice('Export failed.');
                }
              }}
              className="text-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Export Organization Data
            </Button>
          </div>
          {exportNotice && (
            <p className="text-xs text-success font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {exportNotice}
            </p>
          )}
        </Card>

        <div className="flex justify-end items-center gap-3">
          {saved && (
            <span className="text-xs text-success font-medium flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Changes saved successfully
            </span>
          )}
          <Button type="submit" variant="primary" disabled={saving} className="text-xs">
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}

