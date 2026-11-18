import config from "./config.js";
import { api, emailGiftAccess, confirmGiftAccess } from "./api.js";
import { findProduct, landing } from "./landing.js";
import { purchase } from "./purchase.js";
import { date, esc, giftArt, icon } from "./ui.js";

const view = document.querySelector("#site");
const path = location.pathname;
const query = new URLSearchParams(location.search);
const validTheme = theme => ["natal","regular"].includes(theme);
const isolatedPage = title => {
  document.title = title + " — Montreal Gifts";
  const robots = document.createElement("meta");
  robots.name = "robots";
  robots.content = "noindex,nofollow";
  document.head.append(robots);
};

export function header() {
  return '<header class="topbar shell"><a href="/" class="brand" aria-label="Montreal Gifts"><img src="/assets/logo-ink.svg" alt="Montreal Tênis" width="150" height="27"><span>Gifts</span></a></header>';
}

function simple(title, body) {
  view.innerHTML = header() + '<main class="simple-page shell" id="conteudo" tabindex="-1"><h1>' + esc(title) + '</h1>' + body + '</main>';
}

function showError(title,message) {
  simple(title,'<p>' + esc(message) + '</p><a class="text-link" href="/">Voltar ao Montreal Gifts ' + icon("arrow") + '</a>');
}

async function storefront() {
  const requested = query.get("theme");
  const preview = path === "/preview" || path.startsWith("/preview/");
  const localPreview = config.localPreview && validTheme(requested);
  let data;
  if (preview && !validTheme(requested)) return showError("Prévia indisponível","Escolha uma campanha no painel.");
  try {
    data = localPreview ? {active:requested,products:[]} :
      await api(preview ? "/admin/preview?theme=" + requested : "/catalog",{authorized:preview});
  } catch (error) {
    if (preview) return showError("Prévia indisponível",error.message);
    data = {active:"natal",products:[],error:true};
  }
  const campaign = validTheme(data.active) ? data.active : "natal";
  view.innerHTML = landing({campaign,catalog:data,preview:preview || localPreview});
  if (data.testing) {
    const notice = document.createElement("p");
    notice.className = "notice shell";
    notice.textContent = "Compra de teste. Use a conta compradora e o saldo de teste do Mercado Pago.";
    view.prepend(notice);
  }
  const dialog = document.querySelector("#purchase");
  view.addEventListener("click",event => {
    const button = event.target.closest("[data-product]");
    if (!button || button.disabled) return;
    const product = findProduct(button.dataset.product,data,preview || localPreview);
    if (product?.options.length) openPurchase(dialog,product,campaign,preview || localPreview);
  });
}

function openPurchase(dialog, product, campaign, preview) {
  dialog.innerHTML = purchase(product,preview);
  dialog.setAttribute("aria-labelledby","purchase-title-"+product.id);
  const form = dialog.querySelector("form");
  const result = form.querySelector(".form-status");

  form.addEventListener("gifts:checkout",async event => {
    form.setAttribute("aria-busy","true");
    const buttons = Array.from(form.querySelectorAll("button"));
    for (const button of buttons) button.disabled = true;
    result.textContent = "Preparando o pagamento…";
    try {
      const values = {...event.detail,product_id:product.id,campaign,theme:"regular"};
      const key = new TextEncoder().encode(JSON.stringify(values));
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",key)), byte => byte.toString(16).padStart(2,"0")).join("");
      const storageKey = "mg-checkout:" + hash;
      form.dataset.checkoutKey = storageKey;
      const id = sessionStorage.getItem(storageKey) || crypto.randomUUID();
      sessionStorage.setItem(storageKey,id);
      const order = await api("/checkout",{body:{...values,request_id:id}});
      location.assign(order.checkout_url || "/pedido/?s="+encodeURIComponent(order.order_status_token));
    } catch (error) {
      if (error.code === "checkout_expired") sessionStorage.removeItem(form.dataset.checkoutKey);
      result.textContent = error.message;
      for (const button of buttons) button.disabled = false;
      form.removeAttribute("aria-busy");
    }
  });
  dialog.showModal();
  form.querySelector("[data-step-title]").focus();
}

function giftLogin(token,email="",sent=false) {
  simple("Abra seu Montreal Gift",`<p>${sent ? "Digite o código que enviamos para " + esc(email) + "." : "Entre ou crie sua conta com e-mail para ver o código do seu presente."}</p>
    <form class="card-access" id="gift-login">
      ${sent ? '<label>Código de acesso <input name="code" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6,10}" required></label>' :
        '<label>Seu e-mail <input name="email" type="email" autocomplete="email" maxlength="254" required></label>'}
      <button class="button primary">${sent ? "Abrir meu presente" : "Enviar código por e-mail"}</button>
      ${sent ? '<button type="button" class="button outline" id="change-email">Voltar ao e-mail</button>' : ""}
      <p role="status"></p>
    </form>`);
  const form = document.querySelector("#gift-login");
  if (!sent) form.elements.email.value = email;
  document.querySelector("#change-email")?.addEventListener("click",()=>giftLogin(token,email));
  form.onsubmit = async event => {
    event.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      if (sent) {
        await confirmGiftAccess(email,form.elements.code.value);
        await showGift(token);
      } else {
        const address = form.elements.email.value.trim();
        await emailGiftAccess(address);
        giftLogin(token,address,true);
      }
    } catch (error) { form.querySelector('[role="status"]').textContent = error.message; }
    finally { button.disabled = false; }
  };
}

async function cardPage() {
  isolatedPage("Seu presente");
  const token = path.split("/")[2];
  if (!/^[a-f0-9]{64}$/.test(token ?? "")) return showError("Cartão indisponível","Confira se você abriu o link completo.");
  await showGift(token);
}

async function showGift(token) {
  simple("Seu Montreal Gift",'<p role="status">Carregando seu cartão…</p>');
  try {
    const card = await api("/card/"+token,{gift:true});
    simple("Seu Montreal Gift",`<div class="card-content">
      ${giftArt(card)}
      <div class="card-actions">
        ${card.redemption_url ? '<a class="button primary" rel="noreferrer" href="'+esc(card.redemption_url)+'">Resgatar meu presente '+icon("diagonal")+'</a>' : ""}
        <button class="button outline" id="copy-code">${icon("copy")} Copiar código</button>
        <button class="button outline" id="share-card">${icon("share")} Compartilhar</button>
        ${card.image_ready ? '<button class="button outline" id="save-card">Salvar imagem '+icon("down")+'</button>' : ""}
      </div>
      <p role="status" id="card-feedback"></p>
      ${card.redemption_url ? '<p class="field-help">O Matchpoint pode pedir login ou cadastro para concluir o resgate.</p>' : ""}
    </div>`);
    const feedback = document.querySelector("#card-feedback");
    document.querySelector("#save-card")?.addEventListener("click",async ()=>{
      try {
        const response = await api("/card/"+token+"/png",{gift:true,raw:true});
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement("a");
        link.href = url;
        link.download = "montreal-gift.png";
        link.click();
        setTimeout(()=>URL.revokeObjectURL(url),30000);
      } catch (error) { feedback.textContent = error.message; }
    });
    document.querySelector("#copy-code").onclick = async () => {
      try {
        await navigator.clipboard.writeText(card.code);
        feedback.textContent = "Código copiado.";
      } catch {
        const range = document.createRange();
        range.selectNodeContents(document.querySelector(".art-bottom strong"));
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        feedback.textContent = "Código selecionado. Use o menu do seu navegador para copiar.";
      }
    };
    document.querySelector("#share-card").onclick = async () => {
      try {
        if (navigator.share) await navigator.share({title:"Seu Montreal Gift",url:location.href});
        else {
          await navigator.clipboard.writeText(location.href);
          feedback.textContent = "Link copiado para compartilhar.";
        }
      } catch (error) {
        if (error.name !== "AbortError") feedback.textContent = "Você também pode copiar o endereço desta página.";
      }
    };
  } catch (error) {
    if (error.status===401) giftLogin(token);
    else showError("Cartão indisponível",error.status === 404 ? "Confira o link e a validade do cartão." : "Tente abrir o cartão novamente em instantes.");
  }
}

async function orderPage() {
  isolatedPage("Acompanhe seu pedido");
  const token = query.get("s") ?? "";
  if (!/^[a-f0-9-]{36}$/i.test(token)) return showError("Pedido indisponível","Confira o link recebido após o checkout.");
  history.replaceState(null,"","/pedido/?s="+encodeURIComponent(token));
  simple("Acompanhe seu pedido",'<p id="status-text" role="status">Consultando pagamento…</p><button class="button outline" id="refresh">Atualizar status</button>');
  const refresh = document.querySelector("#refresh");
  const status = document.querySelector("#status-text");
  const messages = {
    pending:"Aguardando confirmação do Mercado Pago. Você pode fechar esta página.",
    approved:"Pagamento aprovado. Você receberá o cartão no seu WhatsApp após a emissão.",
    rejected:"O Mercado Pago informou que o pagamento não foi concluído.",
    refunded:"O pagamento foi estornado.",
    disputed:"O pagamento está em análise.",
    review:"Seu pedido está em análise pela Montreal."
  };
  refresh.onclick = async () => {
    refresh.disabled = true;
    try {
      const order = await api("/status/" + token);
      const approvedDirect = order.status==="approved" && order.delivery_mode==="recipient";
      const message = approvedDirect && order.delivery_on ? "Pagamento aprovado. Envio ao presenteado em " + date(order.delivery_on) + ", após a liberação do cartão." :
        approvedDirect ? "Pagamento aprovado. Após a emissão, o cartão será enviado ao WhatsApp do presenteado." : messages[order.status];
      status.textContent = "Pedido " + order.number + ". " + (message || "Consulte novamente em instantes.");
    } catch (error) { status.textContent = error.message; }
    finally { refresh.disabled = false; }
  };
  await refresh.onclick();
}

if (path.startsWith("/admin/") || path === "/admin") {
  isolatedPage("Painel");
  const { mountAdmin } = await import("./admin.js");
  mountAdmin(view,header,query);
} else if (path.startsWith("/card/")) await cardPage();
else if (path === "/pedido" || path.startsWith("/pedido/")) await orderPage();
else if (path === "/" || path === "/index.html" || path === "/preview" || path.startsWith("/preview/")) await storefront();
else showError("Página indisponível","Confira o endereço e tente novamente.");
