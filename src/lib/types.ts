export type Role = 'admin' | 'worker'

export type PostStatus = 'Zaplanowany' | 'Do akceptacji' | 'Zaakceptowany' | 'Opublikowany'

export type PostFormat = 'Post' | 'Rolka' | 'Karuzela' | 'Story'

export type Platform = 'IG' | 'FB' | 'LI'

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'days'

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
  note: string | null
  archived: boolean
  position: number
  created_by: string | null
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
  recur_id: string | null
  recur_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  post_comments?: PostComment[]
  // pola syntetyczne (wirtualne wystapienie serii — nie ma jeszcze rekordu w bazie)
  _virtual?: boolean
}

export interface Series {
  id: string
  client_id: string
  title: string
  format: PostFormat
  platforms: Platform[]
  brief: string | null
  frequency: Frequency
  interval_days: number
  start_date: string
  end_date: string | null
  skip_dates: string[]
  created_by: string | null
  created_at: string
}

export interface ClientRule {
  id: string
  client_id: string
  body: string
  position: number
  created_by: string | null
  created_at: string
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

export interface NewSeriesInput {
  client_id: string
  title: string
  format: PostFormat
  platforms: Platform[]
  brief: string
  frequency: Frequency
  interval_days: number
  start_date: string
  end_date: string | null
}
