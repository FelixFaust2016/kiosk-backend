# Kiosk CMS Backend  
**Node.js + TypeScript**

Backend system powering the **Kiosk Control System**, including:

- CMS authentication & protected admin APIs  
- Media library management (upload, list, delete)  
- Kiosk configuration (playlists, default timings, avatar config)  
- Device registration & device → kiosk assignment  
- Live announcements with targeting rules  
- Interactive avatar sessions & message logging  
- Real-time kiosk updates via Socket.IO  

---

# Architecture Overview

The backend acts as the **central control hub**:

```
Admin CMS → Backend API → MongoDB
                          ↓
                      Socket.IO
                          ↓
                      Kiosk Clients
```

- Admins manage content/configuration from the CMS.
- Changes are stored in MongoDB.
- Updates are pushed instantly to kiosk devices via Socket.IO.

---

# 🛠 Tech Stack & Rationale

## Node.js + Express
- Rapid API development
- Lightweight & scalable
- Rich middleware ecosystem (auth, uploads, sockets)

## TypeScript
- Strong typing for complex relationships (device → kiosk → playlist → media)
- Safer refactoring
- Reduced runtime errors

## MongoDB + Mongoose
- Flexible schema evolution
- Ideal for nested configurations such as:
  - Playlist items (order, duration, media reference)
  - `avatarConfig` object
  - Announcement targeting rules

## Socket.IO
- Real-time config updates
- Instant kiosk refresh (no polling required)

## JWT Authentication
- Stateless CMS authentication
- Secures protected admin routes (media, kiosk edits, announcements)

## ElevenLabs
- High-quality AI voice generation
- Powers animated assistant speech

## Rhubarb + FFmpeg
- Lip-sync generation
- Audio processing pipeline for avatar animation

---

# Requirements

- Node.js (LTS recommended)
- MongoDB (local or Atlas)
- npm or yarn
- FFmpeg
- Rhubarb Lip Sync

---

# Environment Variables

Create a `.env` file in the backend root:

```env
PORT=8080
MONGO_URI=mongodb://127.0.0.1:27017/kiosk_cms
JWT_SECRET=super_secret_change_me

# Optional
DEFAULT_KIOSK_ID=
AVATAR_USE_LLM=true
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
```

---

# Setup Instructions

## Install Dependencies

```bash
npm install
# or
yarn install
```

---

## Configure Environment

Create a `.env` file and populate it with the required values.

---

## Seed Admin User

Run the seed script to generate an authenticated CMS user:

```bash
npx ts-node seed.ts
```

---

## (Optional) Enable Animated AI Assistant

Only required if using the interactive avatar.

### Step A – Install Third-Party Tools

Download and install:

- FFmpeg
- Rhubarb Lip Sync  
  https://github.com/DanielSWolf/rhubarb-lip-sync/releases

---

### Step B – Create Tools Directory

Organize executables as follows:

```
/tools
  /ffmpeg
    ffmpeg.exe
  /rhubarb
    rhubarb.exe
```

Copy the `res` folder from the Rhubarb installation into:

```
/tools/rhubarb/res
```

---

### Step C – Configure ElevenLabs

Create an ElevenLabs account and obtain:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`

Add them to your `.env` file.

---

## Start Development Server

```bash
npm run dev
```

Server will start on:

```
http://localhost:8080
```

---

# Real-Time Flow Example

**When an admin updates a kiosk playlist:**

1. CMS sends update → Backend API  
2. Backend updates MongoDB  
3. Socket.IO emits event to assigned kiosk  
4. Kiosk refreshes content instantly  

---

# Avatar Flow (If Enabled)

1. User interacts with kiosk  
2. Backend generates LLM response (optional)  
3. Text sent to ElevenLabs → Audio generated  
4. FFmpeg processes audio  
5. Rhubarb generates lip-sync JSON  
6. Kiosk animates avatar in real-time  

---

# Production Recommendations

- Use MongoDB Atlas for hosted DB
- Store media files in cloud storage (S3, GCP Storage)
- Use HTTPS + reverse proxy (Nginx)
- Move JWT secret to secure secret manager
- Add role-based access control (RBAC)

---
