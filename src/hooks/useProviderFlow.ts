import { useCallback, useEffect, useState } from 'react';
import type { Provider } from '../components/providers/types';
import type { ServiceProvider } from '../types/provider.types';
import type { ProviderCategory } from '../services/providerDataSource';
import {
  postcodeService,
  calculateDistanceMiles,
} from '../services/postcodeService';

interface PostcodeGeo {
  latitude: number;
  longitude: number;
}

interface UseProviderFlowReturn {
  propertyGeo: PostcodeGeo | null;
  turboMode: boolean;
  setTurboMode: (value: boolean) => void;
  toServiceProvider: (provider: Provider, category: ProviderCategory) => ServiceProvider;
  enrichWithDistance: (providers: Provider[]) => Provider[];
}

/**
 * Bridge between provider marketplace panels and the transaction flow.
 * Handles: postcode geocoding, turbo mode state, type bridging.
 */
export function useProviderFlow(
  transactionPostcode?: string,
): UseProviderFlowReturn {
  const [propertyGeo, setPropertyGeo] = useState<PostcodeGeo | null>(null);
  const [turboMode, setTurboMode] = useState(false);

  // Prefetch property postcode geocode at mount
  useEffect(() => {
    if (!transactionPostcode) return;
    void postcodeService.lookupPostcode(transactionPostcode).then((result) => {
      if (result?.latitude != null && result?.longitude != null) {
        setPropertyGeo({ latitude: result.latitude, longitude: result.longitude });
      }
    });
  }, [transactionPostcode]);

  const toServiceProvider = useCallback(
    (provider: Provider, category: ProviderCategory): ServiceProvider => ({
      id: provider.id,
      name: provider.name,
      category: category === 'aml_kyc' ? 'aml_kyc' : category,
      description: provider.tagline,
      priceInPence: Math.round((provider.price ?? 0) * 100),
      currency: 'GBP',
      averageRating: provider.rating,
      totalReviews: provider.reviews,
      averageTurnaroundMinutes: 0, // No downstream consumer — set to 0 per eng review
      isActive: true,
      logoInitials: provider.logo,
    }),
    [],
  );

  const enrichWithDistance = useCallback(
    (providers: Provider[]): Provider[] => {
      if (!propertyGeo) return providers;
      return providers.map((p) => {
        if (!p.postcode) return p;
        // Use cached geocode from postcodeService
        // For static data, we approximate with known postcodes
        const providerGeo = postcodeService['cache'].get(
          postcodeService.normalizePostcode(p.postcode),
        );
        if (!providerGeo?.data?.latitude || !providerGeo?.data?.longitude) return p;
        const distance = calculateDistanceMiles(
          propertyGeo.latitude,
          propertyGeo.longitude,
          providerGeo.data.latitude,
          providerGeo.data.longitude,
        );
        return { ...p, distanceMiles: Math.round(distance * 10) / 10 };
      });
    },
    [propertyGeo],
  );

  return {
    propertyGeo,
    turboMode,
    setTurboMode,
    toServiceProvider,
    enrichWithDistance,
  };
}
