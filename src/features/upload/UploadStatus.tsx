import type { UploadQueueItem, UploadState } from '../../core/types'
import { AlertIcon, CheckIcon } from '../common/Icons'

function renderItem(item: { phase: UploadQueueItem['phase']; fileName: string | null; message: string }, key?: string) {
  if (item.phase === 'done') {
    return (
      <div key={key} className="upload-status is-success">
        <CheckIcon size={15} />
        <div>
          {item.fileName ? <strong>{item.fileName}</strong> : null}
          <span>{item.message}</span>
        </div>
      </div>
    )
  }

  if (item.phase === 'error') {
    return (
      <div key={key} className="upload-status is-error" role="alert">
        <AlertIcon size={15} />
        <div>
          <strong>{item.fileName || 'Upload failed'}</strong>
          <span>{item.message}</span>
        </div>
      </div>
    )
  }

  return (
    <div key={key} className="upload-status is-busy" role="status">
      <span className="spinner" aria-hidden />
      <div>
        <strong>{item.fileName || item.message}</strong>
        {item.fileName ? <span>{item.message}</span> : null}
      </div>
    </div>
  )
}

export function UploadStatus({
  state,
  queue,
}: {
  state: UploadState
  queue?: UploadQueueItem[]
}) {
  if (queue && queue.length > 0) {
    return (
      <div className="upload-status-list">
        {queue.map((item) => renderItem(item, item.id))}
      </div>
    )
  }

  if (state.phase === 'idle') {
    return null
  }

  return renderItem(state)
}
