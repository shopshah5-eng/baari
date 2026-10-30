'use client';

import React, { useEffect } from 'react';
import { Card, Button } from '@baari/ui';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App runtime error caught by boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg-inset flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-danger-light text-danger flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <Card className="p-8 space-y-4 bg-white shadow-minimal text-center">
          <div className="space-y-1">
            <h1 className="text-base font-bold text-dark">Something Went Wrong</h1>
            <p className="text-xs text-muted">
              {error.message || 'An unexpected error occurred while rendering this view.'}
            </p>
          </div>
          {error.digest && (
            <div className="text-[10px] font-mono text-muted bg-bg-inset py-1 px-2 rounded-[6px] border border-border inline-block">
              Digest: {error.digest}
            </div>
          )}
          <div className="pt-2">
            <Button variant="primary" size="sm" onClick={() => reset()} className="text-xs">
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

