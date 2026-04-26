import { useEffect } from 'react'

function isTypingTarget(el) {
  const t = el?.tagName?.toLowerCase?.() || ''
  return t === 'input' || t === 'textarea' || el?.isContentEditable
}

export function useKeyboardShortcuts(actions = {}) {
  useEffect(() => {
    const onKeyDown = (e) => {
      const key = String(e.key || '')
      const meta = e.metaKey || e.ctrlKey

      if (key === 'Escape') actions.onEsc?.()

      if (isTypingTarget(e.target) && !(meta && (key.toLowerCase() === 'k' || key.toLowerCase() === 'n'))) return

      if (key === '/' && !meta) {
        e.preventDefault()
        actions.onFocusSearch?.()
      }

      if (meta && key.toLowerCase() === 'k') {
        e.preventDefault()
        actions.onQuickSwitcher?.()
      }

      if (meta && key.toLowerCase() === 'n') {
        e.preventDefault()
        actions.onNewChat?.()
      }

      if (key === ' ' || key === 'Spacebar') actions.onSpace?.()
      if (key.toLowerCase() === 'd') actions.onDecline?.()
      if (key.toLowerCase() === 'm') actions.onToggleMute?.()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [actions])
}

