import React, { useState } from 'react';
import { 
  Settings, 
  FileText, 
  Download, 
  CreditCard, 
  Send, 
  Bell, 
  CheckCircle2, 
  Info, 
  HelpCircle,
  TrendingUp,
  Sliders,
  DollarSign,
  AlertTriangle
} from 'lucide-react';
import { PaymentSetting, PaymentTransaction, PaymentNotification, Rider, Restaurant, PaymentEmployee } from '../../types';

interface SettingsReportTabsProps {
  activeSubTab: string; // 'history' | 'reports' | 'bank' | 'notifications' | 'settings'
  settings: PaymentSetting | null;
  transactions: PaymentTransaction[];
  notificationsList: PaymentNotification[];
  riders: Rider[];
  restaurants: Restaurant[];
  employees: PaymentEmployee[];
  onUpdateSettings: (newSettings: Partial<PaymentSetting>) => void;
  onUpdateBankDetails: (
    targetId: string, 
    targetType: 'rider' | 'vendor' | 'employee', 
    bankName: string, 
    accountNo: string, 
    ifsc: string, 
    upi: string
  ) => void;
  onDispatchTestAlert: (
    recipientId: string, 
    recipientType: 'rider' | 'vendor' | 'employee', 
    title: string, 
    message: string
  ) => void;
}

export default function SettingsReportTabs({
  activeSubTab,
  settings,
  transactions,
  notificationsList,
  riders,
  restaurants,
  employees,
  onUpdateSettings,
  onUpdateBankDetails,
  onDispatchTestAlert
}: SettingsReportTabsProps) {
  
  // History states
  const [historyFilterType, setHistoryFilterType] = useState<'all' | 'rider' | 'vendor' | 'employee'>('all');
  const [historyFilterStatus, setHistoryFilterStatus] = useState<'all' | 'pending' | 'approved' | 'paid' | 'on_hold' | 'failed'>('all');

  // Bank edit states
  const [bankTargetType, setBankTargetType] = useState<'rider' | 'vendor' | 'employee'>('rider');
  const [bankTargetId, setBankTargetId] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankUpi, setBankUpi] = useState('');

  // Notification states
  const [notifTargetType, setNotifTargetType] = useState<'rider' | 'vendor' | 'employee'>('rider');
  const [notifTargetId, setNotifTargetId] = useState('');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');

  // Settle Settings sliders/inputs local changes
  const [localCommission, setLocalCommission] = useState(settings?.commissionPct || 15);
  const [localDelivery, setLocalDelivery] = useState(settings?.deliveryCharge || 40);
  const [localPlatform, setLocalPlatform] = useState(settings?.platformFee || 10);
  const [localMinPayout, setLocalMinPayout] = useState(settings?.minPayout || 100);
  const [localMaxPayout, setLocalMaxPayout] = useState(settings?.maxPayout || 50000);

  const triggerExportCSV = () => {
    if (transactions.length === 0) {
      alert("No transaction records available to export.");
      return;
    }
    const headers = "Transaction ID,Recipient Name,Type,Amount,Status,Payment Method,Created At\n";
    const rows = transactions.map(t => 
      `"${t.id}","${t.recipientName}","${t.recipientType}",${t.amount},"${t.status}","${t.paymentMethod}","${t.createdAt}"`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `tingtong_settlement_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBankSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankTargetId) {
      alert("Please select a partner recipient first.");
      return;
    }
    onUpdateBankDetails(bankTargetId, bankTargetType, bankName, bankAccount, bankIfsc, bankUpi);
    alert("Bank details successfully updated in secure vault!");
    setBankTargetId('');
    setBankName('');
    setBankAccount('');
    setBankIfsc('');
    setBankUpi('');
  };

  const handleNotificationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTargetId) {
      alert("Please select a target recipient.");
      return;
    }
    if (!notifTitle.trim() || !notifMessage.trim()) {
      alert("Both title and message are required.");
      return;
    }
    onDispatchTestAlert(notifTargetId, notifTargetType, notifTitle, notifMessage);
    alert("Test alert queued for dispatch! Logs added in live feed.");
    setNotifTargetId('');
    setNotifTitle('');
    setNotifMessage('');
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      commissionPct: Number(localCommission),
      deliveryCharge: Number(localDelivery),
      platformFee: Number(localPlatform),
      minPayout: Number(localMinPayout),
      maxPayout: Number(localMaxPayout)
    });
    alert("Enterprise payment parameters successfully saved!");
  };

  const getBankTargets = () => {
    if (bankTargetType === 'rider') return riders.map(r => ({ id: r.id, name: `${r.name} (Rider)` }));
    if (bankTargetType === 'vendor') return restaurants.map(v => ({ id: v.id, name: `${v.name} (Vendor Restaurant)` }));
    return employees.map(e => ({ id: e.id, name: `${e.name} (${e.role})` }));
  };

  const getNotifTargets = () => {
    if (notifTargetType === 'rider') return riders.map(r => ({ id: r.id, name: `${r.name} (Rider)` }));
    if (notifTargetType === 'vendor') return restaurants.map(v => ({ id: v.id, name: `${v.name} (Vendor Restaurant)` }));
    return employees.map(e => ({ id: e.id, name: `${e.name} (${e.role})` }));
  };

  return (
    <div className="space-y-6" id="settings-report-tabs-root">
      
      {/* 1. PAYMENT HISTORY TAB */}
      {activeSubTab === 'history' && (() => {
        const filtered = transactions.filter(t => {
          const matchType = historyFilterType === 'all' || t.recipientType === historyFilterType;
          const matchStatus = historyFilterStatus === 'all' || t.status === historyFilterStatus;
          return matchType && matchStatus;
        });

        return (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950/40 border-b border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-xs text-slate-200">Historical Payment Ledger</h4>
                <p className="text-[10px] text-slate-400">Complete audit trails of all calculated batches</p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={historyFilterType}
                  onChange={(e) => setHistoryFilterType(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-[10px] font-bold text-slate-300 cursor-pointer outline-none focus:border-amber-500 transition"
                >
                  <option value="all">All Recipients</option>
                  <option value="rider">Riders</option>
                  <option value="vendor">Vendors</option>
                  <option value="employee">Employees</option>
                </select>

                <select
                  value={historyFilterStatus}
                  onChange={(e) => setHistoryFilterStatus(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-[10px] font-bold text-slate-300 cursor-pointer outline-none focus:border-amber-500 transition"
                >
                  <option value="all">All Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="on_hold">On Hold</option>
                  <option value="failed">Failed/Cancelled</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="p-4">Transaction ID</th>
                    <th className="p-4">Beneficiary</th>
                    <th className="p-4">Amount Detail</th>
                    <th className="p-4">Method & Ref</th>
                    <th className="p-4">Created Time</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-xs">
                  {filtered.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-950/15">
                      <td className="p-4 font-mono text-[10px] text-slate-500">{tx.id}</td>
                      <td className="p-4">
                        <div>
                          <span className="font-bold text-slate-200 block">{tx.recipientName}</span>
                          <span className="text-[9px] uppercase font-mono font-bold text-indigo-400 bg-indigo-500/5 px-1 rounded">
                            {tx.recipientType}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 font-mono">
                        <span className="font-bold text-slate-100 text-sm">₹{tx.amount}</span>
                        <div className="text-[9px] text-slate-500">
                          Base: ₹{tx.baseAmount} | Bns: +₹{tx.bonus} | Pen: -₹{tx.penalties}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-300 block font-semibold">{tx.paymentMethod}</span>
                        <span className="text-[10px] font-mono text-slate-500">Ref: {tx.referenceId || 'N/A'}</span>
                      </td>
                      <td className="p-4 text-slate-400 font-mono text-[10px]">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          tx.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          tx.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                          tx.status === 'on_hold' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No transactions found matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* 2. PAYMENT REPORTS TAB */}
      {activeSubTab === 'reports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
          {/* Form and Generation */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <FileText className="w-5 h-5 text-amber-500" />
              <h4 className="font-bold text-sm text-slate-200">Generate Financial Audit Statement</h4>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <p>
                Select a settlement category to review order commissions, tax percentages, platform maintenance fees, and net payouts.
              </p>

              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-850 space-y-3">
                <div className="flex justify-between">
                  <span>Gross Transactions Total:</span>
                  <span className="font-bold font-mono text-slate-100">₹{transactions.reduce((s,t) => s + t.amount, 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Platform Fees Collected:</span>
                  <span className="font-bold font-mono text-indigo-400">₹{transactions.reduce((s,t) => s + t.platformFee, 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[10px]">
                  <span>Auditor Status:</span>
                  <span className="text-emerald-400 font-bold uppercase">Ready</span>
                </div>
              </div>

              <button
                onClick={triggerExportCSV}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span>Download CSV Audit Report</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Grid summary */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col justify-between">
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-slate-200">CSV Export Columns schema</h4>
              <p className="text-[10px] text-slate-500">
                The exported spreadsheet complies with national finance tax audit standards.
              </p>

              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
                <div className="bg-slate-950 p-2 rounded-lg">✓ Transaction ID</div>
                <div className="bg-slate-950 p-2 rounded-lg">✓ Beneficiary Name</div>
                <div className="bg-slate-950 p-2 rounded-lg">✓ Category (Type)</div>
                <div className="bg-slate-950 p-2 rounded-lg">✓ Net Amount</div>
                <div className="bg-slate-950 p-2 rounded-lg">✓ Status Flag</div>
                <div className="bg-slate-950 p-2 rounded-lg">✓ Pay Method</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-[11px] text-amber-500 leading-relaxed">
              <strong>Tip:</strong> Daily automated CRON run schedules a CSV copy to backup email servers at 11:59 PM UTC.
            </div>
          </div>
        </div>
      )}

      {/* 3. BANK & UPI MANAGEMENT TAB */}
      {activeSubTab === 'bank' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
          <form onSubmit={handleBankSubmit} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 md:col-span-2">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <CreditCard className="w-5 h-5 text-amber-500 animate-pulse" />
              <div>
                <h4 className="font-bold text-sm text-slate-200">Audit Bank & UPI Credentials</h4>
                <p className="text-[10px] text-slate-400">Modify partner financial credentials securely</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Partner Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['rider', 'vendor', 'employee'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setBankTargetType(type);
                        setBankTargetId('');
                      }}
                      className={`py-2 text-[10px] font-bold rounded-xl border transition uppercase ${
                        bankTargetType === type 
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' 
                          : 'bg-slate-950/40 text-slate-400 border-slate-850 hover:bg-slate-950/80'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Select Recipient Profile</label>
                <select
                  required
                  value={bankTargetId}
                  onChange={(e) => {
                    setBankTargetId(e.target.value);
                    // Autofill if details exist
                    if (bankTargetType === 'rider') {
                      const found = riders.find(r => r.id === e.target.value);
                      if (found) {
                        setBankName(found.bankName || 'State Bank of India');
                        setBankAccount(found.accountNumber || '');
                        setBankIfsc(found.ifscCode || '');
                        setBankUpi(found.upiId || '');
                      }
                    } else if (bankTargetType === 'vendor') {
                      const found = restaurants.find(r => r.id === e.target.value);
                      if (found) {
                        setBankName(found.bankName || 'HDFC Bank');
                        setBankAccount(found.accountNumber || '');
                        setBankIfsc(found.ifscCode || '');
                        setBankUpi(found.upiId || '');
                      }
                    } else {
                      const found = employees.find(r => r.id === e.target.value);
                      if (found) {
                        setBankName(found.bankName || '');
                        setBankAccount(found.accountNumber || '');
                        setBankIfsc(found.ifscCode || '');
                        setBankUpi(found.upiId || '');
                      }
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 transition"
                >
                  <option value="">Select recipient...</option>
                  {getBankTargets().map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Bank Name</label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="State Bank of India"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Account Number</label>
                <input
                  type="text"
                  required
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="e.g., 30294829381"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">IFSC Code</label>
                <input
                  type="text"
                  required
                  value={bankIfsc}
                  onChange={(e) => setBankIfsc(e.target.value)}
                  placeholder="SBIN0001234"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">UPI Address (ID)</label>
                <input
                  type="text"
                  value={bankUpi}
                  onChange={(e) => setBankUpi(e.target.value)}
                  placeholder="sharma@paytm"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-850 flex justify-end">
              <button
                type="submit"
                disabled={!bankTargetId}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-35 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs cursor-pointer transition shadow-md"
              >
                Save Bank Account
              </button>
            </div>
          </form>

          {/* Verification Status info */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
            <h4 className="font-bold text-xs text-slate-200">Secure AES Vault Node</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              All bank accounts and UPI addresses are encrypted on-disk using military-grade security rules before transit.
            </p>
            <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-850 flex items-start gap-2 text-[10px] text-slate-400">
              <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>
                Upon triggering payouts, the transaction server directly interfaces with IMPS/UPI gateways.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. NOTIFICATION CENTER TAB */}
      {activeSubTab === 'notifications' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
          {/* Dispatch form */}
          <form onSubmit={handleNotificationSubmit} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 md:col-span-2">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Bell className="w-5 h-5 text-amber-500" />
              <div>
                <h4 className="font-bold text-sm text-slate-200">Send Direct Payment Alert</h4>
                <p className="text-[10px] text-slate-400">Dispatch Push, SMS, and Email notifications instantly</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Target User Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['rider', 'vendor', 'employee'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setNotifTargetType(type);
                        setNotifTargetId('');
                      }}
                      className={`py-2 text-[10px] font-bold rounded-xl border transition uppercase ${
                        notifTargetType === type 
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' 
                          : 'bg-slate-950/40 text-slate-400 border-slate-850 hover:bg-slate-950/80'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Target Recipient</label>
                <select
                  required
                  value={notifTargetId}
                  onChange={(e) => setNotifTargetId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 transition"
                >
                  <option value="">Select recipient...</option>
                  {getNotifTargets().map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Alert Subject / Title</label>
                <input
                  type="text"
                  required
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  placeholder="e.g., Payout Deposited successfully!"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition"
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Alert Message Body</label>
                <textarea
                  required
                  rows={3}
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  placeholder="e.g., Dear partner, ₹4,500 has been transferred successfully to your registered State Bank of India account. Reference ID: IMPS029482."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition resize-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-850 flex justify-between items-center text-[10px] text-slate-500">
              <span className="font-mono">Channels: Push, SMS & Email</span>
              <button
                type="submit"
                disabled={!notifTargetId}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-35 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Dispatch Alerts</span>
              </button>
            </div>
          </form>

          {/* Logs */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 flex flex-col justify-between h-full">
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-slate-200">Alert Dispatch logs</h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {notificationsList.map(item => (
                  <div key={item.id} className="p-3 bg-slate-950/40 rounded-xl border border-slate-850/60 text-[10px] space-y-1">
                    <div className="flex justify-between font-bold text-slate-300">
                      <span>{item.recipientName} ({item.recipientType.toUpperCase()})</span>
                      <span className="font-mono text-[8px] text-slate-500">{new Date(item.sentAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <p className="font-bold text-amber-500">{item.title}</p>
                    <p className="text-slate-400 text-[9px] leading-snug">{item.message}</p>
                  </div>
                ))}
                {notificationsList.length === 0 && (
                  <p className="text-xs text-slate-500 italic text-center py-6">No dispatched alerts registered.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. PAYMENT SETTINGS TAB */}
      {activeSubTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 animate-fade-in">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Settings className="w-5 h-5 text-amber-500" />
            <div>
              <h4 className="font-bold text-sm text-slate-200">Payment Engine Settings</h4>
              <p className="text-[10px] text-slate-400">Configure parameters, schedule periods, and approval structures</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-300">
            {/* Left side parameters */}
            <div className="space-y-4">
              <h5 className="font-bold text-slate-200 flex items-center gap-1.5 text-xs uppercase tracking-wide">
                <Sliders className="w-4 h-4 text-amber-500" /> Charge & Commission parameters
              </h5>

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold text-slate-400">Company Commission Percentage (%)</span>
                    <span className="font-bold text-amber-500 font-mono">{localCommission}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="35"
                    value={localCommission}
                    onChange={(e) => setLocalCommission(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold text-slate-400">Base Rider Delivery Charge (₹)</span>
                    <span className="font-bold text-amber-500 font-mono">₹{localDelivery}</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="120"
                    value={localDelivery}
                    onChange={(e) => setLocalDelivery(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold text-slate-400">Platform Maintenance Fee (₹)</span>
                    <span className="font-bold text-amber-500 font-mono">₹{localPlatform}</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={localPlatform}
                    onChange={(e) => setLocalPlatform(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Right side ranges and approvals */}
            <div className="space-y-4">
              <h5 className="font-bold text-slate-200 flex items-center gap-1.5 text-xs uppercase tracking-wide">
                <DollarSign className="w-4 h-4 text-amber-500" /> Payout limits and approvals
              </h5>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Min Payout Threshold (₹)</label>
                  <input
                    type="number"
                    value={localMinPayout}
                    onChange={(e) => setLocalMinPayout(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Max Single Transfer (₹)</label>
                  <input
                    type="number"
                    value={localMaxPayout}
                    onChange={(e) => setLocalMaxPayout(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition font-mono"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-2 text-[11px] leading-relaxed">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    Commission, Delivery charge, and Platform fee rates are read dynamically by the calculation engine to calculate vendor sales earnings.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs cursor-pointer transition shadow-lg shadow-amber-500/10"
            >
              Save Payment Parameters
            </button>
          </div>
        </form>
      )}

    </div>
  );
}
