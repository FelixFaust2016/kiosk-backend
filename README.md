# Kiosk CMS Backend (Node.js + TypeScript)

This backend powers the **Kiosk Control System**:
- CMS authentication and protected admin endpoints
- Media library management (upload, list, delete)
- Kiosk configuration (playlists, default timings, avatar config)
- Device registration + device → active kiosk assignment
- Live announcements + targeting
- Interactive avatar sessions + message logging
- Real-time updates to kiosks via Socket.IO

---

## Tech Stack & Why

### Node.js + Express
- Fast to develop and easy to reason about for REST APIs
- Huge ecosystem (upload, auth, sockets)

### TypeScript
- Stronger safety for complex data flows (device → kiosk → playlist → media)
- Reduces runtime bugs and improves refactor confidence

### MongoDB + Mongoose
- Flexible schema evolution while the product spec evolves
- Great fit for nested kiosk configuration like:
  - playlist items (order, duration, media reference)
  - avatarConfig object
  - announcements targeting rules

### Socket.IO
- Real-time update delivery to kiosk clients (no polling)
- When a kiosk config / announcement changes, clients refresh instantly

### JWT Auth (CMS)
- Simple stateless authentication for the admin dashboard
- Protects admin endpoints such as media upload, kiosk edits, announcements

---

## Requirements
- Node.js (LTS recommended)
- MongoDB (local or Atlas)
- npm or yarn

---

## Environment Variables

Create a `.env` file in the backend root:

## To run the application
1. install `node modules` using npm or yarn
2. create an `env file` and input the `env details`
3. Run command `npm run dev`


```env
PORT=8080
MONGO_URI=mongodb://127.0.0.1:27017/kiosk_cms
JWT_SECRET=super_secret_change_me

# optional
DEFAULT_KIOSK_ID=
AVATAR_USE_LLM=true
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5
