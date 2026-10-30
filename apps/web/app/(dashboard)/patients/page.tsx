'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Input, ErrorState } from '@baari/ui';
import { Users, Download, Trash2, Search, ShieldCheck, AlertCircle } from 'lucide-react';

interface PatientItem {
  id: string;
  name: string;
  phone: string;
  visits: number;
  lastVisit: string;
  consentWa: boolean;
}

export default function PatientsPage() {
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchPatients = () => {
    setLoading(true);
    setError(null);
    fetch('/engine-api/patients')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Patients API returned ${res.status}`);
        return res.json();
      })
      .then((d) => {
        setPatients(d.patients || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load patient records');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.phone.includes(search)
  );

  const handleExportDPDP = async () => {
    try {
      const res = await fetch('/engine-api/dpdp/export');
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `baari_dpdp_export_${Date.now()}.json`;
        a.click();
        setActionNotice('DPDP export downloaded successfully.');
      } else {
        setActionNotice('No patient data to export.');
      }
    } catch {
      setActionNotice('Export service unavailable.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`DPDP Hard Delete: Permanently wipe all records for ${name}? This action is irreversible.`)) {
      try {
        await fetch(`/engine-api/dpdp/delete?patientId=${id}`, { method: 'DELETE' });
        setPatients(patients.filter((p) => p.id !== id));
        setActionNotice(`Patient ${name} records permanently wiped.`);
      } catch {
        setActionNotice('Delete operation failed.');
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl animate-pulse">
        <div className="h-10 bg-bg-inset rounded-[8px]" />
        <Card className="h-64 bg-bg-inset border-border" />
      </div>
    );
  }

  if (error && patients.length === 0) {
    return (
      <ErrorState
        title="Patients Database Offline"
        message={error}
        endpoint="/engine-api/patients"
        onRetry={fetchPatients}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-dark">Patients Directory</h1>
          <p className="text-xs text-muted">
            Per-tenant records. Compliant with Digital Personal Data Protection (DPDP) Act.
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={handleExportDPDP} className="text-xs">
          <Download className="w-3.5 h-3.5 mr-1" />
          One-Click DPDP Export
        </Button>
      </div>

      {actionNotice && (
        <div className="p-3 bg-bg-inset border border-border rounded-[8px] text-xs text-dark flex justify-between items-center">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-xs font-semibold underline">Dismiss</button>
        </div>
      )}

      {/* DPDP Compliance Guarantee */}
      <Card className="bg-bg-inset border-border p-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-success shrink-0" />
          <span className="font-medium text-dark">
            Data Privacy Guarantee: Patient records are strictly isolated under database Row-Level Security (RLS) and never shared.
          </span>
        </div>
      </Card>

      {/* Search Input */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone number..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Patients Table */}
      <Card className="p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-xs text-muted">
            {search ? 'No patients matching your search query.' : 'No registered patients in the database yet.'}
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-bg-inset border-b border-border text-muted font-semibold">
              <tr>
                <th className="py-3 px-4">Patient Name</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Total Visits</th>
                <th className="py-3 px-4">Last Visit</th>
                <th className="py-3 px-4">WhatsApp Consent</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-bg-inset/50 transition-colors">
                  <td className="py-3 px-4 font-semibold text-dark">{p.name}</td>
                  <td className="py-3 px-4 font-mono text-muted">{p.phone}</td>
                  <td className="py-3 px-4 tabular-nums">{p.visits}</td>
                  <td className="py-3 px-4 text-muted">{p.lastVisit}</td>
                  <td className="py-3 px-4">
                    <Badge variant={p.consentWa ? 'success' : 'neutral'}>
                      {p.consentWa ? 'Opted In' : 'None'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(p.id, p.name)}
                      className="text-xs text-danger hover:bg-danger-light"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      DPDP Wipe
                    </Button>
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
