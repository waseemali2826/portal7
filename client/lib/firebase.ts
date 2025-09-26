import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

// Prefer env values if provided, otherwise fall back to the given public config
const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyDrnJtUzYUCyZ8aId87LsfWg_lUpm8Q_NU",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "skill-5f2e6.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "skill-5f2e6",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "skill-5f2e6.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "314983757725",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:314983757725:web:790a5af29e27f14a342174",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-8J6JEKXF73",
};

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

// Auth instance to use across the app
export const auth = getAuth(app);

// Optional analytics (only if supported and in browser)
if (typeof window !== "undefined") {
  isSupported().then((ok) => {
    if (ok) getAnalytics(app);
  });
}

export default app;
