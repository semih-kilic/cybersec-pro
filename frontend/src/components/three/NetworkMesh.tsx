"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ─── Data packets flowing along edges ─── */
function DataPacket({ curve, speed, color }: {
  curve: THREE.CubicBezierCurve3; speed: number; color: string;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  const t = useRef(Math.random());

  useFrame((_, d) => {
    t.current = (t.current + d * speed) % 1;
    if (ref.current) {
      const pos = curve.getPoint(t.current);
      ref.current.position.copy(pos);
    }
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.04, 6, 6]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

/* ─── Network Nodes + Edges ─── */
function NetworkGraph() {
  const groupRef = useRef<THREE.Group>(null!);

  const { nodes, edges, lines, curves } = useMemo(() => {
    const nodeCount = 60;
    const ns: THREE.Vector3[] = [];
    for (let i = 0; i < nodeCount; i++) {
      ns.push(new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 6,
      ));
    }

    const es: [number, number][] = [];
    const linePositions: number[] = [];
    const lineColors: number[] = [];
    const cs: THREE.CubicBezierCurve3[] = [];

    const neon = new THREE.Color("#9fef00");
    const cyan = new THREE.Color("#00d4ff");
    const magenta = new THREE.Color("#ff00ff");
    const palette = [neon, cyan, magenta];

    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const dist = ns[i].distanceTo(ns[j]);
        if (dist < 3.5) {
          es.push([i, j]);
          linePositions.push(ns[i].x, ns[i].y, ns[i].z);
          linePositions.push(ns[j].x, ns[j].y, ns[j].z);
          const c = palette[Math.floor(Math.random() * palette.length)];
          lineColors.push(c.r, c.g, c.b);
          lineColors.push(c.r, c.g, c.b);

          // Create bezier curves for data packets (only some edges)
          if (Math.random() < 0.3) {
            const mid1 = ns[i].clone().lerp(ns[j], 0.33);
            mid1.y += (Math.random() - 0.5) * 0.5;
            const mid2 = ns[i].clone().lerp(ns[j], 0.66);
            mid2.y += (Math.random() - 0.5) * 0.5;
            cs.push(new THREE.CubicBezierCurve3(ns[i], mid1, mid2, ns[j]));
          }
        }
      }
    }

    return {
      nodes: ns,
      edges: es,
      lines: { positions: new Float32Array(linePositions), colors: new Float32Array(lineColors) },
      curves: cs,
    };
  }, []);

  useFrame((_, d) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += d * 0.02;
      groupRef.current.rotation.x += d * 0.005;
    }
  });

  const packetColors = ["#9fef00", "#00d4ff", "#ff00ff", "#ff6600", "#ffcc00"];

  return (
    <group ref={groupRef}>
      {/* Edges */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[lines.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[lines.colors, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.15} />
      </lineSegments>

      {/* Nodes */}
      {nodes.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color={i < 5 ? "#ff3333" : i < 15 ? "#9fef00" : "#00d4ff"} transparent opacity={0.6} />
        </mesh>
      ))}

      {/* Data packets */}
      {curves.map((curve, i) => (
        <DataPacket
          key={i}
          curve={curve}
          speed={0.2 + Math.random() * 0.3}
          color={packetColors[i % packetColors.length]}
        />
      ))}
    </group>
  );
}

/* ─── Main Export ─── */
export default function NetworkMesh() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <Canvas camera={{ position: [0, 0, 10], fov: 55 }} gl={{ antialias: true, alpha: true }} style={{ background: "transparent" }}>
        <ambientLight intensity={0.3} />
        <NetworkGraph />
      </Canvas>
    </div>
  );
}
