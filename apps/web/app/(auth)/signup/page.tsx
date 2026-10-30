'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input, Card } from '@baari/ui';
import { ArrowRight, AlertCircle } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          businessName,
          businessEmail,
          phone,
          password
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create organization');
      }

      // Successful signup with active session cookie: proceed directly to onboarding
      router.push('/onboarding?new=1');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg-inset px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-[12px] bg-primary text-white font-bold text-xl shadow-minimal">
            ब
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-dark">Get started with Baari</h1>
          <p className="text-sm text-muted">Your front desk, on autopilot</p>
        </div>

        <Card className="space-y-4 shadow-minimal">
          {error && (
            <div className="p-3 bg-danger-light border border-danger/20 rounded-[8px] flex items-center gap-2 text-xs text-danger" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="fullName" className="text-xs font-medium text-dark">Full Name</label>
              <Input
                id="fullName"
                name="fullName"
                placeholder="Dr. Rajesh Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="businessName" className="text-xs font-medium text-dark">Business / Clinic Name</label>
              <Input
                id="businessName"
                name="businessName"
                placeholder="Sharma Dental Clinic"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                autoComplete="organization"
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="businessEmail" className="text-xs font-medium text-dark">Business Email</label>
              <Input
                id="businessEmail"
                name="businessEmail"
                type="email"
                placeholder="doctor@clinic.com"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="phone" className="text-xs font-medium text-dark">WhatsApp / Phone Number</label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+91 98100 00001"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-xs font-medium text-dark">Password</label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full mt-3 text-xs font-semibold"
              disabled={loading}
              aria-label="Create organization and continue to setup"
            >
              {loading ? 'Creating organisation...' : 'Continue to Setup'}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          <div className="border-t border-border pt-3 text-center">
            <p className="text-xs text-muted">
              Pehle se account hai?{' '}
              <Link href="/login" className="text-primary font-semibold hover:underline">
                Sign in here
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
