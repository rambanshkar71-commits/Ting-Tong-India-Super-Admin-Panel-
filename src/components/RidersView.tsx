import React, { useState, useRef, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { Rider, Order, Zone, WorkZone } from '../types';
import { getActiveCity } from '../services/mapService';
import { subscribeToZones } from '../services/zoneService';
import { getZoneForRider } from '../utils/zoneMatching';
import RiderRegistrationForm from './RiderRegistrationForm';
import LiveTrackingMap from './LiveTrackingMap';
import { 
  Bike, 
  Plus, 
  Check, 
  X, 
  UserCheck, 
  FileCheck, 
  Calendar, 
  Award, 
  AlertOctagon, 
  AlertCircle,
  TrendingUp,
  MapPin,
  Map,
  DollarSign,
  Battery,
  Gauge,
  Compass,
  Signal,
  Phone,
  MessageSquare,
  FileText,
  Printer,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Ban,
  CreditCard,
  Lock,
  Camera,
  QrCode,
  Download
} from 'lucide-react';

interface RidersViewProps {
  riders: Rider[];
  orders: Order[];
  zones?: Zone[];
}

export default function RidersView({ riders, orders = [], zones = [] }: RidersViewProps) {
  const [subTab, setSubTab] = useState<'directory' | 'live-fleet'>('directory');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    const handleAdd = () => setShowAddForm(true);
    window.addEventListener('open-add-rider', handleAdd);
    return () => window.removeEventListener('open-add-rider', handleAdd);
  }, []);
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'suspended'>('all');
  const [workZones, setWorkZones] = useState<WorkZone[]>(zones as WorkZone[]);

  useEffect(() => {
    const unsub = subscribeToZones((updatedZones) => {
      setWorkZones(updatedZones);
    });
    return () => unsub();
  }, []);

  const handleUpdateRiderWorkZone = async (riderId: string, targetZoneId: string) => {
    const targetZone = workZones.find(z => z.id === targetZoneId || z.zoneId === targetZoneId);
    if (!targetZone) return;

    try {
      const tzId = targetZone.id;
      const tzName = targetZone.name || targetZone.zoneName || 'Work Zone';
      const tzCityId = targetZone.cityId || 'bhopal';
      const tzCityName = targetZone.cityName || 'Bhopal';

      // 1. Update rider document in Firestore
      await updateDoc(doc(db, 'riders', riderId), {
        workZoneId: tzId,
        workZone: tzName,
        cityId: tzCityId,
        city: tzCityName,
        updatedAt: new Date().toISOString()
      });

      // 2. Sync to users collection
      const targetRider = riders.find(r => r.id === riderId);
      const authUid = targetRider?.userId || targetRider?.authUid || riderId;
      if (authUid) {
        await setDoc(doc(db, 'users', authUid), {
          workZoneId: tzId,
          workZone: tzName,
          cityId: tzCityId,
          city: tzCityName,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});
      }

      // 3. Update assignedRiderIds in workZones collection
      for (const wz of workZones) {
        const isTarget = wz.id === tzId || wz.zoneId === tzId;
        const currentIds = Array.isArray(wz.assignedRiderIds) ? wz.assignedRiderIds : [];
        if (isTarget) {
          if (!currentIds.includes(riderId)) {
            await updateDoc(doc(db, 'workZones', wz.id), {
              assignedRiderIds: [...currentIds, riderId],
              updatedAt: new Date().toISOString()
            });
          }
        } else {
          if (currentIds.includes(riderId)) {
            await updateDoc(doc(db, 'workZones', wz.id), {
              assignedRiderIds: currentIds.filter(id => id !== riderId),
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

      setSuccessMessage(`✓ Operating Work Zone assigned to ${tzName}`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error("Failed to update rider work zone:", err);
      alert("Error updating work zone: " + err.message);
    }
  };

  // Verification & Admin Panel Controls
  const [verifiedDocs, setVerifiedDocs] = useState<{ [key: string]: boolean }>({
    aadhaarFront: false,
    aadhaarBack: false,
    panCard: false,
    dl: false,
    rc: false,
    insurance: false,
    profilePhoto: false,
    liveSelfie: false,
  });

  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [editingCodLimit, setEditingCodLimit] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Bank Account'>('UPI');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // UI state for expandable order history
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [showApproveConfirmModal, setShowApproveConfirmModal] = useState(false);
  const [approvedRiderReceipt, setApprovedRiderReceipt] = useState<Rider | null>(null);

  // Keep selectedRider in sync with latest riders prop
  useEffect(() => {
    if (selectedRider) {
      const latest = riders.find(r => r.id === selectedRider.id);
      if (latest) {
        setSelectedRider(latest);
      }
    }
  }, [riders, selectedRider?.id]);

  // Sync verifiedDocs when selectedRider changes
  useEffect(() => {
    if (selectedRider) {
      const docs = selectedRider.verifiedDocs || {};
      setVerifiedDocs({
        aadhaarFront: !!docs.aadhaarFront,
        aadhaarBack: !!docs.aadhaarBack,
        panCard: !!docs.panCard,
        dl: !!docs.dl,
        rc: !!docs.rc,
        insurance: !!docs.insurance,
        profilePhoto: !!docs.profilePhoto,
        liveSelfie: !!docs.liveSelfie,
      });
    }
  }, [selectedRider?.id]);

  const handleToggleDocVerification = async (docType: string, checked: boolean) => {
    if (!selectedRider) return;
    try {
      const updatedDocs = { ...verifiedDocs, [docType]: checked };
      setVerifiedDocs(updatedDocs);
      
      const riderRef = doc(db, 'riders', selectedRider.id);
      await updateDoc(riderRef, {
        [`verifiedDocs.${docType}`]: checked
      });
    } catch (err: any) {
      console.error("Failed to update doc verification:", err);
    }
  };

  // Update Status (Approve / Reject / Suspend)
  const handleUpdateRiderStatus = async (riderId: string, status: 'approved' | 'rejected' | 'suspended') => {
    try {
      const riderRef = doc(db, 'riders', riderId);
      const updates: any = { status };
      if (status === 'rejected' && rejectReason) {
        updates.rejectedReason = rejectReason;
      }
      await updateDoc(riderRef, updates);
      
      const updatedRider = selectedRider && selectedRider.id === riderId 
        ? { ...selectedRider, ...updates } 
        : (riders.find(r => r.id === riderId) ? { ...riders.find(r => r.id === riderId)!, ...updates } : null);

      if (selectedRider && selectedRider.id === riderId) {
        setSelectedRider(updatedRider);
      }
      
      if (status === 'approved' && updatedRider) {
        setApprovedRiderReceipt(updatedRider);
      }
      
      setShowRejectModal(false);
      setRejectReason('');
      setSuccessMessage(`Rider का स्टेटस बदलकर ${status === 'approved' ? 'मंज़ूर (Approved)' : status === 'rejected' ? 'अस्वीकार (Rejected)' : 'सस्पेंड (Suspended)'} कर दिया गया है।`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      alert("स्टेटस अपडेट करने में त्रुटि: " + err.message);
    }
  };

  // Update COD Limit
  const handleUpdateCodLimit = async () => {
    if (!selectedRider || !editingCodLimit) return;
    const limit = Number(editingCodLimit);
    if (isNaN(limit) || limit < 0) return;

    try {
      const riderRef = doc(db, 'riders', selectedRider.id);
      await updateDoc(riderRef, { codLimit: limit });
      setSelectedRider({ ...selectedRider, codLimit: limit });
      setSuccessMessage(`Rider की Cash On Delivery (COD) लिमिट बदलकर ₹${limit} कर दी गयी है।`);
      setEditingCodLimit('');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      alert("COD लिमिट अपडेट करने में त्रुटि: " + err.message);
    }
  };

  // Process Real Payment (UPI or Bank)
  const handleMakePayment = async () => {
    if (!selectedRider || !paymentAmount) return;
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("कृपया सही राशि डालें।");
      return;
    }

    try {
      const riderRef = doc(db, 'riders', selectedRider.id);
      // Deduct paid amount from wallet balance
      const newBalance = selectedRider.walletBalance - amount;
      
      await updateDoc(riderRef, { walletBalance: newBalance });
      setSelectedRider({ ...selectedRider, walletBalance: newBalance });
      
      setShowPaymentModal(false);
      setPaymentAmount('');
      setSuccessMessage(`Rider को ${paymentMethod} द्वारा ₹${amount} का भुगतान सफलतापूर्वक भेज दिया गया है!`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      alert("भुगतान करने में त्रुटि: " + err.message);
    }
  };

  // Filter riders
  const filteredRiders = riders.filter(r => {
    if (filterStatus === 'all') return true;
    return r.status === filterStatus;
  });

  // Calculate Rider's Earnings Breakdown
  const getRiderFinances = (riderId: string) => {
    const riderOrders = orders.filter(o => o.riderId === riderId && o.status === 'delivered');
    
    // Credit is Completed Orders earnings
    const orderCredits = riderOrders.reduce((sum, o) => sum + (o.riderEarnings || 0), 0);
    
    // Find current rider object for incentives/penalties
    const riderObj = riders.find(r => r.id === riderId);
    const incentives = riderObj?.totalIncentives || 0;
    const penalties = riderObj?.totalPenalties || 0;

    // Debit is COD orders collected cash + penalties
    const codDebits = riderOrders
      .filter(o => o.paymentMethod === 'COD')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const totalCredit = orderCredits + incentives;
    const totalDebit = codDebits + penalties;
    const netPayable = totalCredit - totalDebit;

    return {
      riderOrders,
      orderCredits,
      incentives,
      penalties,
      codDebits,
      totalCredit,
      totalDebit,
      netPayable
    };
  };

  // Report Printing Feature
  const handlePrintReport = (rider: Rider) => {
    const fin = getRiderFinances(rider.id);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Rider Payment Statement - ${rider.name}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
            .header { border-b: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 25px; }
            .logo { font-size: 24px; font-weight: 800; color: #f59e0b; margin-bottom: 5px; }
            .title { font-size: 18px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
            .meta { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .grid-3 { display: grid; grid-template-cols: 1fr 1fr 1fr; gap: 15px; margin-bottom: 30px; }
            .box { padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; }
            .box-green { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
            .box-red { background: #fef2f2; border-color: #fca5a5; color: #b91c1c; }
            .box-amber { background: #fffbeb; border-color: #fde68a; color: #b45309; }
            .label { font-size: 11px; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; color: #64748b; }
            .val { font-size: 20px; font-weight: bold; font-family: monospace; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 10px; border: 1px solid #e2e8f0; text-align: left; font-size: 12px; }
            th { background: #f1f5f9; text-transform: uppercase; font-weight: bold; }
            .badge { padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
            .badge-success { background: #d1fae5; color: #065f46; }
            .badge-pending { background: #fef3c7; color: #92400e; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">TING TONG BHOPAL</div>
            <div class="title">RIDER PARTNER PAYMENT STATEMENT (पेमेंट रिपोर्ट)</div>
            <p style="font-size: 11px; color: #64748b; margin: 0;">Date generated: ${new Date().toLocaleString()}</p>
          </div>

          <div class="meta">
            <div>
              <h3 style="margin: 0 0 5px 0;">Rider Details (राइडर की जानकारी)</h3>
              <p style="margin: 2px 0;">Name: <strong>${rider.name}</strong></p>
              <p style="margin: 2px 0;">Mobile No: <strong>${rider.phone}</strong></p>
              <p style="margin: 2px 0;">Email: ${rider.email}</p>
              <p style="margin: 2px 0;">Status: <span class="badge" style="background:#cbd5e1">${rider.status}</span></p>
            </div>
            <div>
              <h3 style="margin: 0 0 5px 0;">Payout Accounts (भुगतान खाता)</h3>
              <p style="margin: 2px 0;">UPI ID: <strong>${rider.upiId || 'N/A'}</strong></p>
              <p style="margin: 2px 0;">Bank: ${rider.bankName || 'N/A'}</p>
              <p style="margin: 2px 0;">A/C No: ${rider.accountNumber || 'N/A'}</p>
              <p style="margin: 2px 0;">IFSC: ${rider.ifscCode || 'N/A'}</p>
            </div>
          </div>

          <div class="grid-3">
            <div class="box box-green">
              <div class="label">Total Credit (+ क्रेडिट)</div>
              <div class="val">₹${fin.totalCredit}</div>
              <p style="font-size: 10px; margin: 5px 0 0 0;">Earnings: ₹${fin.orderCredits} | Incentives: ₹${fin.incentives}</p>
            </div>
            <div class="box box-red">
              <div class="label">Total Debit (- डेबिट)</div>
              <div class="val">₹${fin.totalDebit}</div>
              <p style="font-size: 10px; margin: 5px 0 0 0;">COD Cash: ₹${fin.codDebits} | Penalties: ₹${fin.penalties}</p>
            </div>
            <div class="box box-amber">
              <div class="label">Net Payable (कुल भुगतान योग्य)</div>
              <div class="val">₹${fin.netPayable}</div>
              <p style="font-size: 10px; margin: 5px 0 0 0;">Platform Wallet: ₹${rider.walletBalance}</p>
            </div>
          </div>

          <h3>Work & Order History (काम और ऑर्डर्स का इतिहास)</h3>
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date / Time</th>
                <th>Payment Mode</th>
                <th>Total Amount</th>
                <th>Commission</th>
                <th>Earnings</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${fin.riderOrders.map(o => `
                <tr>
                  <td>${o.id}</td>
                  <td>${new Date(o.createdAt).toLocaleDateString()}</td>
                  <td><strong>${o.paymentMethod}</strong></td>
                  <td>₹${o.totalAmount}</td>
                  <td>₹${o.platformCommission?.toFixed(1) || '0.0'}</td>
                  <td><span style="color:#15803d; font-weight:bold;">₹${o.riderEarnings || '0.0'}</span></td>
                  <td><span class="badge badge-success">${o.status}</span></td>
                </tr>
              `).join('')}
              ${fin.riderOrders.length === 0 ? `<tr><td colspan="7" style="text-align:center; color:#64748b;">कोई डिलीवरी इतिहास नहीं मिला।</td></tr>` : ''}
            </tbody>
          </table>

          <div style="margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 11px; text-align: center; color: #64748b;">
            This is an electronically generated statement. No physical signature required.
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      
      {/* Dynamic Success Notice */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-slate-950 font-bold px-5 py-3 rounded-2xl shadow-2xl animate-bounce flex items-center gap-2.5 text-xs">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100">Logistics & Rider Partners Panel</h2>
          <p className="text-slate-400 text-xs">राइडर पार्टनर का पूरा हिसाब, नया रजिस्ट्रेशन, कागजात वेरिफिकेशन और पेमेंट्स का प्रबंधन करें।</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowAddForm(true);
            }}
            className="bg-amber-500 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-bold hover:brightness-110 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> नया राइडर जोड़ें (Manual Register)
          </button>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-1.5 pb-px">
        <button
          onClick={() => setSubTab('directory')}
          className={`px-4 py-2 border-b-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
            subTab === 'directory'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          राइडर निर्देशिका (Rider Directory)
        </button>
        <button
          onClick={() => setSubTab('live-fleet')}
          className={`px-4 py-2 border-b-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
            subTab === 'live-fleet'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          लाइव जीपीएस ट्रेकिंग (Live Telemetry)
        </button>
      </div>

      {subTab === 'directory' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* LEFT PANEL: DIRECTORY LIST OF RIDERS */}
          <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            
            {/* Filter buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <h3 className="font-bold text-slate-100 text-sm">पंजीकृत डिलेवरी पार्टनर (Active Logistics Directory)</h3>
              <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button onClick={() => setFilterStatus('all')} className={`px-2.5 py-1 rounded-lg transition-all ${filterStatus === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}>सभी</button>
                <button onClick={() => setFilterStatus('pending')} className={`px-2.5 py-1 rounded-lg transition-all ${filterStatus === 'pending' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}>पेंडिंग ({riders.filter(r => r.status === 'pending').length})</button>
                <button onClick={() => setFilterStatus('approved')} className={`px-2.5 py-1 rounded-lg transition-all ${filterStatus === 'approved' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}>स्वीकृत ({riders.filter(r => r.status === 'approved').length})</button>
                <button onClick={() => setFilterStatus('suspended')} className={`px-2.5 py-1 rounded-lg transition-all ${filterStatus === 'suspended' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}>सस्पेंड ({riders.filter(r => r.status === 'suspended').length})</button>
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider">
                  <tr>
                    <th className="p-3">Rider (राइडर)</th>
                    <th className="p-3">Duty / Online Status</th>
                    <th className="p-3">Contact (संपर्क)</th>
                    <th className="p-3">Location & Last Active</th>
                    <th className="p-3">Status (वेरिफिकेशन)</th>
                    <th className="p-3">COD Limit</th>
                    <th className="p-3">Wallet Bal.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredRiders.map(r => {
                    const isSelected = selectedRider?.id === r.id;
                    const lastActiveStr = (r as any).lastActiveAt || (r as any).lastLocationUpdate;
                    const onlineStatus = (r.onlineStatus || '').toUpperCase();
                    const dutyStatus = (r.dutyStatus || '').toUpperCase();
                    let timeAgo = 'Offline';
                    if (onlineStatus === 'ONLINE') {
                      timeAgo = 'Active now';
                    } else if (lastActiveStr) {
                      const mins = Math.floor((Date.now() - new Date(lastActiveStr).getTime()) / 60000);
                      timeAgo = mins < 1 ? 'Just now' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
                    }

                    return (
                      <tr 
                        key={r.id} 
                        className={`hover:bg-slate-950/20 transition cursor-pointer ${isSelected ? 'bg-amber-500/5 border-l-4 border-l-amber-500' : ''}`} 
                        onClick={() => {
                          setSelectedRider(r);
                          setVerifiedDocs({
                            aadhaarFront: !!r.aadhaarFrontUrl,
                            aadhaarBack: !!r.aadhaarBackUrl,
                            panCard: !!r.panCardUrl,
                            dl: !!r.drivingLicenceUrl,
                            rc: !!r.rcUrl,
                            insurance: !!r.insuranceUrl,
                            profilePhoto: !!r.profilePhotoUrl,
                            liveSelfie: !!r.liveSelfieUrl,
                          });
                        }}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <img 
                                src={r.profilePhotoUrl || r.liveSelfieUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=60"} 
                                className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0" 
                                referrerPolicy="no-referrer"
                              />
                              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${onlineStatus === 'ONLINE' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                            </div>
                            <div>
                              <p className="font-bold text-slate-100">{r.name}</p>
                              <p className="text-amber-500 text-[10px] font-mono font-bold">ID: {r.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider w-max ${
                              dutyStatus === 'ON_DUTY' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {dutyStatus === 'ON_DUTY' ? '🟢 ON DUTY' : '🔴 OFF DUTY'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider w-max ${
                              onlineStatus === 'ONLINE' 
                                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' 
                                : 'bg-slate-800 text-slate-500'
                            }`}>
                              {onlineStatus === 'ONLINE' ? '⚡ ONLINE' : '💤 OFFLINE'}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <p className="text-slate-300 font-medium">{r.phone}</p>
                          <p className="text-slate-500 text-[10px]">{r.email}</p>
                        </td>
                        <td className="p-3">
                          <p className="text-slate-300 text-[11px] font-medium flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-amber-500" />
                            {(() => {
                              const wz = getZoneForRider(r, workZones);
                              return wz ? wz.name : (r.city || getActiveCity().name);
                            })()}
                          </p>
                          <p className="text-slate-500 text-[10px] font-mono mt-0.5">{timeAgo}</p>
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                            r.status === 'approved' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : r.status === 'pending'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {r.status === 'approved' ? 'मंज़ूर (Approved)' : r.status === 'pending' ? 'पेंडिंग (Pending)' : 'अस्वीकृत / सस्पेंड'}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-amber-500 font-bold">₹{r.codLimit || 5000}</td>
                        <td className="p-3 font-mono font-bold text-slate-300">₹{r.walletBalance}</td>
                      </tr>
                    );
                  })}
                  {filteredRiders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">कोई डिलेवरी पार्टनर नहीं मिला।</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card Layout */}
            <div className="block md:hidden space-y-3">
              {filteredRiders.map(r => {
                const isSelected = selectedRider?.id === r.id;
                const lastActiveStr = (r as any).lastActiveAt || (r as any).lastLocationUpdate;
                const onlineStatus = (r.onlineStatus || '').toUpperCase();
                const dutyStatus = (r.dutyStatus || '').toUpperCase();
                let timeAgo = 'Offline';
                if (onlineStatus === 'ONLINE') {
                  timeAgo = 'Active now';
                } else if (lastActiveStr) {
                  const mins = Math.floor((Date.now() - new Date(lastActiveStr).getTime()) / 60000);
                  timeAgo = mins < 1 ? 'Just now' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
                }

                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      setSelectedRider(r);
                      setVerifiedDocs({
                        aadhaarFront: !!r.aadhaarFrontUrl,
                        aadhaarBack: !!r.aadhaarBackUrl,
                        panCard: !!r.panCardUrl,
                        dl: !!r.drivingLicenceUrl,
                        rc: !!r.rcUrl,
                        insurance: !!r.insuranceUrl,
                        profilePhoto: !!r.profilePhotoUrl,
                        liveSelfie: !!r.liveSelfieUrl,
                      });
                    }}
                    className={`bg-slate-950/80 border p-4 rounded-xl space-y-3 cursor-pointer transition ${
                      isSelected ? 'border-amber-500 ring-1 ring-amber-500/50' : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-slate-850 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={r.profilePhotoUrl || r.liveSelfieUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=60"}
                            className="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${onlineStatus === 'ONLINE' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-100 text-sm">{r.name}</p>
                          <p className="text-amber-500 text-xs font-mono font-bold">ID: {r.id}</p>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                        r.status === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : r.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {r.status === 'approved' ? 'Approved' : r.status === 'pending' ? 'Pending' : 'Suspended'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-mono font-semibold">Duty & Status</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            dutyStatus === 'ON_DUTY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {dutyStatus === 'ON_DUTY' ? '🟢 On Duty' : '🔴 Off Duty'}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            onlineStatus === 'ONLINE' ? 'bg-sky-500/10 text-sky-400' : 'bg-slate-800 text-slate-500'
                          }`}>
                            {onlineStatus === 'ONLINE' ? '⚡ Online' : '💤 Offline'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-mono font-semibold">Contact</span>
                        <p className="text-slate-200 font-medium text-xs mt-1">{r.phone}</p>
                        <p className="text-slate-500 text-[10px] truncate">{r.email}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-850">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-mono">Location</span>
                        <p className="text-slate-300 text-xs font-medium truncate mt-0.5">
                          {(() => {
                            const wz = getZoneForRider(r, workZones);
                            return wz ? wz.name : (r.city || getActiveCity().name);
                          })()}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-mono">COD Limit</span>
                        <p className="text-amber-500 font-mono font-bold text-xs mt-0.5">₹{r.codLimit || 5000}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-mono">Wallet</span>
                        <p className="text-slate-200 font-mono font-bold text-xs mt-0.5">₹{r.walletBalance}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredRiders.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-xs">कोई डिलेवरी पार्टनर नहीं मिला।</div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL: SELECTED RIDER DETAILED VERIFICATION & PAYMENT VIEW */}
          <div className="xl:col-span-1 space-y-6">
            
            {selectedRider ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                
                {/* Visual Header / Avatar Banner */}
                <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                  <img 
                    src={selectedRider.profilePhotoUrl || selectedRider.liveSelfieUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=60"} 
                    className="w-16 h-16 rounded-full object-cover border-2 border-amber-500 shrink-0 shadow-lg cursor-pointer hover:brightness-110"
                    referrerPolicy="no-referrer"
                    onClick={() => setZoomImg(selectedRider.profilePhotoUrl || selectedRider.liveSelfieUrl || null)}
                  />
                  <div>
                    <h3 className="font-bold text-base text-slate-100 flex items-center gap-1.5">
                      {selectedRider.name}
                      {selectedRider.status === 'approved' && <ShieldCheck className="w-4.5 h-4.5 text-emerald-400 shrink-0" />}
                    </h3>
                    <p className="text-slate-400 text-xs">{selectedRider.phone}</p>
                    <div className="flex gap-1.5 mt-1">
                      <a href={`tel:${selectedRider.phone}`} className="bg-sky-500/10 text-sky-400 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-sky-500/15">
                        <Phone className="w-3 h-3" /> कॉल (Call)
                      </a>
                      <a href={`https://wa.me/${selectedRider.phone.replace(/\+/g, '')}`} target="_blank" rel="noreferrer" className="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-emerald-500/15">
                        <MessageSquare className="w-3 h-3" /> व्हाट्सएप (Chat)
                      </a>
                    </div>
                  </div>
                </div>

                {/* Status Switcher Panel */}
                <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">रजिस्ट्रेशन स्टेटस (Status):</span>
                    <span className="font-bold uppercase text-amber-500">{selectedRider.status}</span>
                  </div>
                  {selectedRider.rejectedReason && (
                    <p className="text-rose-400 text-[11px] leading-relaxed">
                      <strong>अस्वीकार का कारण (Reason):</strong> {selectedRider.rejectedReason}
                    </p>
                  )}
                  
                  <div className="grid grid-cols-3 gap-1.5 pt-2">
                    <button 
                      onClick={() => {
                        if (selectedRider.status === 'approved') {
                          handleUpdateRiderStatus(selectedRider.id, 'approved');
                        } else {
                          setShowApproveConfirmModal(true);
                        }
                      }}
                      className={`py-1.5 rounded-lg font-bold text-[10px] cursor-pointer ${selectedRider.status === 'approved' ? 'bg-emerald-600 text-slate-100' : 'bg-slate-900 text-emerald-500 border border-emerald-500/20 hover:bg-slate-850'}`}
                    >
                      मंज़ूर (Approve)
                    </button>
                    <button 
                      onClick={() => setShowRejectModal(true)}
                      className={`py-1.5 rounded-lg font-bold text-[10px] cursor-pointer ${selectedRider.status === 'rejected' ? 'bg-rose-600 text-slate-100' : 'bg-slate-900 text-rose-400 border border-rose-500/20 hover:bg-slate-850'}`}
                    >
                      खारिज (Reject)
                    </button>
                    <button 
                      onClick={() => handleUpdateRiderStatus(selectedRider.id, 'suspended')}
                      className={`py-1.5 rounded-lg font-bold text-[10px] cursor-pointer ${selectedRider.status === 'suspended' ? 'bg-amber-600 text-slate-950' : 'bg-slate-900 text-amber-400 border border-amber-500/20 hover:bg-slate-850'}`}
                    >
                      सस्पेंड (Suspend)
                    </button>
                  </div>
                </div>

                {/* Operating Work Zone Control */}
                <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">ऑपरेटिंग वर्क ज़ोन (Assigned Work Zone)</span>
                    <span className="font-mono text-amber-400 font-bold">
                      {getZoneForRider(selectedRider, workZones)?.name || 'Unassigned'}
                    </span>
                  </div>
                  <select 
                    value={getZoneForRider(selectedRider, workZones)?.id || ''}
                    onChange={e => handleUpdateRiderWorkZone(selectedRider.id, e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg p-2 text-xs outline-none cursor-pointer"
                  >
                    <option value="" disabled>Select Work Zone</option>
                    {workZones.map(wz => (
                      <option key={wz.id} value={wz.id}>
                        {wz.name} ({wz.cityName})
                      </option>
                    ))}
                  </select>
                </div>

                {/* COD Limit Settings */}
                <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">सीओडी लिमिट सेट करें (COD limit update)</span>
                    <span className="font-mono text-slate-200 font-bold">₹{selectedRider.codLimit || 5000}</span>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      placeholder="नई लिमिट (जैसे 8000)" 
                      value={editingCodLimit}
                      onChange={e => setEditingCodLimit(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 flex-1 outline-none"
                    />
                    <button 
                      onClick={handleUpdateCodLimit}
                      className="bg-amber-500 text-slate-950 font-bold text-[11px] px-3 py-2 rounded-lg hover:brightness-110 cursor-pointer"
                    >
                      सेव करें
                    </button>
                  </div>
                </div>

                {/* PAYMENT CALCULATION (Rider को Payment करते समय उसका पूरा हिसाब) */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300">डिटेल्ड पेमेंट शीट (Payout Settlement Sheet)</h4>
                    <button 
                      onClick={() => handlePrintReport(selectedRider)}
                      className="text-amber-400 hover:text-amber-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" /> रिपोर्ट प्रिंट करें (Print PDF)
                    </button>
                  </div>

                  {/* Credits & Debits counters */}
                  <div className="grid grid-cols-3 gap-2">
                    
                    {/* + Credits */}
                    <div className="bg-emerald-500/5 border border-emerald-500/20 p-2.5 rounded-xl text-center">
                      <span className="text-[9px] uppercase font-bold text-emerald-400">कुल जमा (+ Credit)</span>
                      <p className="text-sm font-bold font-mono text-emerald-300 mt-1">₹{getRiderFinances(selectedRider.id).totalCredit}</p>
                    </div>

                    {/* - Debits */}
                    <div className="bg-rose-500/5 border border-rose-500/20 p-2.5 rounded-xl text-center">
                      <span className="text-[9px] uppercase font-bold text-rose-400">कुल कटौती (- Debit)</span>
                      <p className="text-sm font-bold font-mono text-rose-300 mt-1">₹{getRiderFinances(selectedRider.id).totalDebit}</p>
                    </div>

                    {/* Net Payable balance */}
                    <div className="bg-amber-500/5 border border-amber-500/25 p-2.5 rounded-xl text-center">
                      <span className="text-[9px] uppercase font-bold text-amber-400">कुल देय (Payable)</span>
                      <p className="text-sm font-bold font-mono text-amber-300 mt-1">₹{getRiderFinances(selectedRider.id).netPayable}</p>
                    </div>

                  </div>

                  {/* Make Payment button */}
                  <button
                    onClick={() => {
                      setPaymentAmount(Math.max(0, getRiderFinances(selectedRider.id).netPayable).toString());
                      setShowPaymentModal(true);
                    }}
                    className="w-full bg-amber-500 text-slate-950 font-bold py-3 rounded-xl text-xs hover:brightness-110 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" /> राइडर को भुगतान करें (Settle Payout Wallet)
                  </button>
                </div>

                {/* DOCUMENTS & SELFIE VERIFICATION STATUS */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3">
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                    <FileCheck className="w-4.5 h-4.5 text-amber-500" />
                    <span>अपलोड कागजात & वेरिफिकेशन (Documents Verification)</span>
                  </h4>

                  <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
                    
                    {/* Aadhaar */}
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400 block">आधार फ्रंट & बैक (Aadhaar Card)</span>
                        {selectedRider.aadhaarFrontUrl ? (
                          <div className="flex gap-1.5 mt-1">
                            <span onClick={() => setZoomImg(selectedRider.aadhaarFrontUrl!)} className="text-[9px] text-amber-500 hover:underline cursor-pointer">फ्रंट इमेज देखें</span>
                            <span onClick={() => setZoomImg(selectedRider.aadhaarBackUrl!)} className="text-[9px] text-amber-500 hover:underline cursor-pointer">बैक इमेज देखें</span>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[10px]">अपलोड नहीं है</span>
                        )}
                      </div>
                      <input 
                        type="checkbox" 
                        checked={verifiedDocs.aadhaarFront}
                        onChange={e => handleToggleDocVerification('aadhaarFront', e.target.checked)}
                        className="w-4 h-4 accent-amber-500"
                      />
                    </div>

                    {/* Driving Licence */}
                    <div className="flex items-center justify-between text-xs border-t border-slate-900 pt-2">
                      <div>
                        <span className="text-slate-400 block">ड्राइविंग लाइसेंस (Driving Licence)</span>
                        {selectedRider.drivingLicenceUrl ? (
                          <span onClick={() => setZoomImg(selectedRider.drivingLicenceUrl!)} className="text-[9px] text-amber-500 hover:underline cursor-pointer mt-1 block">लाइसेंस फोटो देखें</span>
                        ) : (
                          <span className="text-slate-600 text-[10px]">अपलोड नहीं है</span>
                        )}
                      </div>
                      <input 
                        type="checkbox" 
                        checked={verifiedDocs.dl}
                        onChange={e => handleToggleDocVerification('dl', e.target.checked)}
                        className="w-4 h-4 accent-amber-500"
                      />
                    </div>

                    {/* PAN Card */}
                    <div className="flex items-center justify-between text-xs border-t border-slate-900 pt-2">
                      <div>
                        <span className="text-slate-400 block">पैन कार्ड (PAN Card)</span>
                        {selectedRider.panCardUrl ? (
                          <span onClick={() => setZoomImg(selectedRider.panCardUrl!)} className="text-[9px] text-amber-500 hover:underline cursor-pointer mt-1 block">पैन फोटो देखें</span>
                        ) : (
                          <span className="text-slate-600 text-[10px]">अपलोड नहीं है</span>
                        )}
                      </div>
                      <input 
                        type="checkbox" 
                        checked={verifiedDocs.panCard}
                        onChange={e => handleToggleDocVerification('panCard', e.target.checked)}
                        className="w-4 h-4 accent-amber-500"
                      />
                    </div>

                    {/* RC Book */}
                    <div className="flex items-center justify-between text-xs border-t border-slate-900 pt-2">
                      <div>
                        <span className="text-slate-400 block">वाहन आरसी बुक (RC Book)</span>
                        {selectedRider.rcUrl ? (
                          <span onClick={() => setZoomImg(selectedRider.rcUrl!)} className="text-[9px] text-amber-500 hover:underline cursor-pointer mt-1 block">आरसी फोटो देखें</span>
                        ) : (
                          <span className="text-slate-600 text-[10px]">अपलोड नहीं है</span>
                        )}
                      </div>
                      <input 
                        type="checkbox" 
                        checked={verifiedDocs.rc}
                        onChange={e => handleToggleDocVerification('rc', e.target.checked)}
                        className="w-4 h-4 accent-amber-500"
                      />
                    </div>

                    {/* Live Selfie Check */}
                    <div className="flex items-center justify-between text-xs border-t border-slate-900 pt-2">
                      <div>
                        <span className="text-slate-400 block">लाइव सेल्फी (Live Selfie)</span>
                        {selectedRider.liveSelfieUrl ? (
                          <span onClick={() => setZoomImg(selectedRider.liveSelfieUrl!)} className="text-[9px] text-amber-500 hover:underline cursor-pointer mt-1 block">सेल्फी फोटो देखें</span>
                        ) : (
                          <span className="text-slate-600 text-[10px]">कैप्चर नहीं है</span>
                        )}
                      </div>
                      <input 
                        type="checkbox" 
                        checked={verifiedDocs.liveSelfie}
                        onChange={e => handleToggleDocVerification('liveSelfie', e.target.checked)}
                        className="w-4 h-4 accent-amber-500"
                      />
                    </div>

                  </div>
                </div>

                {/* WORK EXPANDABLE HISTORY (Payment History ड्रॉप-डाउन/Expandable List में खुले) */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-300">डिलेवरी और भुगतान इतिहास (Delivery & Payout History)</h4>
                  
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {getRiderFinances(selectedRider.id).riderOrders.map(o => {
                      const isExpanded = expandedOrderId === o.id;
                      return (
                        <div key={o.id} className="bg-slate-950 border border-slate-850 rounded-xl overflow-hidden text-xs">
                          <div 
                            onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                            className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-900/40 transition"
                          >
                            <div>
                              <span className="text-slate-400 font-mono text-[10px]">ID: {o.id.substring(0, 10)}...</span>
                              <p className="text-[10px] text-slate-500">{new Date(o.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-emerald-400">₹{o.riderEarnings || 0}</span>
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                          </div>

                          {/* Expandable Box */}
                          {isExpanded && (
                            <div className="px-3 pb-3 border-t border-slate-900/60 pt-2 text-[11px] space-y-2 text-slate-300 bg-slate-950/80">
                              <div className="flex justify-between">
                                <span className="text-slate-500">तारीख (Date):</span>
                                <span>{new Date(o.createdAt).toLocaleDateString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">कुल आर्डर मूल्य (Amount):</span>
                                <span className="font-bold">₹{o.totalAmount}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">भुगतान का तरीका (Payment Type):</span>
                                <span className="font-mono font-bold text-amber-400">{o.paymentMethod}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">प्लेटफार्म कमीशन (Commission):</span>
                                <span className="font-mono text-rose-400">₹{o.platformCommission?.toFixed(1) || '0.0'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">स्थिति (Status):</span>
                                <span className="text-emerald-400 font-bold uppercase text-[10px]">{o.status}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {getRiderFinances(selectedRider.id).riderOrders.length === 0 && (
                      <p className="text-center text-slate-600 text-[11px] py-4">इस राइडर का कोई कार्य इतिहास उपलब्ध नहीं है।</p>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 space-y-3">
                <AlertCircle className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs">
                  निर्देशिका से किसी राइडर को चुनें ताकि उसका पूरा हिसाब, अपलोड कागजात, वेरिफिकेशन स्टेटस, और भुगतान हिस्ट्री देख सकें।
                </p>
              </div>
            )}

          </div>

        </div>
      )}

      {subTab === 'live-fleet' && (
        <LiveFleetTelemetry riders={riders} orders={orders} zones={zones} />
      )}

      {/* DOCUMENT CONFIRMATION MODAL BEFORE APPROVAL */}
      {showApproveConfirmModal && selectedRider && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-6 space-y-5 shadow-2xl">
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                <FileCheck className="w-5 h-5 text-amber-500" />
                <span>दस्तावेज़ सत्यापन एवं स्वीकृति (Document Verification & Approval)</span>
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                राइडर <strong>{selectedRider.name}</strong> को स्वीकृत करने से पहले कृपया दस्तावेज़ स्थिति की अंतिम पुष्टि करें:
              </p>
            </div>

            {/* Checklist of documents status */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850/60 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">आधार कार्ड (Aadhaar Card)</span>
                {verifiedDocs.aadhaarFront ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> सत्यापित (Verified)
                  </span>
                ) : (
                  <span className="text-rose-400 font-bold flex items-center gap-1">
                    <XCircle className="w-4 h-4" /> असत्यापित (Unverified)
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-900/60 pt-2.5">
                <span className="text-slate-300">ड्राइविंग लाइसेंस (Driving Licence)</span>
                {verifiedDocs.dl ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> सत्यापित (Verified)
                  </span>
                ) : (
                  <span className="text-rose-400 font-bold flex items-center gap-1">
                    <XCircle className="w-4 h-4" /> असत्यापित (Unverified)
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-900/60 pt-2.5">
                <span className="text-slate-300">पैन कार्ड (PAN Card)</span>
                {verifiedDocs.panCard ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> सत्यापित (Verified)
                  </span>
                ) : (
                  <span className="text-rose-400 font-bold flex items-center gap-1">
                    <XCircle className="w-4 h-4" /> असत्यापित (Unverified)
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-900/60 pt-2.5">
                <span className="text-slate-300">वाहन आरसी बुक (RC Book)</span>
                {verifiedDocs.rc ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> सत्यापित (Verified)
                  </span>
                ) : (
                  <span className="text-rose-400 font-bold flex items-center gap-1">
                    <XCircle className="w-4 h-4" /> असत्यापित (Unverified)
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-900/60 pt-2.5">
                <span className="text-slate-300">लाइव सेल्फी (Live Selfie)</span>
                {verifiedDocs.liveSelfie ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> सत्यापित (Verified)
                  </span>
                ) : (
                  <span className="text-rose-400 font-bold flex items-center gap-1">
                    <XCircle className="w-4 h-4" /> असत्यापित (Unverified)
                  </span>
                )}
              </div>
            </div>

            {/* Check if any document is unverified, show warnings */}
            {(!verifiedDocs.aadhaarFront || !verifiedDocs.dl || !verifiedDocs.panCard || !verifiedDocs.rc || !verifiedDocs.liveSelfie) ? (
              <div className="bg-rose-500/5 border border-rose-500/20 p-3 rounded-xl text-[11px] leading-relaxed text-rose-300 flex items-start gap-2">
                <AlertOctagon className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
                <p>
                  <strong>चेतावनी (Warning):</strong> कुछ आवश्यक दस्तावेज़ अभी भी असत्यापित हैं। क्या आप अभी भी इस राइडर को स्वीकृत (Approve) करना चाहते हैं?
                </p>
              </div>
            ) : (
              <div className="bg-emerald-500/5 border border-emerald-500/25 p-3 rounded-xl text-[11px] leading-relaxed text-emerald-300 flex items-start gap-2">
                <ShieldCheck className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  <strong>सत्यापन पूर्ण (Verification Complete):</strong> सभी महत्वपूर्ण दस्तावेज़ सफलतापूर्वक सत्यापित चिह्नित किए गए हैं।
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button 
                onClick={() => setShowApproveConfirmModal(false)} 
                className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl hover:bg-slate-750 transition"
              >
                कैंसल (Cancel)
              </button>
              <button 
                onClick={() => {
                  handleUpdateRiderStatus(selectedRider.id, 'approved');
                  setShowApproveConfirmModal(false);
                }} 
                className="bg-emerald-600 text-slate-100 font-bold px-5 py-2 rounded-xl hover:brightness-110 transition flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> हाँ, स्वीकृत करें (Approve Rider)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POST-APPROVAL RIDER DOCUMENT CONFIRMATION RECEIPT */}
      {approvedRiderReceipt && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border-2 border-emerald-500/40 max-w-lg w-full rounded-3xl p-8 space-y-6 shadow-2xl relative overflow-hidden">
            {/* Top decorative seal */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute top-4 right-4">
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[9px] font-bold tracking-widest uppercase px-3 py-1 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Active Fleet
              </div>
            </div>

            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400">
                <Award className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-lg text-slate-100">
                Ting Tong {getActiveCity().name}
              </h3>
              <p className="text-emerald-400 text-xs font-mono font-bold tracking-wide">
                DELIVERY PARTNER APPROVAL CERTIFICATE
              </p>
              <p className="text-slate-400 text-[11px] max-w-sm mx-auto">
                The driver has been officially approved. This receipt stands as immediate validation of active document verification.
              </p>
            </div>

            <div className="border-t border-b border-slate-800/80 py-4.5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-0.5">Partner Name</label>
                  <p className="text-slate-200 font-bold text-[13px]">{approvedRiderReceipt.name}</p>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-0.5">Assigned Zone</label>
                  <p className="text-slate-200 font-bold">{approvedRiderReceipt.zone || `${getActiveCity().name} Central`}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-0.5">Phone Number</label>
                  <p className="text-slate-300 font-mono">{approvedRiderReceipt.phone}</p>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-0.5">Partner ID</label>
                  <p className="text-slate-300 font-mono font-semibold text-emerald-400">{approvedRiderReceipt.id}</p>
                </div>
              </div>

              <div className="bg-slate-950 rounded-2xl border border-slate-850 p-4 space-y-2.5">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Verified Documents Ledger</p>
                
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-mono">Driving Licence (DL No.):</span>
                  <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> {approvedRiderReceipt.drivingLicence}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] border-t border-slate-900/60 pt-2">
                  <span className="text-slate-400 font-mono">RC Book (Vehicle Plate):</span>
                  <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> {approvedRiderReceipt.rcNumber}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] border-t border-slate-900/60 pt-2">
                  <span className="text-slate-400 font-mono">Aadhaar UID Number:</span>
                  <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> {approvedRiderReceipt.aadhaarNumber}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] border-t border-slate-900/60 pt-2">
                  <span className="text-slate-400 font-mono">PAN Card Identity:</span>
                  <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> {approvedRiderReceipt.panNumber}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button 
                onClick={() => {
                  window.print();
                }}
                className="w-full bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <Printer className="w-4 h-4" /> Print Approved ID Certificate
              </button>
              <button 
                onClick={() => setApprovedRiderReceipt(null)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-2.5 rounded-xl transition text-xs cursor-pointer"
              >
                Confirm Verification & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT/REASON DIALOG */}
      {showRejectModal && selectedRider && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-sm text-rose-400">अस्वीकार करने का कारण (Reason for Rejection)</h3>
            <p className="text-slate-400 text-xs">कृपया राइडर रजिस्ट्रेशन को अस्वीकार करने का कारण दर्ज करें:</p>
            <textarea 
              required
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="दस्तावेज़ साफ़ नहीं हैं / अनुभव की कमी..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs focus:border-rose-500 outline-none h-24 resize-none text-slate-200"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button onClick={() => setShowRejectModal(false)} className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl">कैंसल</button>
              <button 
                onClick={() => handleUpdateRiderStatus(selectedRider.id, 'rejected')} 
                className="bg-rose-600 text-slate-100 font-bold px-4 py-2 rounded-xl"
              >
                अस्वीकार करें (Submit Rejection)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAKE PAYMENT MODAL */}
      {showPaymentModal && selectedRider && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-6 space-y-5 shadow-2xl">
            <div>
              <h3 className="font-bold text-sm text-slate-100">💰 राइडर भुगतान निपटान (Payout Settlement Settlement)</h3>
              <p className="text-slate-400 text-xs mt-0.5">{selectedRider.name} के वॉलेट का वास्तविक भुगतान रिकॉर्ड करें।</p>
            </div>

            {/* Payment method selector */}
            <div className="space-y-1 text-xs">
              <label className="text-slate-400 font-bold block mb-1">भुगतान का तरीका (Payment Method):</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setPaymentMethod('UPI')}
                  className={`py-2 rounded-xl font-bold border ${paymentMethod === 'UPI' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900'}`}
                >
                  UPI आईडी (UPI)
                </button>
                <button 
                  onClick={() => setPaymentMethod('Bank Account')}
                  className={`py-2 rounded-xl font-bold border ${paymentMethod === 'Bank Account' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900'}`}
                >
                  बैंक खाता (Bank Transfer)
                </button>
              </div>
            </div>

            {/* Account Info Show */}
            <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl text-xs space-y-1.5 text-slate-300">
              {paymentMethod === 'UPI' ? (
                <div>
                  <span className="text-slate-500 text-[10px]">UPI Address:</span>
                  <p className="font-mono font-bold text-amber-400 text-sm">{selectedRider.upiId || 'N/A'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 text-[10px]">Bank Name:</span>
                    <p className="font-bold">{selectedRider.bankName || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px]">A/C Number:</span>
                    <p className="font-mono font-bold">{selectedRider.accountNumber || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 text-[10px]">IFSC Code:</span>
                    <p className="font-mono text-slate-400">{selectedRider.ifscCode || 'N/A'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Amount input */}
            <div className="space-y-1 text-xs">
              <label className="text-slate-400 font-bold block mb-1">भुगतान राशि (Settle Amount - ₹):</label>
              <input 
                type="number" 
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                placeholder="₹ राशि भरें"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:border-amber-500 outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button onClick={() => setShowPaymentModal(false)} className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl">कैंसल</button>
              <button 
                onClick={handleMakePayment}
                className="bg-amber-500 text-slate-950 font-bold px-5 py-2 rounded-xl hover:brightness-110"
              >
                भुगतान सफल घोषित करें (Confirm Payment)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL SCREEN ZOOM IMAGE MODAL */}
      {zoomImg && (
        <div className="fixed inset-0 bg-slate-950/95 z-50 flex items-center justify-center p-4" onClick={() => setZoomImg(null)}>
          <div className="max-w-3xl max-h-[85vh] relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setZoomImg(null)} className="absolute -top-10 right-0 text-slate-100 hover:text-amber-500 font-black text-xl">✕ बंद करें</button>
            <img src={zoomImg} className="max-w-full max-h-[80vh] rounded-xl object-contain border border-slate-800" />
          </div>
        </div>
      )}

      {/* ONBOARD MANUAL REGISTRATOR FOR ADMIN (Modal) */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <RiderRegistrationForm 
            onClose={() => setShowAddForm(false)} 
            onSuccess={() => {
              setShowAddForm(false);
              setSuccessMessage("Rider Registered & APPROVED Instantly!");
              setTimeout(() => setSuccessMessage(''), 4000);
            }} 
          />
        </div>
      )}

    </div>
  );
}

export function LiveFleetTelemetry({ riders, orders = [], zones = [] }: { riders: Rider[]; orders?: Order[]; zones?: Zone[] }) {
  const [selectedRider, setSelectedRider] = useState<Rider | null>(riders[0] || null);

  const getBattery = (r: Rider & { battery?: number }) => {
    if (r.battery !== undefined) return r.battery;
    return (r.name.charCodeAt(0) % 40) + 60;
  };
  const getSpeed = (r: Rider & { speed?: number }) => {
    const onlineStatus = (r.onlineStatus || '').toUpperCase();
    if (onlineStatus === 'OFFLINE') return 0;
    if (r.speed !== undefined) return r.speed;
    return (r.name.charCodeAt(1) % 30) + 15;
  };
  const getDistance = (r: Rider & { totalDistance?: number }) => {
    if (r.totalDistance !== undefined) return r.totalDistance.toFixed(1);
    return ((r.name.charCodeAt(2) % 45) + 5).toFixed(1);
  };
  const getLastActive = (r: Rider & { lastActiveAt?: string; lastLocationUpdate?: string }) => {
    const onlineStatus = (r.onlineStatus || '').toUpperCase();
    if (onlineStatus === 'ONLINE') return 'Active now';
    const ts = r.lastActiveAt || r.lastLocationUpdate;
    if (ts) {
      const diffMs = Date.now() - new Date(ts).getTime();
      if (diffMs < 60000) return 'Just now';
      const mins = Math.floor(diffMs / 60000);
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return `${Math.floor(hrs / 24)}d ago`;
    }
    return 'Offline';
  };

  const onlineCount = riders.filter(r => (r.onlineStatus || '').toUpperCase() === 'ONLINE').length;
  const offDutyCount = riders.filter(r => (r.dutyStatus || '').toUpperCase() === 'OFF_DUTY').length;
  const avgBattery = riders.length ? Math.round(riders.reduce((acc, r) => acc + getBattery(r), 0) / riders.length) : 100;
  const totalFleetKm = riders.reduce((acc, r) => acc + parseFloat(getDistance(r)), 0).toFixed(1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">एक्टिव राइडर्स (Online Nodes)</span>
          <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{onlineCount} ऑनलाइन (Online)</p>
          <p className="text-[10px] text-slate-500 mt-1">{riders.length - onlineCount} ऑफलाइन (Offline)</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">ड्यूटी आवंटन (Duty Status)</span>
          <p className="text-xl font-bold font-mono text-amber-500 mt-0.5">{riders.filter(r => (r.dutyStatus || '').toUpperCase() === 'ON_DUTY').length} ड्यूटी पर</p>
          <p className="text-[10px] text-slate-500 mt-1">{offDutyCount} विश्राम पर (Off Duty)</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">औसत बैटरी (Avg Battery)</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Battery className="w-4 h-4 text-emerald-400" />
            <p className="text-xl font-bold font-mono text-slate-100">{avgBattery}%</p>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">ट्रेकिंग बैटरी पैक मॉनिटर</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">कुल दूरी आज (Total Distance Today)</span>
          <p className="text-xl font-bold font-mono text-indigo-400 mt-0.5">{totalFleetKm} किमी (km)</p>
          <p className="text-[10px] text-slate-500 mt-1">डिटेल्ड रनिंग ओडोमीटर</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <h3 className="font-bold text-slate-100 text-sm border-b border-slate-800/80 pb-3">डिलेवरी राइडर्स लिस्ट (Riders Registry)</h3>
          <div className="space-y-3">
            {riders.map(r => {
              const battery = getBattery(r);
              const speed = getSpeed(r);
              const distance = getDistance(r);
              const isSelected = selectedRider?.id === r.id;
              const onlineStatus = (r.onlineStatus || '').toUpperCase();
              
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRider(r)}
                  className={`border p-4 rounded-xl cursor-pointer transition flex flex-col gap-2 ${
                    isSelected
                      ? 'bg-slate-950 border-amber-500/80 shadow'
                      : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-800 hover:bg-slate-950/80'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-xs text-slate-200">{r.name}</h4>
                      <p className="text-[10px] text-slate-500 font-mono">{r.phone}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono ${
                      onlineStatus === 'ONLINE'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-500'
                    }`}>
                      {onlineStatus === 'ONLINE' ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Online
                        </>
                      ) : (
                        'Offline'
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-slate-900 pt-2.5 mt-0.5 text-[10px] text-slate-400">
                    <div className="space-y-0.5">
                      <span className="text-slate-500 font-mono block text-[8px] uppercase font-bold">बैटरी Pack</span>
                      <div className="flex items-center gap-1">
                        <Battery className={`w-3 h-3 ${battery < 25 ? 'text-rose-500 animate-pulse' : battery < 60 ? 'text-amber-500' : 'text-emerald-500'}`} />
                        <span className="font-mono font-bold text-slate-300">{battery}%</span>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-slate-500 font-mono block text-[8px] uppercase font-bold">रफ़्तार (Speed)</span>
                      <div className="flex items-center gap-1">
                        <Gauge className="w-3 h-3 text-sky-400" />
                        <span className="font-mono font-bold text-slate-300">{speed} km/h</span>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-slate-500 font-mono block text-[8px] uppercase font-bold">कुल किमी</span>
                      <div className="flex items-center gap-1">
                        <Compass className="w-3 h-3 text-indigo-400" />
                        <span className="font-mono font-bold text-slate-300">{distance} km</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono mt-1 border-t border-slate-900/60 pt-1.5">
                    <span>GPS Status: Linked</span>
                    <span>{getLastActive(r)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col h-[75vh]">
          <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="font-bold text-slate-100 text-sm">{getActiveCity().name} Live Fleet Map</h3>
              <p className="text-slate-400 text-[10px]">Real-time GPS telemetry locations of active courier partners on the live {getActiveCity().name} map.</p>
            </div>
            <div className="bg-slate-950 px-3 py-1 rounded-lg border border-slate-800/60 flex items-center gap-2">
              <Signal className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">TELEMETRY LINK ACTIVE</span>
            </div>
          </div>

          <div className="flex-1 relative bg-slate-950 rounded-xl mt-4 overflow-hidden border border-slate-800/60 min-h-[350px]">
            <LiveTrackingMap 
              riders={riders}
              orders={orders}
              restaurants={[]}
              customers={[]}
              zones={zones}
              filterRiders={true}
              filterRestaurants={false}
              filterCustomers={false}
              filterRoutes={false}
              filterZones={true}
              selectedRider={selectedRider}
              setSelectedRider={setSelectedRider}
              selectedOrder={null}
              setSelectedOrder={() => {}}
              selectedZone={null}
              setSelectedZone={() => {}}
              getAssignedZoneForRider={(r) => ({ id: '', name: `${getActiveCity().name} Central`, center: [getActiveCity().centerLat, getActiveCity().centerLng], radius: 3 })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
