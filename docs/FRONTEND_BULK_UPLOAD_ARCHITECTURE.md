# Frontend Architecture Briefing — Bulk Upload Phase

## 1. Tech Stack

| Layer | Library | Version |
|---|---|---|
| Framework | React + TypeScript | 18.2 / 5.4 |
| Build | Vite | 5.2 |
| Routing | React Router v6 | 6.22 |
| Server State | TanStack React Query | 5.28 |
| Forms | React Hook Form + Zod | 7.51 / 3.22 |
| HTTP Client | Axios | 1.6.8 |
| UI Primitives | Radix UI | Various |
| Styling | Tailwind CSS | 3.4 |
| Icons | Lucide React | 0.358 |
| XLSX Generation | **None installed** | — |

**Key takeaway:** There is no ExcelJS or SheetJS library in the frontend yet. Template download will require adding a dependency (e.g. `exceljs`).

---

## 2. Template Download Flow

**Current state: Does not exist.**

The frontend has zero code for generating or downloading `.xlsx` templates. There is no backend endpoint for template download either — the backend only accepts uploads.

### What needs to be built

The frontend must generate `.xlsx` files **client-side** using ExcelJS (or equivalent). The generation logic must be driven by the same `templateType` value used by the backend router. Each template type maps to a set of expected tabs and columns:

| `templateType` | Tabs | Column Source |
|---|---|---|
| `M1 to M2 Read Along Content` | `read along` | Base + multilingual `{langCode}` columns |
| `M3 Read Along Content` | `read along` | Base + multilingual `{langCode}` columns |
| `M4 to M6 Read Along Content` | `read along` | Base + `multilingual_words` |
| `M7 to M9 Read Along Content` | `read along` | Base + `multilingual_words` |
| `M1 Mechanics Content` | `read along`, `mechanic` | Base + syllable columns |
| `M2 Mechanics Content` | `read along`, `mechanic` | Base + phoneme/match columns |
| `M3 Mechanics Content` | `read along`, `mechanic` | Base + option columns |
| `M4 to M6 Mechanics Content` | `read along`, `fill in the blanks`, `mcq`, `jumbled words` | Base + mechanic sub-columns per tab |
| `M7 to M9 Mechanics Content` | `read along`, `fill in the blanks`, `mcq`, `jumbled words` | Base + mechanic sub-columns per tab |
| `M10 to M15 Mechanics Content` | `read along`, `mechanic` | Base + task/passage columns |
| `Collection` | `collection` | Collection fields |
| `Multilingual` | `multilingual` | Language pair columns |

### Multilingual columns

For M1-M3 templates, the backend strict loop in `buildBasePayload` looks for columns named:

```
multilingual {langCode} text
multilingual {langCode} audio source
multilingual {langCode} audio
multilingual {langCode} image
```

Where `langCode` is from `SUPPORTED_LANGUAGES = ['en', 'hi', 'ta', 'te', 'kn', 'gu', 'ma', 'or']`.

The template generator should include these columns for each target language the user selects in the wizard. For example, if the user picks English content with Kannada + Telugu translations, the `read along` tab would include:

```
Name | Text | Audio_Source | Audio_File | Tags | Status | Publisher |
Multilingual kn Text | Multilingual kn Audio Source | Multilingual kn Audio | Multilingual kn Image |
Multilingual te Text | Multilingual te Audio Source | Multilingual te Audio | Multilingual te Image
```

---

## 3. Bulk Upload Flow

**Current state: Does not exist.**

There is no upload page, no wizard component, and no route. The existing routes are:

```
/                     → ContentListPage
/content/new          → CreateContentPage
/content/:id/edit     → EditContentPage
/collections          → CollectionListPage
/collections/new      → CreateCollectionPage
/collections/:id/edit → EditCollectionPage
```

### What the wizard must collect

The backend `POST /v1/content/bulk-upload` expects `multipart/form-data` with two fields:

| Field | Type | Description |
|---|---|---|
| `file` | Binary | `.zip` bundle containing `.xlsx` + asset files |
| `wizard` | String | JSON-encoded `WizardConfig` object |

The `WizardConfig` interface (from `bulk-ingest.service.ts`):

```typescript
interface WizardConfig {
  collectionId:      string;       // UUID or 'AUTO'
  language:          string;       // 'en' | 'hi' | 'ta' | 'te' | 'kn' | 'gu'
  tags:              string[];     // Used ONLY for AUTO collection creation
  status:            string;       // 'live' | 'draft'
  publisher:         string;       // e.g. 'ekstep'
  target_lang_code:  string;       // Legacy — kept for compatibility
  templateType:      TemplateType; // One of the 12 template type strings
  action:            'CREATE' | 'UPDATE';
}
```

### Suggested wizard steps

| Step | Collects | UI Component |
|---|---|---|
| 1 | `action` (CREATE / UPDATE) | Radio group |
| 2 | `templateType` | Select dropdown (12 options) |
| 3 | `collectionId` (existing UUID or AUTO) | Select from collection list + AUTO option |
| 4 | `language` | Select dropdown |
| 5 | `tags`, `status`, `publisher` | Tag input, status toggle, text input |
| 6 | ZIP file upload | Drag-and-drop zone |

---

## 4. API Integration

### Existing API client

**File:** `frontend/src/api/client.ts`

```typescript
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3008/v1'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor: attaches Bearer token from localStorage
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response interceptor: dispatches auth:unauthorized on 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }
    return Promise.reject(error)
  }
)
```

### API functions to add

The following functions need to be created (suggested file: `frontend/src/api/bulk-upload.ts`):

```typescript
import { apiClient } from './client'

// POST /v1/content/bulk-upload — multipart FormData
export async function submitBulkUpload(
  file: File,
  wizard: WizardConfig,
): Promise<{ jobId: string; totalRows: number }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('wizard', JSON.stringify(wizard))

  const res = await apiClient.post('/content/bulk-upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0, // no timeout for large uploads
  })
  return res.data
}

// GET /v1/content/bulk-upload/status/:jobId — poll progress
export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const res = await apiClient.get(`/content/bulk-upload/status/${jobId}`)
  return res.data
}

// POST /v1/content/bulk-upload/resume/:jobId — resume failed job
export async function resumeJob(jobId: string): Promise<{ message: string }> {
  const res = await apiClient.post(`/content/bulk-upload/resume/${jobId}`)
  return res.data
}
```

### Job status polling pattern (TanStack Query)

```typescript
const { data: job } = useQuery({
  queryKey: ['bulk-job', jobId],
  queryFn: () => getJobStatus(jobId),
  refetchInterval: (query) => {
    const status = query.state.data?.status
    return status === 'PROCESSING' || status === 'PENDING' ? 3000 : false
  },
  enabled: !!jobId,
})
```

---

## 5. Existing Patterns to Follow

### Form validation (Zod + React Hook Form)

Every existing form uses this pattern:

```typescript
const schema = z.object({ ... })
type FormValues = z.infer<typeof schema>
const form = useForm<FormValues>({ resolver: zodResolver(schema) })
```

### Toast notifications

```typescript
import { toast } from '@/hooks/use-toast'
toast({ title: 'Success', description: 'Upload started' })
toast({ title: 'Error', description: msg, variant: 'destructive' })
```

### Navigation link styling

```typescript
<NavLink to="/bulk-upload" className={({ isActive }) => cn(...)}>
```

---

## 6. Frontend Types Reference

**File:** `frontend/src/types/index.ts`

```typescript
type ContentType = 'Word' | 'Sentence' | 'Paragraph' | 'Char'
type Language    = 'en' | 'hi' | 'ta' | 'te' | 'kn' | 'gu'
type Status      = 'live' | 'draft'
```

These types currently do **not** include `TemplateType`, `WizardConfig`, or `JobStatus`. These must be added for the bulk upload feature.

---

## 7. File Tree (Existing + Planned)

```
frontend/src/
├── api/
│   ├── client.ts              # Axios instance (EXISTS)
│   ├── content.ts             # Content CRUD (EXISTS)
│   ├── collection.ts          # Collection CRUD (EXISTS)
│   └── bulk-upload.ts         # ⬅ NEW: submitBulkUpload, getJobStatus, resumeJob
├── components/
│   ├── shared/
│   │   ├── TagInput.tsx       # Tag badge input (EXISTS)
│   │   └── TokenSettings.tsx  # Auth token dialog (EXISTS)
│   ├── content/
│   │   ├── ContentForm.tsx    # Content create/edit (EXISTS)
│   │   └── ...
│   ├── collection/
│   │   └── CollectionForm.tsx # Collection create/edit (EXISTS)
│   └── bulk-upload/           # ⬅ NEW: wizard steps, upload zone, progress
├── hooks/
│   ├── useContent.ts          # Content queries (EXISTS)
│   ├── useCollections.ts      # Collection queries (EXISTS)
│   └── useBulkUpload.ts       # ⬅ NEW: upload mutation + status polling
├── pages/
│   ├── ContentListPage.tsx    # (EXISTS)
│   └── BulkUploadPage.tsx     # ⬅ NEW: wizard + upload + progress
├── types/
│   └── index.ts               # Content, Collection, Language (EXISTS — needs WizardConfig, TemplateType, JobStatus)
└── App.tsx                    # Router (EXISTS — needs /bulk-upload route)
```
