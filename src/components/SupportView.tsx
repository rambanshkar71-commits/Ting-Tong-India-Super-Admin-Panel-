import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { SupportTicket, Zone, Restaurant, Customer, Rider, CommunicationAlert, Announcement, Order } from '../types';
import { getActiveCity } from '../services/mapService';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}
import { 
  MessageSquare, 
  Send, 
  User, 
  Bike, 
  Store, 
  CheckCircle, 
  PhoneCall, 
  X,
  AlertCircle,
  Clock,
  LayoutDashboard,
  Megaphone,
  Bell,
  AlertTriangle,
  UserPlus
} from 'lucide-react';

import SupportDashboard from './support/SupportDashboard';
import LiveChatCenter from './support/LiveChatCenter';
import AlertCenter from './support/AlertCenter';
import AnnouncementCenter from './support/AnnouncementCenter';
import NotificationPanel from './support/NotificationPanel';
import QuickActionsPanel from './support/QuickActionsPanel';
import RefundDialog from './support/RefundDialog';

export default function SupportView() {
  // Navigation
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileIncidentTab, setMobileIncidentTab] = useState<'queue' | 'chat' | 'actions'>('queue');

  // Active Refund state
  const [activeRefundDetails, setActiveRefundDetails] = useState<{
    order: Order;
    conversationId: string;
    conversationType: 'chat' | 'ticket';
  } | null>(null);

  // Real-time Collections States
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [alerts, setAlerts] = useState<CommunicationAlert[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  // Tickets layout states
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketChatInput, setTicketChatInput] = useState('');
  const [ticketChatMessages, setTicketChatMessages] = useState<{ sender: 'admin' | 'user'; text: string; time: string }[]>([
    { sender: 'user', text: "Hello, my coupon wasn't applied on the subtotal. Please refund.", time: "10:30 AM" }
  ]);

  // 1. Snapshot listeners for ALL collections
  useEffect(() => {
    const unsubTickets = onSnapshot(collection(db, 'tickets'), (snap) => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SupportTicket));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tickets'));

    const unsubZones = onSnapshot(collection(db, 'zones'), (snap) => {
      setZones(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Zone));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'zones'));

    const unsubRestaurants = onSnapshot(collection(db, 'restaurants'), (snap) => {
      setRestaurants(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Restaurant));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'restaurants'));

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Customer));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'customers'));

    const unsubRiders = onSnapshot(collection(db, 'riders'), (snap) => {
      setRiders(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Rider));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'riders'));

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Order));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'orders'));

    const unsubAlerts = onSnapshot(collection(db, 'communication_alerts'), (snap) => {
      setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() }) as CommunicationAlert));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'communication_alerts'));

    const unsubAnnouncements = onSnapshot(collection(db, 'announcements'), (snap) => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Announcement));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'announcements'));

    return () => {
      unsubTickets();
      unsubZones();
      unsubRestaurants();
      unsubCustomers();
      unsubRiders();
      unsubOrders();
      unsubAlerts();
      unsubAnnouncements();
    };
  }, []);

  const handleResolveTicket = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'tickets', ticketId), { status: 'resolved' });
      setTickets(tickets.map(tk => tk.id === ticketId ? { ...tk, status: 'resolved' } : tk));
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: 'resolved' });
      }
    } catch (err) {
      console.error("Error resolving ticket: ", err);
    }
  };

  const handleSendTicketMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketChatInput.trim()) return;

    setTicketChatMessages([
      ...ticketChatMessages,
      { sender: 'admin', text: ticketChatInput, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);
    setTicketChatInput('');
  };

  const getActiveChatsCount = () => {
    // Read open chats count
    const active = alerts.filter(a => a.priority === 'critical').length;
    return active;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
        <p className="text-slate-400 text-xs font-mono">Synchronizing Enterprise Communication Grid...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in" id="support-operations-desk-container">
      
      {/* 1. Dashboard Sub Header */}
      <div className="border-b border-slate-850 pb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-100 uppercase">Enterprise Communication Center</h2>
          <p className="text-slate-400 text-xs font-mono">{getActiveCity().name} Hub central command: live chats, secure targeted alerts, policy bulletins, &amp; logs.</p>
        </div>

        {/* 2. Top Tabs Menu */}
        <div className="flex flex-wrap gap-1.5 bg-slate-900/80 p-1.5 border border-slate-850 rounded-2xl">
          
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition ${
              activeTab === 'dashboard' 
                ? 'bg-amber-500 text-slate-950 font-black shadow-md' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> Overview
          </button>

          <button
            onClick={() => setActiveTab('live_chat')}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition ${
              activeTab === 'live_chat' 
                ? 'bg-amber-500 text-slate-950 font-black shadow-md' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 animate-pulse" /> Live Chat
          </button>

          <button
            onClick={() => setActiveTab('alert_center')}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition ${
              activeTab === 'alert_center' 
                ? 'bg-amber-500 text-slate-950 font-black shadow-md' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Alerts Center
          </button>

          <button
            onClick={() => setActiveTab('announcements')}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition ${
              activeTab === 'announcements' 
                ? 'bg-amber-500 text-slate-950 font-black shadow-md' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" /> Announcements
          </button>

          <button
            onClick={() => setActiveTab('incidents')}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition ${
              activeTab === 'incidents' 
                ? 'bg-amber-500 text-slate-950 font-black shadow-md' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Incidents
          </button>

          <button
            onClick={() => setActiveTab('telemetry')}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition ${
              activeTab === 'telemetry' 
                ? 'bg-amber-500 text-slate-950 font-black shadow-md' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" /> Telemetry
          </button>

        </div>
      </div>

      {/* 3. Render Current Tab Container */}
      <div className="min-h-[50vh]">
        {activeTab === 'dashboard' && (
          <SupportDashboard 
            chatSessions={[]} // dynamic inside live chat loader
            tickets={tickets}
            alerts={alerts}
            announcements={announcements}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'live_chat' && (
          <LiveChatCenter 
            orders={orders}
            riders={riders}
            restaurants={restaurants}
            customers={customers}
            onInitiateRefund={(order, conversationId) => {
              setActiveRefundDetails({
                order,
                conversationId,
                conversationType: 'chat'
              });
            }}
          />
        )}

        {activeTab === 'alert_center' && (
          <AlertCenter 
            zones={zones}
            restaurants={restaurants}
            customers={customers}
            riders={riders}
          />
        )}

        {activeTab === 'announcements' && (
          <AnnouncementCenter />
        )}

        {activeTab === 'telemetry' && (
          <NotificationPanel />
        )}

        {activeTab === 'incidents' && (
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-6 items-start w-full">
            
            {/* Mobile Tab Selector inside Incidents */}
            <div className="w-full flex lg:hidden bg-slate-900 border-b border-slate-850 p-1.5 rounded-2xl mb-4 shrink-0 gap-1">
              <button
                onClick={() => setMobileIncidentTab('queue')}
                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition ${
                  mobileIncidentTab === 'queue' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Pipeline ({tickets.length})
              </button>
              <button
                onClick={() => setMobileIncidentTab('chat')}
                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition ${
                  mobileIncidentTab === 'chat' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Incident Terminal
              </button>
              <button
                onClick={() => setMobileIncidentTab('actions')}
                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition ${
                  mobileIncidentTab === 'actions' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Actions
              </button>
            </div>

            {/* Incident logs list */}
            <div className={`lg:col-span-3 bg-slate-900 border border-slate-850 p-4 rounded-3xl space-y-4 w-full h-[50vh] lg:h-auto ${mobileIncidentTab === 'queue' ? 'block' : 'hidden lg:block'}`}>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-200 text-xs uppercase">Incident Report Pipeline</h3>
                <p className="text-[10px] text-slate-500 font-mono">{getActiveCity().name} logistics issues reported via custom app clients.</p>
              </div>
              
              <div className="space-y-3 overflow-y-auto max-h-[40vh] lg:max-h-[55vh] pr-1">
                {tickets.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs font-mono">No active incident logs in pipeline.</div>
                ) : (
                  tickets.map(tk => (
                    <div 
                      key={tk.id}
                      onClick={() => {
                        setSelectedTicket(tk);
                        setMobileIncidentTab('chat');
                      }}
                      className={`border p-3.5 rounded-2xl cursor-pointer transition ${
                        selectedTicket?.id === tk.id 
                          ? 'bg-slate-950 border-amber-500/50 shadow-lg' 
                          : 'bg-slate-950/30 border-slate-850 hover:border-slate-800'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-900 text-slate-400">
                          {tk.userRole} Query
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          tk.status === 'open' ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-400'
                        }`}>
                          {tk.status}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-slate-200 truncate">{tk.subject}</h4>
                      <p className="text-slate-500 text-[10px] mt-1">Initiator: {tk.userName}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Selected Incident Work area */}
            <div className={`lg:col-span-6 bg-slate-900 border border-slate-850 rounded-3xl p-5 flex flex-col h-[65vh] shadow-xl w-full ${mobileIncidentTab === 'chat' ? 'flex' : 'hidden lg:flex'}`}>
              {selectedTicket ? (
                <div className="flex-1 flex flex-col h-full">
                  {/* Header */}
                  <div className="border-b border-slate-850 pb-4 mb-4 flex justify-between items-center shrink-0">
                    <div>
                      <h4 className="font-bold text-slate-200 text-xs">{selectedTicket.subject}</h4>
                      <p className="text-slate-400 text-xs mt-0.5">Contact: {selectedTicket.userName} ({selectedTicket.userRole})</p>
                    </div>
                    {selectedTicket.status === 'open' && (
                      <button 
                        onClick={() => handleResolveTicket(selectedTicket.id)}
                        className="bg-emerald-500 hover:brightness-110 text-slate-950 font-black text-[10px] uppercase px-3.5 py-2 rounded-xl flex items-center gap-1 cursor-pointer transition"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Resolve Ticket
                      </button>
                    )}
                  </div>

                  {/* Chat Thread */}
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1 p-3 bg-slate-950 border border-slate-850 rounded-2xl mb-4">
                    {/* Initial Query Description */}
                    <div className="bg-slate-900 border border-slate-850 p-3.5 rounded-xl max-w-md">
                      <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mb-1 font-mono uppercase">
                        <Clock className="w-3 h-3" /> Initial Incident Report:
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed">{selectedTicket.message}</p>
                    </div>

                    {ticketChatMessages.map((msg, idx) => (
                      <div key={idx} className={`flex flex-col ${msg.sender === 'admin' ? 'items-end' : 'items-start'}`}>
                        <div className={`p-3 rounded-2xl max-w-sm text-xs leading-relaxed ${
                          msg.sender === 'admin' ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-none shadow-md' : 'bg-slate-900 text-slate-200 border border-slate-850'
                        }`}>
                          {msg.text}
                        </div>
                        <span className="text-[8px] text-slate-500 mt-1 px-1">{msg.time}</span>
                      </div>
                    ))}
                  </div>

                  {/* Input Form */}
                  <form onSubmit={handleSendTicketMessage} className="flex gap-2 shrink-0">
                    <input 
                      type="text" 
                      value={ticketChatInput}
                      onChange={e => setTicketChatInput(e.target.value)}
                      placeholder="Type a resolution message to send..."
                      className="bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-slate-100 flex-1 outline-none focus:border-amber-500 transition"
                    />
                    <button type="submit" className="bg-amber-500 hover:brightness-110 text-slate-950 p-3 rounded-xl transition cursor-pointer">
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs py-20 text-center">
                  <AlertCircle className="w-10 h-10 text-slate-700 mb-2 animate-bounce" />
                  <p className="font-bold text-slate-400 mb-1">Incident Terminal</p>
                  <p className="max-w-xs leading-relaxed text-[11px]">Select a logistical support incident ticket from the queue to start a live-resolved session.</p>
                </div>
              )}
            </div>

            {/* Quick Actions Panel */}
            <div className={`lg:col-span-3 h-[65vh] overflow-y-auto w-full ${mobileIncidentTab === 'actions' ? 'block' : 'hidden lg:block'}`}>
              {selectedTicket ? (
                <QuickActionsPanel
                  userId={selectedTicket.userId}
                  userRole={selectedTicket.userRole}
                  conversationId={selectedTicket.id}
                  conversationType="ticket"
                  orders={orders}
                  riders={riders}
                  restaurants={restaurants}
                  customers={customers}
                  onAgentAssigned={(agentName) => {
                    setSelectedTicket(prev => prev ? { ...prev, userName: `Agent: ${agentName}` } : null);
                  }}
                  onInitiateRefund={(order) => {
                    setActiveRefundDetails({
                      order,
                      conversationId: selectedTicket.id,
                      conversationType: 'ticket'
                    });
                  }}
                />
              ) : (
                <div className="bg-slate-900 border border-slate-850 rounded-3xl p-5 text-center text-slate-500 text-xs py-12">
                  <UserPlus className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="font-bold text-slate-400">Quick Actions</p>
                  <p className="text-[10px] text-slate-500 mt-1">Select a conversation to view Quick Actions.</p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {activeRefundDetails && (
        <RefundDialog
          order={activeRefundDetails.order}
          conversationId={activeRefundDetails.conversationId}
          conversationType={activeRefundDetails.conversationType}
          onClose={() => setActiveRefundDetails(null)}
        />
      )}
    </div>
  );
}
