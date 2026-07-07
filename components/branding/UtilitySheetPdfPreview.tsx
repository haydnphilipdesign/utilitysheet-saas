'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BrandProfileFormData, PacketMode } from '@/types';
import { buildPacketPdfHtml } from '@/lib/pdf/packet-html';
import { buildBrandingPreviewPacketData } from '@/lib/branding/preview-data';
import { cn } from '@/lib/utils';

interface UtilitySheetPdfPreviewProps {
    branding: Partial<BrandProfileFormData>;
    /**
     * When false, the preview applies the same plan gating the real packet
     * applies to Free accounts (forces "Powered by", hides the welcome message,
     * ignores custom next steps) so the preview never promises Pro-only output.
     * Advanced mode is Pro/Teams only, so the Simple/Advanced toggle is also
     * hidden for Free accounts.
     */
    isPro?: boolean;
    /**
     * The account's default packet mode, used only to seed the initial
     * Simple/Advanced toggle selection (e.g. onboarding passes the reusable
     * seller link's default_packet_mode). Advanced is Pro-only, so this is
     * ignored for Free accounts. Defaults to 'simple'.
     */
    defaultMode?: PacketMode;
    /**
     * Optional controlled mode. When provided (with onModeChange), the parent
     * owns the Simple/Advanced selection, e.g. so a "download test PDF"
     * button can render the same mode the preview is showing.
     */
    mode?: PacketMode;
    onModeChange?: (mode: PacketMode) => void;
}

/**
 * Production prints on US Letter with 0.55in side margins. Chromium lays the
 * document out at 96 CSS px per inch, so this is the exact content width the
 * print renderer uses. Rendering the same HTML at the same width means the
 * preview wraps lines exactly like the downloadable PDF.
 */
const PRINT_CONTENT_WIDTH_PX = (8.5 - 0.55 * 2) * 96;

/**
 * Live Branding Profile preview.
 *
 * Renders the production PDF HTML from lib/pdf/packet-html.ts (the same
 * builder used by the Chromium download pipeline) inside a sandboxed,
 * scale-to-fit iframe, so the preview cannot drift from the real document.
 * Page breaks, running headers, and page numbers only exist in the printed
 * PDF; the preview shows the document as one continuous sheet.
 */
export default function UtilitySheetPdfPreview({
    branding,
    isPro = false,
    defaultMode = 'simple',
    mode: controlledMode,
    onModeChange,
}: UtilitySheetPdfPreviewProps) {
    const [internalMode, setInternalMode] = useState<PacketMode>(defaultMode);
    const mode = controlledMode ?? internalMode;
    const setMode = (next: PacketMode) => {
        setInternalMode(next);
        onModeChange?.(next);
    };
    const effectiveMode: PacketMode = isPro ? mode : 'simple';

    // Stamp the sample "Generated on" date once per mount so typing in the
    // editor doesn't rebuild the document for a timestamp change.
    const [generatedAt] = useState(() => new Date().toISOString());

    const html = useMemo(() => {
        const packetData = buildBrandingPreviewPacketData(branding, {
            mode: effectiveMode,
            isPro,
            generatedAt,
        });
        return buildPacketPdfHtml(packetData).html;
    }, [branding, effectiveMode, isPro, generatedAt]);

    const containerRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [scale, setScale] = useState(0.5);
    const [documentHeight, setDocumentHeight] = useState(980);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateScale = () => {
            const width = container.clientWidth;
            if (width > 0) {
                setScale(width / PRINT_CONTENT_WIDTH_PX);
            }
        };

        updateScale();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(updateScale);
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    const measureDocument = useCallback(() => {
        const iframeDocument = iframeRef.current?.contentDocument;
        // Measure the document root rather than the iframe viewport: the
        // viewport can never report smaller than the iframe element itself.
        const root = iframeDocument?.querySelector('#packet-pdf-root');
        const height = root?.getBoundingClientRect().height;
        if (height && height > 0) {
            setDocumentHeight(Math.ceil(height + 16));
        }
    }, []);

    // srcDoc updates don't always refire onLoad in every browser, so re-measure
    // whenever the document changes as well.
    useEffect(() => {
        const frame = requestAnimationFrame(measureDocument);
        return () => cancelAnimationFrame(frame);
    }, [html, measureDocument]);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>
                {/* Advanced deliverables are Pro/Teams only, so the mode toggle is
                    hidden for Free accounts and the preview stays honest. */}
                {isPro && (
                    <div
                        className="inline-flex rounded-lg border border-border bg-muted p-0.5 text-xs font-medium"
                        role="group"
                        aria-label="Preview packet mode"
                    >
                        {(['simple', 'advanced'] as PacketMode[]).map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setMode(option)}
                                aria-pressed={mode === option}
                                className={cn(
                                    'rounded-md px-3 py-1 transition-colors',
                                    mode === option
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {option === 'simple' ? 'Simple' : 'Advanced'}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="max-h-[520px] overflow-y-auto rounded-lg border border-border bg-white shadow-lg dark:border-neutral-700">
                <div className="p-3">
                    <div ref={containerRef} className="relative w-full overflow-hidden" style={{ height: documentHeight * scale }}>
                        <iframe
                            ref={iframeRef}
                            title="Branding profile PDF preview"
                            sandbox="allow-same-origin"
                            srcDoc={html}
                            onLoad={measureDocument}
                            scrolling="no"
                            aria-label="Preview of your branded utility info sheet"
                            style={{
                                width: PRINT_CONTENT_WIDTH_PX,
                                height: documentHeight,
                                transform: `scale(${scale})`,
                                transformOrigin: 'top left',
                                border: 0,
                                pointerEvents: 'none',
                            }}
                        />
                    </div>
                </div>
            </div>

            <p className="text-[11px] leading-relaxed text-muted-foreground">
                Exact layout of your downloadable {effectiveMode === 'advanced' ? 'Seller Transition Packet' : 'Utility Info Sheet'} with
                sample property data. Page breaks, running headers, and page numbers appear in the PDF itself.
            </p>
        </div>
    );
}
