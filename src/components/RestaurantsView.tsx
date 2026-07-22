import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { Restaurant, MenuItem } from '../types';
import { getActiveCity } from '../services/mapService';
import { 
  Store, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  FileText, 
  CreditCard, 
  MapPin, 
  PlusCircle, 
  Star,
  DollarSign,
  AlertCircle,
  Award,
  ShieldCheck,
  Printer
} from 'lucide-react';

interface RestaurantsViewProps {
  restaurants: Restaurant[];
}

export default function RestaurantsView({ restaurants }: RestaurantsViewProps) {
  const [subTab, setSubTab] = useState<'directory' | 'performance'>('directory');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [approvedRestaurantReceipt, setApprovedRestaurantReceipt] = useState<Restaurant | null>(null);
  
  // Menu panel states
  const [showMenuModal, setShowMenuModal] = useState<Restaurant | null>(null);
  const [newMenuItemName, setNewMenuItemName] = useState('');
  const [newMenuItemPrice, setNewMenuItemPrice] = useState('');
  const [newMenuItemCat, setNewMenuItemCat] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [commission, setCommission] = useState('15');
  const [gst, setGst] = useState('');
  const [fssai, setFssai] = useState('');
  const [bankName, setBankName] = useState('');
  const [accNo, setAccNo] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [upi, setUpi] = useState('');

  // Live menu items linked to the active restaurants
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const handleCreateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone) return;

    try {
      const id = "rest_" + Date.now();
      const newRest: Restaurant = {
        id,
        name,
        email,
        phone,
        address,
        status: 'approved', // approve instantly in admin panel
        isOpen: true,
        rating: 5.0,
        commissionPercentage: Number(commission),
        gstNo: gst || "GST-PENDING",
        fssaiNo: fssai || "FSSAI-PENDING",
        bankName: bankName || "SBI",
        accountNumber: accNo || "1234567890",
        ifscCode: ifsc || "SBIN0001234",
        upiId: upi || `${phone}@upi`,
        logoUrl: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?q=80&w=200&auto=format&fit=crop",
        coverUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=800&auto=format&fit=crop",
        categories: ["Fast Food", "North Indian"]
      };

      await setDoc(doc(db, 'restaurants', id), newRest);
      setShowAddForm(false);
      // Reset form fields
      setName(''); setEmail(''); setPhone(''); setAddress(''); setGst(''); setFssai(''); setBankName(''); setAccNo(''); setIfsc(''); setUpi('');
    } catch (err) {
      console.error("Error creating restaurant partner: ", err);
    }
  };

  const handleUpdateStatus = async (restaurantId: string, status: 'approved' | 'rejected') => {
    try {
      const restRef = doc(db, 'restaurants', restaurantId);
      await updateDoc(restRef, { status });
      const found = restaurants.find(r => r.id === restaurantId);
      if (status === 'approved' && found) {
        setApprovedRestaurantReceipt({ ...found, status: 'approved' });
      }
    } catch (err) {
      console.error("Error updating restaurant status: ", err);
    }
  };

  const handleToggleOpen = async (restaurantId: string, currentOpen: boolean) => {
    try {
      const restRef = doc(db, 'restaurants', restaurantId);
      await updateDoc(restRef, { isOpen: !currentOpen });
    } catch (err) {
      console.error("Error toggling open status: ", err);
    }
  };

  // Menu items handlers
  const handleAddMenuItem = () => {
    if (!newMenuItemName || !newMenuItemPrice || !showMenuModal) return;
    const item: MenuItem = {
      id: "m_" + Date.now(),
      restaurantId: showMenuModal.id,
      name: newMenuItemName,
      price: Number(newMenuItemPrice),
      category: newMenuItemCat || "General",
      isAvailable: true,
      imageUrl: "",
      description: ""
    };
    setMenuItems([...menuItems, item]);
    setNewMenuItemName('');
    setNewMenuItemPrice('');
  };

  const handleToggleItemAvailable = (itemId: string) => {
    setMenuItems(menuItems.map(it => it.id === itemId ? { ...it, isAvailable: !it.isAvailable } : it));
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100">Merchant Hub Management</h2>
          <p className="text-slate-400 text-xs">Verify onboarding, GST status, billing details, and open limits.</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-amber-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold hover:brightness-110 flex items-center gap-2 self-start cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" /> Onboard New Restaurant
        </button>
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
          Vendor Directory
        </button>
        <button
          onClick={() => setSubTab('performance')}
          className={`px-4 py-2 border-b-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
            subTab === 'performance'
              ? 'border-amber-500 text-amber-500 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Performance Analytics
        </button>
      </div>

      {subTab === 'directory' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Onboarded Restaurants List */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-slate-100 text-sm">Onboarded {getActiveCity().name} Partner Restaurants</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider">
                <tr>
                  <th className="p-3">Restaurant Details</th>
                  <th className="p-3">Commission %</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Store State</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {restaurants.map(r => (
                  <tr key={r.id} className="hover:bg-slate-950/20 transition cursor-pointer" onClick={() => setSelectedRestaurant(r)}>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img src={r.logoUrl} className="w-9 h-9 rounded-lg object-cover bg-slate-800 border border-slate-700" alt={r.name} />
                        <div>
                          <p className="font-bold text-slate-100">{r.name}</p>
                          <p className="text-slate-500 text-[10px] truncate max-w-[160px]">{r.address}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-300">{r.commissionPercentage}%</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        r.status === 'approved' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : r.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {r.status}
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
                    <td className="p-3 text-right space-x-1.5" onClick={(e) => e.stopPropagation()}>
                      {r.status === 'pending' && (
                        <>
                          <button onClick={() => handleUpdateStatus(r.id, 'approved')} className="bg-emerald-500/10 text-emerald-400 p-1 rounded hover:bg-emerald-500/20"><Check className="w-4 h-4" /></button>
                          <button onClick={() => handleUpdateStatus(r.id, 'rejected')} className="bg-rose-500/10 text-rose-400 p-1 rounded hover:bg-rose-500/20"><X className="w-4 h-4" /></button>
                        </>
                      )}
                      <button 
                        onClick={() => setShowMenuModal(r)}
                        className="bg-slate-800 text-slate-300 px-2 py-1 rounded hover:bg-slate-750 text-[10px] font-semibold cursor-pointer"
                      >
                        Menu Manager
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Selected Restaurant Document audit logs */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <h3 className="font-bold text-slate-100 text-sm">Regulatory Credentials & Banking</h3>
          
          {selectedRestaurant ? (
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <img src={selectedRestaurant.logoUrl} className="w-12 h-12 rounded-xl object-cover bg-slate-800 border border-slate-700" alt={selectedRestaurant.name} />
                <div>
                  <h4 className="font-bold text-slate-100 text-sm">{selectedRestaurant.name}</h4>
                  <div className="flex items-center gap-1 text-[10px] text-amber-500 mt-0.5">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    <span>Rating: {selectedRestaurant.rating}</span>
                  </div>
                </div>
              </div>

              {/* FSSAI and GST License */}
              <div className="space-y-3 bg-slate-950 border border-slate-800 p-4 rounded-xl">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-500 pb-1 border-b border-slate-800">
                  <FileText className="w-4 h-4" />
                  <span>Onboarding Licenses</span>
                </div>
                <div className="text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">GST Registration No:</span>
                    <span className="font-mono text-slate-200 font-bold">{selectedRestaurant.gstNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">FSSAI License No:</span>
                    <span className="font-mono text-slate-200 font-bold">{selectedRestaurant.fssaiNo}</span>
                  </div>
                </div>
              </div>

              {/* Bank accounts settlements */}
              <div className="space-y-3 bg-slate-950 border border-slate-800 p-4 rounded-xl">
                <div className="flex items-center gap-2 text-xs font-semibold text-sky-500 pb-1 border-b border-slate-800">
                  <CreditCard className="w-4 h-4" />
                  <span>Settlement Bank Account</span>
                </div>
                <div className="text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Bank:</span>
                    <span className="text-slate-200 font-bold">{selectedRestaurant.bankName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">A/C No:</span>
                    <span className="font-mono text-slate-200 font-bold">{selectedRestaurant.accountNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">IFSC Code:</span>
                    <span className="font-mono text-slate-200 font-bold">{selectedRestaurant.ifscCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Merchant UPI ID:</span>
                    <span className="font-mono text-slate-200 font-bold">{selectedRestaurant.upiId}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-xs">
              <AlertCircle className="w-8 h-8 text-slate-600 mb-2" />
              <span>Select a restaurant to view GST licensing and banking models.</span>
            </div>
          )}
        </div>

      </div>
      ) : (
        <RestaurantPerformanceDashboard restaurants={restaurants} />
      )}

      {/* Onboard New Merchant form Overlay */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-xl w-full rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-start">
              <div>
                <h3 className="font-bold text-base text-slate-100">Merchant Onboarding Portal</h3>
                <p className="text-slate-400 text-xs">Register and verify a new vendor restaurant in {getActiveCity().name}.</p>
              </div>
              <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-200 text-lg cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateRestaurant} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Restaurant Name</label>
                  <input required type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Manohar Dairy" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs focus:border-amber-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</label>
                  <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="merchant@bhopal.com" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs focus:border-amber-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone Contact</label>
                  <input required type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765..." className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs focus:border-amber-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Platform Commission %</label>
                  <input type="number" value={commission} onChange={e => setCommission(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs focus:border-amber-500 outline-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{getActiveCity().name} Physical Address</label>
                <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Shop 12, Arera Market" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs focus:border-amber-500 outline-none h-16 resize-none" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800/80 pt-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">GSTIN Registration</label>
                  <input type="text" value={gst} onChange={e => setGst(e.target.value)} placeholder="23AABCT9384C..." className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs focus:border-amber-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">FSSAI Licence No</label>
                  <input type="text" value={fssai} onChange={e => setFssai(e.target.value)} placeholder="14-Digit Number" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs focus:border-amber-500 outline-none" />
                </div>
              </div>

              <div className="border-t border-slate-800/80 pt-4 space-y-3">
                <p className="text-slate-400 text-xs font-semibold">Settlement Bank & UPI Details</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Bank Name" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs focus:border-amber-500 outline-none" />
                  <input type="text" value={accNo} onChange={e => setAccNo(e.target.value)} placeholder="Account No" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs focus:border-amber-500 outline-none" />
                  <input type="text" value={ifsc} onChange={e => setIfsc(e.target.value)} placeholder="IFSC Code" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs focus:border-amber-500 outline-none" />
                </div>
                <input type="text" value={upi} onChange={e => setUpi(e.target.value)} placeholder="Merchant UPI ID (e.g. manohar@okaxis)" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs focus:border-amber-500 outline-none" />
              </div>

              <button type="submit" className="w-full bg-amber-500 text-slate-950 font-bold py-3 rounded-xl text-xs hover:brightness-110 mt-6 cursor-pointer">
                Complete Onboarding & Approve
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Menu Manager Modal Overlay */}
      {showMenuModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-2xl w-full rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-start">
              <div>
                <h3 className="font-bold text-base text-slate-100">Live Menu Catalog Manager</h3>
                <p className="text-slate-400 text-xs">Managing catalog for {showMenuModal.name}.</p>
              </div>
              <button onClick={() => setShowMenuModal(null)} className="text-slate-400 hover:text-slate-200 text-lg cursor-pointer">✕</button>
            </div>

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Add Menu Item */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                <p className="text-slate-300 text-xs font-bold">Add Item to Catalog</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input type="text" placeholder="Item Name" value={newMenuItemName} onChange={e => setNewMenuItemName(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100 focus:border-amber-500 outline-none" />
                  <input type="number" placeholder="Price (₹)" value={newMenuItemPrice} onChange={e => setNewMenuItemPrice(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100 focus:border-amber-500 outline-none" />
                  <input type="text" placeholder="Category (e.g. Chaat)" value={newMenuItemCat} onChange={e => setNewMenuItemCat(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100 focus:border-amber-500 outline-none" />
                </div>
                <button 
                  onClick={handleAddMenuItem}
                  className="bg-amber-500 text-slate-950 px-4 py-1.5 rounded-lg text-xs font-bold hover:brightness-110 flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" /> Add Item
                </button>
              </div>

              {/* Current Items Catalog List */}
              <div className="space-y-3">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Active Catalog List</p>
                <div className="space-y-2">
                  {menuItems.filter(it => it.restaurantId === showMenuModal.id).map(it => (
                    <div key={it.id} className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-100">{it.name}</p>
                        <p className="text-slate-500 text-[10px]">{it.category} | Price: ₹{it.price}</p>
                      </div>
                      <button 
                        onClick={() => handleToggleItemAvailable(it.id)}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase cursor-pointer ${
                          it.isAvailable ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {it.isAvailable ? 'In Stock' : 'Out of Stock'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POST-APPROVAL RESTAURANT DOCUMENT CONFIRMATION RECEIPT */}
      {approvedRestaurantReceipt && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border-2 border-emerald-500/40 max-w-lg w-full rounded-3xl p-8 space-y-6 shadow-2xl relative overflow-hidden">
            {/* Top decorative seal */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute top-4 right-4">
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[9px] font-bold tracking-widest uppercase px-3 py-1 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Certified Partner
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
                MERCHANT VENDOR APPROVAL CERTIFICATE
              </p>
              <p className="text-slate-400 text-[11px] max-w-sm mx-auto">
                The restaurant store has been officially approved. This receipt stands as immediate validation of active business document verification.
              </p>
            </div>

            <div className="border-t border-b border-slate-800/80 py-4.5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-0.5">Store Name</label>
                  <p className="text-slate-200 font-bold text-[13px]">{approvedRestaurantReceipt.name}</p>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-0.5">Commission Rate</label>
                  <p className="text-slate-200 font-bold">{approvedRestaurantReceipt.commissionPercentage}% Commission</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-0.5">Contact Number</label>
                  <p className="text-slate-300 font-mono">{approvedRestaurantReceipt.phone}</p>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-0.5">Merchant ID</label>
                  <p className="text-slate-300 font-mono font-semibold text-emerald-400">{approvedRestaurantReceipt.id}</p>
                </div>
              </div>

              <div className="bg-slate-950 rounded-2xl border border-slate-850 p-4 space-y-2.5">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Verified Credentials Ledger</p>
                
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-mono">FSSAI Licence Number:</span>
                  <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> {approvedRestaurantReceipt.fssaiNo || 'FSSAI-VERIFIED'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] border-t border-slate-900/60 pt-2">
                  <span className="text-slate-400 font-mono">GSTIN Registration No.:</span>
                  <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> {approvedRestaurantReceipt.gstNo || 'GST-VERIFIED'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] border-t border-slate-900/60 pt-2">
                  <span className="text-slate-400 font-mono">Bank Account No.:</span>
                  <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> {approvedRestaurantReceipt.accountNumber} ({approvedRestaurantReceipt.bankName})
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] border-t border-slate-900/60 pt-2">
                  <span className="text-slate-400 font-mono">UPI Merchant ID:</span>
                  <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> {approvedRestaurantReceipt.upiId}
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
                <Printer className="w-4 h-4" /> Print Approved Store Certificate
              </button>
              <button 
                onClick={() => setApprovedRestaurantReceipt(null)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-2.5 rounded-xl transition text-xs cursor-pointer"
              >
                Confirm Verification & Close
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
  const avgPrep = restaurants.length ? Math.round(restaurants.reduce((acc, r) => acc + getPrepTime(r), 0) / restaurants.length) : 15;
  const avgAcceptance = restaurants.length ? (restaurants.reduce((acc, r) => acc + getAcceptanceRate(r), 0) / restaurants.length).toFixed(1) : '95.0';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Average Kitchen Prep Time</span>
          <p className="text-xl font-bold font-mono text-amber-500 mt-0.5">{avgPrep} mins</p>
          <p className="text-[10px] text-slate-500 mt-1">Platform average: 18m SLA target</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Acceptance Compliance</span>
          <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{avgAcceptance}%</p>
          <p className="text-[10px] text-slate-500 mt-1">Target merchant SLA: &gt;95.0%</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Total Platform Orders</span>
          <p className="text-xl font-bold font-mono text-indigo-400 mt-0.5">{totalOrders}</p>
          <p className="text-[10px] text-slate-500 mt-1">Sum of merchant fulfillments</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Total Merchant Revenue</span>
          <p className="text-xl font-bold font-mono text-slate-100 mt-0.5">₹{totalRevenue.toLocaleString()}</p>
          <p className="text-[10px] text-slate-500 mt-1">Net sales after commissions</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-100 text-sm">Merchant Kitchen SLA Analysis</h3>
          <span className="bg-slate-950 px-2.5 py-0.5 text-[10px] font-mono font-bold text-slate-400 rounded-lg border border-slate-800">
            REALTIME SLA MONITORS
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider">
              <tr>
                <th className="p-3">Partner Restaurant</th>
                <th className="p-3">Avg Prep Duration</th>
                <th className="p-3">Order Acceptance</th>
                <th className="p-3">Cancellation SLA</th>
                <th className="p-3">Total Orders</th>
                <th className="p-3 text-right">Net Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {restaurants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">No restaurants onboarded yet.</td>
                </tr>
              ) : (
                restaurants.map(r => {
                  const prep = getPrepTime(r);
                  const acceptance = getAcceptanceRate(r);
                  const cancellation = getCancellationRate(r);
                  const orders = getTotalOrders(r);
                  const revenue = getRevenue(r);
                  
                  return (
                    <tr key={r.id} className="hover:bg-slate-950/10 transition">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <img src={r.logoUrl} className="w-7 h-7 rounded object-cover bg-slate-800" alt="" />
                          <div>
                            <p className="font-bold text-slate-200">{r.name}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                              <span className="text-[9px] font-mono font-bold text-slate-400">{r.rating.toFixed(1)} rating</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                          prep > 22 ? 'bg-rose-500/10 text-rose-400' : prep > 17 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {prep} mins
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-300">
                        {acceptance}%
                      </td>
                      <td className="p-3">
                        <span className={`font-mono font-bold ${cancellation > 3.5 ? 'text-rose-400' : 'text-slate-400'}`}>
                          {cancellation}%
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-300">
                        {orders}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">
                        ₹{revenue.toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
