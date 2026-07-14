import * as React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TagInput } from '@/components/shared/TagInput'
import { MCQPreviewModal } from './MCQPreviewModal'
import { Eye } from 'lucide-react'
import { CollectionPickerField } from '@/components/shared/CollectionPickerField'
import { FileUploadField } from './FileUploadField'
import { useCreateContentWithAssets } from '@/hooks/useContent'
import { toast } from '@/hooks/use-toast'

// ─────────────────────────────────────────────────────────────────────────────

export type MechanicsTemplateType =
  | 'M1 Mechanics Content'
  | 'M2 Mechanics Content'
  | 'M3 Mechanics Content'
  | 'M4 to M6 Mechanics Content'
  | 'M10 to M15 Mechanics Content'

const ML_LANGUAGES = [
  { code: 'kn', label: 'Kannada' },
  { code: 'te', label: 'Telugu' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'ma', label: 'Marathi' },
] as const

const INDIC_REGEX = /[\u0900-\u0DFF\u1C80-\u1CFF\uA830-\uA83F]/

const SCRIPT_REGEX: Record<string, RegExp> = {
  hi: /[\u0900-\u097F]/,
  ma: /[\u0900-\u097F]/,
  ta: /[\u0B80-\u0BFF]/,
  te: /[\u0C00-\u0C7F]/,
  kn: /[\u0C80-\u0CFF]/,
  gu: /[\u0A80-\u0AFF]/,
}

// ─────────────────────────────────────────────────────────────────────────────

interface MlEntry { text: string; file: File | null }

interface FormValues {
  name: string
  contentType: string
  language: string
  status: string
  collectionId: string
  tags: string[]
  text: string
  multilingual_words: string
  // M1
  syllable_1_text: string
  syllable_2_text: string
  syllable_3_text: string
  // M2
  mech_word_1: string
  mech_word_2: string
  mech_word_3: string
  mech_word_4: string
  mech_word_5: string
  // M3
  mech_correct_text: string
  mech_option_1_text: string
  mech_option_2_text: string
  mech_option_3_text: string
  // M4-M9 Fill in the Blanks
  mech_fill_complete: string
  mech_fill_text: string
  mech_fill_correct: string
  mech_fill_option_1: string
  mech_fill_option_2: string
  mech_fill_option_3: string
  mech_fill_time: string
  // M4-M9 MCQ
  mech_mcq_question: string
  mech_mcq_correct: string
  mech_mcq_option_1: string
  mech_mcq_option_2: string
  mech_mcq_option_3: string
  mech_mcq_time: string
  // M10-M15
  mech_mechanics_id: string
  mech_content_body: string
}

interface Props {
  templateType: MechanicsTemplateType
}

// ─────────────────────────────────────────────────────────────────────────────

export function MechanicsContentForm({ templateType }: Props) {
  const navigate        = useNavigate()
  const createMutation  = useCreateContentWithAssets()

  // ── Template flags ─────────────────────────────────────────────────────────
  const isM1    = templateType === 'M1 Mechanics Content'
  const isM2    = templateType === 'M2 Mechanics Content'
  const isM3    = templateType === 'M3 Mechanics Content'
  const isM4M9  = templateType === 'M4 to M6 Mechanics Content'
  const isM10   = templateType === 'M10 to M15 Mechanics Content'

  // ── File state ────────────────────────────────────────────────────────────
  const [audioFile, setAudioFile] = React.useState<File | null>(null)
  const [imageFile, setImageFile] = React.useState<File | null>(null)

  // M1
  const [mechImage,      setMechImage]      = React.useState<File | null>(null)
  const [syllableAudios, setSyllableAudios] = React.useState<[File|null,File|null,File|null]>([null,null,null])

  // M2
  const [mechImages, setMechImages] = React.useState<[File|null,File|null,File|null,File|null,File|null]>([null,null,null,null,null])
  const [mechAudios, setMechAudios] = React.useState<[File|null,File|null,File|null,File|null,File|null]>([null,null,null,null,null])

  // M3
  const [mechCorrectImage,  setMechCorrectImage]  = React.useState<File | null>(null)
  const [mechOptionImages,  setMechOptionImages]  = React.useState<[File|null,File|null,File|null]>([null,null,null])

  // M4-M9
  const [mechFillAudio,         setMechFillAudio]         = React.useState<File | null>(null)
  const [mechFillImage,         setMechFillImage]         = React.useState<File | null>(null)
  const [mechMcqAudio,          setMechMcqAudio]          = React.useState<File | null>(null)
  const [mechMcqImage,          setMechMcqImage]          = React.useState<File | null>(null)
  const [mechMcqCorrectAudio,   setMechMcqCorrectAudio]   = React.useState<File | null>(null)
  const [mechMcqOptionAudios,   setMechMcqOptionAudios]   = React.useState<[File|null,File|null,File|null]>([null,null,null])

  // Inline multilingual (M1-M3, English only)
  const [mlEntries, setMlEntries] = React.useState<Record<string, MlEntry>>(
    () => Object.fromEntries(ML_LANGUAGES.map(({ code }) => [code, { text: '', file: null }])),
  )

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      name: '', contentType: 'Word', language: 'en', status: 'live',
      collectionId: '', tags: [], text: '', multilingual_words: '',
      syllable_1_text: '', syllable_2_text: '', syllable_3_text: '',
      mech_word_1: '', mech_word_2: '', mech_word_3: '', mech_word_4: '', mech_word_5: '',
      mech_correct_text: '', mech_option_1_text: '', mech_option_2_text: '', mech_option_3_text: '',
      mech_fill_complete: '', mech_fill_text: '', mech_fill_correct: '',
      mech_fill_option_1: '', mech_fill_option_2: '', mech_fill_option_3: '', mech_fill_time: '90',
      mech_mcq_question: '', mech_mcq_correct: '',
      mech_mcq_option_1: '', mech_mcq_option_2: '', mech_mcq_option_3: '', mech_mcq_time: '90',
      mech_mechanics_id: '', mech_content_body: '',
    },
  })

  const language = watch('language')
  const showInlineML = (isM1 || isM2 || isM3) && language === 'en'
  const showMLWords  = (isM4M9 || isM10) && language === 'en'

  // Watch fill / MCQ trigger fields to show required markers reactively
  const fillCompleteVal = watch('mech_fill_complete')
  const fillTextVal     = watch('mech_fill_text')
  const mcqQuestionVal  = watch('mech_mcq_question')
  const fillActive = isM4M9 && !!(fillCompleteVal?.trim() || fillTextVal?.trim())
  const mcqActive  = isM4M9 && !!mcqQuestionVal?.trim()

  // MCQ preview state
  const [mcqPreviewOpen, setMcqPreviewOpen] = React.useState(false)
  const [mcqImageBlobUrl, setMcqImageBlobUrl] = React.useState<string>('')

  // Revoke blob URL when it changes or component unmounts
  React.useEffect(() => {
    return () => { if (mcqImageBlobUrl) URL.revokeObjectURL(mcqImageBlobUrl) }
  }, [mcqImageBlobUrl])

  function openMcqPreview() {
    if (mcqImageBlobUrl) URL.revokeObjectURL(mcqImageBlobUrl)
    setMcqImageBlobUrl(mechMcqImage ? URL.createObjectURL(mechMcqImage) : '')
    setMcqPreviewOpen(true)
  }

  const mcqPreviewContent = {
    _id: 'preview', contentId: 'preview', name: 'Preview',
    contentType: watch('contentType') as any,
    language: watch('language') as any,
    status: 'draft' as const,
    tags: [] as string[],
    contentSourceData: [] as any[],
    mechanics_data: [{
      mechanics_id: 'mechanic_2',
      language: watch('language') as any,
      text: mcqQuestionVal ?? '',
      image_url: mcqImageBlobUrl || undefined,
      options: [
        { text: watch('mech_mcq_option_1') || '', isAns: watch('mech_mcq_correct') === watch('mech_mcq_option_1') },
        { text: watch('mech_mcq_option_2') || '', isAns: watch('mech_mcq_correct') === watch('mech_mcq_option_2') },
        ...(watch('mech_mcq_option_3')?.trim() ? [{ text: watch('mech_mcq_option_3'), isAns: watch('mech_mcq_correct') === watch('mech_mcq_option_3') }] : []),
      ].filter((o) => o.text.trim()),
    }],
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function onSubmit(values: FormValues) {
    const textTrimmed = values.text.trim()

    // Unicode / script validation
    if (values.language === 'en' && INDIC_REGEX.test(textTrimmed)) {
      toast({ title: 'Script mismatch', description: "Language is 'English' but text contains Indic characters.", variant: 'destructive' })
      return
    }
    if (values.language !== 'en' && !INDIC_REGEX.test(textTrimmed)) {
      toast({ title: 'Script mismatch', description: `Language is '${values.language}' but text contains no Indic characters.`, variant: 'destructive' })
      return
    }

    if (values.tags.length === 0) {
      toast({ title: 'Tags required', description: 'Please add at least one tag.', variant: 'destructive' })
      return
    }

    // ── M1 validation ────────────────────────────────────────────────────────
    if (isM1) {
      if (!mechImage) {
        toast({ title: 'Image required', description: 'Mechanic image is required for M1.', variant: 'destructive' })
        return
      }
      if (!values.syllable_1_text.trim()) {
        toast({ title: 'Syllable required', description: 'At least one syllable text is required.', variant: 'destructive' })
        return
      }
      // Sequential: can't have syllable 3 without syllable 2
      if (!values.syllable_2_text.trim() && values.syllable_3_text.trim()) {
        toast({ title: 'Sequential syllables', description: 'Fill syllable 2 before syllable 3.', variant: 'destructive' })
        return
      }
    }

    // ── M2 validation ────────────────────────────────────────────────────────
    if (isM2) {
      for (let i = 0; i < 5; i++) {
        const word = (values[`mech_word_${i+1}` as keyof FormValues] as string).trim()
        if (!word) {
          toast({ title: `Word ${i+1} required`, description: `All 5 words are required.`, variant: 'destructive' })
          return
        }
        if (word.includes(' ')) {
          toast({ title: `Word ${i+1} invalid`, description: `Each entry must be a single word (no spaces).`, variant: 'destructive' })
          return
        }
        if (word.length < 2) {
          toast({ title: `Word ${i+1} too short`, description: `Each word must be at least 2 characters.`, variant: 'destructive' })
          return
        }
        if (!mechImages[i]) {
          toast({ title: `Image ${i+1} required`, description: `Image for word ${i+1} is required.`, variant: 'destructive' })
          return
        }
      }
    }

    // ── M3 validation ────────────────────────────────────────────────────────
    if (isM3) {
      if (!mechCorrectImage) {
        toast({ title: 'Image required', description: 'Correct image is required.', variant: 'destructive' })
        return
      }
      if (!values.mech_option_1_text.trim() || !mechOptionImages[0]) {
        toast({ title: 'Option 1 required', description: 'Option 1 text and image are both required.', variant: 'destructive' })
        return
      }
      if (!values.mech_option_2_text.trim() || !mechOptionImages[1]) {
        toast({ title: 'Option 2 required', description: 'Option 2 text and image are both required.', variant: 'destructive' })
        return
      }
      const has3text  = !!values.mech_option_3_text.trim()
      const has3image = !!mechOptionImages[2]
      if (has3text !== has3image) {
        toast({ title: 'Option 3 incomplete', description: 'Option 3 requires both text and image.', variant: 'destructive' })
        return
      }
      if (!values.mech_correct_text.trim()) {
        toast({ title: 'Correct text required', description: 'Enter the correct option text.', variant: 'destructive' })
        return
      }
      const opts = [values.mech_option_1_text, values.mech_option_2_text]
      if (has3text) opts.push(values.mech_option_3_text)
      const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
      if (!opts.some(o => norm(o) === norm(values.mech_correct_text))) {
        toast({ title: 'Correct text mismatch', description: '"Correct text" must match one of the option texts exactly.', variant: 'destructive' })
        return
      }
    }

    // ── M4-M9 validation ─────────────────────────────────────────────────────
    if (isM4M9) {
      if (showMLWords && !values.multilingual_words.trim()) {
        toast({ title: 'Multilingual words required', description: 'Enter at least one word.', variant: 'destructive' })
        return
      }
      const fillIsActive = !!(values.mech_fill_complete.trim() || values.mech_fill_text.trim())
      const mcqIsActive  = !!values.mech_mcq_question.trim()
      if (!fillIsActive && !mcqIsActive) {
        toast({ title: 'Mechanic required', description: 'Fill in at least one mechanic section (Fill in the Blanks or MCQ).', variant: 'destructive' })
        return
      }
      if (fillIsActive) {
        if (!values.mech_fill_complete.trim()) {
          toast({ title: 'Complete text required', description: 'Fill in the Blanks: complete text is required (used for TTS).', variant: 'destructive' })
          return
        }
        if (!values.mech_fill_text.trim()) {
          toast({ title: 'Text with blank required', description: 'Fill in the Blanks: text with blank is required.', variant: 'destructive' })
          return
        }
        if (!mechFillImage) {
          toast({ title: 'Image required', description: 'Fill in the Blanks: image is required.', variant: 'destructive' })
          return
        }
        if (!values.mech_fill_option_1.trim() || !values.mech_fill_option_2.trim()) {
          toast({ title: 'Options required', description: 'Fill in the Blanks: options 1 and 2 are required.', variant: 'destructive' })
          return
        }
        if (!values.mech_fill_correct.trim()) {
          toast({ title: 'Correct option required', description: 'Fill in the Blanks: enter the correct option.', variant: 'destructive' })
          return
        }
        const fillOpts = [values.mech_fill_option_1, values.mech_fill_option_2, values.mech_fill_option_3].filter(Boolean)
        if (!fillOpts.some(o => o.trim().toLowerCase() === values.mech_fill_correct.trim().toLowerCase())) {
          toast({ title: 'Correct option mismatch', description: '"Correct option" must match one of the options exactly.', variant: 'destructive' })
          return
        }
      }
      if (mcqIsActive) {
        if (!mechMcqImage) {
          toast({ title: 'Image required', description: 'MCQ: image is required.', variant: 'destructive' })
          return
        }
        if (!values.mech_mcq_option_1.trim() || !values.mech_mcq_option_2.trim()) {
          toast({ title: 'Options required', description: 'MCQ: options 1 and 2 are required.', variant: 'destructive' })
          return
        }
        if (!values.mech_mcq_correct.trim()) {
          toast({ title: 'Correct text required', description: 'MCQ: enter the correct option text.', variant: 'destructive' })
          return
        }
        const mcqOpts = [values.mech_mcq_option_1, values.mech_mcq_option_2, values.mech_mcq_option_3].filter(Boolean)
        if (!mcqOpts.some(o => o.trim().toLowerCase() === values.mech_mcq_correct.trim().toLowerCase())) {
          toast({ title: 'Correct text mismatch', description: 'MCQ: "Correct text" must match one of the options exactly.', variant: 'destructive' })
          return
        }
      }
    }

    // ── M10-M15 validation ───────────────────────────────────────────────────
    if (isM10) {
      if (showMLWords && !values.multilingual_words.trim()) {
        toast({ title: 'Multilingual words required', description: 'Enter at least one word.', variant: 'destructive' })
        return
      }
      if (!values.mech_mechanics_id.trim()) {
        toast({ title: 'Mechanics ID required', description: 'Enter the mechanics ID (e.g. mechanic_14).', variant: 'destructive' })
        return
      }
      if (!values.mech_content_body.trim()) {
        toast({ title: 'Content body required', description: 'Enter the stringified JSON content body.', variant: 'destructive' })
        return
      }
      try {
        const parsed = JSON.parse(values.mech_content_body.trim().replace(/\\"/g, '"'))
        if (!Array.isArray(parsed?.data?.tasks) || parsed.data.tasks.length === 0) {
          toast({ title: 'Invalid content body', description: "JSON must have a non-empty 'data.tasks' array.", variant: 'destructive' })
          return
        }
      } catch {
        toast({ title: 'Invalid JSON', description: 'Content body must be valid JSON.', variant: 'destructive' })
        return
      }
    }

    // ── Inline multilingual validation ───────────────────────────────────────
    if (showInlineML) {
      const hasAtLeastOne = ML_LANGUAGES.some(({ code }) => mlEntries[code].text.trim())
      if (!hasAtLeastOne) {
        toast({ title: 'Multilingual translations required', description: 'Fill in at least one language translation.', variant: 'destructive' })
        return
      }
      for (const { code, label } of ML_LANGUAGES) {
        const entry = mlEntries[code]
        if (!entry.text.trim()) continue
        const scriptRx = SCRIPT_REGEX[code]
        if (scriptRx && !scriptRx.test(entry.text)) {
          toast({ title: 'Script mismatch', description: `${label} translation does not appear to use the correct script.`, variant: 'destructive' })
          return
        }
      }
    }

    // ── Build fields and files ───────────────────────────────────────────────
    const fields: Record<string, string> = {
      templateType,
      name:               values.name.trim(),
      contentType:        values.contentType,
      language:           values.language,
      status:             values.status,
      tags:               values.tags.join(','),
      text:               textTrimmed,
      multilingual_words: values.multilingual_words.trim(),
    }
    if (values.collectionId) fields.collectionId = values.collectionId

    const files: Record<string, File> = {}
    if (audioFile) files.audio_file = audioFile
    if (imageFile) files.image = imageFile

    if (isM1) {
      fields.syllable_1_text = values.syllable_1_text.trim()
      if (values.syllable_2_text.trim()) fields.syllable_2_text = values.syllable_2_text.trim()
      if (values.syllable_3_text.trim()) fields.syllable_3_text = values.syllable_3_text.trim()
      files.mech_image = mechImage!
      if (syllableAudios[0]) files.mech_syllable_1_audio = syllableAudios[0]
      if (syllableAudios[1] && values.syllable_2_text.trim()) files.mech_syllable_2_audio = syllableAudios[1]
      if (syllableAudios[2] && values.syllable_3_text.trim()) files.mech_syllable_3_audio = syllableAudios[2]
    }

    if (isM2) {
      for (let i = 1; i <= 5; i++) {
        fields[`mech_word_${i}`] = (values[`mech_word_${i}` as keyof FormValues] as string).trim()
        files[`mech_image_${i}`] = mechImages[i - 1]!
        if (mechAudios[i - 1]) files[`mech_audio_${i}`] = mechAudios[i - 1]!
      }
    }

    if (isM3) {
      fields.mech_correct_text  = values.mech_correct_text.trim()
      fields.mech_option_1_text = values.mech_option_1_text.trim()
      fields.mech_option_2_text = values.mech_option_2_text.trim()
      if (values.mech_option_3_text.trim()) fields.mech_option_3_text = values.mech_option_3_text.trim()
      files.mech_correct_image  = mechCorrectImage!
      files.mech_option_1_image = mechOptionImages[0]!
      files.mech_option_2_image = mechOptionImages[1]!
      if (mechOptionImages[2]) files.mech_option_3_image = mechOptionImages[2]
    }

    if (isM4M9) {
      const fillIsActive = !!(values.mech_fill_complete.trim() || values.mech_fill_text.trim())
      const mcqIsActive  = !!values.mech_mcq_question.trim()

      if (fillIsActive) {
        fields.mech_fill_complete = values.mech_fill_complete.trim()
        fields.mech_fill_text     = values.mech_fill_text.trim()
        fields.mech_fill_correct  = values.mech_fill_correct.trim()
        fields.mech_fill_option_1 = values.mech_fill_option_1.trim()
        fields.mech_fill_option_2 = values.mech_fill_option_2.trim()
        if (values.mech_fill_option_3.trim()) fields.mech_fill_option_3 = values.mech_fill_option_3.trim()
        fields.mech_fill_time     = values.mech_fill_time || '90'
        if (mechFillAudio) files.mech_fill_audio = mechFillAudio
        files.mech_fill_image = mechFillImage!
      }

      if (mcqIsActive) {
        fields.mech_mcq_question  = values.mech_mcq_question.trim()
        fields.mech_mcq_correct   = values.mech_mcq_correct.trim()
        fields.mech_mcq_option_1  = values.mech_mcq_option_1.trim()
        fields.mech_mcq_option_2  = values.mech_mcq_option_2.trim()
        if (values.mech_mcq_option_3.trim()) fields.mech_mcq_option_3 = values.mech_mcq_option_3.trim()
        fields.mech_mcq_time      = values.mech_mcq_time || '90'
        if (mechMcqAudio) files.mech_mcq_audio = mechMcqAudio
        files.mech_mcq_image = mechMcqImage!
        if (mechMcqCorrectAudio) files.mech_mcq_correct_audio = mechMcqCorrectAudio
        mechMcqOptionAudios.forEach((f, i) => { if (f) files[`mech_mcq_option_audio_${i + 1}`] = f })
      }
    }

    if (isM10) {
      fields.mech_mechanics_id = values.mech_mechanics_id.trim()
      fields.mech_content_body = values.mech_content_body.trim()
    }

    if (showInlineML) {
      for (const { code } of ML_LANGUAGES) {
        const entry = mlEntries[code]
        if (entry.text.trim()) {
          fields[`multilingual_${code}_text`] = entry.text.trim()
          if (entry.file) files[`multilingual_${code}_audio_file`] = entry.file
        }
      }
    }

    try {
      await createMutation.mutateAsync({ templateType, fields, files })
      navigate('/')
    } catch {
      // Error toast shown by hook
    }
  }

  const isPending   = createMutation.isPending

  // ── Helpers ────────────────────────────────────────────────────────────────
  function setMechImage_N(i: number, f: File | null) {
    setMechImages((prev) => { const next = [...prev] as typeof prev; next[i] = f; return next })
  }
  function setMechAudio_N(i: number, f: File | null) {
    setMechAudios((prev) => { const next = [...prev] as typeof prev; next[i] = f; return next })
  }
  function setOptionImage_N(i: number, f: File | null) {
    setMechOptionImages((prev) => { const next = [...prev] as typeof prev; next[i] = f; return next })
  }
  function setSyllableAudio_N(i: number, f: File | null) {
    setSyllableAudios((prev) => { const next = [...prev] as typeof prev; next[i] = f; return next })
  }
  function setMcqOptionAudio_N(i: number, f: File | null) {
    setMechMcqOptionAudios((prev) => { const next = [...prev] as typeof prev; next[i] = f; return next })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* ── Content Details ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle>Content Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          <div className="space-y-1.5">
            <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
            <Input id="name" placeholder="Enter content name"
              {...register('name', { required: 'Name is required' })} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Content Type <span className="text-destructive">*</span></Label>
            <Controller name="contentType" control={control} render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Word', 'Sentence', 'Paragraph', 'Char'].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
          </div>

          <div className="space-y-1.5">
            <Label>Language <span className="text-destructive">*</span></Label>
            <Controller name="language" control={control} render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[
                    { code: 'en', label: 'English' }, { code: 'hi', label: 'Hindi' },
                    { code: 'ta', label: 'Tamil' },   { code: 'te', label: 'Telugu' },
                    { code: 'kn', label: 'Kannada' }, { code: 'gu', label: 'Gujarati' },
                    { code: 'ma', label: 'Marathi' },
                  ].map(({ code, label }) => (
                    <SelectItem key={code} value={code}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
          </div>

          <div className="space-y-1.5">
            <Label>Status <span className="text-destructive">*</span></Label>
            <Controller name="status" control={control} render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>

          <div className="space-y-1.5">
            <Label>Collection</Label>
            <Controller name="collectionId" control={control} render={({ field }) => (
              <CollectionPickerField
                value={field.value}
                onChange={field.onChange}
                defaultLanguage={watch('language')}
                defaultContentType={watch('contentType')}
              />
            )} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tags <span className="text-destructive">*</span></Label>
            <Controller name="tags" control={control} render={({ field }) => (
              <TagInput value={field.value} onChange={field.onChange} placeholder="Type a tag and press Enter" />
            )} />
          </div>

        </CardContent>
      </Card>

      {/* ── Read Along Content ───────────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle>Read Along Content</CardTitle></CardHeader>
        <CardContent className="space-y-4">

          <div className="space-y-1.5">
            <Label htmlFor="text">Text <span className="text-destructive">*</span></Label>
            <Textarea id="text" placeholder="Enter the read-along text" className="min-h-[80px]"
              {...register('text', { required: 'Text is required' })} />
            {errors.text && <p className="text-xs text-destructive">{errors.text.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FileUploadField label="Audio File" accept="audio/*" value={audioFile} onChange={setAudioFile}
              hint="Leave empty to auto-generate via TTS" />
            <FileUploadField label="Image" accept="image/*" value={imageFile} onChange={setImageFile}
              hint="Optional" />
          </div>

        </CardContent>
      </Card>

      {/* ── Multilingual Words (M4-M9, M10-M15, English only) ───────────── */}
      {showMLWords && (
        <Card>
          <CardHeader><CardTitle>Multilingual Words</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label htmlFor="multilingual_words">Words <span className="text-destructive">*</span></Label>
              <Input id="multilingual_words" placeholder="e.g. apple, banana, mango"
                {...register('multilingual_words')} />
              <p className="text-xs text-muted-foreground">
                Comma-separated words that must exist in the Multilingual collection.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Multilingual Inline (M1-M3, English only) ────────────────────── */}
      {showInlineML && (
        <Card>
          <CardHeader><CardTitle>Multilingual Translations</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {ML_LANGUAGES.map(({ code, label }) => (
              <div key={code} className="space-y-2">
                <p className="text-sm font-medium">{label}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Text in {label}</Label>
                    <Input placeholder={`${label} translation`} value={mlEntries[code].text}
                      onChange={(e) => setMlEntries((prev) => ({ ...prev, [code]: { ...prev[code], text: e.target.value } }))} />
                  </div>
                  <FileUploadField label={`${label} Audio`} accept="audio/*" value={mlEntries[code].file}
                    onChange={(f) => setMlEntries((prev) => ({ ...prev, [code]: { ...prev[code], file: f } }))}
                    hint="Auto-generated if empty" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── M1: Syllables ─────────────────────────────────────────────────── */}
      {isM1 && (
        <Card>
          <CardHeader><CardTitle>Mechanic — Syllables</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FileUploadField label="Mechanic Image" accept="image/*" value={mechImage}
              onChange={setMechImage} required hint="Image shown during syllable exercise" />
            {[1, 2, 3].map((n) => (
              <div key={n} className="space-y-2">
                <p className="text-sm font-medium">
                  Syllable {n}{n === 1 ? ' *' : ' (optional)'}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Text</Label>
                    <Input placeholder={`Syllable ${n} text`}
                      {...register(`syllable_${n}_text` as keyof FormValues)} />
                  </div>
                  <FileUploadField label="Audio" accept="audio/*" value={syllableAudios[n - 1]}
                    onChange={(f) => setSyllableAudio_N(n - 1, f)} hint="Auto-generated if empty" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── M2: 5 Word Entries ────────────────────────────────────────────── */}
      {isM2 && (
        <Card>
          <CardHeader><CardTitle>Mechanic — Words</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="space-y-2">
                <p className="text-sm font-medium">Word {n} <span className="text-destructive">*</span></p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Word (single, ≥2 chars)</Label>
                    <Input placeholder={`Word ${n}`}
                      {...register(`mech_word_${n}` as keyof FormValues)} />
                  </div>
                  <FileUploadField label="Image" accept="image/*" value={mechImages[n - 1]}
                    onChange={(f) => setMechImage_N(n - 1, f)} required />
                  <FileUploadField label="Audio" accept="audio/*" value={mechAudios[n - 1]}
                    onChange={(f) => setMechAudio_N(n - 1, f)} hint="Auto-generated if empty" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── M3: Options ───────────────────────────────────────────────────── */}
      {isM3 && (
        <Card>
          <CardHeader><CardTitle>Mechanic — Options</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Correct Text <span className="text-destructive">*</span></Label>
                <Input placeholder="Must match one of the option texts below"
                  {...register('mech_correct_text')} />
              </div>
              <FileUploadField label="Correct Image" accept="image/*" value={mechCorrectImage}
                onChange={setMechCorrectImage} required />
            </div>
            {[1, 2, 3].map((n) => (
              <div key={n} className="space-y-2">
                <p className="text-sm font-medium">
                  Option {n}{n <= 2 && <span className="text-destructive"> *</span>}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Text</Label>
                    <Input placeholder={`Option ${n} text`}
                      {...register(`mech_option_${n}_text` as keyof FormValues)} />
                  </div>
                  <FileUploadField label="Image" accept="image/*"
                    value={mechOptionImages[n - 1]} onChange={(f) => setOptionImage_N(n - 1, f)}
                    required={n <= 2} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── M4-M9: Fill in the Blanks ────────────────────────────────────── */}
      {isM4M9 && (
        <Card>
          <CardHeader>
            <CardTitle>Fill in the Blanks (mechanic_1)</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Optional — but at least one mechanic section must be filled.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mech_fill_complete">
                Complete Text {fillActive && <span className="text-destructive">*</span>}
              </Label>
              <Input id="mech_fill_complete" placeholder="Full sentence (used only for TTS, not stored)"
                {...register('mech_fill_complete')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mech_fill_text">
                Text with Blank {fillActive && <span className="text-destructive">*</span>}
              </Label>
              <Input id="mech_fill_text" placeholder="e.g. The cat sat on the ___"
                {...register('mech_fill_text')} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FileUploadField label={fillActive ? 'Image *' : 'Image'} accept="image/*"
                value={mechFillImage} onChange={setMechFillImage} required={fillActive} />
              <FileUploadField label="Audio" accept="audio/*" value={mechFillAudio}
                onChange={setMechFillAudio} hint="TTS from complete text if empty" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Option 1 {fillActive && <span className="text-destructive">*</span>}</Label>
                <Input placeholder="Option 1" {...register('mech_fill_option_1')} />
              </div>
              <div className="space-y-1.5">
                <Label>Option 2 {fillActive && <span className="text-destructive">*</span>}</Label>
                <Input placeholder="Option 2" {...register('mech_fill_option_2')} />
              </div>
              <div className="space-y-1.5">
                <Label>Option 3 (optional)</Label>
                <Input placeholder="Option 3" {...register('mech_fill_option_3')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Correct Option {fillActive && <span className="text-destructive">*</span>}</Label>
              <Input placeholder="Must match one of the options above"
                {...register('mech_fill_correct')} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── M4-M9: MCQ ────────────────────────────────────────────────────── */}
      {isM4M9 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>MCQ (mechanic_2)</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Optional — but at least one mechanic section must be filled.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={!mcqQuestionVal?.trim()}
                onClick={openMcqPreview}
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mech_mcq_question">Question Text {mcqActive && <span className="text-destructive">*</span>}</Label>
              <Input id="mech_mcq_question" placeholder="Enter the MCQ question"
                {...register('mech_mcq_question')} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FileUploadField label={mcqActive ? 'Image *' : 'Image'} accept="image/*"
                value={mechMcqImage} onChange={setMechMcqImage} required={mcqActive} />
              <FileUploadField label="Question Audio" accept="audio/*" value={mechMcqAudio}
                onChange={setMechMcqAudio} hint="TTS from question text if empty" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="space-y-2">
                  <div className="space-y-1.5">
                    <Label>Option {n}{n <= 2 ? (mcqActive ? ' *' : '') : ' (optional)'}</Label>
                    <Input placeholder={`Option ${n}`}
                      {...register(`mech_mcq_option_${n}` as keyof FormValues)} />
                  </div>
                  <FileUploadField label={`Option ${n} Audio`} accept="audio/*"
                    value={mechMcqOptionAudios[n - 1]}
                    onChange={(f) => setMcqOptionAudio_N(n - 1, f)}
                    hint="Auto-generated if empty" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Correct Text {mcqActive && <span className="text-destructive">*</span>}</Label>
                <Input placeholder="Must match one of the options above"
                  {...register('mech_mcq_correct')} />
              </div>
              <FileUploadField label="Correct Hint Audio" accept="audio/*" value={mechMcqCorrectAudio}
                onChange={setMechMcqCorrectAudio} hint="Optional hint audio" />
            </div>
            <p className="text-xs text-muted-foreground">
              Note: mechanic_3 (jumbled text) is auto-generated from the Read Along text above.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── M10-M15 ───────────────────────────────────────────────────────── */}
      {isM10 && (
        <Card>
          <CardHeader><CardTitle>Mechanic</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mech_mechanics_id">Mechanics ID <span className="text-destructive">*</span></Label>
              <Input id="mech_mechanics_id" placeholder="e.g. mechanic_14"
                {...register('mech_mechanics_id')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mech_content_body">Content Body (JSON) <span className="text-destructive">*</span></Label>
              <Textarea id="mech_content_body" placeholder={'Stringified JSON with data.tasks array'}
                className="min-h-[120px] font-mono text-xs"
                {...register('mech_content_body')} />
              <p className="text-xs text-muted-foreground">
                Paste the stringified JSON — same format as the Excel content_body column.
                Must contain a non-empty <code>data.tasks</code> array.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => navigate('/')} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creating… (may take a moment for TTS)' : 'Create Content'}
        </Button>
      </div>

      <MCQPreviewModal
        content={mcqPreviewContent as any}
        open={mcqPreviewOpen}
        onClose={() => setMcqPreviewOpen(false)}
      />

    </form>
  )
}
