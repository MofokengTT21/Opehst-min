export type AccessType = 'open' | 'approval_required' | 'invite_only';
export type ChannelCategory = 'asset' | 'location' | 'process' | 'role';
export type ChannelStatus = 'running' | 'warning' | 'down';

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

export type ChannelEventType = {
  name: string;
  icon: string;
  color: string;
};

export interface Hub {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type Channel = {
  id: string;
  tenantId: string;
  hubId?: string;
  name: string;
  description?: string;
  category?: ChannelCategory;
  accessType?: AccessType;
  eventTypes?: ChannelEventType[];
  createdAt: string;
  updatedAt: string;
};

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
  eventType?: string;
  is_scada_alert: boolean;
  created_at: string;
}

export type ReactionType = 'acknowledged' | 'needs_attention' | 'fixed';

export interface Comment {
  id: string;
  tenantId: string;
  postId: string;
  authorId: string;
  content: string;
  mediaUrls?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Reaction {
  id: string;
  tenantId: string;
  postId: string;
  userId: string;
  type: ReactionType;
  createdAt: string;
}
