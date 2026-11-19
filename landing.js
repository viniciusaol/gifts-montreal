import { allowedImage, esc, giftArt, icon, money } from "./ui.js";
import { purchase } from "./purchase.js";

function sampleOptions(id,prices,experience) {
  return prices.map((price,index) => ({
    id:id+"-"+(index+1)+"h",
    hours:index+1,
    title:(index===0 ? "1 hora" : (index+1)+" horas")+" de "+experience,
    price_cents:price
  }));
}

const products = [
  {
    id:"quadra", name:"Locação de quadra", description:"Presenteie com tempo de jogo no saibro. Escolha de 1 a 4 horas.",
    image:"/assets/presente-quadra.webp", alt:"Raquete e bolas de tênis no saibro",
    options:sampleOptions("quadra",[11500,23000,34500,46000],"locação de quadra")
  },
  {
    id:"aula", name:"Aula particular", description:"Uma experiência com um professor da Montreal. Escolha 1 ou 2 horas.",
    image:"/assets/presente-aula.webp", alt:"Professora demonstrando uma empunhadura de tênis",
    options:sampleOptions("aula",[22000,44000],"aula particular")
  }
];

export function findProduct(id,catalog,preview) {
  const base = products.find(product => product.id===id);
  if (!base) return null;
  const remote = catalog.products.find(product => product.id===id);
  const offers = remote?.options?.length ? remote.options : (preview ? base.options : []);
  return {...base,...remote,defaultImage:base.image,options:preview ? offers : offers.filter(option => option.available)};
}

const campaigns = {
  natal: {
    eyebrow:"NATAL NA MONTREAL",
    title:"Neste Natal,<br>presenteie<br><em>com tênis.</em>",
    subtitle:"Surpreenda amigos, familiares e clientes que adoram tênis com uma experiência na Montreal.",
    image:"/assets/campanha-natal.webp",
    alt:"Presentes de Natal com laços, uma raquete, bolas de tênis, ramos de pinheiro e luzes",
    section:"Escolha o presente.",
    previewTitle:"Um cartão com a sua mensagem."
  },
  regular: {
    eyebrow:"MONTREAL GIFTS",
    title:"Presenteie<br><em>com tênis.</em>",
    subtitle:"Para quem adora tênis e para quem você quer trazer para a quadra. Presenteie amigos, família ou clientes com uma experiência na Montreal.",
    image:"/assets/campanha-regular.webp",
    alt:"Dois amigos conversam no banco com uma raquete de tênis apoiada ao lado",
    section:"Duas formas de viver o tênis.",
    previewTitle:"Um presente com o seu toque."
  }
};

const legacyImages = new Set(["/assets/quadra.jpg","/assets/saibro.jpg"]);

function productTile(product, review) {
  const from = product.options.length ? Math.min(...product.options.map(option => option.price_cents)) : null;
  const picture = legacyImages.has(product.image) ? product.defaultImage : allowedImage(product.image, product.defaultImage);
  const alt = picture === product.defaultImage ? product.alt : product.name;
  const openDialog = review ? ' data-preview-open="purchase-' + product.id + '"' : "";
  return `<article class="product">
    <img src="${esc(picture)}" alt="${esc(alt)}" loading="lazy" width="960" height="640">
    <div class="product-info"><h3>${esc(product.name)}</h3><p>${esc(product.description)}${product.id === "aula" ? " O agendamento depende da disponibilidade do professor." : ""}</p>
      <div class="product-action">
        <span>${from === null ? "Venda indisponível" : "A partir de " + money(from)}</span>
        <button class="button outline" type="button" data-product="${product.id}"${openDialog} ${product.options.length ? "" : "disabled"}>Escolher duração ${icon("diagonal")}</button>
      </div>
    </div>
  </article>`;
}

export function landing({ campaign, catalog, preview, review = false }) {
  const copy = campaigns[campaign];
  const natal = campaign === "natal";
  const custom = catalog.copy ?? {};
  const heading = custom.title ? esc(custom.title) : copy.title;
  const offers = products.map(product => findProduct(product.id,catalog,preview));
  const otherCampaign = natal ? '<a href="regular.html">Ver versão Regular</a>' : '<a href="natal.html">Ver versão Natal</a>';
  const previewLink = review ? otherCampaign : '<a href="/admin/">Voltar ao painel</a>';
  return `<div class="landing ${campaign}">
    ${preview ? `<div class="preview-bar"><div class="shell"><span>Prévia da campanha ${natal ? "Natal" : "Regular"}</span>${previewLink}</div></div>` : ""}
    <header class="topbar shell">
      <a href="${review ? "#conteudo" : "/"}" class="brand" aria-label="Montreal Gifts"><img src="/assets/logo-ink.svg" alt="Montreal Tênis" width="150" height="27"><span>Gifts</span></a>
      <nav aria-label="Principal"><a class="nav-how" href="#como-funciona">Como funciona</a><a class="button nav-cta" href="#experiencias" aria-label="Escolher presente">${icon("gift")} <span>Escolher presente</span></a></nav>
    </header>
    <main id="conteudo" tabindex="-1">
      <section class="hero">
        <div class="hero-content">
          <span class="eyebrow">${copy.eyebrow}</span>
          <h1>${heading}</h1>
          <p>${esc(custom.subtitle || copy.subtitle)}</p>
          <a class="button primary hero-cta" href="#experiencias">${esc(custom.cta || "Escolher meu presente")}${icon("arrow")}</a>
        </div>
        <div class="hero-image">
          <img src="${copy.image}" alt="${copy.alt}" width="1440" height="960" fetchpriority="high">
        </div>
      </section>
      <section class="selection shell" id="experiencias">
        <div class="section-heading"><h2>${copy.section}</h2></div>
        ${catalog.error && !preview ? '<p class="notice" role="status">O catálogo está indisponível no momento. Volte mais tarde para comprar seu presente.</p>' : ""}
        <div class="products">${offers.map(product => productTile(product, review)).join("")}</div>
      </section>
      <section class="how" id="como-funciona">
        <div class="shell"><h2>Como funciona</h2>
          <ol class="steps">
            <li><span>${icon("ball")}</span><h3>Escolha a experiência</h3><p>Escolha a duração da locação ou da aula particular.</p></li>
            <li><span>${icon("pen")}</span><h3>Personalize o cartão</h3><p>Escreva uma mensagem e indique para qual WhatsApp vai o presente.</p></li>
            <li><span>${icon("gift")}</span><h3>Pague e presenteie</h3><p>Após a confirmação e a liberação, o presenteado recebe o cartão e as instruções pelo WhatsApp na data escolhida.</p></li>
          </ol>
        </div>
      </section>
      <section class="preview-section shell">
        <div class="preview-display">${giftArt({recipient:"quem você quiser",product:"Locação de quadra"})}</div>
        <div><h2>${copy.previewTitle}</h2><p>Acrescente uma mensagem, indique quem vai receber e escolha a data do envio. O cartão chega ao WhatsApp do presenteado no seu nome.</p><a class="text-link" href="#experiencias">Escolher experiência ${icon("arrow")}</a></div>
      </section>
      <section class="usage shell" aria-labelledby="utilizacao">
        <h2 id="utilizacao">Como usar o presente</h2>
        <div>
          <details><summary>Como o presenteado recebe o código? ${icon("plus")}</summary><p>O presenteado recebe o código na imagem do cartão e na mensagem do WhatsApp, junto com o link de resgate e as instruções. Quem receber o presente deverá entrar ou criar uma conta no Matchpoint para resgatar.</p></details>
          <details><summary>Como o presenteado usa a locação de quadra? ${icon("plus")}</summary><p>Após o resgate, o valor fica disponível como voucher na conta de quem resgatar o presente. O presenteado escolhe o horário e a quadra e seleciona pagar com voucher na etapa de pagamento da reserva. Reservas sujeitas à disponibilidade.</p></details>
          <details><summary>Como o presenteado agenda a aula particular? ${icon("plus")}</summary><p>Após o resgate, a aula fica disponível como voucher na conta de quem resgatar o presente. O presenteado deverá entrar em contato com a <a href="https://wa.me/5541936183407">secretaria pelo +55 41 93618-3407</a> para agendar com um professor, conforme a disponibilidade.</p></details>
          <details><summary>Qual é a validade? ${icon("plus")}</summary><p>A validade para uso do voucher é de 6 meses. Após o resgate, o presenteado poderá conferir a data de vencimento na conta do Matchpoint.</p></details>
        </div>
      </section>
    </main>
    <footer class="footer"><div class="shell"><img src="/assets/logo-cream.svg" alt="Montreal Tênis" width="150" height="27"><a href="https://montrealtenis.com.br/">Site da Montreal ${icon("diagonal")}</a></div></footer>
    ${review ? offers.map(product => `<dialog id="purchase-${product.id}" aria-labelledby="purchase-title-${product.id}">${purchase(product,true)}</dialog>`).join("") : '<dialog id="purchase"></dialog>'}
  </div>`;
}

