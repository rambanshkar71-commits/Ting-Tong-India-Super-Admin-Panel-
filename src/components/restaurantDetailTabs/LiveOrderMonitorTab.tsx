import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Order, Restaurant } from '../../types';
import {
  Clock,
  Bike,
  User,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sliders,
  Phone,
  MapPin,
  Flame,
} from 'lucide-react';

interface LiveOrderMonitorTabProps {
  restaurant: Restaurant;
  orders: Order[];
  logAdminAction?: (action: string, details: string) => Promise<void>;
}

export default function LiveOrderMonitorTab({ restaurant, orders, logAdminAction }: LiveOrderMonitorTabProps) {
  const [filter, setFilter] = useState<'all' | 'live' | 'delayed' | 'completed'>('live');
  const [now, setNow] = useState<Date>(new Date());

  // Update timer every second for accurate countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const restOrders = orders.filter((o) => o.restaurantId === restaurant.id);

  const liveOrders = restOrders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled'
  );

  const delayedOrders = liveOrders.filter((o) => {
    const elapsedMins = (now.getTime() - new Date(o.createdAt).getTime()) / 60000;
    return elapsedMins > (restaurant.prepSlaMinutes || 20);
  });

  const displayOrders = restOrders.filter((o) => {
    if (filter === 'live') return o.status !== 'delivered' && o.status !== 'cancelled';
    if (filter === 'delayed') {
      const elapsedMins = (now.getTime() - new Date(o.createdAt).getTime()) / 60000;
      return o.status !== 'delivered' && o.status !== 'cancelled' && elapsedMins > (restaurant.prepSlaMinutes || 20);
    }
    if (filter === 'completed') return o.status === 'delivered';
    return true;
  });

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      if (logAdminAction) {
        await logAdminAction('MANUAL_ORDER_INTERVENTION', `Admin changed Order #${orderId.slice(-6)} status to ${newStatus}`);
      }
      alert(`Order status updated to ${newStatus}`);
    } catch (err: any) {
      alert('Error updating order: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      {/* Top Monitor Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" /> Kitchen Live Order & SLA Monitor
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time fulfillment tracking, prep countdowns, rider dispatch statuses, and manual admin overrides.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(['live', 'delayed', 'completed', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-xl text-xs font-bold font-mono uppercase transition cursor-pointer border ${
                filter === f
                  ? 'bg-orange-500/10 border-orange-500/50 text-orange-400'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'delayed' ? `Delayed (${delayedOrders.length})` : f}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Active Kitchen Queue</span>
          <p className="text-xl font-bold font-mono text-orange-400 mt-0.5">{liveOrders.length} Orders</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">SLA Delayed Orders</span>
          <p className={`text-xl font-bold font-mono mt-0.5 ${delayedOrders.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {delayedOrders.length} Alerting
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Completed Today</span>
          <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
            {restOrders.filter((o) => o.status === 'delivered').length} Orders
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Target Prep SLA</span>
          <p className="text-xl font-bold font-mono text-indigo-400 mt-0.5">{restaurant.prepSlaMinutes || 20} Mins</p>
        </div>
      </div>

      {/* Orders List / Cards */}
      <div className="space-y-4">
        {displayOrders.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 font-mono text-xs">
            No live orders found matching the selected filter ({filter}).
          </div>
        ) : (
          displayOrders.map((order) => {
            const elapsedMins = Math.max(0, Math.floor((now.getTime() - new Date(order.createdAt).getTime()) / 60000));
            const elapsedSecs = Math.max(0, Math.floor(((now.getTime() - new Date(order.createdAt).getTime()) % 60000) / 1000));
            const isSlaDelayed = elapsedMins > (restaurant.prepSlaMinutes || 20) && order.status !== 'delivered' && order.status !== 'cancelled';

            return (
              <div
                key={order.id}
                className={`bg-slate-900 border rounded-2xl p-5 space-y-4 shadow-md transition ${
                  isSlaDelayed ? 'border-rose-500/50 bg-rose-950/10' : 'border-slate-800'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="bg-orange-500/10 border border-orange-500/20 text-orange-400 px-2.5 py-1 rounded-xl font-mono text-xs font-bold">
                      #{order.id.slice(-6)}
                    </span>
                    <div>
                      <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" /> {order.customerName || 'Customer'}
                      </h4>
                      <p className="text-slate-400 text-[10px] font-mono flex items-center gap-2 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-500" /> {order.deliveryAddress || 'Local Address'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="text-slate-400">Total: <strong className="text-slate-100">₹{order.totalAmount}</strong></span>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      order.status === 'delivered'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : order.status === 'cancelled'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>

                {/* Live Timers and Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" /> Elapsed Prep Time
                    </span>
                    <span className={`text-base font-bold block ${isSlaDelayed ? 'text-rose-400' : 'text-slate-200'}`}>
                      {elapsedMins}m {elapsedSecs}s
                    </span>
                    {isSlaDelayed && (
                      <span className="text-[10px] text-rose-400 flex items-center gap-1 font-bold">
                        <AlertTriangle className="w-3 h-3" /> SLA VIOLATION (+{elapsedMins - (restaurant.prepSlaMinutes || 20)}m)
                      </span>
                    )}
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                      <Bike className="w-3 h-3 text-cyan-400" /> Assigned Delivery Partner
                    </span>
                    <span className="text-slate-200 font-bold block">
                      {order.riderName || 'Pending Rider Allocation'}
                    </span>
                    <span className="text-[10px] text-slate-400 block">{order.riderPhone || 'N/A'}</span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase block">Items Count</span>
                    <span className="text-slate-200 font-bold block">{order.items?.length || 0} Items</span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {order.items?.map((i) => i.name).join(', ') || 'Custom Dish'}
                    </span>
                  </div>
                </div>

                {/* Admin Manual Interventions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-850">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Admin Intervention:</span>
                  <div className="flex items-center gap-2">
                    {order.status === 'pending' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(order.id, 'accepted')}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition"
                      >
                        Force Accept Order
                      </button>
                    )}
                    {order.status === 'accepted' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(order.id, 'ready')}
                        className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition"
                      >
                        Mark Ready for Dispatch
                      </button>
                    )}
                    {order.status !== 'delivered' && order.status !== 'cancelled' && (
                      <>
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                          className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition"
                        >
                          Force Complete
                        </button>
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition"
                        >
                          Cancel Order
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
