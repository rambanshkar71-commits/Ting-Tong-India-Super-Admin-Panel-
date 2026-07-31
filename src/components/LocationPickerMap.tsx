import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, Search, Loader2, CheckCircle2 } from 'lucide-react';

// Fix default Leaflet marker icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LocationPickerMapProps {
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
  onLocationSelect: (location: {
    lat: number;
    lng: number;
    address: string;
    city: string;
    state: string;
    pincode: string;
  }) => void;
}

export default function LocationPickerMap({
  initialLat = 23.2599,
  initialLng = 77.4126,
  initialAddress = '',
  onLocationSelect,
}: LocationPickerMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [lat, setLat] = useState<number>(initialLat);
  const [lng, setLng] = useState<number>(initialLng);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [addressDetails, setAddressDetails] = useState<{
    address: string;
    city: string;
    state: string;
    pincode: string;
  }>({
    address: initialAddress,
    city: 'Bhopal',
    state: 'Madhya Pradesh',
    pincode: '462001',
  });
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Reverse geocoding using Nominatim
  const reverseGeocode = async (latitude: number, longitude: number) => {
    setIsGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const formattedAddress = data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        const city = addr.city || addr.town || addr.village || addr.suburb || 'Bhopal';
        const state = addr.state || 'Madhya Pradesh';
        const pincode = addr.postcode || '462001';

        const newDetails = {
          address: formattedAddress,
          city,
          state,
          pincode,
        };

        setAddressDetails(newDetails);
        onLocationSelect({
          lat: latitude,
          lng: longitude,
          ...newDetails,
        });
      }
    } catch (err) {
      console.warn('Reverse geocoding error:', err);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Handle Search submit
  const handleSearchAddress = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=5&addressdetails=1`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
        if (data.length > 0) {
          const first = data[0];
          const newLat = parseFloat(first.lat);
          const newLng = parseFloat(first.lon);
          selectSearchResult(newLat, newLng, first);
        }
      }
    } catch (err) {
      console.warn('Search geocoding error:', err);
    } finally {
      setIsGeocoding(false);
    }
  };

  const selectSearchResult = (newLat: number, newLng: number, item: any) => {
    setLat(newLat);
    setLng(newLng);
    if (mapRef.current) {
      mapRef.current.setView([newLat, newLng], 16);
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([newLat, newLng]);
    }

    const addr = item.address || {};
    const formattedAddress = item.display_name;
    const city = addr.city || addr.town || addr.village || 'Bhopal';
    const state = addr.state || 'Madhya Pradesh';
    const pincode = addr.postcode || '462001';

    const newDetails = {
      address: formattedAddress,
      city,
      state,
      pincode,
    };

    setAddressDetails(newDetails);
    setSearchResults([]);
    onLocationSelect({
      lat: newLat,
      lng: newLng,
      ...newDetails,
    });
  };

  // Get Current GPS Location
  const handleUseCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsGeocoding(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;

        setLat(newLat);
        setLng(newLng);

        if (mapRef.current) {
          mapRef.current.setView([newLat, newLng], 17);
        }
        if (markerRef.current) {
          markerRef.current.setLatLng([newLat, newLng]);
        }

        reverseGeocode(newLat, newLng);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        alert('Could not access GPS location. Please ensure location permissions are granted.');
        setIsGeocoding(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 14,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([initialLat, initialLng], {
        draggable: true,
      }).addTo(map);

      marker.on('dragend', () => {
        const position = marker.getLatLng();
        setLat(position.lat);
        setLng(position.lng);
        reverseGeocode(position.lat, position.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;

      // Trigger initial reverse geocode if no address provided
      if (!initialAddress) {
        reverseGeocode(initialLat, initialLng);
      }
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchAddress(e)}
            placeholder="Search landmark, street, or address in Bhopal..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-20 py-2 text-xs text-slate-100 focus:border-orange-500 outline-none"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <button
            type="button"
            onClick={handleSearchAddress}
            className="absolute right-1 top-1 bottom-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 rounded-lg text-[10px] font-bold cursor-pointer"
          >
            Search
          </button>
        </div>

        <button
          type="button"
          onClick={handleUseCurrentLocation}
          className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shrink-0"
        >
          <Navigation className="w-3.5 h-3.5 fill-slate-950" /> Use Current GPS
        </button>
      </div>

      {/* Search results dropdown */}
      {searchResults.length > 0 && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 space-y-1 max-h-40 overflow-y-auto">
          {searchResults.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => selectSearchResult(parseFloat(item.lat), parseFloat(item.lon), item)}
              className="w-full text-left p-2 hover:bg-slate-900 rounded-lg text-[11px] text-slate-300 flex items-start gap-2 cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
              <span className="truncate">{item.display_name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Map view container */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-800 h-52 bg-slate-950">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {isGeocoding && (
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs z-20 flex items-center justify-center text-xs text-orange-400 font-bold gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Geocoding location details...
          </div>
        )}

        <div className="absolute bottom-2 left-2 z-20 bg-slate-950/90 border border-slate-800 px-2.5 py-1 rounded-lg text-[10px] font-mono text-slate-300">
          Lat: <span className="text-orange-400 font-bold">{lat.toFixed(5)}</span> | Lng:{' '}
          <span className="text-orange-400 font-bold">{lng.toFixed(5)}</span>
        </div>
      </div>

      {/* Address auto-filled result banner */}
      <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-start gap-2.5">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-0.5">
          <p className="font-semibold text-slate-200">{addressDetails.address || 'Address selected on map'}</p>
          <p className="text-[10px] text-slate-500 font-mono">
            {addressDetails.city}, {addressDetails.state} - {addressDetails.pincode}
          </p>
        </div>
      </div>
    </div>
  );
}
