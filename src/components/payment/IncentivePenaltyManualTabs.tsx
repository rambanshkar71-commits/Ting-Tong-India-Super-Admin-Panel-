import React, { useState } from 'react';
import { 
  Sparkles, 
  MinusCircle, 
  AlertOctagon, 
  Plus, 
  User, 
  CornerDownRight, 
  Clock, 
  History,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { Rider, Restaurant, PaymentEmployee, PaymentTransaction, PaymentAuditLog } from '../../types';

interface IncentivePenaltyManualTabsProps {
  activeSubTab: string; // 'incentives' | 'penalties' | 'manual'
  riders: Rider[];
  restaurants: Restaurant[];
  employees: PaymentEmployee[];
  transactions: PaymentTransaction[];
  auditLogs: PaymentAuditLog[];
  onApplyBonusPenalty: (
    targetId: string, 
    targetType: 'rider' | 'vendor' | 'employee', 
    amount: number, 
    type: 'bonus' | 'penalty', 
    reason: string
  ) => void;
  onModifyTransaction: (
    transactionId: string, 
    newAmount: number, 
    bonus: number, 
    penalty: number, 
    notes: string
  ) => void;
}

export default function IncentivePenaltyManualTabs({
  activeSubTab,
  riders,
  restaurants,
  employees,
  transactions,
  auditLogs,
  onApplyBonusPenalty,
  onModifyTransaction
}: IncentivePenaltyManualTabsProps) {
  // Common states
  const [targetId, setTargetId] = useState('');
  const [targetType, setTargetType] = useState<'rider' | 'vendor' | 'employee'>('rider');
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');
  
  // Manual adjust states
  const [selectedTxId, setSelectedTxId] = useState('');
  const [manualNewAmount, setManualNewAmount] = useState(0);
  const [manualBonus, setManualBonus] = useState(0);
  const [manualPenalty, setManualPenalty] = useState(0);
  const [manualNotes, setManualNotes] = useState('');

  const handleBonusPenaltySubmit = (e: React.FormEvent, type: 'bonus' | 'penalty') => {
    e.preventDefault();
    if (!targetId) {
      alert("Please select a target recipient partner.");
      return;
    }
    if (amount <= 0) {
      alert("Amount must be greater than zero.");
      return;
    }
    if (!reason.trim()) {
      alert("A valid explanation/reason is required.");
      return;
    }

    onApplyBonusPenalty(targetId, targetType, amount, type, reason);
    
    // Reset
    setAmount(0);
    setReason('');
  };

  const handleManualModificationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxId) {
      alert("Please select a transaction to modify.");
      return;
    }
    if (!manualNotes.trim()) {
      alert("A detailed audit comment is MANDATORY for manually altering financial settlements.");
      return;
    }

    onModifyTransaction(
      selectedTxId, 
      Number(manualNewAmount), 
      Number(manualBonus), 
      Number(manualPenalty), 
      manualNotes
    );

    // Reset
    setSelectedTxId('');
    setManualNewAmount(0);
    setManualBonus(0);
    setManualPenalty(0);
    setManualNotes('');
    alert("Transaction successfully adjusted! Change recorded in secure audit log.");
  };

  // Get active targets list based on selected targetType
  const getTargets = () => {
    if (targetType === 'rider') return riders.map(r => ({ id: r.id, name: `${r.name} (Rider)` }));
    if (targetType === 'vendor') return restaurants.map(v => ({ id: v.id, name: `${v.name} (Vendor Restaurant)` }));
    return employees.map(e => ({ id: e.id, name: `${e.name} (${e.role})` }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="incentive-penalty-tabs-root">
      
      {/* FORM CARD (2 Cols on desktop) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 lg:col-span-2">
        {activeSubTab === 'incentives' && (
          <form onSubmit={(e) => handleBonusPenaltySubmit(e, 'bonus')} className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Sparkles className="w-5 h-5 text-emerald-400 animate-bounce" />
              <div>
                <h4 className="font-bold text-sm text-slate-200">Disburse Incentive & Performance Bonus</h4>
                <p className="text-[10px] text-slate-400">Apply a promotional bonus directly to wallets or payouts</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">1. Select Recipient Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['rider', 'vendor', 'employee'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setTargetType(type);
                        setTargetId('');
                      }}
                      className={`py-2 text-[10px] font-bold rounded-xl border transition uppercase ${
                        targetType === type 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-slate-950/40 text-slate-400 border-slate-850 hover:bg-slate-950/80'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">2. Select Recipient Partner</label>
                <select
                  required
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-emerald-500 transition"
                >
                  <option value="">Select recipient...</option>
                  {getTargets().map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">3. Bonus Incentive Amount (₹)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="500"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">4. Incentive Category/Reason</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Festival Bonus, Peak Hours 100% Attendance"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-850 flex justify-between items-center">
              <span className="text-[9px] text-slate-500 italic">This action will increase the recipient's wallet balance instantly.</span>
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition"
              >
                <Plus className="w-4 h-4" />
                <span>Credit Bonus Amount</span>
              </button>
            </div>
          </form>
        )}

        {activeSubTab === 'penalties' && (
          <form onSubmit={(e) => handleBonusPenaltySubmit(e, 'penalty')} className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <MinusCircle className="w-5 h-5 text-rose-500 animate-pulse" />
              <div>
                <h4 className="font-bold text-sm text-slate-200">Impose Penalty / SLA Deduction</h4>
                <p className="text-[10px] text-slate-400">Impose fines for late deliveries, cancellations, or bad behavior</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">1. Target Partner Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['rider', 'vendor', 'employee'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setTargetType(type);
                        setTargetId('');
                      }}
                      className={`py-2 text-[10px] font-bold rounded-xl border transition uppercase ${
                        targetType === type 
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                          : 'bg-slate-950/40 text-slate-400 border-slate-850 hover:bg-slate-950/80'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">2. Select Target Partner</label>
                <select
                  required
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-rose-500 transition"
                >
                  <option value="">Select target...</option>
                  {getTargets().map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">3. Penalty / Fine Amount (₹)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="200"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-rose-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">4. Violation / Penalty Reason</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., SLA Delay over 45 mins, Gig Misbehaviour"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-rose-500 transition"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-850 flex justify-between items-center">
              <span className="text-[9px] text-rose-500 font-bold uppercase flex items-center gap-1">
                <AlertOctagon className="w-3.5 h-3.5" />
                This will deduct wallet balance immediately!
              </span>
              <button
                type="submit"
                className="bg-rose-600 hover:bg-rose-500 text-slate-100 font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition shadow-lg shadow-rose-500/10"
              >
                <span>Deduct Penalty Fine</span>
              </button>
            </div>
          </form>
        )}

        {activeSubTab === 'manual' && (
          <form onSubmit={handleManualModificationSubmit} className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <AlertOctagon className="w-5 h-5 text-amber-500 animate-pulse" />
              <div>
                <h4 className="font-bold text-sm text-slate-200">Force Manual Payment Override</h4>
                <p className="text-[10px] text-amber-400">Surgically alter calculations, add manual bonuses/penalties to existing ledger batches</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">1. Select Target Transaction Batch</label>
                <select
                  required
                  value={selectedTxId}
                  onChange={(e) => {
                    setSelectedTxId(e.target.value);
                    const found = transactions.find(t => t.id === e.target.value);
                    if (found) {
                      setManualNewAmount(found.amount);
                      setManualBonus(found.bonus || 0);
                      setManualPenalty(found.penalties || 0);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 transition"
                >
                  <option value="">Select a transaction...</option>
                  {transactions.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.recipientName} ({t.recipientType.toUpperCase()}) - Current Amt: ₹{t.amount} ({t.status.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {selectedTxId && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">2. Modify Base Payout Amount (₹)</label>
                    <input
                      type="number"
                      required
                      value={manualNewAmount || ''}
                      onChange={(e) => setManualNewAmount(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">3. Adjust Custom Bonus (₹)</label>
                    <input
                      type="number"
                      value={manualBonus || ''}
                      onChange={(e) => setManualBonus(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">4. Adjust Custom Penalty Fine (₹)</label>
                    <input
                      type="number"
                      value={manualPenalty || ''}
                      onChange={(e) => setManualPenalty(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-rose-400 uppercase font-bold">5. MANDATORY Override Reason (audit log)</label>
                    <input
                      type="text"
                      required
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      placeholder="e.g., Recalculated due to delay dispute from Hub"
                      className="w-full bg-slate-950 border border-rose-500/20 rounded-xl p-2.5 text-xs text-slate-150 outline-none focus:border-rose-500 transition"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="pt-2 border-t border-slate-850 flex justify-between items-center">
              <span className="text-[9px] text-amber-500 font-bold uppercase flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                This action is permanently logged!
              </span>
              <button
                type="submit"
                disabled={!selectedTxId}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-30 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition shadow-lg"
              >
                <span>Commit Override Adjustments</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* SECURITY AUDIT LEDGER (1 Col) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 lg:col-span-1 flex flex-col h-full justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <h4 className="font-bold text-xs text-slate-200">Payment Overrides Ledger</h4>
          </div>
          <p className="text-[10px] text-slate-500 leading-normal">
            Real-time secure audit logs for all adjustments made manually by system administrators.
          </p>

          <div className="space-y-2 max-h-[340px] overflow-y-auto">
            {auditLogs.map(log => (
              <div key={log.id} className="p-3 rounded-2xl bg-slate-950/40 border border-slate-850 text-[10px] space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-amber-500 font-mono uppercase">{log.action}</span>
                  <span className="text-[8px] text-slate-500 font-mono">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                </div>
                
                <p className="text-slate-300 font-bold">Amt: ₹{log.previousAmount} ➔ ₹{log.newAmount}</p>
                <p className="text-slate-400 italic text-[9px] leading-snug">" {log.notes} "</p>
                
                <div className="flex justify-between items-center text-[8px] text-slate-500 pt-1 border-t border-slate-850/40">
                  <span>By: {log.adminName}</span>
                  <span className="font-mono text-emerald-500 flex items-center gap-0.5">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Checked
                  </span>
                </div>
              </div>
            ))}
            {auditLogs.length === 0 && (
              <div className="p-8 text-center text-slate-600 text-xs italic">
                No manual overrides recorded in this session.
              </div>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-850 flex items-center justify-between text-[9px] text-slate-500 font-mono">
          <span>Integrity Node ID: TT-AUDIT-BHP</span>
          <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase">SECURE</span>
        </div>
      </div>

    </div>
  );
}
