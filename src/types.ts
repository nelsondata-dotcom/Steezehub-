import { Timestamp } from 'firebase/firestore';

export type ListingType = 'good' | 'service';

export type ListingCategory =
  | 'Apparel & Thrift'
  | 'Tech & Accessories'
  | 'Textbooks & Study'
  | 'Food & Drinks'
  | 'Grooming & Beauty'
  | 'Design & Repairs'
  | 'Laundry & Errands';

export type ListingGrouping =
  | 'Campus Essentials'
  | 'Hall Life & Dorm'
  | 'Academic & Tech'
  | 'Fashion & Beauty'
  | 'Food & Errands'
  | 'Events & Tickets';

export type PaymentMethod =
  | 'MTN MoMo'
  | 'Telecel Cash'
  | 'AT Money'
  | 'Cash on Meetup'
  | 'Bank / Hubtel Transfer';

export type SellerTier = 'micro' | 'standard' | 'premium';
export type SellerTierStatus = 'pending' | 'approved';

export const SELLER_TIER_DETAILS: Record<
  SellerTier,
  {
    label: string;
    feePercent: string;
    listingCap: string;
    monthlyFeeGhs: number;
    summary: string;
  }
> = {
  micro: {
    label: 'Micro Seller',
    feePercent: '0% platform fee',
    listingCap: 'Up to 5 active listings',
    monthlyFeeGhs: 0,
    summary: 'Built for occasional dorm clear-outs, textbooks, and single-item campus trades.',
  },
  standard: {
    label: 'Standard Seller',
    feePercent: '2.5% transaction fee',
    listingCap: 'Up to 25 active listings',
    monthlyFeeGhs: 25,
    summary: 'Designed for recurring student vendors across halls and Science Market.',
  },
  premium: {
    label: 'Premium Seller',
    feePercent: '1.0% transaction fee',
    listingCap: 'Unlimited active listings',
    monthlyFeeGhs: 60,
    summary: 'Priority campus placement, verified brand spotlight, and lowest platform fee.',
  },
};

export type ListingStatus = 'active' | 'paused' | 'sold';

export type ConversationStatus = 'open' | 'reserved' | 'completed';

export type MessageKind = 'text' | 'meetup_proposal' | 'offer' | 'payment_update';

export type ReferralStatus = 'qualified' | 'rewarded';

export const LISTING_CATEGORIES: ListingCategory[] = [
  'Apparel & Thrift',
  'Tech & Accessories',
  'Textbooks & Study',
  'Food & Drinks',
  'Grooming & Beauty',
  'Design & Repairs',
  'Laundry & Errands',
];

export const LISTING_GROUPINGS: ListingGrouping[] = [
  'Campus Essentials',
  'Hall Life & Dorm',
  'Academic & Tech',
  'Fashion & Beauty',
  'Food & Errands',
  'Events & Tickets',
];

export const PAYMENT_METHODS: PaymentMethod[] = [
  'MTN MoMo',
  'Telecel Cash',
  'AT Money',
  'Cash on Meetup',
  'Bank / Hubtel Transfer',
];

export const POPULAR_BRANDS: string[] = [
  'Steezehub Thrift',
  'Anker & Baseus',
  'Adehye Glow Studio',
  'Sam Jonah Print Lab',
  'Oguaa Kitchen',
  'SRC Express',
  'Apple',
  'Samsung',
  'Nike',
  'Casio',
  'UCC Independent',
];

export const UCC_HALLS = [
  'Valco Hall',
  'Casford Hall',
  'Oguaa Hall',
  'Adehye Hall',
  'Atlantic Hall (ATL)',
  'Kwame Nkrumah Hall (KNH)',
  'Superannuation Hall',
  'SRC Hostel',
  'PSI / Amamoma',
  'Apewosika',
  'Kwaprow',
  'Science Market',
] as const;

export const UCC_MEETUP_ZONES = [
  'Science Market Forecourt',
  'Sam Jonah Library Steps',
  'Old Site Quad',
  'Valco Hall Gate',
  'Casford Forecourt',
  'Oguaa Hall Porter Lodge',
  'Adehye Hall Entrance',
  'ATL Main Gate',
  'SRC Hostel Courtyard',
  'Amamoma Junction',
] as const;

export const FIELD_LIMITS = {
  DISPLAY_NAME_MIN: 2,
  DISPLAY_NAME_MAX: 80,
  HALL_MIN: 2,
  HALL_MAX: 60,
  PROGRAM_MAX: 80,
  BIO_MAX: 300,
  PHONE_MAX: 30,
  TITLE_MIN: 3,
  TITLE_MAX: 100,
  DESCRIPTION_MIN: 10,
  DESCRIPTION_MAX: 1200,
  BRAND_MIN: 1,
  BRAND_MAX: 60,
  PRICE_MIN: 0,
  PRICE_MAX: 100000,
  PRICE_UNIT_MIN: 2,
  PRICE_UNIT_MAX: 30,
  MEETUP_ZONE_MIN: 2,
  MEETUP_ZONE_MAX: 80,
  PAYMENT_METHOD_MAX: 40,
  CONDITION_MIN: 2,
  CONDITION_MAX: 40,
  IMAGE_URL_MAX: 150000,
  MESSAGE_MIN: 1,
  MESSAGE_MAX: 1000,
  REVIEW_MIN: 5,
  REVIEW_MAX: 600,
  REFERRAL_CODE_MIN: 4,
  REFERRAL_CODE_MAX: 32,
} as const;

export const ADMIN_EMAIL = 'futurenyarko@gmail.com';
export const REFERRAL_REWARD_GHS = 15;

export interface UserPublicProfile {
  uid: string;
  displayName: string;
  hall: string;
  program?: string;
  bio?: string;
  photoURL?: string;
  referralCode?: string;
  acceptedPaymentMethods?: string[];
  sellerTier?: SellerTier;
  requestedSellerTier?: SellerTier;
  sellerTierStatus?: SellerTierStatus;
  verifiedCampus: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  phone?: string;
  preferredPaymentMethod?: string;
  updatedAt: Timestamp;
}

export interface FavoriteItem {
  userId: string;
  listingId: string;
  listingTitle: string;
  listingPriceGhs: number;
  listingImageUrl?: string;
  sellerName: string;
  sellerHall: string;
  meetupZone: string;
  brand?: string;
  grouping?: string;
  createdAt: Timestamp;
}

export interface Listing {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerHall: string;
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
  status: ListingStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Conversation {
  id: string;
  listingId: string;
  listingTitle: string;
  listingPriceGhs: number;
  listingImageUrl?: string;
  meetupZone: string;
  paymentMethod?: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  participantIds: string[];
  status: ConversationStatus;
  lastMessageText: string;
  lastMessageSenderId: string;
  lastMessageAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  participantIds: string[];
  text: string;
  kind: MessageKind;
  offerAmountGhs?: number;
  proposedMeetupZone?: string;
  proposedPaymentMethod?: string;
  createdAt: Timestamp;
}

export interface Review {
  id: string;
  listingId: string;
  listingTitle: string;
  sellerId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerHall: string;
  rating: number;
  comment: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ReferralCode {
  code: string;
  ownerUid: string;
  ownerName: string;
  createdAt: Timestamp;
}

export interface Referral {
  id: string;
  referrerUid: string;
  referrerCode: string;
  referrerName: string;
  referredUid: string;
  referredName: string;
  status: ReferralStatus;
  rewardGhs: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OrderRecord {
  id: string;
  listingId: string;
  listingTitle: string;
  listingPriceGhs: number;
  listingImageUrl?: string;
  brand: string;
  grouping: string;
  sellerId: string;
  sellerName: string;
  sellerHall: string;
  buyerId: string;
  buyerName: string;
  participantIds: string[];
  meetupZone: string;
  paymentMethod: string;
  conversationId?: string;
  status: 'completed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ListingPhoto {
  id: string;
  listingId: string;
  sellerId: string;
  listingStatus: ListingStatus;
  imageUrl: string;
  orderIndex: number;
  createdAt: Timestamp;
}


