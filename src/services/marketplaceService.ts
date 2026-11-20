import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { CATEGORY_DEFAULT_IMAGES, CURATED_UCC_LISTINGS } from '../data/uccCatalog';
import {
  ADMIN_EMAIL,
  Conversation,
  ConversationStatus,
  FIELD_LIMITS,
  Listing,
  ListingCategory,
  ListingGrouping,
  ListingPhoto,
  ListingStatus,
  ListingType,
  MessageKind,
  PAYMENT_METHODS,
  REFERRAL_REWARD_GHS,
  ReferralCode,
  ReferralStatus,
  SellerTier,
  SellerTierStatus,
  UserPrivateInfo,
  UserPublicProfile,
} from '../types';

function clampText(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

function makeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function buildReferralCode(uid: string): string {
  const clean = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
  return `STZ-${clean || 'UCC100'}`;
}

function sanitizePaymentMethods(methods: string[]): string[] {
  const cleaned = methods
    .map((m) => clampText(m, FIELD_LIMITS.PAYMENT_METHOD_MAX))
    .filter((m) => m.length >= 2 && (PAYMENT_METHODS as readonly string[]).includes(m));
  const unique = Array.from(new Set(cleaned)).slice(0, 5);
  return unique.length > 0 ? unique : ['MTN MoMo', 'Cash on Meetup'];
}

export async function ensureUserProfile(user: User): Promise<{
  publicProfile: UserPublicProfile;
  privateInfo: UserPrivateInfo | null;
}> {
  const userPath = `users/${user.uid}`;
  const privatePath = `users/${user.uid}/private/info`;

  let publicSnap;
  try {
    publicSnap = await getDoc(doc(db, 'users', user.uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  const defaultCode = buildReferralCode(user.uid);
  const isAdmin = user.email === ADMIN_EMAIL && user.emailVerified;

  if (!publicSnap.exists()) {
    const displayName = clampText(
      user.displayName || user.email?.split('@')[0] || 'UCC Student',
      FIELD_LIMITS.DISPLAY_NAME_MAX
    );
    const safeName = displayName.length >= 2 ? displayName : 'UCC Student';
    const newPublic = {
      uid: user.uid,
      displayName: safeName,
      hall: 'Valco Hall',
      program: '',
      bio: '',
      photoURL: clampText(user.photoURL || '', FIELD_LIMITS.IMAGE_URL_MAX),
      referralCode: defaultCode,
      acceptedPaymentMethods: ['MTN MoMo', 'Cash on Meetup'],
      sellerTier: (isAdmin ? 'premium' : 'micro') as SellerTier,
      requestedSellerTier: (isAdmin ? 'premium' : 'micro') as SellerTier,
      sellerTierStatus: 'approved' as SellerTierStatus,
      verifiedCampus: isAdmin,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'users', user.uid), newPublic);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }
  } else {
    const existing = publicSnap.data() as UserPublicProfile;
    if (
      !existing.referralCode ||
      !existing.acceptedPaymentMethods ||
      !existing.sellerTier ||
      !existing.sellerTierStatus
    ) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          referralCode: existing.referralCode || defaultCode,
          acceptedPaymentMethods: existing.acceptedPaymentMethods || [
            'MTN MoMo',
            'Cash on Meetup',
          ],
          sellerTier: existing.sellerTier || (isAdmin ? 'premium' : 'micro'),
          requestedSellerTier:
            existing.requestedSellerTier ||
            existing.sellerTier ||
            (isAdmin ? 'premium' : 'micro'),
          sellerTierStatus: existing.sellerTierStatus || 'approved',
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userPath);
      }
    }
  }

  const activeCode =
    (publicSnap.exists() ? (publicSnap.data() as UserPublicProfile).referralCode : null) ||
    defaultCode;
  try {
    const codeRef = doc(db, 'referralCodes', activeCode);
    const codeSnap = await getDoc(codeRef);
    if (!codeSnap.exists()) {
      const displayName = clampText(
        user.displayName || user.email?.split('@')[0] || 'UCC Student',
        FIELD_LIMITS.DISPLAY_NAME_MAX
      );
      await setDoc(codeRef, {
        code: activeCode,
        ownerUid: user.uid,
        ownerName: displayName.length >= 1 ? displayName : 'UCC Student',
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `referralCodes/${activeCode}`);
  }

  let privateSnap;
  try {
    privateSnap = await getDoc(doc(db, 'users', user.uid, 'private', 'info'));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, privatePath);
  }

  if (!privateSnap.exists()) {
    const newPrivate = {
      uid: user.uid,
      email: clampText(user.email || 'student@ucc.edu.gh', 160),
      phone: '',
      preferredPaymentMethod: 'MTN MoMo',
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, 'users', user.uid, 'private', 'info'), newPrivate);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, privatePath);
    }
  }

  let freshPublic;
  let freshPrivate;
  try {
    freshPublic = await getDoc(doc(db, 'users', user.uid));
    freshPrivate = await getDoc(doc(db, 'users', user.uid, 'private', 'info'));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  return {
    publicProfile: freshPublic.data() as UserPublicProfile,
    privateInfo: freshPrivate.exists() ? (freshPrivate.data() as UserPrivateInfo) : null,
  };
}

export async function updateUserProfile(
  uid: string,
  email: string,
  updates: {
    displayName: string;
    hall: string;
    program: string;
    bio: string;
    phone: string;
    preferredPaymentMethod: string;
    acceptedPaymentMethods: string[];
  }
): Promise<void> {
  const displayName = clampText(updates.displayName, FIELD_LIMITS.DISPLAY_NAME_MAX);
  const hall = clampText(updates.hall, FIELD_LIMITS.HALL_MAX);
  const program = clampText(updates.program, FIELD_LIMITS.PROGRAM_MAX);
  const bio = clampText(updates.bio, FIELD_LIMITS.BIO_MAX);
  const phone = clampText(updates.phone, FIELD_LIMITS.PHONE_MAX);
  const preferredPaymentMethod = clampText(
    updates.preferredPaymentMethod || 'MTN MoMo',
    FIELD_LIMITS.PAYMENT_METHOD_MAX
  );
  const acceptedPaymentMethods = sanitizePaymentMethods(updates.acceptedPaymentMethods);

  if (displayName.length < FIELD_LIMITS.DISPLAY_NAME_MIN) {
    throw new Error('Display name must be at least 2 characters.');
  }
  if (hall.length < FIELD_LIMITS.HALL_MIN) {
    throw new Error('Please select or enter your UCC hall or hostel.');
  }

  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName,
      hall,
      program,
      bio,
      acceptedPaymentMethods,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }

  try {
    await updateDoc(doc(db, 'users', uid, 'private', 'info'), {
      email: clampText(email, 160),
      phone,
      preferredPaymentMethod,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/private/info`);
  }
}

export async function requestSellerTierUpgrade(
  uid: string,
  requestedTier: SellerTier
): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      requestedSellerTier: requestedTier,
      sellerTierStatus: 'pending' as SellerTierStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function approveSellerTier(
  sellerUid: string,
  approvedTier: SellerTier
): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', sellerUid), {
      sellerTier: approvedTier,
      requestedSellerTier: approvedTier,
      sellerTierStatus: 'approved' as SellerTierStatus,
      verifiedCampus: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${sellerUid}`);
  }
}

export async function toggleFavoriteListing(
  user: User,
  listing: Listing,
  isCurrentlyFavorited: boolean
): Promise<boolean> {
  const favPath = `users/${user.uid}/favorites/${listing.id}`;
  const favRef = doc(db, 'users', user.uid, 'favorites', listing.id);

  if (isCurrentlyFavorited) {
    try {
      await deleteDoc(favRef);
      return false;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, favPath);
    }
  }

  try {
    await setDoc(favRef, {
      userId: user.uid,
      listingId: listing.id,
      listingTitle: clampText(listing.title, FIELD_LIMITS.TITLE_MAX),
      listingPriceGhs: listing.priceGhs,
      listingImageUrl: clampText(listing.imageUrl || '', FIELD_LIMITS.IMAGE_URL_MAX),
      sellerName: clampText(listing.sellerName, FIELD_LIMITS.DISPLAY_NAME_MAX),
      sellerHall: clampText(listing.sellerHall, FIELD_LIMITS.HALL_MAX),
      meetupZone: clampText(listing.meetupZone, FIELD_LIMITS.MEETUP_ZONE_MAX),
      brand: clampText(listing.brand || 'UCC Independent', FIELD_LIMITS.BRAND_MAX),
      grouping: clampText(listing.grouping || 'Campus Essentials', 60),
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, favPath);
  }
}

export async function removeFavoriteListing(
  userId: string,
  listingId: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', userId, 'favorites', listingId));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `users/${userId}/favorites/${listingId}`
    );
  }
}

export async function fetchSellerProfile(sellerId: string): Promise<UserPublicProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'users', sellerId));
    return snap.exists() ? (snap.data() as UserPublicProfile) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${sellerId}`);
  }
}

export async function fetchListingById(listingId: string): Promise<Listing | null> {
  try {
    const snap = await getDoc(doc(db, 'listings', listingId));
    return snap.exists() ? (snap.data() as Listing) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `listings/${listingId}`);
  }
}

export interface CreateListingInput {
  title: string;
  description: string;
  type: ListingType;
  grouping: ListingGrouping;
  brand: string;
  category: ListingCategory;
  priceGhs: number;
  priceUnit: string;
  acceptedPaymentMethods: string[];
  meetupZone: string;
  conditionOrTurnaround: string;
  imageUrl?: string;
  galleryImageUrls?: string[];
}

export async function fetchListingPhotos(
  listing: Pick<Listing, 'id' | 'status' | 'sellerId'>,
  viewerUid?: string
): Promise<ListingPhoto[]> {
  const path = `listings/${listing.id}/photos`;
  try {
    const photosRef = collection(db, 'listings', listing.id, 'photos');
    const q =
      listing.status === 'active'
        ? query(photosRef, where('listingStatus', '==', 'active'))
        : viewerUid === listing.sellerId
          ? query(photosRef, where('sellerId', '==', listing.sellerId))
          : null;

    if (!q) return [];
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as ListingPhoto)
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createListing(
  user: User,
  profile: UserPublicProfile,
  input: CreateListingInput
): Promise<string> {
  const id = makeDocId('listing');
  const title = clampText(input.title, FIELD_LIMITS.TITLE_MAX);
  const description = clampText(input.description, FIELD_LIMITS.DESCRIPTION_MAX);
  const brand = clampText(input.brand || 'UCC Independent', FIELD_LIMITS.BRAND_MAX);
  const priceUnit = clampText(input.priceUnit, FIELD_LIMITS.PRICE_UNIT_MAX);
  const acceptedPaymentMethods = sanitizePaymentMethods(input.acceptedPaymentMethods);
  const meetupZone = clampText(input.meetupZone, FIELD_LIMITS.MEETUP_ZONE_MAX);
  const conditionOrTurnaround = clampText(
    input.conditionOrTurnaround,
    FIELD_LIMITS.CONDITION_MAX
  );
  const sellerName = clampText(
    profile.displayName || user.displayName || 'UCC Seller',
    FIELD_LIMITS.DISPLAY_NAME_MAX
  );
  const sellerHall = clampText(profile.hall || 'Valco Hall', FIELD_LIMITS.HALL_MAX);

  const sanitizedGallery = (input.galleryImageUrls || [])
    .map((url) => clampText(url, FIELD_LIMITS.IMAGE_URL_MAX))
    .filter((url) => url.length >= 5)
    .slice(0, 4);

  const imageUrl = clampText(
    sanitizedGallery[0] || input.imageUrl || CATEGORY_DEFAULT_IMAGES[input.category],
    FIELD_LIMITS.IMAGE_URL_MAX
  );
  const priceGhs = Math.min(
    FIELD_LIMITS.PRICE_MAX,
    Math.max(FIELD_LIMITS.PRICE_MIN, Number(input.priceGhs) || 0)
  );

  if (title.length < FIELD_LIMITS.TITLE_MIN) {
    throw new Error('Title must be at least 3 characters.');
  }
  if (description.length < FIELD_LIMITS.DESCRIPTION_MIN) {
    throw new Error('Description must be at least 10 characters.');
  }
  if (brand.length < FIELD_LIMITS.BRAND_MIN) {
    throw new Error('Brand or shop label is required.');
  }

  const payload = {
    id,
    sellerId: user.uid,
    sellerName,
    sellerHall,
    title,
    description,
    type: input.type,
    grouping: input.grouping,
    brand,
    category: input.category,
    priceGhs,
    priceUnit,
    acceptedPaymentMethods,
    meetupZone,
    conditionOrTurnaround,
    imageUrl,
    status: 'active' as ListingStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const extraPhotos = sanitizedGallery.slice(1);
  if (extraPhotos.length === 0) {
    try {
      await setDoc(doc(db, 'listings', id), payload);
      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `listings/${id}`);
    }
  }

  const batch = writeBatch(db);
  batch.set(doc(db, 'listings', id), payload);
  extraPhotos.forEach((photoUrl, idx) => {
    const photoId = `photo_${idx + 1}`;
    batch.set(doc(db, 'listings', id, 'photos', photoId), {
      id: photoId,
      listingId: id,
      sellerId: user.uid,
      listingStatus: 'active' as ListingStatus,
      imageUrl: photoUrl,
      orderIndex: idx + 1,
      createdAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `listings/${id}`);
  }
}

export async function updateListingDetails(
  listingId: string,
  input: CreateListingInput & { status: ListingStatus; sellerId?: string }
): Promise<void> {
  const title = clampText(input.title, FIELD_LIMITS.TITLE_MAX);
  const description = clampText(input.description, FIELD_LIMITS.DESCRIPTION_MAX);
  const brand = clampText(input.brand || 'UCC Independent', FIELD_LIMITS.BRAND_MAX);
  const priceUnit = clampText(input.priceUnit, FIELD_LIMITS.PRICE_UNIT_MAX);
  const acceptedPaymentMethods = sanitizePaymentMethods(input.acceptedPaymentMethods);
  const meetupZone = clampText(input.meetupZone, FIELD_LIMITS.MEETUP_ZONE_MAX);
  const conditionOrTurnaround = clampText(
    input.conditionOrTurnaround,
    FIELD_LIMITS.CONDITION_MAX
  );

  const sanitizedGallery = (input.galleryImageUrls || [])
    .map((url) => clampText(url, FIELD_LIMITS.IMAGE_URL_MAX))
    .filter((url) => url.length >= 5)
    .slice(0, 4);

  const imageUrl = clampText(
    sanitizedGallery[0] || input.imageUrl || CATEGORY_DEFAULT_IMAGES[input.category],
    FIELD_LIMITS.IMAGE_URL_MAX
  );
  const priceGhs = Math.min(
    FIELD_LIMITS.PRICE_MAX,
    Math.max(FIELD_LIMITS.PRICE_MIN, Number(input.priceGhs) || 0)
  );

  if (title.length < FIELD_LIMITS.TITLE_MIN) {
    throw new Error('Title must be at least 3 characters.');
  }
  if (description.length < FIELD_LIMITS.DESCRIPTION_MIN) {
    throw new Error('Description must be at least 10 characters.');
  }

  const effectiveSellerId = input.sellerId || auth.currentUser?.uid;

  if (input.galleryImageUrls && effectiveSellerId) {
    const existingPhotosSnap = await getDocs(
      query(
        collection(db, 'listings', listingId, 'photos'),
        where('sellerId', '==', effectiveSellerId)
      )
    );

    const batch = writeBatch(db);
    batch.update(doc(db, 'listings', listingId), {
      title,
      description,
      type: input.type,
      grouping: input.grouping,
      brand,
      category: input.category,
      priceGhs,
      priceUnit,
      acceptedPaymentMethods,
      meetupZone,
      conditionOrTurnaround,
      imageUrl,
      status: input.status,
      updatedAt: serverTimestamp(),
    });

    existingPhotosSnap.docs.forEach((d) => {
      batch.delete(d.ref);
    });

    sanitizedGallery.slice(1).forEach((photoUrl, idx) => {
      const photoId = `photo_${Date.now()}_${idx + 1}`;
      batch.set(doc(db, 'listings', listingId, 'photos', photoId), {
        id: photoId,
        listingId,
        sellerId: effectiveSellerId,
        listingStatus: input.status,
        imageUrl: photoUrl,
        orderIndex: idx + 1,
        createdAt: serverTimestamp(),
      });
    });

    try {
      await batch.commit();
      return;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `listings/${listingId}`);
    }
  }

  try {
    await updateDoc(doc(db, 'listings', listingId), {
      title,
      description,
      type: input.type,
      grouping: input.grouping,
      brand,
      category: input.category,
      priceGhs,
      priceUnit,
      acceptedPaymentMethods,
      meetupZone,
      conditionOrTurnaround,
      imageUrl,
      status: input.status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `listings/${listingId}`);
  }
}

export async function updateListingStatus(
  listingId: string,
  status: ListingStatus
): Promise<void> {
  const uid = auth.currentUser?.uid;
  try {
    if (uid) {
      const photosSnap = await getDocs(
        query(
          collection(db, 'listings', listingId, 'photos'),
          where('sellerId', '==', uid)
        )
      );
      if (!photosSnap.empty) {
        const batch = writeBatch(db);
        batch.update(doc(db, 'listings', listingId), {
          status,
          updatedAt: serverTimestamp(),
        });
        photosSnap.docs.forEach((d) => {
          batch.update(d.ref, { listingStatus: status });
        });
        await batch.commit();
        return;
      }
    }

    await updateDoc(doc(db, 'listings', listingId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `listings/${listingId}`);
  }
}

export async function deleteListing(listingId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'listings', listingId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `listings/${listingId}`);
  }
}

export async function markListingAsSold(
  listing: Listing,
  options: {
    buyerId?: string;
    buyerName?: string;
    conversationId?: string;
    conversationStatus?: ConversationStatus;
    finalPriceGhs: number;
    paymentMethod: string;
    meetupZone: string;
  }
): Promise<string> {
  const orderId = makeDocId('order');
  const validExternalBuyer =
    Boolean(options.buyerId) &&
    options.buyerId !== listing.sellerId &&
    /^[a-zA-Z0-9_-]+$/.test(options.buyerId || '');

  const buyerId = validExternalBuyer
    ? (options.buyerId as string)
    : 'campus_walkup_buyer';
  const buyerName = clampText(
    options.buyerName || 'Walk-up UCC Student',
    FIELD_LIMITS.DISPLAY_NAME_MAX
  );
  const participantIds = validExternalBuyer
    ? [listing.sellerId, buyerId]
    : [listing.sellerId];

  const finalPriceGhs = Math.min(
    FIELD_LIMITS.PRICE_MAX,
    Math.max(0, Number(options.finalPriceGhs))
  );
  const paymentMethod = clampText(
    options.paymentMethod || 'MTN MoMo',
    FIELD_LIMITS.PAYMENT_METHOD_MAX
  );
  const meetupZone = clampText(
    options.meetupZone || listing.meetupZone,
    FIELD_LIMITS.MEETUP_ZONE_MAX
  );

  const orderDoc: Record<string, unknown> = {
    id: orderId,
    listingId: listing.id,
    listingTitle: clampText(listing.title, FIELD_LIMITS.TITLE_MAX),
    listingPriceGhs: Number.isNaN(finalPriceGhs) ? listing.priceGhs : finalPriceGhs,
    listingImageUrl: clampText(listing.imageUrl || '', FIELD_LIMITS.IMAGE_URL_MAX),
    brand: clampText(listing.brand || 'UCC Independent', FIELD_LIMITS.BRAND_MAX),
    grouping: clampText(listing.grouping || 'Campus Essentials', 60),
    sellerId: listing.sellerId,
    sellerName: clampText(listing.sellerName, FIELD_LIMITS.DISPLAY_NAME_MAX),
    sellerHall: clampText(listing.sellerHall, FIELD_LIMITS.HALL_MAX),
    buyerId,
    buyerName: buyerName.length >= 1 ? buyerName : 'Walk-up UCC Student',
    participantIds,
    meetupZone: meetupZone.length >= 2 ? meetupZone : listing.meetupZone,
    paymentMethod: paymentMethod.length >= 2 ? paymentMethod : 'MTN MoMo',
    status: 'completed',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (options.conversationId) {
    orderDoc.conversationId = clampText(options.conversationId, 128);
  }

  const batch = writeBatch(db);
  batch.update(doc(db, 'listings', listing.id), {
    status: 'sold' as ListingStatus,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'orders', orderId), orderDoc);

  if (
    options.conversationId &&
    options.conversationStatus &&
    options.conversationStatus !== 'completed'
  ) {
    batch.update(doc(db, 'conversations', options.conversationId), {
      status: 'completed' as ConversationStatus,
      meetupZone: orderDoc.meetupZone,
      paymentMethod: orderDoc.paymentMethod,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return orderId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `orders/${orderId}`);
  }
}

export async function seedCuratedUccCatalog(): Promise<number> {
  let syncedCount = 0;

  for (let idx = 0; idx < CURATED_UCC_LISTINGS.length; idx++) {
    const item = CURATED_UCC_LISTINGS[idx];
    const defaultTier: SellerTier =
      idx < 2 ? 'premium' : idx < 4 ? 'standard' : 'micro';
    const sellerRef = doc(db, 'users', item.sellerId);
    try {
      const sellerSnap = await getDoc(sellerRef);
      if (!sellerSnap.exists()) {
        await setDoc(sellerRef, {
          uid: item.sellerId,
          displayName: item.sellerName,
          hall: item.sellerHall,
          program: item.sellerProgram,
          bio: item.sellerBio,
          photoURL: '',
          acceptedPaymentMethods: item.acceptedPaymentMethods,
          sellerTier: defaultTier,
          requestedSellerTier: defaultTier,
          sellerTierStatus: 'approved',
          verifiedCampus: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const sData = sellerSnap.data() as Partial<UserPublicProfile>;
        if (!sData.sellerTier || !sData.sellerTierStatus) {
          await updateDoc(sellerRef, {
            sellerTier: defaultTier,
            requestedSellerTier: defaultTier,
            sellerTierStatus: 'approved',
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${item.sellerId}`);
    }

    const listingRef = doc(db, 'listings', item.id);
    try {
      const listingSnap = await getDoc(listingRef);
      if (!listingSnap.exists()) {
        await setDoc(listingRef, {
          id: item.id,
          sellerId: item.sellerId,
          sellerName: item.sellerName,
          sellerHall: item.sellerHall,
          title: item.title,
          description: item.description,
          type: item.type,
          grouping: item.grouping,
          brand: item.brand,
          category: item.category,
          priceGhs: item.priceGhs,
          priceUnit: item.priceUnit,
          acceptedPaymentMethods: item.acceptedPaymentMethods,
          meetupZone: item.meetupZone,
          conditionOrTurnaround: item.conditionOrTurnaround,
          imageUrl: item.imageUrl,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        syncedCount += 1;
      } else {
        const existingData = listingSnap.data() as Partial<Listing>;
        if (
          !existingData.grouping ||
          !existingData.brand ||
          !existingData.acceptedPaymentMethods
        ) {
          await updateDoc(listingRef, {
            grouping: item.grouping,
            brand: item.brand,
            acceptedPaymentMethods: item.acceptedPaymentMethods,
            updatedAt: serverTimestamp(),
          });
          syncedCount += 1;
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `listings/${item.id}`);
    }
  }

  return syncedCount;
}

export async function startOrGetConversation(
  buyer: User,
  buyerProfile: UserPublicProfile | null,
  listing: Listing,
  initialMessage?: string
): Promise<string> {
  const convId = `${listing.id}_${buyer.uid}`.replace(/[^a-zA-Z0-9_-]/g, '');
  const convRef = doc(db, 'conversations', convId);

  let convSnap;
  try {
    convSnap = await getDoc(convRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `conversations/${convId}`);
  }

  const buyerName = clampText(
    buyerProfile?.displayName || buyer.displayName || 'UCC Buyer',
    FIELD_LIMITS.DISPLAY_NAME_MAX
  );
  const participantIds = [buyer.uid, listing.sellerId];

  if (!convSnap.exists()) {
    const newConversation = {
      id: convId,
      listingId: listing.id,
      listingTitle: clampText(listing.title, FIELD_LIMITS.TITLE_MAX),
      listingPriceGhs: listing.priceGhs,
      listingImageUrl: clampText(listing.imageUrl || '', FIELD_LIMITS.IMAGE_URL_MAX),
      meetupZone: clampText(listing.meetupZone, FIELD_LIMITS.MEETUP_ZONE_MAX),
      paymentMethod: listing.acceptedPaymentMethods?.[0] || 'MTN MoMo',
      buyerId: buyer.uid,
      buyerName,
      sellerId: listing.sellerId,
      sellerName: clampText(listing.sellerName, FIELD_LIMITS.DISPLAY_NAME_MAX),
      participantIds,
      status: 'open' as ConversationStatus,
      lastMessageText: clampText(
        initialMessage || `Started inquiry about ${listing.title}`,
        FIELD_LIMITS.MESSAGE_MAX
      ),
      lastMessageSenderId: buyer.uid,
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(convRef, newConversation);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `conversations/${convId}`);
    }
  }

  if (initialMessage && initialMessage.trim().length > 0) {
    const freshSnap = await getDoc(convRef);
    if (freshSnap.exists()) {
      await sendMessage(
        freshSnap.data() as Conversation,
        buyer,
        buyerName,
        {
          text: initialMessage,
          kind: 'text',
        }
      );
    }
  }

  return convId;
}

export async function sendMessage(
  conversation: Conversation,
  sender: User,
  senderName: string,
  payload: {
    text: string;
    kind: MessageKind;
    offerAmountGhs?: number;
    proposedMeetupZone?: string;
    proposedPaymentMethod?: string;
  }
): Promise<void> {
  const cleanText = clampText(payload.text, FIELD_LIMITS.MESSAGE_MAX);
  if (cleanText.length < FIELD_LIMITS.MESSAGE_MIN) {
    throw new Error('Message cannot be empty.');
  }

  const msgId = makeDocId('msg');
  const msgRef = doc(db, 'conversations', conversation.id, 'messages', msgId);
  const convRef = doc(db, 'conversations', conversation.id);

  const messageDoc: Record<string, unknown> = {
    id: msgId,
    conversationId: conversation.id,
    senderId: sender.uid,
    senderName: clampText(senderName, FIELD_LIMITS.DISPLAY_NAME_MAX),
    participantIds: conversation.participantIds,
    text: cleanText,
    kind: payload.kind,
    createdAt: serverTimestamp(),
  };

  if (payload.kind === 'offer' && typeof payload.offerAmountGhs === 'number') {
    messageDoc.offerAmountGhs = Math.min(
      FIELD_LIMITS.PRICE_MAX,
      Math.max(0, payload.offerAmountGhs)
    );
  }
  if (payload.kind === 'meetup_proposal' && payload.proposedMeetupZone) {
    messageDoc.proposedMeetupZone = clampText(
      payload.proposedMeetupZone,
      FIELD_LIMITS.MEETUP_ZONE_MAX
    );
  }
  if (payload.kind === 'payment_update' && payload.proposedPaymentMethod) {
    messageDoc.proposedPaymentMethod = clampText(
      payload.proposedPaymentMethod,
      FIELD_LIMITS.PAYMENT_METHOD_MAX
    );
  }

  const batch = writeBatch(db);
  batch.set(msgRef, messageDoc);
  batch.update(convRef, {
    lastMessageText: cleanText,
    lastMessageSenderId: sender.uid,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `conversations/${conversation.id}/messages/${msgId}`
    );
  }
}

export async function updateConversationDealState(
  conversationId: string,
  status: ConversationStatus,
  meetupZone: string,
  paymentMethod?: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'conversations', conversationId), {
      status,
      meetupZone: clampText(meetupZone, FIELD_LIMITS.MEETUP_ZONE_MAX),
      paymentMethod: clampText(
        paymentMethod || 'MTN MoMo',
        FIELD_LIMITS.PAYMENT_METHOD_MAX
      ),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `conversations/${conversationId}`);
  }
}

export async function submitReview(
  reviewer: User,
  reviewerProfile: UserPublicProfile | null,
  listing: Listing,
  rating: number,
  comment: string
): Promise<void> {
  const reviewId = `${listing.id}_${reviewer.uid}`.replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanComment = clampText(comment, FIELD_LIMITS.REVIEW_MAX);
  const clampedRating = Math.min(5, Math.max(1, Math.round(rating)));

  if (cleanComment.length < FIELD_LIMITS.REVIEW_MIN) {
    throw new Error('Review comment must be at least 5 characters.');
  }

  const reviewRef = doc(db, 'reviews', reviewId);
  let existingSnap;
  try {
    existingSnap = await getDoc(reviewRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `reviews/${reviewId}`);
  }

  if (existingSnap.exists()) {
    try {
      await updateDoc(reviewRef, {
        rating: clampedRating,
        comment: cleanComment,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reviews/${reviewId}`);
    }
    return;
  }

  const reviewerName = clampText(
    reviewerProfile?.displayName || reviewer.displayName || 'UCC Student',
    FIELD_LIMITS.DISPLAY_NAME_MAX
  );
  const reviewerHall = clampText(
    reviewerProfile?.hall || 'Valco Hall',
    FIELD_LIMITS.HALL_MAX
  );

  try {
    await setDoc(reviewRef, {
      id: reviewId,
      listingId: listing.id,
      listingTitle: clampText(listing.title, FIELD_LIMITS.TITLE_MAX),
      sellerId: listing.sellerId,
      reviewerId: reviewer.uid,
      reviewerName: reviewerName.length >= 2 ? reviewerName : 'UCC Student',
      reviewerHall,
      rating: clampedRating,
      comment: cleanComment,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `reviews/${reviewId}`);
  }
}

export async function deleteReview(reviewId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'reviews', reviewId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `reviews/${reviewId}`);
  }
}

export async function applyReferralCode(
  user: User,
  profile: UserPublicProfile,
  rawCode: string
): Promise<void> {
  const cleanCode = rawCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (cleanCode.length < FIELD_LIMITS.REFERRAL_CODE_MIN) {
    throw new Error('Enter a valid referral code (for example, STZ-XXXXXX).');
  }

  if (profile.referralCode && profile.referralCode.toUpperCase() === cleanCode) {
    throw new Error('You cannot apply your own referral code.');
  }

  let existingReferralSnap;
  try {
    existingReferralSnap = await getDoc(doc(db, 'referrals', user.uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `referrals/${user.uid}`);
  }

  if (existingReferralSnap.exists()) {
    throw new Error('You have already claimed a campus referral invite.');
  }

  let codeSnap;
  try {
    codeSnap = await getDoc(doc(db, 'referralCodes', cleanCode));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `referralCodes/${cleanCode}`);
  }

  if (!codeSnap.exists()) {
    throw new Error('Referral code not found. Double-check with your friend.');
  }

  const codeData = codeSnap.data() as ReferralCode;
  if (codeData.ownerUid === user.uid) {
    throw new Error('You cannot refer yourself.');
  }

  const referredName = clampText(
    profile.displayName || user.displayName || 'UCC Student',
    FIELD_LIMITS.DISPLAY_NAME_MAX
  );

  try {
    await setDoc(doc(db, 'referrals', user.uid), {
      id: user.uid,
      referrerUid: codeData.ownerUid,
      referrerCode: cleanCode,
      referrerName: clampText(codeData.ownerName, FIELD_LIMITS.DISPLAY_NAME_MAX),
      referredUid: user.uid,
      referredName: referredName.length >= 1 ? referredName : 'UCC Student',
      status: 'qualified' as ReferralStatus,
      rewardGhs: REFERRAL_REWARD_GHS,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `referrals/${user.uid}`);
  }
}

export async function approveReferralReward(referralId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'referrals', referralId), {
      status: 'rewarded' as ReferralStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `referrals/${referralId}`);
  }
}
