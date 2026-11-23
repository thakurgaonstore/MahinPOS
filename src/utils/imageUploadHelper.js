/**
 * Cloudinary image upload helper with client-side canvas compression
 */

export const DEFAULT_CLOUDINARY_CONFIG = {
  cloudName: 'jekaqst5',
  uploadPreset: 'school_preset' // Reusing active preset or shop_preset
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
 * Uploads an image to Cloudinary
 */
export async function uploadToCloudinary(file, customConfig = null) {
  if (!file) throw new Error("No file provided");

  const config = customConfig && customConfig.cloudName ? customConfig : DEFAULT_CLOUDINARY_CONFIG;
  const compressedFile = await compressImage(file);

  const formData = new FormData();
  formData.append('file', compressedFile);
  formData.append('upload_preset', config.uploadPreset || 'school_preset');
  formData.append('folder', 'mahinpos/products');

  const uploadUrl = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`;
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Cloudinary upload failed with status ${response.status}`);
  }

  const result = await response.json();
  return {
    url: result.secure_url || result.url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    format: result.format
  };
}
