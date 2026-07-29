# AI Meeting Assistant (demo-meet)

A smart, modern web application built with **Next.js** to record, transcribe, edit, and summarize your meetings automatically. Designed to boost productivity by turning long meeting recordings into actionable insights and accurate transcripts.

## 🚀 Features

- **🎙️ Real-time & Local Audio Transcription:** Record audio and generate accurate transcripts using local/cloud ASR models.
- **✨ AI-Powered Summarization:** Leverage Google Generative AI (Gemini) to automatically generate meeting minutes, action items, and summaries based on customizable templates.
- **📝 Advanced Transcript Editor:**
  - **Karaoke-style Highlighting:** Words are highlighted in real-time as the audio plays.
  - **Edit & Format:** Correct transcriptions seamlessly without losing time synchronization.
  - **Split & Merge:** Easily split a sentence into two or merge consecutive sentences with intuitive keyboard shortcuts (`Enter` / `Backspace`).
  - **Speaker Management:** Assign, rename, and manage speakers effortlessly.
- **📄 Export Options:** Export your transcripts and summarized minutes to multiple formats including `DOCX`, `PDF`, and plain text.
- **☁️ Cloud Sync & Sharing:** Powered by Firebase, keeping your meetings securely stored and easily shareable in read-only mode.
- **🎯 Guided Onboarding:** Built-in interactive product tours using `driver.js`.

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (React 19)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Backend & Database:** [Firebase](https://firebase.google.com/) (Auth, Firestore, Storage)
- **AI & Processing:**
  - `@google/generative-ai` (LLM integration)
  - `@deepgram/sdk` (Speech-to-text integration)
  - `@ffmpeg/ffmpeg` (In-browser audio processing)
- **Rich Text Editor:** TipTap
- **Icons:** Lucide React

## 📦 Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn
- Firebase Project setup
- API Keys for Google Generative AI and Deepgram (if applicable)

### Installation

1. **Clone the repository (or download the source):**
   ```bash
   git clone <repository-url>
   cd demo-meet
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env.local` file in the root directory and add your keys (update according to your actual configuration):
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
   NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```

5. **Open the App:**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## 💡 Keyboard Shortcuts (Editor)

- **`Enter`**: Split the current transcript segment at the cursor position.
- **`Backspace` (at start of line)**: Merge the current segment with the one above it.
- **Double Click**: Quick edit any transcript text.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 📚 Documentation

Tài liệu kỹ thuật nằm trong folder [`docs/`](./docs/):

- [`docs/REFACTOR_PLAN.md`](./docs/REFACTOR_PLAN.md) — Kế hoạch refactor tổng thể & phân tích business issues
- [`docs/PHASE_3.md`](./docs/PHASE_3.md) — Phase 3: Structure + Type Safety + Migration (đã hoàn thành)
- [`docs/PHASE_4.md`](./docs/PHASE_4.md) — Phase 4: Performance (đã hoàn thành)

## 📄 License

This project is created as part of a thesis/graduation project (Khoa luận). 
