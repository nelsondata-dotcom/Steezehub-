import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, onSnapshot, query, Timestamp, where } from 'firebase/firestore';
import {
  Check,
  CheckCircle2,
  Copy,
  Gift,
  LogOut,
  Receipt,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  applyReferralCode,
  requestSellerTierUpgrade,
  updateUserProfile,
} from '../services/marketplaceService';
import {
  FIELD_LIMITS,
  OrderRecord,
  PAYMENT_METHODS,
  REFERRAL_REWARD_GHS,
  Referral,
  SELLER_TIER_DETAILS,
  SellerTier,
  UCC_HALLS,
  UserPrivateInfo,
  UserPublicProfile,
} from '../types';

interface AccountInfoViewProps {
  currentUser: User | null;
  currentProfile: UserPublicProfile | null;
  privateInfo: UserPrivateInfo | null;
  initialReferralCode?: string;
  onProfileUpdated: () => void;
  onOpenShopOrders?: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

function formatShortDate(ts?: Timestamp | null): string {
  if (!ts || typeof ts.toDate !== 'function') return 'Just now';
  return ts.toDate().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export const AccountInfoView: React.FC<AccountInfoViewProps> = ({
  currentUser,
  currentProfile,
  privateInfo,
  initialReferralCode = '',
  onProfileUpdated,
  onOpenShopOrders,
  onSignIn,
  onSignOut,
}) => {
  const [displayName, setDisplayName] = useState(currentProfile?.displayName || '');
  const [hall, setHall] = useState(currentProfile?.hall || UCC_HALLS[0]);
  const [program, setProgram] = useState(currentProfile?.program || '');
  const [bio, setBio] = useState(currentProfile?.bio || '');
  const [phone, setPhone] = useState(privateInfo?.phone || '');
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState(
    privateInfo?.preferredPaymentMethod || PAYMENT_METHODS[0]
  );
  const [acceptedPaymentMethods, setAcceptedPaymentMethods] = useState<string[]>(
    currentProfile?.acceptedPaymentMethods?.length
      ? currentProfile.acceptedPaymentMethods
      : ['MTN MoMo', 'Cash on Meetup']
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState('');

  const [requestingTier, setRequestingTier] = useState(false);
  const [tierNotice, setTierNotice] = useState('');

  const [referralsSent, setReferralsSent] = useState<Referral[]>([]);
  const [myClaimedReferral, setMyClaimedReferral] = useState<Referral | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderRecord[]>([]);
  const [friendCodeInput, setFriendCodeInput] = useState(initialReferralCode);
  const [claimingReferral, setClaimingReferral] = useState(false);
  const [referralNotice, setReferralNotice] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    setDisplayName(currentProfile?.displayName || '');
    setHall(currentProfile?.hall || UCC_HALLS[0]);
    setProgram(currentProfile?.program || '');
    setBio(currentProfile?.bio || '');
    setPhone(privateInfo?.phone || '');
    setPreferredPaymentMethod(
      privateInfo?.preferredPaymentMethod || PAYMENT_METHODS[0]
    );
    setAcceptedPaymentMethods(
      currentProfile?.acceptedPaymentMethods?.length
        ? currentProfile.acceptedPaymentMethods
        : ['MTN MoMo', 'Cash on Meetup']
    );
  }, [currentProfile, privateInfo]);

  useEffect(() => {
    if (initialReferralCode) {
      setFriendCodeInput(initialReferralCode);
    }
  }, [initialReferralCode]);

  useEffect(() => {
    if (!currentUser) {
      setReferralsSent([]);
      setMyClaimedReferral(null);
      setRecentOrders([]);
      return;
    }

    const sentQuery = query(
      collection(db, 'referrals'),
      where('referrerUid', '==', currentUser.uid)
    );
    const unsubSent = onSnapshot(
      sentQuery,
      (snap) => {
        setReferralsSent(snap.docs.map((d) => d.data() as Referral));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'referrals')
    );

    const claimedQuery = query(
      collection(db, 'referrals'),
      where('referredUid', '==', currentUser.uid)
    );
    const unsubClaimed = onSnapshot(
      claimedQuery,
      (snap) => {
        setMyClaimedReferral(
          snap.empty ? null : (snap.docs[0].data() as Referral)
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'referrals')
    );

    const ordersQuery = query(
      collection(db, 'orders'),
      where('participantIds', 'array-contains', currentUser.uid)
    );
    const unsubOrders = onSnapshot(
      ordersQuery,
      (snap) => {
        setRecentOrders(
          snap.docs
            .map((d) => d.data() as OrderRecord)
            .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'orders')
    );

    return () => {
      unsubSent();
      unsubClaimed();
      unsubOrders();
    };
  }, [currentUser]);

  const totalEarnedGhs = useMemo(
    () =>
      referralsSent
        .filter((r) => r.status === 'rewarded')
        .reduce((sum, r) => sum + r.rewardGhs, 0),
    [referralsSent]
  );

  const pendingRewardGhs = useMemo(
    () =>
      referralsSent
        .filter((r) => r.status === 'qualified')
        .reduce((sum, r) => sum + r.rewardGhs, 0),
    [referralsSent]
  );

  if (!currentUser) {
    return (
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="bg-white border border-[#E4E0D8] rounded-xl p-10 space-y-5">
          <div className="w-11 h-11 rounded-lg bg-[#EFECE6] text-[#0F4C81] flex items-center justify-center mx-auto">
            <UserIcon className="w-5 h-5" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[#14171A] text-balance">
            Sign in to view your Account Information
          </h1>
          <p className="text-sm text-[#575B62] max-w-md mx-auto leading-relaxed">
            Manage your UCC Hall profile, private MoMo payout details, approved seller fee tier, and campus referral credits.
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
  const tierInfo = SELLER_TIER_DETAILS[currentTier];

  const toggleAcceptedPayment = (method: string) => {
    setAcceptedPaymentMethods((prev) => {
      if (prev.includes(method)) {
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== method);
      }
      return [...prev, method].slice(0, 5);
    });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileNotice('');
    try {
      await updateUserProfile(currentUser.uid, currentUser.email || '', {
        displayName,
        hall,
        program,
        bio,
        phone,
        preferredPaymentMethod,
        acceptedPaymentMethods,
      });
      setProfileNotice('Account information saved.');
      onProfileUpdated();
    } catch (err) {
      setProfileNotice(
        err instanceof Error ? err.message : 'Unable to save account information.'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRequestTier = async (tier: SellerTier) => {
    setRequestingTier(true);
    setTierNotice('');
    try {
      await requestSellerTierUpgrade(currentUser.uid, tier);
      setTierNotice(
        `Requested ${SELLER_TIER_DETAILS[tier].label} tier. An administrator will review and approve.`
      );
      onProfileUpdated();
    } catch (err) {
      setTierNotice(
        err instanceof Error ? err.message : 'Unable to submit tier request.'
      );
    } finally {
      setRequestingTier(false);
    }
  };

  const handleCopyReferral = async () => {
    const code = currentProfile?.referralCode || '';
    if (!code) return;
    const shareUrl = `${window.location.origin}/?ref=${code}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setReferralNotice(`Your invite link: ${shareUrl}`);
    }
  };

  const handleApplyReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) return;
    setClaimingReferral(true);
    setReferralNotice('');
    try {
      await applyReferralCode(currentUser, currentProfile, friendCodeInput);
      setReferralNotice('Referral applied. Campus credit is queued for approval.');
      setFriendCodeInput('');
    } catch (err) {
      setReferralNotice(
        err instanceof Error ? err.message : 'Unable to apply referral code.'
      );
    } finally {
      setClaimingReferral(false);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E4E0D8] pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#575B62]">
            Student Identity &amp; Payout Settings
          </p>
          <h1 className="font-display text-3xl font-bold text-[#14171A] mt-1">
            Account Information
          </h1>
          <p className="text-xs text-[#575B62] mt-1">
            Signed in as <strong className="text-[#14171A]">{currentUser.email}</strong>
            {currentProfile?.verifiedCampus && (
              <span> · Verified UCC Seller</span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#14171A] bg-[#EFECE6] hover:bg-[#E4E0D8] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Campus Profile & Private Payment Credentials */}
        <form
          onSubmit={handleSaveProfile}
          className="lg:col-span-7 bg-white border border-[#E4E0D8] rounded-xl p-6 sm:p-8 space-y-6"
        >
          <div className="border-b border-[#E4E0D8] pb-4">
            <h2 className="font-display text-lg font-bold text-[#14171A]">
              Campus Profile &amp; Private Contact
            </h2>
            <p className="text-xs text-[#575B62] mt-1">
              Public hall and bio help buyers coordinate campus meetups. Phone and payout method remain isolated in private storage.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="acct-name" className="block text-xs font-medium text-[#14171A] mb-1.5">
                Display Name
              </label>
              <input
                id="acct-name"
                type="text"
                required
                minLength={FIELD_LIMITS.DISPLAY_NAME_MIN}
                maxLength={FIELD_LIMITS.DISPLAY_NAME_MAX}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
              />
            </div>

            <div>
              <label htmlFor="acct-hall" className="block text-xs font-medium text-[#14171A] mb-1.5">
                UCC Hall or Hostel
              </label>
              <select
                id="acct-hall"
                value={hall}
                onChange={(e) => setHall(e.target.value)}
                className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
              >
                {UCC_HALLS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="acct-program" className="block text-xs font-medium text-[#14171A] mb-1.5">
              Academic Program
            </label>
            <input
              id="acct-program"
              type="text"
              maxLength={FIELD_LIMITS.PROGRAM_MAX}
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              placeholder="e.g., B.Com Finance · Level 300"
              className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
            />
          </div>

          <div>
            <label htmlFor="acct-bio" className="block text-xs font-medium text-[#14171A] mb-1.5">
              Seller Bio
            </label>
            <textarea
              id="acct-bio"
              rows={3}
              maxLength={FIELD_LIMITS.BIO_MAX}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell UCC students what you offer and your typical meetup schedule..."
              className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
            />
          </div>

          <div>
            <span className="block text-xs font-medium text-[#14171A] mb-2">
              Accepted Payment Methods
            </span>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => {
                const active = acceptedPaymentMethods.includes(method);
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => toggleAcceptedPayment(method)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[#0F4C81] text-white border-[#0F4C81]'
                        : 'bg-[#F8F7F4] text-[#575B62] border-[#E4E0D8] hover:text-[#14171A]'
                    }`}
                  >
                    {method}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E4E0D8]">
            <div>
              <label htmlFor="acct-payout" className="block text-xs font-medium text-[#14171A] mb-1.5">
                Private Payout Method
              </label>
              <select
                id="acct-payout"
                value={preferredPaymentMethod}
                onChange={(e) => setPreferredPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="acct-phone" className="block text-xs font-medium text-[#14171A] mb-1.5">
                Private MoMo / Contact Phone
              </label>
              <input
                id="acct-phone"
                type="tel"
                maxLength={FIELD_LIMITS.PHONE_MAX}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="024 000 0000"
                className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3.5 py-2.5 text-sm font-mono tabular-nums text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
              />
            </div>
          </div>

          {profileNotice && (
            <p className="text-xs text-[#0F4C81] font-medium">{profileNotice}</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-5 py-2.5 text-sm font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
            >
              {savingProfile ? 'Saving...' : 'Save Account Information'}
            </button>
          </div>
        </form>

        {/* Right: Seller Fee Tier + Customer Referrals */}
        <div className="lg:col-span-5 space-y-6">
          {/* Seller Fee Tier Card */}
          <div className="bg-white border border-[#E4E0D8] rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-[#575B62]">Current Seller Fee Plan</p>
                <h2 className="font-display text-lg font-bold text-[#14171A]">
                  {tierInfo.label}
                </h2>
              </div>
              <ShieldCheck className="w-5 h-5 text-[#0F4C81] shrink-0" />
            </div>

            <div className="text-xs text-[#575B62] space-y-1">
              <p className="font-mono tabular-nums text-[#14171A] font-medium">
                {tierInfo.feePercent} · {tierInfo.listingCap} · GH₵ {tierInfo.monthlyFeeGhs}/mo
              </p>
              <p>{tierInfo.summary}</p>
              {tierStatus === 'pending' && (
                <p className="text-[#C88A1E] font-medium pt-1">
                  Upgrade to {SELLER_TIER_DETAILS[requestedTier].label} pending administrator approval.
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-[#E4E0D8] space-y-2">
              <p className="text-xs font-medium text-[#14171A]">
                Request Fee Tier Change
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(['micro', 'standard', 'premium'] as const).map((tierKey) => {
                  const isCurrent = currentTier === tierKey && tierStatus === 'approved';
                  const isPendingTarget =
                    tierStatus === 'pending' && requestedTier === tierKey;
                  return (
                    <button
                      key={tierKey}
                      type="button"
                      disabled={requestingTier || isCurrent}
                      onClick={() => handleRequestTier(tierKey)}
                      className={`py-2 px-2.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer capitalize ${
                        isCurrent
                          ? 'bg-[#0F4C81] text-white border-[#0F4C81]'
                          : isPendingTarget
                            ? 'bg-[#EFECE6] text-[#14171A] border-[#C88A1E]'
                            : 'bg-[#F8F7F4] text-[#14171A] border-[#E4E0D8] hover:border-[#0F4C81]'
                      }`}
                    >
                      {tierKey}
                    </button>
                  );
                })}
              </div>
              {tierNotice && (
                <p className="text-xs text-[#0F4C81] font-medium">{tierNotice}</p>
              )}
            </div>
          </div>

          {/* Customer Referrals Card */}
          <div className="bg-white border border-[#E4E0D8] rounded-xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-[#14171A]">
                  Customer Referrals
                </h2>
                <p className="text-xs text-[#575B62] mt-1">
                  Earn{' '}
                  <span className="font-mono tabular-nums font-medium text-[#14171A]">
                    GH₵ {REFERRAL_REWARD_GHS.toFixed(2)}
                  </span>{' '}
                  campus credit per student invite.
                </p>
              </div>
              <Gift className="w-5 h-5 text-[#0F4C81] shrink-0" />
            </div>

            <div className="p-3.5 rounded-lg bg-[#F8F7F4] border border-[#E4E0D8] flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] text-[#575B62]">Your Referral Code</p>
                <p className="font-mono tabular-nums text-base font-semibold text-[#14171A]">
                  {currentProfile?.referralCode || 'Generating...'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyReferral}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#0F4C81] bg-white border border-[#E4E0D8] hover:border-[#0F4C81] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied Link</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Invite</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center border-b border-[#E4E0D8] pb-4">
              <div>
                <p className="font-mono tabular-nums text-base font-bold text-[#14171A]">
                  {referralsSent.length}
                </p>
                <p className="text-[11px] text-[#575B62]">Invited</p>
              </div>
              <div>
                <p className="font-mono tabular-nums text-base font-bold text-[#0F4C81]">
                  GH₵ {pendingRewardGhs}
                </p>
                <p className="text-[11px] text-[#575B62]">Pending</p>
              </div>
              <div>
                <p className="font-mono tabular-nums text-base font-bold text-[#14171A]">
                  GH₵ {totalEarnedGhs}
                </p>
                <p className="text-[11px] text-[#575B62]">Rewarded</p>
              </div>
            </div>

            {myClaimedReferral ? (
              <div className="text-xs text-[#575B62] space-y-1">
                <p>
                  Invited by <strong className="text-[#14171A]">{myClaimedReferral.referrerName}</strong> ({myClaimedReferral.referrerCode})
                </p>
                <p className="capitalize">
                  Status: <strong className="text-[#0F4C81]">{myClaimedReferral.status}</strong>
                </p>
              </div>
            ) : (
              <form onSubmit={handleApplyReferral} className="space-y-2.5">
                <label htmlFor="acct-claim-referral" className="block text-xs font-medium text-[#14171A]">
                  Have a friend&apos;s referral code?
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="acct-claim-referral"
                    type="text"
                    value={friendCodeInput}
                    onChange={(e) => setFriendCodeInput(e.target.value.toUpperCase())}
                    placeholder="STZ-XXXXXX"
                    maxLength={FIELD_LIMITS.REFERRAL_CODE_MAX}
                    className="flex-1 rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3 py-2 text-xs font-mono text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
                  />
                  <button
                    type="submit"
                    disabled={claimingReferral || !friendCodeInput.trim()}
                    className="px-3.5 py-2 text-xs font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {claimingReferral ? 'Applying...' : 'Claim'}
                  </button>
                </div>
              </form>
            )}

            {referralNotice && (
              <p className="text-xs text-[#0F4C81] font-medium">{referralNotice}</p>
            )}
          </div>
        </div>
      </div>

      {/* Order History Snapshot */}
      <div className="bg-white border border-[#E4E0D8] rounded-xl p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E4E0D8] pb-4">
          <div className="flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-[#0F4C81]" />
            <div>
              <h2 className="font-display text-lg font-bold text-[#14171A]">
                Order History
              </h2>
              <p className="text-xs text-[#575B62]">
                Completed campus sales and purchases preserved permanently on your account.
              </p>
            </div>
          </div>
          {onOpenShopOrders && (
            <button
              type="button"
              onClick={onOpenShopOrders}
              className="px-3.5 py-2 text-xs font-medium text-[#0F4C81] bg-[#0F4C81]/8 hover:bg-[#0F4C81] hover:text-white rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Manage in My Shop
            </button>
          )}
        </div>

        {recentOrders.length === 0 ? (
          <p className="text-xs text-[#575B62]">
            No completed order receipts yet. When a listing is marked as sold in My Shop, it appears here automatically.
          </p>
        ) : (
          <div className="divide-y divide-[#E4E0D8]">
            {recentOrders.slice(0, 6).map((order) => {
              const isSeller = order.sellerId === currentUser.uid;
              return (
                <div
                  key={order.id}
                  className="py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-semibold text-[#14171A] truncate">
                      {order.listingTitle}
                    </p>
                    <p className="text-[#575B62]">
                      <span className="font-medium text-[#0F4C81]">
                        {isSeller ? 'Sold' : 'Purchased'}
                      </span>
                      {' · '}
                      {isSeller ? `Buyer: ${order.buyerName}` : `Seller: ${order.sellerName}`}
                      {' · '}
                      {order.paymentMethod}
                      {' · '}
                      {formatShortDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono tabular-nums font-semibold text-[#14171A]">
                      GH₵ {order.listingPriceGhs.toFixed(2)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#0F4C81] font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Completed</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
