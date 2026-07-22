import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Customer, Order } from '../types';
import { getActiveCity } from '../services/mapService';
import { 
  Users, 
  Search, 
  MapPin, 
  Clock, 
  ShieldAlert, 
  Trash2, 
  UserMinus, 
  UserCheck, 
  Wallet, 
  Award,
  AlertCircle
} from 'lucide-react';

interface CustomersViewProps {
  customers: Customer[];
  orders: Order[];
}

export default function CustomersView({ customers, orders }: CustomersViewProps) {
  const [subTab, setSubTab] = useState<'directory' | 'analytics'>('directory');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Adjustment fields
  const [walletAmount, setWalletAmount] = useState('');
  const [rewardAmount, setRewardAmount] = useState('');

  // Filter customers by search
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleBlock = async (cust: Customer) => {
    const nextStatus = cust.status === 'active' ? 'blocked' : 'active';
    try {
      const custRef = doc(db, 'customers', cust.id);
      await updateDoc(custRef, { status: nextStatus });
      // Update local state if selected
      if (selectedCustomer && selectedCustomer.id === cust.id) {
        setSelectedCustomer({ ...selectedCustomer, status: nextStatus });
      }
    } catch (err) {
      console.error("Error toggling customer block status: ", err);
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    try {
      await deleteDoc(doc(db, 'customers', customerId));
      setSelectedCustomer(null);
    } catch (err) {
      console.error("Error deleting customer: ", err);
    }
  };

  const handleWalletAdjust = async (type: 'credit' | 'debit') => {
    if (!selectedCustomer) return;
    const val = Number(walletAmount);
    if (isNaN(val) || val <= 0) return;

    const change = type === 'credit' ? val : -val;
    const nextBal = selectedCustomer.walletBalance + change;

    try {
      const custRef = doc(db, 'customers', selectedCustomer.id);
      await updateDoc(custRef, { walletBalance: nextBal });
      setSelectedCustomer({ ...selectedCustomer, walletBalance: nextBal });
      setWalletAmount('');
    } catch (err) {
      console.error("Error adjusting customer wallet: ", err);
    }
  };

  const handleRewardsAdjust = async () => {
    if (!selectedCustomer) return;
    const val = Number(rewardAmount);
    if (isNaN(val) || val <= 0) return;

    const nextRewards = selectedCustomer.rewardPoints + val;

    try {
      const custRef = doc(db, 'customers', selectedCustomer.id);
      await updateDoc(custRef, { rewardPoints: nextRewards });
      setSelectedCustomer({ ...selectedCustomer, rewardPoints: nextRewards });
      setRewardAmount('');
    } catch (err) {
      console.error("Error adjusting reward points: ", err);
    }
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100">{getActiveCity().name} Registered Clients</h2>
          <p className="text-slate-400 text-xs">Manage consumer accounts, credit wallet lines, and verify address nodes.</p>
        </div>
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by client name, email, or contact..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 pl-10 pr-4 py-2 rounded-xl text-xs focus:border-amber-500 outline-none"
          />
        </div>
      </div>

      <div className="flex border-b border-slate-800 gap-1.5 pb-px">
        <button
          onClick={() => setSubTab('directory')}
          className={`px-4 py-2 border-b-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
            subTab === 'directory'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Consumer Directory
        </button>
        <button
          onClick={() => setSubTab('analytics')}
          className={`px-4 py-2 border-b-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
            subTab === 'analytics'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Customer Analytics
        </button>
      </div>

      {subTab === 'directory' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Table List */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-slate-100 text-sm">Consumer Registers</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider">
                <tr>
                  <th className="p-3">Client Profile</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Wallet</th>
                  <th className="p-3">Rewards</th>
                  <th className="p-3 text-right">Block Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredCustomers.map(c => (
                  <tr key={c.id} className="hover:bg-slate-950/20 transition cursor-pointer" onClick={() => setSelectedCustomer(c)}>
                    <td className="p-3">
                      <p className="font-bold text-slate-100">{c.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">ID: {c.id}</p>
                    </td>
                    <td className="p-3">
                      <p className="text-slate-300 font-medium">{c.phone}</p>
                      <p className="text-[10px] text-slate-500">{c.email}</p>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        c.status === 'active' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-300">₹{c.walletBalance}</td>
                    <td className="p-3 font-mono text-slate-400">{c.rewardPoints} Pts</td>
                    <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => handleToggleBlock(c)}
                        className={`p-1.5 rounded hover:bg-slate-800 transition cursor-pointer ${
                          c.status === 'active' ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                        title={c.status === 'active' ? 'Block Client' : 'Activate Client'}
                      >
                        {c.status === 'active' ? <UserMinus className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Detailed customer audit & ledger card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <h3 className="font-bold text-slate-100 text-sm">Consumer File & Wallets</h3>

          {selectedCustomer ? (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h4 className="font-bold text-slate-100 text-base">{selectedCustomer.name}</h4>
                  <p className="text-slate-500 text-[10px] font-mono mt-0.5">Signed up: {new Date(selectedCustomer.createdAt).toLocaleDateString()}</p>
                </div>
                <button 
                  onClick={() => handleDeleteCustomer(selectedCustomer.id)}
                  className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 p-2 rounded-lg border border-rose-500/10 transition cursor-pointer"
                  title="Purge Account"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Customer Notes */}
              {selectedCustomer.notes && (
                <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-400 italic">
                  "{selectedCustomer.notes}"
                </div>
              )}

              {/* Addresses Grid */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Saved {getActiveCity().name} Delivery Nodes
                </p>
                <div className="space-y-1.5">
                  {selectedCustomer.addresses?.map((addr, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-850 p-3 rounded-xl text-xs">
                      <p className="font-bold text-slate-300">{addr.label}</p>
                      <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">{addr.addressLine}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Wallet adjustment tool */}
              <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-500 border-b border-slate-800 pb-1.5">
                  <Wallet className="w-4 h-4" />
                  <span>Wallet Ledger Balance: ₹{selectedCustomer.walletBalance}</span>
                </div>
                
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    placeholder="Amount (₹)" 
                    value={walletAmount}
                    onChange={e => setWalletAmount(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 flex-1 outline-none font-mono"
                  />
                  <button 
                    onClick={() => handleWalletAdjust('credit')}
                    className="bg-emerald-600 hover:brightness-110 text-slate-950 text-xs font-bold px-2.5 py-1.5 rounded-lg cursor-pointer"
                  >
                    Credit
                  </button>
                  <button 
                    onClick={() => handleWalletAdjust('debit')}
                    className="bg-rose-600 hover:brightness-110 text-slate-100 text-xs font-bold px-2.5 py-1.5 rounded-lg cursor-pointer"
                  >
                    Debit
                  </button>
                </div>
              </div>

              {/* Reward points adjustment */}
              <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 border-b border-slate-800 pb-1.5">
                  <Award className="w-4 h-4" />
                  <span>Reward Points: {selectedCustomer.rewardPoints} Points</span>
                </div>
                
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    placeholder="Add Points" 
                    value={rewardAmount}
                    onChange={e => setRewardAmount(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 flex-1 outline-none font-mono"
                  />
                  <button 
                    onClick={handleRewardsAdjust}
                    className="bg-indigo-600 hover:brightness-110 text-slate-100 text-xs font-bold px-4 py-1.5 rounded-lg cursor-pointer"
                  >
                    Award
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-xs text-center">
              <AlertCircle className="w-8 h-8 text-slate-600 mb-2" />
              <span>Select a client account to audit their order ledger, issue platform credits, and adjust loyal reward points.</span>
            </div>
          )}
        </div>

      </div>
      ) : (
        <CustomerAnalyticsDashboard customers={customers} orders={orders} />
      )}

    </div>
  );
}

export function CustomerAnalyticsDashboard({ customers, orders }: { customers: Customer[]; orders: Order[] }) {
  const getCustomerStats = (c: Customer) => {
    const clientOrders = orders.filter(o => o.customerId === c.id);
    const totalSpent = clientOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const orderCount = clientOrders.length;
    return {
      totalSpent,
      orderCount,
      avgTicket: orderCount ? Math.round(totalSpent / orderCount) : 0
    };
  };

  const customerAnalysisList = customers.map(c => ({
    ...c,
    stats: getCustomerStats(c)
  })).sort((a, b) => b.stats.totalSpent - a.stats.totalSpent);

  const topCustomers = customerAnalysisList.slice(0, 5);
  const returningCustomers = customerAnalysisList.filter(c => c.stats.orderCount >= 2);
  const newCustomersCount = customers.length - returningCustomers.length;
  
  const totalSpendAgg = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const avgOrderFrequency = customers.length ? (orders.length / customers.length).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Total Transacting Pool</span>
          <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{customers.length} Clients</p>
          <p className="text-[10px] text-slate-500 mt-1">{returningCustomers.length} Recurring • {newCustomersCount} New</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Gross Volume Processed</span>
          <p className="text-xl font-bold font-mono text-amber-500 mt-0.5">₹{totalSpendAgg.toLocaleString()}</p>
          <p className="text-[10px] text-slate-500 mt-1">All processed delivery lines</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Purchase Frequency</span>
          <p className="text-xl font-bold font-mono text-indigo-400 mt-0.5">{avgOrderFrequency} orders</p>
          <p className="text-[10px] text-slate-500 mt-1">Average transactions per customer</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Loyalty Wallet Credit pool</span>
          <p className="text-xl font-bold font-mono text-slate-100 font-sans">
            ₹{customers.reduce((sum, c) => sum + c.walletBalance, 0).toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Net customer wallet liability</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-100 text-sm">Top VIP Clients (Ranked by Spending)</h3>
            <span className="bg-amber-500/10 text-amber-500 text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
              VIP Cohort
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider">
                <tr>
                  <th className="p-3">Rank</th>
                  <th className="p-3">Client Details</th>
                  <th className="p-3">Orders</th>
                  <th className="p-3">Avg Ticket</th>
                  <th className="p-3 text-right">Lifetime Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {topCustomers.map((c, index) => (
                  <tr key={c.id} className="hover:bg-slate-950/20 transition">
                    <td className="p-3">
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                        index === 0 ? 'bg-amber-500 text-slate-950' : index === 1 ? 'bg-slate-300 text-slate-900' : index === 2 ? 'bg-amber-700 text-slate-100' : 'bg-slate-800 text-slate-400'
                      }`}>
                        #{index + 1}
                      </span>
                    </td>
                    <td className="p-3">
                      <p className="font-bold text-slate-200">{c.name}</p>
                      <p className="text-slate-500 text-[10px]">{c.email} • {c.phone}</p>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-300">
                      {c.stats.orderCount} placed
                    </td>
                    <td className="p-3 font-mono text-slate-400">
                      ₹{c.stats.avgTicket}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-amber-500">
                      ₹{c.stats.totalSpent.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-slate-100 text-sm border-b border-slate-800 pb-3">Cohort Engagement</h3>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>Returning (2+ Orders)</span>
                <span className="font-mono text-emerald-400">
                  {Math.round((returningCustomers.length / (customers.length || 1)) * 100)}%
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2">
                <div 
                  className="bg-emerald-500 h-2 rounded-full" 
                  style={{ width: `${(returningCustomers.length / (customers.length || 1)) * 100}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-500">{returningCustomers.length} active recurring advocates</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>New Accounts (0-1 Orders)</span>
                <span className="font-mono text-sky-400">
                  {Math.round((newCustomersCount / (customers.length || 1)) * 100)}%
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2">
                <div 
                  className="bg-sky-500 h-2 rounded-full" 
                  style={{ width: `${(newCustomersCount / (customers.length || 1)) * 100}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-500">{newCustomersCount} clients to nurture for repeat business</p>
            </div>

            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl mt-4 space-y-2">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Platform Insight</p>
              <p className="text-[11px] text-slate-500 leading-normal">
                VIP Customers make up the majority of platform order value. Maintain engagement via targeted loyalty campaigns and reward triggers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
