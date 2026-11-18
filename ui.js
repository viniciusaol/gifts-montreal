export const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);

const shapes = {
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  diagonal: '<path d="M6 18 18 6M8 6h10v10"/>',
  down: '<path d="M12 4v15m-6-6 6 6 6-6"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8H8.5A2.5 2.5 0 1 1 11 5.5L12 8Zm0 0h3.5A2.5 2.5 0 1 0 13 5.5L12 8Z"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6a9 9 0 0 1 0 12.8m12.8-12.8a9 9 0 0 0 0 12.8"/>',
  pen: '<path d="m4 20 4.5-1 11-11-3.5-3.5-11 11L4 20Zm9.5-13.5L17 10m-6 10h9"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 5H6a2 2 0 0 0-2 2v9"/>',
  share: '<path d="M12 15V3m-4 4 4-4 4 4M6 11H4v10h16V11h-2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 5 5L20 7"/>'
};

export function icon(name) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + shapes[name] + '</svg>';
}

export function allowedImage(value, fallback) {
  return /^(\/assets\/[\w.-]+|https:\/\/[^\s]+)$/.test(value ?? "") ? value : fallback;
}

export const money = cents => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL"
}).format(cents / 100);
export const date = iso => new Intl.DateTimeFormat("pt-BR", {timeZone:"UTC"}).format(new Date(iso));

export function giftArt({ product = "Uma experiência em quadra", recipient = "", sender = "", message = "", code = "", expiry = "", rules = "" } = {}) {
  return `<div class="gift-art">
    <div class="art-top"><img src="/assets/logo-cream.svg" alt="Montreal Tênis" width="150" height="27"><span>GIFT CARD</span></div>
    <div class="art-body">
      <p class="art-recipient" data-card-recipient ${recipient ? "" : "hidden"}>${recipient ? "Para " + esc(recipient) : ""}</p>
      <p class="art-recipient" data-card-sender ${sender ? "" : "hidden"}>${sender ? "De " + esc(sender) : ""}</p>
      <p class="art-title">${esc(product)}</p>
      <p class="art-message" data-card-message ${message ? "" : "hidden"}>${esc(message)}</p>
    </div>
    <div class="art-bottom">
      <div><span>${code ? "Código do presente" : "Prévia do código"}</span><strong>${esc(code || "•••• ••••")}</strong></div>
      <span>${expiry ? "Válido até " + date(expiry) : "Montreal Gifts"}</span>
    </div>
    ${rules ? '<p class="art-rules"><strong>Como usar</strong>' + esc(rules) + '</p>' : ""}
  </div>`;
}
