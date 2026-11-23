import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

/**
 * Generate Barcode SVG string or render to SVG DOM element
 */
export function generateBarcodeSvg(element, code, options = {}) {
  if (!element || !code) return;
  try {
    JsBarcode(element, String(code).trim(), {
      format: options.format || 'CODE128',
      width: options.width || 1.8,
      height: options.height || 45,
      displayValue: options.displayValue !== false,
      fontSize: options.fontSize || 12,
      font: 'monospace',
      lineColor: '#000000',
      background: 'transparent',
      margin: options.margin || 2,
      ...options
    });
  } catch (err) {
    console.error("Barcode generation failed:", err);
  }
}

/**
 * Custom React Hook to listen for Barcode Scanner inputs
 * Hardware barcode scanners input characters rapidly followed by Enter (Keycode 13)
 */
export function useBarcodeScanner(onBarcodeScanned) {
  const barcodeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is currently typing in an input, textarea or contentEditable
      const targetTag = (e.target.tagName || '').toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea' || e.target.isContentEditable;
      
      const currentTime = Date.now();
      const diff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Scanners type fast (usually < 50ms per key)
      if (e.key === 'Enter') {
        if (barcodeBufferRef.current.length >= 3) {
          const scannedCode = barcodeBufferRef.current;
          barcodeBufferRef.current = '';
          if (onBarcodeScanned) {
            onBarcodeScanned(scannedCode);
          }
        }
        barcodeBufferRef.current = '';
        return;
      }

      // If typed manually with large delays, reset buffer unless fast
      if (diff > 120 && !isInput) {
        barcodeBufferRef.current = '';
      }

      if (e.key.length === 1 && !isInput) {
        barcodeBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBarcodeScanned]);
}

/**
 * Generate a random 12-digit standard barcode if user does not enter one
 */
export function generateRandomBarcode() {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(1000 + Math.random() * 9000).toString();
  return `${timestamp}${random}`;
}
