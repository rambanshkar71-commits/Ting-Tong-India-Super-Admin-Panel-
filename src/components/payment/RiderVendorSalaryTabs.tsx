import React, { useState } from 'react';
import { 
  Bike, 
  Store, 
  Users, 
  DollarSign, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  UserPlus, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Play
} from 'lucide-react';
import { Rider, Restaurant, PaymentEmployee, PaymentTransaction } from '../../types';
import { getActiveCity } from '../../services/mapService';

interface RiderVendorSalaryTabsProps {
  activeSubTab: string; // 'riders' | 'vendors' | 'employees'
  riders: Rider[];
  restaurants: Restaurant[];
  employees: PaymentEmployee[];
  transactions: PaymentTransaction[];
  onTriggerIndividualPayout: (recipientId: string, recipientType: 'rider' | 'vendor' | 'employee', amount: number) => void;
  onAddEmployee: (employee: Omit<PaymentEmployee, 'id' | 'createdAt' | 'walletBalance'>) => void;
}

export default function RiderVendorSalaryTabs({
  activeSubTab,
  riders,
  restaurants,
  employees,
  transactions,
  onTriggerIndividualPayout,
  onAddEmployee
}: RiderVendorSalaryTabsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddEmployeeForm, setShowAddEmployeeForm] = useState(false);
  
  // Employee form state
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empRole, setEmpRole] = useState<'Operations Manager' | 'Support Executive' | 'Hub Manager' | 'Fleet Dispatcher' | 'Software Engineer'>('Support Executive');
  const [empSalary, setEmpSalary] = useState(15000);
  const [empBank, setEmpBank] = useState('State Bank of India');
  const [empAccount, setEmpAccount] = useState('');
  const [empIfsc, setEmpIfsc] = useState('');
  const [empUpi, setEmpUpi] = useState('');

  const handleCreateEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName || !empEmail || !empPhone || !empAccount) {
      alert("Please fill all required employee details.");
      return;
    }
    onAddEmployee({
      name: empName,
      email: empEmail,
      phone: empPhone,
      role: empRole,
      monthlySalary: Number(empSalary),
      bankName: empBank,
      accountNumber: empAccount,
      ifscCode: empIfsc,
      upiId: empUpi,
      status: 'active'
    });
    // Reset
    setEmpName('');
    setEmpEmail('');
    setEmpPhone('');
    setEmpAccount('');
    setEmpIfsc('');
    setEmpUpi('');
    setShowAddEmployeeForm(false);
  };

  // Get total payout sums for list
  const getPayoutsForRecipient = (id: string) => {
    const list = transactions.filter(t => t.recipientId === id);
    const paidSum = list.filter(t => t.status === 'paid').reduce((s, t) => s + t.amount, 0);
    const pendingSum = list.filter(t => t.status !== 'paid' && t.status !== 'cancelled').reduce((s, t) => s + t.amount, 0);
    return { paidSum, pendingSum };
  };

  return (
    <div className="space-y-6" id="rider-vendor-salary-tab-root">
      {/* Search and context bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder={`Search ${activeSubTab === 'riders' ? 'riders...' : activeSubTab === 'vendors' ? 'vendor restaurants...' : 'operations staff...'}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-amber-500 transition"
          />
        </div>

        {activeSubTab === 'employees' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddEmployeeForm(!showAddEmployeeForm)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>{showAddEmployeeForm ? 'Close Form' : 'Register New Employee'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Add Employee Form Drawer */}
      {activeSubTab === 'employees' && showAddEmployeeForm && (
        <form onSubmit={handleCreateEmployeeSubmit} className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4 animate-slide-in">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <UserPlus className="w-4 h-4 text-amber-500" />
            <h4 className="font-bold text-xs text-slate-200">New Staff Registration</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Employee Full Name</label>
              <input
                type="text"
                required
                value={empName}
                onChange={(e) => setEmpName(e.target.value)}
                placeholder="Rahul Sharma"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Primary Email Address</label>
              <input
                type="email"
                required
                value={empEmail}
                onChange={(e) => setEmpEmail(e.target.value)}
                placeholder="rahul@tingtongbhopal.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Contact Number</label>
              <input
                type="tel"
                required
                value={empPhone}
                onChange={(e) => setEmpPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Enterprise Operations Role</label>
              <select
                value={empRole}
                onChange={(e) => setEmpRole(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 transition"
              >
                <option value="Operations Manager">Operations Manager (संचालक प्रबंधक)</option>
                <option value="Support Executive">Support Executive (सपोर्ट एग्जीक्यूटिव)</option>
                <option value="Hub Manager">Hub Manager (हब इंचार्ज)</option>
                <option value="Fleet Dispatcher">Fleet Dispatcher (रैपिड डिस्पैचर)</option>
                <option value="Software Engineer">Software Engineer (तकनीकी टीम)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Monthly Salary Structure (₹)</label>
              <input
                type="number"
                required
                value={empSalary}
                onChange={(e) => setEmpSalary(Number(e.target.value))}
                placeholder="25000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Bank Name</label>
              <input
                type="text"
                value={empBank}
                onChange={(e) => setEmpBank(e.target.value)}
                placeholder="State Bank of India"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Account Number</label>
              <input
                type="text"
                required
                value={empAccount}
                onChange={(e) => setEmpAccount(e.target.value)}
                placeholder="30294829381"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">IFSC Code</label>
              <input
                type="text"
                value={empIfsc}
                onChange={(e) => setEmpIfsc(e.target.value)}
                placeholder="SBIN0001234"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">UPI Identifier (UPI ID)</label>
              <input
                type="text"
                value={empUpi}
                onChange={(e) => setEmpUpi(e.target.value)}
                placeholder="sharma@sbi"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddEmployeeForm(false)}
              className="bg-slate-800 hover:bg-slate-750 text-slate-350 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-2 rounded-xl text-xs cursor-pointer transition shadow-md"
            >
              Save & Register Staff
            </button>
          </div>
        </form>
      )}

      {/* RIDER PARTNER TAB */}
      {activeSubTab === 'riders' && (() => {
        const filtered = riders.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.phone.includes(searchTerm));
        return (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950/40 border-b border-slate-850 flex items-center justify-between">
              <h4 className="font-bold text-xs text-slate-200">{getActiveCity().name} Rider partner Settlement Dashboard</h4>
              <span className="text-[10px] text-slate-400 font-mono">Matched: {filtered.length} riders</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="p-4">Rider Detail</th>
                    <th className="p-4">Duty Status</th>
                    <th className="p-4">Wallet Balance</th>
                    <th className="p-4">Settled / Pending</th>
                    <th className="p-4">Bank & UPI</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-xs">
                  {filtered.map(r => {
                    const { paidSum, pendingSum } = getPayoutsForRecipient(r.id);
                    return (
                      <tr key={r.id} className="hover:bg-slate-950/15">
                        <td className="p-4">
                          <div>
                            <span className="font-bold text-slate-200 block text-sm">{r.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono block">ID: {r.id} | 📞 {r.phone}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                            r.dutyStatus === 'on_duty' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {r.dutyStatus === 'on_duty' ? 'On Duty' : 'Off Duty'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`font-bold font-mono text-sm block ${r.walletBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            ₹{r.walletBalance || 0}
                          </span>
                          <span className="text-[8px] text-slate-500 block uppercase font-bold">Current Wallet Balance</span>
                        </td>
                        <td className="p-4 font-mono text-[11px] space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-slate-400">Settled: ₹{paidSum}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span className="text-slate-400">Unsettled: ₹{pendingSum}</span>
                          </div>
                        </td>
                        <td className="p-4 text-[10px] text-slate-400">
                          {r.upiId ? (
                            <span className="block text-amber-500 font-bold">UPI: {r.upiId}</span>
                          ) : r.accountNumber ? (
                            <div>
                              <span className="block text-slate-300 font-bold">{r.bankName}</span>
                              <span className="block text-[9px] font-mono">A/C: {r.accountNumber}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600 block italic">Details missing</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            disabled={!r.walletBalance || r.walletBalance <= 0}
                            onClick={() => onTriggerIndividualPayout(r.id, 'rider', r.walletBalance)}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-slate-100 font-bold px-3.5 py-1.5 rounded-xl text-[10px] transition cursor-pointer flex items-center gap-1 ml-auto"
                          >
                            <Play className="w-3 h-3 fill-white" />
                            Settle Wallet (भुगतान करें)
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">No matching riders found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* VENDOR/RESTAURANT TAB */}
      {activeSubTab === 'vendors' && (() => {
        const filtered = restaurants.filter(v => v.name.toLowerCase().includes(searchTerm.toLowerCase()) || v.phone.includes(searchTerm));
        return (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950/40 border-b border-slate-850 flex items-center justify-between">
              <h4 className="font-bold text-xs text-slate-200">Merchant Restaurant Settlement Dashboard</h4>
              <span className="text-[10px] text-slate-400 font-mono">Matched: {filtered.length} stores</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="p-4">Store details</th>
                    <th className="p-4">Commission %</th>
                    <th className="p-4">Total Settled</th>
                    <th className="p-4">Pending Wallet Bal</th>
                    <th className="p-4">Bank Account & UPI ID</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-xs">
                  {filtered.map(v => {
                    const { paidSum, pendingSum } = getPayoutsForRecipient(v.id);
                    const pseudoWalletBal = pendingSum;
                    return (
                      <tr key={v.id} className="hover:bg-slate-950/15">
                        <td className="p-4">
                          <div>
                            <span className="font-bold text-slate-200 block text-sm">{v.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono block">ID: {v.id} | 📞 {v.phone}</span>
                          </div>
                        </td>
                        <td className="p-4 font-mono font-bold text-slate-400 text-sm">
                          {v.commissionPercentage || 15}%
                        </td>
                        <td className="p-4 font-mono text-slate-300">
                          ₹{paidSum.toLocaleString('en-IN')}
                        </td>
                        <td className="p-4 font-mono">
                          <span className="text-amber-500 font-bold block text-sm">₹{pseudoWalletBal.toLocaleString('en-IN')}</span>
                          <span className="text-[8px] text-slate-500 block uppercase font-bold">Unsettled Dues</span>
                        </td>
                        <td className="p-4 text-[10px] text-slate-400">
                          {v.upiId ? (
                            <span className="block text-amber-500 font-bold">UPI: {v.upiId}</span>
                          ) : v.accountNumber ? (
                            <div>
                              <span className="block text-slate-300 font-bold">{v.bankName}</span>
                              <span className="block text-[9px] font-mono">A/C: {v.accountNumber}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600 block italic">Details missing</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => onTriggerIndividualPayout(v.id, 'vendor', pseudoWalletBal)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-bold px-3.5 py-1.5 rounded-xl text-[10px] transition cursor-pointer flex items-center gap-1 ml-auto"
                          >
                            <Play className="w-3 h-3 fill-white" />
                            Trigger Settlement
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">No matching restaurants found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* OPERATIONS EMPLOYEE TAB */}
      {activeSubTab === 'employees' && (() => {
        const filtered = employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.role.toLowerCase().includes(searchTerm.toLowerCase()));
        return (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950/40 border-b border-slate-850 flex items-center justify-between">
              <h4 className="font-bold text-xs text-slate-200">Ting Tong {getActiveCity().name} Core Operations Payroll</h4>
              <span className="text-[10px] text-slate-400 font-mono">Registered: {filtered.length} employees</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="p-4">Employee</th>
                    <th className="p-4">Operational Role</th>
                    <th className="p-4">Monthly Salary</th>
                    <th className="p-4">Outstanding Bal</th>
                    <th className="p-4">Audit History</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-xs">
                  {filtered.map(e => {
                    const { paidSum, pendingSum } = getPayoutsForRecipient(e.id);
                    return (
                      <tr key={e.id} className="hover:bg-slate-950/15">
                        <td className="p-4">
                          <div>
                            <span className="font-bold text-slate-200 block text-sm">{e.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono block">✉️ {e.email} | 📞 {e.phone}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded">
                            {e.role}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-bold text-slate-300 text-sm">
                          ₹{e.monthlySalary.toLocaleString('en-IN')}
                        </td>
                        <td className="p-4 font-mono">
                          <span className={`font-bold block text-sm ${e.walletBalance > 0 ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`}>
                            ₹{e.walletBalance || 0}
                          </span>
                          <span className="text-[8px] text-slate-500 block uppercase font-bold">Unpaid Payroll</span>
                        </td>
                        <td className="p-4 text-[10px] text-slate-400 font-mono">
                          <span className="block text-emerald-400">Paid: ₹{paidSum.toLocaleString('en-IN')}</span>
                          <span className="block text-slate-500">Unpaid: ₹{pendingSum.toLocaleString('en-IN')}</span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            disabled={!e.walletBalance || e.walletBalance <= 0}
                            onClick={() => onTriggerIndividualPayout(e.id, 'employee', e.walletBalance)}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-slate-100 font-bold px-3.5 py-1.5 rounded-xl text-[10px] transition cursor-pointer flex items-center gap-1 ml-auto"
                          >
                            <Play className="w-3 h-3 fill-white" />
                            Disburse Salary
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 space-y-3">
                        <Users className="w-8 h-8 text-slate-700 mx-auto opacity-35" />
                        <p className="text-xs">No payroll employees configured.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
