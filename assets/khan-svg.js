// Сұрақтарға арналған SVG: Қазақстан картасы (карта тапсырмасы) және артефакт суреттері
(function () {
'use strict';
const ART = {
 golden_man: '<rect width="200" height="200" fill="#22304A"/><polygon points="100,12 84,78 116,78" fill="#E8B84A"/><circle cx="100" cy="92" r="16" fill="#D9A877"/><path d="M70 110 L130 110 L142 190 L58 190 Z" fill="#B8862C"/><g fill="#F6D27A"><circle cx="82" cy="130" r="4"/><circle cx="100" cy="130" r="4"/><circle cx="118" cy="130" r="4"/><circle cx="88" cy="150" r="4"/><circle cx="112" cy="150" r="4"/></g><rect x="66" y="160" width="68" height="8" fill="#8A5A00"/>',
 cauldron: '<rect width="200" height="200" fill="#22304A"/><path d="M50 70 Q100 60 150 70 L140 125 Q100 145 60 125 Z" fill="#A0652E"/><path d="M50 70 Q100 60 150 70" stroke="#6E4520" stroke-width="6" fill="none"/><path d="M60 60 q-10 -25 15 -25 M140 60 q10 -25 -15 -25" stroke="#A0652E" stroke-width="8" fill="none"/><path d="M80 135 L70 180 L130 180 L120 135 Z" fill="#8A5528"/><path d="M60 95 Q100 105 140 95" stroke="#6E4520" stroke-width="4" fill="none"/>',
 mausoleum: '<rect width="200" height="200" fill="#22304A"/><rect x="30" y="95" width="140" height="95" fill="#D9B77E"/><path d="M60 100 Q100 20 140 100 Z" fill="#C49A5A"/><rect x="75" y="110" width="50" height="80" fill="#B8864A"/><path d="M85 190 V140 Q100 120 115 140 V190 Z" fill="#5A4630"/><g fill="#A8783E"><rect x="40" y="110" width="20" height="8"/><rect x="140" y="110" width="20" height="8"/><rect x="40" y="130" width="20" height="8"/><rect x="140" y="130" width="20" height="8"/></g>',
 scroll: '<rect width="200" height="200" fill="#22304A"/><rect x="45" y="40" width="110" height="130" fill="#F1E3C2"/><rect x="35" y="30" width="130" height="16" rx="8" fill="#C49A5A"/><rect x="35" y="164" width="130" height="16" rx="8" fill="#C49A5A"/><g stroke="#8A6A3A" stroke-width="4"><path d="M60 70 h80 M60 90 h80 M60 110 h80 M60 130 h60"/></g><circle cx="135" cy="140" r="12" fill="#B23A48"/>',
 shanyrak: '<rect width="200" height="200" fill="#22304A"/><circle cx="100" cy="100" r="72" fill="none" stroke="#C49A5A" stroke-width="14"/><g stroke="#A8783E" stroke-width="9"><path d="M100 30 V170 M30 100 H170"/><path d="M78 32 V168 M122 32 V168 M32 78 H168 M32 122 H168"/></g><g stroke="#8A5A00" stroke-width="4"><path d="M100 172 L100 198 M40 140 L18 160 M160 140 L182 160 M40 60 L18 40 M160 60 L182 40"/></g>',
 fortress: '<rect width="200" height="200" fill="#22304A"/><g fill="#7A5434"><path d="M20 190 V95 L30 85 L40 95 V190 Z M45 190 V95 L55 85 L65 95 V190 Z M70 190 V95 L80 85 L90 95 V190 Z M95 190 V95 L105 85 L115 95 V190 Z"/></g><rect x="120" y="45" width="55" height="145" fill="#5E3F26"/><path d="M115 50 L147 20 L180 50 Z" fill="#3E2A1A"/><rect x="138" y="70" width="18" height="22" fill="#22304A"/>',
};
const KZ = [[46.5,48.9],[47.6,50.4],[48.7,50.6],[50.3,51.4],[51.4,51.6],[52.8,51.5],[54.6,50.9],[55.7,50.6],[57.3,51.1],[58.6,51.0],[59.9,50.6],[61.4,50.8],[61.0,52.0],[61.6,53.8],[62.8,54.1],[65.2,54.6],[67.5,54.9],[69.2,55.4],[70.8,55.3],[71.3,54.2],[73.2,54.0],[74.0,53.6],[76.5,54.3],[77.9,53.3],[79.0,52.6],[80.1,51.5],[81.0,51.0],[82.6,50.8],[83.4,51.1],[84.3,50.3],[85.2,49.8],[86.0,49.4],[87.3,49.1],[86.8,48.6],[85.6,48.0],[85.5,47.2],[83.0,47.2],[82.3,45.6],[80.0,45.0],[80.5,43.9],[80.2,42.9],[78.6,42.9],[77.0,42.9],[75.6,42.8],[74.2,43.2],[73.5,42.5],[71.8,42.8],[70.9,42.2],[70.0,41.5],[68.7,40.6],[68.3,41.2],[66.6,41.2],[66.0,42.0],[66.0,43.0],[64.5,43.6],[62.0,43.5],[61.0,44.3],[58.6,45.5],[56.0,45.0],[56.0,41.3],[55.4,41.3],[54.2,42.3],[53.0,42.1],[52.5,41.8],[52.8,42.7],[51.3,43.2],[51.0,44.0],[50.3,44.6],[51.3,45.0],[52.9,45.3],[53.2,46.2],[52.0,46.8],[51.0,47.0],[49.2,46.3],[48.6,46.6],[48.0,47.3],[47.2,47.7],[46.5,48.4]];
const CASPIAN = [[45.5,47.2],[46.5,46.0],[47.5,45.2],[49.2,46.3],[51.0,47.0],[52.0,46.8],[53.2,46.2],[52.9,45.3],[51.3,45.0],[50.3,44.6],[51.0,44.0],[51.3,43.2],[52.8,42.7],[52.5,41.8],[52.0,40.6],[50.0,40.2],[49.0,41.4],[47.5,42.8],[46.2,43.9],[45.5,45.5]];
const BALKHASH = [[73.6,46.4],[75.5,46.6],[77.5,46.9],[79.0,46.8],[79.1,46.4],[77.5,46.35],[75.5,45.95],[73.8,45.85]];
const proj = ([lon, lat]) => [10 + (lon - 45.5) * (460 / 42), 8 + (55.8 - lat) * (244 / 15.5)];
const pts = (arr) => arr.map((p) => proj(p).map((v) => v.toFixed(1)).join(',')).join(' ');
function mapSVG(points) {
  let s = '<svg viewBox="0 0 480 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Қазақстан картасы">';
  s += '<rect width="480" height="260" fill="#18243A"/>';
  s += '<polygon points="' + pts(CASPIAN) + '" fill="#2C6E91"/>';
  s += '<polygon points="' + pts(KZ) + '" fill="#C9A35A" stroke="#8A5A00" stroke-width="2"/>';
  const [ax, ay] = proj([60.0, 45.3]); s += '<ellipse cx="' + ax.toFixed(1) + '" cy="' + ay.toFixed(1) + '" rx="12" ry="12" fill="#2C6E91"/>';
  s += '<polygon points="' + pts(BALKHASH) + '" fill="#2C6E91"/>';
  ['A', 'B', 'C', 'D'].forEach((L, i) => { const p = points[i]; if (!p) return; const [x, y] = proj(p);
    s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="11" fill="#101826" stroke="#E8B84A" stroke-width="3"/>';
    s += '<text x="' + x.toFixed(1) + '" y="' + (y + 5).toFixed(1) + '" text-anchor="middle" font-size="14" font-weight="700" fill="#F3EEE4" font-family="Arial">' + L + '</text>'; });
  return s + '</svg>';
}
function artSVG(id) { return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Артефакт">' + (ART[id] || ART.golden_man) + '</svg>'; }

window.TR_TRACKS = { mapSVG, artSVG };
})();
