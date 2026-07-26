import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { 
  Megaphone, 
  Send, 
  Trash2, 
  AlertOctagon, 
  Layers, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Users, 
  Smartphone, 
  Mail, 
  MessageSquare, 
  MapPin, 
  Store 
} from 'lucide-react';
import { CommunicationAlert, Zone, Restaurant, Customer, Rider } from '../../types';
import { getActiveCity } from '../../services/mapService';

interface AlertCenterProps {
  zones: Zone[];
  restaurants: Restaurant[];
  customers: Customer[];
  riders: Rider[];
}

export default function AlertCenter({
  zones,
  restaurants,
  customers,
  riders
}: AlertCenterProps) {
  
  // State
  const [alerts, setAlerts] = useState<CommunicationAlert[]>([]);
  const [targetType, setTargetType] = useState<CommunicationAlert['targetType']>('all_customers');
  const [alertType, setAlertType] = useState<CommunicationAlert['alertType']>('emergency');
  const [priority, setPriority] = useState<CommunicationAlert['priority']>('critical');
  
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  
  const [inApp, setInApp] = useState(true);
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);
  const [sms, setSms] = useState(false);

  // Targets picker states
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 1. Fetch Alert History from Firestore
  useEffect(() => {
    const q = query(collection(db, 'communication_alerts'), orderBy('sentAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const items: CommunicationAlert[] = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() } as CommunicationAlert);
      });
      setAlerts(items);
    });

    return () => unsub();
  }, []);

  const handleDispatchAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      alert("Please fill in the Alert title and description message.");
      return;
    }

    setSubmitting(true);
    try {
      // Calculate recipient counts based on target
      let totalRecipients = 0;
      if (targetType === 'all_customers') totalRecipients = customers.length;
      else if (targetType === 'all_riders') totalRecipients = riders.length;
      else if (targetType === 'all_vendors') totalRecipients = restaurants.length;
      else if (targetType === 'all_admins') totalRecipients = 1;
      else if (targetType === 'selected_users') totalRecipients = selectedTargetIds.length;
      else if (targetType === 'selected_zones') totalRecipients = selectedTargetIds.length;
      else if (targetType === 'selected_restaurants') totalRecipients = selectedTargetIds.length;

      const newAlert: Omit<CommunicationAlert, 'id'> = {
        senderId: 'super_admin_bhopal',
        senderName: 'Super Admin',
        targetType,
        targetIds: selectedTargetIds,
        alertType,
        priority,
        title,
        message,
        deliveryMethods: {
          inApp,
          push,
          email,
          sms
        },
        sentAt: new Date().toISOString(),
        deliveryStatus: 'sent',
        readCount: 0,
        failedCount: 0,
        deliveryStats: {
          delivered: [],
          read: [],
          failed: []
        }
      };

      await addDoc(collection(db, 'communication_alerts'), newAlert);

      // Reset form
      setTitle('');
      setMessage('');
      setSelectedTargetIds([]);
      alert("✓ Alert dispatched successfully in real-time across selected communication channels.");

    } catch (err: any) {
      alert("Error dispatching alert: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'communication_alerts', id));
    } catch (e: any) {
      console.error("Delete failed: ", e);
    }
  };

  // Quick select checkbox helper
  const handleToggleTarget = (id: string) => {
    setSelectedTargetIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const getPriorityBadgeColor = (p: string) => {
    if (p === 'critical') return 'bg-rose-500/10 text-rose-500 border border-rose-500/20';
    if (p === 'high') return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
    if (p === 'normal') return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
    return 'bg-slate-800 text-slate-400';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="alert-center-root">
      
      {/* LEFT FORM: DISPATCH CONSOLE */}
      <form onSubmit={handleDispatchAlert} className="lg:col-span-5 bg-slate-900 border border-slate-850 p-6 rounded-3xl space-y-4">
        <h4 className="font-black text-xs uppercase text-slate-400 tracking-wider flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-amber-500" /> Dispatch New Security / Emergency Alert
        </h4>

        {/* 1. Recipient Target Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-400 uppercase font-black tracking-wide">Target Audience</label>
          <select
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value as any);
              setSelectedTargetIds([]);
            }}
            className="w-full bg-slate-950 border border-slate-850 text-xs rounded-xl p-2.5 text-slate-200 outline-none focus:border-amber-500"
          >
            <option value="all_customers">All Registered Customers</option>
            <option value="all_riders">All Fleet Riders</option>
            <option value="all_vendors">All Restaurant Vendors</option>
            <option value="all_admins">All Operations Admins</option>
            <option value="selected_zones">Specific Geographic Zones</option>
            <option value="selected_restaurants">Specific Restaurants</option>
          </select>
        </div>

        {/* Selected Zones/Restaurants list if applicable */}
        {targetType === 'selected_zones' && (
          <div className="space-y-1.5 p-3 rounded-2xl bg-slate-950 border border-slate-850/60 max-h-32 overflow-y-auto">
            <span className="text-[9px] font-black uppercase text-slate-500 block mb-2">Select Target Zones</span>
            {zones.map(z => (
              <label key={z.id} className="flex items-center gap-2 text-[11px] text-slate-300 mb-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTargetIds.includes(z.id)}
                  onChange={() => handleToggleTarget(z.id)}
                  className="rounded text-amber-500 focus:ring-0 bg-slate-950 border-slate-800"
                />
                <span>{z.name}</span>
              </label>
            ))}
          </div>
        )}

        {targetType === 'selected_restaurants' && (
          <div className="space-y-1.5 p-3 rounded-2xl bg-slate-950 border border-slate-850/60 max-h-32 overflow-y-auto">
            <span className="text-[9px] font-black uppercase text-slate-500 block mb-2">Select Target Restaurants</span>
            {restaurants.map(r => (
              <label key={r.id} className="flex items-center gap-2 text-[11px] text-slate-300 mb-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTargetIds.includes(r.id)}
                  onChange={() => handleToggleTarget(r.id)}
                  className="rounded text-amber-500 focus:ring-0 bg-slate-950 border-slate-800"
                />
                <span>{r.name}</span>
              </label>
            ))}
          </div>
        )}

        {/* 2. Alert Type & Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase font-black tracking-wide">Alert Type</label>
            <select
              value={alertType}
              onChange={(e) => setAlertType(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-850 text-xs rounded-xl p-2.5 text-slate-200 outline-none focus:border-amber-500"
            >
              <option value="emergency">Emergency Alert</option>
              <option value="order">Order Alert</option>
              <option value="payment">Payment Alert</option>
              <option value="maintenance">Maintenance Alert</option>
              <option value="security">Security Alert</option>
              <option value="weather">Weather Alert</option>
              <option value="traffic">Traffic Alert</option>
              <option value="service_update">Service Update</option>
              <option value="promotional">Promotional Alert</option>
              <option value="custom">Custom Alert</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase font-black tracking-wide">Priority Level</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-850 text-xs rounded-xl p-2.5 text-slate-200 outline-none focus:border-amber-500"
            >
              <option value="critical">Critical (Immediate)</option>
              <option value="high">High Priority</option>
              <option value="normal">Normal</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
        </div>

        {/* 3. Delivery Channels */}
        <div className="space-y-2 p-3 bg-slate-950 border border-slate-850 rounded-2xl">
          <span className="text-[10px] text-slate-500 uppercase font-black block mb-2">Delivery Channels</span>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={inApp}
                onChange={() => setInApp(!inApp)}
                className="rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-800"
              />
              <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5 text-indigo-400" /> In-App Notification</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={push}
                onChange={() => setPush(!push)}
                className="rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-800"
              />
              <span className="flex items-center gap-1"><Smartphone className="w-3.5 h-3.5 text-amber-500" /> Push Notification</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={email}
                onChange={() => setEmail(!email)}
                className="rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-800"
              />
              <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-rose-400" /> Email Ready</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={sms}
                onChange={() => setSms(!sms)}
                className="rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-800"
              />
              <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5 text-emerald-400" /> SMS Ready</span>
            </label>
          </div>
        </div>

        {/* 4. Details Text */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-400 uppercase font-black tracking-wide">Alert Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Critical Water Logging in Zone A"
            className="w-full bg-slate-950 border border-slate-850 text-xs rounded-xl p-2.5 text-slate-200 outline-none focus:border-amber-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-400 uppercase font-black tracking-wide">Alert Message Details</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder={`Describe the instructions or warnings for recipients in ${getActiveCity().name}...`}
            className="w-full bg-slate-950 border border-slate-850 text-xs rounded-xl p-2.5 text-slate-200 outline-none focus:border-amber-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber-500 disabled:opacity-55 hover:brightness-115 text-slate-950 py-3 rounded-xl text-xs font-black tracking-wider flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Send className="w-4 h-4" /> DISPATCH BROADCAST CHANNELS
        </button>

      </form>

      {/* RIGHT LIST: DISPATCH LOGS */}
      <div className="lg:col-span-7 bg-slate-900 border border-slate-850 p-6 rounded-3xl flex flex-col h-full space-y-4">
        <h4 className="font-black text-xs uppercase text-slate-400 tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" /> Historical Dispatch &amp; Delivery Tracking
        </h4>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[60vh]">
          {alerts.map(a => (
            <div key={a.id} className="bg-slate-950/60 border border-slate-850 p-4 rounded-2xl space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${getPriorityBadgeColor(a.priority)}`}>
                    {a.priority}
                  </span>
                  <span className="text-[9px] uppercase font-bold text-slate-500 ml-2">Type: {a.alertType}</span>
                </div>
                
                <button
                  type="button"
                  onClick={() => handleDeleteAlert(a.id)}
                  className="text-slate-500 hover:text-rose-500 p-1 rounded-lg transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <h5 className="font-bold text-xs text-slate-200">{a.title}</h5>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-1">{a.message}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-850/60 text-[10px] text-slate-500">
                <div>
                  <span className="block text-[8px] font-mono text-slate-500 uppercase">Target</span>
                  <span className="font-bold text-slate-300 font-mono text-[9px] uppercase">{a.targetType.replace('all_', '').replace('selected_', '')}</span>
                </div>

                <div>
                  <span className="block text-[8px] font-mono text-slate-500 uppercase">Sent Time</span>
                  <span className="font-bold text-slate-300 font-mono text-[9px]">{new Date(a.sentAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>

                <div>
                  <span className="block text-[8px] font-mono text-slate-500 uppercase">Success Rate</span>
                  <span className="font-bold text-emerald-400 font-mono text-[9px] flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    {a.readCount} Reads
                  </span>
                </div>

                <div>
                  <span className="block text-[8px] font-mono text-slate-500 uppercase">Failed count</span>
                  <span className={`font-bold font-mono text-[9px] ${a.failedCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {a.failedCount} Failed
                  </span>
                </div>
              </div>

              {/* Delivery Channels status row */}
              <div className="flex gap-2 text-[9px] text-slate-500 pt-1">
                <span className="font-mono">Channels:</span>
                {a.deliveryMethods.inApp && <span className="bg-slate-900 px-1.5 py-0.5 rounded font-mono text-indigo-400">IN-APP</span>}
                {a.deliveryMethods.push && <span className="bg-slate-900 px-1.5 py-0.5 rounded font-mono text-amber-500">PUSH</span>}
                {a.deliveryMethods.email && <span className="bg-slate-900 px-1.5 py-0.5 rounded font-mono text-rose-400">EMAIL</span>}
                {a.deliveryMethods.sms && <span className="bg-slate-900 px-1.5 py-0.5 rounded font-mono text-emerald-400">SMS</span>}
              </div>

            </div>
          ))}

          {alerts.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-xs font-mono">
              No alert logs dispatched yet.
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
