"use client"

import * as React from "react"

/**
 * Base UI (1.x) traps focus in a modal dialog with focus-guard elements that
 * move focus back inside on the *next animation frame*, and only marks the
 * page behind the dialog with `aria-hidden` (plus `data-base-ui-inert`).
 * A Tab pressed before that frame runs moves focus from the guard to real
 * page controls behind the dialog. This happens reliably with rapid or held
 * Tab in WebKit, and with sub-frame key presses in Chromium. Base UI has no
 * option to make that background `inert`, so this hook adds `inert` to
 * exactly the elements Base UI hid for the open modal, and releases them as
 * soon as the popup starts closing. Focus still returns to the opener after
 * the popup unmounts. Base UI's own trap, Escape, outside press, and focus
 * return are unchanged.
 */

const HIDDEN_BY_MODAL = '[data-base-ui-inert][aria-hidden="true"]'

// Shared across dialogs so overlapping or nested modals never remove `inert`
// that another open dialog still needs.
const inertHolds = new Map<Element, number>()

function acquire(element: Element): boolean {
  const holds = inertHolds.get(element) ?? 0
  if (holds === 0) {
    // Never take over `inert` that the app set itself.
    if (element.hasAttribute("inert")) return false
    element.setAttribute("inert", "")
  }
  inertHolds.set(element, holds + 1)
  return true
}

function release(element: Element) {
  const holds = inertHolds.get(element) ?? 0
  if (holds <= 1) {
    inertHolds.delete(element)
    element.removeAttribute("inert")
  } else {
    inertHolds.set(element, holds - 1)
  }
}

export function useInertModalBackground(popup: HTMLElement | null) {
  React.useEffect(() => {
    if (!popup || typeof MutationObserver === "undefined") return undefined

    const doc = popup.ownerDocument
    const held = new Set<Element>()

    const releaseAll = () => {
      held.forEach(release)
      held.clear()
    }

    const sync = () => {
      // Base UI removes `data-open` when the popup starts closing.
      if (!popup.isConnected || !popup.hasAttribute("data-open")) {
        releaseAll()
        return
      }
      held.forEach((element) => {
        if (!element.matches(HIDDEN_BY_MODAL)) {
          held.delete(element)
          release(element)
        }
      })
      doc.querySelectorAll(HIDDEN_BY_MODAL).forEach((element) => {
        // A nested popup can hide this dialog's own portal; leave that to the
        // nested popup's hook.
        if (held.has(element) || element.contains(popup)) return
        if (acquire(element)) held.add(element)
      })
    }

    const observer = new MutationObserver(sync)
    observer.observe(doc.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden", "data-base-ui-inert", "data-open"],
    })
    sync()

    return () => {
      observer.disconnect()
      releaseAll()
    }
  }, [popup])
}
