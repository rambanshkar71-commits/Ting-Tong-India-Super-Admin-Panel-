import { WorkZone, Order, Rider } from '../types';
import { calculateDistance } from '../services/mapService';

/**
 * Standard Ray-Casting Point-in-Polygon check.
 */
export function isPointInPolygon(lat: number, lng: number, polygon: any[]): boolean {
  if (!polygon || polygon.length < 3) return false;
  
  // Normalize polygon array elements to { lat, lng }
  const normalizedPoly: { lat: number; lng: number }[] = polygon.map(pt => {
    if (Array.isArray(pt)) {
      return { lat: Number(pt[0]), lng: Number(pt[1]) };
    }
    if (pt && typeof pt === 'object') {
      return { lat: Number(pt.lat ?? pt.latitude ?? 0), lng: Number(pt.lng ?? pt.longitude ?? 0) };
    }
    return { lat: 0, lng: 0 };
  });

  let inside = false;
  for (let i = 0, j = normalizedPoly.length - 1; i < normalizedPoly.length; j = i++) {
    const xi = normalizedPoly[i].lat, yi = normalizedPoly[i].lng;
    const xj = normalizedPoly[j].lat, yj = normalizedPoly[j].lng;
    const intersect = ((yi > lng) !== (yj > lng)) &&
        (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Checks if a coordinate (lat, lng) falls within a Work Zone.
 * If zone has polygon with >= 3 vertices, uses polygon matching.
 * Otherwise, uses radius distance from center.
 */
export function isLocationInZone(lat: number, lng: number, zone: WorkZone): boolean {
  if (!zone || zone.active === false) return false;

  // Polygon boundary check if present
  if (Array.isArray(zone.polygon) && zone.polygon.length >= 3) {
    return isPointInPolygon(lat, lng, zone.polygon);
  }

  // Radius check fallback
  const cLat = zone.centerLat ?? (zone.center as any)?.lat ?? (Array.isArray(zone.center) ? zone.center[0] : 23.25);
  const cLng = zone.centerLng ?? (zone.center as any)?.lng ?? (Array.isArray(zone.center) ? zone.center[1] : 77.4124);
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return false;
  
  const distKm = calculateDistance(lat, lng, cLat, cLng);
  return distKm <= (zone.radius || 5);
}

/**
 * Determines which WorkZone an Order belongs to.
 * Matches by explicit order.workZoneId / workZone name, or by location (restaurantLat/Lng or deliveryLat/Lng).
 */
export function getZoneForOrder(order: Order, workZones: WorkZone[]): WorkZone | null {
  const activeZones = workZones.filter(z => z.active !== false);
  
  // 1. Explicit ID match
  if (order.workZoneId) {
    const matched = activeZones.find(z => z.id === order.workZoneId || z.zoneId === order.workZoneId);
    if (matched) return matched;
  }

  // 2. Explicit name match
  if (order.workZone) {
    const matched = activeZones.find(z => 
      z.name.toLowerCase() === order.workZone!.toLowerCase() || 
      z.zoneName.toLowerCase() === order.workZone!.toLowerCase()
    );
    if (matched) return matched;
  }

  // 3. Polygon / Radius location match using restaurant location
  const restLat = order.restaurantLat;
  const restLng = order.restaurantLng;
  if (typeof restLat === 'number' && typeof restLng === 'number' && restLat !== 0 && restLng !== 0) {
    const matched = activeZones.find(z => isLocationInZone(restLat, restLng, z));
    if (matched) return matched;
  }

  // 4. City fallback
  if (order.cityId || order.city) {
    const cityZones = activeZones.filter(z => 
      z.cityId === order.cityId || 
      z.cityName.toLowerCase() === (order.city || '').toLowerCase()
    );
    if (cityZones.length > 0) return cityZones[0];
  }

  return activeZones[0] || null;
}

/**
 * Determines which WorkZone a Rider belongs to.
 */
export function getZoneForRider(rider: Rider, workZones: WorkZone[]): WorkZone | null {
  const activeZones = workZones.filter(z => z.active !== false);

  // 1. Explicit rider workZoneId match
  if ((rider as any).workZoneId) {
    const matched = activeZones.find(z => z.id === (rider as any).workZoneId || z.zoneId === (rider as any).workZoneId);
    if (matched) return matched;
  }

  // 2. Explicit rider workZone name match
  if (rider.workZone || (rider as any).zone) {
    const rZoneName = (rider.workZone || (rider as any).zone || '').toLowerCase();
    const matched = activeZones.find(z => 
      z.name.toLowerCase() === rZoneName || 
      z.zoneName.toLowerCase() === rZoneName
    );
    if (matched) return matched;
  }

  // 3. Location-based polygon / radius match
  if (typeof rider.lat === 'number' && typeof rider.lng === 'number' && rider.lat !== 0 && rider.lng !== 0) {
    const matched = activeZones.find(z => isLocationInZone(rider.lat, rider.lng, z));
    if (matched) return matched;
  }

  // 4. City match fallback
  if (rider.cityId || rider.city) {
    const cityZones = activeZones.filter(z => 
      z.cityId === rider.cityId || 
      z.cityName.toLowerCase() === (rider.city || '').toLowerCase()
    );
    if (cityZones.length > 0) return cityZones[0];
  }

  return activeZones[0] || null;
}

/**
 * Checks if a Rider and Order belong to the same Work Zone.
 */
export function isRiderInOrderWorkZone(rider: Rider, order: Order, workZones: WorkZone[]): boolean {
  const orderZone = getZoneForOrder(order, workZones);
  const riderZone = getZoneForRider(rider, workZones);
  
  if (!orderZone || !riderZone) return true;
  return orderZone.id === riderZone.id;
}
