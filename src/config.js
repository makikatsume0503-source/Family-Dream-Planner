// Configuration for Firebase and App ID
// Handles global variables (injected) or environment variables/fallbacks

const defaultFirebaseConfig = {
    apiKey: "AIzaSyDdX6NFkS0QQkAQ-g_zGjszyJJsCqA-Ahw",
    authDomain: "family-dream-planner.firebaseapp.com",
    projectId: "family-dream-planner",
    storageBucket: "family-dream-planner.firebasestorage.app",
    messagingSenderId: "967094599073",
    appId: "1:967094599073:web:1271591d4bea1f785c9fe0"
};

let firebaseConfigToUse = defaultFirebaseConfig;

if (typeof window !== 'undefined' && window.__firebase_config) {
    try {
        firebaseConfigToUse = typeof window.__firebase_config === 'string'
            ? JSON.parse(window.__firebase_config)
            : window.__firebase_config;
    } catch (e) {
        console.error("Failed to parse window.__firebase_config:", e);
    }
} else if (import.meta.env.VITE_FIREBASE_CONFIG) {
    try {
        firebaseConfigToUse = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);
    } catch (e) {
        console.error("Failed to parse VITE_FIREBASE_CONFIG:", e);
        console.log("Raw VITE_FIREBASE_CONFIG:", import.meta.env.VITE_FIREBASE_CONFIG);
    }
}

export const firebaseConfig = firebaseConfigToUse;

export const appId = (typeof window !== 'undefined' && window.__app_id)
    ? window.__app_id
    : (import.meta.env.VITE_APP_ID || 'family-dream-planner-fy');

export const initialAuthToken = (typeof window !== 'undefined' && window.__initial_auth_token)
    ? window.__initial_auth_token
    : (import.meta.env.VITE_INITIAL_AUTH_TOKEN || null);
