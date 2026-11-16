import type { UploadQueueItem, UploadState } from '../../core/types'
import { AlertIcon } from '../common/Icons'

function renderItem(
  item: { phase: UploadQueueItem['phase']; fileName: string | null; message: string },
  showBusy: boolean,
  key?: string,
) {
  if (item.phase === 'done') {
    return null
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

  if (!showBusy) {
    return null
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
  showBusy = false,
}: {
  state: UploadState
  queue?: UploadQueueItem[]
  showBusy?: boolean
}) {
  if (queue && queue.length > 0) {
    const visibleItems = queue.filter(
      (item) => item.phase === 'error' || (showBusy && item.phase !== 'done'),
    )
    if (visibleItems.length === 0) return null
    return (
      <div className="upload-status-list">
        {visibleItems.map((item) => renderItem(item, showBusy, item.id))}
      </div>
    )
  }

  if (state.phase === 'idle' || state.phase === 'done') {
    return null
  }

  if (state.phase !== 'error' && !showBusy) {
    return null
  }

  return renderItem(state, showBusy)
}
