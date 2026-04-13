"use client";

import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ─── City data (lat, lng) — expanded for denser coverage ─── */
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
];

const R = 2.5; // Globe radius

function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

/* ─── Atmospheric glow layers ─── */
function Atmosphere() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.025 + Math.sin(Date.now() * 0.0008) * 0.01;
    }
  });
  return (
    <>
      {/* Inner glow */}
      <mesh ref={ref}>
        <sphereGeometry args={[R * 0.99, 64, 64]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.025} side={THREE.BackSide} />
      </mesh>
      {/* Outer atmospheric rim */}
      <mesh>
        <sphereGeometry args={[R * 1.12, 64, 64]} />
        <meshBasicMaterial color="#9fef00" transparent opacity={0.012} side={THREE.BackSide} />
      </mesh>
    </>
  );
}

/* ─── Dark globe body with subtle grid ─── */
function GlobeBody() {
  const ref = useRef<THREE.Group>(null!);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * 0.03; });
  return (
    <group ref={ref}>
      {/* Solid dark sphere */}
      <mesh>
        <sphereGeometry args={[R * 0.995, 64, 64]} />
        <meshBasicMaterial color="#1a1f2e" transparent opacity={0.95} />
      </mesh>
      {/* Subtle grid lines like Kaspersky */}
      <mesh>
        <sphereGeometry args={[R, 40, 20]} />
        <meshBasicMaterial color="#9fef00" wireframe transparent opacity={0.04} />
      </mesh>
      {/* Finer secondary grid */}
      <mesh>
        <sphereGeometry args={[R * 1.001, 80, 40]} />
        <meshBasicMaterial color="#00d4ff" wireframe transparent opacity={0.015} />
      </mesh>
    </group>
  );
}

/* ─── Continent outlines (simplified polygonal land masses) ─── */
function ContinentOutlines() {
  const ref = useRef<THREE.Group>(null!);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * 0.03; });

  const continents = useMemo(() => {
    // Simplified continent boundary coordinates [lat, lng][]
    const data: { name: string; coords: [number, number][] }[] = [
      { name: "NorthAmerica", coords: [
        [60,-140],[55,-130],[50,-125],[48,-124],[37,-122],[32,-117],[25,-110],[20,-105],
        [18,-97],[20,-87],[25,-80],[30,-82],[30,-85],[35,-75],[40,-74],[42,-70],
        [45,-67],[47,-60],[50,-56],[52,-56],[55,-60],[58,-65],[60,-75],[65,-85],
        [70,-100],[72,-115],[70,-140],[65,-168],[60,-165],[60,-140],
      ]},
      { name: "SouthAmerica", coords: [
        [12,-72],[10,-67],[7,-60],[5,-52],[0,-50],[-5,-35],[-10,-37],[-15,-39],
        [-20,-40],[-25,-48],[-30,-50],[-35,-57],[-40,-62],[-45,-65],[-50,-70],
        [-55,-68],[-53,-72],[-46,-76],[-40,-73],[-35,-72],[-25,-70],
        [-15,-76],[-5,-80],[0,-78],[5,-77],[10,-75],[12,-72],
      ]},
      { name: "Europe", coords: [
        [36,-10],[38,-8],[40,-4],[43,3],[44,8],[45,12],[41,14],[38,24],
        [40,26],[42,28],[44,28],[46,30],[50,30],[52,22],[54,14],[56,10],
        [58,12],[60,5],[62,5],[64,10],[68,15],[70,20],[70,28],[68,30],
        [66,25],[60,30],[56,28],[54,20],[52,4],[50,0],[48,-5],[44,-8],[40,-9],[36,-10],
      ]},
      { name: "Africa", coords: [
        [35,-6],[37,10],[32,12],[30,32],[22,36],[15,42],[12,44],[10,42],
        [5,42],[0,42],[-3,40],[-10,40],[-15,40],[-20,35],[-25,33],
        [-30,31],[-34,26],[-34,18],[-30,16],[-20,12],[-12,14],[-5,12],
        [0,10],[5,2],[5,-5],[10,-15],[15,-17],[20,-17],[25,-15],[30,-10],[35,-6],
      ]},
      { name: "Asia", coords: [
        [42,28],[45,40],[40,50],[35,52],[30,50],[25,55],[20,58],[15,55],
        [10,55],[8,80],[5,100],[10,105],[15,108],[22,114],[28,120],[35,120],
        [38,125],[42,130],[45,135],[50,140],[55,135],[60,140],[65,180],
        [70,180],[72,140],[70,100],[68,70],[65,60],[60,50],[55,40],[50,32],[42,28],
      ]},
      { name: "Australia", coords: [
        [-12,130],[-15,133],[-18,140],[-20,146],[-24,152],[-28,153],
        [-33,152],[-37,150],[-38,145],[-35,137],[-32,132],[-30,115],
        [-25,114],[-22,114],[-20,119],[-15,125],[-12,130],
      ]},
    ];

    return data.map(({ name, coords }) => {
      const points = coords.map(([lat, lng]) => latLngToVec3(lat, lng, R * 1.002));
      // Close the loop
      if (points.length > 2) points.push(points[0].clone());
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      return { name, geometry };
    });
  }, []);

  return (
    <group ref={ref}>
      {continents.map(({ name, geometry }) => (
        // @ts-expect-error R3F line element
        <line key={name} geometry={geometry}>
          <lineBasicMaterial color="#4a5568" transparent opacity={0.5} />
        </line>
      ))}
    </group>
  );
}

/* ─── City dots with pulsing effect ─── */
function CityDots() {
  const group = useRef<THREE.Group>(null!);
  useFrame((_, d) => { if (group.current) group.current.rotation.y += d * 0.03; });

  return (
    <group ref={group}>
      {CITIES.map(([lat, lng, name], i) => {
        const pos = latLngToVec3(lat, lng, R * 1.008);
        return (
          <group key={name + i} position={pos}>
            {/* Core dot */}
            <mesh>
              <sphereGeometry args={[0.025, 8, 8]} />
              <meshBasicMaterial color="#9fef00" />
            </mesh>
            {/* Pulse ring */}
            <mesh rotation={[Math.random() * Math.PI, 0, 0]}>
              <ringGeometry args={[0.03, 0.045, 16]} />
              <meshBasicMaterial color="#9fef00" transparent opacity={0.3} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ─── Kaspersky-style attack arc with trail glow ─── */
function AttackArc({ from, to, color, progress }: {
  from: THREE.Vector3; to: THREE.Vector3; color: string; progress: number;
}) {
  const { trailGeom, headPos } = useMemo(() => {
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const dist = from.distanceTo(to);
    mid.normalize().multiplyScalar(R + dist * 0.35);
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    const pts = curve.getPoints(80);
    const p = Math.min(progress, 1);
    const headIdx = Math.floor(pts.length * p);
    const tailIdx = Math.max(0, headIdx - 25);
    const visible = pts.slice(tailIdx, headIdx);

    return {
      trailGeom: visible.length >= 2 ? new THREE.BufferGeometry().setFromPoints(visible) : null,
      headPos: pts[Math.min(headIdx, pts.length - 1)],
    };
  }, [from, to, progress]);

  if (!trailGeom) return null;
  return (
    <group>
      {/* Main trail */}
      {/* @ts-expect-error R3F line element */}
      <line geometry={trailGeom}>
        <lineBasicMaterial color={color} transparent opacity={0.8} linewidth={2} />
      </line>
      {/* Glow trail (wider, dimmer) */}
      {/* @ts-expect-error R3F line element */}
      <line geometry={trailGeom}>
        <lineBasicMaterial color={color} transparent opacity={0.2} linewidth={4} />
      </line>
      {/* Impact head glow */}
      {headPos && progress < 1.1 && (
        <mesh position={headPos}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={Math.max(0, 1 - progress)} />
        </mesh>
      )}
    </group>
  );
}

/* ─── Impact burst at destination ─── */
function ImpactBurst({ position, color, startTime }: {
  position: THREE.Vector3; color: string; startTime: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    if (!ref.current) return;
    const elapsed = (Date.now() - startTime) / 1000;
    const scale = 1 + elapsed * 3;
    const opacity = Math.max(0, 0.6 - elapsed * 0.8);
    ref.current.scale.set(scale, scale, scale);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = opacity;
  });

  return (
    <mesh ref={ref} position={position}>
      <ringGeometry args={[0.03, 0.06, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ─── Attack System — Kaspersky-style colors ─── */
function AttackSystem() {
  const group = useRef<THREE.Group>(null!);
  const [attacks, setAttacks] = useState<{
    id: number; from: THREE.Vector3; to: THREE.Vector3;
    color: string; startTime: number;
  }[]>([]);
  const [impacts, setImpacts] = useState<{
    id: number; position: THREE.Vector3; color: string; startTime: number;
  }[]>([]);
  const nextId = useRef(0);

  // Kaspersky-style colors: magenta/pink, cyan, light blue, white-green
  const ATTACK_COLORS = ["#ff00ff", "#ff44aa", "#00d4ff", "#44eeff", "#9fef00", "#ffffff"];

  const spawn = useCallback(() => {
    const a = Math.floor(Math.random() * CITIES.length);
    let b = Math.floor(Math.random() * CITIES.length);
    while (b === a) b = Math.floor(Math.random() * CITIES.length);
    const color = ATTACK_COLORS[Math.floor(Math.random() * ATTACK_COLORS.length)];
    const now = Date.now();
    const toPos = latLngToVec3(CITIES[b][0], CITIES[b][1], R * 1.008);

    setAttacks(prev => [...prev, {
      id: nextId.current++,
      from: latLngToVec3(CITIES[a][0], CITIES[a][1], R * 1.008),
      to: toPos,
      color,
      startTime: now,
    }].slice(-20));

    // Schedule impact burst
    setTimeout(() => {
      setImpacts(prev => [...prev, {
        id: nextId.current++, position: toPos, color, startTime: Date.now(),
      }].slice(-10));
    }, 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    spawn();
    const iv = setInterval(spawn, 600);
    return () => clearInterval(iv);
  }, [spawn]);

  // Clean old impacts
  useEffect(() => {
    const iv = setInterval(() => {
      setImpacts(prev => prev.filter(i => Date.now() - i.startTime < 1200));
    }, 500);
    return () => clearInterval(iv);
  }, []);

  useFrame((_, d) => { if (group.current) group.current.rotation.y += d * 0.03; });

  return (
    <group ref={group}>
      {attacks.map(atk => {
        const elapsed = (Date.now() - atk.startTime) / 1500;
        if (elapsed > 1.5) return null;
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
      {impacts.map(imp => (
        <ImpactBurst key={imp.id} position={imp.position} color={imp.color} startTime={imp.startTime} />
      ))}
    </group>
  );
}

/* ─── Orbiting scan rings ─── */
function ScanRing({ radius, speed, opacity, tilt, color }: {
  radius: number; speed: number; opacity: number; tilt: number; color: string;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.z += d * speed; });
  return (
    <mesh ref={ref} rotation={[tilt, 0, 0]}>
      <torusGeometry args={[radius, 0.004, 8, 128]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}

/* ─── Ambient space particles ─── */
function SpaceParticles() {
  const ref = useRef<THREE.Points>(null!);
  const positions = useMemo(() => {
    const arr = new Float32Array(1200 * 3);
    for (let i = 0; i < 1200; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 35;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 35;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 35;
    }
    return arr;
  }, []);

  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * 0.005; });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.015} color="#9fef00" transparent opacity={0.25} sizeAttenuation />
    </points>
  );
}

/* ─── Main Export ─── */
export default function CyberAttackGlobe() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <Canvas
        camera={{ position: [0, 1.5, 6], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent", pointerEvents: "none" }}
      >
        <Atmosphere />
        <GlobeBody />
        <ContinentOutlines />
        <CityDots />
        <ScanRing radius={R * 1.2} speed={0.12} opacity={0.07} tilt={1.1} color="#9fef00" />
        <ScanRing radius={R * 1.35} speed={-0.08} opacity={0.04} tilt={0.7} color="#00d4ff" />
        <ScanRing radius={R * 1.5} speed={0.05} opacity={0.03} tilt={1.6} color="#ff00ff" />
        <AttackSystem />
        <SpaceParticles />
      </Canvas>
    </div>
  );
}
