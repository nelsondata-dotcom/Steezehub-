import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Heart,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
} from 'lucide-react';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { HERO_IMAGE_PATH } from './data/uccCatalog';
import {
  ensureUserProfile,
  fetchListingById,
  seedCuratedUccCatalog,
  toggleFavoriteListing,
} from './services/marketplaceService';
import {
  ADMIN_EMAIL,
  Conversation,
  FavoriteItem,
  LISTING_CATEGORIES,
  LISTING_GROUPINGS,
  Listing,
  ListingCategory,
  ListingGrouping,
  ListingType,
  PAYMENT_METHODS,
  Review,
  UCC_MEETUP_ZONES,
  UserPrivateInfo,
  UserPublicProfile,
} from './types';
import { ResilientImage } from './components/ResilientImage';
import { ListingModal } from './components/ListingModal';
import { PostListingModal } from './components/PostListingModal';
import { MessagesWorkspace } from './components/MessagesWorkspace';
import { MyShopView } from './components/MyShopView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { WishlistView } from './components/WishlistView';
import { AccountInfoView } from './components/AccountInfoView';
import { MarkAsSoldModal } from './components/MarkAsSoldModal';

type AppView = 'home' | 'wishlist' | 'messages' | 'shop' | 'account' | 'admin';
type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'top_rated';

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<UserPublicProfile | null>(null);
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo | null>(null);
  const [authError, setAuthError] = useState('');

  const [listings, setListings] = useState<Listing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [togglingFavId, setTogglingFavId] = useState<string | null>(null);
  const [myConversations, setMyConversations] = useState<Conversation[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ListingType>('all');
  const [groupingFilter, setGroupingFilter] = useState<'all' | ListingGrouping>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ListingCategory>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [meetupFilter, setMeetupFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [markingSoldListing, setMarkingSoldListing] = useState<Listing | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [initialReferralCode, setInitialReferralCode] = useState('');

  const autoSeededRef = useRef(false);
  const catalogSectionRef = useRef<HTMLElement>(null);

  const isAdmin =
    Boolean(currentUser?.emailVerified) && currentUser?.email === ADMIN_EMAIL;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref');
    if (refParam) {
      setInitialReferralCode(refParam.trim().toUpperCase());
    }
  }, []);

  const refreshProfile = useCallback(async (user: User) => {
    const result = await ensureUserProfile(user);
    setCurrentProfile(result.publicProfile);
    setPrivateInfo(result.privateInfo);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthReady(true);
      if (user) {
        try {
          await refreshProfile(user);
        } catch (err) {
          console.error('Failed to ensure profile:', err);
        }
      } else {
        setCurrentProfile(null);
        setPrivateInfo(null);
        setFavorites([]);
        setMyConversations([]);
      }
    });
    return () => unsub();
  }, [refreshProfile]);

  useEffect(() => {
    setLoadingListings(true);
    const q = query(collection(db, 'listings'), where('status', '==', 'active'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs
          .map((d) => d.data() as Listing)
          .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setListings(items);
        setLoadingListings(false);

        const needsCuratedSync =
          items.length === 0 ||
          items.some(
            (it) =>
              it.id.startsWith('ucc_seed_') &&
              (!it.grouping || !it.brand || !it.acceptedPaymentMethods)
          );

        if (
          needsCuratedSync &&
          !autoSeededRef.current &&
          auth.currentUser &&
          auth.currentUser.email === ADMIN_EMAIL &&
          auth.currentUser.emailVerified
        ) {
          autoSeededRef.current = true;
          seedCuratedUccCatalog().catch((err) => {
            console.error('Auto-seed error:', err);
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'listings');
      }
    );
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    const q = query(collection(db, 'reviews'), where('rating', '>=', 1));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAllReviews(snap.docs.map((d) => d.data() as Review));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'reviews');
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !currentUser) {
      setFavorites([]);
      return;
    }

    const favPath = `users/${currentUser.uid}/favorites`;
    const favQuery = query(
      collection(db, 'users', currentUser.uid, 'favorites'),
      where('userId', '==', currentUser.uid)
    );
    const unsub = onSnapshot(
      favQuery,
      (snap) => {
        const items = snap.docs
          .map((d) => d.data() as FavoriteItem)
          .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setFavorites(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, favPath);
      }
    );

    return () => unsub();
  }, [authReady, currentUser]);

  useEffect(() => {
    if (!authReady || !currentUser) {
      setMyConversations([]);
      return;
    }
    const adminUser =
      currentUser.email === ADMIN_EMAIL && currentUser.emailVerified;
    const convRef = collection(db, 'conversations');
    const q = adminUser
      ? convRef
      : query(convRef, where('participantIds', 'array-contains', currentUser.uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setMyConversations(snap.docs.map((d) => d.data() as Conversation));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'conversations');
      }
    );
    return () => unsub();
  }, [authReady, currentUser]);

  const handleSignIn = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google sign-in failed.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setView('home');
  };

  const handleOpenPostModal = () => {
    if (!currentUser) {
      handleSignIn();
      return;
    }
    setEditingListing(null);
    setShowPostModal(true);
  };

  const handleNavHome = () => {
    setView('home');
  };

  const handleInspectListingById = async (listingId: string) => {
    const activeMatch = listings.find((l) => l.id === listingId);
    if (activeMatch) {
      setSelectedListing(activeMatch);
      return;
    }
    const fetched = await fetchListingById(listingId);
    if (fetched) {
      setSelectedListing(fetched);
    }
  };

  const favoriteIds = useMemo(
    () => new Set(favorites.map((fav) => fav.listingId)),
    [favorites]
  );

  const handleToggleCardFavorite = async (item: Listing) => {
    if (!currentUser) {
      handleSignIn();
      return;
    }
    setTogglingFavId(item.id);
    try {
      await toggleFavoriteListing(currentUser, item, favoriteIds.has(item.id));
    } finally {
      setTogglingFavId(null);
    }
  };

  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    listings.forEach((item) => {
      if (item.brand) brands.add(item.brand);
    });
    return Array.from(brands).sort((a, b) => a.localeCompare(b));
  }, [listings]);

  const ratingsByListing = useMemo(() => {
    const map: Record<string, { avg: number; count: number }> = {};
    const totals: Record<string, { sum: number; count: number }> = {};
    for (const r of allReviews) {
      if (!totals[r.listingId]) {
        totals[r.listingId] = { sum: 0, count: 0 };
      }
      totals[r.listingId].sum += r.rating;
      totals[r.listingId].count += 1;
    }
    for (const [listingId, val] of Object.entries(totals)) {
      map[listingId] = {
        avg: val.sum / val.count,
        count: val.count,
      };
    }
    return map;
  }, [allReviews]);

  const filteredListings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const list = listings.filter((item) => {
      if (item.status !== 'active') return false;
      const itemGrouping = item.grouping || 'Campus Essentials';
      const itemBrand = item.brand || 'UCC Independent';
      const itemPayments = item.acceptedPaymentMethods || ['MTN MoMo', 'Cash on Meetup'];

      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (groupingFilter !== 'all' && itemGrouping !== groupingFilter) return false;
      if (brandFilter !== 'all' && itemBrand !== brandFilter) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (meetupFilter !== 'all' && item.meetupZone !== meetupFilter) return false;
      if (paymentFilter !== 'all' && !itemPayments.includes(paymentFilter)) return false;

      if (term) {
        const hay = `${item.title} ${item.description} ${itemBrand} ${itemGrouping} ${item.sellerName} ${item.sellerHall} ${item.category} ${item.meetupZone}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });

    if (sortBy === 'price_asc') {
      return [...list].sort((a, b) => a.priceGhs - b.priceGhs);
    }
    if (sortBy === 'price_desc') {
      return [...list].sort((a, b) => b.priceGhs - a.priceGhs);
    }
    if (sortBy === 'top_rated') {
      return [...list].sort(
        (a, b) =>
          (ratingsByListing[b.id]?.avg || 0) - (ratingsByListing[a.id]?.avg || 0)
      );
    }
    return list;
  }, [
    listings,
    typeFilter,
    groupingFilter,
    brandFilter,
    categoryFilter,
    meetupFilter,
    paymentFilter,
    searchTerm,
    sortBy,
    ratingsByListing,
  ]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    typeFilter !== 'all' ||
    groupingFilter !== 'all' ||
    brandFilter !== 'all' ||
    categoryFilter !== 'all' ||
    paymentFilter !== 'all' ||
    meetupFilter !== 'all';

  const resetAllFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setGroupingFilter('all');
    setBrandFilter('all');
    setCategoryFilter('all');
    setPaymentFilter('all');
    setMeetupFilter('all');
    setSortBy('newest');
  };

  const handleHeroSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F7F4] text-[#14171A]">
      {/* Strict 3-Zone Single-Row Top Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E4E0D8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={handleNavHome}
            className="font-display text-xl font-bold tracking-tight text-[#14171A] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Steezehub
          </button>

          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-5 sm:gap-6 text-sm font-medium text-[#575B62] overflow-x-auto"
          >
            <button
              type="button"
              onClick={handleNavHome}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                view === 'home'
                  ? 'text-[#14171A] border-[#0F4C81]'
                  : 'border-transparent hover:text-[#14171A] hover:border-[#E4E0D8]'
              }`}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => setView('wishlist')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                view === 'wishlist'
                  ? 'text-[#14171A] border-[#0F4C81]'
                  : 'border-transparent hover:text-[#14171A] hover:border-[#E4E0D8]'
              }`}
            >
              {favorites.length > 0 ? `Wishlist (${favorites.length})` : 'Wishlist'}
            </button>
            <button
              type="button"
              onClick={() => setView('messages')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                view === 'messages'
                  ? 'text-[#14171A] border-[#0F4C81]'
                  : 'border-transparent hover:text-[#14171A] hover:border-[#E4E0D8]'
              }`}
            >
              {myConversations.length > 0
                ? `Messages (${myConversations.length})`
                : 'Messages'}
            </button>
            <button
              type="button"
              onClick={() => setView('shop')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                view === 'shop'
                  ? 'text-[#14171A] border-[#0F4C81]'
                  : 'border-transparent hover:text-[#14171A] hover:border-[#E4E0D8]'
              }`}
            >
              My Shop
            </button>
            <button
              type="button"
              onClick={() => setView('account')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                view === 'account'
                  ? 'text-[#14171A] border-[#0F4C81]'
                  : 'border-transparent hover:text-[#14171A] hover:border-[#E4E0D8]'
              }`}
            >
              Account
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setView('admin')}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                  view === 'admin'
                    ? 'text-[#14171A] border-[#0F4C81]'
                    : 'border-transparent hover:text-[#14171A] hover:border-[#E4E0D8]'
                }`}
              >
                Admin
              </button>
            )}
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={currentUser ? handleOpenPostModal : handleSignIn}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {currentUser ? 'Post Listing' : 'Sign in'}
            </button>
          </div>
        </div>
      </header>

      {authError && (
        <div className="bg-[#9B2C2C]/10 border-b border-[#9B2C2C]/20 px-6 py-2.5 text-center text-xs text-[#9B2C2C]">
          {authError}
        </div>
      )}

      <main className="flex-1">
        {view === 'home' && (
          <>
            {/* Editorial Flagship Retail Hero */}
            <section className="bg-white border-b border-[#E4E0D8]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
                <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch gap-8 lg:gap-12">
                  <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
                    <div className="space-y-3">
                      <p className="text-xs font-medium tracking-wide uppercase text-[#0F4C81]">
                        University of Cape Coast · Campus Marketplace
                      </p>
                      <h1 className="font-display text-[clamp(2.25rem,4vw,3.5rem)] font-bold tracking-tight leading-[1.06] text-[#14171A] text-balance">
                        Shop trusted UCC student brands, delivered to your hall.
                      </h1>
                      <p className="text-base text-[#575B62] leading-relaxed max-w-xl">
                        Discover verified campus goods, tech kits, snacks, and student services across Valco, Casford, Oguaa, Adehye, and Science Market with instant buyer–seller chat.
                      </p>
                    </div>

                    {/* Integrated Shopping Search Bar */}
                    <form
                      onSubmit={handleHeroSearchSubmit}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 max-w-xl"
                    >
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-[#575B62] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="search"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Search hoodies, tech, braiding, halls, or brands..."
                          aria-label="Search UCC campus store"
                          className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] pl-10 pr-4 py-3 text-sm text-[#14171A] placeholder:text-[#575B62] focus:outline-none focus:border-[#0F4C81]"
                        />
                      </div>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <span>Shop Now</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>

                    {/* Clean Inline Storefront Metrics */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs text-[#575B62]">
                      <span>
                        <strong className="font-mono tabular-nums text-[#14171A]">
                          {listings.length}
                        </strong>{' '}
                        active listings
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        <strong className="font-mono tabular-nums text-[#14171A]">
                          {availableBrands.length || 6}
                        </strong>{' '}
                        student brands
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>MTN MoMo, Telecel Cash &amp; Meetup Pay</span>
                    </div>
                  </div>

                  <div className="lg:col-span-6">
                    <div className="relative h-full min-h-[280px] sm:min-h-[340px] lg:min-h-[400px] rounded-xl overflow-hidden border border-[#E4E0D8] bg-[#EFECE6]">
                      <ResilientImage
                        src={HERO_IMAGE_PATH}
                        alt="University of Cape Coast students exchanging marketplace orders on campus"
                        title="Steezehub UCC Campus Exchange"
                        className="w-full h-full lg:h-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-wrap items-end justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-white/80">
                            Featured UCC Pickup Zones
                          </p>
                          <p className="text-sm font-semibold text-white">
                            Science Market · Old Site Quad · Valco Gate · Sam Jonah Library
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setView('wishlist')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#14171A] bg-white hover:bg-[#F8F7F4] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Heart className="w-3.5 h-3.5 text-[#0F4C81]" />
                          <span>
                            {favorites.length > 0
                              ? `Wishlist (${favorites.length})`
                              : 'Saved Wishlist'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Department Navigation + Catalog Section */}
            <section
              ref={catalogSectionRef}
              className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-8"
            >
              {/* Department Category Bar */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-[#575B62]">
                      Browse by Department
                    </p>
                    <h2 className="font-display text-2xl font-bold text-[#14171A] mt-0.5">
                      Featured Campus Marketplace
                    </h2>
                  </div>

                  <div className="flex items-center gap-3">
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="text-xs font-medium text-[#0F4C81] hover:underline cursor-pointer whitespace-nowrap"
                      >
                        Reset all filters
                      </button>
                    )}
                    <div className="inline-flex items-center gap-2 text-xs text-[#575B62]">
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span className="font-mono tabular-nums font-medium text-[#14171A]">
                        {filteredListings.length}
                      </span>
                      <span>items</span>
                    </div>
                  </div>
                </div>

                {/* Horizontal Category Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('all')}
                    className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      categoryFilter === 'all'
                        ? 'bg-[#14171A] text-white border-[#14171A]'
                        : 'bg-white text-[#575B62] border-[#E4E0D8] hover:text-[#14171A]'
                    }`}
                  >
                    All Departments
                  </button>
                  {LISTING_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        categoryFilter === cat
                          ? 'bg-[#14171A] text-white border-[#14171A]'
                          : 'bg-white text-[#575B62] border-[#E4E0D8] hover:text-[#14171A]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Campus Grouping Underline Rail */}
                <div className="flex items-center gap-5 border-b border-[#E4E0D8] pb-2.5 overflow-x-auto text-xs sm:text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => setGroupingFilter('all')}
                    className={`whitespace-nowrap pb-1 border-b-2 transition-colors cursor-pointer ${
                      groupingFilter === 'all'
                        ? 'text-[#14171A] border-[#0F4C81]'
                        : 'text-[#575B62] border-transparent hover:text-[#14171A]'
                    }`}
                  >
                    All Groupings
                  </button>
                  {LISTING_GROUPINGS.map((grp) => (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => setGroupingFilter(grp)}
                      className={`whitespace-nowrap pb-1 border-b-2 transition-colors cursor-pointer ${
                        groupingFilter === grp
                          ? 'text-[#14171A] border-[#0F4C81]'
                          : 'text-[#575B62] border-transparent hover:text-[#14171A]'
                      }`}
                    >
                      {grp}
                    </button>
                  ))}
                </div>

                {/* Precision Filter & Sort Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="inline-flex items-center gap-1 p-1 bg-[#EFECE6] rounded-lg">
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'good', label: 'Goods' },
                        { id: 'service', label: 'Services' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setTypeFilter(tab.id)}
                        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                          typeFilter === tab.id
                            ? 'bg-white text-[#14171A] shadow-xs'
                            : 'text-[#575B62] hover:text-[#14171A]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <select
                    aria-label="Filter by brand"
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                    className="rounded-lg border border-[#E4E0D8] bg-white px-3 py-2 text-xs font-medium text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
                  >
                    <option value="all">All Brands</option>
                    {availableBrands.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter by payment method"
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="rounded-lg border border-[#E4E0D8] bg-white px-3 py-2 text-xs font-medium text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
                  >
                    <option value="all">All Payment Methods</option>
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter by meetup zone"
                    value={meetupFilter}
                    onChange={(e) => setMeetupFilter(e.target.value)}
                    className="rounded-lg border border-[#E4E0D8] bg-white px-3 py-2 text-xs font-medium text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
                  >
                    <option value="all">All Meetup Zones</option>
                    {UCC_MEETUP_ZONES.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Sort marketplace listings"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="rounded-lg border border-[#E4E0D8] bg-white px-3 py-2 text-xs font-medium text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
                  >
                    <option value="newest">Sort: Newest Arrivals</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="top_rated">Sort: Highest Rated</option>
                  </select>
                </div>
              </div>

              {loadingListings ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((slot) => (
                    <div
                      key={slot}
                      className="bg-white border border-[#E4E0D8] rounded-xl overflow-hidden animate-pulse"
                    >
                      <div className="aspect-[4/3] bg-[#EFECE6]" />
                      <div className="p-5 space-y-3">
                        <div className="h-3 w-28 bg-[#EFECE6] rounded" />
                        <div className="h-5 w-3/4 bg-[#EFECE6] rounded" />
                        <div className="h-4 w-1/3 bg-[#EFECE6] rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredListings.length === 0 ? (
                <div className="bg-white border border-[#E4E0D8] rounded-xl p-12 text-center space-y-4">
                  <h3 className="font-display text-xl font-bold text-[#14171A]">
                    {listings.length === 0
                      ? 'Campus catalog is ready for its first listings'
                      : 'No listings match those filters'}
                  </h3>
                  <p className="text-sm text-[#575B62] max-w-md mx-auto">
                    {listings.length === 0
                      ? 'Sign in with Google to publish the first UCC good or service, or load curated campus listings if you are the marketplace curator.'
                      : 'Try clearing your search term or resetting filters to see every active item on UCC campus.'}
                  </p>
                  {listings.length === 0 ? (
                    <button
                      type="button"
                      onClick={currentUser ? handleOpenPostModal : handleSignIn}
                      className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] rounded-lg transition-colors cursor-pointer"
                    >
                      {currentUser ? 'Post First Listing' : 'Sign in with Google'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-[#14171A] bg-[#EFECE6] hover:bg-[#E4E0D8] rounded-lg transition-colors cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredListings.map((item) => {
                    const isMine = currentUser?.uid === item.sellerId;
                    const isFav = favoriteIds.has(item.id);
                    const ratingStats = ratingsByListing[item.id];
                    const itemPayments =
                      item.acceptedPaymentMethods && item.acceptedPaymentMethods.length > 0
                        ? item.acceptedPaymentMethods
                        : ['MTN MoMo', 'Cash on Meetup'];

                    return (
                      <article
                        key={item.id}
                        className="group bg-white border border-[#E4E0D8] rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-14px_rgba(17,19,21,0.16)]"
                      >
                        <div className="relative aspect-[4/3] w-full bg-[#EFECE6] overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setSelectedListing(item)}
                            className="w-full h-full block text-left cursor-pointer"
                          >
                            <ResilientImage
                              src={item.imageUrl}
                              alt={item.title}
                              title={item.title}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            />
                          </button>

                          <button
                            type="button"
                            disabled={togglingFavId === item.id}
                            onClick={() => handleToggleCardFavorite(item)}
                            aria-label={
                              isFav
                                ? `Remove ${item.title} from wishlist`
                                : `Save ${item.title} to wishlist`
                            }
                            aria-pressed={isFav}
                            className={`absolute top-3 right-3 p-2 rounded-lg border transition-colors cursor-pointer ${
                              isFav
                                ? 'bg-white border-[#9B2C2C]/30 text-[#9B2C2C]'
                                : 'bg-white/95 border-[#E4E0D8] text-[#575B62] hover:text-[#14171A]'
                            }`}
                          >
                            <Heart
                              className={`w-4 h-4 ${isFav ? 'fill-[#9B2C2C]' : ''}`}
                            />
                          </button>

                          <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 py-2.5 bg-gradient-to-t from-black/65 via-black/20 to-transparent flex items-center justify-between text-[11px] font-medium text-white">
                            <span>{item.conditionOrTurnaround}</span>
                            <span>{item.type === 'service' ? 'Service' : 'Good'}</span>
                          </div>
                        </div>

                        <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                          <div className="space-y-2">
                            <p className="text-[12px] font-medium uppercase tracking-wide text-[#575B62] truncate">
                              {item.brand || 'UCC Independent'} · {item.grouping || item.category}
                            </p>
                            <button
                              type="button"
                              onClick={() => setSelectedListing(item)}
                              className="block text-left cursor-pointer"
                            >
                              <h3 className="text-base font-semibold text-[#14171A] leading-snug line-clamp-2 group-hover:text-[#0F4C81] transition-colors">
                                {item.title}
                              </h3>
                            </button>
                            <div className="flex items-center justify-between gap-2 pt-0.5">
                              <div className="flex items-baseline gap-2">
                                <span className="font-mono tabular-nums text-[16px] font-bold text-[#0F4C81]">
                                  GH₵ {item.priceGhs.toFixed(2)}
                                </span>
                                <span className="text-xs text-[#575B62]">
                                  {item.priceUnit}
                                </span>
                              </div>
                              {ratingStats && (
                                <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums text-[#14171A]">
                                  <Star className="w-3.5 h-3.5 fill-[#C88A1E] text-[#C88A1E]" />
                                  <span>{ratingStats.avg.toFixed(1)}</span>
                                  <span className="text-[#575B62]">({ratingStats.count})</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#575B62] truncate">
                              Accepts {itemPayments.slice(0, 3).join(' · ')}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-[#E4E0D8] flex items-center justify-between gap-3">
                            <div className="min-w-0 text-xs text-[#575B62]">
                              <p className="font-medium text-[#14171A] truncate">
                                {item.sellerName} · {item.sellerHall}
                              </p>
                              <p className="inline-flex items-center gap-1 truncate mt-0.5">
                                <MapPin className="w-3 h-3 text-[#0F4C81] shrink-0" />
                                <span className="truncate">{item.meetupZone}</span>
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedListing(item)}
                              className="px-3.5 py-2 text-xs font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              {isMine ? 'Manage' : 'Buy / Chat'}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Campus Commerce Guarantee Band */}
            <section className="bg-white border-t border-[#E4E0D8]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <MapPin className="w-5 h-5 text-[#0F4C81]" />
                  <h3 className="font-display text-base font-bold text-[#14171A]">
                    Public UCC Hall Meetups
                  </h3>
                  <p className="text-xs text-[#575B62] leading-relaxed">
                    Inspect goods in daylight at Science Market Forecourt, Sam Jonah Library Steps, Old Site Quad, or Hall Porter Lodges before settling payment.
                  </p>
                </div>

                <div className="space-y-2">
                  <CreditCard className="w-5 h-5 text-[#0F4C81]" />
                  <h3 className="font-display text-base font-bold text-[#14171A]">
                    Ghana Mobile Money &amp; Cash
                  </h3>
                  <p className="text-xs text-[#575B62] leading-relaxed">
                    Every seller specifies accepted options upfront across MTN MoMo, Telecel Cash, AT Money, Bank / Hubtel Transfer, or Cash on Meetup.
                  </p>
                </div>

                <div className="space-y-2">
                  <ShieldCheck className="w-5 h-5 text-[#0F4C81]" />
                  <h3 className="font-display text-base font-bold text-[#14171A]">
                    Approved Seller Tiers &amp; Order Receipts
                  </h3>
                  <p className="text-xs text-[#575B62] leading-relaxed">
                    Campus sellers operate under admin-approved Micro, Standard, and Premium fee plans with permanent Order History records once items sell.
                  </p>
                </div>
              </div>
            </section>
          </>
        )}

        {view === 'wishlist' && (
          <WishlistView
            currentUser={currentUser}
            favorites={favorites}
            listings={listings}
            onInspectListing={handleInspectListingById}
            onRequireSignIn={handleSignIn}
            onBrowseHome={handleNavHome}
          />
        )}

        {view === 'messages' && (
          <MessagesWorkspace
            currentUser={currentUser}
            currentProfile={currentProfile}
            activeConversationId={activeConversationId}
            onSelectConversation={setActiveConversationId}
            onRequireSignIn={handleSignIn}
            onBrowseMarket={handleNavHome}
          />
        )}

        {view === 'shop' && (
          <MyShopView
            currentUser={currentUser}
            currentProfile={currentProfile}
            favorites={favorites}
            onProfileUpdated={() => {
              if (currentUser) refreshProfile(currentUser);
            }}
            onPostNew={handleOpenPostModal}
            onEditListing={(item) => {
              setEditingListing(item);
              setShowPostModal(true);
            }}
            onInspectListing={handleInspectListingById}
            onOpenConversation={(convId) => {
              setActiveConversationId(convId);
              setView('messages');
            }}
            onOpenAccountInfo={() => setView('account')}
            onSignIn={handleSignIn}
          />
        )}

        {view === 'account' && (
          <AccountInfoView
            currentUser={currentUser}
            currentProfile={currentProfile}
            privateInfo={privateInfo}
            initialReferralCode={initialReferralCode}
            onProfileUpdated={() => {
              if (currentUser) refreshProfile(currentUser);
            }}
            onOpenShopOrders={() => setView('shop')}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
          />
        )}

        {view === 'admin' && (
          <AdminDashboardView
            currentUser={currentUser}
            onOpenConversation={(convId) => {
              setActiveConversationId(convId);
              setView('messages');
            }}
          />
        )}
      </main>

      <footer className="border-t border-[#E4E0D8] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#575B62]">
          <p className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#0F4C81] shrink-0" />
            <span>
              Steezehub · University of Cape Coast Student Marketplace · Meet in public campus zones before payment.
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={handleNavHome}
              className="hover:text-[#14171A] cursor-pointer"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => setView('wishlist')}
              className="hover:text-[#14171A] cursor-pointer"
            >
              Wishlist
            </button>
            <button
              type="button"
              onClick={() => setView('messages')}
              className="hover:text-[#14171A] cursor-pointer"
            >
              Messages
            </button>
            <button
              type="button"
              onClick={() => setView('shop')}
              className="hover:text-[#14171A] cursor-pointer"
            >
              My Shop
            </button>
            <button
              type="button"
              onClick={() => setView('account')}
              className="hover:text-[#14171A] cursor-pointer"
            >
              Account
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setView('admin')}
                className="hover:text-[#14171A] cursor-pointer"
              >
                Admin
              </button>
            )}
          </div>
        </div>
      </footer>

      {selectedListing && (
        <ListingModal
          listing={selectedListing}
          currentUser={currentUser}
          currentProfile={currentProfile}
          isFavorited={favoriteIds.has(selectedListing.id)}
          onClose={() => setSelectedListing(null)}
          onRequireSignIn={handleSignIn}
          onOpenConversation={(convId) => {
            setSelectedListing(null);
            setActiveConversationId(convId);
            setView('messages');
          }}
          onEditListing={(item) => {
            setSelectedListing(null);
            setEditingListing(item);
            setShowPostModal(true);
          }}
          onMarkAsSold={(item) => {
            setSelectedListing(null);
            setMarkingSoldListing(item);
          }}
        />
      )}

      {markingSoldListing && (
        <MarkAsSoldModal
          listing={markingSoldListing}
          conversationsForListing={myConversations.filter(
            (c) =>
              c.listingId === markingSoldListing.id &&
              c.sellerId === currentUser?.uid
          )}
          onClose={() => setMarkingSoldListing(null)}
          onCompleted={() => {
            setMarkingSoldListing(null);
            setView('shop');
          }}
        />
      )}

      {showPostModal && currentUser && currentProfile && (
        <PostListingModal
          currentUser={currentUser}
          currentProfile={currentProfile}
          editingListing={editingListing}
          onClose={() => {
            setShowPostModal(false);
            setEditingListing(null);
          }}
          onSaved={() => {
            setShowPostModal(false);
            setEditingListing(null);
          }}
        />
      )}
    </div>
  );
}
