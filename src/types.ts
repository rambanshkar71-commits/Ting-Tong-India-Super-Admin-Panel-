export interface SystemSettings {
  id?: string;
  companyName: string;
  supportPhone: string;
  supportEmail: string;
  baseCharge: number;
  perKmCharge: number;
  minOrderCharge: number;
  peakCharge: number;
  nightCharge: number;
  rainCharge: number;
  festivalCharge: number;
  freeDeliveryMinAmount: number;
  restaurantCommissionPct: number;
  riderCommissionPct: number;
  maintenanceMode: boolean;
  appVersion: string;
  gstNo: string;
  fssaiNo: string;
  address: string;
  privacyPolicy: string;
  terms: string;
}

export interface SavedAddress {
  label: string; // Home, Work, etc.
  addressLine: string;
  lat: number;
  lng: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  walletBalance: number;
  rewardPoints: number;
  status: 'active' | 'blocked';
  notes: string;
  createdAt: string;
  addresses: SavedAddress[];
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
}

export interface Restaurant {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  status: 'pending' | 'approved' | 'rejected';
  isOpen: boolean;
  rating: number;
  commissionPercentage: number;
  gstNo: string;
  fssaiNo: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  logoUrl: string;
  coverUrl: string;
  categories: string[];
  lat?: number;
  lng?: number;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  price: number;
  category: string;
  isAvailable: boolean;
  imageUrl: string;
  description: string;
}

export interface Rider {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  onlineStatus: 'online' | 'offline';
  dutyStatus: 'on_duty' | 'off_duty';
  rating: number;
  walletBalance: number;
  lat?: number;
  lng?: number;
  drivingLicence: string;
  rcNumber: string;
  aadhaarNumber: string;
  panNumber: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  attendanceDays: number;
  totalPenalties: number;
  totalIncentives: number;
  
  // New Hindi panel compliant fields
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  dob?: string;
  emergencyContact?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  codLimit?: number; // Cash On Delivery limit
  rejectedReason?: string;
  
  // Documents as base64 URLs or URLs
  aadhaarFrontUrl?: string;
  aadhaarBackUrl?: string;
  panCardUrl?: string;
  drivingLicenceUrl?: string;
  rcUrl?: string;
  insuranceUrl?: string;
  profilePhotoUrl?: string;
  liveSelfieUrl?: string;
  acceptanceRate?: number; // Acceptance rate percentage (e.g. 95)
  verifiedDocs?: {
    aadhaarFront?: boolean;
    aadhaarBack?: boolean;
    panCard?: boolean;
    dl?: boolean;
    rc?: boolean;
    insurance?: boolean;
    profilePhoto?: boolean;
    liveSelfie?: boolean;
  };
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  restaurantId: string;
  restaurantName: string;
  riderId: string | null;
  assignedRiderId?: string | null;
  riderName: string | null;
  items: OrderItem[];
  subtotal: number;
  deliveryCharge: number;
  platformCommission: number;
  restaurantEarnings: number;
  riderEarnings: number;
  totalAmount: number;
  status: 'pending' | 'accepted' | 'preparing' | 'ready_for_pickup' | 'picked_up' | 'delivered' | 'cancelled' | 'refunded';
  paymentMethod: 'UPI' | 'COD';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  createdAt: string;
  updatedAt: string;
  deliveryAddress: string;
  deliveryLat: number;
  deliveryLng: number;
  restaurantLat: number;
  restaurantLng: number;
  riderLat?: number;
  riderLng?: number;
  rejectedRiders?: string[]; // Array of riderIds who rejected this order
}

export interface Zone {
  id: string;
  name: string;
  cityId?: string;
  radius: number; // in KM
  minOrderAmount: number;
  maxDistance: number;
  areaCharges: number;
  active: boolean;
  status?: 'active' | 'offline';
  centerLat?: number;
  centerLng?: number;
  capacity?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  minOrderValue: number;
  active: boolean;
  expiryDate: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userRole: 'customer' | 'restaurant' | 'rider';
  userName: string;
  subject: string;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  email: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface Gig {
  id: string;
  name: string;
  city: string;
  zone: string;
  hub: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  vehicleType: string;
  maxRiders: number;
  waitingListMax: number;
  basePay: number;
  perOrderPay: number;
  surgeBonus: number;
  rainBonus: number;
  festivalBonus: number;
  nightBonus: number;
  attendanceBonus: number;
  incentives: number;
  cancellationRules: string;
  penaltyRules: string;
  visibilityRules: 'public' | 'hidden';
  status: 'open' | 'limited' | 'full' | 'locked';
  bookedRiderIds: string[];
  waitingListRiderIds: string[];
  checkedInRiderIds: string[];
  onlineRiderIds: string[];
  completedRiderIds: string[];
  cancelledRiderIds: string[];
  missedRiderIds: string[];
  createdAt: string;
}

export interface GigBooking {
  id: string;
  gigId: string;
  riderId: string;
  riderName: string;
  riderPhone?: string;
  riderVehicle?: string;
  bookingStatus: 'pending' | 'booked' | 'checked_in' | 'online' | 'completed' | 'cancelled' | 'missed';
  bookingId: string;
  reportingTime: string;
  hubAddress: string;
  bookedAt: string;
  checkedInAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}

export interface PaymentSetting {
  id: string;
  commissionPct: number;
  deliveryCharge: number;
  platformFee: number;
  minPayout: number;
  maxPayout: number;
  autoSettlement: boolean;
  manualSettlement: boolean;
  approvalWorkflow: 'standard' | 'dual_admin' | 'auto_instant';
  settlementSchedule: 'daily' | 'weekly' | 'monthly' | 'custom';
  updatedAt: string;
  updatedBy: string;
}

export interface PaymentEmployee {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'Operations Manager' | 'Support Executive' | 'Hub Manager' | 'Fleet Dispatcher' | 'Software Engineer';
  monthlySalary: number;
  walletBalance: number;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  status: 'active' | 'suspended';
  createdAt: string;
}

export interface PaymentTransaction {
  id: string;
  recipientId: string; // riderId, restaurantId (vendor), or employeeId
  recipientName: string;
  recipientType: 'rider' | 'vendor' | 'employee';
  amount: number;
  baseAmount: number;
  deliveryCharges: number;
  platformFee: number;
  commission: number;
  incentives: number;
  bonus: number;
  penalties: number;
  taxes: number;
  refundAdjustments: number;
  calculationType: 'auto' | 'manual';
  status: 'pending' | 'approved' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'on_hold';
  paymentMethod: 'Bank Transfer' | 'UPI' | 'Company Wallet' | 'Cash' | 'QR Payment';
  referenceId?: string; // UPI ref or Bank Txn ID
  heldReason?: string;
  statusNotes?: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
}

export interface PaymentAuditLog {
  id: string;
  transactionId: string;
  action: string; // e.g., "Increased Payment", "Applied Penalty", "Held Payment", "Released Payment"
  previousAmount: number;
  newAmount: number;
  bonusAdded: number;
  penaltyAdded: number;
  adminName: string;
  timestamp: string;
  notes: string;
}

export interface PaymentNotification {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientType: 'rider' | 'vendor' | 'employee';
  title: string;
  message: string;
  channels: {
    inApp: boolean;
    push: boolean;
    sms: boolean;
    email: boolean;
  };
  sentAt: string;
  status: 'unread' | 'read';
}

export interface CommunicationAlert {
  id: string;
  senderId: string;
  senderName: string;
  targetType: 'all_customers' | 'all_riders' | 'all_vendors' | 'all_admins' | 'selected_users' | 'selected_zones' | 'selected_restaurants';
  targetIds?: string[]; // user IDs or zone IDs or restaurant IDs
  alertType: 'emergency' | 'order' | 'payment' | 'maintenance' | 'security' | 'weather' | 'traffic' | 'service_update' | 'promotional' | 'custom';
  priority: 'critical' | 'high' | 'normal' | 'low';
  title: string;
  message: string;
  deliveryMethods: {
    inApp: boolean;
    push: boolean;
    email: boolean;
    sms: boolean;
  };
  sentAt: string;
  deliveryStatus: 'sent' | 'delivered' | 'failed';
  readCount: number;
  failedCount: number;
  deliveryStats?: {
    delivered: string[]; // List of user IDs who received
    read: string[]; // List of user IDs who read
    failed: string[]; // List of user IDs where it failed
  };
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  targetAudience: 'everyone' | 'customers' | 'riders' | 'vendors' | 'admins';
  category: 'company_news' | 'festival_notice' | 'new_features' | 'policy_updates' | 'payment_updates' | 'delivery_updates' | 'offers_promotions';
  pinned: boolean;
  scheduledAt?: string; // empty means immediate
  expiresAt?: string;
  status: 'draft' | 'active' | 'scheduled' | 'expired';
  createdAt: string;
  updatedAt: string;
}

export interface ChatSession {
  id: string; // e.g. customer_id, restaurant_id, rider_id, or staff_id
  userId: string;
  userName: string;
  userRole: 'customer' | 'restaurant' | 'rider' | 'staff';
  status: 'open' | 'waiting' | 'closed';
  unreadCount: number;
  typingStatus?: {
    [userId: string]: boolean;
  };
  lastMessageText?: string;
  lastMessageTime?: string;
  onlineStatus?: 'online' | 'offline';
  assignedAgentId?: string;
  assignedAgentName?: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'restaurant' | 'rider' | 'admin' | 'support';
  text: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: 'image' | 'document' | 'audio';
  emoji?: string;
  sentAt: string;
  readBy?: string[]; // list of admin ids or user ids who read it
}


