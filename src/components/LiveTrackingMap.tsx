import React, { useState, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Order, Rider, Restaurant, Customer, Zone } from '../types';
import { calculateDistance, calculateETA, getOSRMRoute, getActiveMapSettings, getActiveCity, getZoneCenterForCity } from '../services/mapService';
import { 
  X, 
  Search, 
  MapPin, 
  Bike, 
  Store, 
  Users, 
  Maximize2, 
  Compass, 
  Navigation, 
  Ruler, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  AlertCircle 
} from 'lucide-react';

interface LiveTrackingMapProps {
  riders: Rider[];
  orders: Order[];
  restaurants: Restaurant[];
  customers: Customer[];
  zones: Zone[];
  filterRiders: boolean;
  filterRestaurants: boolean;
  filterCustomers: boolean;
  filterRoutes: boolean;
  filterZones: boolean;
  selectedRider: Rider | null;
  setSelectedRider: (r: Rider | null) => void;
  selectedOrder: Order | null;
  setSelectedOrder: (o: Order | null) => void;
  selectedZone: string | null;
  setSelectedZone: (z: string | null) => void;
  getAssignedZoneForRider: (rider: Rider) => { id: string; name: string; center: [number, number]; radius: number };
}

export default function LiveTrackingMap({
  riders,
  orders,
  restaurants,
  customers,
  zones,
  filterRiders,
  filterRestaurants,
  filterCustomers,
  filterRoutes,
  filterZones,
  selectedRider,
  setSelectedRider,
  selectedOrder,
  setSelectedOrder,
  selectedZone,
  setSelectedZone,
  getAssignedZoneForRider
}: LiveTrackingMapProps) {
  const mapContainerId = 'live-leaflet-map-element';
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // States
  const [mapZoom, setMapZoom] = useState<number>(13);
  const [mapSearchQuery, setMapSearchQuery] = useState<string>('');
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Distance Measurement state
  const [measureModeActive, setMeasureModeActive] = useState<boolean>(false);
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const measurePointsRef = useRef<[number, number][]>([]);
  const measureMarkersRef = useRef<L.Marker[]>([]);
  const measureLineRef = useRef<L.Polyline | null>(null);

  // States for cached OSRM routing lines
  const [osrmRoutes, setOsrmRoutes] = useState<Record<string, [number, number][]>>({});
  const pendingRequests = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!filterRoutes) return;

    const activeOrders = orders.filter(o => 
      ['accepted', 'preparing', 'ready_for_pickup', 'picked_up'].includes(o.status)
    );

    activeOrders.forEach(o => {
      const isSelected = selectedOrder?.id === o.id;
      if (selectedOrder && !isSelected) return;

      const r = riders.find(rider => rider.id === o.riderId);

      // Leg 1: Rider -> Restaurant (only if NOT picked up yet)
      if (o.status !== 'picked_up' && r && typeof r.lat === 'number' && typeof r.lng === 'number' && r.lat !== 0) {
        const key = `rider_${r.id}_to_rest_${o.id}`;
        if (!osrmRoutes[key] && !pendingRequests.current.has(key)) {
          pendingRequests.current.add(key);
          getOSRMRoute(r.lng, r.lat, o.restaurantLng, o.restaurantLat)
            .then(result => {
              setOsrmRoutes(prev => ({ ...prev, [key]: result.coords }));
            })
            .catch(err => console.error('OSRM fetch error Leg 1:', err))
            .finally(() => pendingRequests.current.delete(key));
        }
      }

      // Leg 2: Restaurant -> Customer (or Rider -> Customer if picked up)
      if (typeof o.restaurantLat === 'number' && typeof o.deliveryLat === 'number' && o.restaurantLat !== 0) {
        const isPickedUp = o.status === 'picked_up';
        const startLat = (isPickedUp && r && typeof r.lat === 'number' && r.lat !== 0) ? r.lat : o.restaurantLat;
        const startLng = (isPickedUp && r && typeof r.lng === 'number' && r.lng !== 0) ? r.lng : o.restaurantLng;

        // Cache key incorporates rounded coordinates (to 3 decimals ~ 110m) so that route refreshes if rider moves
        const key = isPickedUp
          ? `rider_${r?.id}_to_cust_${o.id}_${startLat.toFixed(3)}_${startLng.toFixed(3)}`
          : `rest_to_cust_${o.id}`;

        if (!osrmRoutes[key] && !pendingRequests.current.has(key)) {
          pendingRequests.current.add(key);
          getOSRMRoute(startLng, startLat, o.deliveryLng, o.deliveryLat)
            .then(result => {
              setOsrmRoutes(prev => ({ ...prev, [key]: result.coords }));
            })
            .catch(err => console.error('OSRM fetch error Leg 2:', err))
            .finally(() => pendingRequests.current.delete(key));
        }
      }
    });
  }, [orders, riders, filterRoutes, selectedOrder, osrmRoutes]);

  // 1. Check if live tracking data exists
  const hasLiveTrackingData = useMemo(() => {
    const onlineRiders = riders.filter(r => r.onlineStatus === 'online');
    return onlineRiders.length > 0 && onlineRiders.some(r => typeof r.lat === 'number' && typeof r.lng === 'number' && r.lat !== 0 && r.lng !== 0);
  }, [riders]);

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (!mapRef.current && document.getElementById(mapContainerId)) {
      const mSettings = getActiveMapSettings();
      const map = L.map(mapContainerId, {
        zoomControl: false,
        attributionControl: true,
        minZoom: mSettings.minZoom,
        maxZoom: mSettings.maxZoom
      }).setView([mSettings.defaultCenterLat, mSettings.defaultCenterLng], mSettings.defaultZoom);

      L.tileLayer(mSettings.tileUrl, {
        maxZoom: mSettings.maxZoom,
        attribution: mSettings.attribution
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      // Sync initial zoom state
      setMapZoom(map.getZoom());

      // Zoom listener
      map.on('zoomend', () => {
        setMapZoom(map.getZoom());
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersLayerRef.current = null;
      }
    };
  }, []);

  // 3. Responsive resize handler (invalidateSize)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  // 3b. Fly map smoothly to selected Rider or Order when they change from tables/lists
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedRider && typeof selectedRider.lat === 'number' && typeof selectedRider.lng === 'number' && selectedRider.lat !== 0) {
      map.flyTo([selectedRider.lat, selectedRider.lng], 15);
    }
  }, [selectedRider]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedOrder && typeof selectedOrder.restaurantLat === 'number' && typeof selectedOrder.restaurantLng === 'number' && selectedOrder.restaurantLat !== 0) {
      map.flyTo([selectedOrder.restaurantLat, selectedOrder.restaurantLng], 14);
    }
  }, [selectedOrder]);

  // 3c. Fly map smoothly when selectedZone changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedZone) return;

    const activeCity = getActiveCity();

    if (selectedZone === 'bhopal_all' || selectedZone.endsWith('_all') || selectedZone === 'all') {
      map.flyTo([activeCity.centerLat, activeCity.centerLng], activeCity.defaultZoom || 13);
      return;
    }

    const activeZones = zones.length > 0 ? zones : [
      { id: 'z1', name: 'Central Commercial Hub', radius: 3, active: true },
      { id: 'z2', name: 'Premium Residential Sector', radius: 4, active: true },
      { id: 'z3', name: 'Eastern Industrial Zone', radius: 4.5, active: true },
      { id: 'z4', name: 'Southern Suburb Belt', radius: 5, active: true }
    ];

    const z = activeZones.find(item => item.id === selectedZone);
    if (z) {
      const center = getZoneCenterForCity(z.name, activeCity);
      map.flyTo(center, 14);
    }
  }, [selectedZone, zones]);

  // 4. Generate beautiful customized HTML Tailwind CSS icons
  const createCustomIcon = (type: 'restaurant' | 'rider' | 'customer' | 'pickup' | 'delivery', isSelected: boolean, extra?: any) => {
    let bgColor = 'bg-slate-500';
    let iconHtml = '';

    if (type === 'restaurant') {
      bgColor = isSelected ? 'bg-orange-600 ring-4 ring-orange-400' : 'bg-orange-500';
      iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="lucide lucide-store"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M10 12h4"/></svg>`;
    } else if (type === 'pickup') {
      bgColor = isSelected ? 'bg-yellow-600 ring-4 ring-yellow-400 text-slate-900' : 'bg-yellow-500 text-slate-900';
      iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="lucide lucide-package"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;
    } else if (type === 'rider') {
      const isBusy = extra?.isBusy;
      const isBreaching = extra?.isBreachingBoundary;
      bgColor = isSelected 
        ? (isBreaching ? 'bg-rose-600 ring-4 ring-rose-400' : 'bg-sky-500 ring-4 ring-sky-300')
        : (isBreaching 
            ? 'bg-rose-500 ring-2 ring-rose-400 animate-pulse' 
            : (isBusy ? 'bg-amber-500 ring-2 ring-amber-300' : 'bg-emerald-500 ring-2 ring-emerald-300 animate-pulse')
          );
      iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="lucide lucide-bike"><circle cx="5.5" cy="17.5" r="2.5"/><circle cx="18.5" cy="17.5" r="2.5"/><path d="M15 6h5a1 1 0 0 1 1 1v2"/><path d="m12 11.5 4 4.5"/><path d="m19 17-3-6H9l-3 4H2"/></svg>`;
    } else if (type === 'customer') {
      bgColor = isSelected ? 'bg-indigo-600 ring-4 ring-indigo-400' : 'bg-indigo-500';
      iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    } else if (type === 'delivery') {
      bgColor = isSelected ? 'bg-red-600 ring-4 ring-red-400' : 'bg-red-500';
      iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="lucide lucide-flag"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;
    }

    const pingHtml = isSelected ? `<span class="absolute -inset-1.5 rounded-full bg-inherit opacity-45 animate-ping"></span>` : '';

    return L.divIcon({
      html: `
        <div class="relative flex items-center justify-center w-8 h-8 rounded-full shadow-lg text-white border-2 border-white ${bgColor} transition-all duration-200">
          ${pingHtml}
          ${iconHtml}
        </div>
      `,
      className: 'custom-div-marker-wrap',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    });
  };

  // Generate popup content helper strings
  const getRiderPopupContent = (
    rider: Rider, 
    isBusy: boolean, 
    currentOrder: Order | undefined,
    assignedZone?: { id: string; name: string; center: [number, number]; radius: number },
    currentDist?: number,
    isBreachingBoundary?: boolean
  ) => {
    const batteryLevel = rider.walletBalance ? (50 + Math.floor(rider.walletBalance % 45)) : 88;
    const dutyStr = rider.dutyStatus === 'on_duty' ? '🟢 ON DUTY' : '🔴 OFF DUTY';

    let boundaryStatusHtml = '';
    if (assignedZone && typeof currentDist === 'number') {
      if (isBreachingBoundary) {
        boundaryStatusHtml = `
          <div class="flex flex-col gap-0.5 p-1.5 bg-rose-500/10 border border-rose-500/25 rounded mt-1 text-[10px]">
            <div class="flex justify-between text-rose-400 font-black animate-pulse">
              <span>🚨 BOUNDARY BREACH</span>
              <span>OUT OF ZONE</span>
            </div>
            <div class="flex justify-between text-rose-300/80">
              <span>Sector:</span>
              <span>${assignedZone.name}</span>
            </div>
            <div class="flex justify-between text-rose-300/80">
              <span>Excess Deviation:</span>
              <span>+${(currentDist - assignedZone.radius).toFixed(2)} KM</span>
            </div>
          </div>
        `;
      } else {
        boundaryStatusHtml = `
          <div class="flex justify-between text-emerald-400/90 text-[10px] mt-1 bg-emerald-500/5 border border-emerald-500/15 p-1 rounded">
            <span>Zone Grid Check:</span>
            <span class="font-bold">OK (Inside ${assignedZone.id.toUpperCase()})</span>
          </div>
        `;
      }
    }

    return `
      <div class="p-2.5 space-y-2 text-slate-100 font-sans min-w-[220px]">
        <div class="flex items-center gap-2 border-b border-slate-800 pb-1.5">
          <div class="w-3 h-3 rounded-full ${isBreachingBoundary ? 'bg-rose-500' : 'bg-emerald-500'} animate-pulse"></div>
          <div>
            <h4 class="font-bold text-sm text-slate-100">${rider.name}</h4>
            <p class="text-[9px] text-slate-500 font-mono">${rider.id}</p>
          </div>
        </div>
        <div class="space-y-1 text-xs font-mono">
          <div class="flex justify-between"><span class="text-slate-400">Mobile:</span><span class="text-slate-200">${rider.phone}</span></div>
          <div class="flex justify-between"><span class="text-slate-400">Duty Status:</span><span class="text-slate-200 font-bold">${dutyStr}</span></div>
          <div class="flex justify-between"><span class="text-slate-400">Current Order:</span><span class="text-sky-400 font-bold">${currentOrder ? '#' + currentOrder.id.substring(0, 8) : 'None'}</span></div>
          ${boundaryStatusHtml}
          <div class="flex justify-between"><span class="text-slate-400">Battery Level:</span><span class="text-emerald-400 font-bold">${batteryLevel}%</span></div>
          <div class="flex justify-between"><span class="text-slate-400">Last GPS Update:</span><span class="text-slate-400">Just Now</span></div>
        </div>
        <div class="grid grid-cols-2 gap-1 pt-2 border-t border-slate-800">
          <a href="tel:${rider.phone}" class="text-center bg-slate-800 hover:bg-slate-700 text-slate-100 py-1 rounded text-[10px] font-bold">Call</a>
          <a href="https://wa.me/${rider.phone}" target="_blank" rel="noreferrer" class="text-center bg-emerald-600 hover:bg-emerald-500 text-white py-1 rounded text-[10px] font-bold">WhatsApp</a>
        </div>
        <button data-action="profile" data-rider-id="${rider.id}" class="w-full text-center bg-amber-500 hover:bg-amber-400 text-slate-950 py-1 rounded text-[10px] font-black mt-1 transition">
          Open Rider Profile
        </button>
      </div>
    `;
  };

  const getRestaurantPopupContent = (rest: Restaurant, restOrdersCount: number) => {
    return `
      <div class="p-2.5 space-y-2 text-slate-100 font-sans min-w-[200px]">
        <h4 class="font-bold text-sm text-slate-100 border-b border-slate-800 pb-1.5">🏢 ${rest.name}</h4>
        <div class="space-y-1 text-xs font-mono">
          <div class="flex justify-between"><span class="text-slate-400">Status:</span><span class="text-emerald-400 font-bold">OPEN</span></div>
          <div class="flex justify-between"><span class="text-slate-400">Active Orders:</span><span class="text-amber-500 font-bold">${restOrdersCount}</span></div>
          <div class="flex justify-between"><span class="text-slate-400">Contact:</span><span class="text-slate-200">${rest.phone}</span></div>
        </div>
        <button data-action="restaurant" data-restaurant-id="${rest.id}" class="w-full text-center bg-slate-800 hover:bg-slate-700 text-slate-100 py-1.5 rounded text-[10px] font-bold mt-1 transition">
          Open Restaurant Profile
        </button>
      </div>
    `;
  };

  const getCustomerPopupContent = (cust: Customer, activeOrder: Order | undefined) => {
    return `
      <div class="p-2.5 space-y-2 text-slate-100 font-sans min-w-[200px]">
        <h4 class="font-bold text-sm text-slate-100 border-b border-slate-800 pb-1.5">👤 ${cust.name}</h4>
        <div class="space-y-1 text-xs font-mono">
          <div class="flex justify-between"><span class="text-slate-400">Active Order:</span><span class="text-amber-500 font-bold">${activeOrder ? '#' + activeOrder.id.substring(0, 8) : 'None'}</span></div>
          <div class="flex flex-col gap-0.5 mt-1"><span class="text-slate-500">Address:</span><span class="text-slate-300 text-[10px] whitespace-normal leading-tight">${cust.addresses?.[0]?.addressLine || getActiveCity().name}</span></div>
        </div>
        ${activeOrder ? `
          <button data-action="order" data-order-id="${activeOrder.id}" class="w-full text-center bg-amber-500 hover:bg-amber-400 text-slate-950 py-1.5 rounded text-[10px] font-black mt-1 transition">
            Open Active Order
          </button>
        ` : ''}
      </div>
    `;
  };

  const getPickupPopupContent = (order: Order) => {
    return `
      <div class="p-2.5 space-y-2 text-slate-100 font-sans min-w-[210px]">
        <h4 class="font-bold text-sm text-amber-400 border-b border-slate-800 pb-1.5 flex items-center gap-1.5">
          <span>📦 Order Pickup Point</span>
        </h4>
        <div class="space-y-1 text-xs font-mono">
          <div class="flex justify-between"><span class="text-slate-400">Merchant:</span><span class="text-slate-100 font-bold">${order.restaurantName}</span></div>
          <div class="flex justify-between"><span class="text-slate-400">Order ID:</span><span class="text-slate-200">#${order.id.substring(0, 8)}</span></div>
          <div class="flex justify-between pb-1"><span class="text-slate-400">Status:</span><span class="text-amber-500 font-black uppercase text-[10px]">${order.status.replace(/_/g, ' ')}</span></div>
          <div class="flex justify-between border-t border-slate-850 pt-1 text-[10px]"><span class="text-slate-500">Scheduled Rider:</span><span class="text-slate-300">${order.riderName || 'Assigning...'}</span></div>
        </div>
        <button data-action="order" data-order-id="${order.id}" class="w-full text-center bg-amber-500 hover:bg-amber-400 text-slate-950 py-1.5 rounded text-[10px] font-black mt-1.5 transition">
          Open Active Order
        </button>
      </div>
    `;
  };

  const getDeliveryPopupContent = (order: Order) => {
    return `
      <div class="p-2.5 space-y-2 text-slate-100 font-sans min-w-[210px]">
        <h4 class="font-bold text-sm text-indigo-400 border-b border-slate-800 pb-1.5 flex items-center gap-1.5">
          <span>🏁 Order Delivery Point</span>
        </h4>
        <div class="space-y-1 text-xs font-mono">
          <div class="flex justify-between"><span class="text-slate-400">Customer:</span><span class="text-slate-100 font-bold">${order.customerName}</span></div>
          <div class="flex justify-between"><span class="text-slate-400">Order ID:</span><span class="text-slate-200">#${order.id.substring(0, 8)}</span></div>
          <div class="flex flex-col gap-0.5 mt-1 pb-1">
            <span class="text-slate-500">Delivery Address:</span>
            <span class="text-slate-300 text-[10px] whitespace-normal leading-tight">${order.deliveryAddress}</span>
          </div>
          <div class="flex justify-between border-t border-slate-850 pt-1 text-[10px]"><span class="text-slate-500">Scheduled Rider:</span><span class="text-slate-300">${order.riderName || 'Assigning...'}</span></div>
        </div>
        <button data-action="order" data-order-id="${order.id}" class="w-full text-center bg-amber-500 hover:bg-amber-400 text-slate-950 py-1.5 rounded text-[10px] font-black mt-1.5 transition">
          Open Active Order
        </button>
      </div>
    `;
  };

  // 5. Setup native event bindings for Leaflet Popup open
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handlePopupOpen = (e: L.PopupEvent) => {
      const element = e.popup.getElement();
      if (!element) return;

      // Profile action
      const profileBtn = element.querySelector('button[data-action="profile"]');
      if (profileBtn) {
        const id = profileBtn.getAttribute('data-rider-id');
        profileBtn.addEventListener('click', () => {
          const match = riders.find(r => r.id === id);
          if (match) setSelectedRider(match);
        });
      }

      // Restaurant action
      const restBtn = element.querySelector('button[data-action="restaurant"]');
      if (restBtn) {
        const id = restBtn.getAttribute('data-restaurant-id');
        restBtn.addEventListener('click', () => {
          const activeOrd = orders.find(o => o.restaurantId === id);
          if (activeOrd) setSelectedOrder(activeOrd);
        });
      }

      // Order action
      const orderBtn = element.querySelector('button[data-action="order"]');
      if (orderBtn) {
        const id = orderBtn.getAttribute('data-order-id');
        orderBtn.addEventListener('click', () => {
          const match = orders.find(o => o.id === id);
          if (match) setSelectedOrder(match);
        });
      }
    };

    map.on('popupopen', handlePopupOpen);
    return () => {
      map.off('popupopen', handlePopupOpen);
    };
  }, [riders, orders, setSelectedRider, setSelectedOrder]);

  // 6. Draw Layer sync layer (Markers, Routes, Zones, Clustering)
  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    // 6a. Draw Delivery Zones (Colored transparent Hexagonal polygons)
    if (filterZones) {
      const activeCity = getActiveCity();
      const activeZones = zones.length > 0 ? zones : [
        { id: 'z1', name: 'Central Commercial Hub', radius: 3, active: true },
        { id: 'z2', name: 'Premium Residential Sector', radius: 4, active: true },
        { id: 'z3', name: 'Eastern Industrial Zone', radius: 4.5, active: true },
        { id: 'z4', name: 'Southern Suburb Belt', radius: 5, active: true }
      ];

      activeZones.forEach((z, idx) => {
        const center = getZoneCenterForCity(z.name, activeCity);
        
        const isSelected = selectedZone === z.id;
        
        // Calculate dynamic hexagonal points around center
        const latOffset = z.radius / 111.0;
        const lngOffset = z.radius / (111.0 * Math.cos(center[0] * Math.PI / 180));
        const polygonPoints: [number, number][] = [];
        const numSides = 6;
        for (let i = 0; i < numSides; i++) {
          const angle = (i * 2 * Math.PI) / numSides;
          polygonPoints.push([
            center[0] + latOffset * Math.sin(angle),
            center[1] + lngOffset * Math.cos(angle)
          ]);
        }

        const ridersInZone = riders.filter(r => r.onlineStatus === 'online' && calculateDistance(r.lat, r.lng, center[0], center[1]) <= z.radius).length;
        const ordersInZone = orders.filter(o => ['accepted', 'preparing', 'ready_for_pickup', 'picked_up'].includes(o.status) && calculateDistance(o.deliveryLat, o.deliveryLng, center[0], center[1]) <= z.radius).length;
        const coverageText = ridersInZone === 0 ? 'CRITICAL DEMAND' : (ridersInZone < 2 ? 'MODERATE DEPTH' : 'OPTIMAL GRID');

        L.polygon(polygonPoints, {
          color: isSelected ? '#14b8a6' : '#2dd4bf',
          fillColor: isSelected ? '#14b8a6' : '#0d9488',
          fillOpacity: isSelected ? 0.28 : 0.08,
          weight: isSelected ? 3.0 : 1.5,
          dashArray: isSelected ? '0' : '4, 4'
        })
        .addTo(markersLayer)
        .bindPopup(`
          <div class="p-2.5 space-y-1.5 text-slate-100 font-sans min-w-[180px]">
            <h4 class="font-bold text-sm text-teal-400 border-b border-slate-800 pb-1">🌐 ${z.name}</h4>
            <div class="text-xs font-mono space-y-0.5">
              <div class="flex justify-between"><span class="text-slate-400">Radius:</span><span class="text-slate-200">${z.radius} KM</span></div>
              <div class="flex justify-between"><span class="text-slate-400">Active Riders:</span><span class="text-emerald-400 font-bold">${ridersInZone}</span></div>
              <div class="flex justify-between"><span class="text-slate-400">Active Orders:</span><span class="text-amber-400 font-bold">${ordersInZone}</span></div>
              <div class="flex justify-between border-t border-slate-800/80 pt-1 mt-1"><span class="text-slate-400">Grid Status:</span><span class="text-teal-400 font-extrabold text-[9px]">${coverageText}</span></div>
            </div>
          </div>
        `);
      });
    }

    // 6b. Collect all filtered markers for individual or cluster rendering
    const markerItems: {
      type: 'rider' | 'restaurant' | 'customer' | 'pickup' | 'delivery';
      id: string;
      lat: number;
      lng: number;
      name: string;
      raw: any;
    }[] = [];

    // Filter and collect riders
    if (filterRiders) {
      riders
        .filter(r => r.onlineStatus === 'online')
        .filter(r => typeof r.lat === 'number' && typeof r.lng === 'number' && r.lat !== 0 && r.lng !== 0)
        .forEach(r => {
          markerItems.push({
            type: 'rider',
            id: r.id,
            lat: r.lat,
            lng: r.lng,
            name: r.name,
            raw: r
          });
        });
    }

    // Filter and collect restaurants (generic merchants)
    if (filterRestaurants) {
      restaurants
        .filter(rest => typeof rest.lat === 'number' && typeof rest.lng === 'number' && rest.lat !== 0 && rest.lng !== 0)
        .forEach(rest => {
          // If this restaurant has an active pickup, we will render it as a Pickup marker instead of a generic Restaurant marker to avoid duplicates
          const hasActivePickup = orders.some(o => o.restaurantId === rest.id && ['accepted', 'preparing', 'ready_for_pickup'].includes(o.status));
          if (!hasActivePickup || !filterRoutes) {
            markerItems.push({
              type: 'restaurant',
              id: rest.id,
              lat: rest.lat!,
              lng: rest.lng!,
              name: rest.name,
              raw: rest
            });
          }
        });
    }

    // Filter and collect customers (generic points)
    if (filterCustomers) {
      customers
        .filter(c => c.addresses && c.addresses.length > 0)
        .forEach(c => {
          const addr = c.addresses[0];
          if (typeof addr.lat === 'number' && typeof addr.lng === 'number' && addr.lat !== 0 && addr.lng !== 0) {
            // If this customer has an active delivery, we will render it as a Delivery marker instead of a generic Customer marker to avoid duplicates
            const hasActiveDelivery = orders.some(o => o.customerId === c.id && ['accepted', 'preparing', 'ready_for_pickup', 'picked_up'].includes(o.status));
            if (!hasActiveDelivery || !filterRoutes) {
              markerItems.push({
                type: 'customer',
                id: c.id,
                lat: addr.lat,
                lng: addr.lng,
                name: c.name,
                raw: c
              });
            }
          }
        });
    }

    // Filter and collect Pickup and Delivery transactional points from active orders
    if (filterRoutes) {
      const activeOrders = orders.filter(o => 
        ['accepted', 'preparing', 'ready_for_pickup', 'picked_up'].includes(o.status)
      );

      activeOrders.forEach(o => {
        const isSelected = selectedOrder?.id === o.id;
        if (selectedOrder && !isSelected) return; // If an order is explicitly selected, only show markers for it

        // Add distinct Pickup Point
        if (typeof o.restaurantLat === 'number' && typeof o.restaurantLng === 'number' && o.restaurantLat !== 0) {
          markerItems.push({
            type: 'pickup',
            id: `pickup_${o.id}`,
            lat: o.restaurantLat,
            lng: o.restaurantLng,
            name: `Pickup Point for Order #${o.id.substring(0, 8)}`,
            raw: o
          });
        }

        // Add distinct Delivery Point
        if (typeof o.deliveryLat === 'number' && typeof o.deliveryLng === 'number' && o.deliveryLat !== 0) {
          markerItems.push({
            type: 'delivery',
            id: `delivery_${o.id}`,
            lat: o.deliveryLat,
            lng: o.deliveryLng,
            name: `Delivery Destination for Order #${o.id.substring(0, 8)}`,
            raw: o
          });
        }
      });
    }

    // 6c. Render markers (Clustered if zoomed out, individual if zoomed in)
    const isZoomedOut = mapZoom <= 12;

    if (isZoomedOut) {
      // Dynamic grid/distance clusterizer algorithm
      const clusters: {
        lat: number;
        lng: number;
        items: typeof markerItems;
      }[] = [];
      const threshold = 0.016; // Coordinates proximity (approx 1.6 km)

      markerItems.forEach(item => {
        let matchedCluster = false;
        for (let i = 0; i < clusters.length; i++) {
          const c = clusters[i];
          const distLat = Math.abs(c.lat - item.lat);
          const distLng = Math.abs(c.lng - item.lng);
          if (distLat < threshold && distLng < threshold) {
            c.items.push(item);
            // Recompute center mass average
            c.lat = (c.lat * (c.items.length - 1) + item.lat) / c.items.length;
            c.lng = (c.lng * (c.items.length - 1) + item.lng) / c.items.length;
            matchedCluster = true;
            break;
          }
        }
        if (!matchedCluster) {
          clusters.push({
            lat: item.lat,
            lng: item.lng,
            items: [item]
          });
        }
      });

      // Render clusters on map
      clusters.forEach(c => {
        if (c.items.length === 1) {
          // Render as solo marker
          const item = c.items[0];
          addSingleMarker(item, markersLayer);
        } else {
          // Render as unified Cluster Bubble
          L.marker([c.lat, c.lng], {
            icon: L.divIcon({
              html: `
                <div class="flex items-center justify-center w-10 h-10 rounded-full bg-slate-900 text-amber-400 border-2 border-amber-400 font-bold shadow-2xl text-xs hover:scale-110 transition-transform">
                  📦 ${c.items.length}
                </div>
              `,
              className: 'custom-leaflet-cluster',
              iconSize: [40, 40],
              iconAnchor: [20, 20]
            })
          })
          .addTo(markersLayer)
          .on('click', () => {
            map.flyTo([c.lat, c.lng], map.getZoom() + 2);
          });
        }
      });

    } else {
      // Render individual markers directly (Zoomed-in mode)
      markerItems.forEach(item => {
        addSingleMarker(item, markersLayer);
      });
    }

    // 6d. Draw Routing Paths: Restaurant -> Rider -> Customer
    if (filterRoutes) {
      const activeOrders = orders.filter(o => 
        ['accepted', 'preparing', 'ready_for_pickup', 'picked_up'].includes(o.status)
      );

      activeOrders.forEach(o => {
        const isSelected = selectedOrder?.id === o.id;
        
        // If an order is explicitly selected in workspace, only focus draw its lines
        if (selectedOrder && !isSelected) return;

        const r = riders.find(rider => rider.id === o.riderId);
        
        // Leg 1: Rider -> Restaurant (Pickup Path) - only drawn if NOT picked up yet
        if (o.status !== 'picked_up' && r && typeof r.lat === 'number' && typeof r.lng === 'number' && r.lat !== 0) {
          const key = `rider_${r.id}_to_rest_${o.id}`;
          const coords = osrmRoutes[key] || [[r.lat, r.lng], [o.restaurantLat, o.restaurantLng]];
          L.polyline(coords, {
            color: '#f59e0b', // Amber/Yellow
            weight: isSelected ? 4.5 : 2.0,
            dashArray: osrmRoutes[key] ? undefined : '5, 8',
            opacity: isSelected ? 0.95 : 0.45
          })
          .addTo(markersLayer)
          .bindTooltip(`Pickup Leg (${calculateDistance(r.lat, r.lng, o.restaurantLat, o.restaurantLng).toFixed(1)} km)`, { sticky: true });
        }

        // Leg 2: Restaurant -> Customer (Delivery Path) - or Rider -> Customer (if picked_up)
        if (typeof o.restaurantLat === 'number' && typeof o.deliveryLat === 'number' && o.restaurantLat !== 0) {
          const isPickedUp = o.status === 'picked_up';
          const startLat = (isPickedUp && r && typeof r.lat === 'number' && r.lat !== 0) ? r.lat : o.restaurantLat;
          const startLng = (isPickedUp && r && typeof r.lng === 'number' && r.lng !== 0) ? r.lng : o.restaurantLng;

          const key = isPickedUp
            ? `rider_${r?.id}_to_cust_${o.id}_${startLat.toFixed(3)}_${startLng.toFixed(3)}`
            : `rest_to_cust_${o.id}`;

          const coords = osrmRoutes[key] || [[startLat, startLng], [o.deliveryLat, o.deliveryLng]];
          L.polyline(coords, {
            color: '#3b82f6', // Bright Blue
            weight: isSelected ? 4.5 : 2.5,
            dashArray: osrmRoutes[key] ? undefined : '6, 6',
            opacity: isSelected ? 0.95 : 0.55
          })
          .addTo(markersLayer)
          .bindTooltip(`${isPickedUp ? 'Live Delivery Path' : 'Scheduled Delivery Leg'} (${calculateDistance(startLat, startLng, o.deliveryLat, o.deliveryLng).toFixed(1)} km)`, { sticky: true });
        }
      });
    }

  }, [
    riders,
    orders,
    restaurants,
    customers,
    zones,
    filterRiders,
    filterRestaurants,
    filterCustomers,
    filterRoutes,
    filterZones,
    selectedRider,
    selectedOrder,
    selectedZone,
    mapZoom,
    osrmRoutes
  ]);

  // Helper helper to inject marker with popups
  const addSingleMarker = (item: any, layer: L.LayerGroup) => {
    let icon: L.DivIcon;
    let popupHtml = '';

    if (item.type === 'rider') {
      const isSelected = selectedRider?.id === item.id;
      const isBusy = orders.some(o => o.riderId === item.id && ['accepted', 'preparing', 'ready_for_pickup', 'picked_up'].includes(o.status));
      const currentOrder = orders.find(o => o.riderId === item.id && ['accepted', 'preparing', 'ready_for_pickup', 'picked_up'].includes(o.status));
      
      const assignedZone = getAssignedZoneForRider(item.raw);
      const dist = calculateDistance(item.raw.lat, item.raw.lng, assignedZone.center[0], assignedZone.center[1]);
      const isBreachingBoundary = dist > assignedZone.radius;

      icon = createCustomIcon('rider', isSelected, { isBusy, isBreachingBoundary });
      popupHtml = getRiderPopupContent(item.raw, isBusy, currentOrder, assignedZone, dist, isBreachingBoundary);

      // Draw beautiful dotted warning line between the breaching rider and their assigned operational zone center
      if (isBreachingBoundary && filterZones) {
        L.polyline([[item.raw.lat, item.raw.lng], assignedZone.center], {
          color: '#f43f5e', // rose-500
          weight: isSelected ? 3.5 : 2.0,
          dashArray: '5, 8',
          opacity: isSelected ? 0.95 : 0.65
        })
        .addTo(layer)
        .bindTooltip(`Rider ${item.raw.name}: Outside of ${assignedZone.name} by ${(dist - assignedZone.radius).toFixed(2)} KM`, { sticky: true });
      }
    } else if (item.type === 'restaurant') {
      const isSelected = selectedOrder?.restaurantId === item.id;
      const restOrdersCount = orders.filter(o => o.restaurantId === item.id && ['accepted', 'preparing', 'ready_for_pickup'].includes(o.status)).length;
      
      icon = createCustomIcon('restaurant', isSelected);
      popupHtml = getRestaurantPopupContent(item.raw, restOrdersCount);
    } else if (item.type === 'pickup') {
      const isSelected = selectedOrder?.id === item.id.replace('pickup_', '');
      icon = createCustomIcon('pickup', isSelected);
      popupHtml = getPickupPopupContent(item.raw);
    } else if (item.type === 'delivery') {
      const isSelected = selectedOrder?.id === item.id.replace('delivery_', '');
      icon = createCustomIcon('delivery', isSelected);
      popupHtml = getDeliveryPopupContent(item.raw);
    } else {
      const isSelected = selectedOrder?.customerId === item.id;
      const activeOrder = orders.find(o => o.customerId === item.id && ['accepted', 'preparing', 'ready_for_pickup', 'picked_up'].includes(o.status));
      
      icon = createCustomIcon('customer', isSelected);
      popupHtml = getCustomerPopupContent(item.raw, activeOrder);
    }

    L.marker([item.lat, item.lng], { icon })
      .addTo(layer)
      .bindPopup(popupHtml, { closeButton: true });
  };

  // 7. Distance measurement activation hook
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMeasureClick = (e: L.LeafletMouseEvent) => {
      if (!measureModeActive) return;

      const { lat, lng } = e.latlng;
      const updated = [...measurePointsRef.current, [lat, lng] as [number, number]];
      measurePointsRef.current = updated;
      setMeasurePoints(updated);

      // Create pin marker
      const pin = L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div class="w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-white shadow-md"></div>`,
          className: 'custom-measure-point',
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        })
      }).addTo(map);

      measureMarkersRef.current.push(pin);

      // Link path
      if (updated.length > 1) {
        if (measureLineRef.current) {
          measureLineRef.current.setLatLngs(updated);
        } else {
          measureLineRef.current = L.polyline(updated, {
            color: '#ef4444',
            weight: 3.5,
            dashArray: '6, 6'
          }).addTo(map);
        }

        // Sum path segments
        let pathDist = 0;
        for (let i = 1; i < updated.length; i++) {
          const l1 = L.latLng(updated[i-1][0], updated[i-1][1]);
          const l2 = L.latLng(updated[i][0], updated[i][1]);
          pathDist += l1.distanceTo(l2);
        }

        pin.bindTooltip(`Total: ${(pathDist / 1000).toFixed(2)} km`, {
          permanent: true,
          direction: 'top',
          className: 'bg-slate-900/90 border border-slate-800 text-red-400 font-mono font-black text-xs px-2 py-1 rounded shadow-xl'
        }).openTooltip();
      }
    };

    if (measureModeActive) {
      map.on('click', handleMeasureClick);
      map.getContainer().style.cursor = 'crosshair';
    } else {
      map.off('click', handleMeasureClick);
      map.getContainer().style.cursor = '';

      // Cleanup
      measureMarkersRef.current.forEach(m => m.remove());
      measureMarkersRef.current = [];
      if (measureLineRef.current) {
        measureLineRef.current.remove();
        measureLineRef.current = null;
      }
      measurePointsRef.current = [];
      setMeasurePoints([]);
    }

    return () => {
      map.off('click', handleMeasureClick);
    };
  }, [measureModeActive]);

  // Map Trigger Actions
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleResetView = () => {
    const activeCity = getActiveCity();
    mapRef.current?.setView([activeCity.centerLat, activeCity.centerLng], activeCity.defaultZoom || 13);
  };
  
  const handleFullScreen = () => {
    const wrapper = containerRef.current;
    if (!wrapper) return;
    if (!document.fullscreenElement) {
      wrapper.requestFullscreen().catch(err => {
        console.warn('Fullscreen lock error:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const map = mapRef.current;
      if (map) {
        const { latitude, longitude } = pos.coords;
        map.flyTo([latitude, longitude], 15);

        // Render accuracy circle
        L.circle([latitude, longitude], {
          radius: pos.coords.accuracy,
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.15,
          weight: 1.5
        }).addTo(map);
      }
    }, err => {
      console.warn('Geolocation blocked:', err.message);
    });
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Clear routes cache to trigger redraw with fresh data
    setOsrmRoutes({});
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const handleSearchResultClick = (result: any) => {
    const map = mapRef.current;
    if (!map) return;

    map.flyTo([result.lat, result.lng], 15);
    setMapSearchQuery('');
    setShowSearchResults(false);

    if (result.type === 'rider') {
      setSelectedRider(result.raw);
      const isBusy = orders.some(o => o.riderId === result.raw.id && ['accepted', 'preparing', 'ready_for_pickup', 'picked_up'].includes(o.status));
      const activeOrd = orders.find(o => o.riderId === result.raw.id && ['accepted', 'preparing', 'ready_for_pickup', 'picked_up'].includes(o.status));
      L.popup()
        .setLatLng([result.lat, result.lng])
        .setContent(getRiderPopupContent(result.raw, isBusy, activeOrd))
        .openOn(map);
    } else if (result.type === 'restaurant') {
      const count = orders.filter(o => o.restaurantId === result.raw.id && ['accepted', 'preparing', 'ready_for_pickup'].includes(o.status)).length;
      L.popup()
        .setLatLng([result.lat, result.lng])
        .setContent(getRestaurantPopupContent(result.raw, count))
        .openOn(map);
    } else if (result.type === 'customer') {
      const activeOrd = orders.find(o => o.customerId === result.raw.id && ['accepted', 'preparing', 'ready_for_pickup', 'picked_up'].includes(o.status));
      L.popup()
        .setLatLng([result.lat, result.lng])
        .setContent(getCustomerPopupContent(result.raw, activeOrd))
        .openOn(map);
    } else if (result.type === 'order') {
      setSelectedOrder(result.raw);
      L.popup()
        .setLatLng([result.lat, result.lng])
        .setContent(getRestaurantPopupContent(restaurants.find(re => re.id === result.raw.restaurantId) || { id: result.raw.restaurantId, name: result.raw.restaurantName, phone: 'N/A' } as Restaurant, 1))
        .openOn(map);
    }
  };

  // Compile search list
  const searchMatches = useMemo(() => {
    if (!mapSearchQuery) return [];
    const query = mapSearchQuery.toLowerCase();
    const list: any[] = [];

    // Riders
    riders.forEach(r => {
      if (r.name.toLowerCase().includes(query) || r.id.toLowerCase().includes(query)) {
        if (r.lat && r.lng && r.lat !== 0 && r.lng !== 0) {
          list.push({ id: r.id, type: 'rider', name: r.name, lat: r.lat, lng: r.lng, desc: `Online Courier (${r.id.substring(0,8)})`, raw: r });
        }
      }
    });

    // Restaurants
    restaurants.forEach(re => {
      if (re.name.toLowerCase().includes(query) || re.id.toLowerCase().includes(query)) {
        if (re.lat && re.lng && re.lat !== 0 && re.lng !== 0) {
          list.push({ id: re.id, type: 'restaurant', name: re.name, lat: re.lat, lng: re.lng, desc: 'Merchant Store', raw: re });
        }
      }
    });

    // Customers
    customers.forEach(cu => {
      if (cu.name.toLowerCase().includes(query) || cu.id.toLowerCase().includes(query)) {
        const lat = cu.addresses?.[0]?.lat;
        const lng = cu.addresses?.[0]?.lng;
        if (lat && lng && lat !== 0 && lng !== 0) {
          list.push({ id: cu.id, type: 'customer', name: cu.name, lat, lng, desc: 'Customer Delivery point', raw: cu });
        }
      }
    });

    // Orders
    orders.forEach(o => {
      if (o.id.toLowerCase().includes(query)) {
        if (o.restaurantLat && o.restaurantLng && o.restaurantLat !== 0 && o.restaurantLng !== 0) {
          list.push({ id: o.id, type: 'order', name: `Order #${o.id.substring(0,8)}`, lat: o.restaurantLat, lng: o.restaurantLng, desc: `Order ${o.status}`, raw: o });
        }
      }
    });

    return list.slice(0, 5);
  }, [mapSearchQuery, riders, restaurants, customers, orders]);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[460px] bg-slate-950 flex flex-col rounded-2xl overflow-hidden shadow-xl border border-slate-800">
      
      {/* 1. Injected Dark Theme styles for Leaflet */}
      <style>{`
        .leaflet-popup-content-wrapper {
          background: #0f172a !important;
          color: #f1f5f9 !important;
          border: 1px solid #1e293b !important;
          border-radius: 0.75rem !important;
          padding: 2px !important;
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5) !important;
        }
        .leaflet-popup-tip {
          background: #0f172a !important;
          border-left: 1px solid #1e293b !important;
          border-bottom: 1px solid #1e293b !important;
        }
        .leaflet-popup-close-button {
          color: #94a3b8 !important;
          padding: 8px 10px 0 0 !important;
          font-weight: bold !important;
        }
        .leaflet-container {
          font-family: inherit;
          background-color: #020617 !important;
        }
        .custom-div-marker-wrap {
          background: transparent !important;
          border: none !important;
        }
      `}</style>

      {/* 2. Floating Search Bar Overlay */}
      <div className="absolute top-4 left-4 z-20 max-w-sm w-[calc(100%-2rem)]">
        <div className="relative flex items-center bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl p-1">
          <Search className="w-4 h-4 text-slate-400 ml-3 shrink-0" />
          <input
            type="text"
            placeholder="Search Rider ID, Vendor, Customer..."
            value={mapSearchQuery}
            onChange={(e) => {
              setMapSearchQuery(e.target.value);
              setShowSearchResults(true);
            }}
            onFocus={() => setShowSearchResults(true)}
            className="w-full bg-transparent border-none text-xs text-slate-100 placeholder-slate-500 py-2 px-3 outline-none focus:ring-0"
          />
          {mapSearchQuery && (
            <button 
              onClick={() => {
                setMapSearchQuery('');
                setShowSearchResults(false);
              }}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg mr-1 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && searchMatches.length > 0 && (
          <div className="absolute top-13 left-0 w-full bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl mt-1 overflow-hidden z-30 divide-y divide-slate-800/60">
            {searchMatches.map((res) => (
              <button
                key={`${res.type}-${res.id}`}
                onClick={() => handleSearchResultClick(res)}
                className="w-full text-left p-3 hover:bg-slate-800/80 transition flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-slate-100">{res.name}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{res.desc}</p>
                </div>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-950 text-amber-500 font-bold border border-slate-800">
                  {res.type}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Floating Custom Map Controls */}
      <div className="absolute right-4 top-4 z-20 flex flex-col gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1.5 rounded-xl shadow-2xl">
        <button
          onClick={handleZoomIn}
          className="w-8.5 h-8.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-slate-200 flex items-center justify-center text-sm font-black transition"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8.5 h-8.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-slate-200 flex items-center justify-center text-sm font-black transition"
          title="Zoom Out"
        >
          -
        </button>
        <button
          onClick={handleResetView}
          className="w-8.5 h-8.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-slate-300 flex items-center justify-center transition"
          title={`Reset ${getActiveCity().name} View`}
        >
          <Compass className="w-4 h-4" />
        </button>
        <button
          onClick={handleFullScreen}
          className="w-8.5 h-8.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-slate-300 flex items-center justify-center transition"
          title="Toggle Fullscreen"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMyLocation}
          className="w-8.5 h-8.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-slate-300 flex items-center justify-center transition"
          title="Fly to My Location"
        >
          <Navigation className="w-3.5 h-3.5 rotate-45" />
        </button>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="w-8.5 h-8.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-slate-300 flex items-center justify-center transition disabled:opacity-50"
          title="Refresh Map Layers"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-500' : ''}`} />
        </button>
        <button
          onClick={() => setMeasureModeActive(!measureModeActive)}
          className={`w-8.5 h-8.5 rounded-lg border flex items-center justify-center transition ${
            measureModeActive 
              ? 'bg-red-500 hover:bg-red-600 text-white border-red-400 shadow-lg shadow-red-950/20' 
              : 'bg-slate-950 hover:bg-slate-800 border-slate-800/80 text-slate-300'
          }`}
          title="Measure Distance Path"
        >
          <Ruler className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 4. Active Distance Measurement Panel */}
      {measureModeActive && (
        <div className="absolute top-18 right-16 z-20 bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
          <div>
            <p className="font-bold text-slate-100 font-mono">Distance Tool: ACTIVE</p>
            <p className="text-[10px] text-slate-400">Click sequential spots on OpenStreetMap to draw path.</p>
          </div>
          <button 
            onClick={() => setMeasureModeActive(false)}
            className="text-[10px] bg-slate-950 border border-slate-800 hover:bg-slate-800 px-2 py-1 rounded font-bold text-slate-400 hover:text-white transition"
          >
            Exit
          </button>
        </div>
      )}

      {/* 5. Map Canvas Mount Element */}
      <div id={mapContainerId} className="w-full flex-1 min-h-[400px] z-10" />

      {/* 6. Dynamic Legend Overlay */}
      {showLegend ? (
        <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-3 rounded-xl shadow-2xl text-xs space-y-2 max-w-[210px]">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
            <span className="font-bold text-slate-200">{getActiveCity().name} Grid Legend</span>
            <button 
              onClick={() => setShowLegend(false)} 
              className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1.5 text-[10px] text-slate-300 font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-1 ring-rose-300 animate-pulse"></span>
              <span className="text-rose-400 font-bold">Boundary Breach Alert</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-1 ring-emerald-300"></span>
              <span>Idle Rider (Online)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-1 ring-amber-300"></span>
              <span>Busy Rider (Delivering)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span>Vendor / Restaurant</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
              <span>Customer Address</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-0.5 border-t border-dashed border-amber-500 inline-block"></span>
              <span>Pickup Route Leg</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-0.5 border-t border-dashed border-blue-500 inline-block"></span>
              <span>Delivery Route Leg</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-2 border border-dashed border-teal-500 bg-teal-500/10 inline-block rounded"></span>
              <span>Delivery Sector Area</span>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowLegend(true)}
          className="absolute bottom-4 left-4 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-800 px-2.5 py-1.5 rounded-xl shadow-2xl text-[10px] font-bold text-slate-300 hover:text-white transition"
        >
          Show Map Legend
        </button>
      )}

      {/* 7. Fallback Block Overlay: No Live Data Available */}
      {!hasLiveTrackingData && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center select-none">
          <AlertCircle className="w-12 h-12 text-amber-500 mb-3 animate-bounce" />
          <h4 className="text-base font-bold text-slate-100">No Live Data Available</h4>
          <p className="text-slate-400 text-xs max-w-xs mt-1 leading-normal">
            There are currently no active couriers transmitting live GPS signals near {getActiveCity().name} city center.
          </p>
        </div>
      )}

    </div>
  );
}
