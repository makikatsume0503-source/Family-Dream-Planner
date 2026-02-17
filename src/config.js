// Configuration for Firebase and App ID
// Handles global variables (injected) or environment variables/fallbacks

const defaultFirebaseConfig = {
    apiKey: "AIzaSyDOCS-EXAMPLE-KEY",
    authDomain: "family-dream-planner-fy.firebaseapp.com",
    projectId: "family-dream-planner-fy",
    storageBucket: "family-dream-planner-fy.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000000000"
};

export const firebaseConfig = (typeof window !== 'undefined' && window.__firebase_config)
    ? (typeof window.__firebase_config === 'string' ? JSON.parse(window.__firebase_config) : window.__firebase_config)
    : (import.meta.env.VITE_FIREBASE_CONFIG ? JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG) : defaultFirebaseConfig);

export const appId = (typeof window !== 'undefined' && window.__app_id)
    ? window.__app_id
    : (import.meta.env.VITE_APP_ID || 'family-dream-planner-fy');

export const initialAuthToken = (typeof window !== 'undefined' && window.__initial_auth_token)
    ? window.__initial_auth_token
    : (import.meta.env.VITE_INITIAL_AUTH_TOKEN || null);
