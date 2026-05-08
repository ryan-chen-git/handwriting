import { useTranslation } from 'react-i18next'
import useSocketListener from '@/features/ide-react/hooks/use-socket-listener'
import { useProjectContext } from '@/shared/context/project-context'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { useModalsContext } from '@/features/ide-react/context/modals-context'
import { useCallback } from 'react'
import { PublicAccessLevel } from '../../../../../types/public-access-level'
import { useLocation } from '@/shared/hooks/use-location'

function useSocketListeners() {
  const { t } = useTranslation()
  const { socket } = useConnectionContext()
  const { showGenericMessageModal } = useModalsContext()
  const { updateProject } = useProjectContext()
  const location = useLocation()

  useSocketListener(
    socket,
    'project:access:revoked',
    useCallback(() => {
      showGenericMessageModal(
        t('removed_from_project'),
        t(
          'you_have_been_removed_from_this_project_and_will_be_redirected_to_project_dashboard'
        )
      )

      // redirect to project page before reconnect timer runs out and reloads the page
      const timer = window.setTimeout(() => {
        location.assign('/project')
      }, 5000)

      return () => {
        window.clearTimeout(timer)
      }
    }, [showGenericMessageModal, t, location])
  )

  useSocketListener(
    socket,
    'project:publicAccessLevel:changed',
    useCallback(
      (data: { newAccessLevel?: PublicAccessLevel }) => {
        if (data.newAccessLevel) {
          updateProject({ publicAccessLevel: data.newAccessLevel })
        }
      },
      [updateProject]
    )
  )

  useSocketListener(
    socket,
    'mainBibliographyDocUpdated',
    useCallback(
      (payload: string) => {
        updateProject({ mainBibliographyDocId: payload })
      },
      [updateProject]
    )
  )

  useSocketListener(
    socket,
    'projectNameUpdated',
    useCallback(
      (payload: string) => {
        updateProject({ name: payload })
      },
      [updateProject]
    )
  )
}

export default useSocketListeners
