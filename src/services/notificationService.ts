import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export interface SendNotificationParams {
  recipientId: string;
  recipientName: string;
  recipientType: 'restaurant' | 'rider' | 'customer' | 'admin';
  title: string;
  message: string;
  type: 'approval' | 'rejection' | 'settlement' | 'security' | 'document_reupload' | 'general';
  channels?: {
    inApp?: boolean;
    push?: boolean;
    sms?: boolean;
    email?: boolean;
  };
}

export async function sendNotification({
  recipientId,
  recipientName,
  recipientType,
  title,
  message,
  type,
  channels = { inApp: true, push: true, sms: true, email: true },
}: SendNotificationParams) {
  try {
    const payload = {
      recipientId,
      recipientName,
      recipientType,
      title,
      message,
      type,
      channels,
      status: 'unread',
      sentAt: new Date().toISOString(),
    };

    // Store in notifications collection
    await addDoc(collection(db, 'notifications'), payload);

    // Also store in communicationAlerts for high visibility broadcast tracking
    await addDoc(collection(db, 'communicationAlerts'), {
      senderId: 'SYSTEM_ADMIN',
      senderName: 'Ting Tong India Master Admin',
      targetType: recipientType === 'restaurant' ? 'selected_restaurants' : 'selected_users',
      targetIds: [recipientId],
      alertType: type,
      priority: type === 'security' || type === 'rejection' ? 'high' : 'normal',
      title,
      message,
      deliveryMethods: channels,
      sentAt: new Date().toISOString(),
      deliveryStatus: 'sent',
      readCount: 0,
      failedCount: 0,
    });

    return true;
  } catch (err) {
    console.warn('Error sending notification:', err);
    return false;
  }
}
