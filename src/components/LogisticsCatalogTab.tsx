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
import { Zone, Order, Rider, Restaurant, MenuItem } from '../types';
import { getActiveCity } from '../services/mapService';
import { 
  MapPin, 
  Utensils, 
  ShoppingBag, 
  Clock, 
  Plus, 
  Trash2, 
  Check, 
  Edit, 
  X, 
  RefreshCw, 
  Truck, 
  Percent, 
  CheckCircle2, 
  DollarSign 
} from 'lucide-react';

interface LogisticsCatalogTabProps {
  restaurants: Restaurant[];
  riders: Rider[];
  orders: Order[];
  onLogEvent: (action: string, details: string) => void;
}

export default function LogisticsCatalogTab({ restaurants, riders, orders, onLogEvent }: LogisticsCatalogTabProps) {
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState<Zone[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  
  // Custom business hours
  const [bizHours, setBizHours] = useState([
    { day: 'Monday', open: '08:00', close: '23:00', status: 'open' },
    { day: 'Tuesday', open: '08:00', close: '23:00', status: 'open' },
    { day: 'Wednesday', open: '08:00', close: '23:00', status: 'open' },
    { day: 'Thursday', open: '08:00', close: '23:00', status: 'open' },
    { day: 'Friday', open: '08:00', close: '23:30', status: 'open' },
    { day: 'Saturday', open: '07:30', close: '23:59', status: 'open' },
    { day: 'Sunday', open: '07:30', close: '23:59', status: 'open' },
  ]);

  // Zone Form states
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneRadius, setNewZoneRadius] = useState('5');
  const [newZoneCharges, setNewZoneCharges] = useState('35');

  // Category & Product states
  const [categories, setCategories] = useState<string[]>(["Sweets", "North Indian", "Chaats", "Bakery", "Sandwiches", "Soups", "Chinese", "Fast Food", "Thalis", "Pure Veg", "Rajasthani", "Desserts"]);
  const [newCategory, setNewCategory] = useState('');
  
  // Menu form states
  const [selectedRestId, setSelectedRestId] = useState('rest_001');
  const [newDishName, setNewDishName] = useState('');
  const [newDishPrice, setNewDishPrice] = useState('120');
  const [newDishCat, setNewDishCat] = useState('Chinese');

  // Order override states
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [overrideStatus, setOverrideStatus] = useState<'pending' | 'accepted' | 'preparing' | 'ready_for_pickup' | 'picked_up' | 'delivered' | 'cancelled' | 'refunded'>('pending');
  const [assignRiderId, setAssignRiderId] = useState('');

  useEffect(() => {
    const fetchZonesAndMenus = async () => {
      try {
        const zoneSnap = await getDocs(collection(db, 'zones'));
        if (!zoneSnap.empty) {
          setZones(zoneSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Zone));
        } else {
          setZones([
            { id: "zone_01", name: "Arera Colony & MP Nagar Central", radius: 5, minOrderAmount: 150, maxDistance: 10, areaCharges: 30, active: true },
            { id: "zone_02", name: "Kolar Road Boundary Zone", radius: 8, minOrderAmount: 200, maxDistance: 15, areaCharges: 40, active: true },
            { id: "zone_03", name: "Indrapuri & Piplani Sector", radius: 6, minOrderAmount: 150, maxDistance: 12, areaCharges: 35, active: true }
          ]);
        }

        const menuSnap = await getDocs(collection(db, 'menu_items'));
        if (!menuSnap.empty) {
          setMenuItems(menuSnap.docs.map(d => ({ id: d.id, ...d.data() }) as MenuItem));
        } else {
          setMenuItems([
            { id: "m1", restaurantId: "rest_001", name: "Special Rabdi (250g)", price: 150, category: "Sweets", isAvailable: true, imageUrl: "", description: "" },
            { id: "m2", restaurantId: "rest_001", name: "Sponge Rasgulla (Plate of 2)", price: 60, category: "Sweets", isAvailable: true, imageUrl: "", description: "" },
            { id: "m3", restaurantId: "rest_002", name: "Double Cheese Sandwich", price: 120, category: "Sandwiches", isAvailable: true, imageUrl: "", description: "" },
            { id: "m4", restaurantId: "rest_002", name: "Hot Veg Soup", price: 80, category: "Soups", isAvailable: true, imageUrl: "", description: "" },
            { id: "m5", restaurantId: "rest_003", name: "Special Veg Thali", price: 220, category: "Thalis", isAvailable: true, imageUrl: "", description: "" }
          ]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchZonesAndMenus();
  }, []);

  // Zones
  const handleCreateZone = async () => {
    if (!newZoneName) return;
    try {
      const id = "zone_" + Date.now();
      const zn: Zone = {
        id,
        name: newZoneName,
        radius: Number(newZoneRadius),
        minOrderAmount: 150,
        maxDistance: Number(newZoneRadius) * 2,
        areaCharges: Number(newZoneCharges),
        active: true
      };
      await setDoc(doc(db, 'zones', id), zn);
      setZones([...zones, zn]);
      onLogEvent('ZONE_CREATED', `Added operational delivery boundary: ${zn.name} (${zn.radius} KM)`);
      setNewZoneName('');
      alert("New operational delivery zone registered in Firestore!");
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleZone = async (id: string, active: boolean) => {
    try {
      await updateDoc(doc(db, 'zones', id), { active });
      setZones(zones.map(z => z.id === id ? { ...z, active } : z));
      onLogEvent('ZONE_TOGGLED', `Operational region ${id} status altered to: ${active}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteZone = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'zones', id));
      setZones(zones.filter(z => z.id !== id));
      onLogEvent('ZONE_DELETED', `Revoked operational grid boundary lock ID: ${id}`);
    } catch (err) {
      console.error(err);
    }
  };

  // Categories
  const handleAddCategory = () => {
    if (!newCategory || categories.includes(newCategory)) return;
    setCategories([...categories, newCategory]);
    onLogEvent('CATEGORY_CREATED', `Registered master culinary tag: ${newCategory}`);
    setNewCategory('');
  };

  const handleDeleteCategory = (cat: string) => {
    setCategories(categories.filter(c => c !== cat));
    onLogEvent('CATEGORY_DELETED', `Decommissioned global culinary tag: ${cat}`);
  };

  // Products Menu Items
  const handleCreateDish = async () => {
    if (!newDishName) return;
    try {
      const id = "dish_" + Date.now();
      const dish: MenuItem = {
        id,
        restaurantId: selectedRestId,
        name: newDishName,
        price: Number(newDishPrice),
        category: newDishCat,
        isAvailable: true,
        imageUrl: "",
        description: `Freshly prepared by chef partners in ${getActiveCity().name}.`
      };

      await setDoc(doc(db, 'menu_items', id), dish);
      setMenuItems([...menuItems, dish]);
      onLogEvent('MENU_ITEM_CREATED', `Added dish ${dish.name} (Rs.${dish.price}) to restaurant ${dish.restaurantId}`);
      setNewDishName('');
      alert("Menu product created successfully in Firebase!");
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleDishAvailability = async (id: string, isAvailable: boolean) => {
    try {
      await updateDoc(doc(db, 'menu_items', id), { isAvailable });
      setMenuItems(menuItems.map(m => m.id === id ? { ...m, isAvailable } : m));
      onLogEvent('MENU_ITEM_TOGGLED', `Adjusted menu item ${id} operational availability: ${isAvailable}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDish = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'menu_items', id));
      setMenuItems(menuItems.filter(m => m.id !== id));
      onLogEvent('MENU_ITEM_DELETED', `Pruned menu item ID from platform directories: ${id}`);
    } catch (e) {
      console.error(e);
    }
  };

  // Individual commission percentage override
  const handleUpdateStoreCommission = async (restId: string, commission: number) => {
    try {
      await updateDoc(doc(db, 'restaurants', restId), { commissionPercentage: commission });
      onLogEvent('STORE_COMMISSION_SET', `Overrode commission setting for restaurant partner ${restId} to: ${commission}%`);
      alert("Custom commission percentage updated successfully for vendor!");
    } catch (err) {
      console.error(err);
    }
  };

  // Order Lifecycle bypass overrides
  const handleForceOrderUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) return;
    try {
      const orderRef = doc(db, 'orders', selectedOrderId);
      const fieldsToUpdate: any = { status: overrideStatus };

      if (overrideStatus === 'cancelled' || overrideStatus === 'refunded') {
        fieldsToUpdate.paymentStatus = 'refunded';
      }

      // If we assign a rider
      if (assignRiderId) {
        const chosenRider = riders.find(r => r.id === assignRiderId);
        if (chosenRider) {
          fieldsToUpdate.riderId = chosenRider.id;
          fieldsToUpdate.assignedRiderId = chosenRider.id;
          fieldsToUpdate.riderName = chosenRider.name;
        }
      }

      await updateDoc(orderRef, fieldsToUpdate);
      onLogEvent('ORDER_BYPASS_OVERRIDE', `Force modified lifecycle state of order ${selectedOrderId} to: ${overrideStatus}`);
      alert(`Order ${selectedOrderId} state overrode perfectly to '${overrideStatus}'`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveBusinessHours = () => {
    onLogEvent('BUSINESS_HOURS_UPDATED', `Overrode platform operational schedules for entire ${getActiveCity().name} fleet.`);
    alert("Business operational slots updated and broadcasted!");
  };

  if (loading) {
    return <div className="text-center py-6 text-xs text-slate-500">Loading logistic layers...</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* City zones and Business Hours row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* City boundaries and pricing zones */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
            <MapPin className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-100">Delivery Zones & Radial Coordinates</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Create form */}
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3">
              <p className="font-bold text-slate-200">Draw Radial Zone</p>
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 font-bold">Zone Label / Region Name</label>
                <input type="text" value={newZoneName} onChange={e => setNewZoneName(e.target.value)} placeholder="Indrapuri Sec-C" className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100 text-[10px]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold">Radius (KM)</label>
                  <input type="number" value={newZoneRadius} onChange={e => setNewZoneRadius(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100 text-[10px]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold">Base Surcharge (Rs.)</label>
                  <input type="number" value={newZoneCharges} onChange={e => setNewZoneCharges(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100 text-[10px]" />
                </div>
              </div>
              <button onClick={handleCreateZone} className="w-full bg-amber-500 text-slate-950 font-bold p-2 rounded hover:brightness-110 flex items-center justify-center gap-1">
                <Plus className="w-4 h-4" /> Register Zone
              </button>
            </div>

            {/* List */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {zones.map(z => (
                <div key={z.id} className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex items-center justify-between text-xs gap-3">
                  <div>
                    <p className="font-bold text-slate-200">{z.name}</p>
                    <p className="text-[10px] text-slate-400">Coverage: {z.radius} KM Radius • Charge: Rs.{z.areaCharges}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleToggleZone(z.id, !z.active)}
                      className={`p-1.5 rounded-lg border ${z.active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-850 text-slate-500 border-slate-800'}`}
                    >
                      {z.active ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </button>
                    <button 
                      onClick={() => handleDeleteZone(z.id)}
                      className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Business Opening Hours */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-100">Merchant Platform Business Hours</h3>
          </div>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 text-[11px]">
            {bizHours.map((bh, idx) => (
              <div key={bh.day} className="bg-slate-950 border border-slate-850 p-2 rounded-xl flex items-center justify-between gap-3">
                <span className="font-bold text-slate-300 w-24">{bh.day}</span>
                <div className="flex items-center gap-2">
                  <input type="text" value={bh.open} onChange={e => {
                    const next = [...bizHours];
                    next[idx].open = e.target.value;
                    setBizHours(next);
                  }} className="bg-slate-900 border border-slate-800 text-slate-100 p-1 w-12 text-center rounded font-mono text-[10px]" />
                  <span className="text-slate-500">to</span>
                  <input type="text" value={bh.close} onChange={e => {
                    const next = [...bizHours];
                    next[idx].close = e.target.value;
                    setBizHours(next);
                  }} className="bg-slate-900 border border-slate-800 text-slate-100 p-1 w-12 text-center rounded font-mono text-[10px]" />
                </div>
                <button 
                  onClick={() => {
                    const next = [...bizHours];
                    next[idx].status = bh.status === 'open' ? 'closed' : 'open';
                    setBizHours(next);
                  }}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${bh.status === 'open' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}
                >
                  {bh.status}
                </button>
              </div>
            ))}
          </div>
          <button onClick={handleSaveBusinessHours} className="w-full bg-slate-950 hover:bg-slate-850 border border-slate-850 text-slate-300 font-bold py-2 rounded-xl transition cursor-pointer">
            Publish Operational Schedules
          </button>
        </div>

      </div>

      {/* Culinary Category & Product master listing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Category manager */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
            <Percent className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-100">Global Categories master</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex gap-2">
              <input type="text" value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="E.g., Beverages" className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-slate-100" />
              <button onClick={handleAddCategory} className="bg-indigo-600 hover:bg-indigo-700 text-slate-100 font-bold p-2 px-3 rounded flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 max-h-[220px] overflow-y-auto pr-1">
              {categories.map(c => (
                <span key={c} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950 border border-slate-850 text-slate-300 text-[10px]">
                  <span>{c}</span>
                  <button onClick={() => handleDeleteCategory(c)} className="text-rose-400 hover:text-rose-300 font-bold">✕</button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Menu products item master listing */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
            <Utensils className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-100">Dish Catalog & Product Master Controls</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            
            {/* Create form */}
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3 h-fit">
              <p className="font-bold text-slate-200">Register Culinary Product</p>
              
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 font-bold">Select Store Vendor</label>
                <select value={selectedRestId} onChange={e => setSelectedRestId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2">
                  {restaurants.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 font-bold">Dish Name</label>
                <input type="text" value={newDishName} onChange={e => setNewDishName(e.target.value)} placeholder="Tandoori Paneer Tikka" className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold">Dish Price (Rs)</label>
                  <input type="number" value={newDishPrice} onChange={e => setNewDishPrice(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold">Culinary Category</label>
                  <select value={newDishCat} onChange={e => setNewDishCat(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100 text-[10px]">
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button onClick={handleCreateDish} className="w-full bg-indigo-600 text-slate-100 font-bold p-2 rounded hover:bg-indigo-700 flex items-center justify-center gap-1">
                <Plus className="w-4 h-4" /> Create Product
              </button>
            </div>

            {/* List */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 sm:col-span-2">
              {menuItems.map(m => {
                const vendor = restaurants.find(r => r.id === m.restaurantId);
                return (
                  <div key={m.id} className="bg-slate-950 border border-slate-850 p-2.5 rounded-xl flex items-center justify-between text-xs gap-3">
                    <div>
                      <p className="font-bold text-slate-200">{m.name}</p>
                      <p className="text-[10px] text-slate-400">Rs.{m.price} • Cat: {m.category} • Store: {vendor?.name || 'Unknown'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleToggleDishAvailability(m.id, !m.isAvailable)}
                        className={`px-2 py-1 rounded text-[9px] font-bold ${m.isAvailable ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}
                      >
                        {m.isAvailable ? 'Available' : 'Sold Out'}
                      </button>
                      <button 
                        onClick={() => handleDeleteDish(m.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>

      </div>

      {/* Manual order dispatch and override controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Super Admin Order Bypass and dispatch manual assignment */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 lg:col-span-2 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
            <ShoppingBag className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-100">Manual Order Dispatch & Force Status Overrides</h3>
          </div>

          <form onSubmit={handleForceOrderUpdate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 font-bold uppercase">Select Target Order ID</label>
              <select 
                value={selectedOrderId} 
                onChange={e => {
                  setSelectedOrderId(e.target.value);
                  const ord = orders.find(o => o.id === e.target.value);
                  if (ord) {
                    setOverrideStatus(ord.status);
                    setAssignRiderId(ord.riderId || '');
                  }
                }} 
                className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-slate-100 focus:border-amber-500 outline-none font-mono"
              >
                <option value="">-- Choose Live Order --</option>
                {orders.map(o => (
                  <option key={o.id} value={o.id}>{o.id} ({o.customerName} - Rs.{o.totalAmount})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 font-bold uppercase">Force Lifecycle status</label>
              <select 
                value={overrideStatus} 
                onChange={e => setOverrideStatus(e.target.value as any)} 
                className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-slate-100 focus:border-amber-500 outline-none"
              >
                <option value="pending">Pending Drivers Accept</option>
                <option value="accepted">Accepted / Store Routing</option>
                <option value="preparing">Preparing in Kitchen</option>
                <option value="ready_for_pickup">Ready for Driver Pickup</option>
                <option value="picked_up">Picked Up / Transit</option>
                <option value="delivered">Completed / Delivered</option>
                <option value="cancelled">Cancelled (Refundable)</option>
                <option value="refunded">Refund Completed</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 font-bold uppercase">Assign Fleet Rider (Dispatch Override)</label>
              <select 
                value={assignRiderId} 
                onChange={e => setAssignRiderId(e.target.value)} 
                className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-slate-100 focus:border-amber-500 outline-none"
              >
                <option value="">-- Manual Assignment (Unassigned) --</option>
                {riders.filter(r => r.status === 'approved' && r.onlineStatus === 'online').map(r => (
                  <option key={r.id} value={r.id}>{r.name} (Duty: {r.dutyStatus})</option>
                ))}
              </select>
            </div>

            <button 
              type="submit" 
              disabled={!selectedOrderId}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-slate-100 font-bold py-3.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1 sm:col-span-3"
            >
              <Truck className="w-4 h-4" /> Apply Override & Dispatch Instruction
            </button>
          </form>
        </div>

        {/* Individual restaurant commission adjust list */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
            <Percent className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-100">Individual commission Overrides</h3>
          </div>

          <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 text-xs">
            {restaurants.map(r => (
              <div key={r.id} className="bg-slate-950 border border-slate-850 p-2.5 rounded-xl flex items-center justify-between gap-3">
                <span className="font-bold text-slate-300 truncate max-w-[120px]">{r.name}</span>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    value={r.commissionPercentage} 
                    onChange={e => handleUpdateStoreCommission(r.id, Number(e.target.value))} 
                    className="bg-slate-900 border border-slate-800 text-slate-100 p-1 w-12 text-center rounded font-mono" 
                  />
                  <span className="text-[10px] text-slate-500">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
