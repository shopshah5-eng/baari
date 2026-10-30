'use client';

import React, { useState, useEffect } from 'react';
import { Card, Badge, Button } from '@baari/ui';
import { Star, AlertTriangle, CheckCircle2, ShieldCheck, ExternalLink, RotateCcw } from 'lucide-react';
import { ErrorState } from '../components/ErrorState';

interface ReviewItem {
  id: string;
  rating: number;
  comment?: string;
  isLowRatingAlert: boolean;
  createdAt: string;
}

interface ReviewStats {
  avgRating: number;
  totalRatings: number;
  asksSent: number;
  googleClicks: number;
  privateAlerts: number;
}

export default function ReviewsPage() {
  const [stats, setStats] = useState<ReviewStats>({
    avgRating: 0,
    totalRatings: 0,
    asksSent: 0,
    googleClicks: 0,
    privateAlerts: 0
  });

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = () => {
    setLoading(true);
    setError(null);
    fetch('/engine-api/reviews')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Reviews API error (${res.status})`);
        return res.json();
      })
      .then((d) => {
        if (d.stats) setStats(d.stats);
        if (d.reviews) setReviews(d.reviews);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch reviews');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-24 bg-bg-inset border-border" />
          ))}
        </div>
        <Card className="h-64 bg-bg-inset border-border" />
      </div>
    );
  }

  if (error && reviews.length === 0) {
    return (
      <ErrorState
        title="Reviews Engine Offline"
        message={error}
        endpoint="/engine-api/reviews"
        onRetry={fetchReviews}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-dark">Reviews & Reputation Management</h1>
        <p className="text-xs text-muted">
          Policy-safe review collection. Non-gated: Google link sent to 100% of respondents; ratings ≤3★ trigger private owner alerts.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="space-y-1">
          <span className="text-xs text-muted font-medium">Average Rating</span>
          <div className="flex items-center gap-1.5 text-2xl font-bold text-dark">
            <span className="tabular-nums">{stats.avgRating > 0 ? stats.avgRating : '—'}</span>
            <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
          </div>
          <span className="text-[11px] text-muted">From {stats.totalRatings} patient responses</span>
        </Card>

        <Card className="space-y-1">
          <span className="text-xs text-muted font-medium">Asks Sent</span>
          <div className="text-2xl font-bold text-dark tabular-nums">{stats.asksSent}</div>
          <span className="text-[11px] text-muted">Ask-once ledger compliant</span>
        </Card>

        <Card className="space-y-1">
          <span className="text-xs text-muted font-medium">Google Profile Clicks</span>
          <div className="text-2xl font-bold text-success tabular-nums">{stats.googleClicks}</div>
          <span className="text-[11px] text-muted">Direct public reviews</span>
        </Card>

        <Card className="space-y-1">
          <span className="text-xs text-muted font-medium">Private Alerts (≤3★)</span>
          <div className="text-2xl font-bold text-warning tabular-nums">{stats.privateAlerts}</div>
          <span className="text-[11px] text-muted">Kept off public web</span>
        </Card>
      </div>

      {/* Compliance Guarantee Banner */}
      <Card className="bg-bg-inset border-border p-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-success" />
          <span className="font-medium text-dark">
            Google Business Profile Anti-Suspension Rule: Baari never gates reviews by score.
          </span>
        </div>
      </Card>

      {/* Feedback Stream */}
      <Card className="space-y-3">
        <h3 className="text-xs font-semibold text-dark">Patient Feedback Stream</h3>
        {reviews.length === 0 ? (
          <div className="text-center py-10 text-xs text-muted">
            No reviews received yet. Review requests will be sent automatically 2 hours after a patient consultation is marked done.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {reviews.map((r) => (
              <div key={r.id} className="py-3 flex justify-between items-start text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                            }`}
                        />
                      ))}
                    </div>
                    {r.isLowRatingAlert && (
                      <Badge variant="warning" className="text-[10px]">
                        Owner Alerted (Private)
                      </Badge>
                    )}
                  </div>
                  <p className="text-dark font-medium">{r.comment || 'No comment provided'}</p>
                </div>
                <span className="text-[11px] text-muted font-mono">{r.createdAt}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
