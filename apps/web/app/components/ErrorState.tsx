'use client';

import React from 'react';
import { Card, Button } from '@baari/ui';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  endpoint?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function ErrorState({
  title = 'Service Unavailable',
  message = 'Unable to reach the Baari engine backend. Showing honest error state instead of simulated data.',
  endpoint,
  onRetry,
  retrying = false
}: ErrorStateProps) {
  return (
    <Card className="p-8 max-w-lg mx-auto text-center space-y-4 border-dashed border-border bg-white shadow-minimal my-8">
      <div className="w-12 h-12 rounded-full bg-danger-light text-danger mx-auto flex items-center justify-center">
        <AlertCircle className="w-6 h-6" />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-semibold text-dark">{title}</h3>
        <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">{message}</p>
      </div>

      {endpoint && (
        <div className="py-1 px-2.5 rounded-[6px] bg-bg-inset border border-border inline-block text-[11px] font-mono text-muted">
          Endpoint: {endpoint}
        </div>
      )}

      {onRetry && (
        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={retrying}
            className="text-xs"
          >
            <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Connecting...' : 'Retry Connection'}
          </Button>
        </div>
      )}
    </Card>
  );
}

