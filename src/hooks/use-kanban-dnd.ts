'use client'

import { useState, useCallback, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'

export interface KanbanColumn {
  key: string
  ids: string[]
}

export interface UseKanbanDndOptions {
  columns: KanbanColumn[]
  onDrop: (itemId: string, columnKey: string) => Promise<void>
}

export function useKanbanDnd({ columns, onDrop }: UseKanbanDndOptions) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [activeColumnKey, setActiveColumnKey] = useState<string | null>(null)
  const [overColumnKey, setOverColumnKey] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const previousColumnRef = useRef<string | null>(null)

  // Build a map: id -> columnKey for quick lookup
  const idToColumn = useCallback(() => {
    const map = new Map<string, string>()
    for (const col of columns) {
      for (const id of col.ids) {
        map.set(id, col.key)
      }
    }
    return map
  }, [columns])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id)
    setActiveId(id)
    setIsDragging(true)
    const col = idToColumn().get(id) || null
    setActiveColumnKey(col)
    previousColumnRef.current = col
    setOverColumnKey(col)
  }, [idToColumn])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id ? String(event.over.id) : null
    setOverId(overId)

    if (overId) {
      // Check if overId is a column droppable or an item
      const overCol = idToColumn().get(overId)
      if (overCol) {
        setOverColumnKey(overCol)
      } else {
        // overId might be a column key itself (droppable column container)
        const foundColumn = columns.find(c => c.key === overId)
        setOverColumnKey(foundColumn ? foundColumn.key : null)
      }
    } else {
      setOverColumnKey(null)
    }
  }, [idToColumn, columns])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    const itemId = String(active.id)

    let targetColumnKey: string | null = null

    if (over) {
      const overStr = String(over.id)
      // Check if dropped on an item
      const overCol = idToColumn().get(overStr)
      if (overCol) {
        targetColumnKey = overCol
      } else {
        // Check if dropped on a column droppable
        const foundColumn = columns.find(c => c.key === overStr)
        if (foundColumn) {
          targetColumnKey = foundColumn.key
        }
      }
    }

    const sourceColumn = previousColumnRef.current

    // Reset visual state
    setActiveId(null)
    setOverId(null)
    setActiveColumnKey(null)
    setOverColumnKey(null)
    setIsDragging(false)
    previousColumnRef.current = null

    // Only call API if dropped on a different column
    if (targetColumnKey && sourceColumn && targetColumnKey !== sourceColumn) {
      try {
        await onDrop(itemId, targetColumnKey)
      } catch {
        toast.error('操作失败，请重试')
      }
    }
  }, [idToColumn, columns, onDrop])

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setOverId(null)
    setActiveColumnKey(null)
    setOverColumnKey(null)
    setIsDragging(false)
    previousColumnRef.current = null
  }, [])

  return {
    sensors,
    activeId,
    overId,
    activeColumnKey,
    overColumnKey,
    isDragging,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    idToColumn,
  }
}

// Re-export DndContext, SortableContext, DragOverlay for convenience
export { DndContext, SortableContext, DragOverlay, closestCenter, verticalListSortingStrategy }

// Re-export useSortable
export { useSortable, CSS }

/**
 * Wrap a card component with sortable behavior.
 * Usage: const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortableCard(id)
 */
export function useSortableCard(id: string) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
  }

  return { attributes, listeners, setNodeRef, style, isDragging, transform, transition }
}

/**
 * Get column highlight class based on drag state.
 */
export function getColumnHighlightClass(
  columnKey: string,
  activeColumnKey: string | null,
  overColumnKey: string | null,
  isDragging: boolean
): string {
  if (!isDragging) return ''
  if (overColumnKey === columnKey && activeColumnKey !== columnKey) {
    return 'ring-2 ring-emerald-400/50 bg-emerald-50/30 dark:bg-emerald-950/20'
  }
  return ''
}

/**
 * Get the CSS classes for the drag overlay card.
 */
export function getDragOverlayStyle(): React.CSSProperties {
  return {
    transform: 'scale(1.05)',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
  border: '2px dashed #10b981',
    borderRadius: '0.5rem',
  }
}

/**
 * Get the emerald indicator line class for a column being dragged over.
 */
export function getColumnIndicatorClass(
  columnKey: string,
  overColumnKey: string | null,
  activeColumnKey: string | null,
  isDragging: boolean
): string {
  if (!isDragging) return ''
  if (overColumnKey === columnKey && activeColumnKey !== columnKey) {
    return 'relative before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-emerald-500 before:rounded-t-xl before:z-10'
  }
  return ''
}

/**
 * Get the emerald insertion indicator line class for an item being hovered over.
 */
export function getInsertionIndicatorClass(
  itemId: string,
  overId: string | null,
  activeId: string | null,
  isDragging: boolean
): string {
  if (!isDragging || !overId || !activeId || itemId === activeId) return ''
  if (itemId === overId) {
    return 'relative after:absolute after:left-0 after:right-0 after:bottom-0 after:h-0.5 after:bg-emerald-500 after:rounded-full after:z-10'
  }
  return ''
}
