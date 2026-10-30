import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Button ──────────────────────────────────────────────────────────────────
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'success';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none rounded-[8px]';
    const variants = {
      primary: 'bg-primary text-white hover:bg-primary-hover shadow-minimal',
      secondary: 'bg-white text-dark border border-border hover:bg-bg-inset shadow-minimal',
      ghost: 'bg-transparent text-muted hover:text-dark hover:bg-bg-inset',
      destructive: 'bg-danger-light text-danger border border-danger/20 hover:bg-danger/10',
      success: 'bg-success text-white hover:bg-success/90 shadow-minimal'
    };
    const sizes = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-10 px-4 text-sm gap-2',
      lg: 'h-12 px-6 text-base gap-2.5 font-semibold'
    };
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

// ── Card ────────────────────────────────────────────────────────────────────
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div
    className={cn('bg-white border border-border rounded-[12px] p-4 shadow-minimal', className)}
    {...props}
  >
    {children}
  </div>
);

// ── Badge ───────────────────────────────────────────────────────────────────
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary';
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'neutral', children, ...props }) => {
  const variants = {
    neutral: 'bg-bg-inset text-muted border border-border',
    success: 'bg-success-light text-success border border-success/20',
    warning: 'bg-warning-light text-warning border border-warning/20',
    danger: 'bg-danger-light text-danger border border-danger/20',
    primary: 'bg-primary-light text-primary border border-primary/20'
  };
  return (
    <span
      className={cn('inline-flex items-center px-2.5 py-0.5 rounded-[999px] text-xs font-medium tabular-nums', variants[variant], className)}
      {...props}
    >
      {children}
    </span>
  );
};

// ── Input ───────────────────────────────────────────────────────────────────
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-[8px] border border-border bg-white px-3 py-2 text-sm text-dark placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

