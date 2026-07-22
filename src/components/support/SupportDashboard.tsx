import React from 'react';
import { 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  Users, 
  Zap, 
  Smile, 
  ShieldAlert 
} from 'lucide-react';
import { ChatSession, SupportTicket, CommunicationAlert, Announcement } from '../../types';
import { getActiveCity } from '../../services/mapService';

interface SupportDashboardProps {
  chatSessions: ChatSession[];
  tickets: SupportTicket[];
  alerts: CommunicationAlert[];
  announcements: Announcement[];
  onNavigateTab: (tabId: string) => void;
}

export default function SupportDashboard({
  chatSessions,
  tickets,
  alerts,
  announcements,
  onNavigateTab
}: SupportDashboardProps) {

  // Computed stats
  const activeChats = chatSessions.filter(c => c.status === 'open').length;
  const waitingUsers = chatSessions.filter(c => c.status === 'waiting').length;
  const openTickets = tickets.filter(t => t.status === 'open').length;
  const resolvedTickets = tickets.filter(t => t.status === 'resolved').length;
  const emergencyAlerts = alerts.filter(a => a.priority === 'critical' || a.alertType === 'emergency').length;

  // Static/Calculated metrics
  const avgResponseTime = "1.8 Min";
  const supportPerformance = "98.4%";

  // Chat categories
  const customerChats = chatSessions.filter(c => c.userRole === 'customer' && c.status !== 'closed').length;
  const riderChats = chatSessions.filter(c => c.userRole === 'rider' && c.status !== 'closed').length;
  const vendorChats = chatSessions.filter(c => c.userRole === 'restaurant' && c.status !== 'closed').length;
  const staffChats = chatSessions.filter(c => c.userRole === 'staff' && c.status !== 'closed').length;

  return (
    <div className="space-y-6" id="support-dashboard-root">
      
      {/* 1. Statistics Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-lg hover:border-slate-700 transition duration-200">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Active Live Chats</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-100">{activeChats}</span>
              <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">LIVE</span>
            </div>
          </div>
          <div className="bg-amber-500/15 text-amber-500 p-3 rounded-xl">
            <MessageSquare className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-lg hover:border-slate-700 transition duration-200">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Waiting Users</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-amber-500">{waitingUsers}</span>
              {waitingUsers > 0 && (
                <span className="text-[9px] text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded animate-bounce">URGENT</span>
              )}
            </div>
          </div>
          <div className="bg-amber-500/15 text-amber-500 p-3 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-lg hover:border-slate-700 transition duration-200">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Open Tickets</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-100">{openTickets}</span>
              <span className="text-[9px] text-slate-400 font-bold">Total: {tickets.length}</span>
            </div>
          </div>
          <div className="bg-amber-500/15 text-amber-500 p-3 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-lg hover:border-slate-700 transition duration-200">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Emergency Dispatches</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-rose-500">{emergencyAlerts}</span>
              <span className="text-[9px] text-rose-500 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded">CRITICAL</span>
            </div>
          </div>
          <div className="bg-rose-500/15 text-rose-500 p-3 rounded-xl">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
          </div>
        </div>

      </div>

      {/* 2. Response Time & Satisfaction Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4">
          <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" /> Response Metric Node
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
              <span className="text-[10px] text-slate-500 font-bold block">Avg First Response Time</span>
              <span className="text-xl font-black text-amber-500 font-mono">{avgResponseTime}</span>
              <p className="text-[9px] text-slate-400 mt-1">Goal SLA threshold: &lt; 3.0 Min</p>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
              <span className="text-[10px] text-slate-500 font-bold block">Resolution SLA Compliance</span>
              <span className="text-xl font-black text-emerald-400 font-mono">99.1%</span>
              <p className="text-[9px] text-slate-400 mt-1">Resolved within 10 minutes</p>
            </div>
          </div>
          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Smile className="w-4 h-4 text-amber-500" />
              <span>Customer Satisfaction Score (CSAT)</span>
            </div>
            <span className="font-mono font-black text-slate-100 text-sm">{supportPerformance}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col justify-between">
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" /> Support Desk Performance
            </h4>
            
            <div className="space-y-2 text-xs text-slate-300">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span>Customer Support Load</span>
                  <span className="font-bold font-mono text-indigo-400">{customerChats} Active</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.min(100, (customerChats + 1) * 20)}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span>Rider Dispatch Support</span>
                  <span className="font-bold font-mono text-amber-500">{riderChats} Active</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, (riderChats + 1) * 20)}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span>Vendor Merchant Desk</span>
                  <span className="font-bold font-mono text-rose-400">{vendorChats} Active</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-rose-500 h-full rounded-full" style={{ width: `${Math.min(100, (vendorChats + 1) * 20)}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-850 flex justify-between items-center text-[10px] text-slate-500 font-mono">
            <span>SLA Nodes Online: 4</span>
            <span className="text-emerald-400 font-bold">ALL SERVICES OPERATIONAL</span>
          </div>
        </div>

      </div>

      {/* 3. Action Hub Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl hover:border-slate-700 transition cursor-pointer flex flex-col justify-between" onClick={() => onNavigateTab('live_chat')}>
          <div className="space-y-2">
            <div className="bg-indigo-500/10 text-indigo-400 p-2.5 rounded-xl w-fit">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-200 text-sm">Real-time Live Chat Node</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Connect directly with customers, riders, and restaurant vendors in {getActiveCity().name}. Handle typing statuses, attachments, and emoji responses.
            </p>
          </div>
          <span className="text-[10px] text-indigo-400 font-black tracking-wide uppercase mt-4 block">Launch Live Chat Console →</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl hover:border-slate-700 transition cursor-pointer flex flex-col justify-between" onClick={() => onNavigateTab('alert_center')}>
          <div className="space-y-2">
            <div className="bg-amber-500/10 text-amber-500 p-2.5 rounded-xl w-fit">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
            <h4 className="font-bold text-slate-200 text-sm">Enterprise Broadcast Desk</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Dispatch critical priority alerts regarding emergencies, traffic delays, weather, or system maintenance instantly.
            </p>
          </div>
          <span className="text-[10px] text-amber-500 font-black tracking-wide uppercase mt-4 block">Dispatch Broadcaster →</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl hover:border-slate-700 transition cursor-pointer flex flex-col justify-between" onClick={() => onNavigateTab('announcements')}>
          <div className="space-y-2">
            <div className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-xl w-fit">
              <CheckCircle className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-200 text-sm">General Announcement Board</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Publish news, festival guidelines, or payment updates for riders, restaurant partners, or clients with pin/scheduling options.
            </p>
          </div>
          <span className="text-[10px] text-emerald-400 font-black tracking-wide uppercase mt-4 block">Publish Announcement →</span>
        </div>

      </div>

    </div>
  );
}
