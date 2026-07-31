import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, updateDoc, collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { Restaurant, RestaurantSettlement } from '../../types';
import { exportToPDF, exportToExcel, printReport } from '../../services/exportService';
import { sendNotification } from '../../services/notificationService';
import {
  Wallet,
  DollarSign,
  TrendingUp,
  Lock,
  Unlock,
  FileSpreadsheet,
  FileText,
  Printer,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  CreditCard,
  Percent,
} from 'lucide-react';

interface FinancialSettlementsTabProps {
  restaurant: Restaurant;
  onUpdate: () => void;
  logAdminAction: (action: string, details: string, beforeVal?: any, afterVal?: any) => Promise<void>;
}

export default function FinancialSettlementsTab({
  restaurant,
  onUpdate,
  logAdminAction,
}: FinancialSettlementsTabProps) {
  const [settlements, setSettlements] = useState<RestaurantSettlement[]>([]);
  const [holdReason, setHoldReason] = useState(restaurant.holdReason || '');
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [isNewSettlementModalOpen, setIsNewSettlementModalOpen] = useState(false);

  // New settlement form state
  const [newAmount, setNewAmount] = useState('');
  const [newGross, setNewGross] = useState('');
  const [newCommission, setNewCommission] = useState('');
  const [newRefId, setNewRefId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real-time listener for settlements
  useEffect(() => {
    if (!restaurant.id) return;
    const q = query(collection(db, 'restaurantSettlements'), where('restaurantId', '==', restaurant.id));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: RestaurantSettlement[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as RestaurantSettlement);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSettlements(list);
    });
    return () => unsub();
  }, [restaurant.id]);

  // Toggle Settlement Hold
  const handleToggleHold = async (shouldHold: boolean) => {
    if (shouldHold && !holdReason.trim()) {
      alert('Please enter a valid reason for placing settlement on hold.');
      return;
    }

    setIsSubmitting(true);
    try {
      const restRef = doc(db, 'restaurants', restaurant.id);
      const now = new Date().toISOString();

      await updateDoc(restRef, {
        settlementHold: shouldHold,
        holdReason: shouldHold ? holdReason.trim() : '',
        updatedAt: now,
      });

      await logAdminAction(
        shouldHold ? 'SETTLEMENT_HOLD' : 'SETTLEMENT_RELEASE',
        `${shouldHold ? 'Placed' : 'Released'} settlement hold for ${restaurant.name}. ${
          shouldHold ? 'Reason: ' + holdReason : ''
        }`
      );

      await sendNotification({
        recipientId: restaurant.id,
        recipientName: restaurant.name,
        recipientType: 'restaurant',
        title: shouldHold ? 'Settlement On Hold' : 'Settlement Hold Released',
        message: shouldHold
          ? `Settlements have been paused by Master Admin. Reason: ${holdReason}`
          : 'Your account settlements are active again.',
        type: shouldHold ? 'security' : 'settlement',
      });

      alert(shouldHold ? 'Settlements placed on hold.' : 'Settlement hold released.');
      setIsHoldModalOpen(false);
      onUpdate();
    } catch (err: any) {
      alert('Error toggling hold state: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Process New Manual Settlement Payout
  const handleCreateSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (restaurant.settlementHold) {
      alert('Cannot process settlement while account is on HOLD.');
      return;
    }
    if (!newAmount || Number(newAmount) <= 0) {
      alert('Please enter a valid settlement amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const settlementData = {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        amount: Number(newAmount),
        grossSales: Number(newGross) || Number(newAmount),
        commissionDeducted: Number(newCommission) || 0,
        packagingFees: 0,
        status: 'completed',
        referenceId: newRefId.trim() || 'REF_' + Date.now(),
        periodStart: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
        periodEnd: new Date().toISOString().split('T')[0],
        createdAt: now,
        processedAt: now,
      };

      await addDoc(collection(db, 'restaurantSettlements'), settlementData);

      // Deduct from pending settlement or update completed settlement
      const restRef = doc(db, 'restaurants', restaurant.id);
      await updateDoc(restRef, {
        completedSettlement: (restaurant.completedSettlement || 0) + Number(newAmount),
        pendingSettlement: Math.max(0, (restaurant.pendingSettlement || 0) - Number(newAmount)),
        updatedAt: now,
      });

      await logAdminAction(
        'PROCESS_SETTLEMENT',
        `Processed ₹${newAmount} settlement payout for ${restaurant.name} (Ref: ${settlementData.referenceId})`
      );

      await sendNotification({
        recipientId: restaurant.id,
        recipientName: restaurant.name,
        recipientType: 'restaurant',
        title: 'Payout Processed Successfully',
        message: `Payout of ₹${newAmount} has been processed to your bank account (${restaurant.bankName} - ${restaurant.accountNumber}). Ref: ${settlementData.referenceId}`,
        type: 'settlement',
      });

      alert('Settlement processed successfully!');
      setIsNewSettlementModalOpen(false);
      setNewAmount('');
      setNewGross('');
      setNewCommission('');
      setNewRefId('');
      onUpdate();
    } catch (err: any) {
      alert('Error creating settlement: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export to PDF
  const handleExportPDF = () => {
    const headers = ['Settlement ID', 'Gross Sales', 'Commission', 'Payout Amount', 'Status', 'Date'];
    const rows = settlements.map((s) => [
      s.id.substring(0, 10),
      `Rs.${s.grossSales || 0}`,
      `Rs.${s.commissionDeducted || 0}`,
      `Rs.${s.amount || 0}`,
      s.status.toUpperCase(),
      new Date(s.createdAt).toLocaleDateString(),
    ]);
    exportToPDF(`Settlement History - ${restaurant.name}`, headers, rows, `${restaurant.name}_settlements`);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const excelData = settlements.map((s) => ({
      'Settlement ID': s.id,
      'Restaurant Name': restaurant.name,
      'Gross Sales (₹)': s.grossSales,
      'Commission Deducted (₹)': s.commissionDeducted,
      'Net Payout Amount (₹)': s.amount,
      'Status': s.status,
      'Reference ID': s.referenceId || 'N/A',
      'Processed Date': s.processedAt ? new Date(s.processedAt).toLocaleString() : 'N/A',
    }));
    exportToExcel(excelData, `${restaurant.name}_Settlements`, 'Settlements');
  };

  // Print Report
  const handlePrint = () => {
    const tableRows = settlements
      .map(
        (s) => `
      <tr>
        <td>${s.referenceId || s.id}</td>
        <td>₹${s.grossSales || 0}</td>
        <td>₹${s.commissionDeducted || 0}</td>
        <td><strong>₹${s.amount}</strong></td>
        <td><span class="badge ${s.status === 'completed' ? 'badge-success' : 'badge-warning'}">${s.status}</span></td>
        <td>${new Date(s.createdAt).toLocaleDateString()}</td>
      </tr>
    `
      )
      .join('');

    const html = `
      <h3>Merchant Bank Account: ${restaurant.bankName} (${restaurant.accountNumber}) | IFSC: ${restaurant.ifscCode}</h3>
      <table>
        <thead>
          <tr>
            <th>Ref / ID</th>
            <th>Gross Sales</th>
            <th>Commission Deducted</th>
            <th>Payout Amount</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;
    printReport(`Settlement Statement - ${restaurant.name}`, html);
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Wallet Balance */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-md">
          <span className="text-[10px] font-mono font-bold uppercase text-slate-400 flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5 text-orange-400" /> Wallet Balance
          </span>
          <p className="text-xl font-bold font-mono text-slate-100">₹{(restaurant.walletBalance || 0).toLocaleString()}</p>
        </div>

        {/* Pending Settlement */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-md">
          <span className="text-[10px] font-mono font-bold uppercase text-slate-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> Pending Settlement
          </span>
          <p className="text-xl font-bold font-mono text-amber-400">₹{(restaurant.pendingSettlement || 0).toLocaleString()}</p>
        </div>

        {/* Completed Settlement */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-md">
          <span className="text-[10px] font-mono font-bold uppercase text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Total Paid Out
          </span>
          <p className="text-xl font-bold font-mono text-emerald-400">₹{(restaurant.completedSettlement || 0).toLocaleString()}</p>
        </div>

        {/* Commission Rate */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-md">
          <span className="text-[10px] font-mono font-bold uppercase text-slate-400 flex items-center gap-1">
            <Percent className="w-3.5 h-3.5 text-cyan-400" /> Platform Commission
          </span>
          <p className="text-xl font-bold font-mono text-cyan-400">{restaurant.commissionPercentage || 15}%</p>
        </div>
      </div>

      {/* Account Bank & Hold Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div className="space-y-1">
          <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-orange-400" /> Registered Settlement Bank Account
          </h4>
          <p className="text-xs text-slate-400 font-mono">
            {restaurant.bankName} | Holder: {restaurant.accountHolderName || restaurant.ownerName} | Acc: {restaurant.accountNumber} | IFSC: {restaurant.ifscCode} | UPI: {restaurant.upiId}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {restaurant.settlementHold ? (
            <button
              onClick={() => handleToggleHold(false)}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Unlock className="w-4 h-4" /> Release Hold
            </button>
          ) : (
            <button
              onClick={() => setIsHoldModalOpen(true)}
              className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-4 h-4" /> Place On Hold
            </button>
          )}

          <button
            onClick={() => setIsNewSettlementModalOpen(true)}
            disabled={restaurant.settlementHold}
            className="bg-orange-500 hover:bg-orange-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" /> Process Payout
          </button>
        </div>
      </div>

      {restaurant.settlementHold && (
        <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl text-xs text-rose-300 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <span className="font-bold uppercase font-mono">Settlement Hold Active:</span>
            <p className="text-slate-300 mt-0.5">{restaurant.holdReason || 'Flagged for compliance review.'}</p>
          </div>
        </div>
      )}

      {/* Settlements History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-orange-400" /> Settlement & Payout Statement History
          </h4>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold transition border border-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold transition border border-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-rose-400" /> PDF
            </button>
            <button
              onClick={handlePrint}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold transition border border-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-400" /> Print
            </button>
          </div>
        </div>

        {settlements.length === 0 ? (
          <p className="text-xs text-slate-500 italic text-center p-6">No payouts or settlements recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
                  <th className="p-3">Reference / ID</th>
                  <th className="p-3">Gross Sales</th>
                  <th className="p-3">Commission ({restaurant.commissionPercentage || 15}%)</th>
                  <th className="p-3">Net Payout</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Processed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {settlements.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-850/50 transition">
                    <td className="p-3 font-mono text-slate-300 font-bold">{item.referenceId || item.id.substring(0, 10)}</td>
                    <td className="p-3 font-mono text-slate-200">₹{(item.grossSales || 0).toLocaleString()}</td>
                    <td className="p-3 font-mono text-rose-400">₹{(item.commissionDeducted || 0).toLocaleString()}</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">₹{item.amount.toLocaleString()}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                          item.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : item.status === 'on_hold'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-400">{new Date(item.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Hold Settlement Reason Input */}
      {isHoldModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-6 space-y-4 shadow-2xl">
            <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Lock className="w-5 h-5 text-rose-400" /> Place Account Settlement On Hold
            </h4>
            <p className="text-xs text-slate-400">
              Enter mandatory hold reason for <span className="text-orange-400 font-bold">{restaurant.name}</span>.
            </p>

            <textarea
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              placeholder="Reason for settlement hold (e.g., GST Verification Pending / Fraud Alert / Customer Dispute)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 outline-none focus:border-rose-500 h-28 resize-none"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsHoldModalOpen(false)}
                className="bg-slate-800 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleToggleHold(true)}
                disabled={isSubmitting || !holdReason.trim()}
                className="bg-rose-500 hover:bg-rose-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer disabled:opacity-40"
              >
                Confirm Hold
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Process New Settlement Payout */}
      {isNewSettlementModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <form onSubmit={handleCreateSettlement} className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-6 space-y-4 shadow-2xl">
            <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-orange-400" /> Process Bank Settlement Payout
            </h4>
            <p className="text-xs text-slate-400">
              Create a direct bank payout transaction record for <span className="text-orange-400 font-bold">{restaurant.name}</span>.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Gross Sales Amount (₹)</label>
                <input
                  type="number"
                  value={newGross}
                  onChange={(e) => setNewGross(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Commission Deducted (₹)</label>
                <input
                  type="number"
                  value={newCommission}
                  onChange={(e) => setNewCommission(e.target.value)}
                  placeholder="e.g. 750"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Net Payout Amount (₹) *</label>
                <input
                  type="number"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="e.g. 4250"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-orange-500 font-bold font-mono text-emerald-400"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Bank Reference / UTR Number</label>
                <input
                  type="text"
                  value={newRefId}
                  onChange={(e) => setNewRefId(e.target.value)}
                  placeholder="e.g. UTR1293849102"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewSettlementModalOpen(false)}
                className="bg-slate-800 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer disabled:opacity-40"
              >
                Execute Payout
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
