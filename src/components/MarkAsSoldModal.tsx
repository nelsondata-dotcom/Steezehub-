import React, { useMemo, useState } from 'react';
import { CheckCircle2, MapPin, ShieldCheck, X } from 'lucide-react';
import { markListingAsSold } from '../services/marketplaceService';
import {
  Conversation,
  FIELD_LIMITS,
  Listing,
  PAYMENT_METHODS,
  UCC_MEETUP_ZONES,
} from '../types';
import { ResilientImage } from './ResilientImage';

interface MarkAsSoldModalProps {
  listing: Listing;
  conversationsForListing: Conversation[];
  onClose: () => void;
  onCompleted: (orderId: string) => void;
}

export const MarkAsSoldModal: React.FC<MarkAsSoldModalProps> = ({
  listing,
  conversationsForListing,
  onClose,
  onCompleted,
}) => {
  const defaultConv = useMemo(() => {
    return (
      conversationsForListing.find((c) => c.status === 'reserved') ||
      conversationsForListing[0] ||
      null
    );
  }, [conversationsForListing]);

  const [selectedConvId, setSelectedConvId] = useState<string>(
    defaultConv ? defaultConv.id : 'walkup'
  );
  const [walkupBuyerName, setWalkupBuyerName] = useState('Walk-up UCC Student');
  const [finalPriceGhs, setFinalPriceGhs] = useState(String(listing.priceGhs));
  const [paymentMethod, setPaymentMethod] = useState(
    defaultConv?.paymentMethod ||
      listing.acceptedPaymentMethods?.[0] ||
      PAYMENT_METHODS[0]
  );
  const [meetupZone, setMeetupZone] = useState(
    defaultConv?.meetupZone || listing.meetupZone || UCC_MEETUP_ZONES[0]
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const selectedConversation = useMemo(
    () => conversationsForListing.find((c) => c.id === selectedConvId) || null,
    [conversationsForListing, selectedConvId]
  );

  const handleSelectBuyer = (id: string) => {
    setSelectedConvId(id);
    const matched = conversationsForListing.find((c) => c.id === id);
    if (matched) {
      if (matched.paymentMethod) setPaymentMethod(matched.paymentMethod);
      if (matched.meetupZone) setMeetupZone(matched.meetupZone);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const parsedPrice = Number(finalPriceGhs);
    if (
      Number.isNaN(parsedPrice) ||
      parsedPrice < 0 ||
      parsedPrice > FIELD_LIMITS.PRICE_MAX
    ) {
      setErrorMsg('Enter a valid final sale price in GH₵.');
      return;
    }

    setSubmitting(true);
    try {
      const orderId = await markListingAsSold(listing, {
        buyerId: selectedConversation?.buyerId,
        buyerName: selectedConversation
          ? selectedConversation.buyerName
          : walkupBuyerName.trim() || 'Walk-up UCC Student',
        conversationId: selectedConversation?.id,
        conversationStatus: selectedConversation?.status,
        finalPriceGhs: parsedPrice,
        paymentMethod,
        meetupZone,
      });
      onCompleted(orderId);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to mark listing as sold.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#14171A]/50 backdrop-blur-[2px] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mark-sold-title"
    >
      <div className="bg-white border border-[#E4E0D8] rounded-xl max-w-lg w-full overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E0D8]">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#575B62]">
              Complete Campus Sale
            </p>
            <h2
              id="mark-sold-title"
              className="font-display text-lg font-bold text-[#14171A]"
            >
              Mark Listing as Sold
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close mark as sold modal"
            className="p-2 text-[#575B62] hover:text-[#14171A] hover:bg-[#F3F1EC] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-6 space-y-5">
          {/* Item Preview */}
          <div className="flex items-center gap-3.5 p-3 rounded-lg bg-[#F8F7F4] border border-[#E4E0D8]">
            <div className="w-16 h-12 rounded-md overflow-hidden bg-[#EFECE6] shrink-0">
              <ResilientImage
                src={listing.imageUrl}
                alt={listing.title}
                title={listing.title}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#14171A] truncate">
                {listing.title}
              </p>
              <p className="text-xs text-[#575B62] truncate">
                {listing.brand || 'UCC Independent'} · Listed at{' '}
                <span className="font-mono tabular-nums font-medium text-[#0F4C81]">
                  GH₵ {listing.priceGhs.toFixed(2)}
                </span>
              </p>
            </div>
          </div>

          {/* Buyer Attribution */}
          <div className="space-y-2">
            <span className="block text-xs font-medium text-[#14171A]">
              Who purchased this item?
            </span>

            {conversationsForListing.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {conversationsForListing.map((conv) => {
                  const selected = selectedConvId === conv.id;
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => handleSelectBuyer(conv.id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-lg border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                        selected
                          ? 'bg-[#0F4C81]/6 border-[#0F4C81]'
                          : 'bg-white border-[#E4E0D8] hover:border-[#0F4C81]/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#14171A] truncate">
                          {conv.buyerName}
                        </p>
                        <p className="text-[11px] text-[#575B62] truncate">
                          {conv.paymentMethod || 'MTN MoMo'} · {conv.meetupZone}
                        </p>
                      </div>
                      {selected && (
                        <CheckCircle2 className="w-4 h-4 text-[#0F4C81] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => handleSelectBuyer('walkup')}
              className={`w-full text-left px-3.5 py-2.5 rounded-lg border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                selectedConvId === 'walkup'
                  ? 'bg-[#0F4C81]/6 border-[#0F4C81]'
                  : 'bg-white border-[#E4E0D8] hover:border-[#0F4C81]/50'
              }`}
            >
              <div>
                <p className="text-xs font-semibold text-[#14171A]">
                  Walk-up or Direct Campus Buyer
                </p>
                <p className="text-[11px] text-[#575B62]">
                  Sold directly on UCC campus outside chat
                </p>
              </div>
              {selectedConvId === 'walkup' && (
                <CheckCircle2 className="w-4 h-4 text-[#0F4C81] shrink-0" />
              )}
            </button>

            {selectedConvId === 'walkup' && (
              <div className="pt-1">
                <label
                  htmlFor="walkup-buyer-name"
                  className="block text-[11px] font-medium text-[#575B62] mb-1"
                >
                  Buyer Label (for your Order History)
                </label>
                <input
                  id="walkup-buyer-name"
                  type="text"
                  maxLength={FIELD_LIMITS.DISPLAY_NAME_MAX}
                  value={walkupBuyerName}
                  onChange={(e) => setWalkupBuyerName(e.target.value)}
                  placeholder="e.g., Valco Hall Student"
                  className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3 py-2 text-xs text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="sold-final-price"
                className="block text-xs font-medium text-[#14171A] mb-1.5"
              >
                Final Price (GH₵)
              </label>
              <input
                id="sold-final-price"
                type="number"
                required
                min={0}
                max={FIELD_LIMITS.PRICE_MAX}
                step="0.5"
                value={finalPriceGhs}
                onChange={(e) => setFinalPriceGhs(e.target.value)}
                className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3.5 py-2 text-sm font-mono tabular-nums text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
              />
            </div>

            <div>
              <label
                htmlFor="sold-payment-method"
                className="block text-xs font-medium text-[#14171A] mb-1.5"
              >
                Payment Received Via
              </label>
              <select
                id="sold-payment-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3 py-2 text-sm text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="sold-meetup-zone"
              className="block text-xs font-medium text-[#14171A] mb-1.5"
            >
              Campus Meetup Location
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-[#0F4C81] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="sold-meetup-zone"
                value={meetupZone}
                onChange={(e) => setMeetupZone(e.target.value)}
                className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] pl-9 pr-3 py-2 text-sm text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
              >
                {UCC_MEETUP_ZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-start gap-2.5 text-xs text-[#575B62] bg-[#F8F7F4] rounded-lg p-3 border border-[#E4E0D8]">
            <ShieldCheck className="w-4 h-4 text-[#0F4C81] shrink-0 mt-0.5" />
            <span>
              Confirming removes this item from the Home marketplace feed immediately and stores a permanent receipt in your Order History.
            </span>
          </div>

          {errorMsg && <p className="text-xs text-[#9B2C2C]">{errorMsg}</p>}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E4E0D8]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#575B62] hover:text-[#14171A] rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 text-sm font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
            >
              {submitting ? 'Completing Sale...' : 'Confirm Mark as Sold'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
