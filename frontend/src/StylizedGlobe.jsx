import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildStylizedEarthTexture } from './stylizedEarthTexture';

const ROTATION_PERIOD_SEC = 120;
const MAX_DELTA_SEC = 0.05;
const SPHERE_RADIUS = 1;
const ATMOSPHERE_SCALE = 1.06;
const STAR_COUNT = 2200;

const ATMOSPHERE_VERTEX = `
varying vec3 vNormal;
void main() {
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ATMOSPHERE_FRAGMENT = `
varying vec3 vNormal;
void main() {
  float rim = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
  vec3 glow = vec3(0.55, 0.88, 0.28);
  gl_FragColor = vec4(glow, clamp(rim * 1.15, 0.0, 0.85));
}
`;

function createStarfield() {
  const positions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i += 1) {
    const r = 18 + Math.random() * 22;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.045,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}

const StylizedGlobe = ({ onActivate, className = '', brightPalette = false }) => {
  const mountRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    let disposed = false;
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    camera.position.set(0, 0.28, 2.85);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = brightPalette ? 1.22 : 1.05;
    el.appendChild(renderer.domElement);

    const stars = createStarfield();
    scene.add(stars);

    const globeGroup = new THREE.Group();
    globeGroup.rotation.x = 0.38;
    globeGroup.rotation.z = 0.04;
    scene.add(globeGroup);

    const bright = brightPalette;
    scene.add(new THREE.AmbientLight(bright ? 0x8aa8c8 : 0x1a2844, bright ? 0.72 : 0.35));

    const sun = new THREE.DirectionalLight(0xfff8f0, bright ? 1.65 : 1.35);
    sun.position.set(4.5, 1.8, 5);
    scene.add(sun);

    const fill = new THREE.DirectionalLight(bright ? 0x9ec4e8 : 0x4a7ab8, bright ? 0.75 : 0.45);
    fill.position.set(-3, -1, 2);
    scene.add(fill);

    const rim = new THREE.PointLight(0xa3e635, bright ? 0.35 : 0.55, 12);
    rim.position.set(-2.2, 0.5, 3.5);
    scene.add(rim);

    const atmosphereMat = new THREE.ShaderMaterial({
      vertexShader: ATMOSPHERE_VERTEX,
      fragmentShader: ATMOSPHERE_FRAGMENT,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(SPHERE_RADIUS * ATMOSPHERE_SCALE, 64, 64),
      atmosphereMat,
    );
    globeGroup.add(atmosphere);

    let globeMesh = null;

    buildStylizedEarthTexture(THREE, { palette: brightPalette ? 'live' : 'default' }).then((texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

      const geometry = new THREE.SphereGeometry(SPHERE_RADIUS, 128, 128);
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.82,
        metalness: 0.04,
        emissive: new THREE.Color(0x030508),
        emissiveIntensity: 0.08,
      });
      globeMesh = new THREE.Mesh(geometry, material);
      globeGroup.add(globeMesh);
    });

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 2 || h < 2) return;
      const side = Math.min(w, h);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
      renderer.setSize(side, side, false);
      renderer.domElement.style.width = `${side}px`;
      renderer.domElement.style.height = `${side}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const clock = new THREE.Clock();
    const angularSpeed = (Math.PI * 2) / ROTATION_PERIOD_SEC;
    let floatPhase = 0;

    const spin = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), MAX_DELTA_SEC);
      floatPhase += dt;

      if (globeMesh && dt > 0) {
        globeMesh.rotation.y += angularSpeed * dt;
        atmosphere.rotation.y = globeMesh.rotation.y;
      }

      globeGroup.position.y = Math.sin(floatPhase * 0.55) * 0.018;
      stars.rotation.y += angularSpeed * 0.08 * dt;

      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(spin);
    };
    clock.start();
    frameRef.current = requestAnimationFrame(spin);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
      atmosphereMat.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === el) {
        el.removeChild(renderer.domElement);
      }
    };
  }, [brightPalette]);

  return (
    <div
      ref={mountRef}
      className={`stylized-globe-canvas ${className}`.trim()}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate?.();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Rotating 3D globe — click to open Zimbabwe map"
    />
  );
};

export default StylizedGlobe;
