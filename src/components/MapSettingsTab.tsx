import React, { useState, useEffect } from 'react';
import { MapSettings, getActiveMapSettings, updateMapSettingsInDb, subscribeToMapSettings, CityConfig, DEFAULT_CITIES } from '../services/mapService';
import { 
  Map, 
  Settings, 
  MapPin, 
  Navigation, 
  Truck, 
  Clock, 
  ShieldCheck, 
  Compass, 
  Layers, 
  CheckCircle,
  HelpCircle,
  Plus,
  Trash2,
  Sliders,
  RefreshCw,
  Eye,
  TrafficCone
} from 'lucide-react';

interface MapSettingsTabProps {
  onLogEvent: (action: string, details: string) => void;
}

export default function MapSettingsTab({ onLogEvent }: MapSettingsTabProps) {
  const [settings, setSettings] = useState<MapSettings>(getActiveMapSettings());
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Local state for adding a new city
  const [newCityId, setNewCityId] = useState('');
  const [newCityName, setNewCityName] = useState('');
  const [newCityLat, setNewCityLat] = useState('');
  const [newCityLng, setNewCityLng] = useState('');
  const [newCityZoom, setNewCityZoom] = useState('13');
  const [newCityState, setNewCityState] = useState('');
  const [newCityCountry, setNewCityCountry] = useState('India');
  const [cityError, setCityError] = useState('');

  useEffect(() => {
    // Keep local state in sync with map service's live state
    const unsubscribe = subscribeToMapSettings((current) => {
      setSettings(current);
    });
    return unsubscribe;
  }, []);

  const handleChange = (key: keyof MapSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSavedSuccess(false);
    try {
      await updateMapSettingsInDb(settings);
      setSavedSuccess(true);
      onLogEvent('MAP_SETTINGS_UPDATE', `Modified centralized platform map configurations, selected active city id "${settings.activeCityId}", and updated pricing metrics.`);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to save map settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateCity = async (cityId: string) => {
    const selectedCity = settings.cities?.find(c => c.id === cityId);
    if (!selectedCity) return;

    setLoading(true);
    try {
      const updated = {
        ...settings,
        activeCityId: cityId,
        defaultCenterLat: selectedCity.centerLat,
        defaultCenterLng: selectedCity.centerLng,
        defaultZoom: selectedCity.defaultZoom
      };
      setSettings(updated);
      await updateMapSettingsInDb(updated);
      setSavedSuccess(true);
      onLogEvent('CITY_SWITCHED', `Platform active operational center switched dynamically to ${selectedCity.name}, ${selectedCity.state}. All panels updated.`);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to switch city:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCity = async (e: React.FormEvent) => {
    e.preventDefault();
    setCityError('');

    if (!newCityId || !newCityName || !newCityLat || !newCityLng) {
      setCityError('All core geographic fields are required.');
      return;
    }

    const cleanId = newCityId.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanId) {
      setCityError('Invalid City ID format (letters and numbers only).');
      return;
    }

    if (settings.cities?.some(c => c.id === cleanId)) {
      setCityError('A city with this unique ID already exists.');
      return;
    }

    const latVal = parseFloat(newCityLat);
    const lngVal = parseFloat(newCityLng);
    const zoomVal = parseInt(newCityZoom);

    if (isNaN(latVal) || latVal < -90 || latVal > 90) {
      setCityError('Latitude must be a valid coordinate between -90 and 90.');
      return;
    }
    if (isNaN(lngVal) || lngVal < -180 || lngVal > 180) {
      setCityError('Longitude must be a valid coordinate between -180 and 180.');
      return;
    }

    const newCity: CityConfig = {
      id: cleanId,
      name: newCityName.trim(),
      centerLat: latVal,
      centerLng: lngVal,
      defaultZoom: isNaN(zoomVal) ? 13 : zoomVal,
      state: newCityState.trim() || 'State',
      country: newCityCountry.trim() || 'India'
    };

    const updatedCities = [...(settings.cities || DEFAULT_CITIES), newCity];
    const updated = {
      ...settings,
      cities: updatedCities
    };

    setLoading(true);
    try {
      setSettings(updated);
      await updateMapSettingsInDb(updated);
      onLogEvent('CITY_CREATED', `Registered new dynamic operational city: "${newCity.name}" (${newCity.id}) located at [${newCity.centerLat}, ${newCity.centerLng}].`);
      
      // Clear inputs
      setNewCityId('');
      setNewCityName('');
      setNewCityLat('');
      setNewCityLng('');
      setNewCityZoom('13');
      setNewCityState('');
    } catch (err) {
      console.error('Failed to add city:', err);
      setCityError('Failed to save to database.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCity = async (cityId: string) => {
    if (cityId === settings.activeCityId) {
      return;
    }

    const updatedCities = (settings.cities || []).filter(c => c.id !== cityId);
    const updated = {
      ...settings,
      cities: updatedCities
    };

    setLoading(true);
    try {
      setSettings(updated);
      await updateMapSettingsInDb(updated);
      onLogEvent('CITY_REMOVED', `Removed operational city "${cityId}" from the system config.`);
    } catch (err) {
      console.error('Failed to delete city:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-8 animate-fade-in">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 animate-pulse-slow">
            <Map className="w-5 h-5 text-amber-500" />
            Centralized Map & Routing Engine Settings
          </h3>
          <p className="text-slate-400 text-xs mt-0.5">
            Configure OpenStreetMap overlays, OSRM road geometry servers, distance calculation standards, and algorithmic ETAs.
          </p>
        </div>
        <div className="bg-slate-950 px-3 py-1 rounded-lg border border-slate-800/80 flex items-center gap-2 self-start sm:self-center">
          <Compass className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
          <span className="text-[10px] font-mono font-bold text-slate-300">MAP ENGINE ONLINE</span>
        </div>
      </div>

      {/* SECTION A: Multi-City Operations Hub */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-800">
          <MapPin className="w-4 h-4 text-emerald-400" />
          Multi-City Active Deployments
        </h4>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active City Selection Card */}
          <div className="lg:col-span-2 bg-slate-950 border border-slate-850 p-5 rounded-xl space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Currently Active Service City</span>
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded text-[10px] font-mono font-bold uppercase">
                  ACTIVE GATEWAY
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold mb-1 block">Select System City</label>
                  <select
                    value={settings.activeCityId}
                    onChange={(e) => handleActivateCity(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 font-bold cursor-pointer"
                  >
                    {(settings.cities || DEFAULT_CITIES).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.state}, {c.country})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex flex-col justify-center">
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Current Coordinates</span>
                  <p className="text-xs font-mono text-slate-300 mt-1 font-bold">
                    Lat: {settings.defaultCenterLat.toFixed(4)}
                  </p>
                  <p className="text-xs font-mono text-slate-300 font-bold">
                    Lng: {settings.defaultCenterLng.toFixed(4)}
                  </p>
                </div>
              </div>

              {/* List of Supported Cities with stats & delete action */}
              <div className="pt-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2">Registered Operational Cities</span>
                <div className="max-h-[140px] overflow-y-auto border border-slate-850 rounded-lg divide-y divide-slate-850 bg-slate-900/40">
                  {(settings.cities || DEFAULT_CITIES).map((c) => {
                    const isActive = c.id === settings.activeCityId;
                    return (
                      <div key={c.id} className="p-2.5 flex items-center justify-between text-xs transition hover:bg-slate-900/80">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
                          <div>
                            <p className="font-bold text-slate-200">{c.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              {c.state}, {c.country} • Lat/Lng: [{c.centerLat}, {c.centerLng}]
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isActive ? (
                            <span className="px-1.5 py-0.5 bg-slate-800 text-[9px] font-bold text-slate-400 rounded uppercase">Live</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleActivateCity(c.id)}
                              className="px-2 py-1 text-[10px] bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-slate-950 font-bold rounded transition cursor-pointer"
                            >
                              Activate
                            </button>
                          )}
                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCity(c.id)}
                              className="p-1 text-slate-600 hover:text-rose-500 rounded transition cursor-pointer"
                              title="Delete City"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 leading-normal mt-3">
              * Activating a city triggers an instant, state-synchronized re-centering of all customer maps, rider tracking, and zone boundaries across the platform.
            </p>
          </div>

          {/* Add City Form Card */}
          <div className="bg-slate-950 border border-slate-850 p-5 rounded-xl space-y-4">
            <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              Add Operational City
            </h5>

            <form onSubmit={handleAddCity} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase block">City ID (Unique)</label>
                  <input
                    required
                    type="text"
                    value={newCityId}
                    onChange={e => setNewCityId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
                    placeholder="indore"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase block">City Name</label>
                  <input
                    required
                    type="text"
                    value={newCityName}
                    onChange={e => setNewCityName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-200 outline-none focus:border-amber-500"
                    placeholder="Indore"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase block">Center Lat</label>
                  <input
                    required
                    type="number"
                    step="0.0001"
                    value={newCityLat}
                    onChange={e => setNewCityLat(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
                    placeholder="22.7196"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase block">Center Lng</label>
                  <input
                    required
                    type="number"
                    step="0.0001"
                    value={newCityLng}
                    onChange={e => setNewCityLng(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
                    placeholder="75.8577"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase block">State</label>
                  <input
                    required
                    type="text"
                    value={newCityState}
                    onChange={e => setNewCityState(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-200 outline-none focus:border-amber-500"
                    placeholder="Madhya Pradesh"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase block">Zoom Level</label>
                  <input
                    required
                    type="number"
                    value={newCityZoom}
                    onChange={e => setNewCityZoom(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
                    placeholder="13"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-slate-400 font-bold uppercase block">Country</label>
                <input
                  required
                  type="text"
                  value={newCityCountry}
                  onChange={e => setNewCityCountry(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-200 outline-none focus:border-amber-500"
                  placeholder="India"
                />
              </div>

              {cityError && (
                <p className="text-[10px] text-rose-500 font-bold bg-rose-500/10 border border-rose-500/20 p-2 rounded">
                  {cityError}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 px-3 rounded text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Register City</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* ROW 1: Providers & General Configs (Section 6 Requirements) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Map Layer Provider Configuration */}
          <div className="bg-slate-950 border border-slate-850 p-5 rounded-xl space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-850">
              <Layers className="w-4 h-4 text-amber-400" />
              Map Engine & Display Configurations
            </h4>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Map Provider</label>
                  <select
                    value={settings.mapProvider}
                    onChange={e => handleChange('mapProvider', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 cursor-pointer font-bold"
                  >
                    <option value="OpenStreetMap">OpenStreetMap</option>
                    <option value="Leaflet">Leaflet Core</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Routing Provider</label>
                  <select
                    value={settings.routingProvider}
                    onChange={e => handleChange('routingProvider', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 cursor-pointer font-bold"
                  >
                    <option value="OSRM">OSRM Engine</option>
                    <option value="Custom API">GraphHopper (Static Fallback)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span>Tile Server URL Template</span>
                </label>
                <input 
                  required
                  type="text"
                  value={settings.tileUrl}
                  onChange={e => handleChange('tileUrl', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
                  placeholder="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Map Attribution Text</label>
                <input 
                  required
                  type="text"
                  value={settings.attribution}
                  onChange={e => handleChange('attribution', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* Extra Toggles: Zone Visibility & Simulated Traffic Layer */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-900/60 p-2.5 border border-slate-850 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] text-slate-300 font-bold uppercase">Zone Boundary</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.zoneVisibility}
                    onChange={e => handleChange('zoneVisibility', e.target.checked)}
                    className="accent-amber-500 cursor-pointer w-3.5 h-3.5"
                  />
                </div>

                <div className="bg-slate-900/60 p-2.5 border border-slate-850 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <TrafficCone className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[10px] text-slate-300 font-bold uppercase">Traffic Simulation</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.trafficLayer}
                    onChange={e => handleChange('trafficLayer', e.target.checked)}
                    className="accent-amber-500 cursor-pointer w-3.5 h-3.5"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Leaflet & Routing Provider Settings */}
          <div className="bg-slate-950 border border-slate-850 p-5 rounded-xl space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-850">
              <Navigation className="w-4 h-4 text-sky-400" />
              Routing Server & Telemetry Intervals
            </h4>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">OSRM Backend API Endpoint</label>
                <input 
                  required
                  type="text"
                  value={settings.osrmEndpoint}
                  onChange={e => handleChange('osrmEndpoint', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
                  placeholder="https://router.project-osrm.org/route/v1/driving"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Telemetry Refresh Interval (Secs)</label>
                  <input 
                    required
                    type="number"
                    min="5"
                    max="120"
                    value={settings.refreshInterval}
                    onChange={e => handleChange('refreshInterval', parseInt(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Default Map Zoom</label>
                  <input 
                    required
                    type="number"
                    value={settings.defaultZoom}
                    onChange={e => handleChange('defaultZoom', parseInt(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Min Zoom Bound</label>
                  <input 
                    required
                    type="number"
                    value={settings.minZoom}
                    onChange={e => handleChange('minZoom', parseInt(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Max Zoom Bound</label>
                  <input 
                    required
                    type="number"
                    value={settings.maxZoom}
                    onChange={e => handleChange('maxZoom', parseInt(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-slate-900/50 rounded-lg border border-slate-800 text-[10px] text-slate-400 flex items-start gap-2 leading-relaxed">
                <Compass className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5 animate-spin-slow" />
                <span>The dynamic telemetry cycle continuously requests GPS updates from couriers using a standard <strong>{settings.refreshInterval} second ping cycle</strong>.</span>
              </div>
            </div>
          </div>

        </div>

        {/* ROW 2: Zones & Distance Standard Mode */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Delivery Zone Boundaries */}
          <div className="bg-slate-950 border border-slate-850 p-5 rounded-xl space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-850">
              <Sliders className="w-4 h-4 text-emerald-400" />
              Logistics Zone Defaults
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Default Radius (KM)</label>
                <input 
                  required
                  type="number"
                  step="0.1"
                  value={settings.defaultZoneRadius}
                  onChange={e => handleChange('defaultZoneRadius', parseFloat(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Base Zone Charge (₹)</label>
                <input 
                  required
                  type="number"
                  value={settings.defaultZoneCharges}
                  onChange={e => handleChange('defaultZoneCharges', parseInt(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Max Deliveries Dist (KM)</label>
                <input 
                  required
                  type="number"
                  step="0.5"
                  value={settings.defaultMaxDistance}
                  onChange={e => handleChange('defaultMaxDistance', parseFloat(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            <p className="text-[10px] text-slate-500 leading-normal">
              These initial parameters configure default bounds for newly created logistics sectors.
            </p>
          </div>

          {/* Distance Calculation Mode */}
          <div className="bg-slate-950 border border-slate-850 p-5 rounded-xl space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-850">
              <Compass className="w-4 h-4 text-indigo-400" />
              Standard Distance Measurement Logic
            </h4>
            
            <div className="space-y-3">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Select Platform Logic</label>
              
              <div className="grid grid-cols-1 gap-2.5">
                <label className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                  settings.distanceMode === 'osrm' 
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-500' 
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}>
                  <div className="space-y-0.5 text-left">
                    <p className="text-xs font-bold">OSRM Real Road Trajectory (Highly Recommended)</p>
                    <p className="text-[9px] text-slate-500 leading-tight">True road network navigation length. Eliminates billing leakage caused by straight-line estimates.</p>
                  </div>
                  <input 
                    type="radio" 
                    name="distanceMode" 
                    value="osrm" 
                    checked={settings.distanceMode === 'osrm'}
                    onChange={() => handleChange('distanceMode', 'osrm')}
                    className="hidden" 
                  />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    settings.distanceMode === 'osrm' ? 'border-amber-500' : 'border-slate-750'
                  }`}>
                    {settings.distanceMode === 'osrm' && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
                  </div>
                </label>

                <label className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                  settings.distanceMode === 'haversine' 
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-500' 
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}>
                  <div className="space-y-0.5 text-left">
                    <p className="text-xs font-bold">Haversine (Great-Circle Distance)</p>
                    <p className="text-[9px] text-slate-500 leading-tight">Straight-line trigonometry on a perfect sphere. Used primarily as a quick fallback or pre-filter.</p>
                  </div>
                  <input 
                    type="radio" 
                    name="distanceMode" 
                    value="haversine" 
                    checked={settings.distanceMode === 'haversine'}
                    onChange={() => handleChange('distanceMode', 'haversine')}
                    className="hidden" 
                  />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    settings.distanceMode === 'haversine' ? 'border-amber-500' : 'border-slate-750'
                  }`}>
                    {settings.distanceMode === 'haversine' && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
                  </div>
                </label>

                <label className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                  settings.distanceMode === 'manhattan' 
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-500' 
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}>
                  <div className="space-y-0.5 text-left">
                    <p className="text-xs font-bold">Manhattan (Grid Block Distance)</p>
                    <p className="text-[9px] text-slate-500 leading-tight">Taxi-cab orthogonal geometry ideal for grid-like metropolitan infrastructure.</p>
                  </div>
                  <input 
                    type="radio" 
                    name="distanceMode" 
                    value="manhattan" 
                    checked={settings.distanceMode === 'manhattan'}
                    onChange={() => handleChange('distanceMode', 'manhattan')}
                    className="hidden" 
                  />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    settings.distanceMode === 'manhattan' ? 'border-amber-500' : 'border-slate-750'
                  }`}>
                    {settings.distanceMode === 'manhattan' && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
                  </div>
                </label>
              </div>
            </div>
          </div>

        </div>

        {/* ROW 3: ETA Algorithm Variables */}
        <div className="bg-slate-950 border border-slate-850 p-5 rounded-xl space-y-4">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-850">
            <Clock className="w-4 h-4 text-purple-400" />
            Algorithmic ETA Configurations
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Average Rider Speed (KM/H)</label>
              <input 
                required
                type="number"
                value={settings.averageRiderSpeed}
                onChange={e => handleChange('averageRiderSpeed', parseInt(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
              />
              <span className="text-[9px] text-slate-500 block mt-1">Average velocity of couriers inside traffic limits.</span>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Prep & Handover Buffer (Mins)</label>
              <input 
                required
                type="number"
                value={settings.preparationBuffer}
                onChange={e => handleChange('preparationBuffer', parseInt(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
              />
              <span className="text-[9px] text-slate-500 block mt-1">Fixed time added for merchant preparation and client handover.</span>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Safety Multiplier Factor</label>
              <input 
                required
                type="number"
                step="0.1"
                value={settings.etaMultiplier}
                onChange={e => handleChange('etaMultiplier', parseFloat(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
              />
              <span className="text-[9px] text-slate-500 block mt-1">Scales theoretical travel durations for unpredictable delays.</span>
            </div>
          </div>

          <div className="bg-slate-900/50 p-4.5 rounded-xl border border-slate-800/80 space-y-2">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono">Algorithmic Projection Formula</p>
            <p className="text-xs font-mono text-slate-300">
              ETA = (Distance / {settings.averageRiderSpeed} km/h) * 60 mins * {settings.etaMultiplier} (Multiplier) + {settings.preparationBuffer} mins (Prep Buffer)
            </p>
            <p className="text-[10px] text-slate-500 leading-normal mt-1">
              Example for an active order at 3.0 KM distance: <strong>{Math.round(((3.0 / settings.averageRiderSpeed) * 60) * settings.etaMultiplier + settings.preparationBuffer)} minutes</strong> predicted delivery duration.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          {savedSuccess && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-4 py-2.5 rounded-xl border border-emerald-500/25">
              <CheckCircle className="w-4 h-4" />
              <span>Settings synchronized successfully across all panels!</span>
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 text-slate-950 font-black py-2.5 px-6 rounded-xl transition text-xs shadow-lg shadow-amber-900/10 cursor-pointer"
          >
            {loading ? 'Synchronizing configs...' : 'Save Settings'}
          </button>
        </div>

      </form>
    </div>
  );
}
