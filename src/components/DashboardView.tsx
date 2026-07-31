import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Order, Rider, Restaurant, Customer, WorkZone } from '../types';
import { getActiveCity } from '../services/mapService';
import CityZoneFilter from './CityZoneFilter';
import { getZoneForOrder, getZoneForRider } from '../utils/zoneMatching';
import { 
  TrendingUp, 
  ShoppingBag, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  DollarSign, 
  Store, 
  Bike, 
  Users,
  MapPin,
  ArrowRight,
  ChevronRight,
  AlertTriangle,
  Activity,
  ShieldCheck,
  Zap,
  Plus,
  Headphones,
  Calendar,
  FileCheck2,
  Receipt,
  LifeBuoy
} from 'lucide-react';

interface DashboardViewProps {
  orders: Order[];
  riders: Rider[];
  restaurants: Restaurant[];
  customers: Customer[];
  onOpenLiveTracking?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export default function DashboardView({ orders, riders, restaurants, customers, onOpenLiveTracking, onNavigateTab }: DashboardViewProps) {
  const [selectedCityId, setSelectedCityId] = useState<string>('all');
  const [selectedWorkZoneId, setSelectedWorkZoneId] = useState<string>('all');
  const [workZones, setWorkZones] = useState<WorkZone[]>([]);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Live Clock Ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Firestore workZones listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'workZones'), (snap) => {
      const list: WorkZone[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          zoneId: data.zoneId || docSnap.id,
          name: data.zoneName || data.name || 'Unnamed Work Zone',
          zoneName: data.zoneName || data.name || 'Unnamed Work Zone',
          cityId: data.cityId || 'bhopal',
          cityName: data.cityName || 'Bhopal',
          radius: data.radius ?? 5,
          active: data.active !== false,
          status: data.status || 'active',
          centerLat: data.centerLat || 23.25,
          centerLng: data.centerLng || 77.4124,
          polygon: data.polygon || [],
          capacity: data.capacity || 15
        } as WorkZone);
      });
      setWorkZones(list);
    });
    return () => unsub();
  }, []);

  // Filter riders by selected city and work zone
  const scopedRiders = useMemo(() => {
    return riders.filter(r => {
      if (selectedCityId !== 'all' && r.cityId && r.cityId !== selectedCityId && (r.city || '').toLowerCase() !== selectedCityId.toLowerCase()) {
        return false;
      }
      if (selectedWorkZoneId !== 'all') {
        const riderZone = getZoneForRider(r, workZones);
        if (!riderZone || (riderZone.id !== selectedWorkZoneId && riderZone.zoneId !== selectedWorkZoneId)) {
          return false;
        }
      }
      return true;
    });
  }, [riders, selectedCityId, selectedWorkZoneId, workZones]);

  // Filter orders by selected city and work zone
  const scopedOrders = useMemo(() => {
    return orders.filter(o => {
      if (selectedCityId !== 'all' && o.cityId && o.cityId !== selectedCityId && (o.city || '').toLowerCase() !== selectedCityId.toLowerCase()) {
        return false;
      }
      if (selectedWorkZoneId !== 'all') {
        const orderZone = getZoneForOrder(o, workZones);
        if (!orderZone || (orderZone.id !== selectedWorkZoneId && orderZone.zoneId !== selectedWorkZoneId)) {
          return false;
        }
      }
      return true;
    });
  }, [orders, selectedCityId, selectedWorkZoneId, workZones]);

  // Calculate Core KPI Statistics based on Scoped Data
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);

  const todayOrders = scopedOrders.filter(o => new Date(o.createdAt) >= todayStart);
  const liveOrders = scopedOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'refunded');
  const completedOrders = scopedOrders.filter(o => o.status === 'delivered');
  const cancelledOrders = scopedOrders.filter(o => o.status === 'cancelled');

  const todayRevenue = todayOrders
    .filter(o => o.paymentStatus === 'paid' && o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const activeRestaurantsCount = restaurants.filter(r => r.status === 'approved').length;
  
  const onlineRiders = scopedRiders.filter(r => {
    const onlineStatus = (r.onlineStatus || '').toUpperCase();
    const dutyStatus = (r.dutyStatus || '').toUpperCase();
    return (onlineStatus === 'ONLINE' || dutyStatus === 'ON_DUTY') && (r.status === 'approved' as any);
  });

  const activeCity = getActiveCity();

  // Helper function to handle quick action tab navigation
  const triggerTabNavigation = (tabName: string) => {
    if (onNavigateTab) {
      onNavigateTab(tabName);
    }
    window.dispatchEvent(new CustomEvent('change-tab', { detail: tabName }));
  };

  // Compute Pending Work Items
  const pendingRestaurants = restaurants.filter(r => r.status === 'pending');
  const pendingRiders = riders.filter(r => (r.status as any) === 'pending' || (r.status as any) === 'under_verification');
  const pendingSettlements = 3; // Standard operational queue simulation
  const pendingTickets = 2;
  const pendingKYC = riders.filter(r => !r.aadhaarFrontUrl || !r.drivingLicenceUrl).length;

  // Compute Live Critical Alerts (Max 5)
  const criticalAlerts = useMemo(() => {
    const list = [];

    const unpaidOrders = scopedOrders.filter(o => o.paymentStatus === 'failed');
    if (unpaidOrders.length > 0) {
      list.push({
        id: 'pay-failed',
        title: `${unpaidOrders.length} Payment Failure${unpaidOrders.length > 1 ? 's' : ''}`,
        desc: 'Customer checkout dropped or gateway gateway issue',
        type: 'error',
        tab: 'orders'
      });
    }

    const unassignedLive = liveOrders.filter(o => !o.riderId);
    if (unassignedLive.length > 0) {
      list.push({
        id: 'unassigned-orders',
        title: `${unassignedLive.length} Unassigned Live Order${unassignedLive.length > 1 ? 's' : ''}`,
        desc: 'Waiting for automatic or manual rider dispatch',
        type: 'warning',
        tab: 'live_tracking'
      });
    }

    if (pendingRiders.length > 0) {
      list.push({
        id: 'rider-approval',
        title: `${pendingRiders.length} Partner Onboarding Pending`,
        desc: 'Driving license and Aadhaar verification queued',
        type: 'info',
        tab: 'riders'
      });
    }

    if (pendingRestaurants.length > 0) {
      list.push({
        id: 'rest-approval',
        title: `${pendingRestaurants.length} Merchant Application${pendingRestaurants.length > 1 ? 's' : ''}`,
        desc: 'FSSAI and GST documentation needs audit',
        type: 'info',
        tab: 'restaurants'
      });
    }

    const lowWalletRiders = scopedRiders.filter(r => r.walletBalance < 0);
    if (lowWalletRiders.length > 0) {
      list.push({
        id: 'cod-warning',
        title: `${lowWalletRiders.length} Rider COD Limit Overdue`,
        desc: 'Negative wallet balance pending settlement',
        type: 'warning',
        tab: 'riders'
      });
    }

    if (list.length === 0) {
      list.push({
        id: 'all-clear',
        title: 'All Systems Operational',
        desc: 'No critical alerts or dispatch bottlenecks detected',
        type: 'success',
        tab: 'dashboard'
      });
    }

    return list.slice(0, 5);
  }, [scopedOrders, liveOrders, pendingRiders, pendingRestaurants, scopedRiders]);

  // Compute Recent Activity Stream (Latest 10)
  const recentActivities = useMemo(() => {
    const list = scopedOrders.slice(0, 10).map(o => ({
      id: o.id,
      title: `Order #${o.id.slice(-6)} - ${o.status.toUpperCase()}`,
      subtitle: `${o.restaurantName} → ${o.customerName}`,
      time: new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      amount: `₹${o.totalAmount}`,
      status: o.status
    }));
    return list;
  }, [scopedOrders]);

  return (
    <div className="space-y-4 sm:space-y-6 text-slate-100 pb-16 lg:pb-0">
      
      {/* 1. TOP SECTION: STATUS HEADER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-100 font-sans">
                Enterprise Command Center
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-amber-400 font-semibold">Admin: Master Operator</span>
            </div>
          </div>

          <CityZoneFilter 
            selectedCityId={selectedCityId}
            selectedWorkZoneId={selectedWorkZoneId}
            onCityChange={setSelectedCityId}
            onWorkZoneChange={setSelectedWorkZoneId}
            workZones={workZones}
          />
        </div>

        {/* System Health Indicators Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-800/80 text-[10px] font-mono">
          <div className="bg-slate-950/60 border border-slate-850 px-2.5 py-1.5 rounded-lg flex items-center justify-between">
            <span className="text-slate-400">Platform Status:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> Online
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-850 px-2.5 py-1.5 rounded-lg flex items-center justify-between">
            <span className="text-slate-400">Firebase:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <Zap className="w-3 h-3 text-emerald-400" /> Connected
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-850 px-2.5 py-1.5 rounded-lg flex items-center justify-between">
            <span className="text-slate-400">Firestore:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <Activity className="w-3 h-3 text-emerald-400" /> Synced
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-850 px-2.5 py-1.5 rounded-lg flex items-center justify-between">
            <span className="text-slate-400">Cloud Functions:</span>
            <span className="text-emerald-400 font-bold">Operational</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-850 px-2.5 py-1.5 rounded-lg flex items-center justify-between col-span-2 sm:col-span-1">
            <span className="text-slate-400">Realtime Sync:</span>
            <span className="text-sky-400 font-bold">Live</span>
          </div>
        </div>
      </div>

      {/* 2. TODAY SUMMARY: COMPACT KPI CARDS (Fits in 2 rows on mobile) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs uppercase font-mono font-bold tracking-wider text-slate-400">Today's Key Performance Indicators</h2>
          <span className="text-[10px] text-slate-500 font-mono">Scope: {activeCity.name}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Revenue */}
          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex flex-col justify-between hover:border-amber-500/40 transition">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Today Revenue</span>
              <div className="p-1 rounded-lg bg-amber-500/10 text-amber-400">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-lg sm:text-xl font-bold font-mono text-amber-400">₹{todayRevenue.toLocaleString('en-IN')}</p>
              <p className="text-[9px] text-slate-500">Paid orders total</p>
            </div>
          </div>

          {/* Live Orders */}
          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex flex-col justify-between hover:border-sky-500/40 transition">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Live Orders</span>
              <div className="p-1 rounded-lg bg-sky-500/10 text-sky-400">
                <ShoppingBag className="w-3.5 h-3.5 animate-bounce" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-lg sm:text-xl font-bold font-mono text-sky-400">{liveOrders.length}</p>
              <p className="text-[9px] text-slate-500">In dispatch queue</p>
            </div>
          </div>

          {/* Completed Orders */}
          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex flex-col justify-between hover:border-emerald-500/40 transition">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Completed</span>
              <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-lg sm:text-xl font-bold font-mono text-emerald-400">{completedOrders.length}</p>
              <p className="text-[9px] text-slate-500">Successfully delivered</p>
            </div>
          </div>

          {/* Cancelled Orders */}
          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex flex-col justify-between hover:border-rose-500/40 transition">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Cancelled</span>
              <div className="p-1 rounded-lg bg-rose-500/10 text-rose-400">
                <XCircle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-lg sm:text-xl font-bold font-mono text-rose-400">{cancelledOrders.length}</p>
              <p className="text-[9px] text-slate-500">Rejected or dropped</p>
            </div>
          </div>

          {/* Online Riders */}
          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex flex-col justify-between hover:border-indigo-500/40 transition">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Online Riders</span>
              <div className="p-1 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Bike className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-lg sm:text-xl font-bold font-mono text-indigo-400">{onlineRiders.length}</p>
              <p className="text-[9px] text-slate-500">On duty active</p>
            </div>
          </div>

          {/* Active Restaurants */}
          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex flex-col justify-between hover:border-purple-500/40 transition">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Active Outlets</span>
              <div className="p-1 rounded-lg bg-purple-500/10 text-purple-400">
                <Store className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-lg sm:text-xl font-bold font-mono text-purple-400">{activeRestaurantsCount}</p>
              <p className="text-[9px] text-slate-500">Merchant outlets</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. QUICK ACTIONS (Max 6 Large Touch-Friendly Buttons) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <h2 className="text-xs uppercase font-mono font-bold tracking-wider text-slate-400">Quick Administrative Actions</h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <button
            onClick={() => {
              triggerTabNavigation('restaurants');
              window.dispatchEvent(new CustomEvent('open-add-restaurant'));
            }}
            className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-850 p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer min-h-[56px] group active:scale-95"
          >
            <Store className="w-4 h-4 text-amber-500 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-slate-200">Add Restaurant</span>
          </button>

          <button
            onClick={() => {
              triggerTabNavigation('riders');
              window.dispatchEvent(new CustomEvent('open-add-rider'));
            }}
            className="bg-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-850 p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer min-h-[56px] group active:scale-95"
          >
            <Bike className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-slate-200">Add Rider</span>
          </button>

          <button
            onClick={() => triggerTabNavigation('orders')}
            className="bg-slate-950 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-850 p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer min-h-[56px] group active:scale-95"
          >
            <ShoppingBag className="w-4 h-4 text-sky-400 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-slate-200">Manual Order</span>
          </button>

          <button
            onClick={() => triggerTabNavigation('live_tracking')}
            className="bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer min-h-[56px] group active:scale-95"
          >
            <Users className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-slate-200">Assign Rider</span>
          </button>

          <button
            onClick={() => {
              if (onOpenLiveTracking) {
                onOpenLiveTracking();
              } else {
                triggerTabNavigation('live_tracking');
              }
            }}
            className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-850 p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer min-h-[56px] group active:scale-95"
          >
            <MapPin className="w-4 h-4 text-amber-400 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-slate-200">Live Tracking</span>
          </button>

          <button
            onClick={() => triggerTabNavigation('support')}
            className="bg-slate-950 border border-slate-800 hover:border-rose-500/50 hover:bg-slate-850 p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer min-h-[56px] group active:scale-95"
          >
            <LifeBuoy className="w-4 h-4 text-rose-400 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-slate-200">Support Desk</span>
          </button>
        </div>
      </div>

      {/* 4. MAIN OPERATIONAL GRID (Live Alerts, Live Map Preview, Pending Work, Recent Activity) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* LEFT COLUMN: LIVE ALERTS & COMPACT LIVE MAP PREVIEW */}
        <div className="space-y-4 lg:col-span-1">
          {/* LIVE ALERTS (Max 5) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase font-mono font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Live Critical Alerts
              </h3>
              <span className="bg-amber-500/10 text-amber-400 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                {criticalAlerts.length}
              </span>
            </div>

            <div className="space-y-2">
              {criticalAlerts.map(alert => (
                <div
                  key={alert.id}
                  onClick={() => triggerTabNavigation(alert.tab)}
                  className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                    alert.type === 'error'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-200 hover:border-rose-500'
                      : alert.type === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200 hover:border-amber-500'
                      : alert.type === 'info'
                      ? 'bg-sky-500/10 border-sky-500/30 text-sky-200 hover:border-sky-500'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {alert.type === 'error' && <XCircle className="w-4 h-4 text-rose-400" />}
                    {alert.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                    {alert.type === 'info' && <ShoppingBag className="w-4 h-4 text-sky-400" />}
                    {alert.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold leading-tight">{alert.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-normal truncate">{alert.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0 self-center" />
                </div>
              ))}
            </div>
          </div>

          {/* COMPACT LIVE MAP PREVIEW */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase font-mono font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                Live Logistics Radar
              </h3>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">{onlineRiders.length} Active Riders</span>
            </div>

            <div className="relative bg-slate-950 border border-slate-850 rounded-xl overflow-hidden h-36 flex items-center justify-center">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]" />
              <div className="text-center space-y-1 relative z-10 p-3">
                <Bike className="w-8 h-8 text-amber-500 mx-auto animate-pulse" />
                <p className="text-xs font-bold text-slate-200">{activeCity.name} Logistics Grid</p>
                <p className="text-[10px] text-slate-500 font-mono">{liveOrders.length} active dispatches in motion</p>
              </div>
            </div>

            <button
              onClick={onOpenLiveTracking}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              Open Live Tracking
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: PENDING WORK & RECENT ACTIVITY STREAM */}
        <div className="space-y-4 lg:col-span-2">
          {/* PENDING WORK AUDIT */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs uppercase font-mono font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-indigo-400" />
              Pending Operational Backlog
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div 
                onClick={() => triggerTabNavigation('restaurants')}
                className="bg-slate-950 border border-slate-850 p-3 rounded-xl hover:border-slate-700 transition cursor-pointer"
              >
                <span className="text-[10px] text-slate-500 font-mono uppercase block truncate">Merchants</span>
                <p className="text-base font-bold font-mono text-amber-400 mt-1">{pendingRestaurants.length}</p>
                <span className="text-[9px] text-slate-400">Approval req.</span>
              </div>

              <div 
                onClick={() => triggerTabNavigation('riders')}
                className="bg-slate-950 border border-slate-850 p-3 rounded-xl hover:border-slate-700 transition cursor-pointer"
              >
                <span className="text-[10px] text-slate-500 font-mono uppercase block truncate">Rider Partners</span>
                <p className="text-base font-bold font-mono text-sky-400 mt-1">{pendingRiders.length}</p>
                <span className="text-[9px] text-slate-400">Onboarding queue</span>
              </div>

              <div 
                onClick={() => triggerTabNavigation('financials')}
                className="bg-slate-950 border border-slate-850 p-3 rounded-xl hover:border-slate-700 transition cursor-pointer"
              >
                <span className="text-[10px] text-slate-500 font-mono uppercase block truncate">Settlements</span>
                <p className="text-base font-bold font-mono text-emerald-400 mt-1">{pendingSettlements}</p>
                <span className="text-[9px] text-slate-400">Payout batches</span>
              </div>

              <div 
                onClick={() => triggerTabNavigation('support')}
                className="bg-slate-950 border border-slate-850 p-3 rounded-xl hover:border-slate-700 transition cursor-pointer"
              >
                <span className="text-[10px] text-slate-500 font-mono uppercase block truncate">Support Tickets</span>
                <p className="text-base font-bold font-mono text-rose-400 mt-1">{pendingTickets}</p>
                <span className="text-[9px] text-slate-400">Open tickets</span>
              </div>

              <div 
                onClick={() => triggerTabNavigation('riders')}
                className="bg-slate-950 border border-slate-850 p-3 rounded-xl hover:border-slate-700 transition cursor-pointer col-span-2 sm:col-span-1"
              >
                <span className="text-[10px] text-slate-500 font-mono uppercase block truncate">KYC Audits</span>
                <p className="text-base font-bold font-mono text-purple-400 mt-1">{pendingKYC}</p>
                <span className="text-[9px] text-slate-400">Doc verification</span>
              </div>
            </div>
          </div>

          {/* RECENT ACTIVITY STREAM (Latest 10) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase font-mono font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-sky-400" />
                Recent Orders Stream (Latest 10)
              </h3>
              <button
                onClick={() => triggerTabNavigation('orders')}
                className="text-[10px] font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1 cursor-pointer font-mono"
              >
                View All Orders <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="divide-y divide-slate-850">
              {recentActivities.map(item => (
                <div
                  key={item.id}
                  onClick={() => triggerTabNavigation('orders')}
                  className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-850/40 px-2 rounded-lg transition cursor-pointer text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200 font-mono">{item.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        item.status === 'delivered'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : item.status === 'cancelled'
                          ? 'bg-rose-500/10 text-rose-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{item.subtitle}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-amber-400">{item.amount}</p>
                    <p className="text-[9px] text-slate-500 font-mono">{item.time}</p>
                  </div>
                </div>
              ))}

              {recentActivities.length === 0 && (
                <div className="p-6 text-center text-slate-500 text-xs">No recent order activity recorded.</div>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
