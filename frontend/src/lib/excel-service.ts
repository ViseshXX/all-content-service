import ExcelJS from 'exceljs'
import type { TemplateType, Language } from '@/types'


function addStyledSheet(workbook: ExcelJS.Workbook, name: string, columns: string[]): void {
  const sheet = workbook.addWorksheet(name)
  sheet.addRow(columns)
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    }
  })
  sheet.columns.forEach((col) => {
    col.width = 20
  })
}

export async function downloadExcelTemplate(config: {
  templateType: TemplateType
  language: Language
  targetLanguages: string
}): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const t = config.templateType

  const isM1M2M3   = /\b(M1|M2|M3)\b/.test(t)
  const isM4toM9   = /\b(M4|M5|M6|M7|M8|M9)\b/.test(t)
  const isM10toM15 = /\b(M10|M11|M12|M13|M14|M15)\b/.test(t)
  const isMechanics = t.toLowerCase().includes('mechanic')

  // ── Multilingual branch ──────────────────────────────────────────────────
  if (t === 'Multilingual') {
    const indicLanguages = ['hindi', 'tamil', 'telugu', 'kannada', 'gujarati', 'marathi']
    const cols: string[] = ['multilingual_id', 'content_id', 'image_path']
    for (const displayName of indicLanguages) {
      cols.push(`${displayName}_text`, `${displayName}_audio`)
    }
    addStyledSheet(workbook, 'multilingual', cols)
  }

  // ── Collection branch ────────────────────────────────────────────────────
  else if (t === 'Collection') {
    addStyledSheet(workbook, 'collection', [
      'name', 'description', 'category', 'author', 'language', 'status', 'tags',
    ])
  }

  // ── M1/M2/M3 Read Along — fixed schema, no audio_source or name column ─────
  // Multilingual columns are added only when the primary language is English.
  else if (t === 'M1 to M2 Read Along Content' || t === 'M3 Read Along Content') {
    const baseCols = [
      'contentType', 'language', 'text', 'audio_file', 'image',
      'instruction_audio_file', 'tags',
    ]
    const isEnglish =
      config.language === 'en' || config.language.toLowerCase() === 'english'
    const mlCols: string[] = isEnglish
      ? [
          'multilingual kn text', 'multilingual kn audio',
          'multilingual te text', 'multilingual te audio',
          'multilingual hi text', 'multilingual hi audio',
          'multilingual ta text', 'multilingual ta audio',
          'multilingual gu text', 'multilingual gu audio',
          'multilingual ma text', 'multilingual ma audio',
        ]
      : []
    addStyledSheet(workbook, 'read along', [...baseCols, ...mlCols])
  }

  // ── Standard M-Series branch ─────────────────────────────────────────────
  else {
    const isEnglish      = config.language === 'en' || config.language.toLowerCase() === 'english'
    const isM1Mechanics  = (t === 'M1 Mechanics Content')
    const isM2Mechanics  = (t === 'M2 Mechanics Content')
    const isM3Mechanics  = (t === 'M3 Mechanics Content')
    const isM4M7Mechanics = (t === 'M4 to M6 Mechanics Content' || t === 'M7 to M9 Mechanics Content')

    // ── M1/M2/M3 Mechanics read along tab: mirrors M1-M3 Read Along layout ────
    // No name (set from xlsx filename), no status/publisher (static live/ekstep),
    // no instruction_audio_file (not needed). Multilingual cols added for English.
    if (isM1Mechanics || isM2Mechanics || isM3Mechanics) {
      const cols: string[] = ['contentType', 'language', 'text', 'audio_file', 'tags', 'image']
      if (isEnglish) {
        cols.push(
          'multilingual kn text', 'multilingual kn audio',
          'multilingual te text', 'multilingual te audio',
          'multilingual hi text', 'multilingual hi audio',
          'multilingual ta text', 'multilingual ta audio',
          'multilingual gu text', 'multilingual gu audio',
          'multilingual ma text', 'multilingual ma audio',
        )
      }
      addStyledSheet(workbook, 'read along', cols)
    } else if (isM4M7Mechanics) {
      // M4-M9 Mechanics read along tab: same base as M1-M3 Mechanics but uses
      // multilingual_id references (Two-Pass) instead of inline multilingual columns.
      // No name (set from xlsx filename), static status/publisher.
      const cols: string[] = ['contentType', 'language', 'text', 'audio_file', 'tags', 'image']
      if (isEnglish) {
        cols.push('multilingual_id') // comma-separated word IDs for Two-Pass lookup
      }
      addStyledSheet(workbook, 'read along', cols)
    } else if (isM10toM15 && isMechanics) {
      // M10-M15 Mechanics read along tab: same structure as M4-M9 Mechanics.
      // No name (set from xlsx filename), status=live and publisher=ekstep are static.
      const cols: string[] = ['contentType', 'language', 'text', 'audio_file', 'tags', 'image']
      if (isEnglish) {
        cols.push('multilingual_id') // required for English; ignored for Indic
      }
      addStyledSheet(workbook, 'read along', cols)
    } else if (t === 'Textbook image mechanic') {
      // Same columns as M7-M9 Read Along. image is required for this template.
      // No mechanic tab despite "mechanic" in the name.
      const cols: string[] = ['contentType', 'language', 'text', 'audio_file', 'name', 'tags', 'image']
      if (isEnglish) {
        cols.push('multilingual_words')
      }
      addStyledSheet(workbook, 'read along', cols)
    } else {
      // M4-M9 Read Along templates.
      const readAlongCols: string[] = [
        'contentType', 'language', 'text', 'audio_file', 'name', 'tags', 'image',
      ]

      if (isM1M2M3) {
        readAlongCols.push('instruction_audio_file')
      }

      // multilingual_words is only used for English Read Along content (not Indic, not Mechanics)
      if (isM4toM9 && !isMechanics && isEnglish) {
        readAlongCols.push('multilingual_words')
      }

      addStyledSheet(workbook, 'read along', readAlongCols)
    }

    // Mechanic tabs
    if (isMechanics) {
      if (/\bM1\b/.test(t)) {
        addStyledSheet(workbook, 'mechanic', [
          'image',
          ...[1, 2, 3].flatMap((i) => [
            `syllable_${i}_text`,
            `syllable_${i}_audio_file`,
          ]),
        ])
      }

      if (/\bM2\b/.test(t)) {
        addStyledSheet(workbook, 'mechanic', [
          ...[1, 2, 3, 4, 5].flatMap((i) => [
            `text_${i}`,
            `audio_file_${i}`,
            `image_file_${i}`,
          ]),
        ])
      }

      if (/\bM3\b/.test(t)) {
        addStyledSheet(workbook, 'mechanic', [
          'correct text',
          'correct image',
          ...[1, 2, 3].flatMap((i) => [`text${i}`, `image${i}`]),
        ])
      }

      if (isM4M7Mechanics) {
        // Fill in the blanks tab → mechanic_1
        // 'audio' (not 'audio_file') so it goes through preprocessRowAssets → mechanics_audios/
        // 'complete text' is TTS source; NOT stored in JSON
        addStyledSheet(workbook, 'fill in the blanks', [
          'complete text', 'audio', 'text with blank', 'image',
          'correct option', 'option1', 'option2', 'option3',
        ])
        // MCQ tab → mechanic_2
        // mechanic_3 is auto-generated from read along text — no tab needed
        addStyledSheet(workbook, 'mcq', [
          'question text', 'question audio', 'image',
          'correct text', 'correct audio',
          'option1', 'audio1', 'option2', 'audio2', 'option3', 'audio3',
        ])
      } else if (isM4toM9) {
        // M4-M9 Read Along Mechanics (legacy path — not used in new spec)
        addStyledSheet(workbook, 'fill in the blanks', [
          'text', 'audio_file', 'image',
          'hint_text', 'hint_audio', 'hint_image', 'time_limit',
          'option_1', 'option_2', 'option_3',
        ])
        addStyledSheet(workbook, 'mcq', [
          'text', 'audio_file', 'image',
          'hint_text', 'hint_audio', 'hint_image', 'time_limit',
          'option_1', 'option_2', 'option_3', 'partial_credit_words',
        ])
      }

      if (isM10toM15) {
        addStyledSheet(workbook, 'mechanic', ['mechanics_id', 'content_body'])
      }
    }
  }

  // ── Safe download ────────────────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${t}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
