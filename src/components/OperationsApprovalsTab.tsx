import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  setDoc, 
  addDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { Restaurant, Rider, Customer, Order } from '../types';
import { 
  Users, 
  Store, 
  Bike, 
  ShieldAlert, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  UserX, 
  CheckCircle, 
  CreditCard, 
  Briefcase, 
  Award, 
  FileText 
} from 'lucide-react';

interface OperationsApprovalsTabProps {
  restaurants: Restaurant[];
  riders: Rider[];
  customers: Customer[];
  onLogEvent: (action: string, details: string) => void;
}

interface InternalUser {
  id: string;
  name: string;
  email: string;
  role: 'Super Admin' | 'Manager' | 'Dispatcher' | 'Support Agent' | 'Financial Auditor';
  status: 'active' | 'suspended';
}

export default function OperationsApprovalsTab({ restaurants, riders, customers, onLogEvent }: OperationsApprovalsTabProps) {
  const [loading, setLoading] = useState(true);
  const [internalUsers, setInternalUsers] = useState<InternalUser[]>([]);
  
  // New user form states
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'Super Admin' | 'Manager' | 'Dispatcher' | 'Support Agent' | 'Financial Auditor'>('Dispatcher');

  // Permission matrix map state (local model backed by Firestore)
  const [permissionMatrix, setPermissionMatrix] = useState<Record<string, string[]>>({
    'Super Admin': ['READ_ORDERS', 'APPROVE_VENDORS', 'MANAGE_FLEET', 'MUTATE_WALLET', 'SYSTEM_CORE'],
    'Manager': ['READ_ORDERS', 'APPROVE_VENDORS', 'MANAGE_FLEET', 'MUTATE_WALLET'],
    'Dispatcher': ['READ_ORDERS', 'MANAGE_FLEET'],
    'Support Agent': ['READ_ORDERS'],
    'Financial Auditor': ['READ_ORDERS', 'MUTATE_WALLET']
  });

  // Customer Adjust states
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [walletAdjustment, setWalletAdjustment] = useState('100');
  const [walletReason, setWalletReason] = useState('Promotional cash rewards credit');
  const [pointsAdjustment, setPointsAdjustment] = useState('50');

  // Rider inspect document modal states
  const [inspectRider, setInspectRider] = useState<Rider | null>(null);

  useEffect(() => {
    const fetchOperationsData = async () => {
      try {
        const userSnap = await getDocs(collection(db, 'internal_users'));
        if (!userSnap.empty) {
          setInternalUsers(userSnap.docs.map(d => ({ id: d.id, ...d.data() }) as InternalUser));
        } else {
          setInternalUsers([
            { id: 'usr_1', name: 'Ramesh Banshkar', email: 'rambanshkar1@gmail.com', role: 'Super Admin', status: 'active' },
            { id: 'usr_2', name: 'Alok Saxena', email: 'alok.dispatcher@tingtong.com', role: 'Dispatcher', status: 'active' },
            { id: 'usr_3', name: 'Sujata Deshmukh', email: 'sujata.auditor@tingtong.com', role: 'Financial Auditor', status: 'active' }
          ]);
        }

        const permSnap = await getDocs(collection(db, 'internal_permissions'));
        if (!permSnap.empty) {
          const matrix: Record<string, string[]> = {};
          permSnap.docs.forEach(d => {
            matrix[d.id] = d.data().permissions || [];
          });
          setPermissionMatrix(matrix);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchOperationsData();
  }, []);

  // Internal users operations
  const handleAddInternalUser = async () => {
    if (!newUserName || !newUserEmail) return;
    try {
      const id = "usr_" + Date.now();
      const u: InternalUser = {
        id,
        name: newUserName,
        email: newUserEmail.toLowerCase().trim(),
        role: newUserRole,
        status: 'active'
      };

      await setDoc(doc(db, 'internal_users', id), u);
      setInternalUsers([...internalUsers, u]);
      onLogEvent('INTERNAL_USER_CREATED', `Granted user ${u.name} role of ${u.role}`);
      setNewUserName('');
      setNewUserEmail('');
      alert(`User ${u.name} successfully provisioned and linked!`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateInternalUserRole = async (id: string, role: any) => {
    try {
      await updateDoc(doc(db, 'internal_users', id), { role });
      setInternalUsers(internalUsers.map(u => u.id === id ? { ...u, role } : u));
      onLogEvent('INTERNAL_ROLE_MODIFIED', `Adjusted roles access policies for user index ID: ${id} to ${role}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSuspendInternalUser = async (id: string, status: 'active' | 'suspended') => {
    try {
      await updateDoc(doc(db, 'internal_users', id), { status });
      setInternalUsers(internalUsers.map(u => u.id === id ? { ...u, status } : u));
      onLogEvent('INTERNAL_USER_SUSPENDED', `Suspended login and write-auth access for user ID: ${id}`);
    } catch (err) {
      console.error(err);
    }
  };

  // Matrix Checkboxes
  const handleToggleMatrixPermission = async (role: string, perm: string) => {
    const current = permissionMatrix[role] || [];
    const updated = current.includes(perm) 
      ? current.filter(p => p !== perm) 
      : [...current, perm];

    try {
      await setDoc(doc(db, 'internal_permissions', role), { permissions: updated });
      setPermissionMatrix({
        ...permissionMatrix,
        [role]: updated
      });
      onLogEvent('PERMISSIONS_MATRIX_UPDATED', `Overrode credentials matrix for role [${role}]: [${perm}]`);
    } catch (err) {
      console.error(err);
    }
  };

  // Merchant Approvals
  const handleUpdateMerchantStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'restaurants', id), { status });
      onLogEvent('MERCHANT_STATUS_MODIFIED', `Changed vendor approval credentials for store ${id} to: ${status}`);
      alert(`Merchant vendor status updated successfully to ${status}!`);
    } catch (err) {
      console.error(err);
    }
  };

  // Rider Approvals
  const handleUpdateRiderStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'riders', id), { status });
      onLogEvent('RIDER_STATUS_MODIFIED', `Altered rider fleet registration status for driver ID ${id} to: ${status}`);
      alert(`Rider application status updated to ${status}!`);
    } catch (err) {
      console.error(err);
    }
  };

  // Customer Management (Wallet adjustments)
  const handleAdjustCustomerWallet = async (action: 'credit' | 'debit') => {
    if (!selectedCustomerId) return;
    const factor = action === 'credit' ? 1 : -1;
    const deltaVal = Number(walletAdjustment) * factor;

    try {
      const cust = customers.find(c => c.id === selectedCustomerId);
      if (!cust) return;

      const newBalance = Math.max(0, cust.walletBalance + deltaVal);
      await updateDoc(doc(db, 'customers', selectedCustomerId), { 
        walletBalance: newBalance,
        rewardPoints: cust.rewardPoints + Number(pointsAdjustment)
      });

      onLogEvent('CUSTOMER_WALLET_ADJUST', `Manual balance adjustment for ${cust.name}: delta Rs.${deltaVal} (${walletReason})`);
      alert(`Customer balance modified successfully. New balance: Rs.${newBalance}`);
      setSelectedCustomerId('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleCustomerBlock = async (id: string, status: 'active' | 'blocked') => {
    try {
      await updateDoc(doc(db, 'customers', id), { status });
      onLogEvent('CUSTOMER_STATUS_ALTERED', `Forced security state transition for customer ${id} to: ${status}`);
      alert(`Customer account status toggled perfectly to ${status}!`);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="text-center py-6 text-xs text-slate-500">Loading operational rosters...</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Internal User directory and Permission Matrix row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Provision Users */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 text-xs lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
            <Users className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-100">Internal Users & Security Roles directory</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-850 items-end">
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 font-bold uppercase">Staff Name</label>
              <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Pranav Mishra" className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 font-bold uppercase">Email Account</label>
              <input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="pranav@tingtong.com" className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 font-bold uppercase">Assigned Security Role</label>
              <div className="flex gap-2">
                <select value={newUserRole} onChange={e => setNewUserRole(e.target.value as any)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200">
                  <option value="Super Admin">Super Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Dispatcher">Dispatcher</option>
                  <option value="Support Agent">Support Agent</option>
                  <option value="Financial Auditor">Financial Auditor</option>
                </select>
                <button onClick={handleAddInternalUser} className="bg-amber-500 text-slate-950 font-bold p-2 px-3 rounded hover:bg-amber-600 transition flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
            {internalUsers.map(u => (
              <div key={u.id} className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-200">{u.name} {u.status === 'suspended' && <span className="bg-rose-500/10 text-rose-400 border border-rose-500/25 text-[8px] font-bold px-1.5 rounded uppercase">Suspended</span>}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select 
                    value={u.role} 
                    onChange={e => handleUpdateInternalUserRole(u.id, e.target.value as any)} 
                    className="bg-slate-900 border border-slate-800 text-slate-300 rounded p-1.5 text-[11px]"
                  >
                    <option value="Super Admin">Super Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="Dispatcher">Dispatcher</option>
                    <option value="Support Agent">Support Agent</option>
                    <option value="Financial Auditor">Financial Auditor</option>
                  </select>
                  
                  {u.status === 'active' ? (
                    <button onClick={() => handleSuspendInternalUser(u.id, 'suspended')} className="p-1.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/15" title="Suspend User">
                      <UserX className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button onClick={() => handleSuspendInternalUser(u.id, 'active')} className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/15" title="Unsuspend User">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Roles Permission Checkbox Matrix */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
            <Briefcase className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-100">Role Security Permissions Matrix</h3>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 text-[10px]">
            <div className="grid grid-cols-6 gap-1 font-bold text-slate-500 uppercase pb-1.5 border-b border-slate-800/80">
              <span>Security Role</span>
              <span className="text-center" title="Force Order dispatch / overrides">Disp</span>
              <span className="text-center" title="Verify Merchants store info">Appr</span>
              <span className="text-center" title="Modify Rider Fleet credentials">Flt</span>
              <span className="text-center" title="Alter Customer Balances / Ledgers">Wlt</span>
              <span className="text-center" title="System parameters write access">Sys</span>
            </div>

            {[
              { role: "Super Admin", key: "Super Admin" },
              { role: "Manager", key: "Manager" },
              { role: "Dispatcher", key: "Dispatcher" },
              { role: "Support Agent", key: "Support Agent" },
              { role: "Financial Auditor", key: "Financial Auditor" },
            ].map(row => (
              <div key={row.key} className="grid grid-cols-6 gap-1 items-center py-2 border-b border-slate-850/50">
                <span className="font-bold text-slate-300 truncate">{row.role}</span>
                {[
                  { tag: "READ_ORDERS" },
                  { tag: "APPROVE_VENDORS" },
                  { tag: "MANAGE_FLEET" },
                  { tag: "MUTATE_WALLET" },
                  { tag: "SYSTEM_CORE" }
                ].map(p => (
                  <div key={p.tag} className="flex justify-center">
                    <input 
                      type="checkbox" 
                      checked={(permissionMatrix[row.key] || []).includes(p.tag)} 
                      onChange={() => handleToggleMatrixPermission(row.key, p.tag)} 
                      className="w-3.5 h-3.5 accent-indigo-500 cursor-pointer" 
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Merchant approval desk and Rider approval desk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Restaurants applications */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
            <Store className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-100">Restaurant Vendor Applications</h3>
          </div>

          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 text-xs">
            {restaurants.map(r => (
              <div key={r.id} className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-200">{r.name}</p>
                  <p className="text-[10px] text-slate-400">GST: {r.gstNo} • FSSAI: {r.fssaiNo}</p>
                  <p className="text-[9px] font-mono text-slate-500">Loc: {r.address}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {r.status === 'pending' ? (
                    <div className="flex gap-1">
                      <button onClick={() => handleUpdateMerchantStatus(r.id, 'approved')} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 p-1 px-2.5 rounded font-bold text-[10px] cursor-pointer">Approve</button>
                      <button onClick={() => handleUpdateMerchantStatus(r.id, 'rejected')} className="bg-rose-500/20 text-rose-400 border border-rose-500/15 p-1 px-2.5 rounded font-bold text-[10px] cursor-pointer">Reject</button>
                    </div>
                  ) : (
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${r.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>{r.status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Riders applications */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
            <Bike className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-100">Rider Partner Applications Desk</h3>
          </div>

          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 text-xs">
            {riders.map(r => (
              <div key={r.id} className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-200">{r.name}</p>
                  <p className="text-[10px] text-slate-400">Licence: {r.drivingLicence} • RC: {r.rcNumber}</p>
                  <p className="text-[9px] text-slate-500">UID: {r.aadhaarNumber} • PAN: {r.panNumber}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={() => setInspectRider(r)}
                    className="bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 p-1 px-2.5 rounded text-[10px] font-bold cursor-pointer"
                  >
                    Inspect
                  </button>
                  {r.status === 'pending' ? (
                    <div className="flex gap-1">
                      <button onClick={() => handleUpdateRiderStatus(r.id, 'approved')} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 p-1 px-2 rounded font-bold text-[10px] cursor-pointer">Approve</button>
                      <button onClick={() => handleUpdateRiderStatus(r.id, 'rejected')} className="bg-rose-500/20 text-rose-400 border border-rose-500/15 p-1 px-2 rounded font-bold text-[10px] cursor-pointer">Reject</button>
                    </div>
                  ) : (
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${r.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>{r.status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Customer Adjustments & Wallet credit-debit ledger panels */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 text-xs">
        <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
          <CreditCard className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-sm text-slate-100">Customer Wallet Balancer & Directory</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Form */}
          <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3 h-fit">
            <p className="font-bold text-slate-200">Adjust Account Wallet</p>
            
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 font-bold">Select Customer</label>
              <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200">
                <option value="">-- Select Customer Account --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} (Bal: Rs.{c.walletBalance})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 font-bold">Adjustment Amt (Rs)</label>
                <input type="number" value={walletAdjustment} onChange={e => setWalletAdjustment(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100 font-mono" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 font-bold">Rewards points add</label>
                <input type="number" value={pointsAdjustment} onChange={e => setPointsAdjustment(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100 font-mono" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 font-bold">Adjustment Justification</label>
              <input type="text" value={walletReason} onChange={e => setWalletReason(e.target.value)} placeholder="Loyalty adjustment..." className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100" />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => handleAdjustCustomerWallet('credit')} disabled={!selectedCustomerId} className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold p-2 rounded flex items-center justify-center gap-1 cursor-pointer">
                Credit Wallet
              </button>
              <button onClick={() => handleAdjustCustomerWallet('debit')} disabled={!selectedCustomerId} className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-slate-950 font-bold p-2 rounded flex items-center justify-center gap-1 cursor-pointer">
                Debit Wallet
              </button>
            </div>
          </div>

          {/* Directory list */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 lg:col-span-2">
            {customers.map(c => (
              <div key={c.id} className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <p className="font-bold text-slate-200 flex items-center gap-1.5">
                    {c.name}
                    {c.status === 'blocked' && <span className="bg-rose-500/10 text-rose-400 border border-rose-500/25 text-[8px] font-bold px-1.5 rounded uppercase">Blocked</span>}
                  </p>
                  <p className="text-[10px] text-slate-400">Phone: {c.phone} • Email: {c.email}</p>
                  <p className="text-[10px] text-slate-500 font-mono">Wallet Balance: Rs.{c.walletBalance} | Reward Points: {c.rewardPoints}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {c.status === 'active' ? (
                    <button onClick={() => handleToggleCustomerBlock(c.id, 'blocked')} className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/15 hover:bg-rose-500/20 font-bold p-1.5 px-3 rounded-lg cursor-pointer">
                      Block Account
                    </button>
                  ) : (
                    <button onClick={() => handleToggleCustomerBlock(c.id, 'active')} className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 hover:bg-emerald-500/20 font-bold p-1.5 px-3 rounded-lg cursor-pointer">
                      Unblock
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Inspect documents modal */}
      {inspectRider && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-500" />
                Document Verification Ledger
              </h4>
              <button onClick={() => setInspectRider(null)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 font-sans">
              <p className="font-bold text-slate-100 text-sm">{inspectRider.name}</p>
              
              <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl space-y-2.5 font-mono text-[11px]">
                <div className="flex justify-between border-b border-slate-900 pb-1.5">
                  <span className="text-slate-500">Driving License:</span>
                  <span className="text-slate-200">{inspectRider.drivingLicence}</span>
                </div>
                <div className="flex justify-between border-b border-slate-900 pb-1.5">
                  <span className="text-slate-500">RC Plate Number:</span>
                  <span className="text-slate-200">{inspectRider.rcNumber}</span>
                </div>
                <div className="flex justify-between border-b border-slate-900 pb-1.5">
                  <span className="text-slate-500">Aadhaar UID:</span>
                  <span className="text-slate-200">{inspectRider.aadhaarNumber}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-slate-500">PAN Card:</span>
                  <span className="text-slate-200">{inspectRider.panNumber}</span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl space-y-2 font-mono text-[11px]">
                <p className="font-bold text-[10px] text-slate-500 uppercase tracking-wide">Linked Banking Ledger</p>
                <div className="flex justify-between">
                  <span className="text-slate-500">Bank Name:</span>
                  <span className="text-slate-200">{inspectRider.bankName || 'SBI'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Account No:</span>
                  <span className="text-slate-200">{inspectRider.accountNumber || '39201948512'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">UPI Alias ID:</span>
                  <span className="text-slate-200">{inspectRider.upiId || 'rider@okaxis'}</span>
                </div>
              </div>

              <button 
                onClick={() => setInspectRider(null)} 
                className="w-full bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 font-bold py-2.5 rounded-xl transition"
              >
                Close Verification Inspection
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
