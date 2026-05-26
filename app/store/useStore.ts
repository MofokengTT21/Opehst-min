import { create } from 'zustand';
import { Item, Group, Subscription, Post, Comment, Acknowledgement } from '@opehst/shared';

interface AppState {
  items: Item[];
  groups: Group[];
  subscriptions: Subscription[];
  posts: Post[];
  comments: Comment[];
  acknowledgements: Acknowledgement[];
  
  // Actions
  setItems: (items: Item[]) => void;
  addItem: (item: Item) => void;
  setGroups: (groups: Group[]) => void;
  addGroup: (group: Group) => void;
  setSubscriptions: (subscriptions: Subscription[]) => void;
  addSubscription: (subscription: Subscription) => void;
  setPosts: (posts: Post[]) => void;
  addPost: (post: Post) => void;
  setComments: (comments: Comment[]) => void;
  addComment: (comment: Comment) => void;
  addAcknowledgement: (ack: Acknowledgement) => void;
}

export const useStore = create<AppState>((set) => ({
  items: [
    {
      id: '1',
      name: 'Arc 4',
      category: 'asset',
      scada_id: 'scada-arc-4',
      description: 'Main furnace Arc 4',
      access_type: 'open',
      status: 'warning',
      vitals_summary: 'Current Temp: 92°C | OEE: 85%',
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Level 3 Shaft',
      category: 'location',
      description: 'Underground Level 3',
      access_type: 'approval_required',
      status: 'running',
      created_at: new Date().toISOString(),
    }
  ],
  groups: [
    {
      id: '3',
      name: 'Heavy Lifting Ops',
      description: 'Coordination for all crane and lifting operations',
      access_type: 'open',
    }
  ],
  subscriptions: [
    { id: 'sub1', user_id: 'me', target_id: '1', target_type: 'item', status: 'approved' },
    { id: 'sub2', user_id: 'me', target_id: '2', target_type: 'item', status: 'approved' },
    { id: 'sub3', user_id: 'me', target_id: '3', target_type: 'group', status: 'approved' },
  ],
  posts: [
    {
      id: 'm1',
      target_id: '1',
      target_type: 'item',
      author_name: 'System Alert',
      subject: 'Critical Temperature Exceeded',
      content: 'Arc 4 is running at 92°C. Threshold is 85°C.',
      tag: '⚠️ Hazard',
      is_scada_alert: true,
      created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    },
    {
      id: 'm2',
      target_id: '1',
      target_type: 'item',
      author_name: 'John (Fitter)',
      subject: 'Oil Leak on Main Drive Gearbox',
      content: 'Found a minor seal leak on the left bearing. Needs to be added to the next planned maintenance schedule.',
      tag: '✅ 5S Check',
      is_scada_alert: false,
      created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    },
  ],
  comments: [
    {
      id: 'c1',
      post_id: 'm1',
      author_name: 'Tshepo M.',
      content: "I'm heading down to check the cooling lines now.",
      created_at: new Date(Date.now() - 3000000).toISOString(),
    },
    {
      id: 'c2',
      post_id: 'm1',
      author_name: 'Maintenance',
      content: "Cooling pump tripped. Resetting.",
      created_at: new Date(Date.now() - 2800000).toISOString(),
    },
    {
      id: 'c3',
      post_id: 'm2',
      author_name: 'Planner',
      content: "Noted. Added to Job Card #4492 for Saturday.",
      created_at: new Date(Date.now() - 80000000).toISOString(),
    }
  ],
  acknowledgements: [],

  setItems: (items) => set({ items }),
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  
  setGroups: (groups) => set({ groups }),
  addGroup: (group) => set((state) => ({ groups: [...state.groups, group] })),
  
  setSubscriptions: (subscriptions) => set({ subscriptions }),
  addSubscription: (subscription) => set((state) => ({ subscriptions: [...state.subscriptions, subscription] })),
  
  setPosts: (posts) => set({ posts }),
  addPost: (post) => set((state) => ({ posts: [post, ...state.posts] })),
  
  setComments: (comments) => set({ comments }),
  addComment: (comment) => set((state) => ({ comments: [...state.comments, comment] })),

  addAcknowledgement: (ack) => set((state) => ({ acknowledgements: [...state.acknowledgements, ack] })),
}));
