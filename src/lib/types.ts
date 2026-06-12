export type Role = 'admin' | 'worker'

export type PostStatus =
  | 'Zaplanowany'
  | 'W przygotowaniu'
  | 'Do akceptacji'
  | 'Do poprawy'
  | 'Zaakceptowany'
  | 'Opublikowany'

export type PostFormat = 'Post' | 'Rolka' | 'Karuzela' | 'Story'

export type Platform = 'IG' | 'FB' | 'LI'

export interface Profile {
  id: string
  display_name: string
  role: Role
}

export interface Client {
  id: string
  name: string
  color: string
  platforms: Platform[]
  dark_text: boolean
  archived: boolean
  position: number
}

export interface PostComment {
  id: string
  post_id: string
  author_id: string | null
  body: string
  created_at: string
  author?: { display_name: string } | null
}

export interface Post {
  id: string
  client_id: string
  publish_date: string // YYYY-MM-DD
  publish_time: string | null
  platforms: Platform[]
  format: PostFormat
  title: string
  brief: string | null
  content: string | null
  content_linkedin: string | null
  graphic_url: string | null
  status: PostStatus
  created_by: string | null
  created_at: string
  updated_at: string
  post_comments?: PostComment[]
}

export interface NewPostInput {
  client_id: string
  publish_date: string
  platforms: Platform[]
  format: PostFormat
  title: string
  brief: string
  graphic_url: string
}
