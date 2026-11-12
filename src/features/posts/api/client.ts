import { supabase } from '../../../core/supabase/client'
import type {
  Post,
  PostImage,
  PostStatus,
  PostSummary,
} from '../../../core/supabase/types'
import { buildSlug, type DraftImage, type PostDraft } from '../lib/compose'

/**
 * Data access for published insights.
 *
 * Every request goes through PostgREST, so the RLS policies in
 * `features/migration/migration.sql` are the authority on who may read and
 * who may write. The client never sends an author id or a publish date.
 */

const POSTS = 'posts'
const POST_IMAGES = 'post_images'
const MEDIA_BUCKET = 'post-media'

const SUMMARY_COLUMNS =
  'id, slug, title, subtitle, excerpt, cover_image_url, cover_caption, tags, featured, reading_time_minutes, view_count, author_name, author_avatar_url, dataset_name, model, published_at, created_at, updated_at'

export interface PublishInput extends PostDraft {
  /** The chat message this post was written from. */
  sourceMessageId?: string | null
  sourceSessionId?: string | null
  datasetName?: string | null
  model?: string | null
  status?: PostStatus
}

export interface FeedOptions {
  limit?: number
  offset?: number
  tag?: string | null
  search?: string | null
}

export interface PostDetail {
  post: Post
  images: PostImage[]
}

export class PostError extends Error {
  cause: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'PostError'
    this.cause = cause
  }
}

function requireClient() {
  if (!supabase) {
    throw new PostError(
      'Supabase is not configured, so insights cannot be published yet.',
    )
  }
  return supabase
}

export interface FeedPage {
  posts: PostSummary[]
  total: number
}

/** Reads a paginated slice of published posts with total count. */
export async function listPublishedPostsPage(
  options: FeedOptions = {},
): Promise<FeedPage> {
  const client = requireClient()
  const limit = options.limit ?? 24
  const offset = options.offset ?? 0

  let query = client
    .from(POSTS)
    .select(SUMMARY_COLUMNS, { count: 'exact' })
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .order('featured', { ascending: false })
    .range(offset, offset + limit - 1)

  if (options.tag) {
    query = query.contains('tags', [options.tag])
  }

  if (options.search && options.search.trim().length > 0) {
    const term = options.search.trim().replace(/[%,()]/g, ' ')
    query = query.or(
      `title.ilike.*${term}*,excerpt.ilike.*${term}*,subtitle.ilike.*${term}*,dataset_name.ilike.*${term}*`,
    )
  }

  const { data, count, error } = await query
  if (error) throw new PostError(error.message, error)
  const posts = (data ?? []) as PostSummary[]
  return { posts, total: count ?? posts.length }
}

/** Reads the published feed. Works for signed-out visitors. */
export async function listPublishedPosts(
  options: FeedOptions = {},
): Promise<PostSummary[]> {
  const { posts } = await listPublishedPostsPage(options)
  return posts
}

/** Reads one published post with its gallery. */
export async function fetchPostBySlug(slug: string): Promise<PostDetail | null> {
  const client = requireClient()

  const { data, error } = await client
    .from(POSTS)
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new PostError(error.message, error)
  if (!data) return null

  const post = data as Post

  const { data: imageRows, error: imageError } = await client
    .from(POST_IMAGES)
    .select('*')
    .eq('post_id', post.id)
    .order('position', { ascending: true })

  if (imageError) throw new PostError(imageError.message, imageError)

  return { post, images: (imageRows ?? []) as PostImage[] }
}

/** Publishes a post. Only an administrator's token passes the RLS policy. */
export async function publishPost(input: PublishInput): Promise<Post> {
  const client = requireClient()

  const { data, error } = await client
    .from(POSTS)
    .insert({
      slug: buildSlug(input.title),
      title: input.title,
      subtitle: input.subtitle,
      excerpt: input.excerpt,
      content: input.content,
      blocks: input.blocks,
      cover_image_url: input.coverImageUrl,
      cover_caption: input.coverCaption,
      source_message_id: input.sourceMessageId ?? null,
      source_session_id: input.sourceSessionId ?? null,
      dataset_name: input.datasetName ?? null,
      model: input.model ?? null,
      status: input.status ?? 'published',
      tags: input.tags,
      featured: false,
      reading_time_minutes: input.readingTimeMinutes,
    })
    .select('*')
    .single()

  if (error) {
    const denied = error.code === '42501' || /row-level security/i.test(error.message)
    throw new PostError(
      denied
        ? 'Only administrators can publish insights.'
        : error.message,
      error,
    )
  }

  const post = data as Post

  if (input.images.length > 0) {
    await attachImages(post.id, input.images)
  }

  return post
}

/** Attaches a gallery to an existing post. */
export async function attachImages(
  postId: string,
  images: DraftImage[],
): Promise<void> {
  if (images.length === 0) return
  const client = requireClient()

  const { error } = await client.from(POST_IMAGES).insert(
    images.map((image, index) => ({
      post_id: postId,
      url: image.url,
      alt_text: image.altText,
      caption: image.caption,
      position: index,
    })),
  )

  if (error) throw new PostError(error.message, error)
}

/** Uploads a file to the media bucket and returns its public URL. */
export async function uploadPostImage(
  postId: string,
  file: File,
): Promise<{ url: string; path: string }> {
  const client = requireClient()
  const extension = file.name.split('.').pop() || 'png'
  const path = `posts/${postId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`

  const { error } = await client.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) throw new PostError(error.message, error)

  const { data } = client.storage.from(MEDIA_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, path }
}

/** Reads every post, drafts included. Administrators only. */
export async function listAllPosts(): Promise<Post[]> {
  const client = requireClient()

  const { data, error } = await client
    .from(POSTS)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new PostError(error.message, error)
  return (data ?? []) as Post[]
}

/** Publishes, unpublishes or archives a post. */
export async function setPostStatus(
  postId: string,
  status: PostStatus,
): Promise<void> {
  const client = requireClient()

  const { error } = await client
    .from(POSTS)
    .update({ status })
    .eq('id', postId)

  if (error) throw new PostError(error.message, error)
}

/** Deletes a post. Its gallery rows cascade away with it. */
export async function deletePost(postId: string): Promise<void> {
  const client = requireClient()

  const { error } = await client.from(POSTS).delete().eq('id', postId)
  if (error) throw new PostError(error.message, error)
}

/** Bumps the public view counter. Failures are never worth surfacing. */
export async function incrementPostView(slug: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('increment_post_view', { post_slug: slug })
  if (error) {
    // A missing counter must never break the page.
    console.warn('Could not record the view count:', error.message)
  }
}
