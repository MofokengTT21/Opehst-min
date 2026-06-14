# How to Seed the Database

If you ever need to reset the database and populate it with fresh test data (users, hubs, channels, posts, comments, and likes), follow these instructions.

## 1. Run the Seed Script

Open your terminal and run the following commands:

```bash
# Navigate to the server directory
cd server

# Run the Prisma seed command
npx prisma db seed
```

## 2. What the Seed Script Does

When you run the seed command, it performs the following actions:
1. **Wipes the Database:** It deletes all existing data to prevent duplicates (Users, Channels, Posts, Comments, Reactions, etc.).
2. **Provisions the Admin User:** It creates your default `Plant Manager` user with the phone number **`+27671521862`**.
3. **Creates Hubs & Channels:** It sets up 4 realistic Hubs (Engineering, Operations, Safety, Quality) and corresponding Channels.
4. **Adds Memberships:** It automatically adds your Admin user to every channel as a `ChannelMember` (so you can see the feeds).
5. **Populates the Feed & Chats:** It generates 2-3 realistic posts for every channel. For testing, it also generates:
   - A standard chat message (comment) on the first post of every channel.
   - A **"Like"** (heart reaction) on that chat message.
   - A **"Quoted Reply"** attached to that chat message.

## 3. Very Important: Clearing App Cache

Opehst uses **WatermelonDB** for offline caching. If you wipe and re-seed the backend database, your mobile app will still hold the *old* data with the old database IDs, and the synchronization will fail or show empty feeds.

**After running the seed script, you MUST do one of the following in the app:**
- **Sign Out and Sign In again:** This clears the local user session and forces a fresh sync.
- **Or Clear App Data:** If you are testing in a web browser, clear your LocalStorage/IndexedDB. If you are on an Android emulator, wipe the app storage from the Android settings.
