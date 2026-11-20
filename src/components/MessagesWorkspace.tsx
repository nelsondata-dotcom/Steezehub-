import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Lock,
  MapPin,
  MessageSquare,
  Send,
  Tag,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  sendMessage,
  updateConversationDealState,
} from '../services/marketplaceService';
import {
  ADMIN_EMAIL,
  ChatMessage,
  Conversation,
  ConversationStatus,
  FIELD_LIMITS,
  PAYMENT_METHODS,
  UCC_MEETUP_ZONES,
  UserPublicProfile,
} from '../types';
import { ResilientImage } from './ResilientImage';

interface MessagesWorkspaceProps {
  currentUser: User | null;
  currentProfile: UserPublicProfile | null;
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string | null) => void;
  onRequireSignIn: () => void;
  onBrowseMarket: () => void;
}

function formatTime(ts?: Timestamp | null): string {
  if (!ts || typeof ts.toDate !== 'function') return 'Just now';
  return ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatShortDate(ts?: Timestamp | null): string {
  if (!ts || typeof ts.toDate !== 'function') return '';
  return ts.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const MessagesWorkspace: React.FC<MessagesWorkspaceProps> = ({
  currentUser,
  currentProfile,
  activeConversationId,
  onSelectConversation,
  onRequireSignIn,
  onBrowseMarket,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [roleFilter, setRoleFilter] = useState<'all' | 'buying' | 'selling'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMeetupPicker, setShowMeetupPicker] = useState(false);
  const [selectedMeetup, setSelectedMeetup] = useState<string>(UCC_MEETUP_ZONES[0]);
  const [showOfferBox, setShowOfferBox] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<string>(PAYMENT_METHODS[0]);
  const [actionError, setActionError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAdmin =
    Boolean(currentUser?.emailVerified) && currentUser?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!currentUser) {
      setConversations([]);
      setLoadingConvs(false);
      return;
    }

    setLoadingConvs(true);
    const convRef = collection(db, 'conversations');
    const q = isAdmin
      ? convRef
      : query(convRef, where('participantIds', 'array-contains', currentUser.uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as Conversation)
          .sort((a, b) => {
            const ta = a.updatedAt?.toMillis?.() || 0;
            const tb = b.updatedAt?.toMillis?.() || 0;
            return tb - ta;
          });
        setConversations(list);
        setLoadingConvs(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'conversations');
      }
    );

    return () => unsub();
  }, [currentUser, isAdmin]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  useEffect(() => {
    if (activeConversation?.paymentMethod) {
      setSelectedPayment(activeConversation.paymentMethod);
    }
    if (activeConversation?.meetupZone) {
      setSelectedMeetup(activeConversation.meetupZone);
    }
  }, [activeConversation?.id, activeConversation?.paymentMethod, activeConversation?.meetupZone]);

  useEffect(() => {
    if (!activeConversationId && conversations.length > 0 && window.innerWidth >= 1024) {
      onSelectConversation(conversations[0].id);
    }
  }, [activeConversationId, conversations, onSelectConversation]);

  useEffect(() => {
    if (!currentUser || !activeConversationId) {
      setMessages([]);
      return;
    }

    setLoadingMsgs(true);
    const msgsRef = collection(db, 'conversations', activeConversationId, 'messages');
    const q = isAdmin
      ? msgsRef
      : query(msgsRef, where('participantIds', 'array-contains', currentUser.uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as ChatMessage)
          .sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() || 0;
            const tb = b.createdAt?.toMillis?.() || 0;
            return ta - tb;
          });
        setMessages(list);
        setLoadingMsgs(false);
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `conversations/${activeConversationId}/messages`
        );
      }
    );

    return () => unsub();
  }, [currentUser, activeConversationId, isAdmin]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeConversationId]);

  const filteredConversations = useMemo(() => {
    if (!currentUser) return [];
    return conversations.filter((conv) => {
      if (roleFilter === 'buying' && conv.buyerId !== currentUser.uid) return false;
      if (roleFilter === 'selling' && conv.sellerId !== currentUser.uid) return false;
      if (searchQuery.trim()) {
        const term = searchQuery.trim().toLowerCase();
        const matches =
          conv.listingTitle.toLowerCase().includes(term) ||
          conv.sellerName.toLowerCase().includes(term) ||
          conv.buyerName.toLowerCase().includes(term) ||
          conv.meetupZone.toLowerCase().includes(term);
        if (!matches) return false;
      }
      return true;
    });
  }, [conversations, currentUser, roleFilter, searchQuery]);

  if (!currentUser) {
    return (
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="bg-white border border-[#E4E0D8] rounded-xl p-10 space-y-5">
          <div className="w-11 h-11 rounded-lg bg-[#EFECE6] text-[#0F4C81] flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="font-display text-2xl font-bold text-[#14171A] text-balance">
            Sign in to open your encrypted campus inbox
          </h2>
          <p className="text-sm text-[#575B62] max-w-md mx-auto leading-relaxed">
            Every buyer-seller conversation on Steezehub is private to participants and synced in real time across UCC campus.
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

  const senderDisplayName =
    currentProfile?.displayName || currentUser.displayName || 'UCC Student';

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || !draftText.trim() || sending) return;
    setSending(true);
    setActionError('');
    try {
      await sendMessage(activeConversation, currentUser, senderDisplayName, {
        text: draftText.trim(),
        kind: 'text',
      });
      setDraftText('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Message failed to send.');
    } finally {
      setSending(false);
    }
  };

  const handleProposeMeetup = async () => {
    if (!activeConversation || sending) return;
    setSending(true);
    setActionError('');
    try {
      await sendMessage(activeConversation, currentUser, senderDisplayName, {
        text: `Proposed UCC Meetup Spot: ${selectedMeetup}`,
        kind: 'meetup_proposal',
        proposedMeetupZone: selectedMeetup,
      });
      await updateConversationDealState(
        activeConversation.id,
        activeConversation.status,
        selectedMeetup,
        activeConversation.paymentMethod
      );
      setShowMeetupPicker(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not send meetup proposal.');
    } finally {
      setSending(false);
    }
  };

  const handleConfirmPaymentMethod = async () => {
    if (!activeConversation || sending) return;
    setSending(true);
    setActionError('');
    try {
      await sendMessage(activeConversation, currentUser, senderDisplayName, {
        text: `Selected Payment Method: ${selectedPayment}`,
        kind: 'payment_update',
        proposedPaymentMethod: selectedPayment,
      });
      await updateConversationDealState(
        activeConversation.id,
        activeConversation.status,
        activeConversation.meetupZone,
        selectedPayment
      );
      setShowPaymentPicker(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update payment method.');
    } finally {
      setSending(false);
    }
  };

  const handleSendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || sending) return;
    const numeric = Number(offerAmount);
    if (Number.isNaN(numeric) || numeric <= 0 || numeric > FIELD_LIMITS.PRICE_MAX) {
      setActionError('Enter a valid GH₵ offer amount.');
      return;
    }
    setSending(true);
    setActionError('');
    try {
      await sendMessage(activeConversation, currentUser, senderDisplayName, {
        text: `Sent offer of GH₵ ${numeric.toFixed(2)} for ${activeConversation.listingTitle}`,
        kind: 'offer',
        offerAmountGhs: numeric,
      });
      setOfferAmount('');
      setShowOfferBox(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not send price offer.');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (nextStatus: ConversationStatus) => {
    if (!activeConversation) return;
    setActionError('');
    try {
      await updateConversationDealState(
        activeConversation.id,
        nextStatus,
        activeConversation.meetupZone,
        activeConversation.paymentMethod
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update deal status.');
    }
  };

  const statusLabel: Record<ConversationStatus, string> = {
    open: 'Open Inquiry',
    reserved: 'Meetup Scheduled',
    completed: 'Completed',
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="bg-white border border-[#E4E0D8] rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px] lg:h-[calc(100vh-148px)]">
        {/* Left Thread List */}
        <aside
          className={`lg:col-span-4 border-r border-[#E4E0D8] flex flex-col bg-[#F8F7F4]/60 ${
            activeConversation ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="p-4 border-b border-[#E4E0D8] space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[#14171A]">
                Campus Inbox
              </h2>
              <span className="font-mono tabular-nums text-xs text-[#575B62]">
                {conversations.length} {conversations.length === 1 ? 'thread' : 'threads'}
              </span>
            </div>

            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search seller, item, or hall..."
              className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3 py-2 text-xs text-[#14171A] placeholder:text-[#575B62] focus:outline-none focus:border-[#0F4C81]"
            />

            <div className="flex items-center gap-1 p-1 bg-[#EFECE6] rounded-lg">
              {(['all', 'buying', 'selling'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRoleFilter(tab)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer whitespace-nowrap ${
                    roleFilter === tab
                      ? 'bg-white text-[#14171A] shadow-xs'
                      : 'text-[#575B62] hover:text-[#14171A]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#E4E0D8]">
            {loadingConvs ? (
              <div className="p-6 text-xs text-[#575B62]">Loading conversations...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <MessageSquare className="w-7 h-7 text-[#575B62]/60 mx-auto" />
                <p className="text-sm font-medium text-[#14171A]">No conversations yet</p>
                <p className="text-xs text-[#575B62] leading-relaxed">
                  Select any good or service on the marketplace and message the seller to start a thread.
                </p>
                <button
                  type="button"
                  onClick={onBrowseMarket}
                  className="inline-flex items-center px-3.5 py-2 text-xs font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] rounded-lg transition-colors cursor-pointer"
                >
                  Browse UCC Listings
                </button>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === activeConversation?.id;
                const counterparty =
                  conv.buyerId === currentUser.uid ? conv.sellerName : conv.buyerName;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => onSelectConversation(conv.id)}
                    className={`w-full text-left p-4 transition-colors cursor-pointer flex items-start gap-3 ${
                      isSelected ? 'bg-white' : 'hover:bg-white/70'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#EFECE6] shrink-0">
                      <ResilientImage
                        src={conv.listingImageUrl}
                        alt={conv.listingTitle}
                        title={conv.listingTitle}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-[#14171A] truncate">
                          {counterparty}
                        </p>
                        <span className="font-mono tabular-nums text-[11px] text-[#575B62] shrink-0">
                          {formatShortDate(conv.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-[#0F4C81] truncate">
                        {conv.listingTitle} · GH₵ {conv.listingPriceGhs.toFixed(0)}
                      </p>
                      <p className="text-xs text-[#575B62] truncate">
                        {conv.lastMessageText}
                      </p>
                      <div className="text-[11px] text-[#575B62] pt-0.5 truncate">
                        <span>{statusLabel[conv.status]}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{conv.paymentMethod || 'MTN MoMo'}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{conv.meetupZone}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Active Real-Time Thread */}
        <div
          className={`lg:col-span-8 flex flex-col bg-white ${
            activeConversation ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {!activeConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <MessageSquare className="w-8 h-8 text-[#0F4C81]/70" strokeWidth={1.5} />
              <h3 className="font-display text-xl font-bold text-[#14171A]">
                Select a conversation
              </h3>
              <p className="text-sm text-[#575B62] max-w-sm">
                Messages sync instantly with Firestore so you and UCC sellers can agree on meetup spots, payment methods, and prices safely.
              </p>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <header className="px-5 py-4 border-b border-[#E4E0D8] flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => onSelectConversation(null)}
                    aria-label="Back to conversations"
                    className="lg:hidden p-2 -ml-2 text-[#575B62] hover:text-[#14171A] rounded-lg cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#EFECE6] shrink-0">
                    <ResilientImage
                      src={activeConversation.listingImageUrl}
                      alt={activeConversation.listingTitle}
                      title={activeConversation.listingTitle}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[#14171A] truncate">
                      {activeConversation.buyerId === currentUser.uid
                        ? activeConversation.sellerName
                        : activeConversation.buyerName}
                    </h3>
                    <p className="text-xs text-[#575B62] truncate">
                      {activeConversation.listingTitle} ·{' '}
                      <span className="font-mono tabular-nums text-[#14171A]">
                        GH₵ {activeConversation.listingPriceGhs.toFixed(2)}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <div className="hidden md:flex items-center gap-1.5 text-xs text-[#575B62]">
                    <CreditCard className="w-3.5 h-3.5 text-[#0F4C81]" />
                    <span>{activeConversation.paymentMethod || 'MTN MoMo'}</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#575B62]">
                    <MapPin className="w-3.5 h-3.5 text-[#0F4C81]" />
                    <span>{activeConversation.meetupZone}</span>
                  </div>

                  <select
                    aria-label="Deal status"
                    value={activeConversation.status}
                    disabled={activeConversation.status === 'completed' && !isAdmin}
                    onChange={(e) =>
                      handleStatusChange(e.target.value as ConversationStatus)
                    }
                    className="rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3 py-1.5 text-xs font-medium text-[#14171A] focus:outline-none focus:border-[#0F4C81] disabled:opacity-70"
                  >
                    <option value="open">Open Inquiry</option>
                    <option value="reserved">Meetup Scheduled</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </header>

              {/* Real-time Message Feed */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F8F7F4]/50">
                <div className="text-center py-2">
                  <span className="text-[11px] text-[#575B62]">
                    Real-time encrypted channel · Verify goods in public UCC meetup spots before paying via{' '}
                    {activeConversation.paymentMethod || 'MoMo or Cash'}
                  </span>
                </div>

                {loadingMsgs ? (
                  <div className="text-xs text-[#575B62] text-center py-8">
                    Syncing messages...
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.senderId === currentUser.uid;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          isMine ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div
                          className={`max-w-[82%] sm:max-w-[70%] rounded-xl px-4 py-3 text-sm ${
                            isMine
                              ? 'bg-[#0F4C81] text-white'
                              : 'bg-white border border-[#E4E0D8] text-[#14171A]'
                          }`}
                        >
                          {msg.kind === 'meetup_proposal' && (
                            <div
                              className={`flex items-center gap-1.5 text-[11px] font-medium mb-1 ${
                                isMine ? 'text-white/80' : 'text-[#0F4C81]'
                              }`}
                            >
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span>Campus Meetup Proposal</span>
                            </div>
                          )}
                          {msg.kind === 'payment_update' && (
                            <div
                              className={`flex items-center gap-1.5 text-[11px] font-medium mb-1 ${
                                isMine ? 'text-white/80' : 'text-[#0F4C81]'
                              }`}
                            >
                              <CreditCard className="w-3.5 h-3.5 shrink-0" />
                              <span>Payment Method Selected</span>
                            </div>
                          )}
                          {msg.kind === 'offer' && (
                            <div
                              className={`flex items-center gap-1.5 text-[11px] font-medium mb-1 ${
                                isMine ? 'text-white/80' : 'text-[#0F4C81]'
                              }`}
                            >
                              <Tag className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                Price Offer ·{' '}
                                <span className="font-mono tabular-nums">
                                  GH₵ {(msg.offerAmountGhs ?? 0).toFixed(2)}
                                </span>
                              </span>
                            </div>
                          )}
                          <p className="leading-relaxed whitespace-pre-wrap break-words">
                            {msg.text}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 px-1 text-[11px] text-[#575B62]">
                          <span>{isMine ? 'You' : msg.senderName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatTime(msg.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Action Popovers & Composer */}
              {activeConversation.status === 'completed' ? (
                <div className="p-4 border-t border-[#E4E0D8] bg-[#F3F1EC] flex items-center justify-center gap-2 text-xs text-[#575B62]">
                  <CheckCircle2 className="w-4 h-4 text-[#0F4C81]" />
                  <span>This campus transaction is marked completed. Thread is archived.</span>
                </div>
              ) : (
                <div className="p-4 border-t border-[#E4E0D8] bg-white space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMeetupPicker((v) => !v);
                        setShowOfferBox(false);
                        setShowPaymentPicker(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#14171A] bg-[#EFECE6] hover:bg-[#E4E0D8] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <MapPin className="w-3.5 h-3.5 text-[#0F4C81]" />
                      <span>Propose Meetup Spot</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowPaymentPicker((v) => !v);
                        setShowMeetupPicker(false);
                        setShowOfferBox(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#14171A] bg-[#EFECE6] hover:bg-[#E4E0D8] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-[#0F4C81]" />
                      <span>Set Payment Method</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowOfferBox((v) => !v);
                        setShowMeetupPicker(false);
                        setShowPaymentPicker(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#14171A] bg-[#EFECE6] hover:bg-[#E4E0D8] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Tag className="w-3.5 h-3.5 text-[#0F4C81]" />
                      <span>Make Price Offer</span>
                    </button>
                  </div>

                  {showMeetupPicker && (
                    <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-[#F8F7F4] border border-[#E4E0D8]">
                      <select
                        aria-label="Choose UCC meetup spot"
                        value={selectedMeetup}
                        onChange={(e) => setSelectedMeetup(e.target.value)}
                        className="flex-1 min-w-[200px] rounded-lg border border-[#E4E0D8] bg-white px-3 py-2 text-xs text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
                      >
                        {UCC_MEETUP_ZONES.map((zone) => (
                          <option key={zone} value={zone}>
                            {zone}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={sending}
                        onClick={handleProposeMeetup}
                        className="px-3.5 py-2 text-xs font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Send Spot
                      </button>
                    </div>
                  )}

                  {showPaymentPicker && (
                    <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-[#F8F7F4] border border-[#E4E0D8]">
                      <select
                        aria-label="Choose payment method"
                        value={selectedPayment}
                        onChange={(e) => setSelectedPayment(e.target.value)}
                        className="flex-1 min-w-[200px] rounded-lg border border-[#E4E0D8] bg-white px-3 py-2 text-xs text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
                      >
                        {PAYMENT_METHODS.map((pm) => (
                          <option key={pm} value={pm}>
                            {pm}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={sending}
                        onClick={handleConfirmPaymentMethod}
                        className="px-3.5 py-2 text-xs font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Confirm Payment
                      </button>
                    </div>
                  )}

                  {showOfferBox && (
                    <form
                      onSubmit={handleSendOffer}
                      className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-[#F8F7F4] border border-[#E4E0D8]"
                    >
                      <input
                        type="number"
                        min={1}
                        max={FIELD_LIMITS.PRICE_MAX}
                        step="0.5"
                        required
                        value={offerAmount}
                        onChange={(e) => setOfferAmount(e.target.value)}
                        placeholder="Offer amount in GH₵"
                        className="flex-1 min-w-[160px] rounded-lg border border-[#E4E0D8] bg-white px-3 py-2 text-xs font-mono tabular-nums text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
                      />
                      <button
                        type="submit"
                        disabled={sending}
                        className="px-3.5 py-2 text-xs font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Send Offer
                      </button>
                    </form>
                  )}

                  {actionError && (
                    <p className="text-xs text-[#9B2C2C]">{actionError}</p>
                  )}

                  <form onSubmit={handleSendText} className="flex items-center gap-2.5">
                    <input
                      type="text"
                      maxLength={FIELD_LIMITS.MESSAGE_MAX}
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      placeholder="Write a message to coordinate pickup or payment..."
                      className="flex-1 rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-4 py-2.5 text-sm text-[#14171A] placeholder:text-[#575B62]/80 focus:outline-none focus:border-[#0F4C81]"
                    />
                    <button
                      type="submit"
                      disabled={sending || !draftText.trim()}
                      aria-label="Send message"
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Send className="w-4 h-4" />
                      <span className="hidden sm:inline">Send</span>
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
};
