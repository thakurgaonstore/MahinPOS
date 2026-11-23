import { initializeApp, getApps } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Primary Shared Firebase configuration loaded from environment variables
export const primaryFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB5TBdxMgsn76o1zFA790LmZ8TQ7dqRzOM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mahinpos.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mahinpos",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mahinpos.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1072661644155",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1072661644155:web:a496b06626950d268033de"
};

// Initialize Primary Shared Firebase
export const defaultApp = initializeApp(primaryFirebaseConfig);
export const defaultAuth = getAuth(defaultApp);

// Ensure local persistence for session retention
setPersistence(defaultAuth, browserLocalPersistence).catch(err => {
  console.warn("Failed to set browserLocalPersistence:", err);
});

export const defaultDb = getFirestore(defaultApp);

// Active pointer for Multi-Tenant Hybrid architecture
let activeDb = defaultDb;
let activeAuth = defaultAuth;
let activeTenantId = 'shared';

// Cache for dedicated tenant Firebase app instances
const tenantInstancesCache = new Map();

/**
 * Gets or initializes a dedicated Firebase project instance for a tenant.
 */
export const getDedicatedTenantFirebase = (tenantConfig, tenantId) => {
  if (!tenantConfig || !tenantConfig.projectId) {
    return { app: defaultApp, db: defaultDb, auth: defaultAuth };
  }
  const appName = `tenant_${tenantId || tenantConfig.projectId}`;
  if (tenantInstancesCache.has(appName)) {
    return tenantInstancesCache.get(appName);
  }
  
  const existingApp = getApps().find(a => a.name === appName);
  const app = existingApp || initializeApp(tenantConfig, appName);
  const dbInstance = getFirestore(app);
  const authInstance = getAuth(app);
  
  const bundle = { app, db: dbInstance, auth: authInstance };
  tenantInstancesCache.set(appName, bundle);
  return bundle;
};

/**
 * Switch active database and auth to a dedicated tenant's Firebase project.
 */
export const switchActiveTenantDb = (customDb, customAuth, tenantId = 'dedicated') => {
  activeDb = customDb || defaultDb;
  activeAuth = customAuth || defaultAuth;
  activeTenantId = tenantId;
  console.log(`[Multi-Tenant POS] Switched active database to tenant: ${tenantId}`);
};

/**
 * Reset back to the primary shared Firebase database.
 */
export const resetActiveTenantDb = () => {
  activeDb = defaultDb;
  activeAuth = defaultAuth;
  activeTenantId = 'shared';
  console.log('[Multi-Tenant POS] Reset active database to primary shared instance');
};

export const getActiveDb = () => activeDb;
export const getActiveAuth = () => activeAuth;
export const getActiveTenantId = () => activeTenantId;

// Smart Proxy for Firestore: dynamically routes queries to active DB
export const db = new Proxy(defaultDb, {
  get(target, prop, receiver) {
    const current = activeDb || target;
    const val = Reflect.get(current, prop, current);
    return typeof val === 'function' ? val.bind(current) : val;
  }
});

// Smart Proxy for Firebase Auth
export const auth = new Proxy(defaultAuth, {
  get(target, prop, receiver) {
    const current = activeAuth || target;
    const val = Reflect.get(current, prop, current);
    return typeof val === 'function' ? val.bind(current) : val;
  }
});

export default defaultApp;
