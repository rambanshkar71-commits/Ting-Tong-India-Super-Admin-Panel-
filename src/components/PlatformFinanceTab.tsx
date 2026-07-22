import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { Coupon, SystemSettings, Restaurant, Rider, Order } from '../types';
import { getActiveCity } from '../services/mapService';
import { 
  Settings, 
  Percent, 
  CreditCard, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Tag, 
  Image as ImageIcon, 
  Smartphone, 
  Mail, 
  Wallet, 
  DollarSign, 
  Coins 
} from 'lucide-react';

interface PlatformFinanceTabProps {
  restaurants: Restaurant[];
  riders: Rider[];
  orders: Order[];
  onLogEvent: (action: string, details: string) => void;
}

interface Banner {
  id: string;
  imageUrl: string;
  redirectUrl: string;
  weight: number;
  active: boolean;
}

export default function PlatformFinanceTab({ restaurants, riders, orders, onLogEvent }: PlatformFinanceTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);

  // Payout logs ledger state
  const [payouts, setPayouts] = useState<any[]>([
    { id: 'pay_001', entityName: 'Manohar Dairy', type: 'restaurant', amount: 12500, date: '2026-07-01', status: 'completed', upi: 'manohar@okaxis' },
    { id: 'pay_002', entityName: 'Rahul Sharma', type: 'rider', amount: 3200, date: '2026-07-03', status: 'completed', upi: 'rahulrider@okaxis' },
    { id: 'pay_003', entityName: 'Sagar Gaire', type: 'restaurant', amount: 8400, date: '2026-07-05', status: 'pending', upi: 'sagargaire@okhdfcbank' }
  ]);

  // Master platform settings values
  const [companyName, setCompanyName] = useState('TING TONG BHOPAL');
  const [supportPhone, setSupportPhone] = useState('+91 755 234 5678');
  const [supportEmail, setSupportEmail] = useState('support@tingtongbhopal.com');
  const [baseCharge, setBaseCharge] = useState('30');
  const [perKmCharge, setPerKmCharge] = useState('10');
  const [minOrderCharge, setMinOrderCharge] = useState('15');
  const [peakCharge, setPeakCharge] = useState('15');
  const [nightCharge, setNightCharge] = useState('20');
  const [rainCharge, setRainCharge] = useState('25');
  const [festivalCharge, setFestivalCharge] = useState('15');
  const [freeMin, setFreeMin] = useState('499');
  const [commPct, setCommPct] = useState('15');
  const [riderPct, setRiderPct] = useState('80');
  const [gstNo, setGstNo] = useState('23AABCT9384C1Z5');
  const [fssaiNo, setFssaiNo] = useState('12421008000293');
  const [address, setAddress] = useState(`Corporate Headquarters, Hub Station, ${getActiveCity().name}, India`);

  // Gateway Keys
  const [razorpayEnabled, setRazorpayEnabled] = useState(true);
  const [codEnabled, setCodEnabled] = useState(true);
  const [sandboxMode, setSandboxMode] = useState(true);
  const [merchantId, setMerchantId] = useState(`rzp_mid_${getActiveCity().id}884`);
  const [apiKey, setApiKey] = useState(`rzp_test_${getActiveCity().id}Key2026_xYz92L`);

  // SMTP & Messaging
  const [twilioSid, setTwilioSid] = useState(`AC884${getActiveCity().id}TwilioSidKey`);
  const [twilioAuth, setTwilioAuth] = useState(`auth_token_9938${getActiveCity().id}`);
  const [smtpHost, setSmtpHost] = useState(`mail.tingtong${getActiveCity().id}.com`);
  const [smtpUser, setSmtpUser] = useState(`alert@tingtong${getActiveCity().id}.com`);

  // Coupon Builder states
  const [newCode, setNewCode] = useState('');
  const [newType, setNewType] = useState<'percentage' | 'flat'>('percentage');
  const [newValue, setNewValue] = useState('15');
  const [newMin, setNewMin] = useState('200');
  const [newExpiry, setNewExpiry] = useState('2026-12-31');

  // Banner Builder states
  const [newBannerUrl, setNewBannerUrl] = useState('');
  const [newBannerRedirect, setNewBannerRedirect] = useState('');
  const [newBannerWeight, setNewBannerWeight] = useState('1');

  useEffect(() => {
    const loadPlatformAndCoupons = async () => {
      try {
        const docSnap = await getDocs(collection(db, 'coupons'));
        const list = docSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Coupon);
        setCoupons(list);

        const bannerSnap = await getDocs(collection(db, 'banners'));
        if (!bannerSnap.empty) {
          setBanners(bannerSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Banner));
        } else {
          setBanners([
            { id: 'b1', imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=800&auto=format&fit=crop', redirectUrl: '/rest_001', weight: 1, active: true },
            { id: 'b2', imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=800&auto=format&fit=crop', redirectUrl: '/rest_002', weight: 2, active: true }
          ]);
        }

        const globalDoc = await getDocs(collection(db, 'system_settings'));
        const globalRef = globalDoc.docs.find(d => d.id === 'global');
        if (globalRef) {
          const data = globalRef.data() as SystemSettings;
          setCompanyName(data.companyName);
          setSupportPhone(data.supportPhone);
          setSupportEmail(data.supportEmail);
          setBaseCharge(String(data.baseCharge));
          setPerKmCharge(String(data.perKmCharge));
          setMinOrderCharge(String(data.minOrderCharge));
          setPeakCharge(String(data.peakCharge));
          setNightCharge(String(data.nightCharge));
          setRainCharge(String(data.rainCharge));
          setFestivalCharge(String(data.festivalCharge));
          setFreeMin(String(data.freeDeliveryMinAmount));
          setCommPct(String(data.restaurantCommissionPct));
          setRiderPct(String(data.riderCommissionPct));
          setGstNo(data.gstNo);
          setFssaiNo(data.fssaiNo);
          setAddress(data.address);
        }
      } catch (err) {
        console.error("Error loading configurations:", err);
      } finally {
        setLoading(false);
      }
    };
    loadPlatformAndCoupons();
  }, []);

  const handleSaveGlobalParams = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const globalRef = doc(db, 'system_settings', 'global');
      await setDoc(globalRef, {
        companyName,
        supportPhone,
        supportEmail,
        baseCharge: Number(baseCharge),
        perKmCharge: Number(perKmCharge),
        minOrderCharge: Number(minOrderCharge),
        peakCharge: Number(peakCharge),
        nightCharge: Number(nightCharge),
        rainCharge: Number(rainCharge),
        festivalCharge: Number(festivalCharge),
        freeDeliveryMinAmount: Number(freeMin),
        restaurantCommissionPct: Number(commPct),
        riderCommissionPct: Number(riderPct),
        gstNo,
        fssaiNo,
        address
      }, { merge: true });

      onLogEvent('GLOBAL_PARAMS_SAVED', `Updated global pricing parameters, commissions and taxes.`);
      alert("Master platform settings updated in Firestore!");
    } catch (err) {
      console.error(err);
      alert("Error saving settings attributes.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGateways = async () => {
    onLogEvent('GATEWAY_CONFIG_UPDATED', `Configured Razorpay credentials and sandbox status.`);
    alert("Razorpay and cash payment gateway properties locked in!");
  };

  const handleSaveSMTP = async () => {
    onLogEvent('COMMUNICATION_SETUP_SAVED', `Twilio API bindings and SMTP relay addresses customized.`);
    alert("Notification transport layers configured successfully!");
  };

  // Coupons
  const handleCreateCoupon = async () => {
    if (!newCode) return;
    try {
      const id = "coup_" + Date.now();
      const coup: Coupon = {
        id,
        code: newCode.toUpperCase().trim(),
        discountType: newType,
        discountValue: Number(newValue),
        minOrderValue: Number(newMin),
        expiryDate: newExpiry,
        active: true
      };

      await setDoc(doc(db, 'coupons', id), coup);
      setCoupons([...coupons, coup]);
      onLogEvent('COUPON_CREATED', `Registered code ${coup.code} yielding ${coup.discountValue} value.`);
      setNewCode('');
      alert("Coupon created successfully in Firestore!");
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleCoupon = async (id: string, active: boolean) => {
    try {
      await updateDoc(doc(db, 'coupons', id), { active });
      setCoupons(coupons.map(c => c.id === id ? { ...c, active } : c));
      onLogEvent('COUPON_TOGGLED', `Toggled coupon ${id} active status to: ${active}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'coupons', id));
      setCoupons(coupons.filter(c => c.id !== id));
      onLogEvent('COUPON_DELETED', `Revoked coupon code node ID: ${id}`);
    } catch (err) {
      console.error(err);
    }
  };

  // Banners
  const handleAddBanner = async () => {
    if (!newBannerUrl) return;
    try {
      const id = "banner_" + Date.now();
      const ban: Banner = {
        id,
        imageUrl: newBannerUrl,
        redirectUrl: newBannerRedirect || '/',
        weight: Number(newBannerWeight),
        active: true
      };

      await setDoc(doc(db, 'banners', id), ban);
      setBanners([...banners, ban]);
      onLogEvent('BANNER_CREATED', `Registered slider banner node directing to ${ban.redirectUrl}`);
      setNewBannerUrl('');
      setNewBannerRedirect('');
      alert("Home Slider Banner added!");
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'banners', id));
      setBanners(banners.filter(b => b.id !== id));
      onLogEvent('BANNER_DELETED', `Removed promotional slide image component ID: ${id}`);
    } catch (err) {
      console.error(err);
    }
  };

  // Wallet payout
  const handlePayoutAction = (id: string, status: 'completed' | 'rejected') => {
    setPayouts(payouts.map(p => p.id === id ? { ...p, status } : p));
    const payItem = payouts.find(p => p.id === id);
    onLogEvent('WALLET_PAYOUT_SETTLED', `Processed payout settlement of Rs.${payItem?.amount} to ${payItem?.entityName} (${status})`);
    alert(`Payout request ${status} successfully!`);
  };

  if (loading) {
    return <div className="text-center py-6 text-xs text-slate-500">Loading configurations...</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Top row settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Core Settings (Base parameters) */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6 lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
            <Settings className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-100">Global Pricing Multipliers & Commissions</h3>
          </div>

          <form onSubmit={handleSaveGlobalParams} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Base Delivery Charge</label>
                <input required type="number" value={baseCharge} onChange={e => setBaseCharge(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-slate-100 focus:border-amber-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Charge per Kilometer</label>
                <input required type="number" value={perKmCharge} onChange={e => setPerKmCharge(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-slate-100 focus:border-amber-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Min Order Delivery Addon</label>
                <input required type="number" value={minOrderCharge} onChange={e => setMinOrderCharge(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-slate-100 focus:border-amber-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Free Delivery Min Amt</label>
                <input required type="number" value={freeMin} onChange={e => setFreeMin(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-slate-100 focus:border-amber-500 outline-none" />
              </div>
            </div>

            {/* Weather surges */}
            <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-4">
              <p className="font-bold text-slate-200">Surge Factor Overrides (Addons in Rs.)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Peak Hour Surge</label>
                  <input required type="number" value={peakCharge} onChange={e => setPeakCharge(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-100 focus:border-amber-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Night Delivery Surge</label>
                  <input required type="number" value={nightCharge} onChange={e => setNightCharge(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-100 focus:border-amber-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monsoon / Rain Surge</label>
                  <input required type="number" value={rainCharge} onChange={e => setRainCharge(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-100 focus:border-amber-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Holiday / Festival Surge</label>
                  <input required type="number" value={festivalCharge} onChange={e => setFestivalCharge(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-100 focus:border-amber-500 outline-none" />
                </div>
              </div>
            </div>

            {/* Commissions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Global Store Commission (%)</label>
                <div className="flex items-center gap-2">
                  <input required type="number" value={commPct} onChange={e => setCommPct(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 focus:border-amber-500 outline-none" />
                  <Percent className="w-5 h-5 text-slate-500" />
                </div>
              </div>
              <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Rider Commission Share (%)</label>
                <div className="flex items-center gap-2">
                  <input required type="number" value={riderPct} onChange={e => setRiderPct(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 focus:border-amber-500 outline-none" />
                  <Percent className="w-5 h-5 text-slate-500" />
                </div>
              </div>
            </div>

            {/* Corporate GST details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Platform Corporate GSTIN</label>
                <input required type="text" value={gstNo} onChange={e => setGstNo(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-slate-100 focus:border-amber-500 outline-none font-mono" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">FSSAI License Number</label>
                <input required type="text" value={fssaiNo} onChange={e => setFssaiNo(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-slate-100 focus:border-amber-500 outline-none font-mono" />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              {saving ? 'Applying Settings...' : 'Save Global Parameters'}
            </button>
          </form>
        </div>

        {/* Payment Gateways Config */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-5 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
            <CreditCard className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-100">Payment Gateway Integrations</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-850 rounded-xl">
              <div className="space-y-0.5">
                <p className="font-bold text-slate-200">Razorpay Gateway API</p>
                <p className="text-[10px] text-slate-500">Enable card, netbanking & wallet payments</p>
              </div>
              <input type="checkbox" checked={razorpayEnabled} onChange={() => setRazorpayEnabled(!razorpayEnabled)} className="w-4 h-4 accent-amber-500" />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-850 rounded-xl">
              <div className="space-y-0.5">
                <p className="font-bold text-slate-200">Cash On Delivery (COD)</p>
                <p className="text-[10px] text-slate-500">Allow physical cash settlements at doorsteps</p>
              </div>
              <input type="checkbox" checked={codEnabled} onChange={() => setCodEnabled(!codEnabled)} className="w-4 h-4 accent-amber-500" />
            </div>

            <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                <span className="font-bold text-slate-200">Production Mode</span>
                <button onClick={() => setSandboxMode(!sandboxMode)} className={`px-3 py-1 rounded text-[9px] font-bold ${sandboxMode ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                  {sandboxMode ? 'SANDBOX' : 'LIVE'}
                </button>
              </div>

              <div className="space-y-2">
                <div className="space-y-0.5">
                  <label className="text-[9px] text-slate-500 uppercase font-bold">Razorpay Merchant ID</label>
                  <input type="text" value={merchantId} onChange={e => setMerchantId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 font-mono text-[10px]" />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] text-slate-500 uppercase font-bold">Private API Secret Key</label>
                  <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 font-mono text-[10px]" />
                </div>
              </div>
            </div>

            <button onClick={handleSaveGateways} className="w-full bg-slate-950 border border-slate-850 text-slate-300 hover:bg-slate-850 font-bold py-3 rounded-xl transition cursor-pointer">
              Lock In Gateway Keys
            </button>
          </div>
        </div>

      </div>

      {/* Messaging / SMS integrations & Coupons tab */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Twilio SMS & SMTP Relay Configuration */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
            <Smartphone className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-100">SMS Gateways & SMTP Mail Servers</h3>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-3">
              <p className="font-bold text-slate-200 flex items-center gap-1">
                <span>Twilio SMS Service Config</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <label className="text-[9px] text-slate-500 font-bold">TWILIO Account SID</label>
                  <input type="text" value={twilioSid} onChange={e => setTwilioSid(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 font-mono text-[10px]" />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] text-slate-500 font-bold">Auth Token Auth</label>
                  <input type="password" value={twilioAuth} onChange={e => setTwilioAuth(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 font-mono text-[10px]" />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-3">
              <p className="font-bold text-slate-200 flex items-center gap-1">
                <Mail className="w-4 h-4 text-slate-400" />
                <span>SMTP Mail Relay Server</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <label className="text-[9px] text-slate-500 font-bold">SMTP Relay Host</label>
                  <input type="text" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-[10px]" />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] text-slate-500 font-bold">Default Sender Address</label>
                  <input type="text" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-[10px]" />
                </div>
              </div>
            </div>

            <button onClick={handleSaveSMTP} className="w-full bg-slate-950 hover:bg-slate-850 border border-slate-850 text-slate-300 font-bold py-3 rounded-xl transition cursor-pointer">
              Update Messaging Gateways
            </button>
          </div>
        </div>

        {/* Coupons builder */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
            <Tag className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-100">Coupon Code Management Center</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            
            {/* Form */}
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3 h-fit">
              <p className="font-bold text-slate-200">Register Promo Code</p>
              
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 font-bold">Promo Code</label>
                <input type="text" value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="TINGTONG50" className="w-full bg-slate-900 border border-slate-800 rounded p-2 outline-none uppercase font-mono" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold">Type</label>
                  <select value={newType} onChange={e => setNewType(e.target.value as any)} className="w-full bg-slate-900 border border-slate-800 rounded p-2">
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Value (Rs.)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold">Discount Value</label>
                  <input type="number" value={newValue} onChange={e => setNewValue(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold">Min Order Amt</label>
                  <input type="number" value={newMin} onChange={e => setNewMin(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold">Expiry Date</label>
                  <input type="date" value={newExpiry} onChange={e => setNewExpiry(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 font-mono text-[10px]" />
                </div>
              </div>

              <button onClick={handleCreateCoupon} className="w-full bg-amber-500 text-slate-950 font-bold p-2 rounded hover:brightness-110 flex items-center justify-center gap-1">
                <Plus className="w-4 h-4" /> Create Coupon
              </button>
            </div>

            {/* List */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {coupons.map(c => (
                <div key={c.id} className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex items-center justify-between text-xs gap-3">
                  <div className="space-y-1">
                    <span className="font-mono font-bold text-slate-100 bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/15">{c.code}</span>
                    <p className="text-[10px] text-slate-400 font-sans mt-1">
                      {c.discountType === 'percentage' ? `${c.discountValue}% Off` : `Rs.${c.discountValue} Off`} • Min: Rs.{c.minOrderValue}
                    </p>
                    <p className="text-[9px] text-slate-500 font-mono">Expires: {c.expiryDate}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleToggleCoupon(c.id, !c.active)}
                      className={`p-1.5 rounded-lg border ${c.active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}
                      title={c.active ? 'Deactivate Coupon' : 'Activate Coupon'}
                    >
                      {c.active ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </button>
                    <button 
                      onClick={() => handleDeleteCoupon(c.id)}
                      className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
                      title="Delete Coupon"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>

      {/* Slider Banner Management & Wallet Settlement ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Promo Slider Banners */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
            <ImageIcon className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-100">Slider Promotion Banners</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            
            {/* Banner form */}
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3">
              <p className="font-bold text-slate-200">Register Slider Banner</p>
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 font-bold">Image URL</label>
                <input type="text" value={newBannerUrl} onChange={e => setNewBannerUrl(e.target.value)} placeholder="https://..." className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100 text-[10px] font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold">Redirect URL / ID</label>
                  <input type="text" value={newBannerRedirect} onChange={e => setNewBannerRedirect(e.target.value)} placeholder="/rest_001" className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100 text-[10px]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold">Order Weight</label>
                  <input type="number" value={newBannerWeight} onChange={e => setNewBannerWeight(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100 text-[10px]" />
                </div>
              </div>
              <button onClick={handleAddBanner} className="w-full bg-amber-500 text-slate-950 font-bold p-2 rounded hover:brightness-110 flex items-center justify-center gap-1">
                <Plus className="w-4 h-4" /> Add Banner
              </button>
            </div>

            {/* Banner listing */}
            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
              {banners.map(b => (
                <div key={b.id} className="bg-slate-950 border border-slate-850 p-2.5 rounded-xl flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-2.5">
                    <img src={b.imageUrl} alt="Banner Preview" className="w-12 h-12 rounded object-cover border border-slate-800" />
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-slate-300 truncate max-w-[130px] font-mono">Weight: {b.weight}</p>
                      <p className="text-[9px] text-slate-500 font-sans truncate max-w-[130px]">Redirect: {b.redirectUrl}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteBanner(b.id)}
                    className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Ledger Payout Requests */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
            <Coins className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-100">Wallet Settlements & Payouts Ledger</h3>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto text-xs pr-1">
            {payouts.map(p => (
              <div key={p.id} className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-bold text-slate-200 flex items-center gap-1.5">
                    {p.entityName}
                    <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 rounded ${p.type === 'restaurant' ? 'bg-orange-500/10 text-orange-400' : 'bg-sky-500/10 text-sky-400'}`}>{p.type}</span>
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">UPI: {p.upi} • Date: {p.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-slate-200">Rs.{p.amount}</span>
                  {p.status === 'pending' ? (
                    <div className="flex gap-1.5">
                      <button 
                        onClick={() => handlePayoutAction(p.id, 'completed')}
                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold p-1 px-2.5 rounded text-[10px] cursor-pointer"
                      >
                        Settle
                      </button>
                      <button 
                        onClick={() => handlePayoutAction(p.id, 'rejected')}
                        className="bg-rose-500/20 text-rose-400 border border-rose-500/15 p-1 px-2.5 rounded text-[10px] cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  ) : (
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${p.status === 'completed' ? 'text-emerald-400' : 'text-slate-500'}`}>{p.status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
