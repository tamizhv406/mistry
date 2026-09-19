import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { X, RotateCcw, Eye, Compass, Box, Grid } from 'lucide-react';
import type {
  FloorPlan, FloorPlanWall, FloorPlanRoom, FloorPlanDoor, FloorPlanWindow,
  FloorPlanColumn, FloorPlanStaircase, FloorPlanFurniture
} from '../db/types';

interface FloorPlan3DPreviewProps {
  plan: FloorPlan;
  walls: FloorPlanWall[];
  rooms: FloorPlanRoom[];
  doors: FloorPlanDoor[];
  windows?: FloorPlanWindow[];
  columns?: FloorPlanColumn[];
  stairs?: FloorPlanStaircase[];
  furniture?: FloorPlanFurniture[];
  onClose: () => void;
}

const WALL_HEIGHT = 10; // feet / units
const SCALE = 0.25; // world units per plan unit

export const FloorPlan3DPreview: React.FC<FloorPlan3DPreviewProps> = ({
  plan,
  walls,
  rooms,
  doors,
  windows = [],
  columns = [],
  stairs = [],
  furniture = [],
  onClose,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Orbit controls state
  const isMouseDown = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const cameraTheta = useRef(Math.PI / 4); // horizontal angle
  const cameraPhi = useRef(Math.PI / 4);   // vertical angle
  const cameraRadius = useRef(40);

  const [wireframe, setWireframe] = useState(false);
  const [activePreset, setActivePreset] = useState<'iso' | 'top' | 'front' | 'side'>('iso');

  const updateCamera = useCallback(() => {
    if (!cameraRef.current) return;
    const r = cameraRadius.current;
    const theta = cameraTheta.current;
    const phi = cameraPhi.current;
    cameraRef.current.position.set(
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.cos(theta)
    );
    cameraRef.current.lookAt(0, 0, 0);
  }, []);

  const setViewPreset = useCallback((preset: 'iso' | 'top' | 'front' | 'side') => {
    setActivePreset(preset);
    if (preset === 'iso') {
      cameraTheta.current = Math.PI / 4;
      cameraPhi.current = Math.PI / 4;
    } else if (preset === 'top') {
      cameraTheta.current = 0.001;
      cameraPhi.current = 0.01;
    } else if (preset === 'front') {
      cameraTheta.current = 0;
      cameraPhi.current = Math.PI / 2 - 0.01;
    } else if (preset === 'side') {
      cameraTheta.current = Math.PI / 2;
      cameraPhi.current = Math.PI / 2 - 0.01;
    }
    updateCamera();
  }, [updateCamera]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    // ── Scene ─────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b1329');
    scene.fog = new THREE.FogExp2('#0b1329', 0.008);
    sceneRef.current = scene;

    // ── Camera ────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    cameraRef.current = camera;
    updateCamera();

    // ── Renderer ──────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Lights ────────────────────────────────────────
    const ambient = new THREE.AmbientLight('#c8d8ec', 0.7);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight('#ffffff', 1.3);
    sun.position.set(30, 50, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    const fill = new THREE.DirectionalLight('#38bdf8', 0.4);
    fill.position.set(-25, 20, -15);
    scene.add(fill);

    // ── Grid Helper ───────────────────────────────────
    const grid = new THREE.GridHelper(100, 100, '#2563eb', '#1e293b');
    scene.add(grid);

    // ── Floor (plot boundary) ─────────────────────────
    const floorW = plan.plotLength * SCALE;
    const floorD = plan.plotWidth * SCALE;
    const floorGeo = new THREE.PlaneGeometry(floorW, floorD);
    const floorMat = new THREE.MeshLambertMaterial({
      color: '#e2e8f0',
      side: THREE.DoubleSide,
      wireframe,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(floorW / 2, 0, floorD / 2);
    floor.receiveShadow = true;
    scene.add(floor);

    // Plot boundary outline
    const outlineGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(floorW, 0.04, floorD));
    const outlineMat = new THREE.LineBasicMaterial({ color: '#f59e0b', linewidth: 2 });
    const outline = new THREE.LineSegments(outlineGeo, outlineMat);
    outline.position.set(floorW / 2, 0, floorD / 2);
    scene.add(outline);

    // ── Rooms (floor slabs) ───────────────────────────
    for (const room of rooms) {
      const rGeo = new THREE.PlaneGeometry(room.width * SCALE, room.height * SCALE);
      const rMat = new THREE.MeshLambertMaterial({
        color: '#f1f5f9',
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        wireframe,
      });
      const rMesh = new THREE.Mesh(rGeo, rMat);
      rMesh.rotation.x = -Math.PI / 2;
      rMesh.position.set(
        (room.x + room.width / 2) * SCALE,
        0.02,
        (room.y + room.height / 2) * SCALE
      );
      rMesh.receiveShadow = true;
      scene.add(rMesh);

      // Room border outline
      const rEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(room.width * SCALE, 0.02, room.height * SCALE)),
        new THREE.LineBasicMaterial({ color: '#94a3b8' })
      );
      rEdges.position.set(
        (room.x + room.width / 2) * SCALE,
        0.03,
        (room.y + room.height / 2) * SCALE
      );
      scene.add(rEdges);

      // Room label (canvas texture)
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'transparent';
        ctx.clearRect(0, 0, 256, 64);
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(room.label, 128, 38);
        const tex = new THREE.CanvasTexture(canvas);
        const labelGeo = new THREE.PlaneGeometry(room.width * SCALE * 0.8, room.height * SCALE * 0.3);
        const labelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
        const label = new THREE.Mesh(labelGeo, labelMat);
        label.rotation.x = -Math.PI / 2;
        label.position.set(
          (room.x + room.width / 2) * SCALE,
          0.05,
          (room.y + room.height / 2) * SCALE
        );
        scene.add(label);
      } catch { /* non-critical */ }
    }

    // ── Walls ─────────────────────────────────────────
    const wallH = (plan.ceilingHeight || WALL_HEIGHT) * SCALE;
    for (const wall of walls) {
      const dx = wall.x2 - wall.x1;
      const dy = wall.y2 - wall.y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 0.1) continue;

      const angle = Math.atan2(dy, dx);
      const cx = ((wall.x1 + wall.x2) / 2) * SCALE;
      const cz = ((wall.y1 + wall.y2) / 2) * SCALE;

      const wallGeo = new THREE.BoxGeometry(length * SCALE, wallH, wall.thickness * SCALE);
      const wallColor = wall.wallType === 'exterior' ? '#cbd5e1' : wall.wallType === 'interior' ? '#e2e8f0' : '#f1f5f9';
      const wallMat = new THREE.MeshLambertMaterial({ color: wallColor, wireframe });
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      wallMesh.position.set(cx, wallH / 2, cz);
      wallMesh.rotation.y = -angle;
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      scene.add(wallMesh);

      // Wall edges for crisp architectural CAD rendering
      const edgesGeo = new THREE.EdgesGeometry(wallGeo);
      const edgesMat = new THREE.LineBasicMaterial({ color: '#64748b' });
      const edges = new THREE.LineSegments(edgesGeo, edgesMat);
      edges.position.copy(wallMesh.position);
      edges.rotation.copy(wallMesh.rotation);
      scene.add(edges);
    }

    // ── Columns / Pillars ──────────────────────────────
    for (const col of columns) {
      const colW = (col.width || 1) * SCALE;
      const colD = (col.depth || 1) * SCALE;
      const colGeo = col.shape === 'round'
        ? new THREE.CylinderGeometry(colW / 2, colW / 2, wallH, 16)
        : new THREE.BoxGeometry(colW, wallH, colD);
      const colMat = new THREE.MeshStandardMaterial({
        color: '#64748b',
        roughness: 0.8,
        wireframe,
      });
      const colMesh = new THREE.Mesh(colGeo, colMat);
      colMesh.position.set(col.x * SCALE, wallH / 2, col.y * SCALE);
      colMesh.castShadow = true;
      colMesh.receiveShadow = true;
      scene.add(colMesh);

      const colEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(colGeo),
        new THREE.LineBasicMaterial({ color: '#334155' })
      );
      colEdges.position.copy(colMesh.position);
      scene.add(colEdges);
    }

    // ── Staircases ────────────────────────────────────
    for (const stair of stairs) {
      const sw = stair.width * SCALE;
      const sl = stair.length * SCALE;
      const steps = stair.steps || 14;
      const stepH = wallH / steps;
      const stepD = sl / steps;
      const stairGroup = new THREE.Group();
      stairGroup.position.set(stair.x * SCALE, 0, stair.y * SCALE);
      stairGroup.rotation.y = -(stair.rotation || 0) * Math.PI / 180;

      const stairMat = new THREE.MeshLambertMaterial({ color: '#d97706', wireframe });
      for (let i = 0; i < steps; i++) {
        const stepGeo = new THREE.BoxGeometry(sw, (i + 1) * stepH, stepD);
        const stepMesh = new THREE.Mesh(stepGeo, stairMat);
        stepMesh.position.set(sw / 2, ((i + 1) * stepH) / 2, (i + 0.5) * stepD);
        stepMesh.castShadow = true;
        stairGroup.add(stepMesh);
      }
      scene.add(stairGroup);
    }

    // ── Door Openings & Frames ────────────────────────
    const doorFrameMat = new THREE.MeshLambertMaterial({ color: '#78350f', wireframe });
    for (const door of doors) {
      const dH = 7 * SCALE; // 7ft door height
      const dW = door.width * SCALE;
      const dT = 0.2;

      const frameGeo = new THREE.BoxGeometry(dW, dH, dT);
      const frameMesh = new THREE.Mesh(frameGeo, doorFrameMat);
      frameMesh.position.set(
        door.x * SCALE + dW / 2,
        dH / 2,
        door.y * SCALE
      );
      frameMesh.rotation.y = -door.rotation * Math.PI / 180;
      frameMesh.castShadow = true;
      scene.add(frameMesh);
    }

    // ── Windows (Glass + Frame) ────────────────────────
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      transmission: 0.6,
      wireframe,
    });
    const winFrameMat = new THREE.MeshLambertMaterial({ color: '#0284c7', wireframe });

    for (const win of windows) {
      const winW = win.width * SCALE;
      const winH = 4 * SCALE; // 4ft window height
      const winSill = 3 * SCALE; // 3ft sill height
      const winT = 0.15;

      const glassGeo = new THREE.BoxGeometry(winW, winH, winT);
      const glassMesh = new THREE.Mesh(glassGeo, glassMat);
      glassMesh.position.set(
        win.x * SCALE + winW / 2,
        winSill + winH / 2,
        win.y * SCALE
      );
      glassMesh.rotation.y = -win.rotation * Math.PI / 180;
      scene.add(glassMesh);

      // Frame outline
      const winEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(glassGeo),
        new THREE.LineBasicMaterial({ color: '#0369a1' })
      );
      winEdges.position.copy(glassMesh.position);
      winEdges.rotation.copy(glassMesh.rotation);
      scene.add(winEdges);
    }

    // ── Furniture & Architectural Fixtures ────────────
    const woodMat = new THREE.MeshLambertMaterial({ color: '#8b5a2b', wireframe });
    const fabricMat = new THREE.MeshLambertMaterial({ color: '#3b82f6', wireframe });
    const whiteCeramicMat = new THREE.MeshLambertMaterial({ color: '#f8fafc', wireframe });
    const metallicMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.3, metalness: 0.8, wireframe });
    const darkScreenMat = new THREE.MeshBasicMaterial({ color: '#090d16' });

    for (const furn of furniture) {
      const fw = (furn.width || 3) * SCALE;
      const fh = (furn.height || 3) * SCALE;
      const fGroup = new THREE.Group();
      fGroup.position.set(
        (furn.x + (furn.width || 3) / 2) * SCALE,
        0,
        (furn.y + (furn.height || 3) / 2) * SCALE
      );
      fGroup.rotation.y = -(furn.rotation || 0) * Math.PI / 180;

      const name = (furn.itemType || '').toLowerCase();

      if (name.includes('bed')) {
        // Base mattress + headboard
        const mattressGeo = new THREE.BoxGeometry(fw, 1.5 * SCALE, fh * 0.9);
        const mattressMesh = new THREE.Mesh(mattressGeo, fabricMat);
        mattressMesh.position.set(0, 0.75 * SCALE, 0);
        mattressMesh.castShadow = true;
        fGroup.add(mattressMesh);

        const headboardGeo = new THREE.BoxGeometry(fw, 3 * SCALE, 0.4 * SCALE);
        const headboardMesh = new THREE.Mesh(headboardGeo, woodMat);
        headboardMesh.position.set(0, 1.5 * SCALE, -fh * 0.45);
        headboardMesh.castShadow = true;
        fGroup.add(headboardMesh);
      } else if (name.includes('sofa') || name.includes('couch') || name.includes('chair')) {
        // Seat base + backrest
        const seatGeo = new THREE.BoxGeometry(fw, 1.2 * SCALE, fh * 0.8);
        const seatMesh = new THREE.Mesh(seatGeo, fabricMat);
        seatMesh.position.set(0, 0.6 * SCALE, 0);
        seatMesh.castShadow = true;
        fGroup.add(seatMesh);

        const backGeo = new THREE.BoxGeometry(fw, 2.2 * SCALE, fh * 0.25);
        const backMesh = new THREE.Mesh(backGeo, fabricMat);
        backMesh.position.set(0, 1.1 * SCALE, -fh * 0.35);
        backMesh.castShadow = true;
        fGroup.add(backMesh);
      } else if (name.includes('dining')) {
        // Dining Table top + legs
        const topGeo = new THREE.BoxGeometry(fw, 0.2 * SCALE, fh);
        const topMesh = new THREE.Mesh(topGeo, woodMat);
        topMesh.position.set(0, 2.5 * SCALE, 0);
        topMesh.castShadow = true;
        fGroup.add(topMesh);

        // 4 table legs
        const legGeo = new THREE.BoxGeometry(0.2 * SCALE, 2.5 * SCALE, 0.2 * SCALE);
        const lx = fw / 2 - 0.2 * SCALE;
        const lz = fh / 2 - 0.2 * SCALE;
        [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].forEach(([px, pz]) => {
          const leg = new THREE.Mesh(legGeo, woodMat);
          leg.position.set(px, 1.25 * SCALE, pz);
          leg.castShadow = true;
          fGroup.add(leg);
        });
      } else if (name.includes('tv')) {
        // TV Console + Screen
        const isWallMounted = name.includes('wall');
        const screenGeo = new THREE.BoxGeometry(fw, 2.2 * SCALE, 0.15 * SCALE);
        const screenMesh = new THREE.Mesh(screenGeo, darkScreenMat);
        screenMesh.position.set(0, (isWallMounted ? 4.5 : 3) * SCALE, 0);
        fGroup.add(screenMesh);

        if (!isWallMounted) {
          const standGeo = new THREE.BoxGeometry(fw * 1.1, 1.5 * SCALE, fh);
          const standMesh = new THREE.Mesh(standGeo, woodMat);
          standMesh.position.set(0, 0.75 * SCALE, 0);
          standMesh.castShadow = true;
          fGroup.add(standMesh);
        }
      } else if (name.includes('ac') || name.includes('hvac')) {
        // Split AC Indoor Unit (Mounted high on wall)
        const acGeo = new THREE.BoxGeometry(fw, 1.2 * SCALE, 0.8 * SCALE);
        const acMesh = new THREE.Mesh(acGeo, whiteCeramicMat);
        acMesh.position.set(0, 7.5 * SCALE, 0);
        acMesh.castShadow = true;
        fGroup.add(acMesh);
      } else if (name.includes('toilet') || name.includes('wc') || name.includes('commode')) {
        // Ceramic toilet bowl + cistern
        const cisternGeo = new THREE.BoxGeometry(fw * 0.9, 2.5 * SCALE, fh * 0.4);
        const cisternMesh = new THREE.Mesh(cisternGeo, whiteCeramicMat);
        cisternMesh.position.set(0, 1.25 * SCALE, -fh * 0.25);
        fGroup.add(cisternMesh);

        const bowlGeo = new THREE.CylinderGeometry(fw * 0.35, fw * 0.3, 1.4 * SCALE, 16);
        const bowlMesh = new THREE.Mesh(bowlGeo, whiteCeramicMat);
        bowlMesh.position.set(0, 0.7 * SCALE, fh * 0.15);
        fGroup.add(bowlMesh);
      } else if (name.includes('basin') || name.includes('sink') || name.includes('vanity')) {
        // Countertop + basin
        const vanityGeo = new THREE.BoxGeometry(fw, 2.8 * SCALE, fh);
        const vanityMesh = new THREE.Mesh(vanityGeo, whiteCeramicMat);
        vanityMesh.position.set(0, 1.4 * SCALE, 0);
        vanityMesh.castShadow = true;
        fGroup.add(vanityMesh);
      } else {
        // Generic architectural block with label
        const blockGeo = new THREE.BoxGeometry(fw, 2 * SCALE, fh);
        const blockMesh = new THREE.Mesh(blockGeo, woodMat);
        blockMesh.position.set(0, 1 * SCALE, 0);
        blockMesh.castShadow = true;
        fGroup.add(blockMesh);
      }

      scene.add(fGroup);
    }

    // ── Center camera on plot ─────────────────────────
    const centerX = floorW / 2;
    const centerZ = floorD / 2;
    scene.position.set(-centerX, 0, -centerZ);

    // ── Animation Loop ────────────────────────────────
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // ── Resize Handler ────────────────────────────────
    const handleResize = () => {
      if (!mount || !renderer || !camera) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    // ── Mouse Controls ────────────────────────────────
    const onMouseDown = (e: MouseEvent) => {
      isMouseDown.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown.current) return;
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      cameraTheta.current += dx * 0.01;
      cameraPhi.current = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, cameraPhi.current - dy * 0.01));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      updateCamera();
    };
    const onMouseUp = () => { isMouseDown.current = false; };
    const onWheel = (e: WheelEvent) => {
      cameraRadius.current = Math.max(5, Math.min(150, cameraRadius.current + e.deltaY * 0.05));
      updateCamera();
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true });

    // Touch controls
    let lastTouchDist = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isMouseDown.current = true;
        lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDist = Math.sqrt(dx * dx + dy * dy);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && isMouseDown.current) {
        const dx = e.touches[0].clientX - lastMousePos.current.x;
        const dy = e.touches[0].clientY - lastMousePos.current.y;
        cameraTheta.current += dx * 0.01;
        cameraPhi.current = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, cameraPhi.current - dy * 0.01));
        lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        updateCamera();
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        cameraRadius.current = Math.max(5, Math.min(150, cameraRadius.current - (dist - lastTouchDist) * 0.05));
        lastTouchDist = dist;
        updateCamera();
      }
    };
    const onTouchEnd = () => { isMouseDown.current = false; };

    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: true });
    renderer.domElement.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      renderer.domElement.removeEventListener('touchend', onTouchEnd);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [plan, walls, rooms, doors, windows, columns, stairs, furniture, wireframe, updateCamera]);

  const handleResetCamera = () => {
    setViewPreset('iso');
  };

  return (
    <div
      className="fp-3d-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="3D Floor Plan Preview"
    >
      <div className="fp-3d-header">
        <div className="fp-3d-title-group">
          <span className="fp-3d-badge">3D Architectural CAD</span>
          <h3 className="fp-3d-title">{plan.buildingName} — {plan.floorName}</h3>
          <span className="fp-3d-controls-hint">
            Drag to rotate • Scroll to zoom • Touch gestures supported
          </span>
        </div>

        {/* View presets & options */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div className="fp-3d-presets" style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.08)', padding: 3, borderRadius: 6 }}>
            <button
              type="button"
              className={`fp-3d-preset-btn ${activePreset === 'iso' ? 'active' : ''}`}
              onClick={() => setViewPreset('iso')}
              title="Isometric 3D view"
              style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: 4, background: activePreset === 'iso' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              Perspective
            </button>
            <button
              type="button"
              className={`fp-3d-preset-btn ${activePreset === 'top' ? 'active' : ''}`}
              onClick={() => setViewPreset('top')}
              title="Top 2D/3D Plan view"
              style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: 4, background: activePreset === 'top' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              Top Plan
            </button>
            <button
              type="button"
              className={`fp-3d-preset-btn ${activePreset === 'front' ? 'active' : ''}`}
              onClick={() => setViewPreset('front')}
              title="Front Elevation view"
              style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: 4, background: activePreset === 'front' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              Front
            </button>
            <button
              type="button"
              className={`fp-3d-preset-btn ${activePreset === 'side' ? 'active' : ''}`}
              onClick={() => setViewPreset('side')}
              title="Side Elevation view"
              style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: 4, background: activePreset === 'side' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              Side
            </button>
          </div>

          <button
            type="button"
            className={`fp-3d-control-btn ${wireframe ? 'active' : ''}`}
            onClick={() => setWireframe(w => !w)}
            title="Toggle CAD Wireframe mode"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Grid size={14} />
            Wireframe
          </button>

          <button
            type="button"
            className="fp-3d-control-btn"
            onClick={handleResetCamera}
            title="Reset camera view"
            id="fp-3d-reset-btn"
          >
            <RotateCcw size={16} />
            Reset
          </button>

          <button
            type="button"
            className="fp-3d-control-btn fp-3d-close-btn"
            onClick={onClose}
            title="Close 3D preview"
            id="fp-3d-close-btn"
            aria-label="Close 3D preview"
          >
            <X size={16} />
            Close
          </button>
        </div>
      </div>

      <div className="fp-3d-canvas-wrap" ref={mountRef} />

      <div className="fp-3d-info">
        <span>
          {walls.length} walls • {rooms.length} rooms • {doors.length} doors • {windows.length} windows • {columns.length} columns •
          Plot: {plan.plotLength} × {plan.plotWidth} {plan.unit === 'feet' ? 'ft' : 'm'}
        </span>
        <span className="fp-3d-disclaimer">
          Precision 3D CAD representation generated directly from 2D coordinates
        </span>
      </div>
    </div>
  );
};

