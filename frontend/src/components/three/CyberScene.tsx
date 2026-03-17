"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function Particles({ count = 500 }: { count?: number }) {
  const mesh = useRef<THREE.Points>(null!);
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return pos;
  }, [count]);

  useFrame((_, delta) => {
    if (mesh.current) {
      mesh.current.rotation.y += delta * 0.02;
      mesh.current.rotation.x += delta * 0.01;
    }
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color="#9fef00"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

function NetworkLines() {
  const linesRef = useRef<THREE.LineSegments>(null!);
  const { positions, colors } = useMemo(() => {
    const nodeCount = 40;
    const nodes: THREE.Vector3[] = [];
    for (let i = 0; i < nodeCount; i++) {
      nodes.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8
        )
      );
    }
    const pos: number[] = [];
    const cols: number[] = [];
    const neon = new THREE.Color("#9fef00");
    const cyan = new THREE.Color("#00d4ff");
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const dist = nodes[i].distanceTo(nodes[j]);
        if (dist < 3) {
          pos.push(nodes[i].x, nodes[i].y, nodes[i].z);
          pos.push(nodes[j].x, nodes[j].y, nodes[j].z);
          const c = dist < 1.5 ? neon : cyan;
          cols.push(c.r, c.g, c.b);
          cols.push(c.r, c.g, c.b);
        }
      }
    }
    return {
      positions: new Float32Array(pos),
      colors: new Float32Array(cols),
    };
  }, []);

  useFrame((_, delta) => {
    if (linesRef.current) {
      linesRef.current.rotation.y += delta * 0.03;
    }
  });

  return (
    <lineSegments ref={linesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.3} />
    </lineSegments>
  );
}

function Globe() {
  const globeRef = useRef<THREE.Mesh>(null!);

  useFrame((_, delta) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <mesh ref={globeRef}>
      <sphereGeometry args={[2.5, 48, 48]} />
      <meshBasicMaterial color="#9fef00" wireframe transparent opacity={0.08} />
    </mesh>
  );
}

export default function CyberScene() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.5} />
        <Globe />
        <Particles count={600} />
        <NetworkLines />
      </Canvas>
    </div>
  );
}
