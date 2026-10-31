'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, UserCheck, Tv, MessageSquare,
  Star, CreditCard, ChevronDown, CheckCircle2, AlertCircle, LogOut,
  Menu, X, FileText, Settings
} from 'lucide-react';
import { Badge } from '@baari/ui';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [tenantName, setTenantName] = useState('Clinic Workspace');
  const [tenantInfo, setTenantInfo] = useState('Consultation & Queues');
  const [userRole, setUserRole] = useState('Clinic Owner');
  const [waConnected, setWaConnected] = useState(false);
  const [isQuietHours, setIsQuietHours] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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

  // Fetch real tenant info, auth user role & WhatsApp connection state
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

    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(d => {
        if (d && d.user) {
          if (d.user.role === 'owner') setUserRole('Clinic Owner');
          else if (d.user.role === 'receptionist') setUserRole('Reception Desk');
          else if (d.user.role === 'doctor') setUserRole('Doctor');
          else if (d.user.role === 'operator') setUserRole('Platform Operator');
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  // Compute initials dynamically from clinic name
  const initials = tenantName
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'CW';

  // Navigation items including Reports and Settings
  const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/desk', label: 'Reception Desk', icon: Users, badge: 'Live' },
    { href: '/cabin', label: 'Doctor Cabin', icon: UserCheck },
    { href: '/tv/display-default', label: 'Waiting TV', icon: Tv },
    { href: '/patients', label: 'Patients', icon: Users },
    { href: '/reports', label: 'Reports & CSV', icon: FileText },
    { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquare, statusDot: waConnected },
    { href: '/reviews', label: 'Reviews', icon: Star },
    { href: '/billing', label: 'Billing & Plans', icon: CreditCard },
    { href: '/settings', label: 'Settings', icon: Settings }
  ];

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full">
      <div className="p-4 space-y-6">
        {/* Logo & Tenant Switcher */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-[8px] bg-primary text-white flex items-center justify-center font-bold text-sm">
                ब
              </span>
              <span className="font-bold text-base tracking-tight text-dark">Baari</span>
            </div>
            {mobileMenuOpen && (
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-[6px] text-muted hover:text-dark md:hidden"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="p-2 rounded-[8px] bg-bg-inset border border-border flex items-center justify-between">
            <div className="truncate">
              <div className="text-xs font-semibold text-dark truncate">{tenantName}</div>
              <div className="text-[11px] text-muted truncate">{tenantInfo}</div>
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
    </div>
  );

  return (
    <div className="min-h-screen flex bg-bg-inset">
      {/* Desktop Sidebar (Hidden on small mobile screens §Rule 4) */}
      <aside className="w-64 border-r border-border bg-white hidden md:flex flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-64 max-w-[80vw] bg-white h-full shadow-2xl flex flex-col z-50">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content View */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-14 border-b border-border bg-white px-4 md:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 -ml-1 text-muted hover:text-dark md:hidden rounded-[6px]"
              aria-label="Open mobile navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs text-muted truncate">Aapki baari, WhatsApp par</span>
          </div>

          <div className="flex items-center gap-3 md:gap-4 text-xs">
            <span className="text-muted hidden sm:inline">{userRole}</span>
            <button
              onClick={handleLogout}
              className="text-muted hover:text-dark flex items-center gap-1 text-xs"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
            <span
              className="w-7 h-7 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold text-xs shrink-0"
              title={tenantName}
            >
              {initials}
            </span>
          </div>
        </header>

        <div className="p-4 md:p-6 max-w-6xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
