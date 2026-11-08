import type { UploadState } from '../../core/types'
import { AlertIcon, CheckIcon } from '../common/Icons'

export function UploadStatus({ state }: { state: UploadState }) {
  if (state.phase === 'idle' || state.phase === 'done') {
    if (state.phase === 'done') {
      return (
        <div className="upload-status is-success">
          <CheckIcon size={15} />
          <span>{state.message}</span>
        </div>
      )
    }
    return null
  }

  if (state.phase === 'error') {
    return (
      <div className="upload-status is-error" role="alert">
        <AlertIcon size={15} />
        <div>
          <strong>Upload failed</strong>
          <span>{state.message}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="upload-status is-busy" role="status">
      <span className="spinner" aria-hidden />
      <div>
        <strong>{state.message}</strong>
        {state.fileName ? <span>{state.fileName}</span> : null}
      </div>
    </div>
  )
}
