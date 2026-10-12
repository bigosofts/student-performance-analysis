import * as THREE from "../assets/vendor/three.module.js";

let scene, camera, renderer;
let clock,
  terrain,
  river,
  clouds = [];
let animationFrameId;
let isActive = false;

// Config
const CONFIG = {
  colors: {
    skyTop: 0x268bc7,
    skyBottom: 0x75c9ed,
    terrain: 0x3d7c47,
    river: 0x18c8dc,
    treeTrunk: 0x4d3b2a,
    treeLeaves: 0x2d5a27,
    grass: 0x5a9e52,
  },
};

export function initScreensaver(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.colors.skyBottom);
  scene.fog = new THREE.FogExp2(CONFIG.colors.skyBottom, 0.00135);

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.set(0, 15, 40);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  clock = new THREE.Clock();

  // Lighting
  const ambientLight = new THREE.HemisphereLight(0xc9efff, 0x334629, 1.15);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffcf75, 2.35);
  dirLight.position.set(50, 100, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.near = 10;
  dirLight.shadow.camera.far = 200;
  dirLight.shadow.camera.left = -100;
  dirLight.shadow.camera.right = 100;
  dirLight.shadow.camera.top = 100;
  dirLight.shadow.camera.bottom = -100;
  scene.add(dirLight);
  const fillLight = new THREE.DirectionalLight(0x52d9fa, 0.7);
  fillLight.position.set(-45, 28, -35);
  scene.add(fillLight);

  // Generate Environment
  createTerrain();
  createRiver();
  createTrees(360);
  createGrass(2200);
  createClouds(20);
  createGroundBase(); // deep green base layer so sky never shows through

  // Handle resize
  window.addEventListener("resize", onWindowResize, false);
}

function createTerrain() {
  const geometry = new THREE.PlaneGeometry(400, 400, 60, 60);
  geometry.rotateX(-Math.PI / 2);

  const vertices = geometry.attributes.position.array;
  const colors = [];
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const z = vertices[i + 2];
    // Create rolling hills, leaving a valley for the river in the center
    const distFromCenter = Math.abs(x);
    let y = 0;
    if (distFromCenter > 20) {
      y =
        Math.sin(x * 0.05) * 5 +
        Math.cos(z * 0.05) * 5 +
        (distFromCenter - 20) * 0.2;
    } else {
      y = (distFromCenter / 20) * 2 - 2; // River bed dip
    }
    vertices[i + 1] = y + (Math.random() * 0.5 - 0.25); // Slight noise
    const patch = (Math.sin(x * .17 + z * .07) + Math.cos(z * .13 - x * .09)) * .5;
    const elevation = THREE.MathUtils.clamp((vertices[i + 1] + 2) / 22, 0, 1);
    const color = new THREE.Color().setHSL(.285 + patch * .07 - elevation * .045, .62 + Math.abs(patch) * .18, .21 + elevation * .16 + patch * .045);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.8,
    flatShading: true,
  });

  terrain = new THREE.Mesh(geometry, material);
  terrain.receiveShadow = true;
  scene.add(terrain);
}

// Large flat ground base — prevents sky color bleeding through gaps between hills
function createGroundBase() {
  const geometry = new THREE.PlaneGeometry(2000, 2000);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({
    color: 0x294d3d,
    roughness: 1.0,
    flatShading: false,
  });

  const base = new THREE.Mesh(geometry, material);
  base.position.y = -5; // sit well below the terrain's lowest point
  base.receiveShadow = false;
  scene.add(base);
}

function createRiver() {
  const geometry = new THREE.PlaneGeometry(30, 400, 10, 50);
  geometry.rotateX(-Math.PI / 2);

  const vertices = geometry.attributes.position.array;
  for (let i = 0; i < vertices.length; i += 3) {
    vertices[i + 1] = -1.5; // Slightly above river bed
  }

  const material = new THREE.MeshStandardMaterial({
    color: CONFIG.colors.river,
    emissive: 0x05a7ba,
    emissiveIntensity: .38,
    transparent: true,
    opacity: 0.8,
    roughness: 0.16,
    metalness: 0.32,
    flatShading: true,
  });

  river = new THREE.Mesh(geometry, material);
  river.receiveShadow = true;
  scene.add(river);
}

function createTrees(count) {
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 3, 5);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: CONFIG.colors.treeTrunk,
    flatShading: true,
  });

  const leavesGeo = new THREE.ConeGeometry(2.5, 6, 5);
  const leafPalette = [0x17482e, 0x287a3c, 0x55a342, 0x9a9c35, 0x168275, 0xc08038, 0x5a6b2e].map(color => new THREE.MeshStandardMaterial({ color, roughness: .78, flatShading: true }));

  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 300;
    const z = (Math.random() - 0.5) * 300;

    // Avoid river
    if (Math.abs(x) < 25) continue;

    const group = new THREE.Group();

    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.5;
    trunk.castShadow = true;
    trunk.receiveShadow = true;

    const leaves = new THREE.Mesh(leavesGeo, leafPalette[Math.floor(Math.random() * leafPalette.length)]);
    leaves.position.y = 5.1;
    leaves.castShadow = true;
    leaves.receiveShadow = true;

    const upperLeaves = new THREE.Mesh(leavesGeo, leaves.material);
    upperLeaves.position.y = 7.1;
    upperLeaves.scale.set(.68, .68, .68);
    upperLeaves.castShadow = true;

    group.add(trunk);
    group.add(leaves);
    group.add(upperLeaves);

    // Calculate approximate height (matching terrain logic)
    const distFromCenter = Math.abs(x);
    let y =
      Math.sin(x * 0.05) * 5 +
      Math.cos(z * 0.05) * 5 +
      (distFromCenter - 20) * 0.2;

    group.position.set(x, y, z);

    const scale = 0.8 + Math.random() * 0.6;
    group.scale.set(scale, scale, scale);
    group.rotation.y = Math.random() * Math.PI;

    scene.add(group);
  }
}

function createGrass(count) {
  const geometry = new THREE.ConeGeometry(.16, 1.2, 3);
  geometry.translate(0, .6, 0);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .9, flatShading: true });
  const grass = new THREE.InstancedMesh(geometry, material, count);
  grass.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    let x = (Math.random() - .5) * 300;
    if (Math.abs(x) < 23) x += Math.sign(x || 1) * 26;
    const z = (Math.random() - .5) * 300;
    const y = Math.sin(x * .05) * 5 + Math.cos(z * .05) * 5 + (Math.abs(x) - 20) * .2;
    const scale = .45 + Math.random() * 1.05;
    dummy.position.set(x, y, z);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
    color.setHSL(.22 + Math.random() * .16, .68 + Math.random() * .2, .25 + Math.random() * .2);
    grass.setColorAt(i, color);
  }
  grass.receiveShadow = true;
  scene.add(grass);
}

function createClouds(count) {
  const cloudGeo = new THREE.SphereGeometry(1, 7, 7);
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xf7fcff,
    emissive: 0xa5e8ff,
    emissiveIntensity: .18,
    transparent: true,
    opacity: 0.8,
    flatShading: true,
  });

  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    const blobs = 3 + Math.floor(Math.random() * 4);

    for (let j = 0; j < blobs; j++) {
      const mesh = new THREE.Mesh(cloudGeo, cloudMat);
      mesh.position.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 6,
      );
      const s = 3 + Math.random() * 4;
      mesh.scale.set(s, s * 0.6, s);
      group.add(mesh);
    }

    group.position.set(
      (Math.random() - 0.5) * 300,
      40 + Math.random() * 30,
      (Math.random() - 0.5) * 300,
    );
    scene.add(group);
    clouds.push(group);
  }
}

function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

export function startScreensaver() {
  if (isActive) return;
  isActive = true;
  document.getElementById("screensaverOverlay").style.display = "block";

  // Fade in the title panel after a short delay
  setTimeout(() => {
    const textEl = document.getElementById("screensaverText");
    if (textEl) textEl.style.opacity = "1";
  }, 1000);

  animate();
}

export function stopScreensaver() {
  if (!isActive) return;
  isActive = false;
  cancelAnimationFrame(animationFrameId);
  document.getElementById("screensaverOverlay").style.display = "none";
  const textEl = document.getElementById("screensaverText");
  if (textEl) textEl.style.opacity = "0";
}

/**
 * Update the screensaver title overlay with class session info.
 * Called from the socket 'class-session-start' event in index.html.
 * @param {string} subject    - e.g. "Agriculture"
 * @param {string} paper      - e.g. "1st Paper"
 * @param {string} chapter    - e.g. "01"
 * @param {string} chapterName - e.g. "বাংলাদেশের কৃষি"
 */
export function updateScreensaverTitle(subject, paper, chapter, chapterName) {
  const subjectEl = document.getElementById("ssSubject");
  const paperEl = document.getElementById("ssPaper");
  const chNumEl = document.getElementById("ssChapterNum");
  const chTitleEl = document.getElementById("ssChapterTitle");

  if (subjectEl) subjectEl.innerText = subject || "";
  if (paperEl) paperEl.innerText = paper || "";
  if (chNumEl) chNumEl.innerText = chapter || ""; // already "Chapter XX"
  if (chTitleEl) chTitleEl.innerText = chapterName || "";
}

function animate() {
  if (!isActive) return;
  animationFrameId = requestAnimationFrame(animate);

  const elapsedTime = clock.getElapsedTime();

  // Animate river vertices for flow effect
  if (river) {
    const positions = river.geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];
      positions[i + 1] =
        -1.5 +
        Math.sin(z * 0.2 + elapsedTime * 2) * 0.3 +
        Math.cos(x * 0.5 + elapsedTime) * 0.2;
    }
    river.geometry.attributes.position.needsUpdate = true;
  }

  // Move clouds
  clouds.forEach((cloud) => {
    cloud.position.z -= 0.05;
    cloud.position.x -= 0.02;
    if (cloud.position.z < -200) cloud.position.z = 200;
    if (cloud.position.x < -200) cloud.position.x = 200;
  });

  // Cinematic Camera Movement
  // Orbit around center slowly, slight bobbing
  const radius = 60 + Math.sin(elapsedTime * 0.1) * 20;
  const angle = elapsedTime * 0.05;

  camera.position.x = Math.cos(angle) * radius;
  camera.position.z = Math.sin(angle) * radius;
  camera.position.y = 15 + Math.sin(elapsedTime * 0.2) * 5;

  camera.lookAt(0, 5, 0);

  renderer.render(scene, camera);
}
