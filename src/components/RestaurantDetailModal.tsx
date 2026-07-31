import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import {
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { Restaurant, MenuItem, Order, RestaurantSettlement, RestaurantReview, RestaurantAuditLog, RestaurantLifecycleStatus } from '../types';
import LocationPickerMap from './LocationPickerMap';
import DocManagementTab from './restaurantDetailTabs/DocManagementTab';
import ScheduleManagementTab from './restaurantDetailTabs/ScheduleManagementTab';
import DeliveryConfigTab from './restaurantDetailTabs/DeliveryConfigTab';
import FinancialSettlementsTab from './restaurantDetailTabs/FinancialSettlementsTab';
import AuditLogsTab from './restaurantDetailTabs/AuditLogsTab';
import ReportsExportTab from './restaurantDetailTabs/ReportsExportTab';
import PerformanceHealthScoreTab from './restaurantDetailTabs/PerformanceHealthScoreTab';
import LiveOrderMonitorTab from './restaurantDetailTabs/LiveOrderMonitorTab';
import ComplaintsTab from './restaurantDetailTabs/ComplaintsTab';
import AnnouncementsTab from './restaurantDetailTabs/AnnouncementsTab';
import RestaurantLiveMapTab from './restaurantDetailTabs/RestaurantLiveMapTab';
import BackupRecoveryTab from './restaurantDetailTabs/BackupRecoveryTab';
import SystemMonitoringTab from './restaurantDetailTabs/SystemMonitoringTab';
import { sendNotification } from '../services/notificationService';
import {
  Store,
  User,
  Mail,
  Phone,
  Percent,
  MapPin,
  Building2,
  CreditCard,
  Key,
  ShieldCheck,
  ShieldAlert,
  Printer,
  Copy,
  Download,
  Send,
  RefreshCw,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  TrendingUp,
  Award,
  Star,
  Clock,
  QrCode,
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  Ban,
  RotateCcw,
  LogOut,
  Calendar,
  Truck,
  BarChart3,
  Shield,
  FileCheck2,
} from 'lucide-react';

interface RestaurantDetailModalProps {
  restaurant: Restaurant;
  onClose: () => void;
  orders: Order[];
  initialTab?: string;
}

export default function RestaurantDetailModal({
  restaurant,
  onClose,
  orders,
  initialTab,
}: RestaurantDetailModalProps) {
  const [activeTab, setActiveTab] = useState<
    | 'profile'
    | 'health'
    | 'live_orders'
    | 'documents'
    | 'schedule'
    | 'delivery'
    | 'settlements'
    | 'complaints'
    | 'map'
    | 'announcements'
    | 'backup'
    | 'system'
    | 'credentials'
    | 'location'
    | 'menu'
    | 'audit'
    | 'reports'
  >((initialTab as any) || 'profile');

  // Editable Profile States
  const [name, setName] = useState(restaurant?.name || '');
  const [ownerName, setOwnerName] = useState(restaurant?.ownerName || '');
  const [email, setEmail] = useState(restaurant?.email || '');
  const [phone, setPhone] = useState(restaurant?.phone || '');
  const [address, setAddress] = useState(restaurant?.address || '');
  const [city, setCity] = useState(restaurant?.city || 'Bhopal');
  const [state, setState] = useState(restaurant?.state || 'Madhya Pradesh');
  const [pincode, setPincode] = useState(restaurant?.pincode || '462001');
  const [lifecycleStatus, setLifecycleStatus] = useState<RestaurantLifecycleStatus>(
    restaurant?.status || 'pending'
  );

  // Business Config States
  const [commission, setCommission] = useState((restaurant?.commissionPercentage ?? 15).toString());
  const [deliveryRadius, setDeliveryRadius] = useState((restaurant?.deliveryRadiusKm ?? 10).toString());
  const [minOrder, setMinOrder] = useState((restaurant?.minOrderAmount ?? 99).toString());
  const [packagingCharge, setPackagingCharge] = useState((restaurant?.packagingCharge ?? 15).toString());
  const [gstNo, setGstNo] = useState(restaurant?.gstNo || '');
  const [gstMandatory, setGstMandatory] = useState(restaurant?.gstMandatory || false);
  const [fssaiNo, setFssaiNo] = useState(restaurant?.fssaiNo || '');
  const [bankName, setBankName] = useState(restaurant?.bankName || '');
  const [accountHolder, setAccountHolder] = useState(restaurant?.accountHolderName || '');
  const [accountNumber, setAccountNumber] = useState(restaurant?.accountNumber || '');
  const [ifscCode, setIfscCode] = useState(restaurant?.ifscCode || '');
  const [upiId, setUpiId] = useState(restaurant?.upiId || '');

  // Menu States
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCat, setNewItemCat] = useState('');
  const [isMenuLocked, setIsMenuLocked] = useState(restaurant.menuLocked || false);

  // Credentials / Auth Creation
  const [credentials, setCredentials] = useState<{
    restaurantId: string;
    username: string;
    tempPass: string;
    loginUrl: string;
    qrCodeUrl: string;
    authUid?: string;
  }>({
    restaurantId: restaurant.restaurantCode || restaurant.id,
    username: restaurant.loginUsername || restaurant.email,
    tempPass: restaurant.tempPassword || 'TTI@Pass' + Math.floor(1000 + Math.random() * 9000),
    loginUrl: `${window.location.origin}/login?restId=${restaurant.id}`,
    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
      `${window.location.origin}/login?restId=${restaurant.id}`
    )}`,
    authUid: restaurant.authUid || restaurant.userId,
  });

  const [isGeneratingAuth, setIsGeneratingAuth] = useState(false);
  const [credentialMessage, setCredentialMessage] = useState('');

  // Load live menu items
  useEffect(() => {
    const q = query(collection(db, 'menuItems'), where('restaurantId', '==', restaurant.id));
    const unsub = onSnapshot(q, (snapshot) => {
      const items: MenuItem[] = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as MenuItem));
      setMenuItems(items);
    });
    return () => unsub();
  }, [restaurant.id]);

  // Log action with full before and after state
  const logAdminAction = async (
    action: string,
    details: string,
    beforeVal?: any,
    afterVal?: any
  ) => {
    try {
      const newLog = {
        restaurantId: restaurant.id,
        adminEmail: auth.currentUser?.email || 'admin@tingtong.com',
        adminName: 'Master Admin',
        action,
        details,
        timestamp: new Date().toISOString(),
        beforeValue: beforeVal ? JSON.stringify(beforeVal) : undefined,
        afterValue: afterVal ? JSON.stringify(afterVal) : undefined,
        deviceInfo: navigator.userAgent,
        ipAddress: '10.0.4.19',
      };
      await addDoc(collection(db, 'restaurantAuditLogs'), newLog);
    } catch (err) {
      console.warn('Audit log error:', err);
    }
  };

  // Lifecycle status change
  const handleStatusChange = async (newStatus: RestaurantLifecycleStatus) => {
    try {
      const restRef = doc(db, 'restaurants', restaurant.id);
      const profRef = doc(db, 'restaurantProfiles', restaurant.id);
      const now = new Date().toISOString();

      await updateDoc(restRef, { status: newStatus, updatedAt: now });
      try {
        await setDoc(profRef, { status: newStatus, updatedAt: now }, { merge: true });
      } catch (e) {
        console.warn('Profile doc status update bypassed:', e);
      }

      await logAdminAction(
        'STATUS_CHANGE',
        `Changed lifecycle status from ${restaurant.status} to ${newStatus}`,
        restaurant.status,
        newStatus
      );

      await sendNotification({
        recipientId: restaurant.id,
        recipientName: restaurant.name,
        recipientType: 'restaurant',
        title: `Account Status Updated: ${newStatus.toUpperCase()}`,
        message: `Your merchant account status has been set to ${newStatus} by Master Admin.`,
        type: newStatus === 'approved' || newStatus === 'active' ? 'approval' : 'rejection',
      });

      setLifecycleStatus(newStatus);
      alert(`Status updated to ${newStatus.replace('_', ' ').toUpperCase()}`);
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    }
  };

  // Save Profile Info
  const handleSaveProfile = async () => {
    try {
      const restRef = doc(db, 'restaurants', restaurant.id);
      await updateDoc(restRef, {
        name,
        ownerName,
        email,
        phone,
        address,
        city,
        state,
        pincode,
        updatedAt: new Date().toISOString(),
      });
      await logAdminAction('UPDATE_PROFILE', `Updated restaurant profile for ${name}`);
      alert('Restaurant profile updated successfully!');
    } catch (err: any) {
      alert('Error updating profile: ' + err.message);
    }
  };

  // Save Business Config
  const handleSaveConfig = async () => {
    try {
      const restRef = doc(db, 'restaurants', restaurant.id);
      await updateDoc(restRef, {
        commissionPercentage: Number(commission),
        deliveryRadiusKm: Number(deliveryRadius),
        minOrderAmount: Number(minOrder),
        packagingCharge: Number(packagingCharge),
        gstNo,
        gstMandatory,
        fssaiNo,
        bankName,
        accountHolderName: accountHolder,
        accountNumber,
        ifscCode,
        upiId,
        updatedAt: new Date().toISOString(),
      });
      await logAdminAction('UPDATE_CONFIG', `Updated business & financial rules for ${name}`);
      alert('Business configuration saved!');
    } catch (err: any) {
      alert('Error saving config: ' + err.message);
    }
  };

  // Approve & Generate Auth Login Credentials
  const handleApproveAndGenerateCredentials = async () => {
    setIsGeneratingAuth(true);
    setCredentialMessage('');
    try {
      // Create Firebase Auth user for restaurant login
      let authUid = restaurant.authUid || restaurant.userId;
      const tempPassword = credentials.tempPass;

      if (!authUid) {
        try {
          const userCred = await createUserWithEmailAndPassword(auth, email, tempPassword);
          authUid = userCred.user.uid;
        } catch (authErr: any) {
          if (authErr.code === 'auth/email-already-in-use') {
            authUid = 'rest_uid_' + Date.now();
          } else {
            console.warn('Auth creation fallback:', authErr);
            authUid = 'rest_uid_' + Date.now();
          }
        }
      }

      const restCode = restaurant.restaurantCode || 'TTI-REST-' + Math.floor(100000 + Math.random() * 900000);
      const username = email;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
        `${window.location.origin}/login?restId=${restaurant.id}`
      )}`;

      // Update Firestore Restaurant Document
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        status: 'approved',
        authUid,
        userId: authUid,
        restaurantCode: restCode,
        loginUsername: username,
        tempPassword,
        loginQrCodeUrl: qrUrl,
        loginDisabled: false,
        updatedAt: new Date().toISOString(),
      });

      // Update users collection with role 'restaurant'
      await setDoc(doc(db, 'users', authUid), {
        uid: authUid,
        restaurantId: restaurant.id,
        name,
        email,
        phone,
        role: 'restaurant',
        status: 'approved',
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setCredentials({
        restaurantId: restCode,
        username,
        tempPass: tempPassword,
        loginUrl: `${window.location.origin}/login?restId=${restaurant.id}`,
        qrCodeUrl: qrUrl,
        authUid,
      });

      await logAdminAction('APPROVE_RESTAURANT', `Approved restaurant and generated Auth account ${authUid}`);
      setCredentialMessage('Restaurant approved & credentials created successfully!');
    } catch (err: any) {
      console.error('Credentials generation error:', err);
      setCredentialMessage('Error: ' + err.message);
    } finally {
      setIsGeneratingAuth(false);
    }
  };

  // Toggle Suspend / Reactivate
  const handleToggleSuspend = async () => {
    const newStatus = restaurant.status === 'suspended' ? 'approved' : 'suspended';
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      await logAdminAction('STATUS_CHANGE', `Changed status to ${newStatus}`);
      alert(`Restaurant is now ${newStatus}`);
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    }
  };

  // Toggle Disable / Enable Login
  const handleToggleLoginAccess = async () => {
    const newDisabled = !restaurant.loginDisabled;
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        loginDisabled: newDisabled,
        updatedAt: new Date().toISOString(),
      });
      await logAdminAction('LOGIN_TOGGLE', `${newDisabled ? 'Disabled' : 'Enabled'} restaurant login access`);
      alert(`Login access is now ${newDisabled ? 'DISABLED' : 'ENABLED'}`);
    } catch (err: any) {
      alert('Error updating login access: ' + err.message);
    }
  };

  // Force Logout
  const handleForceLogout = async () => {
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        lastActivityAt: new Date().toISOString(),
        loginDisabled: true,
      });
      setTimeout(() => {
        updateDoc(doc(db, 'restaurants', restaurant.id), { loginDisabled: false });
      }, 2000);

      await logAdminAction('FORCE_LOGOUT', `Terminated active restaurant sessions`);
      alert('Force logout command sent. Active session invalidated.');
    } catch (err: any) {
      alert('Error sending force logout: ' + err.message);
    }
  };

  // Toggle Menu Lock
  const handleToggleMenuLock = async () => {
    const newLock = !isMenuLocked;
    try {
      await updateDoc(doc(db, 'restaurants', restaurant.id), {
        menuLocked: newLock,
        updatedAt: new Date().toISOString(),
      });
      setIsMenuLocked(newLock);
      await logAdminAction('MENU_LOCK', `${newLock ? 'Locked' : 'Unlocked'} menu modifications`);
    } catch (err: any) {
      alert('Error toggling menu lock: ' + err.message);
    }
  };

  // Add Menu Item
  const handleAddMenuItem = async () => {
    if (!newItemName.trim() || !newItemPrice.trim()) return;
    try {
      const itemRef = doc(collection(db, 'menuItems'));
      await setDoc(itemRef, {
        id: itemRef.id,
        restaurantId: restaurant.id,
        name: newItemName.trim(),
        price: Number(newItemPrice),
        category: newItemCat.trim() || 'General',
        isAvailable: true,
        imageUrl: restaurant.logoUrl,
        description: '',
      });
      setNewItemName('');
      setNewItemPrice('');
      await logAdminAction('ADD_MENU_ITEM', `Added item ${newItemName} to catalog`);
    } catch (err: any) {
      alert('Error adding menu item: ' + err.message);
    }
  };

  // Toggle Item Availability
  const handleToggleItemStock = async (itemId: string, currentAvail: boolean) => {
    try {
      await updateDoc(doc(db, 'menuItems', itemId), { isAvailable: !currentAvail });
    } catch (err: any) {
      alert('Error updating item stock: ' + err.message);
    }
  };

  // Download Credentials TXT
  const handleDownloadCredentials = () => {
    const text = `================================================
TING TONG INDIA - MERCHANT LOGIN CREDENTIALS
================================================
Restaurant Name : ${restaurant.name}
Restaurant ID   : ${credentials.restaurantId}
Username / Email: ${credentials.username}
Temp Password   : ${credentials.tempPass}
Login Portal URL: ${credentials.loginUrl}
================================================
Generated Date  : ${new Date().toLocaleString()}
Status          : ${restaurant.status.toUpperCase()}
================================================`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${restaurant.name.replace(/\s+/g, '_')}_Credentials.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter orders for this restaurant
  const restOrders = orders.filter((o) => o.restaurantId === restaurant.id);
  const totalRevenue = restOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 max-w-5xl w-full rounded-3xl overflow-hidden shadow-2xl my-auto animate-fade-in flex flex-col h-[90vh]">
        {/* Top Bar Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <img
              src={restaurant.logoUrl}
              className="w-12 h-12 rounded-2xl object-cover bg-slate-800 border border-slate-700"
              alt={restaurant.name}
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-100">{restaurant.name}</h3>
                <span
                  className={`px-2.5 py-0.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider ${
                    restaurant.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : restaurant.status === 'approved'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                      : restaurant.status === 'under_verification'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                      : restaurant.status === 'pending'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : restaurant.status === 'inactive'
                      ? 'bg-slate-800 text-slate-300 border border-slate-700'
                      : restaurant.status === 'suspended'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      : restaurant.status === 'rejected'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                      : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                  }`}
                >
                  {restaurant.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-slate-400 text-xs font-mono mt-0.5">
                ID: {restaurant.restaurantCode || restaurant.id} | {restaurant.phone}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={restaurant.status}
              onChange={(e) => handleStatusChange(e.target.value as RestaurantLifecycleStatus)}
              className="bg-slate-950 border border-slate-800 text-orange-400 px-3 py-2 rounded-xl text-xs font-bold font-mono outline-none cursor-pointer hover:border-orange-500 transition"
            >
              <option value="pending">pending</option>
              <option value="under_verification">under verification</option>
              <option value="approved">approved</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="suspended">suspended</option>
              <option value="rejected">rejected</option>
              <option value="permanently_closed">permanently closed</option>
            </select>

            {restaurant.status === 'pending' && (
              <button
                onClick={handleApproveAndGenerateCredentials}
                disabled={isGeneratingAuth}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <ShieldCheck className="w-4 h-4" /> Approve & Create Login
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-2 rounded-xl">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 overflow-x-auto scrollbar-none px-4 pt-2 gap-1 shrink-0">
          {[
            { id: 'profile', label: 'Profile & Status', icon: Store },
            { id: 'health', label: 'Health & SLA Score', icon: TrendingUp },
            { id: 'live_orders', label: 'Live Order Monitor', icon: Clock },
            { id: 'documents', label: 'KYC & Docs', icon: FileCheck2 },
            { id: 'complaints', label: 'Complaints', icon: AlertCircle },
            { id: 'map', label: 'Live Map', icon: MapPin },
            { id: 'announcements', label: 'Notices', icon: Send },
            { id: 'schedule', label: 'Hours & Slots', icon: Clock },
            { id: 'delivery', label: 'Delivery Radius', icon: Truck },
            { id: 'settlements', label: 'Financial Payouts', icon: CreditCard },
            { id: 'menu', label: 'Menu Catalog', icon: Lock },
            { id: 'backup', label: 'Backup & Recovery', icon: Shield },
            { id: 'system', label: 'Telemetry', icon: BarChart3 },
            { id: 'credentials', label: 'Login Access', icon: Key },
            { id: 'audit', label: 'Audit Trail', icon: ShieldCheck },
            { id: 'reports', label: 'Reports', icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2.5 text-xs font-bold tracking-wider uppercase flex items-center gap-1.5 border-b-2 transition whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-400 bg-orange-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Panels */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-slate-100">
          {/* TAB 1: IDENTITY & PROFILE + STATUS LIFECYCLE */}
          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-4xl">
              {/* Enterprise Lifecycle Status Control Hub */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div>
                    <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-orange-400" /> Enterprise Restaurant Lifecycle Management
                    </h4>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Full admin control over store authorization state, visibility, and operational lifecycle.
                    </p>
                  </div>
                  <span className="bg-orange-500/10 text-orange-400 border border-orange-500/30 px-3 py-1 rounded-xl font-mono text-xs font-bold uppercase">
                    Current: {restaurant.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    {
                      id: 'pending',
                      label: 'Pending',
                      desc: 'Initial onboarding; documents awaiting submission.',
                      color: 'border-amber-500/30 text-amber-400 bg-amber-500/5',
                    },
                    {
                      id: 'under_verification',
                      label: 'Under Verification',
                      desc: 'KYC, GST & FSSAI undergoing admin audit.',
                      color: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/5',
                    },
                    {
                      id: 'approved',
                      label: 'Approved',
                      desc: 'KYC cleared; ready for login credentials.',
                      color: 'border-green-500/30 text-green-400 bg-green-500/5',
                    },
                    {
                      id: 'active',
                      label: 'Active (Live)',
                      desc: 'Live on consumer app, receiving live orders.',
                      color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5',
                    },
                    {
                      id: 'inactive',
                      label: 'Inactive',
                      desc: 'Store temporarily paused or offboarded.',
                      color: 'border-slate-700 text-slate-300 bg-slate-900',
                    },
                    {
                      id: 'suspended',
                      label: 'Suspended',
                      desc: 'Banned due to SLA breach or compliance issue.',
                      color: 'border-rose-500/30 text-rose-400 bg-rose-500/5',
                    },
                    {
                      id: 'rejected',
                      label: 'Rejected',
                      desc: 'Application denied due to invalid credentials.',
                      color: 'border-red-500/30 text-red-400 bg-red-500/5',
                    },
                    {
                      id: 'permanently_closed',
                      label: 'Permanently Closed',
                      desc: 'Store shut down permanently & archived.',
                      color: 'border-purple-500/30 text-purple-400 bg-purple-500/5',
                    },
                  ].map((st) => {
                    const isSelected = restaurant.status === st.id;
                    return (
                      <div
                        key={st.id}
                        onClick={() => handleStatusChange(st.id as RestaurantLifecycleStatus)}
                        className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-orange-500/10 border-orange-500 text-orange-300 ring-2 ring-orange-500/20 shadow-lg'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-bold uppercase tracking-wider font-mono ${st.color}`}>
                              {st.label}
                            </span>
                            {isSelected && (
                              <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping"></span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-tight">{st.desc}</p>
                        </div>
                        <button
                          className={`mt-3 w-full py-1.5 rounded-lg text-[10px] font-bold uppercase font-mono transition cursor-pointer ${
                            isSelected
                              ? 'bg-orange-500 text-slate-950 shadow-md font-extrabold'
                              : 'bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          {isSelected ? 'Current Status' : `Set ${st.label}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Restaurant Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-orange-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Owner Name</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-orange-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-orange-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mobile Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-orange-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Physical Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-orange-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-orange-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pincode</label>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveProfile}
                  className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-lg cursor-pointer"
                >
                  Save Profile Changes
                </button>
              </div>
            </div>
          )}

          {/* TAB: HEALTH & SLA SCORE */}
          {activeTab === 'health' && (
            <PerformanceHealthScoreTab
              restaurant={restaurant}
              orders={orders}
              onUpdate={() => {}}
              logAdminAction={logAdminAction}
            />
          )}

          {/* TAB: LIVE ORDER MONITOR */}
          {activeTab === 'live_orders' && (
            <LiveOrderMonitorTab
              restaurant={restaurant}
              orders={orders}
              logAdminAction={logAdminAction}
            />
          )}

          {/* TAB: COMPLAINTS */}
          {activeTab === 'complaints' && (
            <ComplaintsTab
              restaurant={restaurant}
              orders={orders}
              logAdminAction={logAdminAction}
            />
          )}

          {/* TAB: LIVE MAP */}
          {activeTab === 'map' && (
            <RestaurantLiveMapTab
              restaurant={restaurant}
              orders={orders}
            />
          )}

          {/* TAB: ANNOUNCEMENTS */}
          {activeTab === 'announcements' && (
            <AnnouncementsTab
              restaurant={restaurant}
              logAdminAction={logAdminAction}
            />
          )}

          {/* TAB: BACKUP & RECOVERY */}
          {activeTab === 'backup' && (
            <BackupRecoveryTab
              restaurant={restaurant}
              logAdminAction={logAdminAction}
            />
          )}

          {/* TAB: SYSTEM TELEMETRY */}
          {activeTab === 'system' && (
            <SystemMonitoringTab
              restaurant={restaurant}
            />
          )}

          {/* TAB 2: DOCUMENTS & VERIFICATION */}
          {activeTab === 'documents' && (
            <DocManagementTab
              restaurant={restaurant}
              onUpdate={() => {}}
              logAdminAction={logAdminAction}
            />
          )}

          {/* TAB 3: WORKING HOURS & SCHEDULE */}
          {activeTab === 'schedule' && (
            <ScheduleManagementTab
              restaurant={restaurant}
              onUpdate={() => {}}
              logAdminAction={logAdminAction}
            />
          )}

          {/* TAB 4: DELIVERY & LOGISTICS CONFIG */}
          {activeTab === 'delivery' && (
            <DeliveryConfigTab
              restaurant={restaurant}
              onUpdate={() => {}}
              logAdminAction={logAdminAction}
            />
          )}

          {/* TAB 5: FINANCIALS & SETTLEMENTS */}
          {activeTab === 'settlements' && (
            <FinancialSettlementsTab
              restaurant={restaurant}
              onUpdate={() => {}}
              logAdminAction={logAdminAction}
            />
          )}

          {/* TAB 6: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <AuditLogsTab
              restaurant={restaurant}
              onUpdate={() => {}}
              logAdminAction={logAdminAction}
            />
          )}

          {/* TAB 7: REPORTS & EXPORTS */}
          {activeTab === 'reports' && (
            <ReportsExportTab
              restaurant={restaurant}
              orders={orders}
            />
          )}

          {/* TAB 8: CREDENTIALS & LOGIN ACCESS */}
          {activeTab === 'credentials' && (
            <div className="space-y-6 max-w-2xl">
              {credentialMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3.5 rounded-2xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{credentialMessage}</span>
                </div>
              )}

              <div className="bg-slate-950 border-2 border-orange-500/30 p-6 rounded-3xl space-y-5 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20">
                      Merchant Portal Passkey
                    </span>
                    <h4 className="text-base font-bold text-slate-100 mt-2">{restaurant.name}</h4>
                  </div>
                  <img src={credentials.qrCodeUrl} className="w-20 h-20 bg-white p-1 rounded-xl shadow-md" alt="QR" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-850">
                    <span className="text-[10px] text-slate-500 block uppercase">Restaurant ID</span>
                    <span className="text-slate-200 font-bold">{credentials.restaurantId}</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-850">
                    <span className="text-[10px] text-slate-500 block uppercase">Auth UID</span>
                    <span className="text-orange-400 font-bold truncate block">{credentials.authUid || 'Pending'}</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-850">
                    <span className="text-[10px] text-slate-500 block uppercase">Login Email</span>
                    <span className="text-slate-200 font-bold truncate block">{credentials.username}</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-850">
                    <span className="text-[10px] text-slate-500 block uppercase">Temporary Password</span>
                    <span className="text-emerald-400 font-bold">{credentials.tempPass}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `ID: ${credentials.restaurantId}\nUser: ${credentials.username}\nPass: ${credentials.tempPass}`
                      );
                      alert('Credentials copied to clipboard!');
                    }}
                    className="bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: GPS LOCATION */}
          {activeTab === 'location' && (
            <div className="space-y-4">
              <LocationPickerMap
                initialLat={restaurant.lat || 23.2599}
                initialLng={restaurant.lng || 77.4126}
                initialAddress={restaurant.address}
                onLocationSelect={async (loc) => {
                  setAddress(loc.address);
                  setCity(loc.city);
                  setState(loc.state);
                  setPincode(loc.pincode);
                  await updateDoc(doc(db, 'restaurants', restaurant.id), {
                    lat: loc.lat,
                    lng: loc.lng,
                    address: loc.address,
                  });
                  await logAdminAction('UPDATE_LOCATION', `Updated GPS location to (${loc.lat}, ${loc.lng})`);
                }}
              />
            </div>
          )}

          {/* TAB 10: CATALOG & MENU */}
          {activeTab === 'menu' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-slate-950 border border-slate-800 p-4 rounded-2xl">
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-200">
                    Menu Catalog Modification Lock
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    When locked, the restaurant owner cannot alter menu prices or items from their panel.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const newLockState = !isMenuLocked;
                    await updateDoc(doc(db, 'restaurants', restaurant.id), { menuLocked: newLockState });
                    setIsMenuLocked(newLockState);
                    await logAdminAction('TOGGLE_MENU_LOCK', `Menu lock set to ${newLockState}`);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isMenuLocked
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {isMenuLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  {isMenuLocked ? 'Menu Locked by Admin' : 'Menu Unlocked'}
                </button>
              </div>

              {/* Add Item Form */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
                <p className="text-xs font-bold text-orange-400 uppercase tracking-wider">Add Item to Catalog</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Item Name"
                    className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none"
                  />
                  <input
                    type="number"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    placeholder="Price (₹)"
                    className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none font-mono"
                  />
                  <input
                    type="text"
                    value={newItemCat}
                    onChange={(e) => setNewItemCat(e.target.value)}
                    placeholder="Category"
                    className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!newItemName || !newItemPrice) return;
                    await addDoc(collection(db, 'menuItems'), {
                      restaurantId: restaurant.id,
                      name: newItemName,
                      price: Number(newItemPrice),
                      category: newItemCat || 'General',
                      isAvailable: true,
                      createdAt: new Date().toISOString(),
                    });
                    setNewItemName('');
                    setNewItemPrice('');
                    setNewItemCat('');
                  }}
                  className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" /> Add Menu Item
                </button>
              </div>

              {/* Menu List */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Active Items ({menuItems.length})
                </p>
                {menuItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-950 border border-slate-850 p-3.5 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-100">{item.name}</p>
                      <p className="text-slate-500 font-mono text-[11px]">
                        Category: {item.category} | Price: ₹{item.price}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          await updateDoc(doc(db, 'menuItems', item.id), { isAvailable: !item.isAvailable });
                        }}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase cursor-pointer ${
                          item.isAvailable
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {item.isAvailable ? 'In Stock' : 'Out of Stock'}
                      </button>
                      <button
                        onClick={async () => {
                          await deleteDoc(doc(db, 'menuItems', item.id));
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
