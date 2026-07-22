import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { SystemSettings } from '../types';
import { getActiveCity } from '../services/mapService';
import { 
  Percent, 
  Bike, 
  Store, 
  CloudRain, 
  Moon, 
  Zap, 
  Gift, 
  Save, 
  HelpCircle,
  TrendingUp,
  AlertCircle,
  Settings
} from 'lucide-react';

export default function DeliveryCommissionsView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  // Field states
  const [baseCharge, setBaseCharge] = useState('');
  const [perKmCharge, setPerKmCharge] = useState('');
  const [minOrderCharge, setMinOrderCharge] = useState('');
  const [peakCharge, setPeakCharge] = useState('');
  const [nightCharge, setNightCharge] = useState('');
  const [rainCharge, setRainCharge] = useState('');
  const [festivalCharge, setFestivalCharge] = useState('');
  const [freeDeliveryMin, setFreeDeliveryMin] = useState('');
  const [restComm, setRestComm] = useState('');
  const [riderComm, setRiderComm] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'system_settings', 'global');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data() as SystemSettings;
          setSettings(data);
          
          setBaseCharge(String(data.baseCharge));
          setPerKmCharge(String(data.perKmCharge));
          setMinOrderCharge(String(data.minOrderCharge));
          setPeakCharge(String(data.peakCharge));
          setNightCharge(String(data.nightCharge));
          setRainCharge(String(data.rainCharge));
          setFestivalCharge(String(data.festivalCharge));
          setFreeDeliveryMin(String(data.freeDeliveryMinAmount));
          setRestComm(String(data.restaurantCommissionPct));
          setRiderComm(String(data.riderCommissionPct));
        }
      } catch (err) {
        console.error("Error fetching system settings: ", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const docRef = doc(db, 'system_settings', 'global');
      const updatedFields = {
        baseCharge: Number(baseCharge),
        perKmCharge: Number(perKmCharge),
        minOrderCharge: Number(minOrderCharge),
        peakCharge: Number(peakCharge),
        nightCharge: Number(nightCharge),
        rainCharge: Number(rainCharge),
        festivalCharge: Number(festivalCharge),
        freeDeliveryMinAmount: Number(freeDeliveryMin),
        restaurantCommissionPct: Number(restComm),
        riderCommissionPct: Number(riderComm)
      };

      await updateDoc(docRef, updatedFields);
      if (settings) {
        setSettings({ ...settings, ...updatedFields });
      }
      alert(`Ting Tong ${getActiveCity().name} billing parameters updated securely!`);
    } catch (err) {
      console.error("Error saving global billing configurations: ", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-slate-500 text-xs text-center py-12">Loading global billing matrices...</div>;
  }

  return (
    <form onSubmit={handleSaveSettings} className="space-y-6 text-slate-100 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100">Billing & Commission Rules</h2>
          <p className="text-slate-400 text-xs">Tune distance charges, weather surcharges, partner commissions, and free delivery lines.</p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-amber-500 text-slate-950 px-5 py-2.5 rounded-xl text-xs font-bold hover:brightness-110 flex items-center gap-2 self-start disabled:opacity-50 transition cursor-pointer"
        >
          <Save className="w-4 h-4" /> {saving ? 'Applying...' : 'Save Parameters'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Logistics Charges Configuration Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
            <Settings className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-100 text-sm">Delivery & Surcharge Parameters</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Base Charge (₹)</label>
              <input type="number" value={baseCharge} onChange={e => setBaseCharge(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:border-amber-500 outline-none font-mono" />
              <p className="text-[10px] text-slate-500">First 2 kilometers logistics baseline.</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Per Kilometer Charge (₹)</label>
              <input type="number" value={perKmCharge} onChange={e => setPerKmCharge(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:border-amber-500 outline-none font-mono" />
              <p className="text-[10px] text-slate-500">Incremental charge for mileage distance.</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Minimum Order Limit (₹)</label>
              <input type="number" value={minOrderCharge} onChange={e => setMinOrderCharge(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:border-amber-500 outline-none font-mono" />
              <p className="text-[10px] text-slate-500">Lowest order threshold required to order.</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Free Delivery Minimum (₹)</label>
              <input type="number" value={freeDeliveryMin} onChange={e => setFreeDeliveryMin(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:border-amber-500 outline-none font-mono" />
              <p className="text-[10px] text-slate-500">Subtotal required to trigger free delivery.</p>
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-4 space-y-3">
            <p className="text-xs font-semibold text-slate-300">Live Weather & Event Surcharges (Adds to Base)</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 bg-slate-950 border border-slate-850 p-3 rounded-xl">
                <Zap className="w-8 h-8 text-amber-500" />
                <div className="flex-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Peak Hour (₹)</label>
                  <input type="number" value={peakCharge} onChange={e => setPeakCharge(e.target.value)} className="bg-transparent text-slate-100 font-mono text-xs focus:border-amber-500 outline-none w-full border-b border-slate-800 pt-0.5" />
                </div>
              </div>

              <div className="flex items-center gap-3 bg-slate-950 border border-slate-850 p-3 rounded-xl">
                <Moon className="w-8 h-8 text-sky-400" />
                <div className="flex-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Night Shift (₹)</label>
                  <input type="number" value={nightCharge} onChange={e => setNightCharge(e.target.value)} className="bg-transparent text-slate-100 font-mono text-xs focus:border-amber-500 outline-none w-full border-b border-slate-800 pt-0.5" />
                </div>
              </div>

              <div className="flex items-center gap-3 bg-slate-950 border border-slate-850 p-3 rounded-xl">
                <CloudRain className="w-8 h-8 text-cyan-400" />
                <div className="flex-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Rain Surcharge (₹)</label>
                  <input type="number" value={rainCharge} onChange={e => setRainCharge(e.target.value)} className="bg-transparent text-slate-100 font-mono text-xs focus:border-amber-500 outline-none w-full border-b border-slate-800 pt-0.5" />
                </div>
              </div>

              <div className="flex items-center gap-3 bg-slate-950 border border-slate-850 p-3 rounded-xl">
                <Gift className="w-8 h-8 text-rose-400" />
                <div className="flex-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Festivals (₹)</label>
                  <input type="number" value={festivalCharge} onChange={e => setFestivalCharge(e.target.value)} className="bg-transparent text-slate-100 font-mono text-xs focus:border-amber-500 outline-none w-full border-b border-slate-800 pt-0.5" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Commission Allocation Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
            <Percent className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-slate-100 text-sm">Partner Commission Matrix</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4 bg-slate-950 border border-slate-850 p-4 rounded-xl">
              <div className="p-3 bg-indigo-500/15 text-indigo-400 rounded-xl">
                <Store className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs font-bold uppercase text-slate-300">Default Merchant Commission (%)</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={restComm} onChange={e => setRestComm(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:border-amber-500 outline-none w-24 font-mono" />
                  <span className="text-xs text-slate-500">% of order subtotal deducted by platform</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4 bg-slate-950 border border-slate-850 p-4 rounded-xl">
              <div className="p-3 bg-emerald-500/15 text-emerald-400 rounded-xl">
                <Bike className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs font-bold uppercase text-slate-300">Default Rider Logistics Share (%)</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={riderComm} onChange={e => setRiderComm(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:border-amber-500 outline-none w-24 font-mono" />
                  <span className="text-xs text-slate-500">% of delivery fees paid directly to driver</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs leading-relaxed text-slate-400">
              <p className="font-semibold text-slate-200">Commercial Audit Compliance Note</p>
              <p>
                Adjustments made to commission parameters apply to newly registered orders. Outstanding and actively preparing orders preserve their negotiated platform-split parameters. Referrals are settled in direct reward bonuses.
              </p>
            </div>
          </div>
        </div>

      </div>
    </form>
  );
}
