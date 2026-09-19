/* ============================================================
   VIOLIN FLYTHROUGH · pseudo-3D a partir de una foto, sin video
   ------------------------------------------------------------
   Puerto a JS vanilla (ES module) del componente React/R3F subido
   por el usuario en "3d Violin web y render/violin-3d-camera-
   flythrough.zip". Misma matemática (recorte de fondo, extrusión
   por transformada de distancia, shader de barniz) — solo se quitó
   React/@react-three/fiber y se reemplazó por Three.js imperativo,
   porque el sitio no usa build ni framework.

   Ventaja sobre el <video>: no hay seek, así que no hay latencia de
   red ni umbral de 0.12s que ajustar — la cámara se recalcula cada
   frame directamente sobre la trayectoria.
============================================================ */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/* ---------- 1. Trayectoria de cámara (idéntica a la original) ---------- */
const F = (frame) => (frame - 1) / 61;

const KEYS = [
  { t: F(1),  az: 0,   el: 0,   dist: 14.2, roll: 0,   target: [0, 0, 0],       fov: 35 },
  { t: F(7),  az: -48, el: -22, dist: 8.0,  roll: -14, target: [0, -0.4, 0],    fov: 36 },
  { t: F(15), az: -72, el: 18,  dist: 6.0,  roll: 10,  target: [0, -1.0, 0],    fov: 38 },
  { t: F(25), az: -30, el: -55, dist: 3.4,  roll: -22, target: [0, -1.9, 0.1],  fov: 42 },
  { t: F(35), az: 42,  el: -40, dist: 3.0,  roll: 18,  target: [0, -1.3, 0.1],  fov: 44 },
  { t: F(43), az: 65,  el: -15, dist: 2.9,  roll: 28,  target: [0, 1.3, 0.1],   fov: 40 },
  { t: F(50), az: -28, el: 20,  dist: 3.2,  roll: -12, target: [0, 3.6, 0.1],   fov: 34 },
  { t: F(56), az: -70, el: 45,  dist: 11,   roll: 6,   target: [0, 0.8, 0],     fov: 26 },
  { t: F(62), az: -38, el: 22,  dist: 26,   roll: 0,   target: [0, 0, 0],       fov: 19 }
];

const lerp = (a, b, t) => a + (b - a) * t;

function poseAt(t) {
  const u = Math.min(1, Math.max(0, t));
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (u >= KEYS[i].t && u <= KEYS[i + 1].t) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  }
  const k = (u - a.t) / (b.t - a.t || 1);
  return {
    az: lerp(a.az, b.az, k), el: lerp(a.el, b.el, k),
    dist: lerp(a.dist, b.dist, k), roll: lerp(a.roll, b.roll, k),
    target: [lerp(a.target[0], b.target[0], k), lerp(a.target[1], b.target[1], k), lerp(a.target[2], b.target[2], k)],
    fov: lerp(a.fov, b.fov, k)
  };
}

function applyPose(cam, t) {
  const p = poseAt(t);
  const az = (p.az * Math.PI) / 180, el = (p.el * Math.PI) / 180;
  cam.position.set(
    p.target[0] + p.dist * Math.cos(el) * Math.sin(az),
    p.target[1] + p.dist * Math.sin(el),
    p.target[2] + p.dist * Math.cos(el) * Math.cos(az)
  );
  cam.up.set(0, 1, 0);
  cam.lookAt(p.target[0], p.target[1], p.target[2]);
  cam.rotateZ((p.roll * Math.PI) / 180);
  cam.fov = p.fov;
  cam.updateProjectionMatrix();
}

/* ---------- 2. Recorte del fondo blanco (idéntico a la original) ---------- */
function processImage(img) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;

  const isWhite = (i) => {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const mn = Math.min(r, g, b);
    return mn > 212 && Math.max(r, g, b) - mn < 30;
  };

  const bg = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    const p = y * w + x;
    if (bg[p] || !isWhite(p * 4)) return;
    bg[p] = 1; stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }

  const ext = new Uint8Array(bg);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (bg[p]) continue;
      if ((x > 0 && bg[p - 1]) || (x < w - 1 && bg[p + 1]) || (y > 0 && bg[p - w]) || (y < h - 1 && bg[p + w])) ext[p] = 1;
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x, i = p * 4;
      if (ext[p]) { d[i] = 58; d[i + 1] = 34; d[i + 2] = 18; d[i + 3] = 0; continue; }
      const edge = (x > 0 && ext[p - 1]) || (x < w - 1 && ext[p + 1]) || (y > 0 && ext[p - w]) || (y < h - 1 && ext[p + w]);
      if (edge) {
        const mn = Math.min(d[i], d[i + 1], d[i + 2]) / 255;
        const a = 1 - Math.min(1, Math.max(0, (mn - 0.55) / 0.35));
        d[i + 3] = Math.round(255 * Math.max(0.55, a));
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  return { canvas, exterior: ext, w, h };
}

/* ---------- 3. Malla sólida con bordes redondeados (idéntico) ---------- */
function edt1d(f, n, out) {
  const v = new Int32Array(n), z = new Float64Array(n + 1);
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const dq = q - v[k]; out[q] = dq * dq + f[v[k]]; }
}

function distanceTransform(inside, W, H) {
  const INF = 1e12;
  const g = new Float64Array(W * H);
  const col = new Float64Array(H), colOut = new Float64Array(H);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) col[y] = inside[y * W + x] ? INF : 0;
    edt1d(col, H, colOut);
    for (let y = 0; y < H; y++) g[y * W + x] = colOut[y];
  }
  const row = new Float64Array(W), rowOut = new Float64Array(W);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) row[x] = g[y * W + x];
    edt1d(row, W, rowOut);
    for (let x = 0; x < W; x++) g[y * W + x] = Math.sqrt(rowOut[x]);
  }
  return g;
}

const VIOLIN_HEIGHT = 8;
const GRID_W = 180;

function thicknessProfile(d) {
  if (d <= 0) return 0;
  const r = 0.12, H = 0.32, R = 0.6;
  const edge = d < r ? Math.sqrt(Math.max(0, d * (2 * r - d))) : r;
  const u = Math.min(1, d / R);
  const arch = (H - r) * u * u * (3 - 2 * u);
  return Math.min(edge + arch, 2.5 * d);
}

function buildGeometry(p) {
  const aspect = p.w / p.h;
  const width = VIOLIN_HEIGHT * aspect;
  const W = GRID_W, Hh = Math.round(W / aspect);
  const VW = W + 1, VH = Hh + 1;
  const cell = width / W;

  const inside = new Uint8Array(VW * VH);
  const bx = Math.max(1, Math.ceil((p.w / W) * 0.5));
  const by = Math.max(1, Math.ceil((p.h / Hh) * 0.5));
  for (let j = 0; j < VH; j++) {
    const cy = Math.round((j / Hh) * (p.h - 1));
    for (let i = 0; i < VW; i++) {
      const cx = Math.round((i / W) * (p.w - 1));
      let hit = 0;
      for (let y = Math.max(0, cy - by); y <= Math.min(p.h - 1, cy + by) && !hit; y++) {
        for (let x = Math.max(0, cx - bx); x <= Math.min(p.w - 1, cx + bx); x++) {
          if (!p.exterior[y * p.w + x]) { hit = 1; break; }
        }
      }
      inside[j * VW + i] = hit;
    }
  }

  const dist = distanceTransform(inside, VW, VH);
  const nV = VW * VH;
  const positions = new Float32Array(nV * 2 * 3);
  const uvs = new Float32Array(nV * 2 * 2);
  const sides = new Float32Array(nV * 2);

  for (let j = 0; j < VH; j++) {
    for (let i = 0; i < VW; i++) {
      const idx = j * VW + i;
      const x = (i / W - 0.5) * width;
      const y = (0.5 - j / Hh) * VIOLIN_HEIGHT;
      const z = inside[idx] ? thicknessProfile(dist[idx] * cell) : 0;
      const u = i / W, v = 1 - j / Hh;

      positions[idx * 3] = x; positions[idx * 3 + 1] = y; positions[idx * 3 + 2] = z;
      uvs[idx * 2] = u; uvs[idx * 2 + 1] = v; sides[idx] = 0;

      const b = nV + idx;
      positions[b * 3] = x; positions[b * 3 + 1] = y; positions[b * 3 + 2] = -z * 0.92;
      uvs[b * 2] = u; uvs[b * 2 + 1] = v; sides[b] = 1;
    }
  }

  const indices = [];
  for (let j = 0; j < Hh; j++) {
    for (let i = 0; i < W; i++) {
      const a = j * VW + i, b = a + 1, c = a + VW, d2 = c + 1;
      if (!inside[a] && !inside[b] && !inside[c] && !inside[d2]) continue;
      indices.push(a, c, b, b, c, d2);
      const A = a + nV, B = b + nV, C = c + nV, D = d2 + nV;
      indices.push(A, B, C, B, D, C);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('side', new THREE.BufferAttribute(sides, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/* ---------- 4. Shader: textura de la foto + luz estática (idéntico) ---------- */
const vert = `
  attribute float side;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vP;
  varying float vSide;
  void main() {
    vUv = uv;
    vSide = side;
    vN = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vP = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const frag = `
  uniform sampler2D map;
  uniform vec3 lightDir;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vP;
  varying float vSide;
  void main() {
    vec4 c = texture2D(map, vUv);
    if (c.a < 0.5) discard;
    vec3 n = normalize(vN);
    vec3 V = normalize(cameraPosition - vP);
    vec3 L = normalize(lightDir);
    float diff = max(dot(n, L), 0.0);
    vec3 Hv = normalize(L + V);
    float spec = pow(max(dot(n, Hv), 0.0), 48.0) * 0.16;
    float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0) * 0.10;
    float shade = mix(1.0, 0.62, vSide);
    vec3 col = c.rgb * (0.70 + 0.35 * diff) * shade + spec + rim * c.rgb;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ---------- 5. API pública ---------- */
/**
 * Crea la escena dentro de `container` (debe tener position:relative/absolute
 * y tamaño ya definido por CSS). Devuelve { setProgress(t), destroy() }.
 * `setProgress` se llama en el onUpdate del ScrollTrigger existente, con el
 * mismo `self.progress` (0..1) que antes se usaba para el seek del video.
 */
export function createViolinFlythrough({ container, imageSrc, smooth = true }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
  camera.position.set(0, 0, 13.4);

  let mesh = null, disposed = false, raf = 0;
  let tTarget = 0, tCur = 0;

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function () {
    if (disposed) return;
    const processed = processImage(img);
    const tex = new THREE.CanvasTexture(processed.canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.needsUpdate = true;
    const geo = buildGeometry(processed);
    const uniforms = { map: { value: tex }, lightDir: { value: new THREE.Vector3(-0.3, 0.5, 1.0) } };
    const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: uniforms, side: THREE.FrontSide });
    mat.toneMapped = false;
    mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    applyPose(camera, tCur);
    renderer.render(scene, camera);
  };
  img.onerror = function () {
    console.warn('[violin-flythrough] no se pudo cargar la imagen:', imageSrc);
  };
  img.src = imageSrc;

  let last = performance.now();
  function loop(now) {
    if (disposed) return;
    const delta = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (smooth) {
      const k = 1 - Math.exp(-delta * 14);
      tCur += (tTarget - tCur) * k;
      if (Math.abs(tTarget - tCur) < 1e-4) tCur = tTarget;
    } else {
      tCur = tTarget;
    }
    applyPose(camera, tCur);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  return {
    setProgress: function (t) { tTarget = Math.min(1, Math.max(0, t)); },
    destroy: function () {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (mesh) {
        mesh.geometry.dispose();
        mesh.material.uniforms.map.value && mesh.material.uniforms.map.value.dispose();
        mesh.material.dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  };
}
