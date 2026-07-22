import React, { useState } from 'react';
import { Order, Rider, Restaurant, Customer } from '../types';
import { getActiveCity } from '../services/mapService';
import { 
  TrendingUp, 
  ShoppingBag, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  DollarSign, 
  Percent, 
  Store, 
  Bike, 
  Users,
  MapPin,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Navigation
} from 'lucide-react';

interface DashboardViewProps {
  orders: Order[];
  riders: Rider[];
  restaurants: Restaurant[];
  customers: Customer[];
  onOpenLiveTracking?: () => void;
}

export default function DashboardView({ orders, riders, restaurants, customers, onOpenLiveTracking }: DashboardViewProps) {
  const [selectedRiderOnMap, setSelectedRiderOnMap] = useState<Rider | null>(null);

  // 1. Calculate Core Telemetry Statistics
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);

  const todayOrders = orders.filter(o => new Date(o.createdAt) >= todayStart);
  
  const liveOrders = orders.filter(o => 
    o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'refunded'
  );
  
  const completedOrders = orders.filter(o => o.status === 'delivered');
  const cancelledOrders = orders.filter(o => o.status === 'cancelled');
  const pendingOrders = orders.filter(o => o.status === 'pending');

  const todayRevenue = todayOrders
    .filter(o => o.paymentStatus === 'paid' && o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const totalPlatformCommission = orders
    .filter(o => o.paymentStatus === 'paid' && o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.platformCommission, 0);

  const totalRestaurantEarnings = orders
    .filter(o => o.paymentStatus === 'paid' && o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.restaurantEarnings, 0);

  const totalRiderEarnings = orders
    .filter(o => o.paymentStatus === 'paid' && o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.riderEarnings, 0);

  const activeCustomersCount = customers.filter(c => c.status === 'active').length;
  const activeRestaurantsCount = restaurants.filter(r => r.status === 'approved').length;
  const activeRidersCount = riders.filter(r => r.status === 'approved').length;
  
  const onlineRiders = riders.filter(r => r.onlineStatus === 'online' && r.status === 'approved');
  const offlineRiders = riders.filter(r => r.onlineStatus === 'offline' && r.status === 'approved');

  const activeCity = getActiveCity();

  // Dynamic projection bounds based on the selected active city center coordinates:
  // Plots locations onto an interactive SVG Grid (width: 500, height: 400).
  const mapWidth = 500;
  const mapHeight = 400;

  const getXY = (lat: number, lng: number) => {
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
      return { x: 0, y: 0, isValid: false };
    }
    // Mercator-like custom projection centered on the active city
    const minLat = activeCity.centerLat - 0.05;
    const maxLat = activeCity.centerLat + 0.05;
    const minLng = activeCity.centerLng - 0.05;
    const maxLng = activeCity.centerLng + 0.05;

    const x = ((lng - minLng) / (maxLng - minLng)) * mapWidth;
    const y = mapHeight - (((lat - minLat) / (maxLat - minLat)) * mapHeight); // invert Y
    return { 
      x: Math.max(10, Math.min(mapWidth - 10, x)), 
      y: Math.max(10, Math.min(mapHeight - 10, y)),
      isValid: true
    };
  };

  // Landmark centers for visual rendering, dynamically computed based on the selected city
  const landmarks = [
    { name: `${activeCity.name} Core`, lat: activeCity.centerLat, lng: activeCity.centerLng, desc: "Operational Center" },
    { name: "North Sector", lat: activeCity.centerLat + 0.02, lng: activeCity.centerLng + 0.02, desc: "Northern Sector" },
    { name: "South Sector", lat: activeCity.centerLat - 0.02, lng: activeCity.centerLng - 0.02, desc: "Southern Sector" },
    { name: "East Sector", lat: activeCity.centerLat + 0.015, lng: activeCity.centerLng + 0.03, desc: "Eastern Sector" },
    { name: "West Sector", lat: activeCity.centerLat - 0.015, lng: activeCity.centerLng - 0.03, desc: "Western Sector" }
  ];

  return (
    <div className="space-y-8 animate-fade-in text-slate-100">
      {/* Dynamic Upper Title and Telemetry */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100 font-sans">Command Overview</h2>
          <p className="text-slate-400 text-sm">Real-time telemetry and service matrices for {activeCity.name} logistics.</p>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-slate-300 font-medium">Live Gateway Node: Online</span>
        </div>
      </div>

      {/* Grid 1: Today's High-Value Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl relative overflow-hidden shadow-md group hover:border-amber-500/30 transition duration-200">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Revenue</span>
            <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-xl border border-emerald-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-100 font-mono">₹{todayRevenue.toLocaleString('en-IN')}</div>
          <div className="text-xs text-emerald-400 flex items-center gap-1 mt-2">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Active transactions logged today</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition"></div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl relative overflow-hidden shadow-md group hover:border-amber-500/30 transition duration-200">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Platform Commission</span>
            <div className="bg-amber-500/10 text-amber-400 p-2 rounded-xl border border-amber-500/20">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-100 font-mono">₹{totalPlatformCommission.toLocaleString('en-IN')}</div>
          <div className="text-xs text-amber-400 flex items-center gap-1 mt-2">
            <span>Aggregated 15-18% platform share</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition"></div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl relative overflow-hidden shadow-md group hover:border-amber-500/30 transition duration-200">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Restaurant Earnings</span>
            <div className="bg-purple-500/10 text-purple-400 p-2 rounded-xl border border-purple-500/20">
              <Store className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-100 font-mono">₹{totalRestaurantEarnings.toLocaleString('en-IN')}</div>
          <div className="text-xs text-purple-400 flex items-center gap-1 mt-2">
            <span>Payable after commissions</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition"></div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl relative overflow-hidden shadow-md group hover:border-amber-500/30 transition duration-200">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rider Earnings</span>
            <div className="bg-cyan-500/10 text-cyan-400 p-2 rounded-xl border border-cyan-500/20">
              <Bike className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-100 font-mono">₹{totalRiderEarnings.toLocaleString('en-IN')}</div>
          <div className="text-xs text-cyan-400 flex items-center gap-1 mt-2">
            <span>Direct payout logistics share</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition"></div>
        </div>
      </div>

      {/* Grid 2: Logistical Status Counters */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-center">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Live Orders</p>
          <p className="text-2xl font-bold font-mono text-amber-500 mt-1">{liveOrders.length}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-center">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Completed</p>
          <p className="text-2xl font-bold font-mono text-emerald-500 mt-1">{completedOrders.length}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-center">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Cancelled</p>
          <p className="text-2xl font-bold font-mono text-rose-500 mt-1">{cancelledOrders.length}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-center">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Online Riders</p>
          <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">{onlineRiders.length}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-center">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Offline Riders</p>
          <p className="text-2xl font-bold font-mono text-slate-500 mt-1">{offlineRiders.length}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-center">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Registered Users</p>
          <p className="text-2xl font-bold font-mono text-indigo-400 mt-1">{customers.length + riders.length + restaurants.length}</p>
        </div>
      </div>

      {/* Grid 3: Live Map & Revenue Analytics Graph */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Live Tracking Overview Card */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl lg:col-span-5 flex flex-col shadow-xl justify-between min-h-[380px]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-100 text-base">Live Tracking Overview</h3>
              <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                ACTIVE MONITORING
              </span>
            </div>
            
            <p className="text-slate-400 text-xs mb-6 leading-relaxed">Real-time status of {activeCity.name} operations, active deliveries, and online fleet tracking.</p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-950/50 border border-slate-800/60 p-3 rounded-xl">
                <p className="text-slate-500 text-[10px] uppercase font-extrabold tracking-wider mb-1">Online Riders</p>
                <p className="text-xl font-bold font-mono text-emerald-400">{onlineRiders.length}</p>
              </div>
              <div className="bg-slate-950/50 border border-slate-800/60 p-3 rounded-xl">
                <p className="text-slate-500 text-[10px] uppercase font-extrabold tracking-wider mb-1">Active Deliveries</p>
                <p className="text-xl font-bold font-mono text-amber-500">{orders.filter(o => ['accepted', 'preparing', 'ready_for_pickup', 'picked_up'].includes(o.status)).length}</p>
              </div>
              <div className="bg-slate-950/50 border border-slate-800/60 p-3 rounded-xl">
                <p className="text-slate-500 text-[10px] uppercase font-extrabold tracking-wider mb-1">Pending Orders</p>
                <p className="text-xl font-bold font-mono text-rose-400">{orders.filter(o => o.status === 'pending').length}</p>
              </div>
              <div className="bg-slate-950/50 border border-slate-800/60 p-3 rounded-xl">
                <p className="text-slate-500 text-[10px] uppercase font-extrabold tracking-wider mb-1">In Progress</p>
                <p className="text-xl font-bold font-mono text-sky-400">{orders.filter(o => ['accepted', 'preparing', 'ready_for_pickup'].includes(o.status)).length}</p>
              </div>
            </div>

            <div className="border-t border-slate-800/60 pt-4 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Tracking Status</span>
                <span className="text-emerald-400 font-bold font-mono text-[11px]">LIVE FEED ACTIVE</span>
              </div>
            </div>
          </div>

          <button 
            onClick={onOpenLiveTracking}
            className="w-full mt-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 active:scale-[0.99] text-slate-950 font-black py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 text-xs shadow-lg shadow-amber-900/20 cursor-pointer"
          >
            <span>Open Live Tracking Workspace</span>
            <ArrowRight className="w-4 h-4 text-slate-950" />
          </button>
        </div>

        {/* Revenue Trends Pure SVG Graph */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl lg:col-span-7 flex flex-col shadow-xl">
          <div>
            <h3 className="font-bold text-slate-100 text-base">Revenue & Transactions Trend</h3>
            <p className="text-slate-400 text-xs">Platform daily sales aggregator history.</p>
          </div>

          <div className="flex-1 flex flex-col justify-end mt-6">
            {/* Highly customized SVG Area Line Chart */}
            <div className="h-48 w-full bg-slate-950/60 rounded-xl border border-slate-800 p-3 relative flex flex-col justify-between">
              {/* Grid guide labels */}
              <div className="absolute left-2 top-2 text-[9px] font-mono text-slate-500">₹1,500</div>
              <div className="absolute left-2 top-24 text-[9px] font-mono text-slate-500">₹750</div>
              <div className="absolute left-2 bottom-2 text-[9px] font-mono text-slate-500">₹0</div>

              <svg viewBox="0 0 400 150" className="w-full h-full">
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4"/>
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0"/>
                  </linearGradient>
                </defs>

                {/* Horizontal reference lines */}
                <line x1="0" y1="10" x2="400" y2="10" stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" />
                <line x1="0" y1="75" x2="400" y2="75" stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" />
                <line x1="0" y1="140" x2="400" y2="140" stroke="#334155" strokeWidth="0.5" />

                {/* Area under line */}
                <path 
                  d="M 10 140 Q 80 110 140 80 T 260 50 T 390 20 L 390 140 Z" 
                  fill="url(#chartGrad)" 
                />

                {/* Main line */}
                <path 
                  d="M 10 140 Q 80 110 140 80 T 260 50 T 390 20" 
                  fill="none" 
                  stroke="#f59e0b" 
                  strokeWidth="2.5" 
                  strokeLinecap="round"
                />

                {/* Interaction Node Dots */}
                <circle cx="140" cy="80" r="4" fill="#fff" stroke="#f59e0b" strokeWidth="2" />
                <circle cx="260" cy="50" r="4" fill="#fff" stroke="#f59e0b" strokeWidth="2" />
                <circle cx="390" cy="20" r="4" fill="#fff" stroke="#f59e0b" strokeWidth="2" />
              </svg>

              {/* Horizontal bottom labels */}
              <div className="flex justify-between px-2 text-[9px] font-mono text-slate-400 border-t border-slate-800 pt-1.5">
                <span>08:00 AM</span>
                <span>12:00 PM</span>
                <span>04:00 PM</span>
                <span>08:00 PM</span>
              </div>
            </div>

            {/* Sales performance details */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-slate-800/60 pb-2">
                <span className="text-slate-400">Average Order Value</span>
                <span className="font-semibold text-slate-100 font-mono">₹280.50</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-slate-800/60 pb-2">
                <span className="text-slate-400">Peak Ordering Hour</span>
                <span className="font-semibold text-slate-100 font-mono">08:00 PM - 09:00 PM</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Platform Commission Share</span>
                <span className="font-semibold text-amber-500 font-mono">15.4% Average</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Grid 4: Recent Live Orders Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-bold text-slate-100 text-base">Active Logistical Streams</h3>
            <p className="text-slate-400 text-xs">Real-time status registers of outstanding order payloads.</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-amber-500 hover:underline cursor-pointer">
            <span>View All Board Orders</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {liveOrders.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            No live active order processes in queue currently.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-4 rounded-l-lg font-semibold">Order ID</th>
                  <th className="p-4 font-semibold">Customer</th>
                  <th className="p-4 font-semibold">Vendor Restaurant</th>
                  <th className="p-4 font-semibold">Assigned Rider</th>
                  <th className="p-4 font-semibold">Subtotal</th>
                  <th className="p-4 font-semibold">Payment Status</th>
                  <th className="p-4 rounded-r-lg font-semibold">Workflow Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {liveOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-950/20 transition">
                    <td className="p-4 font-mono font-bold text-slate-200">{o.id}</td>
                    <td className="p-4 font-medium text-slate-100">{o.customerName}</td>
                    <td className="p-4 text-slate-400">{o.restaurantName}</td>
                    <td className="p-4">
                      {o.riderName ? (
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <Bike className="w-3.5 h-3.5 text-sky-400" />
                          {o.riderName}
                        </span>
                      ) : (
                        <span className="text-amber-500 italic bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">Unassigned</span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-slate-200">₹{o.totalAmount}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded font-medium ${
                        o.paymentStatus === 'paid' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full text-[11px] font-medium uppercase tracking-wider">
                        {o.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
