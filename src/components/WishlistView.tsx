import React, { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { Bookmark, Heart, MapPin, Search, Trash2 } from 'lucide-react';
import { FavoriteItem, Listing } from '../types';
import { removeFavoriteListing } from '../services/marketplaceService';
import { ResilientImage } from './ResilientImage';

interface WishlistViewProps {
  currentUser: User | null;
  favorites: FavoriteItem[];
  listings: Listing[];
  onInspectListing: (listingId: string) => void;
  onRequireSignIn: () => void;
  onBrowseHome: () => void;
}

export const WishlistView: React.FC<WishlistViewProps> = ({
  currentUser,
  favorites,
  listings,
  onInspectListing,
  onRequireSignIn,
  onBrowseHome,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const filteredFavorites = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return favorites;
    return favorites.filter((fav) => {
      const hay = `${fav.listingTitle} ${fav.sellerName} ${fav.sellerHall} ${fav.meetupZone} ${fav.brand || ''} ${fav.grouping || ''}`.toLowerCase();
      return hay.includes(term);
    });
  }, [favorites, searchQuery]);

  const listingStatusMap = useMemo(() => {
    const map: Record<string, Listing> = {};
    for (const item of listings) {
      map[item.id] = item;
    }
    return map;
  }, [listings]);

  if (!currentUser) {
    return (
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="bg-white border border-[#E4E0D8] rounded-xl p-10 space-y-5">
          <div className="w-11 h-11 rounded-lg bg-[#EFECE6] text-[#0F4C81] flex items-center justify-center mx-auto">
            <Bookmark className="w-5 h-5" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[#14171A] text-balance">
            Save campus finds to your Steezehub Wishlist
          </h1>
          <p className="text-sm text-[#575B62] max-w-md mx-auto leading-relaxed">
            Sign in with Google to bookmark goods and services across UCC halls and sync them between your Wishlist page and My Shop.
          </p>
          <button
            type="button"
            onClick={onRequireSignIn}
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] rounded-lg transition-colors cursor-pointer"
          >
            Sign in with Google
          </button>
        </div>
      </section>
    );
  }

  const handleRemove = async (listingId: string) => {
    setRemovingId(listingId);
    try {
      await removeFavoriteListing(currentUser.uid, listingId);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E4E0D8] pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#575B62]">
            Saved Items &amp; Services
          </p>
          <h1 className="font-display text-3xl font-bold text-[#14171A] mt-1">
            Campus Wishlist
          </h1>
          <p className="text-sm text-[#575B62] mt-1">
            <span className="font-mono tabular-nums font-medium text-[#14171A]">
              {favorites.length}
            </span>{' '}
            {favorites.length === 1 ? 'listing saved' : 'listings saved'} for quick meetup messaging.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#575B62] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter saved items..."
            aria-label="Filter wishlist items"
            className="w-full rounded-lg border border-[#E4E0D8] bg-white pl-9 pr-3.5 py-2 text-sm text-[#14171A] placeholder:text-[#575B62] focus:outline-none focus:border-[#0F4C81]"
          />
        </div>
      </div>

      {filteredFavorites.length === 0 ? (
        <div className="bg-white border border-[#E4E0D8] rounded-xl p-12 text-center space-y-4">
          <Heart className="w-8 h-8 text-[#575B62]/60 mx-auto" strokeWidth={1.5} />
          <h2 className="font-display text-xl font-bold text-[#14171A]">
            {favorites.length === 0
              ? 'Your wishlist is empty'
              : 'No saved items match your search'}
          </h2>
          <p className="text-sm text-[#575B62] max-w-md mx-auto">
            {favorites.length === 0
              ? 'Tap the heart icon on any listing across the Home marketplace to keep track of items you want to compare or buy.'
              : 'Clear your search filter to view all your saved campus listings.'}
          </p>
          <button
            type="button"
            onClick={favorites.length === 0 ? onBrowseHome : () => setSearchQuery('')}
            className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] rounded-lg transition-colors cursor-pointer"
          >
            {favorites.length === 0 ? 'Explore Home Marketplace' : 'Clear Filter'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFavorites.map((fav) => {
            const liveListing = listingStatusMap[fav.listingId];
            const displayPrice = liveListing ? liveListing.priceGhs : fav.listingPriceGhs;
            const displayTitle = liveListing ? liveListing.title : fav.listingTitle;
            const displayImage = liveListing ? liveListing.imageUrl : fav.listingImageUrl;

            return (
              <article
                key={fav.listingId}
                className="bg-white border border-[#E4E0D8] rounded-xl overflow-hidden flex flex-col"
              >
                <div className="relative aspect-[4/3] bg-[#EFECE6] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => onInspectListing(fav.listingId)}
                    className="w-full h-full block cursor-pointer"
                  >
                    <ResilientImage
                      src={displayImage}
                      alt={displayTitle}
                      title={displayTitle}
                    />
                  </button>
                  <button
                    type="button"
                    disabled={removingId === fav.listingId}
                    onClick={() => handleRemove(fav.listingId)}
                    aria-label={`Remove ${displayTitle} from wishlist`}
                    className="absolute top-3 right-3 p-2 rounded-lg bg-white/95 border border-[#E4E0D8] text-[#9B2C2C] hover:bg-white transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <p className="text-[12px] font-medium uppercase tracking-wide text-[#575B62] truncate">
                      {fav.brand || 'UCC Independent'} · {fav.grouping || 'Campus Essentials'}
                    </p>
                    <button
                      type="button"
                      onClick={() => onInspectListing(fav.listingId)}
                      className="block text-left cursor-pointer"
                    >
                      <h2 className="text-base font-semibold text-[#14171A] line-clamp-2 hover:text-[#0F4C81] transition-colors">
                        {displayTitle}
                      </h2>
                    </button>
                    <p className="font-mono tabular-nums text-[15px] font-semibold text-[#0F4C81]">
                      GH₵ {displayPrice.toFixed(2)}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#E4E0D8] flex items-center justify-between gap-3">
                    <div className="min-w-0 text-xs text-[#575B62]">
                      <p className="font-medium text-[#14171A] truncate">
                        {fav.sellerName} · {fav.sellerHall}
                      </p>
                      <p className="inline-flex items-center gap-1 truncate mt-0.5">
                        <MapPin className="w-3 h-3 text-[#0F4C81] shrink-0" />
                        <span className="truncate">{fav.meetupZone}</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onInspectListing(fav.listingId)}
                      className="px-3.5 py-2 text-xs font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Inspect &amp; Chat
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
