import { db } from '../firebase';
import { collection, doc, onSnapshot, setDoc, getDocs } from 'firebase/firestore';
import { Zone } from '../types';

export const REQUIRED_DEFAULT_ZONES: Zone[] = [
  {
    id: 'zone_bhopal',
    name: 'Bhopal',
    cityId: 'bhopal',
    radius: 10,
    minOrderAmount: 150,
    maxDistance: 15,
    areaCharges: 30,
    active: true,
    status: 'active',
    centerLat: 23.2500,
    centerLng: 77.4124,
    capacity: 25
  },
  {
    id: 'zone_biaora',
    name: 'Biaora',
    cityId: 'biaora',
    radius: 8,
    minOrderAmount: 120,
    maxDistance: 12,
    areaCharges: 25,
    active: true,
    status: 'active',
    centerLat: 23.9164,
    centerLng: 76.9165,
    capacity: 15
  },
  {
    id: 'zone_narsinghgarh',
    name: 'Narsinghgarh',
    cityId: 'narsinghgarh',
    radius: 8,
    minOrderAmount: 120,
    maxDistance: 12,
    areaCharges: 25,
    active: true,
    status: 'active',
    centerLat: 23.7054,
    centerLng: 77.0917,
    capacity: 15
  },
  {
    id: 'zone_tindoniya',
    name: 'Tindoniya',
    cityId: 'tindoniya',
    radius: 7,
    minOrderAmount: 110,
    maxDistance: 10,
    areaCharges: 20,
    active: true,
    status: 'active',
    centerLat: 23.6333,
    centerLng: 77.0167,
    capacity: 12
  },
  {
    id: 'zone_kurawar',
    name: 'Kurawar',
    cityId: 'kurawar',
    radius: 6,
    minOrderAmount: 100,
    maxDistance: 10,
    areaCharges: 20,
    active: true,
    status: 'active',
    centerLat: 23.5167,
    centerLng: 77.0333,
    capacity: 10
  },
  {
    id: 'zone_sehore',
    name: 'Sehore',
    cityId: 'sehore',
    radius: 8,
    minOrderAmount: 120,
    maxDistance: 12,
    areaCharges: 25,
    active: true,
    status: 'active',
    centerLat: 23.2032,
    centerLng: 77.0844,
    capacity: 15
  }
];

let cachedZones: Zone[] = [];
let zoneListeners: ((zones: Zone[]) => void)[] = [];

/**
 * Initializes the Zone Service:
 * 1. Checks Firestore 'zones' collection.
 * 2. Verifies presence of Bhopal, Biaora, Narsinghgarh, Kurawar, Sehore.
 * 3. Seeds any missing required zone with full required fields.
 * 4. Listens to real-time changes in Firestore 'zones' collection.
 */
export function initializeZoneService() {
  const zonesCol = collection(db, 'zones');

  // Verify and seed missing required zones
  getDocs(zonesCol).then(async (snap) => {
    const existingNames = snap.docs.map(d => (d.data().name || '').trim().toLowerCase());
    const nowIso = new Date().toISOString();

    for (const reqZone of REQUIRED_DEFAULT_ZONES) {
      if (!existingNames.includes(reqZone.name.toLowerCase())) {
        try {
          await setDoc(doc(db, 'zones', reqZone.id), {
            ...reqZone,
            createdAt: nowIso,
            updatedAt: nowIso
          }, { merge: true });
          console.log(`[ZoneService] Auto-created missing required zone: ${reqZone.name}`);
        } catch (err) {
          console.error(`[ZoneService] Failed to seed zone ${reqZone.name}:`, err);
        }
      } else {
        // Ensure required fields exist on existing zone document if missing
        const foundDoc = snap.docs.find(d => (d.data().name || '').trim().toLowerCase() === reqZone.name.toLowerCase());
        if (foundDoc) {
          const data = foundDoc.data();
          const missingFields: Record<string, any> = {};
          if (data.centerLat === undefined) missingFields.centerLat = reqZone.centerLat;
          if (data.centerLng === undefined) missingFields.centerLng = reqZone.centerLng;
          if (data.cityId === undefined) missingFields.cityId = reqZone.cityId;
          if (data.status === undefined) missingFields.status = 'active';
          if (data.radius === undefined) missingFields.radius = reqZone.radius;
          if (data.minOrderAmount === undefined) missingFields.minOrderAmount = reqZone.minOrderAmount;
          if (data.maxDistance === undefined) missingFields.maxDistance = reqZone.maxDistance;
          if (data.areaCharges === undefined) missingFields.areaCharges = reqZone.areaCharges;
          
          if (Object.keys(missingFields).length > 0) {
            try {
              await setDoc(doc(db, 'zones', foundDoc.id), missingFields, { merge: true });
            } catch (err) {
              console.error(`[ZoneService] Failed updating fields for ${reqZone.name}:`, err);
            }
          }
        }
      }
    }
  }).catch((err) => {
    console.error('[ZoneService] Error auditing Firestore zones collection:', err);
  });

  // Setup real-time listener for all zones
  return onSnapshot(zonesCol, (snap) => {
    const list: Zone[] = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || 'Unnamed Zone',
        cityId: data.cityId || '',
        radius: data.radius ?? 5,
        minOrderAmount: data.minOrderAmount ?? 100,
        maxDistance: data.maxDistance ?? 10,
        areaCharges: data.areaCharges ?? 25,
        active: data.active !== false,
        status: data.status || (data.active !== false ? 'active' : 'offline'),
        centerLat: data.centerLat,
        centerLng: data.centerLng,
        capacity: data.capacity ?? 15,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      } as Zone;
    });

    cachedZones = list;
    zoneListeners.forEach(cb => cb(list));
  }, (err) => {
    console.error('[ZoneService] Realtime subscription error:', err);
  });
}

export function subscribeToZones(callback: (zones: Zone[]) => void) {
  zoneListeners.push(callback);
  if (cachedZones.length > 0) {
    callback(cachedZones);
  }
  return () => {
    zoneListeners = zoneListeners.filter(cb => cb !== callback);
  };
}

export function getCachedZones(): Zone[] {
  return cachedZones;
}
