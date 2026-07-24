import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  updateDoc, 
  doc, 
  addDoc,
  query, 
  where,
  getDoc
} from 'firebase/firestore';
import { Gig, GigBooking, Rider } from '../types';
import { getActiveCity, getActiveMapSettings, updateMapSettingsInDb } from '../services/mapService';
import { 
  Calendar, 
  Clock, 
  Coins, 
  MapPin, 
  Truck, 
  Navigation, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  HelpCircle, 
  ArrowRight, 
  UserCheck, 
  Map, 
  X,
  Sparkles,
  PhoneCall,
  History,
  ClipboardList
} from 'lucide-react';

interface RiderGigViewProps {
  rider: Rider;
}

export default function RiderGigView({ rider }: RiderGigViewProps) {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [bookings, setBookings] = useState<GigBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Calendar states
  const [selectedDateStr, setSelectedDateStr] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'available' | 'my_bookings'>('available');
  const [selectedBooking, setSelectedBooking] = useState<Gig | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successBookingId, setSuccessBookingId] = useState('');

  // 8-Day Calendar generation (today + next 7 days)
  const [calendarDays, setCalendarDays] = useState<{ dateStr: string; label: string; weekday: string }[]>([]);

  useEffect(() => {
    const days = [];
    const today = new Date();
    for (let i = 0; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      
      // Label formatting
      let label = d.getDate().toString();
      let weekday = d.toLocaleDateString('en-IN', { weekday: 'short' });
      if (i === 0) weekday = 'Today';
      
      days.push({ dateStr, label, weekday });
    }
    setCalendarDays(days);
    setSelectedDateStr(days[0].dateStr); // Default to today
  }, []);

  // Fetch real-time gigs and bookings with error handling
  useEffect(() => {
    setLoading(true);
    setFetchError(null);

    const unsubGigs = onSnapshot(collection(db, 'gigs'), (snapshot) => {
      const list: Gig[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as Gig);
      });
      setGigs(list);
      setLoading(false);
      setFetchError(null);
    }, (err) => {
      console.error("Error loading gigs: ", err);
      setFetchError("Unable to load gig schedules from Firestore database.");
      setLoading(false);
    });

    const unsubBookings = onSnapshot(collection(db, 'gig_bookings'), (snapshot) => {
      const list: GigBooking[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as GigBooking);
      });
      setBookings(list);
    }, (err) => {
      console.error("Error loading bookings: ", err);
    });

    return () => {
      unsubGigs();
      unsubBookings();
    };
  }, []);

  // Calculate day status based on all visible gigs on that date
  const getDayStatus = (dateStr: string) => {
    const dayGigs = gigs.filter(g => g.date === dateStr && g.visibilityRules !== 'hidden');
    if (dayGigs.length === 0) return 'empty';
    
    // Check if all are locked
    const allLocked = dayGigs.every(g => g.status === 'locked');
    if (allLocked) return 'locked';

    // Sum slots
    let totalMax = 0;
    let totalBooked = 0;
    dayGigs.forEach(g => {
      totalMax += g.maxRiders;
      totalBooked += g.bookedRiderIds?.length || 0;
    });

    const remaining = Math.max(0, totalMax - totalBooked);
    if (remaining === 0) return 'full';
    if (remaining <= 3) return 'limited';
    return 'open';
  };

  // Check overlap of booking slots
  const hasTimeOverlap = (newGig: Gig) => {
    const activeRiderBookings = gigs.filter(g => 
      g.bookedRiderIds?.includes(rider.id) && g.date === newGig.date
    );

    return activeRiderBookings.some(booked => {
      const [newStartH, newStartM] = newGig.startTime.split(':').map(Number);
      const [newEndH, newEndM] = newGig.endTime.split(':').map(Number);
      const [bookedStartH, bookedStartM] = booked.startTime.split(':').map(Number);
      const [bookedEndH, bookedEndM] = booked.endTime.split(':').map(Number);

      const newStart = newStartH * 60 + newStartM;
      const newEnd = newEndH * 60 + newEndM;
      const bookedStart = bookedStartH * 60 + bookedStartM;
      const bookedEnd = bookedEndH * 60 + bookedEndM;

      // Overlap logic: start time of one is within the duration of another
      return (newStart < bookedEnd && newEnd > bookedStart);
    });
  };

  // Book a Gig
  const bookGig = async (gig: Gig) => {
    if (gig.status === 'locked') {
      alert("This Gig is locked by Administrator.");
      return;
    }

    const alreadyBooked = gig.bookedRiderIds?.includes(rider.id) || gig.waitingListRiderIds?.includes(rider.id);
    if (alreadyBooked) {
      alert("You are already signed up for this gig!");
      return;
    }

    // Check time overlap
    if (hasTimeOverlap(gig)) {
      alert("⚠️ Overlapping Shifts: You are already booked for another gig on this day that overlaps with this time slot. Please choose a different timing.");
      return;
    }

    try {
      const bookedCount = gig.bookedRiderIds?.length || 0;
      const waitingCount = gig.waitingListRiderIds?.length || 0;
      const remaining = Math.max(0, gig.maxRiders - bookedCount);

      const generatedBookingId = `TTR-GIG-${Math.floor(100000 + Math.random() * 900000)}`;

      if (remaining > 0) {
        // Book successfully
        const updatedBooked = [...(gig.bookedRiderIds || []), rider.id];
        
        // Auto-lock check: if full
        const isFullNow = updatedBooked.length >= gig.maxRiders;
        const nextStatus = isFullNow ? 'full' : gig.status;

        await updateDoc(doc(db, 'gigs', gig.id), {
          bookedRiderIds: updatedBooked,
          status: nextStatus
        });

        // Save booking log
        const bookingRecord: Partial<GigBooking> = {
          gigId: gig.id,
          riderId: rider.id,
          riderName: rider.name,
          riderPhone: rider.phone || '',
          riderVehicle: (rider as any).vehicleType || (rider as any).vehicle || '',
          bookingStatus: 'booked',
          bookingId: generatedBookingId,
          reportingTime: getReportingTime(gig.startTime),
          hubAddress: `${gig.hub}, ${gig.zone}, ${getActiveCity().name}`,
          bookedAt: new Date().toISOString()
        };

        await addDoc(collection(db, 'gig_bookings'), bookingRecord);

        // Update rider active gig document in Firestore
        try {
          await updateDoc(doc(db, 'riders', rider.id), {
            activeGigId: gig.id,
            activeGigName: gig.name,
            activeGigStatus: 'booked'
          });
        } catch (rErr) {
          console.warn("Could not update rider doc activeGigId:", rErr);
        }

        // Create Notifications
        await addDoc(collection(db, 'gig_notifications'), {
          title: "Shift Booked Successfully! 🏍️",
          message: `Confirmed: You are booked for ${gig.name} at ${gig.hub}. Reporting Time: ${getReportingTime(gig.startTime)} hrs. ID: #${generatedBookingId}`,
          type: 'booking_success',
          riderId: rider.id,
          gigId: gig.id,
          createdAt: new Date().toISOString(),
          status: 'unread',
          recipient: 'rider'
        });

        await addDoc(collection(db, 'gig_notifications'), {
          title: "New Shift Registration 🏍️",
          message: `Rider ${rider.name} has registered for ${gig.name} (ID: #${generatedBookingId}).`,
          type: 'admin_alert',
          riderId: rider.id,
          gigId: gig.id,
          createdAt: new Date().toISOString(),
          status: 'unread',
          recipient: 'admin'
        });

        if (isFullNow) {
          // Notify each booked rider
          for (const rId of updatedBooked) {
            await addDoc(collection(db, 'gig_notifications'), {
              title: "Shift is Now Full! 🔒",
              message: `The shift "${gig.name}" you booked is now FULL and fully staffed. Get ready for your deliveries!`,
              type: 'gig_full_rider',
              riderId: rId,
              gigId: gig.id,
              createdAt: new Date().toISOString(),
              status: 'unread',
              recipient: 'rider'
            });
          }

          // Admin notification for full gig
          await addDoc(collection(db, 'gig_notifications'), {
            title: "Shift Status: FULL ⚠️",
            message: `The gig ${gig.name} is now at 100% rider capacity (${updatedBooked.length}/${gig.maxRiders} riders).`,
            type: 'gig_full_admin',
            gigId: gig.id,
            createdAt: new Date().toISOString(),
            status: 'unread',
            recipient: 'admin'
          });
        }

        setSuccessBookingId(generatedBookingId);
        setSelectedBooking(gig);
        setShowSuccessModal(true);
      } else {
        // Handle Waiting List Auto-Promotion Check
        const waitMax = gig.waitingListMax || 0;
        if (waitingCount < waitMax) {
          if (window.confirm("This shift is currently Full. Would you like to join the Waiting List? You will be auto-promoted in real-time if a booked rider cancels.")) {
            const updatedWaiting = [...(gig.waitingListRiderIds || []), rider.id];
            await updateDoc(doc(db, 'gigs', gig.id), {
              waitingListRiderIds: updatedWaiting
            });

            const bookingRecord: Partial<GigBooking> = {
              gigId: gig.id,
              riderId: rider.id,
              riderName: rider.name,
              riderPhone: rider.phone || '',
              riderVehicle: (rider as any).vehicleType || (rider as any).vehicle || '',
              bookingStatus: 'pending', // Pending/Waiting status
              bookingId: generatedBookingId,
              reportingTime: getReportingTime(gig.startTime),
              hubAddress: `${gig.hub}, ${gig.zone}, ${getActiveCity().name}`,
              bookedAt: new Date().toISOString()
            };

            await addDoc(collection(db, 'gig_bookings'), bookingRecord);

            // Create Waiting List Notifications
            await addDoc(collection(db, 'gig_notifications'), {
              title: "Joined Waiting List 🙋",
              message: `You have joined the waiting list for ${gig.name}. Position: #${updatedWaiting.length}.`,
              type: 'waiting_list',
              riderId: rider.id,
              gigId: gig.id,
              createdAt: new Date().toISOString(),
              status: 'unread',
              recipient: 'rider'
            });

            await addDoc(collection(db, 'gig_notifications'), {
              title: "Waiting List Update 🙋",
              message: `Rider ${rider.name} joined the waiting list for ${gig.name}. Position: #${updatedWaiting.length}`,
              type: 'admin_alert',
              riderId: rider.id,
              gigId: gig.id,
              createdAt: new Date().toISOString(),
              status: 'unread',
              recipient: 'admin'
            });

            alert("Success! You have been added to the Waiting List. Position: #" + updatedWaiting.length);
          }
        } else {
          alert("We apologize! Both booking slots and the waiting list for this gig are completely full.");
        }
      }
    } catch (err: any) {
      alert("Error booking Gig: " + err.message);
    }
  };

  // Cancel Booking
  const cancelBooking = async (gig: Gig) => {
    // Cancellation policy check
    const todayStr = new Date().toISOString().split('T')[0];
    const gigDate = new Date(gig.date);
    const todayDate = new Date(todayStr);

    try {
        // Remove from booked lists
        let updatedBooked = (gig.bookedRiderIds || []).filter(id => id !== rider.id);
        let updatedWaiting = (gig.waitingListRiderIds || []).filter(id => id !== rider.id);
        let updatedCancelled = [...(gig.cancelledRiderIds || []), rider.id];

        // WAITING LIST AUTO-PROMOTION Logic: 
        // If someone cancelled and there was a rider on the waiting list, promote the first waiting rider!
        let promotedRiderId = '';
        if (updatedBooked.length < gig.maxRiders && updatedWaiting.length > 0) {
          promotedRiderId = updatedWaiting.shift() || '';
          if (promotedRiderId) {
            updatedBooked.push(promotedRiderId);
          }
        }

        // Update Gig document
        await updateDoc(doc(db, 'gigs', gig.id), {
          bookedRiderIds: updatedBooked,
          waitingListRiderIds: updatedWaiting,
          cancelledRiderIds: updatedCancelled,
          status: 'open' // ensure unlocked slots are open
        });

        // Find and cancel booking logs
        // Using snapshot in memory to update since we have bookings state
        const targetBooking = bookings.find(b => b.gigId === gig.id && b.riderId === rider.id && b.bookingStatus !== 'cancelled');
        if (targetBooking) {
          await updateDoc(doc(db, 'gig_bookings', targetBooking.id), {
            bookingStatus: 'cancelled',
            cancelledAt: new Date().toISOString()
          });
        }

        // Create Cancel and Promo Notifications
        await addDoc(collection(db, 'gig_notifications'), {
          title: "Booking Cancelled ❌",
          message: `You have successfully cancelled your booked shift "${gig.name}" on ${gig.date}.`,
          type: 'booking_cancelled',
          riderId: rider.id,
          gigId: gig.id,
          createdAt: new Date().toISOString(),
          status: 'unread',
          recipient: 'rider'
        });

        // If a rider was promoted, find and update their booking status from 'pending' (waiting) to 'booked'!
        if (promotedRiderId) {
          const promotedBooking = bookings.find(b => b.gigId === gig.id && b.riderId === promotedRiderId && b.bookingStatus === 'pending');
          if (promotedBooking) {
            await updateDoc(doc(db, 'gig_bookings', promotedBooking.id), {
              bookingStatus: 'booked'
            });

            await addDoc(collection(db, 'gig_notifications'), {
              title: "Auto-Promoted to Shift! 🎉",
              message: `Good news! You have been auto-promoted from the waiting list to active booking for "${gig.name}". Your shift is confirmed!`,
              type: 'promotion_success',
              riderId: promotedRiderId,
              gigId: gig.id,
              createdAt: new Date().toISOString(),
              status: 'unread',
              recipient: 'rider'
            });

            console.log("Auto-promoted rider ID: ", promotedRiderId);
          }
        }

        await addDoc(collection(db, 'gig_notifications'), {
          title: "Shift Booking Cancelled ❌",
          message: `Rider ${rider.name} cancelled booking for "${gig.name}". ${promotedRiderId ? `Rider ID ${promotedRiderId} was auto-promoted from waiting list!` : "Slot is now vacant and open."}`,
          type: 'admin_alert',
          riderId: rider.id,
          gigId: gig.id,
          createdAt: new Date().toISOString(),
          status: 'unread',
          recipient: 'admin'
        });

        // Clear rider active gig state in Firestore
        try {
          await updateDoc(doc(db, 'riders', rider.id), {
            activeGigId: '',
            activeGigName: '',
            activeGigStatus: 'cancelled'
          });
        } catch (rErr) {
          console.warn("Could not clear rider doc activeGigId:", rErr);
        }

        setSelectedBooking(null);
      } catch (err: any) {
        console.error("Error cancelling booking: ", err);
      }
  };

  // Helper to calculate reporting time (30 minutes before shift starts)
  const getReportingTime = (startTime: string) => {
    const [h, m] = startTime.split(':').map(Number);
    let rh = h;
    let rm = m - 30;
    if (rm < 0) {
      rh -= 1;
      rm += 60;
    }
    if (rh < 0) rh += 24;
    return `${rh.toString().padStart(2, '0')}:${rm.toString().padStart(2, '0')}`;
  };

  // Process Check-In
  const checkInGig = async (gig: Gig) => {
    try {
      const updatedChecked = [...(gig.checkedInRiderIds || []), rider.id];
      await updateDoc(doc(db, 'gigs', gig.id), {
        checkedInRiderIds: updatedChecked
      });

      const targetBooking = bookings.find(b => b.gigId === gig.id && b.riderId === rider.id && b.bookingStatus === 'booked');
      if (targetBooking) {
        await updateDoc(doc(db, 'gig_bookings', targetBooking.id), {
          bookingStatus: 'checked_in',
          checkedInAt: new Date().toISOString()
        });
      }

      try {
        const nowStr = new Date().toISOString();
        await updateDoc(doc(db, 'riders', rider.id), {
          activeGigId: gig.id,
          activeGigName: gig.name,
          activeGigStatus: 'checked_in',
          dutyStatus: 'on_duty',
          onlineStatus: 'online',
          lastActiveAt: nowStr,
          lastLocationUpdate: nowStr
        });
      } catch (e) {
        console.warn("Could not update rider doc activeGigStatus:", e);
      }

      alert("🎉 Checked In successfully! Please reach the reporting counter to receive your deliveries.");
    } catch (err: any) {
      alert("Check In failed: " + err.message);
    }
  };

  // Process Go Online
  const goOnlineGig = async (gig: Gig) => {
    try {
      const updatedOnline = [...(gig.onlineRiderIds || []), rider.id];
      await updateDoc(doc(db, 'gigs', gig.id), {
        onlineRiderIds: updatedOnline
      });

      const targetBooking = bookings.find(b => b.gigId === gig.id && b.riderId === rider.id && (b.bookingStatus === 'checked_in' || b.bookingStatus === 'booked'));
      if (targetBooking) {
        await updateDoc(doc(db, 'gig_bookings', targetBooking.id), {
          bookingStatus: 'online'
        });
      }

      try {
        const nowStr = new Date().toISOString();
        await updateDoc(doc(db, 'riders', rider.id), {
          activeGigId: gig.id,
          activeGigName: gig.name,
          activeGigStatus: 'online',
          dutyStatus: 'on_duty',
          onlineStatus: 'online',
          lastActiveAt: nowStr,
          lastLocationUpdate: nowStr
        });
      } catch (e) {
        console.warn("Could not update rider doc activeGigStatus:", e);
      }

      alert("🏍️ You are now ONLINE on duty! Orders will be pushed to your active duty panel.");
    } catch (err: any) {
      alert("Failed to go online: " + err.message);
    }
  };

  // Complete Gig Shift
  const completeGigShift = async (gig: Gig) => {
    try {
      const updatedCompleted = [...(gig.completedRiderIds || []), rider.id];
      await updateDoc(doc(db, 'gigs', gig.id), {
        completedRiderIds: updatedCompleted
      });

      const targetBooking = bookings.find(b => b.gigId === gig.id && b.riderId === rider.id && b.bookingStatus !== 'completed');
      if (targetBooking) {
        await updateDoc(doc(db, 'gig_bookings', targetBooking.id), {
          bookingStatus: 'completed',
          completedAt: new Date().toISOString()
        });
      }

      // Automatically add expected earnings to rider's wallet balance
      const basePaySum = gig.basePay + gig.attendanceBonus + gig.surgeBonus + gig.rainBonus + gig.festivalBonus + gig.nightBonus + gig.incentives;
      const totalEarned = basePaySum + (gig.perOrderPay * 6);

      const riderRef = doc(db, 'riders', rider.id);
      const riderSnap = await getDoc(riderRef);
      if (riderSnap.exists()) {
        const currentBalance = riderSnap.data().walletBalance || 0;
        await updateDoc(riderRef, {
          walletBalance: currentBalance + totalEarned,
          attendanceDays: (riderSnap.data().attendanceDays || 0) + 1,
          activeGigId: '',
          activeGigName: '',
          activeGigStatus: 'completed'
        });
      }

      alert(`🎉 Shift Completed! You earned a total of ₹${totalEarned} (Base: ₹${basePaySum} + Orders Payout: ₹${gig.perOrderPay * 6}) which has been credited to your Wallet!`);
    } catch (err: any) {
      alert("Failed to complete gig: " + err.message);
    }
  };

  // Filter available gigs for selected date
  const availableGigs = gigs.filter(g => 
    g.date === selectedDateStr && 
    g.visibilityRules !== 'hidden' &&
    !g.bookedRiderIds?.includes(rider.id) &&
    !g.waitingListRiderIds?.includes(rider.id) &&
    !g.checkedInRiderIds?.includes(rider.id) &&
    !g.onlineRiderIds?.includes(rider.id)
  );

  // Filter My Booked Gigs (checking all status arrays, booking records, and rider activeGigId)
  const myBookedGigs = gigs.filter(g => {
    const isBooked = g.bookedRiderIds?.includes(rider.id);
    const isWaiting = g.waitingListRiderIds?.includes(rider.id);
    const isCheckedIn = g.checkedInRiderIds?.includes(rider.id);
    const isOnline = g.onlineRiderIds?.includes(rider.id);
    const isCompleted = g.completedRiderIds?.includes(rider.id);
    const isCancelled = g.cancelledRiderIds?.includes(rider.id);
    const isMissed = g.missedRiderIds?.includes(rider.id);
    const hasBookingRecord = bookings.some(b => b.gigId === g.id && (b.riderId === rider.id || (b.riderPhone && rider.phone && b.riderPhone === rider.phone)));
    const isActiveGigDoc = (rider as any)?.activeGigId === g.id;

    return isBooked || isWaiting || isCheckedIn || isOnline || isCompleted || isCancelled || isMissed || hasBookingRecord || isActiveGigDoc;
  });

  // Calculate live total expected earnings & total hours
  let myExpectedEarnings = 0;
  let myTotalWorkingHours = 0;

  myBookedGigs.forEach(g => {
    const isCompleted = g.completedRiderIds?.includes(rider.id);
    const baseCompensation = g.basePay + g.attendanceBonus + g.surgeBonus + g.rainBonus + g.festivalBonus + g.nightBonus + g.incentives;
    
    // Base pay + let's project an average of 5 orders for booked, or completed actuals
    const ordersCount = isCompleted ? 6 : 5;
    myExpectedEarnings += baseCompensation + (g.perOrderPay * ordersCount);

    // Calculate shift duration
    const [sh, sm] = g.startTime.split(':').map(Number);
    const [eh, em] = g.endTime.split(':').map(Number);
    let startMin = sh * 60 + sm;
    let endMin = eh * 60 + em;
    if (endMin < startMin) endMin += 1440; // overnight shift wrap-around
    myTotalWorkingHours += (endMin - startMin) / 60;
  });

  return (
    <div className="space-y-5 text-slate-100 font-sans pb-16">
      {/* Fetch Error Banner if Firestore load fails */}
      {fetchError && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center justify-between gap-3 text-rose-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{fetchError}</span>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="bg-rose-500 hover:bg-rose-600 text-white font-bold px-3 py-1.5 rounded-xl transition text-[11px] shrink-0"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Active Operating Zone & Location Bounds Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Active GPS Tracking Zone</span>
            <span className="text-xs font-black text-slate-100 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-amber-500 inline" />
              {getActiveCity().name} Grid ({getActiveCity().state})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase">City Zone:</span>
          <select
            value={getActiveCity().id}
            onChange={async (e) => {
              const cId = e.target.value;
              const allCities = getActiveMapSettings().cities || [];
              const targetC = allCities.find(c => c.id === cId);
              if (targetC) {
                await updateMapSettingsInDb({
                  activeCityId: cId,
                  defaultCenterLat: targetC.centerLat,
                  defaultCenterLng: targetC.centerLng,
                  defaultZoom: targetC.defaultZoom
                });
              }
            }}
            className="bg-transparent text-xs font-black text-amber-400 outline-none cursor-pointer"
          >
            {(getActiveMapSettings().cities || []).map(c => (
              <option key={c.id} value={c.id} className="bg-slate-900 text-slate-200">
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Earnings & Working Hours Micro Dashboard */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 grid grid-cols-2 gap-4 shadow-xl">
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850 flex items-center gap-3">
          <div className="bg-emerald-500/10 w-9 h-9 rounded-xl flex items-center justify-center text-emerald-400">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wide">Live Est. Earnings</span>
            <span className="text-sm font-black font-mono text-emerald-400">₹{myExpectedEarnings}</span>
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850 flex items-center gap-3">
          <div className="bg-amber-500/10 w-9 h-9 rounded-xl flex items-center justify-center text-amber-500">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wide">Total Gig Hours</span>
            <span className="text-sm font-black font-mono text-slate-100">{myTotalWorkingHours.toFixed(1)} hrs</span>
          </div>
        </div>
      </div>

      {/* Segment tabs */}
      <div className="grid grid-cols-2 p-1 bg-slate-900 border border-slate-850 rounded-2xl">
        <button
          onClick={() => setActiveTab('available')}
          className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'available' 
              ? 'bg-amber-500 text-slate-950 shadow' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Available Gigs
        </button>
        <button
          onClick={() => setActiveTab('my_bookings')}
          className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 relative ${
            activeTab === 'my_bookings' 
              ? 'bg-amber-500 text-slate-950 shadow' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          My Gigs
          {myBookedGigs.length > 0 && (
            <span className="absolute right-3 top-2 bg-rose-500 text-slate-100 font-mono text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-slate-950">
              {myBookedGigs.length}
            </span>
          )}
        </button>
      </div>

      {/* CALENDAR VIEW FOR GIGS SEARCHING */}
      {activeTab === 'available' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Select Shift Date</span>
            {/* Horizontal 8-day calendar strip */}
            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none snap-x">
              {calendarDays.map((day) => {
                const isSelected = selectedDateStr === day.dateStr;
                const status = getDayStatus(day.dateStr);
                
                let dotColor = 'bg-slate-700';
                if (status === 'open') dotColor = 'bg-emerald-400';
                else if (status === 'limited') dotColor = 'bg-amber-400';
                else if (status === 'full') dotColor = 'bg-rose-400';
                else if (status === 'locked') dotColor = 'bg-slate-500';

                return (
                  <button
                    key={day.dateStr}
                    onClick={() => setSelectedDateStr(day.dateStr)}
                    className={`flex-shrink-0 w-13 py-3 rounded-2xl flex flex-col items-center gap-1 transition-all snap-start cursor-pointer border ${
                      isSelected 
                        ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' 
                        : 'bg-slate-900 border-slate-850 text-slate-400 hover:bg-slate-850'
                    }`}
                  >
                    <span className="text-[9px] font-bold uppercase">{day.weekday}</span>
                    <span className="text-sm font-black font-mono leading-none">{day.label}</span>
                    {status !== 'empty' && (
                      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} mt-0.5`}></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* GIG DETAILS LIST FOR SELECTED DAY */}
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-400">Available Gigs on selected date</span>
              <span className="text-slate-500 font-mono">({availableGigs.length} found)</span>
            </div>

            {loading ? (
              <div className="text-center py-10">
                <div className="w-6 h-6 border-t-2 border-r-2 border-amber-500 rounded-full animate-spin mx-auto"></div>
              </div>
            ) : availableGigs.length === 0 ? (
              <div className="bg-slate-900 border border-slate-850 rounded-3xl p-10 text-center space-y-3 shadow-inner">
                <Calendar className="w-10 h-10 text-slate-700 mx-auto animate-pulse" />
                <p className="text-xs text-slate-400">No available shift slots for this date.</p>
                <p className="text-[10px] text-slate-500">Please select a different date from the horizontal scroll calendar above.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {availableGigs.map(gig => {
                  const bookedCount = gig.bookedRiderIds?.length || 0;
                  const remaining = Math.max(0, gig.maxRiders - bookedCount);
                  const isLocked = gig.status === 'locked';

                  // Expected Pay range
                  const basePaySum = gig.basePay + gig.attendanceBonus + gig.surgeBonus + gig.rainBonus + gig.festivalBonus + gig.nightBonus + gig.incentives;
                  const estimatedEarnings = basePaySum + (gig.perOrderPay * 5); // project average of 5 orders

                  return (
                    <div 
                      key={gig.id} 
                      className={`bg-slate-900 border border-slate-850 rounded-3xl p-5 space-y-4 shadow-xl transition-all ${
                        isLocked ? 'opacity-65' : 'hover:border-slate-850'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-black text-sm text-slate-100 tracking-tight leading-snug">{gig.name}</h4>
                          <span className="text-[9px] text-slate-500 font-mono tracking-wide">{gig.city} • {gig.zone}</span>
                        </div>
                        <span className="text-xs font-black text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
                          ₹{estimatedEarnings} <span className="text-[9px] text-slate-500 font-normal">Est.</span>
                        </span>
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-850 text-[11px] font-mono text-slate-300">
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wide">Shift hours</span>
                          <span className="font-bold text-slate-200 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            {gig.startTime} - {gig.endTime}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wide">Reporting Hub</span>
                          <span className="font-bold text-slate-200 flex items-center gap-1 truncate">
                            <MapPin className="w-3.5 h-3.5 text-amber-500" />
                            {gig.hub}
                          </span>
                        </div>
                      </div>

                      {/* Bonuses Pills */}
                      <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                        {gig.surgeBonus > 0 && <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 px-2 py-0.5 rounded-lg">⚡ Surge: ₹{gig.surgeBonus}</span>}
                        {gig.rainBonus > 0 && <span className="bg-blue-500/10 text-blue-400 border border-blue-500/10 px-2 py-0.5 rounded-lg">🌧️ Rain: ₹{gig.rainBonus}</span>}
                        {gig.festivalBonus > 0 && <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/10 px-2 py-0.5 rounded-lg">🎉 Fest: ₹{gig.festivalBonus}</span>}
                        {gig.nightBonus > 0 && <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 px-2 py-0.5 rounded-lg">🌙 Night: ₹{gig.nightBonus}</span>}
                        {gig.attendanceBonus > 0 && <span className="bg-purple-500/10 text-purple-400 border border-purple-500/10 px-2 py-0.5 rounded-lg">📋 Attendance: ₹{gig.attendanceBonus}</span>}
                      </div>

                      {/* Vehicles Requirements & Slots */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-slate-400 flex items-center gap-1 font-mono">
                          <Truck className="w-3.5 h-3.5 text-slate-500" />
                          {gig.vehicleType}
                        </span>
                        {remaining === 0 ? (
                          <span className="text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-lg uppercase text-[9px]">Waiting List Open</span>
                        ) : (
                          <span className="text-amber-500 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg text-[9px] font-mono">
                            {remaining} Slots Remaining
                          </span>
                        )}
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={() => bookGig(gig)}
                        disabled={isLocked}
                        className={`w-full font-bold py-3.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          isLocked 
                            ? 'bg-slate-800 text-slate-500 border border-slate-750 cursor-not-allowed' 
                            : remaining === 0
                            ? 'bg-slate-950 text-blue-400 hover:bg-slate-850 border border-slate-850'
                            : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/10'
                        }`}
                      >
                        {isLocked ? (
                          <>🔒 Locked by Admin</>
                        ) : remaining === 0 ? (
                          <>🙋 Join Waiting List</>
                        ) : (
                          <>✅ Book Gig Slot</>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MY BOOKED GIGS TRACKER SCREEN */}
      {activeTab === 'my_bookings' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-400">My Registered shifts</span>
            <span className="text-slate-500 font-mono">({myBookedGigs.length} registered)</span>
          </div>

          {myBookedGigs.length === 0 ? (() => {
            const orphanBooking = bookings.find(b => (b.riderId === rider.id || (b.riderPhone && rider.phone && b.riderPhone === rider.phone)) && b.bookingStatus !== 'cancelled');
            const riderActiveGigId = (rider as any)?.activeGigId;

            if (orphanBooking || riderActiveGigId) {
              return (
                <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 text-center space-y-3 shadow-inner">
                  <AlertCircle className="w-10 h-10 text-amber-500 mx-auto animate-pulse" />
                  <h3 className="text-sm font-bold text-amber-400">Active Shift Booking Found (Syncing Details...)</h3>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto">
                    We found a shift booking record (#{orphanBooking?.bookingId || 'REGISTERED'}) for your account, but the full shift details are currently loading or have been updated by an administrator.
                  </p>
                  <div className="flex justify-center gap-2 pt-2">
                    <button
                      onClick={() => window.location.reload()}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl transition"
                    >
                      Refresh Data
                    </button>
                    <button
                      onClick={async () => {
                        if (orphanBooking) {
                          await updateDoc(doc(db, 'gig_bookings', orphanBooking.id), { bookingStatus: 'cancelled' });
                        }
                        await updateDoc(doc(db, 'riders', rider.id), { activeGigId: '', activeGigStatus: '' });
                        alert("Stale booking record cleared. You can now browse and book new shifts.");
                      }}
                      className="bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 font-bold text-xs px-4 py-2 rounded-xl transition"
                    >
                      Clear Stale Booking
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div className="bg-slate-900 border border-slate-850 rounded-3xl p-12 text-center space-y-4 shadow-inner">
                <ClipboardList className="w-12 h-12 text-slate-700 mx-auto animate-pulse" />
                <p className="text-xs text-slate-400">You haven't booked any gig shifts yet.</p>
                <button
                  onClick={() => setActiveTab('available')}
                  className="bg-amber-500 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl hover:scale-102 transition cursor-pointer"
                >
                  Browse & Book Shifts
                </button>
              </div>
            );
          })() : (
            <div className="space-y-4">
              {myBookedGigs.map(gig => {
                const isWaiting = gig.waitingListRiderIds?.includes(rider.id);
                const isCheckedIn = gig.checkedInRiderIds?.includes(rider.id);
                const isOnline = gig.onlineRiderIds?.includes(rider.id);
                const isCompleted = gig.completedRiderIds?.includes(rider.id);
                const isCancelled = gig.cancelledRiderIds?.includes(rider.id);
                
                // Get Booking log status
                const bookingLog = bookings.find(b => b.gigId === gig.id && b.riderId === rider.id);
                const bookingId = bookingLog?.bookingId || 'TTR-GIG-PENDING';
                const reportingTime = bookingLog?.reportingTime || getReportingTime(gig.startTime);

                // Expected Pay
                const basePaySum = gig.basePay + gig.attendanceBonus + gig.surgeBonus + gig.rainBonus + gig.festivalBonus + gig.nightBonus + gig.incentives;
                const estimatedEarnings = basePaySum + (gig.perOrderPay * (isCompleted ? 6 : 5));

                // Status banner representation
                let statusBadge = <span className="bg-blue-500/15 text-blue-400 border border-blue-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-mono">Booked</span>;
                if (isWaiting) statusBadge = <span className="bg-slate-800 text-slate-400 border border-slate-750 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-mono animate-pulse">Pending / Waitlist</span>;
                else if (isCompleted) statusBadge = <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-mono">Completed</span>;
                else if (isOnline) statusBadge = <span className="bg-orange-500/15 text-orange-400 border border-orange-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-mono flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-orange-400 animate-pulse"></span>Online Duty</span>;
                else if (isCheckedIn) statusBadge = <span className="bg-teal-500/15 text-teal-400 border border-teal-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-mono">Checked In</span>;
                else if (isCancelled) statusBadge = <span className="bg-rose-500/15 text-rose-400 border border-rose-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-mono">Cancelled</span>;

                return (
                  <div key={gig.id} className="bg-slate-900 border border-slate-850 rounded-3xl p-5 space-y-4 shadow-xl">
                    <div className="flex justify-between items-start border-b border-slate-850 pb-3">
                      <div>
                        <span className="text-[10px] text-amber-500 font-mono font-bold tracking-wide">BOOKING ID: #{bookingId}</span>
                        <p className="text-[10px] text-slate-500 mt-0.5">Booked for: {new Date(gig.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })}</p>
                      </div>
                      {statusBadge}
                    </div>

                    <div className="space-y-2.5 text-xs text-slate-300">
                      <div>
                        <span className="text-slate-500 text-[9px] block uppercase font-bold">Shift Target / Zone</span>
                        <p className="font-bold text-slate-200">{gig.name}</p>
                        <p className="text-slate-400 text-[10px]">{gig.city} • {gig.zone} ({gig.hub} Hub)</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 bg-slate-950 p-3 rounded-2xl border border-slate-850 font-mono text-[11px]">
                        <div>
                          <span className="text-slate-500 text-[9px] block uppercase font-bold">Reporting Time</span>
                          <span className="text-slate-200 font-bold">{reportingTime} hrs</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[9px] block uppercase font-bold">Earnings payout</span>
                          <span className="text-emerald-400 font-bold">₹{estimatedEarnings}</span>
                        </div>
                      </div>
                    </div>

                    {/* Google Map & Actions button panel */}
                    {!isCompleted && !isCancelled && (
                      <div className="space-y-2 pt-2">
                        {/* Maps Navigation Action */}
                        <a
                          href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(gig.hub + " " + getActiveCity().name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-slate-950 hover:bg-slate-850 border border-slate-800 text-amber-500 text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition"
                        >
                          <Navigation className="w-4 h-4 text-amber-500 shrink-0" />
                          <span>OpenStreetMap Navigation (Navigate to Hub)</span>
                        </a>

                        {/* Interactive flow states for live synchronization */}
                        {!isWaiting && !isCheckedIn && !isOnline && (
                          <button
                            onClick={() => checkInGig(gig)}
                            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl text-xs transition"
                          >
                            🙋 Reach Hub & Check In
                          </button>
                        )}

                        {isCheckedIn && !isOnline && (
                          <button
                            onClick={() => goOnlineGig(gig)}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-100 font-bold py-3 rounded-xl text-xs transition"
                          >
                            🏍️ Go Online (Start Duty)
                          </button>
                        )}

                        {isOnline && (
                          <button
                            onClick={() => completeGigShift(gig)}
                            className="w-full bg-teal-600 hover:bg-teal-500 text-slate-100 font-bold py-3 rounded-xl text-xs transition animate-pulse"
                          >
                            ✓ Complete Shift & Claim Payout
                          </button>
                        )}

                        {/* Contact Support */}
                        <div className="grid grid-cols-2 gap-2">
                          <a 
                            href="tel:+919876543210"
                            className="bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-250 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition"
                          >
                            <PhoneCall className="w-3.5 h-3.5" /> Support
                          </a>
                          <button
                            onClick={() => cancelBooking(gig)}
                            className="bg-slate-950 hover:bg-rose-500/10 border border-slate-850 hover:border-rose-500/20 text-rose-400 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                          >
                            Cancel Booking
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONFIRMED BOOKING POPUP RECEIPT */}
      {showSuccessModal && selectedBooking && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center space-y-5 animate-fade-in">
            <div className="bg-emerald-500/10 w-14 h-14 rounded-full flex items-center justify-center text-emerald-400 mx-auto border border-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-100">Booking Confirmed!</h3>
              <p className="text-slate-400 text-xs">Your enterprise shift is successfully registered.</p>
            </div>

            {/* Receipt Summary */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 text-left space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-slate-900 pb-2">
                <span className="text-slate-500">Booking ID:</span>
                <span className="text-slate-200 font-bold">#{successBookingId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reporting Time:</span>
                <span className="text-slate-200 font-bold">{getReportingTime(selectedBooking.startTime)} hrs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Shift Target:</span>
                <span className="text-slate-200 font-bold truncate max-w-[160px]">{selectedBooking.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Hub Address:</span>
                <span className="text-slate-200 font-bold truncate max-w-[160px]">{selectedBooking.hub}</span>
              </div>
            </div>

            <div className="space-y-2 shrink-0">
              <a
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(selectedBooking.hub + " " + getActiveCity().name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition"
              >
                <Navigation className="w-4 h-4 text-slate-950" />
                Navigate on OpenStreetMap
              </a>
              <button
                onClick={() => { setShowSuccessModal(false); setSelectedBooking(null); }}
                className="w-full bg-slate-950 hover:bg-slate-850 text-slate-400 text-xs font-bold py-3 rounded-xl transition cursor-pointer"
              >
                Got It, Thank You
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
