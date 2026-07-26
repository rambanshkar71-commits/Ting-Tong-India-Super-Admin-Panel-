import { db } from '../firebase';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';

export interface CityConfig {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  defaultZoom: number;
  state: string;
  country: string;
}

export interface MapSettings {
  // Map Provider Settings (OpenStreetMap / Leaflet)
  tileUrl: string;
  attribution: string;
  defaultZoom: number;
  minZoom: number;
  maxZoom: number;
  defaultCenterLat: number;
  defaultCenterLng: number;
  
  // Routing Provider Settings (OSRM)
  osrmEndpoint: string;
  
  // Delivery Zone Settings
  defaultZoneRadius: number; // in KM
  defaultZoneCharges: number; // base area fee in ₹
  defaultMaxDistance: number; // max distance in KM
  
  // Distance Calculation Settings
  distanceMode: 'haversine' | 'manhattan' | 'osrm';
  
  // ETA Settings
  averageRiderSpeed: number; // in km/h
  preparationBuffer: number; // in minutes
  etaMultiplier: number; // multiplier for safety buffer

  // Dynamic Multi-City configurations
  activeCityId: string;
  cities: CityConfig[];

  // Admin settings requested in Section 6
  mapProvider: string; // "OpenStreetMap"
  routingProvider: string; // "OSRM"
  zoneVisibility: boolean;
  trafficLayer: boolean;
  refreshInterval: number; // in seconds
}

export const DEFAULT_CITIES: CityConfig[] = [
  { id: 'bhopal', name: 'Bhopal', centerLat: 23.2500, centerLng: 77.4124, defaultZoom: 13, state: 'Madhya Pradesh', country: 'India' },
  { id: 'biaora', name: 'Biaora', centerLat: 23.9164, centerLng: 76.9165, defaultZoom: 13, state: 'Madhya Pradesh', country: 'India' },
  { id: 'narsinghgarh', name: 'Narsinghgarh', centerLat: 23.7054, centerLng: 77.0917, defaultZoom: 13, state: 'Madhya Pradesh', country: 'India' },
  { id: 'tindoniya', name: 'Tindoniya', centerLat: 23.6333, centerLng: 77.0167, defaultZoom: 13, state: 'Madhya Pradesh', country: 'India' },
  { id: 'kurawar', name: 'Kurawar', centerLat: 23.5167, centerLng: 77.0333, defaultZoom: 13, state: 'Madhya Pradesh', country: 'India' },
  { id: 'sehore', name: 'Sehore', centerLat: 23.2032, centerLng: 77.0844, defaultZoom: 13, state: 'Madhya Pradesh', country: 'India' },
  { id: 'indore', name: 'Indore', centerLat: 22.7196, centerLng: 75.8577, defaultZoom: 13, state: 'Madhya Pradesh', country: 'India' },
  { id: 'mumbai', name: 'Mumbai', centerLat: 19.0760, centerLng: 72.8777, defaultZoom: 12, state: 'Maharashtra', country: 'India' },
  { id: 'delhi', name: 'Delhi', centerLat: 28.7041, centerLng: 77.1025, defaultZoom: 12, state: 'Delhi', country: 'India' },
  { id: 'bengaluru', name: 'Bengaluru', centerLat: 12.9716, centerLng: 77.5946, defaultZoom: 12, state: 'Karnataka', country: 'India' }
];

export const DEFAULT_MAP_SETTINGS: MapSettings = {
  tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  defaultZoom: 13,
  minZoom: 10,
  maxZoom: 18,
  defaultCenterLat: 23.2500,
  defaultCenterLng: 77.4124,
  osrmEndpoint: 'https://router.project-osrm.org/route/v1/driving',
  defaultZoneRadius: 3,
  defaultZoneCharges: 40,
  defaultMaxDistance: 10,
  distanceMode: 'osrm',
  averageRiderSpeed: 25,
  preparationBuffer: 10,
  etaMultiplier: 1.2,
  activeCityId: 'bhopal',
  cities: DEFAULT_CITIES,
  mapProvider: 'OpenStreetMap',
  routingProvider: 'OSRM',
  zoneVisibility: true,
  trafficLayer: false,
  refreshInterval: 10
};

// Simple caching of OSRM routing requests to avoid rate limits and improve performance
const osrmCache: Record<string, { coords: [number, number][]; distanceKm: number; durationMins: number }> = {};
const pendingRequests = new Set<string>();

// Live synchronized settings singleton
let activeSettings: MapSettings = { ...DEFAULT_MAP_SETTINGS };
let listeners: ((settings: MapSettings) => void)[] = [];

// Helper to ensure default cities are always present in activeSettings.cities
function mergeDefaultCities(remoteCities?: CityConfig[]): CityConfig[] {
  const list = Array.isArray(remoteCities) ? [...remoteCities] : [];
  for (const defCity of DEFAULT_CITIES) {
    if (!list.some(c => c.id === defCity.id)) {
      list.push(defCity);
    }
  }
  return list;
}

// Listen for updates from Firestore settings
export function initializeMapService() {
  const settingsRef = doc(db, 'settings', 'map');

  return onSnapshot(settingsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      const mergedCities = mergeDefaultCities(data?.cities);
      if (mergedCities.length !== (data?.cities?.length || 0)) {
        setDoc(settingsRef, { ...data, cities: mergedCities }, { merge: true }).catch(err => {
          console.warn('Could not merge new cities into Firestore map settings:', err);
        });
      }
      activeSettings = { ...DEFAULT_MAP_SETTINGS, ...data, cities: mergedCities } as MapSettings;
    } else {
      setDoc(settingsRef, DEFAULT_MAP_SETTINGS).catch(err => {
        console.warn('Could not seed default map settings in Firestore:', err);
      });
      activeSettings = { ...DEFAULT_MAP_SETTINGS };
    }
    listeners.forEach(cb => cb(activeSettings));
  }, (err) => {
    console.warn('Map settings listener notice:', err);
  });
}

// Subscribe to map settings changes
export function subscribeToMapSettings(callback: (settings: MapSettings) => void) {
  listeners.push(callback);
  callback(activeSettings); // Immediate execution with current settings
  return () => {
    listeners = listeners.filter(cb => cb !== callback);
  };
}

// Get the current active map settings synchronously
export function getActiveMapSettings(): MapSettings {
  return activeSettings;
}

// Get the current active city based on settings
export function getActiveCity(): CityConfig {
  const city = activeSettings.cities?.find(c => c.id === activeSettings.activeCityId);
  return city || DEFAULT_CITIES[0];
}

// Get the center coordinate for a zone name dynamically relative to a city center
export function getZoneCenterForCity(zoneName: string, city: CityConfig): [number, number] {
  let offsetLat = 0;
  let offsetLng = 0;
  
  if (zoneName.includes('MP Nagar') || zoneName.includes('Commercial') || zoneName.includes('Central') || zoneName.includes('Core')) {
    offsetLat = -0.0176;
    offsetLng = 0.0194;
  } else if (zoneName.includes('Arera') || zoneName.includes('Residential') || zoneName.includes('Sector 2')) {
    offsetLat = -0.0355;
    offsetLng = 0.0232;
  } else if (zoneName.includes('Kolar') || zoneName.includes('Southern') || zoneName.includes('Suburb')) {
    offsetLat = -0.0648;
    offsetLng = -0.0120;
  } else if (zoneName.includes('Indrapuri') || zoneName.includes('Eastern') || zoneName.includes('Sector 3')) {
    offsetLat = 0.0012;
    offsetLng = 0.0491;
  } else {
    // Generate a pseudo-stable stagger so multiple zones do not overlap exactly
    const sum = Array.from(zoneName).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    offsetLat = (((sum % 10) - 5) * 0.008);
    offsetLng = ((((sum >> 3) % 10) - 5) * 0.008);
  }
  return [city.centerLat + offsetLat, city.centerLng + offsetLng];
}

// Update settings inside Firestore
export async function updateMapSettingsInDb(newSettings: Partial<MapSettings>): Promise<void> {
  const settingsRef = doc(db, 'settings', 'map');
  const merged = { ...activeSettings, ...newSettings };
  await setDoc(settingsRef, merged);
  activeSettings = merged;
}

// Haversine distance calculator
export function calculateHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || typeof lat2 !== 'number' || typeof lon2 !== 'number' || isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    return 0;
  }
  const R = 6371; // Radius of earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Manhattan distance calculator
export function calculateManhattan(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || typeof lat2 !== 'number' || typeof lon2 !== 'number' || isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    return 0;
  }
  const latDist = Math.abs(lat2 - lat1) * 111.1; // roughly 111.1km per degree latitude
  const avgLat = (lat1 + lat2) / 2 * Math.PI / 180;
  const lonDist = Math.abs(lon2 - lon1) * 111.1 * Math.cos(avgLat); // adjusted for longitude convergence
  return latDist + lonDist;
}

// Synchronous distance calculation depending on settings
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (activeSettings.distanceMode === 'manhattan') {
    return calculateManhattan(lat1, lon1, lat2, lon2);
  }
  return calculateHaversine(lat1, lon1, lat2, lon2);
}

// Calculate ETA based on distance in KM and active configurations
export function calculateETA(distanceKm: number): number {
  if (distanceKm <= 0 || isNaN(distanceKm) || !isFinite(distanceKm)) return 0;
  // Time = (Distance / Speed) * 60 minutes
  const travelTimeMins = (distanceKm / activeSettings.averageRiderSpeed) * 60;
  const bufferedTime = travelTimeMins * activeSettings.etaMultiplier;
  return Math.round(bufferedTime + activeSettings.preparationBuffer);
}

// Retrieve OSRM Route (and Cache it)
export async function getOSRMRoute(
  startLng: number, 
  startLat: number, 
  endLng: number, 
  endLat: number
): Promise<{ coords: [number, number][]; distanceKm: number; durationMins: number }> {
  const cacheKey = `${startLng},${startLat};${endLng},${endLat}`;
  
  if (osrmCache[cacheKey]) {
    return osrmCache[cacheKey];
  }

  if (pendingRequests.has(cacheKey)) {
    // Wait for a brief moment and check cache again to prevent parallel duplicate calls
    await new Promise(resolve => setTimeout(resolve, 300));
    if (osrmCache[cacheKey]) return osrmCache[cacheKey];
  }

  pendingRequests.add(cacheKey);
  try {
    const base = activeSettings.osrmEndpoint;
    const url = `${base}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OSRM fetch failed with code: ${response.status}`);
    }
    const data = await response.json();
    if (data.routes && data.routes[0]) {
      const route = data.routes[0];
      const coords = route.geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]);
      const distanceKm = route.distance / 1000;
      const durationMins = route.duration / 60;
      
      const result = { coords, distanceKm, durationMins };
      osrmCache[cacheKey] = result;
      return result;
    }
    throw new Error('No route found in OSRM response');
  } catch (error) {
    console.error('OSRM route fetch failed, falling back to straight-line:', error);
    // Return direct route fallback
    const directDistance = calculateDistance(startLat, startLng, endLat, endLng);
    const fallbackDuration = (directDistance / activeSettings.averageRiderSpeed) * 60 * activeSettings.etaMultiplier + activeSettings.preparationBuffer;
    const fallback = {
      coords: [[startLat, startLng], [endLat, endLng]] as [number, number][],
      distanceKm: directDistance,
      durationMins: fallbackDuration
    };
    return fallback;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}
