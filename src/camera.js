import { state, saveAiSettings } from './state.js';
import { showToast, openModal, closeModal, prefillMealModalFromScan } from './ui.js';
import { analyzeFood, getAvailableModels } from './ai.js';

let _capturedBase64 = null;
let _stream = null;
let _isTorchOn = false;

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
  _isTorchOn = false;
  const flashBtn = document.getElementById('camera-flash-btn');
  if (flashBtn) flashBtn.classList.remove('active');

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

async function toggleTorch() {
  if (!_stream) return;
  const track = _stream.getVideoTracks()[0];
  if (!track) return;

  const capabilities = track.getCapabilities ? track.getCapabilities() : {};
  if (!capabilities.torch) {
    showToast('Flash/Torch is not supported on this camera/device', 'info');
    return;
  }

  _isTorchOn = !_isTorchOn;
  try {
    await track.applyConstraints({
      advanced: [{ torch: _isTorchOn }]
    });
    const flashBtn = document.getElementById('camera-flash-btn');
    if (flashBtn) {
      flashBtn.classList.toggle('active', _isTorchOn);
    }
  } catch (err) {
    console.error('Failed to toggle torch:', err);
    showToast('Could not toggle flash', 'warning');
  }
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

  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
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
 * Resize ImageBitmap directly to target dimensions with high quality and no alpha overhead.
 */
function resizeImageBitmap(bitmap, maxDim = 800, quality = 0.80) {
  const canvas = document.getElementById('camera-canvas') || document.createElement('canvas');
  let w = bitmap.width;
  let h = bitmap.height;
  const ratio = Math.min(maxDim / w, maxDim / h, 1);
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);

  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Process a captured/uploaded image file: compress to 800px JPEG,
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
  
  if (isHeic) {
    showToast('Processing HEIC image...', 'info');
    try {
      // 2) Native decode first (modern iOS and Android) - directly resize to camera-canvas without intermediary files
      const bitmap = await createImageBitmap(file);
      _capturedBase64 = resizeImageBitmap(bitmap, 800, 0.80);
      bitmap.close();

      const modal = document.getElementById('camera-modal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
      }
      showCameraStep('confirm');
      console.log('[HEIC] Native decode and resize successful');
      return;
    } catch (nativeErr) {
      console.warn('[HEIC] Native decode failed, trying heic2any fallback:', nativeErr);
      try {
        const heic2any = (await import('heic2any')).default;
        const convertedBlob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.80
        });
        const resultBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        const bitmap = await createImageBitmap(resultBlob);
        _capturedBase64 = resizeImageBitmap(bitmap, 800, 0.80);
        bitmap.close();

        const modal = document.getElementById('camera-modal');
        if (modal) {
          modal.classList.remove('hidden');
          modal.setAttribute('aria-hidden', 'false');
        }
        showCameraStep('confirm');
        return;
      } catch (err) {
        console.error('[HEIC] Fallback conversion failed:', err);
        showToast('HEIC conversion failed. In Camera settings, please change format to JPEG.', 'warning');
        return;
      }
    }
  }

  // 3) Standard JPEG/PNG upload processing via browser-image-compression
  let targetFile = file;
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
    console.warn('[Compression] Compression failed, using original file:', compressErr);
  }

  // Draw targetFile directly to camera-canvas with alpha: false
  try {
    const bitmap = await createImageBitmap(targetFile);
    _capturedBase64 = resizeImageBitmap(bitmap, 800, 0.80);
    bitmap.close();

    const modal = document.getElementById('camera-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
    }
    showCameraStep('confirm');
  } catch (bitmapErr) {
    // Fallback to Image loader if createImageBitmap fails
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
      const ratio = Math.min(800 / w, 800 / h, 1);
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);

      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      URL.revokeObjectURL(objectUrl);
      img.src = '';

      _capturedBase64 = canvas.toDataURL('image/jpeg', 0.80);

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
      showToast('Could not load image. Please try another photo.', 'warning');
      showCameraStep('preview');
    };
    img.src = objectUrl;
  }
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

async function uploadImageToR2(base64DataUrl) {
  const response = await fetch('/api/images/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ image: base64DataUrl })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Upload failed: ${errText}`);
  }

  return await response.json(); // returns { url: "/api/images/meal-..." }
}

async function confirmAndScan() {
  if (!_capturedBase64) return;

  showCameraStep('loading');

  try {
    // 1. Upload captured photo to Cloudflare R2
    showToast('Uploading photo to R2...', 'info');
    const uploadRes = await uploadImageToR2(_capturedBase64);
    const imageUrl = uploadRes.url;

    // 2. Perform AI food recognition
    showToast('Analyzing food with AI...', 'info');
    const result = await analyzeFood(_capturedBase64);

    // 3. Close scanner and open meal logging modal
    closeCameraModal();
    prefillMealModalFromScan(result, imageUrl);

  } catch (err) {
    showToast(`AI scan failed: ${err.message}`, 'warning');
    showCameraStep('confirm'); // Go back to confirm so user can retry
  }
}

export async function loadAiSettingsIntoForm() {
  const modelInput = document.getElementById('settings-model-name');
  if (modelInput) modelInput.value = state.modelName || 'gemini-3.8-flash';

  const datalist = document.getElementById('available-models-list');
  if (datalist) {
    try {
      const models = await getAvailableModels();
      if (models && models.length > 0) {
        datalist.innerHTML = models.map(m => `<option value="${m}"></option>`).join('');
      }
    } catch (e) {
      console.warn('Could not populate available models datalist:', e);
    }
  }
}

export function setupCameraListeners() {
  // Camera / AI Scan FAB — directly triggers native camera
  const scanFab = document.getElementById('scan-fab');
  if (scanFab) scanFab.addEventListener('click', () => openCameraModal());

  // Camera modal controls
  const closeCameraBtn = document.getElementById('close-camera-modal');
  const captureBtn = document.getElementById('capture-btn');
  const uploadImgBtn = document.getElementById('upload-img-btn');
  const flashBtn = document.getElementById('camera-flash-btn');
  const cameraCaptureInput = document.getElementById('camera-capture-input');
  const cameraFileInput = document.getElementById('camera-file-input');
  const retakeBtn = document.getElementById('retake-btn');
  const scanConfirmBtn = document.getElementById('scan-confirm-btn');
  const cameraModal = document.getElementById('camera-modal');

  if (closeCameraBtn) closeCameraBtn.addEventListener('click', () => closeCameraModal());
  if (flashBtn) flashBtn.addEventListener('click', () => toggleTorch());

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
      state.modelName = modelVal || 'gemini-3.8-flash';
      saveAiSettings();
      showToast('AI model saved!', 'success');
    });
  }
}
