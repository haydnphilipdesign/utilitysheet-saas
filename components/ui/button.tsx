import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-md border border-transparent bg-clip-padding text-sm sm:text-xs/relaxed font-medium focus-visible:ring-[2px] aria-invalid:ring-[2px] [&_svg:not([class*='size-'])]:size-4 inline-flex items-center justify-center whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none group/button select-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline: "border-border dark:bg-input/30 hover:bg-input/50 hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost: "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive: "bg-destructive/10 hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/20 text-destructive focus-visible:border-destructive/40 dark:hover:bg-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 sm:h-8 gap-2 sm:gap-1 px-4 sm:px-2.5 text-sm sm:text-xs/relaxed has-data-[icon=inline-end]:pr-3 sm:has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-3 sm:has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5",
        xs: "h-9 sm:h-6 gap-1 rounded-sm px-2 text-xs sm:text-[0.625rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3 sm:[&_svg:not([class*='size-'])]:size-2.5",
        sm: "h-10 sm:h-7 gap-1.5 sm:gap-1 px-3 sm:px-2 text-sm sm:text-xs/relaxed has-data-[icon=inline-end]:pr-2 sm:has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-2 sm:has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5 sm:[&_svg:not([class*='size-'])]:size-3",
        lg: "h-12 sm:h-9 gap-2 sm:gap-1 px-5 sm:px-3 text-base sm:text-sm has-data-[icon=inline-end]:pr-4 sm:has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-4 sm:has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-4",
        icon: "size-11 sm:size-8 [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5",
        "icon-xs": "size-8 sm:size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3 sm:[&_svg:not([class*='size-'])]:size-2.5",
        "icon-sm": "size-9 sm:size-7 [&_svg:not([class*='size-'])]:size-3.5 sm:[&_svg:not([class*='size-'])]:size-3",
        "icon-lg": "size-12 sm:size-9 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
