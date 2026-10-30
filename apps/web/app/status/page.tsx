'use client';

import React, { useState, useEffect } from 'react';
import { Card, Badge } from '@baari/ui';
import { Clock, MapPin, Car, CheckCircle2 } from 'lucide-react';

export default function PatientStatusPage() {
  const [tokenInfo, setTokenInfo] = useState({
    tokenFormatted: 'S-07',
    providerName: 'Dr. Rajesh Sharma',
    roomName: 'Cabin 1',
    clinicName: 'Dr Sharma Dental, Model Town',
    etaWindow: '12:10–12:24 PM',
    aheadCount: 1,
    leaveByTime: '11:45 AM',
    travelMinutes: 12,
    bufferMinutes: 10,
    state: 'BOOKED'
  });

  return (
    <div className="min-h-screen bg-bg-inset flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        {/* Clinic Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-[10px] bg-primary text-white font-bold text-lg">
            ब
          </div>
          <h1 className="text-lg font-bold text-dark">{tokenInfo.clinicName}</h1>
          <p className="text-xs text-muted">Aapki Baari — Live Token Status</p>
        </div>

        {/* Token Status Card */}
        <Card className="p-6 text-center space-y-5 border-primary/20 bg-white">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Aapka Token Number</span>
            <div className="text-6xl font-black text-primary tracking-tight tabular-nums py-2">
              {tokenInfo.tokenFormatted}
            </div>
            <div className="text-sm font-bold text-dark">{tokenInfo.providerName}</div>
            <div className="text-xs text-muted">{tokenInfo.roomName}</div>
          </div>

          <div className="p-3 bg-bg-inset rounded-[8px] border border-border space-y-2 text-xs text-left">
            <div className="flex justify-between items-center">
              <span className="text-muted flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                Anumaanit Samay
              </span>
              <strong className="text-dark tabular-nums">~{tokenInfo.etaWindow}</strong>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted">Aapse pehle log</span>
              <strong className="text-dark tabular-nums">{tokenInfo.aheadCount} log</strong>
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-border">
              <span className="text-muted flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-primary" />
                Ghar se niklein
              </span>
              <strong className="text-primary tabular-nums">{tokenInfo.leaveByTime}</strong>
            </div>
          </div>

          <p className="text-[11px] text-muted leading-relaxed">
            Aapko WhatsApp par alert aayega jab aapse pehle sirf 2 log reh jaayenge. Call karne ki zaroorat nahi hai.
          </p>
        </Card>
      </div>
    </div>
  );
}

