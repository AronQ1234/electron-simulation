import React, { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import Plot from "react-plotly.js";
import * as THREE from "three";
import * as PH from "./physics";

/**
 * ElectronFlowSim
 * Visualizes electrons tunneling through a barrier, showing:
 * - Electrons moving left to right, hitting the barrier, and either bouncing back or passing through.
 * - If reflected, the electron bounces back and a faint "ghost" (shadow) appears on the other side.
 * - If transmitted, the electron continues right and a ghost is also left behind (higher opacity).
 * - Full right-side panel with parameters and Plotly stats.
 */
export default function ElectronFlowSim({
  voltage = 5,
  temp = 25,
  humidity = 0,
  V0_eV = 1.7,
  d_nm = 2.0,
  E_eV = 0.5,
  J_ex = 0.08,
  M_FMI = 1.0,
  particleCount = 220,
}) {
  // Geometry (nm)
  const left_nm = -2 * d_nm;
  const right_nm = 3 * d_nm;
  const barrier_start = 0;
  const barrier_end = d_nm;

  // Constants
  const KB_EV = 8.617333e-5; // Boltzmann constant in eV/K

  // Effective energy (E + voltage + temperature)
  const E_eff = useMemo(() => {
    const vBoost = 0.02 * (Number(voltage || 0) - 1);
    const tBoost = KB_EV * (Number(temp || 0));
    return Number(E_eV || 0) + vBoost + tBoost;
  }, [E_eV, voltage, temp]);

  // Humidity reduces transmission
  const humidityFactor = useMemo(() => {
    const h = Math.max(0, Math.min(100, Number(humidity || 0)));
    return 1 - (h / 100) * 0.3;
  }, [humidity]);

  // Transmission probabilities (apply humidity factor)
  const Tvals = useMemo(() => {
    let tUp = 1e-12, tDown = 1e-12;
    try {
      if (typeof PH.calculateTunnelingProbabilitiesWKB === "function") {
        const res = PH.calculateTunnelingProbabilitiesWKB(V0_eV, E_eff, d_nm, J_ex, M_FMI);
        tUp = Number(res.T_up ?? res.Tup ?? 0);
        tDown = Number(res.T_down ?? res.Tdown ?? 0);
      } else {
        const DeltaE = typeof PH.spinSplitting === "function" ? PH.spinSplitting(J_ex, M_FMI) : J_ex * M_FMI;
        const V_up = V0_eV - DeltaE / 2.0;
        const V_down = V0_eV + DeltaE / 2.0;
        const d_m = d_nm * 1e-9;
        tUp = PH.wkbTunneling ? PH.wkbTunneling(V_up, d_m, E_eff) : 1e-12;
        tDown = PH.wkbTunneling ? PH.wkbTunneling(V_down, d_m, E_eff) : 1e-12;
      }
    } catch (err) {
      console.warn("Tvals calc failed:", err);
    }
    tUp = Math.max(0, Math.min(1, tUp * humidityFactor));
    tDown = Math.max(0, Math.min(1, tDown * humidityFactor));
    return { T_up: tUp, T_down: tDown };
  }, [V0_eV, d_nm, E_eff, J_ex, M_FMI, humidityFactor]);

  // Particles (ref for high-rate updates)
  const particlesRef = useRef(
    new Array(particleCount).fill(0).map((_, i) => {
      const spin = Math.random() < 0.5 ? "up" : "down";
      const z = (Math.random() - 0.5) * 1.2;
      const x = left_nm + Math.random() * (Math.abs(left_nm) * 0.25);
      return { id: i, x, z, spin, decided: false, transmitted: false, speed: 0.4 + Math.random() * 0.8 };
    })
  );
  // Ghosts (shadows)
  const ghostsRef = useRef([]);

  // Counts for UI
  const [counts, setCounts] = useState({ transmitted: 0, reflected: 0, total: particleCount });
  const [running, setRunning] = useState(true);

  // Reset function
  function resetSim() {
    particlesRef.current = new Array(particleCount).fill(0).map((_, i) => {
      const spin = Math.random() < 0.5 ? "up" : "down";
      const z = (Math.random() - 0.5) * 1.2;
      const x = left_nm + Math.random() * (Math.abs(left_nm) * 0.25);
      return { id: i, x, z, spin, decided: false, transmitted: false, speed: 0.4 + Math.random() * 0.8 };
    });
    ghostsRef.current = [];
    setCounts({ transmitted: 0, reflected: 0, total: particleCount });
  }

  // Particle controller: updates positions, handles barrier logic, spawns ghosts
  function ParticlesController() {
    useFrame((state, delta) => {
      if (!running) return;
      const arr = particlesRef.current;
      const ghosts = ghostsRef.current;
      const vMultiplier = 1 + 0.12 * Math.max(0, voltage - 1);
      const tScatter = 1 + (Math.max(0, temp - 25) / 200);

      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];
        let x = p.x + p.speed * delta * 50 * vMultiplier / tScatter;
        let decided = p.decided;
        let transmitted = p.transmitted;

        // Barrier decision
        if (!decided && p.x < barrier_start && x >= barrier_start) {
          const prob = p.spin === "up" ? Tvals.T_up : Tvals.T_down;
          const roll = Math.random();
          decided = true;
          if (roll < prob) {
            transmitted = true;
            // Spawn a ghost on the right (high opacity)
            ghosts.push({
              id: `g-${Date.now()}-${i}`,
              x: barrier_end + Math.random() * 0.1 * d_nm,
              z: p.z + (Math.random() - 0.5) * 0.1,
              life: 1.0,
              color: p.spin === "up" ? new THREE.Color(0x4ea8ff) : new THREE.Color(0xff6b6b),
              opacity: 0.45 + 0.3 * prob, // higher for high prob
            });
          } else {
            transmitted = false;
            // Reflect: bounce back and spawn a faint ghost on the right (low opacity)
            x = barrier_start - (x - barrier_start) - 0.5;
            p.speed = -Math.abs(p.speed) * 0.6;
            ghosts.push({
              id: `g-${Date.now()}-${i}`,
              x: barrier_end + Math.random() * 0.1 * d_nm,
              z: p.z + (Math.random() - 0.5) * 0.1,
              life: 1.0,
              color: p.spin === "up" ? new THREE.Color(0x4ea8ff) : new THREE.Color(0xff6b6b),
              opacity: 0.08 + 0.18 * prob, // lower for low prob
            });
          }
        }

        // Respawn if far right
        if (x > right_nm + 1.0) {
          const spin = Math.random() < 0.5 ? "up" : "down";
          arr[i] = {
            ...p,
            x: left_nm + Math.random() * (Math.abs(left_nm) * 0.25),
            z: (Math.random() - 0.5) * 1.2,
            spin,
            decided: false,
            transmitted: false,
            speed: 0.4 + Math.random() * 0.8,
          };
          continue;
        }

        // Respawn if far left
        if (x < left_nm - 1.0) {
          const spin = Math.random() < 0.5 ? "up" : "down";
          arr[i] = {
            ...p,
            x: left_nm + Math.random() * (Math.abs(left_nm) * 0.25),
            z: (Math.random() - 0.5) * 1.2,
            spin,
            decided: false,
            transmitted: false,
            speed: 0.4 + Math.random() * 0.8,
          };
          continue;
        }

        // Commit updates
        arr[i].x = x;
        arr[i].decided = decided;
        arr[i].transmitted = transmitted;
      }

      // Update ghosts (fade and move right)
      for (let g = ghosts.length - 1; g >= 0; g--) {
        ghosts[g].life -= delta * 0.6;
        ghosts[g].x += 0.02 * delta * 50;
        if (ghosts[g].life <= 0) ghosts.splice(g, 1);
      }

      // Update counts
      const transmittedCount = arr.reduce((acc, p) => acc + ((p.transmitted || p.x > barrier_end) ? 1 : 0), 0);
      const reflectedCount = arr.reduce((acc, p) => acc + ((p.decided && !p.transmitted && p.x < barrier_start) ? 1 : 0), 0);
      setCounts({ transmitted: transmittedCount, reflected: reflectedCount, total: arr.length });
    });

    return null;
  }

  // ParticlesMesh: updates instanced meshes each frame using particlesRef
  function ParticlesMesh() {
    const upRef = useRef();
    const downRef = useRef();

    useFrame(() => {
      const arr = particlesRef.current;
      const upParticles = arr.filter((p) => p.spin === "up");
      const downParticles = arr.filter((p) => p.spin === "down");

      if (upRef.current) {
        upRef.current.count = Math.max(1, upParticles.length);
        for (let i = 0; i < upParticles.length; i++) {
          const p = upParticles[i];
          const matrix = new THREE.Matrix4();
          const pos = new THREE.Vector3(p.x * 1e-9, 0.02 + p.z * 0.02, 0);
          const scale = new THREE.Vector3(0.015, 0.015, 0.015);
          matrix.compose(pos, new THREE.Quaternion(), scale);
          upRef.current.setMatrixAt(i, matrix);
        }
        upRef.current.instanceMatrix.needsUpdate = true;
      }

      if (downRef.current) {
        downRef.current.count = Math.max(1, downParticles.length);
        for (let i = 0; i < downParticles.length; i++) {
          const p = downParticles[i];
          const matrix = new THREE.Matrix4();
          const pos = new THREE.Vector3(p.x * 1e-9, 0.02 + p.z * 0.02, 0);
          const scale = new THREE.Vector3(0.015, 0.015, 0.015);
          matrix.compose(pos, new THREE.Quaternion(), scale);
          downRef.current.setMatrixAt(i, matrix);
        }
        downRef.current.instanceMatrix.needsUpdate = true;
      }
    });

    return (
      <group>
        <instancedMesh ref={upRef} args={[null, null, Math.max(1, particleCount)]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color={"#4ea8ff"} />
        </instancedMesh>
        <instancedMesh ref={downRef} args={[null, null, Math.max(1, particleCount)]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color={"#ff6b6b"} />
        </instancedMesh>
      </group>
    );
  }

  // Ghosts (shadows) as faded spheres
  function Ghosts() {
    const ghosts = ghostsRef.current;
    return ghosts.map((g) => {
      const pos = new THREE.Vector3(g.x * 1e-9, 0.03 + g.z * 0.02, 0);
      const a = Math.max(0.05, Math.min(g.opacity, g.life));
      return (
        <mesh key={g.id} position={[pos.x, pos.y, pos.z]}>
          <sphereGeometry args={[0.02, 12, 12]} />
          <meshStandardMaterial color={g.color} transparent opacity={a} />
        </mesh>
      );
    });
  }

  // Plotly data
  const plotData = [
    { x: ["Transmitted", "Reflected"], y: [counts.transmitted, counts.reflected], type: "bar", marker: { color: ["#4ea8ff", "#ff6b6b"] } },
  ];
  const plotLayout = { margin: { t: 10, l: 30, r: 10 }, height: 160, yaxis: { title: "count" } };

  // Scene geometry metrics
  const barrierWidth_m = d_nm * 1e-9;
  const sceneWidth_m = (right_nm - left_nm) * 1e-9;
  const barrierCenterX_m = (barrier_start + barrier_end) / 2.0 * 1e-9;

  return (
    <div className="flex flex-row gap-3 h-full">
      <div className="flex-1 bg-slate-900 rounded-md p-2 h-140">
        <Canvas camera={{ position: [barrierCenterX_m + 0.0000005, 0.12, 0.0015], fov: 50 }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[0.001, 0.05, 0.05]} intensity={0.8} />

          {/* floor */}
          <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]}>
            <planeGeometry args={[sceneWidth_m * 1.4, 0.004]} />
            <meshStandardMaterial color={"#020617"} />
          </mesh>

          {/* barrier */}
          <mesh position={[barrierCenterX_m, 0.03, 0]} castShadow receiveShadow>
            <boxGeometry args={[barrierWidth_m, 0.06, 0.2 * barrierWidth_m + 0.02]} />
            <meshStandardMaterial color={"#888"} transparent opacity={0.9} />
          </mesh>

          {/* controller and mesh */}
          <ParticlesController />
          <ParticlesMesh />
          <Ghosts />

          {/* HUD overlay */}
          {/* <Html position={[-sceneWidth_m / 2 + 0.0006, 0.09, 0]} occlude={false}>
            <div className="bg-white/90 text-black text-xs rounded-md p-2 shadow-md" style={{ width: 220 }}>
              <div className="font-semibold text-sm">Electron Flow</div>
              <div className="text-xs mt-1">Particles: {counts.total}</div>
              <div className="text-xs">Transmitted: {counts.transmitted}</div>
              <div className="text-xs">Reflected: {counts.reflected}</div>
              <div className="mt-2 text-xs">T↑: {Tvals.T_up !== undefined ? (Tvals.T_up).toExponential(2) : "n/a"}</div>
              <div className="text-xs">T↓: {Tvals.T_down !== undefined ? (Tvals.T_down).toExponential(2) : "n/a"}</div>
            </div>
          </Html> */}
        </Canvas>
      </div>

      {/* Right: stats */}
      <div className="w-72 shrink-0">
        <div className="bg-white rounded-md p-3 shadow">
          <div className="font-semibold text-sm mb-2">Transmission Summary</div>
          <div className="text-xs text-slate-600 mb-2">Parameters</div>
          <ul className="text-xs">
            <li>V₀: {V0_eV.toFixed(3)} eV</li>
            <li>d: {d_nm.toFixed(3)} nm</li>
            <li>E_base: {E_eV.toFixed(4)} eV</li>
            <li>E_eff: {E_eff.toFixed(6)} eV</li>
            <li>voltage: {voltage} V</li>
            <li>temp: {temp} °C</li>
            <li>humidity: {humidity}%</li>
          </ul>
          <div className="mt-3">
            <Plot data={plotData} layout={plotLayout} config={{ displayModeBar: false }} style={{ width: "100%" }} />
          </div>
          <div className="mt-2 text-xs">
            <div>Estimated T↑: {typeof Tvals.T_up === "number" ? Tvals.T_up.toExponential(2) : String(Tvals.T_up)}</div>
            <div>Estimated T↓: {typeof Tvals.T_down === "number" ? Tvals.T_down.toExponential(2) : String(Tvals.T_down)}</div>
            <div className="mt-2">Transmitted %: {counts.total ? Math.round((counts.transmitted / counts.total) * 100) : 0}%</div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setRunning((r) => !r)} className="px-2 py-1 bg-slate-900 text-white rounded text-xs">
                {running ? "Pause" : "Resume"}
              </button>
              <button onClick={resetSim} className="px-2 py-1 bg-slate-900 text-white rounded text-xs">
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}