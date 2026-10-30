import Link from 'next/link';
import { Button, Card } from '@baari/ui';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg-inset flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-12 h-12 rounded-[12px] bg-primary text-white flex items-center justify-center font-bold text-xl mx-auto shadow-minimal">
          ब
        </div>
        <Card className="p-8 space-y-4 bg-white shadow-minimal text-center">
          <div className="text-4xl font-black text-primary font-mono">404</div>
          <div className="space-y-1">
            <h1 className="text-base font-bold text-dark">Page Not Found</h1>
            <p className="text-xs text-muted">
              Yeh page ya token link exist nahi karta. Kripya check karein.
            </p>
          </div>
          <div className="pt-2">
            <Link href="/">
              <Button variant="primary" size="sm" className="text-xs">
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

