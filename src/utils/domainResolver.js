import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { defaultDb, getDedicatedTenantFirebase, switchActiveTenantDb } from '../firebase/config';

// Hostnames that belong to the core platform and should not be treated as tenant custom domains
const PLATFORM_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  'mahinpos.web.app',
  'mahinpos.firebaseapp.com',
  'mahinpos.pages.dev',
  'pos.thakurgaonshop.com'
];

/**
 * Checks if current hostname is a custom domain
 */
export const isCustomDomain = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const testDomain = urlParams.get('custom_domain') || urlParams.get('test_domain');
  if (testDomain) return testDomain.toLowerCase().trim();

  const hostname = window.location.hostname.toLowerCase();
  if (
    PLATFORM_HOSTNAMES.includes(hostname) ||
    hostname.endsWith('.web.app') ||
    hostname.endsWith('.firebaseapp.com') ||
    hostname.endsWith('.pages.dev') ||
    hostname.endsWith('.workers.dev') ||
    hostname.includes('localhost')
  ) {
    return null;
  }
  return hostname;
};

/**
 * Resolves a custom domain or subdomain to its registered shop tenant profile.
 */
export const resolveCustomDomain = async () => {
  const domain = isCustomDomain();
  if (!domain) return null;

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase().trim();
  const domainNoWww = cleanDomain.replace(/^www\./, '');
  const domainVariants = [...new Set([cleanDomain, domainNoWww, 'www.' + domainNoWww])];

  const cacheKey = `custom_domain_pos_${cleanDomain}`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.shopId && (Date.now() - (parsed.cachedAt || 0) < 30 * 60 * 1000)) {
        applyTenantEnvironment(parsed);
        return parsed;
      }
    } catch (e) {
      console.warn("Error reading cached domain config:", e);
    }
  }

  try {
    // 1. Check customDomain in shops
    const q1 = query(
      collection(defaultDb, 'shops'),
      where('customDomain', 'in', domainVariants),
      limit(1)
    );
    const snap1 = await getDocs(q1);

    if (!snap1.empty) {
      const shopDoc = snap1.docs[0];
      const data = {
        shopId: shopDoc.id,
        ...shopDoc.data(),
        cachedAt: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(data));
      applyTenantEnvironment(data);
      return data;
    }

    // 2. Subdomain check
    const candidateId = domainNoWww.split('.')[0];
    const systemSubdomains = ['www', 'app', 'api', 'admin', 'portal', 'pos', 'shop', 'mail'];
    if (candidateId && !systemSubdomains.includes(candidateId)) {
      const docRef = doc(defaultDb, 'shops', candidateId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = {
          shopId: docSnap.id,
          ...docSnap.data(),
          cachedAt: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(data));
        applyTenantEnvironment(data);
        return data;
      }
    }
  } catch (err) {
    console.error("Failed to resolve custom domain:", err);
  }

  return null;
};

/**
 * Configure dedicated DB if the tenant has one
 */
export const applyTenantEnvironment = (tenantData) => {
  if (!tenantData) return;
  if (tenantData.databaseType === 'Dedicated' && tenantData.dedicatedFirebaseConfig?.projectId) {
    try {
      const dedicated = getDedicatedTenantFirebase(tenantData.dedicatedFirebaseConfig, tenantData.shopId);
      switchActiveTenantDb(dedicated.db, dedicated.auth, tenantData.shopId);
    } catch (err) {
      console.error("[Multi-Tenant POS] Error switching dedicated DB:", err);
    }
  }
};
