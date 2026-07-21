import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/stack/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const project = await stackServerApp.getProject();

    return NextResponse.json(
      {
        credentialEnabled: project.config.credentialEnabled,
        oauthProviderIds: project.config.oauthProviders.map((provider) => provider.id),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    console.error('Failed to load Stack Auth project configuration', error);
    return NextResponse.json(
      { error: 'Authentication options are temporarily unavailable' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
