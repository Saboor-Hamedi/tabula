import {
  detectVisitorPlatform,
  formatBytes,
  LUMINA_RELEASES_URL,
  recordLuminaDownload,
  type LuminaInstallerAsset,
  type LuminaPlatform,
  type LuminaReleaseInfo,
} from '../api/release'

function WindowsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M2 3.75L10.75 2.5v8.75H2V3.75zm9.75-1.4L22 1v10.25H11.75V2.35zM2 12.75h8.75v8.75L2 20.25v-7.5zm9.75 0H22V23l-10.25-1.35v-8.9z" />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.96 6.33c.64-.78 1.08-1.86.96-2.94-.93.04-2.06.62-2.72 1.4-.58.68-1.1 1.79-.96 2.84 1.04.08 2.08-.52 2.72-1.3z" />
    </svg>
  )
}

function LinuxIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M7 9l3 3-3 3" />
      <path d="M13 15h4" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

export function InstallerGrid({ release }: { release: LuminaReleaseInfo }) {
  const detectedOs: LuminaPlatform = detectVisitorPlatform()

  const handleDownload = (asset: LuminaInstallerAsset) => {
    recordLuminaDownload(asset, release.version)
  }

  return (
    <section className="lumina-installers-section" aria-label="Download Lumina Installers">
      <div className="lumina-installers-header">
        <div className="lumina-installers-heading-group">
          <span className="lumina-installers-kicker">
            Official Desktop Installers
            {release.version ? ` · ${release.version}` : ''}
          </span>
          <h3 className="lumina-installers-title">
            Download for Windows, macOS &amp; Linux
          </h3>
        </div>

        <a
          href={release.htmlUrl || LUMINA_RELEASES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="lumina-installers-gh-link"
        >
          <span>All release assets</span>
          {release.version ? (
            <span className="lumina-release-live-pill">{release.version}</span>
          ) : null}
        </a>
      </div>

      <div className="lumina-installers-grid">
        {/* Windows Installer Card */}
        <div
          className={`lumina-installer-card ${detectedOs === 'windows' ? 'is-recommended' : ''}`}
        >
          <div className="lumina-installer-card-body">
            <div className="lumina-installer-card-top">
              <div className="lumina-installer-os-icon">
                <WindowsIcon />
              </div>
              <div className="lumina-installer-os-meta">
                <div className="lumina-installer-os-row">
                  <span className="lumina-installer-os-name">Windows</span>
                  {detectedOs === 'windows' ? (
                    <span className="lumina-installer-rec-badge">Detected</span>
                  ) : null}
                </div>
                <span className="lumina-installer-os-arch">Windows 10 &amp; 11 (64-bit x64)</span>
              </div>
            </div>

            <div className="lumina-installer-formats">
              <span className="lumina-format-tag">NSIS .exe</span>
              <span className="lumina-format-tag">MSI .msi</span>
              <span className="lumina-format-tag">WebView2</span>
            </div>
          </div>

          <div className="lumina-installer-actions">
            <a
              href={release.windows.exe.url}
              target="_blank"
              rel="noopener noreferrer"
              className="lumina-installer-btn is-primary"
              onClick={() => handleDownload(release.windows.exe)}
            >
              <DownloadIcon />
              <span className="lumina-installer-btn-label">Download Windows (.exe)</span>
              {formatBytes(release.windows.exe.sizeBytes) ? (
                <span className="lumina-installer-size">
                  {formatBytes(release.windows.exe.sizeBytes)}
                </span>
              ) : null}
            </a>

            <a
              href={release.windows.msi.url}
              target="_blank"
              rel="noopener noreferrer"
              className="lumina-installer-btn is-secondary"
              onClick={() => handleDownload(release.windows.msi)}
            >
              <span className="lumina-installer-btn-label">Windows MSI Installer (.msi)</span>
            </a>
          </div>
        </div>

        {/* macOS Installer Card */}
        <div
          className={`lumina-installer-card ${detectedOs === 'macos' ? 'is-recommended' : ''}`}
        >
          <div className="lumina-installer-card-body">
            <div className="lumina-installer-card-top">
              <div className="lumina-installer-os-icon">
                <AppleIcon />
              </div>
              <div className="lumina-installer-os-meta">
                <div className="lumina-installer-os-row">
                  <span className="lumina-installer-os-name">macOS</span>
                  {detectedOs === 'macos' ? (
                    <span className="lumina-installer-rec-badge">Detected</span>
                  ) : null}
                </div>
                <span className="lumina-installer-os-arch">
                  macOS 11+ (Apple Silicon &amp; Intel)
                </span>
              </div>
            </div>

            <div className="lumina-installer-formats">
              <span className="lumina-format-tag">Universal .dmg</span>
              <span className="lumina-format-tag">M1–M4 + Intel</span>
            </div>
          </div>

          <div className="lumina-installer-actions">
            <a
              href={release.macos.dmg.url}
              target="_blank"
              rel="noopener noreferrer"
              className="lumina-installer-btn is-primary"
              onClick={() => handleDownload(release.macos.dmg)}
            >
              <DownloadIcon />
              <span className="lumina-installer-btn-label">Download macOS (.dmg)</span>
              {formatBytes(release.macos.dmg.sizeBytes) ? (
                <span className="lumina-installer-size">
                  {formatBytes(release.macos.dmg.sizeBytes)}
                </span>
              ) : null}
            </a>

            <a
              href={release.htmlUrl || LUMINA_RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="lumina-installer-btn is-secondary"
            >
              <span className="lumina-installer-btn-label">View macOS Tarball &amp; Checksums</span>
            </a>
          </div>
        </div>

        {/* Linux Installer Card */}
        <div
          className={`lumina-installer-card ${detectedOs === 'linux' ? 'is-recommended' : ''}`}
        >
          <div className="lumina-installer-card-body">
            <div className="lumina-installer-card-top">
              <div className="lumina-installer-os-icon">
                <LinuxIcon />
              </div>
              <div className="lumina-installer-os-meta">
                <div className="lumina-installer-os-row">
                  <span className="lumina-installer-os-name">Linux</span>
                  {detectedOs === 'linux' ? (
                    <span className="lumina-installer-rec-badge">Detected</span>
                  ) : null}
                </div>
                <span className="lumina-installer-os-arch">
                  Ubuntu, Debian, Fedora &amp; Arch (x86_64)
                </span>
              </div>
            </div>

            <div className="lumina-installer-formats">
              <span className="lumina-format-tag">.AppImage</span>
              <span className="lumina-format-tag">Debian .deb</span>
            </div>
          </div>

          <div className="lumina-installer-actions">
            <a
              href={release.linux.appImage.url}
              target="_blank"
              rel="noopener noreferrer"
              className="lumina-installer-btn is-primary"
              onClick={() => handleDownload(release.linux.appImage)}
            >
              <DownloadIcon />
              <span className="lumina-installer-btn-label">Download Linux (.AppImage)</span>
              {formatBytes(release.linux.appImage.sizeBytes) ? (
                <span className="lumina-installer-size">
                  {formatBytes(release.linux.appImage.sizeBytes)}
                </span>
              ) : null}
            </a>

            <a
              href={release.linux.deb.url}
              target="_blank"
              rel="noopener noreferrer"
              className="lumina-installer-btn is-secondary"
              onClick={() => handleDownload(release.linux.deb)}
            >
              <span className="lumina-installer-btn-label">Debian / Ubuntu Package (.deb)</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
