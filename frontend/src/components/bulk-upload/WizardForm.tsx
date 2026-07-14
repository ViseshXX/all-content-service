import * as React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Download, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { TagInput } from '@/components/shared/TagInput'
import { useCollections } from '@/hooks/useCollections'
import { downloadExcelTemplate } from '@/lib/excel-service'
import type { WizardConfig, TemplateType, Language } from '@/types'

const TEMPLATE_TYPES: TemplateType[] = [
  'M1 to M2 Read Along Content',
  'M3 Read Along Content',
  'M4 to M6 Read Along Content',
  'M7 to M9 Read Along Content',
  'Textbook image mechanic',
  'M1 Mechanics Content',
  'M2 Mechanics Content',
  'M3 Mechanics Content',
  'M4 to M6 Mechanics Content',
  'M7 to M9 Mechanics Content',
  'M10 to M15 Mechanics Content',
  'Collection',
  'Multilingual',
]

const LANGUAGES: Language[] = ['en', 'hi', 'ta', 'te', 'kn', 'gu', 'ma']

const SUPPORTED_LANG_CODES = new Set(['en', 'hi', 'ta', 'te', 'kn', 'gu', 'ma'])

// No template shows the translation field — language columns are auto-included in the Excel
const TRANSLATION_TEMPLATES = new Set<TemplateType>([])

function showTranslationField(templateType: TemplateType, language: string): boolean {
  return language === 'en' && TRANSLATION_TEMPLATES.has(templateType)
}

const AUTO_VALUE = 'AUTO'

/** Returns true when the collectionId requires creating a new collection. */
function isCreatingCollection(collectionId: string): boolean {
  return collectionId === AUTO_VALUE || collectionId.startsWith('NEW:')
}

const wizardSchema = z.object({
  templateType: z.enum([
    'M1 to M2 Read Along Content',
    'M3 Read Along Content',
    'M4 to M6 Read Along Content',
    'M7 to M9 Read Along Content',
    'Textbook image mechanic',
    'M1 Mechanics Content',
    'M2 Mechanics Content',
    'M3 Mechanics Content',
    'M4 to M6 Mechanics Content',
    'M7 to M9 Mechanics Content',
    'M10 to M15 Mechanics Content',
    'Collection',
    'Multilingual',
  ]),
  language: z.enum(['en', 'hi', 'ta', 'te', 'kn', 'gu', 'ma']),
  target_lang_code: z.string(),
  action: z.literal('CREATE'),
  collectionId: z.string()
    .min(1, 'Collection is required')
    .refine(
      (v) => !(v.startsWith('NEW:') && v.trim() === 'NEW:'),
      'Collection name cannot be empty',
    ),
  status: z.enum(['live', 'draft']),
  tags: z.array(z.string()),
  publisher: z.string(),
}).superRefine((data, ctx) => {
  if (!showTranslationField(data.templateType, data.language)) return

  const codes = data.target_lang_code
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  if (data.templateType === 'Multilingual' && codes.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one target language code is required for Multilingual templates',
      path: ['target_lang_code'],
    })
    return
  }

  const invalid = codes.filter((c) => !SUPPORTED_LANG_CODES.has(c))
  if (invalid.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Unsupported language code(s): ${invalid.join(', ')}. Supported: ${[...SUPPORTED_LANG_CODES].join(', ')}`,
      path: ['target_lang_code'],
    })
  }
})

type WizardFormValues = z.infer<typeof wizardSchema>

// ─────────────────────────────────────────────────────────────────────────────
// COLLECTION COMBOBOX
// Supports three modes encoded in `value`:
//   'AUTO'        → auto-generate (name from xlsx filename or template+language)
//   'NEW:<name>'  → create new collection with user-typed name
//   '<uuid>'      → use existing collection, no creation
// ─────────────────────────────────────────────────────────────────────────────

interface Collection {
  collectionId: string
  name: string
}

interface CollectionComboboxProps {
  collections: Collection[]
  value: string
  onChange: (v: string) => void
  error?: string
}

function CollectionCombobox({ collections, value, onChange, error }: CollectionComboboxProps) {
  const [inputText, setInputText] = React.useState('')
  const [isOpen, setIsOpen]       = React.useState(false)
  const containerRef              = React.useRef<HTMLDivElement>(null)

  // Sync display text whenever the controlled value changes
  React.useEffect(() => {
    if (value === AUTO_VALUE) {
      setInputText('')
    } else if (value.startsWith('NEW:')) {
      setInputText(value.slice(4))
    } else {
      const found = collections.find((c) => c.collectionId === value)
      setInputText(found?.name ?? '')
    }
  }, [value, collections])

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const filtered = collections.filter((c) =>
    c.name.toLowerCase().includes(inputText.toLowerCase()),
  )

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value
    setInputText(text)
    setIsOpen(true)
    onChange(text.trim() ? `NEW:${text.trim()}` : AUTO_VALUE)
  }

  function handleSelectAuto() {
    setInputText('')
    onChange(AUTO_VALUE)
    setIsOpen(false)
  }

  function handleSelectExisting(c: Collection) {
    setInputText(c.name)
    onChange(c.collectionId)
    setIsOpen(false)
  }

  const isExisting = value !== AUTO_VALUE && !value.startsWith('NEW:') && value.length > 0

  const hint = isExisting
    ? 'Content will be added to this existing collection.'
    : value.startsWith('NEW:')
    ? `New collection "${value.slice(4)}" will be created.`
    : 'A collection will be auto-generated using the Excel filename.'

  return (
    // containerRef wraps everything so outside-click closes the dropdown
    // without treating the hint text as "outside"
    <div ref={containerRef} className="relative">
      <Input
        value={inputText}
        placeholder="— Auto-generate —"
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        className={error ? 'border-destructive' : ''}
      />

      {isOpen && (
        // top-full + explicit white bg prevents transparency bleed.
        // shadow-lg + border give the dropdown clear visual separation.
        <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border border-border bg-white dark:bg-gray-950 shadow-lg overflow-hidden">
          {/* Auto-generate — visually separated at the top */}
          <button
            type="button"
            className="w-full text-left px-3 py-2.5 text-sm italic text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer border-b border-border"
            onMouseDown={handleSelectAuto}
          >
            — Auto-generate —
          </button>

          {/* Scrollable list of existing collections */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.collectionId}
                type="button"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                onMouseDown={() => handleSelectExisting(c)}
              >
                {c.name}
              </button>
            ))}

            {inputText.trim() && filtered.length === 0 && (
              <p className="px-3 py-2.5 text-sm text-muted-foreground italic">
                No match — "{inputText.trim()}" will be used as the new collection name.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Hint and error sit in normal flow below the input, never overlap the dropdown */}
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WIZARD FORM
// ─────────────────────────────────────────────────────────────────────────────

interface WizardFormProps {
  onSubmit: (config: WizardConfig) => void
}

export function WizardForm({ onSubmit }: WizardFormProps) {
  const { data: collections = [] } = useCollections()
  const [isDownloading, setIsDownloading] = React.useState(false)

  const {
    control,
    handleSubmit,
    getValues,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      templateType: 'M1 to M2 Read Along Content',
      language: 'en',
      target_lang_code: '',
      action: 'CREATE',
      collectionId: AUTO_VALUE,
      status: 'live',
      tags: [],
      publisher: 'ekstep',
    },
  })

  const watchedTemplate     = watch('templateType')
  const watchedLang         = watch('language')
  const watchedTargetCodes  = watch('target_lang_code')
  const watchedCollectionId = watch('collectionId')

  const isTranslationVisible = showTranslationField(watchedTemplate, watchedLang)

  // Collection and Multilingual templates are top-level documents — they have no
  // parent collection and the collection field is irrelevant for them.
  const isCollectionOrMultilingual =
    watchedTemplate === 'Collection' || watchedTemplate === 'Multilingual'

  // Tags are only relevant when the wizard will create a new collection
  const showTags = !isCollectionOrMultilingual && isCreatingCollection(watchedCollectionId)

  React.useEffect(() => {
    trigger('target_lang_code')
  }, [watchedTemplate, watchedLang, trigger])

  const previewCodes = watchedTargetCodes
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const previewText = isTranslationVisible && previewCodes.length > 0
    ? watchedTemplate === 'Multilingual'
      ? `Preview: columns for ${previewCodes.join(', ')} (e.g. hindi_text, hindi_audio, hindi_image)`
      : `Preview: columns like 'multilingual ${previewCodes[0]} text', 'multilingual ${previewCodes[0]} audio'`
    : null

  async function handleDownloadTemplate() {
    const values = getValues()
    setIsDownloading(true)
    try {
      await downloadExcelTemplate({
        templateType: values.templateType,
        language: values.language,
        targetLanguages: isTranslationVisible ? values.target_lang_code : '',
      })
    } finally {
      setIsDownloading(false)
    }
  }

  function handleFormSubmit(data: WizardFormValues) {
    onSubmit({
      ...data,
      target_lang_code: isTranslationVisible ? data.target_lang_code : '',
    })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Template & Language */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Template Type *</Label>
              <Controller
                control={control}
                name="templateType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <Label>Language *</Label>
              <Controller
                control={control}
                name="language"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Multilingual translation columns */}
          {isTranslationVisible && (
            <div className="p-4 rounded-lg border border-border bg-muted/50 space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Multilingual Content Support</span>
              </div>
              <div className="space-y-1">
                <Label>
                  {watchedTemplate === 'Multilingual'
                    ? 'Target Language Codes *'
                    : 'Add Translation Columns (Optional)'}
                </Label>
                <Input
                  placeholder="e.g. kn, hi"
                  value={watchedTargetCodes}
                  onChange={(e) => {
                    const sanitized = e.target.value.replace(/\s+/g, '').toLowerCase()
                    setValue('target_lang_code', sanitized, { shouldValidate: true })
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Enter comma-separated codes. Supported: en, hi, ta, te, kn, gu, ma.
                </p>
                {previewText && (
                  <p className="text-xs text-muted-foreground italic">{previewText}</p>
                )}
                {errors.target_lang_code && (
                  <p className="text-xs text-destructive">{errors.target_lang_code.message}</p>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Collection */}
          {!isCollectionOrMultilingual && (
            <div className="space-y-1">
              <Label>Collection *</Label>
              <Controller
                control={control}
                name="collectionId"
                render={({ field }) => (
                  <CollectionCombobox
                    collections={collections}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.collectionId?.message}
                  />
                )}
              />
            </div>
          )}

          {/* Tags — only shown when a new collection will be created */}
          {showTags && (
            <div className="space-y-1">
              <Label>Collection Tags</Label>
              <Controller
                control={control}
                name="tags"
                render={({ field }) => (
                  <TagInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Add tag and press Enter"
                  />
                )}
              />
              <p className="text-xs text-muted-foreground">
                These tags are added to the new collection. Individual content tags
                should be set directly inside the Excel file.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isDownloading}
              onClick={handleDownloadTemplate}
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? 'Generating...' : 'Download Template'}
            </Button>
            <Button type="submit">Continue to Upload</Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
