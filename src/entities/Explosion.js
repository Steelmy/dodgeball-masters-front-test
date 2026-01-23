import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const EXPLOSION_DURATION = 1.2; // seconds total
const SCALE_UP_DURATION = 0.3; // fast scale-up phase
const MAX_SCALE = 0.15; // final scale of the model

export class Explosion {
  constructor(position, teamId) {
    this.group = new THREE.Group();
    this.group.position.copy(position);

    this.elapsed = 0;
    this.done = false;
    this.materials = [];

    this.loadModel(teamId);
  }

  loadModel(teamId) {
    const loader = new GLTFLoader();
    const texturePath = teamId === 'player'
      ? '/src/models/explosions/0/textures/Fire_diffuse_blue.png'
      : '/src/models/explosions/0/textures/Fire_diffuse_orange.png';

    const pointyColor = teamId === 'player'
      ? new THREE.Color(0.0, 0.4, 1.0)
      : new THREE.Color(1.0, 0.24, 0.0);

    loader.load(
      '/src/models/explosions/0/scene.gltf',
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(0.01, 0.01, 0.01); // start tiny

        const textureLoader = new THREE.TextureLoader();
        const diffuseTexture = textureLoader.load(texturePath);
        diffuseTexture.flipY = false;

        model.traverse((child) => {
          if (child.isMesh) {
            // Replace material with standard material for proper fading
            const oldMat = child.material;
            const isPointy = child.name === 'Explosion_pointy' ||
              (oldMat && oldMat.name === 'Fire_pointy');

            const newMat = new THREE.MeshStandardMaterial({
              transparent: true,
              opacity: 1.0,
              side: THREE.DoubleSide,
              depthWrite: false,
            });

            if (isPointy) {
              newMat.color.copy(pointyColor);
              newMat.emissive.copy(pointyColor);
              newMat.emissiveIntensity = 0.5;
            } else {
              newMat.map = diffuseTexture;
              newMat.emissive.copy(pointyColor);
              newMat.emissiveIntensity = 0.3;
            }

            child.material = newMat;
            this.materials.push(newMat);
          }
        });

        this.model = model;
        this.group.add(model);
      },
      undefined,
      (error) => console.error('Error loading explosion model:', error)
    );
  }

  update(deltaTime) {
    if (this.done) return;

    this.elapsed += deltaTime;

    if (this.elapsed >= EXPLOSION_DURATION) {
      this.done = true;
      this.group.visible = false;
      return;
    }

    if (!this.model) return;

    // Scale up phase
    if (this.elapsed < SCALE_UP_DURATION) {
      const t = this.elapsed / SCALE_UP_DURATION;
      // Ease-out for snappy pop
      const eased = 1 - Math.pow(1 - t, 3);
      const s = eased * MAX_SCALE;
      this.model.scale.set(s, s, s);
    } else {
      this.model.scale.set(MAX_SCALE, MAX_SCALE, MAX_SCALE);
    }

    // Fade out after scale-up
    if (this.elapsed > SCALE_UP_DURATION) {
      const fadeProgress = (this.elapsed - SCALE_UP_DURATION) / (EXPLOSION_DURATION - SCALE_UP_DURATION);
      const opacity = 1.0 - fadeProgress;
      for (const mat of this.materials) {
        mat.opacity = Math.max(0, opacity);
      }
    }

    // Slow rotation for visual interest
    this.model.rotation.y += deltaTime * 2;
  }

  getMesh() {
    return this.group;
  }

  isDone() {
    return this.done;
  }

  dispose() {
    for (const mat of this.materials) {
      if (mat.map) mat.map.dispose();
      mat.dispose();
    }
    if (this.model) {
      this.model.traverse((child) => {
        if (child.isMesh && child.geometry) {
          child.geometry.dispose();
        }
      });
    }
  }
}
