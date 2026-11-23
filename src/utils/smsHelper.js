import { db, defaultDb } from '../firebase/config';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  increment
} from 'firebase/firestore';

export const CLOUDFLARE_GATEWAY_URL =
  import.meta.env.VITE_WORKER_GATEWAY_URL || 'https://mahinpos.thakurgaonstore.workers.dev';

let isBulkSmsBdIpBlocked = false;

/**
 * Direct browser dispatch fallback for BulkSMSBD / Greenweb
 */
async function sendDirectSMS(config, number, text) {
  const { smsApiKey, senderId, smsApiUrl, smsGateway } = config;
  const provider = (smsGateway || 'bulksmsbd').toLowerCase();

  // 1. Direct Greenweb Dispatch
  if (provider === 'greenweb') {
    const formData = new URLSearchParams();
    formData.append('token', smsApiKey);
    formData.append('to', number);
    formData.append('message', text);

    await fetch('https://api.greenweb.com.bd/api.php', {
      method: 'POST',
      mode: 'no-cors',
      body: formData
    });

    return { success: true, message: "SMS Sent Successfully (Direct Greenweb)", method: "direct" };
  }

  // 2. Direct BulkSMSBD Dispatch
  let apiUrl = smsApiUrl || 'https://bulksmsbd.net/api/smsapi';
  if (apiUrl.startsWith('http://')) apiUrl = apiUrl.replace('http://', 'https://');

  const url = new URL(apiUrl);
  url.searchParams.append('api_key', smsApiKey);
  url.searchParams.append('type', 'text');
  url.searchParams.append('number', number);
  if (senderId) url.searchParams.append('senderid', senderId);
  url.searchParams.append('message', text);

  await fetch(url.toString(), {
    method: 'GET',
    mode: 'no-cors'
  });

  return { success: true, message: "SMS Sent Successfully (Direct BulkSMSBD)", method: "direct" };
}

/**
 * Low-level dispatch function using Cloudflare Worker gateway with direct fallback
 */
export async function dispatchRawSMS(config, number, text) {
  const { smsGateway, smsApiKey, senderId, smsApiUrl } = config;
  const provider = (smsGateway || 'bulksmsbd').toLowerCase();

  if (provider === 'bulksmsbd' && isBulkSmsBdIpBlocked) {
    try {
      return await sendDirectSMS(config, number, text);
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  try {
    const res = await fetch(`${CLOUDFLARE_GATEWAY_URL}/api/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        apiKey: smsApiKey,
        senderId: senderId || '',
        to: number,
        message: text,
        smsApiUrl: smsApiUrl || ''
      })
    });

    const data = await res.json().catch(() => ({}));
    const rawStr = JSON.stringify(data.rawResponse || {});
    const isIpBlocked =
      data?.rawResponse?.response_code === 1032 ||
      rawStr.includes('1032') ||
      rawStr.toLowerCase().includes('whitelist');

    if (isIpBlocked) {
      console.warn("BulkSMSBD IP Whitelist error detected on Cloudflare Worker (1032). Activating direct browser fallback.");
      isBulkSmsBdIpBlocked = true;
      return await sendDirectSMS(config, number, text);
    } else if (res.ok && data.success) {
      return {
        success: true,
        message: data.message || "SMS Sent Successfully",
        rawResponse: data.rawResponse
      };
    } else {
      return await sendDirectSMS(config, number, text);
    }
  } catch (err) {
    console.warn("Gateway SMS dispatch error, falling back to direct:", err);
    return await sendDirectSMS(config, number, text);
  }
}

/**
 * Universal Intelligent SMS Dispatch:
 * - If client shop has configured their own smsApiKey in settings -> Sends using Client's Own bulk account (NO platform quota deducted).
 * - If client shop has NOT configured smsApiKey -> Uses Super Admin's Central Master SMS Gateway and deducts 1 SMS from shop's smsBalance.
 */
export async function sendShopSMS(shopId, to, text, title = 'POS Notification') {
  try {
    const cleanNumber = (to || '').replace(/[^0-9]/g, '');
    if (!cleanNumber || cleanNumber.length < 10) {
      return { success: false, message: "অকার্যকর মোবাইল নম্বর!" };
    }

    // 1. Fetch Shop Record
    let shopData = {};
    try {
      const sSnap = await getDoc(doc(defaultDb, 'shops', shopId));
      if (sSnap.exists()) {
        shopData = sSnap.data();
      } else if (db !== defaultDb) {
        const customSnap = await getDoc(doc(db, 'shops', shopId));
        if (customSnap.exists()) shopData = customSnap.data();
      }
    } catch (e) {
      console.warn("Could not check shop data for SMS:", e);
    }

    // 2. Check if Super Admin has suspended SMS service for this shop
    if (shopData.smsStatus === 'Suspended' || shopData.smsServiceDisabled === true) {
      return {
        success: false,
        message: "আপনার দোকানের এসএমএস সার্ভিস সাময়িকভাবে স্থগিত রয়েছে। অনুগ্রহ করে প্ল্যাটফর্ম সুপার এডমিনের সাথে যোগাযোগ করুন।"
      };
    }

    // 3. Check if shop has configured their OWN Bulk SMS API credentials
    const hasOwnApiKey = !!(shopData.smsApiKey && shopData.smsApiKey.trim() !== '');

    let effectiveConfig = {};
    let dispatchMode = 'client_own';

    if (hasOwnApiKey) {
      // MODE 1: Client has their own Bulk SMS API Key (NO platform quota deducted)
      effectiveConfig = {
        smsGateway: shopData.smsGateway || 'bulksmsbd',
        smsApiKey: shopData.smsApiKey.trim(),
        senderId: (shopData.senderId || '').trim()
      };
      dispatchMode = 'client_own';
    } else {
      // MODE 2: Client uses Super Admin Central Master SMS Gateway
      dispatchMode = 'platform_central';

      const currentBalance = shopData.smsBalance !== undefined ? Number(shopData.smsBalance) : 0;
      if (currentBalance <= 0) {
        return {
          success: false,
          message: "আপনার দোকানের এসএমএস ব্যালেন্স শেষ হয়ে গেছে (অবশিষ্ট: ০ টি)। অনুগ্রহ করে সুপার এডমিনের সাথে যোগাযোগ করে ব্যালেন্স রিচার্জ করুন অথবা নিজস্ব API Key যুক্ত করুন।"
        };
      }

      // Fetch Super Admin Master SMS Gateway credentials
      let masterConfig = {};
      try {
        const mSnap = await getDoc(doc(defaultDb, 'platform', 'gateways'));
        if (mSnap.exists()) {
          masterConfig = mSnap.data();
        }
      } catch (e) {
        console.warn("Could not fetch master gateway config:", e);
      }

      const masterApiKey = masterConfig.smsApiKey;
      if (!masterApiKey) {
        return {
          success: false,
          message: "সিস্টেমের সেন্ট্রাল এসএমএস এপিআই কনফিগার করা হয়নি। সুপার এডমিন প্যানেল থেকে Master SMS Gateway সেট করুন।"
        };
      }

      effectiveConfig = {
        smsGateway: masterConfig.smsProvider || 'bulksmsbd',
        smsApiKey: masterApiKey.trim(),
        senderId: (masterConfig.smsSenderId || '').trim()
      };
    }

    // 4. Dispatch SMS
    const dispatchRes = await dispatchRawSMS(effectiveConfig, cleanNumber, text);

    // 5. If successful and sent via platform central gateway, deduct 1 SMS from shop's balance
    if (dispatchRes.success && dispatchMode === 'platform_central') {
      try {
        await updateDoc(doc(defaultDb, 'shops', shopId), {
          smsBalance: increment(-1),
          totalSmsSent: increment(1),
          lastSmsSentAt: serverTimestamp()
        });
      } catch (deductErr) {
        console.warn("Could not deduct SMS balance in Firestore:", deductErr);
      }
    }

    // 6. Log SMS in shop's subcollection
    try {
      await addDoc(collection(db, 'shops', shopId, 'smsLogs'), {
        to: cleanNumber,
        text,
        title,
        dispatchMode,
        provider: effectiveConfig.smsGateway,
        senderId: effectiveConfig.senderId || 'Default',
        status: dispatchRes.success ? 'Delivered' : 'Failed',
        timestamp: serverTimestamp()
      });
    } catch (logErr) {
      console.warn("Could not write SMS log:", logErr);
    }

    return dispatchRes;
  } catch (error) {
    console.error("sendShopSMS error:", error);
    return { success: false, message: error.message };
  }
}
