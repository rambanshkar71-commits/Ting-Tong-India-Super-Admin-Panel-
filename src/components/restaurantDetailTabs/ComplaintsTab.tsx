import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { Restaurant, Order } from '../../types';
import {
  MessageSquareWarning,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Paperclip,
  Send,
  IndianRupee,
  ShieldAlert,
} from 'lucide-react';

interface ComplaintsTabProps {
  restaurant: Restaurant;
  orders: Order[];
  logAdminAction?: (action: string, details: string) => Promise<void>;
}

export interface ComplaintRecord {
  id: string;
  orderId: string;
  restaurantId: string;
  customerName: string;
  customerPhone?: string;
  category: string;
  description: string;
  attachments?: string[];
  assignedAdmin?: string;
  status: 'open' | 'under_investigation' | 'resolved' | 'rejected';
  internalNotes?: { note: string; admin: string; timestamp: string }[];
  refundStatus?: 'none' | 'full' | 'partial';
  refundAmount?: number;
  createdAt: string;
}

export default function ComplaintsTab({ restaurant, orders, logAdminAction }: ComplaintsTabProps) {
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintRecord | null>(null);
  const [newNote, setNewNote] = useState('');
  const [refundAmountInput, setRefundAmountInput] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New complaint form states
  const [complaintOrderId, setComplaintOrderId] = useState('');
  const [complaintCategory, setComplaintCategory] = useState('Missing Item / Quantity');
  const [complaintDesc, setComplaintDesc] = useState('');

  // Real-time listener for restaurant complaints
  useEffect(() => {
    const q = query(
      collection(db, 'restaurantComplaints'),
      where('restaurantId', '==', restaurant.id)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list: ComplaintRecord[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ComplaintRecord);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setComplaints(list);
    });
    return () => unsub();
  }, [restaurant.id]);

  // Create new complaint
  const handleCreateComplaint = async () => {
    if (!complaintDesc.trim()) {
      alert('Please describe the customer complaint.');
      return;
    }
    try {
      const newRecord = {
        restaurantId: restaurant.id,
        orderId: complaintOrderId || 'ORD_' + Date.now().toString().slice(-6),
        customerName: 'Customer Support Lead',
        category: complaintCategory,
        description: complaintDesc.trim(),
        assignedAdmin: 'Master Admin',
        status: 'open',
        internalNotes: [
          {
            note: 'Ticket created in Master Admin Panel.',
            admin: 'System Admin',
            timestamp: new Date().toISOString(),
          },
        ],
        refundStatus: 'none',
        createdAt: new Date().toISOString(),
      };
      await addDoc(collection(db, 'restaurantComplaints'), newRecord);
      if (logAdminAction) {
        await logAdminAction('CREATE_COMPLAINT', `Logged customer complaint against ${restaurant.name}`);
      }
      setShowCreateModal(false);
      setComplaintDesc('');
      alert('Complaint ticket logged successfully.');
    } catch (err: any) {
      alert('Error creating complaint: ' + err.message);
    }
  };

  // Add Internal Note
  const handleAddNote = async (complaintId: string) => {
    if (!newNote.trim() || !selectedComplaint) return;
    try {
      const updatedNotes = [
        ...(selectedComplaint.internalNotes || []),
        {
          note: newNote.trim(),
          admin: 'Master Admin',
          timestamp: new Date().toISOString(),
        },
      ];
      await updateDoc(doc(db, 'restaurantComplaints', complaintId), {
        internalNotes: updatedNotes,
      });
      setSelectedComplaint({ ...selectedComplaint, internalNotes: updatedNotes });
      setNewNote('');
    } catch (err: any) {
      alert('Error adding note: ' + err.message);
    }
  };

  // Resolve complaint with refund decision
  const handleResolveComplaint = async (complaintId: string, refundType: 'none' | 'full' | 'partial') => {
    try {
      const amount = refundType === 'full' ? 350 : refundType === 'partial' ? Number(refundAmountInput || 150) : 0;
      await updateDoc(doc(db, 'restaurantComplaints', complaintId), {
        status: 'resolved',
        refundStatus: refundType,
        refundAmount: amount,
        resolvedAt: new Date().toISOString(),
      });
      if (logAdminAction) {
        await logAdminAction(
          'RESOLVE_COMPLAINT',
          `Resolved complaint for ${restaurant.name} with ${refundType} refund (₹${amount})`
        );
      }
      alert(`Complaint marked as resolved with ${refundType.toUpperCase()} refund!`);
      setSelectedComplaint(null);
    } catch (err: any) {
      alert('Error resolving complaint: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <MessageSquareWarning className="w-5 h-5 text-rose-400" /> Customer Complaints & Resolution Center
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Log quality complaints, assign admin investigators, attach evidence, and issue customer refunds.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-rose-500 hover:bg-rose-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer self-start"
        >
          + Log New Complaint Ticket
        </button>
      </div>

      {/* Grid: Complaint List & Detailed Ticket Inspector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Complaint Tickets List */}
        <div className="md:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md max-h-[600px] overflow-y-auto">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
            Complaints Register ({complaints.length})
          </h4>

          {complaints.length === 0 ? (
            <div className="p-6 text-center text-slate-500 font-mono text-xs">
              No customer complaints filed against this merchant.
            </div>
          ) : (
            complaints.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedComplaint(item)}
                className={`p-3.5 rounded-xl border transition cursor-pointer space-y-2 ${
                  selectedComplaint?.id === item.id
                    ? 'bg-slate-850 border-orange-500/50'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-orange-400">Order #{item.orderId.slice(-6)}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                      item.status === 'resolved'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : item.status === 'open'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="font-bold text-xs text-slate-200 line-clamp-1">{item.category}</p>
                <p className="text-slate-400 text-[11px] line-clamp-2">{item.description}</p>
              </div>
            ))
          )}
        </div>

        {/* Right Column: Ticket Inspection & Investigation */}
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md">
          {selectedComplaint ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase text-orange-400">
                    Ticket ID: #{selectedComplaint.id.slice(-6)}
                  </span>
                  <h4 className="text-base font-bold text-slate-100 mt-0.5">{selectedComplaint.category}</h4>
                </div>
                <button
                  onClick={() => setSelectedComplaint(null)}
                  className="text-slate-400 hover:text-slate-200 text-xs font-mono cursor-pointer"
                >
                  Close Ticket
                </button>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-500 block font-mono">Customer Description</span>
                <p className="text-slate-200 leading-relaxed">{selectedComplaint.description}</p>
              </div>

              {/* Internal Notes History */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Investigation & Admin Timeline Notes
                </h5>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {selectedComplaint.internalNotes?.map((n, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-xs space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-slate-500">
                        <span>{n.admin}</span>
                        <span>{new Date(n.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-300">{n.note}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Type internal investigation note..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-orange-500"
                  />
                  <button
                    onClick={() => handleAddNote(selectedComplaint.id)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition border border-slate-700"
                  >
                    Add Note
                  </button>
                </div>
              </div>

              {/* Resolution & Refund Control */}
              <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3">
                <h5 className="text-xs font-bold uppercase text-orange-400 font-mono">Resolution & Financial Refund</h5>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleResolveComplaint(selectedComplaint.id, 'none')}
                    className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Resolve (No Refund)
                  </button>
                  <button
                    onClick={() => handleResolveComplaint(selectedComplaint.id, 'full')}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Full Refund (₹350)
                  </button>
                  <button
                    onClick={() => handleResolveComplaint(selectedComplaint.id, 'partial')}
                    className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Partial Refund
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 font-mono text-xs">
              Select a customer complaint ticket from the left panel to inspect details and issue refunds.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Complaint Ticket */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-6 space-y-4 shadow-2xl">
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" /> Log Customer Complaint Ticket
            </h4>

            <div className="space-y-3">
              <input
                type="text"
                value={complaintOrderId}
                onChange={(e) => setComplaintOrderId(e.target.value)}
                placeholder="Order ID (e.g. ORD_982341)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono outline-none"
              />

              <select
                value={complaintCategory}
                onChange={(e) => setComplaintCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none"
              >
                <option value="Missing Item / Quantity">Missing Item / Quantity</option>
                <option value="Food Quality / Hygiene Issue">Food Quality / Hygiene Issue</option>
                <option value="Packaging / Spillage Damage">Packaging / Spillage Damage</option>
                <option value="Wrong Items Received">Wrong Items Received</option>
                <option value="Excessive Delay">Excessive Delay</option>
              </select>

              <textarea
                value={complaintDesc}
                onChange={(e) => setComplaintDesc(e.target.value)}
                placeholder="Describe issue details..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 h-24 outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="bg-slate-800 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateComplaint}
                className="bg-rose-500 hover:bg-rose-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                Log Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
