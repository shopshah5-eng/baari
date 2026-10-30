'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, Card, Badge } from '@baari/ui';
import { ArrowRight, Lock, KeyRound, AlertCircle } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/';

  const [authMode, setAuthMode] = useState<'password' | 'pin'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authMode,
          email: authMode === 'password' ? email : undefined,
          password: authMode === 'password' ? password : undefined,
          pin: authMode === 'pin' ? pin : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      router.push(from);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-inset px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-[12px] bg-primary text-white font-bold text-xl shadow-minimal">
            ब
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-dark">Welcome to Baari</h1>
          <p className="text-sm text-muted">Aapki baari, WhatsApp par</p>
        </div>

        <Card className="space-y-4 shadow-minimal">
          <div className="flex border-b border-border pb-3">
            <button
              type="button"
              onClick={() => {
                setAuthMode('password');
                setError(null);
              }}
              className={`flex-1 text-center py-1.5 text-xs font-medium rounded-[8px] transition-colors ${
                authMode === 'password' ? 'bg-primary-light text-primary font-semibold' : 'text-muted hover:text-dark'
              }`}
            >
              Email / Password
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('pin');
                setError(null);
              }}
              className={`flex-1 text-center py-1.5 text-xs font-medium rounded-[8px] transition-colors ${
                authMode === 'pin' ? 'bg-primary-light text-primary font-semibold' : 'text-muted hover:text-dark'
              }`}
            >
              Receptionist PIN
            </button>
          </div>

          {error && (
            <div className="p-3 bg-danger-light border border-danger/20 rounded-[8px] flex items-center gap-2 text-xs text-danger">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3">
            {authMode === 'password' ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-dark">Business Email</label>
                  <Input
                    type="email"
                    placeholder="doctor@clinic.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-dark">Password</label>
                  </div>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <label className="text-xs font-medium text-dark">Desk Fast PIN</label>
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="e.g. 1234"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="text-center font-mono text-lg tracking-widest"
                  autoComplete="one-time-code"
                  required
                />
                <p className="text-[11px] text-muted text-center pt-1">
                  Default pilot reception PIN is <span className="font-mono font-semibold">1234</span>
                </p>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full text-xs font-semibold"
              disabled={loading}
            >
              {loading ? 'Authenticating...' : authMode === 'password' ? 'Sign In to Dashboard' : 'Unlock Reception Desk'}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          <div className="border-t border-border pt-3 text-center">
            <p className="text-xs text-muted">
              Nayi clinic register karni hai?{' '}
              <Link href="/onboarding" className="text-primary font-semibold hover:underline">
                Start setup here
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-inset flex items-center justify-center p-4">Loading login...</div>}>
      <LoginForm />
    </Suspense>
  );
}

