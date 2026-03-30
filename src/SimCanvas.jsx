// src/SimCanvas.jsx
import React, { forwardRef, useImperativeHandle, useRef, useState, useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import Plot from "react-plotly.js";
import * as PH from "./physics"; // your physics helper module
import ElectronFlowSim from "./ElectronFlowSim";

/* ---------- SSD visual (Tab 1) ---------- */
function SsdModule({ parts = [], modelName = "SSD Module" }) {
  const length = 11.5;
  const width = 2.2;
  const thickness = 0.12;

  const nand = parts.find((p) => p.key === "NAND") || { name: "3D NAND dies", lowp: 2.5, highp: 25, color: 0x222831 };
  const ctrl = parts.find((p) => p.key === "CONTROLLER") || { name: "Controller", lowp: 5, highp: 30, color: 0xffb86b };

  const count = 6;
  const xs = Array.from({ length: count }, (_, i) => -length / 2 + 1.0 + (i / (count - 1)) * (length - 2.0));

  return (
    <group>
      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.6, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#050609" />
      </mesh>

      {/* PCB */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[length, thickness, width]} />
        <meshStandardMaterial color={0x0b3140} metalness={0.2} roughness={0.6} />
      </mesh>

      {/* NAND dies */}
      <group position={[0, thickness / 2 + 0.06, 0]}>
        {xs.map((x, i) => (
          <group key={i} position={[x, 0, 0]}>
            <mesh>
              <boxGeometry args={[0.9, 0.12, 1.3]} />
              <meshStandardMaterial color={nand.color || 0x222831} metalness={0.25} roughness={0.4} />
            </mesh>
            <Html position={[0, 0.16, 0]} center>
              <div className="bg-white rounded-md px-2 py-1 shadow-sm text-xs font-semibold border">
                {nand.name} {i + 1}
              </div>
            </Html>
          </group>
        ))}
      </group>

      {/* controller */}
      <group position={[length / 2 - 1.2, thickness / 2 + 0.02, 0]}>
        <mesh>
          <boxGeometry args={[1.1, 0.08, 0.9]} />
          <meshStandardMaterial color={ctrl.color || 0xffb86b} metalness={0.35} roughness={0.45} />
        </mesh>
        <Html position={[0, 0.08, 0]} center>
          <div className="bg-white rounded-md px-2 py-1 shadow-sm text-xs font-semibold border">
            {ctrl.name}
            <div className="text-xs text-slate-500 mt-1">${(ctrl.lowp || 0).toFixed(2)} - ${(ctrl.highp || 0).toFixed(2)}</div>
          </div>
        </Html>
      </group>

      <Html position={[0, 0.9, 0]} center>
        <div className="bg-slate-900 text-white px-3 py-1 rounded-md font-semibold">{modelName} — Parts overview</div>
      </Html>
    </group>
  );
}
function getSpinEnergies(E_eV, J_ex, M_FMI) {
  if (typeof PH.spinEnergies === "function") return PH.spinEnergies(E_eV, J_ex, M_FMI);
  if (typeof PH.getSpinEnergies === "function") return PH.getSpinEnergies(E_eV, J_ex, M_FMI);
  // fallback using getSpinSplitting
  const DeltaE = getSpinSplitting(J_ex, M_FMI);
  return { up: E_eV + DeltaE / 2.0, down: E_eV - DeltaE / 2.0 };
}
function wkbTunneling(V0_eV, d_m, E_eV) {
  if (typeof PH.wkbTunneling === "function") return PH.wkbTunneling(V0_eV, d_m, E_eV);
  // fallback simple: return small value when below barrier else 1
  try {
    const V0J = (V0_eV || 0) * 1.60217662e-19;
    const EJ = (E_eV || 0) * 1.60217662e-19;
    if (E_eV >= V0_eV) return 1.0;
  } catch (e) { /* ignore */ }
  return 1e-20;
}
function calcWavefunction(x_m, V0_J, E_J, d_m) {
  if (typeof PH.calculateWavefunction === "function") return PH.calculateWavefunction(x_m, V0_J, E_J, d_m);
  // fallback: return zeros
  return { prob: new Array(x_m.length).fill(0) };
}
/* ---------- Utility functions ---------- */
function safeNum(x, fallback = 0) {
  return Number.isFinite(x) ? x : fallback;
}
function makeRange(start, end, step) {
  const s = Math.min(start, end);
  const e = Math.max(start, end);
  const arr = [];
  for (let v = s; v <= e + 1e-12; v += step) arr.push(+v.toFixed(8));
  if (arr.length === 0) arr.push(+s.toFixed(8), +(s + step).toFixed(8));
  return arr;
}

/* ---------- Barrier visual + plots (Tab 2) ---------- */
function BarrierPlots({ 
  modelKey, 
  V0_eV = (modelKey === "our" ?PH.OUR_MODEL_DEFAULTS.V0_eV : PH.CURRENT_MARKET_DEFAULTS.V0_eV), 
  d_nm=(modelKey === "our" ?PH.OUR_MODEL_DEFAULTS.d_nm : PH.CURRENT_MARKET_DEFAULTS.d_nm), 
  E_eV = (modelKey === "our" ?PH.OUR_MODEL_DEFAULTS.E_eV : PH.CURRENT_MARKET_DEFAULTS.E_eV), 
  J_ex = (modelKey === "our" ?PH.OUR_MODEL_DEFAULTS.J_ex : PH.CURRENT_MARKET_DEFAULTS.J_ex), 
  M_FMI = (modelKey === "our" ?PH.OUR_MODEL_DEFAULTS.M_FMI : PH.CURRENT_MARKET_DEFAULTS.M_FMI) 
}) {
  // defensive conversions & small constants
  const spacing = 0.025;
  const E_MIN = 0.1;
  console.log(d_nm*1e-9);
  const d_m = safeNum(d_nm * 1e-9, 1e-9);
  console.log(d_m);
  const V0safe = safeNum(V0_eV, 1.0);

  // spin splitting and effective barriers (robust)
  const DeltaE = safeNum(PH.getSpinSplitting(J_ex, M_FMI), 0.0);
  // const DeltaE = safeNum(PH.getSpinSplitting(), 0.0);
  const V_eff_up = safeNum(V0safe - DeltaE / 2.0, V0safe);
  const V_eff_down = safeNum(V0safe + DeltaE / 2.0, V0safe);

  const E_upper_up = Math.min(V0safe + PH.E_MAX_OFFSET, V_eff_up);
  const E_upper_down = Math.min(V0safe + PH.E_MAX_OFFSET, V_eff_down);

  const energiesUp = makeRange(E_MIN, E_upper_up + spacing/2, spacing);
  const energiesDown = makeRange(E_MIN,E_upper_down +spacing/2, spacing);

  // WKB transmissions
  // const T_up_arr = energiesUp.map((e) => {
  //   const v = wkbTunneling(V_eff_up, d_m, e);
  //   return safeNum(v, 1e-20);
  // });
  const T_up_arr = energiesUp.map((e) => {
    // If energy is greater than or equal to the barrier, it's perfect transmission
    if (e >= V_eff_up) {
      return 1.0;
    }
    
    // Otherwise, calculate the tunneling probability
    return wkbTunneling(V_eff_up, d_m, e);
  });

  // const T_down_arr = energiesDown.map((e) => {
  //   const v = wkbTunneling(V_eff_down, d_m, e);
  //   return safeNum(v, 1e-20);
  // });
  const T_down_arr = energiesDown.map((e) => {
    if (e >= V_eff_down) {
      return 1.0;
    }
    return wkbTunneling(V_eff_down, d_m, e);
  });

  // ensure non-empty valid arrays for Plotly
  const anyValidTrans = T_up_arr.some(Number.isFinite) || T_down_arr.some(Number.isFinite);
  if (!anyValidTrans) {
    energiesUp.splice(0, energiesUp.length, E_MIN, E_MIN + spacing);
    T_up_arr.splice(0, T_up_arr.length, 1e-20, 2e-20);
    energiesDown.splice(0, energiesDown.length, E_MIN, E_MIN + spacing);
    T_down_arr.splice(0, T_down_arr.length, 1e-20, 2e-20);
  }

  // compute transmissions at the current energy (used for annotation)
  const T_up_at_E = safeNum(wkbTunneling(V_eff_up, d_m, E_eV), 1e-20);
  const T_down_at_E = safeNum(wkbTunneling(V_eff_down, d_m, E_eV), 1e-20);
  const V_eff_up_safe = safeNum(V_eff_up, E_MIN);
  const V_eff_down_safe = safeNum(V_eff_down, E_MIN);
  const E_eV_safe = safeNum(E_eV, E_MIN);

  const transTraces = [
    {
      x: energiesUp,
      y: T_up_arr,
      mode: "lines",
      name: "Spin-up (↓)",
      line: { color: "blue", width: 2.5 },
      hovertemplate: "<b>Spin-up (↓)</b><br>E = %{x:.3f} eV<br>T = %{y:.3e}<extra></extra>",
    },
    {
      x: energiesDown,
      y: T_down_arr,
      mode: "lines",
      name: "Spin-down (↑)",
      line: { color: "red", width: 2.5 },
      hovertemplate: "<b>Spin-down (↑)</b><br>E = %{x:.3f} eV<br>T = %{y:.3e}<extra></extra>",
    },
  ];

  const transLayout = {
    title:{text: "<b>Transmission probability vs. electron energy</b>"},
    xaxis: { title: { text: "Electron energy E (eV)", font: { family: 'Times New Roman', size: 12 } }},
    yaxis: {
      title: {text: "Transmission probability T", font: { family: 'Times New Roman', size: 12 }},
      type: "log",
      exponentformat: "e",
      showexponent: "all",
      range: [-10, Math.log10(2)],
    },
    hovermode: 'x unified',
    showlegend: true,
    legend: { x: 0.02, y: 0.98, bgcolor: "rgba(255,255,255,0.8)" },
    // height: 500,
    margin: { t: 48 },
    template: "plotly_white",
    font: { family: 'Times New Roman', size: 16 },
    shapes: [
      { type: "line", x0: V_eff_up_safe, x1: V_eff_up_safe, y0: 0, y1: 1, yref: 'paper', line: { dash: "dash", color: "blue", width: 1 } },
      { type: "line", x0: V_eff_down_safe, x1: V_eff_down_safe, y0: 0, y1: 1, yref: 'paper', line: { dash: "dash", color: "red", width: 1 } },
      { type: "line", x0: E_eV_safe, x1: E_eV_safe, y0: 0, y1: 1, yref: 'paper', line: { dash: "dot", color: "green", width: 2 } },
    ],
    annotations: [
      {
        x: E_eV_safe, y: 1.02, text: "Reference energy",
        showarrow: false, font: { color: 'green', size: 12, family: 'Times New Roman' },
        yref: 'paper', xanchor: 'center', xshift: 46
      },
      {
        x: V_eff_up_safe, y: 1.02, text: `<i>V</i><sub>eff</sub><sub>↓</sub> = ${V_eff_up_safe.toFixed(3)} eV`,
        showarrow: false, font: { color: 'blue', size: 12, family: 'Times New Roman' },
        yref: 'paper', xanchor: 'left', xshift: 12
      },
      {
        x: V_eff_down_safe, y: 1.02, text: `<i>V</i><sub>eff</sub><sub>↑</sub> = ${V_eff_down_safe.toFixed(3)} eV`,
        showarrow: false, font: { color: 'red', size: 12, family: 'Times New Roman' },
        yref: 'paper', xanchor: 'right', xshift: -13
      },
      {
        x: E_eV_safe, y: 0.12,
        text: `<i>E</i> = ${E_eV_safe.toFixed(3)} eV<br><i>T</i><sub>↓</sub> = ${T_up_at_E.toExponential(3)}<br><i>T</i><sub>↑</sub> = ${T_down_at_E.toExponential(3)}`,
        showarrow: false, font: { color: 'black', size: 12, family: 'Times New Roman' },
        yref: 'paper', xanchor: 'center', xshift: -42, yshift: -30
      }
    ]
  };

  // Wavefunction (transfer-matrix exact)
  const Npts = 2000;
  const x_nm = new Array(Npts);
  const x_start = -2 * d_nm;
  const x_end = 3 * d_nm;
  for (let i = 0; i < Npts; i++) x_nm[i] = x_start + (i / (Npts - 1)) * (x_end - x_start);
  const x_m = x_nm.map((xx) => xx * 1e-9);

  const V0_J = safeNum(V0safe * 1.60217662e-19, 1.0 * 1.60217662e-19);
  const Espin = getSpinEnergies(E_eV, J_ex, M_FMI);

  let probUp = new Array(Npts).fill(0);
  let probDown = new Array(Npts).fill(0);
  try {
    const upRes = calcWavefunction(x_m, V0_J, Espin.up * 1.60217662e-19, d_m);
    const downRes = calcWavefunction(x_m, V0_J, Espin.down * 1.60217662e-19, d_m);
    if (upRes && Array.isArray(upRes.prob)) probUp = upRes.prob.map((v) => safeNum(v, 0));
    else if (Array.isArray(upRes)) probUp = upRes.map((v) => safeNum(v, 0));
    if (downRes && Array.isArray(downRes.prob)) probDown = downRes.prob.map((v) => safeNum(v, 0));
    else if (Array.isArray(downRes)) probDown = downRes.map((v) => safeNum(v, 0));
  } catch (err) {
    // If transfer-matrix fails, keep zeros (plotly will still render)
    console.warn("calculateWavefunction failed:", err);
  }

  const maxProb = Math.max(1e-12, ...probUp, ...probDown);
  const barrier_scale = maxProb * 0.3;
  const Vbar = x_nm.map((xx) => (xx >= 0 && xx <= d_nm ? V0safe : 0));
  const barrierScaled = Vbar.map((v) => (v * barrier_scale) / (V0safe || 1e-12));

  const waveTraces = [
    { x: x_nm, y: probUp, mode: "lines", name: "|ψ↑|² (Spin up)", line: { color: "blue", width: 2 } },
    { x: x_nm, y: probDown, mode: "lines", name: "|ψ↓|² (Spin down)", line: { color: "red", width: 2 } },
    { x: x_nm, y: barrierScaled, mode: "lines", name: "barrier (scaled)", fill: "tozeroy", line: { color: "gray", width: 2 }, yaxis: 'y2' },
  ];

  const waveLayout = {
    title:{text: "Electron wavefunction probability density (FMI exchange coupling)"},
    xaxis: { title: { text: "Position (nm)", font: { family: 'Times New Roman', size: 12 } }},
    yaxis: { title: {text: "Probability density |ψ|²", font: { family: 'Times New Roman', size: 14 } }},
    yaxis2: { title: {text: "Potential (scaled)", font: { family: 'Times New Roman', size: 12 } }, overlaying: "y", side: "right", showgrid: false},
    // height: 500,
    showlegend: true,
    margin: { t: 48 },
    shapes: [
      { type: "line", x0: 0, x1: 0, y0: 0, y1: maxProb * 1.05, line: { dash: "dot", color: "black" } },
      { type: "line", x0: d_nm, x1: d_nm, y0: 0, y1: maxProb * 1.05, line: { dash: "dot", color: "black" } },
    ],
  };

  return (
    <div className="flex flex-col gap-3 w-full h-full">
      <div className="w-full h-75 sm:h-95 lg:h-105">
        <Plot data={transTraces} layout={transLayout} config={{ responsive: true }} useResizeHandler={true} className="w-full h-full" />
      </div>

      <div className="w-full h-75 sm:h-95 lg:h-105">
        <Plot data={waveTraces} layout={waveLayout} config={{ responsive: true }} useResizeHandler={true} className="w-full h-full" />
      </div>
    </div>
  );
}

/* ---------- SimCanvas wrapper ---------- */
const SimCanvas = forwardRef(({voltage, parameter, tab, modelKey, parts, V0, d_nm, E_eV, J_ex, M_FMI, spinUP, setSpinUP, particleCount, effectiveElectronMassMultiplier, isFullScreen, enterFullscreen, exitFullscreen, setModelKey }, ref) => {
  useImperativeHandle(ref, () => ({
    reset: () => {},
    downloadCSV: () => {},
  }));

  const color = modelKey === "our" ? 0x00bfff : 0xff6b3b;
  const modelName = modelKey === "our" ? "Our SSD" : "Market SSD";

  return (
    <div className="w-full h-full">
      {tab === 1 ? (
        <Canvas dpr={[1, 1.5]} gl={{ antialias: false }} style={{ width: "100%", height: "100%" }} camera={{ position: [0, 2.2, 9], fov: 45 }}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[10, 10, 5]} intensity={0.8} />
          <SsdModule parts={parts} modelName={modelName} />
          <OrbitControls
            enableDamping
            enablePan={true}
            maxPolarAngle={Math.PI / 2}
            // minDistance={4}
            // maxDistance={15}
          />
        </Canvas>
      ) : tab === 2 ? (

        <div className="w-full h-full p-2 md:p-4">
          <BarrierPlots
            key={`${modelKey}-${V0}-${d_nm}-${E_eV}`} 
            V0_eV={V0}
            d_nm={d_nm}
            E_eV={E_eV}
            J_ex={J_ex}
            M_FMI={M_FMI}
          />
        </div>
      ) : (
        <div className="w-full h-full p-2">
            {/* small orbit disabled or keep controls if you want */}
            <ElectronFlowSim
              voltage={voltage}
              // temp={temperature}
              setModelKey={setModelKey}
              modelKey={modelKey}
              parameter={parameter}
              V0_eV={V0}
              d_nm={d_nm}
              E_eV={E_eV}
              J_ex={J_ex}
              M_FMI={M_FMI}
              particleCount={particleCount}
              spinUp={spinUP}
              setSpinUp={setSpinUP}
              effectiveElectronMassMultiplier={effectiveElectronMassMultiplier}
              isFullScreen = {isFullScreen}
                                  enterFullscreen={enterFullscreen}
                    exitFullscreen={exitFullscreen}
            />
        </div>
      )}
    </div>
  );
});

export default SimCanvas;
