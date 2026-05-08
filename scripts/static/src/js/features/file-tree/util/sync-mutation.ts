import { postJSON, deleteJSON } from '../../../infrastructure/fetch-json'
import { Folder } from '@ol-types/folder'
import { Doc } from '@ol-types/doc'

// Offline build: upstream's server broadcasts a `recive*` socket event after
// every successful write; the client's file-tree-socket-listener listens for
// those and updates the tree. We have no real server, so after the local
// middleware POST resolves we fire the matching event ourselves through the
// SocketShimNoop singleton (`window.__socket`).
function notifySocket(event: string, ...args: unknown[]) {
  const sock = (window as any).__socket
  if (sock?._simulate) sock._simulate(event, ...args)
}

export function syncRename(
  projectId: string,
  entityType: string,
  entityId: string,
  newName: string
) {
  return postJSON(
    `/project/${projectId}/${getEntityPathName(entityType)}/${entityId}/rename`,
    {
      body: {
        name: newName,
      },
    }
  ).then(response => {
    notifySocket('reciveEntityRename', entityId, newName)
    return response
  })
}

export function syncDelete(
  projectId: string,
  entityType: string,
  entityId: string
) {
  return deleteJSON(
    `/project/${projectId}/${getEntityPathName(entityType)}/${entityId}`
  ).then(response => {
    notifySocket('removeEntity', entityId)
    return response
  })
}

export function syncMove(
  projectId: string,
  entityType: string,
  entityId: string,
  toFolderId: string
) {
  return postJSON(
    `/project/${projectId}/${getEntityPathName(entityType)}/${entityId}/move`,
    {
      body: {
        folder_id: toFolderId,
      },
    }
  ).then(response => {
    notifySocket('reciveEntityMove', entityId, toFolderId)
    return response
  })
}

export type NewDocEntity = {
  endpoint: 'doc'
  name: string
}

export type NewFolderEntity = {
  endpoint: 'folder'
  name: string
}

export type NewLinkedFileEntity = {
  endpoint: 'linked_file'
  name: string
  provider: string
  data: Record<string, any>
}

export type NewEntity = NewDocEntity | NewFolderEntity | NewLinkedFileEntity

type SyncCreateEntityReturn<T> = T extends NewDocEntity
  ? Promise<Doc>
  : T extends NewFolderEntity
    ? Promise<Folder>
    : T extends NewLinkedFileEntity
      ? Promise<{ new_file_id: string }>
      : never

export function syncCreateEntity<T extends NewEntity>(
  projectId: string,
  parentFolderId: string,
  newEntityData: T
): SyncCreateEntityReturn<T> {
  const { endpoint, ...newEntity } = newEntityData
  return postJSON(`/project/${projectId}/${endpoint}`, {
    body: {
      parent_folder_id: parentFolderId,
      ...newEntity,
    },
  }).then((response: any) => {
    // Offline build: simulate the server's recive* broadcast.
    if (endpoint === 'folder') {
      notifySocket('reciveNewFolder', parentFolderId, response)
    } else if (endpoint === 'doc') {
      notifySocket('reciveNewDoc', parentFolderId, response, undefined)
    } else if (endpoint === 'linked_file') {
      // linked_file POST returns `{ new_file_id }`; the client fetches the
      // full entity later. Skip the synthetic event here to avoid passing a
      // partial shape — uploads use a separate Uppy success path anyway.
    }
    return response
  }) as SyncCreateEntityReturn<T>
}

function getEntityPathName(entityType: string) {
  return entityType === 'fileRef' ? 'file' : entityType
}

export function syncRootDocId(projectId: string, rootDocId: string) {
  return postJSON(`/project/${projectId}/settings`, {
    body: { rootDocId },
  })
}
