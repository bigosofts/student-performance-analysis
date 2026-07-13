import * as THREE from "../assets/vendor/three.module.js";

let scene, camera, renderer, clock, terrain, river;
let animationFrameId;
let isActive = false;
let containerEl = null;

const clouds = [];

const CONFIG = {
  colors: {
    skyTop: 0x6fb2ea,
    skyBottom: 0xd7eef7,
    terrain: 0x3d7c47,
    river: 0x75c6d0,
    treeTrunk: 0x4d3b2a,
    treeLeaves: 0x2f6a35,
  },
};

export function initQbankScene(containerId) {
  containerEl = document.getElementById(containerId);
  if (!containerEl) return;

  disposeQbankScene();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.colors.skyBottom);
  scene.fog = new THREE.FogExp2(CONFIG.colors.skyBottom, 0.0028);

  camera = new THREE.PerspectiveCamera(
    58,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.set(0, 15, 40);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  containerEl.innerHTML = "";
  containerEl.appendChild(renderer.domElement);
  clock = new THREE.Clock();

  createLighting();
  createTerrain();
  createRiver();
  createTrees(150);
  createClouds(20);

  window.removeEventListener("resize", onWindowResize);
  window.addEventListener("resize", onWindowResize, false);
}

export function disposeQbankScene() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (renderer) renderer.dispose();
  if (containerEl) containerEl.innerHTML = "";
  scene = null;
  camera = null;
  renderer = null;
  clock = null;
  terrain = null;
  river = null;
  clouds.length = 0;
  isActive = false;
}

export function startQbankScene() {
  if (!containerEl) return;
  if (!renderer) initQbankScene(containerEl.id);
  if (!renderer || isActive) return;
  isActive = true;
  containerEl.classList.add("active");
  clock?.start();
  animate();
}

export function stopQbankScene() {
  isActive = false;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (containerEl) containerEl.classList.remove("active");
}

function createLighting() {
  scene.add(new THREE.AmbientLight(0xffffff, 0.62));

  const dirLight = new THREE.DirectionalLight(0xfffaed, 0.95);
  dirLight.position.set(50, 100, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  dirLight.shadow.camera.near = 10;
  dirLight.shadow.camera.far = 200;
  dirLight.shadow.camera.left = -100;
  dirLight.shadow.camera.right = 100;
  dirLight.shadow.camera.top = 100;
  dirLight.shadow.camera.bottom = -100;
  scene.add(dirLight);
}

function createTerrain() {
  const geometry = new THREE.PlaneGeometry(400, 400, 60, 60);
  geometry.rotateX(-Math.PI / 2);

  const vertices = geometry.attributes.position.array;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const z = vertices[i + 2];
    const distFromCenter = Math.abs(x);
    let y = 0;
    if (distFromCenter > 20) {
      y =
        Math.sin(x * 0.05) * 5 +
        Math.cos(z * 0.05) * 5 +
        (distFromCenter - 20) * 0.2;
    } else {
      y = (distFromCenter / 20) * 2 - 2;
    }
    vertices[i + 1] = y + Math.random() * 0.5 - 0.25;
  }
  geometry.computeVertexNormals();

  terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: CONFIG.colors.terrain,
      roughness: 0.82,
      flatShading: true,
    }),
  );
  terrain.receiveShadow = true;
  scene.add(terrain);
}

function createRiver() {
  const geometry = new THREE.PlaneGeometry(30, 400, 10, 50);
  geometry.rotateX(-Math.PI / 2);

  const vertices = geometry.attributes.position.array;
  for (let i = 0; i < vertices.length; i += 3) {
    vertices[i + 1] = -1.5;
  }

  river = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: CONFIG.colors.river,
      transparent: true,
      opacity: 0.82,
      roughness: 0.1,
      metalness: 0.1,
      flatShading: true,
    }),
  );
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
  const leavesMat = new THREE.MeshStandardMaterial({
    color: CONFIG.colors.treeLeaves,
    flatShading: true,
  });

  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 300;
    const z = (Math.random() - 0.5) * 300;
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

    group.add(trunk, leaves);
    const distFromCenter = Math.abs(x);
    const y =
      Math.sin(x * 0.05) * 5 +
      Math.cos(z * 0.05) * 5 +
      (distFromCenter - 20) * 0.2;
    const scale = 0.8 + Math.random() * 0.6;
    group.position.set(x, y, z);
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
    opacity: 0.72,
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
    group.userData.speed = 0.025 + Math.random() * 0.025;
    clouds.push(group);
    scene.add(group);
  }
}

function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  if (!isActive || !renderer || !scene || !camera) return;
  animationFrameId = requestAnimationFrame(animate);

  const elapsedTime = clock.getElapsedTime();
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

  clouds.forEach((cloud) => {
    cloud.position.z -= cloud.userData.speed;
    cloud.position.x -= cloud.userData.speed * 0.4;
    if (cloud.position.z < -200) cloud.position.z = 200;
    if (cloud.position.x < -200) cloud.position.x = 200;
  });

  const radius = 60 + Math.sin(elapsedTime * 0.1) * 20;
  const angle = elapsedTime * 0.05;
  camera.position.x = Math.cos(angle) * radius;
  camera.position.z = Math.sin(angle) * radius;
  camera.position.y = 15 + Math.sin(elapsedTime * 0.2) * 5;
  camera.lookAt(0, 5, 0);

  renderer.render(scene, camera);
}
