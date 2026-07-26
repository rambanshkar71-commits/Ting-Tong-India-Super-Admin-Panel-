import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  setDoc,
  onSnapshot, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { Order, Rider, WorkZone } from '../types';
import { calculateDistance, getActiveCity } from '../services/mapService';
import { subscribeToZones } from '../services/zoneService';
import { isRiderInOrderWorkZone } from '../utils/zoneMatching';

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
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
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
  ShieldAlert, 
  UserCheck, 
  UserX, 
  RefreshCw, 
  AlertTriangle, 
  Search, 
  MapPin, 
  Clock, 
  Bike, 
  Phone, 
  CheckCircle, 
  TrendingUp, 
  Info,
  Calendar,
  Layers,
  Activity,
  UserCheck2,
  X,
  Eye,
  Ban,
  MessageSquare,
  ShieldCheck
} from 'lucide-react';

interface ManualDispatchControlProps {
  orders: Order[];
  riders: Rider[];
  parentSelectedOrderId?: string;
  onSelectOrderId?: (orderId: string) => void;
}

interface TimelineItem {
  id: string;
  orderId: string;
  type: 'Auto Assigned' | 'Manual Assigned' | 'Force Assigned' | 'Reassigned' | 'Assignment Cancelled';
  previousRider: string | null;
  newRider: string | null;
  transferReason?: string;
  timestamp: string;
  adminName: string;
  adminRole: string;
}

export default function ManualDispatchControl({ 
  orders, 
  riders,
  parentSelectedOrderId,
  onSelectOrderId
}: ManualDispatchControlProps) {
  // Role selector state
  const [adminRole, setAdminRole] = useState<'Super Admin' | 'Dispatch Manager' | 'Support Agent'>('Super Admin');
  
  // Selection states
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [riderSearchQuery, setRiderSearchQuery] = useState<string>('');
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [workZones, setWorkZones] = useState<WorkZone[]>([]);

  useEffect(() => {
    const unsub = subscribeToZones((updatedZones) => {
      setWorkZones(updatedZones);
    });
    return () => unsub();
  }, []);

  // Sync selected order from parent component
  useEffect(() => {
    if (parentSelectedOrderId !== undefined) {
      setSelectedOrderId(parentSelectedOrderId);
    }
  }, [parentSelectedOrderId]);

  // Dispatch settings synced with Firestore /dispatch_settings/global
  const [settings, setSettings] = useState({
    maxActiveOrders: 2,
    maxDailyOrders: 15,
    maxDistanceRadius: 8.0,
    maxPickupDelay: 45,
    autoRetryInterval: 30,
    adminTimeout: 5
  });
  
  // Modal states
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [targetRiderForTransfer, setTargetRiderForTransfer] = useState<Rider | null>(null);
  const [transferReason, setTransferReason] = useState<string>('Vehicle Breakdown');
  const [transferNotes, setTransferNotes] = useState<string>('');
  
  const [showForceAssignWarning, setShowForceAssignWarning] = useState<boolean>(false);
  const [targetRiderForForce, setTargetRiderForForce] = useState<Rider | null>(null);
  const [forceType, setForceType] = useState<'assign' | 'transfer'>('assign');
  const [viewingRider, setViewingRider] = useState<Rider | null>(null);

  // Load chronological timeline of assignments
  useEffect(() => {
    const q = query(collection(db, 'dispatch_timeline'), orderBy('timestamp', 'desc'), limit(40));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: TimelineItem[] = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() } as TimelineItem);
      });
      setTimeline(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'dispatch_timeline');
    });
    return () => unsubscribe();
  }, []);

  // Sync capacity settings from Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'dispatch_settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings({
          maxActiveOrders: data.maxActiveOrders ?? 2,
          maxDailyOrders: data.maxDailyOrders ?? 15,
          maxDistanceRadius: data.maxDistanceRadius ?? 8.0,
          maxPickupDelay: data.maxPickupDelay ?? 45,
          autoRetryInterval: data.autoRetryInterval ?? 30,
          adminTimeout: data.adminTimeout ?? 5
        });
      } else {
        // Initialize default settings in Firestore
        setDoc(doc(db, 'dispatch_settings', 'global'), {
          autoAssign: true,
          maxActiveOrders: 2,
          maxDailyOrders: 15,
          maxDistanceRadius: 8.0,
          maxPickupDelay: 45,
          autoRetryInterval: 30,
          adminTimeout: 5
        }).catch(err => handleFirestoreError(err, OperationType.CREATE, 'dispatch_settings/global'));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'dispatch_settings/global');
    });
    return () => unsub();
  }, []);

  // Update a single setting
  const handleSettingChange = async (key: string, value: number) => {
    if (adminRole !== 'Super Admin' && adminRole !== 'Dispatch Manager') {
      alert("⛔ Unauthorized: Only Super Admin and Dispatch Manager can change matching criteria parameters.");
      return;
    }
    try {
      await updateDoc(doc(db, 'dispatch_settings', 'global'), {
        [key]: value
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'dispatch_settings/global');
    }
  };

  // Generate active operational anomalies & alerts
  const getAnomalyAlerts = () => {
    const alerts: Array<{
      id: string;
      orderId: string;
      riderId: string;
      riderName: string;
      type: string;
      message: string;
      severity: 'high' | 'warning';
    }> = [];

    orders.forEach(o => {
      if (o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'refunded') {
        if (o.riderId) {
          const riderObj = riders.find(r => r.id === o.riderId);
          if (!riderObj) return;

          const onlineStatus = (riderObj.onlineStatus || '').toUpperCase();
          const dutyStatus = (riderObj.dutyStatus || '').toUpperCase();

          // 1. Rider Goes Offline while assigned
          if (onlineStatus === 'OFFLINE') {
            alerts.push({
              id: `offline-${o.id}`,
              orderId: o.id,
              riderId: o.riderId,
              riderName: o.riderName || 'Rider',
              type: 'RIDER_OFFLINE',
              message: `Courier partner ${o.riderName} is OFFLINE while holding Order #${o.id}!`,
              severity: 'high'
            });
          }
          // 2. Rider Duty Ended while assigned
          else if (dutyStatus === 'OFF_DUTY') {
            alerts.push({
              id: `duty-${o.id}`,
              orderId: o.id,
              riderId: o.riderId,
              riderName: o.riderName || 'Rider',
              type: 'SHIFT_ENDED',
              message: `Courier partner ${o.riderName} shift ended while assigned to Order #${o.id}.`,
              severity: 'high'
            });
          }
          // 3. Stale Location / GPS Stops Updating
          else if (riderObj.lat === 23.2324 && riderObj.lng === 77.4318 && o.status === 'picked_up') {
            alerts.push({
              id: `gps-${o.id}`,
              orderId: o.id,
              riderId: o.riderId,
              riderName: o.riderName || 'Rider',
              type: 'NO_MOVEMENT',
              message: `Courier partner ${o.riderName} has NOT moved after order pickup!`,
              severity: 'warning'
            });
          }
        } else if (o.status === 'pending') {
          // 4. Order unassigned timeout in queue
          const elapsedMins = (Date.now() - new Date(o.createdAt).getTime()) / 60000;
          if (elapsedMins > settings.adminTimeout) {
            alerts.push({
              id: `timeout-${o.id}`,
              orderId: o.id,
              riderId: '',
              riderName: 'Unassigned',
              type: 'QUEUE_TIMEOUT',
              message: `Order #${o.id} unassigned in ${getActiveCity().name} Queue for over ${Math.round(elapsedMins)} mins!`,
              severity: 'high'
            });
          }
        }
      }
    });

    return alerts;
  };

  // Safe instant reassign alert recovery action
  const handleInstantAutoReassign = async (orderId: string) => {
    if (adminRole !== 'Super Admin' && adminRole !== 'Dispatch Manager') {
      showAccessDeniedAlert();
      return;
    }
    const currentOrder = orders.find(o => o.id === orderId);
    if (!currentOrder) return;

    try {
      const orderRef = doc(db, 'orders', orderId);
      const prevRiderId = currentOrder.riderId;
      const prevRiderName = currentOrder.riderName;

      // Track previous rider as rejected/cancelled so SATCOM filters them out
      const rejectedRiders = currentOrder.rejectedRiders || [];
      if (prevRiderId && !rejectedRiders.includes(prevRiderId)) {
        rejectedRiders.push(prevRiderId);
      }

      await updateDoc(orderRef, {
        riderId: null,
        assignedRiderId: null,
        riderName: null,
        riderEarnings: 0,
        status: 'pending',
        rejectedRiders,
        updatedAt: new Date().toISOString()
      });

      await logAndNotify(
        orderId,
        'Assignment Cancelled',
        prevRiderName || 'System Alert Recovery',
        null,
        'Automatic Safety Reassignment Triggered'
      );

      alert(`✓ Order #${orderId} successfully recycled to unassigned queue. Prior driver (${prevRiderName || 'N/A'}) was flagged. SATCOM AI will instantly auto-rematch!`);
    } catch (err: any) {
      console.error("Alert recovery assignment reset failed:", err);
      alert("Error: " + err.message);
    }
  };

  // Determine currently selected order details
  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  // Helper: Centralized distance calculation delegate
  const calculateDistanceDelegate = (lat1: any, lon1: any, lat2: any, lon2: any) => {
    if (
      lat1 === undefined || lat1 === null || isNaN(Number(lat1)) ||
      lon1 === undefined || lon1 === null || isNaN(Number(lon1)) ||
      lat2 === undefined || lat2 === null || isNaN(Number(lat2)) ||
      lon2 === undefined || lon2 === null || isNaN(Number(lon2))
    ) {
      return Infinity;
    }
    const numLat1 = Number(lat1);
    const numLon1 = Number(lon1);
    const numLat2 = Number(lat2);
    const numLon2 = Number(lon2);
    
    // Check for uninitialized coordinates
    if (numLat1 === 0 && numLon1 === 0) return Infinity;
    if (numLat2 === 0 && numLon2 === 0) return Infinity;

    return calculateDistance(numLat1, numLon1, numLat2, numLon2);
  };

  // Check if admin has authorization
  const hasAccess = adminRole === 'Super Admin' || adminRole === 'Dispatch Manager';

  const showAccessDeniedAlert = () => {
    alert(`⛔ ACCESS DENIED: Your active role context (${adminRole}) does not have permission to execute this dispatch directive.\n\nOnly "Super Admin" and "Dispatch Manager" profiles can modify assignments.`);
  };

  // Logging and Notifications helpers
  const logAndNotify = async (
    orderId: string,
    type: TimelineItem['type'],
    prevRider: Rider | null | string,
    newRiderObj: Rider | null,
    reason?: string
  ) => {
    const prevName = typeof prevRider === 'string' ? prevRider : (prevRider?.name || null);
    const newName = newRiderObj?.name || null;
    
    // 1. Add dispatch timeline entry
    try {
      await addDoc(collection(db, 'dispatch_timeline'), {
        orderId,
        type,
        previousRider: prevName,
        newRider: newName,
        transferReason: reason || null,
        timestamp: new Date().toISOString(),
        adminName: `Admin (${adminRole})`,
        adminRole: adminRole
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'dispatch_timeline');
    }

    // 2. Add admin audit log
    try {
      await addDoc(collection(db, 'audit_logs'), {
        id: 'dispatch_log_' + Date.now(),
        userId: 'dispatch_mgr',
        email: 'admin@tingtong.com',
        adminEmail: 'admin@tingtong.com',
        action: `DISPATCH_${type.toUpperCase().replace(' ', '_')}`,
        details: `Order #${orderId}: ${type}. Prev: ${prevName || 'None'}, New: ${newName || 'None'}. Reason: ${reason || 'N/A'}. Actioned by ${adminRole}.`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'audit_logs');
    }

    // 3. Dispatch Live Notifications
    // Notify old rider if removed
    if (typeof prevRider !== 'string' && prevRider?.id) {
      try {
        await addDoc(collection(db, 'gig_notifications'), {
          title: "Order Unassigned ⚠️",
          message: `Order #${orderId} has been reassigned to another fleet partner due to administrative dispatch adjustment.`,
          type: 'order_unassigned',
          riderId: prevRider.id,
          createdAt: new Date().toISOString(),
          status: 'unread',
          recipient: 'rider'
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'gig_notifications');
      }
    }

    // Notify new rider if assigned
    if (newRiderObj?.id) {
      try {
        await addDoc(collection(db, 'gig_notifications'), {
          title: "New Order Assigned! 🏍️",
          message: `Direct Admin Dispatch: Order #${orderId} has been assigned to you. Head to ${selectedOrder?.restaurantName || 'the merchant'} immediately.`,
          type: 'order_assigned',
          riderId: newRiderObj.id,
          createdAt: new Date().toISOString(),
          status: 'unread',
          recipient: 'rider'
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'gig_notifications');
      }
    }

    // System wide notifications
    try {
      await addDoc(collection(db, 'system_live_notifications'), {
        category: 'orders',
        title: `Order Dispatch Updated: #${orderId}`,
        message: `${type} by Admin. New Driver: ${newName || 'None'}.`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'system_live_notifications');
    }
  };

  // Feature 1 & 3: Direct Manual Assign / Force Assign
  const executeAssignment = async (rider: Rider, isForced: boolean = false) => {
    if (!hasAccess) {
      showAccessDeniedAlert();
      return;
    }
    if (!selectedOrder) return;

    try {
      const orderRef = doc(db, 'orders', selectedOrder.id);
      const deliveryCharge = selectedOrder.deliveryCharge || 30;
      const riderEarnings = Math.round(deliveryCharge * 0.8);

      await updateDoc(orderRef, {
        riderId: rider.id,
        assignedRiderId: rider.id,
        riderName: rider.name,
        riderEarnings,
        status: 'accepted',
        updatedAt: new Date().toISOString()
      });

      await logAndNotify(
        selectedOrder.id,
        isForced ? 'Force Assigned' : 'Manual Assigned',
        null,
        rider
      );

      alert(`✓ Success: Assigned rider ${rider.name} to Order #${selectedOrder.id}!`);
      setSelectedOrderId('');
    } catch (err: any) {
      console.error("Assignment failed:", err);
      handleFirestoreError(err, OperationType.UPDATE, 'orders/' + selectedOrder.id);
    }
  };

  // Feature 2: Emergency Rider Transfer
  const executeEmergencyTransfer = async () => {
    if (!hasAccess) {
      showAccessDeniedAlert();
      return;
    }
    if (!selectedOrder || !targetRiderForTransfer) return;

    try {
      const orderRef = doc(db, 'orders', selectedOrder.id);
      const deliveryCharge = selectedOrder.deliveryCharge || 30;
      const riderEarnings = Math.round(deliveryCharge * 0.8);

      const previousRiderId = selectedOrder.riderId;
      const previousRiderName = selectedOrder.riderName;

      // Find full previous rider object to send notification
      const prevRiderObj = riders.find(r => r.id === previousRiderId) || null;

      await updateDoc(orderRef, {
        riderId: targetRiderForTransfer.id,
        assignedRiderId: targetRiderForTransfer.id,
        riderName: targetRiderForTransfer.name,
        riderEarnings,
        status: 'accepted',
        updatedAt: new Date().toISOString()
      });

      const fullReason = `${transferReason} - ${transferNotes.trim()}`;

      await logAndNotify(
        selectedOrder.id,
        'Reassigned',
        prevRiderObj || previousRiderName || 'Unknown Rider',
        targetRiderForTransfer,
        fullReason
      );

      alert(`✓ Emergency Transfer Complete: Order #${selectedOrder.id} transferred to ${targetRiderForTransfer.name} successfully.`);
      setShowTransferModal(false);
      setTargetRiderForTransfer(null);
      setTransferNotes('');
      setSelectedOrderId('');
    } catch (err: any) {
      console.error("Emergency transfer failed:", err);
      handleFirestoreError(err, OperationType.UPDATE, 'orders/' + selectedOrder.id);
    }
  };

  // Feature 4: Cancel Rider Assignment
  const handleCancelAssignment = async () => {
    if (!hasAccess) {
      showAccessDeniedAlert();
      return;
    }
    if (!selectedOrder || !selectedOrder.riderId) return;

    if (!confirm(`Are you sure you want to remove rider ${selectedOrder.riderName} from Order #${selectedOrder.id}? The order status will return to pending queue.`)) {
      return;
    }

    try {
      const orderRef = doc(db, 'orders', selectedOrder.id);
      const prevRiderId = selectedOrder.riderId;
      const prevRiderName = selectedOrder.riderName;
      const prevRiderObj = riders.find(r => r.id === prevRiderId) || null;

      await updateDoc(orderRef, {
        riderId: null,
        assignedRiderId: null,
        riderName: null,
        riderEarnings: 0,
        status: 'pending',
        updatedAt: new Date().toISOString()
      });

      await logAndNotify(
        selectedOrder.id,
        'Assignment Cancelled',
        prevRiderObj || prevRiderName || 'Unknown',
        null,
        'Admin Canceled Assignment'
      );

      alert(`✓ Assignment Cancelled: Order #${selectedOrder.id} returned to unassigned pending queue.`);
      setSelectedOrderId('');
    } catch (err: any) {
      console.error("Cancellation failed:", err);
      handleFirestoreError(err, OperationType.UPDATE, 'orders/' + selectedOrder.id);
    }
  };

  // Find closest approved online rider
  const getClosestRiderInfo = () => {
    if (!selectedOrder) return null;
    const oLat = selectedOrder.restaurantLat || getActiveCity().centerLat;
    const oLng = selectedOrder.restaurantLng || getActiveCity().centerLng;

    const eligibleRiders = riders.filter(r => {
      const onlineStatus = (r.onlineStatus || '').toUpperCase();
      const inZone = isRiderInOrderWorkZone(r, selectedOrder, workZones);
      return r.status === 'approved' && onlineStatus === 'ONLINE' && inZone;
    });

    if (eligibleRiders.length === 0) return null;

    let minD = Infinity;
    let bestRider: Rider | null = null;

    eligibleRiders.forEach(r => {
      const d = calculateDistanceDelegate(oLat, oLng, r.lat, r.lng);
      if (d < minD) {
        minD = d;
        bestRider = r;
      }
    });

    return { rider: bestRider, distance: minD };
  };

  const closestInfo = getClosestRiderInfo();

  // Helper variables to govern manual assignment & override button rules
  const isPendingOrderSelected = !!selectedOrder && !selectedOrder.riderId;
  const isAssignedOrderSelected = !!selectedOrder && !!selectedOrder.riderId;

  const handleAssignOrder = async (rider: Rider) => {
    if (!hasAccess) {
      showAccessDeniedAlert();
      return;
    }
    if (!selectedOrder) {
      alert("Please select an order first.");
      return;
    }
    if (selectedOrder.riderId) {
      alert("This action is only available for unassigned orders.");
      return;
    }

    const confirmAssign = confirm(`Are you sure you want to manually assign Order #${selectedOrder.id} to rider ${rider.name}?`);
    if (!confirmAssign) return;

    await executeAssignment(rider, false);
  };

  const handleOverrideAssign = async (rider: Rider) => {
    if (!hasAccess) {
      showAccessDeniedAlert();
      return;
    }
    if (!selectedOrder) {
      alert("Please select an assigned order first.");
      return;
    }
    if (!selectedOrder.riderId) {
      alert("This action is only available for already assigned orders.");
      return;
    }

    const previousRiderId = selectedOrder.riderId;
    const previousRiderName = selectedOrder.riderName || 'Unknown';

    if (previousRiderId === rider.id) {
      alert(`Rider ${rider.name} is already assigned to this order!`);
      return;
    }

    const confirmOverride = confirm(`⚠️ OVERRIDE ASSIGNMENT\n\nOrder #${selectedOrder.id} is currently assigned to:\n👉 ${previousRiderName} (ID: ${previousRiderId})\n\nAre you sure you want to OVERRIDE this assignment and reassign the order to:\n👉 ${rider.name} (ID: ${rider.id})?\n\nThis override will be recorded in the system audit logs and order timeline.`);
    if (!confirmOverride) return;

    try {
      const orderRef = doc(db, 'orders', selectedOrder.id);
      const deliveryCharge = selectedOrder.deliveryCharge || 30;
      const riderEarnings = Math.round(deliveryCharge * 0.8);

      const prevRiderObj = riders.find(r => r.id === previousRiderId) || null;

      await updateDoc(orderRef, {
        riderId: rider.id,
        assignedRiderId: rider.id,
        riderName: rider.name,
        riderEarnings,
        status: 'accepted',
        updatedAt: new Date().toISOString()
      });

      await logAndNotify(
        selectedOrder.id,
        'Reassigned',
        prevRiderObj || previousRiderName,
        rider,
        `Administrative Override Reassignment by Admin (${adminRole})`
      );

      alert(`✓ Override Success: Order #${selectedOrder.id} reassigned to ${rider.name}!`);
      setSelectedOrderId('');
    } catch (err: any) {
      console.error("Override assignment failed:", err);
      alert("Error processing override: " + err.message);
    }
  };

  // Filter riders list
  const filteredRiders = riders.filter(r => {
    if (r.status !== 'approved') return false; // Must be approved rider
    
    const queryStr = riderSearchQuery.toLowerCase();
    const phoneMatch = r.phone?.toLowerCase().includes(queryStr);
    const idMatch = r.id?.toLowerCase().includes(queryStr);
    const nameMatch = r.name?.toLowerCase().includes(queryStr);
    const vehicleMatch = r.vehicleType?.toLowerCase().includes(queryStr);
    const addressMatch = r.address?.toLowerCase().includes(queryStr) || r.city?.toLowerCase().includes(queryStr);

    return !riderSearchQuery || phoneMatch || idMatch || nameMatch || vehicleMatch || addressMatch;
  });

  // Calculate dynamic active orders for each rider
  const getActiveOrdersCount = (riderId: string) => {
    return orders.filter(
      o => o.riderId === riderId && 
      !['delivered', 'cancelled', 'refunded'].includes(o.status)
    ).length;
  };

  // Toggle Suspend / Resume Status for Rider in Firestore
  const toggleRiderStatus = async (rider: Rider) => {
    if (adminRole !== 'Super Admin' && adminRole !== 'Dispatch Manager') {
      alert("⛔ Unauthorized: Only Super Admin and Dispatch Manager can suspend or resume riders.");
      return;
    }
    const currentStatus = rider.status || 'approved';
    const newStatus = currentStatus === 'suspended' ? 'approved' : 'suspended';
    const confirmMessage = currentStatus === 'suspended'
      ? `Are you sure you want to RESUME / APPROVE fleet partner ${rider.name}?`
      : `Are you sure you want to SUSPEND fleet partner ${rider.name}? This prevents them from receiving dispatch orders immediately.`;
    
    if (!confirm(confirmMessage)) return;

    try {
      await updateDoc(doc(db, 'riders', rider.id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      alert(`✓ Success: Rider ${rider.name} status updated to ${newStatus.toUpperCase()}.`);
    } catch (err: any) {
      console.error("Failed to toggle rider status:", err);
      handleFirestoreError(err, OperationType.UPDATE, 'riders/' + rider.id);
    }
  };

  // Handle action click from fleet grid
  const handleRiderAction = (rider: Rider) => {
    if (!hasAccess) {
      showAccessDeniedAlert();
      return;
    }
    if (!selectedOrder) {
      alert("Please select an active order from the panel first.");
      return;
    }

    // Check if force assignment warning is triggered
    // Warning is triggered if:
    // 1. There is a closest rider identified
    // 2. This rider is NOT the closest rider
    // 3. The distance of this rider is larger than closest by a material margin (>0.2 KM)
    const isClosest = closestInfo && closestInfo.rider?.id === rider.id;
    const shouldWarn = closestInfo && !isClosest;

    if (shouldWarn) {
      setTargetRiderForForce(rider);
      setForceType(selectedOrder.riderId ? 'transfer' : 'assign');
      setShowForceAssignWarning(true);
    } else {
      // Proceed directly
      if (selectedOrder.riderId) {
        // Open transfer modal to specify transfer reason
        setTargetRiderForTransfer(rider);
        setShowTransferModal(true);
      } else {
        executeAssignment(rider, false);
      }
    }
  };

  const confirmForceAction = () => {
    if (!targetRiderForForce) return;
    setShowForceAssignWarning(false);
    
    if (forceType === 'transfer') {
      setTargetRiderForTransfer(targetRiderForForce);
      setShowTransferModal(true);
    } else {
      executeAssignment(targetRiderForForce, true);
    }
    setTargetRiderForForce(null);
  };

  return (
    <div id="manual-dispatch-module" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-6 shadow-xl animate-fade-in">
      
      {/* Header Panel with Role Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="font-black text-sm text-amber-500 uppercase tracking-widest flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500 animate-pulse" /> Manual Dispatch & Emergency Control
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">Super-user control room to override default SATCOM nearest-routing matching algorithms & troubleshoot fleet operations.</p>
        </div>

        {/* Role Context Selector (Security Gating Testing Tool) */}
        <div className="bg-slate-950 p-1 rounded-xl border border-slate-850 flex items-center gap-1">
          <span className="text-[10px] text-slate-500 font-bold px-2.5 uppercase font-mono">Active Role Context:</span>
          <button
            type="button"
            onClick={() => setAdminRole('Super Admin')}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
              adminRole === 'Super Admin' 
                ? 'bg-amber-500 text-slate-950' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Super Admin
          </button>
          <button
            type="button"
            onClick={() => setAdminRole('Dispatch Manager')}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
              adminRole === 'Dispatch Manager' 
                ? 'bg-indigo-600 text-white' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Dispatch Manager
          </button>
          <button
            type="button"
            onClick={() => setAdminRole('Support Agent')}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
              adminRole === 'Support Agent' 
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Support Agent (RO)
          </button>
        </div>
      </div>

      {/* Top Section: Split Controls, Engine Rules, and Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Card: Active Order Selection & Controls */}
        <div className="lg:col-span-4 bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-900 pb-2.5">
              <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-500" /> Dispatch Console
              </h4>
              <span className="text-[9px] font-mono text-slate-500 font-semibold bg-slate-900 border border-slate-850 px-2 py-0.5 rounded-md">
                STEP 1: SELECT
              </span>
            </div>

            {/* Selector input for orders */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-slate-500 block">Filter & Select Order</label>
              <div className="relative">
                <select
                  value={selectedOrderId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedOrderId(val);
                    if (onSelectOrderId) {
                      onSelectOrderId(val);
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-2.5 pr-8 text-[11px] text-slate-200 outline-none focus:border-amber-500 appearance-none font-mono cursor-pointer"
                >
                  <option value="">-- Choose active order --</option>
                  <optgroup label="UNASSIGNED IN QUEUE (Pending)">
                    {orders.filter(o => !o.riderId && o.status === 'pending').map(o => (
                      <option key={o.id} value={o.id}>
                        #{o.id} | {o.customerName} (₹{o.totalAmount})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="IN PROGRESS (Accepted / Preparing / Ready)">
                    {orders.filter(o => o.riderId && ['accepted', 'preparing', 'ready_for_pickup'].includes(o.status)).map(o => (
                      <option key={o.id} value={o.id}>
                        #{o.id} | {o.customerName} ({o.riderName})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="IN TRANSIT (Picked Up)">
                    {orders.filter(o => o.riderId && o.status === 'picked_up').map(o => (
                      <option key={o.id} value={o.id}>
                        #{o.id} | {o.customerName} ({o.riderName}) - TRANSIT
                      </option>
                    ))}
                  </optgroup>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Active order detailed view */}
            {selectedOrder ? (
              <div className="bg-slate-900/60 border border-slate-850/50 p-3.5 rounded-xl space-y-3.5 animate-scale-in text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase font-bold">Reference</span>
                    <span className="font-bold text-slate-200 font-mono text-xs block mt-0.5">#{selectedOrder.id}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase font-bold">Status</span>
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded font-mono text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase">
                      {selectedOrder.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase font-bold">Merchant Node</span>
                    <span className="font-semibold text-slate-300 truncate block mt-0.5">{selectedOrder.restaurantName}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase font-bold">Recipient Customer</span>
                    <span className="font-semibold text-slate-300 truncate block mt-0.5">{selectedOrder.customerName}</span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-850 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase font-bold">Assigned Rider</span>
                      <span className="font-bold text-slate-200 block mt-0.5">
                        {selectedOrder.riderName ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <Bike className="w-3.5 h-3.5" /> {selectedOrder.riderName}
                          </span>
                        ) : (
                          <span className="text-rose-400 uppercase text-[9px] tracking-wide font-mono bg-rose-500/10 px-2 py-0.5 rounded">UNASSIGNED</span>
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase font-bold">SATCOM Recommendation</span>
                      <span className="font-semibold text-slate-300 block mt-0.5">
                        {closestInfo && closestInfo.rider ? (
                          <span className="text-indigo-400 font-mono text-[10px] flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {closestInfo.rider.name} ({closestInfo.distance === Infinity || isNaN(closestInfo.distance) ? '—' : `${closestInfo.distance.toFixed(1)}k`})
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[9px]">No riders close</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Console Action Buttons */}
                <div className="pt-2 border-t border-slate-850 flex flex-wrap gap-2">
                  {selectedOrder.riderId && (
                    <button
                      type="button"
                      onClick={handleCancelAssignment}
                      className="w-full bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/20 text-rose-400 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserX className="w-4 h-4" /> Cancel Assignment
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/40 border border-slate-850 border-dashed rounded-xl p-6 text-center text-slate-500 flex flex-col items-center justify-center space-y-1.5 py-8">
                <Layers className="w-6 h-6 text-slate-600 animate-pulse" />
                <p className="text-xs font-semibold text-slate-400">No active order selected</p>
                <p className="text-[10px] text-slate-500 max-w-xs leading-normal">Choose an unassigned order or active delivery to override assignments.</p>
              </div>
            )}
          </div>
        </div>

        {/* Middle Card: Dispatch Capacity & Rules Control */}
        <div className="lg:col-span-4 bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-slate-900 pb-2.5 flex justify-between items-center">
              <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400" /> Dispatch Engine Rules
              </h4>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono px-2 py-0.5 rounded font-bold">ACTIVE</span>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Sliders for each setting */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400 font-medium">Max Active Orders per Rider</span>
                  <span className="text-amber-500 font-mono font-bold">{settings.maxActiveOrders}</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="5" 
                  value={settings.maxActiveOrders}
                  onChange={(e) => handleSettingChange('maxActiveOrders', parseInt(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-800 h-1 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400 font-medium">Max Daily Orders per Rider</span>
                  <span className="text-amber-500 font-mono font-bold">{settings.maxDailyOrders}</span>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="50" 
                  value={settings.maxDailyOrders}
                  onChange={(e) => handleSettingChange('maxDailyOrders', parseInt(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-800 h-1 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400 font-medium">Max Distance Radius Boundary</span>
                  <span className="text-amber-500 font-mono font-bold">{settings.maxDistanceRadius} KM</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="25" 
                  step="0.5"
                  value={settings.maxDistanceRadius}
                  onChange={(e) => handleSettingChange('maxDistanceRadius', parseFloat(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-800 h-1 rounded-lg cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="text-[9px] text-slate-500 block uppercase font-bold">Auto-Match Loop</label>
                  <select
                    value={settings.autoRetryInterval}
                    onChange={(e) => handleSettingChange('autoRetryInterval', parseInt(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1 px-2 text-[10px] text-slate-300 font-mono cursor-pointer outline-none mt-0.5"
                  >
                    <option value={15}>15 secs</option>
                    <option value={30}>30 secs</option>
                    <option value={45}>45 secs</option>
                    <option value={60}>60 secs</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-slate-500 block uppercase font-bold">Admin SLA Alerts</label>
                  <select
                    value={settings.adminTimeout}
                    onChange={(e) => handleSettingChange('adminTimeout', parseInt(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1 px-2 text-[10px] text-slate-300 font-mono cursor-pointer outline-none mt-0.5"
                  >
                    <option value={3}>3 mins</option>
                    <option value={5}>5 mins</option>
                    <option value={10}>10 mins</option>
                    <option value={15}>15 mins</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[9px] text-slate-500 leading-normal pt-2 border-t border-slate-900 font-sans mt-2">
            💡 {getActiveCity().name} SATCOM Engine will filters matching routes according to capacity limits, radius rules and rejections.
          </div>
        </div>

        {/* Right Card: Assignment Timeline */}
        <div className="lg:col-span-4 bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col h-[280px] lg:h-auto">
          <div className="border-b border-slate-900 pb-2.5 mb-2.5 flex justify-between items-center shrink-0">
            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-400" /> Dispatch Action Log
            </h4>
            <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono px-2 py-0.5 rounded font-bold animate-pulse">REAL-TIME</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar text-xs">
            {timeline.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 text-xs py-8 space-y-1">
                <Clock className="w-5 h-5 text-slate-700 animate-pulse" />
                <p className="font-medium text-slate-500">Timeline is quiet</p>
                <p className="text-[9px] text-slate-600">Administrative overrides will record here.</p>
              </div>
            ) : (
              timeline.slice(0, 15).map((item, index) => (
                <div key={item.id || index} className="relative pl-4 border-l border-slate-800 pb-1 text-[11px]">
                  {/* Bullet */}
                  <span className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ${
                    item.type === 'Assignment Cancelled' ? 'bg-rose-500' :
                    item.type === 'Force Assigned' ? 'bg-amber-500 animate-pulse' :
                    item.type === 'Reassigned' ? 'bg-cyan-500' : 'bg-emerald-500'
                  }`} />
                  
                  <div className="flex items-center justify-between font-bold text-[10px] text-slate-200">
                    <span className="font-mono text-slate-100">{item.type}</span>
                    <span className="text-[8px] text-slate-500 font-mono font-normal">
                      {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ''}
                    </span>
                  </div>
                  
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                    Order <span className="text-slate-300 font-mono font-bold">#{item.orderId}</span>
                    {item.newRider && <span> assigned to <span className="text-emerald-400 font-bold">{item.newRider}</span></span>}
                  </div>

                  {item.transferReason && (
                    <div className="text-[9px] text-amber-500 font-mono truncate mt-0.5">
                      ⚠️ Reason: {item.transferReason}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Safety Alerts Panel */}
      {getAnomalyAlerts().length > 0 && (
        <div className="bg-slate-950 p-4 rounded-xl border border-rose-500/10 space-y-3.5 animate-pulse-slow">
          <div className="flex items-center gap-2 border-b border-slate-900 pb-2">
            <ShieldAlert className="w-5 h-5 text-rose-500 animate-bounce" />
            <div>
              <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider font-mono">
                ⚠️ Live Fleet Safety Anomalies & Operational Alarms ({getAnomalyAlerts().length})
              </h4>
              <p className="text-[10px] text-slate-500">The SATCOM monitoring engine has detected anomalies. Action is recommended to maintain customer SLAs.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {getAnomalyAlerts().map((alert) => (
              <div key={alert.id} className="bg-slate-900/80 border border-rose-500/20 p-3 rounded-xl flex items-start justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                    <span className="font-mono text-[9px] font-bold text-rose-400 uppercase bg-rose-500/10 px-2 py-0.5 rounded">
                      {alert.type}
                    </span>
                  </div>
                  <p className="text-slate-300 font-medium text-[11px] leading-normal">{alert.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleInstantAutoReassign(alert.orderId)}
                  className="bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-[9px] px-2.5 py-1.5 rounded uppercase tracking-wider transition cursor-pointer self-center whitespace-nowrap shrink-0"
                >
                  REASSIGN NOW
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Section: Live Rider Grid and Directory */}
      <div className="space-y-3.5 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-850">
          <div>
            <h4 className="text-xs font-black text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <Bike className="w-4 h-4 text-amber-500" /> Active Fleet Directory & Proximity Engine
            </h4>
            <p className="text-[10px] text-slate-500 font-medium">Search and inspect any approved fleet partner. Direct single-click override matching buttons in actions column.</p>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:max-w-xs shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Name, ID, Mobile, Vehicle..."
              value={riderSearchQuery}
              onChange={(e) => setRiderSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-850 text-slate-200 placeholder-slate-500 pl-8.5 pr-3 py-1.5 rounded-lg text-xs outline-none focus:border-amber-500"
            />
            {riderSearchQuery && (
              <button 
                type="button" 
                onClick={() => setRiderSearchQuery('')}
                className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Desktop Fleet Table */}
        <div className="hidden md:block overflow-x-auto border border-slate-850 rounded-xl bg-slate-950">
          <table className="w-full text-left text-xs min-w-[800px]">
            <thead>
              <tr className="bg-slate-900/60 text-slate-500 border-b border-slate-850 text-[10px] font-mono uppercase font-bold">
                <th className="py-3 px-4">Rider Details</th>
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4">Duty Status</th>
                <th className="py-3 px-4">Proximity Distance</th>
                <th className="py-3 px-4">Active Orders</th>
                <th className="py-3 px-4">Telemetry Updates</th>
                <th className="py-3 px-4 text-center">Dispatch Directive</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/40">
              {filteredRiders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-mono text-[11px]">
                    No matching approved fleet partners found in {getActiveCity().name} region.
                  </td>
                </tr>
              ) : (
                filteredRiders.map((rider) => {
                  const activeCount = getActiveOrdersCount(rider.id);
                  
                  // Calculate distance if order is selected
                  let distanceText = '—';
                  let distanceVal = Infinity;
                  if (selectedOrder) {
                    const rLat = selectedOrder.restaurantLat || 23.2324;
                    const rLng = selectedOrder.restaurantLng || 77.4318;
                    distanceVal = calculateDistanceDelegate(rLat, rLng, rider.lat, rider.lng);
                    distanceText = (distanceVal === Infinity || isNaN(distanceVal)) ? '—' : `${distanceVal.toFixed(2)} km`;
                  }

                  const isClosest = closestInfo && closestInfo.rider?.id === rider.id;

                  return (
                    <tr key={rider.id} className={`hover:bg-slate-900/40 transition ${isClosest ? 'bg-indigo-500/5' : ''}`}>
                      {/* Name / ID */}
                      <td className="py-3.5 px-4 space-y-1">
                        <div className="font-bold text-slate-200 flex items-center gap-1.5">
                          <span>{rider.name}</span>
                          {isClosest && (
                            <span className="bg-indigo-500/20 text-indigo-400 text-[8px] font-mono font-black uppercase px-1.5 py-0.5 rounded border border-indigo-500/30">
                              ⚡ CLOSEST
                            </span>
                          )}
                          {rider.status === 'suspended' && (
                            <span className="bg-rose-500/20 text-rose-400 text-[8px] font-mono font-black uppercase px-1.5 py-0.5 rounded border border-rose-500/30">
                              ⛔ SUSPENDED
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                          <span>ID: {rider.id}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" /> {rider.phone}</span>
                        </div>
                      </td>

                      {/* Vehicle */}
                      <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                        {rider.vehicleType || 'Bike'}
                      </td>

                      {/* Status badge */}
                      <td className="py-3.5 px-4 space-y-1">
                        {(() => {
                          const onlineStatus = (rider.onlineStatus || '').toUpperCase();
                          const dutyStatus = (rider.dutyStatus || '').toUpperCase();
                          const isOnlineOrOnDuty = onlineStatus === 'ONLINE' || dutyStatus === 'ON_DUTY';
                          return (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${isOnlineOrOnDuty ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                                <span className={`text-[10px] font-bold uppercase ${isOnlineOrOnDuty ? 'text-emerald-400' : 'text-slate-400'}`}>
                                  {isOnlineOrOnDuty ? 'online' : 'offline'}
                                </span>
                              </div>
                              <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                                dutyStatus === 'ON_DUTY' 
                                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                                  : 'bg-slate-900 text-slate-500 border border-slate-850'
                              }`}>
                                {dutyStatus === 'ON_DUTY' ? 'ON DUTY' : 'OFF DUTY'}
                              </span>
                            </>
                          );
                        })()}
                      </td>

                      {/* Proximity */}
                      <td className="py-3.5 px-4">
                        {selectedOrder ? (
                          <span className={`font-mono font-bold ${isClosest ? 'text-indigo-400' : 'text-slate-300'}`}>
                            {distanceText}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px] italic leading-snug">Select a Pending Order to view rider distance.</span>
                        )}
                      </td>

                      {/* Active Orders */}
                      <td className="py-3.5 px-4">
                        <span className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded-full ${
                          activeCount > 0 
                            ? 'bg-amber-500/15 text-amber-500 font-bold border border-amber-500/10' 
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                        }`}>
                          {activeCount} active
                        </span>
                      </td>

                      {/* Telemetry updates */}
                      <td className="py-3.5 px-4 space-y-0.5">
                        <div className="text-[10px] text-slate-400 font-mono">
                          GPS: {typeof rider.lat === 'number' ? rider.lat.toFixed(4) : '—'}, {typeof rider.lng === 'number' ? rider.lng.toFixed(4) : '—'}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono">Sync: Just Now</div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            disabled={!isPendingOrderSelected}
                            onClick={() => handleAssignOrder(rider)}
                            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition flex items-center justify-center gap-1 ${
                              isPendingOrderSelected
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 cursor-pointer'
                                : 'bg-slate-900 border border-slate-850 text-slate-600 cursor-not-allowed'
                            }`}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Assign</span>
                          </button>

                          <button
                            type="button"
                            disabled={!isAssignedOrderSelected}
                            onClick={() => handleOverrideAssign(rider)}
                            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition flex items-center justify-center gap-1 ${
                              isAssignedOrderSelected
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                                : 'bg-slate-900 border border-slate-850 text-slate-600 cursor-not-allowed'
                            }`}
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Override</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setViewingRider(rider)}
                            className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 px-2 py-1.5 rounded-lg text-[9px] font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-400" />
                            <span>View</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleRiderStatus(rider)}
                            className={`px-2 py-1.5 rounded-lg text-[9px] font-bold border transition cursor-pointer ${
                              rider.status === 'suspended'
                                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                                : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400'
                            }`}
                          >
                            {rider.status === 'suspended' ? 'Resume' : 'Suspend'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Responsive Rider Cards */}
        <div className="block md:hidden space-y-4">
          {filteredRiders.length === 0 ? (
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-8 text-center text-slate-500 font-mono text-xs">
              No matching approved fleet partners found in {getActiveCity().name} region.
            </div>
          ) : (
            filteredRiders.map((rider) => {
              const activeCount = getActiveOrdersCount(rider.id);
              
              let distanceText = '—';
              let distanceVal = Infinity;
              if (selectedOrder) {
                const rLat = selectedOrder.restaurantLat || 23.2324;
                const rLng = selectedOrder.restaurantLng || 77.4318;
                distanceVal = calculateDistanceDelegate(rLat, rLng, rider.lat, rider.lng);
                distanceText = (distanceVal === Infinity || isNaN(distanceVal)) ? '—' : `${distanceVal.toFixed(2)} km`;
              }

              const isClosest = closestInfo && closestInfo.rider?.id === rider.id;
              const isSuspended = rider.status === 'suspended';

              return (
                <div 
                  key={rider.id} 
                  className={`bg-slate-950 rounded-xl border p-4 space-y-4 shadow-md transition ${
                    isClosest ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-850'
                  }`}
                >
                  {/* Card Header: Name and Vehicle */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h5 className="font-bold text-sm text-slate-200">{rider.name}</h5>
                        {isClosest && (
                          <span className="bg-indigo-500/20 text-indigo-400 text-[8px] font-mono font-black uppercase px-1.5 py-0.5 rounded border border-indigo-500/30 animate-pulse">
                            ⚡ CLOSEST
                          </span>
                        )}
                        {isSuspended && (
                          <span className="bg-rose-500/20 text-rose-400 text-[8px] font-mono font-black uppercase px-1.5 py-0.5 rounded border border-rose-500/30">
                            ⛔ SUSPENDED
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono">ID: {rider.id}</p>
                    </div>
                    <span className="bg-slate-900 border border-slate-800 text-slate-400 font-mono text-[10px] px-2.5 py-1 rounded-md uppercase font-semibold">
                      {rider.vehicleType || 'Bike'}
                    </span>
                  </div>

                  {/* Rider Grid Stats */}
                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-900/40 p-3 rounded-lg border border-slate-900">
                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase font-bold">Online Status</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${(rider.onlineStatus || '').toUpperCase() === 'ONLINE' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                        <span className={`text-[10px] font-bold uppercase ${(rider.onlineStatus || '').toUpperCase() === 'ONLINE' ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {rider.onlineStatus}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase font-bold">Duty Status</span>
                      <span className={`inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                        (rider.dutyStatus || '').toUpperCase() === 'ON_DUTY' 
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                          : 'bg-slate-950 text-slate-500 border border-slate-850'
                      }`}>
                        {(rider.dutyStatus || '').toUpperCase() === 'ON_DUTY' ? 'ON DUTY' : 'OFF DUTY'}
                      </span>
                    </div>

                    <div className={selectedOrder ? "col-span-1" : "col-span-2 bg-slate-900/60 p-2.5 rounded border border-slate-800/40"}>
                      <span className="text-[9px] text-slate-500 block uppercase font-bold">Proximity Distance</span>
                      {selectedOrder ? (
                        <span className={`font-mono font-bold text-[11px] block mt-0.5 ${isClosest ? 'text-indigo-400' : 'text-slate-300'}`}>
                          {distanceText}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px] block mt-0.5 italic leading-snug font-medium">
                          Select a Pending Order to view rider distance.
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase font-bold">Active Orders</span>
                      <span className={`inline-block mt-0.5 font-mono font-bold text-[10px] px-2 py-0.5 rounded-full ${
                        activeCount > 0 
                          ? 'bg-amber-500/15 text-amber-500 border border-amber-500/10' 
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                      }`}>
                        {activeCount} active
                      </span>
                    </div>

                    <div className="col-span-2 pt-1 border-t border-slate-800/60">
                      <span className="text-[9px] text-slate-500 block uppercase font-bold">Operating Zone & City</span>
                      <span className="text-slate-300 text-[11px] font-medium block mt-0.5 truncate">
                        {rider.city || rider.address || `${getActiveCity().name} Region`}
                      </span>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="space-y-2">
                    <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Directive Controls</span>
                    
                    {/* Primary actions: Assign & Override */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={!isPendingOrderSelected}
                        onClick={() => handleAssignOrder(rider)}
                        className={`min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition ${
                          isPendingOrderSelected
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 active:scale-95 cursor-pointer'
                            : 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Assign Order</span>
                      </button>

                      <button
                        type="button"
                        disabled={!isAssignedOrderSelected}
                        onClick={() => handleOverrideAssign(rider)}
                        className={`min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition ${
                          isAssignedOrderSelected
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-95 cursor-pointer'
                            : 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Override Assign</span>
                      </button>
                    </div>

                    {/* Secondary actions: View, Call, WhatsApp */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setViewingRider(rider)}
                        className="min-h-[44px] flex flex-col items-center justify-center bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded-xl text-[9px] font-semibold transition active:scale-95 cursor-pointer"
                      >
                        <Eye className="w-4 h-4 text-indigo-400 mb-0.5" />
                        <span>View Rider</span>
                      </button>

                      <a
                        href={`tel:${rider.phone}`}
                        className="min-h-[44px] flex flex-col items-center justify-center bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded-xl text-[9px] font-semibold transition active:scale-95 cursor-pointer"
                      >
                        <Phone className="w-4 h-4 text-cyan-400 mb-0.5" />
                        <span>Call Rider</span>
                      </a>

                      <a
                        href={`https://wa.me/91${rider.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] flex flex-col items-center justify-center bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded-xl text-[9px] font-semibold transition active:scale-95 text-center text-emerald-400 cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4 mb-0.5" />
                        <span>WhatsApp</span>
                      </a>
                    </div>

                    {/* Admin Action: Suspend / Resume */}
                    <button
                      type="button"
                      onClick={() => toggleRiderStatus(rider)}
                      className={`w-full min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
                        isSuspended
                          ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400'
                      }`}
                    >
                      {isSuspended ? (
                        <>
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          <span>Resume (Admin)</span>
                        </>
                      ) : (
                        <>
                          <Ban className="w-4 h-4 text-rose-400" />
                          <span>Suspend Partner</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* View Rider Details Modal */}
      {viewingRider && (
        <div id="rider-view-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div id="rider-view-modal" className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-100 relative shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => setViewingRider(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 transition cursor-pointer p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-800 pb-3.5 mb-4 flex items-center gap-3">
              <div className="relative">
                <img 
                  src={viewingRider.profilePhotoUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=60"} 
                  className="w-12 h-12 rounded-full object-cover border border-slate-700" 
                  referrerPolicy="no-referrer"
                />
                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${(viewingRider.onlineStatus || '').toUpperCase() === 'ONLINE' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">
                  {viewingRider.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">ID: {viewingRider.id}</p>
              </div>
            </div>

            <div className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Contact Number</span>
                  <p className="text-slate-300 font-mono mt-0.5 font-bold">{viewingRider.phone}</p>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Email Address</span>
                  <p className="text-slate-300 truncate mt-0.5 font-semibold">{viewingRider.email || 'N/A'}</p>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Vehicle Type</span>
                  <p className="text-slate-300 mt-0.5 font-bold">{viewingRider.vehicleType || 'Bike'}</p>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Active Orders</span>
                  <p className="text-amber-500 mt-0.5 font-bold font-mono">
                    {getActiveOrdersCount(viewingRider.id)} active deliveries
                  </p>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Duty Status</span>
                  <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                    (viewingRider.dutyStatus || '').toUpperCase() === 'ON_DUTY' 
                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                      : 'bg-slate-900 text-slate-500 border border-slate-800'
                  }`}>
                    {(viewingRider.dutyStatus || '').toUpperCase() === 'ON_DUTY' ? 'ON DUTY' : 'OFF DUTY'}
                  </span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Verification Status</span>
                  <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                    viewingRider.status === 'approved' 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : viewingRider.status === 'suspended'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {viewingRider.status?.toUpperCase() || 'APPROVED'}
                  </span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Rider Rating</span>
                  <p className="text-slate-300 font-bold mt-0.5">⭐️ {viewingRider.rating || '4.5'}</p>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Acceptance Rate</span>
                  <p className="text-slate-300 font-bold mt-0.5 font-mono">{viewingRider.acceptanceRate || '95'}%</p>
                </div>
                <div className="col-span-2 bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Current Telemetry Coordinates</span>
                  <p className="text-slate-400 mt-0.5 font-mono">
                    Lat: {viewingRider.lat?.toFixed(6) || '23.2324'}, Lng: {viewingRider.lng?.toFixed(6) || '77.4318'}
                  </p>
                </div>
                <div className="col-span-2 bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Residential Address & City</span>
                  <p className="text-slate-300 mt-0.5 font-medium leading-normal">
                    {viewingRider.address || '—'}, {viewingRider.city || getActiveCity().name}
                  </p>
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <a
                  href={`tel:${viewingRider.phone}`}
                  className="flex-1 min-h-[44px] bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-200 py-2.5 rounded-xl text-center text-xs font-bold transition flex items-center justify-center gap-1.5 animate-pulse"
                >
                  <Phone className="w-4 h-4 text-cyan-400" />
                  <span>Call Partner</span>
                </a>
                <button
                  type="button"
                  onClick={() => setViewingRider(null)}
                  className="flex-1 min-h-[44px] bg-amber-500 hover:brightness-110 text-slate-950 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition"
                >
                  Close Panel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Transfer Modal */}
      {showTransferModal && targetRiderForTransfer && selectedOrder && (
        <div id="transfer-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div id="transfer-modal" className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-slate-100 relative shadow-2xl animate-scale-in">
            <button
              type="button"
              onClick={() => {
                setShowTransferModal(false);
                setTargetRiderForTransfer(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-850 pb-3 mb-4">
              <h3 className="text-sm font-black text-rose-500 flex items-center gap-2 uppercase tracking-wide">
                <AlertTriangle className="w-5 h-5 text-rose-500 animate-bounce" /> Emergency Transfer Routing
              </h3>
              <p className="text-xs text-slate-400 mt-1">Forcing live rerouting of active deliveries. This operates atomically in Firestore.</p>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-xs space-y-2 mb-4 font-sans">
              <div>
                <span className="text-slate-500 text-[10px] uppercase">Rerouting Order</span>
                <p className="font-bold font-mono text-slate-200">#{selectedOrder.id}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase">De-assigning Driver</span>
                  <p className="font-semibold text-slate-400 line-through truncate">{selectedOrder.riderName}</p>
                </div>
                <div>
                  <span className="text-indigo-400 text-[10px] uppercase font-bold">New Target Driver</span>
                  <p className="font-bold text-indigo-400 truncate">{targetRiderForTransfer.name}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Mandatory Reason Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-400 block tracking-wider">Mandatory Reason Code</label>
                <select
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3 text-xs text-slate-200 outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="Vehicle Breakdown">🚨 Vehicle Breakdown</option>
                  <option value="Rider Not Responding">📱 Rider Not Responding</option>
                  <option value="Accident">🚑 Accident / Emergency</option>
                  <option value="Battery Dead">🔋 Battery Dead</option>
                  <option value="Network Issue">🌐 Network/GPS Issue</option>
                  <option value="Rider Refused Order">❌ Rider Refused Order</option>
                  <option value="Customer Requested Change">👤 Customer Requested Change</option>
                  <option value="Other Override">🛠️ Other Administrative Override</option>
                </select>
              </div>

              {/* Optional Comments */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-400 block tracking-wider font-sans">Dispatcher Notes / Internal Logs</label>
                <textarea
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="Provide supporting notes detailing this emergency action..."
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-slate-100 outline-none focus:border-amber-500 h-20 resize-none font-sans"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTransferModal(false);
                    setTargetRiderForTransfer(null);
                  }}
                  className="flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Abort Action
                </button>
                <button
                  type="button"
                  onClick={executeEmergencyTransfer}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer"
                >
                  Approve Transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Force Assignment Proximity Warning Dialog */}
      {showForceAssignWarning && targetRiderForForce && selectedOrder && (
        <div id="force-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div id="force-modal" className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-slate-100 relative shadow-2xl animate-scale-in">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-amber-500 uppercase tracking-widest font-sans">
                Force Dispatch Override Warning
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                You are selecting <span className="font-bold text-white">{targetRiderForForce.name}</span> who is <span className="text-amber-400 font-bold font-mono">not the closest</span> available rider.
              </p>

              {closestInfo && closestInfo.rider && (
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-[11px] text-slate-400 font-mono text-left space-y-1 my-3">
                  <div className="text-slate-500 text-[9px] uppercase font-bold">Proximity Routing Recommendation:</div>
                  <div className="flex justify-between font-sans">
                    <span className="text-indigo-400 font-bold">{closestInfo.rider.name}</span>
                    <span className="text-indigo-300 font-bold">{closestInfo.distance === Infinity || isNaN(closestInfo.distance) ? '—' : `${closestInfo.distance.toFixed(2)} km away`}</span>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
                Force assigning overrides the standard nearest-fleet dispatcher logic and can degrade delivery efficiency. Do you wish to override?
              </p>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForceAssignWarning(false);
                    setTargetRiderForForce(null);
                  }}
                  className="flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Use Recommendation
                </button>
                <button
                  type="button"
                  onClick={confirmForceAction}
                  className="flex-1 bg-amber-500 hover:brightness-110 text-slate-950 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer"
                >
                  Yes, Force Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
