'use client';

import { useEffect, useState } from 'react';

type AuthConfig = {
  credentialEnabled: boolean;
  oauthProviderIds: string[];
  loading: boolean;
  unavailable: boolean;
};

const FALLBACK_CONFIG: AuthConfig = {
  credentialEnabled: false,
  oauthProviderIds: [],
  loading: true,
  unavailable: false,
};

export function useAuthConfig(): AuthConfig {
  const [config, setConfig] = useState<AuthConfig>(FALLBACK_CONFIG);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/auth/config', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Authentication configuration request failed');
        const payload = (await response.json()) as Partial<AuthConfig>;
        setConfig({
          credentialEnabled: payload.credentialEnabled === true,
          oauthProviderIds: Array.isArray(payload.oauthProviderIds)
            ? payload.oauthProviderIds.filter((provider): provider is string => typeof provider === 'string')
            : [],
          loading: false,
          unavailable: false,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Failed to load authentication options', error);
        setConfig({ ...FALLBACK_CONFIG, loading: false, unavailable: true });
      });

    return () => controller.abort();
  }, []);

  return config;
}
