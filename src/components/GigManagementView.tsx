import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  query, 
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { Gig, GigBooking, Rider, Zone } from '../types';
import { getActiveCity } from '../services/mapService';
import { 
  Calendar, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Copy, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  Clock, 
  TrendingUp, 
  Coins, 
  Users, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Check, 
  X, 
  Building, 
  Truck, 
  Info,
  CalendarDays,
  Sparkles,
  ArrowRightLeft,
  ChevronDown,
  Activity,
  ArrowRight,
  Phone,
  PhoneCall,
  UserCheck,
  UserX,
  ShieldCheck,
  Star,
  Download,
  User,
  CheckCircle,
  XCircle,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';

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

export const CITY_ZONES_HUBS: Record<string, { zones: string[]; hubs: string[] }> = {
  Bhopal: {
    zones: ['Arera Colony', 'MP Nagar', 'Indrapuri', 'Kolar Road', 'TT Nagar', 'Ayodhya Bypass'],
    hubs: ['MP Nagar Hub', 'Gulmohar Hub', 'Ayodhya Bypass Hub', 'Kolar Hub']
  },
  Biaora: {
    zones: ['Main Market', 'Station Road', 'Multanpura', 'Guna Road', 'Rajgarh Highway'],
    hubs: ['Biaora Main Hub', 'Station Road Hub']
  },
  Narsinghgarh: {
    zones: ['Fort Area', 'Bada Bazaar', 'Talen Road', 'Bhopal Naka', 'Jal Mandir Zone'],
    hubs: ['Narsinghgarh Center Hub', 'Bhopal Naka Hub']
  },
  Tindoniya: {
    zones: ['Central Tindoniya', 'Main Road Zone', 'Gramin Sector'],
    hubs: ['Tindoniya Main Hub']
  },
  Kurawar: {
    zones: ['Kurawar Mandi', 'Narsinghgarh Road', 'Bhopal Highway', 'Bus Stand Area'],
    hubs: ['Kurawar Central Hub']
  },
  Sehore: {
    zones: ['Englishpura', 'Chanakyapuri', 'Bada Bazaar', 'Crescent Park Area', 'Indore Naka'],
    hubs: ['Sehore City Center Hub', 'Indore Naka Hub']
  },
  Indore: {
    zones: ['Vijay Nagar', 'Palasia', 'Rajendra Nagar', 'Bhanwarkuan', 'Sukhliya', 'Anand Bazar'],
    hubs: ['Vijay Nagar Hub', 'Palasia Hub', 'Bhanwarkuan Hub']
  },
  Jabalpur: {
    zones: ['Civil Lines', 'Wright Town', 'Vijay Nagar', 'Madan Mahal', 'Adhartal'],
    hubs: ['Civil Lines Hub', 'Madan Mahal Hub']
  },
  Gwalior: {
    zones: ['Lashkar', 'Morar', 'Deen Dayal Nagar', 'City Center', 'Thatipur'],
    hubs: ['City Center Hub', 'Morar Hub']
  },
  Mumbai: {
    zones: ['Andheri West', 'Bandra West', 'Colaba', 'Borivali West', 'Powai', 'Thane West'],
    hubs: ['Andheri Hub', 'Bandra Hub', 'Thane Hub', 'Powai Hub']
  },
  Delhi: {
    zones: ['Connaught Place', 'South Ext', 'Dwarka', 'Rohini', 'Karol Bagh', 'Noida Sec-62'],
    hubs: ['CP Hub', 'Dwarka Hub', 'Noida Hub']
  },
  Bengaluru: {
    zones: ['Koramangala', 'HSR Layout', 'Indiranagar', 'Whitefield', 'Jayanagar', 'Electronic City'],
    hubs: ['Koramangala Hub', 'Whitefield Hub', 'HSR Hub']
  }
};

export default function GigManagementView() {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [bookings, setBookings] = useState<GigBooking[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [firestoreZones, setFirestoreZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  // Roster Modal States
  const [selectedGigForRoster, setSelectedGigForRoster] = useState<Gig | null>(null);
  const [showGlobalRosterModal, setShowGlobalRosterModal] = useState(false);
  const [rosterTab, setRosterTab] = useState<'all' | 'booked' | 'waiting' | 'checked_in' | 'completed' | 'cancelled'>('all');
  const [rosterSearch, setRosterSearch] = useState('');
  const [globalRosterCity, setGlobalRosterCity] = useState('All');
  const [globalRosterStatus, setGlobalRosterStatus] = useState('All');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('All');
  const [selectedZone, setSelectedZone] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Reset selectedZone filter when selectedCity changes if the zone is not in that city
  useEffect(() => {
    if (selectedCity !== 'All') {
      const zonesInCity = new Set(gigs.filter(g => g.city === selectedCity).map(g => g.zone));
      if (selectedZone !== 'All' && !zonesInCity.has(selectedZone)) {
        setSelectedZone('All');
      }
    }
  }, [selectedCity, gigs, selectedZone]);

  // Modal / Form States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGig, setEditingGig] = useState<Gig | null>(null);
  const [deletingGig, setDeletingGig] = useState<Gig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Form Fields State
  const [formData, setFormData] = useState({
    name: '',
    city: getActiveCity().name,
    zone: 'Arera Colony',
    hub: 'MP Nagar Hub',
    date: new Date().toISOString().split('T')[0],
    startTime: '08:00',
    endTime: '12:00',
    vehicleType: '2-Wheeler (Petrol/EV)',
    maxRiders: 15,
    waitingListMax: 5,
    basePay: 150,
    perOrderPay: 30,
    surgeBonus: 20,
    rainBonus: 0,
    festivalBonus: 0,
    nightBonus: 0,
    attendanceBonus: 50,
    incentives: 0,
    cancellationRules: 'Must cancel at least 4 hours before startup time to avoid penalties.',
    penaltyRules: 'No-show will incur a Rs. 100 penalty deduction.',
    visibilityRules: 'public' as 'public' | 'hidden'
  });

  // Load gigs, bookings, and riders in real-time
  useEffect(() => {
    const unsubGigs = onSnapshot(
      query(collection(db, 'gigs'), orderBy('date', 'asc')),
      (snapshot) => {
        const list: Gig[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Gig);
        });
        setGigs(list);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.GET, 'gigs');
      }
    );

    const unsubBookings = onSnapshot(
      collection(db, 'gig_bookings'),
      (snapshot) => {
        const list: GigBooking[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as GigBooking);
        });
        setBookings(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'gig_bookings');
      }
    );

    const unsubRiders = onSnapshot(
      collection(db, 'riders'),
      (snapshot) => {
        const list: Rider[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Rider);
        });
        setRiders(list);
      },
      (error) => {
        console.warn('Could not load riders list for admin gig panel:', error);
      }
    );

    const unsubZones = onSnapshot(
      collection(db, 'workZones'),
      (snapshot) => {
        const list: Zone[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const name = data.zoneName || data.name || 'Unnamed Zone';
          list.push({ 
            id: doc.id, 
            zoneId: doc.id,
            name,
            zoneName: name,
            cityId: data.cityId || 'bhopal',
            cityName: data.cityName || 'Bhopal',
            radius: data.radius ?? 5,
            minOrderAmount: data.minOrderAmount ?? 100,
            maxDistance: data.maxDistance ?? 10,
            areaCharges: data.areaCharges ?? 25,
            active: data.active !== false,
            status: data.status || 'active',
            center: data.center || { lat: data.centerLat || 23.25, lng: data.centerLng || 77.4124 },
            centerLat: data.centerLat || 23.25,
            centerLng: data.centerLng || 77.4124,
            polygon: data.polygon || [],
            capacity: data.capacity || 15
          } as Zone);
        });
        setFirestoreZones(list);
      },
      (error) => {
        console.warn('Could not load workZones list for admin gig panel:', error);
      }
    );

    return () => {
      unsubGigs();
      unsubBookings();
      unsubRiders();
      unsubZones();
    };
  }, []);

  // Action handler: Update rider booking status (Check-In, Complete, No-Show, Cancel)
  const handleUpdateBookingStatus = async (
    bookingId: string | undefined, 
    gigId: string, 
    riderId: string, 
    newStatus: 'booked' | 'checked_in' | 'completed' | 'cancelled' | 'missed'
  ) => {
    try {
      // 1. Update gig_bookings if document exists
      if (bookingId) {
        const updatePayload: any = { bookingStatus: newStatus };
        if (newStatus === 'checked_in') updatePayload.checkedInAt = new Date().toISOString();
        if (newStatus === 'completed') updatePayload.completedAt = new Date().toISOString();
        if (newStatus === 'cancelled') updatePayload.cancelledAt = new Date().toISOString();

        await updateDoc(doc(db, 'gig_bookings', bookingId), updatePayload);
      }

      // 2. Update gig document arrays
      const targetGig = gigs.find(g => g.id === gigId);
      if (targetGig) {
        let updatedCheckedIn = targetGig.checkedInRiderIds || [];
        let updatedCompleted = targetGig.completedRiderIds || [];
        let updatedMissed = targetGig.missedRiderIds || [];
        let updatedCancelled = targetGig.cancelledRiderIds || [];
        let updatedBooked = targetGig.bookedRiderIds || [];

        if (newStatus === 'checked_in') {
          if (!updatedCheckedIn.includes(riderId)) updatedCheckedIn = [...updatedCheckedIn, riderId];
        } else if (newStatus === 'completed') {
          if (!updatedCompleted.includes(riderId)) updatedCompleted = [...updatedCompleted, riderId];
        } else if (newStatus === 'missed') {
          if (!updatedMissed.includes(riderId)) updatedMissed = [...updatedMissed, riderId];
        } else if (newStatus === 'cancelled') {
          updatedBooked = updatedBooked.filter(id => id !== riderId);
          if (!updatedCancelled.includes(riderId)) updatedCancelled = [...updatedCancelled, riderId];
        }

        await updateDoc(doc(db, 'gigs', gigId), {
          bookedRiderIds: updatedBooked,
          checkedInRiderIds: updatedCheckedIn,
          completedRiderIds: updatedCompleted,
          missedRiderIds: updatedMissed,
          cancelledRiderIds: updatedCancelled,
          status: updatedBooked.length >= targetGig.maxRiders ? 'full' : 'open'
        });
      }

      // 3. Sync Rider Document Active Gig state
      try {
        const riderRef = doc(db, 'riders', riderId);
        const riderSnap = await getDoc(riderRef);
        if (riderSnap.exists()) {
          const isFinished = newStatus === 'completed' || newStatus === 'cancelled';
          await updateDoc(riderRef, {
            activeGigStatus: newStatus,
            ...(isFinished ? { activeGigId: '', activeGigName: '' } : { activeGigId: gigId, activeGigName: targetGig?.name || 'Active Shift' })
          });
        }
      } catch (rErr) {
        console.warn("Could not sync rider doc active state:", rErr);
      }

      // 4. Send Notification to Rider
      await addDoc(collection(db, 'gig_notifications'), {
        title: `Gig Status Update: ${newStatus.toUpperCase().replace('_', ' ')} 📋`,
        message: `Admin has updated your booking status for gig shift to: ${newStatus.replace('_', ' ')}.`,
        type: 'status_update',
        riderId: riderId,
        gigId: gigId,
        createdAt: new Date().toISOString(),
        status: 'unread',
        recipient: 'rider'
      });

      showToast(`Rider booking status updated to ${newStatus.replace('_', ' ')}`);
    } catch (err) {
      console.error("Error updating booking status:", err);
      showToast("Error updating booking status.");
    }
  };

  // Action handler: Promote waiting list rider to booked slot
  const handlePromoteWaitingRider = async (gig: Gig, riderId: string, bookingId?: string) => {
    try {
      const currentBooked = gig.bookedRiderIds || [];
      const currentWaiting = gig.waitingListRiderIds || [];

      if (currentBooked.length >= gig.maxRiders) {
        showToast("Cannot promote rider: Maximum capacity reached for this slot.");
        return;
      }

      const updatedWaiting = currentWaiting.filter(id => id !== riderId);
      const updatedBooked = [...currentBooked, riderId];

      await updateDoc(doc(db, 'gigs', gig.id), {
        bookedRiderIds: updatedBooked,
        waitingListRiderIds: updatedWaiting,
        status: updatedBooked.length >= gig.maxRiders ? 'full' : gig.status
      });

      if (bookingId) {
        await updateDoc(doc(db, 'gig_bookings', bookingId), {
          bookingStatus: 'booked',
          bookedAt: new Date().toISOString()
        });
      }

      await addDoc(collection(db, 'gig_notifications'), {
        title: "Promoted from Waiting List! 🎉",
        message: `Great news! You have been promoted to a booked slot for ${gig.name}.`,
        type: 'promotion',
        riderId: riderId,
        gigId: gig.id,
        createdAt: new Date().toISOString(),
        status: 'unread',
        recipient: 'rider'
      });

      showToast("Rider promoted to booked slot!");
    } catch (err) {
      console.error("Error promoting waiting rider:", err);
      showToast("Failed to promote rider.");
    }
  };

  // Auto-Sync / Repair Missing Booking Documents
  const handleAutoSyncMissingBookings = async (gig: Gig) => {
    try {
      let createdCount = 0;
      const allRiderIds = Array.from(new Set([...(gig.bookedRiderIds || []), ...(gig.waitingListRiderIds || [])]));

      for (const rId of allRiderIds) {
        const existingDoc = bookings.find(b => b.gigId === gig.id && b.riderId === rId);
        if (!existingDoc) {
          const riderInfo = riders.find(r => r.id === rId);
          const isWaiting = gig.waitingListRiderIds?.includes(rId);
          const genBookingId = `TTR-GIG-${Math.floor(100000 + Math.random() * 900000)}`;

          const newBookingRecord: Partial<GigBooking> = {
            gigId: gig.id,
            riderId: rId,
            riderName: riderInfo?.name || `Rider #${rId.substring(0,6)}`,
            riderPhone: riderInfo?.phone || '',
            riderVehicle: (riderInfo as any)?.vehicleType || (riderInfo as any)?.vehicle || gig.vehicleType,
            bookingStatus: isWaiting ? 'pending' : 'booked',
            bookingId: genBookingId,
            reportingTime: gig.startTime,
            hubAddress: `${gig.hub}, ${gig.zone}, ${gig.city}`,
            bookedAt: new Date().toISOString()
          };

          await addDoc(collection(db, 'gig_bookings'), newBookingRecord);
          createdCount++;
        }
      }

      if (createdCount > 0) {
        showToast(`Auto-synced ${createdCount} missing booking records!`);
      } else {
        showToast("All booking records are already in sync!");
      }
    } catch (err) {
      console.error("Auto sync error:", err);
      showToast("Error syncing booking records.");
    }
  };

  // Pre-populate Form for Editing
  const openEditModal = (gig: Gig) => {
    setEditingGig(gig);
    setFormData({
      name: gig.name,
      city: gig.city,
      zone: gig.zone,
      hub: gig.hub,
      date: gig.date,
      startTime: gig.startTime,
      endTime: gig.endTime,
      vehicleType: gig.vehicleType,
      maxRiders: gig.maxRiders,
      waitingListMax: gig.waitingListMax,
      basePay: gig.basePay,
      perOrderPay: gig.perOrderPay,
      surgeBonus: gig.surgeBonus,
      rainBonus: gig.rainBonus,
      festivalBonus: gig.festivalBonus,
      nightBonus: gig.nightBonus,
      attendanceBonus: gig.attendanceBonus,
      incentives: gig.incentives,
      cancellationRules: gig.cancellationRules,
      penaltyRules: gig.penaltyRules,
      visibilityRules: gig.visibilityRules
    });
    setShowAddModal(true);
  };

  // Form Reset
  const resetForm = () => {
    setEditingGig(null);
    setFormData({
      name: '',
      city: getActiveCity().name,
      zone: 'Arera Colony',
      hub: 'MP Nagar Hub',
      date: new Date().toISOString().split('T')[0],
      startTime: '08:00',
      endTime: '12:00',
      vehicleType: '2-Wheeler (Petrol/EV)',
      maxRiders: 15,
      waitingListMax: 5,
      basePay: 150,
      perOrderPay: 30,
      surgeBonus: 20,
      rainBonus: 0,
      festivalBonus: 0,
      nightBonus: 0,
      attendanceBonus: 50,
      incentives: 0,
      cancellationRules: 'Must cancel at least 4 hours before startup time to avoid penalties.',
      penaltyRules: 'No-show will incur a Rs. 100 penalty deduction.',
      visibilityRules: 'public'
    });
  };

  // Handle Dynamic City & Related Zones Change
  const handleCityChange = (city: string) => {
    const data = CITY_ZONES_HUBS[city];
    if (data) {
      setFormData(prev => ({
        ...prev,
        city,
        zone: data.zones[0] || '',
        hub: data.hubs[0] || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        city,
        zone: '',
        hub: ''
      }));
    }
  };

  // Create or Update Gig
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const gigData = {
        ...formData,
        maxRiders: Number(formData.maxRiders),
        waitingListMax: Number(formData.waitingListMax),
        basePay: Number(formData.basePay),
        perOrderPay: Number(formData.perOrderPay),
        surgeBonus: Number(formData.surgeBonus),
        rainBonus: Number(formData.rainBonus),
        festivalBonus: Number(formData.festivalBonus),
        nightBonus: Number(formData.nightBonus),
        attendanceBonus: Number(formData.attendanceBonus),
        incentives: Number(formData.incentives),
        status: 'open',
        bookedRiderIds: editingGig ? editingGig.bookedRiderIds : [],
        waitingListRiderIds: editingGig ? editingGig.waitingListRiderIds : [],
        checkedInRiderIds: editingGig ? editingGig.checkedInRiderIds : [],
        onlineRiderIds: editingGig ? editingGig.onlineRiderIds : [],
        completedRiderIds: editingGig ? editingGig.completedRiderIds : [],
        cancelledRiderIds: editingGig ? editingGig.cancelledRiderIds : [],
        missedRiderIds: editingGig ? editingGig.missedRiderIds : [],
        createdAt: editingGig ? editingGig.createdAt : new Date().toISOString()
      };

      if (editingGig) {
        await updateDoc(doc(db, 'gigs', editingGig.id), gigData);
        showToast("Gig updated successfully!");
      } else {
        await addDoc(collection(db, 'gigs'), gigData);
        showToast("New Gig created and published!");
      }
      setShowAddModal(false);
      resetForm();
    } catch (err: any) {
      handleFirestoreError(err, editingGig ? OperationType.UPDATE : OperationType.CREATE, 'gigs');
    }
  };

  // Open Delete Confirmation
  const promptDelete = (gig: Gig) => {
    setDeletingGig(gig);
  };

  // Execute Delete
  const confirmDelete = async () => {
    if (!deletingGig) return;
    try {
      setIsDeleting(true);
      const gigIdToDelete = deletingGig.id;
      await deleteDoc(doc(db, 'gigs', gigIdToDelete));
      
      // Also cancel related bookings in background
      const relatedBookings = bookings.filter(b => b.gigId === gigIdToDelete);
      for (const b of relatedBookings) {
        await deleteDoc(doc(db, 'gig_bookings', b.id));
      }
      setDeletingGig(null);
      showToast("Gig slot permanently deleted.");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, 'gigs');
    } finally {
      setIsDeleting(false);
    }
  };

  // Lock / Unlock Gig
  const toggleLock = async (gig: Gig) => {
    const newStatus = gig.status === 'locked' ? 'open' : 'locked';
    try {
      await updateDoc(doc(db, 'gigs', gig.id), { status: newStatus });
      showToast(newStatus === 'locked' ? "Gig locked." : "Gig unlocked.");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `gigs/${gig.id}`);
    }
  };

  // Duplicate Gig
  const duplicateGig = async (gig: Gig) => {
    try {
      const duplicated = {
        ...gig,
        bookedRiderIds: [],
        waitingListRiderIds: [],
        checkedInRiderIds: [],
        onlineRiderIds: [],
        completedRiderIds: [],
        cancelledRiderIds: [],
        missedRiderIds: [],
        status: 'open',
        createdAt: new Date().toISOString(),
        name: `${gig.name} (Copy)`
      };
      delete (duplicated as any).id; // Remove Firestore ID key
      await addDoc(collection(db, 'gigs'), duplicated);
      showToast("Gig slot duplicated!");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'gigs');
    }
  };

  // Copy Next Week Gigs
  const executeCopyNextWeek = async () => {
    if (gigs.length === 0) {
      showToast("No active gigs found to duplicate.");
      setShowCopyModal(false);
      return;
    }
    try {
      setIsCopying(true);
      const batch = writeBatch(db);
      let count = 0;
      
      gigs.forEach(gig => {
        const currentDate = new Date(gig.date);
        if (!isNaN(currentDate.getTime())) {
          const nextWeekDate = new Date(currentDate);
          nextWeekDate.setDate(currentDate.getDate() + 7);
          const formattedDate = nextWeekDate.toISOString().split('T')[0];
          
          const newGigRef = doc(collection(db, 'gigs'));
          const copiedData = {
            ...gig,
            date: formattedDate,
            bookedRiderIds: [],
            waitingListRiderIds: [],
            checkedInRiderIds: [],
            onlineRiderIds: [],
            completedRiderIds: [],
            cancelledRiderIds: [],
            missedRiderIds: [],
            status: 'open',
            createdAt: new Date().toISOString()
          };
          delete (copiedData as any).id;
          batch.set(newGigRef, copiedData);
          count++;
        }
      });

      await batch.commit();
      setShowCopyModal(false);
      showToast(`Duplicated ${count} gigs to next week!`);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'gigs');
    } finally {
      setIsCopying(false);
    }
  };

  // Toggle Visibility
  const toggleVisibility = async (gig: Gig) => {
    const newVisibility = gig.visibilityRules === 'public' ? 'hidden' : 'public';
    try {
      await updateDoc(doc(db, 'gigs', gig.id), { visibilityRules: newVisibility });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `gigs/${gig.id}`);
    }
  };



  // Metrics calculation
  const totalGigs = gigs.length;
  const activeGigs = gigs.filter(g => {
    // A gig is active if its date is today
    const today = new Date().toISOString().split('T')[0];
    return g.date === today && g.status !== 'locked';
  }).length;

  let totalBookedRiders = 0;
  let totalWaitingListRiders = 0;
  let totalCheckedInRiders = 0;
  let totalOnlineRiders = 0;
  let totalCompletedRiders = 0;
  let totalCancelledRiders = 0;
  let totalNoShowRiders = 0;
  let todayEstimatedPayout = 0;

  gigs.forEach(gig => {
    const bookedCount = gig.bookedRiderIds?.length || 0;
    totalBookedRiders += bookedCount;
    totalWaitingListRiders += gig.waitingListRiderIds?.length || 0;
    totalCheckedInRiders += gig.checkedInRiderIds?.length || 0;
    totalOnlineRiders += gig.onlineRiderIds?.length || 0;
    totalCompletedRiders += gig.completedRiderIds?.length || 0;
    totalCancelledRiders += gig.cancelledRiderIds?.length || 0;
    totalNoShowRiders += gig.missedRiderIds?.length || 0;

    // Calculate payouts for completed and booked riders
    const baseCompensation = gig.basePay + gig.attendanceBonus + gig.surgeBonus + gig.rainBonus + gig.festivalBonus + gig.nightBonus + gig.incentives;
    // Assume average 5 orders per shift for projection
    const projectedPerRider = baseCompensation + (gig.perOrderPay * 5);
    
    // Add completed payout
    todayEstimatedPayout += (gig.completedRiderIds?.length || 0) * projectedPerRider;
    // Add booked payout (projection) if the gig is today
    const today = new Date().toISOString().split('T')[0];
    if (gig.date === today) {
      todayEstimatedPayout += bookedCount * projectedPerRider;
    }
  });

  // Unique cities & zones for filters
  const uniqueCities = ['All', ...Array.from(new Set([
    ...gigs.map(g => g.city),
    ...firestoreZones.map(z => z.name)
  ]))];
  const uniqueZones = ['All', ...Array.from(new Set([
    ...firestoreZones.map(z => z.name),
    ...gigs
      .filter(g => selectedCity === 'All' || g.city === selectedCity)
      .map(g => g.zone)
  ]))];

  // Filtering gigs list
  const filteredGigs = gigs.filter(g => {
    const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          g.hub.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          g.zone.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCity = selectedCity === 'All' || g.city === selectedCity;
    const matchesZone = selectedZone === 'All' || g.zone === selectedZone;
    const matchesStatus = selectedStatus === 'All' || g.status === selectedStatus || (selectedStatus === 'public' && g.visibilityRules === 'public') || (selectedStatus === 'hidden' && g.visibilityRules === 'hidden');
    
    return matchesSearch && matchesCity && matchesZone && matchesStatus;
  });

  return (
    <div className="space-y-5 text-slate-100 font-sans p-3.5 sm:p-6 bg-slate-950 min-h-screen">
      {/* Upper Brand / Info Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-slate-900 border border-amber-500/20 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-amber-500 text-slate-950 font-black font-mono text-[10px] px-2 py-0.5 rounded tracking-wider uppercase animate-pulse">Enterprise System</span>
            <span className="text-slate-400 text-xs">Ting Tong India</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">Gig Booking Command Center</h2>
          <p className="text-slate-400 text-xs max-w-xl leading-relaxed">
            Configure rider slots, active zones, incentives, and bonus payouts. Manage waiting lists and monitor real-time attendance end-to-end.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 self-start md:self-center shrink-0 w-full md:w-auto">
          <button
            onClick={() => setShowGlobalRosterModal(true)}
            className="flex-1 md:flex-initial justify-center bg-blue-500/10 hover:bg-blue-500 hover:text-white border border-blue-500/30 text-blue-400 text-xs font-bold px-3.5 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10"
          >
            <Users className="w-4 h-4" />
            <span>Master Roster ({bookings.length})</span>
          </button>
          <button
            onClick={() => setShowCopyModal(true)}
            className="flex-1 md:flex-initial justify-center bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-bold px-3.5 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Copy Next Week</span>
          </button>
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="flex-1 md:flex-initial justify-center bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-3.5 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-4.5 h-4.5" />
            <span>Create Gig Slot</span>
          </button>
        </div>
      </div>

      {/* Admin Live Dashboard Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Gigs */}
        <div className="bg-slate-900 border border-slate-800/60 rounded-3xl p-5 space-y-3 relative overflow-hidden shadow-xl">
          <div className="bg-slate-950 w-10 h-10 rounded-2xl flex items-center justify-center text-amber-500 border border-slate-800">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wide">Total Gigs / Active Today</span>
            <span className="text-2xl font-black font-mono text-slate-100">{totalGigs} <span className="text-xs text-slate-500 font-normal">/ {activeGigs} active</span></span>
          </div>
          <div className="absolute right-4 top-4 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded uppercase font-mono">Live Sync</div>
        </div>

        {/* Bookings & Waiting List */}
        <button
          type="button"
          onClick={() => setShowGlobalRosterModal(true)}
          className="w-full text-left bg-slate-900 border border-slate-800/60 hover:border-blue-500/50 rounded-3xl p-5 space-y-3 relative overflow-hidden shadow-xl transition cursor-pointer group"
        >
          <div className="bg-slate-950 w-10 h-10 rounded-2xl flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white border border-slate-800 transition">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 group-hover:text-blue-400 block uppercase font-bold tracking-wide transition">Booked / Waiting List</span>
            <span className="text-2xl font-black font-mono text-slate-100">{totalBookedRiders} <span className="text-xs text-slate-500 font-normal">/ {totalWaitingListRiders} waiting</span></span>
          </div>
          <div className="absolute right-3 top-3 text-[10px] text-blue-400 font-bold bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">View All Roster →</div>
        </button>

        {/* Checked In / Duty Live */}
        <div className="bg-slate-900 border border-slate-800/60 rounded-3xl p-5 space-y-3 relative overflow-hidden shadow-xl">
          <div className="bg-slate-950 w-10 h-10 rounded-2xl flex items-center justify-center text-emerald-400 border border-slate-800">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wide">Checked-In / Online Duty</span>
            <span className="text-2xl font-black font-mono text-slate-100">{totalCheckedInRiders} <span className="text-xs text-slate-500 font-normal">/ {totalOnlineRiders} online</span></span>
          </div>
        </div>

        {/* Completions & No-Shows */}
        <div className="bg-slate-900 border border-slate-800/60 rounded-3xl p-5 space-y-3 relative overflow-hidden shadow-xl">
          <div className="bg-slate-950 w-10 h-10 rounded-2xl flex items-center justify-center text-teal-400 border border-slate-800">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wide">Completed / No-Show Gigs</span>
            <span className="text-2xl font-black font-mono text-slate-100">{totalCompletedRiders} <span className="text-xs text-rose-500 font-bold">/ {totalNoShowRiders} missed</span></span>
          </div>
        </div>

        {/* Estimated Payout */}
        <div className="bg-slate-900 border border-slate-800/60 rounded-3xl p-5 col-span-2 lg:col-span-1 space-y-3 relative overflow-hidden shadow-xl">
          <div className="bg-slate-950 w-10 h-10 rounded-2xl flex items-center justify-center text-yellow-500 border border-slate-800">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wide">Today's Est. Payout</span>
            <span className="text-2xl font-black font-mono text-emerald-400">₹{todayEstimatedPayout.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Advanced Filter and Search Controls */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search gigs by slot name, hub, delivery zone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 p-3 pl-10 rounded-xl text-xs outline-none transition text-slate-100 placeholder-slate-550"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* City Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs">
            <span className="text-slate-500">City:</span>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-transparent outline-none border-none font-bold text-slate-300 cursor-pointer"
            >
              {uniqueCities.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
            </select>
          </div>

          {/* Zone Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs">
            <span className="text-slate-500">Zone:</span>
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="bg-transparent outline-none border-none font-bold text-slate-300 cursor-pointer max-w-[140px]"
            >
              {uniqueZones.map(z => <option key={z} value={z} className="bg-slate-900">{z}</option>)}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs">
            <span className="text-slate-500">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent outline-none border-none font-bold text-slate-300 cursor-pointer"
            >
              <option value="All" className="bg-slate-900">All Status</option>
              <option value="open" className="bg-slate-900">🟢 Open Slots</option>
              <option value="limited" className="bg-slate-900">🟡 Limited Slots</option>
              <option value="full" className="bg-slate-900">🔴 Full Slots</option>
              <option value="locked" className="bg-slate-900">🔒 Locked</option>
              <option value="public" className="bg-slate-900">👁️ Public Only</option>
              <option value="hidden" className="bg-slate-900">👁️‍🗨️ Hidden Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Gigs List / Layout */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 space-y-3">
          <div className="w-8 h-8 border-t-2 border-r-2 border-amber-500 rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500 font-mono">Syncing enterprise gig states...</span>
        </div>
      ) : filteredGigs.length === 0 ? (
        <div className="bg-slate-900 border border-slate-850 rounded-3xl p-16 text-center space-y-4">
          <CalendarDays className="w-12 h-12 text-slate-700 mx-auto animate-pulse" />
          <h3 className="text-lg font-bold text-slate-300">No Enterprise Gigs Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            There are no gigs matching your filter criteria. Create your first gig slot by clicking "Create Gig Slot".
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => { resetForm(); setShowAddModal(true); }}
              className="bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/20 text-amber-500 text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
            >
              Add Custom Shift
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGigs.map(gig => {
            const bookedCount = gig.bookedRiderIds?.length || 0;
            const waitingCount = gig.waitingListRiderIds?.length || 0;
            const remainingSlots = Math.max(0, gig.maxRiders - bookedCount);
            
            // Dynamic status styling
            let statusBadge = (
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                🟢 Open
              </span>
            );
            if (gig.status === 'locked') {
              statusBadge = (
                <span className="bg-slate-800 text-slate-400 border border-slate-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-mono flex items-center gap-1">
                  🔒 Locked
                </span>
              );
            } else if (remainingSlots === 0) {
              statusBadge = (
                <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-mono flex items-center gap-1">
                  🔴 Full
                </span>
              );
            } else if (remainingSlots <= 3) {
              statusBadge = (
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-mono flex items-center gap-1">
                  🟡 Limited
                </span>
              );
            }

            return (
              <div 
                key={gig.id} 
                className={`bg-slate-900 border rounded-3xl overflow-hidden shadow-2xl hover:scale-[1.01] transition-all flex flex-col justify-between ${
                  gig.status === 'locked' ? 'border-slate-800/80 opacity-70' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Card Header Area */}
                <div className="p-5 border-b border-slate-850 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] text-slate-500 font-mono uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                      ID: #{gig.id.substring(0,6).toUpperCase()}
                    </span>
                    <div className="flex items-center gap-2">
                      {gig.visibilityRules === 'hidden' && (
                        <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1" title="Hidden from Riders">
                          <EyeOff className="w-3 h-3" /> Hidden
                        </span>
                      )}
                      {statusBadge}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-slate-100 tracking-tight leading-snug line-clamp-2">{gig.name}</h3>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>{gig.city} • {gig.zone} ({gig.hub})</span>
                    </div>
                  </div>
                </div>

                {/* Slot Details Area */}
                <div className="p-5 space-y-4 flex-1">
                  {/* Timing & Vehicle requirements */}
                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-3 rounded-2xl border border-slate-850">
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wide">Schedule Date</span>
                      <span className="font-bold font-mono text-slate-300 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {new Date(gig.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wide">Shift Hours</span>
                      <span className="font-bold font-mono text-slate-300 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {gig.startTime} - {gig.endTime}
                      </span>
                    </div>
                    <div className="space-y-0.5 col-span-2 pt-1 border-t border-slate-900">
                      <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wide">Vehicle Allowed</span>
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-amber-500" />
                        {gig.vehicleType}
                      </span>
                    </div>
                  </div>

                  {/* Compensation & Bonuses */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">Payout breakdown</span>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-xl border border-slate-850/60">
                        <span className="text-slate-450">Base Pay:</span>
                        <span className="font-bold text-slate-200">₹{gig.basePay}</span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-xl border border-slate-850/60">
                        <span className="text-slate-450">Per Order:</span>
                        <span className="font-bold text-amber-400">₹{gig.perOrderPay}</span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-xl border border-slate-850/60">
                        <span className="text-slate-450">Surge Bonus:</span>
                        <span className="font-bold text-emerald-400">₹{gig.surgeBonus}</span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-xl border border-slate-850/60">
                        <span className="text-slate-450">Rain Bonus:</span>
                        <span className="font-bold text-blue-400">₹{gig.rainBonus}</span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-xl border border-slate-850/60 col-span-2">
                        <span className="text-slate-450">Attendance / Incentives:</span>
                        <span className="font-bold text-yellow-500">₹{gig.attendanceBonus} / ₹{gig.incentives}</span>
                      </div>
                    </div>
                  </div>

                  {/* Slots tracker */}
                  <button
                    type="button"
                    onClick={() => { setSelectedGigForRoster(gig); setRosterTab('all'); setRosterSearch(''); }}
                    className="w-full text-left space-y-1.5 bg-slate-950/80 hover:bg-slate-950 p-3 rounded-2xl border border-slate-850 hover:border-amber-500/50 transition cursor-pointer group"
                  >
                    <div className="flex justify-between font-bold text-xs">
                      <span className="text-slate-400 group-hover:text-amber-400 flex items-center gap-1.5 transition">
                        <Users className="w-3.5 h-3.5 text-amber-500" />
                        Booked Slots:
                      </span>
                      <span className="font-mono text-slate-200">{bookedCount} / {gig.maxRiders} <span className="text-slate-500 text-[10px] font-normal">({remainingSlots} left)</span></span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          remainingSlots === 0 ? 'bg-rose-500' : remainingSlots <= 3 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, (bookedCount / gig.maxRiders) * 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-amber-500 font-bold pt-1 border-t border-slate-900/80">
                      <span>View Booked Riders & Attendance →</span>
                      {waitingCount > 0 && <span className="text-blue-400 font-mono">{waitingCount} waiting</span>}
                    </div>
                  </button>
                </div>

                {/* Card Actions Segment */}
                <div className="p-5 border-t border-slate-850 bg-slate-950/20 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { setSelectedGigForRoster(gig); setRosterTab('all'); setRosterSearch(''); }}
                      className="bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-slate-950 border border-amber-500/30 font-bold px-3 py-2 rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                      title="View Booked Riders & Attendance"
                    >
                      <Users className="w-4 h-4" />
                      <span>Roster ({bookedCount})</span>
                    </button>
                    <button
                      onClick={() => openEditModal(gig)}
                      className="bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 p-2.5 rounded-xl transition cursor-pointer"
                      title="Edit Gig Slot"
                    >
                      <Plus className="w-4 h-4 rotate-45 text-slate-400" />
                    </button>
                    <button
                      onClick={() => duplicateGig(gig)}
                      className="bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 p-2.5 rounded-xl transition cursor-pointer"
                      title="Duplicate Gig"
                    >
                      <Copy className="w-4 h-4 text-slate-400" />
                    </button>
                    <button
                      onClick={() => toggleLock(gig)}
                      className={`p-2.5 rounded-xl border transition cursor-pointer ${
                        gig.status === 'locked' 
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20' 
                          : 'bg-slate-950 hover:bg-slate-850 text-slate-300 border-slate-800'
                      }`}
                      title={gig.status === 'locked' ? "Unlock Gig" : "Lock Gig"}
                    >
                      {gig.status === 'locked' ? <Unlock className="w-4 h-4 text-rose-400" /> : <Lock className="w-4 h-4 text-slate-400" />}
                    </button>
                    <button
                      onClick={() => toggleVisibility(gig)}
                      className={`p-2.5 rounded-xl border transition cursor-pointer ${
                        gig.visibilityRules === 'hidden'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20' 
                          : 'bg-slate-950 hover:bg-slate-850 text-slate-300 border-slate-800'
                      }`}
                      title={gig.visibilityRules === 'hidden' ? "Make Public" : "Hide from Riders"}
                    >
                      {gig.visibilityRules === 'hidden' ? <Eye className="w-4 h-4 text-amber-500" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                    </button>
                  </div>
                  
                  <button
                    onClick={() => promptDelete(gig)}
                    className="bg-slate-950 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/10 p-2.5 rounded-xl transition cursor-pointer"
                    title="Permanently Delete Gig"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SINGLE GIG BOOKINGS & ATTENDANCE ROSTER MODAL */}
      {selectedGigForRoster && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl my-auto animate-fade-in">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl border border-amber-500/20 shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold text-slate-100">{selectedGigForRoster.name}</h3>
                    <span className="bg-slate-850 text-slate-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-slate-800">
                      {selectedGigForRoster.city} • {selectedGigForRoster.zone}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Hub: <span className="text-amber-400 font-semibold">{selectedGigForRoster.hub}</span> | Date: {selectedGigForRoster.date} ({selectedGigForRoster.startTime} - {selectedGigForRoster.endTime})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleAutoSyncMissingBookings(selectedGigForRoster)}
                  className="hidden sm:flex items-center gap-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold px-3 py-2 rounded-xl border border-slate-750 transition cursor-pointer"
                  title="Repair & Sync Missing Booking Docs"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Auto-Sync</span>
                </button>
                <button
                  onClick={() => setSelectedGigForRoster(null)}
                  className="bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 p-2.5 rounded-xl border border-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="bg-slate-950/40 p-3 sm:p-4 border-b border-slate-850/80 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs font-mono shrink-0">
              <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Max Capacity</span>
                <span className="font-bold text-slate-200 text-sm">{selectedGigForRoster.maxRiders} Slots</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Booked Riders</span>
                <span className="font-bold text-amber-400 text-sm">{(selectedGigForRoster.bookedRiderIds || []).length} Booked</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Checked In</span>
                <span className="font-bold text-emerald-400 text-sm">{(selectedGigForRoster.checkedInRiderIds || []).length} Checked</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Completed</span>
                <span className="font-bold text-teal-400 text-sm">{(selectedGigForRoster.completedRiderIds || []).length} Done</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-850 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">Waiting List</span>
                <span className="font-bold text-blue-400 text-sm">{(selectedGigForRoster.waitingListRiderIds || []).length} Waiting</span>
              </div>
            </div>

            {/* Filters & Search */}
            <div className="p-4 border-b border-slate-850 bg-slate-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
                {(['all', 'booked', 'waiting', 'checked_in', 'completed', 'cancelled'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setRosterTab(tab)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer capitalize ${
                      rosterTab === tab
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-slate-950 hover:bg-slate-850 text-slate-400 border border-slate-850'
                    }`}
                  >
                    {tab.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <div className="relative shrink-0 sm:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by rider name, phone, booking ID..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 pl-9 pr-3 py-1.5 rounded-xl text-xs outline-none text-slate-200 placeholder-slate-550"
                />
              </div>
            </div>

            {/* Roster Rider List Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1">
              {(() => {
                // Combine all rider IDs associated with this gig
                const gigBookingsList = bookings.filter(b => b.gigId === selectedGigForRoster.id);
                const bookedIds = selectedGigForRoster.bookedRiderIds || [];
                const waitingIds = selectedGigForRoster.waitingListRiderIds || [];
                const checkedInIds = selectedGigForRoster.checkedInRiderIds || [];
                const completedIds = selectedGigForRoster.completedRiderIds || [];
                const cancelledIds = selectedGigForRoster.cancelledRiderIds || [];
                const missedIds = selectedGigForRoster.missedRiderIds || [];

                const allAssociatedRiderIds = Array.from(new Set([
                  ...bookedIds,
                  ...waitingIds,
                  ...checkedInIds,
                  ...completedIds,
                  ...cancelledIds,
                  ...missedIds,
                  ...gigBookingsList.map(b => b.riderId)
                ]));

                if (allAssociatedRiderIds.length === 0) {
                  return (
                    <div className="p-12 text-center space-y-3 bg-slate-950/40 rounded-2xl border border-slate-850">
                      <Users className="w-10 h-10 text-slate-700 mx-auto" />
                      <p className="text-slate-300 font-bold text-sm">No Riders Booked Yet</p>
                      <p className="text-slate-500 text-xs max-w-xs mx-auto">
                        This shift currently has 0 bookings. When riders book this gig shift from their app, their complete details and attendance actions will appear here in real-time.
                      </p>
                    </div>
                  );
                }

                // Map rider details
                const combinedItems = allAssociatedRiderIds.map(riderId => {
                  const bookingDoc = gigBookingsList.find(b => b.riderId === riderId);
                  const riderProfile = riders.find(r => r.id === riderId);

                  const isWaiting = waitingIds.includes(riderId) || bookingDoc?.bookingStatus === 'pending';
                  const isCheckedIn = checkedInIds.includes(riderId) || bookingDoc?.bookingStatus === 'checked_in';
                  const isCompleted = completedIds.includes(riderId) || bookingDoc?.bookingStatus === 'completed';
                  const isMissed = missedIds.includes(riderId) || bookingDoc?.bookingStatus === 'missed';
                  const isCancelled = cancelledIds.includes(riderId) || bookingDoc?.bookingStatus === 'cancelled';

                  let calculatedStatus: 'booked' | 'waiting' | 'checked_in' | 'completed' | 'missed' | 'cancelled' = 'booked';
                  if (isCompleted) calculatedStatus = 'completed';
                  else if (isCheckedIn) calculatedStatus = 'checked_in';
                  else if (isMissed) calculatedStatus = 'missed';
                  else if (isCancelled) calculatedStatus = 'cancelled';
                  else if (isWaiting) calculatedStatus = 'waiting';

                  return {
                    riderId,
                    bookingDoc,
                    riderProfile,
                    status: calculatedStatus,
                    name: bookingDoc?.riderName || riderProfile?.name || `Rider #${riderId.substring(0,6)}`,
                    phone: bookingDoc?.riderPhone || riderProfile?.phone || 'N/A',
                    bookingId: bookingDoc?.bookingId || `TTR-GIG-${riderId.substring(0,6).toUpperCase()}`,
                    vehicle: bookingDoc?.riderVehicle || (riderProfile as any)?.vehicleType || (riderProfile as any)?.vehicle || selectedGigForRoster.vehicleType,
                    reportingTime: bookingDoc?.reportingTime || selectedGigForRoster.startTime,
                    hubAddress: bookingDoc?.hubAddress || `${selectedGigForRoster.hub}, ${selectedGigForRoster.zone}`,
                    bookedAt: bookingDoc?.bookedAt ? new Date(bookingDoc.bookedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Active'
                  };
                });

                // Apply roster filters
                const filteredItems = combinedItems.filter(item => {
                  if (rosterTab === 'booked' && item.status !== 'booked') return false;
                  if (rosterTab === 'waiting' && item.status !== 'waiting') return false;
                  if (rosterTab === 'checked_in' && item.status !== 'checked_in') return false;
                  if (rosterTab === 'completed' && item.status !== 'completed') return false;
                  if (rosterTab === 'cancelled' && item.status !== 'cancelled' && item.status !== 'missed') return false;

                  if (rosterSearch.trim()) {
                    const q = rosterSearch.toLowerCase();
                    const matchName = item.name.toLowerCase().includes(q);
                    const matchPhone = item.phone.toLowerCase().includes(q);
                    const matchBookingId = item.bookingId.toLowerCase().includes(q);
                    const matchRiderId = item.riderId.toLowerCase().includes(q);
                    return matchName || matchPhone || matchBookingId || matchRiderId;
                  }

                  return true;
                });

                if (filteredItems.length === 0) {
                  return (
                    <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/40 rounded-2xl border border-slate-850">
                      No riders found matching "{rosterSearch}" under filter "{rosterTab}".
                    </div>
                  );
                }

                return filteredItems.map((item, idx) => (
                  <div key={item.riderId + idx} className="bg-slate-950/80 border border-slate-850 hover:border-slate-800 p-4 rounded-2xl transition space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center font-bold text-amber-500 shrink-0">
                          {item.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-100 text-sm">{item.name}</span>
                            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md font-semibold">
                              #{item.bookingId}
                            </span>
                            {/* Status Pill */}
                            {item.status === 'completed' && (
                              <span className="bg-teal-500/10 text-teal-400 border border-teal-500/20 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                ✅ Completed
                              </span>
                            )}
                            {item.status === 'checked_in' && (
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                🟢 Checked In
                              </span>
                            )}
                            {item.status === 'booked' && (
                              <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                🏍️ Booked
                              </span>
                            )}
                            {item.status === 'waiting' && (
                              <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                ⏳ Waiting List
                              </span>
                            )}
                            {(item.status === 'cancelled' || item.status === 'missed') && (
                              <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                ❌ {item.status === 'missed' ? 'No-Show' : 'Cancelled'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap font-mono">
                            {item.phone && item.phone !== 'N/A' && (
                              <a
                                href={`tel:${item.phone}`}
                                className="flex items-center gap-1 text-slate-300 hover:text-amber-400 transition"
                              >
                                <Phone className="w-3 h-3 text-amber-500" />
                                <span>{item.phone}</span>
                              </a>
                            )}
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-400">Vehicle: <strong className="text-slate-300 font-sans">{item.vehicle}</strong></span>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-500">Booked: {item.bookedAt}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons for admin */}
                      <div className="flex items-center gap-2 flex-wrap shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-900">
                        {item.status === 'waiting' ? (
                          <button
                            onClick={() => handlePromoteWaitingRider(selectedGigForRoster, item.riderId, item.bookingDoc?.id)}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Promote to Booked</span>
                          </button>
                        ) : (
                          <>
                            {item.status !== 'checked_in' && item.status !== 'completed' && (
                              <button
                                onClick={() => handleUpdateBookingStatus(item.bookingDoc?.id, selectedGigForRoster.id, item.riderId, 'checked_in')}
                                className="bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer"
                                title="Mark Rider Checked In at Hub"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Check-In</span>
                              </button>
                            )}

                            {item.status !== 'completed' && (
                              <button
                                onClick={() => handleUpdateBookingStatus(item.bookingDoc?.id, selectedGigForRoster.id, item.riderId, 'completed')}
                                className="bg-teal-500/10 hover:bg-teal-500 hover:text-slate-950 text-teal-400 border border-teal-500/30 text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer"
                                title="Mark Shift Completed"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Complete</span>
                              </button>
                            )}

                            {item.status !== 'cancelled' && item.status !== 'missed' && (
                              <button
                                onClick={() => handleUpdateBookingStatus(item.bookingDoc?.id, selectedGigForRoster.id, item.riderId, 'missed')}
                                className="bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 border border-rose-500/30 text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer"
                                title="Mark No-Show / Absent"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                <span>No-Show</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Booking metadata footer */}
                    <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-850/60 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2 font-mono">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-amber-500" />
                        <span>Hub Reporting: <strong className="text-slate-200">{item.hubAddress}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-blue-400" />
                        <span>Reporting Time: <strong className="text-slate-200">{item.reportingTime}</strong></span>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MASTER GLOBAL BOOKINGS ROSTER MODAL */}
      {showGlobalRosterModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl my-auto animate-fade-in">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20 shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-100">All-City Master Rider Booking Roster</h3>
                  <p className="text-slate-400 text-xs">Real-time attendance & gig bookings log across all active shifts ({bookings.length} total records)</p>
                </div>
              </div>

              <button
                onClick={() => setShowGlobalRosterModal(false)}
                className="bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 p-2.5 rounded-xl border border-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter controls */}
            <div className="p-4 border-b border-slate-850 bg-slate-950 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by rider name, phone, booking ID, or gig..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 p-2.5 pl-10 rounded-xl text-xs outline-none text-slate-200 placeholder-slate-500"
                />
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs">
                  <span className="text-slate-500">City:</span>
                  <select
                    value={globalRosterCity}
                    onChange={(e) => setGlobalRosterCity(e.target.value)}
                    className="bg-transparent outline-none border-none font-bold text-slate-300 cursor-pointer"
                  >
                    <option value="All" className="bg-slate-900">All Cities</option>
                    {CITY_ZONES_HUBS && Object.keys(CITY_ZONES_HUBS).map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs">
                  <span className="text-slate-500">Status:</span>
                  <select
                    value={globalRosterStatus}
                    onChange={(e) => setGlobalRosterStatus(e.target.value)}
                    className="bg-transparent outline-none border-none font-bold text-slate-300 cursor-pointer"
                  >
                    <option value="All" className="bg-slate-900">All Statuses</option>
                    <option value="booked" className="bg-slate-900">Booked</option>
                    <option value="pending" className="bg-slate-900">Waiting List</option>
                    <option value="checked_in" className="bg-slate-900">Checked In</option>
                    <option value="completed" className="bg-slate-900">Completed</option>
                    <option value="cancelled" className="bg-slate-900">Cancelled / Missed</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bookings Table / Cards */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1">
              {(() => {
                const filteredBookings = bookings.filter(b => {
                  const matchCity = globalRosterCity === 'All' || b.hubAddress?.includes(globalRosterCity);
                  const matchStatus = globalRosterStatus === 'All' || b.bookingStatus === globalRosterStatus;

                  if (!matchCity || !matchStatus) return false;

                  if (rosterSearch.trim()) {
                    const q = rosterSearch.toLowerCase();
                    const matchName = b.riderName?.toLowerCase().includes(q);
                    const matchPhone = b.riderPhone?.toLowerCase().includes(q);
                    const matchBookingId = b.bookingId?.toLowerCase().includes(q);
                    const matchGigId = b.gigId?.toLowerCase().includes(q);
                    return matchName || matchPhone || matchBookingId || matchGigId;
                  }

                  return true;
                });

                if (filteredBookings.length === 0) {
                  return (
                    <div className="p-12 text-center text-slate-500 text-xs bg-slate-950/40 rounded-2xl border border-slate-850 space-y-2">
                      <Users className="w-10 h-10 text-slate-700 mx-auto" />
                      <p className="text-slate-300 font-bold text-sm">No Booking Records Found</p>
                      <p className="text-slate-500">Try adjusting your search or filter parameters above.</p>
                    </div>
                  );
                }

                return filteredBookings.map((b) => {
                  const matchingGig = gigs.find(g => g.id === b.gigId);

                  return (
                    <div key={b.id} className="bg-slate-950/80 border border-slate-850 hover:border-slate-800 p-4 rounded-2xl transition space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center font-bold text-blue-400 shrink-0">
                            {b.riderName ? b.riderName.charAt(0).toUpperCase() : 'R'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-100 text-sm">{b.riderName}</span>
                              <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md font-semibold">
                                #{b.bookingId}
                              </span>
                              <span className="text-xs text-slate-400 font-semibold">
                                ({matchingGig ? matchingGig.name : 'Gig Shift'})
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap font-mono">
                              {b.riderPhone && (
                                <a href={`tel:${b.riderPhone}`} className="flex items-center gap-1 text-slate-300 hover:text-amber-400 transition">
                                  <Phone className="w-3 h-3 text-amber-500" />
                                  <span>{b.riderPhone}</span>
                                </a>
                              )}
                              <span className="text-slate-600">•</span>
                              <span className="text-slate-400">Reporting: <strong className="text-slate-200">{b.reportingTime}</strong></span>
                              <span className="text-slate-600">•</span>
                              <span className="text-slate-500">Hub: {b.hubAddress}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-bold px-3 py-1 rounded-xl border capitalize ${
                            b.bookingStatus === 'completed' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
                            b.bookingStatus === 'checked_in' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            b.bookingStatus === 'booked' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            b.bookingStatus === 'pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                            'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {b.bookingStatus?.replace('_', ' ') || 'booked'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT SLIDES / MODAL SCREEN */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl my-auto animate-fade-in">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-slate-850 flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-amber-500" />
                  {editingGig ? "Edit Enterprise Gig Configuration" : "Configure New Enterprise Gig Slot"}
                </h3>
                <p className="text-slate-400 text-xs">Fill in operational timings, pay parameters, and safety limits.</p>
              </div>
              <button 
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-850 p-2 rounded-xl transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gig Slot Name</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Morning Peak Breakfast Rush, Midnight Cravings Slot"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 p-3 rounded-xl text-xs outline-none transition text-slate-100"
                  />
                </div>

                {/* City, Zone */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">City</label>
                  <select
                    required
                    value={formData.city}
                    onChange={(e) => handleCityChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 p-3 rounded-xl text-xs outline-none transition text-slate-100 font-bold"
                  >
                    {Object.keys(CITY_ZONES_HUBS).map(c => (
                      <option key={c} value={c} className="bg-slate-900">{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Delivery Zone</label>
                  {(() => {
                    const currentCityData = CITY_ZONES_HUBS[formData.city] || { zones: [], hubs: [] };
                    const fsZoneNames = firestoreZones.map(z => z.name);
                    const combinedZones = Array.from(new Set([...fsZoneNames, ...currentCityData.zones]));
                    const formZones = combinedZones.includes(formData.zone)
                      ? combinedZones
                      : formData.zone ? [formData.zone, ...combinedZones] : combinedZones;

                    return (
                      <select
                        required
                        value={formData.zone}
                        onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 p-3 rounded-xl text-xs outline-none transition text-slate-100 font-bold"
                      >
                        {formZones.map(z => (
                          <option key={z} value={z} className="bg-slate-900">{z}</option>
                        ))}
                      </select>
                    );
                  })()}
                </div>

                {/* Hub, Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reporting Hub</label>
                  {(() => {
                    const currentCityData = CITY_ZONES_HUBS[formData.city] || { zones: [], hubs: [] };
                    const formHubs = currentCityData.hubs.includes(formData.hub)
                      ? currentCityData.hubs
                      : formData.hub ? [formData.hub, ...currentCityData.hubs] : currentCityData.hubs;

                    return (
                      <select
                        required
                        value={formData.hub}
                        onChange={(e) => setFormData({ ...formData, hub: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 p-3 rounded-xl text-xs outline-none transition text-slate-100 font-bold"
                      >
                        {formHubs.map(h => (
                          <option key={h} value={h} className="bg-slate-900">{h}</option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Shift Date</label>
                  <input
                    required
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 p-3 rounded-xl text-xs outline-none transition text-slate-100 font-mono"
                  />
                </div>

                {/* Timings */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Start Time</label>
                  <input
                    required
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 p-3 rounded-xl text-xs outline-none transition text-slate-100 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">End Time</label>
                  <input
                    required
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 p-3 rounded-xl text-xs outline-none transition text-slate-100 font-mono"
                  />
                </div>

                {/* Vehicles allowed & Capacity details */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vehicle Type Requirements</label>
                  <select
                    value={formData.vehicleType}
                    onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 p-3 rounded-xl text-xs outline-none transition text-slate-100 font-bold"
                  >
                    <option value="2-Wheeler (Petrol/EV)">2-Wheeler (Petrol/EV)</option>
                    <option value="3-Wheeler Electric">3-Wheeler Electric</option>
                    <option value="Any Vehicle Type">Any Vehicle Type</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450">Max Riders</label>
                    <input
                      required
                      type="number"
                      min={1}
                      value={formData.maxRiders}
                      onChange={(e) => setFormData({ ...formData, maxRiders: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 p-3 rounded-xl text-xs outline-none transition text-slate-100 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450">Waiting List Max</label>
                    <input
                      required
                      type="number"
                      min={0}
                      value={formData.waitingListMax}
                      onChange={(e) => setFormData({ ...formData, waitingListMax: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 p-3 rounded-xl text-xs outline-none transition text-slate-100 font-mono"
                    />
                  </div>
                </div>

                {/* Base Payouts */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Base Shift Pay (₹)</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={formData.basePay}
                    onChange={(e) => setFormData({ ...formData, basePay: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 p-3 rounded-xl text-xs outline-none transition text-slate-100 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Per Delivered Order Pay (₹)</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={formData.perOrderPay}
                    onChange={(e) => setFormData({ ...formData, perOrderPay: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 p-3 rounded-xl text-xs outline-none transition text-slate-100 font-mono"
                  />
                </div>

                {/* Bonus incentives */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:col-span-2 bg-slate-950 p-4 rounded-2xl border border-slate-850">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Surge (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.surgeBonus}
                      onChange={(e) => setFormData({ ...formData, surgeBonus: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-xs outline-none text-slate-100 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Rain (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.rainBonus}
                      onChange={(e) => setFormData({ ...formData, rainBonus: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-xs outline-none text-slate-100 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Festival (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.festivalBonus}
                      onChange={(e) => setFormData({ ...formData, festivalBonus: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-xs outline-none text-slate-100 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Night (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.nightBonus}
                      onChange={(e) => setFormData({ ...formData, nightBonus: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-xs outline-none text-slate-100 font-mono"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Attendance Bonus (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.attendanceBonus}
                      onChange={(e) => setFormData({ ...formData, attendanceBonus: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-xs outline-none text-slate-100 font-mono"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Performance Incentives (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.incentives}
                      onChange={(e) => setFormData({ ...formData, incentives: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-xs outline-none text-slate-100 font-mono"
                    />
                  </div>
                </div>

                {/* Rules */}
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cancellation Policy Rules</label>
                  <textarea
                    rows={2}
                    value={formData.cancellationRules}
                    onChange={(e) => setFormData({ ...formData, cancellationRules: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 p-3 rounded-xl text-xs outline-none transition text-slate-100 resize-none"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">No-Show & Penalty Rules</label>
                  <textarea
                    rows={2}
                    value={formData.penaltyRules}
                    onChange={(e) => setFormData({ ...formData, penaltyRules: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 p-3 rounded-xl text-xs outline-none transition text-slate-100 resize-none"
                  />
                </div>

                {/* Visibility */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Visibility Mode</label>
                  <select
                    value={formData.visibilityRules}
                    onChange={(e) => setFormData({ ...formData, visibilityRules: e.target.value as 'public' | 'hidden' })}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 p-3 rounded-xl text-xs outline-none transition text-slate-100 font-bold"
                  >
                    <option value="public">👁️ Public Shift (Visible to Riders)</option>
                    <option value="hidden">👁️‍🗨️ Hidden Shift (Admin eyes only)</option>
                  </select>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-850 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="bg-slate-950 hover:bg-slate-850 text-slate-400 border border-slate-850 text-xs font-bold px-5 py-3 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-6 py-3 rounded-xl transition shadow-lg shadow-amber-500/10 cursor-pointer"
                >
                  {editingGig ? "Apply Configuration Updates" : "Publish Gig Shift Slots"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingGig && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-5 animate-fade-in">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Permanently Delete Gig?</h3>
                <p className="text-slate-400 text-xs font-mono">ID: #{deletingGig.id.substring(0, 8)}</p>
              </div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850 space-y-2">
              <p className="text-slate-100 text-sm font-bold">{deletingGig.name}</p>
              <p className="text-slate-400 text-xs leading-relaxed">
                This action will permanently delete the gig slot for <span className="text-slate-200 font-semibold">{deletingGig.city}</span> ({deletingGig.zone}) and cancel all associated rider bookings.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-850">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingGig(null)}
                className="bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-lg shadow-rose-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Yes, Delete Gig"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COPY NEXT WEEK CONFIRMATION MODAL */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-5 animate-fade-in">
            <div className="flex items-center gap-3 text-amber-500">
              <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 shrink-0">
                <ArrowRightLeft className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Copy Gigs to Next Week?</h3>
                <p className="text-slate-400 text-xs">Duplicate active schedule slots (+7 days)</p>
              </div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850 space-y-2">
              <p className="text-slate-300 text-xs leading-relaxed">
                This action will copy all <span className="text-amber-400 font-bold">{gigs.length} active gig slots</span> currently scheduled for this week into the exact same shift times for next week.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-850">
              <button
                type="button"
                disabled={isCopying}
                onClick={() => setShowCopyModal(false)}
                className="bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCopying}
                onClick={executeCopyNextWeek}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isCopying ? "Duplicating..." : "Yes, Copy Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST BANNER */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-amber-500/40 text-slate-100 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-up">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
