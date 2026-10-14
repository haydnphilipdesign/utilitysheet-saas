'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Phones (under 640px wide, over 500px tall; the `pinbar` variant in
 * app/globals.css): pins a step's main actions to the bottom of the screen.
 *
 * Sticky rather than fixed: the actions keep their place in the page, so tab
 * order is unchanged, they finish after the last content (never on top of it),
 * and the steps' slide-in transforms cannot move them. While a text field is
 * focused (the phone keyboard is open) they un-pin back to that place instead
 * of floating above the keyboard. Screens under 500px tall (landscape phones)
 * are not pinned: there the bar would take a third of the screen. Tablets and
 * desktop are unaffected.
 */
export const wizardPinnedActions =
    'pinbar:sticky pinbar:bottom-0 pinbar:z-30 pinbar:-mx-4 pinbar:px-4 pinbar:pt-3 pinbar:pb-[calc(0.75rem+env(safe-area-inset-bottom))] pinbar:border-t pinbar:border-border pinbar:bg-background pinbar:data-[typing]:static';

const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit']);

function isTextEntry(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target instanceof HTMLTextAreaElement) return true;
    if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type);
    return target.isContentEditable;
}

function isPinned(bar: HTMLElement): boolean {
    return getComputedStyle(bar).position === 'sticky';
}

// The newest mounted bar owns the page's scroll padding. A step that is still
// animating out (Review reappears after the sending screen while the previous
// copy leaves) must not clear what the new one set.
let paddingOwner: HTMLElement | null = null;

function syncScrollPadding(bar: HTMLElement) {
    if (paddingOwner !== bar) return;
    document.documentElement.style.scrollPaddingBottom = isPinned(bar) ? `${Math.ceil(bar.getBoundingClientRect().height)}px` : '';
}

/** Spread on the actions container that uses `wizardPinnedActions`. */
export function usePinnedActions<T extends HTMLElement = HTMLDivElement>() {
    const ref = useRef<T | null>(null);
    const [typing, setTyping] = useState(false);

    useEffect(() => {
        const bar = ref.current;
        if (!bar) return;
        // Focus scrolling and scrollIntoView keep clear of the pinned bar.
        paddingOwner = bar;
        const sync = () => syncScrollPadding(bar);

        // A focused control must not end up hidden behind the bar (WCAG 2.4.11).
        let frame = 0;
        const revealFocused = (target: HTMLElement) => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                if (paddingOwner !== bar || !target.isConnected || bar.contains(target) || !isPinned(bar)) return;
                const overlap = target.getBoundingClientRect().bottom - bar.getBoundingClientRect().top;
                if (overlap > 0) window.scrollBy({ top: overlap + 8, left: 0, behavior: 'instant' });
            });
        };

        // Leaving a text field re-pins the bar, but never in the middle of a
        // press: a mouse press that moved focus would otherwise end on the bar
        // that just appeared over its target, and the click would be lost.
        let pointerDown = false;
        let releaseAfterPress = false;
        let releaseTimer = 0;
        const release = () => {
            if (pointerDown) releaseAfterPress = true;
            else setTyping(false);
        };
        const onPointerDown = () => { pointerDown = true; };
        const onPointerUp = () => {
            pointerDown = false;
            if (!releaseAfterPress) return;
            releaseAfterPress = false;
            // The click follows pointerup in the same task.
            releaseTimer = window.setTimeout(() => setTyping(false), 0);
        };

        const onFocusIn = (event: FocusEvent) => {
            if (isTextEntry(event.target)) {
                releaseAfterPress = false;
                clearTimeout(releaseTimer);
                setTyping(true);
                return;
            }
            release();
            if (event.target instanceof HTMLElement) revealFocused(event.target);
        };
        const onFocusOut = (event: FocusEvent) => {
            if (!isTextEntry(event.relatedTarget)) release();
        };

        // Steps mount after a button press, so no text field has focus yet.
        sync();
        document.addEventListener('focusin', onFocusIn);
        document.addEventListener('focusout', onFocusOut);
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('pointerup', onPointerUp, true);
        document.addEventListener('pointercancel', onPointerUp, true);
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
        observer?.observe(bar);
        window.addEventListener('resize', sync);
        return () => {
            cancelAnimationFrame(frame);
            clearTimeout(releaseTimer);
            document.removeEventListener('focusin', onFocusIn);
            document.removeEventListener('focusout', onFocusOut);
            document.removeEventListener('pointerdown', onPointerDown, true);
            document.removeEventListener('pointerup', onPointerUp, true);
            document.removeEventListener('pointercancel', onPointerUp, true);
            observer?.disconnect();
            window.removeEventListener('resize', sync);
            if (paddingOwner === bar) {
                paddingOwner = null;
                document.documentElement.style.scrollPaddingBottom = '';
            }
        };
    }, []);

    useEffect(() => {
        if (ref.current) syncScrollPadding(ref.current);
    }, [typing]);

    return { ref, 'data-typing': typing ? '' : undefined };
}
