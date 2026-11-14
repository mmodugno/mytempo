// La mascota: un pomerania. Un solo dibujo con tres ánimos y accesorios que se desbloquean con la racha.
// Es SVG armado desde constantes (nada del usuario entra al dibujo).

const FLUFF = ["-30,0,9", "30,0,9", "-22,22,9", "22,22,9", "0,33,9", "-24,-20,8", "24,-20,8", "-31,-10,7", "31,-10,7"]
  .map((c) => {
    const [x, y, r] = c.split(",");
    return `<circle cx="${x}" cy="${y}" r="${r}"/>`;
  })
  .join("");

const EYES = {
  calm: `<circle cx="-12" cy="-5" r="3.4" fill="#3A2A22"/><circle cx="12" cy="-5" r="3.4" fill="#3A2A22"/><circle cx="-11" cy="-6" r="1.1" fill="#fff"/><circle cx="13" cy="-6" r="1.1" fill="#fff"/>`,
  happy: `<path d="M-16 -3 Q-12 -10 -8 -3" fill="none" stroke="#3A2A22" stroke-width="2.4" stroke-linecap="round"/><path d="M8 -3 Q12 -10 16 -3" fill="none" stroke="#3A2A22" stroke-width="2.4" stroke-linecap="round"/>`,
  sleepy: `<path d="M-16 -4 Q-12 0 -8 -4" fill="none" stroke="#3A2A22" stroke-width="2.2" stroke-linecap="round"/><path d="M8 -4 Q12 0 16 -4" fill="none" stroke="#3A2A22" stroke-width="2.2" stroke-linecap="round"/>`,
};

const MOUTH = {
  calm: `<path d="M-5 11 Q0 15 5 11" fill="none" stroke="#3A2A22" stroke-width="1.7" stroke-linecap="round"/>`,
  happy: `<path d="M-7 12 Q0 26 7 12 Z" fill="#7A2F2F"/><ellipse cx="0" cy="19" rx="3.6" ry="3" fill="#F07C8C"/>`,
  sleepy: `<path d="M-4 13 Q0 15 4 13" fill="none" stroke="#3A2A22" stroke-width="1.7" stroke-linecap="round"/>`,
};

const EXTRA = {
  calm: "",
  happy: `<path class="spark" d="M44 -34 l3 -8 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 Z" fill="#E8A838"/><path class="spark s2" d="M-47 -22 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 Z" fill="#E8A838"/>`,
  sleepy: `<text x="34" y="-34" font-size="14" font-weight="700" fill="#8A6BB5">z</text><text x="44" y="-46" font-size="10" font-weight="700" fill="#8A6BB5">z</text>`,
};

/**
 * @param {{mood?: "calm"|"happy"|"sleepy", outfit?: {bow?: boolean, scarf?: boolean, hat?: boolean, crown?: boolean, flower?: boolean, glasses?: boolean, headphones?: boolean, medal?: boolean, cape?: boolean, chef?: boolean}}} opts
 * @returns {string} SVG
 */
export function pomeranianSvg({ mood = "calm", outfit = {} } = {}) {
  const cheeks = `<circle cx="-21" cy="6" r="4.2" fill="#F08A7C" opacity="${mood === "happy" ? 0.6 : 0.45}"/><circle cx="21" cy="6" r="4.2" fill="#F08A7C" opacity="${mood === "happy" ? 0.6 : 0.45}"/>`;
  return `<svg viewBox="-52 -58 104 108" width="100%" height="100%" aria-hidden="true" focusable="false">
${outfit.cape ? `<path d="M-30 18 Q-48 44 -38 56 L38 56 Q48 44 30 18 Z" fill="#7F77DD"/><path d="M-30 18 Q0 34 30 18" fill="none" stroke="#5F58BD" stroke-width="2"/>` : ""}
<path d="M-26 -22 L-23 -44 L-6 -30 Z" fill="#E8923D"/><path d="M26 -22 L23 -44 L6 -30 Z" fill="#E8923D"/>
<path d="M-23 -27 L-21 -38 L-12 -30 Z" fill="#F7C9A0"/><path d="M23 -27 L21 -38 L12 -30 Z" fill="#F7C9A0"/>
<g fill="#F2A65A"><circle cx="0" cy="0" r="34"/>${FLUFF}</g>
<ellipse cx="0" cy="11" rx="17" ry="13" fill="#FCE9CF"/>
${MOUTH[mood]}
<ellipse cx="0" cy="4" rx="4.5" ry="3.2" fill="#3A2A22"/>
${EYES[mood]}${cheeks}
${outfit.medal ? `<path d="M-6 30 L0 40 L6 30" fill="none" stroke="#2E7D9A" stroke-width="2.4"/><circle cx="0" cy="43" r="5" fill="#E8A838" stroke="#B9801C" stroke-width="1.2"/><path d="M0 40.5 l1.2 2.4 l2.6 .4 l-1.9 1.8 l.5 2.6 l-2.4 -1.3 l-2.4 1.3 l.5 -2.6 l-1.9 -1.8 l2.6 -.4 Z" fill="#fff" opacity=".85"/>` : ""}
${outfit.scarf ? `<path d="M-23 27 Q0 40 23 27 L21 36 Q0 47 -21 36 Z" fill="#CF5A2E"/><path d="M12 38 l9 -1 l2 9 l-9 1 Z" fill="#B84A22"/>` : ""}
${outfit.bow ? `<path d="M23 -25 l-10 -6 v12 z M23 -25 l10 -6 v12 z" fill="#E86A92"/><circle cx="23" cy="-25" r="3.2" fill="#C94874"/>` : ""}
${outfit.hat ? `<path d="M-12 -31 L0 -56 L12 -31 Z" fill="#7F77DD"/><circle cx="0" cy="-56" r="3" fill="#E8A838"/>` : ""}
${outfit.chef ? `<rect x="-14" y="-37" width="28" height="8" rx="2" fill="#fff" stroke="#D8D4CC" stroke-width="1"/><g fill="#fff" stroke="#D8D4CC" stroke-width="1"><circle cx="-9" cy="-44" r="8"/><circle cx="9" cy="-44" r="8"/><circle cx="0" cy="-49" r="9"/></g><rect x="-13" y="-38" width="26" height="6" fill="#fff"/>` : ""}
${outfit.crown ? `<path d="M-14 -31 L-14 -47 L-7 -40 L0 -50 L7 -40 L14 -47 L14 -31 Z" fill="#E8A838" stroke="#B9801C" stroke-width="1.2" stroke-linejoin="round"/>` : ""}
${outfit.flower ? `<g transform="translate(-23 -26)"><circle cx="0" cy="-5" r="3.6" fill="#F7B6C8"/><circle cx="5" cy="-1.5" r="3.6" fill="#F7B6C8"/><circle cx="3" cy="4.5" r="3.6" fill="#F7B6C8"/><circle cx="-3" cy="4.5" r="3.6" fill="#F7B6C8"/><circle cx="-5" cy="-1.5" r="3.6" fill="#F7B6C8"/><circle cx="0" cy="0" r="2.8" fill="#E8A838"/></g>` : ""}
${outfit.headphones ? `<path d="M-33 -4 Q-34 -46 0 -47 Q34 -46 33 -4" fill="none" stroke="#3A3A4A" stroke-width="4" stroke-linecap="round"/><rect x="-39" y="-8" width="9" height="17" rx="4.5" fill="#5B5B72"/><rect x="30" y="-8" width="9" height="17" rx="4.5" fill="#5B5B72"/>` : ""}
${outfit.glasses ? `<rect x="-21" y="-12" width="17" height="12" rx="5" fill="#2B2B38"/><rect x="4" y="-12" width="17" height="12" rx="5" fill="#2B2B38"/><path d="M-4 -8 H4" stroke="#2B2B38" stroke-width="2.2"/><path d="M-19 -10 l5 0" stroke="#fff" stroke-width="1.5" opacity=".5" stroke-linecap="round"/><path d="M6 -10 l5 0" stroke="#fff" stroke-width="1.5" opacity=".5" stroke-linecap="round"/>` : ""}
${EXTRA[mood]}
</svg>`;
}
