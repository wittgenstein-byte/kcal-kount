import { state, saveAiSettings } from './state.js';
import { showToast, openModal, closeModal, prefillMealModalFromScan } from './ui.js';
import { analyzeFood } from './ai.js';

let _capturedBase64 = null;
let _stream = null;

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function startVideoStream() {
  const video = document.getElementById('camera-video');
  const prompt = document.querySelector('.camera-capture-prompt');
  if (!video) return;

  try {
    const constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "environment"
      },
      audio: false
    };
    _stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = _stream;
    video.classList.remove('hidden');
    const guide = document.getElementById('camera-guide-overlay');
    if (guide) guide.classList.add('active');
    if (prompt) prompt.classList.add('hidden');
  } catch (err) {
    console.warn('Could not start video stream:', err);
    if (video) video.classList.add('hidden');
    if (prompt) prompt.classList.remove('hidden');
    const guide = document.getElementById('camera-guide-overlay');
    if (guide) guide.classList.remove('active');
    showToast('Could not access camera. Please select a photo from your gallery.', 'info');
  }
}

function stopVideoStream() {
  if (_stream) {
    _stream.getTracks().forEach(track => track.stop());
    _stream = null;
  }
  const video = document.getElementById('camera-video');
  if (video) {
    video.srcObject = null;
    video.classList.add('hidden');
  }
  const guide = document.getElementById('camera-guide-overlay');
  if (guide) guide.classList.remove('active');
  const prompt = document.querySelector('.camera-capture-prompt');
  if (prompt) prompt.classList.remove('hidden');
}

function captureVideoFrame() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  if (!video || !canvas) return;

  let w = video.videoWidth || video.width;
  let h = video.videoHeight || video.height;
  if (!w || !h) return;

  const size = Math.min(w, h);
  const sx = (w - size) / 2;
  const sy = (h - size) / 2;

  const targetSize = Math.min(size, 1024);
  canvas.width = targetSize;
  canvas.height = targetSize;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, sx, sy, size, size, 0, 0, targetSize, targetSize);
  _capturedBase64 = canvas.toDataURL('image/jpeg', 0.80);

  stopVideoStream();

  const modal = document.getElementById('camera-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }
  showCameraStep('confirm');
}

/**
 * Trigger the native device camera to take a photo.
 * On mobile this opens the camera app; on desktop it opens a file picker.
 */
function triggerNativeCamera() {
  const captureInput = document.getElementById('camera-capture-input');
  if (captureInput) {
    captureInput.value = '';
    captureInput.click();
  }
}

/**
 * Open the camera modal showing the capture/upload prompt (step 1).
 * Also immediately triggers the native camera so the user can take a photo right away.
 */
export function openCameraModal() {
  const modal = document.getElementById('camera-modal');
  if (!modal) return;

  _capturedBase64 = null;
  showCameraStep('preview');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');

  startVideoStream();
}

export function closeCameraModal() {
  const modal = document.getElementById('camera-modal');
  if (modal) closeModal(modal);
  _capturedBase64 = null;
  stopVideoStream();

  // Reset canvas to free memory
  const canvas = document.getElementById('camera-canvas');
  if (canvas) {
    canvas.width = 1;
    canvas.height = 1;
  }
}

function showCameraStep(step) {
  // step: 'preview' | 'confirm' | 'loading'
  ['preview', 'confirm', 'loading'].forEach(s => {
    const el = document.getElementById(`camera-step-${s}`);
    if (el) el.classList.toggle('hidden', s !== step);
  });

  const modal = document.getElementById('camera-modal');
  if (modal) {
    if (step === 'preview') {
      modal.classList.add('camera-modal--fullscreen');
    } else {
      modal.classList.remove('camera-modal--fullscreen');
    }
  }
}

/**
 * Process a captured/uploaded image file: compress to 800x600 JPEG,
 * store as base64, and show the confirm step.
 */
async function processImageFile(file) {
  if (!file) return;

  // 1) Guard: Reject files larger than 15MB to prevent OOM on mobile
  const MAX_FILE_BYTES = 15 * 1024 * 1024;
  if (file.size > MAX_FILE_BYTES) {
    showToast('Image too large (max 15MB). Please upload a smaller photo.', 'warning');
    return;
  }

  const isHeic = file.name?.toLowerCase().endsWith('.heic') || file.name?.toLowerCase().endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif';
  
  let targetFile = file;
  let alreadyResized = false;

  if (isHeic) {
    showToast('Processing HEIC image...', 'info');
    try {
      // 2) Try native decode first (supported in modern iOS and Android) - no library load, very low RAM usage
      const bitmap = await createImageBitmap(file);
      
      const tempCanvas = document.createElement('canvas');
      const MAX_W = 600;
      const MAX_H = 450;
      let w = bitmap.width;
      let h = bitmap.height;
      const ratio = Math.min(MAX_W / w, MAX_H / h, 1);
      tempCanvas.width = Math.round(w * ratio);
      tempCanvas.height = Math.round(h * ratio);
      
      const ctx = tempCanvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, tempCanvas.width, tempCanvas.height);
      
      // Close bitmap immediately to release memory
      bitmap.close();
      
      const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/jpeg', 0.75));
      
      // Reset temp canvas size
      tempCanvas.width = 1;
      tempCanvas.height = 1;
      
      targetFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
        type: 'image/jpeg'
      });
      alreadyResized = true;
      console.log('[HEIC] Native decode successful');
    } catch (nativeErr) {
      console.warn('[HEIC] Native decode failed, trying heic2any fallback:', nativeErr);
      try {
        const heic2any = (await import('heic2any')).default;
        const convertedBlob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.75
        });
        const resultBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        targetFile = new File([resultBlob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
          type: 'image/jpeg'
        });
      } catch (err) {
        console.error('[HEIC] Fallback conversion failed:', err);
        showToast('HEIC conversion failed. In Camera settings, please change format to JPEG.', 'warning');
        return;
      }
    }
  }

  // 3) Compress image if it hasn't been resized yet
  if (!alreadyResized) {
    try {
      showToast('Optimizing image...', 'info');
      const imageCompression = (await import('browser-image-compression')).default;
      const options = {
        maxSizeMB: 0.1,          // Target size ~100KB
        maxWidthOrHeight: 800,   // Max dimension 800px
        useWebWorker: true
      };
      targetFile = await imageCompression(targetFile, options);
      console.log('[Compression] Compression successful. Compressed size:', targetFile.size);
    } catch (compressErr) {
      console.warn('[Compression] Compression failed, using original/converted file:', compressErr);
    }
  }

  const objectUrl = URL.createObjectURL(targetFile);
  const img = new Image();
  img.onload = function() {
    const canvas = document.getElementById('camera-canvas');
    if (!canvas) {
      URL.revokeObjectURL(objectUrl);
      return;
    }

    let w = img.width;
    let h = img.height;
    const size = Math.min(w, h);
    const sx = (w - size) / 2;
    const sy = (h - size) / 2;

    const targetSize = Math.min(size, 1024);
    canvas.width = targetSize;
    canvas.height = targetSize;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, size, size, 0, 0, targetSize, targetSize);

    URL.revokeObjectURL(objectUrl);

    // Release image reference so GC can reclaim it
    img.src = '';
    img.onload = null;
    img.onerror = null;

    _capturedBase64 = canvas.toDataURL('image/jpeg', 0.80);

    // Show the modal (in case it was hidden) and go to confirm step
    const modal = document.getElementById('camera-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
    }
    showCameraStep('confirm');
  };
  img.onerror = function() {
    URL.revokeObjectURL(objectUrl);
    img.src = '';
    img.onload = null;
    img.onerror = null;
    showToast('Could not load image. Please try another photo.', 'warning');
    showCameraStep('preview');
  };
  img.src = objectUrl;
}

function retakePhoto() {
  _capturedBase64 = null;
  showCameraStep('preview');

  // Reset canvas to free memory
  const canvas = document.getElementById('camera-canvas');
  if (canvas) {
    canvas.width = 1;
    canvas.height = 1;
  }

  startVideoStream();
}

async function confirmAndScan() {
  if (!_capturedBase64) return;

  showCameraStep('loading');

  try {
    const result = await analyzeFood(_capturedBase64);

    // Close camera modal, open meal modal pre-filled with the image
    const imageToPass = _capturedBase64;
    closeCameraModal();
    prefillMealModalFromScan(result, imageToPass);

  } catch (err) {
    showToast(`AI scan failed: ${err.message}`, 'warning');
    showCameraStep('confirm'); // Go back to confirm so user can retry
  }
}

export function loadAiSettingsIntoForm() {
  const modelInput = document.getElementById('settings-model-name');
  if (modelInput) modelInput.value = state.modelName || 'gemini-3.5-flash';
}

export function setupCameraListeners() {
  // Camera / AI Scan FAB — directly triggers native camera
  const scanFab = document.getElementById('scan-fab');
  if (scanFab) scanFab.addEventListener('click', () => openCameraModal());

  // Camera modal controls
  const closeCameraBtn = document.getElementById('close-camera-modal');
  const captureBtn = document.getElementById('capture-btn');
  const uploadImgBtn = document.getElementById('upload-img-btn');
  const cameraCaptureInput = document.getElementById('camera-capture-input');
  const cameraFileInput = document.getElementById('camera-file-input');
  const retakeBtn = document.getElementById('retake-btn');
  const scanConfirmBtn = document.getElementById('scan-confirm-btn');
  const cameraModal = document.getElementById('camera-modal');

  if (closeCameraBtn) closeCameraBtn.addEventListener('click', () => closeCameraModal());

  // Shutter button (capture="environment") click/change listener
  if (captureBtn) {
    captureBtn.addEventListener('click', () => {
      if (_stream) {
        captureVideoFrame();
      } else if (cameraCaptureInput) {
        cameraCaptureInput.click();
      }
    });
  }

  if (cameraCaptureInput) {
    cameraCaptureInput.addEventListener('change', async (e) => {
      if (e.target.files?.[0]) {
        await processImageFile(e.target.files[0]);
        e.target.value = '';
      }
    });
  }

  // Gallery upload change listener
  if (cameraFileInput) {
    cameraFileInput.addEventListener('change', async (e) => {
      if (e.target.files?.[0]) {
        await processImageFile(e.target.files[0]);
        e.target.value = '';
      }
    });
  }

  if (retakeBtn) retakeBtn.addEventListener('click', () => retakePhoto());
  if (scanConfirmBtn) scanConfirmBtn.addEventListener('click', () => confirmAndScan());
  if (cameraModal) {
    cameraModal.addEventListener('click', (e) => {
      if (e.target === cameraModal) closeCameraModal();
    });
  }

  // Save AI Settings button
  const saveAiBtn = document.getElementById('save-ai-settings-btn');
  if (saveAiBtn) {
    saveAiBtn.addEventListener('click', () => {
      const modelVal = document.getElementById('settings-model-name').value.trim();
      state.modelName = modelVal || 'gemini-3.5-flash';
      saveAiSettings();
      showToast('AI model saved!', 'success');
    });
  }
}
