'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, Badge } from '@baari/ui';
import { ArrowRight, Lock, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'password' | 'pin'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate Supabase login and session establishment
    setTimeout(() => {
      setLoading(false);
      router.push('/');
    }, 600);
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

        <Card className="space-y-4">
          <div className="flex border-b border-border pb-3">
            <button
              type="button"
              onClick={() => setAuthMode('password')}
              className={`flex-1 text-center py-1.5 text-xs font-medium rounded-[8px] transition-colors ${authMode === 'password' ? 'bg-primary-light text-primary font-semibold' : 'text-muted hover:text-dark'}`}
            >
              Email / Password
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('pin')}
              className={`flex-1 text-center py-1.5 text-xs font-medium rounded-[8px] transition-colors ${authMode === 'pin' ? 'bg-primary-light text-primary font-semibold' : 'text-muted hover:text-dark'}`}
            >
              Desk PIN
            </button>
          </div>

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
                    required
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-dark">Password</label>
                    <a href="#" className="text-xs text-primary hover:underline">Forgot?</a>
                  </div>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <label className="text-xs font-medium text-dark">Reception Desk PIN</label>
                <div className="relative">
                  <Input
                    type="password"
                    maxLength={6}
                    placeholder="4 to 6 digit PIN"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    required
                  />
                  <KeyRound className="w-4 h-4 text-muted absolute right-3 top-3" />
                </div>
                <p className="text-[11px] text-muted">Scoped to queue & walk-ins only (cannot access revenue or history).</p>
              </div>
            )}

            <Button type="submit" variant="primary" className="w-full mt-2" disabled={loading}>
              {loading ? 'Signing in...' : authMode === 'password' ? 'Sign in' : 'Unlock Desk'}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted">Or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            className="w-full flex items-center justify-center gap-2"
            onClick={() => {
              setLoading(true);
              setTimeout(() => { router.push('/'); }, 500);
            }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Sign in with Google
          </Button>
        </Card>

        <p className="text-center text-xs text-muted">
          New clinic or business?{' '}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Create an organisation
          </Link>
        </p>
      </div>
    </div>
  );
}

