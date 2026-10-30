'use client';

import React, { useState } from 'react';
import { Card, Button, Badge, Input } from '@baari/ui';
import { Users, Download, Trash2, Search, ShieldCheck } from 'lucide-react';

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
  const [patients, setPatients] = useState<PatientItem[]>([
    { id: '1', name: 'Ritu Sharma', phone: '+91 98100 00001', visits: 4, lastVisit: 'Today', consentWa: true },
    { id: '2', name: 'Priya Gill', phone: '+91 98100 00002', visits: 2, lastVisit: 'Today', consentWa: true },
    { id: '3', name: 'Manish Kumar', phone: '+91 98100 00003', visits: 1, lastVisit: 'Today', consentWa: true },
    { id: '4', name: 'Amit Verma', phone: '+91 98100 00004', visits: 7, lastVisit: '2 days ago', consentWa: true },
    { id: '5', name: 'Jaspreet Singh', phone: '+91 98100 00005', visits: 3, lastVisit: 'Last week', consentWa: true }
  ]);

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.phone.includes(search)
  );

  const handleExportDPDP = () => {
    alert('DPDP Compliant export generated. Download ZIP containing patient CSV and consent logs.');
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`DPDP Hard Delete: Permanently delete all health and visit records for ${name}? This action is irreversible.`)) {
      setPatients(patients.filter(p => p.id !== id));
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-dark">Patients Directory</h1>
          <p className="text-xs text-muted">
            Per-tenant records. Compliant with Digital Personal Data Protection (DPDP) Act.
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={handleExportDPDP}>
          <Download className="w-3.5 h-3.5 mr-1" />
          One-Click DPDP Export
        </Button>
      </div>

      {/* DPDP Compliance Guarantee */}
      <Card className="bg-bg-inset border-border p-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-success" />
          <span className="font-medium text-dark">Data Privacy Guarantee: Patient data is never shared across clinics or used for external advertising.</span>
        </div>
        <span className="text-muted">Consent stored</span>
      </Card>

      {/* Search Bar */}
      <div className="relative">
        <Input
          placeholder="Search by patient name or phone number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
        <Search className="w-4 h-4 text-muted absolute left-3 top-3" />
      </div>

      {/* Patient Table */}
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-bg-inset border-b border-border text-muted font-semibold">
            <tr>
              <th className="py-3 px-4">Patient Name</th>
              <th className="py-3 px-4">WhatsApp Phone</th>
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
                <td className="py-3 px-4 text-muted tabular-nums">{p.phone}</td>
                <td className="py-3 px-4 font-semibold text-dark tabular-nums">{p.visits}</td>
                <td className="py-3 px-4 text-muted">{p.lastVisit}</td>
                <td className="py-3 px-4">
                  <Badge variant="success">Consented</Badge>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => handleDelete(p.id, p.name)}
                    className="text-danger hover:text-danger/80 font-medium inline-flex items-center gap-1 text-[11px]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hard Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

