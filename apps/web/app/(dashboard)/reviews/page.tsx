'use client';

import React, { useState, useEffect } from 'react';
import { Card, Badge, Button } from '@baari/ui';
import { Star, AlertTriangle, CheckCircle2, ShieldCheck, ExternalLink } from 'lucide-react';

interface ReviewItem {
  id: string;
  rating: number;
  comment?: string;
  isLowRatingAlert: boolean;
  createdAt: string;
}

export default function ReviewsPage() {
  const [stats, setStats] = useState({
    avgRating: 4.8,
    totalRatings: 34,
    asksSent: 48,
    googleClicks: 21,
    privateAlerts: 2
  });

  const [reviews, setReviews] = useState<ReviewItem[]>([
    { id: 'r1', rating: 5, comment: 'Dr. Sharma was very gentle with scaling. Almost no wait time!', isLowRatingAlert: false, createdAt: 'Today, 11:20' },
    { id: 'r2', rating: 2, comment: 'AC in the waiting room was off, felt very hot.', isLowRatingAlert: true, createdAt: 'Today, 10:15' },
    { id: 'r3', rating: 5, comment: 'Token system is wonderful. Got alert when 2 patients ahead.', isLowRatingAlert: false, createdAt: 'Yesterday' }
  ]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-dark">Reviews & Feedback</h1>
        <p className="text-xs text-muted">
          Policy-safe review collection. Non-gated: Google link sent to 100% of respondents.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="space-y-1">
          <span className="text-xs text-muted font-medium">Average Rating</span>
          <div className="flex items-center gap-1.5 text-2xl font-bold text-dark">
            <span className="tabular-nums">{stats.avgRating}</span>
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
          <div className="text-2xl font-bold text-danger tabular-nums">{stats.privateAlerts}</div>
          <span className="text-[11px] text-danger font-medium">Saved from public 1-star</span>
        </Card>
      </div>

      {/* Compliance Guarantee Notice */}
      <Card className="bg-bg-inset border-border p-4 space-y-1.5">
        <div className="flex items-center gap-2 text-dark font-semibold text-xs">
          <ShieldCheck className="w-4 h-4 text-success" />
          <span>Zero Rating-Gating Policy Compliance</span>
        </div>
        <p className="text-xs text-muted">
          Every patient who rates (1★ to 5★) receives the direct Google Business Profile review link. Additionally, every rating is offered a private channel to inform the doctor directly. Any rating ≤3★ immediately triggers a private notification to the owner.
        </p>
      </Card>

      {/* Reviews Ledger */}
      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-dark">Recent Feedback Stream</h2>
        <div className="space-y-2">
          {reviews.map((rev) => (
            <div
              key={rev.id}
              className={`p-3 rounded-[8px] border text-xs space-y-1.5 ${
                rev.isLowRatingAlert ? 'bg-danger-light/50 border-danger/30' : 'bg-white border-border'
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="flex text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-amber-400' : 'text-border fill-border'}`}
                      />
                    ))}
                  </div>
                  <span className="font-bold text-dark tabular-nums">{rev.rating} Stars</span>
                  {rev.isLowRatingAlert && (
                    <Badge variant="danger">Private Alert ≤3★</Badge>
                  )}
                </div>
                <span className="text-muted text-[11px] tabular-nums">{rev.createdAt}</span>
              </div>
              {rev.comment && <p className="text-dark font-medium">{rev.comment}</p>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

