import { ChevronRight } from 'lucide-react'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'

function Breadcrumb({ className, ...props }) {
  return <nav data-slot="breadcrumb" aria-label="Breadcrumb" className={cn(className)} {...props} />
}

function BreadcrumbList({ className, ...props }) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn('flex min-w-0 flex-nowrap items-center justify-center gap-1.5', className)}
      {...props}
    />
  )
}

function BreadcrumbItem({ className, ...props }) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn('inline-flex min-w-0 items-center gap-1.5', className)}
      {...props}
    />
  )
}

function BreadcrumbLink({ asChild = false, className, ...props }) {
  const Comp = asChild ? Slot.Root : 'a'

  return <Comp data-slot="breadcrumb-link" className={cn(className)} {...props} />
}

function BreadcrumbPage({ className, ...props }) {
  return (
    <span
      data-slot="breadcrumb-page"
      aria-current="page"
      className={cn('inline-flex min-w-0 items-center', className)}
      {...props}
    />
  )
}

function BreadcrumbSeparator({ children, className, ...props }) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn('inline-flex items-center justify-center', className)}
      {...props}
    >
      {children ?? <ChevronRight className="size-3" />}
    </li>
  )
}

function BreadcrumbEllipsis({ className, ...props }) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn('inline-flex h-5 w-5 items-center justify-center text-muted-foreground', className)}
      {...props}
    >
      <span className="text-sm leading-none">...</span>
    </span>
  )
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}