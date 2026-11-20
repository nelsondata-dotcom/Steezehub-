import { ListingCategory, ListingGrouping, ListingType, PaymentMethod } from '../types';

export const HERO_IMAGE_PATH = '/src/assets/images/hero_ucc_campus_market_1795194565115.jpg';

export interface CuratedListingSeed {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerHall: string;
  sellerProgram: string;
  sellerBio: string;
  title: string;
  description: string;
  type: ListingType;
  grouping: ListingGrouping;
  brand: string;
  category: ListingCategory;
  priceGhs: number;
  priceUnit: string;
  acceptedPaymentMethods: PaymentMethod[];
  meetupZone: string;
  conditionOrTurnaround: string;
  imageUrl: string;
}

export const CURATED_UCC_LISTINGS: CuratedListingSeed[] = [
  {
    id: 'ucc_seed_varsity_tote',
    sellerId: 'ucc_vendor_valco_threads',
    sellerName: 'Kwame Boateng',
    sellerHall: 'Valco Hall',
    sellerProgram: 'B.Com Marketing · Level 300',
    sellerBio: 'Curating washed vintage outerwear and heavyweight campus totes around Valco & Science Market.',
    title: 'Washed Charcoal Varsity Jacket & Canvas Tote',
    description:
      'Heavyweight 420gsm washed charcoal varsity bomber paired with a structured 16oz natural canvas lecture tote. Fits 15-inch laptops, textbooks, and chargers comfortably. Available for try-on at Valco Hall Gate or Science Market.',
    type: 'good',
    grouping: 'Fashion & Beauty',
    brand: 'Steezehub Thrift',
    category: 'Apparel & Thrift',
    priceGhs: 280,
    priceUnit: 'Fixed Set',
    acceptedPaymentMethods: ['MTN MoMo', 'Telecel Cash', 'Cash on Meetup'],
    meetupZone: 'Valco Hall Gate',
    conditionOrTurnaround: 'Grade A Thrift',
    imageUrl: '/src/assets/images/listing_campus_streetwear_1795194564169.jpg',
  },
  {
    id: 'ucc_seed_tech_desk_kit',
    sellerId: 'ucc_vendor_science_tech',
    sellerName: 'Abena Osei-Mensah',
    sellerHall: 'Science Market',
    sellerProgram: 'B.Sc Computer Science · Level 400',
    sellerBio: 'Testing and supplying reliable study electronics, laptop risers, and fast power banks for UCC students.',
    title: 'Aluminum Laptop Stand, ANC Headphones & 20k Power Bank',
    description:
      'Complete dorm and library study setup: solid brushed aluminum ergonomic riser, matte obsidian wireless headphones with 35h battery life, and a 20,000mAh PD USB-C power bank tested during campus outages. Items also sold individually.',
    type: 'good',
    grouping: 'Academic & Tech',
    brand: 'Anker & Baseus',
    category: 'Tech & Accessories',
    priceGhs: 490,
    priceUnit: 'Bundle / Negotiable',
    acceptedPaymentMethods: ['MTN MoMo', 'Bank / Hubtel Transfer', 'Cash on Meetup'],
    meetupZone: 'Science Market Forecourt',
    conditionOrTurnaround: 'Brand New Sealed',
    imageUrl: '/src/assets/images/listing_tech_desk_kit_1795194563786.jpg',
  },
  {
    id: 'ucc_seed_braiding_care',
    sellerId: 'ucc_vendor_adehye_glow',
    sellerName: 'Efua Cobbina',
    sellerHall: 'Adehye Hall',
    sellerProgram: 'B.Ed Home Economics · Level 300',
    sellerBio: 'Clean knotless braids, scalp care blends, and in-hall appointments across Adehye, Oguaa, and ATL.',
    title: 'Knotless Braids & Botanical Scalp Oil Studio',
    description:
      'Neat, tension-free medium knotless braids plus cold-pressed rosemary and cedar scalp oil treatment. Weekend and evening slots open at Adehye Hall Room 214 or mobile hall visits across Old Site.',
    type: 'service',
    grouping: 'Fashion & Beauty',
    brand: 'Adehye Glow Studio',
    category: 'Grooming & Beauty',
    priceGhs: 140,
    priceUnit: 'Per Session',
    acceptedPaymentMethods: ['MTN MoMo', 'Telecel Cash', 'Cash on Meetup'],
    meetupZone: 'Adehye Hall Entrance',
    conditionOrTurnaround: 'Same-Day Booking',
    imageUrl: '/src/assets/images/listing_braiding_grooming_1795194565715.jpg',
  },
  {
    id: 'ucc_seed_thesis_design',
    sellerId: 'ucc_vendor_samjonah_studio',
    sellerName: 'Kofi Tawiah',
    sellerHall: 'Casford Hall',
    sellerProgram: 'B.Sc Information Technology · Level 400',
    sellerBio: 'APA/Harvard thesis formatting, presentation decks, and urgent graphic design near Sam Jonah Library.',
    title: 'Thesis Formatting, Slide Decks & Brand Design',
    description:
      'Final-year dissertation formatting (APA 7th, table of contents, citations, SPSS tables) plus crisp Canva/Figma presentation decks for defense week. Fast turnaround with live revision previews.',
    type: 'service',
    grouping: 'Academic & Tech',
    brand: 'Sam Jonah Print Lab',
    category: 'Design & Repairs',
    priceGhs: 95,
    priceUnit: 'Per Project',
    acceptedPaymentMethods: ['MTN MoMo', 'AT Money', 'Bank / Hubtel Transfer'],
    meetupZone: 'Sam Jonah Library Steps',
    conditionOrTurnaround: '24h Turnaround',
    imageUrl: '/src/assets/images/listing_academic_design_studio_1795194564247.jpg',
  },
  {
    id: 'ucc_seed_sobolo_crisps',
    sellerId: 'ucc_vendor_oguaa_pantry',
    sellerName: 'Maame Yaa Asante',
    sellerHall: 'Oguaa Hall',
    sellerProgram: 'B.Sc Hospitality Management · Level 200',
    sellerBio: 'Freshly brewed spiced sobolo and crisp plantain chips delivered warm or chilled to lecture halls.',
    title: 'Chilled Spiced Sobolo & Plantain Crisps Pack',
    description:
      'Small-batch pineapple-ginger hibiscus sobolo in sanitized 330ml glass bottles paired with hand-cooked lightly spiced plantain crisps. Bulk orders available for hall week and study groups.',
    type: 'good',
    grouping: 'Food & Errands',
    brand: 'Oguaa Kitchen',
    category: 'Food & Drinks',
    priceGhs: 35,
    priceUnit: 'Per Combo',
    acceptedPaymentMethods: ['MTN MoMo', 'Telecel Cash', 'Cash on Meetup'],
    meetupZone: 'Old Site Quad',
    conditionOrTurnaround: 'Chilled Daily',
    imageUrl: '/src/assets/images/listing_dorm_snacks_drinks_1795194565539.jpg',
  },
  {
    id: 'ucc_seed_laundry_press',
    sellerId: 'ucc_vendor_src_errands',
    sellerName: 'Ekow Dadzie',
    sellerHall: 'SRC Hostel',
    sellerProgram: 'B.A Economics · Level 300',
    sellerBio: 'Reliable wash, fold, and steam press pickup for SRC Hostel, Superannuation, and Amamoma.',
    title: 'Hall Pickup Laundry, Fold & Steam Press',
    description:
      'Door-to-door laundry bag pickup from SRC Hostel, Valco, and Amamoma. Hypoallergenic detergent wash, sun-dry, crisp iron press for lecture shirts, and neatly folded delivery within 24 hours.',
    type: 'service',
    grouping: 'Hall Life & Dorm',
    brand: 'SRC Express',
    category: 'Laundry & Errands',
    priceGhs: 60,
    priceUnit: 'Per Basket (8kg)',
    acceptedPaymentMethods: ['MTN MoMo', 'Cash on Meetup'],
    meetupZone: 'SRC Hostel Courtyard',
    conditionOrTurnaround: '24h Pickup & Return',
    imageUrl: '/src/assets/images/hero_ucc_campus_market_1795194565115.jpg',
  },
];

export const CATEGORY_DEFAULT_IMAGES: Record<ListingCategory, string> = {
  'Apparel & Thrift': '/src/assets/images/listing_campus_streetwear_1795194564169.jpg',
  'Tech & Accessories': '/src/assets/images/listing_tech_desk_kit_1795194563786.jpg',
  'Textbooks & Study': '/src/assets/images/listing_academic_design_studio_1795194564247.jpg',
  'Food & Drinks': '/src/assets/images/listing_dorm_snacks_drinks_1795194565539.jpg',
  'Grooming & Beauty': '/src/assets/images/listing_braiding_grooming_1795194565715.jpg',
  'Design & Repairs': '/src/assets/images/listing_academic_design_studio_1795194564247.jpg',
  'Laundry & Errands': '/src/assets/images/hero_ucc_campus_market_1795194565115.jpg',
};
