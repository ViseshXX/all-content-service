import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-start gap-3 rounded-lg border p-4 shadow-lg animate-in slide-in-from-right-full',
            t.variant === 'destructive' && 'border-destructive bg-destructive text-destructive-foreground',
            t.variant === 'success' && 'border-green-500 bg-green-50 text-green-900',
            t.variant === 'default' && 'bg-background text-foreground'
          )}
        >
          <div className="flex-1 text-sm">
            {t.title && <p className="font-semibold">{t.title}</p>}
            {t.description && <p className="mt-0.5 text-muted-foreground">{t.description}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
