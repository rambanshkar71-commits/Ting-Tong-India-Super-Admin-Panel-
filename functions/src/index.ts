import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

/**
 * Cloud Function triggered when a rider successfully books a gig slot.
 * It auto-creates a live gig_notification document and sends a push alert via FCM.
 */
export const onGigBookingCreated = onDocumentCreated("gig_bookings/{bookingId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log("No data associated with the event");
    return;
  }

  const bookingData = snapshot.data();
  const { gigId, riderId, riderName, bookingId: generatedBookingId, bookingStatus } = bookingData;

  // Only notify if bookingStatus is 'booked' or 'pending' (waiting list)
  if (bookingStatus !== "booked" && bookingStatus !== "pending") {
    return;
  }

  try {
    // 1. Fetch associated Gig details
    const gigDoc = await db.collection("gigs").doc(gigId).get();
    if (!gigDoc.exists) {
      console.error(`Gig ${gigId} not found`);
      return;
    }
    const gigData = gigDoc.data() || {};
    const gigName = gigData.name || "Enterprise Delivery Shift";
    const startTime = gigData.startTime || "00:00";
    const hub = gigData.hub || "Bhopal Hub";

    // 2. Fetch Rider FCM token & info
    const riderDoc = await db.collection("riders").doc(riderId).get();
    let fcmToken = "";
    if (riderDoc.exists) {
      fcmToken = riderDoc.data()?.fcmToken || "";
    }

    const isWaiting = bookingStatus === "pending";
    const title = isWaiting 
      ? "Joined Waiting List 🙋" 
      : "Shift Booked Successfully! 🏍️";
    const message = isWaiting
      ? `You have joined the waiting list for ${gigName}. If a booked rider cancels, you will be auto-promoted!`
      : `Confirmed: You are booked for ${gigName} at ${hub}. Reporting Time: ${startTime} hrs. ID: #${generatedBookingId}`;

    // 3. Save Notification into Firestore for real-time listener synchronization
    const notificationRef = db.collection("gig_notifications").doc();
    await notificationRef.set({
      title,
      message,
      type: isWaiting ? "waiting_list" : "booking_success",
      riderId,
      gigId,
      bookingId: generatedBookingId,
      createdAt: new Date().toISOString(),
      status: "unread",
      recipient: "rider"
    });

    // 4. Send Firebase Cloud Messaging (FCM) Push Alert to Rider's device
    if (fcmToken) {
      const payload = {
        token: fcmToken,
        notification: {
          title,
          body: message
        },
        data: {
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
          type: "GIG_BOOKING",
          gigId,
          bookingId: generatedBookingId
        }
      };

      const response = await admin.messaging().send(payload);
      console.log(`FCM sent successfully to rider ${riderId}: ${response}`);
    } else {
      console.log(`Rider ${riderId} does not have an active registered FCM token. Live in-app toast fallback activated.`);
    }

    // 5. Notify the Admin as well (write notification document)
    await db.collection("gig_notifications").add({
      title: "New Shift Registration 🏍️",
      message: `Rider ${riderName} has registered for ${gigName} (ID: #${generatedBookingId}).`,
      type: "admin_alert",
      riderId,
      gigId,
      createdAt: new Date().toISOString(),
      status: "unread",
      recipient: "admin"
    });

  } catch (error) {
    console.error("Error processing onGigBookingCreated cloud function: ", error);
  }
});

/**
 * Cloud Function triggered when a Gig document is updated.
 * Triggers a broadcast FCM notification when the status changes to 'Full'
 * so that both Admins and all Booked Riders are notified instantly.
 */
export const onGigUpdated = onDocumentUpdated("gigs/{gigId}", async (event) => {
  const change = event.data;
  if (!change) {
    console.log("No data associated with the event");
    return;
  }

  const beforeData = change.before.data() || {};
  const afterData = change.after.data() || {};
  const gigId = event.params.gigId;

  const previousStatus = beforeData.status;
  const currentStatus = afterData.status;

  // We check if the gig has just transitioned to 'full' or if bookedRiderIds filled up
  const wasFull = previousStatus === "full";
  const isFullNow = currentStatus === "full" || (afterData.bookedRiderIds?.length >= afterData.maxRiders);

  if (isFullNow && !wasFull) {
    try {
      const gigName = afterData.name || "Enterprise Shift";
      const bookedRiders: string[] = afterData.bookedRiderIds || [];
      const hub = afterData.hub || "Bhopal Hub";

      const title = "Shift is Now Full! 🔒";
      const message = `Excellent! The enterprise shift ${gigName} at ${hub} has filled all available slots and is ready for operations.`;

      // 1. Create System-wide Admin notification
      await db.collection("gig_notifications").add({
        title: "Shift Status: FULL ⚠️",
        message: `The gig ${gigName} (${afterData.date}) is now at 100% rider capacity (${bookedRiders.length}/${afterData.maxRiders} riders).`,
        type: "gig_full_admin",
        gigId,
        createdAt: new Date().toISOString(),
        status: "unread",
        recipient: "admin"
      });

      // 2. Notify each booked rider (and collect their FCM tokens)
      const fcmTokens: string[] = [];
      const batch = db.batch();

      for (const riderId of bookedRiders) {
        // Create in-app notification document for each rider
        const riderNotifRef = db.collection("gig_notifications").doc();
        batch.set(riderNotifRef, {
          title,
          message: `The shift "${gigName}" you booked is now FULL and fully staffed. Get ready for your deliveries!`,
          type: "gig_full_rider",
          riderId,
          gigId,
          createdAt: new Date().toISOString(),
          status: "unread",
          recipient: "rider"
        });

        // Get FCM token
        const riderDoc = await db.collection("riders").doc(riderId).get();
        if (riderDoc.exists) {
          const token = riderDoc.data()?.fcmToken;
          if (token) fcmTokens.push(token);
        }
      }

      await batch.commit();

      // 3. Send multicast FCM Push Notifications
      if (fcmTokens.length > 0) {
        const payload = {
          tokens: fcmTokens,
          notification: {
            title,
            body: `Your booked shift "${gigName}" is now fully staffed and ready to launch!`
          },
          data: {
            type: "GIG_FULL",
            gigId
          }
        };

        const response = await admin.messaging().sendEachForMulticast(payload);
        console.log(`Multicast FCM sent successfully to ${fcmTokens.length} riders. Success count: ${response.successCount}`);
      } else {
        console.log("No registered FCM tokens found for booked riders. In-app real-time synchronization fallback active.");
      }

    } catch (error) {
      console.error("Error processing onGigUpdated cloud function: ", error);
    }
  }
});
