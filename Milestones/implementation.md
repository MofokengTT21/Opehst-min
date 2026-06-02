Smart. Keep it simple first, expand later.

---

**Two roles only:**

```
Admin
└── The supervisor/manager/system operator
    ├── Manages users in their tenant
    ├── Approves permits to work
    ├── Does shift handover
    ├── Sees all equipment groups
    ├── Sees analytics and dashboards
    ├── Manages CI board
    ├── Creates and manages communities
    ├── Configures SCADA alerts
    ├── Manages departments/equipment groups
    └── Full read/write on everything
        in their tenant

Normal User
└── The artisan on the floor
    ├── Posts reports and photos
    ├── Comments and reacts
    ├── Views their equipment feed
    ├── Updates CI board entries
    ├── Requests permit to work
    ├── Views shift handover
    ├── Receives notifications
    └── Read only on analytics
```

---

**What neither role can do:**

```
├── See another tenant's data — ever
├── Change their own role
├── Delete audit logs
└── Access system configuration
    └── Only you (system_admin) can
```

---

**Now the full rewritten plan:**

---

**Phase 1 — Auth Foundation**

```
├── Supabase GoTrue self hosted
├── OTP login via phone number
│   └── Africa's Talking for SA
├── Email + password as alternative
├── JWT with claims:
│   ├── user_id
│   ├── role (admin | user)
│   └── tenant_id
├── expo-secure-store for tokens
├── Biometric unlock after first login
├── Offline JWT validation
├── RLS on all tables
│   └── tenant_id enforced at DB level
└── Role based navigation
    ├── Admin → full app
    └── User → simplified view
```

---

**Phase 2 — Database Schema**

```
Tables:
├── tenants
│   ├── id
│   ├── name
│   ├── subdomain
│   ├── plan
│   └── created_at
│
├── users
│   ├── id
│   ├── tenant_id
│   ├── role (admin | user)
│   ├── name
│   ├── phone
│   ├── email
│   ├── department
│   ├── avatar_url
│   └── last_active
│
├── equipment_groups
│   ├── id
│   ├── tenant_id
│   ├── name (Arc 4, Crane etc)
│   ├── status (running|stopped|maintenance)
│   └── created_by
│
├── posts
│   ├── id
│   ├── tenant_id
│   ├── equipment_group_id
│   ├── user_id
│   ├── content
│   ├── media_urls (array)
│   ├── type (report|alert|scada|photo)
│   └── created_at
│
├── comments
│   ├── id
│   ├── post_id
│   ├── user_id
│   ├── tenant_id
│   └── content
│
├── reactions
│   ├── id
│   ├── post_id
│   ├── user_id
│   └── type (acknowledged|needsattention|fixed)
│
├── ci_board
│   ├── id
│   ├── tenant_id
│   ├── type (safety_cross|performance|kaizen|problem_solving)
│   ├── date
│   ├── status
│   ├── content
│   └── updated_by
│
├── permits
│   ├── id
│   ├── tenant_id
│   ├── equipment_group_id
│   ├── requested_by
│   ├── approved_by
│   ├── status (pending|approved|rejected|expired)
│   ├── expires_at
│   └── description
│
├── shift_handovers
│   ├── id
│   ├── tenant_id
│   ├── outgoing_user_id
│   ├── incoming_user_id
│   ├── shift_date
│   ├── notes
│   ├── acknowledged_at
│   └── scada_summary
│
├── notifications
│   ├── id
│   ├── tenant_id
│   ├── user_id
│   ├── type
│   ├── message
│   ├── read
│   ├── reference_id
│   └── created_at
│
└── audit_logs
    ├── id
    ├── tenant_id
    ├── user_id
    ├── action
    ├── table_name
    ├── record_id
    ├── old_value
    ├── new_value
    └── created_at
```

---

**Phase 3 — Core Feed (heart of the app)**

```
Admin capabilities:
├── Create equipment groups
├── Post reports, photos, videos
├── Pin important posts
├── Delete any post in their tenant
├── Configure what SCADA posts
└── Manage who is in each group

User capabilities:
├── View their equipment group feed
├── Post reports with photos/videos
├── Comment on posts
├── React — acknowledged/needs attention/fixed
└── Cannot delete others posts
```

---

**Phase 4 — Media Handling**

```
├── Cloudflare R2 storage
├── Direct upload from app
│   └── Never through your API server
├── Auto compression on upload
├── Thumbnail generation
├── Cloudflare Stream for videos
├── Offline queue
│   └── expo-file-system stores locally
│   └── Uploads when signal returns
└── Bucket per tenant
    └── angloamerican/reports/
    └── sibanye/reports/
```

---

**Phase 5 — Offline + Mesh**

```
├── SQLite via expo-sqlite
│   └── Full local copy of relevant data
├── libp2p over WebRTC
│   └── Phone to phone on same router
├── Sync queue for offline actions
├── CRDT conflict resolution
│   └── Two people edit same CI entry
│   └── Merged intelligently
├── Background sync when online
└── Visual indicator
    ├── 🟢 Online — synced
    ├── 🟡 Offline — local only
    └── 🔵 Mesh — syncing with nearby phones
```

---

**Phase 6 — Notifications**

```
Admin:
├── Receives all SCADA alerts
├── Receives permit requests
├── Escalation alerts if unacknowledged
│   └── Alert not seen in 5min → escalate
├── Shift handover reminders
└── Can configure alert rules

User:
├── Receives alerts for their equipment group
├── Permit approved/rejected notification
├── Mentioned in a comment
├── Shift handover incoming notification
└── Cannot configure alert rules
```

---

**Phase 7 — CI Board**

```
Admin capabilities:
├── Configure CI board for their plant
├── Set performance targets
├── Assign problem solving cards
├── Mark kaizen items complete
└── View full history and trends

User capabilities:
├── Update daily safety cross
├── Log production numbers
├── Add kaizen suggestions
├── Update assigned problem solving cards
└── View board — cannot configure it
```

---

**Phase 8 — Permit to Work**

```
User:
├── Request permit
├── Describe work and equipment
├── Attach photos
└── View permit status

Admin:
├── Review permit request
├── Approve with digital signature
├── Reject with reason
├── Set expiry time
├── Permit auto posts to equipment group
└── Full audit trail
```

---

**Phase 9 — Shift Handover**

```
Admin only feature:
├── Outgoing admin fills guided form
│   ├── Equipment status
│   ├── Issues encountered
│   ├── Open permits
│   ├── Pending work
│   └── SCADA highlights
├── Incoming admin acknowledges
├── Summary auto posts to Updates feed
└── Stored as permanent record
```

---

**Phase 10 — Communities**

```
Admin capabilities:
├── Create communities
│   └── Group of plants/branches
├── Invite suppliers
├── Manage community members
└── Pin announcements

User capabilities:
├── View community feed
├── Post in community
├── Comment
└── Cannot manage members
```

---

**Phase 11 — Analytics**

```
Admin only:
├── Daily active users
├── Reports submitted per shift
├── Permit compliance rate
├── CI board completion rate
├── SCADA alert response times
├── Equipment downtime trends
└── Exportable reports for corporate

User:
└── Cannot see analytics
```

---

**Phase 12 — Multi Tenancy + Infrastructure**

```
├── Coolify on Hetzner (start here)
├── Provisioning script
│   └── New tenant = one command
├── Supabase instance per tenant
├── Subdomain per tenant
│   └── client.opehst.com
├── Hetzner Managed K8s (when scaling)
└── Rancher UI for team management
```

---

**Phase 13 — Observability**

```
├── Sentry — crash tracking
├── PostHog — user behavior
│   └── Session recordings
│   └── Feature flags per tenant
├── Grafana + Prometheus
│   └── Infrastructure health
└── Custom mining dictionary
    └── Nspell for spell check
```

---

**Build order — what to actually do:**

```
Week 1-2:   Phase 1 — Auth
Week 3:     Phase 2 — Schema
Week 4-5:   Phase 3 — Feed
Week 6:     Phase 4 — Media
Week 7-8:   Phase 5 — Offline
Week 9:     Phase 6 — Notifications
Week 10:    Phase 7 — CI Board
Week 11:    Phase 8 — Permits
Week 12:    Phase 9 — Handover
Week 13:    Phase 10 — Communities

After first paying client:
├── Phase 11 — Analytics
├── Phase 12 — Multi tenancy
└── Phase 13 — Observability
```

---

**Your immediate next step — one prompt to your agent:**

*"Implement Phase 1 auth for Opehst. Two roles only: admin and user. Use Supabase GoTrue self hosted. OTP via phone number as primary login. Email + password as secondary. JWT tokens stored in expo-secure-store with these claims: user_id, role, tenant_id. Biometric unlock via expo-local-authentication after first login. Offline JWT validation. RLS policies on all tables enforcing tenant_id isolation. Role based navigation — admin sees full app, user sees simplified view. Node.js middleware validates JWT and extracts role and tenant_id on every API request."*

---

Want me to go deeper on any specific phase?



For this auth phase — only write the authenticated user to WatermelonDB local database after successful OTP verification. Do not build sync endpoints yet. Just store: user id, tenant_id, role, name, phone, email, department. Sync endpoints come in Phase 5. Keep the WatermelonDB setup clean and ready for sync but do not implement synchronize() yet.