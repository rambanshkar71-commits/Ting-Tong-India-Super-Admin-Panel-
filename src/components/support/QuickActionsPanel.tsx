import React, { useState } from 'react';
import { db } from '../../firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc,
  setDoc
} from 'firebase/firestore';
import { PhoneCall, MessageSquare, FileText, Bike, Store, User, DollarSign, AlertTriangle, UserPlus, X, CheckCircle, MapPin, Calendar, Coins, Briefcase, Eye, CreditCard, Hash, AlertCircle } from 'lucide-react';
import { getActiveCity } from '../../services/mapService';
import { ChatSession, SupportTicket, Order, Rider, Restaurant, Customer } from '../../types';

interface QuickActionsPanelProps {
  userId: string;
  userRole: 'customer' | 'rider' | 'restaurant' | 'staff' | string;
  conversationId: string;
  conversationType: 'chat' | 'ticket';
  orders: Order[];
  riders: Rider[];
  restaurants: Restaurant[];
  customers: Customer[];
  onAgentAssigned?: (agentName: string) => void;
  onInitiateRefund?: (order: Order) => void;
}

export default function QuickActionsPanel({
  userId,
  userRole,
  conversationId,
  conversationType,
  orders,
  riders,
  restaurants,
  customers,
  onAgentAssigned,
  onInitiateRefund
}: QuickActionsPanelProps) {
  // Modal states
  const [activeModal, setActiveModal] = useState<'order' | 'rider' | 'vendor' | 'customer' | 'refund' | 'escalate' | 'assign' | null>(null);

  // Form states
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundReason, setRefundReason] = useState<string>('');
  const [refundOrderId, setRefundOrderId] = useState<string>('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundMode, setRefundMode] = useState<'auto' | 'manual'>('auto');
  const [refundMethod, setRefundMethod] = useState<'upi' | 'bank'>('upi');
  const [manualReference, setManualReference] = useState<string>('');

  const [escalateTeam, setEscalateTeam] = useState<'Senior Support' | 'Finance Team' | 'Operations Team' | 'Super Admin'>('Senior Support');
  const [escalateReason, setEscalateReason] = useState('');
  const [escalateLoading, setEscalateLoading] = useState(false);

  const [assignAgent, setAssignAgent] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Resolve Profile Data directly from live collections
  const customerData = customers.find(c => c.id === userId);
  const riderData = riders.find(r => r.id === userId);
  const restaurantData = restaurants.find(v => v.id === userId);

  // Resolve user phone and name based on role
  let userPhone = '';
  let userName = '';

  if (userRole === 'customer') {
    userPhone = customerData?.phone || '';
    userName = customerData?.name || '';
  } else if (userRole === 'rider') {
    userPhone = riderData?.phone || '';
    userName = riderData?.name || '';
  } else if (userRole === 'restaurant') {
    userPhone = restaurantData?.phone || '';
    userName = restaurantData?.name || '';
  } else {
    // General fallback for empty support ticket states
    userPhone = '';
    userName = 'Operational Support Client';
  }

  // Find recent order for this user (customer, rider or restaurant)
  const userOrders = orders.filter(o => 
    o.customerId === userId || 
    o.riderId === userId || 
    o.restaurantId === userId
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Use the most recent user order if any
  const recentOrder = userOrders[0] || undefined;

  // Helper lists
  const supportAgents = [
    { id: 'agent_amit', name: 'Amit Patel (Operations Manager)' },
    { id: 'agent_neha', name: 'Neha Sharma (Senior Support)' },
    { id: 'agent_rajesh', name: 'Rajesh Kumar (Finance Lead)' },
    { id: 'agent_rahul', name: 'Rahul Singh (Fleet Coordinator)' },
    { id: 'agent_master', name: 'Master Support Admin' }
  ];

  // Trigger actions
  const handleCallUser = () => {
    if (!userPhone) return;
    window.open(`tel:${userPhone}`);
  };

  const handleWhatsApp = () => {
    if (!userPhone) return;
    // Format phone to Indian international format if needed
    const cleanPhone = userPhone.replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    window.open(`https://wa.me/${formattedPhone}?text=Hello,%20this%20is%20Ting%20Tong%20Support%2520regarding%2520your%2520request.`, '_blank');
  };

  // Submit refund
  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundOrderId) {
      alert("Please select an order to refund.");
      return;
    }
    const orderToRefund = orders.find(o => o.id === refundOrderId);
    if (!orderToRefund) {
      alert("Selected order not found.");
      return;
    }

    const amount = refundType === 'full' ? orderToRefund.totalAmount : parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0 || amount > orderToRefund.totalAmount) {
      alert(`Please enter a valid refund amount up to ₹${orderToRefund.totalAmount}`);
      return;
    }

    if (!refundReason.trim()) {
      alert("Please enter a reason for the refund.");
      return;
    }

    if (refundMode === 'manual' && !manualReference.trim()) {
      alert("Please enter the UTR / Payout transaction reference number for manual reconciliation.");
      return;
    }

    setRefundLoading(true);
    try {
      // Generate transaction details based on mode
      const txnId = refundMode === 'auto' 
        ? `TT-AUTO-GATE-${Math.floor(10000000 + Math.random() * 90000000)}`
        : manualReference.trim();

      // 1. Save Refund action in Firestore
      const refundRef = collection(db, 'refund_actions');
      await addDoc(refundRef, {
        orderId: refundOrderId,
        customerId: orderToRefund.customerId,
        customerName: orderToRefund.customerName,
        refundAmount: amount,
        refundType,
        reason: refundReason,
        refundMode,
        refundMethod,
        transactionId: txnId,
        processedAt: new Date().toISOString(),
        processedBy: 'Ting Tong Support Team',
        status: 'completed'
      });

      // 2. Update Order status and paymentStatus in Firestore
      const orderRef = doc(db, 'orders', refundOrderId);
      await updateDoc(orderRef, {
        status: 'refunded',
        paymentStatus: 'refunded',
        updatedAt: new Date().toISOString()
      });

      // 3. Log a ticket/chat update message
      const modeLabel = refundMode === 'auto' ? 'AUTOMATIC (Gateway Payout)' : 'MANUAL (Bank/UPI Rec)';
      const methodLabel = refundMethod === 'upi' ? 'UPI Transfer' : 'Direct Bank NEFT';
      const msgText = `💰 REFUND PROCESSED [${modeLabel}]: ₹${amount} (${refundType === 'full' ? 'Full' : 'Partial'}) refund applied for order #${refundOrderId}.\n• Method: ${methodLabel}\n• Txn Reference: ${txnId}\n• Reason: ${refundReason}`;
      
      if (conversationType === 'chat') {
        const chatMsgRef = doc(collection(db, 'chat_messages'));
        await setDoc(chatMsgRef, {
          id: chatMsgRef.id,
          sessionId: conversationId,
          senderId: 'admin_bhopal',
          senderName: 'Ting Tong Support System',
          senderRole: 'admin',
          text: msgText,
          sentAt: new Date().toISOString(),
          readBy: ['admin_bhopal']
        });

        await updateDoc(doc(db, 'chat_sessions', conversationId), {
          lastMessageText: `💰 Refund: ₹${amount} (${refundMode})`,
          lastMessageTime: new Date().toISOString()
        });
      } else {
        // Ticket update message / log
        const chatMsgRef = doc(collection(db, 'ticket_messages'));
        await setDoc(chatMsgRef, {
          id: chatMsgRef.id,
          ticketId: conversationId,
          senderId: 'admin_bhopal',
          senderName: 'Ting Tong Support System',
          senderRole: 'admin',
          text: msgText,
          sentAt: new Date().toISOString(),
          readBy: ['admin_bhopal']
        });
      }

      alert(`✓ Refund of ₹${amount} via ${modeLabel} for Order #${refundOrderId} successfully saved and applied!`);
      setActiveModal(null);
      // Reset form
      setRefundAmount('');
      setRefundReason('');
      setManualReference('');
    } catch (err: any) {
      console.error("Error processing refund: ", err);
      alert("Error processing refund: " + err.message);
    } finally {
      setRefundLoading(false);
    }
  };

  // Submit escalation
  const handleEscalateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateReason.trim()) {
      alert("Please enter an escalation reason.");
      return;
    }

    setEscalateLoading(true);
    try {
      // 1. Save Escalation log in Firestore
      await addDoc(collection(db, 'escalations'), {
        conversationId,
        conversationType,
        escalatedTo: escalateTeam,
        reason: escalateReason,
        timestamp: new Date().toISOString(),
        escalatedBy: 'Ting Tong Support Executive',
        userName,
        userRole
      });

      // 2. Update status of the source entity in Firestore
      if (conversationType === 'chat') {
        await updateDoc(doc(db, 'chat_sessions', conversationId), {
          status: 'waiting',
          assignedAgentName: escalateTeam,
          lastMessageText: `⚠️ Escalated to ${escalateTeam}`,
          lastMessageTime: new Date().toISOString()
        });

        // Add system log message to the chat
        const chatMsgRef = doc(collection(db, 'chat_messages'));
        await setDoc(chatMsgRef, {
          id: chatMsgRef.id,
          sessionId: conversationId,
          senderId: 'admin_system',
          senderName: 'System Monitor',
          senderRole: 'admin',
          text: `⚠️ SESSION ESCALATED to [${escalateTeam}]. Reason: ${escalateReason}`,
          sentAt: new Date().toISOString(),
          readBy: []
        });
      } else {
        await updateDoc(doc(db, 'tickets', conversationId), {
          status: 'open',
          subject: `[ESCALATED - ${escalateTeam}] ${recentOrder ? 'Order #' + recentOrder.id : ''}`
        });
      }

      alert(`✓ Conversation successfully escalated to ${escalateTeam}!`);
      setActiveModal(null);
      setEscalateReason('');
    } catch (err: any) {
      console.error("Error escalating: ", err);
      alert("Escalation error: " + err.message);
    } finally {
      setEscalateLoading(false);
    }
  };

  // Submit reassignment
  const handleAssignAgentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignAgent) {
      alert("Please select an agent.");
      return;
    }

    const selected = supportAgents.find(a => a.id === assignAgent);
    if (!selected) return;

    setAssignLoading(true);
    try {
      // 1. Update Firestore in real time
      if (conversationType === 'chat') {
        await updateDoc(doc(db, 'chat_sessions', conversationId), {
          assignedAgentId: selected.id,
          assignedAgentName: selected.name,
          lastMessageText: `👨‍💼 Reassigned to ${selected.name}`,
          lastMessageTime: new Date().toISOString()
        });

        // Add a system log message in chat
        const chatMsgRef = doc(collection(db, 'chat_messages'));
        await setDoc(chatMsgRef, {
          id: chatMsgRef.id,
          sessionId: conversationId,
          senderId: 'admin_system',
          senderName: 'System Monitor',
          senderRole: 'admin',
          text: `👨‍💼 REASSIGNED: This conversation was reassigned to support agent [${selected.name}].`,
          sentAt: new Date().toISOString(),
          readBy: []
        });
      } else {
        // Tickets update reassign
        await updateDoc(doc(db, 'tickets', conversationId), {
          userName: `${recentOrder ? 'Agent: ' + selected.name : userName}`
        });
      }

      if (onAgentAssigned) {
        onAgentAssigned(selected.name);
      }

      alert(`✓ Conversation successfully reassigned to ${selected.name}!`);
      setActiveModal(null);
    } catch (err: any) {
      console.error("Error reassigning: ", err);
      alert("Reassignment error: " + err.message);
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-850 rounded-3xl p-4 space-y-4" id="quick-actions-panel-main">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-amber-500" /> Command Quick Actions
        </h4>
        {userPhone && (
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            Active
          </span>
        )}
      </div>

      {/* Primary Communication Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleCallUser}
          disabled={!userPhone}
          className="bg-slate-950 hover:bg-slate-900 border border-slate-800 disabled:opacity-45 disabled:pointer-events-none text-slate-200 py-2 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
          title={userPhone ? `Call +91 ${userPhone}` : "Phone number unavailable"}
        >
          <PhoneCall className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Call User</span>
        </button>

        <button
          onClick={handleWhatsApp}
          disabled={!userPhone}
          className="bg-slate-950 hover:bg-slate-900 border border-slate-800 disabled:opacity-45 disabled:pointer-events-none text-slate-200 py-2 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
          title={userPhone ? "Open WhatsApp chat" : "WhatsApp number unavailable"}
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>WhatsApp</span>
        </button>
      </div>

      {/* Main Feature Actions Stack */}
      <div className="space-y-1.5">
        <button
          onClick={() => setActiveModal('order')}
          disabled={!recentOrder}
          className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 disabled:opacity-40 text-slate-200 py-2 px-3 rounded-xl text-[11px] font-bold flex items-center justify-between transition cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Open Order</span>
          </span>
          <span className="text-[9px] font-mono text-slate-500">
            {recentOrder ? `#${recentOrder.id.slice(-5)}` : 'None'}
          </span>
        </button>

        <button
          onClick={() => setActiveModal('rider')}
          disabled={!riderData && (!recentOrder || !recentOrder.riderId)}
          className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 disabled:opacity-40 text-slate-200 py-2 px-3 rounded-xl text-[11px] font-bold flex items-center justify-between transition cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Bike className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Open Rider Profile</span>
          </span>
          <span className="text-[9px] font-mono text-indigo-400">
            {riderData?.name || (recentOrder?.riderName ? recentOrder.riderName : 'Check')}
          </span>
        </button>

        <button
          onClick={() => setActiveModal('vendor')}
          disabled={!restaurantData && (!recentOrder || !recentOrder.restaurantId)}
          className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 disabled:opacity-40 text-slate-200 py-2 px-3 rounded-xl text-[11px] font-bold flex items-center justify-between transition cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Store className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Open Vendor Profile</span>
          </span>
          <span className="text-[9px] font-mono text-rose-400">
            {restaurantData?.name || (recentOrder?.restaurantName ? recentOrder.restaurantName : 'Check')}
          </span>
        </button>

        <button
          onClick={() => setActiveModal('customer')}
          disabled={!customerData && (!recentOrder || !recentOrder.customerId)}
          className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 disabled:opacity-40 text-slate-200 py-2 px-3 rounded-xl text-[11px] font-bold flex items-center justify-between transition cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Open Customer Profile</span>
          </span>
          <span className="text-[9px] font-mono text-emerald-400">
            {customerData?.name || (recentOrder?.customerName ? recentOrder.customerName : 'Check')}
          </span>
        </button>

        <button
          onClick={() => {
            if (onInitiateRefund && recentOrder) {
              onInitiateRefund(recentOrder);
            } else {
              setActiveModal('refund');
              if (recentOrder) setRefundOrderId(recentOrder.id);
            }
          }}
          disabled={userOrders.length === 0}
          className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 disabled:opacity-40 text-slate-200 py-2 px-3 rounded-xl text-[11px] font-bold flex items-center gap-2 transition cursor-pointer"
        >
          <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Refund Order</span>
        </button>

        <button
          onClick={() => setActiveModal('escalate')}
          className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-200 py-2 px-3 rounded-xl text-[11px] font-bold flex items-center gap-2 transition cursor-pointer"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>Escalate Ticket</span>
        </button>

        <button
          onClick={() => setActiveModal('assign')}
          className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-200 py-2 px-3 rounded-xl text-[11px] font-bold flex items-center gap-2 transition cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>Assign Another Agent</span>
        </button>
      </div>

      {/* --- MODAL POPUPS AND DIALOGS --- */}

      {/* 1. Order Details Side Panel / Dialog */}
      {activeModal === 'order' && recentOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-lg w-full rounded-3xl p-6 text-slate-100 relative space-y-4 shadow-2xl animate-scale-in">
            <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-100">
              <X className="w-5 h-5" />
            </button>
            
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-200 flex items-center gap-2 uppercase tracking-wide">
                <FileText className="w-5 h-5 text-amber-500" /> Order Details
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-1">ID: #{recentOrder.id}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Customer</span>
                <p className="font-bold mt-1 text-slate-300">{recentOrder.customerName}</p>
                <p className="text-[10px] text-slate-500 mt-1">Destination Address:</p>
                <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{recentOrder.deliveryAddress}</p>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Restaurant</span>
                <p className="font-bold mt-1 text-slate-300">{recentOrder.restaurantName}</p>
                <span className="text-[10px] text-slate-500 block uppercase font-bold mt-2">Rider assigned</span>
                <p className="text-xs font-bold text-amber-500">{recentOrder.riderName || 'Not Assigned'}</p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 space-y-2">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Items list</span>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {recentOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-slate-300">
                    <span>{item.name} <span className="text-slate-500 font-bold">x{item.quantity}</span></span>
                    <span>₹{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-850 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span>₹{recentOrder.subtotal}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Delivery Charge:</span>
                <span>₹{recentOrder.deliveryCharge}</span>
              </div>
              <div className="flex justify-between border-t border-slate-850 pt-1.5 text-slate-200 font-bold text-sm">
                <span>Total Amount:</span>
                <span className="text-amber-500">₹{recentOrder.totalAmount}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Status:</span>
                <span className={`px-2.5 py-1 rounded-full font-black text-[9px] uppercase ${
                  recentOrder.status === 'delivered' ? 'bg-emerald-500/15 text-emerald-400' :
                  recentOrder.status === 'cancelled' ? 'bg-rose-500/15 text-rose-400' :
                  'bg-amber-500/15 text-amber-500 animate-pulse'
                }`}>
                  {recentOrder.status}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Payment:</span>
                <span className="font-bold text-slate-300">{recentOrder.paymentMethod} ({recentOrder.paymentStatus})</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Rider Profile Dialog */}
      {activeModal === 'rider' && (
        (() => {
          // Look up rider profile directly, or fallback to recent order rider details
          const activeRider = riderData || riders.find(r => r.id === recentOrder?.riderId);
          if (!activeRider) return null;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-800 max-w-xl w-full rounded-3xl p-6 text-slate-100 relative space-y-4 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
                <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-100">
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                  <div className="w-14 h-14 rounded-full bg-slate-800 border border-amber-500/30 flex items-center justify-center font-bold text-amber-500 text-lg">
                    {activeRider.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-200">{activeRider.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">ID: {activeRider.id}</p>
                    <div className="flex gap-2 mt-1">
                      {(() => {
                        const dutyStatus = (activeRider.dutyStatus || '').toUpperCase();
                        const onlineStatus = (activeRider.onlineStatus || '').toUpperCase();
                        const isOnDuty = dutyStatus === 'ON_DUTY';
                        const isOnline = onlineStatus === 'ONLINE';
                        return (
                          <>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                              isOnDuty ? 'bg-emerald-500/25 text-emerald-400' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {isOnDuty ? 'ON DUTY' : 'OFF DUTY'}
                            </span>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                              isOnline ? 'bg-emerald-500/25 text-emerald-400' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {activeRider.onlineStatus}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850 space-y-1.5">
                    <p className="text-slate-500 uppercase font-black text-[9px]">Contact & Rating</p>
                    <p className="text-slate-300 font-bold">📞 {activeRider.phone}</p>
                    <p className="text-slate-400">{activeRider.email}</p>
                    <p className="text-slate-300 font-bold mt-1">Rating: ⭐ {activeRider.rating || '4.8'}/5</p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850 space-y-1.5">
                    <p className="text-slate-500 uppercase font-black text-[9px]">Earnings & Wallet</p>
                    <p className="text-amber-400 font-bold text-sm">₹{activeRider.walletBalance?.toLocaleString() || '0'} Wallet</p>
                    <p className="text-slate-400 text-[10px]">Total Incentives: ₹{activeRider.totalIncentives || 0}</p>
                    <p className="text-slate-400 text-[10px]">Total Penalties: ₹{activeRider.totalPenalties || 0}</p>
                  </div>
                </div>

                {/* Duty Status & Location */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-rose-500" />
                      <span>Live Location Coordinate Node</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Lat: {activeRider.lat || getActiveCity().centerLat}, Lng: {activeRider.lng || getActiveCity().centerLng} ({getActiveCity().name} Hub)
                    </span>
                  </div>

                  {/* Vehicle details */}
                  <div className="border-t border-slate-850 pt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="text-slate-400">
                      Vehicle No: <span className="text-slate-200 font-bold">{activeRider.vehicleNumber || 'MP-04-AB-1234'}</span>
                    </div>
                    <div className="text-slate-400">
                      Vehicle Type: <span className="text-slate-200 font-bold uppercase">{activeRider.vehicleType || 'Motorcycle'}</span>
                    </div>
                  </div>
                </div>

                {/* Documents view */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 space-y-3">
                  <p className="text-slate-500 uppercase font-black text-[9px] border-b border-slate-850 pb-1.5">KYC Verified Documents</p>
                  <div className="grid grid-cols-3 gap-2 text-[10px] text-center font-bold">
                    <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-500 block text-[9px]">AADHAAR CARD</span>
                      <span className="text-emerald-400 text-[9px]">✓ Verified</span>
                      <a href={activeRider.aadhaarFrontUrl || '#'} target="_blank" rel="noreferrer" className="text-amber-500 block text-[9px] font-black hover:underline mt-1">View doc</a>
                    </div>

                    <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-500 block text-[9px]">PAN CARD</span>
                      <span className="text-emerald-400 text-[9px]">✓ Verified</span>
                      <a href={activeRider.panCardUrl || '#'} target="_blank" rel="noreferrer" className="text-amber-500 block text-[9px] font-black hover:underline mt-1">View doc</a>
                    </div>

                    <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-500 block text-[9px]">DRIVING LICENSE</span>
                      <span className="text-emerald-400 text-[9px]">✓ Verified</span>
                      <a href={activeRider.drivingLicenceUrl || '#'} target="_blank" rel="noreferrer" className="text-amber-500 block text-[9px] font-black hover:underline mt-1">View doc</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* 3. Vendor Profile Dialog */}
      {activeModal === 'vendor' && (
        (() => {
          const activeVendor = restaurantData || restaurants.find(v => v.id === recentOrder?.restaurantId);
          if (!activeVendor) return null;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-800 max-w-xl w-full rounded-3xl p-6 text-slate-100 relative space-y-4 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
                <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-100">
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-850 border border-rose-500/20 flex items-center justify-center font-bold text-rose-400 text-lg overflow-hidden shrink-0">
                    {activeVendor.logoUrl ? (
                      <img src={activeVendor.logoUrl} alt={activeVendor.name} className="w-full h-full object-cover" />
                    ) : (
                      activeVendor.name.charAt(0)
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-200">{activeVendor.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Address: {activeVendor.address}</p>
                    <div className="flex gap-2 mt-1.5">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                        activeVendor.isOpen ? 'bg-emerald-500/25 text-emerald-400' : 'bg-rose-500/25 text-rose-400'
                      }`}>
                        {activeVendor.isOpen ? 'OPEN' : 'CLOSED'}
                      </span>
                      <span className="text-[9px] font-black bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md uppercase">
                        ⭐ {activeVendor.rating || '4.5'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850 space-y-1">
                    <p className="text-slate-500 uppercase font-black text-[9px]">Contact & Reg</p>
                    <p className="text-slate-300 font-bold">📞 {activeVendor.phone}</p>
                    <p className="text-slate-400">{activeVendor.email}</p>
                    <p className="text-slate-400 mt-1">GST: {activeVendor.gstNo || 'Not Added'}</p>
                    <p className="text-slate-400">FSSAI: {activeVendor.fssaiNo || 'Not Added'}</p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850 space-y-1">
                    <p className="text-slate-500 uppercase font-black text-[9px]">Settlement Info</p>
                    <p className="text-slate-300 font-bold">UPI: {activeVendor.upiId || 'Not Added'}</p>
                    <p className="text-slate-400">Bank: {activeVendor.bankName}</p>
                    <p className="text-slate-400">A/C: {activeVendor.accountNumber}</p>
                    <p className="text-slate-400">Commission Rate: {activeVendor.commissionPercentage || '10'}%</p>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 space-y-2">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Restaurant Menu Categories</span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {activeVendor.categories?.map((cat, idx) => (
                      <span key={idx} className="bg-slate-900 border border-slate-800 text-slate-300 text-[10px] font-bold px-2.5 py-1 rounded-lg">
                        {cat}
                      </span>
                    )) || <span className="text-slate-500 text-[11px] font-mono">No categories added</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* 4. Customer Profile Dialog */}
      {activeModal === 'customer' && (
        (() => {
          const activeCustomer = customerData || customers.find(c => c.id === recentOrder?.customerId);
          if (!activeCustomer) return null;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-800 max-w-xl w-full rounded-3xl p-6 text-slate-100 relative space-y-4 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
                <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-100">
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                  <div className="w-14 h-14 rounded-full bg-slate-800 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 text-lg">
                    {activeCustomer.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-200">{activeCustomer.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">ID: {activeCustomer.id}</p>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md inline-block mt-1 ${
                      activeCustomer.status === 'active' ? 'bg-emerald-500/25 text-emerald-400' : 'bg-rose-500/25 text-rose-400'
                    }`}>
                      Account: {activeCustomer.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850 space-y-1">
                    <p className="text-slate-500 uppercase font-black text-[9px]">Contact Info</p>
                    <p className="text-slate-300 font-bold">📞 {activeCustomer.phone}</p>
                    <p className="text-slate-400">{activeCustomer.email}</p>
                    <p className="text-slate-500 text-[10px] mt-2">Member Since:</p>
                    <p className="text-slate-400 text-[10px]">{new Date(activeCustomer.createdAt || Date.now()).toLocaleDateString()}</p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850 space-y-1">
                    <p className="text-slate-500 uppercase font-black text-[9px]">Wallet & Rewards</p>
                    <p className="text-amber-500 font-black text-base">₹{activeCustomer.walletBalance?.toLocaleString() || '0.00'}</p>
                    <p className="text-slate-400 text-[10px]">Reward Points: {activeCustomer.rewardPoints || 0}</p>
                    {activeCustomer.notes && (
                      <p className="text-slate-500 text-[10px] italic mt-1 font-sans">"{activeCustomer.notes}"</p>
                    )}
                  </div>
                </div>

                {/* Addresses */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 space-y-2">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Saved Addresses</span>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {activeCustomer.addresses?.map((addr, idx) => (
                      <div key={idx} className="flex gap-2 text-xs text-slate-300 border-b border-slate-900 pb-1.5 last:border-0 last:pb-0">
                        <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-amber-500 text-[10px] uppercase block">{addr.label}</span>
                          <span className="text-[11px] text-slate-400 leading-normal">{addr.addressLine}</span>
                        </div>
                      </div>
                    )) || <span className="text-slate-500 text-xs font-mono">No saved addresses</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* 5. Refund Order Dialog */}
      {activeModal === 'refund' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-3xl p-6 text-slate-100 relative shadow-2xl animate-scale-in">
            <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-100">
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-200 flex items-center gap-2 uppercase tracking-wide">
                <DollarSign className="w-5 h-5 text-emerald-400" /> Refund Management Hub
              </h3>
              <p className="text-xs text-slate-400 mt-1">Configure automated instant payout release or log manual banking details.</p>
            </div>

            <form onSubmit={handleRefundSubmit} className="space-y-4">
              {/* Select Order */}
              <div>
                <label className="text-[10px] uppercase font-black text-slate-400 block mb-1">Select Order to Refund</label>
                <select
                  value={refundOrderId}
                  onChange={(e) => setRefundOrderId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500"
                  required
                >
                  <option value="">-- Choose Order --</option>
                  {userOrders.map(o => (
                    <option key={o.id} value={o.id}>
                      Order #{o.id.slice(-6)} - ₹{o.totalAmount} ({o.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Mode Selector */}
              <div>
                <label className="text-[10px] uppercase font-black text-slate-400 block mb-1.5">Refund Processing Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRefundMode('auto')}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer ${
                      refundMode === 'auto'
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Auto Gateway
                    </span>
                    <span className="text-[9px] text-slate-500 mt-1 leading-tight">Release money automatically via active UPI/payout channel.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundMode('manual')}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer ${
                      refundMode === 'manual'
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                      Manual Bank Rec
                    </span>
                    <span className="text-[9px] text-slate-500 mt-1 leading-tight">Enter manual wire reference/receipt code for auditing.</span>
                  </button>
                </div>
              </div>

              {refundOrderId && (() => {
                const sel = orders.find(o => o.id === refundOrderId);
                if (!sel) return null;

                return (
                  <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-850">
                    <p className="text-xs font-bold text-slate-300 flex justify-between">
                      <span>Order Amount:</span> 
                      <span className="text-amber-500">₹{sel.totalAmount}</span>
                    </p>

                    <div className="flex gap-4 pt-1.5 border-t border-slate-900">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="refundType"
                          checked={refundType === 'full'}
                          onChange={() => setRefundType('full')}
                          className="accent-amber-500"
                        />
                        <span>Full Refund (₹{sel.totalAmount})</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="refundType"
                          checked={refundType === 'partial'}
                          onChange={() => setRefundType('partial')}
                          className="accent-amber-500"
                        />
                        <span>Partial Refund</span>
                      </label>
                    </div>

                    {refundType === 'partial' && (
                      <div className="pt-2">
                        <label className="text-[10px] uppercase font-black text-slate-400 block mb-1">Refund Amount (₹)</label>
                        <input
                          type="number"
                          value={refundAmount}
                          onChange={(e) => setRefundAmount(e.target.value)}
                          max={sel.totalAmount}
                          placeholder={`Max ₹${sel.totalAmount}`}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500"
                          required
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Refund Method & Payout Details */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-850">
                <div>
                  <label className="text-[10px] uppercase font-black text-slate-400 block mb-1.5">Payout Channel</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={`flex items-center gap-2 text-xs font-bold p-2 rounded-xl border cursor-pointer transition ${
                      refundMethod === 'upi' ? 'bg-slate-900 border-amber-500/40 text-amber-500' : 'bg-slate-950 border-slate-900 text-slate-400'
                    }`}>
                      <input
                        type="radio"
                        name="refundMethod"
                        checked={refundMethod === 'upi'}
                        onChange={() => setRefundMethod('upi')}
                        className="hidden"
                      />
                      <span>UPI Payee Address</span>
                    </label>
                    <label className={`flex items-center gap-2 text-xs font-bold p-2 rounded-xl border cursor-pointer transition ${
                      refundMethod === 'bank' ? 'bg-slate-900 border-amber-500/40 text-amber-500' : 'bg-slate-950 border-slate-900 text-slate-400'
                    }`}>
                      <input
                        type="radio"
                        name="refundMethod"
                        checked={refundMethod === 'bank'}
                        onChange={() => setRefundMethod('bank')}
                        className="hidden"
                      />
                      <span>Bank NEFT/IMPS</span>
                    </label>
                  </div>
                </div>

                {refundMode === 'manual' && (
                  <div className="pt-2 border-t border-slate-900">
                    <label className="text-[10px] uppercase font-black text-slate-400 block mb-1">Transaction Ref / UTR ID</label>
                    <input
                      type="text"
                      value={manualReference}
                      onChange={(e) => setManualReference(e.target.value)}
                      placeholder="e.g., UTR-239485721098"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 font-mono"
                      required={refundMode === 'manual'}
                    />
                    <p className="text-[9px] text-slate-500 mt-1 font-mono">Manually process with wire agent first, then paste voucher reference.</p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-slate-400 block mb-1">Reason for Refund</label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="E.g., Item spoiled, double transaction, delivery delay..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 h-20 resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={refundLoading}
                className="w-full bg-emerald-500 hover:brightness-110 disabled:opacity-50 text-slate-950 font-black uppercase text-xs py-3 rounded-xl transition cursor-pointer"
              >
                {refundLoading 
                  ? 'Processing Refund...' 
                  : refundMode === 'auto' 
                    ? 'Approve & Release Auto Gateway Refund' 
                    : 'Log & Confirm Manual Wire Refund'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 6. Escalate Ticket Dialog */}
      {activeModal === 'escalate' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-3xl p-6 text-slate-100 relative shadow-2xl animate-scale-in">
            <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-100">
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-200 flex items-center gap-2 uppercase tracking-wide">
                <AlertTriangle className="w-5 h-5 text-amber-500" /> Escalate Support SLA
              </h3>
              <p className="text-xs text-slate-400 mt-1">Direct escalation pathways to dispatch managers or compliance teams.</p>
            </div>

            <form onSubmit={handleEscalateSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-black text-slate-400 block mb-1">Escalation target department</label>
                <select
                  value={escalateTeam}
                  onChange={(e: any) => setEscalateTeam(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 font-bold"
                  required
                >
                  <option value="Senior Support">Senior Support Tier-2</option>
                  <option value="Finance Team">Finance &amp; Refund Audit Team</option>
                  <option value="Operations Team">{getActiveCity().name} Hub Operations Team</option>
                  <option value="Super Admin">Super Admin Control Hub</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-slate-400 block mb-1">Detailed Reason for Escalation</label>
                <textarea
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  placeholder="Describe why direct Tier-1 agent handling requires department intervention..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 h-24 resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={escalateLoading}
                className="w-full bg-amber-500 hover:brightness-110 disabled:opacity-50 text-slate-950 font-black uppercase text-xs py-3 rounded-xl transition cursor-pointer"
              >
                {escalateLoading ? 'Filing Escalation...' : 'Log & Route Escalation'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 7. Assign Agent Dialog */}
      {activeModal === 'assign' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-3xl p-6 text-slate-100 relative shadow-2xl animate-scale-in">
            <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-100">
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-200 flex items-center gap-2 uppercase tracking-wide">
                <UserPlus className="w-5 h-5 text-indigo-400" /> Reassign Support Agent
              </h3>
              <p className="text-xs text-slate-400 mt-1">Pass control of the conversation thread to another available agent.</p>
            </div>

            <form onSubmit={handleAssignAgentSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-black text-slate-400 block mb-1">Select Available Agent</label>
                <select
                  value={assignAgent}
                  onChange={(e) => setAssignAgent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 font-bold"
                  required
                >
                  <option value="">-- Choose Agent --</option>
                  {supportAgents.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={assignLoading}
                className="w-full bg-indigo-500 hover:brightness-110 disabled:opacity-50 text-slate-950 font-black uppercase text-xs py-3 rounded-xl transition cursor-pointer"
              >
                {assignLoading ? 'Reassigning control...' : 'Transfer Session Control'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
