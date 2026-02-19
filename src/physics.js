// src/physics.js
// Physics helper ported from the Python code, using mathjs for complex arithmetic.
//
// Exports:
//  - wkbTunneling(V0_eV, d_m, E_eV)
//  - wkbTunnelingProbability(V0_J, E_J, d_m)
//  - spinSplitting(J_ex, M_FMI)  (alias of getSpinSplitting)
//  - getSpinSplitting() (uses module-level defaults if not provided)
//  - spinEnergies(E_eV, J_ex, M_FMI)
//  - calculateWavefunctionCoefficients(V0_J, E_J, d_m)
//  - calculateWavefunction(x_m_array, V0_J, E_J, d_m)
//  - calculateTunnelingProbabilitiesExact(V0_eV, E_eV, d_nm, J_ex, M_FMI)

import { create, all } from "mathjs";
const math = create(all);

// ------------------- constants -------------------
export const hbar = 1.0545718e-34;// Reduced Planck constant (J·s)
export const m0 = 9.10938356e-31;
export const m_e = 1.2 * m0; // Effective electron mass (1.2 * m_0)
export const eV = 1.60217662e-19;
export const d_m = 2.0e-9; //barrier width in meters (nm → m)
export const V0_eV = 1.70; //Barrier height in eV
export const E_eV = 0.50; //Electron energy in eV
export const KB_EV = 8.617333262145e-5;

// default model params (you may override by calling functions with args)

//Todo: replace these defaults with our model details
export const OUR_MODEL_DEFAULTS = {
  V0_eV: 1.70, //Barrier height in eV
  d_m: 3.0e-9 * 1e9,//Barrier width in meters (nm → m)
  d_nm: 3.0, //Barrier width in nm (for display)
  E_eV: 0.50,//Electron energy in eV
  J_ex: 0.050,//Exchange coupling strength in eV
  M_FMI: 1.0,//Magnetisierungsfaktor (dimensionslos, ±1)
};
//Todo: replace these defaults with current industrie model details
export const CURRENT_MARKET_DEFAULTS = {
  V0_eV: 1.70, //Barrier height in eV
  d_m: 3.5e-9 * 1e9,//Barrier width in meters (nm → m)
  d_nm: 3.5, //Barrier width in nm (for display)
  E_eV: 0.50,//Electron energy in eV
  J_ex: 0.050,//Exchange coupling strength in eV
  M_FMI: 1.0,//Magnetisierungsfaktor (dimensionslos, ±1)
}
export const E_MIN = 0.1 // Minimum energy for plot (eV)
export const E_MAX_OFFSET = 0.5 // Energy range above V0 (eV)
export const NUM_POINTS = 200 // Number of points for energy range

// ------------------- small helpers -------------------
const toJ = (eVval) => eVval * eV;
const safeNum = (x, fallback = 0) => (Number.isFinite(x) ? x : fallback);
const c = (re = 0, im = 0) => math.complex(re, im);
const cAbs2 = (z) => {
  // returns |z|^2 as number
  return Math.pow(math.abs(z), 2);
};

// ------------------- WKB functions -------------------
export function wkbTunneling(V0_eV, d_m, E_eV) {
  // V0_eV, E_eV in eV, d_m in meters
  if (E_eV >= V0_eV) return 1.0;
  const V0_J = toJ(V0_eV);
  const E_J = toJ(E_eV);
  const kappa = Math.sqrt(2 * m_e * (V0_J - E_J)) / hbar;
  const T = Math.exp(-2 * kappa * d_m);
  return T;
}

export function wkbTunnelingProbability(V0_J, E_J, d_m) {
  // legacy wrapper: expects SI units (J, J, m)
  if (E_J >= V0_J) return 1.0;
  const kappa = Math.sqrt(2 * m_e * (V0_J - E_J)) / hbar;
  return Math.exp(-2 * kappa * d_m);
}

// ------------------- spin helpers -------------------
export function spinSplitting(J_ex = OUR_MODEL_DEFAULTS.J_ex, M_FMI = OUR_MODEL_DEFAULTS.M_FMI) {
  return J_ex * M_FMI;
}
export const getSpinSplitting = spinSplitting; // alias

export function spinEnergies(E_eV, J_ex = OUR_MODEL_DEFAULTS.J_ex, M_FMI = OUR_MODEL_DEFAULTS.M_FMI) {
  const DeltaE = spinSplitting(J_ex, M_FMI);
  return { up: E_eV + DeltaE / 2.0, down: E_eV - DeltaE / 2.0 };
}
export const getSpinEnergies = spinEnergies;

// convenience
export function fmiExchangeAplitting(J_ex = OUR_MODEL_DEFAULTS.J_ex, M_FMI = OUR_MODEL_DEFAULTS.M_FMI) {
  return (spinSplitting(J_ex, M_FMI) / 2.0) * eV;
}

// ------------------- transfer-matrix coefficient solver -------------------
export function calculateWavefunctionCoefficients(V0_J, E_J, d_m) {
  // t, r, A, B are math.complex; k1, k2_or_kappa are real numbers

  // protect inputs
  V0_J = safeNum(V0_J, toJ(OUR_MODEL_DEFAULTS.V0_eV));
  E_J = safeNum(E_J, toJ(OUR_MODEL_DEFAULTS.E_eV));
  d_m = safeNum(d_m, OUR_MODEL_DEFAULTS.d_m);

  const k1 = Math.sqrt(2 * m_e * E_J) / hbar;

  if (E_J >= V0_J) {
    // over-barrier (oscillatory inside)
    const k2 = Math.sqrt(2 * m_e * (E_J - V0_J)) / hbar;
    const cos_k2d = Math.cos(k2 * d_m);
    const sin_k2d = Math.sin(k2 * d_m);

    // denominator = cos_k2d + 0.5j * (k2/k1 + k1/k2) * sin_k2d
    const imagFactor = 0.5 * (k2 / k1 + k1 / k2) * sin_k2d;
    const denom = c(cos_k2d, imagFactor);
    const one = c(1, 0);
    const t = math.divide(one, denom); // complex

    // r = -0.5j*(k2/k1 - k1/k2)*sin_k2d / denominator
    const rnum = c(0, -0.5 * (k2 / k1 - k1 / k2) * sin_k2d);
    const r = math.divide(rnum, denom);

    // A = 0.5 * ((1 + r) + (k1/k2)*(1 - r))
    const onePlusR = math.add(one, r);
    const oneMinusR = math.subtract(one, r);
    const kratio = k1 / k2;
    const term = math.multiply(oneMinusR, kratio);
    const A = math.multiply(math.add(onePlusR, term), 0.5);

    // B = 0.5 * ((1 + r) - (k1/k2)*(1 - r))
    const B = math.multiply(math.subtract(onePlusR, term), 0.5);

    return { t, r, k1, k2_or_kappa: k2, A, B };
  } else {
    // tunneling regime: exponentials inside barrier
    const kappa = Math.sqrt(2 * m_e * (V0_J - E_J)) / hbar;
    const sinh_kd = Math.sinh(kappa * d_m);
    const cosh_kd = Math.cosh(kappa * d_m);

    // impedance_term = (kappa^2 - k1^2) / (2 k1 kappa)
    const impedance_term = (kappa * kappa - k1 * k1) / (2 * k1 * kappa);

    // denominator = cosh_kd + i * impedance_term * sinh_kd
    const denom = c(cosh_kd, impedance_term * sinh_kd);
    const one = c(1, 0);
    const t = math.divide(one, denom);

    // r = -i * (kappa^2 + k1^2) / (2 k1 kappa) * sinh_kd / denominator
    const rnum = c(0, -((kappa * kappa + k1 * k1) / (2 * k1 * kappa)) * sinh_kd);
    const r = math.divide(rnum, denom);

    // A = 0.5 * ((1 + r) - i*(k1/kappa)*(1 - r))
    const waveRatio = k1 / kappa;
    const onePlusR = math.add(one, r);
    const oneMinusR = math.subtract(one, r);
    const imFactor = c(0, waveRatio); // -i * (k1/kappa) represented as complex(0, -k1/kappa)
    const term = math.multiply(oneMinusR, imFactor);
    const A = math.multiply(math.subtract(onePlusR, term), 0.5);

    // B = 0.5 * ((1 + r) + i*(k1/kappa)*(1 - r))
    const B = math.multiply(math.add(onePlusR, term), 0.5);

    return { t, r, k1, k2_or_kappa: kappa, A, B };
  }
}

// ------------------- wavefunction builder -------------------
export function calculateWavefunction(x_m_array, V0_J, E_J, d_m) {
  // prepare coefficients
  const coeffs = calculateWavefunctionCoefficients(V0_J, E_J, d_m);
  const { t, r, k1, k2_or_kappa, A, B } = coeffs;
  const N = x_m_array.length;

  const psiRe = new Array(N).fill(0);
  const psiIm = new Array(N).fill(0);
  const prob = new Array(N).fill(0);

  const isTunnel = E_J < V0_J;

  for (let i = 0; i < N; i++) {
    const x = x_m_array[i];

    if (x < 0) {
      const eikx = math.exp(c(0, k1 * x)); // exp(i k1 x)
      const eMinus = math.exp(c(0, -k1 * x)); // exp(-i k1 x)
      const term1 = eikx;
      const term2 = math.multiply(r, eMinus);
      const psi = math.add(term1, term2);
      psiRe[i] = math.re(psi);
      psiIm[i] = math.im(psi);
      prob[i] = cAbs2(psi);
    } else if (x >= 0 && x <= d_m) {
      if (isTunnel) {
        const kappa = k2_or_kappa;
        const e1 = Math.exp(-kappa * x);
        const e2 = Math.exp(kappa * x);
        const term1 = math.multiply(A, e1);
        const term2 = math.multiply(B, e2);
        const psi = math.add(term1, term2);
        psiRe[i] = math.re(psi);
        psiIm[i] = math.im(psi);
        prob[i] = cAbs2(psi);
      } else {
        const k2 = k2_or_kappa;
        const e1 = math.exp(c(0, k2 * x));
        const e2 = math.exp(c(0, -k2 * x));
        const term1 = math.multiply(A, e1);
        const term2 = math.multiply(B, e2);
        const psi = math.add(term1, term2);
        psiRe[i] = math.re(psi);
        psiIm[i] = math.im(psi);
        prob[i] = cAbs2(psi);
      }
    } else {
      const phase = math.exp(c(0, k1 * (x - d_m)));
      const psi = math.multiply(t, phase);
      psiRe[i] = math.re(psi);
      psiIm[i] = math.im(psi);
      prob[i] = cAbs2(psi);
    }
  }

  return { psiRe, psiIm, prob };
}

// ------------------- exact transmission wrapper -------------------
export function calculateTunnelingProbabilitiesExact(V0_eV, E_eV, d_nm, J_ex = OUR_MODEL_DEFAULTS.J_ex, M_FMI = OUR_MODEL_DEFAULTS.M_FMI) {
  // returns { T_up, T_down } (numbers)
  const d_m = d_nm * 1e-9;
  const DeltaE = spinSplitting(J_ex, M_FMI);
  const E_up = E_eV + DeltaE / 2.0;
  const E_down = E_eV - DeltaE / 2.0;

  const V0_J = toJ(V0_eV);
  const E_up_J = toJ(E_up);
  const E_down_J = toJ(E_down);

  const t_up = calculateWavefunctionCoefficients(V0_J, E_up_J, d_m).t;
  const t_down = calculateWavefunctionCoefficients(V0_J, E_down_J, d_m).t;

  const T_up = Math.pow(math.abs(t_up), 2);
  const T_down = Math.pow(math.abs(t_down), 2);

  return { T_up, T_down };
}

// ------------------- convenience WKB probabilities for spin channels -------------------
export function calculateTunnelingProbabilitiesWKB(V0_eV, E_eV, d_nm, J_ex = OUR_MODEL_DEFAULTS.J_ex, M_FMI = OUR_MODEL_DEFAULTS.M_FMI) {
  const d_m = d_nm * 1e-9;
  const DeltaE = spinSplitting(J_ex, M_FMI);
  const E_up = E_eV + DeltaE / 2.0;
  const E_down = E_eV - DeltaE / 2.0;
  const T_up = wkbTunneling(V0_eV, d_m, E_up);
  const T_down = wkbTunneling(V0_eV, d_m, E_down);
  return { T_up, T_down };
}
function cAbs(a) { return Math.sqrt(a.re * a.re + a.im * a.im); }
function cDivScalar(a, s) { return { re: a.re / s, im: a.im / s }; }
function cSubComplex(a, b) { return { re: a.re - b.re, im: a.im - b.im }; }
export function validateQuantumMechanics(V0_J, E_J, d_m) {
  // 1) get coefficients
  const coeffs = calculateWavefunctionCoefficients(V0_J, E_J, d_m);
  const { t, r, k1, k2_or_kappa } = coeffs;

  // 2) unitarity
  const T = cAbs2(t); // |t|^2
  const R = cAbs2(r); // |r|^2
  const unitarity = Math.abs(R + T - 1.0);

  // 3) continuity checks at x=0 and x=d:
  // choose a tiny epsilon relative to d (but avoid zero)
  const eps = Math.max(d_m * 1e-10, 1e-15);
  const x_test = [-eps, 0, eps, d_m - eps, d_m, d_m + eps];

  // calculate psi at these points: NOTE calculateWavefunction expects an array of x (meters)
  const { psiRe: psiRe1, psiIm: psiIm1 } = calculateWavefunction(x_test, V0_J, E_J, d_m);

  // build complex psi array
  const psi1 = psiRe1.map((re, i) => ({ re, im: psiIm1[i] }));

  // continuity magnitudes
  const continuity_0 = cAbs(cSubComplex(psi1[1], psi1[2])); // psi(0-) vs psi(eps)
  const continuity_d = cAbs(cSubComplex(psi1[4], psi1[5])); // psi(d) vs psi(d+eps)

  // 4) derivative continuity using a robust dx based on local wavelengths
  // compute wavelengths (careful with regimes)
  const lambda1 = (2 * Math.PI) / k1;
  let lambda2;
  if (E_J >= V0_J) {
    // k2 is a real wavenumber
    lambda2 = (2 * Math.PI) / k2_or_kappa;
  } else {
    // tunneling: use 1/kappa as characteristic decay length
    lambda2 = 1.0 / k2_or_kappa;
  }
  let dx_robust = Math.min(lambda1, lambda2) / 100;
  dx_robust = Math.max(dx_robust, 1e-12); // avoid zero

  const x_deriv = [-dx_robust, 0, dx_robust, d_m - dx_robust, d_m, d_m + dx_robust];
  const { psiRe: psiRe2, psiIm: psiIm2 } = calculateWavefunction(x_deriv, V0_J, E_J, d_m);
  const psi2 = psiRe2.map((re, i) => ({ re, im: psiIm2[i] }));

  // derivatives at x=0
  const dpsi_left_0 = cDivScalar(cSubComplex(psi2[1], psi2[0]), dx_robust);
  const dpsi_right_0 = cDivScalar(cSubComplex(psi2[2], psi2[1]), dx_robust);
  const derivative_continuity_0 = cAbs(cSubComplex(dpsi_left_0, dpsi_right_0));

  // derivatives at x=d
  const dpsi_left_d = cDivScalar(cSubComplex(psi2[4], psi2[3]), dx_robust);
  const dpsi_right_d = cDivScalar(cSubComplex(psi2[5], psi2[4]), dx_robust);
  const derivative_continuity_d = cAbs(cSubComplex(dpsi_left_d, dpsi_right_d));

  // thresholds (tunable)
  const unitarity_threshold = 1e-8;     // permissive in JS; adjust smaller for stricter tests
  const continuity_threshold = 1e-6;    // depends on scale / numeric precision

  const is_valid =
    unitarity < unitarity_threshold &&
    continuity_0 < continuity_threshold &&
    continuity_d < continuity_threshold &&
    derivative_continuity_0 < continuity_threshold &&
    derivative_continuity_d < continuity_threshold;

  const details = {
    unitarity_error: unitarity,
    transmission: T,
    reflection: R,
    continuity_at_0: continuity_0,
    continuity_at_d: continuity_d,
    derivative_continuity_0: derivative_continuity_0,
    derivative_continuity_d: derivative_continuity_d,
    is_tunneling_regime: E_J < V0_J,
  };

  return { isValid: is_valid, details };
}

// export friendly aliases to match older names used in your React code
export const spinSplittingAlias = spinSplitting;
export const spinEnergiesAlias = spinEnergies;
export const calculateWavefunctionAlias = calculateWavefunction;
export default {
  hbar,
  m0,
  m_e,
  eV,
  OUR_MODEL_DEFAULTS,
  CURRENT_MARKET_DEFAULTS,
  wkbTunneling,
  wkbTunnelingProbability,
  spinSplitting,
  getSpinSplitting,
  spinEnergies,
  getSpinEnergies,
  fmiExchangeAplitting,
  calculateWavefunctionCoefficients,
  calculateWavefunction,
  calculateTunnelingProbabilitiesExact,
  calculateTunnelingProbabilitiesWKB,
};

