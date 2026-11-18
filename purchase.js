import { esc, giftArt, icon, money } from "./ui.js";

const steps = ["Experiência","Cartão e entrega","Revisão"];
const duration = hours => hours === 1 ? "1 hora" : hours + " horas";

function optionChoice(option,index) {
  return `<label class="checkout-choice duration-choice">
    <input type="radio" name="option_id" value="${esc(option.id)}" ${index===0 ? "checked" : ""} required
      data-title="${esc(option.title)}" data-price="${option.price_cents}" data-rules="${esc(option.rules)}" data-validity="${esc(option.validity_days)}">
    <span><strong>${duration(option.hours)}</strong></span><span class="choice-price">${money(option.price_cents)}</span>
  </label>`;
}

export function purchase(product, preview) {
  const first = product.options[0];
  return `<form class="purchase-form" data-checkout data-step="0" ${preview ? "data-preview-form" : ""} novalidate>
    <div class="purchase-head">
      <div><p class="eyebrow">${esc(product.name)}</p><h2 id="purchase-title-${product.id}" data-step-title tabindex="-1">Escolha a duração</h2></div>
      <button type="button" class="icon-button" data-close aria-label="Fechar">${icon("close")}</button>
    </div>
    <ol class="purchase-steps" aria-label="Etapas da compra">${steps.map((step,i) =>
      `<li ${i===0 ? 'aria-current="step"' : ""}><span aria-hidden="true">${i+1}</span>${step}</li>`
    ).join("")}</ol>
    <div class="purchase-columns">
      <div class="purchase-flow">
        <section class="purchase-fields" data-purchase-panel aria-label="Experiência">
          <fieldset class="purchase-choices">
            <legend>Duração do presente</legend>
            ${product.options.map(optionChoice).join("")}
          </fieldset>
          ${product.id === "aula" ? '<p class="field-help">A aula precisa ser agendada conforme a disponibilidade do professor.</p>' : ""}
        </section>
        <section class="purchase-fields" data-purchase-panel aria-label="Cartão e entrega" hidden>
          <input type="hidden" name="delivery_mode" value="recipient">
          <fieldset class="purchase-contact">
            <legend>Quem vai receber o presente</legend>
            <label>Nome <input name="recipient" required maxlength="45"></label>
            <label>WhatsApp <input name="recipient_phone" type="tel" inputmode="tel" placeholder="(41) 99999-9999" required maxlength="24"></label>
            <label class="full-row">Data do envio <input name="delivery_on" type="date" required></label>
            <p class="field-help full-row">O presente será enviado no seu nome, pelo WhatsApp, a partir das 9h da data escolhida (horário de Brasília). Se o cartão ainda estiver em preparação, o envio será feito após a liberação.</p>
          </fieldset>
          <fieldset class="purchase-contact">
            <legend>Seus dados</legend>
            <label>Seu nome <input name="buyer_name" autocomplete="name" required maxlength="100"></label>
            <label>Seu WhatsApp <input name="buyer_phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="(41) 99999-9999" required maxlength="24"></label>
            <label class="full-row"><span>Seu e-mail <small>(opcional)</small></span><input type="email" name="buyer_email" autocomplete="email" maxlength="254"></label>
            <p class="field-help full-row">Usamos seu WhatsApp para confirmar a compra. Seu nome aparece no presente.</p>
          </fieldset>
          <label><span>Sua mensagem <small>(opcional)</small></span><textarea name="message" rows="2" maxlength="140"></textarea></label>
        </section>
        <section class="purchase-fields" data-purchase-panel aria-label="Revisão" hidden>
          <dl class="purchase-review">
            <div><dt>Experiência</dt><dd data-review-title></dd></div>
            <div><dt>Comprador</dt><dd data-review-buyer></dd></div>
            <div><dt>Entrega do cartão</dt><dd data-review-destination></dd></div>
            <div><dt>WhatsApp de entrega</dt><dd data-review-phone></dd></div>
            <div><dt>Data do envio</dt><dd data-review-date></dd></div>
          </dl>
          <p class="field-help">Quem receber o presente acessa o link enviado no WhatsApp e entra ou cria uma conta no Matchpoint para resgatar.</p>
          <p class="field-help" data-review-rules hidden></p>
          <p class="field-help" data-review-validity hidden></p>
          ${preview ? '<p class="notice">Esta prévia simula o pagamento e a entrega.</p>' :
            '<p class="field-help">Você paga com Pix ou cartão pelo Mercado Pago.</p>'}
        </section>
        ${preview ? `<section class="purchase-fields" data-purchase-panel aria-label="Simulação concluída" hidden>
          <p data-preview-result></p><p class="field-help">Em uma compra real, o envio respeita a data escolhida e depende da liberação do cartão.</p>
        </section>` : ""}
      </div>
      <aside class="purchase-summary" aria-label="Prévia do cartão">
        <div data-gift-preview>${giftArt({product:first.title})}</div>
      </aside>
    </div>
    <div class="purchase-footer">
      <p class="form-status" aria-live="polite"></p>
      <div class="purchase-nav">
        <button class="button outline" type="button" data-previous hidden>Voltar</button>
        <div class="purchase-total"><span>Total</span><strong data-total>${money(first.price_cents)}</strong></div>
        <button class="button primary" type="submit" data-next><span>Continuar para entrega</span>${icon("arrow")}</button>
      </div>
    </div>
  </form>`;
}
