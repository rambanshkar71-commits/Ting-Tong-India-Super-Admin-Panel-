import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, query, orderBy, limit, addDoc, doc, setDoc } from 'firebase/firestore';
import { Bell, Filter, Trash2, Activity, ShieldAlert, Bike, Store, User, Database, DollarSign, TrendingUp, Info, Calendar } from 'lucide-react';
import { getActiveCity } from '../../services/mapService';

interface LiveNotif {
  id: string;
  category: 'customer' | 'rider' | 'vendor' | 'admin' | 'payment' | 'orders' | 'security' | 'system';
  title: string;
  message: string;
  timestamp: string;
}

export default function NotificationPanel() {
  
  const [notifications, setNotifications] = useState<LiveNotif[]>([]);
  const [filter, setFilter] = useState<string>('all');

  // 1. Listen in real-time to the live feed
  useEffect(() => {
    const q = query(collection(db, 'system_live_notifications'), orderBy('timestamp', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snapshot) => {
      const items: LiveNotif[] = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() } as LiveNotif);
      });
      setNotifications(items);
    });

    return () => unsub();
  }, []);



  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'rider': return <Bike className="w-4 h-4 text-amber-500" />;
      case 'vendor': return <Store className="w-4 h-4 text-indigo-400" />;
      case 'customer': return <User className="w-4 h-4 text-emerald-400" />;
      case 'payment': return <DollarSign className="w-4 h-4 text-emerald-500" />;
      case 'orders': return <TrendingUp className="w-4 h-4 text-purple-400" />;
      case 'security': return <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />;
      case 'system': return <Database className="w-4 h-4 text-indigo-500" />;
      default: return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  const filteredNotifs = filter === 'all' 
    ? notifications 
    : notifications.filter(n => n.category === filter);

  return (
    <div className="bg-slate-900 border border-slate-850 p-6 rounded-3xl space-y-6" id="notification-panel-root">
      
      {/* Selector Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-850/60">
        <div className="space-y-1">
          <h4 className="font-bold text-sm text-slate-200 flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" /> Live Telemetry Log &amp; Feed Panel
          </h4>
          <p className="text-[10px] text-slate-500 font-mono">Real-time trace of logistic, security, and messaging events.</p>
        </div>

        <div className="flex flex-wrap gap-1">
          {['all', 'customer', 'rider', 'vendor', 'payment', 'orders', 'security', 'system'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition ${
                filter === cat 
                  ? 'bg-amber-500 text-slate-950 shadow-md' 
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-850'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Timeline */}
      <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
        {filteredNotifs.map(n => (
          <div key={n.id} className="bg-slate-950/60 border border-slate-850/60 p-4 rounded-2xl flex items-start gap-3.5 hover:border-slate-800 transition">
            
            {/* Category Marker */}
            <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl shrink-0">
              {getCategoryIcon(n.category)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <h5 className="font-bold text-xs text-slate-200">{n.title}</h5>
                <span className="text-[9px] text-slate-500 font-mono whitespace-nowrap pl-2">
                  {new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{n.message}</p>
              
              <div className="flex items-center gap-1.5 mt-2.5">
                <span className="text-[8px] px-1.5 py-0.5 rounded font-black font-mono uppercase bg-slate-900 text-slate-400">
                  REF: {n.category}
                </span>
                <span className="text-[8px] text-slate-500 font-mono">{getActiveCity().name} Cluster Node</span>
              </div>
            </div>

          </div>
        ))}

        {filteredNotifs.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-xs font-mono">
            No telemetry feeds found under this filter query.
          </div>
        )}
      </div>

    </div>
  );
}
