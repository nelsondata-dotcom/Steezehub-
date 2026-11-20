import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Camera,
  ImagePlus,
  Link2,
  Loader2,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { CATEGORY_DEFAULT_IMAGES } from '../data/uccCatalog';
import {
  createListing,
  fetchListingPhotos,
  updateListingDetails,
} from '../services/marketplaceService';
import {
  FIELD_LIMITS,
  LISTING_CATEGORIES,
  LISTING_GROUPINGS,
  Listing,
  ListingCategory,
  ListingGrouping,
  ListingStatus,
  ListingType,
  PAYMENT_METHODS,
  POPULAR_BRANDS,
  UCC_MEETUP_ZONES,
  UserPublicProfile,
} from '../types';
import {
  compressListingImageFile,
  isValidListingImageSource,
} from '../utils/imageUpload';
import { ResilientImage } from './ResilientImage';

interface PostListingModalProps {
  currentUser: User;
  currentProfile: UserPublicProfile;
  editingListing?: Listing | null;
  onClose: () => void;
  onSaved: () => void;
}

const MAX_LISTING_PHOTOS = 4;

const IMAGE_PRESETS: { label: string; url: string }[] = [
  {
    label: 'Apparel & Tote',
    url: '/src/assets/images/listing_campus_streetwear_1795194564169.jpg',
  },
  {
    label: 'Tech & Desk Kit',
    url: '/src/assets/images/listing_tech_desk_kit_1795194563786.jpg',
  },
  {
    label: 'Grooming & Hair Care',
    url: '/src/assets/images/listing_braiding_grooming_1795194565715.jpg',
  },
  {
    label: 'Academic & Design',
    url: '/src/assets/images/listing_academic_design_studio_1795194564247.jpg',
  },
  {
    label: 'Snacks & Drinks',
    url: '/src/assets/images/listing_dorm_snacks_drinks_1795194565539.jpg',
  },
];

export const PostListingModal: React.FC<PostListingModalProps> = ({
  currentUser,
  currentProfile,
  editingListing,
  onClose,
  onSaved,
}) => {
  const [type, setType] = useState<ListingType>(editingListing?.type || 'good');
  const [grouping, setGrouping] = useState<ListingGrouping>(
    editingListing?.grouping || 'Campus Essentials'
  );
  const [brand, setBrand] = useState(
    editingListing?.brand || currentProfile.displayName || 'UCC Independent'
  );
  const [category, setCategory] = useState<ListingCategory>(
    editingListing?.category || 'Apparel & Thrift'
  );
  const [title, setTitle] = useState(editingListing?.title || '');
  const [description, setDescription] = useState(editingListing?.description || '');
  const [priceGhs, setPriceGhs] = useState(
    editingListing ? String(editingListing.priceGhs) : ''
  );
  const [priceUnit, setPriceUnit] = useState(
    editingListing?.priceUnit || 'Fixed'
  );
  const [acceptedPaymentMethods, setAcceptedPaymentMethods] = useState<string[]>(
    editingListing?.acceptedPaymentMethods?.length
      ? editingListing.acceptedPaymentMethods
      : currentProfile.acceptedPaymentMethods?.length
        ? currentProfile.acceptedPaymentMethods
        : ['MTN MoMo', 'Cash on Meetup']
  );
  const [meetupZone, setMeetupZone] = useState(
    editingListing?.meetupZone || UCC_MEETUP_ZONES[0]
  );
  const [conditionOrTurnaround, setConditionOrTurnaround] = useState(
    editingListing?.conditionOrTurnaround || 'Brand New'
  );
  const [fallbackPresetUrl, setFallbackPresetUrl] = useState(
    CATEGORY_DEFAULT_IMAGES[editingListing?.category || 'Apparel & Thrift']
  );
  const [galleryUrls, setGalleryUrls] = useState<string[]>(() =>
    editingListing?.imageUrl ? [editingListing.imageUrl] : []
  );
  const [loadingExistingPhotos, setLoadingExistingPhotos] = useState<boolean>(
    Boolean(editingListing)
  );
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const [status, setStatus] = useState<ListingStatus>(
    editingListing?.status || 'active'
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editingListing) {
      setLoadingExistingPhotos(false);
      return;
    }

    let active = true;
    setLoadingExistingPhotos(true);

    fetchListingPhotos(editingListing, currentUser.uid)
      .then((extraPhotos) => {
        if (!active) return;
        const combined = Array.from(
          new Set(
            [
              editingListing.imageUrl,
              ...extraPhotos.map((p) => p.imageUrl),
            ].filter((u): u is string => Boolean(u))
          )
        ).slice(0, MAX_LISTING_PHOTOS);
        setGalleryUrls(combined);
      })
      .catch(() => {
        // Keep cover photo if extra gallery fetch fails
      })
      .finally(() => {
        if (active) setLoadingExistingPhotos(false);
      });

    return () => {
      active = false;
    };
  }, [editingListing, currentUser.uid]);

  const handleCategoryChange = (nextCategory: ListingCategory) => {
    setCategory(nextCategory);
    if (!editingListing) {
      setFallbackPresetUrl(CATEGORY_DEFAULT_IMAGES[nextCategory]);
    }
  };

  const handleTypeChange = (nextType: ListingType) => {
    setType(nextType);
    if (!editingListing) {
      setPriceUnit(nextType === 'service' ? 'Per Session' : 'Fixed');
      setConditionOrTurnaround(nextType === 'service' ? '24h Turnaround' : 'Brand New');
    }
  };

  const togglePaymentMethod = (method: string) => {
    setAcceptedPaymentMethods((prev) => {
      if (prev.includes(method)) {
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== method);
      }
      return [...prev, method].slice(0, 5);
    });
  };

  const handleSelectedFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setPhotoError('');
    const remainingSlots = MAX_LISTING_PHOTOS - galleryUrls.length;
    if (remainingSlots <= 0) {
      setPhotoError(`Maximum of ${MAX_LISTING_PHOTOS} pictures reached. Remove one to add another.`);
      return;
    }

    const batch = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setPhotoError(
        `Only ${remainingSlots} ${remainingSlots === 1 ? 'slot' : 'slots'} left (up to ${MAX_LISTING_PHOTOS} pictures per listing).`
      );
    }

    setUploadingPhotos(true);
    const processed: string[] = [];

    try {
      for (let i = 0; i < batch.length; i += 1) {
        const file = batch[i];
        setUploadStatusText(`Optimizing picture ${i + 1} of ${batch.length}...`);
        const result = await compressListingImageFile(file);
        processed.push(result.dataUrl);
      }

      if (processed.length > 0) {
        setGalleryUrls((prev) =>
          Array.from(new Set([...prev, ...processed])).slice(0, MAX_LISTING_PHOTOS)
        );
      }
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : 'Unable to process selected picture.'
      );
    } finally {
      setUploadingPhotos(false);
      setUploadStatusText('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddUrl = () => {
    setPhotoError('');
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    if (galleryUrls.length >= MAX_LISTING_PHOTOS) {
      setPhotoError(`Maximum of ${MAX_LISTING_PHOTOS} pictures reached.`);
      return;
    }

    if (!isValidListingImageSource(trimmed)) {
      setPhotoError('Enter a valid image link starting with https:// or http://.');
      return;
    }

    setGalleryUrls((prev) =>
      Array.from(new Set([...prev, trimmed])).slice(0, MAX_LISTING_PHOTOS)
    );
    setUrlInput('');
    setShowUrlInput(false);
  };

  const handleMakeCover = (index: number) => {
    if (index <= 0 || index >= galleryUrls.length) return;
    setGalleryUrls((prev) => {
      const next = [...prev];
      const [chosen] = next.splice(index, 1);
      return [chosen, ...next];
    });
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoError('');
    setGalleryUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleSelectedFiles(e.dataTransfer.files);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const parsedPrice = Number(priceGhs);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0 || parsedPrice > FIELD_LIMITS.PRICE_MAX) {
      setErrorMsg('Enter a valid price in GH₵ between 0 and 100,000.');
      return;
    }

    const finalGallery =
      galleryUrls.length > 0 ? galleryUrls : [fallbackPresetUrl];

    setSubmitting(true);
    try {
      if (editingListing) {
        await updateListingDetails(editingListing.id, {
          title,
          description,
          type,
          grouping,
          brand,
          category,
          priceGhs: parsedPrice,
          priceUnit,
          acceptedPaymentMethods,
          meetupZone,
          conditionOrTurnaround,
          imageUrl: finalGallery[0],
          galleryImageUrls: finalGallery,
          sellerId: editingListing.sellerId,
          status,
        });
      } else {
        await createListing(currentUser, currentProfile, {
          title,
          description,
          type,
          grouping,
          brand,
          category,
          priceGhs: parsedPrice,
          priceUnit,
          acceptedPaymentMethods,
          meetupZone,
          conditionOrTurnaround,
          imageUrl: finalGallery[0],
          galleryImageUrls: finalGallery,
        });
      }
      onSaved();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save listing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#14171A]/50 backdrop-blur-[2px] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-listing-title"
    >
      <div className="bg-white border border-[#E4E0D8] rounded-xl max-w-2xl w-full overflow-hidden my-auto max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E0D8] shrink-0">
          <h2 id="post-listing-title" className="font-display text-lg font-bold text-[#14171A]">
            {editingListing ? 'Edit Campus Listing' : 'Post a Campus Good or Service'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-[#575B62] hover:text-[#14171A] hover:bg-[#F3F1EC] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-1 p-1 bg-[#EFECE6] rounded-lg">
              <button
                type="button"
                onClick={() => handleTypeChange('good')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  type === 'good'
                    ? 'bg-white text-[#14171A] shadow-xs'
                    : 'text-[#575B62] hover:text-[#14171A]'
                }`}
              >
                Physical Good
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('service')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  type === 'service'
                    ? 'bg-white text-[#14171A] shadow-xs'
                    : 'text-[#575B62] hover:text-[#14171A]'
                }`}
              >
                Student Service
              </button>
            </div>

            {editingListing && editingListing.status !== 'sold' && (
              <div className="flex items-center gap-2">
                <label htmlFor="listing-status" className="text-xs font-medium text-[#575B62]">
                  Status
                </label>
                <select
                  id="listing-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ListingStatus)}
                  className="rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3 py-1.5 text-xs font-medium text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
            )}
          </div>

          {/* Seller Product / Service Pictures Uploader */}
          <div className="rounded-xl border border-[#E4E0D8] bg-[#F8F7F4]/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-[#14171A]">
                  {type === 'service'
                    ? 'Service Portfolio & Work Pictures'
                    : 'Product Pictures'}
                </h3>
                <p className="text-[11px] text-[#575B62]">
                  Upload up to {MAX_LISTING_PHOTOS} real photos from your phone or laptop. First photo is your storefront cover.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono tabular-nums text-[11px] font-semibold text-[#0F4C81]">
                  {galleryUrls.length}/{MAX_LISTING_PHOTOS} photos
                </span>
                <button
                  type="button"
                  onClick={() => setShowUrlInput((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#575B62] hover:text-[#0F4C81] cursor-pointer whitespace-nowrap"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>{showUrlInput ? 'Hide URL' : 'Paste Image URL'}</span>
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  void handleSelectedFiles(e.target.files);
                }
              }}
            />

            {showUrlInput && (
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/product-photo.jpg"
                  className="flex-1 rounded-lg border border-[#E4E0D8] bg-white px-3 py-2 text-xs text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
                />
                <button
                  type="button"
                  onClick={handleAddUrl}
                  className="px-3 py-2 text-xs font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  Add Link
                </button>
              </div>
            )}

            {galleryUrls.length === 0 ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`rounded-xl border-2 border-dashed p-4 transition-colors ${
                  isDragging
                    ? 'border-[#0F4C81] bg-[#0F4C81]/5'
                    : 'border-[#D5CFC2] bg-white'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-[#0F4C81]/10 text-[#0F4C81] flex items-center justify-center shrink-0">
                      {uploadingPhotos ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Camera className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#14171A]">
                        {uploadingPhotos
                          ? uploadStatusText
                          : 'Drag & drop photos here or browse device'}
                      </p>
                      <p className="text-[11px] text-[#575B62]">
                        Automatically optimized for fast campus mobile loading.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={uploadingPhotos}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Pictures</span>
                  </button>
                </div>

                <div className="mt-3 pt-3 border-t border-[#EFECE6] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-md overflow-hidden border border-[#E4E0D8] shrink-0 bg-[#F3F1EC]">
                      <ResilientImage
                        src={fallbackPresetUrl}
                        alt="Studio fallback cover"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-[11px] text-[#575B62]">
                      Studio placeholder if you skip uploading:
                    </span>
                  </div>
                  <select
                    aria-label="Fallback studio cover"
                    value={fallbackPresetUrl}
                    onChange={(e) => setFallbackPresetUrl(e.target.value)}
                    className="rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-2.5 py-1.5 text-xs text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
                  >
                    {IMAGE_PRESETS.map((preset) => (
                      <option key={preset.url} value={preset.url}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className="space-y-3"
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {galleryUrls.map((url, idx) => (
                    <div
                      key={`${url.slice(0, 36)}-${idx}`}
                      className={`rounded-lg border overflow-hidden bg-white flex flex-col ${
                        idx === 0 ? 'border-[#0F4C81]' : 'border-[#E4E0D8]'
                      }`}
                    >
                      <div className="relative aspect-[4/3] bg-[#EFECE6] overflow-hidden">
                        <ResilientImage
                          src={url}
                          alt={`Uploaded picture ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {idx === 0 && (
                          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[#0F4C81] text-white rounded">
                            Cover
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          aria-label={`Remove picture ${idx + 1}`}
                          className="absolute top-1.5 right-1.5 p-1 rounded bg-[#14171A]/75 text-white hover:bg-[#9B2C2C] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="px-2 py-1.5 border-t border-[#EFECE6] flex items-center justify-between gap-1">
                        <span className="font-mono tabular-nums text-[10px] text-[#575B62]">
                          Photo {idx + 1}
                        </span>
                        {idx > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleMakeCover(idx)}
                            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#0F4C81] hover:underline cursor-pointer whitespace-nowrap"
                          >
                            <Star className="w-2.5 h-2.5" />
                            <span>Set Cover</span>
                          </button>
                        ) : (
                          <span className="text-[10px] font-medium text-[#0F4C81]">
                            Primary
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {galleryUrls.length < MAX_LISTING_PHOTOS && (
                    <button
                      type="button"
                      disabled={uploadingPhotos}
                      onClick={() => fileInputRef.current?.click()}
                      className={`rounded-lg border-2 border-dashed min-h-[116px] flex flex-col items-center justify-center gap-1.5 p-3 text-center transition-colors cursor-pointer ${
                        isDragging
                          ? 'border-[#0F4C81] bg-[#0F4C81]/5 text-[#0F4C81]'
                          : 'border-[#D5CFC2] bg-white text-[#575B62] hover:border-[#0F4C81] hover:text-[#0F4C81]'
                      }`}
                    >
                      {uploadingPhotos ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#0F4C81]" />
                      ) : (
                        <ImagePlus className="w-5 h-5" />
                      )}
                      <span className="text-[11px] font-medium">
                        {uploadingPhotos ? 'Optimizing...' : 'Add Photo'}
                      </span>
                    </button>
                  )}
                </div>

                {(loadingExistingPhotos || uploadingPhotos) && (
                  <p className="text-[11px] text-[#0F4C81] font-medium">
                    {uploadingPhotos
                      ? uploadStatusText
                      : 'Loading gallery photos...'}
                  </p>
                )}
              </div>
            )}

            {photoError && (
              <p className="text-xs text-[#9B2C2C] font-medium">{photoError}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="listing-title" className="block text-xs font-medium text-[#14171A] mb-1.5">
                Title
              </label>
              <input
                id="listing-title"
                type="text"
                required
                minLength={FIELD_LIMITS.TITLE_MIN}
                maxLength={FIELD_LIMITS.TITLE_MAX}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  type === 'service'
                    ? 'e.g., Knotless Braids & Scalp Treatment'
                    : 'e.g., Casio Scientific Calculator fx-991EX'
                }
                className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
              />
            </div>

            <div>
              <label htmlFor="listing-brand" className="block text-xs font-medium text-[#14171A] mb-1.5">
                Brand or Shop Label
              </label>
              <input
                id="listing-brand"
                type="text"
                list="ucc-brand-suggestions"
                required
                minLength={FIELD_LIMITS.BRAND_MIN}
                maxLength={FIELD_LIMITS.BRAND_MAX}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g., Apple, Nike, Steezehub Thrift"
                className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
              />
              <datalist id="ucc-brand-suggestions">
                {POPULAR_BRANDS.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="listing-grouping" className="block text-xs font-medium text-[#14171A] mb-1.5">
                Campus Grouping
              </label>
              <select
                id="listing-grouping"
                value={grouping}
                onChange={(e) => setGrouping(e.target.value as ListingGrouping)}
                className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
              >
                {LISTING_GROUPINGS.map((grp) => (
                  <option key={grp} value={grp}>
                    {grp}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="listing-category" className="block text-xs font-medium text-[#14171A] mb-1.5">
                Category
              </label>
              <select
                id="listing-category"
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as ListingCategory)}
                className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
              >
                {LISTING_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="listing-description" className="text-xs font-medium text-[#14171A]">
                Description
              </label>
              <span className="font-mono tabular-nums text-[11px] text-[#575B62]">
                {description.length}/{FIELD_LIMITS.DESCRIPTION_MAX}
              </span>
            </div>
            <textarea
              id="listing-description"
              required
              rows={3}
              minLength={FIELD_LIMITS.DESCRIPTION_MIN}
              maxLength={FIELD_LIMITS.DESCRIPTION_MAX}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Include key details, condition or turnaround time, and when you are available on campus..."
              className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="listing-price" className="block text-xs font-medium text-[#14171A] mb-1.5">
                Price (GH₵)
              </label>
              <input
                id="listing-price"
                type="number"
                required
                min={0}
                max={FIELD_LIMITS.PRICE_MAX}
                step="0.5"
                value={priceGhs}
                onChange={(e) => setPriceGhs(e.target.value)}
                placeholder="120"
                className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3.5 py-2.5 text-sm font-mono tabular-nums text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
              />
            </div>

            <div>
              <label htmlFor="listing-unit" className="block text-xs font-medium text-[#14171A] mb-1.5">
                Pricing Terms
              </label>
              <input
                id="listing-unit"
                type="text"
                required
                minLength={FIELD_LIMITS.PRICE_UNIT_MIN}
                maxLength={FIELD_LIMITS.PRICE_UNIT_MAX}
                value={priceUnit}
                onChange={(e) => setPriceUnit(e.target.value)}
                placeholder="Fixed / Negotiable"
                className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
              />
            </div>

            <div>
              <label htmlFor="listing-condition" className="block text-xs font-medium text-[#14171A] mb-1.5">
                {type === 'service' ? 'Turnaround' : 'Condition'}
              </label>
              <input
                id="listing-condition"
                type="text"
                required
                minLength={FIELD_LIMITS.CONDITION_MIN}
                maxLength={FIELD_LIMITS.CONDITION_MAX}
                value={conditionOrTurnaround}
                onChange={(e) => setConditionOrTurnaround(e.target.value)}
                placeholder={type === 'service' ? '24h Turnaround' : 'Gently Used'}
                className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-[#14171A] mb-2">
              Accepted Payment Methods (select at least 1)
            </span>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => {
                const selected = acceptedPaymentMethods.includes(method);
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => togglePaymentMethod(method)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                      selected
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

          <div>
            <label htmlFor="listing-meetup" className="block text-xs font-medium text-[#14171A] mb-1.5">
              UCC Meetup Zone
            </label>
            <select
              id="listing-meetup"
              value={meetupZone}
              onChange={(e) => setMeetupZone(e.target.value)}
              className="w-full rounded-lg border border-[#E4E0D8] bg-[#F8F7F4] px-3.5 py-2.5 text-sm text-[#14171A] focus:outline-none focus:border-[#0F4C81]"
            >
              {UCC_MEETUP_ZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </div>

          {errorMsg && <p className="text-xs text-[#9B2C2C]">{errorMsg}</p>}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E4E0D8]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-[#575B62] hover:text-[#14171A] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingPhotos}
              className="px-5 py-2.5 text-sm font-medium text-white bg-[#0F4C81] hover:bg-[#0B3B66] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              {submitting
                ? 'Saving...'
                : editingListing
                  ? 'Save Changes'
                  : 'Publish to UCC Market'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
