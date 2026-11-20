import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Heart,
  MapPin,
  MessageSquare,
  PackageCheck,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  FIELD_LIMITS,
  Listing,
  Review,
  UserPublicProfile,
} from '../types';
import {
  fetchListingPhotos,
  fetchSellerProfile,
  startOrGetConversation,
  submitReview,
  toggleFavoriteListing,
} from '../services/marketplaceService';
import { ResilientImage } from './ResilientImage';

interface ListingModalProps {
  listing: Listing;
  currentUser: User | null;
  currentProfile: UserPublicProfile | null;
  isFavorited: boolean;
  onClose: () => void;
  onRequireSignIn: () => void;
  onOpenConversation: (conversationId: string) => void;
  onEditListing: (listing: Listing) => void;
  onMarkAsSold?: (listing: Listing) => void;
}

export const ListingModal: React.FC<ListingModalProps> = ({
  listing,
  currentUser,
  currentProfile,
  isFavorited,
  onClose,
  onRequireSignIn,
  onOpenConversation,
  onEditListing,
  onMarkAsSold,
}) => {
  const [sellerProfile, setSellerProfile] = useState<UserPublicProfile | null>(null);
  const [inquiryText, setInquiryText] = useState(
    `Hi ${listing.sellerName.split(' ')[0]}, is "${listing.title}" still available at ${listing.meetupZone}?`
  );
  const [sending, setSending] = useState(false);
  const [togglingFav, setTogglingFav] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [reviews, setReviews] = useState<Review[]>([]);
  const [ratingInput, setRatingInput] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewNotice, setReviewNotice] = useState('');
  const [extraPhotoUrls, setExtraPhotoUrls] = useState<string[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const isOwner = currentUser?.uid === listing.sellerId;

  useEffect(() => {
    let active = true;
    setActivePhotoIndex(0);
    setExtraPhotoUrls([]);
    fetchListingPhotos(listing, currentUser?.uid)
      .then((photos) => {
        if (active) {
          setExtraPhotoUrls(photos.map((p) => p.imageUrl).filter(Boolean));
        }
      })
      .catch(() => {
        // Keep primary cover photo if subcollection query is unavailable
      });
    return () => {
      active = false;
    };
  }, [listing, currentUser?.uid]);

  const galleryUrls = useMemo(
    () =>
      Array.from(
        new Set(
          [listing.imageUrl, ...extraPhotoUrls].filter(
            (u): u is string => Boolean(u)
          )
        )
      ),
    [listing.imageUrl, extraPhotoUrls]
  );

  const safePhotoIndex = Math.min(
    activePhotoIndex,
    Math.max(0, galleryUrls.length - 1)
  );
  const activeImageUrl = galleryUrls[safePhotoIndex] || listing.imageUrl;

  useEffect(() => {
    let active = true;
    fetchSellerProfile(listing.sellerId)
      .then((prof) => {
        if (active) setSellerProfile(prof);
      })
      .catch(() => {
        // Fallback to listing summary metadata
      });
    return () => {
      active = false;
    };
  }, [listing.sellerId]);

  useEffect(() => {
    const q = query(
      collection(db, 'reviews'),
      where('rating', '>=', 1)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs
          .map((d) => d.data() as Review)
          .filter((r) => r.listingId === listing.id)
          .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setReviews(items);
        if (currentUser) {
          const mine = items.find((r) => r.reviewerId === currentUser.uid);
          if (mine) {
            setRatingInput(mine.rating);
            setReviewComment(mine.comment);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'reviews');
      }
    );
    return () => unsub();
  }, [listing.id, currentUser]);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return null;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return sum / reviews.length;
  }, [reviews]);

  const handleToggleFavorite = async () => {
    if (!currentUser) {
      onRequireSignIn();
      return;
    }
    setTogglingFav(true);
    try {
      await toggleFavoriteListing(currentUser, listing, isFavorited);
    } finally {
      setTogglingFav(false);
    }
  };

  const handleMessageSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireSignIn();
      return;
    }
    setSending(true);
    setErrorMsg('');
    try {
      const convId = await startOrGetConversation(
        currentUser,
        currentProfile,
        listing,
        inquiryText.trim()
      );
      onOpenConversation(convId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to start conversation.');
    } finally {
      setSending(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireSignIn();
      return;
    }
    setSubmittingReview(true);
    setReviewNotice('');
    try {
      await submitReview(
        currentUser,
        currentProfile,
        listing,
        ratingInput,
        reviewComment
      );
      setReviewNotice('Review published.');
    } catch (err) {
      setReviewNotice(
        err instanceof Error ? err.message : 'Unable to submit review.'
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  const paymentMethods =
    listing.acceptedPaymentMethods && listing.acceptedPaymentMethods.length > 0
      ? listing.acceptedPaymentMethods
      : ['MTN MoMo', 'Cash on Meetup'];

  return (
    <div
      className="fixed inset-0 z-50 bg-[#14171A]/50 backdrop-blur-[2px] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="listing-modal-title"
    >
      <div className="bg-white border border-[#E4E0D8] rounded-xl max-w-4xl w-full overflow-hidden my-auto max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E0D8] shrink-0 gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#575B62]">
            <span className="font-semibold text-[#14171A]">
              {listing.brand || 'UCC Independent'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{listing.grouping || 'Campus Essentials'}</span>
            <span aria-hidden="true">·</span>
            <span>{listing.category}</span>
            <span aria-hidden="true">·</span>
            <span>{listing.conditionOrTurnaround}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={togglingFav}
              onClick={handleToggleFavorite}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                isFavorited
                  ? 'bg-[#9B2C2C]/8 border-[#9B2C2C]/30 text-[#9B2C2C]'
                  : 'bg-[#F8F7F4] border-[#E4E0D8] text-[#14171A] hover:border-[#0F4C81]'
              }`}
            >
              <Heart
                className={`w-3.5 h-3.5 ${isFavorited ? 'fill-[#9B2C2C]' : ''}`}
              />
              <span>{isFavorited ? 'Saved' : 'Save'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close listing details"
              className="p-2 text-[#575B62] hover:text-[#14171A] hover:bg-[#F3F1EC] rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 border-b border-[#E4E0D8]">
            <div className="lg:col-span-6 bg-[#F3F1EC] flex flex-col">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#EFECE6]">
                <ResilientImage
                  src={activeImageUrl}
                  alt={listing.title}
                  title={listing.title}
                  className="w-full h-full object-cover"
                />
                {galleryUrls.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActivePhotoIndex((prev) =>
                          prev === 0 ? galleryUrls.length - 1 : prev - 1
                        )
                      }
                      aria-label="Previous listing picture"
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white/90 hover:bg-white text-[#14171A] border border-[#E4E0D8] transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActivePhotoIndex((prev) => (prev + 1) % galleryUrls.length)
                      }
                      aria-label="Next listing picture"
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white/90 hover:bg-white text-[#14171A] border border-[#E4E0D8] transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-[#14171A]/75 text-white font-mono tabular-nums text-[11px]">
                      {safePhotoIndex + 1} / {galleryUrls.length}
                    </div>
                  </>
                )}
              </div>

              {galleryUrls.length > 1 && (
                <div className="px-4 py-3 bg-white/80 border-t border-[#E4E0D8] grid grid-cols-4 gap-2.5">
                  {galleryUrls.map((url, idx) => {
                    const isActive = idx === safePhotoIndex;
                    return (
                      <button
                        key={`${url.slice(0, 32)}-${idx}`}
                        type="button"
                        onClick={() => setActivePhotoIndex(idx)}
                        aria-label={`View picture ${idx + 1} of ${galleryUrls.length}`}
                        className={`aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                          isActive
                            ? 'border-[#0F4C81] opacity-100'
                            : 'border-[#E4E0D8] opacity-75 hover:opacity-100'
                        }`}
                      >
                        <ResilientImage
                          src={url}
                          alt={`${listing.title} photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="p-6 border-t border-[#E4E0D8] space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-[#575B62]">Listed by</p>
                    <p className="text-sm font-semibold text-[#14171A]">
                      {listing.sellerName} · {listing.sellerHall}
                    </p>
                  </div>
                  {sellerProfile?.verifiedCampus && (
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0F4C81]">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>
                        Verified{' '}
                        {sellerProfile.sellerTier
                          ? `${sellerProfile.sellerTier.charAt(0).toUpperCase()}${sellerProfile.sellerTier.slice(1)}`
                          : 'Seller'}
                      </span>
                    </div>
                  )}
                </div>
                {sellerProfile?.program && (
                  <p className="text-xs text-[#575B62]">{sellerProfile.program}</p>
                )}
                {sellerProfile?.bio && (
                  <p className="text-xs text-[#575B62] leading-relaxed">
                    {sellerProfile.bio}
                  </p>
                )}
              </div>
            </div>

            <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-[#575B62]">
                    {listing.type === 'service' ? 'Campus Service' : 'Campus Good'}
                  </span>
                  {averageRating !== null && (
                    <div className="inline-flex items-center gap-1 text-xs font-medium text-[#14171A]">
                      <Star className="w-3.5 h-3.5 fill-[#C88A1E] text-[#C88A1E]" />
                      <span className="font-mono tabular-nums">
                        {averageRating.toFixed(1)}
                      </span>
                      <span className="text-[#575B62] font-mono tabular-nums">
                        ({reviews.length})
                      </span>
                    </div>
                  )}
                </div>

                <h2
                  id="listing-modal-title"
                  className="font-display text-2xl font-bold text-[#14171A] leading-tight text-balance"
                >
                  {listing.title}
                </h2>

                <div className="flex items-baseline gap-2.5 pb-4 border-b border-[#E4E0D8]">
                  <span className="font-mono tabular-nums text-2xl font-semibold text-[#0F4C81]">
                    GH₵ {listing.priceGhs.toFixed(2)}
                  </span>
                  <span className="text-xs text-[#575B62]">{listing.priceUnit}</span>
                </div>

                <p className="text-sm text-[#14171A]/85 leading-relaxed">
                  {listing.description}
                </p>

                <div className="space-y-2 pt-2 text-xs text-[#575B62]">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#0F4C81] shrink-0" />
                    <span>
                      Campus Meetup:{' '}
                      <strong className="text-[#14171A]">{listing.meetupZone}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#0F4C81] shrink-0" />
                    <span>
                      Accepted Payment:{' '}
                      <strong className="text-[#14171A]">
                        {paymentMethods.join(' · ')}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {listing.status === 'sold' ? (
                <div className="pt-4 border-t border-[#E4E0D8] space-y-2">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#0F4C81]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Marked as Sold · Archived in Order History</span>
                  </div>
                  <p className="text-xs text-[#575B62]">
                    This listing is hidden from the Home marketplace feed because the sale has been completed.
                  </p>
                </div>
              ) : isOwner ? (
                <div className="pt-4 border-t border-[#E4E0D8] space-y-3">
                  <p className="text-xs text-[#575B62]">
                    You own this listing. Update details or mark it as sold to move it into your Order History.
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => onEditListing(listing)}
                      className="flex-1 py-2.5 px-4 text-sm font-medium text-[#14171A] bg-[#EFECE6] hover:bg-[#E4E0D8] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Edit Listing
                    </button>
                    {onMarkAsSold && (
                      <button
                        type="button"
                        onClick={() => onMarkAsSold(listing)}
                        className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <PackageCheck className="w-4 h-4" />
                        <span>Mark as Sold</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleMessageSeller}
                  className="pt-4 border-t border-[#E4E0D8] space-y-3"
                >
                  <label
                    htmlFor="quick-inquiry"
                    className="block text-xs font-medium text-[#14171A]"
                  >
                    Message {listing.sellerName.split(' ')[0]} directly
                  </label>
                  <textarea
                    id="quick-inquiry"
                    rows={3}
                    maxLength={1000}
                    value={inquiryText}
                    onChange={(e) => setInquiryText(e.target.value)}
                    placeholder="Ask about availability, sizing, payment method, or campus meetup time..."
                    className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#14171A] placeholder:text-[#575B62]/70 focus:outline-none focus:border-[#0F4C81]"
                  />
                  {errorMsg && <p className="text-xs text-[#9B2C2C]">{errorMsg}</p>}
                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <span>
                      {currentUser
                        ? sending
                          ? 'Opening Chat...'
                          : 'Send & Open Real-Time Chat'
                        : 'Sign in with Google to Message Seller'}
                    </span>
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Student Reviews & Ratings Section */}
          <div className="p-6 sm:p-8 bg-[#F8F7F4]/60 grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 space-y-4">
              <div>
                <h3 className="font-display text-lg font-bold text-[#14171A]">
                  Student Reviews &amp; Ratings
                </h3>
                <p className="text-xs text-[#575B62] mt-1">
                  {reviews.length === 0
                    ? 'No student reviews yet for this listing.'
                    : `${averageRating?.toFixed(1)} out of 5 across ${reviews.length} verified ${
                        reviews.length === 1 ? 'review' : 'reviews'
                      }.`}
                </p>
              </div>

              {!isOwner && (
                <form
                  onSubmit={handleReviewSubmit}
                  className="bg-white border border-[#E4E0D8] rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#14171A]">
                      Your Rating
                    </span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRatingInput(star)}
                          aria-label={`Rate ${star} out of 5 stars`}
                          className="p-1 cursor-pointer"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              star <= ratingInput
                                ? 'fill-[#C88A1E] text-[#C88A1E]'
                                : 'text-[#E4E0D8]'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    required
                    minLength={FIELD_LIMITS.REVIEW_MIN}
                    maxLength={FIELD_LIMITS.REVIEW_MAX}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder={
                      currentUser
                        ? 'Share feedback on item quality, service turnaround, or meetup punctuality...'
                        : 'Sign in with Google to leave a student review...'
                    }
                    className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3 py-2 text-xs text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
                  />

                  {reviewNotice && (
                    <p className="text-xs text-[#0F4C81] font-medium">
                      {reviewNotice}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="w-full py-2 px-3.5 text-xs font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                  >
                    {currentUser
                      ? submittingReview
                        ? 'Publishing...'
                        : 'Submit Review'
                      : 'Sign in to Review'}
                  </button>
                </form>
              )}
            </div>

            <div className="lg:col-span-7 space-y-3">
              {reviews.length === 0 ? (
                <div className="bg-white border border-[#E4E0D8] rounded-xl p-6 text-xs text-[#575B62]">
                  Be the first UCC student to rate this seller after your campus meetup.
                </div>
              ) : (
                reviews.map((rev) => (
                  <article
                    key={rev.id}
                    className="bg-white border border-[#E4E0D8] rounded-xl p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs">
                        <span className="font-semibold text-[#14171A]">
                          {rev.reviewerName}
                        </span>
                        <span className="text-[#575B62]"> · {rev.reviewerHall}</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono tabular-nums text-xs text-[#14171A]">
                        <Star className="w-3.5 h-3.5 fill-[#C88A1E] text-[#C88A1E]" />
                        <span>{rev.rating}.0</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#14171A]/90 leading-relaxed">
                      {rev.comment}
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
