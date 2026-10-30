'use client';

import React, { useState } from 'react';
import { Card, Button, Input, Badge } from '@baari/ui';
import { Settings, Clock, Users, Key, Save } from 'lucide-react';

export default function SettingsPage() {
  const [clinicName, setClinicName] = useState('Dr Sharma Dental');
  const [hours, setHours] = useState('10:00 AM – 2:00 PM, 5:00 PM – 8:00 PM (Sunday closed)');
  const [displayToken, setDisplayToken] = useState('tv-sharma-2026-secure');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
            <label className="text-xs font-medium text-dark">Clinic Display Name</label>
            <Input
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-dark">Operating Hours</label>
            <Input
              value={hours}
              onChange={(e) => setHours(e.target.value)}
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
              value={displayToken}
              onChange={(e) => setDisplayToken(e.target.value)}
              className="font-mono"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDisplayToken('tv-' + Math.random().toString(36).substring(2, 12))}
            >
              Rotate Token
            </Button>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          {saved && <span className="text-xs text-success font-medium self-center">Settings saved successfully</span>}
          <Button type="submit" variant="primary">
            <Save className="w-4 h-4 mr-1.5" />
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}

