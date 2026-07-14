import * as React from 'react'
import { WizardForm } from '@/components/bulk-upload/WizardForm'
import { UploadZone } from '@/components/bulk-upload/UploadZone'
import { JobProgress } from '@/components/bulk-upload/JobProgress'
import { useSubmitBulkUpload } from '@/hooks/useBulkUpload'
import type { WizardConfig, TemplateType } from '@/types'

export function BulkUploadPage() {
  const [step, setStep] = React.useState<1 | 2 | 3>(1)
  const [wizardConfig, setWizardConfig] = React.useState<WizardConfig | null>(null)
  const [uploadTemplateType, setUploadTemplateType] = React.useState<TemplateType | null>(null)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [activeJobId, setActiveJobId] = React.useState<string | null>(null)

  const uploadMutation = useSubmitBulkUpload()

  function handleWizardSubmit(config: WizardConfig) {
    setWizardConfig(config)
    setUploadTemplateType(config.templateType)
    setStep(2)
  }

  function handleUpload() {
    if (!selectedFile || !wizardConfig || !uploadTemplateType) return

    const finalConfig: WizardConfig = { ...wizardConfig, templateType: uploadTemplateType }

    uploadMutation.mutate(
      { file: selectedFile, wizard: finalConfig },
      {
        onSuccess: (data) => {
          setActiveJobId(data.jobId)
          setStep(3)
        },
      },
    )
  }

  function handleStartOver() {
    setStep(1)
    setWizardConfig(null)
    setUploadTemplateType(null)
    setSelectedFile(null)
    setActiveJobId(null)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bulk Upload</h1>

      {step === 1 && <WizardForm onSubmit={handleWizardSubmit} />}

      {step === 2 && wizardConfig && uploadTemplateType && (
        <UploadZone
          file={selectedFile}
          onFileChange={setSelectedFile}
          onUpload={handleUpload}
          onBack={() => setStep(1)}
          isUploading={uploadMutation.isPending}
          templateType={uploadTemplateType}
          onTemplateTypeChange={setUploadTemplateType}
        />
      )}

      {step === 3 && activeJobId && (
        <JobProgress jobId={activeJobId} onStartOver={handleStartOver} />
      )}
    </div>
  )
}
