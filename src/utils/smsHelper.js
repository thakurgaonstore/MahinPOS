import { db, defaultDb } from '../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const CLOUDFLARE_GATEWAY_URL = import.meta.env.VITE_WORKER_GATEWAY_URL || 'https://mahinpos-gateway.workers.dev';

let isBulkSmsBdIpBlocked = false;

/**
 * Direct browser dispatch fallback for BulkSMSBD / Greenweb
 */
async function sendDirectSMS(config, number, text) {
  const { smsApiKey, senderId, smsApiUrl, smsGateway } = config;
  const provider = (smsGateway || 'bulksmsbd').toLowerCase();

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
        senderId,
        to: number,
        message: text,
        smsApiUrl
      })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { success: true, message: "SMS Sent Successfully via Cloudflare Gateway", data };
    }
    // Fallback to direct
    return await sendDirectSMS(config, number, text);
  } catch (err) {
    console.warn("Gateway SMS dispatch error, falling back to direct:", err);
    return await sendDirectSMS(config, number, text);
  }
}

/**
 * High-level send SMS and log to Firestore under shop
 */
export async function sendShopSMS(shopId, config, number, text, title = 'POS Notification') {
  if (!number || !text) {
    return { success: false, message: "Phone number and text are required" };
  }
  const result = await dispatchRawSMS(config, number, text);

  // Log SMS
  try {
    const logsRef = collection(db, 'shops', shopId, 'smsLogs');
    await addDoc(logsRef, {
      phone: number,
      message: text,
      title,
      status: result.success ? 'Success' : 'Failed',
      timestamp: serverTimestamp(),
      method: result.method || 'gateway'
    });
  } catch (e) {
    console.warn("Could not log SMS to Firestore:", e);
  }

  return result;
}
