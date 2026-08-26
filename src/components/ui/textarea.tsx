import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Flat design — matches Input: gray field, hard 2px focus border.
        "placeholder:text-muted-foreground aria-invalid:border-destructive dark:bg-input/30 dark:focus-visible:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border-2 border-transparent bg-muted px-3 py-2 text-base outline-none transition-colors focus-visible:border-primary focus-visible:bg-card disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
