import * as THREE from "three";
import backgroundTextureUrl from "./assets/sheepdog/toy-background.png";
import "./styles.css";

const FIELD_WIDTH = 22;
const FIELD_HEIGHT = 34;
const GOAL_DEPTH = 4.4;
const GOAL_SCORING_DEPTH = 2.6;
const SHEEP_COUNT = 50;
const MATCH_SECONDS = 90;
const DOG_MAX_SPEED = 9.2;
const DOG_ACCELERATION = 34;
const SHEEP_MAX_SPEED = 6.3;
const SHEEP_REPEL_RADIUS = 5.2;
const SHEEP_SEPARATION_RADIUS = 1.15;
const SHEEP_WANDER_FORCE = 1.6;
const SHEEP_WANDER_INTERVAL_MIN = 0.8;
const SHEEP_WANDER_INTERVAL_MAX = 2.2;
const SHEEP_SCORE_DURATION = 0.72;
const TARGET_MIN_DISTANCE = 3.1;
const TARGET_GRAB_RADIUS = 1.65;
const FIELD_MARGIN = 0.75;
const CREAM = 0xfff3c7;
const BACKGROUND_ASPECT = 941 / 1672;
const BACKGROUND_PLANE_WIDTH = FIELD_WIDTH + 5.5;
const BACKGROUND_PLANE_HEIGHT = BACKGROUND_PLANE_WIDTH / BACKGROUND_ASPECT;

type PlayerIndex = 0 | 1;

type Player = {
  index: PlayerIndex;
  color: number;
  accent: string;
  score: number;
  pointerId: number | null;
  dog: THREE.Group;
  dogVelocity: THREE.Vector3;
  target: THREE.Vector3;
  targetRing: THREE.Group;
  leash: THREE.Line;
};

type Sheep = {
  body: THREE.Group;
  velocity: THREE.Vector3;
  wander: THREE.Vector3;
  wanderTimer: number;
  scoringTimer: number;
  scoringPlayer: PlayerIndex | null;
  scoringStart: THREE.Vector3;
};

type ScoreEffect = {
  group: THREE.Group;
  sprite: THREE.Sprite;
  ring: THREE.Mesh;
  timer: number;
  duration: number;
};

const gameHost = requireElement<HTMLDivElement>("#game");
const scoreP1 = requireElement<HTMLElement>("#score-p1");
const scoreP2 = requireElement<HTMLElement>("#score-p2");
const timerEl = requireElement<HTMLElement>("#timer");
const restartButton = requireElement<HTMLButtonElement>("#restart");
const message = requireElement<HTMLDivElement>("#message");
const resultTitle = requireElement<HTMLElement>("#result-title");
const resultDetail = requireElement<HTMLElement>("#result-detail");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa9dcff);
scene.fog = new THREE.Fog(0xa9dcff, 38, 66);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
camera.position.set(0, 25, 18);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
gameHost.appendChild(renderer.domElement);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const worldPoint = new THREE.Vector3();
const tmpVector = new THREE.Vector3();
const tmpVector2 = new THREE.Vector3();
const clock = new THREE.Clock();

const sheep: Sheep[] = [];
const players: Player[] = [];
const scoreEffects: ScoreEffect[] = [];
let timeLeft = MATCH_SECONDS;
let gameOver = false;

setupLights();
buildField();
players.push(createPlayer(0, 0x38bdf8, "#62d6ff", FIELD_HEIGHT * 0.3));
players.push(createPlayer(1, 0xff626a, "#ff7a7d", -FIELD_HEIGHT * 0.3));
createSheep();
resetGame();
resize();

window.addEventListener("resize", resize);
renderer.domElement.addEventListener("pointerdown", onPointerDown);
renderer.domElement.addEventListener("pointermove", onPointerMove);
renderer.domElement.addEventListener("pointerup", onPointerUp);
renderer.domElement.addEventListener("pointercancel", onPointerUp);
restartButton.addEventListener("click", resetGame);

requestAnimationFrame(tick);

function setupLights() {
  const hemi = new THREE.HemisphereLight(0xfff7dc, 0x66a86a, 2.45);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 2.9);
  sun.position.set(-9, 22, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  scene.add(sun);
}

function buildField() {
  const backgroundTexture = new THREE.TextureLoader().load(backgroundTextureUrl);
  backgroundTexture.colorSpace = THREE.SRGBColorSpace;
  backgroundTexture.minFilter = THREE.LinearFilter;
  backgroundTexture.magFilter = THREE.LinearFilter;
  const field = new THREE.Mesh(
    new THREE.PlaneGeometry(BACKGROUND_PLANE_WIDTH, BACKGROUND_PLANE_HEIGHT),
    new THREE.MeshBasicMaterial({ map: backgroundTexture }),
  );
  field.rotation.x = -Math.PI / 2;
  field.position.y = -0.04;
  scene.add(field);
}

function createPlayer(index: PlayerIndex, color: number, accent: string, startZ: number): Player {
  const dog = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x1f2933, roughness: 0.5 });
  const earMaterial = new THREE.MeshStandardMaterial({ color: 0x45352b, roughness: 0.58 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 0.9, 6, 12), bodyMaterial);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.58;
  body.castShadow = true;
  dog.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 12), bodyMaterial);
  head.position.set(0.62, 0.74, 0);
  head.castShadow = true;
  dog.add(head);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), darkMaterial);
  nose.position.set(1.0, 0.76, 0);
  dog.add(nose);

  for (const z of [-0.26, 0.26]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), earMaterial);
    ear.position.set(0.52, 1.02, z);
    ear.scale.set(0.72, 1.25, 0.72);
    ear.castShadow = true;
    dog.add(ear);
  }

  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.56, 5, 8), bodyMaterial);
  tail.position.set(-0.66, 0.76, 0);
  tail.rotation.z = -0.7;
  tail.castShadow = true;
  dog.add(tail);

  dog.position.set(index === 0 ? -2.6 : 2.6, 0, startZ);
  scene.add(dog);

  const target = new THREE.Vector3(index === 0 ? -2.6 : 2.6, 0, startZ);
  const targetRing = createTargetRing(color);
  targetRing.position.copy(target);
  scene.add(targetRing);

  const leashGeometry = new THREE.BufferGeometry().setFromPoints([dog.position, target]);
  const leash = new THREE.Line(
    leashGeometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.46 }),
  );
  scene.add(leash);

  return {
    index,
    color,
    accent,
    score: 0,
    pointerId: null,
    dog,
    dogVelocity: new THREE.Vector3(),
    target,
    targetRing,
    leash,
  };
}

function createTargetRing(color: number) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.08, 8, 48),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.28, roughness: 0.25 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.52, 36),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.06;
  group.add(disc);
  return group;
}

function createSheep() {
  const woolMaterial = new THREE.MeshStandardMaterial({ color: 0xfff8e8, roughness: 0.88 });
  const woolAccentMaterial = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.9 });
  const faceMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.62 });
  for (let i = 0; i < SHEEP_COUNT; i += 1) {
    const body = new THREE.Group();
    const wool = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), woolMaterial);
    wool.scale.set(1.2, 0.88, 0.96);
    wool.position.y = 0.44;
    wool.castShadow = true;
    body.add(wool);

    for (const [x, z, scale] of [
      [-0.26, -0.25, 0.72],
      [-0.25, 0.24, 0.68],
      [0.12, -0.3, 0.62],
      [0.1, 0.3, 0.62],
    ]) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), woolAccentMaterial);
      puff.position.set(x, 0.57, z);
      puff.scale.setScalar(scale);
      puff.castShadow = true;
      body.add(puff);
    }

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), faceMaterial);
    head.position.set(0.42, 0.46, 0);
    head.castShadow = true;
    body.add(head);
    scene.add(body);
    sheep.push({
      body,
      velocity: new THREE.Vector3(),
      wander: new THREE.Vector3(),
      wanderTimer: randomBetween(SHEEP_WANDER_INTERVAL_MIN, SHEEP_WANDER_INTERVAL_MAX),
      scoringTimer: 0,
      scoringPlayer: null,
      scoringStart: new THREE.Vector3(),
    });
  }
}

function resetGame() {
  timeLeft = MATCH_SECONDS;
  gameOver = false;
  message.hidden = true;
  players.forEach((player, index) => {
    player.score = 0;
    player.pointerId = null;
    const x = index === 0 ? -2.6 : 2.6;
    const z = index === 0 ? FIELD_HEIGHT * 0.32 : -FIELD_HEIGHT * 0.32;
    player.dog.position.set(x, 0, z);
    player.dogVelocity.set(0, 0, 0);
    player.target.set(x, 0, z);
    player.targetRing.position.copy(player.target);
  });
  sheep.forEach((item) => resetSheep(item));
  updateHud();
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.033);
  if (!gameOver) {
    timeLeft = Math.max(0, timeLeft - dt);
    if (timeLeft <= 0) {
      endGame();
    }
    updatePlayers(dt);
    updateSheep(dt);
    updateScoreEffects(dt);
    updateHud();
  }
  updateVisuals();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function updatePlayers(dt: number) {
  for (const player of players) {
    tmpVector.copy(player.target).sub(player.dog.position);
    tmpVector.y = 0;
    const distance = tmpVector.length();
    if (distance > 0.05) {
      tmpVector.normalize().multiplyScalar(DOG_ACCELERATION * dt);
      player.dogVelocity.add(tmpVector);
      clampLength(player.dogVelocity, DOG_MAX_SPEED);
    }
    player.dogVelocity.multiplyScalar(distance < 0.4 ? 0.82 : 0.95);
    player.dog.position.addScaledVector(player.dogVelocity, dt);
    clampToField(player.dog.position, 0.8);

    if (player.dogVelocity.lengthSq() > 0.12) {
      player.dog.rotation.y = Math.atan2(-player.dogVelocity.z, player.dogVelocity.x);
    }
  }
}

function updateSheep(dt: number) {
  for (const item of sheep) {
    if (item.scoringTimer > 0) {
      updateScoringSheep(item, dt);
      continue;
    }

    const force = tmpVector.set(0, 0, 0);
    for (const player of players) {
      tmpVector2.copy(item.body.position).sub(player.dog.position);
      tmpVector2.y = 0;
      const distance = Math.max(tmpVector2.length(), 0.01);
      if (distance < SHEEP_REPEL_RADIUS) {
        force.addScaledVector(tmpVector2.normalize(), (1 - distance / SHEEP_REPEL_RADIUS) * 28);
      }
    }

    for (const other of sheep) {
      if (other === item) continue;
      tmpVector2.copy(item.body.position).sub(other.body.position);
      tmpVector2.y = 0;
      const distance = Math.max(tmpVector2.length(), 0.01);
      if (distance < SHEEP_SEPARATION_RADIUS) {
        force.addScaledVector(tmpVector2.normalize(), (1 - distance / SHEEP_SEPARATION_RADIUS) * 5.5);
      }
    }

    item.wanderTimer -= dt;
    if (item.wanderTimer <= 0) {
      item.wander.set(randomBetween(-1, 1), 0, randomBetween(-1, 1));
      if (item.wander.lengthSq() > 0.001) {
        item.wander.normalize();
      }
      item.wanderTimer = randomBetween(SHEEP_WANDER_INTERVAL_MIN, SHEEP_WANDER_INTERVAL_MAX);
    }
    force.addScaledVector(item.wander, SHEEP_WANDER_FORCE);

    addWallForce(item.body.position, force);
    item.velocity.addScaledVector(force, dt);
    item.velocity.multiplyScalar(0.91);
    clampLength(item.velocity, SHEEP_MAX_SPEED);
    item.body.position.addScaledVector(item.velocity, dt);
    clampToField(item.body.position, 0.45);
    if (item.velocity.lengthSq() > 0.05) {
      item.body.rotation.y = Math.atan2(-item.velocity.z, item.velocity.x);
    }
    checkGoal(item);
  }
}

function addWallForce(position: THREE.Vector3, force: THREE.Vector3) {
  const halfW = FIELD_WIDTH / 2 - 1.1;
  const halfH = FIELD_HEIGHT / 2 - 1.1;
  const wallRange = 2.1;
  if (position.x < -halfW + wallRange) force.x += (-halfW + wallRange - position.x) * 7;
  if (position.x > halfW - wallRange) force.x -= (position.x - (halfW - wallRange)) * 7;
  if (position.z < -halfH + wallRange) force.z += (-halfH + wallRange - position.z) * 7;
  if (position.z > halfH - wallRange) force.z -= (position.z - (halfH - wallRange)) * 7;
}

function checkGoal(item: Sheep) {
  const x = item.body.position.x;
  const z = item.body.position.z;
  const insideGoalX = Math.abs(x) < FIELD_WIDTH / 2 - 1.2;
  if (!insideGoalX) return;
  if (z > FIELD_HEIGHT / 2 - GOAL_SCORING_DEPTH) {
    scoreSheep(item, 0);
  } else if (z < -FIELD_HEIGHT / 2 + GOAL_SCORING_DEPTH) {
    scoreSheep(item, 1);
  }
}

function scoreSheep(item: Sheep, playerIndex: PlayerIndex) {
  if (item.scoringTimer > 0) return;
  players[playerIndex].score += 1;
  item.scoringPlayer = playerIndex;
  item.scoringTimer = SHEEP_SCORE_DURATION;
  item.scoringStart.copy(item.body.position);
  item.velocity.set(0, 0, 0);
  item.wander.set(0, 0, 0);
  createScoreEffect(item.body.position, players[playerIndex]);
}

function updateScoringSheep(item: Sheep, dt: number) {
  item.scoringTimer = Math.max(0, item.scoringTimer - dt);
  const progress = 1 - item.scoringTimer / SHEEP_SCORE_DURATION;
  const lift = Math.sin(progress * Math.PI) * 0.9;
  const shrink = THREE.MathUtils.lerp(1, 0.35, progress);
  item.body.position.copy(item.scoringStart);
  item.body.position.y = lift;
  item.body.scale.setScalar(shrink);
  item.body.rotation.y += dt * 4;
  if (item.scoringTimer <= 0) {
    resetSheep(item);
  }
}

function resetSheep(item: Sheep) {
  item.body.position.set(randomBetween(-5.8, 5.8), 0, randomBetween(-4.8, 4.8));
  item.body.scale.setScalar(1);
  item.velocity.set(randomBetween(-0.3, 0.3), 0, randomBetween(-0.3, 0.3));
  item.wander.set(randomBetween(-1, 1), 0, randomBetween(-1, 1));
  if (item.wander.lengthSq() > 0.001) {
    item.wander.normalize();
  }
  item.wanderTimer = randomBetween(SHEEP_WANDER_INTERVAL_MIN, SHEEP_WANDER_INTERVAL_MAX);
  item.scoringTimer = 0;
  item.scoringPlayer = null;
  item.scoringStart.set(0, 0, 0);
}

function createScoreEffect(position: THREE.Vector3, player: Player) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.position.y = 0.16;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.055, 8, 40),
    new THREE.MeshBasicMaterial({ color: player.color, transparent: true, opacity: 0.88 }),
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createScoreTexture(player.accent),
      transparent: true,
      depthWrite: false,
    }),
  );
  sprite.position.set(0, 1.25, 0);
  sprite.scale.set(1.8, 0.9, 1);
  group.add(sprite);

  scene.add(group);
  scoreEffects.push({ group, sprite, ring, timer: 0, duration: 0.75 });
}

function createScoreTexture(color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 80;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create score texture.");
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "800 56px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 8;
  context.strokeStyle = "rgba(16, 26, 21, 0.82)";
  context.strokeText("+1", 80, 42);
  context.fillStyle = color;
  context.fillText("+1", 80, 42);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function updateScoreEffects(dt: number) {
  for (let index = scoreEffects.length - 1; index >= 0; index -= 1) {
    const effect = scoreEffects[index];
    effect.timer += dt;
    const progress = Math.min(effect.timer / effect.duration, 1);
    const opacity = 1 - progress;
    effect.group.position.y = 0.16 + progress * 1.4;
    effect.ring.scale.setScalar(1 + progress * 1.8);
    const ringMaterial = effect.ring.material as THREE.MeshBasicMaterial;
    const spriteMaterial = effect.sprite.material as THREE.SpriteMaterial;
    ringMaterial.opacity = opacity * 0.88;
    spriteMaterial.opacity = opacity;
    if (progress >= 1) {
      scene.remove(effect.group);
      effect.group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      spriteMaterial.map?.dispose();
      spriteMaterial.dispose();
      scoreEffects.splice(index, 1);
    }
  }
}

function updateVisuals() {
  for (const player of players) {
    player.targetRing.position.copy(player.target);
    const activeScale = player.pointerId === null ? 1 : 1.18;
    player.targetRing.scale.lerp(tmpVector.set(activeScale, activeScale, activeScale), 0.22);
    const positions = player.leash.geometry.attributes.position as THREE.BufferAttribute;
    positions.setXYZ(0, player.dog.position.x, 0.18, player.dog.position.z);
    positions.setXYZ(1, player.target.x, 0.18, player.target.z);
    positions.needsUpdate = true;
  }
}

function updateHud() {
  scoreP1.textContent = `${players[0].score}`;
  scoreP2.textContent = `${players[1].score}`;
  timerEl.textContent = `${Math.ceil(timeLeft)}`;
}

function endGame() {
  gameOver = true;
  players.forEach((player) => {
    player.pointerId = null;
  });
  const [p1, p2] = players;
  if (p1.score === p2.score) {
    resultTitle.textContent = "Draw";
    resultDetail.textContent = `${p1.score} - ${p2.score}`;
  } else {
    const winner = p1.score > p2.score ? "Player 1 Wins" : "Player 2 Wins";
    resultTitle.textContent = winner;
    resultDetail.textContent = `${p1.score} - ${p2.score}`;
  }
  message.hidden = false;
}

function onPointerDown(event: PointerEvent) {
  if (gameOver) return;
  const point = pointerToWorld(event);
  const available = players.filter(
    (player) => player.pointerId === null && player.target.distanceTo(point) <= TARGET_GRAB_RADIUS,
  );
  if (available.length === 0) return;
  available.sort((a, b) => a.target.distanceToSquared(point) - b.target.distanceToSquared(point));
  const player = available[0];
  player.pointerId = event.pointerId;
  renderer.domElement.setPointerCapture(event.pointerId);
  moveTarget(player, point);
}

function onPointerMove(event: PointerEvent) {
  const player = players.find((item) => item.pointerId === event.pointerId);
  if (!player || gameOver) return;
  moveTarget(player, pointerToWorld(event));
}

function onPointerUp(event: PointerEvent) {
  const player = players.find((item) => item.pointerId === event.pointerId);
  if (!player) return;
  player.pointerId = null;
  if (renderer.domElement.hasPointerCapture(event.pointerId)) {
    renderer.domElement.releasePointerCapture(event.pointerId);
  }
}

function moveTarget(player: Player, point: THREE.Vector3) {
  player.target.copy(point);
  player.target.y = 0;
  clampToField(player.target, FIELD_MARGIN);
  const other = players.find((item) => item !== player);
  if (!other) return;
  tmpVector.copy(player.target).sub(other.target);
  tmpVector.y = 0;
  const distance = tmpVector.length();
    if (distance < TARGET_MIN_DISTANCE) {
      if (distance < 0.001) {
      tmpVector.set(0, 0, player.index === 0 ? 1 : -1);
    } else {
      tmpVector.normalize();
    }
    player.target.copy(other.target).addScaledVector(tmpVector, TARGET_MIN_DISTANCE);
    clampToField(player.target, FIELD_MARGIN);
  }
}

function pointerToWorld(event: PointerEvent) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(groundPlane, worldPoint);
  return worldPoint.clone();
}

function clampToField(position: THREE.Vector3, margin: number) {
  position.x = THREE.MathUtils.clamp(position.x, -FIELD_WIDTH / 2 + margin, FIELD_WIDTH / 2 - margin);
  position.z = THREE.MathUtils.clamp(position.z, -FIELD_HEIGHT / 2 + margin, FIELD_HEIGHT / 2 - margin);
  position.y = 0;
}

function clampLength(vector: THREE.Vector3, max: number) {
  const lengthSq = vector.lengthSq();
  if (lengthSq > max * max) {
    vector.multiplyScalar(max / Math.sqrt(lengthSq));
  }
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;
  const fieldAspect = FIELD_WIDTH / FIELD_HEIGHT;
  const viewHeight = aspect > fieldAspect ? FIELD_HEIGHT + 6 : (FIELD_WIDTH + 6) / aspect;
  const viewWidth = viewHeight * aspect;
  camera.left = -viewWidth / 2;
  camera.right = viewWidth / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}
