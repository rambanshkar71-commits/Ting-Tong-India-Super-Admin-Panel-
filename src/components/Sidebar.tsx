import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  UtensilsCrossed, 
  Bike, 
  Users, 
  Percent, 
  MapPin, 
  Wallet, 
  MessageSquare, 
  Settings, 
  Database,
  Power,
  ShieldCheck,
  X,
  CalendarDays
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  adminEmail: string | null;
  onLogout: () => void;
  onResetDb: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, adminEmail, onLogout, onResetDb, isOpen, onClose }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'live_tracking', label: '📍 Live Tracking', icon: MapPin, badge: 'Live' },
    { id: 'orders', label: 'Real-time Orders', icon: ShoppingBag, badge: 'Live' },
    { id: 'gig_management', label: 'Gig Management', icon: CalendarDays, badge: 'New' },
    { id: 'restaurants', label: 'Restaurant Vendors', icon: UtensilsCrossed },
    { id: 'riders', label: 'Rider Partners', icon: Bike },
    { id: 'customers', label: 'Customer Management', icon: Users },
    { id: 'billing', label: 'Charges & Commissions', icon: Percent },
    { id: 'marketing', label: 'Coupons & Zones', icon: MapPin },
    { id: 'financials', label: 'Wallet Settlements', icon: Wallet },
    { id: 'payment_management', label: 'Employee & Payout Desk', icon: Wallet, badge: 'PRO' },
    { id: 'support', label: 'Support & Tickets', icon: MessageSquare },
    { id: 'settings', label: 'Settings & Security', icon: Settings },
  ];

  return (
    <div className={`fixed inset-y-0 left-0 z-50 w-[280px] sm:w-80 max-w-[85vw] bg-slate-900 border-r border-slate-800 flex flex-col h-screen shrink-0 text-slate-300 transform transition-transform duration-300 lg:translate-x-0 lg:static ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      {/* Branding Header */}
      <div className="p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-amber-500 to-orange-600 p-2 rounded-xl text-slate-950 font-black tracking-widest text-lg shadow-lg">
            TT
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 tracking-tight font-sans">TING TONG</h1>
            <span className="text-xs text-amber-500 font-mono tracking-wider">BHOPAL ADMIN</span>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="lg:hidden text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          title="Close Sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Admin Profile Segment */}
      {adminEmail && (
        <div className="px-6 py-4 border-b border-slate-800/60 bg-slate-950/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-100 uppercase">
            {adminEmail.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400 font-medium">Logged in as</p>
            <p className="text-sm font-semibold text-slate-200 truncate font-mono">{adminEmail}</p>
          </div>
        </div>
      )}

      {/* Menu Options Scroll Container */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                onClose();
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition duration-150 cursor-pointer ${
                isActive
                  ? 'bg-amber-500/10 text-amber-500 border-l-4 border-amber-500'
                  : 'hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 border-l-4 border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${isActive ? 'text-amber-500' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full animate-pulse">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Actions and Status Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-2">
        <button
          onClick={onResetDb}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-medium text-slate-400 hover:text-amber-500 hover:bg-amber-500/5 border border-slate-800 hover:border-amber-500/10 transition cursor-pointer"
        >
          <Database className="w-4 h-4" />
          <span>Reset Platform Database</span>
        </button>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 border border-slate-800 hover:border-rose-500/10 transition cursor-pointer"
        >
          <Power className="w-4 h-4" />
          <span>Secure Admin Sign Out</span>
        </button>

        <div className="pt-2 flex items-center justify-center gap-2 text-[10px] text-slate-500 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Ting Tong SSL Protected</span>
        </div>
      </div>
    </div>
  );
}
