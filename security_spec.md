# Grade 9 Hub — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default-Deny Safety Net**: Every path not explicitly matched is denied (`allow read, write: if false;`).
2. **Email Verification Gate**: All protected user mutations and PII reads require `request.auth != null && request.auth.token.email_verified == true`.
3. **Strict PII Isolation**: `/users/{userId}` (containing `email`, `birthday`, `isAdmin`) and `/school_accounts/{accountKey}` (containing `email`, `passwordHash`) are NEVER readable or listable by other students. Public leaderboard reads happen exclusively on `/leaderboard_entries/{userId}` where `resource.data.role == 'student'` and zero PII fields exist.
4. **No Self-Assigned Privilege Escalation**: A non-admin user creating or updating `/users/{userId}` MUST have `role == 'student'` and `isAdmin == false`. Only verified `mohamdm791@gmail.com` or an existing `/admins/{uid}` entry can hold `role == 'teacher'` or `isAdmin == true` or write to `/admins` or `/school_accounts`.
5. **Master Gate & Immutability**: Subcollection `/users/{userId}/quiz_attempts/{attemptId}` checks parent `/users/{userId}` ownership (`get(...)`), prevents updates/deletes by non-admins, and enforces server timestamps (`request.time`) and immutable ownership (`uid`, `userId`, `createdAt`).
6. **Path Variable & Payload Size Hardening**: Every document ID matches `^[a-zA-Z0-9_\-]+$` with length `<= 128`, every string has explicit `.size()` bounds, and every create/update strictly enforces `keys().hasOnly(...)` / `affectedKeys().hasOnly(...)`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Be Denied)
1. **Shadow Field Injection on User Create**: Sending `{ uid, name, email, role: 'student', isAdmin: false, createdAt: request.time, updatedAt: request.time, superPower: true }` -> DENIED (`keys().hasOnly` rejects unknown key).
2. **Self-Assigned Admin on Create**: Student sending `role: 'teacher', isAdmin: true` in `/users/{uid}` -> DENIED.
3. **Privilege Escalation on Update**: Student updating `/users/{uid}` to change `role` or `isAdmin` or `uid` -> DENIED (`affectedKeys().hasOnly` + immutability check).
4. **Cross-User PII Read (`get`)**: Student A trying `get(/users/studentB)` -> DENIED.
5. **Blanket User List Scraping**: Student trying `list(/users)` -> DENIED (`list` forbidden for non-admin).
6. **Admin Registry Spoofing**: Non-admin student writing `/admins/{studentUid}` -> DENIED.
7. **School Account Leak**: Student trying `get` or `list` on `/school_accounts` -> DENIED (`isAdmin()` required).
8. **Unverified Email Spoof**: User with `email: 'mohamdm791@gmail.com'` and `email_verified: false` attempting admin read/write -> DENIED (`email_verified == true` required).
9. **Oversized ID Poisoning**: Creating `/users/<200-char-invalid-id>` -> DENIED (`isValidId` rejects).
10. **Forged Client Timestamp**: Creating `/users/{uid}` with `createdAt: Timestamp.fromDate(...)` instead of `request.time` -> DENIED.
11. **Parentless Quiz Attempt**: Writing `/users/{otherUid}/quiz_attempts/{id}` or without parent `/users/{uid}` -> DENIED (Master Gate `get()`).
12. **PII Injection into Leaderboard or Peer Presence**: Writing `email` into `/leaderboard_entries/{uid}` or `/peer_presence/{uid}`, or non-admin writing `/app_settings/global` -> DENIED.
13. **Restricted & Main Admin Protection**: Non-admin user updating `isRestricted` on themselves, or any admin deleting/demoting/restricting `mohamdm791@gmail.com` -> DENIED.
14. **Cross-User DM Snooping or Impersonation**: Reading `/direct_messages` where `request.auth.uid` is not in `participants`, listing without `participants` filter, or sending a DM with `senderUid != request.auth.uid` -> DENIED.
15. **Unauthorized Announcement Creation or Revocation Forgery**: Non-teacher student creating/deleting `/announcements/{id}` or forging `createdAt != request.time`, or non-admin writing `/account_revocations/{id}` -> DENIED.
16. **Unauthorized Hero Banner Write or Oversized Payload**: Non-admin student writing, updating, or deleting `/hero_banners/{bannerId}`, injecting unknown fields, or exceeding 280KB banner `src` size -> DENIED (`isAdmin() || isTeacherUser()` + `isValidHeroBanner` required).

