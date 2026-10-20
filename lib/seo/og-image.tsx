import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ImageResponse } from 'next/og';

export const ogImageSize = { width: 1200, height: 630 };

// Brand colors from app/(marketing)/marketing.css.
const colors = {
  background: '#f8f6f0',
  navy: '#0a2c40',
  teal: '#176173',
  muted: '#5c686f',
  border: '#cbd9d9',
  mint: '#cce7e1',
  red: '#cc4932',
};

async function loadAssets() {
  const root = process.cwd();
  const [logo, semibold, bold] = await Promise.all([
    readFile(join(root, 'public/logo-sm.png')),
    readFile(join(root, 'lib/seo/og-fonts/figtree-600.woff')),
    readFile(join(root, 'lib/seo/og-fonts/figtree-700.woff')),
  ]);
  return { logo: `data:image/png;base64,${logo.toString('base64')}`, semibold, bold };
}

/** Renders the 1200x630 social preview used for Open Graph and X cards. */
export async function renderOgImage({ eyebrow, title }: { eyebrow: string; title: string }) {
  const { logo, semibold, bold } = await loadAssets();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 80px 56px',
          backgroundColor: colors.background,
          color: colors.navy,
          fontFamily: 'Figtree',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: -170,
            bottom: -230,
            width: 440,
            height: 440,
            borderRadius: 9999,
            backgroundColor: colors.mint,
          }}
        />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 10, backgroundColor: colors.navy }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by satori, not the browser */}
          <img src={logo} width={52} height={60} alt="" />
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.8 }}>UtilitySheet</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 940 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: colors.teal,
              textTransform: 'uppercase',
              letterSpacing: 2.4,
              marginBottom: 22,
            }}
          >
            {eyebrow}
          </div>
          <div style={{ fontSize: 70, fontWeight: 700, lineHeight: 1.06, letterSpacing: -2, textWrap: 'balance' }}>{title}</div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            fontSize: 24,
            fontWeight: 600,
            color: colors.muted,
          }}
        >
          <div style={{ width: 40, height: 4, backgroundColor: colors.red }} />
          <div>utilitysheet.com</div>
          <div style={{ color: colors.border }}>·</div>
          <div>For transaction coordinators &amp; real estate agents</div>
        </div>
      </div>
    ),
    {
      ...ogImageSize,
      fonts: [
        { name: 'Figtree', data: semibold, weight: 600, style: 'normal' },
        { name: 'Figtree', data: bold, weight: 700, style: 'normal' },
      ],
    },
  );
}
