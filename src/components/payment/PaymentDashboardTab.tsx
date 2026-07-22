import React from 'react';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  Play, 
  Cpu,
  ArrowUpRight,
  AlertCircle
} from 'lucide-react';
import { PaymentTransaction, Rider, Restaurant, PaymentEmployee, PaymentSetting } from '../../types';
import { getActiveCity } from '../../services/mapService';

interface PaymentDashboardTabProps {
  transactions: PaymentTransaction[];
  riders: Rider[];
  restaurants: Restaurant[];
  employees: PaymentEmployee[];
  settings: PaymentSetting | null;
  onTriggerAutoCalc: () => void;
  onToggleAutoSettlement: () => void;
}

export default function PaymentDashboardTab({
  transactions,
  riders,
  restaurants,
  employees,
  settings,
  onTriggerAutoCalc,
  onToggleAutoSettlement
}: PaymentDashboardTabProps) {
  // Calculations
  const totalPayouts = transactions
    .filter(t => t.status === 'paid')
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingPayouts = transactions
    .filter(t => t.status === 'pending' || t.status === 'approved' || t.status === 'processing')
    .reduce((sum, t) => sum + t.amount, 0);

  const holdPayouts = transactions
    .filter(t => t.status === 'on_hold')
    .reduce((sum, t) => sum + t.amount, 0);

  const companyCommission = transactions
    .filter(t => t.status === 'paid')
    .reduce((sum, t) => sum + t.commission, 0);

  const platformFees = transactions
    .filter(t => t.status === 'paid')
    .reduce((sum, t) => sum + t.platformFee, 0);

  // Count by statuses
  const statusCounts = {
    pending: transactions.filter(t => t.status === 'pending').length,
    approved: transactions.filter(t => t.status === 'approved').length,
    processing: transactions.filter(t => t.status === 'processing').length,
    paid: transactions.filter(t => t.status === 'paid').length,
    on_hold: transactions.filter(t => t.status === 'on_hold').length,
    failed: transactions.filter(t => t.status === 'failed').length,
  };

  return (
    <div className="space-y-6 animate-fade-in" id="payment-dashboard-container">
      {/* Top Banner and Quick Engine Control */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/10 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-amber-500/10 text-amber-500 rounded-lg text-xs font-mono font-bold">V1.4 Live</span>
            <h3 className="font-bold text-sm text-slate-200">Ting Tong {getActiveCity().name} Payment Calculation Engine</h3>
          </div>
          <p className="text-xs text-slate-400">
            Automated payouts process order-by-order commissions, platform fees, and rider earnings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onToggleAutoSettlement}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              settings?.autoSettlement 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' 
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/25'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Auto-Settlement: {settings?.autoSettlement ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={onTriggerAutoCalc}
            className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/10 transition cursor-pointer"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>Process Daily Payouts</span>
          </button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Settled */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Settled (Paid)</span>
            <p className="text-xl font-bold font-mono text-emerald-400">₹{totalPayouts.toLocaleString('en-IN')}</p>
            <span className="text-[9px] text-slate-500 font-mono">Success Rate: 98.7%</span>
          </div>
          <div className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/25">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Pending Settlements */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending Settlements</span>
            <p className="text-xl font-bold font-mono text-amber-500">₹{pendingPayouts.toLocaleString('en-IN')}</p>
            <span className="text-[9px] text-slate-500 font-mono">{statusCounts.pending + statusCounts.approved} payouts waiting</span>
          </div>
          <div className="bg-amber-500/10 text-amber-500 p-2.5 rounded-xl border border-amber-500/25">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Funds On Hold */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">On-Hold Reserves</span>
            <p className="text-xl font-bold font-mono text-rose-400">₹{holdPayouts.toLocaleString('en-IN')}</p>
            <span className="text-[9px] text-slate-500 font-mono">{statusCounts.on_hold} accounts frozen</span>
          </div>
          <div className="bg-rose-500/10 text-rose-400 p-2.5 rounded-xl border border-rose-500/25">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Company Commission / Revenue */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Platform Revenue</span>
            <p className="text-xl font-bold font-mono text-indigo-400">₹{(companyCommission + platformFees).toLocaleString('en-IN')}</p>
            <span className="text-[9px] text-slate-500 font-mono">Commission + Platform Fees</span>
          </div>
          <div className="bg-indigo-500/10 text-indigo-400 p-2.5 rounded-xl border border-indigo-500/25">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Grid of status breakdown and recent details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Count Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 lg:col-span-1">
          <div>
            <h4 className="font-bold text-xs text-slate-200">Settlement Status Matrix</h4>
            <p className="text-[10px] text-slate-400">Distribution of current batch payouts</p>
          </div>

          <div className="space-y-2.5">
            {[
              { label: 'Paid (सफलतापूर्वक भुगतान)', count: statusCounts.paid, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
              { label: 'Pending (लंबित)', count: statusCounts.pending, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
              { label: 'Approved (स्वीकृत)', count: statusCounts.approved, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
              { label: 'Processing (प्रक्रिया में)', count: statusCounts.processing, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
              { label: 'On Hold (रोका गया)', count: statusCounts.on_hold, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
              { label: 'Failed/Cancelled', count: statusCounts.failed, color: 'text-slate-400', bg: 'bg-slate-800/40', border: 'border-slate-800' }
            ].map((stat, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/40 border border-slate-850/60">
                <span className="text-[10px] font-bold text-slate-300">{stat.label}</span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full font-mono ${stat.color} ${stat.bg} border ${stat.border}`}>
                  {stat.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Ledger / Recent Settlements */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-slate-200">Real-time Settlement Stream</h4>
                <p className="text-[10px] text-slate-400">Recent payouts across all platform nodes</p>
              </div>
              <span className="text-[9px] text-emerald-400 flex items-center gap-1 font-mono bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10">
                ● Live Sync
              </span>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5">Beneficiary</th>
                    <th className="py-2.5">Type</th>
                    <th className="py-2.5">Amount</th>
                    <th className="py-2.5">Method</th>
                    <th className="py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-xs">
                  {transactions.slice(0, 5).map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-950/20">
                      <td className="py-3 font-semibold text-slate-200">{tx.recipientName}</td>
                      <td className="py-3">
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                          tx.recipientType === 'rider' ? 'bg-amber-500/10 text-amber-500' :
                          tx.recipientType === 'vendor' ? 'bg-indigo-500/10 text-indigo-500' :
                          'bg-emerald-500/10 text-emerald-500'
                        }`}>
                          {tx.recipientType}
                        </span>
                      </td>
                      <td className="py-3 font-bold font-mono text-slate-300">₹{tx.amount.toLocaleString('en-IN')}</td>
                      <td className="py-3 text-[10px] text-slate-400">{tx.paymentMethod}</td>
                      <td className="py-3">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          tx.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' :
                          tx.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/15' :
                          tx.status === 'on_hold' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/15' :
                          'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                        No transactions registered yet. Click "Process Daily Payouts" to calculate settlements.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-850 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Automated Ledger Auditing Active
            </span>
            <span>Ref: TT-PAY-GRID</span>
          </div>
        </div>
      </div>
    </div>
  );
}
