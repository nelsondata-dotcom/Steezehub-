# Steezehub Security Specification & Threat Model

## 1. Data Invariants
1. **Identity Integrity**: Every user public profile (`/users/{userId}`) and private PII document (`/users/{userId}/private/info`) is strictly owned by `userId == request.auth.uid` (or bootstrapped admin). Public profiles must never contain email or phone fields.
2. **Verified Sellers Only**: Creating or modifying listings requires `request.auth != null && request.auth.token.email_verified == true`. `sellerId` is immutable after creation.
3. **Terminal State Locking**: Once a listing reaches `status == 'sold'`, non-admin edits to title, price, or description are rejected. Once a conversation reaches `status == 'completed'`, non-admin updates are rejected.
4. **Master Gate & Conversation Isolation**: Messages in `/conversations/{conversationId}/messages/{messageId}` require the parent conversation to exist and the sender to be one of the two `participantIds` (`buyerId` or `sellerId`). `list` queries on conversations and messages strictly validate `request.auth.uid in resource.data.participantIds`.
5. **Temporal Integrity & Anti-Shadow-Fields**: All `createdAt` and `updatedAt` timestamps must match `request.time`. All documents enforce strict `keys().hasAll(...)` and `keys().hasOnly(...)` allowlists.

## 2. Dirty Dozen Adversarial Payloads
1. **Shadow Field Injection on Profile**: Creating `/users/u1` with an extra `{ isVerifiedAdmin: true }` field -> `PERMISSION_DENIED`.
2. **PII Leak Attempt**: Reading `/users/victimUid/private/info` as another signed-in user -> `PERMISSION_DENIED`.
3. **Unverified Email Listing Create**: Creating `/listings/l1` when `email_verified == false` -> `PERMISSION_DENIED`.
4. **Seller Spoofing**: Creating `/listings/l1` with `sellerId: "victimUid"` as a non-admin user -> `PERMISSION_DENIED`.
5. **Oversized ID Poisoning**: Creating `/listings/<200-char-invalid-id!>` -> `PERMISSION_DENIED`.
6. **Negative / Poisoned Price**: Creating `/listings/l1` with `priceGhs: -50` or `priceGhs: "free"` -> `PERMISSION_DENIED`.
7. **Timestamp Forgery**: Creating `/listings/l1` with a backdated `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
8. **Post-Sold Listing Tampering**: Updating `priceGhs` on a listing whose existing `status == 'sold'` -> `PERMISSION_DENIED`.
9. **Unauthorized Conversation Scraping**: Listing `/conversations` without filtering to `participantIds` containing `request.auth.uid` -> `PERMISSION_DENIED`.
10. **Orphaned Message Injection**: Creating a message inside a non-existent `conversationId` -> `PERMISSION_DENIED`.
11. **Eavesdropper Message Injection**: Sending a message into someone else's conversation -> `PERMISSION_DENIED`.
12. **Message History Tampering**: Updating or deleting an existing chat message -> `PERMISSION_DENIED`.
