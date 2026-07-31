import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Restaurant, Order } from '../../types';
import {
  Activity,
  Award,
  AlertTriangle,
  Sliders,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
} from 'lucide-react';

interface PerformanceHealthScoreTabProps {
  restaurant: Restaurant;
  orders: Order[];
  onUpdate?: () => void;
  logAdminAction?: (action: string, details: string) => Promise<void>;
}

export default function PerformanceHealthScoreTab({
  restaurant,
  orders,
  logAdminAction,
}: PerformanceHealthScoreTabProps) {
  const restOrders = orders.filter((o) => o.restaurantId === restaurant.id);
  const totalOrders = restOrders.length;
  const deliveredOrders = restOrders.filter((o) => o.status === 'delivered');
  const cancelledOrders = restOrders.filter((o) => o.status === 'cancelled');

  // Metrics calculation
  const acceptanceRate = totalOrders > 0 ? Math.round((deliveredOrders.length / totalOrders) * 100) : 95;
  const completionRate = totalOrders > 0 ? Math.round(((totalOrders - cancelledOrders.length) / totalOrders) * 100) : 98;
  const cancellationRate = totalOrders > 0 ? Math.round((cancelledOrders.length / totalOrders) * 100) : 2;
  const avgPrepTime = restaurant.prepTime || 18; // mins
  const ratingScore = restaurant.rating || 4.5;
  const docVerified = restaurant.fssaiVerified && restaurant.gstVerified;

  // Capacity states
  const [maxConcurrent, setMaxConcurrent] = useState<number>(restaurant.maxConcurrentOrders || 15);
  const [maxOrdersPerHour, setMaxOrdersPerHour] = useState<number>(restaurant.maxOrdersPerHour || 40);
  const [autoPauseOnCap, setAutoPauseOnCap] = useState<boolean>(restaurant.autoPauseOnCapacity ?? true);
  const [prepQueueLimit, setPrepQueueLimit] = useState<number>(restaurant.prepQueueLimit || 20);
  const [isPaused, setIsPaused] = useState<boolean>(!restaurant.isOpen);

  // SLA Targets
  const [prepSla, setPrepSla] = useState<number>(restaurant.prepSlaMinutes || 20);
  const [acceptanceSla, setAcceptanceSla] = useState<number>(restaurant.acceptanceSlaSeconds || 120);

  // Health score calculation formula (0 - 100)
  // Weightings: Rating (25%), Acceptance Rate (20%), Completion Rate (20%), Prep Time SLA (15%), Doc Verified (10%), Low Cancellation (10%)
  const ratingWeight = (ratingScore / 5) * 25;
  const acceptanceWeight = (acceptanceRate / 100) * 20;
  const completionWeight = (completionRate / 100) * 20;
  const prepTimeWeight = avgPrepTime <= prepSla ? 15 : Math.max(0, 15 - (avgPrepTime - prepSla));
  const docWeight = docVerified ? 10 : 5;
  const cancelWeight = Math.max(0, 10 - cancellationRate * 2);

  const healthScore = Math.min(100, Math.round(ratingWeight + acceptanceWeight + completionWeight + prepTimeWeight + docWeight + cancelWeight));

  const getHealthBadge = (score: number) => {
    if (score >= 85) return { label: 'EXCELLENT HEALTH', bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', bar: 'bg-emerald-500' };
    if (score >= 70) return { label: 'GOOD STANDING', bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400', bar: 'bg-amber-500' };
    if (score >= 50) return { label: 'NEEDS ATTENTION', bg: 'bg-orange-500/10 border-orange-500/30 text-orange-400', bar: 'bg-orange-500' };
    return { label: 'CRITICAL WARNING', bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400', bar: 'bg-rose-500' };
  };

  const badge = getHealthBadge(healthScore);

  const handleSaveCapacity = async () => {
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        maxConcurrentOrders: Number(maxConcurrent),
        maxOrdersPerHour: Number(maxOrdersPerHour),
        autoPauseOnCapacity: autoPauseOnCap,
        prepQueueLimit: Number(prepQueueLimit),
        prepSlaMinutes: Number(prepSla),
        acceptanceSlaSeconds: Number(acceptanceSla),
      });
      if (logAdminAction) {
        await logAdminAction(
          'UPDATE_CAPACITY_SLA',
          `Updated capacity limit: Concurrent ${maxConcurrent}, PerHr ${maxOrdersPerHour}, QueueLimit ${prepQueueLimit}`
        );
      }
      alert('Capacity & SLA rules updated successfully.');
    } catch (err: any) {
      alert('Error updating capacity: ' + err.message);
    }
  };

  const handleTogglePauseStore = async () => {
    try {
      const nextOpen = isPaused; // toggle pause means toggle open
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        isOpen: nextOpen,
      });
      setIsPaused(!nextOpen);
      if (logAdminAction) {
        await logAdminAction('CAPACITY_STORE_TOGGLE', `Manually ${nextOpen ? 'Resumed' : 'Paused'} merchant store operations`);
      }
    } catch (err: any) {
      alert('Error toggling store state: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      {/* Top Banner: Restaurant Health Score */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${badge.bg}`}>
                {badge.label}
              </span>
              <span className="text-xs text-slate-400 font-mono">ID: #{restaurant.id.slice(-6)}</span>
            </div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-400" /> Automated Restaurant Health & SLA Score
            </h3>
            <p className="text-xs text-slate-400">
              Real-time algorithmic scoring calculated from order acceptance, kitchen prep times, customer reviews, document verification status, and SLA violations.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-850 shrink-0">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-800"
                  strokeWidth="3"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={badge.bar.replace('bg-', 'text-')}
                  strokeDasharray={`${healthScore}, 100`}
                  strokeWidth="3"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-2xl font-bold font-mono text-slate-100">{healthScore}</span>
                <span className="text-[9px] text-slate-500 block uppercase font-mono">/ 100</span>
              </div>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between gap-3 font-mono">
                <span className="text-slate-400">Rating Score:</span>
                <span className="text-orange-400 font-bold">{ratingScore.toFixed(1)} ★</span>
              </div>
              <div className="flex justify-between gap-3 font-mono">
                <span className="text-slate-400">Acceptance Rate:</span>
                <span className="text-emerald-400 font-bold">{acceptanceRate}%</span>
              </div>
              <div className="flex justify-between gap-3 font-mono">
                <span className="text-slate-400">Completion Rate:</span>
                <span className="text-emerald-400 font-bold">{completionRate}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Health Factors & SLA Violations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Metric Breakdown Cards */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Award className="w-4 h-4 text-orange-400" /> Scoring Weight Distribution
          </h4>

          <div className="space-y-3 font-mono text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Order Acceptance Rate</span>
                <span className="text-slate-200 font-bold">{acceptanceRate}% (Max 20 pts)</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                <div className="bg-emerald-500 h-full" style={{ width: `${acceptanceRate}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Order Completion Rate</span>
                <span className="text-slate-200 font-bold">{completionRate}% (Max 20 pts)</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                <div className="bg-emerald-500 h-full" style={{ width: `${completionRate}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Average Kitchen Prep Time</span>
                <span className="text-slate-200 font-bold">{avgPrepTime} mins (Target ≤ {prepSla} min)</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                <div
                  className={avgPrepTime <= prepSla ? 'bg-emerald-500 h-full' : 'bg-rose-500 h-full'}
                  style={{ width: `${Math.min(100, (prepSla / avgPrepTime) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">KYC & Document Verification</span>
                <span className={docVerified ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {docVerified ? '100% Verified (10 pts)' : 'Pending Docs (5 pts)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SLA Management & Violation Monitor */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" /> SLA SLA Thresholds & Violations
          </h4>

          <div className="grid grid-cols-2 gap-3 font-mono text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
              <span className="text-slate-500 text-[10px] uppercase block">Acceptance SLA Target</span>
              <span className="text-slate-100 font-bold text-sm">{acceptanceSla} seconds</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
              <span className="text-slate-500 text-[10px] uppercase block">Kitchen Prep SLA Target</span>
              <span className="text-slate-100 font-bold text-sm">{prepSla} minutes</span>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2 text-xs">
            <span className="text-[10px] font-bold uppercase font-mono text-slate-400 block">SLA Compliance Checklist</span>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Acceptance Delay Threshold: Under 2 mins average</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Food Preparation SLA: 18 mins compliant</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Cancellation Limit: Under 5% order volume threshold</span>
            </div>
          </div>
        </div>
      </div>

      {/* RESTAURANT CAPACITY CONTROL PANEL */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-orange-400" /> Enterprise Kitchen Capacity & Queue Controls
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Prevent kitchen overflow by setting limits on concurrent orders, hourly throughput, and automated store pause.
            </p>
          </div>

          <button
            onClick={handleTogglePauseStore}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              isPaused
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
            }`}
          >
            {isPaused ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
            {isPaused ? 'Resume Kitchen Operations' : 'Pause Store (Overload)'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Max Concurrent Orders
            </label>
            <input
              type="number"
              value={maxConcurrent}
              onChange={(e) => setMaxConcurrent(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono outline-none focus:border-orange-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Max Orders Per Hour
            </label>
            <input
              type="number"
              value={maxOrdersPerHour}
              onChange={(e) => setMaxOrdersPerHour(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono outline-none focus:border-orange-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Prep Queue Limit
            </label>
            <input
              type="number"
              value={prepQueueLimit}
              onChange={(e) => setPrepQueueLimit(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono outline-none focus:border-orange-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Kitchen Prep SLA (Minutes)
            </label>
            <input
              type="number"
              value={prepSla}
              onChange={(e) => setPrepSla(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono outline-none focus:border-orange-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-850">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-200 block">Auto-Pause Store on Capacity Limit</span>
            <span className="text-[11px] text-slate-400">
              Automatically switch store to "Paused" status when active pending orders equal max concurrent capacity.
            </span>
          </div>
          <input
            type="checkbox"
            checked={autoPauseOnCap}
            onChange={(e) => setAutoPauseOnCap(e.target.checked)}
            className="w-5 h-5 accent-orange-500 rounded cursor-pointer"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveCapacity}
            className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-lg cursor-pointer"
          >
            Save Capacity & SLA Rules
          </button>
        </div>
      </div>
    </div>
  );
}
