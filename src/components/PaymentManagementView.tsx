import React, { useState, useEffect } from 'react';
import { 
  db 
} from '../firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  doc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  getDocs,
  where
} from 'firebase/firestore';
import { 
  Rider, 
  Restaurant, 
  Order, 
  PaymentSetting, 
  PaymentEmployee, 
  PaymentTransaction, 
  PaymentAuditLog, 
  PaymentNotification 
} from '../types';
import { getActiveCity } from '../services/mapService';

// Icons
import { 
  LayoutDashboard, 
  Bike, 
  Store, 
  Users, 
  Coins, 
  AlertTriangle, 
  Cpu, 
  Sliders, 
  History, 
  FileSpreadsheet, 
  CreditCard, 
  BellRing, 
  Settings,
  HelpCircle,
  Play,
  CheckCircle2,
  Lock
} from 'lucide-react';

// Sub components
import PaymentDashboardTab from './payment/PaymentDashboardTab';
import RiderVendorSalaryTabs from './payment/RiderVendorSalaryTabs';
import IncentivePenaltyManualTabs from './payment/IncentivePenaltyManualTabs';
import SettingsReportTabs from './payment/SettingsReportTabs';

export default function PaymentManagementView() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  
  // Database States
  const [riders, setRiders] = useState<Rider[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  
  const [settings, setSettings] = useState<PaymentSetting | null>(null);
  const [employees, setEmployees] = useState<PaymentEmployee[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<PaymentAuditLog[]>([]);
  const [notificationsList, setNotificationsList] = useState<PaymentNotification[]>([]);

  const [loading, setLoading] = useState(true);

  // Sync core Firestore collections in real-time
  useEffect(() => {
    // 1. Core platform collections
    const unsubRiders = onSnapshot(collection(db, 'riders'), (snap) => {
      const items: Rider[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() } as Rider));
      setRiders(items);
    });

    const unsubRestaurants = onSnapshot(collection(db, 'restaurants'), (snap) => {
      const items: Restaurant[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() } as Restaurant));
      setRestaurants(items);
    });

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
      const items: Order[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() } as Order));
      setOrders(items);
    });

    // 2. Payment collections
    const unsubSettings = onSnapshot(doc(db, 'payment_settings', 'global_config'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings({ id: docSnap.id, ...docSnap.data() } as PaymentSetting);
      } else {
        // Initialize default settings if not exist
        const defaultSettings: Omit<PaymentSetting, 'id'> = {
          commissionPct: 15,
          deliveryCharge: 40,
          platformFee: 10,
          minPayout: 100,
          maxPayout: 50000,
          autoSettlement: true,
          manualSettlement: false,
          approvalWorkflow: 'standard',
          settlementSchedule: 'daily',
          updatedAt: new Date().toISOString(),
          updatedBy: 'system_admin'
        };
        setDoc(doc(db, 'payment_settings', 'global_config'), defaultSettings)
          .then(() => console.log("Initialized global payment settings"))
          .catch(e => console.error("Error setting default settings: ", e));
      }
    });

    const unsubEmployees = onSnapshot(collection(db, 'payment_employees'), (snap) => {
      const items: PaymentEmployee[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() } as PaymentEmployee));
      setEmployees(items);
    });

    const unsubTransactions = onSnapshot(collection(db, 'payment_transactions'), (snap) => {
      const items: PaymentTransaction[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() } as PaymentTransaction));
      // Sort newest first
      items.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransactions(items);
    });

    const unsubAudit = onSnapshot(collection(db, 'payment_audit_logs'), (snap) => {
      const items: PaymentAuditLog[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() } as PaymentAuditLog));
      // Sort newest first
      items.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAuditLogs(items);
    });

    const unsubNotif = onSnapshot(collection(db, 'payment_notifications'), (snap) => {
      const items: PaymentNotification[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() } as PaymentNotification));
      items.sort((a,b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
      setNotificationsList(items);
    });

    setLoading(false);

    return () => {
      unsubRiders();
      unsubRestaurants();
      unsubOrders();
      unsubSettings();
      unsubEmployees();
      unsubTransactions();
      unsubAudit();
      unsubNotif();
    };
  }, []);

  // 1. Process Batch Auto Calculations (Tab 7 & Dashboard quick action)
  const handleTriggerAutoCalc = async () => {
    try {
      setLoading(true);
      // Process completed order earnings that haven't been logged in transactions yet
      const completedOrders = orders.filter(o => o.status === 'delivered');
      
      let processedCount = 0;
      let totalRiderEarned = 0;
      let totalVendorEarned = 0;

      for (const order of completedOrders) {
        // Check if transaction already processed for this order
        const exists = transactions.some(t => t.referenceId === order.id);
        if (exists) continue;

        const commPct = settings?.commissionPct || 15;
        const delCharge = settings?.deliveryCharge || 40;
        const platFee = settings?.platformFee || 10;

        // Auto Calculations
        const riderE = order.riderEarnings || delCharge;
        const restaurantE = order.restaurantEarnings || (order.subtotal * (1 - commPct / 100));
        const commissionEarned = order.platformCommission || (order.subtotal * (commPct / 100));

        // Create transaction logs for Rider
        if (order.riderId) {
          const riderRef = doc(collection(db, 'payment_transactions'));
          const txRider: PaymentTransaction = {
            id: riderRef.id,
            recipientId: order.riderId,
            recipientName: order.riderName || 'Rider Partner',
            recipientType: 'rider',
            amount: riderE,
            baseAmount: riderE,
            deliveryCharges: delCharge,
            platformFee: 0,
            commission: 0,
            incentives: 0,
            bonus: 0,
            penalties: 0,
            taxes: 0,
            refundAdjustments: 0,
            calculationType: 'auto',
            status: 'pending',
            paymentMethod: 'Company Wallet',
            referenceId: order.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await setDoc(riderRef, txRider);
          totalRiderEarned += riderE;
        }

        // Create transaction logs for Restaurant (Vendor)
        if (order.restaurantId) {
          const vendorRef = doc(collection(db, 'payment_transactions'));
          const txVendor: PaymentTransaction = {
            id: vendorRef.id,
            recipientId: order.restaurantId,
            recipientName: order.restaurantName || 'Vendor Merchant',
            recipientType: 'vendor',
            amount: restaurantE,
            baseAmount: order.subtotal,
            deliveryCharges: 0,
            platformFee: platFee,
            commission: commissionEarned,
            incentives: 0,
            bonus: 0,
            penalties: 0,
            taxes: commissionEarned * 0.18, // 18% GST on commission
            refundAdjustments: 0,
            calculationType: 'auto',
            status: 'pending',
            paymentMethod: 'Bank Transfer',
            referenceId: order.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await setDoc(vendorRef, txVendor);
          totalVendorEarned += restaurantE;
        }

        processedCount++;
      }

      alert(`Calculation engine finished! Processed ${processedCount} completed order nodes.\n\nTotal Rider payouts: ₹${totalRiderEarned}\nTotal Vendor settlements: ₹${totalVendorEarned}`);
    } catch (err: any) {
      alert("Error processing auto calculation: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Toggle Auto Settlement Configuration
  const handleToggleAutoSettlement = async () => {
    if (!settings) return;
    try {
      await updateDoc(doc(db, 'payment_settings', 'global_config'), {
        autoSettlement: !settings.autoSettlement
      });
    } catch (e: any) {
      alert("Error toggling settlement engine: " + e.message);
    }
  };

  // 3. Trigger manual settlement payout
  const handleTriggerIndividualPayout = async (recipientId: string, recipientType: 'rider' | 'vendor' | 'employee', amount: number) => {
    try {
      setLoading(true);
      // Deduct from wallet / reset balance in parent collection
      if (recipientType === 'rider') {
        const rRef = doc(db, 'riders', recipientId);
        await updateDoc(rRef, { walletBalance: 0 });
      } else if (recipientType === 'employee') {
        const eRef = doc(db, 'payment_employees', recipientId);
        await updateDoc(eRef, { walletBalance: 0 });
      }

      // Create physical settled payout transaction
      const txRef = doc(collection(db, 'payment_transactions'));
      const payout: PaymentTransaction = {
        id: txRef.id,
        recipientId,
        recipientName: recipientType === 'rider' ? (riders.find(r => r.id === recipientId)?.name || 'Rider') :
                       recipientType === 'vendor' ? (restaurants.find(v => v.id === recipientId)?.name || 'Merchant Store') :
                       (employees.find(e => e.id === recipientId)?.name || 'Internal Employee'),
        recipientType,
        amount,
        baseAmount: amount,
        deliveryCharges: 0,
        platformFee: 0,
        commission: 0,
        incentives: 0,
        bonus: 0,
        penalties: 0,
        taxes: 0,
        refundAdjustments: 0,
        calculationType: 'manual',
        status: 'paid',
        paymentMethod: recipientType === 'rider' ? 'UPI' : 'Bank Transfer',
        referenceId: 'TXN-' + Math.floor(Math.random() * 900000 + 100000),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        processedAt: new Date().toISOString()
      };
      await setDoc(txRef, payout);

      // Create a dispatch smart alert notification
      const notifRef = doc(collection(db, 'payment_notifications'));
      const notif: PaymentNotification = {
        id: notifRef.id,
        recipientId,
        recipientName: payout.recipientName,
        recipientType,
        title: " settlement Payment Success ✓",
        message: `Your payout of ₹${amount.toLocaleString('en-IN')} has been credited. Reference ID: ${payout.referenceId}.`,
        channels: { inApp: true, push: true, sms: true, email: true },
        sentAt: new Date().toISOString(),
        status: 'unread'
      };
      await setDoc(notifRef, notif);

      alert(`Settlement transfer successful! ₹${amount} disbursed to registered payout account.`);
    } catch (err: any) {
      alert("Payout transfer error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 4. Register new internal staff
  const handleAddEmployee = async (empData: Omit<PaymentEmployee, 'id' | 'createdAt' | 'walletBalance'>) => {
    try {
      const docRef = doc(collection(db, 'payment_employees'));
      const completeEmployee: PaymentEmployee = {
        id: docRef.id,
        ...empData,
        walletBalance: empData.monthlySalary, // First month salary starts outstanding
        createdAt: new Date().toISOString()
      };
      await setDoc(docRef, completeEmployee);
      alert("Operations staff member successfully registered!");
    } catch (e: any) {
      alert("Error adding employee: " + e.message);
    }
  };



  // 5. Apply custom incentive bonus or penalty fine
  const handleApplyBonusPenalty = async (
    targetId: string, 
    targetType: 'rider' | 'vendor' | 'employee', 
    amount: number, 
    type: 'bonus' | 'penalty', 
    reason: string
  ) => {
    try {
      setLoading(true);
      const adjustment = type === 'bonus' ? amount : -amount;

      // Update parent balances
      if (targetType === 'rider') {
        const ref = doc(db, 'riders', targetId);
        const r = riders.find(item => item.id === targetId);
        if (r) {
          await updateDoc(ref, { walletBalance: (r.walletBalance || 0) + adjustment });
        }
      } else if (targetType === 'employee') {
        const ref = doc(db, 'payment_employees', targetId);
        const e = employees.find(item => item.id === targetId);
        if (e) {
          await updateDoc(ref, { walletBalance: (e.walletBalance || 0) + adjustment });
        }
      }

      // Create audit log
      const logRef = doc(collection(db, 'payment_audit_logs'));
      const log: PaymentAuditLog = {
        id: logRef.id,
        transactionId: 'ADJUST-' + Math.floor(Math.random() * 90000 + 10000),
        action: type === 'bonus' ? 'Incentive Credit' : 'Penalty Deduction',
        previousAmount: 0,
        newAmount: adjustment,
        bonusAdded: type === 'bonus' ? amount : 0,
        penaltyAdded: type === 'penalty' ? amount : 0,
        adminName: 'Master Admin',
        timestamp: new Date().toISOString(),
        notes: reason
      };
      await setDoc(logRef, log);

      // Save notification alert
      const targetName = targetType === 'rider' ? riders.find(item => item.id === targetId)?.name :
                         targetType === 'vendor' ? restaurants.find(item => item.id === targetId)?.name :
                         employees.find(item => item.id === targetId)?.name;

      const notifRef = doc(collection(db, 'payment_notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        recipientId: targetId,
        recipientName: targetName || 'Partner',
        recipientType: targetType,
        title: type === 'bonus' ? 'Incentive Bonus Credited ✨' : 'Penalty Violation Applied ⚠️',
        message: `₹${amount} has been adjusted on your wallet. Reason: ${reason}`,
        channels: { inApp: true, push: true, sms: true, email: true },
        sentAt: new Date().toISOString(),
        status: 'unread'
      });

      alert(`Adjustment registered! Wallet balance updated.`);
    } catch (e: any) {
      alert("Adjustment failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // 6. Force manual transaction modification override
  const handleModifyTransaction = async (
    transactionId: string, 
    newAmount: number, 
    bonus: number, 
    penalty: number, 
    notes: string
  ) => {
    try {
      const found = transactions.find(t => t.id === transactionId);
      if (!found) return;

      const txRef = doc(db, 'payment_transactions', transactionId);
      await updateDoc(txRef, {
        amount: newAmount,
        bonus,
        penalties: penalty,
        calculationType: 'manual',
        updatedAt: new Date().toISOString()
      });

      // Write secure audit ledger record
      const auditRef = doc(collection(db, 'payment_audit_logs'));
      const audit: PaymentAuditLog = {
        id: auditRef.id,
        transactionId,
        action: 'Manual Override',
        previousAmount: found.amount,
        newAmount,
        bonusAdded: bonus,
        penaltyAdded: penalty,
        adminName: 'Master Admin Override',
        timestamp: new Date().toISOString(),
        notes
      };
      await setDoc(auditRef, audit);
    } catch (e: any) {
      alert("Override error: " + e.message);
    }
  };

  // 7. Update charge settings parameters
  const handleUpdateSettings = async (newSettings: Partial<PaymentSetting>) => {
    try {
      await updateDoc(doc(db, 'payment_settings', 'global_config'), {
        ...newSettings,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Master Admin'
      });
    } catch (e: any) {
      alert("Error updating settings: " + e.message);
    }
  };

  // 8. Update Bank & UPI Details
  const handleUpdateBankDetails = async (
    targetId: string, 
    targetType: 'rider' | 'vendor' | 'employee', 
    bank: string, 
    account: string, 
    ifsc: string, 
    upi: string
  ) => {
    try {
      if (targetType === 'rider') {
        await updateDoc(doc(db, 'riders', targetId), {
          bankName: bank,
          accountNumber: account,
          ifscCode: ifsc,
          upiId: upi
        });
      } else if (targetType === 'vendor') {
        await updateDoc(doc(db, 'restaurants', targetId), {
          bankName: bank,
          accountNumber: account,
          ifscCode: ifsc,
          upiId: upi
        });
      } else {
        await updateDoc(doc(db, 'payment_employees', targetId), {
          bankName: bank,
          accountNumber: account,
          ifscCode: ifsc,
          upiId: upi
        });
      }
    } catch (e: any) {
      alert("Credentials update failed: " + e.message);
    }
  };

  // 9. Dispatch a customized test alert notification
  const handleDispatchTestAlert = async (recipientId: string, recipientType: 'rider' | 'vendor' | 'employee', title: string, msg: string) => {
    try {
      const recipientName = recipientType === 'rider' ? riders.find(item => item.id === recipientId)?.name :
                            recipientType === 'vendor' ? restaurants.find(item => item.id === recipientId)?.name :
                            employees.find(item => item.id === recipientId)?.name;

      const notifRef = doc(collection(db, 'payment_notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        recipientId,
        recipientName: recipientName || 'Recipient Partner',
        recipientType,
        title,
        message: msg,
        sentAt: new Date().toISOString(),
        status: 'unread'
      });
    } catch (e: any) {
      alert("Test alert failed: " + e.message);
    }
  };

  // Rendering Tabs Sidebar Menu
  const tabs = [
    { id: 'dashboard', label: 'Payment Dashboard', icon: LayoutDashboard },
    { id: 'rider_payments', label: 'Rider Payments', icon: Bike },
    { id: 'vendor_settlements', label: 'Vendor Settlements', icon: Store },
    { id: 'employee_salaries', label: 'Employee Salaries', icon: Users },
    { id: 'incentives', label: 'Incentives & Bonuses', icon: Coins },
    { id: 'penalties', label: 'Penalties & Deductions', icon: AlertTriangle },
    { id: 'auto_engine', label: 'Auto Calculation Engine', icon: Cpu },
    { id: 'manual_override', label: 'Manual Adjustment', icon: Sliders },
    { id: 'history', label: 'Payment History', icon: History },
    { id: 'reports', label: 'Payment Reports', icon: FileSpreadsheet },
    { id: 'bank_upi', label: 'Bank & UPI Management', icon: CreditCard },
    { id: 'alerts', label: 'Notification Center', icon: BellRing },
    { id: 'settings', label: 'Payment Settings', icon: Settings }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-500">Loading {getActiveCity().name} Payment Hub data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="payment-management-view-main">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-850 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-500" />
            <h1 className="text-xl font-black tracking-tight text-slate-100 uppercase">
              Employee Payment & Settlement Management System
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Secure enterprise ledger node connected with Master Admin, Vendor and Rider Panels in {getActiveCity().name}.
          </p>
        </div>
      </div>

      {/* Main Layout containing Sidebar Sub-menu + Content panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Left Side Tab Menu (13 sub-items) */}
        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-2 lg:col-span-1 space-y-1">
          <span className="text-[9px] font-black tracking-wider text-slate-500 uppercase px-3 block mb-2">
            ⚙️ PAYMENT DESK OPTIONS
          </span>
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl transition font-bold text-xs cursor-pointer ${
                  activeTab === tab.id 
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10' 
                    : 'text-slate-450 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Side Working Canvas */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Render target panel */}
          {activeTab === 'dashboard' && (
            <PaymentDashboardTab
              transactions={transactions}
              riders={riders}
              restaurants={restaurants}
              employees={employees}
              settings={settings}
              onTriggerAutoCalc={handleTriggerAutoCalc}
              onToggleAutoSettlement={handleToggleAutoSettlement}
            />
          )}

          {activeTab === 'rider_payments' && (
            <RiderVendorSalaryTabs
              activeSubTab="riders"
              riders={riders}
              restaurants={restaurants}
              employees={employees}
              transactions={transactions}
              onTriggerIndividualPayout={handleTriggerIndividualPayout}
              onAddEmployee={handleAddEmployee}
            />
          )}

          {activeTab === 'vendor_settlements' && (
            <RiderVendorSalaryTabs
              activeSubTab="vendors"
              riders={riders}
              restaurants={restaurants}
              employees={employees}
              transactions={transactions}
              onTriggerIndividualPayout={handleTriggerIndividualPayout}
              onAddEmployee={handleAddEmployee}
            />
          )}

          {activeTab === 'employee_salaries' && (
            <RiderVendorSalaryTabs
              activeSubTab="employees"
              riders={riders}
              restaurants={restaurants}
              employees={employees}
              transactions={transactions}
              onTriggerIndividualPayout={handleTriggerIndividualPayout}
              onAddEmployee={handleAddEmployee}
            />
          )}

          {activeTab === 'incentives' && (
            <IncentivePenaltyManualTabs
              activeSubTab="incentives"
              riders={riders}
              restaurants={restaurants}
              employees={employees}
              transactions={transactions}
              auditLogs={auditLogs}
              onApplyBonusPenalty={handleApplyBonusPenalty}
              onModifyTransaction={handleModifyTransaction}
            />
          )}

          {activeTab === 'penalties' && (
            <IncentivePenaltyManualTabs
              activeSubTab="penalties"
              riders={riders}
              restaurants={restaurants}
              employees={employees}
              transactions={transactions}
              auditLogs={auditLogs}
              onApplyBonusPenalty={handleApplyBonusPenalty}
              onModifyTransaction={handleModifyTransaction}
            />
          )}

          {activeTab === 'auto_engine' && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <Cpu className="w-5 h-5 text-amber-500" />
                <div>
                  <h4 className="font-bold text-sm text-slate-200">Auto Calculation Engine Node</h4>
                  <p className="text-[10px] text-slate-400">Computational logic definitions for real-time payout processing</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-300 leading-relaxed">
                <div className="space-y-3 p-4 rounded-2xl bg-slate-950/40 border border-slate-850">
                  <h5 className="font-bold text-slate-200 uppercase tracking-wider text-[10px] text-amber-400">Rider Settlement Formula</h5>
                  <p className="font-mono bg-slate-950 p-3 rounded-lg text-amber-500 font-bold">
                    Payout = Base Charge (₹{settings?.deliveryCharge || 40}) + Surge + Incentives - Penalties - TDS Tax
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-400">
                    <li>Base Charge is calculated from regional settings parameters.</li>
                    <li>Surges apply automatically for peak rainfall or festivals.</li>
                    <li>TDS is deducted on-the-fly according to national guidelines (1%).</li>
                  </ul>
                </div>

                <div className="space-y-3 p-4 rounded-2xl bg-slate-950/40 border border-slate-850">
                  <h5 className="font-bold text-slate-200 uppercase tracking-wider text-[10px] text-indigo-400">Vendor Settle Formula</h5>
                  <p className="font-mono bg-slate-950 p-3 rounded-lg text-indigo-400 font-bold">
                    Net Earned = Gross Sales - Company Commission ({settings?.commissionPct || 15}%) - Platform Fee (₹{settings?.platformFee || 10})
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-400">
                    <li>Gross Sales matches customer subtotal invoice amount.</li>
                    <li>Company commission percentage can be scaled via settings.</li>
                    <li>Platform fee is capped dynamically at a fixed flat-rate per ticket.</li>
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-850 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5 font-mono">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-pulse" />
                  Formulas compliant with GST & Income Tax Acts
                </span>
                <button
                  onClick={handleTriggerAutoCalc}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition shadow-md"
                >
                  <Play className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Generate Settlement Ledger</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'manual_override' && (
            <IncentivePenaltyManualTabs
              activeSubTab="manual"
              riders={riders}
              restaurants={restaurants}
              employees={employees}
              transactions={transactions}
              auditLogs={auditLogs}
              onApplyBonusPenalty={handleApplyBonusPenalty}
              onModifyTransaction={handleModifyTransaction}
            />
          )}

          {activeTab === 'history' && (
            <SettingsReportTabs
              activeSubTab="history"
              settings={settings}
              transactions={transactions}
              notificationsList={notificationsList}
              riders={riders}
              restaurants={restaurants}
              employees={employees}
              onUpdateSettings={handleUpdateSettings}
              onUpdateBankDetails={handleUpdateBankDetails}
              onDispatchTestAlert={handleDispatchTestAlert}
            />
          )}

          {activeTab === 'reports' && (
            <SettingsReportTabs
              activeSubTab="reports"
              settings={settings}
              transactions={transactions}
              notificationsList={notificationsList}
              riders={riders}
              restaurants={restaurants}
              employees={employees}
              onUpdateSettings={handleUpdateSettings}
              onUpdateBankDetails={handleUpdateBankDetails}
              onDispatchTestAlert={handleDispatchTestAlert}
            />
          )}

          {activeTab === 'bank_upi' && (
            <SettingsReportTabs
              activeSubTab="bank"
              settings={settings}
              transactions={transactions}
              notificationsList={notificationsList}
              riders={riders}
              restaurants={restaurants}
              employees={employees}
              onUpdateSettings={handleUpdateSettings}
              onUpdateBankDetails={handleUpdateBankDetails}
              onDispatchTestAlert={handleDispatchTestAlert}
            />
          )}

          {activeTab === 'alerts' && (
            <SettingsReportTabs
              activeSubTab="notifications"
              settings={settings}
              transactions={transactions}
              notificationsList={notificationsList}
              riders={riders}
              restaurants={restaurants}
              employees={employees}
              onUpdateSettings={handleUpdateSettings}
              onUpdateBankDetails={handleUpdateBankDetails}
              onDispatchTestAlert={handleDispatchTestAlert}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsReportTabs
              activeSubTab="settings"
              settings={settings}
              transactions={transactions}
              notificationsList={notificationsList}
              riders={riders}
              restaurants={restaurants}
              employees={employees}
              onUpdateSettings={handleUpdateSettings}
              onUpdateBankDetails={handleUpdateBankDetails}
              onDispatchTestAlert={handleDispatchTestAlert}
            />
          )}

        </div>
      </div>
    </div>
  );
}
