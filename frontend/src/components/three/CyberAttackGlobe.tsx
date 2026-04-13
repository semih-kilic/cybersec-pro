"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ─── City data (lat, lng) ─── */
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
];

function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

/* ─── Inner glow sphere ─── */
function GlobeGlow() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.03 + Math.sin(Date.now() * 0.001) * 0.01;
    }
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[2.48, 64, 64]} />
      <meshBasicMaterial color="#9fef00" transparent opacity={0.03} />
    </mesh>
  );
}

/* ─── Wireframe Globe ─── */
function GlobeWireframe() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * 0.05; });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[2.5, 64, 64]} />
      <meshBasicMaterial color="#9fef00" wireframe transparent opacity={0.06} />
    </mesh>
  );
}

/* ─── Shield (3D shield shape) ─── */
function Shield3D() {
  const groupRef = useRef<THREE.Group>(null!);

  const shieldShape = useMemo(() => {
    const shape = new THREE.Shape();
    const s = 0.9;
    shape.moveTo(0, s * 1.1);
    shape.bezierCurveTo(s * 0.55, s * 0.95, s * 0.85, s * 0.5, s * 0.85, 0);
    shape.bezierCurveTo(s * 0.85, -s * 0.55, s * 0.45, -s * 0.95, 0, -s * 1.15);
    shape.bezierCurveTo(-s * 0.45, -s * 0.95, -s * 0.85, -s * 0.55, -s * 0.85, 0);
    shape.bezierCurveTo(-s * 0.85, s * 0.5, -s * 0.55, s * 0.95, 0, s * 1.1);
    return shape;
  }, []);

  const edgeGeometry = useMemo(() => {
    const points = shieldShape.getPoints(80);
    return new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(p.x, p.y, 0)));
  }, [shieldShape]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(Date.now() * 0.0003) * 0.1;
    }
  });

  // Checkmark points
  const checkGeometry = useMemo(() => {
    const points = [
      new THREE.Vector3(-0.3, -0.05, 0.01),
      new THREE.Vector3(-0.08, -0.35, 0.01),
      new THREE.Vector3(0.35, 0.3, 0.01),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);

  return (
    <group ref={groupRef} position={[0, 0, 0.5]}>
      {/* Shield glow (behind) */}
      <mesh position={[0, -0.025, -0.1]}>
        <planeGeometry args={[2.2, 2.8]} />
        <meshBasicMaterial color="#9fef00" transparent opacity={0.02} />
      </mesh>
      {/* Shield outline - outer */}
      {/* @ts-expect-error R3F line element */}
      <line geometry={edgeGeometry}>
        <lineBasicMaterial color="#9fef00" transparent opacity={0.6} linewidth={2} />
      </line>
      {/* Shield outline - glow layer */}
      {/* @ts-expect-error R3F line element */}
      <line geometry={edgeGeometry} position={[0, 0, -0.02]}>
        <lineBasicMaterial color="#9fef00" transparent opacity={0.15} linewidth={4} />
      </line>
      {/* Checkmark inside shield */}
      {/* @ts-expect-error R3F line element */}
      <line geometry={checkGeometry}>
        <lineBasicMaterial color="#9fef00" transparent opacity={0.8} linewidth={2} />
      </line>
    </group>
  );
}

/* ─── Orbiting ring ─── */
function OrbitRing({ radius, speed, opacity, tilt }: { radius: number; speed: number; opacity: number; tilt: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.z += d * speed; });
  return (
    <mesh ref={ref} rotation={[tilt, 0, 0]}>
      <torusGeometry args={[radius, 0.005, 8, 128]} />
      <meshBasicMaterial color="#9fef00" transparent opacity={opacity} />
    </mesh>
  );
}

/* ─── City dots  ─── */
function CityDots() {
  const group = useRef<THREE.Group>(null!);
  useFrame((_, d) => { if (group.current) group.current.rotation.y += d * 0.05; });

  return (
    <group ref={group}>
      {CITIES.map(([lat, lng, name], i) => {
        const pos = latLngToVec3(lat, lng, 2.52);
        return (
          <mesh key={name + i} position={pos}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshBasicMaterial color="#9fef00" />
          </mesh>
        );
      })}
    </group>
  );
}

/* ─── Attack Arc ─── */
function AttackArc({ from, to, color, progress }: {
  from: THREE.Vector3; to: THREE.Vector3; color: string; progress: number;
}) {
  const curve = useMemo(() => {
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const dist = from.distanceTo(to);
    mid.normalize().multiplyScalar(2.5 + dist * 0.3);
    return new THREE.QuadraticBezierCurve3(from, mid, to);
  }, [from, to]);

  const geometry = useMemo(() => {
    const pts = curve.getPoints(64);
    const visibleCount = Math.floor(pts.length * Math.min(progress, 1));
    const tail = Math.max(0, visibleCount - 20);
    const visible = pts.slice(tail, visibleCount);
    if (visible.length < 2) return null;
    return new THREE.BufferGeometry().setFromPoints(visible);
  }, [curve, progress]);

  if (!geometry) return null;
  return (
    // @ts-expect-error R3F line element conflicts with SVG line type
    <line geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.7} linewidth={1} />
    </line>
  );
}

/* ─── Attack System ─── */
function AttackSystem() {
  const group = useRef<THREE.Group>(null!);
  const [attacks, setAttacks] = useState<{
    id: number; from: THREE.Vector3; to: THREE.Vector3;
    color: string; startTime: number;
  }[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    const spawn = () => {
      const a = Math.floor(Math.random() * CITIES.length);
      let b = Math.floor(Math.random() * CITIES.length);
      while (b === a) b = Math.floor(Math.random() * CITIES.length);
      const colors = ["#ff3333", "#ff6600", "#9fef00", "#00d4ff", "#ff00ff"];
      setAttacks(prev => {
        const next = [...prev, {
          id: nextId.current++,
          from: latLngToVec3(CITIES[a][0], CITIES[a][1], 2.52),
          to: latLngToVec3(CITIES[b][0], CITIES[b][1], 2.52),
          color: colors[Math.floor(Math.random() * colors.length)],
          startTime: Date.now(),
        }];
        return next.slice(-15);
      });
    };
    spawn();
    const iv = setInterval(spawn, 800);
    return () => clearInterval(iv);
  }, []);

  useFrame((_, d) => { if (group.current) group.current.rotation.y += d * 0.05; });

  return (
    <group ref={group}>
      {attacks.map(atk => {
        const elapsed = (Date.now() - atk.startTime) / 1500;
        return (
          <AttackArc
            key={atk.id}
            from={atk.from}
            to={atk.to}
            color={atk.color}
            progress={elapsed}
          />
        );
      })}
    </group>
  );
}

/* ─── Ambient particles ─── */
function SpaceParticles() {
  const ref = useRef<THREE.Points>(null!);
  const positions = useMemo(() => {
    const arr = new Float32Array(800 * 3);
    for (let i = 0; i < 800; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 30;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 30;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    return arr;
  }, []);

  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * 0.008; });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.02} color="#9fef00" transparent opacity={0.3} sizeAttenuation />
    </points>
  );
}

/* ─── Main Export ─── */
export default function CyberAttackGlobe() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <Canvas camera={{ position: [0, 0, 7], fov: 50 }} gl={{ antialias: true, alpha: true }} style={{ background: "transparent", pointerEvents: "none" }}>
        <GlobeGlow />
        <GlobeWireframe />
        <Shield3D />
        <OrbitRing radius={3.0} speed={0.15} opacity={0.08} tilt={1.2} />
        <OrbitRing radius={3.3} speed={-0.1} opacity={0.05} tilt={0.8} />
        <CityDots />
        <AttackSystem />
        <SpaceParticles />
      </Canvas>
    </div>
  );
}
