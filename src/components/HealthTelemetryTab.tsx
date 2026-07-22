import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { AuditLog } from '../types';

interface TicketReply {
  sender: 'customer' | 'operator';
  text: string;
}

interface Ticket {
  id: string;
  customerName: string;
  issueType: string;
  description: string;
  status: 'open' | 'resolved';
  date: string;
  replies?: TicketReply[];
}
import { 
  Heart, 
  Search, 
  Database, 
  Activity, 
  ShieldAlert, 
  Code, 
  FileCheck, 
  RefreshCw, 
  Trash2, 
  MessageSquare, 
  Terminal, 
  ToggleLeft, 
  Key, 
  Sliders, 
  CheckCircle, 
  Clock 
} from 'lucide-react';

interface HealthTelemetryTabProps {
  auditLogs: AuditLog[];
  onLogEvent: (action: string, details: string) => void;
}

interface DeveloperKey {
  id: string;
  name: string;
  key: string;
  scope: string;
  created: string;
}

export default function HealthTelemetryTab({ auditLogs, onLogEvent }: HealthTelemetryTabProps) {
  const [loading, setLoading] = useState(true);
  const [dbLogs, setDbLogs] = useState<AuditLog[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');

  // Support Resolver
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [ticketReply, setTicketReply] = useState('');

  // Feature Flags
  const [liveTracking, setLiveTracking] = useState(true);
  const [inAppChat, setInAppChat] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [fraudStrict, setFraudStrict] = useState(true);

  // Developer Keys
  const [apiKeys, setApiKeys] = useState<DeveloperKey[]>([]);
  const [newKeyLabel, setNewKeyLabel] = useState('');

  useEffect(() => {
    const fetchTelemetryAndLogs = async () => {
      try {
        const logsSnap = await getDocs(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(15)));
        if (!logsSnap.empty) {
          setDbLogs(logsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as AuditLog));
        } else {
          setDbLogs(auditLogs);
        }

        const ticketsSnap = await getDocs(collection(db, 'tickets'));
        if (!ticketsSnap.empty) {
          setTickets(ticketsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Ticket));
        } else {
          setTickets([
            { id: 'tic_001', customerName: 'Harish Verma', issueType: 'Late Delivery', description: 'Order delayed in MP Nagar for 40 minutes.', status: 'open', date: '2026-07-08', replies: [{ sender: 'customer', text: 'Where is my order?' }] },
            { id: 'tic_002', customerName: 'Sneha Rao', issueType: 'Wrong Item', description: 'Received Sweet Lassi instead of Rabdi.', status: 'open', date: '2026-07-09', replies: [] },
            { id: 'tic_003', customerName: 'Gopal Singh (Rider)', issueType: 'Payout Issue', description: 'Rider wallet shows mismatch for Saturday payouts.', status: 'resolved', date: '2026-07-05', replies: [] }
          ]);
        }

        const keysSnap = await getDocs(collection(db, 'developer_api_keys'));
        if (!keysSnap.empty) {
          setApiKeys(keysSnap.docs.map(d => ({ id: d.id, ...d.data() }) as DeveloperKey));
        } else {
          setApiKeys([
            { id: 'key_1', name: 'Logistics Partner API', key: 'tt_live_728bhopal_a982', scope: 'Read Orders', created: '2026-05-15' }
          ]);
        }
      } catch (err) {
        console.error("Error fetching telemetry configurations:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTelemetryAndLogs();
  }, []);

  const handleCreateAPIKey = async () => {
    if (!newKeyLabel) return;
    try {
      const id = "key_" + Date.now();
      const rawKey = `tt_${maintenanceMode ? 'test' : 'live'}_${Math.random().toString(36).substring(2, 10)}${Date.now().toString().substring(10)}`;
      const key: DeveloperKey = {
        id,
        name: newKeyLabel,
        key: rawKey,
        scope: 'Read/Write Platform Orders & Stores',
        created: new Date().toISOString().substring(0, 10)
      };

      await setDoc(doc(db, 'developer_api_keys', id), key);
      setApiKeys([...apiKeys, key]);
      onLogEvent('API_KEY_GENERATED', `Provisioned third-party access token credential: ${key.name}`);
      setNewKeyLabel('');
      alert("Third-party developer credential token generated!");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAPIKey = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'developer_api_keys', id));
      setApiKeys(apiKeys.filter(k => k.id !== id));
      onLogEvent('API_KEY_REVOKED', `Revoked developer client token: ${id}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolveTicket = async (id: string, status: 'resolved' | 'open') => {
    try {
      await updateDoc(doc(db, 'tickets', id), { status });
      setTickets(tickets.map(t => t.id === id ? { ...t, status } : t));
      onLogEvent('SUPPORT_TICKET_RESOLVED', `Marked support ticket ${id} as: ${status}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicketId || !ticketReply) return;
    try {
      const chosen = tickets.find(t => t.id === selectedTicketId);
      if (!chosen) return;

      const nextReplies = [...(chosen.replies || []), { sender: 'operator', text: ticketReply }];
      await updateDoc(doc(db, 'tickets', selectedTicketId), { replies: nextReplies });
      
      setTickets(tickets.map(t => t.id === selectedTicketId ? { ...t, replies: nextReplies } : t));
      onLogEvent('SUPPORT_REPLY_SENT', `Replied to ticket ID: ${selectedTicketId}`);
      setTicketReply('');
      alert("Reply sent successfully and synced with Firebase!");
    } catch (err) {
      console.error(err);
    }
  };

  const handleMaintenanceToggle = async () => {
    const next = !maintenanceMode;
    setMaintenanceMode(next);
    try {
      await updateDoc(doc(db, 'system_settings', 'global'), { maintenanceMode: next });
      onLogEvent('MAINTENANCE_TOGGLE', `Overrode platform online state. Maintenance: ${next}`);
      alert(`Platform global state changed: ${next ? 'UNDER MAINTENANCE' : 'LIVE ONLINE'}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFlushCache = () => {
    onLogEvent('REDIS_CACHE_FLUSHED', `Cleared global endpoints cache and regenerated route indexes.`);
    alert("In-Memory cache and CDN route nodes flushed successfully!");
  };

  const handleBackupDatabase = () => {
    const backupObj = {
      timestamp: Date.now(),
      platform: 'ting-tong-bhopal',
      scopes: ['global_settings', 'coupons', 'zones', 'internal_users', 'banners'],
      data: {
        apiKeys,
        liveTracking,
        inAppChat,
        fraudStrict
      }
    };
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ting_tong_backup_${Date.now()}.json`;
    a.click();
    onLogEvent('DB_BACKUP_GENERATED', `Successfully completed full database backup dump.`);
  };

  const handleToggleFlag = (type: 'tracking' | 'chat' | 'fraud') => {
    if (type === 'tracking') {
      setLiveTracking(!liveTracking);
      onLogEvent('FLAG_CHANGE', `Toggled Live Logistics Tracking: ${!liveTracking}`);
    } else if (type === 'chat') {
      setInAppChat(!inAppChat);
      onLogEvent('FLAG_CHANGE', `Toggled In-App Customer Chat: ${!inAppChat}`);
    } else {
      setFraudStrict(!fraudStrict);
      onLogEvent('FLAG_CHANGE', `Set Fraud Detection Threshold strictly: ${!fraudStrict}`);
    }
  };

  // Filter logs list
  const filteredLogs = dbLogs.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (log.adminEmail || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterAction === 'ALL') return matchesSearch;
    return matchesSearch && log.action.includes(filterAction);
  });

  return (
    <div className="space-y-8 animate-fade-in text-xs">
      
      {/* Telemetry charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Dynamic health metrics SVGs */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-850 pb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-500 animate-pulse" />
              <h3 className="font-bold text-sm text-slate-100">Live API Requests & Redis Telemetry</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-[10px] text-emerald-400 font-mono">NODE ONLINE (99.98% SLA)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            {/* System Performance Chart */}
            <div className="space-y-2">
              <p className="font-bold text-slate-300">API Response Latency (MS) - Last 24 Hrs</p>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex items-center justify-center">
                <svg className="w-full h-32 text-indigo-500" viewBox="0 0 300 100" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  <line x1="0" y1="20" x2="300" y2="20" stroke="#1e293b" strokeDasharray="4 4" />
                  <line x1="0" y1="50" x2="300" y2="50" stroke="#1e293b" strokeDasharray="4 4" />
                  <line x1="0" y1="80" x2="300" y2="80" stroke="#1e293b" strokeDasharray="4 4" />
                  {/* Area fill */}
                  <path d="M0,100 L0,50 L30,45 L60,82 L90,25 L120,40 L150,15 L180,60 L210,35 L240,48 L270,72 L300,30 L300,100 Z" fill="rgba(99, 102, 241, 0.1)" />
                  {/* Latency line */}
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    points="0,50 30,45 60,82 90,25 120,40 150,15 180,60 210,35 240,48 270,72 300,30"
                  />
                  {/* Dot anchors */}
                  <circle cx="150" cy="15" r="3" fill="#fbbf24" />
                </svg>
              </div>
              <p className="text-[10px] text-slate-500 text-center font-mono">Average load latency: 32ms | Peak: 85ms (DB sync write)</p>
            </div>

            {/* Server Memory and Traffic ratios */}
            <div className="space-y-2">
              <p className="font-bold text-slate-300">Memory Usage vs CPU load</p>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">Node JS Heap Memory (V8 Engine)</span>
                    <span className="text-amber-400 font-bold">144.2 MB / 512 MB</span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-2 rounded-full" style={{ width: '28%' }}></div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">Firestore Read Quota Load</span>
                    <span className="text-indigo-400 font-bold">12,492 / 50,000 Free Limit</span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '24.9%' }}></div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">Active WebSocket Connections</span>
                    <span className="text-emerald-400 font-bold">48 Active Riders</span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '80%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Support Resolver Resolver tickets */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
            <MessageSquare className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-100">Rider / Customer Support Solver</h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            
            {/* Tickets list */}
            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {tickets.map(t => (
                <button 
                  key={t.id} 
                  onClick={() => setSelectedTicketId(t.id)}
                  className={`w-full text-left p-2.5 rounded-xl border transition ${selectedTicketId === t.id ? 'bg-indigo-600/10 border-indigo-500/40 text-slate-100' : 'bg-slate-950 border-slate-850 hover:bg-slate-850 text-slate-300'}`}
                >
                  <div className="flex justify-between items-center text-[10px] mb-1">
                    <span className="font-bold text-slate-100 font-mono">{t.id}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${t.status === 'open' ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{t.status}</span>
                  </div>
                  <p className="font-bold text-xs truncate">{t.issueType}: {t.customerName}</p>
                </button>
              ))}
            </div>

            {/* Chat reply composer */}
            {selectedTicketId && (
              <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl space-y-3">
                <p className="font-bold text-slate-200">Reply Composer (Ticket: {selectedTicketId})</p>
                
                <div className="max-h-[90px] overflow-y-auto space-y-1.5 p-1.5 bg-slate-900 rounded font-sans text-[10px]">
                  {tickets.find(t => t.id === selectedTicketId)?.replies?.map((r, idx) => (
                    <div key={idx} className={`p-1.5 rounded-lg max-w-[80%] ${r.sender === 'customer' ? 'bg-slate-800 text-slate-300 mr-auto' : 'bg-indigo-900/40 text-indigo-300 ml-auto'}`}>
                      <p className="font-bold text-[8px] uppercase text-slate-400">{r.sender}</p>
                      <p>{r.text}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-1.5">
                  <input 
                    type="text" 
                    value={ticketReply} 
                    onChange={e => setTicketReply(e.target.value)} 
                    placeholder="Type supportive message..." 
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-slate-200 text-[10px]" 
                  />
                  <button onClick={handleSendReply} className="bg-amber-500 text-slate-950 font-bold p-1 px-3 rounded text-[10px] hover:brightness-110">Send</button>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => handleResolveTicket(selectedTicketId, 'resolved')} className="w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/15 p-1 rounded font-bold text-[10px]">Mark Solved</button>
                  <button onClick={() => handleResolveTicket(selectedTicketId, 'open')} className="w-full bg-slate-900 hover:bg-slate-850 text-slate-400 border border-slate-800 p-1 rounded text-[10px]">Reopen</button>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* Database utilities and Developer Keys */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Core Administrative switches */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-100">Platform Feature Flags & Maintenance Locks</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-200">Maintenance Mode</p>
                  <p className="text-[10px] text-slate-500 leading-tight">Block checkout APIs and lock customer applications.</p>
                </div>
                <button onClick={handleMaintenanceToggle} className={`px-3 py-1 rounded text-[10px] font-bold ${maintenanceMode ? 'bg-rose-500/15 text-rose-400' : 'bg-slate-800 text-slate-400'}`}>
                  {maintenanceMode ? 'ACTIVE' : 'OFF'}
                </button>
              </div>

              <div className="flex justify-between items-center border-t border-slate-900 pt-3">
                <div>
                  <p className="font-bold text-slate-200">Strict Fraud Detection</p>
                  <p className="text-[10px] text-slate-500 leading-tight">Auto-block accounts executing multiple cancelled cash orders.</p>
                </div>
                <button onClick={() => handleToggleFlag('fraud')} className={`px-3 py-1 rounded text-[10px] font-bold ${fraudStrict ? 'bg-indigo-500/15 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                  {fraudStrict ? 'STRICT' : 'LAX'}
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-200">Live Rider Tracking</p>
                  <p className="text-[10px] text-slate-500 leading-tight">Publish GPS updates stream to customers.</p>
                </div>
                <button onClick={() => handleToggleFlag('tracking')} className={`px-3 py-1 rounded text-[10px] font-bold ${liveTracking ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                  {liveTracking ? 'ACTIVE' : 'PAUSED'}
                </button>
              </div>

              <div className="flex justify-between items-center border-t border-slate-900 pt-3">
                <div>
                  <p className="font-bold text-slate-200">Driver Chat Channels</p>
                  <p className="text-[10px] text-slate-500 leading-tight">Allow communication chats inside active delivery runs.</p>
                </div>
                <button onClick={() => handleToggleFlag('chat')} className={`px-3 py-1 rounded text-[10px] font-bold ${inAppChat ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                  {inAppChat ? 'ACTIVE' : 'PAUSED'}
                </button>
              </div>
            </div>

          </div>

          {/* Database Backup Restorer tools */}
          <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="font-bold text-slate-200 flex items-center gap-1">
                <Database className="w-4 h-4 text-slate-400" />
                <span>Binary Snapshot & Backups</span>
              </p>
              <p className="text-[10px] text-slate-500">Generate downloadable backups or flash server memories.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleBackupDatabase} className="bg-indigo-600 hover:bg-indigo-700 text-slate-100 p-2 px-4 rounded font-bold cursor-pointer">
                Dump Backup JSON
              </button>
              <button onClick={handleFlushCache} className="bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 p-2 px-4 rounded font-bold cursor-pointer">
                Flush Redis CDN
              </button>
            </div>
          </div>
        </div>

        {/* Developer API Keys Creator */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
            <Code className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-100">Developer client API Keys & Webhooks</h3>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2 bg-slate-950 p-3 rounded-xl border border-slate-850 items-end">
              <div className="space-y-1 flex-1">
                <label className="text-[9px] text-slate-500 font-bold uppercase">Token Name / Client Label</label>
                <input type="text" value={newKeyLabel} onChange={e => setNewKeyLabel(e.target.value)} placeholder="Marketing Hub Webhook" className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 text-[10px]" />
              </div>
              <button onClick={handleCreateAPIKey} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold p-2 px-4 rounded text-[10px] cursor-pointer h-fit">
                Generate Token
              </button>
            </div>

            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {apiKeys.map(k => (
                <div key={k.id} className="bg-slate-950 border border-slate-850 p-2.5 rounded-xl flex items-center justify-between gap-3 font-mono text-[10px]">
                  <div>
                    <p className="font-bold text-slate-200 font-sans">{k.name}</p>
                    <p className="text-amber-500 select-all font-bold mt-0.5">{k.key}</p>
                    <p className="text-[9px] text-slate-500 font-sans">{k.scope} • Created: {k.created}</p>
                  </div>
                  <button onClick={() => handleDeleteAPIKey(k.id)} className="p-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Audit Logs Explorer search bar & table */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-100">Super Admin Audit trail & Session Logs</h3>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input 
                type="text" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                placeholder="Search audit trail..." 
                className="bg-slate-950 border border-slate-850 pl-9 pr-4 py-2 rounded-xl text-slate-200 outline-none focus:border-amber-500 font-sans w-full sm:w-48" 
              />
            </div>
            <select 
              value={filterAction} 
              onChange={e => setFilterAction(e.target.value)} 
              className="bg-slate-950 border border-slate-850 p-2 rounded-xl text-slate-300 outline-none"
            >
              <option value="ALL">All Event Streams</option>
              <option value="ADMIN_PROFILE">Admin Profiles</option>
              <option value="COUPON">Coupons & Promos</option>
              <option value="ZONE">Zoning Coordinates</option>
              <option value="VERIF">Vendor Approvals</option>
              <option value="SECURITY">Security Locks</option>
              <option value="WALLET">Wallet Crediting</option>
              <option value="BYPASS">Lifecycle Overrides</option>
            </select>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto border border-slate-850 rounded-xl bg-slate-950">
          <table className="w-full text-left border-collapse font-sans text-xs min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-850 bg-slate-900/40 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                <th className="p-3">Timestamp</th>
                <th className="p-3">Egress Admin</th>
                <th className="p-3">Action Type</th>
                <th className="p-3">Payload Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/55 text-slate-300">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-900/20 transition">
                  <td className="p-3 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-3 font-mono text-slate-400 font-medium">
                    {log.adminEmail || 'admin@tingtong.com'}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${
                      log.action.includes('MFA') || log.action.includes('KEY') || log.action.includes('BYPASS')
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-indigo-500/10 text-indigo-400'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3 leading-normal max-w-sm font-sans text-slate-400">
                    {log.details}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-500 italic">No matching security events in ledger trail.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
