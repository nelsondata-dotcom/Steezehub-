import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, onSnapshot, query, Timestamp, where } from 'firebase/firestore';
import {
  Bookmark,
  CheckCircle2,
  CreditCard,
  MapPin,
  MessageSquare,
  PackageCheck,
  Pencil,
  Plus,
  Receipt,
  ShieldCheck,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  deleteListing,
  removeFavoriteListing,
  requestSellerTierUpgrade,
  updateListingStatus,
} from '../services/marketplaceService';
import {
  Conversation,
  FavoriteItem,
  Listing,
  OrderRecord,
  SELLER_TIER_DETAILS,
  SellerTier,
  UserPublicProfile,
} from '../types';
import { ResilientImage } from './ResilientImage';
import { MarkAsSoldModal } from './MarkAsSoldModal';

interface MyShopViewProps {
  currentUser: User | null;
  currentProfile: UserPublicProfile | null;
  favorites: FavoriteItem[];
  onProfileUpdated: () => void;
  onPostNew: () => void;
  onEditListing: (listing: Listing) => void;
  onInspectListing: (listingId: string) => void;
  onOpenConversation: (conversationId: string) => void;
  onOpenAccountInfo: () => void;
  onSignIn: () => void;
}

function formatOrderDate(ts?: Timestamp | null): string {
  if (!ts || typeof ts.toDate !== 'function') return 'Just now';
  return ts.toDate().toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const MyShopView: React.FC<MyShopViewProps> = ({
  currentUser,
  currentProfile,
  favorites,
  onProfileUpdated,
  onPostNew,
  onEditListing,
  onInspectListing,
  onOpenConversation,
  onOpenAccountInfo,
  onSignIn,
}) => {
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [sellerConversations, setSellerConversations] = useState<Conversation[]>([]);

  const [shopTab, setShopTab] = useState<'listings' | 'orders' | 'wishlist'>('listings');
  const [showSoldInListings, setShowSoldInListings] = useState(false);
  const [requestingTier, setRequestingTier] = useState(false);
  const [tierMessage, setTierMessage] = useState('');
  const [markingSoldListing, setMarkingSoldListing] = useState<Listing | null>(null);
  const [soldSuccessNotice, setSoldSuccessNotice] = useState('');

  useEffect(() => {
    if (!currentUser) {
      setMyListings([]);
      setOrders([]);
      setSellerConversations([]);
      setLoadingListings(false);
      setLoadingOrders(false);
      return;
    }

    setLoadingListings(true);
    const qListings = query(
      collection(db, 'listings'),
      where('sellerId', '==', currentUser.uid)
    );
    const unsubListings = onSnapshot(
      qListings,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as Listing)
          .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setMyListings(list);
        setLoadingListings(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'listings');
      }
    );

    setLoadingOrders(true);
    const qOrders = query(
      collection(db, 'orders'),
      where('participantIds', 'array-contains', currentUser.uid)
    );
    const unsubOrders = onSnapshot(
      qOrders,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as OrderRecord)
          .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setOrders(list);
        setLoadingOrders(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }
    );

    const qConvs = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', currentUser.uid)
    );
    const unsubConvs = onSnapshot(
      qConvs,
      (snap) => {
        setSellerConversations(
          snap.docs
            .map((d) => d.data() as Conversation)
            .filter((c) => c.sellerId === currentUser.uid)
            .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0))
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'conversations');
      }
    );

    return () => {
      unsubListings();
      unsubOrders();
      unsubConvs();
    };
  }, [currentUser]);

  const combinedOrderHistory = useMemo(() => {
    const orderListingIds = new Set(orders.map((o) => o.listingId));
    const legacySoldListings = myListings
      .filter((l) => l.status === 'sold' && !orderListingIds.has(l.id))
      .map(
        (l): OrderRecord => ({
          id: `legacy_${l.id}`,
          listingId: l.id,
          listingTitle: l.title,
          listingPriceGhs: l.priceGhs,
          listingImageUrl: l.imageUrl,
          brand: l.brand || 'UCC Independent',
          grouping: l.grouping || 'Campus Essentials',
          sellerId: l.sellerId,
          sellerName: l.sellerName,
          sellerHall: l.sellerHall,
          buyerId: 'campus_walkup_buyer',
          buyerName: 'UCC Campus Buyer',
          participantIds: [l.sellerId],
          meetupZone: l.meetupZone,
          paymentMethod: l.acceptedPaymentMethods?.[0] || 'MTN MoMo',
          status: 'completed',
          createdAt: l.updatedAt || l.createdAt,
          updatedAt: l.updatedAt || l.createdAt,
        })
      );

    return [...orders, ...legacySoldListings].sort(
      (a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
    );
  }, [orders, myListings]);

  const displayedListings = useMemo(() => {
    if (showSoldInListings) return myListings;
    return myListings.filter((item) => item.status !== 'sold');
  }, [myListings, showSoldInListings]);

  const shopMetrics = useMemo(() => {
    const activeCount = myListings.filter((l) => l.status === 'active').length;
    const salesTotalGhs = combinedOrderHistory
      .filter((o) => o.sellerId === currentUser?.uid)
      .reduce((sum, o) => sum + (o.listingPriceGhs || 0), 0);
    return {
      activeCount,
      orderCount: combinedOrderHistory.length,
      salesTotalGhs,
    };
  }, [myListings, combinedOrderHistory, currentUser?.uid]);

  if (!currentUser) {
    return (
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="bg-white border border-[#E4E0D8] rounded-xl p-10 space-y-5">
          <h1 className="font-display text-2xl font-bold text-[#14171A] text-balance">
            Open your UCC student shop on Steezehub
          </h1>
          <p className="text-sm text-[#575B62] max-w-md mx-auto leading-relaxed">
            Sign in with Google to publish goods or services, track completed orders in your Order History, access your saved wishlist, and apply for Micro, Standard, or Premium seller fee plans.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] rounded-lg transition-colors cursor-pointer"
          >
            Sign in with Google
          </button>
        </div>
      </section>
    );
  }

  const currentTier: SellerTier = currentProfile?.sellerTier || 'micro';
  const requestedTier: SellerTier =
    currentProfile?.requestedSellerTier || currentTier;
  const tierStatus = currentProfile?.sellerTierStatus || 'approved';
  const tierDetails = SELLER_TIER_DETAILS[currentTier];

  const handleRequestUpgrade = async (tier: SellerTier) => {
    setRequestingTier(true);
    setTierMessage('');
    try {
      await requestSellerTierUpgrade(currentUser.uid, tier);
      setTierMessage(
        `Submitted ${SELLER_TIER_DETAILS[tier].label} approval request to campus admin.`
      );
      onProfileUpdated();
    } catch (err) {
      setTierMessage(
        err instanceof Error ? err.message : 'Unable to request seller tier.'
      );
    } finally {
      setRequestingTier(false);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* Shop Overview Header */}
      <div className="bg-white border border-[#E4E0D8] rounded-xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#575B62]">
            <span className="font-semibold text-[#14171A]">
              {currentProfile?.displayName || currentUser.displayName}
            </span>
            <span aria-hidden="true">·</span>
            <span>{currentProfile?.hall || 'UCC Campus'}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-medium text-[#0F4C81]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{tierDetails.label}</span>
            </span>
          </div>

          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#14171A]">
            My Campus Shop
          </h1>
          <p className="text-xs text-[#575B62]">
            <span className="font-mono tabular-nums text-[#14171A] font-medium">
              {tierDetails.feePercent} · {tierDetails.listingCap} · GH₵ {tierDetails.monthlyFeeGhs}/mo
            </span>
            {tierStatus === 'pending' && (
              <span className="text-[#C88A1E] font-medium">
                {' '}
                · Pending approval for {SELLER_TIER_DETAILS[requestedTier].label}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onOpenAccountInfo}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium text-[#14171A] bg-[#EFECE6] hover:bg-[#E4E0D8] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <UserIcon className="w-4 h-4 text-[#0F4C81]" />
            <span>Account Info</span>
          </button>

          <button
            type="button"
            onClick={onPostNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Post Listing</span>
          </button>
        </div>
      </div>

      {/* 4-Column Shop Performance Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E4E0D8] rounded-xl p-5 space-y-1">
          <p className="text-xs text-[#575B62]">Active Feed Listings</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-[#14171A]">
            {shopMetrics.activeCount}
          </p>
        </div>
        <div className="bg-white border border-[#E4E0D8] rounded-xl p-5 space-y-1">
          <p className="text-xs text-[#575B62]">Order History</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-[#0F4C81]">
            {shopMetrics.orderCount}
          </p>
        </div>
        <div className="bg-white border border-[#E4E0D8] rounded-xl p-5 space-y-1">
          <p className="text-xs text-[#575B62]">Completed Sales</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-[#14171A]">
            GH₵ {shopMetrics.salesTotalGhs.toFixed(0)}
          </p>
        </div>
        <div className="bg-white border border-[#E4E0D8] rounded-xl p-5 space-y-1">
          <p className="text-xs text-[#575B62]">Saved Wishlist</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-[#14171A]">
            {favorites.length}
          </p>
        </div>
      </div>

      {/* Seller Fee Tier Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['micro', 'standard', 'premium'] as const).map((tierKey) => {
          const info = SELLER_TIER_DETAILS[tierKey];
          const isActiveTier = currentTier === tierKey && tierStatus === 'approved';
          const isPending = tierStatus === 'pending' && requestedTier === tierKey;
          return (
            <div
              key={tierKey}
              className={`bg-white border rounded-xl p-5 flex flex-col justify-between gap-4 ${
                isActiveTier ? 'border-[#0F4C81]' : 'border-[#E4E0D8]'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-base font-bold text-[#14171A]">
                    {info.label}
                  </h2>
                  <span className="font-mono tabular-nums text-xs font-semibold text-[#0F4C81]">
                    GH₵ {info.monthlyFeeGhs}/mo
                  </span>
                </div>
                <p className="text-xs font-medium text-[#14171A]">
                  {info.feePercent} · {info.listingCap}
                </p>
                <p className="text-xs text-[#575B62] leading-relaxed">
                  {info.summary}
                </p>
              </div>

              <button
                type="button"
                disabled={requestingTier || isActiveTier || isPending}
                onClick={() => handleRequestUpgrade(tierKey)}
                className={`w-full py-2 px-3 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  isActiveTier
                    ? 'bg-[#0F4C81]/10 text-[#0F4C81] cursor-default'
                    : isPending
                      ? 'bg-[#EFECE6] text-[#C88A1E] cursor-default'
                      : 'bg-[#EFECE6] hover:bg-[#E4E0D8] text-[#14171A]'
                }`}
              >
                {isActiveTier
                  ? 'Current Approved Tier'
                  : isPending
                    ? 'Pending Admin Approval'
                    : `Request ${info.label}`}
              </button>
            </div>
          );
        })}
      </div>

      {tierMessage && (
        <p className="text-xs text-[#0F4C81] font-medium">{tierMessage}</p>
      )}

      {soldSuccessNotice && (
        <div className="bg-white border border-[#0F4C81]/30 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="inline-flex items-center gap-2 font-medium text-[#14171A]">
            <CheckCircle2 className="w-4 h-4 text-[#0F4C81]" />
            <span>{soldSuccessNotice}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setShopTab('orders');
              setSoldSuccessNotice('');
            }}
            className="font-medium text-[#0F4C81] hover:underline cursor-pointer"
          >
            View in Order History
          </button>
        </div>
      )}

      {/* Shop Tabs: My Listings | Order History | Saved Wishlist */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E4E0D8] pb-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#EFECE6] rounded-lg">
          <button
            type="button"
            onClick={() => setShopTab('listings')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              shopTab === 'listings'
                ? 'bg-white text-[#14171A] shadow-xs'
                : 'text-[#575B62] hover:text-[#14171A]'
            }`}
          >
            My Listings ({displayedListings.length})
          </button>
          <button
            type="button"
            onClick={() => setShopTab('orders')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              shopTab === 'orders'
                ? 'bg-white text-[#14171A] shadow-xs'
                : 'text-[#575B62] hover:text-[#14171A]'
            }`}
          >
            Order History ({combinedOrderHistory.length})
          </button>
          <button
            type="button"
            onClick={() => setShopTab('wishlist')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              shopTab === 'wishlist'
                ? 'bg-white text-[#14171A] shadow-xs'
                : 'text-[#575B62] hover:text-[#14171A]'
            }`}
          >
            Saved Wishlist ({favorites.length})
          </button>
        </div>

        {shopTab === 'listings' && myListings.some((l) => l.status === 'sold') && (
          <label className="inline-flex items-center gap-2 text-xs text-[#575B62] cursor-pointer">
            <input
              type="checkbox"
              checked={showSoldInListings}
              onChange={(e) => setShowSoldInListings(e.target.checked)}
              className="rounded border-[#E4E0D8] text-[#0F4C81] focus:ring-[#0F4C81]"
            />
            <span>Include archived sold listings</span>
          </label>
        )}
      </div>

      {shopTab === 'listings' && (
        <>
          {loadingListings ? (
            <div className="bg-white border border-[#E4E0D8] rounded-xl p-8 text-sm text-[#575B62]">
              Loading your listings...
            </div>
          ) : displayedListings.length === 0 ? (
            <div className="bg-white border border-[#E4E0D8] rounded-xl p-12 text-center space-y-4">
              <h3 className="font-display text-lg font-bold text-[#14171A]">
                {myListings.length === 0
                  ? "You haven't posted any listings yet"
                  : 'All your listings have been marked as sold'}
              </h3>
              <p className="text-sm text-[#575B62] max-w-md mx-auto">
                {myListings.length === 0
                  ? 'Publish a product, textbook, snack, or student service so buyers across UCC halls can message you.'
                  : 'Sold items are automatically hidden from the Home feed and preserved in your Order History.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onPostNew}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Post New Listing</span>
                </button>
                {combinedOrderHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShopTab('orders')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#14171A] bg-[#EFECE6] hover:bg-[#E4E0D8] rounded-lg transition-colors cursor-pointer"
                  >
                    <Receipt className="w-4 h-4 text-[#0F4C81]" />
                    <span>View Order History</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedListings.map((item) => (
                <article
                  key={item.id}
                  className="bg-white border border-[#E4E0D8] rounded-xl overflow-hidden flex flex-col"
                >
                  <div className="aspect-[4/3] bg-[#F3F1EC] overflow-hidden">
                    <ResilientImage
                      src={item.imageUrl}
                      alt={item.title}
                      title={item.title}
                    />
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="text-xs text-[#575B62]">
                        <span className="font-medium text-[#14171A]">
                          {item.brand || 'UCC Independent'}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>{item.grouping || item.category}</span>
                        <span aria-hidden="true"> · </span>
                        <span
                          className={`capitalize font-medium ${
                            item.status === 'active'
                              ? 'text-[#0F4C81]'
                              : item.status === 'sold'
                                ? 'text-[#14171A]'
                                : 'text-[#C88A1E]'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-[#14171A] line-clamp-1">
                        {item.title}
                      </h3>
                      <p className="font-mono tabular-nums text-sm font-semibold text-[#0F4C81]">
                        GH₵ {item.priceGhs.toFixed(2)}{' '}
                        <span className="font-sans font-normal text-xs text-[#575B62]">
                          · {item.meetupZone}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#E4E0D8]">
                      {item.status !== 'sold' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onEditListing(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#14171A] bg-[#EFECE6] hover:bg-[#E4E0D8] rounded-lg transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateListingStatus(
                                item.id,
                                item.status === 'active' ? 'paused' : 'active'
                              )
                            }
                            className="px-3 py-1.5 text-xs font-medium text-[#14171A] bg-[#EFECE6] hover:bg-[#E4E0D8] rounded-lg transition-colors cursor-pointer"
                          >
                            {item.status === 'active' ? 'Pause' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setMarkingSoldListing(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] rounded-lg transition-colors cursor-pointer"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>Mark as Sold</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShopTab('orders')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0F4C81] bg-[#0F4C81]/10 hover:bg-[#0F4C81]/15 rounded-lg transition-colors cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>View in Order History</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteListing(item.id)}
                        aria-label={`Delete ${item.title}`}
                        className="ml-auto p-1.5 text-[#575B62] hover:text-[#9B2C2C] rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {shopTab === 'orders' && (
        <>
          {loadingOrders ? (
            <div className="bg-white border border-[#E4E0D8] rounded-xl p-8 text-sm text-[#575B62]">
              Loading your order history...
            </div>
          ) : combinedOrderHistory.length === 0 ? (
            <div className="bg-white border border-[#E4E0D8] rounded-xl p-12 text-center space-y-3">
              <Receipt className="w-8 h-8 text-[#575B62]/60 mx-auto" strokeWidth={1.5} />
              <h3 className="font-display text-lg font-bold text-[#14171A]">
                No completed campus orders yet
              </h3>
              <p className="text-sm text-[#575B62] max-w-md mx-auto">
                When you mark any of your listings as sold—or complete a purchase with another UCC student—the verified order receipt is stored here permanently.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {combinedOrderHistory.map((order) => {
                const isSeller = order.sellerId === currentUser.uid;
                return (
                  <article
                    key={order.id}
                    className="bg-white border border-[#E4E0D8] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-5"
                  >
                    <div className="flex items-start sm:items-center gap-4 min-w-0">
                      <div className="w-24 h-20 rounded-lg overflow-hidden bg-[#EFECE6] shrink-0">
                        <ResilientImage
                          src={order.listingImageUrl}
                          alt={order.listingTitle}
                          title={order.listingTitle}
                        />
                      </div>

                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#575B62]">
                          <span className="font-semibold text-[#0F4C81]">
                            {isSeller ? 'Sold Order' : 'Purchased Order'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatOrderDate(order.createdAt)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-[11px] uppercase">
                            #{order.id.slice(-8)}
                          </span>
                        </div>

                        <h3 className="text-base font-semibold text-[#14171A] truncate">
                          {order.listingTitle}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#575B62]">
                          <span>
                            {isSeller
                              ? `Buyer: ${order.buyerName}`
                              : `Seller: ${order.sellerName} (${order.sellerHall})`}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <CreditCard className="w-3.5 h-3.5 text-[#0F4C81]" />
                            <span>{order.paymentMethod}</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#0F4C81]" />
                            <span>{order.meetupZone}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[#E4E0D8]">
                      <div className="text-left md:text-right">
                        <p className="font-mono tabular-nums text-lg font-bold text-[#14171A]">
                          GH₵ {order.listingPriceGhs.toFixed(2)}
                        </p>
                        <p className="text-[11px] font-medium text-[#0F4C81] inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Completed · Hidden from Feed</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {order.conversationId && (
                          <button
                            type="button"
                            onClick={() => onOpenConversation(order.conversationId!)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#14171A] bg-[#EFECE6] hover:bg-[#E4E0D8] rounded-lg transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-[#0F4C81]" />
                            <span>Chat Receipt</span>
                          </button>
                        )}
                        {isSeller && (
                          <button
                            type="button"
                            onClick={() => onInspectListing(order.listingId)}
                            className="px-3 py-1.5 text-xs font-medium text-[#0F4C81] bg-[#0F4C81]/10 hover:bg-[#0F4C81]/15 rounded-lg transition-colors cursor-pointer"
                          >
                            Listing Details
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {shopTab === 'wishlist' && (
        <>
          {favorites.length === 0 ? (
            <div className="bg-white border border-[#E4E0D8] rounded-xl p-12 text-center space-y-3">
              <Bookmark className="w-7 h-7 text-[#575B62]/60 mx-auto" />
              <h3 className="font-display text-lg font-bold text-[#14171A]">
                No saved wishlist items yet
              </h3>
              <p className="text-sm text-[#575B62] max-w-md mx-auto">
                Save any campus good or service from the Home page to compare prices and message sellers right from your shop.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favorites.map((fav) => (
                <article
                  key={fav.listingId}
                  className="bg-white border border-[#E4E0D8] rounded-xl overflow-hidden flex flex-col"
                >
                  <button
                    type="button"
                    onClick={() => onInspectListing(fav.listingId)}
                    className="aspect-[4/3] bg-[#F3F1EC] overflow-hidden cursor-pointer"
                  >
                    <ResilientImage
                      src={fav.listingImageUrl}
                      alt={fav.listingTitle}
                      title={fav.listingTitle}
                    />
                  </button>
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-1.5">
                      <p className="text-xs text-[#575B62] truncate">
                        {fav.brand || 'UCC Independent'} · {fav.grouping || 'Campus Essentials'}
                      </p>
                      <h3 className="text-base font-semibold text-[#14171A] line-clamp-1">
                        {fav.listingTitle}
                      </h3>
                      <p className="font-mono tabular-nums text-sm font-semibold text-[#0F4C81]">
                        GH₵ {fav.listingPriceGhs.toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#E4E0D8]">
                      <span className="inline-flex items-center gap-1 text-xs text-[#575B62] truncate">
                        <MapPin className="w-3.5 h-3.5 text-[#0F4C81] shrink-0" />
                        <span className="truncate">{fav.meetupZone}</span>
                      </span>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onInspectListing(fav.listingId)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] rounded-lg transition-colors cursor-pointer"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            removeFavoriteListing(currentUser.uid, fav.listingId)
                          }
                          aria-label={`Remove ${fav.listingTitle}`}
                          className="p-1.5 text-[#575B62] hover:text-[#9B2C2C] rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {markingSoldListing && (
        <MarkAsSoldModal
          listing={markingSoldListing}
          conversationsForListing={sellerConversations.filter(
            (c) => c.listingId === markingSoldListing.id
          )}
          onClose={() => setMarkingSoldListing(null)}
          onCompleted={() => {
            const soldTitle = markingSoldListing.title;
            setMarkingSoldListing(null);
            setSoldSuccessNotice(
              `"${soldTitle}" has been marked as sold, hidden from the Home feed, and saved to your Order History.`
            );
          }}
        />
      )}
    </section>
  );
};
