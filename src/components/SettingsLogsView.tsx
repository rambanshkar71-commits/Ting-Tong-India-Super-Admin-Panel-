import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { Restaurant, Rider, Customer, Order, AuditLog } from '../types';
import { 
  User, 
  Coins, 
  Truck, 
  Users, 
  Activity, 
  Settings,
  ShieldCheck,
  Map
} from 'lucide-react';

// Subcomponents
import AdminProfileTab from './AdminProfileTab';
import PlatformFinanceTab from './PlatformFinanceTab';
import LogisticsCatalogTab from './LogisticsCatalogTab';
import OperationsApprovalsTab from './OperationsApprovalsTab';
import HealthTelemetryTab from './HealthTelemetryTab';
import MapSettingsTab from './MapSettingsTab';

interface SettingsLogsViewProps {
  restaurants: Restaurant[];
  riders: Rider[];
  customers: Customer[];
  orders: Order[];
}

type TabID = 'profile' | 'finance' | 'logistics' | 'approvals' | 'diagnostics' | 'maps';

export default function SettingsLogsView({ restaurants, riders, customers, orders }: SettingsLogsViewProps) {
  const [activeTab, setActiveTab] = useState<TabID>('profile');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [adminEmail, setAdminEmail] = useState<string | null>('admin@tingtong.com');

  // Load audit logs stream from Firebase to pass into Telemetry Tab
  const fetchAuditLogs = async () => {
    try {
      const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(50));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as AuditLog);
      setAuditLogs(list);
    } catch (err) {
      console.error("Error loading audit logs: ", err);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  // Connected logger that child components invoke to log any action
  const handleLogEvent = async (action: string, details: string) => {
    try {
      const logEntry = {
        id: 'log_' + Date.now(),
        userId: 'admin_usr',
        email: adminEmail || 'admin@tingtong.com',
        adminEmail: adminEmail || 'admin@tingtong.com',
        action,
        details,
        timestamp: new Date().toISOString()
      };

      // Add to Firestore
      await addDoc(collection(db, 'audit_logs'), logEntry);
      
      // Update local state instantly so it loads in the trail list
      setAuditLogs(prev => [logEntry, ...prev]);
    } catch (err) {
      console.error("Error writing security audit log: ", err);
    }
  };

  const tabs: { id: TabID; label: string; icon: React.ComponentType<any>; color: string }[] = [
    { id: 'profile', label: 'Admin Profile', icon: User, color: 'text-amber-500' },
    { id: 'finance', label: 'Finance & Promos', icon: Coins, color: 'text-emerald-500' },
    { id: 'logistics', label: 'Logistics & Catalog', icon: Truck, color: 'text-indigo-500' },
    { id: 'maps', label: 'Map Settings', icon: Map, color: 'text-amber-400' },
    { id: 'approvals', label: 'Access & Approvals', icon: Users, color: 'text-sky-500' },
    { id: 'diagnostics', label: 'Health & Security', icon: Activity, color: 'text-rose-500' }
  ];

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      
      {/* View Header */}
      <div className="border-b border-slate-850 pb-5">
        <h2 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-amber-500" />
          Enterprise Super Admin Terminal
        </h2>
        <p className="text-slate-400 text-xs">
          Platform-wide credentials, financial pricing multipliers, active merchant audits, zoning controls, and automated logistics telemetry.
        </p>
      </div>

      {/* Tab Navigation Menu Bar */}
      <div className="flex overflow-x-auto gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-850 scrollbar-none">
        {tabs.map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer whitespace-nowrap shrink-0 ${
                isActive 
                  ? 'bg-slate-900 border border-slate-800 text-slate-100 shadow-lg shadow-black/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <Icon className={`w-4 h-4 ${t.color}`} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Tab Render Workspace */}
      <div className="pt-2">
        {activeTab === 'profile' && (
          <AdminProfileTab 
            adminEmail={adminEmail} 
            onLogEvent={handleLogEvent} 
          />
        )}

        {activeTab === 'finance' && (
          <PlatformFinanceTab 
            restaurants={restaurants} 
            riders={riders} 
            orders={orders} 
            onLogEvent={handleLogEvent} 
          />
        )}

        {activeTab === 'logistics' && (
          <LogisticsCatalogTab 
            restaurants={restaurants} 
            riders={riders} 
            orders={orders} 
            onLogEvent={handleLogEvent} 
          />
        )}

        {activeTab === 'approvals' && (
          <OperationsApprovalsTab 
            restaurants={restaurants} 
            riders={riders} 
            customers={customers} 
            onLogEvent={handleLogEvent} 
          />
        )}

        {activeTab === 'maps' && (
          <MapSettingsTab 
            onLogEvent={handleLogEvent} 
          />
        )}

        {activeTab === 'diagnostics' && (
          <HealthTelemetryTab 
            auditLogs={auditLogs} 
            onLogEvent={handleLogEvent} 
          />
        )}
      </div>

    </div>
  );
}
