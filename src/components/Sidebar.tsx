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
  const menuSections = [
    {
      title: 'HOME',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        { id: 'live_tracking', label: 'Live Tracking', icon: MapPin, badge: 'Live' },
        { id: 'orders', label: 'Real-time Orders', icon: ShoppingBag, badge: 'Live' },
        { id: 'gig_management', label: 'Gig Management', icon: CalendarDays, badge: 'New' },
      ],
    },
    {
      title: 'BUSINESS',
      items: [
        { id: 'restaurants', label: 'Restaurant Vendors', icon: UtensilsCrossed },
        { id: 'riders', label: 'Rider Partners', icon: Bike },
        { id: 'customers', label: 'Customer Management', icon: Users },
      ],
    },
    {
      title: 'FINANCE',
      items: [
        { id: 'billing', label: 'Charges & Commissions', icon: Percent },
        { id: 'financials', label: 'Wallet Settlements', icon: Wallet },
        { id: 'payment_management', label: 'Employee & Payout Desk', icon: Wallet, badge: 'PRO' },
      ],
    },
    {
      title: 'PLATFORM',
      items: [
        { id: 'marketing', label: 'Area Management', icon: MapPin },
        { id: 'support', label: 'Support & Tickets', icon: MessageSquare },
        { id: 'settings', label: 'Settings & Security', icon: Settings },
      ],
    },
  ];

  return (
    <div className={`fixed inset-y-0 left-0 z-50 w-[280px] sm:w-80 max-w-[85vw] bg-slate-900 border-r border-slate-800 flex flex-col h-screen shrink-0 text-slate-300 transform transition-transform duration-300 lg:translate-x-0 lg:static ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      {/* Branding Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-amber-500 to-orange-600 p-2 rounded-xl text-slate-950 font-black tracking-widest text-lg shadow-lg">
            TT
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 tracking-tight font-sans">TING TONG</h1>
            <span className="text-xs text-amber-500 font-mono tracking-wider">MASTER ADMIN PANEL</span>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="lg:hidden text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Close Sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Admin Profile Segment */}
      {adminEmail && (
        <div className="px-5 py-3 border-b border-slate-800/60 bg-slate-950/20 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-100 uppercase shrink-0">
            {adminEmail.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider font-mono">Logged in as</p>
            <p className="text-xs font-semibold text-slate-200 truncate font-mono">{adminEmail}</p>
          </div>
        </div>
      )}

      {/* Menu Options Scroll Container */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {menuSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-3 text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest mb-1.5">
              {section.title}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition duration-150 cursor-pointer min-h-[42px] ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-400 border-l-4 border-amber-500 font-bold shadow-sm'
                      : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
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
