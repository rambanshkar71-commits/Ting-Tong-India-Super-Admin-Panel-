import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  setDoc, 
  getDoc,
  runTransaction
} from 'firebase/firestore';
import { Order } from '../../types';
import { 
  X, 
  DollarSign, 
  CheckCircle, 
  AlertCircle,
  HelpCircle,
  TrendingDown,
  Loader2
} from 'lucide-react';

interface RefundDialogProps {
  order: Order;
  conversationId: string;
  conversationType: 'chat' | 'ticket';
  onClose: () => void;
}

export default function RefundDialog({ 
  order, 
  conversationId, 
  conversationType, 
  onClose 
}: RefundDialogProps) {
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundReason, setRefundReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize refund amount when type changes
  useEffect(() => {
    if (refundType === 'full') {
      setRefundAmount(order.totalAmount.toString());
    } else {
      setRefundAmount('');
    }
  }, [refundType, order.totalAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amount = refundType === 'full' ? order.totalAmount : parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0 || amount > order.totalAmount) {
      setError(`Please enter a valid refund amount up to ₹${order.totalAmount}`);
      return;
    }

    if (!refundReason.trim()) {
      setError("Please specify a reason for the refund.");
      return;
    }

    setLoading(true);
    try {
      const txnId = `TT-REFUND-${Math.floor(10000000 + Math.random() * 90000000)}`;

      await runTransaction(db, async (transaction) => {
        // 1. Update Customer's wallet balance
        const custRef = doc(db, 'customers', order.customerId);
        const custDoc = await transaction.get(custRef);

        let newBal = amount;
        if (custDoc.exists()) {
          const currentBal = custDoc.data().walletBalance || 0;
          newBal = currentBal + amount;
          transaction.update(custRef, { walletBalance: newBal });
        } else {
          // If customer doc doesn't exist, we can create it or log error. 
          // For safety in this app, we'll set it
          transaction.set(custRef, { 
            id: order.customerId,
            name: order.customerName,
            walletBalance: amount 
          }, { merge: true });
        }

        // 2. Add refund action record
        const refundActionRef = doc(collection(db, 'refund_actions'));
        transaction.set(refundActionRef, {
          orderId: order.id,
          customerId: order.customerId,
          customerName: order.customerName,
          refundAmount: amount,
          refundType,
          reason: refundReason.trim(),
          refundMode: 'auto',
          refundMethod: 'wallet',
          transactionId: txnId,
          processedAt: new Date().toISOString(),
          processedBy: 'Ting Tong Support Team',
          status: 'completed'
        });

        // 3. Add refund record to global 'refunds' collection for Financials View
        const refundRecordRef = doc(collection(db, 'refunds'));
        transaction.set(refundRecordRef, {
          orderId: order.id,
          customerId: order.customerId,
          customerName: order.customerName,
          amount: amount,
          refundType,
          reason: refundReason.trim(),
          refundMode: 'auto',
          refundMethod: 'wallet',
          transactionId: txnId,
          createdAt: new Date().toISOString(),
          processedBy: 'Ting Tong Support Team',
          status: 'completed'
        });

        // 4. Update order status & paymentStatus to refunded
        const orderRef = doc(db, 'orders', order.id);
        transaction.update(orderRef, {
          status: 'refunded',
          paymentStatus: 'refunded',
          updatedAt: new Date().toISOString()
        });

        // 5. Send message into chat/ticket thread
        const msgText = `💰 SUPPORT REFUND ISSUED: ₹${amount.toFixed(2)} (${refundType === 'full' ? 'Full' : 'Partial'}) refund processed atomically to customer wallet.\n• Txn ID: ${txnId}\n• Reason: ${refundReason.trim()}`;
        
        if (conversationType === 'chat') {
          const chatMsgRef = doc(collection(db, 'chat_messages'));
          transaction.set(chatMsgRef, {
            id: chatMsgRef.id,
            sessionId: conversationId,
            senderId: 'admin_bhopal',
            senderName: 'Ting Tong Support System',
            senderRole: 'admin',
            text: msgText,
            sentAt: new Date().toISOString(),
            readBy: ['admin_bhopal']
          });

          const sessionRef = doc(db, 'chat_sessions', conversationId);
          transaction.update(sessionRef, {
            lastMessageText: `💰 Refund: ₹${amount}`,
            lastMessageTime: new Date().toISOString()
          });
        } else {
          const ticketMsgRef = doc(collection(db, 'ticket_messages'));
          transaction.set(ticketMsgRef, {
            id: ticketMsgRef.id,
            ticketId: conversationId,
            senderId: 'admin_bhopal',
            senderName: 'Ting Tong Support System',
            senderRole: 'admin',
            text: msgText,
            sentAt: new Date().toISOString(),
            readBy: ['admin_bhopal']
          });
        }
      });

      alert(`✓ Refund of ₹${amount} successfully processed! Customer wallet balance has been credited in real-time.`);
      onClose();
    } catch (err: any) {
      console.error("Refund transaction failed: ", err);
      setError(err.message || "An error occurred during refund transaction.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="refund-dialog-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div 
        id="refund-dialog-container" 
        className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-3xl p-6 text-slate-100 relative shadow-2xl animate-scale-in"
      >
        <button 
          id="refund-dialog-close-btn"
          type="button"
          onClick={onClose} 
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="border-b border-slate-800 pb-3 mb-4">
          <h3 className="text-sm font-black text-slate-200 flex items-center gap-2 uppercase tracking-wide">
            <DollarSign className="w-5 h-5 text-amber-500" /> Operational Support Refund
          </h3>
          <p className="text-xs text-slate-400 mt-1">Issue a secure real-time refund to the customer's platform wallet.</p>
        </div>

        {/* Order Info Card */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 space-y-2 mb-4 text-xs">
          <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-mono font-bold">
            <span>Order Reference</span>
            <span>Status</span>
          </div>
          <div className="flex justify-between items-center font-bold">
            <span className="text-slate-200">#{order.id}</span>
            <span className="text-amber-500 uppercase font-mono text-[10px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {order.status}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900 text-slate-400">
            <div>
              <p className="text-[10px] text-slate-500">Customer</p>
              <p className="font-semibold text-slate-300 truncate">{order.customerName}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500">Total Amount</p>
              <p className="font-mono font-bold text-emerald-400">₹{order.totalAmount}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs flex items-start gap-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-tight">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Selector: Full / Partial */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-slate-400 block tracking-wider">Refund Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRefundType('full')}
                className={`py-2.5 px-3 rounded-xl border text-center font-bold text-xs transition cursor-pointer flex flex-col justify-center items-center gap-1 ${
                  refundType === 'full'
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-500'
                    : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800'
                }`}
              >
                <span>Full Refund</span>
                <span className="text-[10px] font-mono text-slate-500">₹{order.totalAmount}</span>
              </button>
              <button
                type="button"
                onClick={() => setRefundType('partial')}
                className={`py-2.5 px-3 rounded-xl border text-center font-bold text-xs transition cursor-pointer flex flex-col justify-center items-center gap-1 ${
                  refundType === 'partial'
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-500'
                    : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800'
                }`}
              >
                <span>Partial Refund</span>
                <span className="text-[10px] font-mono text-slate-500">Custom Amount</span>
              </button>
            </div>
          </div>

          {/* Amount input for partial */}
          {refundType === 'partial' && (
            <div className="space-y-1.5 animate-fade-in">
              <label className="text-[10px] uppercase font-black text-slate-400 block tracking-wider">Refund Amount (₹)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-500">₹</span>
                <input
                  type="number"
                  step="0.01"
                  max={order.totalAmount}
                  min={1}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder={`Enter amount up to ₹${order.totalAmount}`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-7 pr-4 text-xs text-slate-100 outline-none focus:border-amber-500 font-mono"
                  required
                />
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-black text-slate-400 block tracking-wider">Reason for Refund</label>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Provide a detailed explanation for this operational refund..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 outline-none focus:border-amber-500 h-24 resize-none leading-relaxed"
              required
            />
            {/* Quick Suggestions */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                'SLA delay breached',
                'Incorrect items delivered',
                'Quality issues',
                'Customer cancel adjustment'
              ].map(suggestion => (
                <button
                  type="button"
                  key={suggestion}
                  onClick={() => setRefundReason(suggestion)}
                  className="bg-slate-950 hover:bg-slate-900 border border-slate-850 text-[10px] text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing Transaction...</span>
              </>
            ) : (
              <span>Approve & Issue Refund</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
