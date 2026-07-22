import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Coupon, Zone } from '../types';
import { getActiveCity } from '../services/mapService';
import { 
  Map, 
  Percent, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Tag, 
  MapPin, 
  Calendar, 
  AlertCircle
} from 'lucide-react';

export default function MarketingZonesView() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  // Coupon form states
  const [coupCode, setCoupCode] = useState('');
  const [coupType, setCoupType] = useState<'percentage' | 'flat'>('percentage');
  const [coupVal, setCoupVal] = useState('');
  const [coupMin, setCoupMin] = useState('');
  const [coupExpiry, setCoupExpiry] = useState('');

  // Zone form states
  const [zoneName, setZoneName] = useState('');
  const [zoneRadius, setZoneRadius] = useState('');
  const [zoneMinOrder, setZoneMinOrder] = useState('');
  const [zoneMaxDist, setZoneMaxDist] = useState('');
  const [zoneCharges, setZoneCharges] = useState('');

  const fetchMarketingData = async () => {
    try {
      const coupSnap = await getDocs(collection(db, 'coupons'));
      const zoneSnap = await getDocs(collection(db, 'zones'));

      setCoupons(coupSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Coupon));
      setZones(zoneSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Zone));
    } catch (err) {
      console.error("Error fetching marketing & zones lists: ", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketingData();
  }, []);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coupCode || !coupVal) return;

    try {
      const id = "coup_" + Date.now();
      const newCoup: Coupon = {
        id,
        code: coupCode.toUpperCase(),
        discountType: coupType,
        discountValue: Number(coupVal),
        minOrderValue: Number(coupMin) || 0,
        active: true,
        expiryDate: coupExpiry || "2026-12-31"
      };

      await setDoc(doc(db, 'coupons', id), newCoup);
      setCoupons([...coupons, newCoup]);
      
      setCoupCode('');
      setCoupVal('');
      setCoupMin('');
    } catch (err) {
      console.error("Error creating coupon: ", err);
    }
  };

  const handleToggleCoupon = async (coupId: string, currentActive: boolean) => {
    try {
      await updateDoc(doc(db, 'coupons', coupId), { active: !currentActive });
      setCoupons(coupons.map(cp => cp.id === coupId ? { ...cp, active: !currentActive } : cp));
    } catch (err) {
      console.error("Error toggling coupon: ", err);
    }
  };

  const handleDeleteCoupon = async (coupId: string) => {
    try {
      await deleteDoc(doc(db, 'coupons', coupId));
      setCoupons(coupons.filter(cp => cp.id !== coupId));
    } catch (err) {
      console.error("Error deleting coupon: ", err);
    }
  };

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName || !zoneRadius) return;

    try {
      const id = "zone_" + Date.now();
      const newZone: Zone = {
        id,
        name: zoneName,
        radius: Number(zoneRadius),
        minOrderAmount: Number(zoneMinOrder) || 150,
        maxDistance: Number(zoneMaxDist) || 12,
        areaCharges: Number(zoneCharges) || 30,
        active: true
      };

      await setDoc(doc(db, 'zones', id), newZone);
      setZones([...zones, newZone]);

      setZoneName('');
      setZoneRadius('');
      setZoneMinOrder('');
      setZoneMaxDist('');
      setZoneCharges('');
    } catch (err) {
      console.error("Error creating service zone: ", err);
    }
  };

  const handleToggleZone = async (zoneId: string, currentActive: boolean) => {
    try {
      await updateDoc(doc(db, 'zones', zoneId), { active: !currentActive });
      setZones(zones.map(z => z.id === zoneId ? { ...z, active: !currentActive } : z));
    } catch (err) {
      console.error("Error toggling zone: ", err);
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    try {
      await deleteDoc(doc(db, 'zones', zoneId));
      setZones(zones.filter(z => z.id !== zoneId));
    } catch (err) {
      console.error("Error deleting zone: ", err);
    }
  };

  if (loading) {
    return <div className="text-slate-500 text-xs text-center py-12">Loading marketing and operational zones...</div>;
  }

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      <div className="border-b border-slate-800 pb-5">
        <h2 className="text-xl font-bold tracking-tight text-slate-100">Marketing & Logistics Zones</h2>
        <p className="text-slate-400 text-xs">Configure commercial coupon campaigns and map delivery operational service boundaries.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Coupon manager */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 flex flex-col">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
            <Percent className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-100 text-sm">Coupon Campaign Manager</h3>
          </div>

          <form onSubmit={handleCreateCoupon} className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3">
            <p className="text-slate-300 text-xs font-bold">Register New Coupon</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <input required type="text" placeholder="COUPONCODE" value={coupCode} onChange={e => setCoupCode(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs outline-none focus:border-amber-500 font-mono" />
              <select value={coupType} onChange={e => setCoupType(e.target.value as any)} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs outline-none focus:border-amber-500 text-slate-300">
                <option value="percentage">Percentage %</option>
                <option value="flat">Flat ₹</option>
              </select>
              <input required type="number" placeholder="Discount Val" value={coupVal} onChange={e => setCoupVal(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs outline-none focus:border-amber-500 font-mono" />
              <input type="number" placeholder="Min. Order (₹)" value={coupMin} onChange={e => setCoupMin(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs outline-none focus:border-amber-500 font-mono" />
              <input type="date" value={coupExpiry} onChange={e => setCoupExpiry(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs outline-none focus:border-amber-500 text-slate-400 font-mono" />
              <button type="submit" className="bg-amber-500 text-slate-950 font-bold text-xs py-2 rounded-xl hover:brightness-110 flex items-center justify-center gap-1 cursor-pointer">
                <Plus className="w-4 h-4" /> Save Campaign
              </button>
            </div>
          </form>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[40vh] pr-1">
            {coupons.map(cp => (
              <div key={cp.id} className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex items-center justify-between text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-200 text-sm bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/10">{cp.code}</span>
                    <span className="text-[10px] text-slate-500 font-mono">Expires: {cp.expiryDate}</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Discount: <span className="font-bold text-slate-300">{cp.discountType === 'percentage' ? `${cp.discountValue}%` : `₹${cp.discountValue}`}</span> | Min Order: ₹{cp.minOrderValue}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleToggleCoupon(cp.id, cp.active)}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer ${
                      cp.active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {cp.active ? 'Active' : 'Paused'}
                  </button>
                  <button onClick={() => handleDeleteCoupon(cp.id)} className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Zone manager */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 flex flex-col">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
            <Map className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-slate-100 text-sm">Operational Service Zones</h3>
          </div>

          <form onSubmit={handleCreateZone} className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3">
            <p className="text-slate-300 text-xs font-bold">Map New Boundary Zone</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <input required type="text" placeholder={`Zone Name (${getActiveCity().name})`} value={zoneName} onChange={e => setZoneName(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs outline-none focus:border-amber-500" />
              <input required type="number" placeholder="Radius (KM)" value={zoneRadius} onChange={e => setZoneRadius(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs outline-none focus:border-amber-500 font-mono" />
              <input type="number" placeholder="Area Fee (₹)" value={zoneCharges} onChange={e => setZoneCharges(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs outline-none focus:border-amber-500 font-mono" />
              <input type="number" placeholder="Min. Order (₹)" value={zoneMinOrder} onChange={e => setZoneMinOrder(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs outline-none focus:border-amber-500 font-mono" />
              <input type="number" placeholder="Max Dist (KM)" value={zoneMaxDist} onChange={e => setZoneMaxDist(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs outline-none focus:border-amber-500 font-mono" />
              <button type="submit" className="bg-indigo-600 text-slate-100 font-bold text-xs py-2 rounded-xl hover:brightness-110 flex items-center justify-center gap-1 cursor-pointer">
                <Plus className="w-4 h-4" /> Map Boundary
              </button>
            </div>
          </form>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[40vh] pr-1">
            {zones.map(z => (
              <div key={z.id} className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex items-center justify-between text-xs">
                <div className="space-y-1">
                  <p className="font-bold text-slate-200 text-sm">{z.name}</p>
                  <p className="text-slate-400 text-[11px]">
                    Radius: <span className="text-slate-300 font-bold font-mono">{z.radius} KM</span> | Base Area Fee: ₹{z.areaCharges} | Max Distance: {z.maxDistance} KM
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleToggleZone(z.id, z.active)}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer ${
                      z.active ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {z.active ? 'Active' : 'Offline'}
                  </button>
                  <button onClick={() => handleDeleteZone(z.id)} className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
