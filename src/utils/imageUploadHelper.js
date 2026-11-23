import { doc, getDoc } from 'firebase/firestore';
import { db, defaultDb } from '../firebase/config';

/**
 * Cloudinary image upload helper with client-side canvas compression and smart multi-tenant fallback
 */

export const DEFAULT_CLOUDINARY_CONFIG = {
  cloudName: 'jekaqst5',
  uploadPreset: 'school_preset',
  folder: 'mahinpos/products'
};

/**
 * Compresses an image in the browser using HTML5 Canvas.
 * Reduces 5MB-10MB mobile phone photos to ~25KB-50KB WebP images with high sharpness.
 */
export async function compressImage(file, { maxWidth = 800, maxHeight = 800, quality = 0.82 } = {}) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    return file;
  }
  if (file.type === 'image/svg+xml') {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
            type: 'image/webp'
          });
          resolve(compressed);
        }, 'image/webp', quality);
      };

      img.onerror = () => resolve(file);
    };

    reader.onerror = () => resolve(file);
  });
}

/**
 * Resolves effective Cloudinary credentials:
 * 1. Client Shop's custom Cloudinary credentials (from shop doc)
 * 2. If blank, Super Admin's Central Cloudinary credentials (from platform/cloudinary)
 * 3. System Defaults
 */
export async function resolveEffectiveCloudinaryConfig(shopId = null) {
  // 1. Check Client Shop's own settings if shopId is provided
  if (shopId) {
    try {
      const sSnap = await getDoc(doc(db, 'shops', shopId));
      if (sSnap.exists()) {
        const s = sSnap.data();
        if (s.cloudinaryCloudName && s.cloudinaryUploadPreset) {
          return {
            cloudName: s.cloudinaryCloudName.trim(),
            uploadPreset: s.cloudinaryUploadPreset.trim(),
            folder: `mahinpos/${shopId}/products`,
            isCustom: true
          };
        }
      }
    } catch (e) {
      console.warn("Could not check shop custom Cloudinary config:", e);
    }
  }

  // 2. Check Super Admin Central Cloudinary config from platform/cloudinary
  try {
    const pSnap = await getDoc(doc(defaultDb, 'platform', 'cloudinary'));
    if (pSnap.exists()) {
      const p = pSnap.data();
      if (p.cloudName && p.imagePreset) {
        return {
          cloudName: p.cloudName.trim(),
          uploadPreset: p.imagePreset.trim(),
          folder: `mahinpos/${shopId || 'shared'}/products`,
          isCustom: false
        };
      }
    }
  } catch (e) {
    console.warn("Could not check platform Cloudinary config:", e);
  }

  // 3. Fallback to System Defaults
  return {
    ...DEFAULT_CLOUDINARY_CONFIG,
    folder: `mahinpos/${shopId || 'shared'}/products`,
    isCustom: false
  };
}

/**
 * Uploads an image to Cloudinary using canvas compression and smart multi-tenant resolution
 */
export async function uploadToCloudinary(file, shopIdOrConfig = null) {
  if (!file) throw new Error("কোনো ছবি সিলেক্ট করা হয়নি");

  let config;
  if (typeof shopIdOrConfig === 'string') {
    config = await resolveEffectiveCloudinaryConfig(shopIdOrConfig);
  } else if (shopIdOrConfig && shopIdOrConfig.cloudName) {
    config = shopIdOrConfig;
  } else {
    config = await resolveEffectiveCloudinaryConfig(null);
  }

  const compressedFile = await compressImage(file);

  const formData = new FormData();
  formData.append('file', compressedFile);
  formData.append('upload_preset', config.uploadPreset || 'school_preset');
  formData.append('folder', config.folder || 'mahinpos/products');

  const uploadUrl = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`;
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Cloudinary upload failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    url: data.secure_url || data.url,
    publicId: data.public_id,
    width: data.width,
    height: data.height,
    bytes: data.bytes
  };
}
