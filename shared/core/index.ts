/**
 * Platform-agnostic Kaarobar logic shared by every client (Expo apps, Next.js
 * web, Electron desktop). Nothing here may import react-native, next, electron
 * or any DOM API — that is what keeps it usable from all four.
 */
export * from '@core/lib/decimal';
export * from '@core/lib/uuid';
export * from '@core/lib/barcode';
export * from '@core/lib/listingFilters';
export * from '@core/lib/customers';
export * from '@core/lib/brand-palette';
