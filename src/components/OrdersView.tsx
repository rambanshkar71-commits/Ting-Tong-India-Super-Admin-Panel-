import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, setDoc, addDoc, collection, onSnapshot } from 'firebase/firestore';
import { Order, Rider } from '../types';
import { calculateDistance, getActiveCity } from '../services/mapService';
import ManualDispatchControl from './ManualDispatchControl';
import { 
  ShoppingBag, 
  Search, 
  Bike, 
  Printer, 
  ArrowRight, 
  User, 
  Store, 
  MapPin, 
  Clock, 
  RotateCcw, 
  CheckCircle,
  FileCheck,
  FileText,
  DollarSign,
  X,
  Cpu
} from 'lucide-react';

interface OrdersViewProps {
  orders: Order[];
  riders: Rider[];
}

export default function OrdersView({ orders, riders }: OrdersViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showRiderAssignModal, setShowRiderAssignModal] = useState<string | null>(null); // contains orderId
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'live-monitor'>('board');
  const [autoRefreshSecs, setAutoRefreshSecs] = useState(10);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-Assign dispatcher states (default to ON)
  const [isAutoAssignEnabled, setIsAutoAssignEnabled] = useState(true);
  const [autoAssignLogs, setAutoAssignLogs] = useState<string[]>([]);

  // Dispatch engine parameters synced with Firestore
  const [dispatchSettings, setDispatchSettings] = React.useState({
    maxActiveOrders: 2,
    maxDailyOrders: 15,
    maxDistanceRadius: 8.0,
    maxPickupDelay: 45,
    autoRetryInterval: 30,
    adminTimeout: 5
  });

  React.useEffect(() => {
    const unsub = onSnapshot(doc(db, 'dispatch_settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (typeof data.autoAssign === 'boolean') {
          setIsAutoAssignEnabled(data.autoAssign);
        } else {
          // If autoAssign property is missing in Firestore, default to true and save
          setDoc(doc(db, 'dispatch_settings', 'global'), { autoAssign: true }, { merge: true }).catch(err => console.error(err));
          setIsAutoAssignEnabled(true);
        }
        setDispatchSettings({
          maxActiveOrders: Number(data.maxActiveOrders ?? 2),
          maxDailyOrders: Number(data.maxDailyOrders ?? 15),
          maxDistanceRadius: Number(data.maxDistanceRadius ?? 8.0),
          maxPickupDelay: Number(data.maxPickupDelay ?? 45),
          autoRetryInterval: Number(data.autoRetryInterval ?? 30),
          adminTimeout: Number(data.adminTimeout ?? 5)
        });
      } else {
        // Document doesn't exist, create default with autoAssign: true
        setDoc(doc(db, 'dispatch_settings', 'global'), {
          autoAssign: true,
          maxActiveOrders: 2,
          maxDailyOrders: 15,
          maxDistanceRadius: 8.0,
          maxPickupDelay: 45,
          autoRetryInterval: 30,
          adminTimeout: 5
        }).catch(err => console.error(err));
        setIsAutoAssignEnabled(true);
      }
    });
    return () => unsub();
  }, []);

  // Proximity Distance helper delegating to Shared Map Service
  const calculateDistanceDelegate = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return Infinity;
    return calculateDistance(lat1, lon1, lat2, lon2);
  };

  // Helper: Get active orders count for a rider
  const getActiveOrdersCount = (riderId: string) => {
    return orders.filter(
      o => o.riderId === riderId && 
      !['delivered', 'cancelled', 'refunded'].includes(o.status)
    ).length;
  };

  // Automatic single-order dispatcher with Intelligent Matching Priority
  const triggerAutoAssignForOrder = async (orderId: string): Promise<{ success: boolean; message: string }> => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return { success: false, message: "Order not found." };

    // 1. Get approved, online, on-duty riders
    const activeRiders = riders.filter(r => 
      r.status === 'approved' && 
      r.onlineStatus === 'online' &&
      r.dutyStatus === 'on_duty'
    );

    if (activeRiders.length === 0) {
      return { success: false, message: `No active on-duty fleet partners in ${getActiveCity().name} for Order #${orderId}.` };
    }

    // 2. Filter by Capacity Control, Distance Radius, and Rejections
    const eligibleRiders = activeRiders.filter(r => {
      // Busy Rider Check (Active orders count < maxActiveOrders)
      const activeCount = getActiveOrdersCount(r.id);
      if (activeCount >= dispatchSettings.maxActiveOrders) return false;

      // Rider who rejected same order check
      if (order.rejectedRiders?.includes(r.id)) return false;

      // Radius boundary check
      const dist = calculateDistanceDelegate(
        order.restaurantLat || 23.2324, 
        order.restaurantLng || 77.4318, 
        r.lat, 
        r.lng
      );
      if (dist > dispatchSettings.maxDistanceRadius) return false;

      return true;
    });

    if (eligibleRiders.length === 0) {
      return { success: false, message: `All active ${getActiveCity().name} riders are either busy, too far, or previously rejected Order #${orderId}.` };
    }

    // 3. Score riders based on Intelligent Matching Priority
    const scoredRiders = eligibleRiders.map(r => {
      const dist = calculateDistanceDelegate(
        order.restaurantLat || 23.2324, 
        order.restaurantLng || 77.4318, 
        r.lat, 
        r.lng
      );

      // Priority 1: Same Zone (within 3 KM is high affinity)
      const sameZoneScore = dist <= 3.0 ? 1000 : 0;

      // Priority 2: Nearest Distance (subtracted to favor closer)
      const distanceScore = -dist * 100;

      // Priority 3: Lowest Active Orders (each order subtracts 150 points)
      const activeCount = getActiveOrdersCount(r.id);
      const activeOrderScore = -activeCount * 150;

      // Priority 4: Highest Acceptance Rate (1.5x)
      const acceptanceScore = (r.acceptanceRate || 95) * 1.5;

      // Priority 5: Fastest ETA (additional distance penalty representing transit time)
      const etaScore = -dist * 50;

      // Priority 6: Better Rider Rating (50 points per star)
      const ratingScore = (r.rating || 4.5) * 50;

      const totalScore = sameZoneScore + distanceScore + activeOrderScore + acceptanceScore + etaScore + ratingScore;

      return {
        rider: r,
        distance: dist,
        score: totalScore
      };
    });

    // Sort descending by priority score
    scoredRiders.sort((a, b) => b.score - a.score);

    const bestMatch = scoredRiders[0];
    if (bestMatch) {
      const rider = bestMatch.rider;
      
      // Update Firestore and handle dispatch
      await handleAssignRider(orderId, rider.id, rider.name);

      // Log to dispatch_timeline
      await addDoc(collection(db, 'dispatch_timeline'), {
        orderId,
        type: 'Auto Assigned',
        previousRider: null,
        newRider: rider.name,
        transferReason: `SATCOM Auto-Match (Proximity: ${bestMatch.distance.toFixed(2)} km, Score: ${Math.round(bestMatch.score)})`,
        timestamp: new Date().toISOString(),
        adminName: 'SATCOM AI Engine',
        adminRole: 'AI Dispatch'
      });

      return {
        success: true,
        message: `Matched Order ${orderId} with ranked Rider ${rider.name} (${bestMatch.distance.toFixed(2)} km away).`
      };
    }

    return { success: false, message: "Could not find a suitable ranked rider." };
  };

  // SATCOM Live Auto-Assign Daemon
  React.useEffect(() => {
    if (!isAutoAssignEnabled) return;

    const pendingOrders = orders.filter(o => o.status === 'pending' && !o.riderId);
    if (pendingOrders.length === 0) return;

    const processAutoAssign = async () => {
      for (const order of pendingOrders) {
        const result = await triggerAutoAssignForOrder(order.id);
        if (result.success) {
          try {
            await addDoc(collection(db, 'audit_logs'), {
              id: 'log_' + Date.now(),
              userId: 'auto_dispatcher_daemon',
              email: 'system-daemon@tingtong.com',
              adminEmail: 'system-daemon@tingtong.com',
              action: 'AUTO_DISPATCH_MATCH',
              details: result.message,
              timestamp: new Date().toISOString()
            });
          } catch (e) {
            console.error("Error logging auto assign: ", e);
          }
          setAutoAssignLogs(prev => [`[${new Date().toLocaleTimeString()}] ${result.message}`, ...prev.slice(0, 19)]);
          break; // Process one order per pass to prevent racing
        }
      }
    };

    const timer = setTimeout(processAutoAssign, 2000);
    return () => clearTimeout(timer);
  }, [orders, riders, isAutoAssignEnabled, dispatchSettings]);

  // Filter orders by search
  const filteredOrders = orders.filter(o => 
    o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.restaurantName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group columns
  const columns = {
    pending: filteredOrders.filter(o => o.status === 'pending'),
    accepted: filteredOrders.filter(o => o.status === 'accepted' || o.status === 'preparing'),
    ready: filteredOrders.filter(o => o.status === 'ready_for_pickup'),
    transit: filteredOrders.filter(o => o.status === 'picked_up'),
    delivered: filteredOrders.filter(o => o.status === 'delivered'),
    cancelled: filteredOrders.filter(o => o.status === 'cancelled' || o.status === 'refunded')
  };

  // Live monitor timer and aging
  const getAgingMinutes = (createdAtStr: string) => {
    if (!createdAtStr) return 0;
    const created = new Date(createdAtStr);
    const diffMs = Date.now() - created.getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  const getOrderStatusDelayInfo = (o: Order) => {
    const minutes = getAgingMinutes(o.createdAt);
    if (o.status === 'pending' && minutes > 10) {
      return { isDelayed: true, message: `Unassigned for ${minutes} mins`, minutes };
    }
    if ((o.status === 'accepted' || o.status === 'preparing') && minutes > 20) {
      return { isDelayed: true, message: `In preparation for ${minutes} mins`, minutes };
    }
    if ((o.status === 'ready_for_pickup' || o.status === 'picked_up') && minutes > 30) {
      return { isDelayed: true, message: `In transit/pickup for ${minutes} mins`, minutes };
    }
    return { isDelayed: false, message: '', minutes };
  };

  React.useEffect(() => {
    if (viewMode !== 'live-monitor') return;
    const interval = setInterval(() => {
      setAutoRefreshSecs(prev => {
        if (prev <= 1) {
          setIsRefreshing(true);
          setTimeout(() => setIsRefreshing(false), 800);
          return 10;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [viewMode]);

  const handleUpdateStatus = async (orderId: string, nextStatus: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: nextStatus,
        updatedAt: new Date().toISOString()
      });
      // Update local selection if open
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: nextStatus as any });
      }
    } catch (err) {
      console.error("Error updating order status: ", err);
    }
  };

  const handleAssignRider = async (orderId: string, riderId: string, riderName: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      // Let's compute delivery payout for rider (typically 80% of delivery charge)
      const currentOrder = orders.find(o => o.id === orderId);
      const deliveryCharge = currentOrder?.deliveryCharge || 30;
      const riderEarnings = Math.round(deliveryCharge * 0.8);

      await updateDoc(orderRef, {
        riderId,
        riderName,
        riderEarnings,
        status: 'accepted',
        updatedAt: new Date().toISOString()
      });
      setShowRiderAssignModal(null);
    } catch (err) {
      console.error("Error assigning rider to order: ", err);
    }
  };

  const activeRiders = riders.filter(r => r.status === 'approved' && r.onlineStatus === 'online');

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100">Logistics Flow Control</h2>
          <p className="text-slate-400 text-xs">Real-time status boards monitoring live transactions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-850 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('board')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'board' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Logistics Board
            </button>
            <button
              onClick={() => setViewMode('live-monitor')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'live-monitor' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              Live Monitoring Dashboard
            </button>
          </div>

          <div className="relative max-w-xs">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search Order ID, Client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 pl-10 pr-4 py-2 rounded-xl text-xs focus:border-amber-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Auto-Dispatch Radar and Controller Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${isAutoAssignEnabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-950 text-slate-400 border-slate-850'}`}>
              <Cpu className={`w-5 h-5 ${isAutoAssignEnabled ? 'animate-pulse text-emerald-400' : 'text-slate-500'}`} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                SATCOM Proximity Auto-Dispatcher
                {isAutoAssignEnabled && (
                  <span className="bg-emerald-500/10 text-emerald-400 font-mono text-[9px] px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold animate-pulse">
                    RUNNING
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400 font-sans">Automatically detects the nearest approved online rider to restaurants for instant queue processing.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center">
            <span className="text-xs text-slate-400 font-medium">Automatic Matching Mode:</span>
            <button
              onClick={() => {
                const nextVal = !isAutoAssignEnabled;
                setIsAutoAssignEnabled(nextVal);
                setDoc(doc(db, 'dispatch_settings', 'global'), { autoAssign: nextVal }, { merge: true }).catch(err => console.error(err));
                addDoc(collection(db, 'audit_logs'), {
                  id: 'log_' + Date.now(),
                  userId: 'admin_usr',
                  email: 'admin@tingtong.com',
                  adminEmail: 'admin@tingtong.com',
                  action: nextVal ? 'AUTO_DISPATCH_ACTIVATED' : 'AUTO_DISPATCH_DEACTIVATED',
                  details: nextVal ? 'Activated global SATCOM nearest-rider auto-dispatch system.' : 'Deactivated global SATCOM auto-dispatching systems.',
                  timestamp: new Date().toISOString()
                }).catch(e => console.error(e));
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isAutoAssignEnabled ? 'bg-emerald-500' : 'bg-slate-800'}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${isAutoAssignEnabled ? 'translate-x-5 bg-white' : 'translate-x-0'}`}
              />
            </button>
          </div>
        </div>

        {/* Live Matching Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850">
            <span className="text-slate-500 block font-mono text-[9px] uppercase font-bold">Online Riders Range</span>
            <span className="text-sm font-bold text-slate-200 font-mono mt-0.5 block">{activeRiders.length} Available</span>
          </div>
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850">
            <span className="text-slate-500 block font-mono text-[9px] uppercase font-bold">Unassigned Queue</span>
            <span className="text-sm font-bold text-amber-500 font-mono mt-0.5 block">{orders.filter(o => o.status === 'pending').length} Orders</span>
          </div>
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850">
            <span className="text-slate-500 block font-mono text-[9px] uppercase font-bold">Recommended Zone Radius</span>
            <span className="text-sm font-bold text-indigo-400 font-mono mt-0.5 block">Arera & MP Nagar (5.0km)</span>
          </div>
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850">
            <span className="text-slate-500 block font-mono text-[9px] uppercase font-bold">Dispatcher Latency</span>
            <span className="text-sm font-bold text-sky-400 font-mono mt-0.5 block">Sub-200ms Match</span>
          </div>
        </div>

        {/* Live matching logs stream inside dispatcher component */}
        {autoAssignLogs.length > 0 && (
          <div className="bg-slate-950/80 border border-slate-850 p-3 rounded-xl space-y-1.5 font-mono text-[10px] text-slate-400 font-sans">
            <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 border-b border-slate-900 pb-1.5 mb-1.5 font-mono">
              <span>REAL-TIME DISPATCH AGENT EVENT LOGS</span>
              <span className="text-emerald-400 animate-pulse flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> LISTENING
              </span>
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto scrollbar-none font-mono">
              {autoAssignLogs.map((log, index) => (
                <div key={index} className="flex gap-1.5 leading-relaxed font-mono">
                  <span className="text-slate-500 shrink-0">⚡</span>
                  <span className={log.includes('Matched') || log.includes('Successfully') ? 'text-emerald-400/90' : 'text-slate-300'}>{log}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ManualDispatchControl 
        orders={orders} 
        riders={riders} 
        parentSelectedOrderId={selectedOrder?.id || ''}
        onSelectOrderId={(orderId) => {
          const ord = orders.find(o => o.id === orderId);
          setSelectedOrder(ord || null);
        }}
      />

      {/* Main Board Columns Grid */}
      {viewMode === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-start">
        
        {/* Column 1: Pending */}
        <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 space-y-3">
          <div className="flex justify-between items-center px-1.5 py-0.5 border-b border-slate-800/60 pb-2">
            <span className="font-semibold text-xs text-slate-400 uppercase tracking-wider">Pending</span>
            <span className="bg-amber-500/10 text-amber-500 font-mono text-[10px] px-2 py-0.5 rounded-full font-bold">{columns.pending.length}</span>
          </div>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {columns.pending.map(o => (
              <div 
                key={o.id} 
                onClick={() => setSelectedOrder(o)}
                className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 p-4 rounded-xl cursor-pointer shadow transition"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-mono text-slate-400 font-bold">{o.id}</span>
                  <span className="text-[10px] text-amber-500 font-bold uppercase">{o.paymentMethod}</span>
                </div>
                <h4 className="font-bold text-xs text-slate-100 truncate mb-1">{o.customerName}</h4>
                <p className="text-[11px] text-slate-400 truncate mb-2">{o.restaurantName}</p>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-300 font-mono">₹{o.totalAmount}</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowRiderAssignModal(o.id);
                    }}
                    className="bg-amber-500 text-slate-950 text-[10px] font-bold px-2 py-1 rounded hover:brightness-110 cursor-pointer"
                  >
                    Assign Rider
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Accepted & Preparing */}
        <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 space-y-3">
          <div className="flex justify-between items-center px-1.5 py-0.5 border-b border-slate-800/60 pb-2">
            <span className="font-semibold text-xs text-slate-400 uppercase tracking-wider">Preparing</span>
            <span className="bg-sky-500/10 text-sky-400 font-mono text-[10px] px-2 py-0.5 rounded-full font-bold">{columns.accepted.length}</span>
          </div>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {columns.accepted.map(o => (
              <div 
                key={o.id} 
                onClick={() => setSelectedOrder(o)}
                className="bg-slate-900 border border-slate-800 hover:border-sky-500/40 p-4 rounded-xl cursor-pointer shadow transition"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-mono text-slate-400 font-bold">{o.id}</span>
                  <span className="text-[10px] text-sky-400 font-bold uppercase">{o.status}</span>
                </div>
                <h4 className="font-bold text-xs text-slate-100 truncate mb-1">{o.customerName}</h4>
                <p className="text-[11px] text-slate-400 truncate mb-2">{o.restaurantName}</p>
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span className="text-slate-300 font-mono">₹{o.totalAmount}</span>
                  <span>Rider: {o.riderName || 'None'}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800/50 flex gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateStatus(o.id, 'ready_for_pickup');
                    }}
                    className="w-full bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/10 text-[10px] py-1 rounded font-bold cursor-pointer"
                  >
                    Mark Ready
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Ready for Pickup */}
        <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 space-y-3">
          <div className="flex justify-between items-center px-1.5 py-0.5 border-b border-slate-800/60 pb-2">
            <span className="font-semibold text-xs text-slate-400 uppercase tracking-wider">Ready</span>
            <span className="bg-indigo-500/10 text-indigo-400 font-mono text-[10px] px-2 py-0.5 rounded-full font-bold">{columns.ready.length}</span>
          </div>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {columns.ready.map(o => (
              <div 
                key={o.id} 
                onClick={() => setSelectedOrder(o)}
                className="bg-slate-900 border border-slate-800 hover:border-indigo-500/40 p-4 rounded-xl cursor-pointer shadow transition"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-mono text-slate-400 font-bold">{o.id}</span>
                </div>
                <h4 className="font-bold text-xs text-slate-100 truncate mb-1">{o.customerName}</h4>
                <p className="text-[11px] text-slate-400 truncate mb-2">{o.restaurantName}</p>
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span className="text-slate-300 font-mono">₹{o.totalAmount}</span>
                  <span>Rider: {o.riderName}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800/50 flex gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateStatus(o.id, 'picked_up');
                    }}
                    className="w-full bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 border border-indigo-500/10 text-[10px] py-1 rounded font-bold cursor-pointer"
                  >
                    Mark Picked
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 4: Picked up / Transit */}
        <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 space-y-3">
          <div className="flex justify-between items-center px-1.5 py-0.5 border-b border-slate-800/60 pb-2">
            <span className="font-semibold text-xs text-slate-400 uppercase tracking-wider">In Transit</span>
            <span className="bg-fuchsia-500/10 text-fuchsia-400 font-mono text-[10px] px-2 py-0.5 rounded-full font-bold">{columns.transit.length}</span>
          </div>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {columns.transit.map(o => (
              <div 
                key={o.id} 
                onClick={() => setSelectedOrder(o)}
                className="bg-slate-900 border border-slate-800 hover:border-fuchsia-500/40 p-4 rounded-xl cursor-pointer shadow transition"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-mono text-slate-400 font-bold">{o.id}</span>
                </div>
                <h4 className="font-bold text-xs text-slate-100 truncate mb-1">{o.customerName}</h4>
                <p className="text-[11px] text-slate-400 truncate mb-2">{o.restaurantName}</p>
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span className="text-slate-300 font-mono">₹{o.totalAmount}</span>
                  <span>Rider: {o.riderName}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800/50 flex gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateStatus(o.id, 'delivered');
                    }}
                    className="w-full bg-emerald-600 text-slate-950 text-[10px] py-1 rounded font-bold cursor-pointer"
                  >
                    Confirm Delivered
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 5: Delivered */}
        <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 space-y-3">
          <div className="flex justify-between items-center px-1.5 py-0.5 border-b border-slate-800/60 pb-2">
            <span className="font-semibold text-xs text-slate-400 uppercase tracking-wider">Delivered</span>
            <span className="bg-emerald-500/10 text-emerald-400 font-mono text-[10px] px-2 py-0.5 rounded-full font-bold">{columns.delivered.length}</span>
          </div>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {columns.delivered.map(o => (
              <div 
                key={o.id} 
                onClick={() => setSelectedOrder(o)}
                className="bg-slate-900/60 border border-slate-800 opacity-80 p-4 rounded-xl cursor-pointer shadow transition"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-mono text-slate-400 font-bold">{o.id}</span>
                </div>
                <h4 className="font-bold text-xs text-slate-200 truncate mb-1">{o.customerName}</h4>
                <p className="text-[11px] text-slate-400 truncate mb-2">{o.restaurantName}</p>
                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span className="font-mono">₹{o.totalAmount}</span>
                  <span className="text-emerald-500 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Done
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 6: Cancelled / Refunded */}
        <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 space-y-3">
          <div className="flex justify-between items-center px-1.5 py-0.5 border-b border-slate-800/60 pb-2">
            <span className="font-semibold text-xs text-slate-400 uppercase tracking-wider">Cancelled</span>
            <span className="bg-rose-500/10 text-rose-400 font-mono text-[10px] px-2 py-0.5 rounded-full font-bold">{columns.cancelled.length}</span>
          </div>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {columns.cancelled.map(o => (
              <div 
                key={o.id} 
                onClick={() => setSelectedOrder(o)}
                className="bg-slate-900/40 border border-slate-800 opacity-60 p-4 rounded-xl cursor-pointer shadow transition"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-mono text-slate-400 font-bold">{o.id}</span>
                  <span className="text-[9px] text-rose-500 uppercase">{o.status}</span>
                </div>
                <h4 className="font-bold text-xs text-slate-300 truncate mb-1">{o.customerName}</h4>
                <p className="text-[11px] text-slate-400 truncate mb-2">{o.restaurantName}</p>
                <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                  <span>₹{o.totalAmount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
      ) : (
        <div className="space-y-6">
          {/* Real-time Status Hub & Telemetry Header */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Sync Pipeline</span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full bg-emerald-500 ${isRefreshing ? 'animate-ping' : ''}`}></span>
                <p className="text-xs font-mono font-bold text-slate-200">REALTIME SNAPSHOT</p>
              </div>
              <p className="text-[9px] text-slate-500 mt-1">Sync countdown: {autoRefreshSecs}s</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono font-sans">Active Delivery Flows</span>
              <p className="text-xl font-bold font-mono text-amber-500 mt-0.5">
                {orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'refunded').length}
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono font-sans">Pending Allocation</span>
              <p className="text-xl font-bold font-mono text-indigo-400 mt-0.5">
                {orders.filter(o => o.status === 'pending').length}
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Delayed SLA Breaches</span>
              <p className="text-xl font-bold font-mono text-rose-500 mt-0.5">
                {orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'refunded' && getOrderStatusDelayInfo(o).isDelayed).length}
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm col-span-2 md:col-span-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono font-sans">Food Ready & Transit</span>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                {orders.filter(o => o.status === 'ready_for_pickup' || o.status === 'picked_up').length}
              </p>
            </div>
          </div>

          {/* Delayed Orders Warning Banner */}
          {orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'refunded' && getOrderStatusDelayInfo(o).isDelayed).length > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-start gap-3.5 text-xs">
              <div className="bg-rose-500/20 text-rose-400 p-1.5 rounded-lg border border-rose-500/30 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-rose-400 uppercase font-mono tracking-wider">Delay Threshold SLA Warnings</h4>
                <p className="text-slate-400 text-[11px] mt-0.5 leading-normal">
                  The following active orders have breached preparation thresholds (Unassigned &gt; 10m, Preparing &gt; 20m, Dispatch &gt; 30m). Dispatcher intervention recommended:
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'refunded' && getOrderStatusDelayInfo(o).isDelayed).map(o => {
                    const delay = getOrderStatusDelayInfo(o);
                    return (
                      <span key={o.id} className="bg-rose-950/80 border border-rose-800/80 text-[10px] text-rose-300 px-2.5 py-0.5 rounded-lg font-mono font-bold">
                        {o.id}: {delay.message}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Core Telemetry Table of Active Orders */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="font-bold text-slate-100 text-sm mb-4 font-sans">Live Dispatch Stream</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider">
                  <tr>
                    <th className="p-3">Order Code</th>
                    <th className="p-3">Client & Node Address</th>
                    <th className="p-3">Merchant Restaurant</th>
                    <th className="p-3">Assigned Fleet Courier</th>
                    <th className="p-3">Aging Timeline</th>
                    <th className="p-3">SLA Status</th>
                    <th className="p-3 text-right">Instant Control Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'refunded').length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-500 text-xs text-center">No active transactions in progress.</td>
                    </tr>
                  ) : (
                    filteredOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'refunded').map(o => {
                      const delayInfo = getOrderStatusDelayInfo(o);
                      const agingMins = getAgingMinutes(o.createdAt);
                      return (
                        <tr key={o.id} className="hover:bg-slate-950/10 transition cursor-pointer" onClick={() => setSelectedOrder(o)}>
                          <td className="p-3 font-mono">
                            <p className="font-bold text-slate-200">{o.id}</p>
                            <p className="text-slate-500 text-[10px]">₹{o.totalAmount} • {o.paymentMethod}</p>
                          </td>
                          <td className="p-3 font-sans">
                            <p className="font-bold text-slate-200">{o.customerName}</p>
                            <p className="text-slate-500 text-[10px] truncate max-w-[150px]">{o.deliveryAddress}</p>
                          </td>
                          <td className="p-3 font-sans">
                            <p className="font-bold text-slate-200">{o.restaurantName}</p>
                            <p className="text-slate-500 text-[10px]">Arera Colony</p>
                          </td>
                          <td className="p-3 font-sans">
                            {o.riderName ? (
                              <div>
                                <p className="font-bold text-sky-400">{o.riderName}</p>
                                <p className="text-[10px] text-slate-500">Fleet Active</p>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowRiderAssignModal(o.id);
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-slate-100 px-2 py-1 rounded text-[10px] font-bold uppercase transition cursor-pointer"
                              >
                                Allocate Courier
                              </button>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <Clock className={`w-3.5 h-3.5 ${delayInfo.isDelayed ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`} />
                              <span className={`font-mono font-bold ${delayInfo.isDelayed ? 'text-rose-400' : 'text-slate-300'}`}>
                                {agingMins}m running
                              </span>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="space-y-1">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                o.status === 'pending'
                                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                  : o.status === 'accepted' || o.status === 'preparing'
                                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                  : o.status === 'ready_for_pickup'
                                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {o.status.replace(/_/g, ' ')}
                              </span>
                              {delayInfo.isDelayed && (
                                <p className="text-[9px] text-rose-500 font-bold uppercase font-mono tracking-wider">🚨 SLA DELAY</p>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-end gap-1.5">
                              {o.status === 'pending' && (
                                <button
                                  onClick={() => handleUpdateStatus(o.id, 'accepted')}
                                  className="bg-emerald-600 text-slate-950 font-bold px-2 py-1 rounded text-[10px] hover:brightness-110 cursor-pointer"
                                >
                                  Accept
                                </button>
                              )}
                              {o.status === 'accepted' && (
                                <button
                                  onClick={() => handleUpdateStatus(o.id, 'preparing')}
                                  className="bg-indigo-600 text-slate-100 font-bold px-2 py-1 rounded text-[10px] hover:brightness-110 cursor-pointer"
                                >
                                  Prep
                                </button>
                              )}
                              {o.status === 'preparing' && (
                                <button
                                  onClick={() => handleUpdateStatus(o.id, 'ready_for_pickup')}
                                  className="bg-sky-600 text-slate-950 font-bold px-2 py-1 rounded text-[10px] hover:brightness-110 cursor-pointer"
                                >
                                  Ready
                                </button>
                              )}
                              {o.status === 'ready_for_pickup' && (
                                <button
                                  onClick={() => handleUpdateStatus(o.id, 'picked_up')}
                                  className="bg-amber-600 text-slate-950 font-bold px-2 py-1 rounded text-[10px] hover:brightness-110 cursor-pointer"
                                >
                                  Pickup
                                </button>
                              )}
                              {o.status === 'picked_up' && (
                                <button
                                  onClick={() => handleUpdateStatus(o.id, 'delivered')}
                                  className="bg-emerald-600 text-slate-950 font-bold px-2 py-1 rounded text-[10px] hover:brightness-110 cursor-pointer"
                                >
                                  Deliver
                                </button>
                              )}
                              <button
                                onClick={() => handleUpdateStatus(o.id, 'cancelled')}
                                className="bg-rose-500/10 text-rose-400 p-1 rounded hover:bg-rose-500/20 cursor-pointer"
                                title="Cancel Order"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
      )}

      {/* Floating Detailed Viewer Panel */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                  Order Operations Desk
                </span>
                <h3 className="font-bold text-lg text-slate-100 mt-1">{selectedOrder.id}</h3>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Order Logistics Route */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-500">
                    <Store className="w-4 h-4" />
                    <span>Restaurant Origin</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm">{selectedOrder.restaurantName}</h4>
                    <p className="text-slate-400 text-xs">Origin Lat: {selectedOrder.restaurantLat}, Lng: {selectedOrder.restaurantLng}</p>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-500">
                    <User className="w-4 h-4" />
                    <span>Customer Destination</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm">{selectedOrder.customerName}</h4>
                    <p className="text-slate-400 text-xs truncate">{selectedOrder.deliveryAddress}</p>
                    <p className="text-slate-400 text-xs">Dest Lat: {selectedOrder.deliveryLat}, Lng: {selectedOrder.deliveryLng}</p>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 pb-1.5 border-b border-slate-800/60">Cart Payload Details</h4>
                <div className="space-y-2">
                  {selectedOrder.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span className="text-slate-300 font-medium">
                        {it.name} <span className="text-slate-500 font-bold">x {it.quantity}</span>
                      </span>
                      <span className="font-mono text-slate-200">₹{it.price * it.quantity}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-800/80 pt-2 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal</span>
                    <span>₹{selectedOrder.subtotal}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Delivery Charges</span>
                    <span>₹{selectedOrder.deliveryCharge}</span>
                  </div>
                  <div className="flex justify-between text-slate-200 font-bold pt-1 border-t border-slate-800/60">
                    <span>Total Amount</span>
                    <span className="text-amber-500">₹{selectedOrder.totalAmount}</span>
                  </div>
                </div>
              </div>

              {/* Assignments and status actions */}
              <div className="flex flex-wrap gap-3 pt-2">
                {selectedOrder.status === 'pending' && (
                  <button 
                    onClick={() => {
                      setShowRiderAssignModal(selectedOrder.id);
                      setSelectedOrder(null);
                    }}
                    className="flex-1 bg-amber-500 text-slate-950 py-2.5 rounded-xl text-xs font-bold hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Bike className="w-4 h-4" />
                    <span>Assign Rider Logistics Partner</span>
                  </button>
                )}

                {selectedOrder.status === 'accepted' && (
                  <button 
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'preparing')}
                    className="flex-1 bg-sky-600 text-slate-100 py-2.5 rounded-xl text-xs font-bold hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Start Preparation</span>
                  </button>
                )}

                {selectedOrder.status === 'preparing' && (
                  <button 
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'ready_for_pickup')}
                    className="flex-1 bg-emerald-600 text-slate-100 py-2.5 rounded-xl text-xs font-bold hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Finish and Set Ready</span>
                  </button>
                )}

                {selectedOrder.status === 'ready_for_pickup' && (
                  <button 
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'picked_up')}
                    className="flex-1 bg-indigo-600 text-slate-100 py-2.5 rounded-xl text-xs font-bold hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Confirm Rider Pickup</span>
                  </button>
                )}

                {selectedOrder.status === 'picked_up' && (
                  <button 
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'delivered')}
                    className="flex-1 bg-emerald-600 text-slate-950 py-2.5 rounded-xl text-xs font-bold hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Deliver Order</span>
                  </button>
                )}

                {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && (
                  <button 
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'cancelled')}
                    className="bg-rose-500/15 border border-rose-500/20 text-rose-400 px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-rose-500/20 cursor-pointer"
                  >
                    Cancel Order
                  </button>
                )}

                <button 
                  onClick={() => {
                    setInvoiceOrder(selectedOrder);
                    setSelectedOrder(null);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>GST Invoice</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Rider Selection Modal */}
      {showRiderAssignModal && (() => {
        const modalOrder = orders.find(o => o.id === showRiderAssignModal);
        const activeRidersWithDistance = activeRiders.map(r => {
          const distance = modalOrder
            ? calculateDistanceDelegate(
                modalOrder.restaurantLat || 23.2324,
                modalOrder.restaurantLng || 77.4318,
                r.lat,
                r.lng
              )
            : 999;
          return { ...r, distance };
        }).sort((a, b) => a.distance - b.distance);

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
            <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl shadow-2xl overflow-hidden p-6">
              <div className="flex justify-between items-start mb-4 border-b border-slate-850 pb-3">
                <div>
                  <h3 className="font-bold text-base text-slate-100 flex items-center gap-1.5">
                    <Bike className="w-5 h-5 text-amber-500 animate-pulse" />
                    Logistics Grid Allocator
                  </h3>
                  <p className="text-slate-400 text-[11px] mt-0.5">Assigning courier partners based on real-time SATCOM locations.</p>
                </div>
                <button 
                  onClick={() => setShowRiderAssignModal(null)}
                  className="text-slate-400 hover:text-slate-200 text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Instant Auto-Detect Proximity Trigger */}
              <button
                onClick={async () => {
                  const orderId = showRiderAssignModal;
                  if (!orderId) return;
                  const result = await triggerAutoAssignForOrder(orderId);
                  if (result.success) {
                    try {
                      await addDoc(collection(db, 'audit_logs'), {
                        id: 'log_' + Date.now(),
                        userId: 'admin_usr',
                        email: 'admin@tingtong.com',
                        adminEmail: 'admin@tingtong.com',
                        action: 'AUTO_DISPATCH_MATCH',
                        details: result.message,
                        timestamp: new Date().toISOString()
                      });
                    } catch (e) {
                      console.error("Error logging auto assign: ", e);
                    }
                    alert(result.message);
                    setShowRiderAssignModal(null);
                  } else {
                    alert(result.message);
                  }
                }}
                className="w-full mb-4 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-extrabold py-3 px-4 rounded-xl text-xs hover:brightness-110 transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10 border border-amber-400/20"
              >
                <Cpu className="w-4 h-4 text-slate-950 animate-pulse" />
                <span>⚡ AUTO-DETECT & ASSIGN NEAREST</span>
              </button>

              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex justify-between items-center px-1 font-mono">
                <span>Riders Sorted By Proximity</span>
                <span>{getActiveCity().name} Grid distance</span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {activeRidersWithDistance.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No online delivery partners currently active in {getActiveCity().name}.
                  </div>
                ) : (
                  activeRidersWithDistance.map((r, idx) => (
                    <div 
                      key={r.id} 
                      onClick={() => handleAssignRider(showRiderAssignModal, r.id, r.name)}
                      className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 p-3 rounded-xl flex items-center justify-between cursor-pointer transition group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-xs text-slate-100 group-hover:text-amber-400 transition">{r.name}</h4>
                          {idx === 0 && (
                            <span className="bg-emerald-500/10 text-emerald-400 font-mono text-[8px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/20">
                              🏆 Closest Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Rating: ⭐ {r.rating} | Phone: {r.phone}
                        </p>
                      </div>
                      <div className="text-right space-y-0.5 shrink-0">
                        <p className="text-[11px] font-bold text-slate-200 font-mono">{r.distance.toFixed(2)} km</p>
                        <p className="text-[8px] text-slate-500 uppercase font-mono tracking-wider">Estimated Dist</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Printable GST Invoice Modal */}
      {invoiceOrder && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 max-w-lg w-full rounded-2xl p-8 shadow-2xl flex flex-col justify-between">
            
            {/* Invoice Contents to Print */}
            <div className="space-y-6">
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-slate-900">TING TONG BHOPAL</h3>
                  <p className="text-[10px] text-slate-500">FSSAI Licence No: 12421008000293</p>
                  <p className="text-[10px] text-slate-500">GSTIN: 23AABCT9384C1Z5</p>
                </div>
                <div className="text-right">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">GST Invoice</h4>
                  <p className="text-xs font-mono font-bold text-slate-800">{invoiceOrder.id}</p>
                  <p className="text-[10px] text-slate-500">Date: {new Date(invoiceOrder.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Origin and Destination Details */}
              <div className="grid grid-cols-2 gap-4 text-[11px]">
                <div>
                  <h5 className="font-bold text-slate-400 uppercase tracking-wider text-[9px] mb-1">Merchant Vendor</h5>
                  <p className="font-bold text-slate-800">{invoiceOrder.restaurantName}</p>
                  <p className="text-slate-500 line-clamp-2">{getActiveCity().name} Partner Hub</p>
                </div>
                <div>
                  <h5 className="font-bold text-slate-400 uppercase tracking-wider text-[9px] mb-1">Consignee Customer</h5>
                  <p className="font-bold text-slate-800">{invoiceOrder.customerName}</p>
                  <p className="text-slate-500 line-clamp-2">{invoiceOrder.deliveryAddress}</p>
                </div>
              </div>

              {/* Item details */}
              <table className="w-full text-[11px] border-t border-b border-slate-200 py-3">
                <thead>
                  <tr className="text-slate-400 text-left uppercase tracking-wider font-bold">
                    <th className="py-2">Item Description</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-right">Price</th>
                    <th className="py-2 text-right font-bold">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {invoiceOrder.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2 font-medium">{it.name}</td>
                      <td className="py-2 text-center">{it.quantity}</td>
                      <td className="py-2 text-right">₹{it.price}</td>
                      <td className="py-2 text-right font-bold font-mono">₹{it.price * it.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pricing computations */}
              <div className="space-y-1.5 text-xs text-slate-800 text-right">
                <div className="flex justify-between pl-20">
                  <span className="text-slate-500">Basket Subtotal:</span>
                  <span className="font-mono">₹{invoiceOrder.subtotal}</span>
                </div>
                <div className="flex justify-between pl-20">
                  <span className="text-slate-500">SGST (2.5%) + CGST (2.5%):</span>
                  <span className="font-mono">₹{Math.round(invoiceOrder.subtotal * 0.05)}</span>
                </div>
                <div className="flex justify-between pl-20">
                  <span className="text-slate-500">Delivery Logistics:</span>
                  <span className="font-mono">₹{invoiceOrder.deliveryCharge}</span>
                </div>
                <div className="flex justify-between pl-20 font-bold border-t border-slate-200 pt-2 text-sm text-slate-950">
                  <span>Authorized Grand Total:</span>
                  <span className="font-mono text-orange-600">₹{invoiceOrder.totalAmount}</span>
                </div>
              </div>

              {/* Authorized footer tag */}
              <div className="border-t border-slate-200 pt-4 text-center">
                <p className="text-[9px] text-slate-400 font-medium">This is a system-generated commercial invoice authorized on behalf of Ting Tong {getActiveCity().name}.</p>
                <p className="text-[10px] text-orange-600 font-bold tracking-widest mt-1">THANK YOU FOR THE TRANSACTION</p>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button 
                onClick={() => window.print()}
                className="flex-1 bg-slate-900 text-white font-bold py-2 rounded-xl text-xs hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </button>
              <button 
                onClick={() => setInvoiceOrder(null)}
                className="bg-slate-200 text-slate-800 font-bold px-6 py-2 rounded-xl text-xs hover:bg-slate-300 cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
