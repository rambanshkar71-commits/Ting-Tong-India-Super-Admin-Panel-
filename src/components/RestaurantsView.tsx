import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { doc, updateDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { Restaurant, Order, MenuItem, RestaurantLifecycleStatus } from '../types';
import MerchantOnboardingForm from './MerchantOnboardingForm';
import RestaurantDetailModal from './RestaurantDetailModal';
import { sendNotification } from '../services/notificationService';
import {
  Store,
  Plus,
  Trash2,
  Check,
  X,
  FileText,
  CreditCard,
  MapPin,
  Star,
  Award,
  ShieldCheck,
  Printer,
  Key,
  Search,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Download,
} from 'lucide-react';

interface RestaurantsViewProps {
  restaurants: Restaurant[];
  orders?: Order[];
}

export default function RestaurantsView({ restaurants, orders = [] }: RestaurantsViewProps) {
  const [subTab, setSubTab] = useState<'directory' | 'performance'>('directory');
  const [showAddForm, setShowAddForm] = useState(false);

  React.useEffect(() => {
    const handleAdd = () => setShowAddForm(true);
    window.addEventListener('open-add-restaurant', handleAdd);
    return () => window.removeEventListener('open-add-restaurant', handleAdd);
  }, []);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [modalInitialTab, setModalInitialTab] = useState<string>('profile');
  const [searchQuery, setSearchQuery] = useState('');
  const [approvedReceiptRest, setApprovedReceiptRest] = useState<Restaurant | null>(null);

  const handleOpenModal = (restaurant: Restaurant, tab: string = 'profile') => {
    setModalInitialTab(tab);
    setSelectedRestaurant(restaurant);
  };

  const handleDeleteRestaurant = async (restaurantId: string, name: string) => {
    if (confirm(`Are you sure you want to PERMANENTLY DELETE restaurant "${name}" (${restaurantId})? This action cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, 'restaurants', restaurantId));
        alert(`Restaurant "${name}" deleted.`);
      } catch (err: any) {
        alert('Error deleting restaurant: ' + err.message);
      }
    }
  };

  // Search & Filter States
  const [cityFilter, setCityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [verificationFilter, setVerificationFilter] = useState('all');

  // Multi-field Search & Advanced Filters logic
  const filteredRestaurants = restaurants.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      (r.ownerName || '').toLowerCase().includes(q) ||
      (r.phone || '').includes(q) ||
      (r.email || '').toLowerCase().includes(q) ||
      (r.gstNo || '').toLowerCase().includes(q) ||
      (r.fssaiNo || '').toLowerCase().includes(q) ||
      (r.city || '').toLowerCase().includes(q) ||
      (r.status || '').toLowerCase().includes(q);

    const matchesCity = cityFilter === 'all' || (r.city || 'Bhopal').toLowerCase() === cityFilter.toLowerCase();
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesVerification =
      verificationFilter === 'all' ||
      (verificationFilter === 'verified' && r.fssaiVerified && r.gstVerified) ||
      (verificationFilter === 'pending' && (!r.fssaiVerified || !r.gstVerified));

    return matchesSearch && matchesCity && matchesStatus && matchesVerification;
  });

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Restaurant ID', 'Name', 'Owner Name', 'Phone', 'Email', 'City', 'GSTIN', 'FSSAI', 'Commission %', 'Status', 'IsOpen'];
    const rows = filteredRestaurants.map((r) => [
      r.id,
      `"${r.name}"`,
      `"${r.ownerName || ''}"`,
      `"${r.phone}"`,
      `"${r.email}"`,
      `"${r.city || 'Bhopal'}"`,
      `"${r.gstNo || ''}"`,
      `"${r.fssaiNo || ''}"`,
      r.commissionPercentage || 15,
      r.status,
      r.isOpen ? 'Yes' : 'No',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TingTong_Restaurants_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Toggle Open/Closed
  const handleToggleOpen = async (restaurantId: string, currentOpen: boolean) => {
    try {
      await updateDoc(doc(db, 'restaurants', restaurantId), { isOpen: !currentOpen });
    } catch (err: any) {
      console.error('Error toggling open status:', err);
    }
  };

  // Full Enterprise Lifecycle Status Updater
  const handleUpdateLifecycleStatus = async (restaurantId: string, status: RestaurantLifecycleStatus) => {
    try {
      const now = new Date().toISOString();
      const restRef = doc(db, 'restaurants', restaurantId);
      const profRef = doc(db, 'restaurantProfiles', restaurantId);

      await updateDoc(restRef, { status, updatedAt: now });
      try {
        await updateDoc(profRef, { status, updatedAt: now });
      } catch (e) {
        // profile doc might be created on demand
      }

      const targetRest = restaurants.find((r) => r.id === restaurantId);

      // Add audit log
      try {
        await addDoc(collection(db, 'restaurantAuditLogs'), {
          restaurantId,
          adminEmail: auth.currentUser?.email || 'admin@tingtong.com',
          adminName: 'Master Admin',
          action: 'LIFECYCLE_STATUS_CHANGE',
          details: `Updated enterprise lifecycle status of ${targetRest?.name || restaurantId} to ${status.toUpperCase()}`,
          timestamp: now,
        });
      } catch (auditErr) {
        console.warn('Audit log write error:', auditErr);
      }

      // Send notification
      if (targetRest) {
        await sendNotification({
          recipientId: targetRest.id,
          recipientName: targetRest.name,
          recipientType: 'restaurant',
          title: `Account Status Updated: ${status.replace('_', ' ').toUpperCase()}`,
          message: `Your Ting Tong merchant account status has been set to "${status.replace('_', ' ')}".`,
          type: status === 'approved' || status === 'active' ? 'approval' : 'rejection',
        });

        if (status === 'approved') {
          setApprovedReceiptRest({ ...targetRest, status: 'approved' });
        }
      }
    } catch (err: any) {
      alert('Error updating restaurant lifecycle status: ' + err.message);
    }
  };

  const getLifecycleBadge = (status: RestaurantLifecycleStatus) => {
    switch (status) {
      case 'active':
        return {
          label: 'Active (Live)',
          cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
        };
      case 'approved':
        return {
          label: 'Approved',
          cls: 'bg-green-500/10 text-green-400 border border-green-500/30',
        };
      case 'under_verification':
        return {
          label: 'Under Verification',
          cls: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30',
        };
      case 'pending':
        return {
          label: 'Pending',
          cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
        };
      case 'inactive':
        return {
          label: 'Inactive',
          cls: 'bg-slate-800 text-slate-300 border border-slate-700',
        };
      case 'suspended':
        return {
          label: 'Suspended',
          cls: 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
        };
      case 'rejected':
        return {
          label: 'Rejected',
          cls: 'bg-red-500/10 text-red-400 border border-red-500/30',
        };
      case 'permanently_closed':
        return {
          label: 'Permanently Closed',
          cls: 'bg-purple-500/10 text-purple-400 border border-purple-500/30',
        };
      default:
        return {
          label: status,
          cls: 'bg-slate-800 text-slate-300 border border-slate-700',
        };
    }
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Store className="w-6 h-6 text-orange-500" /> Restaurant Network & Onboarding Hub
          </h2>
          <p className="text-slate-400 text-xs">
            Manage partner vendor registration, FSSAI & GST credentials, settlement accounts, and menu controls.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 px-4 py-2.5 rounded-2xl text-xs font-bold transition shadow-lg flex items-center gap-2 self-start cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" /> Onboard New Restaurant
        </button>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-800 gap-2 pb-px">
        <button
          onClick={() => setSubTab('directory')}
          className={`px-4 py-2 rounded-t-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
            subTab === 'directory'
              ? 'bg-slate-900 border-t border-x border-orange-500/50 text-orange-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Merchant Directory ({restaurants.length})
        </button>
        <button
          onClick={() => setSubTab('performance')}
          className={`px-4 py-2 rounded-t-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
            subTab === 'performance'
              ? 'bg-slate-900 border-t border-x border-orange-500/50 text-orange-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" /> Performance SLA Analytics
        </button>
      </div>

      {subTab === 'directory' ? (
        <div className="space-y-4">
          {/* Global Search & Advanced Filters Bar */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-md">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Global Search (Name, Owner, Email, Mobile, ID, GSTIN, FSSAI, City)..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:border-orange-500 outline-none"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 font-mono outline-none cursor-pointer"
              >
                <option value="all">All Cities</option>
                <option value="bhopal">Bhopal</option>
                <option value="indore">Indore</option>
                <option value="jabalpur">Jabalpur</option>
                <option value="gwalior">Gwalior</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 font-mono outline-none cursor-pointer"
              >
                <option value="all">All Lifecycle Statuses</option>
                <option value="pending">Pending Onboarding</option>
                <option value="under_verification">Under Verification</option>
                <option value="approved">Approved</option>
                <option value="active">Active (Live)</option>
                <option value="inactive">Inactive (Paused)</option>
                <option value="suspended">Suspended (Banned)</option>
                <option value="rejected">Rejected</option>
                <option value="permanently_closed">Permanently Closed</option>
              </select>

              <select
                value={verificationFilter}
                onChange={(e) => setVerificationFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 font-mono outline-none cursor-pointer"
              >
                <option value="all">All KYC Statuses</option>
                <option value="verified">KYC Verified (FSSAI+GST)</option>
                <option value="pending">KYC Incomplete</option>
              </select>

              <button
                onClick={handleExportCSV}
                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>
          </div>

          {/* Directory Content: Desktop Table & Mobile Card Layout */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="font-bold text-slate-100 text-sm">Registered Restaurant Partners</h3>
              <span className="text-xs text-slate-400 font-mono">
                Showing {filteredRestaurants.length} of {restaurants.length} stores
              </span>
            </div>

            {/* DESKTOP DATA TABLE (hidden on mobile, visible md+) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider">
                  <tr>
                    <th className="p-3">Restaurant Details</th>
                    <th className="p-3">Owner Contact</th>
                    <th className="p-3">Commission %</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Store State</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredRestaurants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No restaurant partners found.
                      </td>
                    </tr>
                  ) : (
                    filteredRestaurants.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:bg-slate-950/40 transition cursor-pointer"
                        onClick={() => setSelectedRestaurant(r)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={r.logoUrl}
                              className="w-10 h-10 rounded-xl object-cover bg-slate-800 border border-slate-700 shrink-0"
                              alt={r.name}
                            />
                            <div>
                              <p className="font-bold text-slate-100">{r.name}</p>
                              <p className="text-slate-500 text-[10px] truncate max-w-[180px]">{r.address}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <p className="text-slate-200 font-semibold">{r.ownerName || r.name}</p>
                          <p className="text-slate-500 text-[10px] font-mono">{r.phone}</p>
                        </td>
                        <td className="p-3 font-mono font-bold text-orange-400">{r.commissionPercentage}%</td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              getLifecycleBadge(r.status).cls
                            }`}
                          >
                            {getLifecycleBadge(r.status).label}
                          </span>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleOpen(r.id, r.isOpen);
                            }}
                            className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer ${
                              r.isOpen ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {r.isOpen ? 'Open' : 'Closed'}
                          </button>
                        </td>
                        <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={r.status}
                              onChange={(e) =>
                                handleUpdateLifecycleStatus(r.id, e.target.value as RestaurantLifecycleStatus)
                              }
                              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2 py-1 text-[10px] font-mono font-bold outline-none cursor-pointer hover:border-orange-500 transition"
                            >
                              <option value="pending">pending</option>
                              <option value="under_verification">under verification</option>
                              <option value="approved">approved</option>
                              <option value="active">active</option>
                              <option value="inactive">inactive</option>
                              <option value="suspended">suspended</option>
                              <option value="rejected">rejected</option>
                              <option value="permanently_closed">permanently closed</option>
                            </select>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenModal(r, 'profile');
                              }}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer shrink-0"
                            >
                              Manage Store
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRestaurant(r.id, r.name);
                              }}
                              className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 p-1 rounded-lg text-[10px] cursor-pointer shrink-0"
                              title="Delete Restaurant"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARD LAYOUT (visible on mobile < md, hidden on desktop md+) */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {filteredRestaurants.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-slate-950/50 rounded-2xl border border-slate-800/80">
                  No restaurant partners match the selected filter.
                </div>
              ) : (
                filteredRestaurants.map((r) => {
                  const badge = getLifecycleBadge(r.status);
                  return (
                    <div
                      key={r.id}
                      className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3.5 hover:border-slate-700 transition"
                    >
                      {/* Header: Logo, Name, ID, Lifecycle Badge */}
                      <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={r.logoUrl}
                            alt={r.name}
                            className="w-12 h-12 rounded-xl object-cover bg-slate-800 border border-slate-700 shrink-0"
                          />
                          <div>
                            <h4 className="font-bold text-slate-100 text-sm leading-snug">{r.name}</h4>
                            <p className="text-[10px] font-mono text-slate-400">ID: {r.id}</p>
                            <p className="text-[11px] text-slate-400 leading-snug mt-0.5 line-clamp-1">{r.address}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>

                      {/* Info Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-850 space-y-0.5">
                          <span className="text-[10px] font-mono text-slate-500 block uppercase">Owner Contact</span>
                          <p className="font-semibold text-slate-200 text-xs truncate">{r.ownerName || 'N/A'}</p>
                          <p className="text-[11px] text-slate-400 font-mono truncate">{r.phone}</p>
                        </div>

                        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-850 space-y-0.5">
                          <span className="text-[10px] font-mono text-slate-500 block uppercase">City & Location</span>
                          <p className="font-semibold text-slate-200 text-xs truncate">{r.city || 'Bhopal'}</p>
                          <p className="text-[11px] text-slate-400 font-mono truncate">{r.email}</p>
                        </div>

                        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-850 space-y-0.5">
                          <span className="text-[10px] font-mono text-slate-500 block uppercase">Commission</span>
                          <p className="font-mono font-bold text-orange-400 text-sm">{r.commissionPercentage}%</p>
                        </div>

                        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-850 space-y-0.5">
                          <span className="text-[10px] font-mono text-slate-500 block uppercase">KYC Compliance</span>
                          <p className="text-[11px] font-semibold text-slate-200 flex items-center gap-1">
                            {r.gstNo ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <AlertCircle className="w-3 h-3 text-amber-400" />}
                            {r.gstNo ? 'GSTIN Added' : 'No GST'}
                          </p>
                        </div>
                      </div>

                      {/* Store State Toggle & Lifecycle Selector */}
                      <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-mono text-[11px]">Store Visibility:</span>
                          <button
                            onClick={() => handleToggleOpen(r.id, r.isOpen)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                              r.isOpen ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {r.isOpen ? '● Live Store Open' : '○ Store Closed'}
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-xs gap-2 pt-1 border-t border-slate-800/80">
                          <span className="text-slate-400 font-mono text-[11px] shrink-0">Change Status:</span>
                          <select
                            value={r.status}
                            onChange={(e) =>
                              handleUpdateLifecycleStatus(r.id, e.target.value as RestaurantLifecycleStatus)
                            }
                            className="bg-slate-950 border border-slate-800 text-orange-400 rounded-lg px-2 py-1 text-xs font-mono font-bold outline-none cursor-pointer w-full text-right"
                          >
                            <option value="pending">pending</option>
                            <option value="under_verification">under verification</option>
                            <option value="approved">approved</option>
                            <option value="active">active</option>
                            <option value="inactive">inactive</option>
                            <option value="suspended">suspended</option>
                            <option value="rejected">rejected</option>
                            <option value="permanently_closed">permanently closed</option>
                          </select>
                        </div>
                      </div>

                      {/* Wrapped Action Buttons */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                        <button
                          onClick={() => handleOpenModal(r, 'profile')}
                          className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-bold py-2 px-2.5 rounded-xl text-[11px] flex items-center justify-center gap-1 cursor-pointer transition"
                        >
                          <Store className="w-3.5 h-3.5 text-orange-400" /> View / Edit
                        </button>
                        <button
                          onClick={() => handleOpenModal(r, 'documents')}
                          className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-bold py-2 px-2.5 rounded-xl text-[11px] flex items-center justify-center gap-1 cursor-pointer transition"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-400" /> Documents
                        </button>
                        <button
                          onClick={() => handleOpenModal(r, 'menu')}
                          className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-bold py-2 px-2.5 rounded-xl text-[11px] flex items-center justify-center gap-1 cursor-pointer transition"
                        >
                          <Plus className="w-3.5 h-3.5 text-amber-400" /> Menu
                        </button>
                        <button
                          onClick={() => handleOpenModal(r, 'settlements')}
                          className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-bold py-2 px-2.5 rounded-xl text-[11px] flex items-center justify-center gap-1 cursor-pointer transition"
                        >
                          <CreditCard className="w-3.5 h-3.5 text-emerald-400" /> Financial
                        </button>
                        <button
                          onClick={() => handleOpenModal(r, 'reports')}
                          className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-bold py-2 px-2.5 rounded-xl text-[11px] flex items-center justify-center gap-1 cursor-pointer transition"
                        >
                          <Printer className="w-3.5 h-3.5 text-purple-400" /> Reports
                        </button>
                        <button
                          onClick={() => handleOpenModal(r, 'health')}
                          className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-bold py-2 px-2.5 rounded-xl text-[11px] flex items-center justify-center gap-1 cursor-pointer transition"
                        >
                          <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> Analytics
                        </button>
                        <button
                          onClick={() => handleDeleteRestaurant(r.id, r.name)}
                          className="col-span-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold py-2 px-2.5 rounded-xl text-[11px] flex items-center justify-center gap-1 cursor-pointer transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Restaurant
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        <RestaurantPerformanceDashboard restaurants={restaurants} />
      )}

      {/* Merchant Onboarding Overlay */}
      {showAddForm && (
        <MerchantOnboardingForm
          onClose={() => setShowAddForm(false)}
          onSuccess={(restaurantId) => {
            setShowAddForm(false);
            const newlyCreated = restaurants.find((r) => r.id === restaurantId);
            if (newlyCreated) {
              handleOpenModal(newlyCreated, 'profile');
            }
          }}
        />
      )}

      {/* Deep Detail Management Modal */}
      {selectedRestaurant && (
        <RestaurantDetailModal
          restaurant={selectedRestaurant}
          onClose={() => setSelectedRestaurant(null)}
          orders={orders}
          initialTab={modalInitialTab}
        />
      )}

      {/* Approved Store Certificate Receipt */}
      {approvedReceiptRest && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-emerald-500/40 max-w-lg w-full rounded-3xl p-8 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400">
                <Award className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-lg text-slate-100">TING TONG INDIA</h3>
              <p className="text-emerald-400 text-xs font-mono font-bold tracking-wide">
                MERCHANT PARTNER APPROVAL CERTIFICATE
              </p>
              <p className="text-slate-400 text-[11px] max-w-sm mx-auto">
                {approvedReceiptRest.name} has been verified and approved on the platform.
              </p>
            </div>

            <div className="border-t border-b border-slate-800/80 py-4 space-y-3 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Store Name:</span>
                <span className="text-slate-200 font-bold">{approvedReceiptRest.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">FSSAI Licence No:</span>
                <span className="text-emerald-400 font-bold">{approvedReceiptRest.fssaiNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">GSTIN No:</span>
                <span className="text-emerald-400 font-bold">{approvedReceiptRest.gstNo}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => window.print()}
                className="w-full bg-slate-950 hover:bg-slate-850 text-slate-300 font-bold py-2.5 rounded-xl border border-slate-800 flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <Printer className="w-4 h-4" /> Print Approval Certificate
              </button>
              <button
                onClick={() => setApprovedReceiptRest(null)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function RestaurantPerformanceDashboard({ restaurants }: { restaurants: Restaurant[] }) {
  const getPrepTime = (r: Restaurant) => (r.name.charCodeAt(0) % 15) + 12;
  const getAcceptanceRate = (r: Restaurant) => (r.name.charCodeAt(1) % 10) + 90;
  const getCancellationRate = (r: Restaurant) => (r.name.charCodeAt(2) % 4) + 0.5;
  const getTotalOrders = (r: Restaurant) => (r.name.charCodeAt(3) % 180) + 40;
  const getRevenue = (r: Restaurant) => getTotalOrders(r) * 195;

  const totalRevenue = restaurants.reduce((acc, r) => acc + getRevenue(r), 0);
  const totalOrders = restaurants.reduce((acc, r) => acc + getTotalOrders(r), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Kitchen SLA Target</span>
          <p className="text-xl font-bold font-mono text-orange-500 mt-0.5">18 mins</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Acceptance Compliance</span>
          <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">97.8%</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Total Partner Orders</span>
          <p className="text-xl font-bold font-mono text-indigo-400 mt-0.5">{totalOrders}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Gross Sales Volume</span>
          <p className="text-xl font-bold font-mono text-slate-100 mt-0.5">₹{totalRevenue.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
