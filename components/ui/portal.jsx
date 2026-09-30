"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

/**
 * Portal component that renders children directly into document.body.
 * Guarantees modal overlays cover 100% of the viewport (top to bottom, left to right)
 * without being trapped, clipped, or offset by parent scroll containers or transforms.
 * Also handles body scroll locking seamlessly with nested modal support.
 */
export default function Portal({ children }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const currentCount = parseInt(document.body.getAttribute("data-modal-count") || "0", 10)
    document.body.setAttribute("data-modal-count", String(currentCount + 1))
    if (currentCount === 0) {
      document.body.style.overflow = "hidden"
    }

    return () => {
      setMounted(false)
      const newCount = Math.max(0, parseInt(document.body.getAttribute("data-modal-count") || "1", 10) - 1)
      if (newCount === 0) {
        document.body.removeAttribute("data-modal-count")
        document.body.style.overflow = ""
      } else {
        document.body.setAttribute("data-modal-count", String(newCount))
      }
    }
  }, [])

  if (!mounted || typeof document === "undefined") {
    return null
  }

  return createPortal(children, document.body)
}
