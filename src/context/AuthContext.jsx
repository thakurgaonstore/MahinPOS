import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  signInWithEmailAndPassword, 
  signInAnonymously,
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db, defaultDb, getActiveAuth, getDedicatedTenantFirebase, switchActiveTenantDb, resetActiveTenantDb } from '../firebase/config';
import { verifyPassword } from '../utils/cryptoHelper';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  // Read initial staff session if stored
  const getInitialStaff = () => {
    try {
      const stored = localStorage.getItem('staffAuth_pos');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return null;
  };

  // Read initial impersonation session
  const getInitialImpersonation = () => {
    try {
      const stored = sessionStorage.getItem('impersonationSession_pos') || localStorage.getItem('impersonationSession_pos');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return null;
  };

  const getInitialAdmin = () => {
    try {
      const stored = localStorage.getItem('adminProfile_pos');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return null;
  };

  const initialStaff = getInitialStaff();
  const initialImpersonation = getInitialImpersonation();
  const initialAdmin = getInitialAdmin();

  const [currentUser, setCurrentUser] = useState(initialStaff?.staffUser || null);
  const [userProfile, setUserProfile] = useState(
    initialImpersonation?.isImpersonating
      ? {
          role: 'shop_admin',
          shopId: initialImpersonation.shopId,
          shopName: initialImpersonation.shopName,
          isImpersonating: true,
          originalRole: 'super_admin'
        }
      : (initialStaff?.staffProfile || initialAdmin || null)
  );
  const [loading, setLoading] = useState(true);

  // Email & Password login for Super Admin or Shop Owner
  const login = async (email, password) => {
    sessionStorage.removeItem('impersonationSession_pos');
    localStorage.removeItem('impersonationSession_pos');
    localStorage.removeItem('staffAuth_pos');
    localStorage.removeItem('adminProfile_pos');
    localStorage.setItem('mahinpos_last_active_time', String(Date.now()));
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const superAdminEmails = [
      'admin@mahinpos.com', 
      'admin@mahinerp.com', 
      'owner@mahinpos.com', 
      'mahin@pos.com',
      'mahin.webservice@gmail.com'
    ];
    if (cred.user && superAdminEmails.includes(cred.user.email?.toLowerCase())) {
      const profile = { role: 'super_admin', email: cred.user.email };
      setUserProfile(profile);
      setCurrentUser(cred.user);
      localStorage.setItem('adminProfile_pos', JSON.stringify(profile));
    }
    return cred;
  };

  // Staff login for Cashier, Manager, Accountant using Shop Code + Phone + Password
  const loginStaff = async (shopCode, phone, password) => {
    try {
      const cleanShopCode = (shopCode || '').trim();
      const cleanPhone = (phone || '').trim();
      const cleanPassword = (password || '').trim();

      if (!cleanShopCode || !cleanPhone || !cleanPassword) {
        return { success: false, message: 'দোকান কোড, ফোন নম্বর ও পাসওয়ার্ড অবশ্যই পূরণ করুন।' };
      }

      // 1. Verify shop exists in central registry
      const shopRef = doc(defaultDb, 'shops', cleanShopCode);
      const shopSnap = await getDoc(shopRef);
      if (!shopSnap.exists()) {
        return { success: false, message: 'ভুল দোকান কোড! এই কোডের কোনো দোকান পাওয়া যায়নি।' };
      }

      const sData = shopSnap.data() || {};
      if (sData.status === 'Suspended') {
        return { success: false, message: 'এই দোকানের সেবা সাময়িকভাবে স্থগিত রয়েছে।' };
      }

      // Check dedicated DB
      if (sData.databaseType === 'Dedicated' && sData.dedicatedFirebaseConfig?.projectId) {
        try {
          const dedicated = getDedicatedTenantFirebase(sData.dedicatedFirebaseConfig, cleanShopCode);
          switchActiveTenantDb(dedicated.db, dedicated.auth, cleanShopCode);
        } catch (e) {
          console.error("Dedicated DB switch error:", e);
        }
      }

      // 2. Query staff by phone
      const digits = cleanPhone.replace(/[^0-9]/g, '');
      const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
      const phoneCandidates = [
        cleanPhone,
        digits,
        last10 ? '0' + last10 : null,
        last10 ? '880' + last10 : null,
        last10 ? '+880' + last10 : null,
        last10
      ].filter(Boolean);
      const uniqueCandidates = [...new Set(phoneCandidates)];

      const staffRef = collection(db, 'shops', cleanShopCode, 'staff');
      const q = query(staffRef, where('phone', 'in', uniqueCandidates.slice(0, 10)), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { success: false, message: 'ভুল ফোন নম্বর! এই নম্বরে কোনো স্টাফের একাউন্ট পাওয়া যায়নি।' };
      }

      const staffDoc = querySnapshot.docs[0];
      const data = staffDoc.data() || {};

      if (data.status === 'Inactive') {
        return { success: false, message: 'আপনার একাউন্টটি নিষ্ক্রিয় রয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।' };
      }

      // 3. Verify password
      const storedPass = (data.password || '').trim();
      const verification = await verifyPassword(cleanPassword, storedPass);

      if (!verification.matches) {
        return { success: false, message: 'ভুল পাসওয়ার্ড! অনুগ্রহ করে সঠিক পাসওয়ার্ড দিন।' };
      }

      // Establish Firebase Auth session so strict firestore.rules work for staff too
      try {
        await signInAnonymously(getActiveAuth());
      } catch (anonErr) {
        console.warn("Anonymous auth notice (enable Anonymous Sign-In in Firebase Console for staff rules):", anonErr?.code);
      }

      // Staff authenticated!
      const staffUser = {
        uid: staffDoc.id,
        displayName: data.name || 'Staff Member',
        email: data.email || `${cleanPhone}@pos.local`,
        isStaff: true
      };

      const staffProfile = {
        role: data.role || 'cashier', // 'manager', 'cashier', 'accountant', 'staff'
        shopId: cleanShopCode,
        shopName: sData.shopName || sData.name || 'Mahin POS Store',
        name: data.name,
        phone: data.phone,
        staffId: staffDoc.id,
        isStaff: true
      };

      localStorage.setItem('staffAuth_pos', JSON.stringify({ staffUser, staffProfile }));
      localStorage.setItem('lastShopId_pos', cleanShopCode);
      localStorage.setItem('mahinpos_last_active_time', String(Date.now()));

      setCurrentUser(staffUser);
      setUserProfile(staffProfile);

      return { success: true, profile: staffProfile };
    } catch (err) {
      console.error("Staff login error:", err);
      return { success: false, message: 'লগইন করতে সমস্যা হচ্ছে। কিছুক্ষণ পর আবার চেষ্টা করুন।' };
    }
  };

  // 1-Click Impersonation (Super Admin switches to view a shop as Owner)
  const impersonateShop = async (shopId, shopData) => {
    try {
      if (shopData.databaseType === 'Dedicated' && shopData.dedicatedFirebaseConfig?.projectId) {
        const dedicated = getDedicatedTenantFirebase(shopData.dedicatedFirebaseConfig, shopId);
        switchActiveTenantDb(dedicated.db, dedicated.auth, shopId);
      } else {
        resetActiveTenantDb();
      }

      const impSession = {
        isImpersonating: true,
        shopId,
        shopName: shopData.shopName || shopData.name || 'Shop',
        ownerEmail: shopData.ownerEmail || '',
        originalRole: 'super_admin'
      };

      sessionStorage.setItem('impersonationSession_pos', JSON.stringify(impSession));
      setUserProfile({
        role: 'shop_admin',
        shopId,
        shopName: shopData.shopName || shopData.name || 'Shop',
        isImpersonating: true,
        originalRole: 'super_admin'
      });
      return true;
    } catch (err) {
      console.error("Failed to impersonate shop:", err);
      return false;
    }
  };

  // Exit Impersonation back to Super Admin
  const stopImpersonation = () => {
    sessionStorage.removeItem('impersonationSession_pos');
    resetActiveTenantDb();
    setUserProfile({
      role: 'super_admin',
      email: currentUser?.email
    });
  };

  const logout = async () => {
    sessionStorage.removeItem('impersonationSession_pos');
    localStorage.removeItem('impersonationSession_pos');
    localStorage.removeItem('staffAuth_pos');
    localStorage.removeItem('adminProfile_pos');
    localStorage.removeItem('mahinpos_last_active_time');
    resetActiveTenantDb();
    setCurrentUser(null);
    setUserProfile(null);
    return signOut(auth);
  };

  // 60-Minute Inactivity Auto-Logout Timer for both Client Admin/Staff & Super Admin
  useEffect(() => {
    if (!currentUser && !userProfile) return;

    const INACTIVITY_LIMIT_MS = 60 * 60 * 1000; // 60 minutes
    const STORAGE_KEY = 'mahinpos_last_active_time';

    const updateActivityTime = () => {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    };

    if (!localStorage.getItem(STORAGE_KEY)) {
      updateActivityTime();
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    let lastThrottledTime = 0;

    const onUserActivity = () => {
      const now = Date.now();
      if (now - lastThrottledTime > 5000) {
        lastThrottledTime = now;
        localStorage.setItem(STORAGE_KEY, String(now));
      }
    };

    events.forEach((evt) => {
      window.addEventListener(evt, onUserActivity, { passive: true });
    });

    const checkInterval = setInterval(() => {
      const now = Date.now();
      const lastActive = Number(localStorage.getItem(STORAGE_KEY)) || now;
      if (now - lastActive >= INACTIVITY_LIMIT_MS) {
        console.warn("[AuthContext] 60 minutes of inactivity reached. Logging out...");
        logout();
        toast.error('নিষ্ক্রিয়তার কারণে ৬০ মিনিট পর স্বয়ংক্রিয়ভাবে লগআউট করা হয়েছে। অনুগ্রহ করে আবার লগইন করুন।', {
          id: 'session-inactivity-logout',
          duration: 8000
        });
      }
    }, 30000);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, onUserActivity);
      });
      clearInterval(checkInterval);
    };
  }, [currentUser, userProfile]);

  // Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Check if staff session is active
      const staffSession = getInitialStaff();
      if (staffSession && !user) {
        setCurrentUser(staffSession.staffUser);
        setUserProfile(staffSession.staffProfile);
        setLoading(false);
        return;
      }

      if (user) {
        setCurrentUser(user);
        try {
          // Check if Super Admin
          const superAdminEmails = [
            'admin@mahinpos.com', 
            'admin@mahinerp.com', 
            'owner@mahinpos.com', 
            'mahin@pos.com',
            'mahin.webservice@gmail.com'
          ];
          if (superAdminEmails.includes(user.email?.toLowerCase())) {
            const profile = { role: 'super_admin', email: user.email };
            setUserProfile(profile);
            localStorage.setItem('adminProfile_pos', JSON.stringify(profile));
            setLoading(false);
            return;
          }

          // Check user in platform/users or shops collection
          const userDoc = await getDoc(doc(defaultDb, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserProfile(data);
            localStorage.setItem('adminProfile_pos', JSON.stringify(data));
          } else {
            // Find shop where ownerEmail matches
            const q = query(collection(defaultDb, 'shops'), where('ownerEmail', '==', user.email), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const shopDoc = snap.docs[0];
              const sData = shopDoc.data();
              const profile = {
                role: 'shop_admin',
                shopId: shopDoc.id,
                shopName: sData.shopName || sData.name || 'My Store',
                email: user.email
              };
              setUserProfile(profile);
              localStorage.setItem('adminProfile_pos', JSON.stringify(profile));
            } else {
              // Default fallback as shop admin for test accounts
              const profile = {
                role: 'shop_admin',
                shopId: 'main-shop',
                shopName: 'Mahin Super Store',
                email: user.email
              };
              setUserProfile(profile);
            }
          }
        } catch (err) {
          console.error("Auth profile resolution error:", err);
        }
      } else {
        if (!staffSession) {
          setCurrentUser(null);
          setUserProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = {
    currentUser,
    userProfile,
    loading,
    login,
    loginStaff,
    impersonateShop,
    stopImpersonation,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
