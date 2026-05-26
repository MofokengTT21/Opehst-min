export type AccessType = 'open' | 'approval_required' | 'invite_only';
export type ItemCategory = 'asset' | 'location' | 'process' | 'role';
export type ItemStatus = 'running' | 'warning' | 'down';

export interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  scada_id?: string;
  description: string;
  avatar_uri?: string;
  access_type: AccessType;
  status: ItemStatus;
  vitals_summary?: string;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  avatar_uri?: string;
  access_type: AccessType;
}

export interface Subscription {
  id: string;
  user_id: string;
  target_id: string;
  target_type: 'item' | 'group';
  status: 'pending' | 'approved';
}

export interface Post {
  id: string;
  target_id: string;
  target_type: 'item' | 'group';
  author_name: string;
  subject?: string;
  content: string;
  photo_uri?: string;
  photo_caption?: string;
  voice_uri?: string;
  location?: string;
  tag?: string;
  is_scada_alert: boolean;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

export interface Acknowledgement {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}
