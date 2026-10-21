import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "rounded-full border border-foreground/15 bg-foreground/10 text-foreground [a]:hover:bg-foreground/15",
        secondary:
          "rounded-full border border-border bg-muted text-muted-foreground [a]:hover:bg-muted/80",
        destructive:
          "rounded-full border border-danger/30 bg-danger/15 text-danger focus-visible:ring-red-500/20 [a]:hover:bg-danger/20",
        outline:
          "rounded-full border-border text-muted-foreground [a]:hover:bg-muted [a]:hover:text-foreground",
        ghost:
          "rounded-full hover:bg-muted hover:text-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
        success:
          "rounded-full border border-success/30 bg-success/15 text-success [a]:hover:bg-success/20",
        warning:
          "rounded-full border border-warning/30 bg-warning/15 text-warning [a]:hover:bg-warning/20",
        completed:
          "rounded-full border border-foreground/20 bg-foreground/10 text-foreground [a]:hover:bg-foreground/15",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
