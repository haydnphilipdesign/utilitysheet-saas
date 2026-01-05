import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = {
    width: 1200,
    height: 630,
};
export const contentType = 'image/png';

function Pill({ children }: { children: string }) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: 9999,
                border: '1px solid rgba(148, 163, 184, 0.25)',
                background: 'rgba(15, 23, 42, 0.6)',
                color: 'rgba(226, 232, 240, 0.9)',
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: -0.2,
                whiteSpace: 'nowrap',
            }}
        >
            {children}
        </div>
    );
}

export default function OpenGraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '72px',
                    backgroundColor: '#0b1220',
                    position: 'relative',
                    overflow: 'hidden',
                    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        top: -140,
                        left: -140,
                        width: 520,
                        height: 520,
                        borderRadius: 9999,
                        background: 'rgba(71, 85, 105, 0.45)',
                        filter: 'blur(70px)',
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        bottom: -160,
                        right: -160,
                        width: 620,
                        height: 620,
                        borderRadius: 9999,
                        background: 'rgba(14, 165, 233, 0.18)',
                        filter: 'blur(80px)',
                    }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
                    <div
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 16,
                            background: 'linear-gradient(135deg,#475569,#334155)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontWeight: 900,
                            fontSize: 28,
                            letterSpacing: -1,
                            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
                        }}
                    >
                        US
                    </div>
                    <div style={{ fontSize: 36, fontWeight: 900, color: '#ffffff', letterSpacing: -1.2 }}>
                        UtilitySheet
                    </div>
                </div>

                <div
                    style={{
                        fontSize: 64,
                        fontWeight: 950,
                        lineHeight: 1.05,
                        color: '#ffffff',
                        letterSpacing: -2.4,
                        maxWidth: 980,
                    }}
                >
                    Stop chasing sellers
                    <span
                        style={{
                            display: 'block',
                            background: 'linear-gradient(90deg,#94a3b8,#e2e8f0,#94a3b8)',
                            backgroundClip: 'text',
                            color: 'transparent',
                        }}
                    >
                        for utility providers.
                    </span>
                </div>

                <div
                    style={{
                        marginTop: 22,
                        fontSize: 26,
                        lineHeight: 1.35,
                        color: 'rgba(226, 232, 240, 0.9)',
                        maxWidth: 980,
                    }}
                >
                    Send a guided intake link. Get a buyer-ready utility info sheet (PDF + link) with provider contacts—without the back-and-forth.
                </div>

                <div style={{ marginTop: 30, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <Pill>For transaction coordinators</Pill>
                    <Pill>No login for sellers</Pill>
                    <Pill>PDF + share link</Pill>
                </div>

                <div
                    style={{
                        position: 'absolute',
                        bottom: 52,
                        left: 72,
                        fontSize: 20,
                        color: 'rgba(226, 232, 240, 0.7)',
                        letterSpacing: -0.2,
                    }}
                >
                    utilitysheet.com
                </div>
            </div>
        ),
        size
    );
}

