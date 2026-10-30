'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, UserCheck, Tv, MessageSquare,
  Star, CreditCard, ChevronDown, CheckCircle2, AlertCircle, LogOut
} from 'lucide-react';
import { Badge } from '@baari/ui';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [tenantName, setTenantName] = useState('Dr Sharma Dental');
  const [tenantInfo, setTenantInfo] = useState('Clinic · 3 Doctors');
  const [waConnected, setWaConnected] = useState(false);
  const [isQuietHours, setIsQuietHours] = useState(false);

  // Derive quiet hours from actual Indian Standard Time (IST)
  useEffect(() => {
    const checkQuietHours = () => {
      try {
        const istHour = Number(
          new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false })
        );
        setIsQuietHours(istHour >= 21 || istHour < 8);
      } catch {
        setIsQuietHours(false);
      }
    };
    checkQuietHours();
    const timer = setInterval(checkQuietHours, 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch real tenant info & WhatsApp connection state
  useEffect(() => {
    fetch('/engine-api/wa/status')
      .then(res => res.ok ? res.json() : null)
      .then(d => {
        if (d && d.status === 'connected') {
          setWaConnected(true);
        } else {
          setWaConnected(false);
        }
      })
      .catch(() => setWaConnected(false));

    fetch('/api/tenant')
      .then(res => res.ok ? res.json() : null)
      .then(d => {
        if (d && d.tenant) {
          setTenantName(d.tenant.name);
          setTenantInfo(`${d.tenant.mode.toUpperCase()} · ${d.tenant.area || 'Model Town'}`);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  // Exactly 8 sidebar items per §3
  const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/desk', label: 'Reception Desk', icon: Users, badge: 'Live' },
    { href: '/cabin', label: 'Doctor Cabin', icon: UserCheck },
    { href: '/tv/display-default', label: 'Waiting TV', icon: Tv },
    { href: '/patients', label: 'Patients', icon: Users },
    { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquare, statusDot: waConnected },
    { href: '/reviews', label: 'Reviews', icon: Star },
    { href: '/billing', label: 'Billing & Plans', icon: CreditCard }
  ];

  return (
    <div className="min-h-screen flex bg-bg-inset">
      {/* Sidebar (8 items maximum) */}
      <aside className="w-64 border-r border-border bg-white flex flex-col justify-between shrink-0">
        <div className="p-4 space-y-6">
          {/* Logo & Tenant Switcher */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-2">
              <span className="w-6 h-6 rounded-[8px] bg-primary text-white flex items-center justify-center font-bold text-sm">
                ब
              </span>
              <span className="font-bold text-base tracking-tight text-dark">Baari</span>
            </div>

            <div className="p-2 rounded-[8px] bg-bg-inset border border-border flex items-center justify-between">
              <div className="truncate">
                <div className="text-xs font-semibold text-dark truncate">{tenantName}</div>
                <div className="text-[11px] text-muted">{tenantInfo}</div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href === '/' && pathname === '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 rounded-[8px] text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-light text-primary font-semibold'
                      : 'text-muted hover:text-dark hover:bg-bg-inset'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 bg-success-light text-success text-[10px] font-semibold rounded-pill">
                      {item.badge}
                    </span>
                  )}
                  {item.statusDot !== undefined && (
                    <span className={`w-2 h-2 rounded-full ${item.statusDot ? 'bg-success' : 'bg-gray-300'}`} />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer info: WhatsApp Health Indicator — Honest Status (§4) */}
        <div className="p-4 border-t border-border space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">WhatsApp lane</span>
            {waConnected ? (
              <span className="inline-flex items-center gap-1.5 text-success font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-muted font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                Not Connected
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted">
            {isQuietHours ? '🌙 Quiet hours active: 21:00–08:00 IST' : '☀️ Day hours active'}
          </div>
        </div>
      </aside>

      {/* Main Content View */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-14 border-b border-border bg-white px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Aapki baari, WhatsApp par</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-muted">Receptionist PIN Scoped</span>
            <button
              onClick={handleLogout}
              className="text-muted hover:text-dark flex items-center gap-1 text-xs"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
            <span className="w-7 h-7 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold text-xs">
              RS
            </span>
          </div>
        </header>

        <div className="p-6 max-w-6xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
