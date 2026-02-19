// src/App.jsx
import React, { useState, useRef, useEffect } from "react";
import Tabs from "./Tabs";
import SimCanvas from "./SimCanvas";
import "./styles.css";
import SideControlPanel from "./SideControlPanel";
import * as PH from "./physics";

const CHIP_MODELS = {
  our: { key: "our", name: "Our SSD", cost: 12.5, fragility: 0.8 },
  market: { key: "market", name: "Current SSD", cost: 9.0, fragility: 1.0 },
};

const PARTS = [
  { key: "NAND", name: "3D NAND Dies", lowp: 2.5, highp: 25.0, color: 0x28323a, explonation: "The core storage medium where data is stored as charge in floating gate transistors. The quality and design of the NAND flash cells directly impact the SSD's performance, endurance, and reliability." },
  { key: "CONTROLLER", name: "NVMe Controller", lowp: 5.0, highp: 40.0, color: 0xffb86b, explonation: "The brain of the SSD that manages data flow, error correction, wear leveling, and communication with the host system. A more advanced controller can significantly enhance performance and durability." },
  { key: "DRAM_CACHE", name: "DRAM (Cache)", lowp: 1.0, highp: 12.0, color: 0x7bd389, explonation: "Used as a cache to speed up data access and improve performance. Higher quality DRAM can reduce latency and increase the lifespan of the SSD by minimizing direct writes to NAND." },
  { key: "PCB", name: "M.2 PCB + Connector", lowp: 0.5, highp: 10.0, color: 0x2b7fdb, explonation: "The printed circuit board that holds the SSD components together and provides the connection to the host system. The quality of the PCB affects signal integrity and thermal management." },
  { key: "HEAT", name: "Heatsink / Shield", lowp: 0.5, highp: 20.0, color: 0x9aa7b2, explonation: "Provides thermal management to keep the SSD operating within safe temperature ranges. A better heatsink can improve performance and longevity." },
];


function calculateEoffEv(temperatureC, alpha = 1.0) {
  const T =  temperatureC + 273.15;
  return alpha * PH.KB_EV * T;
}

// E_off in eV, V0 in eV, d_nm in nm
function computeLeakageWKB(V0_eV, d_nm, E_off_eV, J_ex, M_FMI) {
  const d_m = d_nm * 1e-9;
  const DeltaE = PH.getSpinSplitting ? PH.getSpinSplitting(J_ex, M_FMI) : (J_ex * M_FMI);
  const Veff_up = V0_eV - DeltaE/2;
  const Veff_down = V0_eV + DeltaE/2;

  const T_up_off = (E_off_eV >= Veff_up) ? 1.0 : PH.wkbTunneling(Veff_up, d_m, E_off_eV);
  const T_down_off = (E_off_eV >= Veff_down) ? 1.0 : PH.wkbTunneling(Veff_down, d_m, E_off_eV);

  // choose conservative or average
  const leakageWorst = Math.max(T_up_off, T_down_off);
  const leakageAvg = 0.5*(T_up_off + T_down_off);
  return { T_up_off, T_down_off, leakageWorst, leakageAvg, Veff_up, Veff_down };
}
function calculateVreqFromT(T_target, V0_eV, d_nm, { J_ex = 0.0, M_FMI = 0.0, spin = "up", m_eff = PH.m_e } = {}) {
  // validate T_target
  if (!(typeof T_target === "number") || !(T_target > 0 && T_target < 1)) {
    return { E_req_eV: 0, V_eff_eV: V0_eV, kappa: NaN };
  }

  const d_m = Math.max(1e-12, d_nm * 1e-9);
  const DeltaE = (typeof PH.getSpinSplitting === "function") ? PH.getSpinSplitting(J_ex, M_FMI) : (J_ex * M_FMI);
  const Veff_eV = spin === "up" ? V0_eV - DeltaE / 2.0 : V0_eV + DeltaE / 2.0;
  const Veff_J = Veff_eV * PH.eV;

  // ln(T) is negative -> kappa positive
  const lnT = Math.log(T_target);
  const kappa = -lnT / (2 * d_m);
  const deltaJ = (PH.hbar * PH.hbar * kappa * kappa) / (2 * m_eff);
  let E_req_J = Veff_J - deltaJ;

  if (!Number.isFinite(E_req_J)) E_req_J = 0;
  // clamp (cannot exceed Veff)
  if (E_req_J >= Veff_J) E_req_J = Veff_J;
  if (E_req_J <= 0) E_req_J = 0;

  return { E_req_eV: E_req_J / PH.eV, V_eff_eV: Veff_eV, kappa };
}
function calculateEfficiency(V0_eV, d_nm, E_eV, J_ex, M_FMI, alpha = 4.0, tempK_approx= 300) {
  //Todo: replace with real physics-based calculation
  const T_updown = PH.calculateTunnelingProbabilitiesWKB(V0_eV, E_eV, d_nm, J_ex, M_FMI)
  const T_up = T_updown.T_up;      // number 0..1
  const T_down = T_updown.T_down;  // number 0..1
  const E_off_eV = calculateEoffEv((tempK_approx - 273.15), alpha);

  // metrics
  const P = (T_up + T_down) > 0 ? (T_up - T_down) / (T_up + T_down) : 0;
  const leakageInfo = computeLeakageWKB(V0_eV, d_nm, E_off_eV, J_ex, M_FMI); // smaller is better
  const leakageAvg = leakageInfo.leakageAvg;
  const leakageWorst = leakageInfo.leakageWorst;
  const absP = Math.min(Math.max(Math.abs(P), 0), 1);
  const T_target = 1e-6;
  const reqUp = calculateVreqFromT(T_target, V0_eV, d_nm, { J_ex, M_FMI, spin: "up" });
  const reqDown = calculateVreqFromT(T_target, V0_eV, d_nm, { J_ex, M_FMI, spin: "down" });
  const Vreq_eV = Math.min(reqUp.E_req_eV || Infinity, reqDown.E_req_eV || Infinity);// measured/estimated voltage to hit T_target
  const Vmax = 3.0;
  const E_score = 1 - Math.min(Vreq_eV / Vmax, 1);
  const T_on_avg = (T_up + T_down) / 2.0;

  // composite (example weights)
  const w1=0.45, w2=0.30, w3=0.15, w4=0.10;
  const normT = Math.min(Math.max(T_on_avg,0),1);
  const normLeak = Math.min(Math.max(leakageAvg,0),1);
  const normP = absP; // already 0..1

  const eff_score = (w1*normT + w2*(1 - normLeak) + w3*normP + w4*E_score);
  const eff_percent = Math.round(eff_score * 100);
  return {    
    eff_score,
    eff_percent,
    T_up,
    T_down,
    P,
    leakage: {
      avg: leakageAvg,
      worst: leakageWorst,
      per_spin: { up: leakageInfo.T_up_off, down: leakageInfo.T_down_off },
      E_off_eV,
      Veff_up: leakageInfo.Veff_up,
      Veff_down: leakageInfo.Veff_down
    },
    Vreq_eV,
    details: { reqUp, reqDown }
  };
}
function computeMetrics(voltage, temperature, model, V0, d_nm, E_eV, J_ex, M_FMI) {
  //Todo:adjust the fuction to work based on physics and add other aspects not only voltage and temp
  const tempPenalty = (Number.isNaN(temperature))? 0 : Math.max(0, (temperature - 25) * 0.35);//placeholder thing replaced by real physics
  const fragPenalty = Object.keys(model).length === 0 ? 0: model.fragility * 6.0; // placeholder, replaced by real physics-based fragility impact
  const voltageBoost = (Number.isNaN(voltage))? 0: (voltage - 1) * 1.6; // placeholder, replaced by real physics-based voltage impact
  const instability =  (Number.isNaN(temperature))? 0 : Math.max(0, (temperature - 80) / 70); // placeholder, replaced by real physics-based instability metric (e.g. from leakage or error rates at high temp)
  // let efficiency = m.base_eff - tempPenalty - fragPenalty + voundefinedltageBoost - instability * 8.0;
  const phys = calculateEfficiency(V0, d_nm, E_eV, J_ex, M_FMI);
  console.log("Physics details:", phys);
  // phys.eff_percent is 0..100, phys.eff_score is 0..1
  // combine with simple penalties (scale appropriately)
  // convert phys.eff_percent back to 0..100 numeric base
  let efficiencyBase = phys.eff_percent; // 0..100
  let efficiency = efficiencyBase - tempPenalty - fragPenalty + voltageBoost - instability * 8.0;
  console.log("efficiencyBase:", efficiencyBase, "tempPenalty:", tempPenalty, "fragPenalty:", fragPenalty, "voltageBoost:", voltageBoost, "instability:", instability, "efficiency:", efficiency);
  efficiency = Math.max(0, Math.min(100, efficiency));

  const cost_est =Object.keys(model).length === 0 ? 0: Number(model.cost);
  return {
    efficiency: Number(efficiency.toFixed(2)),
    cost_est: Number(cost_est.toFixed(2)),
    instability: Number(instability.toFixed(4)),
    model_name: model.name,
    fragility: model.fragility,
    physics: phys,
  };
}




export default function App() {
  const [tab, setTab] = useState(1);
  const [voltage, setVoltage] = useState(5);
  const [temperature, setTemperature] = useState(25);
  const [humidity, setHumidity] = useState(50);
  const [selectedChip, setSelectedChip] = useState("our");
  const simRef = useRef(null);

  // Barrier / FMI params (for Tab 2). Moved to top-level so SideControlPanel can control them.
  const [V0, setV0] = useState(PH.V0_eV);      // eV
  const [d_nm, setDnm] = useState((selectedChip === "our" ?PH.OUR_MODEL_DEFAULTS.d_nm : PH.CURRENT_MARKET_DEFAULTS.d_nm));   // nm
  const [E_eV, setE] = useState((selectedChip === "our" ?PH.OUR_MODEL_DEFAULTS.E_eV : PH.CURRENT_MARKET_DEFAULTS.E_eV));     // eV
  const [J_ex, setJex] = useState((selectedChip === "our" ?PH.OUR_MODEL_DEFAULTS.J_ex : PH.CURRENT_MARKET_DEFAULTS.J_ex));  // eV
  const [M_FMI, setM] = useState((selectedChip === "our" ?PH.OUR_MODEL_DEFAULTS.M_FMI : PH.CURRENT_MARKET_DEFAULTS.M_FMI));    // dimensionless

  const metrics = computeMetrics(voltage, temperature, CHIP_MODELS[selectedChip], V0, d_nm, E_eV, J_ex, M_FMI);
  const totalPartsPriceLow = PARTS.reduce((s, p) => s + (p.lowp || 0), 0).toFixed(2);
  const totalPartsPriceHigh = PARTS.reduce((s, p) => s + (p.highp || 0), 0).toFixed(2);

  useEffect(() => {
    if (selectedChip === "our") {
      setDnm(PH.OUR_MODEL_DEFAULTS.d_nm);
      setE(PH.OUR_MODEL_DEFAULTS.E_eV);
      setJex(PH.OUR_MODEL_DEFAULTS.J_ex);
      setM(PH.OUR_MODEL_DEFAULTS.M_FMI);
    } else if (selectedChip === "market") {
      setDnm(PH.CURRENT_MARKET_DEFAULTS.d_nm);
      setE(PH.CURRENT_MARKET_DEFAULTS.E_eV);
      setJex(PH.CURRENT_MARKET_DEFAULTS.J_ex);
      setM(PH.CURRENT_MARKET_DEFAULTS.M_FMI);
    }
  }, [selectedChip]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <div className="relative flex-1 flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-sm border-b">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold">Flash Memory Cell</div>
            <div className="text-sm text-slate-500">— interactive demo</div>
          </div>

          <div className="flex-1 flex justify-center">
            <Tabs tab={tab} onChange={setTab} />
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-sm text-slate-600 mr-2">Compare</div>
            <div className="flex gap-2">
              <button
                className={`px-3 py-2 rounded-md text-sm font-semibold transition ${
                  selectedChip === "our" ? "bg-sky-600 text-white shadow" : "bg-white text-slate-800 border"
                }`}
                onClick={() => setSelectedChip("our")}
              >
                Our model
              </button>
              <button
                className={`px-3 py-2 rounded-md text-sm font-semibold transition ${
                  selectedChip === "market" ? "bg-sky-600 text-white shadow" : "bg-white text-slate-800 border"
                }`}
                onClick={() => setSelectedChip("market")}
              >
                Market model
              </button>
            </div>
          </div>
        </header>

        <div className="flex flex-1 min-h-0">
          {/* MAIN */}
          <main className="flex-1 p-4 min-h-0 flex flex-col">
            <div className="bg-white rounded-xl p-4 shadow-lg flex flex-col flex-1 min-h-0">
              <div className="font-semibold text-lg mb-2">
                {tab === 1 ? "SSD — Parts & Price" : tab === 2 ? "Barrier / Tunneling Simulator" : "Harsh environment"}
              </div>

              <div className="flex-1 min-h-0 flex flex-col gap-3">
                <div className="flex-1 min-h-0 rounded-lg overflow-hidden bg-slate-900 p-2">
                  <SimCanvas
                    ref={simRef}
                    tab={tab}
                    voltage={voltage}
                    temperature={temperature}
                    modelKey={selectedChip}
                    metrics={metrics}
                    parts={PARTS}
                    // barrier props for Tab 2
                    V0={V0}
                    d_nm={d_nm}
                    E_eV={E_eV}
                    J_ex={J_ex}
                    M_FMI={M_FMI}
                  />
                </div>
              </div>
            </div>
          </main>

          {/* SINGLE SideControlPanel on the RIGHT */}
          <SideControlPanel
            voltage={voltage}
            setVoltage={setVoltage}
            temperature={temperature}
            setTemperature={setTemperature}
            humidity={humidity}
            setHumidity={setHumidity}
            computeMetrics={computeMetrics}
            tab={tab}
            parts={PARTS}
            totalPartsPriceLow={totalPartsPriceLow}
            totalPartsPriceHigh={totalPartsPriceHigh}
            selectedChip={selectedChip}
            calculateEfficiency={calculateEfficiency}
            chipModel={CHIP_MODELS[selectedChip]}
            // pass barrier handlers so SideControlPanel shows barrier sliders when tab === 2
            V0={V0}
            setV0={setV0}
            d_nm={d_nm}
            setDnm={setDnm}
            E_eV={E_eV}
            setE={setE}
            J_ex={J_ex}
            setJex={setJex}
            M_FMI={M_FMI}
            setM={setM}
          />
        </div>
      </div>
    </div>
  );
}

