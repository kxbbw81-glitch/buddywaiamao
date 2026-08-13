'use client'

import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in-up">
      {icon && <div className="mb-4 text-muted-foreground/30">{icon}</div>}
      <h3 className="text-lg font-medium text-muted-foreground mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground/70 text-center max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-4" size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
