import { db, defaultDb } from '../firebase/config';
import { collection, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

export const DEFAULT_CLOUDINARY_BACKUP_CONFIG = {
  cloudName: 'jekaqst5',
  uploadPreset: 'school_preset',
  folder: 'MahinPOS_Backups'
};

export const POS_SUBCOLLECTIONS = [
  'products',
  'sales',
  'customers',
  'suppliers',
  'expenses',
  'staff',
  'cashRegisters',
  'settings',
  'smsLogs'
];

/**
 * Test Cloudinary raw storage upload connection
 */
export async function testCloudinaryConnection(cloudName, uploadPreset, folder = 'MahinPOS_Backups') {
  const cName = (cloudName || DEFAULT_CLOUDINARY_BACKUP_CONFIG.cloudName).trim();
  const cPreset = (uploadPreset || DEFAULT_CLOUDINARY_BACKUP_CONFIG.uploadPreset).trim();
  const cFolder = (folder || DEFAULT_CLOUDINARY_BACKUP_CONFIG.folder).trim();

  if (!cName || !cPreset) {
    throw new Error("Cloudinary Cloud Name এবং Upload Preset প্রদান করুন!");
  }

  const pingData = JSON.stringify({
    ping: true,
    platform: 'MahinPOS Cloud Backup Test',
    timestamp: new Date().toISOString()
  });

  const blob = new Blob([pingData], { type: 'application/json' });
  const formData = new FormData();
  formData.append('file', blob, `test_ping_${Date.now()}.json`);
  formData.append('upload_preset', cPreset);
  formData.append('folder', cFolder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cName}/raw/upload`, {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Cloudinary সংযোগ ব্যর্থ হয়েছে। Cloud Name ও Preset চেক করুন।');
  }

  return {
    success: true,
    url: data.secure_url,
    message: `সফল! Cloudinary (${cName}) ক্লাউড স্টোরেজ সম্পূর্ণ সচল ও প্রস্তুত।`
  };
}

/**
 * Exports all shop data and subcollections into a complete JSON object
 */
export async function exportShopData(shopId) {
  if (!shopId) throw new Error("দোকান কোড (Shop ID) প্রয়োজন");

  const exportData = {
    platform: 'MahinPOS',
    version: '1.2',
    shopId,
    timestamp: new Date().toISOString(),
    rootDoc: null,
    subcollections: {}
  };

  // 1. Fetch Root Shop Document
  const rootSnap = await getDoc(doc(db, 'shops', shopId));
  if (rootSnap.exists()) {
    exportData.rootDoc = rootSnap.data();
  } else {
    throw new Error("দোকানটি ফায়ারবেস ডেটাবেসে পাওয়া যায়নি!");
  }

  // 2. Fetch all POS Subcollections
  for (const subCol of POS_SUBCOLLECTIONS) {
    exportData.subcollections[subCol] = {};
    try {
      const qSnap = await getDocs(collection(db, 'shops', shopId, subCol));
      qSnap.forEach((docItem) => {
        exportData.subcollections[subCol][docItem.id] = docItem.data();
      });
    } catch (e) {
      console.warn(`Subcollection ${subCol} fetch note:`, e);
    }
  }

  return exportData;
}

/**
 * Downloads shop backup as a .json file directly in browser
 */
export async function downloadShopBackupJson(shopId, shopName = 'shop') {
  const data = await exportShopData(shopId);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const safeName = (shopName || shopId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeName}_backup_${dateStr}.json`;

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { success: true, fileName };
}

/**
 * Restores shop data from a parsed JSON object
 */
export async function restoreShopDataFromJson(shopId, importData) {
  if (!importData || !importData.rootDoc || !importData.subcollections) {
    throw new Error("অকার্যকর ব্যাকআপ ফাইল! এটি MahinPOS ব্যাকআপ ফাইল নয়।");
  }

  // 1. Restore Root Document
  await setDoc(doc(db, 'shops', shopId), {
    ...importData.rootDoc,
    lastRestoredAt: new Date().toISOString()
  }, { merge: true });

  // 2. Restore Subcollections
  let restoredCount = 0;
  for (const [subColName, docsObj] of Object.entries(importData.subcollections)) {
    const setPromises = [];
    for (const [docId, docData] of Object.entries(docsObj)) {
      setPromises.push(
        setDoc(doc(db, 'shops', shopId, subColName, docId), docData, { merge: true })
      );
      restoredCount++;
    }
    await Promise.all(setPromises);
  }

  return { success: true, restoredCount };
}

/**
 * Uploads shop backup to Cloudinary Raw Storage organized by shopId folder
 */
export async function backupShopToCloudinary(shopId, shopName = 'shop', customConfig = {}) {
  // 1. Export Data
  const exportData = await exportShopData(shopId);

  // 2. Format Filename & Folder
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  const cleanId = String(shopId).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${cleanId}_backup_${dateStr}_${timeStr}.json`;

  // 3. Resolve Cloudinary Config (Custom or Global from Firestore or Defaults)
  let cName = customConfig.cloudName;
  let cPreset = customConfig.uploadPreset;
  let cFolder = customConfig.folder;

  if (!cName || !cPreset) {
    try {
      const gSnap = await getDoc(doc(defaultDb, 'platform', 'cloudinary'));
      if (gSnap.exists()) {
        const g = gSnap.data();
        cName = cName || g.cloudName;
        cPreset = cPreset || g.backupPreset || g.uploadPreset;
        cFolder = cFolder || g.backupFolder;
      }
    } catch (e) {}
  }

  cName = (cName || DEFAULT_CLOUDINARY_BACKUP_CONFIG.cloudName).trim();
  cPreset = (cPreset || DEFAULT_CLOUDINARY_BACKUP_CONFIG.uploadPreset).trim();
  const targetFolder = `${(cFolder || DEFAULT_CLOUDINARY_BACKUP_CONFIG.folder).trim()}/${cleanId}`;

  // 4. Create Blob & FormData
  const jsonContent = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });

  const formData = new FormData();
  formData.append('file', blob, fileName);
  formData.append('upload_preset', cPreset);
  formData.append('folder', targetFolder);
  formData.append('public_id', `${cleanId}_${dateStr}_${timeStr}`);

  // 5. Upload to Cloudinary Raw Endpoint
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cName}/raw/upload`, {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Cloudinary-তে ব্যাকআপ আপলোড ব্যর্থ হয়েছে।');
  }

  const fileUrl = data.secure_url || data.url;
  const fileSize = data.bytes || blob.size;

  // 6. Record metadata in Firestore under shop
  try {
    await updateDoc(doc(db, 'shops', shopId), {
      lastBackupDate: new Date().toISOString(),
      lastBackupFileUrl: fileUrl,
      lastBackupStorage: 'Cloudinary',
      lastBackupSize: fileSize,
      lastBackupStatus: 'Success'
    });
  } catch (err) {
    console.warn("Could not save backup record in Firestore:", err);
  }

  return {
    success: true,
    fileUrl,
    fileName,
    size: fileSize,
    storage: 'Cloudinary'
  };
}
