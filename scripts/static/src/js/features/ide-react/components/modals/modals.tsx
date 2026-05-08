import { memo } from 'react'
import ForceDisconnected from '@/features/ide-react/components/modals/force-disconnected'
import { UnsavedDocs } from '@/features/ide-react/components/unsaved-docs/unsaved-docs'
import SystemMessages from '@/shared/components/system-messages'
import ProjectConvertedFromDocxModal from '@/features/ide-react/components/modals/project-converted-from-docx-modal'

export const Modals = memo(() => {
  return (
    <>
      <ForceDisconnected />
      <UnsavedDocs />
      <SystemMessages />
      <ProjectConvertedFromDocxModal />
    </>
  )
})
Modals.displayName = 'Modals'
