import * as React from 'react'
import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'

export function TokenSettings() {
  const [token, setToken] = React.useState(() => localStorage.getItem('auth_token') ?? '')
  const [open, setOpen] = React.useState(false)

  function handleSave() {
    const trimmed = token.trim()
    if (trimmed) {
      localStorage.setItem('auth_token', trimmed)
    } else {
      localStorage.removeItem('auth_token')
    }
    toast({ title: 'Token saved', variant: 'success' })
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" title="API Token Settings">
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>API Token</SheetTitle>
          <SheetDescription>
            Paste your JWT Bearer token below. It will be stored in localStorage and sent with every
            API request.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token-input">Bearer Token</Label>
            <Textarea
              id="token-input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your JWT token here..."
              className="font-mono text-xs min-h-[160px]"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">
              Save Token
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setToken('')
                localStorage.removeItem('auth_token')
                toast({ title: 'Token cleared' })
              }}
            >
              Clear
            </Button>
          </div>
          {localStorage.getItem('auth_token') && (
            <p className="text-xs text-muted-foreground">
              Token is currently set ({localStorage.getItem('auth_token')!.length} chars).
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
