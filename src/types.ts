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

export type RestaurantLifecycleStatus =
  | 'pending'
  | 'under_verification'
  | 'approved' | 'active' | 'inactive' | 'suspended' | 'rejected' | 'permanently_closed';

export interface DocumentVerificationItem {
  status: 'pending' | 'under_review' | 'verified' | 'rejected' | 'reupload_requested';
  url?: string;
  expiryDate?: string;
  rejectionReason?: string;
  reuploadRequestedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface DocumentVerificationHistoryLog {
  id: string;
  docType: string; // e.g. 'GST', 'FSSAI', 'PAN', 'Aadhaar', 'Cheque', 'Shop License', 'Trade License', 'Menu PDF'
  action: 'approved' | 'rejected' | 'reupload_requested';
  reason?: string;
  adminEmail: string;
  timestamp: string;
}

export interface RestaurantTimeSlot {
  label: string; // e.g. 'Lunch', 'Dinner'
  open: string; // HH:MM
  close: string; // HH:MM
}

export interface FestivalSchedule {
  festivalName: string;
  date: string;
  isClosed: boolean;
  customOpen?: string;
  customClose?: string;
}

export interface EmergencyClosure {
  isClosed: boolean;
  reason?: string;
  until?: string;
}

export interface Restaurant {
  id: string;
  authUid?: string;
  userId?: string;
  restaurantCode?: string;
  name: string;
  ownerName?: string;
  email: string;
  phone: string;
  address: string;
  city?: string;
  state?: string;
  pincode?: string;
  status: RestaurantLifecycleStatus;
  isOpen: boolean;
  rating: number;
  commissionPercentage: number;
  gstNo: string;
  fssaiNo: string;
  bankName: string;
  accountHolderName?: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  logoUrl: string;
  coverUrl: string;
  categories: string[];
  lat?: number;
  lng?: number;
  deliveryRadiusKm?: number;
  minOrderAmount?: number;
  packagingCharge?: number;
  gstMandatory?: boolean;
  fssaiStatus?: 'verified' | 'pending' | 'rejected' | 'reupload_requested';
  walletBalance?: number;
  pendingSettlement?: number;
  completedSettlement?: number;
  settlementHold?: boolean;
  holdReason?: string;
  menuLocked?: boolean;
  loginDisabled?: boolean;
  loginUsername?: string;
  tempPassword?: string;
  loginQrCodeUrl?: string;
  lastLoginAt?: string;
  lastActivityAt?: string;
  lastIpAddress?: string;
  createdAt?: string;
  updatedAt?: string;

  // Verification & Capacity / SLA fields
  fssaiVerified?: boolean;
  gstVerified?: boolean;
  prepTime?: number;
  maxConcurrentOrders?: number;
  maxOrdersPerHour?: number;
  autoPauseOnCapacity?: boolean;
  prepQueueLimit?: number;
  prepSlaMinutes?: number;
  acceptanceSlaSeconds?: number;

  // Documents
  gstDocumentUrl?: string;
  gstStatus?: 'pending' | 'under_review' | 'verified' | 'rejected' | 'reupload_requested';
  gstRejectionReason?: string;

  fssaiDocumentUrl?: string;
  fssaiExpiryDate?: string;
  fssaiRejectionReason?: string;

  ownerPanNo?: string;
  ownerPanDocumentUrl?: string;
  panStatus?: 'pending' | 'under_review' | 'verified' | 'rejected' | 'reupload_requested';
  panRejectionReason?: string;

  ownerAadhaarNo?: string;
  ownerAadhaarDocumentUrl?: string;
  aadhaarStatus?: 'pending' | 'under_review' | 'verified' | 'rejected' | 'reupload_requested';
  aadhaarRejectionReason?: string;

  chequeDocumentUrl?: string;
  chequeStatus?: 'pending' | 'under_review' | 'verified' | 'rejected' | 'reupload_requested';
  chequeRejectionReason?: string;

  shopLicenseUrl?: string;
  shopLicenseStatus?: 'pending' | 'under_review' | 'verified' | 'rejected' | 'reupload_requested';
  shopLicenseExpiry?: string;
  shopLicenseRejectionReason?: string;

  tradeLicenseUrl?: string;
  tradeLicenseStatus?: 'pending' | 'under_review' | 'verified' | 'rejected' | 'reupload_requested';
  tradeLicenseExpiry?: string;
  tradeLicenseRejectionReason?: string;

  menuPdfUrl?: string;
  menuPdfStatus?: 'pending' | 'under_review' | 'verified' | 'rejected' | 'reupload_requested';
  menuPdfRejectionReason?: string;

  docVerificationHistory?: DocumentVerificationHistoryLog[];

  // Working Hours & Schedule Management
  openingTime?: string; // HH:MM
  closingTime?: string; // HH:MM
  weeklyHolidays?: string[]; // e.g. ['Sunday']
  timeSlots?: RestaurantTimeSlot[];
  tempClosed?: boolean;
  tempClosedReason?: string;
  festivalSchedule?: FestivalSchedule[];
  emergencyClosure?: EmergencyClosure;
  autoSchedule?: boolean;

  // Delivery Configuration
  deliveryType?: 'tingtong_only' | 'self_delivery' | 'mixed';
  freeDeliveryThreshold?: number;
  maxDeliveryRadiusKm?: number;
  avgPrepTimeMin?: number;
  pickupEnabled?: boolean;
  deliveryEnabled?: boolean;
  takeawayEnabled?: boolean;
  dineInEnabled?: boolean;
}

export interface RestaurantProfile {
  id: string; // matches restaurantId
  restaurantId: string;
  restaurantCode: string;
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  categories: string[];
  description?: string;
  logoUrl: string;
  coverUrl: string;
  rating: number;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  isOpen: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantDocument {
  id: string;
  restaurantId: string;
  gstNo: string;
  gstStatus: 'verified' | 'pending' | 'rejected';
  gstDocumentUrl?: string;
  fssaiNo: string;
  fssaiStatus: 'verified' | 'pending' | 'rejected';
  fssaiExpiryDate?: string;
  fssaiDocumentUrl?: string;
  ownerPanNo?: string;
  ownerPanDocumentUrl?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface RestaurantLocation {
  id: string;
  restaurantId: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  serviceZoneId?: string;
  isServiceable: boolean;
  deliveryRadiusKm: number;
}

export interface RestaurantBankDetail {
  id: string;
  restaurantId: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  isVerified: boolean;
  verifiedAt?: string;
}

export interface RestaurantSettlement {
  id: string;
  restaurantId: string;
  restaurantName: string;
  amount: number;
  grossSales: number;
  commissionDeducted: number;
  packagingFees: number;
  status: 'pending' | 'completed' | 'on_hold' | 'failed';
  holdReason?: string;
  referenceId?: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  processedAt?: string;
}

export interface RestaurantReview {
  id: string;
  restaurantId: string;
  customerName: string;
  rating: number;
  comment: string;
  adminReply?: string;
  isFake?: boolean;
  createdAt: string;
}

export interface RestaurantAuditLog {
  id: string;
  restaurantId: string;
  adminEmail: string;
  adminName?: string;
  action: string;
  details: string;
  timestamp: string;
  beforeValue?: string;
  afterValue?: string;
  deviceInfo?: string;
  ipAddress?: string;
  isRestored?: boolean;
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
  status: 'pending' | 'approved' | 'rejected' | 'suspended' | 'under_verification';
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
  userId?: string;
  authUid?: string;
  address?: string;
  city?: string;
  cityId?: string;
  workZoneId?: string;
  workZone?: string;
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
  cityId?: string;
  city?: string;
  workZoneId?: string;
  workZone?: string;
  deliveryLat: number;
  deliveryLng: number;
  restaurantLat: number;
  restaurantLng: number;
  riderLat?: number;
  riderLng?: number;
  riderPhone?: string;
  rejectedRiders?: string[]; // Array of riderIds who rejected this order
  cancelledBy?: string;
  cancelReason?: string;
}

export interface City {
  id: string;
  name: string;
  state?: string;
  centerLat: number;
  centerLng: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PolygonPoint {
  lat: number;
  lng: number;
}

export interface WorkZone {
  id: string;
  zoneId?: string;
  name: string;
  zoneName?: string;
  cityId: string;
  cityName: string;
  radius: number; // in KM
  minOrderAmount: number;
  maxDistance: number;
  areaCharges: number;
  active: boolean;
  status?: 'active' | 'offline';
  center?: { lat: number; lng: number } | [number, number];
  centerLat?: number;
  centerLng?: number;
  polygon?: PolygonPoint[] | [number, number][];
  mapData?: any;
  capacity?: number;
  assignedRiderIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type Zone = WorkZone;

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


