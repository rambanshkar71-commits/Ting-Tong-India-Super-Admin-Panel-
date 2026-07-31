import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Restaurant, Order, MenuItem } from '../types';
import {
  Store,
  Clock,
  CheckCircle2,
  XCircle,
  ChefHat,
  Package,
  TrendingUp,
  DollarSign,
  Lock,
  Star,
  Power,
  ShieldCheck,
  AlertCircle,
  Menu as MenuIcon,
  ShoppingBag,
} from 'lucide-react';

interface RestaurantPortalViewProps {
  restaurant: Restaurant;
  orders: Order[];
  menuItems: MenuItem[];
}

export default function RestaurantPortalView({
  restaurant,
  orders,
  menuItems,
}: RestaurantPortalViewProps) {
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'earnings' | 'settings'>('orders');

  // Filter orders for this restaurant
  const restOrders = orders.filter((o) => o.restaurantId === restaurant.id);
  const pendingOrders = restOrders.filter(
    (o) => o.status === 'pending' || o.status === 'accepted' || o.status === 'preparing'
  );
  const completedOrders = restOrders.filter((o) => o.status === 'delivered');

  // Toggle store open/closed
  const handleToggleStoreOpen = async () => {
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        isOpen: !restaurant.isOpen,
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      alert('Error updating store status: ' + err.message);
    }
  };

  // Update order status (Accept -> Preparing -> Ready)
  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      alert('Error updating order status: ' + err.message);
    }
  };

  // Toggle Item Stock (if not locked by Admin)
  const handleToggleItemStock = async (itemId: string, currentAvail: boolean) => {
    if (restaurant.menuLocked) {
      alert('Menu modifications are locked by Master Admin.');
      return;
    }
    try {
      await updateDoc(doc(db, 'menuItems', itemId), { isAvailable: !currentAvail });
    } catch (err: any) {
      alert('Error updating stock: ' + err.message);
    }
  };

  const totalSales = restOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const netEarnings = totalSales * (1 - (restaurant.commissionPercentage || 15) / 100);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 space-y-6 p-4 sm:p-6 animate-fade-in">
      {/* Top Banner Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4">
          <img
            src={restaurant.logoUrl}
            className="w-16 h-16 rounded-2xl object-cover bg-slate-800 border-2 border-orange-500/30"
            alt={restaurant.name}
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-100">{restaurant.name}</h2>
              <span className="bg-orange-500/10 border border-orange-500/30 text-orange-400 font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                Merchant Partner
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1">
              {restaurant.address} | Rating: <span className="text-amber-400 font-bold">{restaurant.rating} ★</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleToggleStoreOpen}
            className={`px-5 py-3 rounded-2xl font-bold text-xs transition shadow-md flex items-center gap-2 cursor-pointer ${
              restaurant.isOpen
                ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <Power className="w-4 h-4 stroke-[2.5]" />
            {restaurant.isOpen ? 'STORE IS OPEN FOR ORDERS' : 'STORE IS CLOSED'}
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-800 gap-2 pb-px">
        {[
          { id: 'orders', label: `Kitchen Orders (${pendingOrders.length})`, icon: ShoppingBag },
          { id: 'menu', label: 'Menu Catalog', icon: MenuIcon },
          { id: 'earnings', label: 'Sales & Earnings', icon: TrendingUp },
          { id: 'settings', label: 'Store Permissions & Info', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-slate-900 border-t border-x border-orange-500/50 text-orange-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: KITCHEN ORDERS QUEUE */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Live Pending Queue</span>
              <p className="text-2xl font-bold font-mono text-orange-400 mt-1">{pendingOrders.length}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Fulfilled Today</span>
              <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">{completedOrders.length}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Today's Revenue</span>
              <p className="text-2xl font-bold font-mono text-slate-100 mt-1">₹{totalSales.toLocaleString()}</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-orange-500" /> Incoming Kitchen Preparation Queue
            </h3>

            {pendingOrders.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 space-y-2">
                <ChefHat className="w-10 h-10 mx-auto text-slate-700" />
                <p className="text-xs font-semibold">No active incoming orders in preparation queue right now.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingOrders.map((o) => (
                  <div key={o.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
                    <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-[10px] font-mono font-bold text-orange-400">#{o.id.slice(-6)}</span>
                        <h4 className="font-bold text-sm text-slate-100 mt-0.5">{o.customerName}</h4>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-orange-500/10 text-orange-400 border border-orange-500/20">
                        {o.status}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <p className="text-slate-300 font-semibold">Order Items:</p>
                      <p className="text-slate-400 text-[11px] font-mono">{o.deliveryAddress}</p>
                      <p className="text-emerald-400 font-mono font-bold pt-1">Total: ₹{o.totalAmount}</p>
                    </div>

                    <div className="flex gap-2 pt-2">
                      {o.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(o.id, 'preparing')}
                          className="w-full bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold py-2 rounded-xl text-xs transition cursor-pointer"
                        >
                          Accept & Start Preparing
                        </button>
                      )}
                      {o.status === 'preparing' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(o.id, 'ready_for_pickup')}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 rounded-xl text-xs transition cursor-pointer"
                        >
                          Mark Ready for Pickup
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MENU CATALOG */}
      {activeTab === 'menu' && (
        <div className="space-y-4">
          {restaurant.menuLocked && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-4 rounded-2xl text-xs flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Menu is currently locked by Master Admin. You can view catalog items but stock controls are read-only.</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {menuItems
              .filter((it) => it.restaurantId === restaurant.id)
              .map((item) => (
                <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-slate-100">{item.name}</h4>
                      <p className="text-slate-500 text-[10px] font-mono">{item.category}</p>
                    </div>
                    <span className="font-mono font-bold text-emerald-400 text-xs">₹{item.price}</span>
                  </div>

                  <button
                    disabled={restaurant.menuLocked}
                    onClick={() => handleToggleItemStock(item.id, item.isAvailable)}
                    className={`w-full py-2 rounded-xl text-xs font-bold uppercase transition cursor-pointer disabled:opacity-50 ${
                      item.isAvailable
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {item.isAvailable ? 'In Stock' : 'Out of Stock'}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 3: EARNINGS */}
      {activeTab === 'earnings' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Gross Sales</span>
              <p className="text-2xl font-bold font-mono text-slate-100 mt-1">₹{totalSales.toLocaleString()}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Platform Commission ({restaurant.commissionPercentage || 15}%)</span>
              <p className="text-2xl font-bold font-mono text-amber-400 mt-1">
                ₹{Math.round(totalSales * ((restaurant.commissionPercentage || 15) / 100)).toLocaleString()}
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Net Payable Earnings</span>
              <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">₹{Math.round(netEarnings).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PERMISSIONS & READ-ONLY CONFIG */}
      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-2xl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-orange-400 font-bold text-xs uppercase tracking-wider border-b border-slate-800 pb-2">
              <ShieldCheck className="w-4 h-4" /> Administrative Controls & Policy Rules
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between bg-slate-950 p-3 rounded-xl border border-slate-850">
                <span className="text-slate-400">Platform Commission Rate:</span>
                <span className="font-mono font-bold text-orange-400">{restaurant.commissionPercentage || 15}% (Admin Managed)</span>
              </div>
              <div className="flex justify-between bg-slate-950 p-3 rounded-xl border border-slate-850">
                <span className="text-slate-400">GSTIN Registration:</span>
                <span className="font-mono font-bold text-slate-200">{restaurant.gstNo}</span>
              </div>
              <div className="flex justify-between bg-slate-950 p-3 rounded-xl border border-slate-850">
                <span className="text-slate-400">FSSAI License:</span>
                <span className="font-mono font-bold text-emerald-400">{restaurant.fssaiNo}</span>
              </div>
              <div className="flex justify-between bg-slate-950 p-3 rounded-xl border border-slate-850">
                <span className="text-slate-400">Payout Account:</span>
                <span className="font-mono font-bold text-slate-200">
                  {restaurant.bankName} - {restaurant.accountNumber}
                </span>
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850 text-[11px] text-slate-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-400 shrink-0" />
              <span>
                To request changes to commission rate, bank details, or store status, please contact Master Admin Support.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
