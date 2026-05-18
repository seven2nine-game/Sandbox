import * as THREE from 'three';
import './style.css';

const canvas = document.querySelector('#scene');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101820);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 0, 4);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const geometry = new THREE.BoxGeometry(1.4, 1.4, 1.4);
const material = new THREE.MeshStandardMaterial({
  color: 0x4fd1c5,
  roughness: 0.38,
  metalness: 0.18,
});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
keyLight.position.set(3, 4, 5);
scene.add(keyLight);

const fillLight = new THREE.HemisphereLight(0xd7f3ff, 0x15202b, 1.2);
scene.add(fillLight);

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

window.addEventListener('resize', resize);
resize();

function animate() {
  cube.rotation.x += 0.008;
  cube.rotation.y += 0.012;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
