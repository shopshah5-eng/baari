'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Input } from '@baari/ui';
import { ArrowRight } from 'lucide-react';

export default function StatusLookupPage() {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState('');

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (tokenInput.trim()) {
      router.push(`/status/${encodeURIComponent(tokenInput.trim().toUpperCase())}`);
    }
  };

  return (
    <main className="min-h-screen bg-bg-inset flex items-center justify-center p-4" role="main">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="space-y-1">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-[10px] bg-primary text-white font-bold text-lg" aria-hidden="true">
            ब
          </div>
          <h1 className="text-lg font-bold text-dark">Live Queue Status</h1>
          <p className="text-xs text-muted">Aapki baari, WhatsApp par</p>
        </div>

        <Card className="p-6 space-y-4 bg-white shadow-minimal">
          <form onSubmit={handleLookup} className="space-y-3 text-left">
            <div>
              <label htmlFor="tokenNumber" className="text-xs font-medium text-dark">Apna Token Number Daalein</label>
              <Input
                id="tokenNumber"
                name="tokenNumber"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="e.g. S-07 ya K-04"
                className="font-mono text-center text-lg font-bold"
                required
              />
            </div>
            <Button variant="primary" size="md" className="w-full text-xs" type="submit" aria-label="Check live queue status">
              Check Live Status <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </form>
          <p className="text-[11px] text-muted text-center">
            Token number aapko WhatsApp par booking ke samay mila hoga.
          </p>
        </Card>
      </div>
    </main>
  );
}
