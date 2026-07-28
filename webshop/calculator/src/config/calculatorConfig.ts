/**
 * Het enige bestand dat je hoeft aan te passen.
 *
 * Producten, exposure-waardes, conversiepercentages en aannames staan hier.
 * De variant-ID's en prijzen komen uit Shopify zelf (via Liquid), zodat je ze
 * hier niet hoeft bij te houden — koppelen gebeurt op `handle`.
 */
import type { ProductConfig, Category } from '../types';

export const PRODUCTS: ProductConfig[] = [
  {
    id: 'google-standaard',
    handle: 'tapkaarten-google-review-standaard',
    // Wit en zwart zijn hetzelfde bordje; als twee losse tegels leidde dat
    // alleen maar af van de keuze die er echt toe doet.
    options: [
      { label: 'Wit', handle: 'tapkaarten-google-review-standaard' },
      { label: 'Zwart', handle: 'tapkaarten-google-review-standaard-zwart' },
    ],
    title: 'Google Review-standaard',
    blurb: 'Op de balie of het tafeltje. De klassieker voor meer Google-reviews.',
    category: 'google',
    exposure: { steps: [1.0, 0.6, 0.4], tail: 0.25 },
    accent: '#4285F4',
    badge: 'Meest gekozen',
  },
  {
    id: 'google-sticker',
    handle: 'tapkaarten-google-review-sticker',
    title: 'Google Review-sticker',
    blurb: 'Zelfklevend. Op de toonbank, de deur of naast de pinautomaat.',
    category: 'google',
    exposure: { steps: [0.7, 0.3], tail: 0.15 },
    accent: '#34A853',
  },
  {
    id: 'instagram-standaard',
    handle: 'tapkaarten-instagram-standaard',
    title: 'Instagram-standaard',
    blurb: 'Eén tik en je klant volgt je op Instagram.',
    category: 'instagram',
    exposure: { steps: [1.0, 0.6, 0.4], tail: 0.25 },
    accent: '#D62976',
  },
  {
    id: 'facebook-standaard',
    handle: 'tapkaarten-facebook-standaard',
    title: 'Facebook-standaard',
    blurb: 'Eén tik en je klant volgt je bedrijfspagina op Facebook.',
    category: 'facebook',
    exposure: { steps: [1.0, 0.6, 0.4], tail: 0.25 },
    accent: '#1877F2',
  },
];

/**
 * Basisconversie per categorie: het aandeel kassabezoekers dat iets doet.
 * Dit is een nettogetal — tikpercentage maal afmaakpercentage. De 4% voor
 * Google staat bijvoorbeeld voor: één op de tien klanten houdt zijn telefoon
 * tegen de kaart, en vier op de tien daarvan schrijft de review ook echt.
 * Instagram ligt hoger omdat volgen één tik is en een review typen kost.
 *
 * Dit zijn schattingen. Zodra je eigen cijfers hebt uit de eerste maanden,
 * vervang je ze hier door de gemeten waarden.
 */
export const BASE_CONVERSION: Record<Category, number> = {
  google: 0.04,
  instagram: 0.05,
  facebook: 0.025,
};

export const ASSUMPTIONS = {
  /** Deel van de bezoekers dat langs de kassa of balie komt. */
  checkoutShare: 0.9,
  daysPerMonth: 30,
  /**
   * `1 - e^(-exposure)` geeft één standaard maar 63% effectiviteit. Met
   * normaliseren telt de eerste standaard voor 100% en levert elk extra
   * exemplaar daar bovenop steeds minder op. Zet op false voor de kale formule.
   */
  normaliseEffectiveness: true,
} as const;

export const SLIDER = {
  min: 10,
  max: 1000,
  default: 150,
  /**
   * De schuifbalk loopt niet recht. Verreweg de meeste zaken zitten tussen de
   * 20 en 300 bezoekers per dag, en op een rechte schaal schiet je daar met één
   * duimbeweging overheen. Met deze macht krijgt 10–100 ruim een derde van de
   * balk, terwijl de bovenkant bruikbaar blijft.
   */
  curve: 2.5,
  /** Aantal standen van de balk zelf; niet het aantal bezoekers. */
  positions: 1000,
} as const;

/** Btw-tarief voor de uitsplitsing in het overzicht. */
export const VAT_RATE = 0.21;

/** Snelkeuzes: vullen de aantallen in één klik. */
export const PRESETS: { id: string; label: string; hint: string; quantities: Record<string, number>; }[] = [
  {
    id: 'start',
    label: 'Eén balie',
    hint: 'Van elk één',
    quantities: {
      'google-standaard': 1,
      'google-sticker': 1,
      'instagram-standaard': 1,
      'facebook-standaard': 1,
    },
  },
  {
    id: 'compleet',
    label: 'Compleet',
    hint: 'Van elk twee, drie stickers',
    quantities: {
      'google-standaard': 2,
      'google-sticker': 3,
      'instagram-standaard': 2,
      'facebook-standaard': 2,
    },
  },
  {
    id: 'meerdere',
    label: 'Meerdere punten',
    hint: 'Van elk drie, vijf stickers',
    quantities: {
      'google-standaard': 3,
      'google-sticker': 5,
      'instagram-standaard': 3,
      'facebook-standaard': 3,
    },
  },
];

export const CATEGORY_LABELS: Record<Category, { title: string; unit: string; accent: string }> = {
  google: { title: 'Geschatte nieuwe Google Reviews', unit: 'per maand', accent: '#4285F4' },
  instagram: { title: 'Geschatte nieuwe Instagram-volgers', unit: 'per maand', accent: '#D62976' },
  facebook: { title: 'Geschatte nieuwe Facebook-volgers', unit: 'per maand', accent: '#1877F2' },
};

/**
 * Staffelkorting. Deze percentages moeten gelijk lopen met de automatische
 * kortingen in Shopify — die doen het echte rekenwerk bij het afrekenen,
 * hier tonen we alleen wat de klant kan verwachten. Wijzig je er één,
 * wijzig dan ook de ander.
 */
export const VOLUME_TIERS: { minQuantity: number; percentage: number }[] = [
  { minQuantity: 2, percentage: 0.1 },
  { minQuantity: 3, percentage: 0.15 },
  { minQuantity: 4, percentage: 0.2 },
];
