import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDocs } from 'firebase/firestore';
import { WorkZone, City, PolygonPoint, Rider, Coupon } from '../types';
import { saveWorkZoneToFirestore, toggleWorkZoneActive, deleteWorkZoneFromFirestore } from '../services/zoneService';
import { DEFAULT_CITIES } from '../services/mapService';
import { getZoneForRider } from '../utils/zoneMatching';
import { 
  MapPin, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Edit3, 
  Building2, 
  Layers, 
  Users, 
  Sliders, 
  RotateCcw, 
  Maximize2, 
  Navigation, 
  ShieldAlert, 
  Percent, 
  Tag, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  ArrowRightLeft
} from 'lucide-react';

// Fix Leaflet marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Interactive Map Component for Boundary Polygon Drawing & Radius Editing
interface ZoneMapEditorProps {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  polygon: PolygonPoint[];
  isDrawing: boolean;
  onCenterChange: (lat: number, lng: number) => void;
  onPolygonChange: (polygon: PolygonPoint[]) => void;
}

function ZoneMapEditor({
  centerLat,
  centerLng,
  radiusKm,
  polygon,
  isDrawing,
  onCenterChange,
  onPolygonChange
}: ZoneMapEditorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const centerMarkerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const vertexMarkersRef = useRef<L.Marker[]>([]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [centerLat || 23.2500, centerLng || 77.4124],
        zoom: 13,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    map.setView([centerLat || 23.2500, centerLng || 77.4124], map.getZoom() || 13);

  }, []);

  // Update Center Marker & Radius Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Center marker
    if (centerMarkerRef.current) {
      centerMarkerRef.current.setLatLng([centerLat, centerLng]);
    } else {
      const centerIcon = L.divIcon({
        className: 'custom-center-marker',
        html: `<div style="background-color: #f59e0b; width: 18px; height: 18px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      const marker = L.marker([centerLat, centerLng], {
        icon: centerIcon,
        draggable: true
      }).addTo(map);

      marker.on('dragend', (e) => {
        const latLng = e.target.getLatLng();
        onCenterChange(Number(latLng.lat.toFixed(6)), Number(latLng.lng.toFixed(6)));
      });

      centerMarkerRef.current = marker;
    }

    // Radius Circle
    if (circleRef.current) {
      circleRef.current.setLatLng([centerLat, centerLng]);
      circleRef.current.setRadius(radiusKm * 1000);
    } else {
      const circle = L.circle([centerLat, centerLng], {
        radius: radiusKm * 1000,
        color: '#6366f1',
        weight: 2,
        fillColor: '#818cf8',
        fillOpacity: 0.15,
        dashArray: '5, 5'
      }).addTo(map);

      circleRef.current = circle;
    }
  }, [centerLat, centerLng, radiusKm]);

  // Update Polygon & Vertex Handles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous vertex markers
    vertexMarkersRef.current.forEach(m => m.remove());
    vertexMarkersRef.current = [];

    const latLngs = polygon.map(p => [p.lat, p.lng] as [number, number]);

    if (polygonRef.current) {
      polygonRef.current.setLatLngs(latLngs);
    } else {
      const poly = L.polygon(latLngs, {
        color: '#f59e0b',
        weight: 3,
        fillColor: '#fbbf24',
        fillOpacity: 0.25
      }).addTo(map);

      polygonRef.current = poly;
    }

    // Add draggable vertex markers for modifying polygon boundary
    polygon.forEach((pt, index) => {
      const handleIcon = L.divIcon({
        className: 'vertex-handle',
        html: `<div style="background-color: #38bdf8; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #ffffff; cursor: move;"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });

      const vMarker = L.marker([pt.lat, pt.lng], {
        icon: handleIcon,
        draggable: true
      }).addTo(map);

      vMarker.on('dragend', (e) => {
        const newLatLng = e.target.getLatLng();
        const updated = [...polygon];
        updated[index] = {
          lat: Number(newLatLng.lat.toFixed(6)),
          lng: Number(newLatLng.lng.toFixed(6))
        };
        onPolygonChange(updated);
      });

      // Click vertex to delete
      vMarker.on('click', () => {
        if (polygon.length > 3) {
          const updated = polygon.filter((_, idx) => idx !== index);
          onPolygonChange(updated);
        }
      });

      vertexMarkersRef.current.push(vMarker);
    });

  }, [polygon]);

  // Handle map click when drawing mode is enabled
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (!isDrawing) return;
      const newPoint: PolygonPoint = {
        lat: Number(e.latlng.lat.toFixed(6)),
        lng: Number(e.latlng.lng.toFixed(6))
      };
      onPolygonChange([...polygon, newPoint]);
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isDrawing, polygon, onPolygonChange]);

  return (
    <div className="relative w-full h-[360px] rounded-xl overflow-hidden border border-slate-700/80 shadow-inner">
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-slate-950" />

      {/* Map Control Overlay */}
      <div className="absolute top-3 right-3 z-10 bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-xl p-2.5 text-xs text-slate-200 shadow-xl space-y-1.5">
        <div className="flex items-center gap-2 font-mono text-[11px] text-amber-400">
          <MapPin className="w-3.5 h-3.5" />
          <span>Center: {centerLat.toFixed(4)}, {centerLng.toFixed(4)}</span>
        </div>
        <div className="text-[10px] text-slate-400">
          • Drag orange marker to move zone center.<br />
          • {isDrawing ? 'Click anywhere on map to add boundary points.' : 'Click "Draw Polygon" to plot boundary.'}<br />
          • Drag blue dots to adjust vertex points.
        </div>
      </div>
    </div>
  );
}

export default function AreaManagementView() {
  const [activeTab, setActiveTab] = useState<'work_zones' | 'cities' | 'rider_distribution' | 'coupons'>('work_zones');
  
  // Data states
  const [cities, setCities] = useState<City[]>([]);
  const [workZones, setWorkZones] = useState<WorkZone[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & selection
  const [selectedCityId, setSelectedCityId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // WorkZone Modal State
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Partial<WorkZone> | null>(null);
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);

  // City Modal State
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<Partial<City> | null>(null);

  // Rider Assignment Modal State
  const [isRiderAssignOpen, setIsRiderAssignOpen] = useState(false);
  const [assigningZone, setAssigningZone] = useState<WorkZone | null>(null);
  const [selectedRiderIds, setSelectedRiderIds] = useState<string[]>([]);

  // Coupon form states
  const [coupCode, setCoupCode] = useState('');
  const [coupType, setCoupType] = useState<'percentage' | 'flat'>('percentage');
  const [coupVal, setCoupVal] = useState('');
  const [coupMin, setCoupMin] = useState('');
  const [coupExpiry, setCoupExpiry] = useState('');

  // Synchronize Firestore Collections
  useEffect(() => {
    // 1. Cities
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
        const cityList: City[] = snap.docs.map(d => ({
          id: d.id,
          name: d.data().name || d.id,
          state: d.data().state || 'Madhya Pradesh',
          centerLat: d.data().centerLat ?? 23.2500,
          centerLng: d.data().centerLng ?? 77.4124,
          active: d.data().active !== false,
          createdAt: d.data().createdAt,
          updatedAt: d.data().updatedAt
        }));
        setCities(cityList);
      }
    }, (err) => console.error("Error subscribing cities:", err));

    // 2. WorkZones
    const unsubWorkZones = onSnapshot(collection(db, 'workZones'), (snap) => {
      const list: WorkZone[] = snap.docs.map(d => {
        const data = d.data();
        const cLat = data.centerLat ?? (data.center?.lat || (Array.isArray(data.center) ? data.center[0] : 23.25));
        const cLng = data.centerLng ?? (data.center?.lng || (Array.isArray(data.center) ? data.center[1] : 77.4124));
        const name = data.zoneName || data.name || 'Unnamed Zone';

        return {
          id: d.id,
          zoneId: data.zoneId || d.id,
          name,
          zoneName: name,
          cityId: data.cityId || 'bhopal',
          cityName: data.cityName || 'Bhopal',
          radius: data.radius ?? 6,
          minOrderAmount: data.minOrderAmount ?? 120,
          maxDistance: data.maxDistance ?? 10,
          areaCharges: data.areaCharges ?? 25,
          active: data.active !== false,
          status: data.status || (data.active !== false ? 'active' : 'offline'),
          center: data.center || { lat: cLat, lng: cLng },
          centerLat: cLat,
          centerLng: cLng,
          polygon: data.polygon || [],
          mapData: data.mapData || null,
          capacity: data.capacity ?? 15,
          assignedRiderIds: data.assignedRiderIds || [],
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        } as WorkZone;
      });
      setWorkZones(list);
      setLoading(false);
    }, (err) => console.error("Error subscribing workZones:", err));

    // 3. Riders
    const unsubRiders = onSnapshot(collection(db, 'riders'), (snap) => {
      const rList: Rider[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Rider));
      setRiders(rList);
    }, (err) => console.error("Error subscribing riders:", err));

    // 4. Coupons
    const unsubCoupons = onSnapshot(collection(db, 'coupons'), (snap) => {
      setCoupons(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Coupon));
    }, (err) => console.error("Error subscribing coupons:", err));

    return () => {
      unsubCities();
      unsubWorkZones();
      unsubRiders();
      unsubCoupons();
    };
  }, []);

  // Filtered WorkZones based on selected city and search query
  const filteredWorkZones = workZones.filter(wz => {
    const matchesCity = selectedCityId === 'all' || wz.cityId.toLowerCase() === selectedCityId.toLowerCase();
    const matchesSearch = !searchQuery || wz.name.toLowerCase().includes(searchQuery.toLowerCase()) || wz.cityName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCity && matchesSearch;
  });

  // Handler: Open Modal to Add/Edit WorkZone
  const handleOpenZoneModal = (zone?: WorkZone) => {
    if (zone) {
      setEditingZone({ ...zone });
    } else {
      // Find selected city center or default to Bhopal
      const activeCityObj = cities.find(c => c.id === selectedCityId) || cities[0] || { id: 'bhopal', name: 'Bhopal', centerLat: 23.2500, centerLng: 77.4124 };
      const defaultLat = activeCityObj.centerLat;
      const defaultLng = activeCityObj.centerLng;

      setEditingZone({
        id: '',
        name: '',
        zoneName: '',
        cityId: activeCityObj.id,
        cityName: activeCityObj.name,
        radius: 6,
        minOrderAmount: 120,
        maxDistance: 12,
        areaCharges: 25,
        active: true,
        status: 'active',
        center: { lat: defaultLat, lng: defaultLng },
        centerLat: defaultLat,
        centerLng: defaultLng,
        polygon: [
          { lat: defaultLat + 0.02, lng: defaultLng - 0.02 },
          { lat: defaultLat + 0.02, lng: defaultLng + 0.02 },
          { lat: defaultLat - 0.02, lng: defaultLng + 0.02 },
          { lat: defaultLat - 0.02, lng: defaultLng - 0.02 }
        ],
        capacity: 15,
        assignedRiderIds: []
      });
    }
    setIsDrawingPolygon(false);
    setIsZoneModalOpen(true);
  };

  // Handler: Save WorkZone
  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZone || (!editingZone.name && !editingZone.zoneName)) return;

    try {
      const cityObj = cities.find(c => c.id === editingZone.cityId) || { id: editingZone.cityId || 'bhopal', name: editingZone.cityName || 'Bhopal' };
      
      const payload: Partial<WorkZone> = {
        ...editingZone,
        name: editingZone.zoneName || editingZone.name,
        zoneName: editingZone.zoneName || editingZone.name,
        cityId: cityObj.id,
        cityName: cityObj.name,
        center: { lat: editingZone.centerLat || 23.25, lng: editingZone.centerLng || 77.4124 }
      };

      await saveWorkZoneToFirestore(payload);
      setIsZoneModalOpen(false);
      setEditingZone(null);
    } catch (err) {
      console.error("Error saving workZone:", err);
      alert("Failed to save work zone to Firestore.");
    }
  };

  // Handler: Open City Modal
  const handleOpenCityModal = (city?: City) => {
    if (city) {
      setEditingCity({ ...city });
    } else {
      setEditingCity({
        id: '',
        name: '',
        state: 'Madhya Pradesh',
        centerLat: 23.2500,
        centerLng: 77.4124,
        active: true
      });
    }
    setIsCityModalOpen(true);
  };

  // Handler: Save City
  const handleSaveCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCity || !editingCity.name) return;

    try {
      const id = editingCity.id || editingCity.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const nowIso = new Date().toISOString();

      const docData: City = {
        id,
        name: editingCity.name,
        state: editingCity.state || 'Madhya Pradesh',
        centerLat: Number(editingCity.centerLat) || 23.2500,
        centerLng: Number(editingCity.centerLng) || 77.4124,
        active: editingCity.active !== false,
        createdAt: editingCity.createdAt || nowIso,
        updatedAt: nowIso
      };

      await setDoc(doc(db, 'cities', id), docData, { merge: true });
      setIsCityModalOpen(false);
      setEditingCity(null);
    } catch (err) {
      console.error("Error saving city:", err);
    }
  };

  // Handler: Delete City
  const handleDeleteCity = async (cityId: string) => {
    const hasZones = workZones.some(wz => wz.cityId === cityId);
    if (hasZones) {
      alert(`Cannot delete city because work zones are assigned to it. Please reassign or delete those work zones first.`);
      return;
    }
    if (confirm(`Are you sure you want to delete this city?`)) {
      await deleteDoc(doc(db, 'cities', cityId));
    }
  };

  // Handler: Open Rider Assignment Modal
  const handleOpenRiderAssign = (wz: WorkZone) => {
    setAssigningZone(wz);
    // Gather riders already assigned to this zone
    const currentRiderIds = Array.isArray(wz.assignedRiderIds) && wz.assignedRiderIds.length > 0
      ? wz.assignedRiderIds
      : riders.filter(r => {
          const rZone = getZoneForRider(r, workZones);
          return rZone?.id === wz.id || rZone?.zoneId === wz.id;
        }).map(r => r.id);
    setSelectedRiderIds(currentRiderIds);
    setIsRiderAssignOpen(true);
  };

  // Handler: Save Rider Assignment
  const handleSaveRiderAssign = async () => {
    if (!assigningZone) return;

    try {
      const targetZoneId = assigningZone.id;
      const targetZoneName = assigningZone.name || assigningZone.zoneName || 'Work Zone';
      const targetCityId = assigningZone.cityId || 'bhopal';
      const targetCityName = assigningZone.cityName || 'Bhopal';

      // 1. Update the target workZone's assignedRiderIds
      await updateDoc(doc(db, 'workZones', targetZoneId), {
        assignedRiderIds: selectedRiderIds,
        updatedAt: new Date().toISOString()
      });

      // 2. Remove selectedRiderIds from all other workZones
      for (const wz of workZones) {
        if (wz.id !== targetZoneId && Array.isArray(wz.assignedRiderIds)) {
          const filteredIds = wz.assignedRiderIds.filter(id => !selectedRiderIds.includes(id));
          if (filteredIds.length !== wz.assignedRiderIds.length) {
            await updateDoc(doc(db, 'workZones', wz.id), {
              assignedRiderIds: filteredIds,
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

      // 3. Update rider documents and sync to users collection
      for (const rider of riders) {
        const isAssigned = selectedRiderIds.includes(rider.id);
        const authUid = rider.userId || rider.authUid || rider.id;

        if (isAssigned) {
          await updateDoc(doc(db, 'riders', rider.id), {
            workZoneId: targetZoneId,
            workZone: targetZoneName,
            cityId: targetCityId,
            city: targetCityName,
            updatedAt: new Date().toISOString()
          });

          if (authUid) {
            await setDoc(doc(db, 'users', authUid), {
              workZoneId: targetZoneId,
              workZone: targetZoneName,
              cityId: targetCityId,
              city: targetCityName,
              updatedAt: new Date().toISOString()
            }, { merge: true }).catch(() => {});
          }
        } else if ((rider as any).workZoneId === targetZoneId || rider.workZone === targetZoneName) {
          await updateDoc(doc(db, 'riders', rider.id), {
            workZoneId: '',
            workZone: '',
            updatedAt: new Date().toISOString()
          });

          if (authUid) {
            await setDoc(doc(db, 'users', authUid), {
              workZoneId: '',
              workZone: '',
              updatedAt: new Date().toISOString()
            }, { merge: true }).catch(() => {});
          }
        }
      }

      setIsRiderAssignOpen(false);
      setAssigningZone(null);
    } catch (err) {
      console.error("Error assigning riders to workZone:", err);
    }
  };

  // Coupon Handlers
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coupCode || !coupVal) return;

    try {
      const id = "coup_" + Date.now();
      const newCoup: Coupon = {
        id,
        code: coupCode.toUpperCase(),
        discountType: coupType,
        discountValue: Number(coupVal),
        minOrderValue: Number(coupMin) || 0,
        active: true,
        expiryDate: coupExpiry || "2026-12-31"
      };

      await setDoc(doc(db, 'coupons', id), newCoup);
      setCoupCode('');
      setCoupVal('');
      setCoupMin('');
    } catch (err) {
      console.error("Error creating coupon: ", err);
    }
  };

  if (loading) {
    return <div className="text-slate-400 text-xs text-center py-16 animate-pulse">Loading Area Management System & Work Zones...</div>;
  }

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      {/* Module Title Header */}
      <div className="border-b border-slate-800 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-100">Area Management Engine</h2>
              <p className="text-slate-400 text-xs">Manage operational cities, polygon boundary simankan, delivery radiuses, and rider fleet distribution.</p>
            </div>
          </div>
        </div>

        {/* Action Tabs & Sub-Navigation */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('work_zones')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'work_zones' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" /> Work Zones ({workZones.length})
          </button>
          <button
            onClick={() => setActiveTab('cities')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'cities' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Building2 className="w-4 h-4" /> Cities ({cities.length})
          </button>
          <button
            onClick={() => setActiveTab('rider_distribution')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'rider_distribution' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" /> Fleet Distribution
          </button>
          <button
            onClick={() => setActiveTab('coupons')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'coupons' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Percent className="w-4 h-4" /> Coupon Campaigns
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: WORK ZONES MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'work_zones' && (
        <div className="space-y-6">
          {/* Controls Bar: City Selector & Create Zone Button */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* City Filter */}
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-xs">
                <Building2 className="w-4 h-4 text-amber-500" />
                <span className="text-slate-400 font-medium">Select City:</span>
                <select
                  value={selectedCityId}
                  onChange={e => setSelectedCityId(e.target.value)}
                  className="bg-transparent text-slate-200 font-bold outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">All Cities ({workZones.length} Zones)</option>
                  {cities.map(c => (
                    <option key={c.id} value={c.id} className="bg-slate-900">
                      {c.name} ({workZones.filter(wz => wz.cityId === c.id).length} Zones)
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Box */}
              <input
                type="text"
                placeholder="Search work zones..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500 text-slate-200 w-full sm:w-48"
              />
            </div>

            <button
              onClick={() => handleOpenZoneModal()}
              className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-extrabold text-xs px-5 py-2.5 rounded-xl hover:brightness-110 flex items-center gap-2 cursor-pointer shadow-lg w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" /> Create Work Zone
            </button>
          </div>

          {/* Work Zones Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredWorkZones.map(wz => {
              const assignedRidersCount = wz.assignedRiderIds?.length || riders.filter(r => (r.city || '').toLowerCase() === wz.cityName.toLowerCase()).length;

              return (
                <div 
                  key={wz.id} 
                  className={`bg-slate-900 border rounded-2xl p-5 space-y-4 transition duration-200 relative overflow-hidden flex flex-col justify-between ${
                    wz.active ? 'border-slate-800 hover:border-amber-500/40' : 'border-slate-800/60 opacity-60'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold font-mono tracking-wider uppercase px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {wz.cityName}
                        </span>
                        <h3 className="font-bold text-slate-100 text-base mt-1">{wz.name}</h3>
                      </div>

                      <button
                        onClick={() => toggleWorkZoneActive(wz.id, wz.active)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider cursor-pointer border ${
                          wz.active 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {wz.active ? 'Active' : 'Deactivated'}
                      </button>
                    </div>

                    {/* Operational Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950 p-3 rounded-xl border border-slate-850">
                      <div>
                        <p className="text-[10px] text-slate-500">Radius (Simankan):</p>
                        <p className="font-bold text-slate-200 font-mono">{wz.radius} KM</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">Area Delivery Fee:</p>
                        <p className="font-bold text-emerald-400 font-mono">₹{wz.areaCharges}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">Min Order Value:</p>
                        <p className="font-bold text-slate-300 font-mono">₹{wz.minOrderAmount}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">Max Distance:</p>
                        <p className="font-bold text-slate-300 font-mono">{wz.maxDistance} KM</p>
                      </div>
                    </div>

                    {/* Boundary Stats & Fleet Details */}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Polygon Points: <strong className="text-slate-200">{wz.polygon?.length || 0}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Users className="w-3.5 h-3.5 text-amber-500" />
                        <span>Riders: <strong className="text-amber-400">{assignedRidersCount}</strong> / {wz.capacity || 15}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenZoneModal(wz)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-500" /> Edit Boundary Map
                    </button>

                    <button
                      onClick={() => handleOpenRiderAssign(wz)}
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition"
                      title="Assign Riders"
                    >
                      <Users className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Delete work zone "${wz.name}" permanently from workZones?`)) {
                          deleteWorkZoneFromFirestore(wz.id);
                        }
                      }}
                      className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 p-2 rounded-xl cursor-pointer transition"
                      title="Delete WorkZone"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CITIES MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'cities' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <p className="text-xs text-slate-400">Manage all operational cities for Ting Tong logistics network. Work zones are linked directly to these cities.</p>
            <button
              onClick={() => handleOpenCityModal()}
              className="bg-amber-500 text-slate-950 font-extrabold text-xs px-4 py-2 rounded-xl hover:brightness-110 flex items-center gap-1.5 cursor-pointer shadow"
            >
              <Plus className="w-4 h-4" /> Add New City
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {cities.map(c => {
              const cityZonesCount = workZones.filter(wz => wz.cityId === c.id).length;

              return (
                <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-100 text-base">{c.name}</h3>
                      <button
                        onClick={async () => {
                          await updateDoc(doc(db, 'cities', c.id), { active: !c.active });
                        }}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border cursor-pointer ${
                          c.active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {c.active ? 'Active' : 'Offline'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{c.state || 'Madhya Pradesh'}, India</p>

                    <div className="mt-3 bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Center Latitude:</span>
                        <span className="font-mono font-bold">{c.centerLat}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Center Longitude:</span>
                        <span className="font-mono font-bold">{c.centerLng}</span>
                      </div>
                      <div className="flex items-center justify-between text-amber-400 pt-1 border-t border-slate-850 font-bold">
                        <span>Work Zones Active:</span>
                        <span>{cityZonesCount} Zones</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleOpenCityModal(c)}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-500" /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCity(c.id)}
                      className="text-xs text-slate-500 hover:text-rose-400 p-1.5 cursor-pointer"
                      title="Delete City"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RIDER AREA FLEET DISTRIBUTION */}
      {/* ========================================================================= */}
      {activeTab === 'rider_distribution' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <p className="text-xs text-slate-400">View real-time rider distribution per work zone and auto-balance fleet density across operational areas.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {workZones.map(wz => {
              const assignedRiders = riders.filter(r => (wz.assignedRiderIds || []).includes(r.id) || (r.city || '').toLowerCase() === wz.cityName.toLowerCase());
              const onlineRiders = assignedRiders.filter(r => {
                const onlineStatus = (r.onlineStatus || '').toUpperCase();
                const dutyStatus = (r.dutyStatus || '').toUpperCase();
                return onlineStatus === 'ONLINE' || dutyStatus === 'ON_DUTY';
              });
              const capacity = wz.capacity || 15;
              const coverageRatio = onlineRiders.length / capacity;

              let statusBadge = { label: 'Optimal Coverage', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
              if (coverageRatio < 0.3) statusBadge = { label: 'Understaffed', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
              else if (coverageRatio > 1.2) statusBadge = { label: 'High Density', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };

              return (
                <div key={wz.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-amber-400 font-mono font-bold uppercase">{wz.cityName}</span>
                      <h3 className="font-bold text-slate-100 text-base">{wz.name}</h3>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${statusBadge.color}`}>
                      {statusBadge.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center bg-slate-950 p-3 rounded-xl border border-slate-850">
                    <div>
                      <p className="text-[10px] text-slate-500">Target Capacity</p>
                      <p className="text-sm font-extrabold text-slate-200 font-mono">{capacity}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Assigned Fleet</p>
                      <p className="text-sm font-extrabold text-amber-400 font-mono">{assignedRiders.length}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Active On Duty</p>
                      <p className="text-sm font-extrabold text-emerald-400 font-mono">{onlineRiders.length}</p>
                    </div>
                  </div>

                  {/* Rider list chips */}
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400 font-bold">Assigned Rider Fleet:</p>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {assignedRiders.map(r => (
                        <span key={r.id} className="bg-slate-950 border border-slate-800 text-slate-300 text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${(r.onlineStatus || '').toUpperCase() === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></span>
                          {r.name}
                        </span>
                      ))}
                      {assignedRiders.length === 0 && (
                        <p className="text-slate-500 text-xs italic">No riders assigned to this zone yet.</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenRiderAssign(wz)}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition"
                  >
                    <ArrowRightLeft className="w-4 h-4" /> Reassign / Distribute Riders
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: COUPONS & PROMOTIONAL CAMPAIGNS */}
      {/* ========================================================================= */}
      {activeTab === 'coupons' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <Percent className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-slate-100 text-sm">Coupon Campaign Manager</h3>
            </div>

            <form onSubmit={handleCreateCoupon} className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3">
              <p className="text-slate-300 text-xs font-bold">Register New Coupon Code</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <input required type="text" placeholder="COUPONCODE" value={coupCode} onChange={e => setCoupCode(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs outline-none focus:border-amber-500 font-mono" />
                <select value={coupType} onChange={e => setCoupType(e.target.value as any)} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs outline-none focus:border-amber-500 text-slate-300">
                  <option value="percentage">Percentage %</option>
                  <option value="flat">Flat ₹</option>
                </select>
                <input required type="number" placeholder="Discount Val" value={coupVal} onChange={e => setCoupVal(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs outline-none focus:border-amber-500 font-mono" />
                <input type="number" placeholder="Min. Order (₹)" value={coupMin} onChange={e => setCoupMin(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs outline-none focus:border-amber-500 font-mono" />
                <input type="date" value={coupExpiry} onChange={e => setCoupExpiry(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs outline-none focus:border-amber-500 text-slate-400 font-mono" />
                <button type="submit" className="bg-amber-500 text-slate-950 font-bold text-xs py-2 rounded-xl hover:brightness-110 flex items-center justify-center gap-1 cursor-pointer">
                  <Plus className="w-4 h-4" /> Save Campaign
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {coupons.map(cp => (
                <div key={cp.id} className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-200 text-sm bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20">{cp.code}</span>
                      <span className="text-[10px] text-slate-500 font-mono">Expires: {cp.expiryDate}</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Discount: <span className="font-bold text-slate-300">{cp.discountType === 'percentage' ? `${cp.discountValue}%` : `₹${cp.discountValue}`}</span> | Min Order: ₹{cp.minOrderValue}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={async () => {
                        await updateDoc(doc(db, 'coupons', cp.id), { active: !cp.active });
                      }}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer ${
                        cp.active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {cp.active ? 'Active' : 'Paused'}
                    </button>
                    <button onClick={async () => { await deleteDoc(doc(db, 'coupons', cp.id)); }} className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE / EDIT WORK ZONE WITH MAP BOUNDARY EDITOR */}
      {/* ========================================================================= */}
      {isZoneModalOpen && editingZone && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl p-6 space-y-5 my-8 shadow-2xl animate-fade-in text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-100 text-base">
                  {editingZone.id ? `Edit Work Zone (${editingZone.name})` : 'Create New Work Zone'}
                </h3>
              </div>
              <button onClick={() => setIsZoneModalOpen(false)} className="text-slate-400 hover:text-slate-200 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveZone} className="space-y-5">
              {/* Form Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">City:</label>
                  <select
                    value={editingZone.cityId}
                    onChange={e => {
                      const selectedCity = cities.find(c => c.id === e.target.value);
                      setEditingZone({
                        ...editingZone,
                        cityId: e.target.value,
                        cityName: selectedCity?.name || 'Bhopal',
                        centerLat: selectedCity?.centerLat || editingZone.centerLat,
                        centerLng: selectedCity?.centerLng || editingZone.centerLng
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500"
                  >
                    {cities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Work Zone Name:</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Tindoniya Central Zone"
                    value={editingZone.name || editingZone.zoneName || ''}
                    onChange={e => setEditingZone({ ...editingZone, name: e.target.value, zoneName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Delivery Radius (KM):</label>
                  <input
                    required
                    type="number"
                    step="0.5"
                    value={editingZone.radius || 6}
                    onChange={e => setEditingZone({ ...editingZone, radius: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Area Delivery Fee (₹):</label>
                  <input
                    type="number"
                    value={editingZone.areaCharges ?? 25}
                    onChange={e => setEditingZone({ ...editingZone, areaCharges: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Min Order Amount (₹):</label>
                  <input
                    type="number"
                    value={editingZone.minOrderAmount ?? 120}
                    onChange={e => setEditingZone({ ...editingZone, minOrderAmount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Target Rider Capacity:</label>
                  <input
                    type="number"
                    value={editingZone.capacity ?? 15}
                    onChange={e => setEditingZone({ ...editingZone, capacity: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Map Boundary Drawing Section */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Layers className="w-4 h-4" /> Map Boundary Drawing (Simankan) & Radius
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsDrawingPolygon(!isDrawingPolygon)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold border cursor-pointer transition ${
                        isDrawingPolygon 
                          ? 'bg-amber-500 text-slate-950 border-amber-400' 
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {isDrawingPolygon ? '✓ Click Map to Plot Points' : '+ Draw Polygon Boundary'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const defaultLat = editingZone.centerLat || 23.2500;
                        const defaultLng = editingZone.centerLng || 77.4124;
                        setEditingZone({
                          ...editingZone,
                          polygon: [
                            { lat: defaultLat + 0.02, lng: defaultLng - 0.02 },
                            { lat: defaultLat + 0.02, lng: defaultLng + 0.02 },
                            { lat: defaultLat - 0.02, lng: defaultLng + 0.02 },
                            { lat: defaultLat - 0.02, lng: defaultLng - 0.02 }
                          ]
                        });
                      }}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                    >
                      Reset Shape
                    </button>
                  </div>
                </div>

                {/* Leaflet Map Drawing Component */}
                <ZoneMapEditor
                  centerLat={editingZone.centerLat || 23.2500}
                  centerLng={editingZone.centerLng || 77.4124}
                  radiusKm={editingZone.radius || 6}
                  polygon={editingZone.polygon || []}
                  isDrawing={isDrawingPolygon}
                  onCenterChange={(lat, lng) => setEditingZone({ ...editingZone, centerLat: lat, centerLng: lng, center: { lat, lng } })}
                  onPolygonChange={(poly) => setEditingZone({ ...editingZone, polygon: poly })}
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsZoneModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl text-xs font-extrabold text-slate-950 bg-amber-500 hover:brightness-110 cursor-pointer shadow-lg"
                >
                  Save Work Zone to Firestore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CITY MODAL */}
      {/* ========================================================================= */}
      {isCityModalOpen && editingCity && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-sm">
                {editingCity.id ? `Edit City (${editingCity.name})` : 'Add Operational City'}
              </h3>
              <button onClick={() => setIsCityModalOpen(false)} className="text-slate-400 hover:text-slate-200 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCity} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">City Name:</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Tindoniya"
                  value={editingCity.name || ''}
                  onChange={e => setEditingCity({ ...editingCity, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">State:</label>
                <input
                  type="text"
                  value={editingCity.state || 'Madhya Pradesh'}
                  onChange={e => setEditingCity({ ...editingCity, state: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Center Lat:</label>
                  <input
                    required
                    type="number"
                    step="0.0001"
                    value={editingCity.centerLat ?? 23.2500}
                    onChange={e => setEditingCity({ ...editingCity, centerLat: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Center Lng:</label>
                  <input
                    required
                    type="number"
                    step="0.0001"
                    value={editingCity.centerLng ?? 77.4124}
                    onChange={e => setEditingCity({ ...editingCity, centerLng: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-slate-200 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="cityActive"
                  checked={editingCity.active !== false}
                  onChange={e => setEditingCity({ ...editingCity, active: e.target.checked })}
                  className="rounded border-slate-800 text-amber-500"
                />
                <label htmlFor="cityActive" className="text-slate-300 font-medium">Operational Active Status</label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsCityModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-400 bg-slate-800">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl text-slate-950 font-bold bg-amber-500">
                  Save City
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: RIDER ASSIGNMENT MODAL */}
      {/* ========================================================================= */}
      {isRiderAssignOpen && assigningZone && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl text-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Assign Riders to Work Zone</h3>
                <p className="text-xs text-amber-400 font-mono">{assigningZone.name} ({assigningZone.cityName})</p>
              </div>
              <button onClick={() => setIsRiderAssignOpen(false)} className="text-slate-400 hover:text-slate-200 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
              {riders.map(r => {
                const isSelected = selectedRiderIds.includes(r.id);

                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedRiderIds(selectedRiderIds.filter(id => id !== r.id));
                      } else {
                        setSelectedRiderIds([...selectedRiderIds, r.id]);
                      }
                    }}
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition ${
                      isSelected 
                        ? 'bg-amber-500/10 border-amber-500/40 text-slate-100' 
                        : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-slate-200">{r.name}</p>
                      <p className="text-[10px] text-slate-500">{r.phone} • {r.city || 'Unassigned'}</p>
                    </div>

                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                      isSelected ? 'bg-amber-500 border-amber-500 text-slate-950 font-bold' : 'border-slate-700'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-xs text-slate-400 font-mono">{selectedRiderIds.length} Riders Selected</span>
              <div className="flex gap-2">
                <button onClick={() => setIsRiderAssignOpen(false)} className="px-4 py-2 rounded-xl text-xs text-slate-400 bg-slate-800">
                  Cancel
                </button>
                <button onClick={handleSaveRiderAssign} className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-500">
                  Confirm Distribution
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
