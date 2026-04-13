"use client";

import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";

/* ─── City data — 40 major cities for dense attack traffic ─── */
const CITIES: [number, number, string][] = [
  [40.7128, -74.006, "New York"], [51.5074, -0.1278, "London"],
  [35.6762, 139.6503, "Tokyo"], [55.7558, 37.6173, "Moscow"],
  [-33.8688, 151.2093, "Sydney"], [39.9042, 116.4074, "Beijing"],
  [48.8566, 2.3522, "Paris"], [37.5665, 126.978, "Seoul"],
  [19.076, 72.8777, "Mumbai"], [-23.5505, -46.6333, "São Paulo"],
  [1.3521, 103.8198, "Singapore"], [30.0444, 31.2357, "Cairo"],
  [52.52, 13.405, "Berlin"], [41.0082, 28.9784, "Istanbul"],
  [34.0522, -118.2437, "Los Angeles"], [25.2048, 55.2708, "Dubai"],
  [22.3193, 114.1694, "Hong Kong"], [59.3293, 18.0686, "Stockholm"],
  [-1.2921, 36.8219, "Nairobi"], [43.6532, -79.3832, "Toronto"],
  [47.6062, -122.3321, "Seattle"], [-34.6037, -58.3816, "Buenos Aires"],
  [28.6139, 77.209, "New Delhi"], [13.7563, 100.5018, "Bangkok"],
  [33.8688, 35.5018, "Beirut"], [37.9838, 23.7275, "Athens"],
  [60.1699, 24.9384, "Helsinki"], [-6.2088, 106.8456, "Jakarta"],
  [4.711, -74.0721, "Bogotá"], [14.5995, 120.9842, "Manila"],
  [45.4215, -75.6972, "Ottawa"], [38.7223, -9.1393, "Lisbon"],
  [50.0755, 14.4378, "Prague"], [64.1466, -21.9426, "Reykjavik"],
  [35.6895, 51.389, "Tehran"], [-15.7801, -47.9292, "Brasília"],
  [31.2304, 121.4737, "Shanghai"], [36.8065, 10.1815, "Tunis"],
  [6.5244, 3.3792, "Lagos"], [53.3498, -6.2603, "Dublin"],
];

const R = 2.5;

function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

/* ─── Globe with real earth texture (Kaspersky dark style) ─── */
function EarthGlobe() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const nightMap = useTexture("/earth-dark.jpg");
  const bumpMap = useTexture("/earth-topology.png");

  // Darken and tint the texture for Kaspersky-style look
  useEffect(() => {
    if (nightMap) {
      nightMap.colorSpace = THREE.SRGBColorSpace;
    }
  }, [nightMap]);

  useFrame((_, d) => {
    if (meshRef.current) meshRef.current.rotation.y += d * 0.02;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[R, 64, 64]} />
      <meshStandardMaterial
        map={nightMap}
        bumpMap={bumpMap}
        bumpScale={0.03}
        emissiveMap={nightMap}
        emissive={new THREE.Color("#1a3a1a")}
        emissiveIntensity={0.3}
        roughness={0.9}
        metalness={0.1}
        transparent
        opacity={0.95}
      />
    </mesh>
  );
}

/* ─── Atmospheric glow rim ─── */
function Atmosphere() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.06 + Math.sin(Date.now() * 0.0008) * 0.02;
    }
  });
  return (
    <>
      <mesh ref={ref}>
        <sphereGeometry args={[R * 1.02, 64, 64]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.06} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[R * 1.08, 64, 64]} />
        <meshBasicMaterial color="#9fef00" transparent opacity={0.02} side={THREE.BackSide} />
      </mesh>
    </>
  );
}

/* ─── Subtle grid overlay ─── */
function GridOverlay() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * 0.02; });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[R * 1.003, 36, 18]} />
      <meshBasicMaterial color="#9fef00" wireframe transparent opacity={0.03} />
    </mesh>
  );
}

/* ─── City dots with pulse rings ─── */
function CityDots() {
  const group = useRef<THREE.Group>(null!);
  useFrame((_, d) => { if (group.current) group.current.rotation.y += d * 0.02; });

  return (
    <group ref={group}>
      {CITIES.map(([lat, lng, name], i) => {
        const pos = latLngToVec3(lat, lng, R * 1.006);
        return (
          <group key={name + i} position={pos}>
            <mesh>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshBasicMaterial color="#9fef00" />
            </mesh>
            <mesh>
              <ringGeometry args={[0.025, 0.04, 16]} />
              <meshBasicMaterial color="#9fef00" transparent opacity={0.25} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ─── Kaspersky-style attack arc with bright trail + head glow ─── */
function AttackArc({ from, to, color, progress }: {
  from: THREE.Vector3; to: THREE.Vector3; color: string; progress: number;
}) {
  const data = useMemo(() => {
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const dist = from.distanceTo(to);
    mid.normalize().multiplyScalar(R + dist * 0.4);
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    return curve.getPoints(80);
  }, [from, to]);

  const { trailGeom, headPos } = useMemo(() => {
    const p = Math.min(progress, 1);
    const headIdx = Math.floor(data.length * p);
    const tailLen = 30;
    const tailIdx = Math.max(0, headIdx - tailLen);
    const visible = data.slice(tailIdx, headIdx);
    return {
      trailGeom: visible.length >= 2 ? new THREE.BufferGeometry().setFromPoints(visible) : null,
      headPos: data[Math.min(headIdx, data.length - 1)],
    };
  }, [data, progress]);

  if (!trailGeom) return null;
  return (
    <group>
      {/* Core trail (bright) */}
      {/* @ts-expect-error R3F line element */}
      <line geometry={trailGeom}>
        <lineBasicMaterial color={color} transparent opacity={0.9} linewidth={2} />
      </line>
      {/* Outer glow trail */}
      {/* @ts-expect-error R3F line element */}
      <line geometry={trailGeom}>
        <lineBasicMaterial color={color} transparent opacity={0.25} linewidth={4} />
      </line>
      {/* Head glow sphere */}
      {headPos && progress <= 1.0 && (
        <mesh position={headPos}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={Math.max(0, 0.9 - progress * 0.5)} />
        </mesh>
      )}
    </group>
  );
}

/* ─── Impact explosion at destination ─── */
function ImpactRing({ position, color, startTime }: {
  position: THREE.Vector3; color: string; startTime: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    if (!ref.current) return;
    const elapsed = (Date.now() - startTime) / 800;
    const scale = 1 + elapsed * 4;
    ref.current.scale.set(scale, scale, scale);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 - elapsed);
  });
  return (
    <mesh ref={ref} position={position}>
      <ringGeometry args={[0.03, 0.07, 24]} />
      <meshBasicMaterial color={color} transparent opacity={0.7} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ─── Attack System — Kaspersky-dense traffic ─── */
function AttackSystem() {
  const group = useRef<THREE.Group>(null!);
  const nextId = useRef(0);
  const [attacks, setAttacks] = useState<{
    id: number; from: THREE.Vector3; to: THREE.Vector3;
    color: string; startTime: number;
  }[]>([]);
  const [impacts, setImpacts] = useState<{
    id: number; position: THREE.Vector3; color: string; startTime: number;
  }[]>([]);

  /* Kaspersky palette: bright magenta, hot pink, cyan, electric blue, white */
  const COLORS = ["#ff00ff", "#ff2d95", "#00d4ff", "#00eeff", "#ff44cc", "#ffffff", "#9fef00"];

  const spawn = useCallback(() => {
    const a = Math.floor(Math.random() * CITIES.length);
    let b = Math.floor(Math.random() * CITIES.length);
    while (b === a) b = Math.floor(Math.random() * CITIES.length);
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const toPos = latLngToVec3(CITIES[b][0], CITIES[b][1], R * 1.006);

    setAttacks(prev => [...prev, {
      id: nextId.current++,
      from: latLngToVec3(CITIES[a][0], CITIES[a][1], R * 1.006),
      to: toPos,
      color,
      startTime: Date.now(),
    }].slice(-30));

    setTimeout(() => {
      setImpacts(prev => [...prev, {
        id: nextId.current++, position: toPos, color, startTime: Date.now(),
      }].slice(-15));
    }, 1200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    spawn(); spawn(); spawn(); // Start with 3 immediate attacks
    const iv = setInterval(spawn, 400); // Faster spawn rate (Kaspersky-dense)
    return () => clearInterval(iv);
  }, [spawn]);

  useEffect(() => {
    const iv = setInterval(() => {
      setImpacts(prev => prev.filter(i => Date.now() - i.startTime < 1000));
      setAttacks(prev => prev.filter(a => Date.now() - a.startTime < 3000));
    }, 500);
    return () => clearInterval(iv);
  }, []);

  useFrame((_, d) => { if (group.current) group.current.rotation.y += d * 0.02; });

  return (
    <group ref={group}>
      {attacks.map(atk => {
        const elapsed = (Date.now() - atk.startTime) / 1200;
        if (elapsed > 1.5) return null;
        return (
          <AttackArc key={atk.id} from={atk.from} to={atk.to} color={atk.color} progress={elapsed} />
        );
      })}
      {impacts.map(imp => (
        <ImpactRing key={imp.id} position={imp.position} color={imp.color} startTime={imp.startTime} />
      ))}
    </group>
  );
}

/* ─── Scan rings ─── */
function ScanRing({ radius, speed, opacity, tilt, color }: {
  radius: number; speed: number; opacity: number; tilt: number; color: string;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.z += d * speed; });
  return (
    <mesh ref={ref} rotation={[tilt, 0, 0]}>
      <torusGeometry args={[radius, 0.003, 8, 128]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}

/* ─── Space particles ─── */
function SpaceParticles() {
  const ref = useRef<THREE.Points>(null!);
  const positions = useMemo(() => {
    const arr = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 40;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 40;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    return arr;
  }, []);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * 0.004; });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.012} color="#9fef00" transparent opacity={0.2} sizeAttenuation />
    </points>
  );
}

/* ─── Mouse-controlled Camera ─── */
function CameraRig() {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  useFrame(() => {
    target.current.x += (mouse.current.x - target.current.x) * 0.02;
    target.current.y += (mouse.current.y - target.current.y) * 0.02;
    camera.position.x = target.current.x * 0.8;
    camera.position.y = 1.5 - target.current.y * 0.5;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/* ─── Main Export ─── */
export default function CyberAttackGlobe() {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowH = window.innerHeight;
      // Fully visible for first screen, then fade to 0.15 over next 2 screens
      const fade = Math.max(0.12, 1 - (scrollY - windowH * 0.5) / (windowH * 1.5));
      setOpacity(fade);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
      style={{ opacity }}
    >
      <Canvas
        camera={{ position: [0, 1.5, 6], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.8;
        }}
      >
        <ambientLight intensity={0.15} />
        <directionalLight position={[5, 3, 5]} intensity={0.4} color="#ffffff" />
        <pointLight position={[-5, -3, -5]} intensity={0.15} color="#00d4ff" />

        <Atmosphere />
        <EarthGlobe />
        <GridOverlay />
        <CityDots />
        <ScanRing radius={R * 1.15} speed={0.1} opacity={0.06} tilt={1.1} color="#9fef00" />
        <ScanRing radius={R * 1.3} speed={-0.07} opacity={0.04} tilt={0.6} color="#00d4ff" />
        <ScanRing radius={R * 1.45} speed={0.04} opacity={0.03} tilt={1.8} color="#ff00ff" />
        <AttackSystem />
        <SpaceParticles />
        <CameraRig />
      </Canvas>
    </div>
  );
}
