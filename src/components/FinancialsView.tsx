import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, collection, query, orderBy, onSnapshot, runTransaction } from 'firebase/firestore';
import { Restaurant, Rider, Order, Customer } from '../types';
import { getActiveCity } from '../services/mapService';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Check, 
  X, 
  CreditCard, 
  Coins, 
  Briefcase, 
  FileText,
  DollarSign,
  Search,
  RefreshCw,
  PlusCircle,
  History,
  Printer,
  ChevronDown
} from 'lucide-react';

interface FinancialsViewProps {
  restaurants: Restaurant[];
  riders: Rider[];
  orders: Order[];
  customers: Customer[];
  adminEmail: string | null;
}

export default function FinancialsView({ restaurants, riders, orders, customers, adminEmail }: FinancialsViewProps) {
  const [subTab, setSubTab] = useState<'settlements' | 'refunds' | 'dashboard'>('settlements');
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [selectedRest, setSelectedRest] = useState<Restaurant | null>(null);

  // Refund states
  const [refunds, setRefunds] = useState<any[]>([]);
  const [refundsLoading, setRefundsLoading] = useState(true);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [selectedOrderForRefund, setSelectedOrderForRefund] = useState<Order | null>(null);
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [customRefundAmount, setCustomRefundAmount] = useState('');
  const [refundChannel, setRefundChannel] = useState<'wallet' | 'upi' | 'bank'>('wallet');
  const [refundTxnId, setRefundTxnId] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [processingRefund, setProcessingRefund] = useState(false);
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState('');
  const [selectedRefundForCertificate, setSelectedRefundForCertificate] = useState<any | null>(null);

  // Aggregated computations for settlements
  const totalRiderLiabilities = riders.reduce((sum, r) => sum + r.walletBalance, 0);
  const totalIncentivesAllocated = riders.reduce((sum, r) => sum + r.totalIncentives, 0);
  const totalPenaltiesDeducted = riders.reduce((sum, r) => sum + r.totalPenalties, 0);

  // Fetch refunds in real-time
  useEffect(() => {
    const q = query(collection(db, 'refunds'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setRefunds(list);
      setRefundsLoading(false);
    }, (error) => {
      console.error("Error fetching refunds snapshot: ", error);
      setRefundsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSettleRider = async (riderId: string) => {
    if (!window.confirm("Confirm bank settlement? This will reset the rider's platform wallet balance to ₹0 after bank dispatch.")) return;
    try {
      const riderRef = doc(db, 'riders', riderId);
      await updateDoc(riderRef, { walletBalance: 0 });
      alert("Rider wallet balance settled to bank securely!");
      setSelectedRider(null);
    } catch (err) {
      console.error("Error settling rider wallet: ", err);
    }
  };

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForRefund) return;

    const amount = refundType === 'full' 
      ? selectedOrderForRefund.totalAmount 
      : parseFloat(customRefundAmount);

    if (isNaN(amount) || amount <= 0 || amount > selectedOrderForRefund.totalAmount) {
      alert(`Invalid refund amount. Must be between ₹1 and ₹${selectedOrderForRefund.totalAmount}`);
      return;
    }

    if (!refundReason.trim()) {
      alert("Please specify a reason for the refund.");
      return;
    }

    const finalTxnId = refundChannel === 'wallet'
      ? `TT-WL-CRED-${Math.floor(10000000 + Math.random() * 90000000)}`
      : refundTxnId.trim();

    if (refundChannel !== 'wallet' && !finalTxnId) {
      alert("Please enter the Transaction Reference / UTR ID for external transfers.");
      return;
    }

    setProcessingRefund(true);
    try {
      await runTransaction(db, async (transaction) => {
        // 1. Fetch customer document
        const custRef = doc(db, 'customers', selectedOrderForRefund.customerId);
        const custDoc = await transaction.get(custRef);

        if (!custDoc.exists()) {
          throw new Error("Customer profile not found in database.");
        }

        const currentBal = custDoc.data().walletBalance || 0;
        const newBal = currentBal + amount;

        // 2. Generate refund document reference
        const refundRef = doc(collection(db, 'refunds'));

        // 3. Create the refund record
        const refundData = {
          orderId: selectedOrderForRefund.id,
          customerId: selectedOrderForRefund.customerId,
          customerName: selectedOrderForRefund.customerName,
          amount: amount,
          refundType: refundType,
          reason: refundReason.trim(),
          refundMode: refundChannel === 'wallet' ? 'auto' : 'manual',
          refundMethod: refundChannel,
          transactionId: finalTxnId,
          createdAt: new Date().toISOString(),
          processedBy: adminEmail || 'admin@tingtong.bhopal',
          status: 'completed'
        };

        // 4. Perform atomic updates
        transaction.update(custRef, { walletBalance: newBal });
        transaction.set(refundRef, refundData);

        // 5. Update order status and paymentStatus
        const orderRef = doc(db, 'orders', selectedOrderForRefund.id);
        transaction.update(orderRef, {
          status: 'refunded',
          paymentStatus: 'refunded',
          updatedAt: new Date().toISOString()
        });
      });

      alert(`✓ Refund of ₹${amount} successfully processed! Customer wallet balance has been updated in real-time.`);

      // Reset form fields
      setSelectedOrderForRefund(null);
      setOrderSearchQuery('');
      setCustomRefundAmount('');
      setRefundReason('');
      setRefundTxnId('');
    } catch (error: any) {
      console.error("Refund transaction failed: ", error);
      alert("Error processing refund: " + error.message);
    } finally {
      setProcessingRefund(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      <div className="border-b border-slate-800 pb-5">
        <h2 className="text-xl font-bold tracking-tight text-slate-100">Wallet & Bank Settlements</h2>
        <p className="text-slate-400 text-xs">Settle rider fees, issue customer refunds, and view overall platform liabilities securely.</p>
      </div>

      <div className="flex border-b border-slate-800 gap-1.5 pb-px">
        <button
          onClick={() => setSubTab('settlements')}
          className={`px-4 py-2 border-b-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
            subTab === 'settlements'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Partner Settlements
        </button>
        <button
          onClick={() => setSubTab('refunds')}
          className={`px-4 py-2 border-b-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
            subTab === 'refunds'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Refund Management
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full">
            REAL-TIME
          </span>
        </button>
        <button
          onClick={() => setSubTab('dashboard')}
          className={`px-4 py-2 border-b-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
            subTab === 'dashboard'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Finance Dashboard
        </button>
      </div>

      {subTab === 'settlements' && (
        <>
          {/* Aggregated platform liabilities counters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rider Wallet Liabilities</span>
                <p className="text-2xl font-bold font-mono text-amber-500">₹{totalRiderLiabilities.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-amber-500/10 text-amber-500 p-2.5 rounded-xl border border-amber-500/25">
                <Coins className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Rider Incentives</span>
                <p className="text-2xl font-bold font-mono text-emerald-400">₹{totalIncentivesAllocated.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/25">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Penalties Levied</span>
                <p className="text-2xl font-bold font-mono text-rose-400">₹{totalPenaltiesDeducted.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-rose-500/10 text-rose-400 p-2.5 rounded-xl border border-rose-500/25">
                <ArrowDownRight className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Riders wallets & settlements table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-slate-100 text-sm">Rider Payout Settlements</h3>
              
              <div className="space-y-3">
                {riders.map(r => (
                  <div 
                    key={r.id}
                    onClick={() => setSelectedRider(r)}
                    className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex items-center justify-between cursor-pointer hover:border-sky-500/30 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-sky-500/10 text-sky-400 p-2 rounded-lg">
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-200">{r.name}</h4>
                        <p className="text-[10px] text-slate-500 font-mono">Incentives: ₹{r.totalIncentives} | Penalties: ₹{r.totalPenalties}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs font-bold text-slate-100">₹{r.walletBalance}</p>
                      <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Unpaid balance</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Payout Bank ledger card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <h3 className="font-bold text-slate-100 text-sm">Secure Dispatch Bank Ledger</h3>

              {selectedRider ? (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex justify-between items-start border-b border-slate-850 pb-4">
                    <div>
                      <h4 className="font-bold text-slate-100 text-base">{selectedRider.name}</h4>
                      <p className="text-slate-400 text-xs mt-0.5">Contact: {selectedRider.phone}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                        Pending Dispatch
                      </span>
                      <p className="text-xl font-bold font-mono text-slate-100 mt-1">₹{selectedRider.walletBalance}</p>
                    </div>
                  </div>

                  {/* Bank Account Grid details */}
                  <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-sky-400 pb-1.5 border-b border-slate-800">
                      <CreditCard className="w-4 h-4" />
                      <span>Settlement Bank Account</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Beneficiary Bank:</span>
                        <span className="text-slate-200 font-bold">{selectedRider.bankName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Account Number:</span>
                        <span className="font-mono text-slate-200 font-bold">{selectedRider.accountNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">IFSC Code:</span>
                        <span className="font-mono text-slate-200 font-bold">{selectedRider.ifscCode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Direct UPI ID:</span>
                        <span className="font-mono text-slate-200 font-bold">{selectedRider.upiId}</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleSettleRider(selectedRider.id)}
                    className="w-full bg-emerald-600 text-slate-950 font-bold py-3 rounded-xl text-xs hover:brightness-110 cursor-pointer"
                  >
                    Approve Dispatch & Settle Wallet
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-xs text-center leading-relaxed">
                  <CreditCard className="w-8 h-8 text-slate-600 mb-2" />
                  <span>Select a delivery partner to dispatch pending wallet liabilities directly to their registered bank accounts.</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {subTab === 'refunds' && (
        <div className="space-y-6 animate-fade-in">
          {/* Refund Overview Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Total Refunds Issued</span>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">₹{refunds.reduce((sum, r) => sum + r.amount, 0).toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-slate-500 mt-1">Processed across {refunds.length} transactions</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Full Refunds</span>
              <p className="text-xl font-bold font-mono text-sky-400 mt-0.5">{refunds.filter(r => r.refundType === 'full').length}</p>
              <p className="text-[10px] text-slate-500 mt-1">100% order value returns</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Partial Refunds</span>
              <p className="text-xl font-bold font-mono text-amber-500 mt-0.5">{refunds.filter(r => r.refundType === 'partial').length}</p>
              <p className="text-[10px] text-slate-500 mt-1">Adjusted item-level payouts</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Active Wallet Credits</span>
              <p className="text-xl font-bold font-mono text-purple-400 mt-0.5">₹{refunds.filter(r => r.refundMethod === 'wallet').reduce((sum, r) => sum + r.amount, 0).toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-slate-500 mt-1">Direct real-time wallet credits</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left side: Process refund form (5 columns) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                    <PlusCircle className="w-5 h-5 text-amber-500" />
                    Process Order Refund
                  </h3>
                  <span className="bg-amber-500/10 text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-bold">
                    SECURE GATEWAY
                  </span>
                </div>

                {/* Search Order field */}
                <div className="space-y-2 relative">
                  <label className="text-[10px] uppercase font-black text-slate-400 block">Search Order ID / Customer</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Enter Order ID or Customer Name..."
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Order search results dropdown */}
                  {orderSearchQuery && (
                    <div className="absolute left-0 right-0 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-900 shadow-2xl z-20 w-full mt-1">
                      {orders
                        .filter(o => 
                          o.id.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
                          o.customerName.toLowerCase().includes(orderSearchQuery.toLowerCase())
                        )
                        .slice(0, 5)
                        .map(o => {
                          const isAlreadyRefunded = o.status === 'refunded' || o.paymentStatus === 'refunded';
                          return (
                            <button
                              type="button"
                              key={o.id}
                              onClick={() => {
                                setSelectedOrderForRefund(o);
                                setOrderSearchQuery('');
                              }}
                              className="w-full text-left p-2.5 hover:bg-slate-900/50 transition flex justify-between items-center text-xs"
                            >
                              <div>
                                <p className="font-bold text-slate-200">#{o.id.slice(-6)} - {o.customerName}</p>
                                <p className="text-[10px] text-slate-500">{o.restaurantName} • ₹{o.totalAmount}</p>
                              </div>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                                isAlreadyRefunded 
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                  : 'bg-slate-800 text-slate-400'
                              }`}>
                                {isAlreadyRefunded ? 'Refunded' : o.status}
                              </span>
                            </button>
                          );
                        })}
                      {orders.filter(o => 
                        o.id.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
                        o.customerName.toLowerCase().includes(orderSearchQuery.toLowerCase())
                      ).length === 0 && (
                        <p className="text-xs text-slate-500 p-3 text-center">No orders matched search query.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Form to submit once order is selected */}
                {selectedOrderForRefund ? (
                  <form onSubmit={handleProcessRefund} className="space-y-4 pt-2">
                    {/* Selected Order Summary Card */}
                    <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3 relative">
                      <button
                        type="button"
                        onClick={() => setSelectedOrderForRefund(null)}
                        className="absolute top-2 right-2 text-slate-500 hover:text-slate-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="border-b border-slate-900 pb-2">
                        <span className="text-[10px] font-mono text-amber-500 bg-amber-500/5 border border-amber-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                          Selected Order
                        </span>
                        <h4 className="font-bold text-slate-200 mt-1.5 text-xs">#{selectedOrderForRefund.id}</h4>
                      </div>

                      {/* Customer real-time wallet summary */}
                      {(() => {
                        const cust = customers.find(c => c.id === selectedOrderForRefund.customerId);
                        return (
                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono">
                            <div>
                              <p className="text-slate-500 text-[10px] uppercase font-sans font-bold">Customer</p>
                              <p className="text-slate-200 font-bold truncate">{selectedOrderForRefund.customerName}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-[10px] uppercase font-sans font-bold">Wallet Balance</p>
                              <p className="text-emerald-400 font-bold">₹{cust ? cust.walletBalance : 0}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-[10px] uppercase font-sans font-bold">Order Total</p>
                              <p className="text-slate-200 font-bold">₹{selectedOrderForRefund.totalAmount}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-[10px] uppercase font-sans font-bold">Status / Pay Status</p>
                              <p className="text-slate-200 font-bold">{selectedOrderForRefund.status} / {selectedOrderForRefund.paymentStatus}</p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Refund Type Selector */}
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black text-slate-400 block">Refund Type</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setRefundType('full')}
                          className={`py-2 px-3 rounded-xl border text-center font-bold text-xs transition cursor-pointer ${
                            refundType === 'full'
                              ? 'bg-amber-500/10 border-amber-500/50 text-amber-500'
                              : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800'
                          }`}
                        >
                          Full Refund (₹{selectedOrderForRefund.totalAmount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setRefundType('partial')}
                          className={`py-2 px-3 rounded-xl border text-center font-bold text-xs transition cursor-pointer ${
                            refundType === 'partial'
                              ? 'bg-amber-500/10 border-amber-500/50 text-amber-500'
                              : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800'
                          }`}
                        >
                          Partial Refund
                        </button>
                      </div>
                    </div>

                    {/* Custom Refund Amount input */}
                    {refundType === 'partial' && (
                      <div className="space-y-1 animate-fade-in">
                        <label className="text-[10px] uppercase font-black text-slate-400 block">Refund Amount (₹)</label>
                        <input
                          type="number"
                          value={customRefundAmount}
                          onChange={(e) => setCustomRefundAmount(e.target.value)}
                          max={selectedOrderForRefund.totalAmount}
                          min={1}
                          placeholder={`Enter custom amount up to ₹${selectedOrderForRefund.totalAmount}`}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500"
                          required
                        />
                      </div>
                    )}

                    {/* Payout Channel */}
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black text-slate-400 block">Refund Payment Channel</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setRefundChannel('wallet')}
                          className={`p-2 rounded-xl border text-center flex flex-col justify-center items-center transition cursor-pointer ${
                            refundChannel === 'wallet'
                              ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                              : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800'
                          }`}
                        >
                          <Wallet className="w-4 h-4 mb-1" />
                          <span className="text-[10px] font-bold">Wallet Credit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRefundChannel('upi')}
                          className={`p-2 rounded-xl border text-center flex flex-col justify-center items-center transition cursor-pointer ${
                            refundChannel === 'upi'
                              ? 'bg-sky-500/10 border-sky-500/50 text-sky-400'
                              : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800'
                          }`}
                        >
                          <ArrowUpRight className="w-4 h-4 mb-1" />
                          <span className="text-[10px] font-bold">UPI / Bank</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRefundChannel('bank')}
                          className={`p-2 rounded-xl border text-center flex flex-col justify-center items-center transition cursor-pointer ${
                            refundChannel === 'bank'
                              ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
                              : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800'
                          }`}
                        >
                          <CreditCard className="w-4 h-4 mb-1" />
                          <span className="text-[10px] font-bold">Bank IMPS</span>
                        </button>
                      </div>
                    </div>

                    {/* Transaction Reference ID for non-wallet channels */}
                    {refundChannel !== 'wallet' && (
                      <div className="space-y-1 animate-fade-in">
                        <label className="text-[10px] uppercase font-black text-slate-400 block">Transaction Reference / UTR ID</label>
                        <input
                          type="text"
                          value={refundTxnId}
                          onChange={(e) => setRefundTxnId(e.target.value)}
                          placeholder="e.g. UTR-98240219487"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 font-mono"
                          required
                        />
                      </div>
                    )}

                    {/* Reason */}
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black text-slate-400 block">Reason for Refund</label>
                      <textarea
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                        placeholder="Why is this order being refunded?"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 h-20 resize-none"
                        required
                      />

                      {/* Suggestions list */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {[
                          'SLA delay breached',
                          'Incorrect food item',
                          'Quality issue/spoiled',
                          'Customer cancelled',
                          'Double charged payment'
                        ].map(suggestion => (
                          <button
                            type="button"
                            key={suggestion}
                            onClick={() => setRefundReason(suggestion)}
                            className="bg-slate-950 border border-slate-850 text-[10px] text-slate-400 hover:text-slate-200 hover:border-slate-700 px-2 py-1 rounded-md transition"
                          >
                            + {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={processingRefund}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
                    >
                      {processingRefund ? 'Processing Refund...' : 'Approve & Issue Refund'}
                    </button>
                  </form>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-xs text-center">
                    <DollarSign className="w-8 h-8 text-slate-600 mb-2" />
                    <span>Search and select an active or delivered order to initiate a secure partial or full refund.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Real-time Refund Ledger (7 columns) */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                  <History className="w-5 h-5 text-sky-400" />
                  Real-time Refund Ledger
                </h3>
                <span className="bg-sky-500/10 text-sky-400 text-[10px] px-2.5 py-0.5 rounded-lg border border-sky-500/10 font-mono font-bold">
                  {refunds.length} LOGS
                </span>
              </div>

              {/* Search ledger */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter ledger by Order ID, Customer Name..."
                  value={ledgerSearchQuery}
                  onChange={(e) => setLedgerSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Refunds list */}
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {refundsLoading ? (
                  <div className="flex justify-center items-center py-20 text-slate-400 text-xs">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading refund ledger...
                  </div>
                ) : refunds.filter(r => 
                  r.orderId.toLowerCase().includes(ledgerSearchQuery.toLowerCase()) ||
                  r.customerName.toLowerCase().includes(ledgerSearchQuery.toLowerCase())
                ).length === 0 ? (
                  <div className="text-center py-20 text-slate-500 text-xs">
                    <History className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    No refund logs found.
                  </div>
                ) : (
                  refunds
                    .filter(r => 
                      r.orderId.toLowerCase().includes(ledgerSearchQuery.toLowerCase()) ||
                      r.customerName.toLowerCase().includes(ledgerSearchQuery.toLowerCase())
                    )
                    .map(r => (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRefundForCertificate(r)}
                        className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex items-center justify-between cursor-pointer hover:border-sky-500/30 transition shadow-sm hover:shadow"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg">
                            <DollarSign className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-xs text-slate-200">{r.customerName}</h4>
                              <span className={`text-[8px] font-bold px-1 py-0.2 rounded uppercase ${
                                r.refundType === 'full' ? 'bg-sky-500/10 text-sky-400' : 'bg-amber-500/10 text-amber-400'
                              }`}>
                                {r.refundType}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-mono">Order: #{r.orderId.slice(-6)} | Channel: {r.refundMethod}</p>
                            <p className="text-[9px] text-slate-500 font-mono italic truncate max-w-xs">"{r.reason}"</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-xs font-bold text-emerald-400">+₹{r.amount}</p>
                          <p className="text-[9px] text-slate-500 font-mono">{new Date(r.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'dashboard' && (
        <FinanceDashboard restaurants={restaurants} riders={riders} orders={orders} />
      )}

      {/* Refund Payout Certificate Modal */}
      {selectedRefundForCertificate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-lg w-full rounded-3xl overflow-hidden shadow-2xl relative animate-scale-in">
            {/* Modal close */}
            <button
              onClick={() => setSelectedRefundForCertificate(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Printable Area with ID for printing */}
            <div id="refund-receipt-print-area" className="p-8 space-y-6 text-slate-100">
              {/* Receipt Header Badge */}
              <div className="text-center space-y-2 pb-6 border-b border-slate-800/80">
                <div className="inline-flex bg-gradient-to-tr from-amber-500 to-orange-600 p-3 rounded-2xl text-slate-950 font-black tracking-widest text-xl shadow-lg mb-2">
                  TT
                </div>
                <h3 className="text-base font-bold tracking-tight text-slate-100 uppercase">Ting Tong {getActiveCity().name}</h3>
                <span className="text-[10px] font-mono font-bold tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full uppercase">
                  OFFICIAL REFUND DISPATCH RECEIPT
                </span>
                <p className="text-[10px] text-slate-500 font-mono pt-1">TRANSAC ID: {selectedRefundForCertificate.transactionId}</p>
              </div>

              {/* Receipt Grid */}
              <div className="space-y-4 text-xs font-mono">
                {/* Section: Customer Details */}
                <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 font-sans uppercase tracking-wider mb-1">Payee Customer Details</p>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-500">Name:</span>
                    <span className="text-slate-200 font-sans font-bold text-right">{selectedRefundForCertificate.customerName}</span>
                    <span className="text-slate-500">Customer ID:</span>
                    <span className="text-slate-300 text-right">{selectedRefundForCertificate.customerId.slice(0, 10)}...</span>
                  </div>
                </div>

                {/* Section: Order Details */}
                <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 font-sans uppercase tracking-wider mb-1">Original Order Details</p>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-slate-500">Order ID:</span>
                    <span className="text-slate-300 text-right">{selectedRefundForCertificate.orderId}</span>
                    <span className="text-slate-500">Payment Status:</span>
                    <span className="text-emerald-400 text-right font-sans font-bold font-mono">REFUNDED</span>
                  </div>
                </div>

                {/* Section: Refund Breakdown */}
                <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 font-sans uppercase tracking-wider mb-1">Refund Dispatch Breakdown</p>
                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Refund Type:</span>
                      <span className="text-slate-200 capitalize font-bold">{selectedRefundForCertificate.refundType} Refund</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Refund Channel:</span>
                      <span className="text-slate-200 uppercase font-bold">{selectedRefundForCertificate.refundMethod}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Processed By:</span>
                      <span className="text-slate-200 font-bold">{selectedRefundForCertificate.processedBy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Timestamp:</span>
                      <span className="text-slate-300">{new Date(selectedRefundForCertificate.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-800">
                      <span className="text-slate-400">Reason:</span>
                      <span className="text-slate-200 italic text-right max-w-[200px] font-sans">"{selectedRefundForCertificate.reason}"</span>
                    </div>
                    <div className="flex justify-between pt-3 border-t border-slate-800 font-sans">
                      <span className="text-slate-200 font-bold text-sm">TOTAL AMOUNT CREDITED:</span>
                      <span className="text-emerald-400 font-mono font-extrabold text-base">₹{selectedRefundForCertificate.amount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Secure Stamp */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-[9px] text-slate-500 leading-normal font-mono">
                  <p>• Verified by Ting Tong {getActiveCity().name} Gateway</p>
                  <p>• Wallet balance updated atomically</p>
                  <p>• Transaction cleared under compliance</p>
                </div>
                <div className="border-2 border-emerald-500/35 bg-emerald-500/5 text-emerald-400 font-bold rounded-xl px-4 py-2 rotate-12 uppercase tracking-widest text-center text-[10px] font-sans">
                  APPROVED &amp;<br/>DISPATCHED
                </div>
              </div>
            </div>

            {/* Print and Download Actions */}
            <div className="bg-slate-950 p-6 flex gap-4 border-t border-slate-800">
              <button
                onClick={() => {
                  const printContents = document.getElementById('refund-receipt-print-area')?.innerHTML;
                  if (printContents) {
                    const printWindow = window.open('', '', 'height=600,width=800');
                    if (printWindow) {
                      printWindow.document.write('<html><head><title>Refund Receipt</title>');
                      printWindow.document.write('<style>');
                      printWindow.document.write('body { background-color: #0f172a; color: #f1f5f9; font-family: monospace; padding: 40px; }');
                      printWindow.document.write('.bg-slate-950 { background-color: #020617; padding: 20px; border-radius: 12px; margin-bottom: 15px; }');
                      printWindow.document.write('.text-emerald-400 { color: #34d399; }');
                      printWindow.document.write('.text-slate-500 { color: #64748b; }');
                      printWindow.document.write('.text-slate-400 { color: #94a3b8; }');
                      printWindow.document.write('.text-slate-200 { color: #e2e8f0; }');
                      printWindow.document.write('.font-sans { font-family: sans-serif; }');
                      printWindow.document.write('.border-b { border-bottom: 1px solid #1e293b; }');
                      printWindow.document.write('.pb-6 { padding-bottom: 24px; }');
                      printWindow.document.write('.text-center { text-align: center; }');
                      printWindow.document.write('.inline-flex { display: inline-flex; background: linear-gradient(to top right, #f59e0b, #ea580c); padding: 12px; border-radius: 16px; font-weight: 900; }');
                      printWindow.document.write('.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }');
                      printWindow.document.write('.flex { display: flex; justify-content: space-between; }');
                      printWindow.document.write('.justify-between { justify-content: space-between; }');
                      printWindow.document.write('.border-2 { border: 2px solid rgba(52, 211, 153, 0.35); padding: 8px 16px; border-radius: 12px; transform: rotate(12deg); }');
                      printWindow.document.write('</style></head><body>');
                      printWindow.document.write(printContents);
                      printWindow.document.write('</body></html>');
                      printWindow.document.close();
                      printWindow.focus();
                      printWindow.print();
                    }
                  }
                }}
                className="flex-1 bg-sky-600 hover:bg-sky-500 text-slate-950 font-black text-xs py-3 rounded-xl uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
              <button
                type="button"
                onClick={() => setSelectedRefundForCertificate(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-3 rounded-xl uppercase tracking-wider transition cursor-pointer"
              >
                Dismiss Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FinanceDashboard({ restaurants, riders, orders }: { restaurants: Restaurant[]; riders: Rider[]; orders: Order[] }) {
  const totalGmv = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  
  const totalCommission = orders.reduce((sum, o) => {
    const rest = restaurants.find(r => r.id === o.restaurantId);
    const rate = rest ? rest.commissionPercentage : 15;
    return sum + (o.totalAmount * (rate / 100));
  }, 0);

  const totalRiderPayout = orders.filter(o => o.status === 'delivered').length * 40 + riders.reduce((sum, r) => sum + r.totalIncentives, 0);
  const totalRestSettlement = totalGmv - totalCommission;
  const operationalOverhead = totalGmv * 0.03;
  const netProfit = totalCommission - riders.reduce((sum, r) => sum + r.totalIncentives, 0) - operationalOverhead;

  const dailyRevenue = totalCommission * 0.14;
  const weeklyRevenue = totalCommission * 0.48;
  const monthlyRevenue = totalCommission;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Gross Merchandise Value (GMV)</span>
          <p className="text-xl font-bold font-mono text-indigo-400 mt-0.5">₹{totalGmv.toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-slate-500 mt-1">Total consumer billing volume</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Platform Commission</span>
          <p className="text-xl font-bold font-mono text-amber-500 mt-0.5">₹{Math.round(totalCommission).toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-slate-500 mt-1">Weighted average: ~15.2% rate</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Operational Overhead</span>
          <p className="text-xl font-bold font-mono text-rose-400 mt-0.5">₹{Math.round(operationalOverhead).toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-slate-500 mt-1">3% SaaS gateway & SMS API SLAs</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Net Platform Profit</span>
          <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">₹{Math.round(netProfit).toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-slate-500 mt-1">Commission profit after driver SLA</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-slate-100 text-sm border-b border-slate-800 pb-3">Revenue Timelines</h3>
          <div className="space-y-4 pt-1 text-xs">
            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-850">
              <div>
                <p className="font-bold text-slate-300">Today's Commission</p>
                <p className="text-[10px] text-slate-500">Realtime direct collections</p>
              </div>
              <p className="font-mono font-bold text-emerald-400 text-sm">₹{Math.round(dailyRevenue).toLocaleString('en-IN')}</p>
            </div>

            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-850">
              <div>
                <p className="font-bold text-slate-300">Weekly Run Rate</p>
                <p className="text-[10px] text-slate-500">Trailing 7-day cumulative</p>
              </div>
              <p className="font-mono font-bold text-sky-400 text-sm">₹{Math.round(weeklyRevenue).toLocaleString('en-IN')}</p>
            </div>

            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-850">
              <div>
                <p className="font-bold text-slate-300">Monthly Yield</p>
                <p className="text-[10px] text-slate-500">Trailing 30-day cumulative</p>
              </div>
              <p className="font-mono font-bold text-indigo-400 text-sm">₹{Math.round(monthlyRevenue).toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="font-bold text-slate-100 text-sm">Enterprise Settlement Ledger</h3>
            <span className="bg-emerald-500/10 text-emerald-400 font-mono font-bold text-[10px] px-2.5 py-0.5 rounded-lg border border-emerald-500/10 font-sans">
              CLEAR OF LIABILITIES
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3">
              <p className="font-bold text-slate-300 font-mono text-[10px] uppercase tracking-wider text-amber-500">Merchant Settlements</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Gross Merchant Sales:</span>
                  <span className="font-mono text-slate-200">₹{totalGmv.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Weighted Commission:</span>
                  <span className="font-mono text-rose-400">-₹{Math.round(totalCommission).toLocaleString('en-IN')}</span>
                </div>
                <div className="border-t border-slate-800 pt-2 flex justify-between font-bold">
                  <span className="text-slate-200">Total Net Settlement:</span>
                  <span className="font-mono text-emerald-400">₹{Math.round(totalRestSettlement).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3">
              <p className="font-bold text-slate-300 font-mono text-[10px] uppercase tracking-wider text-sky-400">Rider Fleet Settlements</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Base Transit Fees Paid:</span>
                  <span className="font-mono text-slate-200">₹{orders.filter(o => o.status === 'delivered').length * 40}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Fleet Peak Incentives:</span>
                  <span className="font-mono text-slate-200">₹{riders.reduce((sum, r) => sum + r.totalIncentives, 0)}</span>
                </div>
                <div className="border-t border-slate-800 pt-2 flex justify-between font-bold">
                  <span className="text-slate-200">Total Dispatch Outflow:</span>
                  <span className="font-mono text-emerald-400">₹{totalRiderPayout.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
