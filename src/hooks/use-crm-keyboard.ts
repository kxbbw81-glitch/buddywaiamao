'use client'

import { useEffect } from 'react'
import { useCRMStore } from '@/store/use-crm-store'
import type { ModuleKey } from '@/lib/types'

const INPUT_TAGNAMES = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

const MODULE_SHORTCUTS: Record<string, ModuleKey> = {
  '1': 'workbench',
  '2': 'acquisition',
  '3': 'customer',
  '4': 'pipeline',
  '5': 'comms',
  '6': 'product',
  '7': 'quote',
  '8': 'fulfillment',
  '9': 'finance',
}

export function useCRMKeyboard() {
  const currentUser = useCRMStore((s) => s.currentUser)
  const {
    setCurrentModule,
    selectCustomer,
    selectInquiry,
    selectQuotation,
    selectOrder,
    selectProduct,
    selectSample,
    closeCustomerForm,
    closeInquiryForm,
    closeQuotationForm,
    closeOrderForm,
    closeProductForm,
    setAiDrawerOpen,
  } = useCRMStore()

  useEffect(() => {
    // Only active when a user is logged in
    if (!currentUser) return

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const tagName = target.tagName

      // Don't trigger when typing in input elements
      if (INPUT_TAGNAMES.has(tagName)) {
        return
      }

      // Don't trigger when a contenteditable element is focused
      if (target.isContentEditable) {
        return
      }

      // Don't trigger when a dialog/sheet is open
      const dialogEl = document.querySelector('[role="dialog"]')
      if (dialogEl) {
        return
      }

      // Escape: close any open drawer/sheet/dialog
      if (e.key === 'Escape') {
        selectCustomer(null)
        selectInquiry(null)
        selectQuotation(null)
        selectOrder(null)
        selectProduct(null)
        selectSample(null)
        closeCustomerForm()
        closeInquiryForm()
        closeQuotationForm()
        closeOrderForm()
        closeProductForm()
        setAiDrawerOpen(false)
        return
      }

      // k or Cmd/Ctrl+K: open global search
      if (e.key === 'k') {
        if (e.metaKey || e.ctrlKey) {
          // Cmd+K / Ctrl+K is handled by GlobalSearchDialog already
          return
        }
        // Plain 'k' when no input is focused: open search
        e.preventDefault()
        // Dispatch a synthetic Cmd+K to trigger the GlobalSearchDialog
        const syntheticEvent = new KeyboardEvent('keydown', {
          key: 'k',
          metaKey: true,
          ctrlKey: false,
          bubbles: true,
        })
        target.dispatchEvent(syntheticEvent)
        return
      }

      // 1-9: switch sidebar modules
      if (e.key >= '1' && e.key <= '9') {
        const targetModule = MODULE_SHORTCUTS[e.key]
        if (targetModule) {
          setCurrentModule(targetModule)
          return
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    setCurrentModule,
    selectCustomer,
    selectInquiry,
    selectQuotation,
    selectOrder,
    selectProduct,
    selectSample,
    closeCustomerForm,
    closeInquiryForm,
    closeQuotationForm,
    closeOrderForm,
    closeProductForm,
    setAiDrawerOpen,
    currentUser,
  ])
}
