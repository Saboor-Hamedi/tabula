export type PricingTier = 'free' | 'pro' | 'enterprise'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete'

/**
 * Account role. `admin` is the only role that may publish posts.
 * The value is mirrored in the database as `public.app_role`.
 */
export type AppRole = 'user' | 'admin'

export interface UserProfile {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  tier: PricingTier
  role: AppRole
  created_at: string
  updated_at: string
}

export interface UserSubscription {
  id: string
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  tier: PricingTier
  status: SubscriptionStatus
  current_period_end: string | null
  cancel_at_period_end: boolean
}

/** Lifecycle of a published insight. */
export type PostStatus = 'draft' | 'published' | 'archived'

/** A single image in a post's gallery. */
export interface PostImage {
  id: string
  post_id: string
  url: string
  storage_path: string | null
  alt_text: string | null
  caption: string | null
  width: number | null
  height: number | null
  position: number
}

/**
 * A published Lumina Tabula answer.
 *
 * `blocks` carries the parsed render blocks so the public page can draw the
 * exact same markdown, Mermaid diagrams, charts and tables the admin saw.
 */
export interface Post {
  id: string
  slug: string
  title: string
  subtitle: string | null
  excerpt: string | null
  content: string
  blocks: PostBlock[]
  cover_image_url: string | null
  cover_caption: string | null
  source_message_id: string | null
  source_session_id: string | null
  dataset_name: string | null
  model: string | null
  author_id: string | null
  author_name: string | null
  author_avatar_url: string | null
  status: PostStatus
  tags: string[]
  featured: boolean
  reading_time_minutes: number
  view_count: number
  published_at: string | null
  created_at: string
  updated_at: string
}

/** The subset of a post the public feed needs. */
export type PostSummary = Omit<Post, 'blocks'> & {
  blocks?: PostBlock[]
  post_images?: Pick<PostImage, 'url' | 'alt_text' | 'position'>[]
}

/**
 * Render blocks stored on a post.
 *
 * This mirrors `ContentBlock` in `core/types` but is declared separately so the
 * database shape stays decoupled from the in-memory renderer.
 */
export type PostBlock =
  | { type: 'markdown'; content: string }
  | { type: 'mermaid'; code: string }
  | {
      type: 'chart'
      chart:
        | {
            type: 'elbow'
            title: string
            xLabel: string
            yLabel: string
            points: { x: number; y: number }[]
            elbowX: number
            elbowLabel?: string
            note?: string
            textColor?: string
          }
        | {
            type: 'series'
            kind: 'bar' | 'line' | 'scatter'
            title: string
            xLabel: string
            yLabel: string
            points: { label: string; value: number }[]
            highlightIndex?: number
            highlightLabel?: string
            note?: string
            textColor?: string
          }
    }
  | {
      type: 'table'
      headers: string[]
      rows: string[][]
      alignments?: ('left' | 'right' | 'center')[]
    }
