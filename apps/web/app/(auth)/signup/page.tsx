'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input, Card } from '@baari/ui';
import { ArrowRight } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Directs into conversational onboarding immediately
    setTimeout(() => {
      setLoading(false);
      router.push('/onboarding');
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-inset px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-[12px] bg-primary text-white font-bold text-xl shadow-minimal">
            ब
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-dark">Get started with Baari</h1>
          <p className="text-sm text-muted">Your front desk, on autopilot</p>
        </div>

        <Card className="space-y-4">
          <form onSubmit={handleSignup} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-dark">Full Name</label>
              <Input
                placeholder="Dr. Rajesh Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-dark">Business / Clinic Name</label>
              <Input
                placeholder="Sharma Dental Clinic"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-dark">Business Email</label>
              <Input
                type="email"
                placeholder="contact@sharmadental.com"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-dark">WhatsApp / Phone Number</label>
              <Input
                placeholder="+91 98100 00001"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-dark">Password</label>
              <Input
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" variant="primary" className="w-full mt-3" disabled={loading}>
              {loading ? 'Creating organisation...' : 'Continue to Setup'}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-muted">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

