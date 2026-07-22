# Security Specification - Ting Tong Bhopal Admin

## Data Invariants
1. Orders must have positive totals.
2. Riders cannot assign orders to themselves if they are offline.
3. System settings must only be editable by Super Admins.
4. Timestamps (createdAt, updatedAt) must match the server time.
5. All IDs must match a safe format.

## The Dirty Dozen (Vulnerable Payloads Rejected by Rules)
1. Creating an order with a negative totalAmount.
2. Creating an order with a missing customerId.
3. Creating or updating a rider profile setting `walletBalance` to a high number client-side.
4. Setting custom claims or admin flags on a customer account.
5. Deleting audit logs client-side.
6. Creating a coupon with a discount value greater than 100%.
7. Creating a zone with a negative delivery radius.
8. Modifying the `createdAt` timestamp of any document upon update.
9. Modifying the `platformCommission` field of an order without proper authorization.
10. Creating a support ticket without a valid `userRole`.
11. Injecting a massive string as a customer ID.
12. Attempting a read on a PII-containing document without active session credentials.

## Rules Implementation Guard
The rules will enforce verification, type safety, and path hardening to reject all 12 malicious payloads.
