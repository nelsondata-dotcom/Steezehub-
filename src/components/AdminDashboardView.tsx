import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Star,
  Trash2,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  approveReferralReward,
  approveSellerTier,
  deleteListing,
  deleteReview,
  seedCuratedUccCatalog,
  updateConversationDealState,
  updateListingStatus,
} from '../services/marketplaceService';
import {
  ADMIN_EMAIL,
  Conversation,
  ConversationStatus,
  Listing,
  ListingStatus,
  Referral,
  Review,
  SELLER_TIER_DETAILS,
  SellerTier,
  UserPublicProfile,
} from '../types';

interface AdminDashboardViewProps {
  currentUser: User | null;
  onOpenConversation: (conversationId: string) => void;
}

type AdminTab = 'sellers' | 'listings' | 'conversations' | 'reviews' | 'referrals';

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  currentUser,
  onOpenConversation,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('sellers');
  const [allSellers, setAllSellers] = useState<UserPublicProfile[]>([]);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [allReferrals, setAllReferrals] = useState<Referral[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | ListingStatus>('all');
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [approvingUid, setApprovingUid] = useState<string | null>(null);

  const isAdmin =
    Boolean(currentUser?.emailVerified) && currentUser?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!isAdmin) return;

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setAllSellers(
          snap.docs
            .map((d) => d.data() as UserPublicProfile)
            .sort((a, b) => {
              const aPend = a.sellerTierStatus === 'pending' ? 1 : 0;
              const bPend = b.sellerTierStatus === 'pending' ? 1 : 0;
              if (aPend !== bPend) return bPend - aPend;
              return (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0);
            })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const unsubListings = onSnapshot(
      collection(db, 'listings'),
      (snap) => {
        setAllListings(
          snap.docs
            .map((d) => d.data() as Listing)
            .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'listings')
    );

    const unsubConvs = onSnapshot(
      collection(db, 'conversations'),
      (snap) => {
        setAllConversations(
          snap.docs
            .map((d) => d.data() as Conversation)
            .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'conversations')
    );

    const unsubReviews = onSnapshot(
      collection(db, 'reviews'),
      (snap) => {
        setAllReviews(
          snap.docs
            .map((d) => d.data() as Review)
            .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'reviews')
    );

    const unsubReferrals = onSnapshot(
      collection(db, 'referrals'),
      (snap) => {
        setAllReferrals(
          snap.docs
            .map((d) => d.data() as Referral)
            .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'referrals')
    );

    return () => {
      unsubUsers();
      unsubListings();
      unsubConvs();
      unsubReviews();
      unsubReferrals();
    };
  }, [isAdmin]);

  const metrics = useMemo(() => {
    const activeCount = allListings.filter((l) => l.status === 'active').length;
    const pendingTiers = allSellers.filter((u) => u.sellerTierStatus === 'pending').length;
    const avgRating =
      allReviews.length > 0
        ? allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length
        : 0;
    const pendingReferrals = allReferrals.filter((r) => r.status === 'qualified').length;
    const brandSet = new Set(allListings.map((l) => l.brand).filter(Boolean));

    return {
      totalSellers: allSellers.length,
      pendingTiers,
      activeCount,
      totalListings: allListings.length,
      brandCount: brandSet.size,
      totalReviews: allReviews.length,
      avgRating,
      pendingReferrals,
      totalReferrals: allReferrals.length,
    };
  }, [allSellers, allListings, allReviews, allReferrals]);

  const filteredListings = useMemo(() => {
    if (statusFilter === 'all') return allListings;
    return allListings.filter((l) => l.status === statusFilter);
  }, [allListings, statusFilter]);

  if (!isAdmin) {
    return (
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="bg-white border border-[#E4E0D8] rounded-xl p-10 space-y-4">
          <ShieldCheck className="w-8 h-8 text-[#0F4C81] mx-auto" />
          <h1 className="font-display text-2xl font-bold text-[#14171A]">
            Campus Admin Access Required
          </h1>
          <p className="text-sm text-[#575B62] max-w-md mx-auto">
            This moderation, seller fee tier approval, and referral payout console is restricted to verified Steezehub campus administrators.
          </p>
        </div>
      </section>
    );
  }

  const handleSyncCatalog = async () => {
    setSyncingCatalog(true);
    setSyncMessage('');
    try {
      const updated = await seedCuratedUccCatalog();
      setSyncMessage(
        updated > 0
          ? `Synchronized ${updated} curated listings with groupings, brands, and payment methods.`
          : 'All curated UCC listings and seller tiers are up to date.'
      );
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncingCatalog(false);
    }
  };

  const handleApproveTier = async (sellerUid: string, tier: SellerTier) => {
    setApprovingUid(sellerUid);
    try {
      await approveSellerTier(sellerUid, tier);
    } finally {
      setApprovingUid(null);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#575B62]">
            Steezehub Administration
          </p>
          <h1 className="font-display text-3xl font-bold text-[#14171A]">
            Campus Marketplace Operations
          </h1>
        </div>

        <button
          type="button"
          disabled={syncingCatalog}
          onClick={handleSyncCatalog}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncingCatalog ? 'animate-spin' : ''}`} />
          <span>{syncingCatalog ? 'Syncing...' : 'Sync Curated Catalog'}</span>
        </button>
      </div>

      {syncMessage && (
        <div className="bg-white border border-[#E4E0D8] rounded-xl px-4 py-3 text-xs text-[#0F4C81] font-medium">
          {syncMessage}
        </div>
      )}

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E4E0D8] rounded-xl p-5 space-y-1">
          <p className="text-xs text-[#575B62]">Seller Fee Approvals</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-[#0F4C81]">
            {metrics.pendingTiers}{' '}
            <span className="text-sm font-normal text-[#575B62]">
              pending / {metrics.totalSellers} sellers
            </span>
          </p>
          <p className="text-xs text-[#575B62]">
            Micro · Standard · Premium plans
          </p>
        </div>

        <div className="bg-white border border-[#E4E0D8] rounded-xl p-5 space-y-1">
          <p className="text-xs text-[#575B62]">Listings &amp; Brands</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-[#14171A]">
            {metrics.activeCount}{' '}
            <span className="text-sm font-normal text-[#575B62]">
              / {metrics.totalListings} total
            </span>
          </p>
          <p className="text-xs text-[#575B62] font-mono tabular-nums">
            {metrics.brandCount} active brands
          </p>
        </div>

        <div className="bg-white border border-[#E4E0D8] rounded-xl p-5 space-y-1">
          <p className="text-xs text-[#575B62]">Reviews &amp; Ratings</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-[#14171A]">
            {metrics.totalReviews > 0 ? metrics.avgRating.toFixed(1) : '—'}
          </p>
          <p className="text-xs text-[#575B62] font-mono tabular-nums">
            {metrics.totalReviews} student reviews
          </p>
        </div>

        <div className="bg-white border border-[#E4E0D8] rounded-xl p-5 space-y-1">
          <p className="text-xs text-[#575B62]">Customer Referrals</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-[#0F4C81]">
            {metrics.pendingReferrals}
          </p>
          <p className="text-xs text-[#575B62] font-mono tabular-nums">
            pending approval ({metrics.totalReferrals} total)
          </p>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E4E0D8] pb-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#EFECE6] rounded-lg">
          {(
            [
              { id: 'sellers', label: 'Seller Fee Approvals' },
              { id: 'listings', label: 'Listings & Brands' },
              { id: 'conversations', label: 'Conversations & Payments' },
              { id: 'reviews', label: 'Reviews Moderation' },
              { id: 'referrals', label: 'Referral Payouts' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-[#14171A] shadow-xs'
                  : 'text-[#575B62] hover:text-[#14171A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'listings' && (
          <select
            aria-label="Filter admin listings by status"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'all' | ListingStatus)
            }
            className="rounded-lg border border-[#E4E0D8] bg-white px-3 py-1.5 text-xs font-medium text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="sold">Sold</option>
          </select>
        )}
      </div>

      {/* Seller Fee Tier Approval Tab */}
      {activeTab === 'sellers' && (
        <div className="bg-white border border-[#E4E0D8] rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E4E0D8] text-xs text-[#575B62]">
                <th className="py-3.5 px-4 font-medium">Seller &amp; UCC Hall</th>
                <th className="py-3.5 px-4 font-medium">Current Fee Tier</th>
                <th className="py-3.5 px-4 font-medium">Requested / Status</th>
                <th className="py-3.5 px-4 font-medium text-right">
                  Approve Fee Tier
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E0D8]">
              {allSellers.map((seller) => {
                const currentTier: SellerTier = seller.sellerTier || 'micro';
                const requestedTier: SellerTier =
                  seller.requestedSellerTier || currentTier;
                const tierStatus = seller.sellerTierStatus || 'approved';
                const currentInfo = SELLER_TIER_DETAILS[currentTier];

                return (
                  <tr key={seller.uid} className="hover:bg-[#F8F7F4]/60">
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-[#14171A]">
                        {seller.displayName}
                      </p>
                      <p className="text-xs text-[#575B62]">
                        {seller.hall}
                        {seller.program ? ` · ${seller.program}` : ''}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <p className="font-semibold text-[#14171A]">
                        {currentInfo.label}
                      </p>
                      <p className="font-mono tabular-nums text-[#575B62]">
                        {currentInfo.feePercent} · GH₵ {currentInfo.monthlyFeeGhs}/mo
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {tierStatus === 'pending' ? (
                        <span className="font-medium text-[#C88A1E]">
                          Requested: {SELLER_TIER_DETAILS[requestedTier].label}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#0F4C81] font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approved</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        {(['micro', 'standard', 'premium'] as const).map((tierOption) => {
                          const isCurrentApproved =
                            currentTier === tierOption && tierStatus === 'approved';
                          return (
                            <button
                              key={tierOption}
                              type="button"
                              disabled={approvingUid === seller.uid || isCurrentApproved}
                              onClick={() => handleApproveTier(seller.uid, tierOption)}
                              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors cursor-pointer whitespace-nowrap ${
                                isCurrentApproved
                                  ? 'bg-[#0F4C81] text-white cursor-default'
                                  : requestedTier === tierOption && tierStatus === 'pending'
                                    ? 'bg-[#C88A1E] text-white hover:opacity-90'
                                    : 'bg-[#EFECE6] text-[#14171A] hover:bg-[#E4E0D8]'
                              }`}
                            >
                              {isCurrentApproved
                                ? `${tierOption} ✓`
                                : `Approve ${tierOption}`}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'listings' && (
        <div className="bg-white border border-[#E4E0D8] rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E4E0D8] text-xs text-[#575B62]">
                <th className="py-3.5 px-4 font-medium">Listing &amp; Seller</th>
                <th className="py-3.5 px-4 font-medium">Grouping &amp; Brand</th>
                <th className="py-3.5 px-4 font-medium">Payment Methods</th>
                <th className="py-3.5 px-4 font-medium">Price</th>
                <th className="py-3.5 px-4 font-medium">Status</th>
                <th className="py-3.5 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E0D8]">
              {filteredListings.map((item) => (
                <tr key={item.id} className="hover:bg-[#F8F7F4]/60">
                  <td className="py-3.5 px-4">
                    <p className="font-medium text-[#14171A]">{item.title}</p>
                    <p className="text-xs text-[#575B62]">
                      {item.sellerName} · {item.sellerHall}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-[#575B62]">
                    <p className="font-medium text-[#14171A]">
                      {item.brand || 'UCC Independent'}
                    </p>
                    <p>{item.grouping || 'Campus Essentials'}</p>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-[#575B62]">
                    {(item.acceptedPaymentMethods || ['MTN MoMo']).join(' · ')}
                  </td>
                  <td className="py-3.5 px-4 font-mono tabular-nums text-xs font-semibold text-[#0F4C81]">
                    GH₵ {item.priceGhs.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4">
                    <select
                      aria-label={`Status for ${item.title}`}
                      value={item.status}
                      onChange={(e) =>
                        updateListingStatus(item.id, e.target.value as ListingStatus)
                      }
                      className="rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-2.5 py-1 text-xs font-medium text-[#14171A]"
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="sold">Sold</option>
                    </select>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => deleteListing(item.id)}
                      aria-label={`Delete ${item.title}`}
                      className="p-2 text-[#575B62] hover:text-[#9B2C2C] rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'conversations' && (
        <div className="bg-white border border-[#E4E0D8] rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E4E0D8] text-xs text-[#575B62]">
                <th className="py-3.5 px-4 font-medium">Listing &amp; Parties</th>
                <th className="py-3.5 px-4 font-medium">Meetup &amp; Payment</th>
                <th className="py-3.5 px-4 font-medium">Latest Message</th>
                <th className="py-3.5 px-4 font-medium">Deal Status</th>
                <th className="py-3.5 px-4 font-medium text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E0D8]">
              {allConversations.map((conv) => (
                <tr key={conv.id} className="hover:bg-[#F8F7F4]/60">
                  <td className="py-3.5 px-4">
                    <p className="font-medium text-[#14171A]">{conv.listingTitle}</p>
                    <p className="text-xs text-[#575B62]">
                      Buyer: {conv.buyerName} · Seller: {conv.sellerName}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-[#575B62]">
                    <p className="font-medium text-[#14171A]">
                      {conv.paymentMethod || 'MTN MoMo'}
                    </p>
                    <p>{conv.meetupZone}</p>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-[#575B62] max-w-xs truncate">
                    {conv.lastMessageText}
                  </td>
                  <td className="py-3.5 px-4">
                    <select
                      aria-label={`Deal status for ${conv.listingTitle}`}
                      value={conv.status}
                      onChange={(e) =>
                        updateConversationDealState(
                          conv.id,
                          e.target.value as ConversationStatus,
                          conv.meetupZone,
                          conv.paymentMethod
                        )
                      }
                      className="rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-2.5 py-1 text-xs font-medium text-[#14171A]"
                    >
                      <option value="open">Open Inquiry</option>
                      <option value="reserved">Meetup Scheduled</option>
                      <option value="completed">Completed</option>
                    </select>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenConversation(conv.id)}
                      className="px-3 py-1.5 text-xs font-medium text-[#0F4C81] bg-[#0F4C81]/10 hover:bg-[#0F4C81] hover:text-white rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Open Chat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="space-y-3">
          {allReviews.length === 0 ? (
            <div className="bg-white border border-[#E4E0D8] rounded-xl p-8 text-sm text-[#575B62]">
              No student reviews have been posted yet.
            </div>
          ) : (
            allReviews.map((rev) => (
              <article
                key={rev.id}
                className="bg-white border border-[#E4E0D8] rounded-xl p-5 flex items-start justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-[#575B62]">
                    <span className="font-semibold text-[#14171A]">
                      {rev.listingTitle}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {rev.reviewerName} ({rev.reviewerHall})
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[#14171A]">
                      <Star className="w-3.5 h-3.5 fill-[#C88A1E] text-[#C88A1E]" />
                      {rev.rating}.0
                    </span>
                  </div>
                  <p className="text-sm text-[#14171A]">{rev.comment}</p>
                </div>

                <button
                  type="button"
                  onClick={() => deleteReview(rev.id)}
                  aria-label="Remove review"
                  className="p-2 text-[#575B62] hover:text-[#9B2C2C] rounded-lg cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </article>
            ))
          )}
        </div>
      )}

      {activeTab === 'referrals' && (
        <div className="bg-white border border-[#E4E0D8] rounded-xl overflow-x-auto">
          {allReferrals.length === 0 ? (
            <div className="p-8 text-sm text-[#575B62]">
              No student referral claims yet. Students can share or apply invite codes inside Account Info.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E4E0D8] text-xs text-[#575B62]">
                  <th className="py-3.5 px-4 font-medium">Referrer</th>
                  <th className="py-3.5 px-4 font-medium">Referred Student</th>
                  <th className="py-3.5 px-4 font-medium">Code</th>
                  <th className="py-3.5 px-4 font-medium">Credit</th>
                  <th className="py-3.5 px-4 font-medium">Status</th>
                  <th className="py-3.5 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E0D8]">
                {allReferrals.map((ref) => (
                  <tr key={ref.id} className="hover:bg-[#F8F7F4]/60">
                    <td className="py-3.5 px-4 font-medium text-[#14171A]">
                      {ref.referrerName}
                    </td>
                    <td className="py-3.5 px-4 text-[#575B62]">
                      {ref.referredName}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-[#14171A]">
                      {ref.referrerCode}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-xs font-semibold text-[#0F4C81]">
                      GH₵ {ref.rewardGhs.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-xs capitalize font-medium text-[#14171A]">
                      {ref.status}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {ref.status === 'qualified' ? (
                        <button
                          type="button"
                          onClick={() => approveReferralReward(ref.id)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Approve Reward
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-[#575B62]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#0F4C81]" />
                          <span>Paid</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
};
