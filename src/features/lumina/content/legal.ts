import type { LuminaDocPageDef } from './types'

export const LEGAL_DOCS: LuminaDocPageDef[] = [
  {
    slug: 'privacy',
    path: '/lumina/privacy',
    section: 'Legal',
    title: 'Privacy Policy',
    navLabel: 'Privacy Policy',
    subtitle:
      'Official Privacy Policy for the Lumina desktop application, including local-first storage guarantees and Google API Services User Data Policy compliance.',
    summary:
      'Lumina Privacy Policy and Google API Services Limited Use compliance disclosure.',
    sortOrder: 70,
    content: `## 1. Overview

**Lumina** is a local-first desktop application developed by **Saboor Hamedi**. Lumina is architected so that your personal notes, knowledge graph, and workspace files remain under your direct physical ownership.

## 2. Local Storage First

All notes, vaults, canvases, tags, and snippets are stored directly on the user's personal computer as plain-text \`.md\` and \`.canvas\` files. Lumina does not operate proprietary tracking servers or centralized databases storing personal notes.

## 3. Google User Data & Limited Use Disclosure

Lumina provides an optional Google Account connection that users may explicitly enable for:

- **Google Drive:** Storing vault backups (single note exports, bulk folder mirrors, or compressed ZIP workspace backups) directly in the user's own Google Drive.
- **Gmail:** Reading, organizing, and sending emails directly from the Lumina desktop interface at the user's explicit direction.

> [!IMPORTANT]
> **Google API Services User Data Policy Compliance:** Lumina's use and transfer of information received from Google APIs to any other app will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

## 4. How Google Data is Handled

- **No Third-Party Sharing:** Google user data accessed by Lumina is never sold, rented, shared, or transferred to third parties, advertisers, or data brokers.
- **No Human Access:** No person or developer has access to your private emails or Google Drive files. All API calls happen locally on the user's machine over HTTPS directly to Google's official endpoints.
- **Secure Local Token Storage:** OAuth 2.0 tokens are stored securely on the user's local device and are only refreshed directly with Google's official OAuth 2.0 servers.

## 5. Data Deletion & Revoking Access

Users retain complete control over their data and can revoke Google Account access at any time by:
1. Logging out of Google integrations inside **Lumina Settings**, which immediately purges local OAuth tokens from the device; or
2. Revoking Lumina's permissions directly from their Google Account security dashboard at [https://myaccount.google.com/permissions](https://myaccount.google.com/permissions).

Because all vault notes and backups reside locally on your computer (and in your own Google Drive if backup is used), you may delete your files at any time using your operating system or Google Drive interface.

## 6. Contact

If you have any questions about this Privacy Policy or Lumina's data practices, please contact:

- **Developer:** Saboor Hamedi
- **Email:** [saboorhamedi49@gmail.com](mailto:saboorhamedi49@gmail.com)
- **GitHub Repository:** [https://github.com/Saboor-Hamedi/lumina](https://github.com/Saboor-Hamedi/lumina)`,
  },
  {
    slug: 'terms',
    path: '/lumina/terms',
    section: 'Legal',
    title: 'Terms of Service',
    navLabel: 'Terms of Service',
    subtitle:
      'Official Terms of Service governing the download, installation, and use of the Lumina desktop application.',
    summary: 'Lumina Terms of Service.',
    sortOrder: 80,
    content: `## 1. Acceptance of Terms

By downloading, installing, accessing, or using **Lumina** ("the Software"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not download, install, or use the Software.

## 2. Description of Service

Lumina is an open-source, local-first desktop application released under the MIT License for Markdown note-taking, spatial canvas diagramming (\`.canvas\`), 2D/3D knowledge graph visualization, AI assistance, integrated native terminal emulation, and optional user-controlled cloud backup and email integrations.

## 3. User Responsibilities

Because Lumina is a local-first desktop application without a central custodial server, you are solely responsible for:
- Maintaining the confidentiality, security, and backups of your local notes, vault directories, API keys, encryption keys, and OAuth tokens stored on your device.
- Ensuring that your use of the Software, local terminal commands, and connected APIs complies with all applicable laws and regulations.

## 4. Third-Party Integrations

Lumina allows you to optionally connect third-party services—including **Google Drive**, **Gmail**, and user-configured AI providers (**Ollama**, **DeepSeek**, **OpenAI**, **Anthropic Claude**). Your use of those third-party services is subject to their respective terms of service and privacy policies. Lumina is not responsible for the availability, policies, or actions of third-party providers.

## 5. Disclaimer of Warranties

THE SOFTWARE IS PROVIDED **"AS IS"** AND **"AS AVAILABLE"**, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT.

## 6. Limitation of Liability

IN NO EVENT SHALL THE AUTHORS, DEVELOPERS, OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES, DATA LOSS, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## 7. Contact Information

For questions regarding these Terms of Service, please contact:

- **Developer:** Saboor Hamedi
- **Email:** [saboorhamedi49@gmail.com](mailto:saboorhamedi49@gmail.com)
- **GitHub Repository:** [https://github.com/Saboor-Hamedi/lumina](https://github.com/Saboor-Hamedi/lumina)`,
  },
]
