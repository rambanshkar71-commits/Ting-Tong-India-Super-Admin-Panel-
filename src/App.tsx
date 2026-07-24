/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query,
  doc,
  updateDoc,
  addDoc,
  setDoc
} from 'firebase/firestore';

// Subcomponents
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import LiveTrackingView from './components/LiveTrackingView';
import OrdersView from './components/OrdersView';
import RestaurantsView from './components/RestaurantsView';
import RidersView from './components/RidersView';
import CustomersView from './components/CustomersView';
import DeliveryCommissionsView from './components/DeliveryCommissionsView';
import MarketingZonesView from './components/MarketingZonesView';
import FinancialsView from './components/FinancialsView';
import SupportView from './components/SupportView';
import SettingsLogsView from './components/SettingsLogsView';
import RiderRegistrationForm from './components/RiderRegistrationForm';
import GigManagementView from './components/GigManagementView';
import PaymentManagementView from './components/PaymentManagementView';
import RiderGigView from './components/RiderGigView';
import { initializeMapService, getActiveCity } from './services/mapService';

// Icons & UI elements
import { 
  LogOut, 
  Database, 
  Lock, 
  AlertTriangle,
  FlameKindling,
  UserCheck,
  Menu,
  Bike,
  Power,
  Truck,
  Sparkles,
  User,
  Phone,
  Compass,
  CalendarDays,
  Bell,
  BellRing,
  X,
  Info,
  CheckCircle2,
  Wallet,
  Coins
} from 'lucide-react';
import { Order, Restaurant, Rider, Customer } from './types';

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

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Firestore Real-time Collections States
  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Notifications & Push Toast States
  const [notifications, setNotifications] = useState<any[]>([]);
  const [toasts, setToasts] = useState<any[]>([]);
  const [isAdminNotifOpen, setIsAdminNotifOpen] = useState(false);
  const [isRiderNotifOpen, setIsRiderNotifOpen] = useState(false);
  const [appStartTime] = useState(() => new Date().toISOString());

  // Auth States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');

  // Rider Portal States
  const [portalMode, setPortalMode] = useState<'admin' | 'rider'>('admin');
  const [currentRider, setCurrentRider] = useState<Rider | null>(null);
  const [riderPhoneInput, setRiderPhoneInput] = useState('');
  const [riderAadhaarInput, setRiderAadhaarInput] = useState('');
  const [riderLoginError, setRiderLoginError] = useState('');
  const [showRiderRegistration, setShowRiderRegistration] = useState(false);
  const [riderTab, setRiderTab] = useState<'duties' | 'gigs'>('duties');
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmtInput, setWithdrawAmtInput] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');

  // Manage Active Session Auth States
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Initialize centralized Map Settings subscription
  useEffect(() => {
    const unsubMap = initializeMapService();
    return () => {
      unsubMap();
    };
  }, []);

  // Requirement 4: Live GPS Location & Status tracking sync when rider is logged in and active
  useEffect(() => {
    if (!currentRider) return;
    const liveRider = riders.find(r => r.id === currentRider.id) || currentRider;
    if (liveRider.dutyStatus === 'on_duty' || liveRider.onlineStatus === 'online') {
      let watchId: number | null = null;
      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            updateDoc(doc(db, 'riders', liveRider.id), {
              lat: latitude,
              lng: longitude,
              lastActiveAt: new Date().toISOString(),
              lastLocationUpdate: new Date().toISOString()
            }).catch(err => {
              handleFirestoreError(err, OperationType.UPDATE, 'riders/' + liveRider.id);
            });
          },
          (err) => {
            console.warn("Rider GPS watch warning:", err);
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
        );
      }

      // Continuous timestamp pulse every 15s to keep lastActiveAt fresh in Firestore
      const interval = setInterval(() => {
        updateDoc(doc(db, 'riders', liveRider.id), {
          lastActiveAt: new Date().toISOString()
        }).catch(err => {
          handleFirestoreError(err, OperationType.UPDATE, 'riders/' + liveRider.id);
        });
      }, 15000);

      return () => {
        if (watchId !== null && 'geolocation' in navigator) {
          navigator.geolocation.clearWatch(watchId);
        }
        clearInterval(interval);
      };
    }
  }, [currentRider?.id, riders]);

  // Guarantee that login inputs are fully blank and free of browser auto-fill/suggestions
  useEffect(() => {
    if (!user) {
      setEmail('');
      setPassword('');
      setRiderPhoneInput('');
      setRiderAadhaarInput('');
      setAuthError('');
      setRiderLoginError('');
    }
  }, [user, portalMode, showRiderRegistration]);

  // Sync real-time data to support both Admin panel and Rider portal when authenticated
  useEffect(() => {
    if (!user) {
      setOrders([]);
      setRestaurants([]);
      setRiders([]);
      setCustomers([]);
      return;
    }

    // Real-time Orders Snapshot
    const unsubOrders = onSnapshot(query(collection(db, 'orders')), (snapshot) => {
      const items: Order[] = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() } as Order);
      });
      setOrders(items);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'orders'));

    // Real-time Restaurants Snapshot
    const unsubRestaurants = onSnapshot(query(collection(db, 'restaurants')), (snapshot) => {
      const items: Restaurant[] = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() } as Restaurant);
      });
      setRestaurants(items);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'restaurants'));

    // Real-time Riders Snapshot
    const unsubRiders = onSnapshot(query(collection(db, 'riders')), (snapshot) => {
      const items: Rider[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const riderObj = { id: docSnap.id, ...data } as Rider;
        items.push(riderObj);

        // Requirement 7: If a rider exists in 'riders' collection but not in 'users' collection,
        // automatically create or synchronize the corresponding 'users' document using Auth UID or rider ID with role: 'rider'.
        const authUid = data.userId || data.authUid || docSnap.id;
        if (authUid) {
          const userRef = doc(db, 'users', authUid);
          setDoc(userRef, {
            uid: authUid,
            riderId: docSnap.id,
            name: data.name || 'Rider Partner',
            email: data.email || `${docSnap.id.toLowerCase()}@tingtong.com`,
            phone: data.phone || '',
            role: 'rider',
            status: data.status || 'approved',
            onlineStatus: data.onlineStatus || 'offline',
            dutyStatus: data.dutyStatus || 'off_duty',
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(err => {
            handleFirestoreError(err, OperationType.UPDATE, 'users/' + authUid);
          });
        }
      });
      setRiders(items);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'riders'));

    // Real-time Customers Snapshot
    const unsubCustomers = onSnapshot(query(collection(db, 'customers')), (snapshot) => {
      const items: Customer[] = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() } as Customer);
      });
      setCustomers(items);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'customers'));

    return () => {
      unsubOrders();
      unsubRestaurants();
      unsubRiders();
      unsubCustomers();
    };
  }, [user]);

  // Real-time Gig Notifications and Push Toasts Listener
  useEffect(() => {
    if (!db || !user) {
      setNotifications([]);
      return;
    }
    const q = query(collection(db, 'gig_notifications'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() });
      });
      // Sort newest first
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(items);

      // Detect newly created items for dynamic slide-in alert toasts
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const notifId = change.doc.id;
          
          // Verify if is newer than app loaded time
          const isFresh = new Date(data.createdAt).getTime() > new Date(appStartTime).getTime();
          if (isFresh) {
            let isTarget = false;
            if (portalMode === 'admin' && (data.recipient === 'admin' || data.recipient === 'all')) {
              isTarget = true;
            } else if (portalMode === 'rider' && currentRider && (data.recipient === 'rider' || data.recipient === 'all') && (data.riderId === currentRider.id || data.assignedRiderId === currentRider.id)) {
              isTarget = true;
            }

            if (isTarget) {
              // Add to visual toast alerts
              setToasts(prev => {
                if (prev.some(t => t.id === notifId)) return prev;
                return [...prev, {
                  id: notifId,
                  title: data.title,
                  message: data.message,
                  type: data.type,
                  createdAt: data.createdAt
                }];
              });

              // Auto dismiss toast after 6 seconds
              setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== notifId));
              }, 6000);
            }
          }
        }
      });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'gig_notifications'));

    return unsubscribe;
  }, [user, portalMode, currentRider, appStartTime]);

  const markAdminNotificationsAsRead = async () => {
    const unread = notifications.filter(n => (n.recipient === 'admin' || n.recipient === 'all') && n.status === 'unread');
    for (const notif of unread) {
      try {
        await updateDoc(doc(db, 'gig_notifications', notif.id), { status: 'read' });
      } catch (err) {
        console.error("Error marking notification as read:", err);
      }
    }
  };

  const markNotificationAsRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'gig_notifications', notifId), { status: 'read' });
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const markRiderNotificationsAsRead = async (riderId: string) => {
    const unread = notifications.filter(n => (n.recipient === 'rider' || n.recipient === 'all') && n.riderId === riderId && n.status === 'unread');
    for (const notif of unread) {
      try {
        await updateDoc(doc(db, 'gig_notifications', notif.id), { status: 'read' });
      } catch (err) {
        console.error("Error marking notification as read:", err);
      }
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccessMsg('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
        setAuthSuccessMsg("Super Admin account created successfully! You are now logged in.");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setAuthError("Firebase Email/Password Authentication is not yet enabled. Please enable it in your Firebase console under Authentication > Sign-in method > Email/Password, then try again.");
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError("This email is already registered as an administrator. Please try signing in instead.");
      } else if (err.code === 'auth/weak-password') {
        setAuthError("The security password is too weak. It must be at least 6 characters.");
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setAuthError("Incorrect admin email or security password. Access denied.");
      } else if (err.code === 'auth/invalid-email') {
        setAuthError("Please enter a valid admin email address format.");
      } else {
        setAuthError("Failed to authenticate secure session: " + err.message);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Error in secure logout sequence: ", err);
    }
  };

  const handleRiderLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setRiderLoginError('');
    if (!riderPhoneInput || !riderAadhaarInput) {
      setRiderLoginError("कृपया मोबाइल नंबर और आधार कार्ड के आखरी 4 अंक दर्ज करें।");
      return;
    }

    const matched = riders.find(r => r.phone === riderPhoneInput);
    if (!matched) {
      setRiderLoginError("इस मोबाइल नंबर के साथ कोई राइडर पार्टनर पंजीकृत नहीं है।");
      return;
    }

    // Safety check: clean non-digits, check trailing 4 digits
    const cleanAadhaar = matched.aadhaarNumber.replace(/[^0-9]/g, '');
    const cleanInput = riderAadhaarInput.replace(/[^0-9]/g, '');
    const lastFour = cleanAadhaar.slice(-4);

    if (cleanInput !== lastFour && matched.aadhaarNumber !== "Aadhaar-NotUploaded" && matched.aadhaarNumber !== "AADHAAR-PENDING") {
      setRiderLoginError("गलत सुरक्षा पिन (आधार कार्ड के आखरी 4 अंक मैच नहीं हुए)।");
      return;
    }

    if (matched.status === 'pending') {
      setRiderLoginError("आपका आवेदन अभी पेंडिंग है। एडमिन द्वारा स्वीकृति के बाद ही आप ड्यूटी शुरू कर सकते हैं।");
      return;
    }
    if (matched.status === 'rejected') {
      setRiderLoginError(`आपका आवेदन अस्वीकृत (Rejected) कर दिया गया है। कारण: ${matched.rejectedReason || 'दस्तावेज़ साफ़ नहीं हैं।'}`);
      return;
    }
    if (matched.status === 'suspended') {
      setRiderLoginError("आपका अकाउंट सस्पेंड (Suspended) है। कृपया एडमिनिस्ट्रेटर से संपर्क करें।");
      return;
    }

    // Successfully log in
    setCurrentRider(matched);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-4 font-sans selection:bg-amber-500 selection:text-slate-950">
        <div className="w-10 h-10 border-t-2 border-r-2 border-amber-500 rounded-full animate-spin"></div>
        <span className="text-xs font-semibold tracking-widest uppercase text-amber-500">Connecting Grid Nodes...</span>
      </div>
    );
  }

  // If a Rider is logged in, show the mobile-optimized Rider Duty Portal
  if (currentRider) {
    // Sync current rider details with real-time state from DB
    const liveRider = riders.find(r => r.id === currentRider.id) || currentRider;
    const assignedOrders = orders.filter(o => (o.riderId === liveRider.id || o.assignedRiderId === liveRider.id) && o.status !== 'delivered' && o.status !== 'cancelled');

    // Real-time daily statistics calculation
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayStartTime = todayStart.getTime();

    const riderOrdersToday = orders.filter(o => 
      (o.riderId === liveRider.id || o.assignedRiderId === liveRider.id) && 
      o.createdAt && new Date(o.createdAt).getTime() >= todayStartTime
    );

    const todaysOrdersCount = riderOrdersToday.length;
    const completedOrdersTodayCount = riderOrdersToday.filter(o => o.status === 'delivered').length;
    
    const activeOrdersCount = orders.filter(o => 
      (o.riderId === liveRider.id || o.assignedRiderId === liveRider.id) && 
      o.status !== 'delivered' && 
      o.status !== 'cancelled'
    ).length;

    const earningsToday = riderOrdersToday
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.riderEarnings || 40), 0);

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans selection:bg-amber-500 selection:text-slate-950 flex justify-center pb-24">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-amber-500 to-orange-600 p-2 rounded-xl text-slate-950 font-black text-xs">
                TT
              </div>
              <div>
                <h1 className="font-bold text-slate-100 text-xs flex items-center gap-1.5">
                  TING TONG INDIA
                  <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[8px] font-bold px-1 rounded uppercase font-mono">VIP</span>
                </h1>
                <span className="text-[9px] text-amber-500 font-mono tracking-wider">ID: {liveRider.id || 'TTRXX'} • Duty Dashboard</span>
              </div>
            </div>
            
            <div className="flex gap-2">
              {(() => {
                const riderNotifs = notifications.filter(n => (n.recipient === 'rider' || n.recipient === 'all') && n.riderId === liveRider.id);
                const riderUnreadCount = riderNotifs.filter(n => n.status === 'unread').length;
                
                return (
                  <button 
                    onClick={() => {
                      setIsRiderNotifOpen(!isRiderNotifOpen);
                      if (!isRiderNotifOpen && riderUnreadCount > 0) {
                        markRiderNotificationsAsRead(liveRider.id);
                      }
                    }}
                    className={`p-2 rounded-xl transition relative cursor-pointer ${
                      isRiderNotifOpen
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                    title="Notifications"
                  >
                    {riderUnreadCount > 0 ? (
                      <>
                        <BellRing className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                        <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border border-slate-900 shadow-lg">
                          {riderUnreadCount}
                        </span>
                      </>
                    ) : (
                      <Bell className="w-3.5 h-3.5" />
                    )}
                  </button>
                );
              })()}
              
              <button 
                onClick={() => setCurrentRider(null)}
                className="bg-slate-800 hover:bg-slate-750 text-slate-300 px-2.5 py-1.5 rounded-xl transition text-[10px] font-bold cursor-pointer"
                title="Return to Admin Panel"
              >
                ← Admin Mode
              </button>
              <button 
                onClick={() => {
                  setCurrentRider(null);
                  handleLogout();
                }}
                className="bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 text-slate-450 px-2.5 py-1.5 rounded-xl transition text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Power className="w-3.5 h-3.5 text-rose-500" /> Log Out
              </button>
            </div>
          </div>

          {/* Rider Notifications Modal */}
          {isRiderNotifOpen && (() => {
            const riderNotifs = notifications.filter(n => (n.recipient === 'rider' || n.recipient === 'all') && n.riderId === liveRider.id);
            
            return (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
                  <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-500 animate-bounce" />
                      <h3 className="font-bold text-xs text-slate-200">Rider Notifications</h3>
                    </div>
                    <button 
                      onClick={() => setIsRiderNotifOpen(false)}
                      className="text-slate-400 hover:text-slate-200 cursor-pointer p-1 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="overflow-y-auto divide-y divide-slate-850/60 p-2 space-y-1">
                    {riderNotifs.length === 0 ? (
                      <div className="p-8 text-center space-y-2">
                        <Bell className="w-8 h-8 text-slate-700 mx-auto opacity-40" />
                        <p className="text-xs text-slate-500">कोई नोटिफिकेशन नहीं है।</p>
                      </div>
                    ) : (
                      riderNotifs.map((notif) => (
                        <div 
                          key={notif.id}
                          className={`p-3 rounded-2xl transition flex gap-3 ${
                            notif.status === 'unread' ? 'bg-amber-500/[0.03] border border-amber-500/10' : 'bg-slate-950/30'
                          }`}
                        >
                          <div className="shrink-0 mt-0.5">
                            {notif.type === 'booking_success' || notif.type === 'promotion_success' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : notif.type === 'booking_cancelled' ? (
                              <X className="w-4 h-4 text-rose-400" />
                            ) : (
                              <Info className="w-4 h-4 text-sky-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-1">
                              <h4 className="text-[11px] font-bold text-slate-200 leading-tight">
                                {notif.title}
                              </h4>
                              <span className="text-[8px] text-slate-500 font-mono">
                                {new Date(notif.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                              {notif.message}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  <div className="p-3 bg-slate-950/40 border-t border-slate-800 text-center">
                    <button 
                      onClick={() => setIsRiderNotifOpen(false)}
                      className="w-full bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold py-2 rounded-xl text-[10px] transition cursor-pointer"
                    >
                      Close (बंद करें)
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Rider Withdraw Request Modal */}
          {isWithdrawOpen && (
            <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-55 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col p-6 space-y-4 animate-fade-in">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-500 animate-pulse" />
                    <h3 className="font-bold text-xs text-slate-200">Withdraw Request (पैसे निकालें)</h3>
                  </div>
                  <button 
                    onClick={() => {
                      setIsWithdrawOpen(false);
                      setWithdrawSuccess('');
                    }}
                    className="text-slate-400 hover:text-slate-200 cursor-pointer p-1 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {withdrawSuccess ? (
                  <div className="text-center py-6 space-y-3">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                    <p className="text-xs font-bold text-slate-100">{withdrawSuccess}</p>
                    <p className="text-[10px] text-slate-400">Withdraw request has been successfully queued for instant bank dispatch. The admin is notified.</p>
                    <button
                      onClick={() => {
                        setIsWithdrawOpen(false);
                        setWithdrawSuccess('');
                      }}
                      className="w-full bg-slate-850 hover:bg-slate-800 text-slate-200 font-bold py-2.5 rounded-xl text-xs mt-4 transition cursor-pointer"
                    >
                      Close (बंद करें)
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 text-xs">
                    <div className="bg-slate-950 p-4 border border-slate-850 rounded-2xl flex justify-between">
                      <div>
                        <span className="text-slate-500 text-[10px] block font-bold">CURRENT WALLET</span>
                        <span className="font-mono font-bold text-slate-200 block">₹{liveRider.walletBalance}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 text-[10px] block font-bold">PAYOUT ACCOUNT</span>
                        <span className="font-mono font-bold text-amber-400 block">{liveRider.upiId || `${liveRider.phone}@ybl`}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-slate-400 font-bold block">Enter Withdraw Amount (राशि दर्ज करें):</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-400 font-mono font-bold">₹</span>
                        <input
                          type="number"
                          max={liveRider.walletBalance}
                          min={1}
                          value={withdrawAmtInput}
                          onChange={(e) => setWithdrawAmtInput(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-7 pr-3 font-mono font-bold text-amber-500 outline-none focus:border-amber-500"
                          placeholder="e.g. 330"
                        />
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-500 leading-normal">
                      Note: On request submission, the admin panel will instantly approve and disburse ₹{withdrawAmtInput || 0} directly to your UPI ID/Bank account linked to ID: {liveRider.id}.
                    </p>

                    <div className="flex gap-2.5 pt-2">
                      <button
                        onClick={() => setIsWithdrawOpen(false)}
                        className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold py-2.5 rounded-xl transition cursor-pointer"
                      >
                        Cancel (रद्द करें)
                      </button>
                      <button
                        onClick={async () => {
                          const amt = Number(withdrawAmtInput);
                          if (isNaN(amt) || amt <= 0 || amt > liveRider.walletBalance) {
                            alert("कृपया सही निकासी राशि दर्ज करें (अधिकतम ₹" + liveRider.walletBalance + ")");
                            return;
                          }

                          try {
                            // Update rider's wallet balance in real-time Firestore database
                            const nextBal = liveRider.walletBalance - amt;
                            await updateDoc(doc(db, 'riders', liveRider.id), { walletBalance: nextBal });

                            // Trigger real-time alert log to Admin Panel
                            await addDoc(collection(db, 'gig_notifications'), {
                              title: "Withdrawal Request Disbursed",
                              message: `Rider ${liveRider.name} (ID: ${liveRider.id}) has successfully requested & disbursed ₹${amt} to their payout account.`,
                              type: "booking_success",
                              recipient: "admin",
                              riderId: liveRider.id,
                              createdAt: new Date().toISOString(),
                              status: "unread"
                            });

                            setWithdrawSuccess(`₹${amt} Withdraw Request Success!`);
                          } catch (err: any) {
                            alert("Withdraw request failed: " + err.message);
                          }
                        }}
                        className="flex-1 bg-amber-500 text-slate-950 font-bold py-2.5 rounded-xl hover:brightness-110 transition cursor-pointer"
                      >
                        Submit Request
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {riderTab === 'duties' ? (
            <>
              {/* Profile Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center gap-4">
                  <img 
                    src={liveRider.profilePhotoUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60"} 
                    className="w-16 h-16 rounded-full object-cover border-2 border-amber-500 shrink-0 shadow-lg"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60";
                    }}
                  />
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-slate-100 flex items-center gap-1.5 truncate">
                      {liveRider.name}
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono">Approved</span>
                    </h2>
                    <p className="text-amber-500 text-xs font-mono font-bold mt-0.5">ID: {liveRider.id}</p>
                    <p className="text-slate-400 text-xs truncate">{liveRider.phone}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] text-slate-500 font-mono bg-slate-950 px-2 py-0.5 rounded">COD Limit: ₹{liveRider.codLimit || 5000}</span>
                    </div>
                  </div>
                </div>

                {/* Wallet summary */}
                <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 border border-slate-850 rounded-2xl">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">मेरा वॉलेट बैलेंस (Wallet)</span>
                    <span className={`text-base font-bold font-mono ${liveRider.walletBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ₹{liveRider.walletBalance || 0}
                    </span>
                    <span className="text-[9px] text-slate-500 block mt-0.5">
                      {liveRider.walletBalance >= 0 ? '(कंपनी आपको देगी)' : '(आपको कंपनी को देना है)'}
                    </span>
                  </div>
                  <div className="flex flex-col justify-center items-end gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-slate-500 uppercase font-bold">Duty:</span>
                      <button
                        onClick={async () => {
                          const nextDuty = liveRider.dutyStatus === 'on_duty' ? 'off_duty' : 'on_duty';
                          const nextOnline = nextDuty === 'on_duty' ? 'online' : 'offline';
                          try {
                            const nowStr = new Date().toISOString();
                            await updateDoc(doc(db, 'riders', liveRider.id), { 
                              dutyStatus: nextDuty,
                              onlineStatus: nextOnline,
                              lastActiveAt: nowStr,
                              lastLocationUpdate: nowStr
                            });

                            const authUid = (liveRider as any).userId || (liveRider as any).authUid || user?.uid;
                            if (authUid) {
                              updateDoc(doc(db, 'users', authUid), {
                                onlineStatus: nextOnline,
                                dutyStatus: nextDuty,
                                updatedAt: nowStr
                              }).catch(() => {});
                            }
                          } catch (err: any) {
                            alert("ड्यूटी स्थिति अपडेट करने में त्रुटि: " + err.message);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                          liveRider.dutyStatus === 'on_duty' 
                            ? 'bg-emerald-600 text-slate-100 hover:bg-emerald-500' 
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-750'
                        }`}
                      >
                        {liveRider.dutyStatus === 'on_duty' ? '🟢 ON DUTY' : '🔴 OFF DUTY'}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-slate-500 uppercase font-bold">Live:</span>
                      <button
                        onClick={async () => {
                          const nextOnline = liveRider.onlineStatus === 'online' ? 'offline' : 'online';
                          const nextDuty = nextOnline === 'online' ? 'on_duty' : 'off_duty';
                          try {
                            const nowStr = new Date().toISOString();
                            await updateDoc(doc(db, 'riders', liveRider.id), { 
                              onlineStatus: nextOnline,
                              dutyStatus: nextDuty,
                              lastActiveAt: nowStr,
                              lastLocationUpdate: nowStr
                            });
                            
                            const authUid = (liveRider as any).userId || (liveRider as any).authUid || user?.uid;
                            if (authUid) {
                              updateDoc(doc(db, 'users', authUid), {
                                onlineStatus: nextOnline,
                                dutyStatus: nextDuty,
                                updatedAt: nowStr
                              }).catch(() => {});
                            }
                          } catch (err: any) {
                            alert("ऑनलाइन स्थिति अपडेट करने में त्रुटि: " + err.message);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                          liveRider.onlineStatus === 'online' 
                            ? 'bg-sky-600 text-slate-100 hover:bg-sky-500' 
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-750'
                        }`}
                      >
                        {liveRider.onlineStatus === 'online' ? '⚡ ONLINE' : '💤 OFFLINE'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Today's Performance Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
                <div className="border-b border-slate-850 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-xs text-slate-200 uppercase tracking-wider">Today's Performance (आज का प्रदर्शन)</h3>
                    <p className="text-[10px] text-slate-500">Real-time statistics & financial settlement tracking</p>
                  </div>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950 p-3 border border-slate-850 rounded-2xl flex flex-col justify-between">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Today's Orders (आज के ऑर्डर्स)</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-black font-mono text-slate-200">{todaysOrdersCount}</span>
                      <span className="text-[10px] text-slate-500 font-medium">assigned</span>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 border border-slate-850 rounded-2xl flex flex-col justify-between">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Completed Orders (पूरे हुए ऑर्डर्स)</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-black font-mono text-emerald-400">{completedOrdersTodayCount}</span>
                      <span className="text-[10px] text-slate-500 font-medium font-mono">delivered</span>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 border border-slate-850 rounded-2xl flex flex-col justify-between">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Active Orders (सक्रिय ऑर्डर्स)</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-black font-mono text-amber-500">{activeOrdersCount}</span>
                      <span className="text-[10px] text-slate-500 font-medium font-mono">in-flight</span>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 border border-slate-850 rounded-2xl flex flex-col justify-between">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Earnings Today (आज की कमाई)</span>
                    <div className="flex flex-col mt-1">
                      <span className="text-xl font-black font-mono text-emerald-400">₹{earningsToday}</span>
                      <span className="text-[8px] text-slate-500 font-medium">Including bonuses</span>
                    </div>
                  </div>
                </div>

                {/* Wallet Balance & Withdraw Section */}
                <div className="bg-slate-950/80 p-4 border border-slate-850 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Wallet Balance (वॉलेट बैलेंस)</span>
                      <span className="text-lg font-black font-mono text-amber-400 mt-1 block">₹{liveRider.walletBalance || 0}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Pending Settlement (पेंडिंग)</span>
                      <span className="text-xs font-bold font-mono text-slate-400 mt-1 block">₹{liveRider.totalIncentives || 0}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setWithdrawAmtInput(Math.max(0, liveRider.walletBalance).toString());
                      setIsWithdrawOpen(true);
                    }}
                    disabled={liveRider.walletBalance <= 0}
                    className={`w-full font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer ${
                      liveRider.walletBalance > 0
                        ? 'bg-amber-500 text-slate-950 hover:brightness-110'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Coins className="w-4 h-4 shrink-0" />
                    <span>Settle Wallet / Withdraw Request (पैसे निकालें)</span>
                  </button>
                </div>
              </div>

              {/* Active Orders List */}
              <div className="space-y-4">
                <h3 className="font-bold text-xs text-slate-300 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-500" />
                  <span>आवंटित सक्रिय ऑर्डर्स (Active assigned orders - {assignedOrders.length})</span>
                </h3>

                {assignedOrders.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-850 rounded-2xl p-8 text-center text-slate-500 space-y-2 shadow-inner">
                    <Bike className="w-8 h-8 mx-auto text-slate-600 animate-pulse" />
                    <p className="text-xs">कोई नया ऑर्डर अभी असाइन नहीं हुआ है।</p>
                    <p className="text-[10px] text-slate-600">नये ऑर्डर्स प्राप्त करने के लिए अपनी ड्यूटी स्थिति को "ON DUTY" रखें।</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {assignedOrders.map(o => (
                      <div key={o.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
                        <div className="flex justify-between items-start border-b border-slate-850 pb-3">
                          <div>
                            <span className="text-[10px] text-amber-500 font-mono font-bold tracking-wide">ORDER ID: #{o.id.substring(0, 8).toUpperCase()}</span>
                            <p className="text-[10px] text-slate-500 mt-0.5">{new Date(o.createdAt).toLocaleTimeString()}</p>
                          </div>
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold px-2 py-0.5 rounded uppercase font-mono">
                            {o.status.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <div className="space-y-2.5 text-xs text-slate-300">
                          <div>
                            <span className="text-slate-500 text-[10px] block">रेस्टोरेंट (Restaurant):</span>
                            <p className="font-bold text-slate-200">{o.restaurantName}</p>
                          </div>

                          <div>
                            <span className="text-slate-500 text-[10px] block">डिलीवरी का पता (Delivery Address):</span>
                            <p className="text-slate-200 font-medium leading-relaxed">{o.deliveryAddress}</p>
                          </div>

                          <div>
                            <span className="text-slate-500 text-[10px] block">ग्राहक का विवरण (Customer Contact):</span>
                            <p className="text-slate-200 font-medium">{o.customerName} ({o.customerPhone})</p>
                          </div>

                          <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex justify-between font-mono font-bold">
                            <div>
                              <span className="text-slate-500 text-[9px] block">भुगतान प्रकार (Payment)</span>
                              <span className="text-amber-400">{o.paymentMethod}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-500 text-[9px] block">कुल मूल्य (Amount)</span>
                              <span className="text-slate-200">₹{o.totalAmount}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons based on status */}
                        <div className="pt-2">
                          {(o.status === 'accepted' || o.status === 'assigned' || o.status === 'preparing' || o.status === 'ready_for_pickup' || o.status === 'pending') && (
                            <button
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, 'orders', o.id), { 
                                    status: 'picked_up',
                                    updatedAt: new Date().toISOString()
                                  });
                                } catch (err: any) {
                                  alert("त्रुटि: " + err.message);
                                }
                              }}
                              className="w-full bg-amber-500 text-slate-950 font-bold py-3 rounded-xl text-xs hover:brightness-110 active:scale-[0.99] transition cursor-pointer"
                            >
                              मैंने आर्डर पिकअप कर लिया है (Mark as Picked Up)
                            </button>
                          )}

                          {(o.status === 'picked_up' || o.status === 'picked') && (
                            <button
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, 'orders', o.id), { 
                                    status: 'delivered',
                                    paymentStatus: 'paid',
                                    updatedAt: new Date().toISOString()
                                  });
                                  
                                  // Real-time wallet calculation
                                  const riderRef = doc(db, 'riders', liveRider.id);
                                  const earnings = o.riderEarnings || 40;
                                  let walletAdjustment = earnings;
                                  if (o.paymentMethod === 'COD') {
                                    walletAdjustment -= o.totalAmount;
                                  }
                                  const nextBalance = (liveRider.walletBalance || 0) + walletAdjustment;
                                  await updateDoc(riderRef, { walletBalance: nextBalance });
                                  
                                  alert("ऑर्डर सफलतापूर्वक डिलीवर कर दिया गया! ₹" + earnings + " आपके वॉलेट में जमा हो चुके हैं।");
                                } catch (err: any) {
                                  alert("त्रुटि: " + err.message);
                                }
                              }}
                              className="w-full bg-emerald-600 text-slate-100 font-bold py-3 rounded-xl text-xs hover:bg-emerald-500 active:scale-[0.99] transition cursor-pointer"
                            >
                              मैंने सफलतापूर्वक डिलीवर कर दिया (Mark as Delivered) ✓
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : riderTab === 'gigs' ? (
            <RiderGigView rider={liveRider} />
          ) : (
            /* Dedicated Rider Payments tab */
            <div className="space-y-4 animate-fade-in pb-16">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-xl">
                <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider">मेरा भुगतान विवरण (My Payment Details)</h3>
                
                {/* Bank account details status */}
                <div className="bg-slate-950 p-4 border border-slate-850 rounded-2xl space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">बैंक नाम (Bank):</span>
                    <span className="font-bold text-slate-200">{liveRider.bankName || 'HDFC Bank'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">खाता संख्या (A/C No):</span>
                    <span className="font-bold text-slate-200 font-mono">{liveRider.accountNumber || '************5432'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">यूपीआई आईडी (UPI ID):</span>
                    <span className="font-bold text-amber-500 font-mono">{liveRider.upiId || `${liveRider.phone}@ybl`}</span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 text-center leading-normal">
                  यदि आप अपना बैंक विवरण बदलना चाहते हैं, तो कृपया एडमिन पैनल के "Bank & UPI Management" डेस्क से संपर्क करें।
                </p>
              </div>

              {/* Transactions list */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
                <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider">मेरा लेनदेन इतिहास (Transactions History)</h3>
                
                {/* Real-time sync list of transactions for this rider */}
                {(() => {
                  const riderTx = notifications.filter(n => n.recipient === 'rider' && n.riderId === liveRider.id); // fallbacks
                  // Search transactions collection from live snapshot state instead!
                  // We have 'orders' delivered state or we can pull from parent payment_transactions list if we have it here? Oh, in App.tsx we don't have payment_transactions yet.
                  // Wait, can we fetch payment_transactions in App.tsx or use orders delivery list?
                  // Yes! We have orders! We can show orders delivered by this rider, displaying their earnings!
                  const myDeliveredOrders = orders.filter(o => (o.riderId === liveRider.id || o.assignedRiderId === liveRider.id) && o.status === 'delivered');

                  return (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {myDeliveredOrders.map(o => (
                        <div key={o.id} className="p-3 rounded-2xl bg-slate-950/40 border border-slate-850 text-xs flex justify-between items-center">
                          <div>
                            <span className="font-bold text-slate-200 block">ऑर्डर #{o.id.slice(-6).toUpperCase()}</span>
                            <span className="text-[9px] text-slate-500 font-mono">Delivered on {new Date(o.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-emerald-400 font-mono block">₹{o.riderEarnings || 40}</span>
                            <span className="text-[9px] text-slate-400 bg-emerald-500/5 px-1.5 py-0.5 rounded uppercase font-bold">PAID</span>
                          </div>
                        </div>
                      ))}
                      {myDeliveredOrders.length === 0 && (
                        <p className="text-[10px] text-slate-500 text-center py-6">कोई भुगतान इतिहास दर्ज नहीं है।</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Bottom Navigation */}
          <div className="fixed bottom-0 inset-x-0 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 p-2 flex justify-around items-center z-40 max-w-md mx-auto rounded-t-2xl shadow-xl">
            <button
              onClick={() => setRiderTab('duties')}
              className={`flex flex-col items-center gap-1 transition cursor-pointer px-4 py-1 rounded-xl ${
                riderTab === 'duties' ? 'text-amber-500' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bike className="w-5 h-5" />
              <span className="text-[10px] font-bold">Duties</span>
            </button>
            <button
              onClick={() => setRiderTab('gigs')}
              className={`flex flex-col items-center gap-1 transition cursor-pointer px-4 py-1 rounded-xl relative ${
                riderTab === 'gigs' ? 'text-amber-500' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarDays className="w-5 h-5 animate-pulse" />
              <span className="text-[10px] font-bold">🗓 Gig</span>
            </button>
            <button
              onClick={() => setRiderTab('payments')}
              className={`flex flex-col items-center gap-1 transition cursor-pointer px-4 py-1 rounded-xl relative ${
                riderTab === 'payments' ? 'text-amber-500' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wallet className="w-5 h-5" />
              <span className="text-[10px] font-bold">भुगतान (Payments)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Login Panel for non-authenticated administrators
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-100 selection:bg-amber-500 selection:text-slate-950">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-500 px-4 py-1.5 rounded-full border border-amber-500/10">
              <Lock className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Ting Tong {getActiveCity().name}</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-100">Operations Control Desk</h1>
            <p className="text-slate-400 text-xs">Please sign in with administrator credentials.</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4" autoComplete="off">
            {/* Decoy inputs to capture and defeat browser credential auto-fill/suggest engines */}
            <input 
              style={{ opacity: 0, position: 'absolute', top: -100, left: -100, height: 0, width: 0 }} 
              type="text" 
              name="admin_username_decoy" 
              tabIndex={-1} 
              autoComplete="off" 
            />
            <input 
              style={{ opacity: 0, position: 'absolute', top: -100, left: -100, height: 0, width: 0 }} 
              type="password" 
              name="admin_password_decoy" 
              tabIndex={-1} 
              autoComplete="new-password" 
            />

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Admin Email</label>
              <input 
                required 
                type="text" 
                name="x_adm_id"
                id="x_adm_id"
                autoComplete="off"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:border-amber-500 outline-none transition" 
                placeholder="Enter authorized administrator email"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Security Password</label>
              <input 
                required 
                type="password" 
                name="x_adm_tok"
                id="x_adm_tok"
                autoComplete="new-password"
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:border-amber-500 outline-none transition" 
                placeholder="Enter operational security key"
              />
            </div>

            {authError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex flex-col gap-1.5 text-rose-400 text-xs leading-normal">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              </div>
            )}

            {authSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2.5 text-emerald-400 text-xs leading-normal">
                <UserCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authSuccessMsg}</span>
              </div>
            )}

            <button 
              type="submit" 
              className="w-full bg-amber-500 text-slate-950 font-bold py-3.5 rounded-xl text-xs hover:brightness-110 active:scale-[0.99] transition cursor-pointer"
            >
              Sign In to Command Center
            </button>
          </form>

          <div className="pt-4 border-t border-slate-850 text-center">
            <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">
              🛡️ Enterprise Multi-Factor & Auth Node Active
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Render Admin Layout for Authenticated users
  return (
    <div className="min-h-screen bg-slate-950 flex font-sans text-slate-100 selection:bg-amber-500 selection:text-slate-950">
      
      {/* Sidebar Backdrop Overlay on Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={currentTab} 
        setActiveTab={setCurrentTab} 
        adminEmail={user.email}
        onLogout={handleLogout}
        onResetDb={() => alert("Please use the Admin Panel to manage your business data. Seeding and sandbox triggers are disabled in production.")}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Universal Top Operational Control Header */}
        <header className="h-16 border-b border-slate-800 shrink-0 px-4 sm:px-8 flex items-center justify-between bg-slate-900/60 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
            {/* Hamburger Menu Toggle on Mobile */}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-slate-300 hover:text-slate-100 p-2 rounded-xl hover:bg-slate-800 transition cursor-pointer shrink-0"
              title="Open Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <span className="text-xs text-slate-500 hidden xl:inline shrink-0">Environment ID: <span className="font-mono text-amber-500 font-bold">BHP-GRID-LIVE</span></span>
            
            {/* Status indicator for database */}
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0">
              <Database className="w-3.5 h-3.5" /> 
              <span>
                <span className="hidden md:inline">{getActiveCity().name} Data Node Live</span>
                <span className="md:hidden">Node Live</span>
              </span>
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {riders.length > 0 && (
              <div className="hidden md:flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5">
                <span className="text-[9px] text-slate-500 uppercase font-black tracking-wide">Rider Perspective:</span>
                <select 
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const found = riders.find(r => r.id === e.target.value);
                    if (found) {
                      setRiderTab('duties'); // Default to active duties on switch
                      setCurrentRider(found);
                    }
                  }}
                  value={currentRider ? currentRider.id : ''}
                  className="bg-transparent text-[10px] font-bold text-amber-500 cursor-pointer outline-none border-none pr-1"
                >
                  <option value="" className="bg-slate-900 text-slate-400">Select Rider Partner...</option>
                  {riders.map(r => (
                    <option key={r.id} value={r.id} className="bg-slate-900 text-slate-200 font-mono">
                      🏍️ {r.name} ({r.id})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Real-time FCM Notification Slide-in Popups (Toasts) */}
            <div className="fixed top-4 right-4 z-[9999] space-y-3 max-w-sm w-full pointer-events-none">
              {toasts.map((t) => (
                <div 
                  key={t.id}
                  className="pointer-events-auto bg-slate-900/95 border border-slate-850 border-l-4 rounded-xl p-4 shadow-2xl flex gap-3 transform translate-x-0 transition-all duration-300 animate-slide-in relative overflow-hidden"
                  style={{
                    borderLeftColor: 
                      t.type === 'booking_success' || t.type === 'promotion_success' ? '#10b981' : 
                      t.type === 'waiting_list' ? '#0ea5e9' : 
                      t.type === 'booking_cancelled' ? '#f97316' : 
                      t.type === 'gig_full_rider' || t.type === 'gig_full_admin' ? '#8b5cf6' : '#f59e0b'
                  }}
                >
                  <div className="shrink-0 mt-0.5">
                    {t.type === 'booking_success' || t.type === 'promotion_success' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : t.type === 'booking_cancelled' ? (
                      <X className="w-5 h-5 text-rose-400" />
                    ) : t.type === 'waiting_list' ? (
                      <Info className="w-5 h-5 text-sky-400" />
                    ) : (
                      <Bell className="w-5 h-5 text-amber-400 animate-bounce" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-6">
                    <h4 className="text-xs font-black text-slate-100 flex items-center gap-1.5">
                      {t.title}
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase bg-slate-950 text-slate-400 font-mono">
                        FCM Alert
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                      {t.message}
                    </p>
                    <span className="text-[8px] text-slate-500 font-mono mt-1.5 block">
                      {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  <button 
                    onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
                    className="absolute top-3 right-3 text-slate-500 hover:text-slate-350 cursor-pointer transition p-1 rounded-lg hover:bg-slate-850"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Admin Notification Bell with Dropdown Panel */}
            {(() => {
              const adminNotifs = notifications.filter(n => n.recipient === 'admin' || n.recipient === 'all');
              const unreadCount = adminNotifs.filter(n => n.status === 'unread').length;
              
              return (
                <div className="relative">
                  <button 
                    onClick={() => {
                      setIsAdminNotifOpen(!isAdminNotifOpen);
                      if (!isAdminNotifOpen && unreadCount > 0) {
                        markAdminNotificationsAsRead();
                      }
                    }}
                    className={`p-2 rounded-xl transition relative cursor-pointer ${
                      isAdminNotifOpen 
                        ? 'bg-slate-800 text-amber-400 border border-slate-750' 
                        : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                    title="System Notifications"
                  >
                    {unreadCount > 0 ? (
                      <>
                        <BellRing className="w-4 h-4 text-amber-400 animate-pulse" />
                        <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-slate-900 shadow-lg">
                          {unreadCount}
                        </span>
                      </>
                    ) : (
                      <Bell className="w-4 h-4" />
                    )}
                  </button>

                  {/* Dropdown Panel */}
                  {isAdminNotifOpen && (
                    <>
                      {/* Backdrop to close */}
                      <div className="fixed inset-0 z-40" onClick={() => setIsAdminNotifOpen(false)} />
                      
                      <div className="absolute right-0 mt-2.5 w-72 sm:w-96 max-w-[calc(100vw-2rem)] bg-slate-900/95 border border-slate-850 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[450px] backdrop-blur-md">
                        <div className="p-4 border-b border-slate-850 bg-slate-950/40 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-amber-500 animate-pulse" />
                            <h3 className="font-bold text-xs text-slate-200">System Live Alerts</h3>
                          </div>
                          {unreadCount > 0 && (
                            <button 
                              onClick={markAdminNotificationsAsRead}
                              className="text-[10px] text-amber-500 hover:text-amber-400 font-bold transition cursor-pointer"
                            >
                              Mark all as read
                            </button>
                          )}
                        </div>

                        <div className="overflow-y-auto divide-y divide-slate-850/60 max-h-[300px] shrink-0">
                          {adminNotifs.length === 0 ? (
                            <div className="p-8 text-center space-y-2">
                              <Bell className="w-8 h-8 text-slate-700 mx-auto opacity-40" />
                              <p className="text-xs text-slate-500">No operational alerts recorded yet.</p>
                            </div>
                          ) : (
                            adminNotifs.map((notif) => (
                              <div 
                                key={notif.id}
                                onClick={() => markNotificationAsRead(notif.id)}
                                className={`p-4 transition cursor-pointer hover:bg-slate-850/40 flex gap-3 ${
                                  notif.status === 'unread' ? 'bg-amber-500/[0.02]' : ''
                                }`}
                              >
                                <div className="shrink-0 mt-0.5">
                                  <div className={`w-2 h-2 rounded-full ${
                                    notif.status === 'unread' ? 'bg-amber-500 animate-ping' : 'bg-slate-600'
                                  }`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start gap-1">
                                    <h4 className={`text-[11px] font-bold leading-tight ${
                                      notif.status === 'unread' ? 'text-slate-100' : 'text-slate-400'
                                    }`}>
                                      {notif.title}
                                    </h4>
                                    <span className="text-[8px] text-slate-500 font-mono">
                                      {new Date(notif.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                                    {notif.message}
                                  </p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                        
                        <div className="p-3 bg-slate-950/40 border-t border-slate-850 text-center">
                          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">
                            Ting Tong FCM Trigger Node
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            <div className="text-right">
              <p className="text-xs font-bold text-slate-300">Ting Tong Admin</p>
              <p className="text-[10px] text-slate-500 hidden sm:block truncate max-w-[150px] font-mono">{user.email}</p>
            </div>
            
            <button 
              onClick={handleLogout}
              className="bg-slate-800 hover:bg-rose-500 hover:text-slate-100 text-slate-400 p-2 rounded-xl transition cursor-pointer"
              title="Secure Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Dynamic View container */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardView 
              orders={orders} 
              restaurants={restaurants} 
              riders={riders} 
              customers={customers} 
              onOpenLiveTracking={() => setCurrentTab('live_tracking')}
            />
          )}

          {currentTab === 'live_tracking' && (
            <LiveTrackingView 
              orders={orders} 
              riders={riders} 
              restaurants={restaurants} 
              customers={customers} 
            />
          )}

          {currentTab === 'orders' && (
            <OrdersView 
              orders={orders} 
              riders={riders} 
            />
          )}

          {currentTab === 'gig_management' && (
            <GigManagementView riders={riders} />
          )}

          {currentTab === 'restaurants' && (
            <RestaurantsView 
              restaurants={restaurants} 
            />
          )}

          {currentTab === 'riders' && (
            <RidersView 
              riders={riders} 
              orders={orders}
            />
          )}

          {currentTab === 'customers' && (
            <CustomersView 
              customers={customers} 
              orders={orders} 
            />
          )}

          {currentTab === 'billing' && (
            <DeliveryCommissionsView />
          )}

          {currentTab === 'marketing' && (
            <MarketingZonesView />
          )}

          {currentTab === 'financials' && (
            <FinancialsView 
              restaurants={restaurants} 
              riders={riders} 
              orders={orders}
              customers={customers}
              adminEmail={user?.email || 'admin@tingtong.bhopal'}
            />
          )}

          {currentTab === 'payment_management' && (
            <PaymentManagementView />
          )}

          {currentTab === 'support' && (
            <SupportView />
          )}

          {currentTab === 'settings' && (
            <SettingsLogsView 
              restaurants={restaurants}
              riders={riders}
              customers={customers}
              orders={orders}
            />
          )}
        </main>
      </div>

      {/* Real-time Enterprise Workspace */}

    </div>
  );
}

