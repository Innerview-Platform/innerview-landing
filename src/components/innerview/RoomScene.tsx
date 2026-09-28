import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF, useProgress } from "@react-three/drei";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import camInterviewer from "@/assets/cam-interviewer.jpg";
import camCandidate from "@/assets/cam-candidate.jpg";
import { scrollState, smooth } from "./scroll-state";

// Copied from /assets into /public so the dev server and build can serve them.
const INTERVIEWER_URL = "/interviewer.glb";
const INTERVIEWEE_URL = "/interviewee.glb";
const TABLE_Y = 1.22;

/* ---------- Head-turn material (model is unrigged: bend vertices above the neck) ---------- */
// Single mesh per model, so one shared set of uniforms per person is fine.
type HeadUniforms = { uYaw: { value: number }; uPitch: { value: number } };

type NeckZone = { pivot: THREE.Vector3; lo: number; hi: number };

function makeHeadMaterial(
  src: THREE.Material | THREE.Material[],
  tint: string,
  uniforms: HeadUniforms,
  neck: NeckZone,
) {
  const mats = Array.isArray(src) ? src : [src];
  const out = mats.map((old) => {
    const srcStd = (old as THREE.MeshStandardMaterial).isMeshStandardMaterial
      ? (old as THREE.MeshStandardMaterial)
      : new THREE.MeshStandardMaterial();
    const m = srcStd.clone();
    m.roughness = 0.78;
    m.metalness = 0;
    if (tint) m.color = new THREE.Color(tint);
    m.envMapIntensity = 0.6;
    m.onBeforeCompile = (s) => {
      s.uniforms["uYaw"] = uniforms.uYaw;
      s.uniforms["uPitch"] = uniforms.uPitch;
      s.vertexShader =
        `uniform float uYaw; uniform float uPitch;
         uniform vec3 uPivot; uniform float uNeckLo; uniform float uNeckHi;
         mat3 hrY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s, 0.,1.,0., s,0.,c);}
         mat3 hrX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0., 0.,c,s, 0.,-s,c);}
        ` + s.vertexShader;
      s.vertexShader = s.vertexShader
        .replace(
          "#include <beginnormal_vertex>",
          `#include <beginnormal_vertex>
           float hw = smoothstep(uNeckLo, uNeckHi, position.y);
           mat3 hr = hrY(uYaw * hw) * hrX(uPitch * hw);
           objectNormal = hr * objectNormal;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           transformed = uPivot + hr * (transformed - uPivot);`,
        );
      s.uniforms["uPivot"] = { value: neck.pivot };
      s.uniforms["uNeckLo"] = { value: neck.lo };
      s.uniforms["uNeckHi"] = { value: neck.hi };
    };
    // distinct program per person so tint/uniform wiring never collides
    m.customProgramCacheKey = () => `head-bend`;
    return m;
  });
  return Array.isArray(src) ? out : out[0]!;
}

function Person({
  url,
  position,
  rotationY,
  tint,
  phase,
  chairX,
}: {
  url: string;
  position: [number, number, number];
  rotationY: number;
  tint: string | null;
  phase: number;
  chairX: number;
}) {
  const { scene } = useGLTF(url, false);
  const group = useRef<THREE.Group>(null);
  const { uniforms, wrap } = useMemo(() => {
    const obj = scene.clone(true);
    const uniforms: HeadUniforms = { uYaw: { value: 0 }, uPitch: { value: 0 } };

    // Models ship in raw mesh units (near the ±32767 range); normalize so the
    // person stands 1.76 units tall with feet on the floor, centred on x/z.
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const scale = 1.76 / size.y;

    const wrap = new THREE.Group();
    obj.scale.setScalar(scale);
    obj.position.y = -box.min.y * scale;
    obj.position.x = -center.x * scale;
    obj.position.z = -center.z * scale;
    wrap.add(obj);

    // Head-bend pivot sits at the skull base; the neck band blends from just
    // below the chin. The vertex shader reads the *raw* model `position`
    // attribute, so convert these world-unit heights back into model units.
    const toRawY = (worldY: number) => box.min.y + (worldY / 1.76) * size.y;
    const neck: NeckZone = {
      pivot: new THREE.Vector3(center.x, toRawY(1.6), center.z + (0.02 / 1.76) * size.y),
      lo: toRawY(1.47),
      hi: toRawY(1.62),
    };
    obj.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.material = makeHeadMaterial(mesh.material, tint ?? "", uniforms, neck);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return { uniforms, wrap };
  }, [scene, tint]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    const p = scrollState.current;
    const down = smooth(0.43, 0.52, p); // 0 = looking at each other, 1 = at laptop
    // Layered sines at incommensurate frequencies read as organic motion
    // rather than a metronome. Cubed terms linger near zero, so glances come
    // in natural bursts instead of a constant wag.
    const glance = Math.sin(t * 0.21 + phase);
    const talkYaw =
      Math.sin(t * 0.53) * 0.07 + Math.sin(t * 1.13 + 1.4) * 0.03 + glance * glance * glance * 0.16;
    const talkPitch = Math.sin(t * 1.31 + 0.5) * 0.028 + Math.sin(t * 0.47) * 0.02 - 0.02;
    // at laptop: reading the screen, small saccades on top of a slow scan
    const readYaw = Math.sin(t * 0.37 + 2.0) * 0.05 + Math.sin(t * 2.9) * 0.008;
    const readPitch = 0.42 + Math.sin(t * 0.83 + 1.1) * 0.02 + Math.sin(t * 3.7 + 0.4) * 0.005;
    uniforms.uYaw.value = THREE.MathUtils.lerp(talkYaw, readYaw, down);
    uniforms.uPitch.value = THREE.MathUtils.lerp(talkPitch, readPitch, down);
    if (group.current) {
      // asymmetric inhale/exhale + a hint of postural sway
      const breathe = Math.sin(t * 1.05) + Math.sin(t * 2.1 + 0.9) * 0.25;
      group.current.scale.set(1, 1 + breathe * 0.003, 1);
      group.current.rotation.x = down * 0.05; // lean in toward the screen
      group.current.rotation.y = Math.sin(t * 0.17 + phase * 2.0) * 0.01;
    }
  });

  return (
    <group position={position} rotation-y={rotationY}>
      <group ref={group}>
        <primitive object={wrap} />
      </group>
      <Chair offsetX={chairX} />
    </group>
  );
}

/* ---------- Props ---------- */
function Chair({ offsetX }: { offsetX: number }) {
  // The models' hips sit around y=0.85 and z=-0.12 after normalization.
  const seatY = 0.73;
  const legHeight = seatY - 0.03;
  return (
    <group position={[offsetX, 0, -0.13]}>
      <mesh position={[0, seatY, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.62, 0.06, 0.55]} />
        <meshStandardMaterial color="#1b1612" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.25, -0.32]} rotation-x={-0.08} castShadow>
        <boxGeometry args={[0.62, 0.86, 0.06]} />
        <meshStandardMaterial color="#1b1612" roughness={0.6} />
      </mesh>
      {[-0.25, 0.25].flatMap((x) =>
        [-0.22, 0.22].map((z) => (
          <mesh key={`${x}${z}`} position={[x, legHeight / 2, z]}>
            <cylinderGeometry args={[0.018, 0.018, legHeight]} />
            <meshStandardMaterial color="#0c0c0c" metalness={0.8} roughness={0.35} />
          </mesh>
        )),
      )}
    </group>
  );
}

function woodTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#2a1d14";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 140; i++) {
    const y = Math.random() * 512;
    g.strokeStyle = `rgba(${10 + Math.random() * 30},${6 + Math.random() * 14},4,${0.15 + Math.random() * 0.35})`;
    g.lineWidth = Math.random() * 3 + 0.5;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 4);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function Table() {
  const tex = useMemo(woodTexture, []);
  return (
    <group>
      <mesh position={[0, TABLE_Y - 0.025, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.25, 0.05, 1.3]} />
        <meshStandardMaterial map={tex} roughness={0.45} metalness={0.05} />
      </mesh>
      {[-0.55, 0.55].flatMap((x) =>
        [-0.58, 0.58].map((z) => (
          <mesh key={`${x}${z}`} position={[x, (TABLE_Y - 0.05) / 2, z]} castShadow>
            <boxGeometry args={[0.05, TABLE_Y - 0.05, 0.05]} />
            <meshStandardMaterial color="#120d09" roughness={0.5} />
          </mesh>
        )),
      )}
      {/* coffee mug */}
      <mesh position={[0.42, TABLE_Y + 0.05, -0.15]} castShadow>
        <cylinderGeometry args={[0.04, 0.036, 0.1, 24]} />
        <meshStandardMaterial color="#d9d2c5" roughness={0.3} />
      </mesh>
    </group>
  );
}

/* ---------- Laptop with live interview screen ---------- */
const CODE_LINES = [
  "def merge(intervals):",
  "    intervals.sort(key=lambda x: x[0])",
  "    out = [intervals[0]]",
  "    for s, e in intervals[1:]:",
  "        if s <= out[-1][1]:",
  "            out[-1][1] = max(out[-1][1], e)",
  "        else:",
  "            out.append([s, e])",
  "    return out",
];

function useScreenTexture(remote: string) {
  const { canvas, tex, img } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 400;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const img = new Image();
    img.src = remote;
    return { canvas, tex, img };
  }, [remote]);
  const last = useRef(0);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (t - last.current < 0.12) return;
    last.current = t;
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#0f0e0d";
    g.fillRect(0, 0, 640, 400);
    // top bar
    g.fillStyle = "#1a1816";
    g.fillRect(0, 0, 640, 28);
    g.fillStyle = "#e8a64a";
    g.font = "600 14px monospace";
    g.fillText("innerview", 12, 19);
    g.fillStyle = "#ff5a4f";
    g.beginPath();
    g.arc(600, 14, 5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#aaa";
    g.font = "12px monospace";
    const secs = Math.floor(t) % 60;
    g.fillText(`24:${secs.toString().padStart(2, "0")}`, 548, 19);
    // problem panel
    g.fillStyle = "#151412";
    g.fillRect(8, 36, 150, 356);
    g.fillStyle = "#ddd";
    g.font = "600 12px sans-serif";
    g.fillText("Merge Intervals", 16, 56);
    g.fillStyle = "#555";
    for (let i = 0; i < 12; i++) g.fillRect(16, 70 + i * 14, 120 - (i % 3) * 22, 5);
    // editor
    g.fillStyle = "#121110";
    g.fillRect(166, 36, 300, 250);
    g.font = "11px monospace";
    // Cyclical typing with human-feeling pauses. A cosine-eased triangle wave
    // (plus a slow secondary wobble) makes line boundaries sometimes land on
    // the slower beats — reads as a person thinking, not a machine spooling.
    const cycle = (t % 22) / 22;
    const eased = 0.5 - 0.5 * Math.cos(cycle * Math.PI * 2); // 0 → 1 → 0
    const wobble = 1 + Math.sin(t * 0.31) * 0.06;
    const chars = Math.floor(Math.min(1, eased * wobble) * 420);
    let used = 0;
    CODE_LINES.forEach((line, i) => {
      const show = Math.max(0, Math.min(line.length, chars - used));
      used += line.length;
      g.fillStyle = i === 0 ? "#e8a64a" : "#cfc8bb";
      g.fillText(line.slice(0, show), 176, 56 + i * 16);
      if (show > 0 && show < line.length && Math.floor(t * 3) % 2 === 0) {
        g.fillStyle = "#e8a64a";
        g.fillRect(176 + show * 6.6, 47 + i * 16, 2, 12);
      }
    });
    // tests
    g.fillStyle = "#121110";
    g.fillRect(166, 294, 300, 98);
    for (let i = 0; i < 4; i++) {
      const done = chars > 360 + i * 12;
      g.fillStyle = done ? "#4fd08a" : "#444";
      g.beginPath();
      g.arc(182, 314 + i * 20, 5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#999";
      g.fillText(`Test case ${i + 1}`, 196, 318 + i * 20);
    }
    // video tiles
    if (img.complete && img.naturalWidth) {
      g.drawImage(img, 474, 36, 158, 118);
    } else {
      g.fillStyle = "#222";
      g.fillRect(474, 36, 158, 118);
    }
    g.fillStyle = "#1c1a18";
    g.fillRect(474, 162, 158, 118);
    g.fillStyle = "#e8a64a";
    g.beginPath();
    g.arc(553, 221, 22, 0, Math.PI * 2);
    g.fill();
    // canvas sketch
    g.fillStyle = "#151412";
    g.fillRect(474, 288, 158, 104);
    g.strokeStyle = "#7fb4e8";
    g.lineWidth = 3;
    [
      [0, 40],
      [30, 70],
      [90, 120],
    ].forEach(([a, b], i) => {
      g.beginPath();
      g.moveTo(486 + a!, 310 + i * 22);
      g.lineTo(486 + b!, 310 + i * 22);
      g.stroke();
    });
    tex.needsUpdate = true;
  });
  return tex;
}

const KEY_POSITIONS: [number, number][] = Array.from({ length: 5 }, (_, row) => {
  const columns =
    row === 4 ? [0, 1, 2, 3, 9, 10, 11, 12] : Array.from({ length: 13 }, (_, column) => column);
  return columns.map((column): [number, number] => [(column - 6) * 0.0235, -0.096 + row * 0.024]);
}).flat();

function Keyboard() {
  const keys = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = keys.current;
    if (!mesh) return;
    const key = new THREE.Object3D();
    KEY_POSITIONS.forEach(([x, z], i) => {
      key.position.set(x, 0.024, z);
      key.updateMatrix();
      mesh.setMatrixAt(i, key.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <group>
      <mesh position={[0, 0.0197, -0.046]}>
        <boxGeometry args={[0.326, 0.001, 0.154]} />
        <meshStandardMaterial color="#17191c" metalness={0.25} roughness={0.65} />
      </mesh>
      <instancedMesh ref={keys} args={[undefined, undefined, KEY_POSITIONS.length]}>
        <boxGeometry args={[0.019, 0.004, 0.018]} />
        <meshStandardMaterial color="#41444a" metalness={0.3} roughness={0.55} />
      </instancedMesh>
      <mesh position={[0, 0.024, 0]}>
        <boxGeometry args={[0.113, 0.004, 0.018]} />
        <meshStandardMaterial color="#41444a" metalness={0.3} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.0197, 0.082]}>
        <boxGeometry args={[0.105, 0.001, 0.05]} />
        <meshStandardMaterial color="#26282c" metalness={0.45} roughness={0.5} />
      </mesh>
    </group>
  );
}

function Laptop({ z, flip, remote }: { z: number; flip: boolean; remote: string }) {
  const tex = useScreenTexture(remote);
  return (
    <group position={[0, TABLE_Y, z]} rotation-y={flip ? Math.PI : 0}>
      {/* base; user sits toward local +z */}
      <mesh position={[0, 0.01, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.36, 0.018, 0.25]} />
        <meshStandardMaterial color="#3a3a3c" metalness={0.8} roughness={0.35} />
      </mesh>
      <Keyboard />
      <group position={[0, 0.02, -0.12]} rotation-x={-0.26}>
        <mesh position={[0, 0.115, -0.006]} castShadow>
          <boxGeometry args={[0.36, 0.235, 0.01]} />
          <meshStandardMaterial color="#3a3a3c" metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.115, 0.0005]}>
          <planeGeometry args={[0.34, 0.2125]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
        <pointLight
          position={[0, 0.12, 0.25]}
          color="#8fb6ff"
          intensity={1.4}
          distance={1.4}
          decay={2}
        />
      </group>
    </group>
  );
}

function Lamp() {
  return (
    <group position={[0, 2.75, 0]}>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 2.4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh>
        <coneGeometry args={[0.2, 0.18, 32, 1, true]} />
        <meshStandardMaterial
          color="#141210"
          side={THREE.DoubleSide}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, -0.05, 0]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ---------- Scroll-driven camera ---------- */
type Key = { p: number; pos: [number, number, number]; tgt: [number, number, number] };
const KEYS: Key[] = [
  { p: 0.0, pos: [3.4, 2.1, 0.2], tgt: [0, 1.45, 0] },
  { p: 0.12, pos: [2.5, 1.95, 1.9], tgt: [0, 1.5, 0] },
  { p: 0.22, pos: [0.3, 1.82, 0.35], tgt: [0.04, 1.76, -1.2] }, // his face
  { p: 0.29, pos: [0.22, 1.8, 0.2], tgt: [0.04, 1.76, -1.2] },
  { p: 0.35, pos: [-0.3, 1.82, -0.35], tgt: [-0.04, 1.76, 1.2] }, // the other face
  { p: 0.42, pos: [-0.22, 1.8, -0.2], tgt: [-0.04, 1.76, 1.2] },
  { p: 0.5, pos: [2.2, 2.7, 1.0], tgt: [0, 1.3, 0] }, // both look down
  { p: 0.58, pos: [0.45, 1.55, -0.15], tgt: [0.04, 1.62, -1.2] }, // face lit by screen
  { p: 0.65, pos: [0.28, 1.9, -1.35], tgt: [0, 1.36, -0.2] }, // over shoulder to screen
  { p: 0.71, pos: [-0.45, 1.55, 0.15], tgt: [-0.04, 1.62, 1.2] }, // other face
  { p: 0.77, pos: [-0.28, 1.9, 1.35], tgt: [0, 1.36, 0.2] }, // other screen
  { p: 0.85, pos: [0.2, 1.8, -1.2], tgt: [0, 1.35, -0.2] }, // back to first seat
  { p: 1.0, pos: [0, 1.37, -0.46], tgt: [0, 1.34, -0.1] }, // into the screen
];

function CameraRig() {
  const { camera, size } = useThree();
  const pos = useMemo(() => new THREE.Vector3(), []);
  const tgt = useMemo(() => new THREE.Vector3(), []);
  const camPosCurve = useMemo(() => {
    // Pad both ends with the endpoint duplicated so the curve eases to a stop
    // instead of launching into / out of the story.
    const pts = [KEYS[0]!, ...KEYS, KEYS[KEYS.length - 1]!].map((k) => new THREE.Vector3(...k.pos));
    return new THREE.CatmullRomCurve3(pts, false, "centripetal");
  }, []);
  const camTgtCurve = useMemo(() => {
    const pts = [KEYS[0]!, ...KEYS, KEYS[KEYS.length - 1]!].map((k) => new THREE.Vector3(...k.tgt));
    return new THREE.CatmullRomCurve3(pts, false, "centripetal");
  }, []);
  // Map normalized story progress (0..1 across KEYS) onto the padded curve
  // parameter so we sample at the right points.
  const n = KEYS.length - 1; // segments in the original key stack
  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    scrollState.current += (scrollState.target - scrollState.current) * (1 - Math.exp(-5 * dt));
    const p = scrollState.current;
    const u = (p * n + 1) / (n + 2); // 1/N .. (N+1)/N on the padded curve
    camPosCurve.getPoint(u, pos);
    camTgtCurve.getPoint(u, tgt);
    // Handheld drift — layered, sub-pixel-ish amplitudes that fade to nothing
    // near the screen dive so the end transition is stable.
    const portrait = size.width < size.height;
    const overview = portrait ? 1 - smooth(0.08, 0.2, p) : 0;
    if (portrait) pos.lerp(tgt, -(0.25 + 0.5 * overview));
    const drift = 1 - smooth(0.88, 1, p);
    const ct = clock.elapsedTime;
    pos.x += (Math.sin(ct * 0.41) * 0.5 + Math.sin(ct * 0.97 + 1.7) * 0.3) * 0.022 * drift;
    pos.y += (Math.sin(ct * 0.53 + 0.8) * 0.5 + Math.sin(ct * 1.21) * 0.3) * 0.012 * drift;
    pos.z += Math.sin(ct * 0.29 + 2.4) * 0.014 * drift;
    tgt.x += Math.sin(ct * 0.23 + 3.1) * 0.008 * drift;
    tgt.y += Math.sin(ct * 0.19 + 1.2) * 0.006 * drift;
    camera.position.copy(pos);
    camera.lookAt(tgt);
    const cam = camera as THREE.PerspectiveCamera;
    const fovT = smooth(0.15, 0.34, p) * (1 - smooth(0.46, 0.56, p));
    const storyFov = THREE.MathUtils.lerp(portrait ? 46 : 38, portrait ? 36 : 30, fovT);
    const fov = THREE.MathUtils.lerp(storyFov, 58, overview);
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

function Room() {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#0d0b0a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 3, -5]}>
        <planeGeometry args={[30, 8]} />
        <meshStandardMaterial color="#0e0d0c" roughness={1} />
      </mesh>
    </>
  );
}

function World() {
  return (
    <>
      <Room />
      <Table />
      <Lamp />
      <Person
        url={INTERVIEWER_URL}
        position={[0, 0, -1.12]}
        rotationY={0}
        tint="#ffffff"
        phase={0}
        chairX={0.06}
      />
      <Person
        url={INTERVIEWEE_URL}
        position={[0, 0, 1.12]}
        rotationY={Math.PI}
        tint={null}
        phase={2.3}
        chairX={0.12}
      />
      <Laptop z={-0.36} flip remote={camCandidate} />
      <Laptop z={0.36} flip={false} remote={camInterviewer} />
    </>
  );
}

function SceneReady({ onReady }: { onReady: (ready: boolean) => void }) {
  useEffect(() => onReady(true), [onReady]);
  return null;
}

function SceneLoadProgress({ onProgress }: { onProgress: (progress: number) => void }) {
  const progress = useProgress((state) => state.progress);
  useEffect(() => onProgress(progress), [onProgress, progress]);
  return null;
}

export default function RoomScene({
  onReady,
  onProgress,
}: {
  onReady: (ready: boolean) => void;
  onProgress: (progress: number) => void;
}) {
  const [quality, setQuality] = useState({ dpr: 1.25, shadowMapSize: 512 });

  useEffect(() => {
    const updateQuality = () => {
      const compact = window.innerWidth < 768;
      setQuality({
        dpr: Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.75),
        shadowMapSize: compact ? 512 : 1024,
      });
    };
    updateQuality();
    window.addEventListener("resize", updateQuality);
    return () => window.removeEventListener("resize", updateQuality);
  }, []);

  // NOTE: we intentionally don't clear the GLTF cache on unmount — the scene
  // remounts during development / re-navigation, and refetching two ~9 MB
  // models each time stalls the intro.
  return (
    <Canvas
      shadows
      dpr={quality.dpr}
      camera={{ position: [3.4, 2.1, 0.2], fov: 38, near: 0.02, far: 60 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      <color attach="background" args={["#070605"]} />
      <fog attach="fog" args={["#070605", 4, 11]} />
      <ambientLight intensity={0.06} />
      <spotLight
        position={[0, 2.7, 0]}
        angle={0.95}
        penumbra={0.9}
        intensity={14}
        distance={6}
        decay={1.6}
        color="#ffbb70"
        castShadow
        shadow-mapSize-width={quality.shadowMapSize}
        shadow-mapSize-height={quality.shadowMapSize}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-4, 3, -3]} intensity={0.25} color="#6f8fbf" />
      <Environment resolution={64}>
        <Lightformer
          intensity={0.5}
          position={[0, 4, 0]}
          scale={[4, 4, 1]}
          rotation-x={Math.PI / 2}
          color="#ffb870"
        />
        <Lightformer
          intensity={0.25}
          position={[-5, 1, 0]}
          rotation-y={Math.PI / 2}
          scale={[10, 2, 1]}
          color="#5f7fb0"
        />
      </Environment>
      <SceneLoadProgress onProgress={onProgress} />
      <Suspense fallback={null}>
        <World />
        <SceneReady onReady={onReady} />
      </Suspense>
      <CameraRig />
    </Canvas>
  );
}
