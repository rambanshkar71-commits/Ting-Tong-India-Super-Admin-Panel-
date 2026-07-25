import { db } from '../firebase';
import { collection, doc, onSnapshot, setDoc, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { WorkZone, Zone } from '../types';

export const REQUIRED_DEFAULT_WORK_ZONES: WorkZone[] = [
  {
    id: 'workzone_bhopal_central',
    zoneId: 'workzone_bhopal_central',
    name: 'Bhopal Central',
    zoneName: 'Bhopal Central',
    cityId: 'bhopal',
    cityName: 'Bhopal',
    radius: 10,
    minOrderAmount: 150,
    maxDistance: 15,
    areaCharges: 30,
    active: true,
    status: 'active',
    center: { lat: 23.2500, lng: 77.4124 },
    centerLat: 23.2500,
    centerLng: 77.4124,
    polygon: [
      { lat: 23.2800, lng: 77.3800 },
      { lat: 23.2800, lng: 77.4500 },
      { lat: 23.2200, lng: 77.4500 },
      { lat: 23.2200, lng: 77.3800 }
    ],
    capacity: 25,
    assignedRiderIds: []
  },
  {
    id: 'workzone_biaora_main',
    zoneId: 'workzone_biaora_main',
    name: 'Biaora Main',
    zoneName: 'Biaora Main',
    cityId: 'biaora',
    cityName: 'Biaora',
    radius: 8,
    minOrderAmount: 120,
    maxDistance: 12,
    areaCharges: 25,
    active: true,
    status: 'active',
    center: { lat: 23.9164, lng: 76.9165 },
    centerLat: 23.9164,
    centerLng: 76.9165,
    polygon: [
      { lat: 23.9400, lng: 76.8900 },
      { lat: 23.9400, lng: 76.9400 },
      { lat: 23.8900, lng: 76.9400 },
      { lat: 23.8900, lng: 76.8900 }
    ],
    capacity: 15,
    assignedRiderIds: []
  },
  {
    id: 'workzone_narsinghgarh_town',
    zoneId: 'workzone_narsinghgarh_town',
    name: 'Narsinghgarh Town',
    zoneName: 'Narsinghgarh Town',
    cityId: 'narsinghgarh',
    cityName: 'Narsinghgarh',
    radius: 8,
    minOrderAmount: 120,
    maxDistance: 12,
    areaCharges: 25,
    active: true,
    status: 'active',
    center: { lat: 23.7054, lng: 77.0917 },
    centerLat: 23.7054,
    centerLng: 77.0917,
    polygon: [
      { lat: 23.7300, lng: 77.0700 },
      { lat: 23.7300, lng: 77.1100 },
      { lat: 23.6800, lng: 77.1100 },
      { lat: 23.6800, lng: 77.0700 }
    ],
    capacity: 15,
    assignedRiderIds: []
  },
  {
    id: 'workzone_tindoniya_sector',
    zoneId: 'workzone_tindoniya_sector',
    name: 'Tindoniya Sector',
    zoneName: 'Tindoniya Sector',
    cityId: 'tindoniya',
    cityName: 'Tindoniya',
    radius: 7,
    minOrderAmount: 110,
    maxDistance: 10,
    areaCharges: 20,
    active: true,
    status: 'active',
    center: { lat: 23.6333, lng: 77.0167 },
    centerLat: 23.6333,
    centerLng: 77.0167,
    polygon: [
      { lat: 23.6550, lng: 76.9950 },
      { lat: 23.6550, lng: 77.0350 },
      { lat: 23.6100, lng: 77.0350 },
      { lat: 23.6100, lng: 76.9950 }
    ],
    capacity: 12,
    assignedRiderIds: []
  },
  {
    id: 'workzone_kurawar_mandi',
    zoneId: 'workzone_kurawar_mandi',
    name: 'Kurawar Mandi',
    zoneName: 'Kurawar Mandi',
    cityId: 'kurawar',
    cityName: 'Kurawar',
    radius: 6,
    minOrderAmount: 100,
    maxDistance: 10,
    areaCharges: 20,
    active: true,
    status: 'active',
    center: { lat: 23.5167, lng: 77.0333 },
    centerLat: 23.5167,
    centerLng: 77.0333,
    polygon: [
      { lat: 23.5350, lng: 77.0150 },
      { lat: 23.5350, lng: 77.0500 },
      { lat: 23.4950, lng: 77.0500 },
      { lat: 23.4950, lng: 77.0150 }
    ],
    capacity: 10,
    assignedRiderIds: []
  },
  {
    id: 'workzone_sehore_central',
    zoneId: 'workzone_sehore_central',
    name: 'Sehore Central',
    zoneName: 'Sehore Central',
    cityId: 'sehore',
    cityName: 'Sehore',
    radius: 8,
    minOrderAmount: 120,
    maxDistance: 12,
    areaCharges: 25,
    active: true,
    status: 'active',
    center: { lat: 23.2032, lng: 77.0844 },
    centerLat: 23.2032,
    centerLng: 77.0844,
    polygon: [
      { lat: 23.2250, lng: 77.0650 },
      { lat: 23.2250, lng: 77.1050 },
      { lat: 23.1800, lng: 77.1050 },
      { lat: 23.1800, lng: 77.0650 }
    ],
    capacity: 15,
    assignedRiderIds: []
  }
];

let cachedWorkZones: WorkZone[] = [];
let zoneListeners: ((workZones: WorkZone[]) => void)[] = [];

/**
 * Initializes the Zone Service using 'workZones' collection as the SINGLE source of truth.
 * - Checks 'workZones' collection.
 * - Migrates legacy 'zones' data if 'workZones' is empty.
 * - Seeds default work zones.
 * - Listens in real-time to 'workZones'.
 */
export function initializeZoneService() {
  const workZonesCol = collection(db, 'workZones');

  // Check and seed/migrate workZones
  getDocs(workZonesCol).then(async (snap) => {
    const nowIso = new Date().toISOString();

    if (snap.empty) {
      // Migrate from old 'zones' collection if available
      try {
        const oldZonesSnap = await getDocs(collection(db, 'zones'));
        if (!oldZonesSnap.empty) {
          for (const oldDoc of oldZonesSnap.docs) {
            const data = oldDoc.data();
            const wzId = "wz_" + oldDoc.id;
            await setDoc(doc(db, 'workZones', wzId), {
              id: wzId,
              zoneId: wzId,
              name: data.name || 'Work Zone',
              zoneName: data.name || 'Work Zone',
              cityId: data.cityId || 'bhopal',
              cityName: (data.cityId || 'Bhopal').toUpperCase(),
              radius: data.radius ?? 8,
              minOrderAmount: data.minOrderAmount ?? 120,
              maxDistance: data.maxDistance ?? 12,
              areaCharges: data.areaCharges ?? 25,
              active: data.active !== false,
              status: data.status || 'active',
              center: { lat: data.centerLat || 23.25, lng: data.centerLng || 77.4124 },
              centerLat: data.centerLat || 23.25,
              centerLng: data.centerLng || 77.4124,
              polygon: [],
              capacity: data.capacity ?? 15,
              assignedRiderIds: [],
              createdAt: data.createdAt || nowIso,
              updatedAt: nowIso
            }, { merge: true });
          }
          console.log('[ZoneService] Migrated old zones collection to workZones');
        }
      } catch (err) {
        console.warn('[ZoneService] Note migrating old zones:', err);
      }
    }

    // Ensure all default required work zones are seeded
    const updatedSnap = await getDocs(workZonesCol);
    const existingNames = updatedSnap.docs.map(d => ((d.data().zoneName || d.data().name || '') as string).trim().toLowerCase());

    for (const reqZone of REQUIRED_DEFAULT_WORK_ZONES) {
      if (!existingNames.includes(reqZone.name.toLowerCase())) {
        try {
          await setDoc(doc(db, 'workZones', reqZone.id), {
            ...reqZone,
            createdAt: nowIso,
            updatedAt: nowIso
          }, { merge: true });
          console.log(`[ZoneService] Auto-created missing default workZone: ${reqZone.name}`);
        } catch (err) {
          console.error(`[ZoneService] Failed seeding workZone ${reqZone.name}:`, err);
        }
      }
    }
  }).catch((err) => {
    console.error('[ZoneService] Error auditing workZones collection:', err);
  });

  // Setup real-time listener on 'workZones' collection exclusively
  return onSnapshot(workZonesCol, (snap) => {
    const list: WorkZone[] = snap.docs.map(d => {
      const data = d.data();
      const cLat = data.centerLat ?? (data.center?.lat || (Array.isArray(data.center) ? data.center[0] : 23.25));
      const cLng = data.centerLng ?? (data.center?.lng || (Array.isArray(data.center) ? data.center[1] : 77.4124));

      const name = data.zoneName || data.name || 'Unnamed Work Zone';

      return {
        id: d.id,
        zoneId: data.zoneId || d.id,
        name,
        zoneName: name,
        cityId: data.cityId || 'bhopal',
        cityName: data.cityName || 'Bhopal',
        radius: data.radius ?? 5,
        minOrderAmount: data.minOrderAmount ?? 100,
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

    cachedWorkZones = list;
    zoneListeners.forEach(cb => cb(list));
  }, (err) => {
    console.error('[ZoneService] Realtime workZones subscription error:', err);
  });
}

export function subscribeToZones(callback: (workZones: WorkZone[]) => void) {
  zoneListeners.push(callback);
  if (cachedWorkZones.length > 0) {
    callback(cachedWorkZones);
  }
  return () => {
    zoneListeners = zoneListeners.filter(cb => cb !== callback);
  };
}

export function getCachedZones(): WorkZone[] {
  return cachedWorkZones;
}

export async function saveWorkZoneToFirestore(workZone: Partial<WorkZone>): Promise<string> {
  const nowIso = new Date().toISOString();
  const id = workZone.id || "workzone_" + Date.now();
  const name = workZone.zoneName || workZone.name || "New Work Area";
  const cLat = workZone.centerLat ?? (workZone.center?.lat || (Array.isArray(workZone.center) ? workZone.center[0] : 23.25));
  const cLng = workZone.centerLng ?? (workZone.center?.lng || (Array.isArray(workZone.center) ? workZone.center[1] : 77.4124));

  const docData: Record<string, any> = {
    id,
    zoneId: id,
    name,
    zoneName: name,
    cityId: workZone.cityId || 'bhopal',
    cityName: workZone.cityName || 'Bhopal',
    radius: workZone.radius ?? 6,
    minOrderAmount: workZone.minOrderAmount ?? 120,
    maxDistance: workZone.maxDistance ?? 12,
    areaCharges: workZone.areaCharges ?? 25,
    active: workZone.active !== false,
    status: workZone.active !== false ? 'active' : 'offline',
    center: { lat: cLat, lng: cLng },
    centerLat: cLat,
    centerLng: cLng,
    polygon: workZone.polygon || [],
    mapData: workZone.mapData || null,
    capacity: workZone.capacity ?? 15,
    assignedRiderIds: workZone.assignedRiderIds || [],
    updatedAt: nowIso
  };

  if (!workZone.createdAt) {
    docData.createdAt = nowIso;
  }

  await setDoc(doc(db, 'workZones', id), docData, { merge: true });
  return id;
}

export async function toggleWorkZoneActive(zoneId: string, currentActive: boolean): Promise<void> {
  await updateDoc(doc(db, 'workZones', zoneId), { 
    active: !currentActive,
    status: !currentActive ? 'active' : 'offline',
    updatedAt: new Date().toISOString()
  });
}

export async function deleteWorkZoneFromFirestore(zoneId: string): Promise<void> {
  await deleteDoc(doc(db, 'workZones', zoneId));
}
