import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

let scene, camera, renderer;
let clock, terrain, river, clouds = [];
let animationFrameId;
let isActive = false;

// Config
const CONFIG = {
  colors: {
    skyTop: 0x4a6583,
    skyBottom: 0xc1d3d0,
    terrain: 0x3d7c47,
    river: 0x4ca1af,
    treeTrunk: 0x4d3b2a,
    treeLeaves: 0x2d5a27,
    grass: 0x5a9e52
  }
};

export function initScreensaver(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.colors.skyBottom);
  scene.fog = new THREE.FogExp2(CONFIG.colors.skyBottom, 0.002);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 15, 40);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  clock = new THREE.Clock();

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xfffaed, 0.8);
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

  // Generate Environment
  createTerrain();
  createRiver();
  createTrees(150);
  createClouds(20);

  // Handle resize
  window.addEventListener('resize', onWindowResize, false);
}

function createTerrain() {
  const geometry = new THREE.PlaneGeometry(400, 400, 60, 60);
  geometry.rotateX(-Math.PI / 2);

  const vertices = geometry.attributes.position.array;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const z = vertices[i + 2];
    // Create rolling hills, leaving a valley for the river in the center
    const distFromCenter = Math.abs(x);
    let y = 0;
    if (distFromCenter > 20) {
      y = Math.sin(x * 0.05) * 5 + Math.cos(z * 0.05) * 5 + (distFromCenter - 20) * 0.2;
    } else {
      y = (distFromCenter / 20) * 2 - 2; // River bed dip
    }
    vertices[i + 1] = y + (Math.random() * 0.5 - 0.25); // Slight noise
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: CONFIG.colors.terrain,
    roughness: 0.8,
    flatShading: true
  });

  terrain = new THREE.Mesh(geometry, material);
  terrain.receiveShadow = true;
  scene.add(terrain);
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
    transparent: true,
    opacity: 0.8,
    roughness: 0.1,
    metalness: 0.1,
    flatShading: true
  });

  river = new THREE.Mesh(geometry, material);
  river.receiveShadow = true;
  scene.add(river);
}

function createTrees(count) {
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 3, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.treeTrunk, flatShading: true });

  const leavesGeo = new THREE.ConeGeometry(2.5, 6, 5);
  const leavesMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.treeLeaves, flatShading: true });

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

    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.y = 5;
    leaves.castShadow = true;
    leaves.receiveShadow = true;

    group.add(trunk);
    group.add(leaves);

    // Calculate approximate height (matching terrain logic)
    const distFromCenter = Math.abs(x);
    let y = Math.sin(x * 0.05) * 5 + Math.cos(z * 0.05) * 5 + (distFromCenter - 20) * 0.2;

    group.position.set(x, y, z);

    const scale = 0.8 + Math.random() * 0.6;
    group.scale.set(scale, scale, scale);
    group.rotation.y = Math.random() * Math.PI;

    scene.add(group);
  }
}

function createClouds(count) {
  const cloudGeo = new THREE.SphereGeometry(1, 7, 7);
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
    flatShading: true
  });

  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    const blobs = 3 + Math.floor(Math.random() * 4);

    for (let j = 0; j < blobs; j++) {
      const mesh = new THREE.Mesh(cloudGeo, cloudMat);
      mesh.position.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 6
      );
      const s = 3 + Math.random() * 4;
      mesh.scale.set(s, s * 0.6, s);
      group.add(mesh);
    }

    group.position.set(
      (Math.random() - 0.5) * 300,
      40 + Math.random() * 30,
      (Math.random() - 0.5) * 300
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
  document.getElementById('screensaverOverlay').style.display = 'block';

  // Fade in text
  setTimeout(() => {
    const textEl = document.getElementById('screensaverText');
    if (textEl) textEl.style.opacity = '1';
  }, 1000);

  animate();
}

export function stopScreensaver() {
  if (!isActive) return;
  isActive = false;
  cancelAnimationFrame(animationFrameId);
  document.getElementById('screensaverOverlay').style.display = 'none';
  const textEl = document.getElementById('screensaverText');
  if (textEl) textEl.style.opacity = '0';
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
      positions[i + 1] = -1.5 + Math.sin(z * 0.2 + elapsedTime * 2) * 0.3 + Math.cos(x * 0.5 + elapsedTime) * 0.2;
    }
    river.geometry.attributes.position.needsUpdate = true;
  }

  // Move clouds
  clouds.forEach(cloud => {
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
