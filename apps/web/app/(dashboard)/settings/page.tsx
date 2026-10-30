'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge } from '@baari/ui';
import { Settings, Clock, Users, Key, Save, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const [clinicName, setClinicName] = useState('Clinic Workspace');
  const [hours, setHours] = useState('10:00 AM – 2:00 PM, 5:00 PM – 8:00 PM (Sunday closed)');
  const [displayToken, setDisplayToken] = useState('tv-display-default');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

