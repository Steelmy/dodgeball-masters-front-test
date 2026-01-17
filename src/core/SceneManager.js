import * as THREE from 'three';
import { COLORS } from '../utils/Constants.js';

/**
 * SceneManager
 * Handles Three.js scene setup with bright, sunny atmosphere
 */

export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
    this.setupScene();
  }

  setupScene() {
    // Bright sky blue background
    this.scene.background = new THREE.Color(COLORS.SKY);

    // Light fog for depth (distant fade)
    this.scene.fog = new THREE.Fog(COLORS.SKY, 50, 150);

    // Strong ambient light for bright atmosphere
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(this.ambientLight);

    // Main sun light - bright and warm
    this.sunLight = new THREE.DirectionalLight(0xfffaf0, 1.2);
    this.sunLight.position.set(30, 50, 30);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 100;
    this.sunLight.shadow.camera.left = -30;
    this.sunLight.shadow.camera.right = 30;
    this.sunLight.shadow.camera.top = 30;
    this.sunLight.shadow.camera.bottom = -30;
    this.sunLight.shadow.bias = -0.0001;
    this.scene.add(this.sunLight);

    // Secondary fill light (sky light from opposite direction)
    this.fillLight = new THREE.DirectionalLight(0x87ceeb, 0.4);
    this.fillLight.position.set(-20, 30, -20);
    this.scene.add(this.fillLight);

    // Hemisphere light for natural outdoor lighting
    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x98d9e6, 0.6);
    this.scene.add(this.hemiLight);

    // Add a visible sun
    this.createSun();
  }

  createSun() {
    // Sun sphere (emissive)
    const sunGeometry = new THREE.SphereGeometry(5, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff80,
    });
    this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
    this.sun.position.set(30, 50, 30);
    this.scene.add(this.sun);

    // Sun glow (lens flare effect with sprite)
    const glowGeometry = new THREE.SphereGeometry(8, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffcc,
      transparent: true,
      opacity: 0.3,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.copy(this.sun.position);
    this.scene.add(glow);
  }

  add(object) {
    this.scene.add(object);
  }

  remove(object) {
    this.scene.remove(object);
  }

  getScene() {
    return this.scene;
  }

  dispose() {
    // Clean up lights
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.sunLight);
    this.scene.remove(this.fillLight);
    this.scene.remove(this.hemiLight);
    this.scene.remove(this.sun);

    // Dispose of all scene children
    while (this.scene.children.length > 0) {
      const child = this.scene.children[0];
      this.scene.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  }
}
