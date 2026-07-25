import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, setDoc, doc } from 'firebase/firestore';
import { WorkZone, City } from '../types';
import { DEFAULT_CITIES, CityConfig } from '../services/mapService';
import { MapPin, Navigation, Layers, CheckCircle2, Sliders, ShieldCheck } from 'lucide-react';

interface CityZoneFilterProps {
  selectedCityId: string;
  selectedWorkZoneId: string;
  onCityChange: (cityId: string) => void;
  onWorkZoneChange: (zoneId: string) => void;
  workZones?: WorkZone[];
  onlineRidersCount?: number;
  unassignedOrdersCount?: number;
  compact?: boolean;
}

export default function CityZoneFilter({
  selectedCityId,
  selectedWorkZoneId,
  onCityChange,
  onWorkZoneChange,
  workZones: externalWorkZones,
  onlineRidersCount,
  unassignedOrdersCount,
  compact = false
}: CityZoneFilterProps) {
  const [internalWorkZones, setInternalWorkZones] = useState<WorkZone[]>([]);
  const [cities, setCities] = useState<CityConfig[]>(DEFAULT_CITIES);

  // Subscribe to Firestore 'cities' collection in real time
  useEffect(() => {
    const unsubCities = onSnapshot(collection(db, 'cities'), async (snap) => {
      if (snap.empty) {
        // Seed default cities if Firestore cities collection is empty
        const nowIso = new Date().toISOString();
        for (const defCity of DEFAULT_CITIES) {
          await setDoc(doc(db, 'cities', defCity.id), {
            id: defCity.id,
            name: defCity.name,
            state: defCity.state,
            centerLat: defCity.centerLat,
            centerLng: defCity.centerLng,
            active: true,
            createdAt: nowIso,
            updatedAt: nowIso
          }, { merge: true });
        }
      } else {
        const cityList: CityConfig[] = snap.docs.map(d => ({
          id: d.id,
          name: d.data().name || d.id,
          state: d.data().state || 'Madhya Pradesh',
          centerLat: d.data().centerLat ?? 23.2500,
          centerLng: d.data().centerLng ?? 77.4124,
          defaultZoom: d.data().defaultZoom ?? 13,
          country: d.data().country || 'India',
          active: d.data().active !== false
        }));
        setCities(cityList);
      }
    });

    return () => unsubCities();
  }, []);

  // Subscribe to workZones in real time if not provided externally
  useEffect(() => {
    if (externalWorkZones && externalWorkZones.length > 0) {
      setInternalWorkZones(externalWorkZones);
      return;
    }

    const unsub = onSnapshot(collection(db, 'workZones'), (snap) => {
      const list: WorkZone[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          zoneId: data.zoneId || docSnap.id,
          name: data.zoneName || data.name || 'Unnamed Zone',
          zoneName: data.zoneName || data.name || 'Unnamed Zone',
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
      setInternalWorkZones(list);
    });

    return () => unsub();
  }, [externalWorkZones]);

  // Combine external and internal workZones
  const workZones = externalWorkZones && externalWorkZones.length > 0 ? externalWorkZones : internalWorkZones;

  // Filter available workZones by selected city
  const filteredWorkZones = useMemo(() => {
    if (!selectedCityId || selectedCityId === 'all') {
      return workZones.filter(z => z.active !== false);
    }
    const currentCity = cities.find(c => c.id === selectedCityId);
    const cityName = currentCity ? currentCity.name.toLowerCase() : selectedCityId.toLowerCase();
    
    return workZones.filter(z => 
      z.active !== false && 
      (z.cityId === selectedCityId || (z.cityName || '').toLowerCase() === cityName)
    );
  }, [workZones, selectedCityId, cities]);

  // When selectedCityId changes, automatically update work zone if necessary
  useEffect(() => {
    if (selectedCityId !== 'all' && filteredWorkZones.length > 0) {
      const isCurrentZoneValid = filteredWorkZones.some(z => z.id === selectedWorkZoneId || z.zoneId === selectedWorkZoneId);
      if (!isCurrentZoneValid || selectedWorkZoneId === 'all') {
        // Automatically default to the first work zone of the selected city
        onWorkZoneChange(filteredWorkZones[0].id || filteredWorkZones[0].zoneId);
      }
    }
  }, [selectedCityId, filteredWorkZones, selectedWorkZoneId, onWorkZoneChange]);

  // Active selected Work Zone object
  const activeWorkZone = useMemo(() => {
    if (!selectedWorkZoneId || selectedWorkZoneId === 'all') {
      return filteredWorkZones[0] || workZones[0] || null;
    }
    return workZones.find(z => z.id === selectedWorkZoneId || z.zoneId === selectedWorkZoneId) || filteredWorkZones[0] || null;
  }, [workZones, filteredWorkZones, selectedWorkZoneId]);

  // Active selected City object
  const activeCity = useMemo(() => {
    if (!selectedCityId || selectedCityId === 'all') return null;
    return cities.find(c => c.id === selectedCityId) || { id: selectedCityId, name: selectedCityId.toUpperCase() };
  }, [cities, selectedCityId]);

  const hasPolygon = activeWorkZone && Array.isArray(activeWorkZone.polygon) && activeWorkZone.polygon.length >= 3;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Title & Instructions */}
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/10 text-amber-500 p-2.5 rounded-xl border border-amber-500/20">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              Dashboard Work Zone Selector
              <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase">
                Single Source of Truth
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Select City & Work Zone to scope live monitoring, fleet matching & queue telemetry.
            </p>
          </div>
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Select City */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Navigation className="w-3 h-3 text-amber-500" /> Select City
            </label>
            <select
              value={selectedCityId}
              onChange={(e) => {
                const newCityId = e.target.value;
                onCityChange(newCityId);
              }}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-amber-500 font-medium cursor-pointer min-w-[150px]"
            >
              <option value="all">🌐 All Cities</option>
              {cities.map(c => (
                <option key={c.id} value={c.id}>📍 {c.name}</option>
              ))}
            </select>
          </div>

          {/* Select Work Zone */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3 h-3 text-indigo-400" /> Select Work Zone
            </label>
            <select
              value={selectedWorkZoneId}
              onChange={(e) => onWorkZoneChange(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-medium cursor-pointer min-w-[190px]"
            >
              {selectedCityId === 'all' && (
                <option value="all">⚡ All Active Work Zones</option>
              )}
              {filteredWorkZones.map(z => (
                <option key={z.id} value={z.id}>
                  🎯 {z.name} ({z.radius || 5} km)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Dynamic Scoped Metadata Summary Banner */}
      {!compact && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-850 text-xs font-mono">
          <div>
            <span className="text-[9px] text-slate-500 uppercase font-bold block">Active Scope</span>
            <span className="text-slate-200 font-bold block truncate">
              {activeCity ? activeCity.name : 'All Cities'}
            </span>
          </div>

          <div>
            <span className="text-[9px] text-slate-500 uppercase font-bold block">Work Zone & Radius</span>
            <span className="text-amber-400 font-bold block truncate">
              {activeWorkZone ? `${activeWorkZone.name} (${activeWorkZone.radius} km)` : 'All Active Zones'}
            </span>
          </div>

          <div>
            <span className="text-[9px] text-slate-500 uppercase font-bold block">Matching Type</span>
            <span className={`font-bold block truncate ${hasPolygon ? 'text-emerald-400' : 'text-sky-400'}`}>
              {hasPolygon ? '❖ Polygon Geofence' : '⭕ Radius Geofence'}
            </span>
          </div>

          <div>
            <span className="text-[9px] text-slate-500 uppercase font-bold block">Live Status</span>
            <span className="text-emerald-400 font-bold block flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Realtime Sync
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

