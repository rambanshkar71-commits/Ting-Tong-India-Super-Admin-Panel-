import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, setDoc, collection, onSnapshot, getDoc } from 'firebase/firestore';
import { Order, Rider, Restaurant, Customer, Zone } from '../types';
import { calculateDistance, getActiveCity, getZoneCenterForCity, getActiveMapSettings, updateMapSettingsInDb } from '../services/mapService';
import LiveTrackingMap from './LiveTrackingMap';
import { 
  MapPin, 
  Navigation, 
  Bike, 
  Store, 
  Users, 
  Compass, 
  AlertTriangle, 
  Clock, 
  Settings, 
  Activity, 
  ListFilter, 
  RotateCw, 
  Search, 
  Check, 
  Volume2, 
  VolumeX, 
  Sliders, 
  CheckCircle2, 
  Bell, 
  UserCheck, 
  ShieldAlert, 
  History, 
  Play, 
  TrendingUp, 
  Layers, 
  X,
  FileText,
  AlertCircle,
  HelpCircle,
  Info,
  Map,
  Maximize2,
  RefreshCw
} from 'lucide-react';

interface LiveTrackingViewProps {
  orders: Order[];
  riders: Rider[];
  restaurants: Restaurant[];
  customers: Customer[];
}

export default function LiveTrackingView({ orders, riders, restaurants, customers }: LiveTrackingViewProps) {
  // ---------------------------------------------------------------------------
  // 1. COMPONENT & WORKSPACE STATE
  // ---------------------------------------------------------------------------
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  
  // Tab/Panel selector for interactive panel
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'orders' | 'dispatch' | 'zones' | 'history'>('orders');

  // Map Filter Options
  const [filterRestaurants, setFilterRestaurants] = useState<boolean>(true);
  const [filterRiders, setFilterRiders] = useState<boolean>(true);
  const [filterCustomers, setFilterCustomers] = useState<boolean>(true);
  const [filterRoutes, setFilterRoutes] = useState<boolean>(true);
  const [filterZones, setFilterZones] = useState<boolean>(true);

  // Rider Tracking sidebar search & filter
  const [riderSearch, setRiderSearch] = useState<string>('');
  const [riderFilterStatus, setRiderFilterStatus] = useState<'all' | 'online' | 'offline' | 'busy'>('all');

  // Tracking Settings
  const [refreshInterval, setRefreshInterval] = useState<number>(5);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [gpsAccuracy, setGpsAccuracy] = useState<'high' | 'medium' | 'low'>('high');
  const [soundAlerts, setSoundAlerts] = useState<boolean>(true);
  const [pushNotifications, setPushNotifications] = useState<boolean>(true);

  // Dispatch Center Settings (stored in state, syncable with Firestore)
  const [autoAssign, setAutoAssign] = useState<boolean>(true);
  const [selectedDispatchOrderId, setSelectedDispatchOrderId] = useState<string>('');
  const [dispatchHistory, setDispatchHistory] = useState<{ id: string; orderId: string; riderName: string; time: string; status: string }[]>([]);

  // Delivery Zones list (fetched or fallback)
  const [zones, setZones] = useState<Zone[]>([]);
  
  // Sound system chime helper
  const triggerAlertChime = () => {
    if (!soundAlerts) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
      console.warn('Audio Context block or unsupported:', e);
    }
  };

  // ---------------------------------------------------------------------------
  // 2. REAL-TIME FIRESTORE BINDS
  // ---------------------------------------------------------------------------
  // Listen to delivery workZones in real-time
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'workZones'), (snap) => {
      const list: Zone[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        list.push({ 
          id: doc.id, 
          zoneId: doc.id,
          name: data.zoneName || data.name || 'Unnamed Zone',
          zoneName: data.zoneName || data.name || 'Unnamed Zone',
          cityId: data.cityId || 'bhopal',
          cityName: data.cityName || 'Bhopal',
          radius: data.radius ?? 5,
          minOrderAmount: data.minOrderAmount ?? 100,
          maxDistance: data.maxDistance ?? 10,
          areaCharges: data.areaCharges ?? 25,
          active: data.active !== false,
          status: data.status || 'active',
          center: data.center || { lat: data.centerLat || 23.25, lng: data.centerLng || 77.4124 },
          centerLat: data.centerLat || 23.25,
          centerLng: data.centerLng || 77.4124,
          polygon: data.polygon || [],
          capacity: data.capacity || 15
        } as Zone);
      });
      setZones(list);
    }, (err) => {
      console.warn("WorkZones snapshot listener notice:", err);
    });
    return () => unsub();
  }, []);

  // Listen to auto-dispatch settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'dispatch_settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (typeof data.autoAssign === 'boolean') {
          setAutoAssign(data.autoAssign);
        } else {
          setDoc(doc(db, 'dispatch_settings', 'global'), { autoAssign: true }, { merge: true }).catch(err => console.warn(err));
          setAutoAssign(true);
        }
      } else {
        setDoc(doc(db, 'dispatch_settings', 'global'), {
          autoAssign: true,
          maxActiveOrders: 2,
          maxDailyOrders: 15,
          maxDistanceRadius: 8.0,
          maxPickupDelay: 45,
          autoRetryInterval: 30,
          adminTimeout: 5
        }).catch(err => console.warn(err));
        setAutoAssign(true);
      }
    }, (err) => {
      console.warn("Dispatch settings snapshot listener notice:", err);
    });
    return () => unsub();
  }, []);

  // ---------------------------------------------------------------------------
  // 3. MAP FOCUS & FLY-TO SYNCHRONIZATION
  // ---------------------------------------------------------------------------
  // Handled automatically via modern state hooks by <LiveTrackingMap />

  // ---------------------------------------------------------------------------
  // 4. ACTIVE DATA AGGREGATORS
  // ---------------------------------------------------------------------------
  // Live orders in progress
  const liveOrders = useMemo(() => {
    return orders.filter(o => 
      ['pending', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up'].includes(o.status)
    );
  }, [orders]);

  // Online and offline riders
  const onlineRiders = useMemo(() => {
    return riders.filter(r => r.onlineStatus === 'online' || r.dutyStatus === 'on_duty');
  }, [riders]);

  const busyRiders = useMemo(() => {
    return riders.filter(r => 
      (r.onlineStatus === 'online' || r.dutyStatus === 'on_duty') && 
      orders.some(o => o.riderId === r.id && ['accepted', 'preparing', 'ready_for_pickup', 'picked_up'].includes(o.status))
    );
  }, [riders, orders]);

  // Centralized distance calculation delegate
  const calculateDistanceDelegate = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    return calculateDistance(lat1, lon1, lat2, lon2);
  };

  // Nearby Rider calculation for a selected order
  const currentDispatchOrder = useMemo(() => {
    if (!selectedDispatchOrderId) return null;
    return orders.find(o => o.id === selectedDispatchOrderId) || null;
  }, [selectedDispatchOrderId, orders]);

  const sortedNearbyRiders = useMemo(() => {
    if (!currentDispatchOrder) return [];
    
    const restLat = currentDispatchOrder.restaurantLat || 23.2324;
    const restLng = currentDispatchOrder.restaurantLng || 77.4318;

    return onlineRiders
      .map(r => {
        const dist = calculateDistanceDelegate(r.lat, r.lng, restLat, restLng);
        const hasActiveOrder = orders.some(o => 
          o.riderId === r.id && 
          ['accepted', 'preparing', 'ready_for_pickup', 'picked_up'].includes(o.status)
        );
        return { rider: r, distance: dist, isBusy: hasActiveOrder };
      })
      .sort((a, b) => a.distance - b.distance);
  }, [currentDispatchOrder, onlineRiders, orders]);

  const recommendedRider = useMemo(() => {
    // Return the closest available (not busy) online rider
    return sortedNearbyRiders.find(item => !item.isBusy)?.rider || null;
  }, [sortedNearbyRiders]);

  // Helper to determine coordinates for each zone dynamically relative to the active city
  const getZoneCenter = (zoneName: string): [number, number] => {
    const activeCity = getActiveCity();
    return getZoneCenterForCity(zoneName, activeCity);
  };

  const resolvedZones = useMemo(() => {
    return zones.map((z) => {
      return {
        ...z,
        name: z.name,
        radius: z.radius || 5,
        capacity: z.capacity || 15,
        active: z.active !== false
      };
    });
  }, [zones]);

  // Deterministic operational zone assignment for each rider
  const getAssignedZoneForRider = (rider: Rider) => {
    if (resolvedZones.length === 0) {
      const activeCity = getActiveCity();
      return { id: 'default', name: activeCity.name, center: [activeCity.centerLat, activeCity.centerLng] as [number, number], radius: 5 };
    }
    const hash = rider.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const zoneIndex = hash % resolvedZones.length;
    const zone = resolvedZones[zoneIndex];
    const center = (zone.centerLat && zone.centerLng) ? [zone.centerLat, zone.centerLng] as [number, number] : getZoneCenter(zone.name);
    return {
      id: zone.id,
      name: zone.name,
      center,
      radius: zone.radius
    };
  };

  // ---------------------------------------------------------------------------
  // 5. AUTOMATED LIVE ALERTS ENGINE
  // ---------------------------------------------------------------------------
  const liveAlerts = useMemo(() => {
    const alerts: { id: string; type: string; title: string; message: string; severity: 'critical' | 'warning' | 'info'; timestamp: string; riderId?: string; orderId?: string }[] = [];

    // Alert: Order Delayed (preparing for > 15 mins)
    orders.forEach(o => {
      if (['accepted', 'preparing'].includes(o.status)) {
        const timeDiff = (Date.now() - new Date(o.createdAt).getTime()) / 1000 / 60; // minutes
        if (timeDiff > 15) {
          alerts.push({
            id: `alert-delay-${o.id}`,
            type: 'Order Delayed',
            title: `Order ${o.id.substring(0, 8)} Long Prep`,
            message: `Restaurant is taking ${Math.floor(timeDiff)} mins to prepare this order.`,
            severity: 'warning',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            orderId: o.id
          });
        }
      }
    });

    // Alert: Rider Offline while assigned an order
    orders.forEach(o => {
      if (o.riderId && ['accepted', 'preparing', 'ready_for_pickup', 'picked_up'].includes(o.status)) {
        const rider = riders.find(r => r.id === o.riderId);
        if (rider && rider.onlineStatus === 'offline') {
          alerts.push({
            id: `alert-offline-${o.id}`,
            type: 'Rider Offline',
            title: `Rider ${rider.name} Offline`,
            message: `Rider is holding Order ${o.id.substring(0, 8)} but disconnected.`,
            severity: 'critical',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            riderId: rider.id,
            orderId: o.id
          });
        }
      }
    });

    // Alert: Customers waiting too long
    orders.forEach(o => {
      if (o.status === 'picked_up') {
        const timeDiff = (Date.now() - new Date(o.updatedAt || o.createdAt).getTime()) / 1000 / 60;
        if (timeDiff > 20) {
          alerts.push({
            id: `alert-waiting-${o.id}`,
            type: 'Customer Waiting',
            title: `Client Waiting Timeout`,
            message: `Rider is on-route for over ${Math.floor(timeDiff)} mins since pick-up.`,
            severity: 'critical',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            orderId: o.id
          });
        }
      }
    });

    // Alert: Rider Operational Zone Boundary Check
    onlineRiders.forEach(r => {
      const assignedZone = getAssignedZoneForRider(r);
      const dist = calculateDistanceDelegate(r.lat, r.lng, assignedZone.center[0], assignedZone.center[1]);
      
      // Check if rider has deviated too far (i.e. past their assigned zone radius)
      if (dist > assignedZone.radius) {
        const excess = (dist - assignedZone.radius).toFixed(2);
        alerts.push({
          id: `alert-boundary-${r.id}`,
          type: 'Boundary Breach',
          title: `Rider Out of Zone: ${r.name}`,
          message: `${r.name} has deviated outside assigned operational zone (${assignedZone.name}) by ${excess} KM. Current distance to zone center: ${dist.toFixed(2)} KM (Allowed Radius: ${assignedZone.radius} KM).`,
          severity: 'warning',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          riderId: r.id
        });
      }
    });

    // Fallback info if empty
    if (alerts.length === 0) {
      alerts.push({
        id: 'alert-system-ok',
        type: 'System Status',
        title: `${getActiveCity().name} Grid Operating Nominally`,
        message: 'No delays, outages, or logistical violations detected.',
        severity: 'info',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }

    return alerts;
  }, [orders, riders, resolvedZones]);

  // Sound play on new alert count change
  useEffect(() => {
    if (liveAlerts.some(a => a.severity === 'critical')) {
      triggerAlertChime();
    }
  }, [liveAlerts.length]);

  // ---------------------------------------------------------------------------
  // 6. FIRESTORE ACTIONS
  // ---------------------------------------------------------------------------
  // Toggle auto dispatch globally
  const handleToggleAutoAssign = async () => {
    try {
      const globalDispatchRef = doc(db, 'dispatch_settings', 'global');
      await setDoc(globalDispatchRef, {
        autoAssign: !autoAssign
      }, { merge: true });
    } catch (err) {
      console.error("Failed to toggle global Auto Assign state:", err);
    }
  };

  // Manual Assign/Reassign rider
  const handleAssignRider = async (riderId: string, riderName: string) => {
    if (!selectedDispatchOrderId) return;
    try {
      const orderRef = doc(db, 'orders', selectedDispatchOrderId);
      await updateDoc(orderRef, {
        riderId: riderId,
        assignedRiderId: riderId,
        riderName: riderName,
        status: 'accepted',
        updatedAt: new Date().toISOString()
      });

      // Update local session log history
      setDispatchHistory(prev => [
        {
          id: `disp-${Date.now()}`,
          orderId: selectedDispatchOrderId,
          riderName: riderName,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'RIDER_ASSIGNED'
        },
        ...prev
      ]);

      // Highlight target rider on map
      const riderObj = riders.find(r => r.id === riderId);
      if (riderObj) {
        setSelectedRider(riderObj);
      }
    } catch (err) {
      console.error("Failed to manually assign rider:", err);
    }
  };

  // ---------------------------------------------------------------------------
  // 7. RIDER FILTERING & SEARCH
  // ---------------------------------------------------------------------------
  const filteredRidersList = useMemo(() => {
    return riders.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(riderSearch.toLowerCase()) || 
                            r.id.toLowerCase().includes(riderSearch.toLowerCase()) ||
                            r.phone.includes(riderSearch);
      
      const isRiderBusy = orders.some(o => 
        o.riderId === r.id && 
        ['accepted', 'preparing', 'ready_for_pickup', 'picked_up'].includes(o.status)
      );

      if (riderFilterStatus === 'online') {
        return matchesSearch && r.onlineStatus === 'online';
      }
      if (riderFilterStatus === 'offline') {
        return matchesSearch && r.onlineStatus === 'offline';
      }
      if (riderFilterStatus === 'busy') {
        return matchesSearch && r.onlineStatus === 'online' && isRiderBusy;
      }
      return matchesSearch;
    });
  }, [riders, riderSearch, riderFilterStatus, orders]);

  // Zone Coverage Percentage calculation
  const getZoneCoverage = (zoneName: string) => {
    // Simulated calculation representing proportion of online riders within distance
    const matchedCount = onlineRiders.filter(r => {
      const seed = r.name.charCodeAt(0) % 4;
      return (seed === 0 && zoneName.includes("MP Nagar")) ||
             (seed === 1 && zoneName.includes("Arera")) ||
             (seed === 2 && zoneName.includes("Indrapuri")) ||
             (seed === 3 && zoneName.includes("Kolar"));
    }).length;
    
    if (onlineRiders.length === 0) return "0%";
    return `${Math.floor((matchedCount / onlineRiders.length) * 100)}%`;
  };



  const zoneStats = useMemo(() => {
    return resolvedZones.map(z => {
      const center = getZoneCenter(z.name);
      const ridersInZone = onlineRiders.filter(r => {
        const dist = calculateDistanceDelegate(r.lat, r.lng, center[0], center[1]);
        return dist <= z.radius;
      });
      const ordersInZone = liveOrders.filter(o => {
        const dist = calculateDistanceDelegate(o.deliveryLat, o.deliveryLng, center[0], center[1]);
        return dist <= z.radius;
      });
      const utilization = Math.round((ridersInZone.length / z.capacity) * 100);

      return {
        ...z,
        ridersInZone,
        ordersInZone,
        utilization,
        center
      };
    });
  }, [resolvedZones, onlineRiders, liveOrders]);

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in font-sans">
      
      {/* 1. TOP BAR: TITLE AND REALTIME CONTROLS */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <span className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg">
              <Compass className="w-5 h-5 animate-spin-slow" />
            </span>
            Enterprise Live Tracking Control Room
          </h2>
          <p className="text-slate-400 text-xs mt-1">Real-time geospatial dispatch mesh, timeline playback, and route monitoring.</p>
        </div>

        {/* Global Control Widgets */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 p-2 rounded-xl border border-slate-800/80">
          <div className="flex items-center gap-2 border-r border-slate-800 pr-3">
            <button 
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-1.5 rounded-lg transition ${
                autoRefresh ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
              title="Toggle Auto Refresh"
            >
              <RotateCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
            </button>
            <span className="text-[10px] text-slate-400 font-mono font-bold">AUTO REFRESH</span>
          </div>

          <div className="flex items-center gap-2 border-r border-slate-800 pr-3">
            <span className="text-[10px] text-slate-500 font-mono">FREQ</span>
            <select 
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-300 font-mono focus:border-amber-500 outline-none"
            >
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setSoundAlerts(!soundAlerts)}
              className={`p-1.5 rounded-lg transition ${
                soundAlerts ? 'bg-amber-500/10 text-amber-500' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Toggle Alert Sounds"
            >
              {soundAlerts ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
            <span className="text-[10px] text-slate-400 font-mono font-bold">{soundAlerts ? 'AUDIO ON' : 'MUTED'}</span>
          </div>
        </div>
      </div>

      {/* 2. GRID WORKSPACE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: LIVE MAP WORKSPACE & TABBED CONTROLS */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* MAP CANVAS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative flex flex-col min-h-[480px]">
            {/* Map Header Controls */}
            <div className="p-4 border-b border-slate-800/60 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <Map className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-200">Interactive {getActiveCity().name} Live Map</span>
                
                {/* Active City Bounds Switcher */}
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
                  <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="text-[10px] text-slate-400 font-bold uppercase">City Zone:</span>
                  <select
                    value={getActiveCity().id}
                    onChange={async (e) => {
                      const cId = e.target.value;
                      const allCities = getActiveMapSettings().cities || [];
                      const targetC = allCities.find(c => c.id === cId);
                      if (targetC) {
                        await updateMapSettingsInDb({
                          activeCityId: cId,
                          defaultCenterLat: targetC.centerLat,
                          defaultCenterLng: targetC.centerLng,
                          defaultZoom: targetC.defaultZoom
                        });
                      }
                    }}
                    className="bg-transparent text-xs font-black text-amber-400 outline-none cursor-pointer"
                  >
                    {(getActiveMapSettings().cities || []).map(c => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-slate-200">
                        {c.name} ({c.state})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Map Layer Filters */}
              <div className="flex flex-wrap gap-1 text-[9px] font-bold">
                <button 
                  onClick={() => setFilterRestaurants(!filterRestaurants)}
                  className={`px-2 py-1 rounded transition ${filterRestaurants ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-slate-950 text-slate-600 border border-slate-850'}`}
                >
                  🏢 Vendors
                </button>
                <button 
                  onClick={() => setFilterRiders(!filterRiders)}
                  className={`px-2 py-1 rounded transition ${filterRiders ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 'bg-slate-950 text-slate-600 border border-slate-850'}`}
                >
                  🚴 Riders
                </button>
                <button 
                  onClick={() => setFilterCustomers(!filterCustomers)}
                  className={`px-2 py-1 rounded transition ${filterCustomers ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-slate-950 text-slate-600 border border-slate-850'}`}
                >
                  👤 Client Address
                </button>
                <button 
                  onClick={() => setFilterRoutes(!filterRoutes)}
                  className={`px-2 py-1 rounded transition ${filterRoutes ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-slate-950 text-slate-600 border border-slate-850'}`}
                >
                  🛣️ Route Paths
                </button>
                <button 
                  onClick={() => setFilterZones(!filterZones)}
                  className={`px-2 py-1 rounded transition ${filterZones ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-slate-950 text-slate-600 border border-slate-850'}`}
                >
                  🌐 Zones
                </button>
              </div>
            </div>

            {/* Map Canvas itself */}
            <div className="flex-1 min-h-[500px] relative bg-slate-950">
              <LiveTrackingMap 
                riders={riders}
                orders={orders}
                restaurants={restaurants}
                customers={customers}
                zones={zones}
                filterRiders={filterRiders}
                filterRestaurants={filterRestaurants}
                filterCustomers={filterCustomers}
                filterRoutes={filterRoutes}
                filterZones={filterZones}
                selectedRider={selectedRider}
                setSelectedRider={setSelectedRider}
                selectedOrder={selectedOrder}
                setSelectedOrder={setSelectedOrder}
                selectedZone={selectedZone}
                setSelectedZone={setSelectedZone}
                getAssignedZoneForRider={getAssignedZoneForRider}
              />
            </div>
          </div>

          {/* LOWER INTERACTIVE TAB PANEL */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {/* Tab Selectors */}
            <div className="flex border-b border-slate-800 bg-slate-950/20 overflow-x-auto shrink-0">
              <button 
                onClick={() => setActiveWorkspaceTab('orders')}
                className={`px-5 py-3.5 text-xs font-bold transition flex items-center gap-2 border-b-2 shrink-0 ${
                  activeWorkspaceTab === 'orders' ? 'border-amber-500 text-amber-500 bg-amber-500/[0.02]' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clock className="w-4 h-4" />
                Active Orders ({liveOrders.length})
              </button>
              <button 
                onClick={() => setActiveWorkspaceTab('dispatch')}
                className={`px-5 py-3.5 text-xs font-bold transition flex items-center gap-2 border-b-2 shrink-0 ${
                  activeWorkspaceTab === 'dispatch' ? 'border-amber-500 text-amber-500 bg-amber-500/[0.02]' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-4 h-4" />
                Dispatch Desk
              </button>
              <button 
                onClick={() => setActiveWorkspaceTab('zones')}
                className={`px-5 py-3.5 text-xs font-bold transition flex items-center gap-2 border-b-2 shrink-0 ${
                  activeWorkspaceTab === 'zones' ? 'border-amber-500 text-amber-500 bg-amber-500/[0.02]' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-4 h-4" />
                Coverage Zones
              </button>
              <button 
                onClick={() => setActiveWorkspaceTab('history')}
                className={`px-5 py-3.5 text-xs font-bold transition flex items-center gap-2 border-b-2 shrink-0 ${
                  activeWorkspaceTab === 'history' ? 'border-amber-500 text-amber-500 bg-amber-500/[0.02]' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-4 h-4" />
                GPS Route History
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-6">
              
              {/* TAB 1: ACTIVE ORDERS */}
              {activeWorkspaceTab === 'orders' && (
                <div className="space-y-4">
                  {liveOrders.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 space-y-2">
                      <HelpCircle className="w-8 h-8 mx-auto opacity-30" />
                      <p className="text-xs">No active orders found in {getActiveCity().name} logistics grid.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                            <th className="pb-3">Order ID</th>
                            <th className="pb-3">Client & Dest.</th>
                            <th className="pb-3">Merchant</th>
                            <th className="pb-3">Courier</th>
                            <th className="pb-3">Status</th>
                            <th className="pb-3 text-right">Trip Metrics</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40 text-xs">
                          {liveOrders.map(o => {
                            const ageMins = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 1000 / 60);
                            return (
                              <tr 
                                key={o.id} 
                                className={`hover:bg-slate-850/20 transition cursor-pointer ${
                                  selectedOrder?.id === o.id ? 'bg-amber-500/[0.03]' : ''
                                }`}
                                onClick={() => {
                                  setSelectedOrder(o);
                                }}
                              >
                                <td className="py-3.5 font-mono font-bold text-amber-500">
                                  #{o.id.substring(0, 8)}
                                </td>
                                <td className="py-3.5">
                                  <div className="font-bold text-slate-200">{o.customerName}</div>
                                  <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{o.deliveryAddress}</div>
                                </td>
                                <td className="py-3.5 font-medium text-slate-300">
                                  {o.restaurantName}
                                </td>
                                <td className="py-3.5">
                                  {o.riderId ? (
                                    <span className="text-sky-400 font-medium flex items-center gap-1">
                                      <Bike className="w-3 h-3" /> {o.riderName}
                                    </span>
                                  ) : (
                                    <span className="text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider">
                                      UNASSIGNED
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                    o.status === 'picked_up' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                                    o.status === 'preparing' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                    o.status === 'ready_for_pickup' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                    'bg-slate-800 text-slate-400'
                                  }`}>
                                    {o.status.replace(/_/g, ' ')}
                                  </span>
                                </td>
                                <td className="py-3.5 text-right font-mono">
                                  <div className="text-slate-200 font-bold">Age: {ageMins}m</div>
                                  <div className="text-[10px] text-slate-500">ETA: ~{Math.max(2, 25 - ageMins)} mins</div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: DISPATCH CENTER */}
              {activeWorkspaceTab === 'dispatch' && (
                <div className="space-y-6">
                  {/* Auto assignment settings banner */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${autoAssign ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        <Sliders className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-200">Autonomous Dispatch Protocol</h4>
                        <p className="text-xs text-slate-400">If active, incoming bookings auto-match the nearest qualified rider.</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleToggleAutoAssign}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                        autoAssign 
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-950/20' 
                          : 'bg-rose-600 hover:bg-rose-500 text-slate-100 shadow-lg shadow-rose-950/20'
                      }`}
                    >
                      {autoAssign ? 'AUTO ASSIGN: ACTIVE' : 'MANUAL DISPATCH MODE'}
                    </button>
                  </div>

                  {/* Manual Assign Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-amber-500" /> 1. Select Live Order
                      </h4>
                      <select 
                        value={selectedDispatchOrderId}
                        onChange={(e) => setSelectedDispatchOrderId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:border-amber-500 outline-none transition"
                      >
                        <option value="">-- Choose Active Booking --</option>
                        {liveOrders.map(o => (
                          <option key={o.id} value={o.id}>
                            #{o.id.substring(0, 8)} - {o.restaurantName} ➔ {o.customerName} ({o.status})
                          </option>
                        ))}
                      </select>

                      {currentDispatchOrder && (
                        <div className="mt-3 p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-1.5 text-xs text-slate-400 font-mono">
                          <div><span className="text-slate-500">Merchant:</span> {currentDispatchOrder.restaurantName}</div>
                          <div><span className="text-slate-500">Client Address:</span> {currentDispatchOrder.deliveryAddress}</div>
                          <div><span className="text-slate-500">Current Courier:</span> {currentDispatchOrder.riderName || 'None'}</div>
                          <div><span className="text-slate-500">Value:</span> ₹{currentDispatchOrder.totalAmount} ({currentDispatchOrder.paymentMethod})</div>
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                        <Bike className="w-4 h-4 text-sky-400" /> 2. Dispatch Nearby Courier
                      </h4>

                      {!currentDispatchOrder ? (
                        <div className="h-28 border border-dashed border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-500">
                          Please choose a live booking on the left to scan nearby couriers.
                        </div>
                      ) : sortedNearbyRiders.length === 0 ? (
                        <div className="h-28 border border-dashed border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-500">
                          No online riders available near {getActiveCity().name} city center.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                          {recommendedRider && (
                            <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 rounded-xl flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="p-1 bg-sky-500/20 text-sky-400 rounded text-[9px] font-bold">RECOMMENDED</span>
                                <span className="text-xs font-bold text-slate-200">{recommendedRider.name}</span>
                              </div>
                              <button 
                                onClick={() => handleAssignRider(recommendedRider.id, recommendedRider.name)}
                                className="px-2.5 py-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-[10px] rounded transition cursor-pointer"
                              >
                                Auto Assign Close
                              </button>
                            </div>
                          )}

                          {sortedNearbyRiders.map(({ rider, distance, isBusy }) => (
                            <div key={rider.id} className="p-2.5 bg-slate-950/60 border border-slate-850 rounded-xl flex items-center justify-between text-xs">
                              <div>
                                <span className="font-medium text-slate-300">{rider.name}</span>
                                <span className="text-[10px] text-slate-500 font-mono ml-2">({distance.toFixed(2)} KM)</span>
                                {isBusy && <span className="ml-2 text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1 py-0.5 rounded">BUSY</span>}
                              </div>
                              <button 
                                onClick={() => handleAssignRider(rider.id, rider.name)}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] rounded transition cursor-pointer"
                              >
                                Dispatch
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dispatch Session History */}
                  {dispatchHistory.length > 0 && (
                    <div className="pt-4 border-t border-slate-800/60">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-3">Dispatch Activity Log</h4>
                      <div className="space-y-2">
                        {dispatchHistory.map(h => (
                          <div key={h.id} className="p-2 bg-slate-950/20 border border-slate-900 rounded-lg flex items-center justify-between text-[11px] font-mono">
                            <span className="text-slate-400">Order #{h.orderId.substring(0, 8)} manually dispatched to {h.riderName}.</span>
                            <span className="text-emerald-500">{h.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: COVERAGE ZONES */}
              {activeWorkspaceTab === 'zones' && (
                <div className="space-y-6">
                  {/* Top Control Header with active city action */}
                  <div className="p-5 bg-slate-950/80 border border-slate-800/80 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-xl">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse"></span>
                        <h4 className="font-bold text-sm text-slate-100">Live Delivery Zone Matrix</h4>
                      </div>
                      <p className="text-xs text-slate-400">Monitor regional fleet limits, active demand queues, and coverage depths in real-time.</p>
                    </div>
                    <button 
                      onClick={() => setSelectedZone('all')}
                      className={`px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 shadow-lg ${
                        selectedZone === 'all'
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-950/20'
                          : 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-teal-950/20'
                      }`}
                    >
                      <Compass className="w-4 h-4 animate-spin-slow" />
                      Show All {getActiveCity().name} Zones
                    </button>
                  </div>

                  {/* Grid of Coverage Zones */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {zoneStats.map(z => {
                      const isSelected = selectedZone === z.id;
                      const ridersCount = z.ridersInZone.length;
                      const ordersCount = z.ordersInZone.length;
                      const utilizationPct = Math.min(100, z.utilization);
                      
                      // Status colors
                      const utilColor = utilizationPct > 85 ? 'bg-rose-500' : utilizationPct > 50 ? 'bg-amber-500' : 'bg-emerald-500';
                      const utilTextColor = utilizationPct > 85 ? 'text-rose-400' : utilizationPct > 50 ? 'text-amber-400' : 'text-emerald-400';

                      return (
                        <div 
                          key={z.id} 
                          onClick={() => setSelectedZone(isSelected ? null : z.id)}
                          className={`p-4 border rounded-xl transition cursor-pointer relative overflow-hidden group ${
                            isSelected 
                              ? 'bg-teal-500/[0.04] border-teal-500/70 shadow-lg shadow-teal-950/30 ring-1 ring-teal-500/30' 
                              : 'bg-slate-950/40 border-slate-850 hover:border-slate-700/80'
                          }`}
                        >
                          {/* Selected glowing corner accent */}
                          {isSelected && (
                            <div className="absolute top-0 right-0 w-8 h-8 bg-teal-500/10 rounded-bl-xl flex items-center justify-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping"></span>
                            </div>
                          )}

                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-xs text-slate-200 uppercase tracking-wide group-hover:text-teal-400 transition truncate pr-6">{z.name}</h4>
                            <span className={`w-2 h-2 rounded-full ${z.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></span>
                          </div>

                          <div className="space-y-3.5 text-xs font-mono">
                            {/* Capacity status with progress bar */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] text-slate-400">
                                <span>Zone Capacity:</span>
                                <span className={`font-bold ${utilTextColor}`}>{ridersCount} / {z.capacity} ({utilizationPct}%)</span>
                              </div>
                              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${utilColor}`} 
                                  style={{ width: `${utilizationPct}%` }}
                                ></div>
                              </div>
                            </div>

                            {/* Detailed Counters */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/40 text-center">
                                <p className="text-[9px] text-slate-500 uppercase font-black">Riders In Zone</p>
                                <p className="text-sm font-bold text-slate-100 mt-0.5">{ridersCount}</p>
                              </div>
                              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/40 text-center">
                                <p className="text-[9px] text-slate-500 uppercase font-black">Orders In Zone</p>
                                <p className="text-sm font-bold text-slate-100 mt-0.5">{ordersCount}</p>
                              </div>
                            </div>

                            <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                              <span>Radius: {z.radius} KM</span>
                              <span className="text-teal-500 font-bold uppercase tracking-wider">Click to view list</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Zone Master-Detail Breakdown Section */}
                  {selectedZone && selectedZone !== 'all' ? (() => {
                    const activeStat = zoneStats.find(item => item.id === selectedZone);
                    if (!activeStat) return null;

                    return (
                      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-5 animate-slide-up">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                          <div>
                            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                              <span className="p-1 bg-teal-500/10 text-teal-400 rounded-md text-xs">DIAGNOSTICS</span>
                              {activeStat.name} Fleet & Order Registry
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">Real-time listing of active dispatch points inside this sector boundary.</p>
                          </div>
                          <button 
                            onClick={() => setSelectedZone(null)}
                            className="px-2.5 py-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-bold border border-slate-800 transition cursor-pointer"
                          >
                            Close Details
                          </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Left List: Riders in Zone */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <Bike className="w-4 h-4 text-sky-400" />
                              Riders in Zone ({activeStat.ridersInZone.length})
                            </h4>
                            
                            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                              {activeStat.ridersInZone.length === 0 ? (
                                <div className="text-center py-8 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
                                  No active courier partners inside this zone right now.
                                </div>
                              ) : (
                                activeStat.ridersInZone.map(r => {
                                  const isBusy = orders.some(o => o.riderId === r.id && ['accepted', 'preparing', 'ready_for_pickup', 'picked_up'].includes(o.status));
                                  return (
                                    <div 
                                      key={r.id}
                                      onClick={() => setSelectedRider(r)}
                                      className="p-3 bg-slate-950/60 border border-slate-850 hover:border-slate-800 rounded-xl flex items-center justify-between transition cursor-pointer"
                                    >
                                      <div>
                                        <p className="text-xs font-bold text-slate-200">{r.name}</p>
                                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{r.phone} • {r.vehicleType || 'Motorcycle'}</p>
                                      </div>
                                      <div className="text-right">
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold font-mono ${
                                          isBusy ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        }`}>
                                          {isBusy ? 'DELIVERING' : 'IDLE'}
                                        </span>
                                        <p className="text-[9px] text-slate-500 font-mono mt-1">Fly map to ➔</p>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* Right List: Orders in Zone */}
                          <div className="space-y-3">
                            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-amber-500" />
                              Orders in Zone ({activeStat.ordersInZone.length})
                            </h4>

                            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                              {activeStat.ordersInZone.length === 0 ? (
                                <div className="text-center py-8 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
                                  No active order destinations inside this zone boundary.
                                </div>
                              ) : (
                                activeStat.ordersInZone.map(o => (
                                  <div 
                                    key={o.id}
                                    onClick={() => setSelectedOrder(o)}
                                    className="p-3 bg-slate-950/60 border border-slate-850 hover:border-slate-800 rounded-xl flex items-center justify-between transition cursor-pointer"
                                  >
                                    <div className="min-w-0 flex-1 pr-3">
                                      <div className="flex items-center gap-1.5">
                                        <p className="text-xs font-bold text-slate-200 truncate">#{o.id.substring(0, 8)}</p>
                                        <span className="text-[9px] text-slate-500 font-mono truncate">({o.customerName})</span>
                                      </div>
                                      <p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">{o.deliveryAddress}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold font-mono ${
                                        o.status === 'picked_up' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                      }`}>
                                        {o.status.replace(/_/g, ' ')}
                                      </span>
                                      <p className="text-[10px] text-slate-200 font-bold font-mono mt-1">₹{o.totalAmount}</p>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })() : (
                    /* Default City Overview Panel when no specific zone is active */
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">{getActiveCity().name} Grid Aggregate Analytics</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-850">
                          <p className="text-[10px] text-slate-500 font-mono font-bold uppercase">Total Grid Capacity</p>
                          <p className="text-xl font-bold text-slate-100 font-mono mt-1">
                            {zoneStats.reduce((acc, curr) => acc + curr.capacity, 0)} Riders
                          </p>
                          <p className="text-[9px] text-slate-500 mt-1">Sum of individual max capacities across all zones.</p>
                        </div>
                        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-850">
                          <p className="text-[10px] text-slate-500 font-mono font-bold uppercase">Allocated Couriers</p>
                          <p className="text-xl font-bold text-teal-400 font-mono mt-1">
                            {zoneStats.reduce((acc, curr) => acc + curr.ridersInZone.length, 0)} Active
                          </p>
                          <p className="text-[9px] text-slate-500 mt-1">Total online riders matched inside active zones.</p>
                        </div>
                        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-850">
                          <p className="text-[10px] text-slate-500 font-mono font-bold uppercase">Total Orders in Zones</p>
                          <p className="text-xl font-bold text-amber-500 font-mono mt-1">
                            {zoneStats.reduce((acc, curr) => acc + curr.ordersInZone.length, 0)} Bookings
                          </p>
                          <p className="text-[9px] text-slate-500 mt-1">Sum of deliveries destined inside coverage boundaries.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-400" />
                    <span>Real-time polygon boundaries dynamically cross-reference online rider latitude/longitude to report live zone density indexes.</span>
                  </div>
                </div>
              )}

              {/* TAB 4: GPS ROUTE HISTORY */}
              {activeWorkspaceTab === 'history' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-3">1. Select Courier/Order</h4>
                      <select 
                        value={selectedRider?.id || ''}
                        onChange={(e) => {
                          const r = riders.find(item => item.id === e.target.value);
                          if (r) setSelectedRider(r);
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:border-amber-500 outline-none transition"
                      >
                        <option value="">-- Choose Active Courier --</option>
                        {onlineRiders.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.id})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-3">2. Playback Timeline History</h4>
                      
                      {selectedRider ? (
                        (!selectedRider.lat || !selectedRider.lng || selectedRider.lat === 0 || selectedRider.lng === 0) ? (
                          <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/30 text-center space-y-2 py-6">
                            <div className="text-amber-500 font-mono font-bold text-xs uppercase tracking-wider">No Live Data Available</div>
                            <div className="text-[10px] text-slate-500 max-w-[240px] mx-auto">This partner device is not transmitting live GPS signals. Tracking requires location data from a real device.</div>
                          </div>
                        ) : (
                          <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/30 space-y-4">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-slate-200">GPS Breadcrumb Track</span>
                              <span className="text-emerald-400 font-mono font-bold">LIVE SIGNAL</span>
                            </div>

                            <div className="space-y-3 font-mono text-[11px] relative pl-4 border-l border-slate-800">
                              <div className="relative">
                                <span className="absolute -left-[21px] top-0.5 w-2 h-2 rounded-full bg-emerald-500"></span>
                                <div className="text-slate-300 font-bold">Real-time Location Coordinate</div>
                                <div className="text-slate-500">Lat: {selectedRider.lat.toFixed(5)}, Lng: {selectedRider.lng.toFixed(5)}</div>
                              </div>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="h-28 border border-dashed border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-500">
                          Please select an online courier above to trace their route tracking history.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: FLEET SUMMARY & LIVE ALERTS & SETTINGS */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* FLEET TRACKING SUMMARY STATUS */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Bike className="w-4 h-4 text-sky-400" />
              Fleet Status Track ({onlineRiders.length} Online)
            </h3>

            {/* Status counts block */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-slate-950 p-2 border border-slate-800/80 rounded-xl">
                <p className="text-slate-500 text-[9px] uppercase font-bold">Active</p>
                <p className="text-base font-bold font-mono text-emerald-400">{onlineRiders.length}</p>
              </div>
              <div className="bg-slate-950 p-2 border border-slate-800/80 rounded-xl">
                <p className="text-slate-500 text-[9px] uppercase font-bold">Busy</p>
                <p className="text-base font-bold font-mono text-amber-500">{busyRiders.length}</p>
              </div>
              <div className="bg-slate-950 p-2 border border-slate-800/80 rounded-xl">
                <p className="text-slate-500 text-[9px] uppercase font-bold">Offline</p>
                <p className="text-base font-bold font-mono text-slate-500">{riders.filter(r => r.onlineStatus !== 'online' && r.dutyStatus !== 'on_duty').length}</p>
              </div>
            </div>

            {/* Rider Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search rider partners..."
                value={riderSearch}
                onChange={(e) => setRiderSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-amber-500 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-200 outline-none transition font-sans"
              />
            </div>

            {/* Rider Status filter options */}
            <div className="flex gap-1 text-[10px] font-bold">
              <button 
                onClick={() => setRiderFilterStatus('all')}
                className={`flex-1 py-1 rounded transition ${riderFilterStatus === 'all' ? 'bg-slate-850 border border-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200 bg-slate-950/20'}`}
              >
                All
              </button>
              <button 
                onClick={() => setRiderFilterStatus('online')}
                className={`flex-1 py-1 rounded transition ${riderFilterStatus === 'online' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'text-slate-400 hover:text-slate-200 bg-slate-950/20'}`}
              >
                Online
              </button>
              <button 
                onClick={() => setRiderFilterStatus('busy')}
                className={`flex-1 py-1 rounded transition ${riderFilterStatus === 'busy' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'text-slate-400 hover:text-slate-200 bg-slate-950/20'}`}
              >
                Busy
              </button>
            </div>

            {/* Scroll list of riders */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {filteredRidersList.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-xs">
                  No riders match current filters.
                </div>
              ) : (
                filteredRidersList.map(r => {
                  const isBusy = orders.some(o => 
                    o.riderId === r.id && 
                    ['accepted', 'preparing', 'ready_for_pickup', 'picked_up'].includes(o.status)
                  );
                  return (
                    <div 
                      key={r.id}
                      onClick={() => {
                        setSelectedRider(r);
                      }}
                      className={`p-3 bg-slate-950/40 border rounded-xl flex items-center justify-between transition cursor-pointer hover:border-slate-700 ${
                        selectedRider?.id === r.id ? 'border-sky-500 bg-sky-500/[0.02]' : 'border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${r.onlineStatus === 'online' || r.dutyStatus === 'on_duty' ? 'bg-emerald-500' : 'bg-slate-600'}`}></div>
                        <div>
                          <p className="text-xs font-bold text-slate-200">{r.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono font-bold uppercase">
                            {r.dutyStatus === 'on_duty' || r.onlineStatus === 'online' ? 'On Duty' : 'Off Duty'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        {isBusy ? (
                          <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                            BUSY
                          </span>
                        ) : (
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                            IDLE
                          </span>
                        )}
                        <p className="text-[8px] text-slate-500 font-mono mt-1">⭐ {r.rating || '5.0'}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* REALTIME OPERATIONAL LIVE ALERTS PANEL */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
            <h3 className="font-bold text-slate-100 text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Live Operational Alerts
              </span>
              <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-mono font-bold animate-pulse">
                {liveAlerts.filter(a => a.severity === 'critical' || a.severity === 'warning').length} ISSUES
              </span>
            </h3>

            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {liveAlerts.map(alert => {
                const isClickable = !!(alert.riderId || alert.orderId);
                return (
                  <div 
                    key={alert.id}
                    onClick={() => {
                      if (alert.riderId) {
                        const r = riders.find(item => item.id === alert.riderId);
                        if (r) {
                          setSelectedRider(r);
                        }
                      }
                      if (alert.orderId) {
                        const o = orders.find(item => item.id === alert.orderId);
                        if (o) {
                          setSelectedOrder(o);
                        }
                      }
                    }}
                    className={`p-3 border rounded-xl flex items-start gap-2.5 text-xs transition select-none ${
                      isClickable ? 'cursor-pointer hover:border-slate-700 hover:bg-slate-850/20 active:scale-[0.98]' : ''
                    } ${
                      alert.severity === 'critical' ? 'bg-rose-500/[0.02] border-rose-500/30' :
                      alert.severity === 'warning' ? 'bg-amber-500/[0.02] border-amber-500/30' :
                      'bg-slate-950/40 border-slate-850'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {alert.severity === 'critical' ? (
                        <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
                      ) : alert.severity === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
                      ) : (
                        <Info className="w-4 h-4 text-sky-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`font-bold truncate ${
                          alert.severity === 'critical' ? 'text-rose-300' :
                          alert.severity === 'warning' ? 'text-amber-300' :
                          'text-sky-300'
                        }`}>{alert.title}</p>
                        <span className="text-[8px] text-slate-500 font-mono shrink-0">{alert.timestamp}</span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-1 leading-normal">{alert.message}</p>
                      {isClickable && (
                        <span className="inline-block text-[9px] text-sky-400 font-semibold mt-1 hover:underline">
                          🔍 Click to locate on grid
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TRACKING SETTINGS MODULE PANEL */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-400" />
              Tracking Engine Config
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-300">Live GPS Accuracy</p>
                  <p className="text-[10px] text-slate-500">Filters high-drift coordinates.</p>
                </div>
                <select 
                  value={gpsAccuracy}
                  onChange={(e) => setGpsAccuracy(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 outline-none"
                >
                  <option value="high">High (GPS)</option>
                  <option value="medium">Medium (Cell)</option>
                  <option value="low">Low (IP)</option>
                </select>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800/60 pt-3">
                <div>
                  <p className="font-bold text-slate-300">Push Notifications</p>
                  <p className="text-[10px] text-slate-500">Alert dispatch team on timeouts.</p>
                </div>
                <button 
                  onClick={() => setPushNotifications(!pushNotifications)}
                  className={`px-3 py-1 rounded text-[10px] font-bold tracking-wider transition cursor-pointer ${
                    pushNotifications ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-950 text-slate-600 border border-slate-850'
                  }`}
                >
                  {pushNotifications ? 'ACTIVE' : 'OFF'}
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800/60 pt-3">
                <div>
                  <p className="font-bold text-slate-300">Sound Alerts</p>
                  <p className="text-[10px] text-slate-500">Audible warnings on delays.</p>
                </div>
                <button 
                  onClick={() => setSoundAlerts(!soundAlerts)}
                  className={`px-3 py-1 rounded text-[10px] font-bold tracking-wider transition cursor-pointer ${
                    soundAlerts ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-950 text-slate-600 border border-slate-850'
                  }`}
                >
                  {soundAlerts ? 'ENABLED' : 'MUTED'}
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
