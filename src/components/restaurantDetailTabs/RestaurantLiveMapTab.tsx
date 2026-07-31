import React, { useState } from 'react';
import { Restaurant, Order } from '../../types';
import { MapPin, Navigation, Bike, User, Compass, Layers, ShieldCheck } from 'lucide-react';

interface RestaurantLiveMapTabProps {
  restaurant: Restaurant;
  orders: Order[];
}

export default function RestaurantLiveMapTab({ restaurant, orders }: RestaurantLiveMapTabProps) {
  const [showRiders, setShowRiders] = useState(true);
  const [showCustomers, setShowCustomers] = useState(true);
  const [showRadius, setShowRadius] = useState(true);

  const lat = restaurant.lat || 28.6139; // Default Delhi
  const lng = restaurant.lng || 77.209;
  const radiusKm = restaurant.deliveryRadiusKm || 7;

  // Active live orders
  const activeOrders = orders.filter(
    (o) => o.restaurantId === restaurant.id && o.status !== 'delivered' && o.status !== 'cancelled'
  );

  // OpenStreetMap embed URL with bbox around location
  const delta = radiusKm * 0.015;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Compass className="w-5 h-5 text-emerald-400" /> OpenStreetMap Live Geofence & Active Fulfillment Radar
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Geospatial tracking of merchant store location, delivery radius boundary ({radiusKm} km), active orders, and live rider positions.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono font-bold">
          <span className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-emerald-400 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Lat: {lat.toFixed(4)}, Lng: {lng.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Layer Toggles & Stats Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <label className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-850 cursor-pointer">
            <input
              type="checkbox"
              checked={showRadius}
              onChange={(e) => setShowRadius(e.target.checked)}
              className="accent-emerald-500 rounded"
            />
            <span className="text-slate-300">Delivery Radius Circle ({radiusKm} km)</span>
          </label>

          <label className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-850 cursor-pointer">
            <input
              type="checkbox"
              checked={showRiders}
              onChange={(e) => setShowRiders(e.target.checked)}
              className="accent-cyan-500 rounded"
            />
            <span className="text-slate-300">Active Riders ({activeOrders.filter((o) => o.riderName).length})</span>
          </label>

          <label className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-850 cursor-pointer">
            <input
              type="checkbox"
              checked={showCustomers}
              onChange={(e) => setShowCustomers(e.target.checked)}
              className="accent-orange-500 rounded"
            />
            <span className="text-slate-300">Active Customer Destinations ({activeOrders.length})</span>
          </label>
        </div>

        <a
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=14/${lat}/${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition flex items-center gap-1.5"
        >
          <Navigation className="w-3.5 h-3.5" /> Open in OSM Maps
        </a>
      </div>

      {/* Map Display & Live Overlay Canvas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* OpenStreetMap Map Frame */}
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl relative h-[450px]">
          <iframe
            title="OpenStreetMap View"
            src={osmEmbedUrl}
            className="w-full h-full border-0 filter brightness-90 contrast-110"
          />

          {/* Interactive Radar Badge Overlay */}
          <div className="absolute top-4 left-4 bg-slate-950/90 backdrop-blur-md border border-slate-800 p-3 rounded-2xl space-y-1 font-mono text-xs shadow-2xl">
            <div className="flex items-center gap-2 text-orange-400 font-bold">
              <span className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-ping" />
              <span>{restaurant.name}</span>
            </div>
            <p className="text-[10px] text-slate-400">{restaurant.address}</p>
          </div>
        </div>

        {/* Live Active Destination Points */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md max-h-[450px] overflow-y-auto">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
            <Layers className="w-4 h-4 text-orange-400" /> Active Destination Waypoints
          </h4>

          {activeOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-mono text-xs">
              No live active orders on the map for this restaurant.
            </div>
          ) : (
            activeOrders.map((o) => (
              <div key={o.id} className="bg-slate-950 border border-slate-850 p-3.5 rounded-xl space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-orange-400 font-bold">#{o.id.slice(-6)}</span>
                  <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[9px] uppercase font-bold">
                    {o.status}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-200 font-sans font-semibold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" /> {o.customerName}
                  </p>
                  <p className="text-slate-400 text-[10px] flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" /> {o.deliveryAddress}
                  </p>
                </div>
                {o.riderName && (
                  <div className="border-t border-slate-850 pt-1.5 flex items-center justify-between text-[10px] text-cyan-400">
                    <span className="flex items-center gap-1">
                      <Bike className="w-3 h-3" /> {o.riderName}
                    </span>
                    <span>En Route</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
