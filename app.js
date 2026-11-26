// ======================================================================
// Offline support (PWA)
// ======================================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {
      // Offline support just won't be available this session — the app
      // still works fully online without it.
    });
  });
}

// ======================================================================
// Theme (toggled from the menu)
// ======================================================================
const root = document.documentElement;
const themeSwitch = document.getElementById('themeSwitch');
function setTheme(t) {
  root.setAttribute('data-theme', t);
  localStorage.setItem('firststeps-theme', t);
  themeSwitch.classList.toggle('on', t === 'dark');
}
setTheme(localStorage.getItem('firststeps-theme') || 'dark');
document.getElementById('menuThemeToggle').addEventListener('click', () => {
  setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

// ======================================================================
// Fullscreen
// ======================================================================
document.getElementById('fullscreenToggle').addEventListener('click', () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen().catch(() => {});
  }
});

// ======================================================================
// Menu dropdown
// ======================================================================
const menuToggle = document.getElementById('menuToggle');
const menuDropdown = document.getElementById('menuDropdown');
menuToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  menuDropdown.style.display = menuDropdown.style.display === 'block' ? 'none' : 'block';
});
document.addEventListener('click', () => { menuDropdown.style.display = 'none'; });

// ---------- Modals (About, Settings) ----------
function wireModal(modalId, openButtonId) {
  const modal = document.getElementById(modalId);
  document.getElementById(openButtonId).addEventListener('click', () => {
    menuDropdown.style.display = 'none';
    modal.classList.add('open');
  });
  modal.querySelector('[data-close]').addEventListener('click', () => {
    modal.classList.remove('open');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });
}
wireModal('modalAbout', 'menuAbout');
wireModal('modalSettings', 'menuSettings');

// ======================================================================
// View routing (home <-> favicon tool)
// ======================================================================
const homeView = document.getElementById('homeView');
const faviconView = document.getElementById('faviconView');
const webCardHouseView = document.getElementById('webCardHouseView');
const shareView = document.getElementById('shareView');
const brandHome = document.getElementById('brandHome');

function hideAllViews() {
  homeView.hidden = true;
  faviconView.hidden = true;
  webCardHouseView.hidden = true;
  shareView.hidden = true;
}
function showHome() {
  hideAllViews();
  clearSharedFile();
  homeView.hidden = false;
}
function showFavicon() {
  hideAllViews();
  faviconView.hidden = false;
}
function showWebCardHouse() {
  hideAllViews();
  webCardHouseView.hidden = false;
  bkRenderAll();
}
document.getElementById('openFavicon').addEventListener('click', showFavicon);
document.getElementById('backBtn').addEventListener('click', showHome);
document.getElementById('openWebCardHouse').addEventListener('click', showWebCardHouse);
document.getElementById('backBtnWebCardHouse').addEventListener('click', showHome);
document.getElementById('backBtnShare').addEventListener('click', showHome);
brandHome.addEventListener('click', showHome);
brandHome.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showHome(); }
});

// ======================================================================
// Favicon tool: state
// ======================================================================
const drop = document.getElementById('drop');
const fileInput = document.getElementById('fileInput');
const cropCard = document.getElementById('cropCard');
const cropStage = document.getElementById('cropStage');
const sourceImg = document.getElementById('sourceImg');
const cropBox = document.getElementById('cropBox');
const cropHint = document.getElementById('cropHint');
const optionsCard = document.getElementById('optionsCard');
const generateBtn = document.getElementById('generateBtn');
const sizeWarning = document.getElementById('sizeWarning');
const resultButtons = document.getElementById('resultButtons');
const zipNameRow = document.getElementById('zipNameRow');
const zipNameInput = document.getElementById('zipNameInput');
const resultList = document.getElementById('resultList');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const zipBtn = document.getElementById('zipBtn');

const MIN_RECOMMENDED = 512;
let naturalWidth = 0;
let naturalHeight = 0;
let generatedFiles = []; // { name, blob }
let uploadedFileBaseName = 'favicons';
let isSvgSource = false;

// ---------- Option checkboxes + localStorage ----------
const optionIds = ['opt-ico', 'opt-16', 'opt-32', 'opt-apple', 'opt-192', 'opt-512', 'opt-manifest', 'opt-share'];
const OPTIONS_KEY = 'firststeps-favicon-options';

function loadOptions() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(OPTIONS_KEY) || '{}'); } catch (e) { saved = {}; }
  optionIds.forEach(id => {
    if (id in saved) document.getElementById(id).checked = saved[id];
  });
  applyManifestLock();
}
function saveOptions() {
  const state = {};
  optionIds.forEach(id => { state[id] = document.getElementById(id).checked; });
  localStorage.setItem(OPTIONS_KEY, JSON.stringify(state));
}
function applyManifestLock() {
  const manifestChecked = document.getElementById('opt-manifest').checked;
  const opt192 = document.getElementById('opt-192');
  const opt512 = document.getElementById('opt-512');
  if (manifestChecked) {
    opt192.checked = true;
    opt512.checked = true;
  }
  opt192.disabled = manifestChecked;
  opt512.disabled = manifestChecked;
  opt192.closest('.opt-row').classList.toggle('locked', manifestChecked);
  opt512.closest('.opt-row').classList.toggle('locked', manifestChecked);
  // The share-target option only makes sense together with a manifest
  const optShare = document.getElementById('opt-share');
  optShare.disabled = !manifestChecked;
  optShare.closest('.opt-row').classList.toggle('locked', !manifestChecked);
}
optionIds.forEach(id => {
  document.getElementById(id).addEventListener('change', () => {
    applyManifestLock();
    saveOptions();
  });
});
loadOptions();

// ---------- File loading ----------
const sourceToggle = document.getElementById('sourceToggle');
const sourceHint = document.getElementById('sourceHint');
const sourceHints = {
  images: 'Photo picker — fast, but SVGs and other non-photo files may not show up here.',
  files: 'File browser — slower to open, but shows every file type, including SVGs.'
};
sourceToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.seg-btn');
  if (!btn) return;
  sourceToggle.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const mode = btn.dataset.mode;
  fileInput.accept = mode === 'files' ? '*/*' : 'image/*';
  sourceHint.textContent = sourceHints[mode];
});

drop.addEventListener('click', () => fileInput.click());
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
  e.preventDefault(); drop.classList.add('drag');
}));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
  e.preventDefault(); drop.classList.remove('drag');
}));
drop.addEventListener('drop', e => {
  if (e.dataTransfer.files[0]) loadImageFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e => {
  if (e.target.files[0]) loadImageFile(e.target.files[0]);
  fileInput.value = '';
});

document.addEventListener('paste', (e) => {
  if (faviconView.hidden) return;
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) loadImageFile(file);
      e.preventDefault();
      break;
    }
  }
});

function loadImageFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please choose an image file.');
    return;
  }
  uploadedFileBaseName = file.name.replace(/\.[^./\\]+$/, '').replace(/[/\\]/g, '') || 'image';
  isSvgSource = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  zipNameInput.value = `favicons--${uploadedFileBaseName}`;
  const url = URL.createObjectURL(file);
  sourceImg.onload = () => {
    naturalWidth = sourceImg.naturalWidth;
    naturalHeight = sourceImg.naturalHeight;
    cropCard.hidden = false;
    optionsCard.hidden = false;
    generateBtn.hidden = false;
    resultButtons.hidden = true;
    resultList.innerHTML = '';
    sizeWarning.hidden = true;
    generatedFiles = [];
    // Give the browser a tick to lay out the stage before measuring it
    requestAnimationFrame(() => {
      sizeImageToStage();
      initCropBox();
    });
  };
  sourceImg.src = url;
}

// Sets the image's rendered box directly in pixels — scaled UP to fill the
// stage for a small source (e.g. a compact SVG with an intrinsic size of
// 100x100), or scaled DOWN to fit for a large one — so clientWidth/
// clientHeight always exactly equal what's actually on screen. Relying on
// CSS auto-sizing here doesn't work: it happily scales large images down,
// but never scales a small image up to fill the space.
// Width always fills the full stage; height just follows from the aspect
// ratio. The height cap only kicks in for a pathologically extreme portrait
// aspect ratio, so a normal image (including a square logo on a wide
// desktop window) always gets the full stage width.
function sizeImageToStage() {
  if (!naturalWidth || !naturalHeight) return;
  const stageW = cropStage.clientWidth;
  const aspect = naturalWidth / naturalHeight;
  let w = stageW;
  let h = w / aspect;
  const maxH = window.innerHeight * 3;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  sourceImg.style.width = Math.round(w) + 'px';
  sourceImg.style.height = Math.round(h) + 'px';
}

// ---------- Crop box: init, drag, resize ----------
// The crop box is always bounded against the image's own rendered box
// (getImgRect), not the wider stage — a portrait image can render
// narrower than the stage, leaving empty space on the sides, and the
// box must not be movable into that empty space.
function getImgRect() {
  return {
    left: sourceImg.offsetLeft,
    top: sourceImg.offsetTop,
    width: sourceImg.clientWidth,
    height: sourceImg.clientHeight
  };
}

// Crop position/size as fractions of the image rect, so it can be
// re-applied after the layout changes size (browser zoom, mobile address
// bar show/hide on scroll, orientation change) instead of resetting.
let cropRel = { left: 0.1, top: 0.1, size: 0.8 };

function initCropBox() {
  const r = getImgRect();
  const size = Math.round(Math.min(r.width, r.height) * 0.8);
  const left = Math.round(r.left + (r.width - size) / 2);
  const top = Math.round(r.top + (r.height - size) / 2);
  setCropBox(left, top, size);
}

function clampBoxToImage(left, top, size, r) {
  size = Math.min(size, r.width, r.height);
  left = Math.max(r.left, Math.min(left, r.left + r.width - size));
  top = Math.max(r.top, Math.min(top, r.top + r.height - size));
  return { left, top, size };
}

function setCropBox(left, top, size) {
  const r = getImgRect();
  const c = clampBoxToImage(left, top, size, r);
  cropBox.style.left = c.left + 'px';
  cropBox.style.top = c.top + 'px';
  cropBox.style.width = c.size + 'px';
  cropBox.style.height = c.size + 'px';
  if (r.width > 0) {
    cropRel = {
      left: (c.left - r.left) / r.width,
      top: (c.top - r.top) / r.width,
      size: c.size / r.width
    };
  }
  updateCropHint(r);
}

function reapplyCropFromRel() {
  if (cropCard.hidden) return;
  sizeImageToStage();
  const r = getImgRect();
  if (r.width === 0) return;
  setCropBox(r.left + cropRel.left * r.width, r.top + cropRel.top * r.width, cropRel.size * r.width);
}

function updateCropHint(r) {
  r = r || getImgRect();
  const scale = naturalWidth / r.width;
  const naturalCropSize = Math.round(cropBox.offsetWidth * scale);
  if (isSvgSource) {
    cropHint.textContent = `Selected area ≈ ${naturalCropSize}×${naturalCropSize}px — vector source, so every size is rendered sharp regardless.`;
  } else if (naturalCropSize < MIN_RECOMMENDED) {
    cropHint.textContent = `Selected area ≈ ${naturalCropSize}×${naturalCropSize}px — smaller than the recommended ${MIN_RECOMMENDED}×${MIN_RECOMMENDED}px, larger icons will be upscaled.`;
  } else {
    cropHint.textContent = `Selected area ≈ ${naturalCropSize}×${naturalCropSize}px`;
  }
}

let dragMode = null; // 'move' | 'nw' | 'ne' | 'sw' | 'se'
let dragStartX = 0, dragStartY = 0;
let boxStart = { left: 0, top: 0, size: 0 };
const MIN_BOX = 90;

function onPointerDown(mode) {
  return (e) => {
    dragMode = mode;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    boxStart = { left: cropBox.offsetLeft, top: cropBox.offsetTop, size: cropBox.offsetWidth };
    e.target.setPointerCapture(e.pointerId);
    e.stopPropagation();
    e.preventDefault();
  };
}
cropBox.addEventListener('pointerdown', onPointerDown('move'));
cropBox.querySelector('.handle-nw').addEventListener('pointerdown', onPointerDown('nw'));
cropBox.querySelector('.handle-ne').addEventListener('pointerdown', onPointerDown('ne'));
cropBox.querySelector('.handle-sw').addEventListener('pointerdown', onPointerDown('sw'));
cropBox.querySelector('.handle-se').addEventListener('pointerdown', onPointerDown('se'));

window.addEventListener('pointermove', (e) => {
  if (!dragMode) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  const r = getImgRect();

  if (dragMode === 'move') {
    let left = boxStart.left + dx;
    let top = boxStart.top + dy;
    left = Math.max(r.left, Math.min(left, r.left + r.width - boxStart.size));
    top = Math.max(r.top, Math.min(top, r.top + r.height - boxStart.size));
    setCropBox(left, top, boxStart.size);
    return;
  }

  // Resize: the corner opposite the dragged handle stays fixed in place,
  // and the maximum size is capped by that fixed anchor point plus the
  // image's own edges, so the box can never be dragged out of the image.
  let newSize;
  if (dragMode === 'se') newSize = boxStart.size + Math.max(dx, dy);
  else if (dragMode === 'nw') newSize = boxStart.size - Math.min(dx, dy);
  else if (dragMode === 'ne') newSize = boxStart.size + Math.max(dx, -dy);
  else if (dragMode === 'sw') newSize = boxStart.size + Math.max(-dx, dy);

  let maxSize, left, top;
  if (dragMode === 'nw') {
    const anchorX = boxStart.left + boxStart.size;
    const anchorY = boxStart.top + boxStart.size;
    maxSize = Math.min(anchorX - r.left, anchorY - r.top);
    newSize = Math.min(Math.max(MIN_BOX, newSize), maxSize);
    left = anchorX - newSize;
    top = anchorY - newSize;
  } else if (dragMode === 'ne') {
    const anchorX = boxStart.left;
    const anchorY = boxStart.top + boxStart.size;
    maxSize = Math.min((r.left + r.width) - anchorX, anchorY - r.top);
    newSize = Math.min(Math.max(MIN_BOX, newSize), maxSize);
    left = anchorX;
    top = anchorY - newSize;
  } else if (dragMode === 'sw') {
    const anchorX = boxStart.left + boxStart.size;
    const anchorY = boxStart.top;
    maxSize = Math.min(anchorX - r.left, (r.top + r.height) - anchorY);
    newSize = Math.min(Math.max(MIN_BOX, newSize), maxSize);
    left = anchorX - newSize;
    top = anchorY;
  } else { // se
    const anchorX = boxStart.left;
    const anchorY = boxStart.top;
    maxSize = Math.min((r.left + r.width) - anchorX, (r.top + r.height) - anchorY);
    newSize = Math.min(Math.max(MIN_BOX, newSize), maxSize);
    left = anchorX;
    top = anchorY;
  }

  setCropBox(left, top, newSize);
});
window.addEventListener('pointerup', () => { dragMode = null; });

// Re-apply the crop proportionally instead of resetting it — this is what
// used to make the box jump back to its default position on Ctrl+scroll
// zoom (desktop) or on the mobile address bar hiding/showing while
// scrolling, both of which fire a plain 'resize' event.
window.addEventListener('resize', reapplyCropFromRel);
window.addEventListener('orientationchange', reapplyCropFromRel);

// ---------- Center / Maximize actions ----------
document.getElementById('centerCropBtn').addEventListener('click', () => {
  const r = getImgRect();
  const size = Math.min(cropBox.offsetWidth, r.width, r.height);
  setCropBox(r.left + (r.width - size) / 2, r.top + (r.height - size) / 2, size);
});
document.getElementById('maximizeCropBtn').addEventListener('click', () => {
  const r = getImgRect();
  const size = Math.min(r.width, r.height);
  setCropBox(r.left + (r.width - size) / 2, r.top + (r.height - size) / 2, size);
});

// ======================================================================
// Generating icons
// ======================================================================
function cropToCanvas(size) {
  const r = getImgRect();
  const scale = naturalWidth / r.width;
  const sx = (cropBox.offsetLeft - r.left) * scale;
  const sy = (cropBox.offsetTop - r.top) * scale;
  const sSize = cropBox.offsetWidth * scale;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceImg, sx, sy, sSize, sSize, 0, 0, size, size);
  return canvas;
}

// toDataURL is the older, more battle-tested API for guaranteeing a genuine
// PNG encode — some mobile browsers/webviews have had inconsistent behavior
// with toBlob's requested MIME type, occasionally ignoring it.
function canvasToPngBlob(canvas) {
  return dataUrlToBlob(canvas.toDataURL('image/png'));
}

function dataUrlToBlob(dataUrl) {
  const commaIndex = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, commaIndex);
  const base64 = dataUrl.slice(commaIndex + 1);
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
function isPngBytes(bytes) {
  if (bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}

function blobToUint8Array(blob) {
  return blob.arrayBuffer().then(buf => new Uint8Array(buf));
}

// Build a modern (PNG-in-ICO) favicon.ico from a list of {size, bytes}
function buildIco(entries) {
  entries.forEach(e => {
    if (!isPngBytes(e.bytes)) {
      throw new Error(`Icon data for size ${e.size} was not valid PNG — refusing to build a broken favicon.ico.`);
    }
  });
  const count = entries.length;
  const headerSize = 6 + 16 * count;
  let dataSize = 0;
  entries.forEach(e => { dataSize += e.bytes.length; });
  const buf = new Uint8Array(headerSize + dataSize);
  const view = new DataView(buf.buffer);

  view.setUint16(0, 0, true);  // reserved
  view.setUint16(2, 1, true);  // type: icon
  view.setUint16(4, count, true);

  let offset = headerSize;
  entries.forEach((e, i) => {
    const entryOffset = 6 + i * 16;
    const dim = e.size >= 256 ? 0 : e.size; // 0 means 256px
    buf[entryOffset] = dim;       // width
    buf[entryOffset + 1] = dim;   // height
    buf[entryOffset + 2] = 0;     // color palette
    buf[entryOffset + 3] = 0;     // reserved
    view.setUint16(entryOffset + 4, 1, true);   // color planes
    view.setUint16(entryOffset + 6, 32, true);  // bits per pixel
    view.setUint32(entryOffset + 8, e.bytes.length, true);
    view.setUint32(entryOffset + 12, offset, true);
    buf.set(e.bytes, offset);
    offset += e.bytes.length;
  });
  return new Blob([buf], { type: 'image/x-icon' });
}

function buildManifest(includeShare) {
  // Placeholder names are intentional: adjust name, short_name and description per site.
  const manifest = {
    name: 'My App',
    short_name: 'My App',
    description: 'My App description',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#131313',
    background_color: '#131313',
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }
    ]
  };
  if (includeShare) {
    // Lets the installed app appear in the OS share sheet. The site's service
    // worker must handle the POST to /share-target/ (see this app's README).
    manifest.share_target = {
      action: '/share-target/',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        files: [{ name: 'file', accept: ['image/*'] }]
      }
    };
  }
  return new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/manifest+json' });
}

generateBtn.addEventListener('click', async () => {
  generateBtn.disabled = true;
  try {
    await generateAll();
  } catch (err) {
    alert('Something went wrong generating the icons. If you used an SVG that references external images or fonts, try a self-contained SVG (or a raster image) instead.');
  } finally {
    generateBtn.disabled = false;
  }
});

async function generateAll() {
  generatedFiles = [];
  resultList.innerHTML = '';

  const r = getImgRect();
  const scale = naturalWidth / r.width;
  const naturalCropSize = Math.round(cropBox.offsetWidth * scale);
  if (!isSvgSource && naturalCropSize < MIN_RECOMMENDED) {
    sizeWarning.hidden = false;
    sizeWarning.textContent = `Your selected crop is about ${naturalCropSize}×${naturalCropSize}px, below the recommended ${MIN_RECOMMENDED}×${MIN_RECOMMENDED}px. Larger icons below have been upscaled and may look soft.`;
  } else {
    sizeWarning.hidden = true;
  }

  const wantIco = document.getElementById('opt-ico').checked;
  const want16 = document.getElementById('opt-16').checked;
  const want32 = document.getElementById('opt-32').checked;
  const wantApple = document.getElementById('opt-apple').checked;
  const want192 = document.getElementById('opt-192').checked;
  const want512 = document.getElementById('opt-512').checked;
  const wantManifest = document.getElementById('opt-manifest').checked;

  // Render every size we might need once, reuse for both individual files and the .ico
  const sizesNeeded = new Set();
  if (wantIco) { sizesNeeded.add(16); sizesNeeded.add(32); sizesNeeded.add(48); }
  if (want16) sizesNeeded.add(16);
  if (want32) sizesNeeded.add(32);
  if (wantApple) sizesNeeded.add(180);
  if (want192 || wantManifest) sizesNeeded.add(192);
  if (want512 || wantManifest) sizesNeeded.add(512);

  const pngBySize = {};
  for (const size of sizesNeeded) {
    const canvas = cropToCanvas(size);
    const blob = await canvasToPngBlob(canvas);
    pngBySize[size] = blob;
  }

  if (want16) generatedFiles.push({ name: 'favicon-16x16.png', blob: pngBySize[16] });
  if (want32) generatedFiles.push({ name: 'favicon-32x32.png', blob: pngBySize[32] });
  if (wantApple) generatedFiles.push({ name: 'apple-touch-icon.png', blob: pngBySize[180] });
  if (want192) generatedFiles.push({ name: 'android-chrome-192x192.png', blob: pngBySize[192] });
  if (want512) generatedFiles.push({ name: 'android-chrome-512x512.png', blob: pngBySize[512] });

  if (wantIco) {
    const entries = await Promise.all([16, 32, 48].map(async (size) => ({
      size, bytes: await blobToUint8Array(pngBySize[size])
    })));
    generatedFiles.push({ name: 'favicon.ico', blob: buildIco(entries) });
  }

  if (wantManifest) {
    generatedFiles.push({ name: 'site.webmanifest', blob: buildManifest(document.getElementById('opt-share').checked) });
  }

  renderResults();
}

function renderResults() {
  resultList.innerHTML = '';
  generatedFiles.forEach(f => {
    const url = URL.createObjectURL(f.blob);
    const row = document.createElement('div');
    row.className = 'item';

    const thumb = document.createElement('img');
    thumb.src = f.name.endsWith('.ico') ? url : url; // browsers preview both fine as <img>
    thumb.alt = '';

    const info = document.createElement('div');
    info.className = 'info';
    const nameEl = document.createElement('div');
    nameEl.className = 'name';
    nameEl.textContent = f.name;
    const sizeEl = document.createElement('div');
    sizeEl.className = 'sizes';
    sizeEl.textContent = formatSize(f.blob.size);
    info.appendChild(nameEl);
    info.appendChild(sizeEl);

    const dl = document.createElement('a');
    dl.className = 'dl';
    dl.href = url;
    dl.download = f.name;
    dl.textContent = 'Save';

    row.appendChild(thumb);
    row.appendChild(info);
    row.appendChild(dl);
    resultList.appendChild(row);
  });
  resultButtons.hidden = generatedFiles.length === 0;
  zipNameRow.hidden = generatedFiles.length === 0;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  return (bytes / 1024).toFixed(1) + ' KB';
}

downloadAllBtn.addEventListener('click', () => {
  if (generatedFiles.length === 0) return;
  generatedFiles.forEach((f, i) => {
    setTimeout(() => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(f.blob);
      a.download = f.name;
      a.click();
    }, i * 150);
  });
});

// ======================================================================
// Minimal ZIP writer (STORE method, no compression) — no external library
// needed for a handful of small icon files.
// ======================================================================
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(date) {
  const time = ((date.getHours() & 0x1F) << 11) | ((date.getMinutes() & 0x3F) << 5) | ((date.getSeconds() >> 1) & 0x1F);
  const day = (((date.getFullYear() - 1980) & 0x7F) << 9) | (((date.getMonth() + 1) & 0xF) << 5) | (date.getDate() & 0x1F);
  return { time, day };
}

function writeString(bytes, offset, str) {
  for (let i = 0; i < str.length; i++) bytes[offset + i] = str.charCodeAt(i) & 0xFF;
}

async function buildZip(files) {
  const now = new Date();
  const { time, day } = dosDateTime(now);
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);       // version needed
    lv.setUint16(6, 0, true);        // flags
    lv.setUint16(8, 0, true);        // compression: store
    lv.setUint16(10, time, true);
    lv.setUint16(12, day, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true); // compressed size
    lv.setUint32(22, data.length, true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);       // extra field length
    local.set(nameBytes, 30);

    localParts.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);       // version made by
    cv.setUint16(6, 20, true);       // version needed
    cv.setUint16(8, 0, true);        // flags
    cv.setUint16(10, 0, true);       // compression: store
    cv.setUint16(12, time, true);
    cv.setUint16(14, day, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);       // extra field length
    cv.setUint16(32, 0, true);       // comment length
    cv.setUint16(34, 0, true);       // disk number
    cv.setUint16(36, 0, true);       // internal attrs
    cv.setUint32(38, 0, true);       // external attrs
    cv.setUint32(42, offset, true);  // local header offset
    central.set(nameBytes, 46);

    centralParts.push(central);
    offset += local.length + data.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  centralParts.forEach(p => { centralSize += p.length; });

  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);
  ev.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
}

function sanitizeFileName(name) {
  return name.replace(/[/\\:*?"<>|]/g, '').trim();
}

zipBtn.addEventListener('click', async () => {
  if (generatedFiles.length === 0) return;
  zipBtn.disabled = true;
  zipBtn.textContent = 'Zipping…';
  try {
    const zipBlob = await buildZip(generatedFiles);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    const chosenName = sanitizeFileName(zipNameInput.value) || `favicons--${uploadedFileBaseName}`;
    a.download = `${chosenName}.zip`;
    a.click();
  } finally {
    zipBtn.disabled = false;
    zipBtn.textContent = 'Download all as ZIP';
  }
});

// ======================================================================
// Web Card House (beta): freely combinable header/main/footer blocks
// ======================================================================
const bkTabs = document.getElementById('bkTabs');
const bkBlockList = document.getElementById('bkBlockList');
const bkPreview = document.getElementById('bkPreview');
const bkHtmlOut = document.getElementById('bkHtmlOut');
const bkCssOut = document.getElementById('bkCssOut');

const bkState = {
  activeSection: 'header',
  idCounter: 0,
  sections: { header: [], main: [], footer: [] }
};

const BK_TYPE_LABELS = { logo: 'Logo', nav: 'Nav', text: 'Text', image: 'Image', button: 'Button' };

// Deliberately colorless: only structure/spacing, so the snippet drops into
// any existing site's palette without fighting it. `currentColor` on the
// button border means it inherits whatever text color the target page uses.
const BK_CSS = `header, footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.fs-logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.fs-logo img {
  height: 40px;
  width: auto;
}

.fs-logo span {
  font-weight: 600;
  font-size: 1.1rem;
}

.fs-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.fs-nav a {
  text-decoration: none;
}

.fs-text {
  margin: 0;
}

.fs-image {
  max-width: 100%;
  height: auto;
  display: block;
}

.fs-button {
  display: inline-block;
  padding: 10px 20px;
  border: 1px solid currentColor;
  border-radius: 6px;
  text-decoration: none;
}
`;

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(str) {
  return escHtml(str).replace(/"/g, '&quot;');
}

function bkDefaultData(type) {
  switch (type) {
    case 'logo': return { imageSrc: 'logo.png', alt: 'Logo', text: 'Site Name' };
    case 'nav': return { links: [{ label: 'Home', href: '#' }, { label: 'About', href: '#' }] };
    case 'text': return { tag: 'h1', content: 'Heading text' };
    case 'image': return { src: 'image.jpg', alt: 'Description' };
    case 'button': return { label: 'Click me', href: '#' };
    default: return {};
  }
}

function bkBlockHTML(block) {
  const d = block.data;
  switch (block.type) {
    case 'logo': {
      const img = `<img src="${escAttr(d.imageSrc)}" alt="${escAttr(d.alt)}">`;
      const label = d.text ? `<span>${escHtml(d.text)}</span>` : '';
      return `<div class="fs-logo">${img}${label}</div>`;
    }
    case 'nav': {
      const links = d.links.map(l => `<a href="${escAttr(l.href)}">${escHtml(l.label)}</a>`).join('\n    ');
      return `<nav class="fs-nav">\n    ${links}\n  </nav>`;
    }
    case 'text':
      return `<${d.tag} class="fs-text">${escHtml(d.content)}</${d.tag}>`;
    case 'image':
      return `<img class="fs-image" src="${escAttr(d.src)}" alt="${escAttr(d.alt)}">`;
    case 'button':
      return `<a class="fs-button" href="${escAttr(d.href)}">${escHtml(d.label)}</a>`;
    default:
      return '';
  }
}

function bkSectionHTML(tag, blocks) {
  if (blocks.length === 0) return '';
  const inner = blocks.map(b => '  ' + bkBlockHTML(b)).join('\n');
  return `<${tag}>\n${inner}\n</${tag}>`;
}

function bkGenerateHTML() {
  return [
    bkSectionHTML('header', bkState.sections.header),
    bkSectionHTML('main', bkState.sections.main),
    bkSectionHTML('footer', bkState.sections.footer)
  ].filter(Boolean).join('\n\n');
}

function bkUpdatePreview() {
  const html = bkGenerateHTML();
  const body = html || '<p style="padding:16px;color:#888;font-family:sans-serif;">Add some blocks to see a preview.</p>';
  const doc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body { margin:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color:#1a1a1a; background:#fff; }
${BK_CSS}
</style></head><body>${body}</body></html>`;
  bkPreview.srcdoc = doc;
}

function bkRefreshOutputs() {
  const html = bkGenerateHTML();
  bkHtmlOut.textContent = html || '<!-- Add some blocks above to generate HTML -->';
  bkCssOut.textContent = BK_CSS.trim();
  bkUpdatePreview();
}

// ---------- Field builders (plain DOM, not innerHTML — so typing never
// fights a re-render and values never need attribute-escaping) ----------
function bkField(labelText, inputEl) {
  const wrap = document.createElement('div');
  wrap.className = 'bk-field';
  const label = document.createElement('label');
  label.textContent = labelText;
  wrap.appendChild(label);
  wrap.appendChild(inputEl);
  return wrap;
}
function bkTextInput(value, onInput) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.addEventListener('input', () => onInput(input.value));
  return input;
}
function bkTextarea(value, onInput) {
  const ta = document.createElement('textarea');
  ta.value = value;
  ta.addEventListener('input', () => onInput(ta.value));
  return ta;
}
function bkSelect(options, value, onChange) {
  const sel = document.createElement('select');
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.value === value) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}

function bkBuildFields(block, fieldsWrap) {
  const d = block.data;
  if (block.type === 'logo') {
    fieldsWrap.appendChild(bkField('Image path', bkTextInput(d.imageSrc, v => { d.imageSrc = v; bkRefreshOutputs(); })));
    fieldsWrap.appendChild(bkField('Alt text', bkTextInput(d.alt, v => { d.alt = v; bkRefreshOutputs(); })));
    fieldsWrap.appendChild(bkField('Brand text (optional)', bkTextInput(d.text, v => { d.text = v; bkRefreshOutputs(); })));
  } else if (block.type === 'nav') {
    const listWrap = document.createElement('div');
    d.links.forEach((link, i) => {
      const row = document.createElement('div');
      row.className = 'bk-link-row';
      const labelInput = bkTextInput(link.label, v => { link.label = v; bkRefreshOutputs(); });
      labelInput.placeholder = 'Label';
      const hrefInput = bkTextInput(link.href, v => { link.href = v; bkRefreshOutputs(); });
      hrefInput.placeholder = 'Link (href)';
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'bk-icon-sm';
      removeBtn.textContent = '×';
      removeBtn.title = 'Remove link';
      removeBtn.addEventListener('click', () => {
        d.links.splice(i, 1);
        bkRenderBlockList();
        bkRefreshOutputs();
      });
      row.appendChild(labelInput);
      row.appendChild(hrefInput);
      row.appendChild(removeBtn);
      listWrap.appendChild(row);
    });
    fieldsWrap.appendChild(listWrap);
    const addLinkBtn = document.createElement('button');
    addLinkBtn.type = 'button';
    addLinkBtn.className = 'bk-add-link';
    addLinkBtn.textContent = '+ Add link';
    addLinkBtn.addEventListener('click', () => {
      d.links.push({ label: 'New link', href: '#' });
      bkRenderBlockList();
      bkRefreshOutputs();
    });
    fieldsWrap.appendChild(addLinkBtn);
  } else if (block.type === 'text') {
    fieldsWrap.appendChild(bkField('Style', bkSelect([
      { value: 'h1', label: 'Heading (h1)' },
      { value: 'h2', label: 'Heading (h2)' },
      { value: 'h3', label: 'Heading (h3)' },
      { value: 'p', label: 'Paragraph' }
    ], d.tag, v => { d.tag = v; bkRefreshOutputs(); })));
    fieldsWrap.appendChild(bkField('Content', bkTextarea(d.content, v => { d.content = v; bkRefreshOutputs(); })));
  } else if (block.type === 'image') {
    fieldsWrap.appendChild(bkField('Image path', bkTextInput(d.src, v => { d.src = v; bkRefreshOutputs(); })));
    fieldsWrap.appendChild(bkField('Alt text', bkTextInput(d.alt, v => { d.alt = v; bkRefreshOutputs(); })));
  } else if (block.type === 'button') {
    fieldsWrap.appendChild(bkField('Label', bkTextInput(d.label, v => { d.label = v; bkRefreshOutputs(); })));
    fieldsWrap.appendChild(bkField('Link (href)', bkTextInput(d.href, v => { d.href = v; bkRefreshOutputs(); })));
  }
}

function bkCreateBlockCard(block, index, total) {
  const card = document.createElement('div');
  card.className = 'bk-block';

  const head = document.createElement('div');
  head.className = 'bk-block-head';
  const typeLabel = document.createElement('span');
  typeLabel.className = 'bk-block-type';
  typeLabel.textContent = BK_TYPE_LABELS[block.type] || block.type;

  const actions = document.createElement('div');
  actions.className = 'bk-block-actions';

  const upBtn = document.createElement('button');
  upBtn.type = 'button'; upBtn.className = 'bk-icon-sm'; upBtn.textContent = '↑'; upBtn.title = 'Move up';
  upBtn.disabled = index === 0;
  upBtn.addEventListener('click', () => bkMoveBlock(block.id, -1));

  const downBtn = document.createElement('button');
  downBtn.type = 'button'; downBtn.className = 'bk-icon-sm'; downBtn.textContent = '↓'; downBtn.title = 'Move down';
  downBtn.disabled = index === total - 1;
  downBtn.addEventListener('click', () => bkMoveBlock(block.id, 1));

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button'; removeBtn.className = 'bk-icon-sm'; removeBtn.textContent = '×'; removeBtn.title = 'Remove block';
  removeBtn.addEventListener('click', () => bkRemoveBlock(block.id));

  actions.appendChild(upBtn);
  actions.appendChild(downBtn);
  actions.appendChild(removeBtn);
  head.appendChild(typeLabel);
  head.appendChild(actions);

  const fields = document.createElement('div');
  bkBuildFields(block, fields);

  card.appendChild(head);
  card.appendChild(fields);
  return card;
}

function bkRenderBlockList() {
  const blocks = bkState.sections[bkState.activeSection];
  bkBlockList.innerHTML = '';
  if (blocks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'bk-empty';
    empty.textContent = 'No blocks in this section yet — add one above.';
    bkBlockList.appendChild(empty);
    return;
  }
  blocks.forEach((block, i) => {
    bkBlockList.appendChild(bkCreateBlockCard(block, i, blocks.length));
  });
}

function bkMoveBlock(id, dir) {
  const blocks = bkState.sections[bkState.activeSection];
  const i = blocks.findIndex(b => b.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= blocks.length) return;
  [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  bkRenderBlockList();
  bkRefreshOutputs();
}

function bkRemoveBlock(id) {
  bkState.sections[bkState.activeSection] = bkState.sections[bkState.activeSection].filter(b => b.id !== id);
  bkRenderBlockList();
  bkRefreshOutputs();
}

function bkAddBlock(type) {
  bkState.idCounter += 1;
  bkState.sections[bkState.activeSection].push({ id: bkState.idCounter, type, data: bkDefaultData(type) });
  bkRenderBlockList();
  bkRefreshOutputs();
}

function bkRenderAll() {
  bkRenderBlockList();
  bkRefreshOutputs();
}

bkTabs.querySelectorAll('.bk-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    bkTabs.querySelectorAll('.bk-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    bkState.activeSection = tab.dataset.section;
    bkRenderBlockList();
  });
});

document.querySelectorAll('.bk-add-btn').forEach(btn => {
  btn.addEventListener('click', () => bkAddBlock(btn.dataset.type));
});

document.querySelectorAll('.bk-copy-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const targetId = btn.dataset.copy === 'html' ? 'bkHtmlOut' : 'bkCssOut';
    const text = document.getElementById(targetId).textContent;
    try {
      await navigator.clipboard.writeText(text);
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 1500);
    } catch (err) {
      alert('Could not copy automatically — please select and copy the text manually.');
    }
  });
});

// ======================================================================
// Settings: glossary of internet basics
// ======================================================================
const GLOSSARY = [
 {
  "cat": "Addresses & names",
  "terms": [
   {
    "t": "URL",
    "d": "The full address of a page or file on the internet, e.g. https://first-steps.michels.world/."
   },
   {
    "t": "Domain",
    "d": "The human-readable name of a website, like michels.world. You rent it from a registrar."
   },
   {
    "t": "Subdomain",
    "d": "A prefix in front of a domain, like first-steps in first-steps.michels.world. One domain can have many."
   },
   {
    "t": "www",
    "d": "Short for World Wide Web. Just a common subdomain; it has no special power."
   },
   {
    "t": "TLD (.com, .net, .org)",
    "d": "The last part of a domain. .com is commercial, .net was for networks, .org for organizations – today they are used freely."
   },
   {
    "t": "Country TLD (.de, .at, .ch)",
    "d": "A TLD tied to a country, like .de for Germany."
   },
   {
    "t": "IP address",
    "d": "The numeric address of a computer on the internet, e.g. 192.0.2.1. Domains are just friendly names for these."
   },
   {
    "t": "DNS",
    "d": "The internet's phone book. It turns a domain name into the IP address of the server."
   },
   {
    "t": "Registrar",
    "d": "A company where you register and renew a domain name."
   },
   {
    "t": "DNS record (A, CNAME)",
    "d": "An entry in the DNS phone book. A points a name to an IP address, CNAME points it to another name."
   },
   {
    "t": "localhost",
    "d": "Your own computer. A site on localhost is only visible to you."
   }
  ]
 },
 {
  "cat": "Reading the address bar",
  "terms": [
   {
    "t": "https://",
    "d": "The scheme: it says how to talk to the server. https means the connection is encrypted."
   },
   {
    "t": "/ (path)",
    "d": "Says which page or file you want on the site, like /about or /images/logo.png."
   },
   {
    "t": "? (query)",
    "d": "Starts extra settings sent to a page, e.g. ?search=cats. Several are joined with &."
   },
   {
    "t": "& (ampersand)",
    "d": "Separates several query settings, e.g. ?a=1&b=2."
   },
   {
    "t": "# (fragment)",
    "d": "Jumps to a spot on the page (like a heading). It is never sent to the server."
   },
   {
    "t": ": (port)",
    "d": "A door number on the server, like :8080. Usually hidden because 80 and 443 are the default."
   }
  ]
 },
 {
  "cat": "How a page reaches you",
  "terms": [
   {
    "t": "Browser / client",
    "d": "The program on your device (Chrome, Safari, Firefox) that asks for pages and shows them."
   },
   {
    "t": "Server",
    "d": "A computer that is always on and answers requests with pages and files."
   },
   {
    "t": "HTTP / HTTPS",
    "d": "The language browsers and servers use to talk. HTTPS is the secure, encrypted version."
   },
   {
    "t": "Request & response",
    "d": "The browser sends a request (\"give me this page\"), the server sends back a response."
   },
   {
    "t": "Status code",
    "d": "A number in the response. 200 = OK, 301 = moved, 404 = not found, 500 = server error."
   },
   {
    "t": "SSL / TLS certificate",
    "d": "A digital ID that proves a site is who it claims to be and enables HTTPS. Shown as the padlock."
   },
   {
    "t": "Hosting",
    "d": "Renting space on a server so your website is online around the clock."
   },
   {
    "t": "CDN",
    "d": "A network of servers around the world that deliver your files from a place close to the visitor."
   },
   {
    "t": "Frontend",
    "d": "The part of a website you see and click in the browser."
   },
   {
    "t": "Backend",
    "d": "The part running on the server: logic, accounts, databases."
   },
   {
    "t": "Database",
    "d": "Organized storage for data, like user accounts or posts."
   },
   {
    "t": "Static vs. dynamic site",
    "d": "Static: the same files for everyone. Dynamic: pages are built on the server for each visitor."
   },
   {
    "t": "Deploy",
    "d": "Publishing a new version of your site so that visitors can see it."
   },
   {
    "t": "Git",
    "d": "A tool that saves every version of your code, so you can go back and work in teams."
   },
   {
    "t": "GitHub / repository",
    "d": "GitHub is a website for storing Git projects. A repository (repo) is one project folder with its history."
   }
  ]
 },
 {
  "cat": "Building a website",
  "terms": [
   {
    "t": "HTML",
    "d": "The structure of a page: headings, paragraphs, images, links."
   },
   {
    "t": "CSS",
    "d": "The look of a page: colors, fonts, spacing, layout."
   },
   {
    "t": "JavaScript (JS)",
    "d": "The behavior of a page: buttons, animations, anything that reacts to you. Runs in your browser."
   },
   {
    "t": "Tag, element, attribute",
    "d": "A tag like <p> marks content. Tag plus content is an element. Attributes add details, e.g. href in a link."
   },
   {
    "t": "DOM",
    "d": "The live tree of all elements on a page that JavaScript can read and change."
   },
   {
    "t": "JSON",
    "d": "A simple text format for data, easy for people and programs to read."
   },
   {
    "t": "API",
    "d": "A defined way for programs to talk to each other and exchange data."
   },
   {
    "t": "Framework / library",
    "d": "Ready-made code to build faster. A framework sets the structure, a library offers single tools."
   },
   {
    "t": "Vanilla JS",
    "d": "Plain JavaScript without any framework or library."
   },
   {
    "t": "Responsive design",
    "d": "A layout that adapts to phones, tablets and big screens."
   },
   {
    "t": "Meta tags",
    "d": "Hidden info in a page's head, like title and description, used by search engines and link previews."
   },
   {
    "t": "Open Graph",
    "d": "Meta tags that decide the picture, title and text shown when you share a link in chat apps."
   },
   {
    "t": "SEO",
    "d": "Search engine optimization: making a site easier to find on Google & co."
   },
   {
    "t": "Favicon",
    "d": "The tiny icon in the browser tab. Often delivered as .ico and PNG in several sizes."
   },
   {
    "t": "PNG, JPG, WebP, SVG",
    "d": "Image formats. PNG: sharp, supports transparency. JPG: small photos. WebP: modern and small. SVG: scalable vector graphics."
   },
   {
    "t": "Web manifest",
    "d": "A small JSON file telling phones the name, icons and colors of a site when installed as an app."
   },
   {
    "t": "PWA",
    "d": "Progressive web app: a website that can be installed and even work offline."
   },
   {
    "t": "Service worker",
    "d": "A script running in the background of the browser that can cache files for offline use."
   },
   {
    "t": "Share target",
    "d": "Lets an installed web app appear in your phone's Share menu and receive files."
   }
  ]
 },
 {
  "cat": "Remembering things",
  "terms": [
   {
    "t": "Cache",
    "d": "A saved copy of files so they load faster next time."
   },
   {
    "t": "Cookie",
    "d": "A small note a site stores in your browser, e.g. to keep you logged in."
   },
   {
    "t": "localStorage",
    "d": "A place in your browser where a site can save settings on your device. Nothing is sent to a server."
   }
  ]
 },
 {
  "cat": "Staying safe",
  "terms": [
   {
    "t": "Encryption",
    "d": "Scrambling data so only the intended receiver can read it."
   },
   {
    "t": "Phishing",
    "d": "Fake emails or sites that try to trick you into giving away passwords or data."
   },
   {
    "t": "VPN",
    "d": "A private tunnel for your connection that hides your traffic from the local network."
   },
   {
    "t": "2FA",
    "d": "Two-factor authentication: a second proof besides your password, e.g. a code on your phone."
   }
  ]
 }
];

const glossaryList = document.getElementById('glossaryList');
const glossarySearch = document.getElementById('glossarySearch');

function renderGlossary(filter) {
  const q = (filter || '').trim().toLowerCase();
  glossaryList.textContent = '';
  let count = 0;
  GLOSSARY.forEach(group => {
    const items = group.terms.filter(x => !q || x.t.toLowerCase().includes(q) || x.d.toLowerCase().includes(q));
    if (!items.length) return;
    const h = document.createElement('div');
    h.className = 'glossary-cat';
    h.textContent = group.cat;
    glossaryList.appendChild(h);
    items.forEach(x => {
      const row = document.createElement('div');
      row.className = 'glossary-item';
      const t = document.createElement('p');
      t.className = 'glossary-term';
      t.textContent = x.t;
      const d = document.createElement('p');
      d.className = 'glossary-desc';
      d.textContent = x.d;
      row.append(t, d);
      glossaryList.appendChild(row);
      count++;
    });
  });
  if (!count) {
    const e = document.createElement('p');
    e.className = 'glossary-empty';
    e.textContent = 'No matching terms.';
    glossaryList.appendChild(e);
  }
}
glossarySearch.addEventListener('input', () => renderGlossary(glossarySearch.value));
renderGlossary('');

// ======================================================================
// Share target: chooser shown when a file was shared to the installed app
// ======================================================================
const SHARE_CACHE = 'first-steps-share';
const SHARE_KEY = '/shared-file';
let sharedFile = null;
let sharePreviewUrl = null;

function clearSharedFile() {
  sharedFile = null;
  if (sharePreviewUrl) { URL.revokeObjectURL(sharePreviewUrl); sharePreviewUrl = null; }
  if ('caches' in window) caches.open(SHARE_CACHE).then(c => c.delete(SHARE_KEY)).catch(() => {});
}

function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

async function handleSharedFile() {
  const params = new URLSearchParams(location.search);
  if (!params.has('shared') || !('caches' in window)) return;
  history.replaceState(null, '', location.pathname);
  try {
    const cache = await caches.open(SHARE_CACHE);
    const res = await cache.match(SHARE_KEY);
    if (!res) return;
    const blob = await res.blob();
    let name = 'shared-file';
    try { name = decodeURIComponent(res.headers.get('X-File-Name') || name); } catch (e) {}
    sharedFile = new File([blob], name, { type: blob.type });
  } catch (e) { return; }

  const isImage = sharedFile.type.startsWith('image/');
  const preview = document.getElementById('sharePreview');
  document.getElementById('shareName').textContent = sharedFile.name;
  document.getElementById('shareSize').textContent = formatBytes(sharedFile.size);
  if (isImage) {
    sharePreviewUrl = URL.createObjectURL(sharedFile);
    preview.src = sharePreviewUrl;
    preview.hidden = false;
  } else {
    preview.hidden = true;
  }
  const openBtn = document.getElementById('shareOpenFavicon');
  openBtn.disabled = !isImage;
  openBtn.classList.toggle('disabled', !isImage);
  document.getElementById('shareHint').textContent = isImage
    ? ''
    : 'This file is not an image, so no tool can open it right now.';
  hideAllViews();
  shareView.hidden = false;
}

document.getElementById('shareOpenFavicon').addEventListener('click', () => {
  if (!sharedFile) return;
  const file = sharedFile;
  showFavicon();
  loadImageFile(file);
  clearSharedFile();
});
handleSharedFile();
