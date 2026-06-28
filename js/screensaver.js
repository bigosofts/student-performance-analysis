import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";

let scene, camera, renderer, clock;
let terrain, river, riverMaterial, sun, moon, skyDome, cinematicTitle, sunVeilCloud;
let animationFrameId;
let isActive = false;
let screensaverContainerId = null;

const clouds = [];
const birds = [];
const butterflies = [];
const driftingLeaves = [];
const animatedReeds = [];
const fireflies = [];
const waterFoam = [];
const windObjects = [];
const titleSurfaces = [];

let currentPaperTitle = "Agriculture 1st Paper";
let currentChapterTitle = "Chapter 01: বাংলাদেশের কৃষি";

const CONFIG = {
  worldSize: 460,
  riverHalfWidth: 14,
  colors: {
    skyTop: 0x78b8ef,
    skyHorizon: 0xd9efff,
    distantHill: 0x7e9b79,
    grass: 0x78985a,
    deepGrass: 0x506f45,
    soil: 0x8a744f,
    river: 0x7fc4cc,
    riverDeep: 0x2c6a76,
    bark: 0x5d4735,
    leafA: 0x3f6d3f,
    leafB: 0x6f9149,
    reed: 0x8a8d55,
    stone: 0x87887d,
    flowerPink: 0xd98aa1,
    flowerGold: 0xe2bc62,
  },
};

export function initScreensaver(containerId) {
  screensaverContainerId = containerId;
  const container = document.getElementById(containerId);
  if (!container) return;

  disposeScene();

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xcfe4ef, 0.0054);

  camera = new THREE.PerspectiveCamera(
    54,
    window.innerWidth / window.innerHeight,
    0.1,
    1200,
  );
  camera.position.set(55, 22, 72);

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

  container.innerHTML = "";
  container.appendChild(renderer.domElement);
  clock = new THREE.Clock();

  createSky();
  createLighting();
  createTerrain();
  createRiver();
  createDistantHills();
  createFarmFields();
  createForest(155);
  createMeadowDetails();
  createRocks(130);
  createBridge();
  createCabin();
  createFarmHouses();
  createFarmProps();
  createLandMarkers();
  createClouds(16);
  createSunVeilCloud();
  createBirds(12);
  createButterflies(14);
  createDriftingLeaves(50);
  createFireflies(36);
  refreshTitleSurfaces();

  window.removeEventListener("resize", onWindowResize);
  window.addEventListener("resize", onWindowResize, false);
}

function disposeScene() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (renderer) renderer.dispose();
  scene = null;
  camera = null;
  renderer = null;
  clock = null;
  clouds.length = 0;
  birds.length = 0;
  butterflies.length = 0;
  driftingLeaves.length = 0;
  animatedReeds.length = 0;
  fireflies.length = 0;
  waterFoam.length = 0;
  windObjects.length = 0;
  titleSurfaces.length = 0;
  cinematicTitle = null;
  sunVeilCloud = null;
}

function createSky() {
  const uniforms = {
    topColor: { value: new THREE.Color(CONFIG.colors.skyTop) },
    horizonColor: { value: new THREE.Color(CONFIG.colors.skyHorizon) },
    offset: { value: 0.08 },
    exponent: { value: 0.78 },
  };

  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        gl_FragColor = vec4(mix(horizonColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `,
  });

  skyDome = new THREE.Mesh(new THREE.SphereGeometry(700, 48, 24), material);
  scene.add(skyDome);

  sun = new THREE.Mesh(
    new THREE.SphereGeometry(8, 32, 16),
    new THREE.MeshBasicMaterial({
      color: 0xffedb6,
      transparent: true,
      opacity: 0.48,
    }),
  );
  sun.position.set(-90, 115, -120);
  scene.add(sun);

  moon = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 32, 16),
    new THREE.MeshBasicMaterial({
      color: 0xe7f2ff,
      transparent: true,
      opacity: 0.45,
    }),
  );
  moon.position.set(145, 82, 35);
  scene.add(moon);
}

function createLighting() {
  const hemisphere = new THREE.HemisphereLight(0xeaf7ff, 0x5f7450, 1.75);
  scene.add(hemisphere);

  const keyLight = new THREE.DirectionalLight(0xfff4dc, 2.7);
  keyLight.position.set(-80, 120, -55);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 10;
  keyLight.shadow.camera.far = 330;
  keyLight.shadow.camera.left = -140;
  keyLight.shadow.camera.right = 140;
  keyLight.shadow.camera.top = 140;
  keyLight.shadow.camera.bottom = -140;
  scene.add(keyLight);

  const rim = new THREE.DirectionalLight(0xaed8ff, 0.75);
  rim.position.set(100, 40, 90);
  scene.add(rim);
}

function createTerrain() {
  const geometry = new THREE.PlaneGeometry(
    CONFIG.worldSize,
    CONFIG.worldSize,
    210,
    210,
  );
  geometry.rotateX(-Math.PI / 2);

  const color = new THREE.Color();
  const colors = [];
  const positions = geometry.attributes.position.array;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const z = positions[i + 2];
    const h = terrainHeight(x, z);
    positions[i + 1] = h;

    const valley = THREE.MathUtils.smoothstep(
      Math.abs(x - riverCenterX(z)),
      CONFIG.riverHalfWidth,
      CONFIG.riverHalfWidth + 38,
    );
    const shade = THREE.MathUtils.clamp(
      0.68 + h * 0.012 + noise2(x * 0.05, z * 0.05) * 0.12,
      0.46,
      0.96,
    );
    color.setHex(valley < 0.25 ? CONFIG.colors.soil : CONFIG.colors.grass);
    color.lerp(new THREE.Color(CONFIG.colors.deepGrass), (1 - shade) * 0.75);
    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    map: createGroundTexture(),
    vertexColors: true,
    roughness: 0.96,
    metalness: 0.02,
  });

  terrain = new THREE.Mesh(geometry, material);
  terrain.receiveShadow = true;
  scene.add(terrain);
}

function createRiver() {
  const length = CONFIG.worldSize + 30;
  const width = CONFIG.riverHalfWidth * 2;
  const geometry = new THREE.PlaneGeometry(width, length, 36, 160);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    const localX = positions[i];
    const z = positions[i + 2];
    const bend = riverCenterX(z);
    positions[i] = localX + bend;
    positions[i + 1] = -1.15 + Math.abs(localX / width) * 0.18;
  }
  geometry.userData.basePositions = Float32Array.from(positions);
  geometry.computeVertexNormals();

  riverMaterial = new THREE.MeshPhysicalMaterial({
    color: CONFIG.colors.river,
    emissive: CONFIG.colors.riverDeep,
    emissiveIntensity: 0.04,
    roughness: 0.03,
    metalness: 0.05,
    transmission: 0.22,
    thickness: 1.5,
    transparent: true,
    opacity: 0.78,
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    normalMap: createWaterNormalTexture(),
    normalScale: new THREE.Vector2(0.18, 0.28),
  });

  river = new THREE.Mesh(geometry, riverMaterial);
  river.receiveShadow = true;
  scene.add(river);

  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xe8fbff,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  for (let i = 0; i < 84; i++) {
    const z = -220 + Math.random() * 440;
    const side = Math.random() > 0.5 ? 1 : -1;
    const x =
      riverCenterX(z) +
      side * (CONFIG.riverHalfWidth - 0.8 + Math.random() * 2.6);
    const foam = new THREE.Mesh(
      new THREE.PlaneGeometry(
        3 + Math.random() * 7,
        0.12 + Math.random() * 0.22,
      ),
      foamMat.clone(),
    );
    foam.rotation.x = -Math.PI / 2;
    foam.rotation.z = side * (Math.PI / 2 + (Math.random() - 0.5) * 0.35);
    foam.position.set(x, -0.78, z);
    foam.userData = {
      speed: 1.2 + Math.random() * 2.4,
      phase: Math.random() * 10,
      side,
    };
    waterFoam.push(foam);
    scene.add(foam);
  }
}

function createFarmFields() {
  const fieldMat = new THREE.MeshStandardMaterial({
    color: 0x8b7a48,
    roughness: 0.98,
    metalness: 0,
  });
  const cropMat = new THREE.MeshStandardMaterial({
    color: 0x6f9b3d,
    roughness: 0.86,
  });
  const rowMat = new THREE.MeshStandardMaterial({
    color: 0x5f4d32,
    roughness: 0.95,
  });

  const patches = [
    { x: -78, z: -42, w: 58, d: 42, rot: 0.12 },
    { x: 74, z: -54, w: 64, d: 46, rot: -0.1 },
    { x: -100, z: 58, w: 52, d: 36, rot: -0.18 },
    { x: 96, z: 58, w: 58, d: 38, rot: 0.16 },
    { x: -18, z: -118, w: 72, d: 34, rot: 0.04 },
    { x: 132, z: -126, w: 54, d: 34, rot: -0.28 },
    { x: -142, z: -112, w: 50, d: 30, rot: 0.31 },
  ];

  patches.forEach((patch) => {
    const field = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(patch.w, patch.d),
      fieldMat,
    );
    base.rotation.x = -Math.PI / 2;
    base.position.y = 0.03;
    base.receiveShadow = true;
    field.add(base);

    const rowCount = Math.floor(patch.w / 4);
    for (let i = 0; i < rowCount; i++) {
      const x = -patch.w / 2 + 3 + i * 4;
      const furrow = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.08, patch.d * 0.92),
        rowMat,
      );
      furrow.position.set(x, 0.1, 0);
      furrow.receiveShadow = true;
      field.add(furrow);

      for (let j = 0; j < 9; j++) {
        const crop = new THREE.Mesh(
          new THREE.ConeGeometry(0.32, 1.2, 5),
          cropMat,
        );
        crop.position.set(
          x + (Math.random() - 0.5) * 0.45,
          0.68,
          -patch.d * 0.42 + j * ((patch.d * 0.84) / 8),
        );
        crop.rotation.z = (Math.random() - 0.5) * 0.22;
        crop.castShadow = true;
        field.add(crop);
        windObjects.push({
          object: crop,
          strength: 0.035 + Math.random() * 0.025,
          phase: Math.random() * 20,
        });
      }
    }

    field.position.set(
      patch.x,
      terrainHeight(patch.x, patch.z) + 0.05,
      patch.z,
    );
    field.rotation.y = patch.rot;
    field.rotation.x = THREE.MathUtils.degToRad((Math.random() - 0.5) * 5);
    field.rotation.z = THREE.MathUtils.degToRad((Math.random() - 0.5) * 7);
    scene.add(field);
  });

  createTerracedFields();
}

function createTerracedFields() {
  const fieldMat = new THREE.MeshStandardMaterial({
    color: 0x9a8a56,
    roughness: 0.98,
  });
  const cropMat = new THREE.MeshStandardMaterial({
    color: 0x7fae45,
    roughness: 0.86,
  });
  const terraceConfigs = [
    { x: -148, z: -62, rot: -0.38, levels: 5 },
    { x: 145, z: -24, rot: 0.34, levels: 4 },
  ];

  terraceConfigs.forEach((config) => {
    for (let level = 0; level < config.levels; level++) {
      const width = 44 + level * 7;
      const depth = 8;
      const terrace = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.42, depth),
        fieldMat,
      );
      base.position.y = 0.15 + level * 0.34;
      base.receiveShadow = true;
      terrace.add(base);

      for (let i = 0; i < Math.floor(width / 4); i++) {
        const crop = new THREE.Mesh(
          new THREE.ConeGeometry(0.22, 0.9, 5),
          cropMat,
        );
        crop.position.set(
          -width / 2 + 2 + i * 4,
          0.85 + level * 0.34,
          (Math.random() - 0.5) * depth * 0.55,
        );
        crop.castShadow = true;
        terrace.add(crop);
        windObjects.push({
          object: crop,
          strength: 0.035,
          phase: Math.random() * 20,
        });
      }

      const z = config.z + level * 8;
      terrace.position.set(
        config.x,
        terrainHeight(config.x, z) + level * 0.25,
        z,
      );
      terrace.rotation.y = config.rot;
      terrace.rotation.x = THREE.MathUtils.degToRad(-5 + level * 1.5);
      scene.add(terrace);
    }
  });
}

function createDistantHills() {
  const hillGeo = new THREE.SphereGeometry(
    1,
    36,
    16,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2,
  );
  const rows = [
    {
      z: -250,
      y: -8,
      opacity: 0.56,
      color: 0x89a98b,
      count: 6,
      scale: [80, 28, 34],
    },
    {
      z: -320,
      y: -4,
      opacity: 0.38,
      color: 0xa8bca6,
      count: 5,
      scale: [120, 34, 42],
    },
  ];

  rows.forEach((row, rowIndex) => {
    const material = new THREE.MeshStandardMaterial({
      color: row.color,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: Math.min(row.opacity + 0.24, 0.86),
      depthWrite: true,
    });

    for (let i = 0; i < row.count; i++) {
      const hill = new THREE.Mesh(hillGeo, material);
      const x =
        -320 + i * (640 / (row.count - 1)) + Math.sin(i * 1.7 + rowIndex) * 22;
      const sx = row.scale[0] * (0.75 + Math.random() * 0.5);
      const sy = row.scale[1] * (0.75 + Math.random() * 0.45);
      const sz = row.scale[2] * (0.85 + Math.random() * 0.4);
      hill.position.set(x, row.y, row.z - Math.random() * 26);
      hill.scale.set(sx, sy, sz);
      hill.receiveShadow = true;
      scene.add(hill);
    }
  });
}

function createForest(count) {
  const trunkMats = [
    new THREE.MeshStandardMaterial({
      color: CONFIG.colors.bark,
      roughness: 0.9,
    }),
    new THREE.MeshStandardMaterial({ color: 0x4b3626, roughness: 0.95 }),
  ];
  const leafMats = [
    new THREE.MeshStandardMaterial({
      color: CONFIG.colors.leafA,
      roughness: 0.72,
    }),
    new THREE.MeshStandardMaterial({
      color: CONFIG.colors.leafB,
      roughness: 0.68,
    }),
    new THREE.MeshStandardMaterial({ color: 0x6b943c, roughness: 0.74 }),
  ];

  const trunkGeo = new THREE.CylinderGeometry(0.24, 0.46, 4.6, 10);
  const crownGeo = new THREE.SphereGeometry(2.05, 16, 12);
  const pineGeo = new THREE.ConeGeometry(2.35, 5.8, 14);

  let placed = 0;
  while (placed < count) {
    const x = (Math.random() - 0.5) * 410;
    const z = (Math.random() - 0.5) * 410;
    if (
      Math.abs(x - riverCenterX(z)) <
      CONFIG.riverHalfWidth + 10 + Math.random() * 16
    )
      continue;

    const height = terrainHeight(x, z);
    const tree = new THREE.Group();
    const scale = 0.45 + Math.random() * 1.75;
    const shapeRoll = Math.random();
    const isPine = shapeRoll > 0.58;
    const isBlooming = !isPine && shapeRoll < 0.24;

    const trunk = new THREE.Mesh(
      trunkGeo,
      trunkMats[Math.floor(Math.random() * trunkMats.length)],
    );
    trunk.position.y = 2.15 * scale;
    trunk.scale.set(0.8 * scale, scale, 0.8 * scale);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    const crownCount = isPine ? 3 : 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < crownCount; i++) {
      const crown = new THREE.Mesh(
        isPine ? pineGeo : crownGeo,
        leafMats[Math.floor(Math.random() * leafMats.length)],
      );
      crown.position.set(
        (Math.random() - 0.5) * 0.55 * scale,
        (4.6 + i * (isPine ? 1.55 : 0.75)) * scale,
        (Math.random() - 0.5) * 0.55 * scale,
      );
      const crownScale =
        scale * (isPine ? 1 - i * 0.18 : 0.85 + Math.random() * 0.35);
      crown.scale.set(crownScale, crownScale * (isPine ? 1 : 0.82), crownScale);
      crown.rotation.set(
        Math.random() * 0.16,
        Math.random() * Math.PI,
        Math.random() * 0.16,
      );
      crown.castShadow = true;
      crown.receiveShadow = true;
      tree.add(crown);
      windObjects.push({
        object: crown,
        strength: 0.012 + Math.random() * 0.025,
        phase: Math.random() * 20,
      });
    }

    if (isBlooming) {
      addTreeBlossoms(tree, scale);
    }

    tree.position.set(x, height, z);
    tree.rotation.y = Math.random() * Math.PI * 2;
    scene.add(tree);
    placed += 1;
  }
}

function addTreeBlossoms(tree, scale) {
  const blossomColors = [0xf4a7c5, 0xf7d66b, 0xf6f2d4, 0xc9b8ff, 0xffb37d];
  const mat = new THREE.MeshStandardMaterial({
    color: blossomColors[Math.floor(Math.random() * blossomColors.length)],
    roughness: 0.55,
  });
  const geo = new THREE.SphereGeometry(0.14, 8, 6);
  const count = 18 + Math.floor(Math.random() * 18);

  for (let i = 0; i < count; i++) {
    const blossom = new THREE.Mesh(geo, mat);
    const angle = Math.random() * Math.PI * 2;
    const radius = (1.2 + Math.random() * 2.2) * scale;
    blossom.position.set(
      Math.cos(angle) * radius,
      (4.4 + Math.random() * 2.8) * scale,
      Math.sin(angle) * radius,
    );
    blossom.scale.setScalar(0.75 + Math.random() * 1.4);
    blossom.castShadow = true;
    tree.add(blossom);
  }
}

function createMeadowDetails() {
  const grassGeo = new THREE.ConeGeometry(0.08, 1.2, 4);
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x7cab4e,
    roughness: 0.9,
  });
  const flowerStemGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.65, 5);
  const flowerPetalGeo = new THREE.SphereGeometry(0.12, 8, 6);
  const flowerMats = [
    new THREE.MeshStandardMaterial({
      color: CONFIG.colors.flowerPink,
      roughness: 0.5,
    }),
    new THREE.MeshStandardMaterial({
      color: CONFIG.colors.flowerGold,
      roughness: 0.5,
    }),
    new THREE.MeshStandardMaterial({ color: 0xb8dbff, roughness: 0.5 }),
  ];

  const grass = new THREE.InstancedMesh(grassGeo, grassMat, 2600);
  const matrix = new THREE.Matrix4();
  let index = 0;
  for (let i = 0; i < 3400 && index < grass.count; i++) {
    const z = (Math.random() - 0.5) * 380;
    const center = riverCenterX(z);
    const x =
      center +
      (Math.random() > 0.5 ? 1 : -1) *
        (CONFIG.riverHalfWidth + 3 + Math.random() * 26);
    const y = terrainHeight(x, z) + 0.58;
    const s = 0.55 + Math.random() * 1.25;
    matrix.compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          (Math.random() - 0.5) * 0.4,
          Math.random() * Math.PI,
          (Math.random() - 0.5) * 0.4,
        ),
      ),
      new THREE.Vector3(s, s, s),
    );
    grass.setMatrixAt(index, matrix);
    index += 1;
  }
  grass.castShadow = true;
  grass.receiveShadow = true;
  scene.add(grass);

  for (let i = 0; i < 180; i++) {
    const z = (Math.random() - 0.5) * 340;
    const x =
      riverCenterX(z) +
      (Math.random() > 0.5 ? 1 : -1) *
        (CONFIG.riverHalfWidth + 7 + Math.random() * 42);
    const y = terrainHeight(x, z);
    const flower = new THREE.Group();
    const stem = new THREE.Mesh(flowerStemGeo, grassMat);
    stem.position.y = 0.34;
    flower.add(stem);
    const petals = new THREE.Mesh(
      flowerPetalGeo,
      flowerMats[Math.floor(Math.random() * flowerMats.length)],
    );
    petals.position.y = 0.74;
    petals.scale.set(1.45, 0.65, 1.45);
    petals.castShadow = true;
    flower.add(petals);
    flower.position.set(x, y, z);
    flower.scale.setScalar(0.75 + Math.random() * 0.6);
    scene.add(flower);
    windObjects.push({
      object: flower,
      strength: 0.025 + Math.random() * 0.03,
      phase: Math.random() * 20,
    });
  }

  const reedMat = new THREE.MeshStandardMaterial({
    color: CONFIG.colors.reed,
    roughness: 0.86,
  });
  for (let i = 0; i < 180; i++) {
    const z = -220 + Math.random() * 440;
    const side = Math.random() > 0.5 ? 1 : -1;
    const x =
      riverCenterX(z) + side * (CONFIG.riverHalfWidth + Math.random() * 3);
    const reed = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.05, 1.8 + Math.random() * 1.5, 5),
      reedMat,
    );
    reed.position.set(
      x,
      terrainHeight(x, z) + reed.geometry.parameters.height / 2,
      z,
    );
    reed.rotation.z = side * (0.08 + Math.random() * 0.18);
    reed.castShadow = true;
    animatedReeds.push({
      object: reed,
      baseRotation: reed.rotation.z,
      phase: Math.random() * 20,
    });
    scene.add(reed);
  }
}

function createRocks(count) {
  const rockMat = new THREE.MeshStandardMaterial({
    color: CONFIG.colors.stone,
    roughness: 0.96,
    metalness: 0.02,
  });
  const rockGeo = new THREE.DodecahedronGeometry(1, 1);

  for (let i = 0; i < count; i++) {
    const z = -215 + Math.random() * 430;
    const nearWater = Math.random() > 0.2;
    const x = nearWater
      ? riverCenterX(z) +
        (Math.random() > 0.5 ? 1 : -1) *
          (CONFIG.riverHalfWidth + Math.random() * 8)
      : (Math.random() - 0.5) * 380;
    if (
      !nearWater &&
      Math.abs(x - riverCenterX(z)) < CONFIG.riverHalfWidth + 20
    )
      continue;

    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(x, terrainHeight(x, z) + 0.28, z);
    rock.scale.set(
      0.45 + Math.random() * 1.8,
      0.25 + Math.random() * 0.8,
      0.45 + Math.random() * 1.6,
    );
    rock.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    );
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }
}

function createBridge() {
  const wood = new THREE.MeshStandardMaterial({
    color: 0x7b5132,
    roughness: 0.82,
  });
  const rope = new THREE.MeshStandardMaterial({
    color: 0xb0895e,
    roughness: 0.95,
  });
  const wetWood = new THREE.MeshStandardMaterial({
    color: 0x4f3728,
    roughness: 0.9,
  });
  const bridge = new THREE.Group();
  const plankGeo = new THREE.BoxGeometry(2.2, 0.35, 7.2);

  for (let i = -7; i <= 7; i++) {
    const plank = new THREE.Mesh(plankGeo, wood);
    plank.position.set(i * 1.9, 2.2 + Math.sin(i * 0.35) * 0.25, 0);
    plank.rotation.z = Math.sin(i) * 0.04;
    plank.castShadow = true;
    plank.receiveShadow = true;
    bridge.add(plank);
  }

  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 31, 8),
      rope,
    );
    rail.position.set(0, 4.4, side * 4.2);
    rail.rotation.z = Math.PI / 2;
    rail.castShadow = true;
    bridge.add(rail);

    for (let i = -7; i <= 7; i += 2) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.18, 2.7, 7),
        wood,
      );
      post.position.set(i * 1.9, 3.2, side * 4.1);
      post.castShadow = true;
      bridge.add(post);
    }
  }

  const pierGeo = new THREE.CylinderGeometry(0.22, 0.32, 4.4, 10);
  const braceGeo = new THREE.CylinderGeometry(0.08, 0.1, 5.1, 8);
  for (const x of [-11.4, -3.8, 3.8, 11.4]) {
    for (const z of [-3.15, 3.15]) {
      const pier = new THREE.Mesh(pierGeo, wetWood);
      pier.position.set(x, 0.1, z);
      pier.castShadow = true;
      pier.receiveShadow = true;
      bridge.add(pier);
    }

    const leftBrace = new THREE.Mesh(braceGeo, wetWood);
    leftBrace.position.set(x, 1.05, 0);
    leftBrace.rotation.x = 0.72;
    leftBrace.castShadow = true;
    bridge.add(leftBrace);

    const rightBrace = new THREE.Mesh(braceGeo, wetWood);
    rightBrace.position.set(x, 1.05, 0);
    rightBrace.rotation.x = -0.72;
    rightBrace.castShadow = true;
    bridge.add(rightBrace);
  }

  const bankPostGeo = new THREE.CylinderGeometry(0.28, 0.38, 3.2, 10);
  for (const x of [-15.2, 15.2]) {
    for (const z of [-3.6, 3.6]) {
      const post = new THREE.Mesh(bankPostGeo, wetWood);
      post.position.set(x, 0.8, z);
      post.castShadow = true;
      post.receiveShadow = true;
      bridge.add(post);
    }
  }

  bridge.position.set(riverCenterX(18), 0, 18);
  bridge.rotation.y = -0.08;
  scene.add(bridge);
}

function createCabin() {
  const cabin = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x8a5e3d,
    roughness: 0.84,
  });
  const darkWood = new THREE.MeshStandardMaterial({
    color: 0x4f301f,
    roughness: 0.9,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x5f2520,
    roughness: 0.78,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffd184,
    emissive: 0xffa844,
    emissiveIntensity: 0.55,
    roughness: 0.18,
    metalness: 0.05,
    transparent: true,
    opacity: 0.8,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(16, 9, 12), wallMat);
  body.position.y = 5;
  body.castShadow = true;
  body.receiveShadow = true;
  cabin.add(body);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(12, 6, 4), roofMat);
  roof.position.y = 11;
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.78;
  roof.castShadow = true;
  cabin.add(roof);

  const door = new THREE.Mesh(new THREE.BoxGeometry(3.3, 5.4, 0.25), darkWood);
  door.position.set(-3.6, 3.1, 6.12);
  cabin.add(door);

  for (const x of [2.7, 6.2]) {
    const windowMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.2, 0.28),
      glassMat,
    );
    windowMesh.position.set(x, 5.6, 6.15);
    cabin.add(windowMesh);
  }

  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 5.5, 2.1),
    darkWood,
  );
  chimney.position.set(-4.8, 13, -1.5);
  chimney.castShadow = true;
  cabin.add(chimney);

  cabin.position.set(-58, terrainHeight(-58, -46), -46);
  cabin.rotation.y = 0.32;
  scene.add(cabin);

  const warmLight = new THREE.PointLight(0xffb35c, 6, 55, 2.2);
  warmLight.position.set(-48, terrainHeight(-58, -46) + 6, -38);
  scene.add(warmLight);
}

function createFarmHouses() {
  const houses = [
    { x: 58, z: -104, scale: 0.72, rot: -0.45, wall: 0xa56f4a, roof: 0x8f3d32 },
    { x: 118, z: -84, scale: 0.58, rot: 0.22, wall: 0xb28a5e, roof: 0x6f4a39 },
    { x: -126, z: -82, scale: 0.62, rot: 0.52, wall: 0x9d7252, roof: 0x7a3730 },
    { x: -34, z: -142, scale: 0.5, rot: -0.08, wall: 0xb69a6a, roof: 0x6d4a36 },
    { x: 138, z: 36, scale: 0.52, rot: -0.72, wall: 0xa17c58, roof: 0x784036 },
  ];

  houses.forEach((house) => {
    const group = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({
      color: house.wall,
      roughness: 0.86,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: house.roof,
      roughness: 0.78,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x4a3328,
      roughness: 0.9,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xffdc8c,
      emissive: 0xffb15c,
      emissiveIntensity: 0.25,
      roughness: 0.4,
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 9), wallMat);
    body.position.y = 3.5;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(8.6, 4.2, 4), roofMat);
    roof.position.y = 8.8;
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.82;
    roof.castShadow = true;
    group.add(roof);

    const door = new THREE.Mesh(new THREE.BoxGeometry(2, 3.8, 0.22), trimMat);
    door.position.set(-2.5, 2, 4.62);
    group.add(door);

    for (const x of [1.2, 4]) {
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 1.4, 0.24),
        glassMat,
      );
      win.position.set(x, 4.4, 4.64);
      group.add(win);
    }

    group.position.set(house.x, terrainHeight(house.x, house.z), house.z);
    group.rotation.y = house.rot;
    group.scale.setScalar(house.scale);
    scene.add(group);
  });
}

function createFarmProps() {
  const fenceMat = new THREE.MeshStandardMaterial({
    color: 0x8b6a43,
    roughness: 0.9,
  });
  const hayMat = new THREE.MeshStandardMaterial({
    color: 0xd6b45c,
    roughness: 0.95,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0xc7d3d4,
    roughness: 0.35,
    metalness: 0.25,
  });
  const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.4, 7);
  const railGeo = new THREE.CylinderGeometry(0.045, 0.05, 8, 7);

  const fenceLines = [
    { x: -86, z: -14, length: 48, rot: 0.18 },
    { x: 82, z: -18, length: 52, rot: -0.16 },
    { x: -88, z: 84, length: 42, rot: -0.25 },
    { x: 88, z: 86, length: 46, rot: 0.22 },
  ];

  fenceLines.forEach((line) => {
    const fence = new THREE.Group();
    const posts = Math.floor(line.length / 8) + 1;
    for (let i = 0; i < posts; i++) {
      const x = -line.length / 2 + i * 8;
      const post = new THREE.Mesh(postGeo, fenceMat);
      post.position.set(x, 0.7, 0);
      post.castShadow = true;
      fence.add(post);
    }
    for (const y of [0.85, 1.18]) {
      const rail = new THREE.Mesh(railGeo, fenceMat);
      rail.position.set(0, y, 0);
      rail.rotation.z = Math.PI / 2;
      rail.scale.y = line.length / 8;
      rail.castShadow = true;
      fence.add(rail);
    }
    fence.position.set(line.x, terrainHeight(line.x, line.z) + 0.05, line.z);
    fence.rotation.y = line.rot;
    scene.add(fence);
  });

  for (let i = 0; i < 10; i++) {
    const x = -48 + Math.random() * 34;
    const z = 10 + Math.random() * 64;
    const bale = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.15, 2.2, 18),
      hayMat,
    );
    bale.position.set(x, terrainHeight(x, z) + 1.05, z);
    bale.rotation.z = Math.PI / 2;
    bale.rotation.y = Math.random() * Math.PI;
    bale.castShadow = true;
    bale.receiveShadow = true;
    scene.add(bale);
  }

  const silo = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.7, 11, 20),
    metalMat,
  );
  body.position.y = 5.5;
  body.castShadow = true;
  body.receiveShadow = true;
  silo.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.7, 2.4, 20), metalMat);
  roof.position.y = 12.2;
  roof.castShadow = true;
  silo.add(roof);
  silo.position.set(-72, terrainHeight(-72, -54), -54);
  scene.add(silo);
}

function createLandMarkers() {
  const welcome = createSignBoard({
    lines: ["Welcome to the class", "of Abdullah Sir"],
    width: 38,
    height: 12.5,
    fontSizes: [104, 108],
    textureWidth: 2048,
    textureHeight: 768,
    background: "rgba(32, 72, 44, 0.9)",
    textColor: "#fff7d6",
    strokeColor: "#16301f",
    postHeight: 7.2,
    postDepth: 2.8,
    lineGap: 0.32,
  });
  welcome.position.set(-36, terrainHeight(-36, 42), 42);
  welcome.rotation.y = -0.18;
  scene.add(welcome);

  const title = createHillsideTitle();
  title.position.set(-8, terrainHeight(-8, -154) + 58, -154);
  title.rotation.set(THREE.MathUtils.degToRad(-3), 0.02, 0);
  title.userData.baseY = title.position.y;
  cinematicTitle = title;
  scene.add(title);
}

function createHillsideTitle() {
  const group = new THREE.Group();
  const paper = createTextPlane([""], {
    width: 244,
    height: 61,
    fontSizes: [300],
    textureWidth: 4096,
    textureHeight: 1024,
    textGradient: ["#fffdf5", "#d8f0ff", "#8fc7ff"],
    strokeColor: "rgba(12, 38, 58, 0.92)",
    shadowColor: "rgba(3, 18, 31, 0.62)",
    shadowBlur: 34,
    maxTextWidth: 3740,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    fog: false,
  });
  paper.position.y = 13;
  paper.userData.titleRole = "paper";
  titleSurfaces.push(paper);
  group.add(paper);

  const chapter = createTextPlane([""], {
    width: 244,
    height: 55,
    fontSizes: [330],
    textureWidth: 5120,
    textureHeight: 1152,
    textGradient: ["#ffffff", "#f5e587", "#79dfb6"],
    strokeColor: "rgba(10, 41, 49, 0.94)",
    shadowColor: "rgba(0, 16, 24, 0.68)",
    shadowBlur: 38,
    maxTextWidth: 4580,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    fog: false,
  });
  chapter.position.y = -15;
  chapter.userData.titleRole = "chapter";
  titleSurfaces.push(chapter);
  group.add(chapter);

  return group;
}

function createSignBoard(options) {
  const group = new THREE.Group();
  const board = createTextPlane(options.lines, options);
  board.position.y = options.postHeight;
  board.renderOrder = 4;
  group.add(board);

  const postMat = new THREE.MeshStandardMaterial({
    color: 0x5f432b,
    roughness: 0.9,
  });
  for (const x of [-options.width * 0.36, options.width * 0.36]) {
    const totalHeight = options.postHeight + (options.postDepth || 1.8);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.44, totalHeight, 10),
      postMat,
    );
    post.position.set(x, options.postHeight - totalHeight / 2, -0.25);
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);
  }
  return group;
}

function createTextPlane(lines, options) {
  const texture = createTextTexture(lines, options);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthTest: options.depthTest !== false,
    depthWrite: options.depthWrite !== false,
    fog: options.fog !== false,
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(options.width, options.height),
    material,
  );
  mesh.renderOrder = options.depthTest === false ? 10 : 0;
  mesh.castShadow = false;
  mesh.userData.textOptions = options;
  mesh.userData.textLines = lines;
  return mesh;
}

function createTextTexture(lines, options) {
  const canvas = document.createElement("canvas");
  canvas.width = options.textureWidth || 2048;
  canvas.height = options.textureHeight || 512;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!options.transparent) {
    ctx.fillStyle = options.background || "rgba(20, 35, 28, 0.9)";
    roundRect(ctx, 24, 24, canvas.width - 48, canvas.height - 48, 34);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 8;
    ctx.stroke();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";

  const total = lines.length;
  lines.forEach((line, index) => {
    let size = options.fontSizes[index] || options.fontSizes[0] || 64;
    ctx.font = `900 ${size}px "Noto Sans Bengali", "Segoe UI", Arial, sans-serif`;
    const maxTextWidth = options.maxTextWidth || canvas.width * 0.9;
    const measuredWidth = ctx.measureText(line).width;
    if (measuredWidth > maxTextWidth) {
      size *= maxTextWidth / measuredWidth;
      ctx.font = `900 ${size}px "Noto Sans Bengali", "Segoe UI", Arial, sans-serif`;
    }
    const fillGradient = options.textGradient
      ? ctx.createLinearGradient(0, canvas.height * 0.18, 0, canvas.height * 0.84)
      : null;
    if (fillGradient) {
      const stops = options.textGradient;
      stops.forEach((color, stopIndex) => {
        fillGradient.addColorStop(
          stops.length === 1 ? 0 : stopIndex / (stops.length - 1),
          color,
        );
      });
    }
    ctx.fillStyle = fillGradient || options.textColor || "#ffffff";
    ctx.strokeStyle = options.strokeColor || "rgba(0,0,0,0.65)";
    ctx.lineWidth = Math.max(7, size * 0.12);
    ctx.shadowColor = options.shadowColor || "rgba(0,0,0,0.35)";
    ctx.shadowBlur = options.shadowBlur || Math.max(6, size * 0.08);
    ctx.shadowOffsetY = Math.max(3, size * 0.035);
    const gap = options.lineGap || 0.26;
    const y = canvas.height * (0.5 + (index - (total - 1) / 2) * gap);
    ctx.strokeText(line, canvas.width / 2, y);
    ctx.fillText(line, canvas.width / 2, y);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function createClouds(count) {
  const cloudTexture = createCloudTexture();
  const cloudMat = new THREE.SpriteMaterial({
    map: cloudTexture,
    color: 0xf5f8f2,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    depthTest: true,
  });

  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    const blobs = 3 + Math.floor(Math.random() * 4);
    for (let j = 0; j < blobs; j++) {
      const sprite = new THREE.Sprite(cloudMat.clone());
      sprite.material.opacity = 0.22 + Math.random() * 0.22;
      sprite.position.set(
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 3.5,
        (Math.random() - 0.5) * 8,
      );
      const s = 18 + Math.random() * 20;
      sprite.scale.set(
        s * (1.4 + Math.random() * 0.8),
        s * (0.28 + Math.random() * 0.12),
        1,
      );
      group.add(sprite);
    }
    group.position.set(
      (Math.random() - 0.5) * 500,
      64 + Math.random() * 44,
      -230 + Math.random() * 260,
    );
    group.userData = {
      speed: 0.012 + Math.random() * 0.02,
      phase: Math.random() * 20,
    };
    clouds.push(group);
    scene.add(group);
  }
}

function createSunVeilCloud() {
  const cloudTexture = createCloudTexture();
  const group = new THREE.Group();
  const placements = [
    { x: -12, y: 1.5, scaleX: 64, scaleY: 15, opacity: 0.58 },
    { x: 14, y: 3.2, scaleX: 52, scaleY: 12, opacity: 0.5 },
    { x: 1, y: -3.2, scaleX: 74, scaleY: 12, opacity: 0.38 },
    { x: 28, y: -1.2, scaleX: 42, scaleY: 10, opacity: 0.42 },
  ];

  placements.forEach((placement) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: cloudTexture,
        color: 0xfffbef,
        transparent: true,
        opacity: placement.opacity,
        depthWrite: false,
        depthTest: true,
      }),
    );
    sprite.position.set(placement.x, placement.y, 0);
    sprite.scale.set(placement.scaleX, placement.scaleY, 1);
    group.add(sprite);
  });

  group.userData = {
    phase: Math.random() * 20,
    sunOffset: new THREE.Vector3(6, -1, 4),
  };
  sunVeilCloud = group;
  clouds.push(group);
  scene.add(group);
}

function createBirds(count) {
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x222a31,
    roughness: 0.75,
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x111820,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  const bodyGeo = new THREE.ConeGeometry(0.22, 1.05, 8);
  const wingGeo = new THREE.PlaneGeometry(1.35, 0.34);

  for (let i = 0; i < count; i++) {
    const bird = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    bird.add(body);

    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    const rightWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.position.x = -0.55;
    rightWing.position.x = 0.55;
    bird.add(leftWing, rightWing);

    bird.position.set(
      -80 + Math.random() * 80,
      35 + Math.random() * 35,
      -160 + Math.random() * 110,
    );
    bird.scale.setScalar(0.8 + Math.random() * 1.15);
    bird.userData = {
      velocity: new THREE.Vector3(
        0.09 + Math.random() * 0.07,
        0,
        0.025 + Math.random() * 0.04,
      ),
      phase: Math.random() * 20,
      leftWing,
      rightWing,
    };
    birds.push(bird);
    scene.add(bird);
  }
}

function createButterflies(count) {
  const wingGeo = new THREE.PlaneGeometry(0.55, 0.42);
  const bodyGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.42, 6);
  const colors = [0xffc44d, 0x69d2e7, 0xe27dff, 0xfff275];

  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: colors[i % colors.length],
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
    });
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x332313,
      roughness: 0.6,
    });
    const group = new THREE.Group();
    const left = new THREE.Mesh(wingGeo, mat);
    const right = new THREE.Mesh(wingGeo, mat);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    left.position.x = -0.25;
    right.position.x = 0.25;
    group.add(left, right, body);

    const z = -110 + Math.random() * 210;
    const x =
      riverCenterX(z) +
      (Math.random() > 0.5 ? 1 : -1) *
        (CONFIG.riverHalfWidth + 10 + Math.random() * 38);
    group.position.set(x, terrainHeight(x, z) + 2 + Math.random() * 3, z);
    group.userData = {
      home: group.position.clone(),
      left,
      right,
      phase: Math.random() * 20,
      radius: 2 + Math.random() * 4,
      speed: 0.6 + Math.random() * 0.7,
    };
    butterflies.push(group);
    scene.add(group);
  }
}

function createDriftingLeaves(count) {
  const leafGeo = new THREE.PlaneGeometry(0.42, 0.8);
  const leafMats = [0xd89b3d, 0xb85c38, 0x8b9a3a].map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.7,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.86,
      }),
  );

  for (let i = 0; i < count; i++) {
    const leaf = new THREE.Mesh(leafGeo, leafMats[i % leafMats.length]);
    leaf.position.set(
      (Math.random() - 0.5) * 200,
      10 + Math.random() * 35,
      (Math.random() - 0.5) * 220,
    );
    leaf.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    );
    leaf.userData = {
      velocity: new THREE.Vector3(
        -0.01 - Math.random() * 0.035,
        -0.01 - Math.random() * 0.018,
        0.012 + Math.random() * 0.035,
      ),
      spin: new THREE.Vector3(
        Math.random() * 0.02,
        Math.random() * 0.035,
        Math.random() * 0.018,
      ),
    };
    driftingLeaves.push(leaf);
    scene.add(leaf);
  }
}

function createFireflies(count) {
  const geo = new THREE.SphereGeometry(0.08, 8, 6);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xfff1a0,
    transparent: true,
    opacity: 0.78,
  });

  for (let i = 0; i < count; i++) {
    const z = -130 + Math.random() * 260;
    const x =
      riverCenterX(z) +
      (Math.random() > 0.5 ? 1 : -1) *
        (CONFIG.riverHalfWidth + Math.random() * 48);
    const firefly = new THREE.Mesh(geo, mat.clone());
    firefly.position.set(x, terrainHeight(x, z) + 1.5 + Math.random() * 5, z);
    firefly.userData = {
      phase: Math.random() * 20,
      home: firefly.position.clone(),
    };
    fireflies.push(firefly);
    scene.add(firefly);
  }
}

function terrainHeight(x, z) {
  const riverDistance = Math.abs(x - riverCenterX(z));
  const valley = THREE.MathUtils.smoothstep(
    riverDistance,
    CONFIG.riverHalfWidth,
    CONFIG.riverHalfWidth + 64,
  );
  const terraceBand = Math.floor((z + 210) / 18) * 0.42;
  const terraceMask =
    softRange(Math.abs(x - 145), 28, 92) *
      softRange(Math.abs(z + 30), 42, 150) +
    softRange(Math.abs(x + 145), 28, 88) * softRange(Math.abs(z + 72), 42, 145);
  const hills =
    Math.sin(x * 0.025) * 5.4 +
    Math.cos(z * 0.023) * 4.7 +
    Math.sin((x + z) * 0.014) * 4.2 +
    noise2(x * 0.036, z * 0.036) * 4.7;
  const broadRise = Math.max(riverDistance - 48, 0) * 0.07;
  return -2.4 + valley * (hills + broadRise + terraceBand * terraceMask);
}

function riverCenterX(z) {
  return Math.sin(z * 0.018) * 10 + Math.sin(z * 0.047 + 1.7) * 3.5;
}

function noise2(x, y) {
  const a = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  const b = Math.sin((x + 13.4) * 21.17 + (y - 5.6) * 9.23) * 24634.6345;
  return (fract(a) + fract(b)) * 0.5 * 2 - 1;
}

function fract(value) {
  return value - Math.floor(value);
}

function softRange(value, inner, outer) {
  return 1 - THREE.MathUtils.smoothstep(value, inner, outer);
}

function createGroundTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n =
        noise2(x * 0.035, y * 0.035) * 0.6 +
        noise2(x * 0.11 + 40, y * 0.11 - 20) * 0.28 +
        noise2(x * 0.28, y * 0.28) * 0.12;
      const blade = Math.sin((x + n * 16) * 0.9) > 0.95 ? 12 : 0;
      const shade = THREE.MathUtils.clamp(0.72 + n * 0.18, 0.45, 0.94);
      image.data[i] = Math.floor((88 + blade) * shade);
      image.data[i + 1] = Math.floor((122 + blade) * shade);
      image.data[i + 2] = Math.floor(72 * shade);
      image.data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(18, 18);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createWaterNormalTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const wave =
        Math.sin(x * 0.24 + y * 0.08) * 0.5 + Math.sin(y * 0.34) * 0.5;
      image.data[i] = 128 + wave * 22;
      image.data[i + 1] = 128 + Math.cos(x * 0.12 + y * 0.3) * 18;
      image.data[i + 2] = 230;
      image.data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 22);
  return texture;
}

function createCloudTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.08,
    size * 0.5,
    size * 0.5,
    size * 0.48,
  );
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.42, "rgba(255,255,255,0.62)");
  gradient.addColorStop(0.72, "rgba(255,255,255,0.2)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

export function startScreensaver() {
  if (isActive) return;
  const overlay = document.getElementById("screensaverOverlay");
  if (!overlay) return;
  if (!renderer && screensaverContainerId) {
    initScreensaver(screensaverContainerId);
  }
  if (!renderer) return;
  isActive = true;
  overlay.style.display = "block";
  clock?.start();

  animate();
}

export function stopScreensaver() {
  if (!isActive) return;
  isActive = false;
  cancelAnimationFrame(animationFrameId);
  const overlay = document.getElementById("screensaverOverlay");
  if (overlay) overlay.style.display = "none";
  const textEl = document.getElementById("screensaverText");
  if (textEl) textEl.style.opacity = "0";
}

export function updateScreensaverTitle(paperTitle, chapterTitle) {
  currentPaperTitle = paperTitle || currentPaperTitle;
  currentChapterTitle = chapterTitle || currentChapterTitle;
  refreshTitleSurfaces();
}

function refreshTitleSurfaces() {
  titleSurfaces.forEach((surface) => {
    const role = surface.userData.titleRole;
    const options = surface.userData.textOptions;
    const lines =
      role === "paper"
        ? [currentPaperTitle.toUpperCase()]
        : [currentChapterTitle];
    const oldMap = surface.material.map;
    surface.material.map = createTextTexture(lines, options);
    surface.material.needsUpdate = true;
    if (oldMap) oldMap.dispose();
  });
}

function animate() {
  if (!isActive || !renderer || !scene || !camera) return;
  animationFrameId = requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.033);
  const elapsedTime = clock.elapsedTime;
  const wind =
    Math.sin(elapsedTime * 0.8) * 0.5 + Math.sin(elapsedTime * 0.31) * 0.5;

  animateWater(elapsedTime);
  animateClouds(elapsedTime);
  animateWind(elapsedTime, wind);
  animateBirds(elapsedTime, delta);
  animateButterflies(elapsedTime);
  animateLeaves(delta);
  animateFireflies(elapsedTime);
  animateTitle(elapsedTime);
  animateCamera(elapsedTime);

  renderer.render(scene, camera);
}

function animateWater(elapsedTime) {
  if (!river) return;
  riverMaterial.emissiveIntensity = 0.08 + Math.sin(elapsedTime * 1.2) * 0.018;
  if (riverMaterial.normalMap) {
    riverMaterial.normalMap.offset.y = elapsedTime * 0.032;
    riverMaterial.normalMap.offset.x = Math.sin(elapsedTime * 0.12) * 0.012;
  }

  const positions = river.geometry.attributes.position;
  const basePositions = river.geometry.userData.basePositions;
  if (basePositions) {
    for (let i = 0; i < positions.count; i++) {
      const vertexIndex = i * 3;
      const x = basePositions[vertexIndex];
      const z = basePositions[vertexIndex + 2];
      const side = Math.abs(x - riverCenterX(z)) / CONFIG.riverHalfWidth;
      const edgeWave = Math.pow(THREE.MathUtils.clamp(side, 0, 1), 1.65);
      positions.array[vertexIndex + 1] =
        basePositions[vertexIndex + 1] +
        Math.sin(z * 0.18 + elapsedTime * 2.2) * 0.1 +
        Math.sin(z * 0.34 + elapsedTime * 3.1 + side * 2.4) * 0.22 * edgeWave;
    }
    positions.needsUpdate = true;
  }

  waterFoam.forEach((foam) => {
    foam.position.z += foam.userData.speed * 0.018;
    foam.position.x =
      riverCenterX(foam.position.z) +
      foam.userData.side *
        (CONFIG.riverHalfWidth -
          0.2 +
          Math.sin(elapsedTime + foam.userData.phase) * 1.1);
    foam.material.opacity =
      0.22 + Math.sin(elapsedTime * 2.3 + foam.userData.phase) * 0.14;
    if (foam.position.z > 235) foam.position.z = -230;
  });
}

function animateClouds(elapsedTime) {
  clouds.forEach((cloud) => {
    if (cloud === sunVeilCloud) {
      cloud.position.y +=
        Math.sin(elapsedTime * 0.22 + cloud.userData.phase) * 0.003;
      return;
    }
    cloud.position.x -= cloud.userData.speed;
    cloud.position.y +=
      Math.sin(elapsedTime * 0.18 + cloud.userData.phase) * 0.004;
    if (cloud.position.x < -260) cloud.position.x = 260;
  });
}

function animateTitle(elapsedTime) {
  if (!cinematicTitle) return;
  cinematicTitle.position.y =
    cinematicTitle.userData.baseY +
    Math.sin(elapsedTime * 0.55) * 1.15;
  cinematicTitle.rotation.z = Math.sin(elapsedTime * 0.38) * 0.006;
  cinematicTitle.scale.setScalar(1 + Math.sin(elapsedTime * 0.45) * 0.008);
}

function animateWind(elapsedTime, wind) {
  windObjects.forEach((item) => {
    item.object.rotation.z =
      Math.sin(elapsedTime * 1.4 + item.phase) * item.strength +
      wind * item.strength;
  });
  animatedReeds.forEach((reed) => {
    reed.object.rotation.z =
      reed.baseRotation +
      Math.sin(elapsedTime * 1.9 + reed.phase) * 0.1 +
      wind * 0.07;
  });
}

function animateBirds(elapsedTime, delta) {
  birds.forEach((bird, index) => {
    const data = bird.userData;
    data.velocity.y += Math.sin(elapsedTime * 1.5 + data.phase) * 0.0005;
    bird.position.addScaledVector(data.velocity, delta * 60);
    bird.position.y += Math.sin(elapsedTime * 2.1 + index) * 0.01;
    bird.rotation.y = Math.atan2(data.velocity.x, data.velocity.z);

    const flap = Math.sin(elapsedTime * 10 + data.phase) * 0.65;
    data.leftWing.rotation.z = flap;
    data.rightWing.rotation.z = -flap;

    if (bird.position.x > 220 || bird.position.z > 130) {
      bird.position.set(
        -210,
        38 + Math.random() * 34,
        -160 + Math.random() * 85,
      );
    }
  });
}

function animateButterflies(elapsedTime) {
  butterflies.forEach((butterfly, index) => {
    const data = butterfly.userData;
    const t = elapsedTime * data.speed + data.phase;
    butterfly.position.x = data.home.x + Math.sin(t * 1.5) * data.radius;
    butterfly.position.z = data.home.z + Math.cos(t) * data.radius;
    butterfly.position.y = data.home.y + Math.sin(t * 2.1 + index) * 1.2;
    butterfly.rotation.y = Math.sin(t) * 0.8;
    data.left.rotation.y = Math.sin(elapsedTime * 15 + data.phase) * 1.2;
    data.right.rotation.y = -Math.sin(elapsedTime * 15 + data.phase) * 1.2;
  });
}

function animateLeaves(delta) {
  driftingLeaves.forEach((leaf) => {
    leaf.position.addScaledVector(leaf.userData.velocity, delta * 60);
    leaf.rotation.x += leaf.userData.spin.x * delta * 60;
    leaf.rotation.y += leaf.userData.spin.y * delta * 60;
    leaf.rotation.z += leaf.userData.spin.z * delta * 60;
    if (
      leaf.position.y < terrainHeight(leaf.position.x, leaf.position.z) + 0.4 ||
      leaf.position.z > 235 ||
      leaf.position.x < -235
    ) {
      leaf.position.set(
        80 + Math.random() * 90,
        18 + Math.random() * 34,
        -210 + Math.random() * 90,
      );
    }
  });
}

function animateFireflies(elapsedTime) {
  fireflies.forEach((firefly, index) => {
    const phase = firefly.userData.phase;
    firefly.position.x =
      firefly.userData.home.x + Math.sin(elapsedTime * 0.9 + phase) * 1.8;
    firefly.position.y =
      firefly.userData.home.y + Math.sin(elapsedTime * 1.7 + index) * 0.85;
    firefly.position.z =
      firefly.userData.home.z + Math.cos(elapsedTime * 0.75 + phase) * 1.8;
    firefly.material.opacity =
      0.18 +
      Math.pow(Math.sin(elapsedTime * 2.8 + phase) * 0.5 + 0.5, 2) * 0.72;
  });
}

function animateCamera(elapsedTime) {
  const radius = 78 + Math.sin(elapsedTime * 0.08) * 18;
  const angle = elapsedTime * 0.043;
  const targetZ = Math.sin(elapsedTime * 0.11) * 18;
  const target = new THREE.Vector3(riverCenterX(targetZ), 5.5, targetZ);

  camera.position.x =
    Math.cos(angle) * radius + Math.sin(elapsedTime * 0.19) * 9;
  camera.position.z = Math.sin(angle) * radius + 12;
  camera.position.y = 22 + Math.sin(elapsedTime * 0.21) * 6;
  camera.lookAt(target);

  if (sun) {
    sun.position.x = -95 + Math.sin(elapsedTime * 0.025) * 18;
    sun.position.y = 112 + Math.cos(elapsedTime * 0.018) * 8;
  }
  if (sun && sunVeilCloud) {
    const offset = sunVeilCloud.userData.sunOffset;
    sunVeilCloud.position.set(
      sun.position.x + offset.x + Math.sin(elapsedTime * 0.08) * 4,
      sun.position.y + offset.y + Math.cos(elapsedTime * 0.11) * 1.2,
      sun.position.z + offset.z,
    );
  }
}
