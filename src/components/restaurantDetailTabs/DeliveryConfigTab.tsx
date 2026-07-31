import React, { useState } from 'react';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Restaurant } from '../../types';
import {
  Truck,
  MapPin,
  Clock,
  DollarSign,
  ShoppingBag,
  Store,
  CheckCircle2,
  Save,
  Shield,
  Layers,
} from 'lucide-react';

interface DeliveryConfigTabProps {
  restaurant: Restaurant;
  onUpdate: () => void;
  logAdminAction: (action: string, details: string, beforeVal?: any, afterVal?: any) => Promise<void>;
}

export default function DeliveryConfigTab({
  restaurant,
  onUpdate,
  logAdminAction,
}: DeliveryConfigTabProps) {
  const [deliveryType, setDeliveryType] = useState<'tingtong_only' | 'self_delivery' | 'mixed'>(
    restaurant.deliveryType || 'tingtong_only'
  );
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState<string>(
    (restaurant.freeDeliveryThreshold ?? 499).toString()
  );
  const [maxDeliveryRadius, setMaxDeliveryRadius] = useState<string>(
    (restaurant.maxDeliveryRadiusKm ?? restaurant.deliveryRadiusKm ?? 10).toString()
  );
  const [avgPrepTimeMin, setAvgPrepTimeMin] = useState<string>(
    (restaurant.avgPrepTimeMin ?? 18).toString()
  );

  // Channel Toggles
  const [pickupEnabled, setPickupEnabled] = useState<boolean>(restaurant.pickupEnabled ?? true);
  const [deliveryEnabled, setDeliveryEnabled] = useState<boolean>(restaurant.deliveryEnabled ?? true);
  const [takeawayEnabled, setTakeawayEnabled] = useState<boolean>(restaurant.takeawayEnabled ?? true);
  const [dineInEnabled, setDineInEnabled] = useState<boolean>(restaurant.dineInEnabled ?? false);

  const [isSaving, setIsSaving] = useState(false);

  // Save Delivery Config
  const handleSaveDeliveryConfig = async () => {
    setIsSaving(true);
    try {
      const restRef = doc(db, 'restaurants', restaurant.id);
      const now = new Date().toISOString();

      const payload = {
        deliveryType,
        freeDeliveryThreshold: Number(freeDeliveryThreshold),
        maxDeliveryRadiusKm: Number(maxDeliveryRadius),
        deliveryRadiusKm: Number(maxDeliveryRadius), // Sync back
        avgPrepTimeMin: Number(avgPrepTimeMin),
        pickupEnabled,
        deliveryEnabled,
        takeawayEnabled,
        dineInEnabled,
        updatedAt: now,
      };

      await updateDoc(restRef, payload);
      await logAdminAction(
        'UPDATE_DELIVERY_CONFIG',
        `Updated delivery & channel controls for ${restaurant.name}`
      );

      alert('Delivery configuration saved successfully!');
      onUpdate();
    } catch (err: any) {
      alert('Error saving delivery config: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-400" /> Logistics & Channel Distribution Configuration
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure delivery fulfillment mode, free delivery tiers, maximum distance, and active channels.
          </p>
        </div>

        <span className="bg-orange-500/10 border border-orange-500/30 text-orange-400 font-mono text-xs font-bold px-3 py-1 rounded-full uppercase">
          Mode: {deliveryType.replace('_', ' ')}
        </span>
      </div>

      {/* Delivery Mode Selection */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
        <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
          <Layers className="w-4 h-4 text-orange-400" /> Fulfillment Delivery Mode
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Option 1: Ting Tong Rider Only */}
          <button
            type="button"
            onClick={() => setDeliveryType('tingtong_only')}
            className={`p-4 rounded-2xl border text-left space-y-2 transition cursor-pointer ${
              deliveryType === 'tingtong_only'
                ? 'bg-orange-500/10 border-orange-500 text-orange-400 shadow-md'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase font-mono">Ting Tong Fleet Only</span>
              {deliveryType === 'tingtong_only' && <CheckCircle2 className="w-4 h-4 text-orange-500" />}
            </div>
            <p className="text-[11px] text-slate-400">
              Exclusive dispatch via Ting Tong India verified delivery riders. Maximum SLA & live tracking.
            </p>
          </button>

          {/* Option 2: Self Delivery */}
          <button
            type="button"
            onClick={() => setDeliveryType('self_delivery')}
            className={`p-4 rounded-2xl border text-left space-y-2 transition cursor-pointer ${
              deliveryType === 'self_delivery'
                ? 'bg-orange-500/10 border-orange-500 text-orange-400 shadow-md'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase font-mono">Self Delivery</span>
              {deliveryType === 'self_delivery' && <CheckCircle2 className="w-4 h-4 text-orange-500" />}
            </div>
            <p className="text-[11px] text-slate-400">
              Restaurant uses its own internal delivery personnel. Commission rate may be reduced.
            </p>
          </button>

          {/* Option 3: Mixed Delivery */}
          <button
            type="button"
            onClick={() => setDeliveryType('mixed')}
            className={`p-4 rounded-2xl border text-left space-y-2 transition cursor-pointer ${
              deliveryType === 'mixed'
                ? 'bg-orange-500/10 border-orange-500 text-orange-400 shadow-md'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase font-mono">Mixed Delivery</span>
              {deliveryType === 'mixed' && <CheckCircle2 className="w-4 h-4 text-orange-500" />}
            </div>
            <p className="text-[11px] text-slate-400">
              Flexible fallback model. Auto-assigns Ting Tong riders if self-delivery riders are unavailable.
            </p>
          </button>
        </div>
      </div>

      {/* Thresholds & Operational Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Free Delivery Threshold */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-md">
          <label className="text-xs font-mono text-slate-400 block flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-emerald-400" /> Free Delivery Min. Threshold (₹)
          </label>
          <input
            type="number"
            value={freeDeliveryThreshold}
            onChange={(e) => setFreeDeliveryThreshold(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-bold font-mono text-emerald-400 outline-none focus:border-emerald-500"
          />
          <p className="text-[10px] text-slate-500">Orders above this amount get free delivery sponsored by platform/merchant rules.</p>
        </div>

        {/* Max Delivery Radius */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-md">
          <label className="text-xs font-mono text-slate-400 block flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-orange-400" /> Maximum Delivery Radius (KM)
          </label>
          <input
            type="number"
            value={maxDeliveryRadius}
            onChange={(e) => setMaxDeliveryRadius(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-bold font-mono text-orange-400 outline-none focus:border-orange-500"
          />
          <p className="text-[10px] text-slate-500">Operational geofence limit for receiving customer orders.</p>
        </div>

        {/* Avg Preparation Time */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-md">
          <label className="text-xs font-mono text-slate-400 block flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-400" /> Avg Preparation Time (Mins)
          </label>
          <input
            type="number"
            value={avgPrepTimeMin}
            onChange={(e) => setAvgPrepTimeMin(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-bold font-mono text-amber-400 outline-none focus:border-amber-500"
          />
          <p className="text-[10px] text-slate-500">Target kitchen prep SLA used for customer ETA calculations.</p>
        </div>
      </div>

      {/* Active Ordering Channels Toggles */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
        <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-orange-400" /> Permitted Sales Channels
        </h4>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Pickup */}
          <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <p className="font-bold text-xs text-slate-100">Pickup</p>
              <p className="text-[10px] text-slate-500">Self Pickup</p>
            </div>
            <input
              type="checkbox"
              checked={pickupEnabled}
              onChange={(e) => setPickupEnabled(e.target.checked)}
              className="w-4 h-4 accent-orange-500 cursor-pointer"
            />
          </div>

          {/* Delivery */}
          <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <p className="font-bold text-xs text-slate-100">Delivery</p>
              <p className="text-[10px] text-slate-500">Doorstep Delivery</p>
            </div>
            <input
              type="checkbox"
              checked={deliveryEnabled}
              onChange={(e) => setDeliveryEnabled(e.target.checked)}
              className="w-4 h-4 accent-orange-500 cursor-pointer"
            />
          </div>

          {/* Takeaway */}
          <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <p className="font-bold text-xs text-slate-100">Takeaway</p>
              <p className="text-[10px] text-slate-500">Parcel Pack</p>
            </div>
            <input
              type="checkbox"
              checked={takeawayEnabled}
              onChange={(e) => setTakeawayEnabled(e.target.checked)}
              className="w-4 h-4 accent-orange-500 cursor-pointer"
            />
          </div>

          {/* Dine-In */}
          <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <p className="font-bold text-xs text-slate-100">Dine-In</p>
              <p className="text-[10px] text-slate-500">Table Ordering</p>
            </div>
            <input
              type="checkbox"
              checked={dineInEnabled}
              onChange={(e) => setDineInEnabled(e.target.checked)}
              className="w-4 h-4 accent-orange-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-end pt-4 border-t border-slate-800">
        <button
          onClick={handleSaveDeliveryConfig}
          disabled={isSaving}
          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 px-6 py-2.5 rounded-xl font-bold text-xs transition shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-40"
        >
          <Save className="w-4 h-4 stroke-[2.5]" /> Save Delivery Configuration
        </button>
      </div>
    </div>
  );
}
