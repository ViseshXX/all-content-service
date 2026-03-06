# ALL Content Service — Documentation

## Overview

The **ALL Content Service** is a NestJS/TypeScript REST API that manages educational content for the AXL (Assisted Language and Math Learning) programme. It is the central store for all learning material — words, sentences, paragraphs, and characters — used by the teacher assistant, school practice assistant, home chatbot, and community learning tools.

The service handles:
- Storing and retrieving structured content
- Automatically computing linguistic features (phonemes, syllable counts, word frequency, reading complexity) by calling downstream ML APIs
- Organizing content into **Collections** (logical groups) and attaching metadata like difficulty level, competency, and CEFR level
- Serving filtered/adaptive content queries to learner-facing applications

**Stack:** NestJS · Fastify · MongoDB (Mongoose) · TypeScript
**Port:** 3008
**Auth:** JWT Bearer token (all write endpoints, most read endpoints)

---

## Core Concepts

### Content vs. Collection

| Concept | Description |
|---|---|
| **Collection** | A named group of related content items (e.g., "Grade 2 English Chapter 3"). Has a category, language, difficulty level, and tags. |
| **Content** | An individual learning item (word, sentence, paragraph, or character) that belongs to a collection. Carries the actual text plus computed linguistic metadata. |

### Content Types

There are exactly **four supported content types**, set via the `contentType` field:

| Type | Description | Example |
|---|---|---|
| `Word` | A single word, used for phoneme/syllable practice | `"amma"` |
| `Sentence` | A complete sentence, used for reading and fluency | `"Blue bird, blue bird, what do you see?"` |
| `Paragraph` | A multi-sentence reading passage | A short story excerpt |
| `Char` | A single character, used for alphabet/akshara learning | `"க"` |

### Supported Languages

| Code | Language |
|---|---|
| `en` | English |
| `hi` | Hindi |
| `ta` | Tamil |
| `te` | Telugu |
| `kn` | Kannada |
| `gu` | Gujarati |

Languages `ta`, `hi`, `te`, `kn` (and `ka` as alias for Kannada) receive full complexity analysis via the language-complexity API. English receives phoneme extraction. Gujarati and others pass through without enrichment.

---

## Data Schemas

### Collection Schema

Defined in `src/schemas/collection.schema.ts`.

| Field | Type | Required | Description |
|---|---|---|---|
| `collectionId` | UUID (string) | auto | Auto-generated unique identifier |
| `name` | string | yes | Human-readable name of the collection |
| `category` | string | yes | Content type category: `Word`, `Sentence`, `Paragraph`, `Char` |
| `language` | string | yes | Primary language code (`en`, `hi`, `ta`, etc.) |
| `status` | string | yes | `live` or `draft` |
| `description` | string | no | Optional description |
| `author` | string | no | Author/creator name |
| `publisher` | string | no | Publisher name |
| `edition` | string | no | Edition identifier |
| `imagePath` | string | no | Path to cover image |
| `difficultyLevel` | string | no | Difficulty classification |
| `ageGroup` | string | no | Target age group |
| `level_complexity` | object | no | `{ level, level_competency, CEFR_level? }` |
| `tags` | string[] | yes | Categorization tags (e.g., `ASER`, `set1`, `CEFR_M1_P1`) |
| `reviewer` | string | no | Reviewer ID |
| `reviewStatus` | string | no | Review state |
| `flaggedBy` / `flagReasons` / `lastFlaggedOn` | string | no | Content moderation fields |
| `createdAt` / `updatedAt` | Date | auto | Timestamps |

---

### Content Schema

Defined in `src/schemas/content.schema.ts`.

| Field | Type | Required | Description |
|---|---|---|---|
| `contentId` | UUID (string) | auto | Auto-generated unique identifier |
| `collectionId` | string | no | UUID of the parent collection |
| `name` | string | yes | Name/label for the content item |
| `contentType` | string | yes | `Word`, `Sentence`, `Paragraph`, or `Char` |
| `language` | string | yes | Primary language code |
| `status` | string | yes | `live` or `draft` |
| `contentSourceData` | Mixed[] | yes | Array of per-language content objects (see below) |
| `mechanics_data` | object[] | no | Structured exercise data for specific mechanics (see below) |
| `multilingual` | object | no | `{ [langCode]: { text, audio_url } }` — cross-language text/audio |
| `level_complexity` | object | no | `{ level, level_competency, CEFR_level? }` |
| `tags` | string[] | yes | Categorization tags |
| `imagePath` | string | no | Path to associated image |
| `contentIndex` | number | no | Ordering index within a collection |
| `publisher` | string | no | Publisher name |
| `reviewer` / `reviewStatus` | string | no | Review metadata |
| `flaggedBy` / `flagReasons` / `lastFlaggedOn` | string | no | Moderation fields |
| `createdAt` / `updatedAt` | Date | auto | Timestamps |

#### `contentSourceData` — Per-Language Content Object

Each element in the `contentSourceData` array represents the content in one language. You provide `language`, `text`, and optionally `audioUrl`. The remaining fields are **computed automatically** by the service on creation.

**Input fields (provided by caller):**

| Field | Type | Description |
|---|---|---|
| `language` | string | Language code for this data element |
| `text` | string | The actual content text |
| `audioUrl` | string | (optional) URL to pre-recorded audio |
| `inst_audioUrl` | string | (optional) URL to pre-recorded audio for instructions |

**Computed fields (added by the service):**

| Field | Type | Languages | Description |
|---|---|---|---|
| `phonemes` | string[] | `en` | Phoneme breakdown of the text |
| `wordCount` | number | `en`, `ta`, `hi`, `te`, `kn` | Total word count |
| `wordFrequency` | object | `en`, `ta`, `hi`, `te`, `kn` | Map of word → occurrence count |
| `syllableCount` | number | all | Total grapheme/syllable count |
| `syllableCountMap` | object | all | Map of word → its syllable count |
| `wordMeasures` | object[] | `ta`, `hi`, `te`, `kn` | Per-word complexity matrices from language API |
| `totalOrthoComplexity` | number | `ta`, `hi`, `te`, `kn` | Orthographic complexity score |
| `totalPhonicComplexity` | number | `ta`, `hi`, `te`, `kn` | Phonic complexity score |
| `meanComplexity` | number | `ta`, `hi`, `te`, `kn` | Mean word complexity |
| `readingComplexity` | number | `hi`, `te`, `kn` | Reading difficulty score (C0–C4) |

#### `mechanics_data` — Structured Exercise Data

Optional array used for specific interactive exercise types (e.g., MCQ, jumbled words, matching). Each element is keyed to a `mechanics_id` and a `language`.

| Field | Type | Description | Mandatory |
|---|---|---|
| `mechanics_id` | string | Identifier for the mechanics/exercise type | yes |
| `language` | string | Language this mechanics entry applies to | yes |
| `content_body` | string | Main content body text | yes |
| `text` | string | Display text | yes |
| `jumbled_text` | string | Text in jumbled form (for reordering exercises) | no |
| `audio_url` | string | Audio for the content | no |
| `image_url` | string | Image for the content |
| `time_limit` | number | Time allowed in seconds |
| `options` | object[] | MCQ options: `{ text, audio_url, image_url, isAns, side }` |
| `hints` | object | Hint: `{ text, audio_url, image_url }` |
| `correctness` | object | Partial-credit mapping: `{ "50%": [string[]] }` |
| `syllable` | object[] | Syllable breakdown: `{ text, audio_url }[]` |
| `words` | string[] | Word list |
| `imageAudioMap` | object[] | Image-audio pairs: `{ text, multilingual_id, audio_url, image_url }[]` |

Note that there might be a case where mechanics data or any mechanic type can have only image or audio as options so there might be some optional fields. We need to consider those aspects in creating any mechanics data content types. 

For images and audio file uploads, the relative path is stored.
---

## Difficulty and Level Classification

### Content Levels (L1–L6)

Content is classified into levels based on `syllableCount` and `wordCount`, language, and content type. Defined in `src/config/commonConfig.ts` and per-language configs.

**Tamil (ta) examples:**

| Level | Word | Sentence | Paragraph |
|---|---|---|---|
| L1 | 2 syllables | 2–3 words | — |
| L2 | 2–3 syllables | 2–3 words, ≤8 syllables | — |
| L3 | ≥4 syllables | 3–5 words, ≤15 syllables | ≤10 words |
| L4 | — | 6–7 words, ≤20 syllables | ≤10 words |
| L5 | — | 7–10 words | 11–15 words |
| L6 | — | — | >15 words |

### Complexity Levels (C0–C4)

Orthographic and phonic complexity are scored and bucketed into `C0`–`C4`. `readingComplexity` (for `hi`, `te`, `kn`) is computed by an external ML API.

### CEFR Levels

Content and collections may carry a `CEFR_level` (e.g., A1, A2, B1) in the `level_complexity` object.

### Tags

Tags are the primary mechanism for associating content with curriculum modules, assessments, and competency tracks. Common tag patterns:

| Pattern | Example | Purpose |
|---|---|---|
| CEFR module/passage | `CEFR_M1_P1`, `CEFR_M3_S2` | Module and passage within CEFR track |
| CEFR reading | `CEFR_R1_P1` … `CEFR_R2_P50` | Reading passage references |
| Assessment set | `ASER`, `NAS`, `set1` | Assessment framework tags |
| Mechanics | `M4_TE_MECH`, `M9_GEN_MECH` | Mechanics exercise groupings |

---

## API Reference

**Base path:** `/v1`
**Auth:** All endpoints (except `/v1/ping`) require `Authorization: Bearer <JWT>`.

### Collections

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/collection` | Create a collection |
| `GET` | `/v1/collection` | List all collections |
| `GET` | `/v1/collection/bylanguage/:language` | Collections by language |
| `GET` | `/v1/collection/:id` | Get one collection by MongoDB `_id` |
| `PUT` | `/v1/collection/:id` | Update a collection |
| `DELETE` | `/v1/collection/:id` | Delete a collection |

**Create Collection — minimum request body:**
```json
{
  "name": "Grade 2 English Chapter 3",
  "category": "Sentence",
  "language": "en",
  "status": "live",
  "tags": ["CEFR_M1_P1"]
}
```

### Content

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/content` | Create content (with automatic linguistic enrichment) |
| `GET` | `/v1/content` | List all content (paginated) |
| `GET` | `/v1/content/pagination` | Paginated content with type/collection filter |
| `GET` | `/v1/content/getByIds` | Fetch multiple items by content IDs |
| `PUT` | `/v1/content/:id` | Update content (recomputes complexity) |
| `DELETE` | `/v1/content/:id` | Delete content |
| `POST` | `/v1/content/getContent` | Advanced filtered query (competency, mechanics, multilingual) |
| `POST` | `/v1/content/getContentByFilters` | Filter by syllables, word count, complexity scores |
| `POST` | `/v1/content/getAssessment` | Get assessment collections (ASER/NAS) |
| `POST` | `/v1/content/getContentForMileStone` | Milestone content by level and complexity |
| `GET` | `/v1/content/getRandomContent` | Random sample of content |
| `GET` | `/v1/content/getContentWord` | Random words |
| `GET` | `/v1/content/getContentSentence` | Random sentences |
| `GET` | `/v1/content/getContentParagraph` | Random paragraphs |
| `POST` | `/v1/content/multilingual` | Create multilingual translation data |

**Create Content — minimum request body:**
```json
{
  "collectionId": "3f0192af-0720-4248-b4d4-d99a9f731d4f",
  "name": "gr2 eng ch3 s1",
  "contentType": "Sentence",
  "language": "en",
  "status": "live",
  "tags": ["CEFR_M1_P1"],
  "contentSourceData": [
    {
      "language": "en",
      "text": "Blue bird, blue bird, what do you see?"
    }
  ]
}
```

**Create Content — example response** (service auto-computes enrichment):
```json
{
  "status": "success",
  "data": {
    "contentId": "fa853c29-bf19-417a-9661-c67d2671ebc1",
    "collectionId": "3f0192af-0720-4248-b4d4-d99a9f731d4f",
    "contentType": "Sentence",
    "language": "en",
    "status": "live",
    "tags": ["CEFR_M1_P1"],
    "contentSourceData": [
      {
        "language": "en",
        "text": "Blue bird, blue bird, what do you see?",
        "phonemes": ["b", "l", "u", "b", "ə", "r", "d", "..."],
        "wordCount": 8,
        "wordFrequency": { "blue": 2, "bird": 2, "what": 1, "do": 1, "you": 1, "see": 1 },
        "syllableCount": 28,
        "syllableCountMap": { "blue": 4, "bird": 4, "what": 4, "do": 2, "you": 3, "see": 3 }
      }
    ]
  }
}
```

### Health Check

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/v1/ping` | None | Returns 200 if service is up |

---

## Content Processing Pipeline (on Create/Update)

```
Caller sends POST /v1/content
         │
         ▼
 For each element in contentSourceData:
   ├─ language in [ta, hi, te, kn, ka]?
   │     └─ Call ALL_LC_API_URL → get wordMeasures, ortho/phonic complexity
   │        Call ALL_TEXT_EVAL_URL/getReadingComplexity (hi, te, kn only)
   │        Compute syllableCount + syllableCountMap via split-graphemes
   │
   ├─ language == 'en'?
   │     └─ Call ALL_TEXT_EVAL_URL/getPhonemes → get phonemes array
   │        Compute wordCount, wordFrequency, syllableCount, syllableCountMap locally
   │
   └─ other language → pass through unchanged
         │
         ▼
  Save enriched document to MongoDB 'content' collection
         │
         ▼
  Return { status: "success", data: <saved document> }
```

---

## External Service Dependencies

| Env Variable | Used For |
|---|---|
| `MONGODB_URL` | MongoDB connection |
| `ALL_LC_API_URL` | Language complexity API (ta, hi, te, kn) — returns `wordMeasures` with orthographic/phonic scores |
| `ALL_TEXT_EVAL_URL` | Text evaluation API — `/getPhonemes` for English, `/getReadingComplexity` for hi/te/kn |
| `ALL_ORC_SERVICE_URL` | Auth/orchestration service — validates JWT token status on each request |
| `JOSE_SECRET` | Secret for JWT decryption |
| `JWT_SIGNIN_PRIVATE_KEY` | Key for JWT signature verification |
| `POOL_SIZE` | MongoDB connection pool size |


## Example payloads
Example templates for read along and mechanics content milestone wise. Please note the following standardized rules across our content modules:

- Audio Formatting: The audioUrl follows the {{contentId}}.wav format within contentSourceData.
- M1 to M3 (English): We have included the multilingual data directly within the JSON instead of fetching it from a separate multilingual collection.
- M4 to M9 (English): The multilingual_id array must contain words extracted from the text field that also exist in the separate multilingual collection.
- M10 to M15: We are passing data inside the content_body within mechanics_data as a stringified JSON format (e.g., "content_body": "{\"level\": \"S1\"...").

###M1 and M2 Practice content template

```json
{ 
  "contentId": "8d7b152f-29bd-4e1b-a71c-dae0e39f66f8",
  "collectionId": "0486d6a2-d4c8-4956-95d0-c6fe095b6de9",
  "name": "EnglishM1-PS",
  "contentType": "Word",
  "contentSourceData": [
    {
      "language": "en",
      "audioUrl": "8d7b152f-29bd-4e1b-a71c-dae0e39f66f8.wav", //audioUrl follows the contentId.wav format.
      "inst_audioUrl": "b0a5c776-2d77-4922-95c7-677abe513ebe.wav",
      "text": "hot"
    }
  ],  // For English M1 to M3, we have included the multilingual data directly in the JSON instead of fetching from a multilingual collection.
  "multilingual": {
    "kn": {
      "text": "ಬಿಸಿ",
      "audio_url": "48f123ab-2f1c-4d44-846b-459420d4ce77.wav"
    },
    "te": {
      "text": "వేడి",
      "audio_url": "ceecc997-96aa-4b3a-aa57-116bb3f53d43.wav"
    }
  },
  "imagePath": "bc17d3ed-8488-4586-b8eb-b36341fdegta.png",
  "level_complexity": {
    "level": "",
    "level_competency": ""
  },
  "status": "live",
  "publisher": "ekstep",
  "language": "en",
  "contentIndex": 1,
  "tags": [
    "CEFR_GEN_M1_P1"
  ],
  "createdAt": "2025-10-27T10:20:49.954Z",
  "updatedAt": "2025-10-27T10:20:49.954Z",
  "__v": 0
}
```

###  M3 Practice content template

```json
{
    "contentId": "3d7b152f-29bd-4e1b-a71c-dae0e39f66f8",
    "collectionId": "0bf5ef53-6332-42f6-9e9a-269ee40af364",
    "name": "M3 P&S json en",
    "contentType": "Sentence",
    "contentSourceData": [
      {
        "language": "en",
        "audioUrl": "3d7b152f-29bd-4e1b-a71c-dae0e39f66f8.wav",
        "text": "We play."
      }
    ],
    "multilingual": {
      "kn": {
        "text": "ನಾವು ಆಡುತ್ತೇವೆ.",
        "audio_url": "8bf33bcac4a3415fa2664c7b78486eed.wav"
      }
    },
    "status": "live",
    "publisher": "ekstep",
    "language": "en",
    "contentIndex": 2,
    "tags": [
      "CEFR_GEN_M3_P1"
    ],
    "createdAt": "2025-08-05T16:15:01.060Z",
    "updatedAt": "2025-08-05T16:15:01.060Z",
    "__v": 0
  }
```

### M1 Mechanic content template

```json
{
    "contentId": "1d7b152f-29bd-4e1b-a71c-dae0e39f66f8",
    "collectionId": "2addcc90-6c14-42d5-aac3-eba7a3ade628",
    "name": "EnglishM1-L",
    "contentType": "Word",
    "contentSourceData": [
      {
        "language": "en",
        "audioUrl": "1d7b152f-29bd-4e1b-a71c-dae0e39f66f8.wav",
        "inst_audioUrl":"e0a5c776-2d77-4922-95c7-677abe513ebe.wav",
        "text": "man"
      }
    ],
    "multilingual": {
      "kn": {
        "text": "ಮನುಷ್ಯ",
        "audio_url": "367104da-9a43-4465-afe2-7cd4e069b0bf.wav"
      },
      "te": {
        "text": "మనిషి",
        "audio_url": "1610c410-1950-42f9-a758-41ac8d6c14c2.wav"
      }
    },
    "mechanics_data": [
      {
        "mechanics_id": "M1_L",
        "language": "en",
        "image_url": "9890153d-3c51-4153-8f58-5e92caceb9b6.png",
        "syllable": [
          {
            "text": "man",
            "audio_url": "4d79ae00-3950-4b31-a53c-6fe805a6090f.wav"
          }
        ]
      }
    ],
    "imagePath": "9890153d-3c51-4153-8f58-5e92caceb9b6.png",
    "level_complexity": {
      "level": "",
      "level_competency": ""
    },
    "status": "live",
    "publisher": "ekstep",
    "language": "en",
    "contentIndex": 1,
    "tags": [
      "CEFR_GEN_M1_L1"
    ],
    "createdAt": "2025-10-27T09:43:41.695Z",
    "updatedAt": "2025-10-27T09:43:41.695Z",
    "__v": 0
  }
```

### M2 Mechanic content template

```json
{
    "contentId": "6d7b152f-29bd-4e1b-a71c-dae0e39f66f8",
    "collectionId": "d01cb440-3517-42ea-a0d0-0539567299da",
    "name": "EnglishM2-L_with_content_id",
    "contentType": "Word",
    "contentSourceData": [
      {
        "language": "en",
        "audioUrl": "6d7b152f-29bd-4e1b-a71c-dae0e39f66f8.wav",
        "inst_audioUrl":"f0a5c776-2d77-4922-95c7-677abe513ebe.wav",
        "text": "railway"
      }
    ],
    "mechanics_data": [
      {
        "mechanics_id": "M2_L",
        "image_url": "",
        "language": "en",
        "words": [
          "c",
          "rail",
          "way",
          "sa",
          "ou",
          "w",
          "jo",
          "y",
          "t",
          "ow"
        ],
        "imageAudioMap": [
          {
            "text": "railway",
            "audio_url": "fcc31b6f-1d97-4d43-9895-1d5f535cc734.wav",
            "image_url": "73257c79-4ae7-4e65-b0f4-f4f0246c5163.png",
            "multilinual_id": "railway"
          },
          {
            "text": "cow",
            "audio_url": "d841949b-990b-4928-be99-609cc77f690a.wav",
            "image_url": "1b5384a7-bf8b-437c-b828-26cbd862b094.png",
            "multilinual_id": "cow"
          },
          {
            "text": "out",
            "audio_url": "433d0079-ba11-459c-b407-901e94c7e5ed.wav",
            "image_url": "3c116e06-36d7-4fda-a81b-d1db50804b9f.png",
            "multilinual_id": "out"
          },
          {
            "text": "joy",
            "audio_url": "14260db0-96b2-4981-a1a9-f985bb7aecef.wav",
            "image_url": "b12412c7-2ab1-4c23-b4c6-17404f7225df.png",
            "multilinual_id": "joy"
          },
          {
            "text": "saw",
            "audio_url": "0b4b8d58-3f70-40aa-896a-343df0142ea2.wav",
            "image_url": "3526a7aa-a2b9-4844-a32d-0092619c29da.png",
            "multilinual_id": "saw"
          }
        ]
      }
    ],
    "level_complexity": {
      "level": "",
      "level_competency": ""
    },
    "status": "live",
    "publisher": "ekstep",
    "language": "en",
    "contentIndex": 2,
    "tags": [
      "CEFR_GEN_M2_L2"
    ],
    "createdAt": "2025-10-30T08:12:36.241Z",
    "updatedAt": "2025-10-30T08:12:36.241Z",
    "__v": 0
  }
```

### M3 Mechanic content template

```json
{
    "contentId": "7d7b152f-29bd-4e1b-a71c-dae0e39f66f8",
    "collectionId": "2a751a47-7065-44bc-8a5b-5230d1607500",
    "name": "M3-L-Flows-2.0",
    "contentType": "Sentence",
    "contentSourceData": [
      {
        "language": "en",
        "audioUrl": "7d7b152f-29bd-4e1b-a71c-dae0e39f66f8.wav",
        "inst_audioUrl":"20a5c776-2d77-4922-95c7-677abe513ebe.wav",
        "text": "Fish Swim"
      }
    ],
    "multilingual": {
      "kn": {
        "text": "ಮೀನು ಈಜುವುದು",
        "audio_url": "a071479b7f574887aceb93d8d08dbf91.wav"
      }
    },
    "mechanics_data": [
      {
        "mechanics_id": "M3_L",
        "language": "en",
        "image_url": "024d99b9-19dc-4bb7-82db-ccc5f23933f8.png",
        "options": [
          {
            "text": "Dogs Bark",
            "audio_url": "",
            "image_url": "0012d4ce-4413-496e-814f-db47e408f1b5.png",
            "isAns": false
          },
          {
            "text": "Fish Swim",
            "audio_url": "",
            "image_url": "024d99b9-19dc-4bb7-82db-ccc5f23933f8.png",
            "isAns": true
          },
          {
            "text": "It Rains",
            "audio_url": "",
            "image_url": "71d1f707-44ad-49d6-a8b5-e37096db3ec7.png",
            "isAns": false
          }
        ]
      }
    ],
    "level_complexity": {
      "level": "",
      "level_competency": ""
    },
    "status": "live",
    "publisher": "ekstep",
    "language": "en",
    "contentIndex": 2,
    "tags": [
      "CEFR_GEN_M3_L1"
    ],
    "createdAt": "2025-07-09T06:26:28.107Z",
    "updatedAt": "2025-07-09T06:26:28.107Z",
    "__v": 0
  }
```

### M4 to M6 Read along content template

```json
{
        "contentId": "9d7b152f-29bd-4e1b-a71c-dae0e39f66f8",
        "collectionId": "6cd399d1-8bb2-4c3f-aafd-b364c93a22db",
        "name": "EN-new-Tags-M4tOm6",
        "contentType": "Sentence",
        "contentSourceData": [
            {
                "language": "en",
                "audioUrl": "9d7b152f-29bd-4e1b-a71c-dae0e39f66f8.wav",
                "text": "A child sleeps.",
                "multilingual_id": [
                    "child",
                    "sleeps"
                ]
            }
        ], // For English M4 to M9, the multilingual_id array must contain words extracted from the text field that also exist in the multilingual collection.
        "status": "live",
        "publisher": "ekstep",
        "language": "en",
        "contentIndex": 1,
        "tags": [
            "M4_GEN-EN_READ"
        ]
    }
```

### M7 to M9 Read along content template

```json
{
        "contentId": "0d7b152f-29bd-4e1b-a71c-dae0e39f66f8",
        "collectionId": "8a035600-1485-427e-9332-822c0870a73d",
        "name": "EnglishM7",
        "contentType": "Paragraph",
        "contentSourceData": [
            {
                "language": "en",
                "audioUrl": "0d7b152f-29bd-4e1b-a71c-dae0e39f66f8.wav",
                "text": "Raja loved Science deeply. He refused to give up. After months of effort, the government finally gave permission.",
                "multilingual_id": [
                    "give"
                ]
            }
        ],
        "status": "live",
        "publisher": "ekstep",
        "language": "en",
        "contentIndex": 157,
        "tags": [
            "M7_GEN-EN_READ"
        ]
    }
```



### M4 to M6 Mech Content Template

```json
{
        "contentId": "5d7b152f-29bd-4e1b-a71c-dae0e39f66f8",
        "collectionId": "d6e2fc0b-e27f-4e8a-bd32-51494815e76f",
        "name": "TE_M4_MECH",
        "contentType": "Sentence",
        "contentSourceData": [
            {
                "language": "te",
                "audioUrl": "5d7b152f-29bd-4e1b-a71c-dae0e39f66f8.wav",
                "text": "నీటిలో ఏమి ఈదుతున్నది?"
            }
        ],
        "mechanics_data": [
            {
                "mechanics_id": "mechanic_1",
                "text": "సుందరం ----------------లు ఒలుస్తున్నాడు.",
                "language": "te",
                "audio_url": "818e7e9b-af3c-4018-a9ca-edf9cc7cd445.wav",
                "image_url": "d2493eeb-a135-44b1-9c8e-79154cda181b.png",
                "options": [
                    {
                        "text": "గుమ్మడికాయ",
                        "audio_url": "",
                        "image_url": "",
                        "isAns": false
                    },
                    {
                        "text": "అనపకాయ",
                        "audio_url": "",
                        "image_url": "",
                        "isAns": true
                    },
                    {
                        "text": "కాకరకాయ",
                        "audio_url": "",
                        "image_url": "",
                        "isAns": false
                    }
                ],
                "hints": {
                    "text": "",
                    "audio_url": "",
                    "image_url": ""
                },
                "time_limit": 90
            },
            {
                "mechanics_id": "mechanic_2",
                "text": "నీటిలో ఏమి ఈదుతున్నది?",
                "language": "te",
                "audio_url": "fa4b5093-e9a3-4293-89d3-1493ce253af3.wav",
                "image_url": "ec713cdf-60ac-4317-8644-88a0e489dd8b.png",
                "options": [
                    {
                        "text": "పడవ ",
                        "audio_url": "c962d9f1-ef94-4d05-8b1f-a7afc7500b63.wav",
                        "image_url": "",
                        "isAns": true
                    },
                    {
                        "text": "కడవ ",
                        "audio_url": "6095077d-a30d-4b32-9553-32761d443b2d.wav",
                        "image_url": "",
                        "isAns": false
                    },
                    {
                        "text": "చరక",
                        "audio_url": "48875929-bcc2-4ef0-81dd-8f45dec898b3.wav",
                        "image_url": "",
                        "isAns": false
                    }
                ],
                "correctness": {
                    "50%": [
                        "పడవ"
                    ]
                },
                "hints": {
                    "text": "",
                    "audio_url": "",
                    "image_url": ""
                },
                "time_limit": 90
            },
            {
                "mechanics_id": "mechanic_3",
                "jumbled_text": "ఈదుతున్నది? నీటిలో ఏమి",
                "language": "te",
                "audio_url": "14e3d7c3-55bf-4282-b0d8-47470bd1db43.wav",
                "image_url": "",
                "hints": {
                    "text": "",
                    "audio_url": "",
                    "image_url": ""
                },
                "time_limit": 90
            }
        ],
        "level_complexity": {
            "level": "",
            "level_competency": "",
            "CEFR_level": ""
        },
        "status": "live",
        "publisher": "ekstep",
        "language": "te",
        "contentIndex": 1,
        "tags": [
            "M4_TE_MECH"
        ],
        "createdAt": "2026-01-20T08:10:48.130Z",
        "updatedAt": "2026-01-20T08:10:48.130Z",
        "__v": 0
    }
```

### M7 to M9 Mech Content Template

```json
{
        "contentId": "117b152f-29bd-4e1b-a71c-dae0e39f66f8",
        "collectionId": "8d0c837c-f095-401c-b82e-fa222367885c",
        "name": "En_gen_M7_MECH",
        "contentType": "Paragraph",
        "contentSourceData": [
            {
                "language": "en",
                "audioUrl": "117b152f-29bd-4e1b-a71c-dae0e39f66f8.wav",
                "text": "Sita was coming back from school. She stood under a tree when it started raining. How many people did she see going with an umbrella?"
            }
        ],
        "mechanics_data": [
            {
                "mechanics_id": "mechanic_2",
                "text": "Sita was coming back from school. She stood under a tree when it started raining. How many people did she see going with an umbrella?",
                "language": "en",
                "audio_url": "ff87a905-51bd-46c7-a433-e87759c21173.wav",
                "image_url": "0b9e99b4-d5f2-4665-81cd-2bdef413cdbd.png",
                "options": [
                    {
                        "text": "She saw three people with an umbrella",
                        "audio_url": "0f851efd-bc64-4edf-9a2c-270b86b95cb2.wav",
                        "image_url": "",
                        "isAns": false
                    },
                    {
                        "text": "She saw a man with an umbrella",
                        "audio_url": "5b6ce023-c689-4396-8197-a953c18e3b1d.wav",
                        "image_url": "",
                        "isAns": false
                    },
                    {
                        "text": "She saw two people with an umbrella",
                        "audio_url": "d3e2c887-3b5d-4f48-a014-5de2d03fbb7e.wav",
                        "image_url": "",
                        "isAns": true
                    }
                ],
                "correctness": {
                    "50%": [
                        "umbrella",
                        "people"
                    ]
                },
                "hints": {
                    "text": "",
                    "audio_url": "",
                    "image_url": ""
                },
                "time_limit": 90
            },
            {
                "mechanics_id": "mechanic_3",
                "jumbled_text": "school. back many going started under people a an she coming it umbrella? see raining. She when did Sita with stood How from tree was",
                "language": "en",
                "audio_url": "882f40bc-d4c6-42ca-9930-7cbff50178a2.wav",
                "image_url": "",
                "hints": {
                    "text": "",
                    "audio_url": "",
                    "image_url": ""
                },
                "time_limit": 90
            }
        ],
        "level_complexity": {
            "level": "",
            "level_competency": "",
            "CEFR_level": ""
        },
        "status": "live",
        "publisher": "ekstep",
        "language": "en",
        "contentIndex": 30,
        "tags": [
            "M7_GEN-EN_MECH"
        ],
        "createdAt": "2026-02-03T09:58:01.345Z",
        "updatedAt": "2026-02-03T09:58:01.345Z",
        "__v": 0
    }
```

### M10 to M15 Mechanics Content Template

```json
{
    "contentId": "127b152f-29bd-4e1b-a71c-dae0e39f66f8",
    "collectionId": "afbd0ae7-dbeb-4440-ad40-a02e84dc8c72",
    "name": "Corrections",
    "contentType": "Sentence",
    "contentSourceData": [
        {
                "language": "en",
                "audioUrl": "127b152f-29bd-4e1b-a71c-dae0e39f66f8.wav",
                "text": "I enjoy a healthy breakfast with fruits and eggs."
        }
],
    "mechanics_data": [
    {
      "mechanics_id": "mechanic_14",
      "language": "en",
      "content_body": "{\"level\": \"S1\", \"mechanics\": \"AnouncementFlow\", \"data\": {\"instructions\": {\"type\": \"announcement\", \"imageOne\": \"69888c40-7a56-4e57-8a8c-f52e9df36dcf.png\", \"imageTwo\": \"787509c3-7041-4d11-9a4a-1ab34daad2b6.png\", \"imageThree\": \"689a4db7-1b40-4dc5-85a2-199e6da6a2aa.png\", \"content\": [{\"role\": \"System\", \"message\": \"I enjoy a healthy breakfast with fruits and eggs. Sometimes, I eat dosa. I eat breakfast with my parents before school. I love watching movies with my family. I enjoy cartoons. I also love reading picture storybooks. The illustrations help me imagine the story. I don't enjoy horror movies.\", \"audio\": \"c3c5aa85-8bcc-450d-b144-74840e0a9d35.mp3\"}]}, \"tasks\": [{\"question\": {\"type\": \"text\", \"value\": \"What does the person eat for breakfast?\"}, \"options\": [{\"type\": \"text\", \"id\": \"option1\", \"value\": \"Fruits and eggs\"}, {\"type\": \"text\", \"id\": \"option2\", \"value\": \"Only dosa\"}, {\"type\": \"text\", \"id\": \"option3\", \"value\": \"Just milk.\"}, {\"type\": \"text\", \"id\": \"option4\", \"value\": \"Only bread\"}], \"answer\": \"option1\"}, {\"question\": {\"type\": \"text\", \"value\": \"When does the person eat with their parents?\"}, \"options\": [{\"type\": \"text\", \"id\": \"option1\", \"value\": \"After school\"}, {\"type\": \"text\", \"id\": \"option2\", \"value\": \"Before school\"}, {\"type\": \"text\", \"id\": \"option3\", \"value\": \"During lunch\"}, {\"type\": \"text\", \"id\": \"option4\", \"value\": \"Midnight\"}], \"answer\": \"option2\"}, {\"question\": {\"type\": \"text\", \"value\": \"What kind of movies does the person enjoy?\"}, \"options\": [{\"type\": \"text\", \"id\": \"option1\", \"value\": \"Horror movies\"}, {\"type\": \"text\", \"id\": \"option2\", \"value\": \"Action movies\"}, {\"type\": \"text\", \"id\": \"option3\", \"value\": \"Movies with family\"}, {\"type\": \"text\", \"id\": \"option4\", \"value\": \"Cooking shows\"}], \"answer\": \"option3\"}, {\"question\": {\"type\": \"text\", \"value\": \"What helps the person imagine the story in books?\"}, \"options\": [{\"type\": \"text\", \"id\": \"option1\", \"value\": \"The cover\"}, {\"type\": \"text\", \"id\": \"option2\", \"value\": \"The title\"}, {\"type\": \"text\", \"id\": \"option3\", \"value\": \"The illustrations\"}, {\"type\": \"text\", \"id\": \"option4\", \"value\": \"They are for exams\"}], \"answer\": \"option3\"}, {\"question\": {\"type\": \"text\", \"value\": \"What type of movies does the person not enjoy?\"}, \"options\": [{\"type\": \"text\", \"id\": \"option1\", \"value\": \"Cartoons\"}, {\"type\": \"text\", \"id\": \"option2\", \"value\": \"Horror movies\"}, {\"type\": \"text\", \"id\": \"option3\", \"value\": \"Adventure movies\"}, {\"type\": \"text\", \"id\": \"option4\", \"value\": \"Science fiction movies\"}], \"answer\": \"option2\"}, {\"question\": {\"type\": \"text\", \"value\": \"Which food does the person sometimes eat for breakfast?\"}, \"options\": [{\"type\": \"text\", \"id\": \"option1\", \"value\": \"Dosa\"}, {\"type\": \"text\", \"id\": \"option2\", \"value\": \"Pizza\"}, {\"type\": \"text\", \"id\": \"option3\", \"value\": \"Burgers\"}, {\"type\": \"text\", \"id\": \"option4\", \"value\": \"Ice cream\"}], \"answer\": \"option1\"}]}}"
    }
    ],
    "level_complexity": {
        "level": "",
        "level_competency": ""
},
    "status": "live",
    "publisher": "ekstep",
    "language": "en",
    "contentIndex": 5,
    "tags": [
        "CEFR_GEN_M11_S1"
],
    "createdAt": "2025-08-20T04:07:17.236Z",
    "updatedAt": "2025-08-20T04:07:17.236Z",
    "__v": 0
  }
```