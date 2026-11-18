(() => {
  const headings = ["Escolha a duração","Personalize e escolha a entrega","Revise seu pedido","Simulação concluída"];
  const actions = ["Continuar para entrega","Revisar pedido","Ir para pagamento","Fechar"];
  const currency = new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
  const brazilDay = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"});
  const dateLabel = value => value.split("-").reverse().join("/");
  const value = (form,name) => form.elements.namedItem(name).value.trim();
  const set = (form,selector,text) => { form.querySelector(selector).textContent = text; };

  function cardText(form, selector, text) {
    const target = form.querySelector(selector);
    target.textContent = text;
    target.hidden = !text;
  }

  function sync(form) {
    const selected = form.querySelector("[name=option_id]:checked");
    const {title,price,rules,validity} = selected.dataset;
    form.elements.delivery_on.min = brazilDay.format(new Date());
    const recipient = value(form,"recipient");
    const buyer = value(form,"buyer_name");
    cardText(form,"[data-card-recipient]",recipient ? "Para " + recipient : "");
    cardText(form,"[data-card-sender]",buyer ? "De " + buyer : "");
    cardText(form,"[data-card-message]",value(form,"message"));
    set(form,"[data-gift-preview] .art-title",title);
    set(form,"[data-total]",currency.format(Number(price)/100));
    set(form,"[data-review-title]",title);
    set(form,"[data-review-buyer]",buyer);
    set(form,"[data-review-destination]",recipient);
    set(form,"[data-review-phone]",value(form,"recipient_phone"));
    set(form,"[data-review-date]",dateLabel(value(form,"delivery_on")));
    cardText(form,"[data-review-rules]",rules);
    cardText(form,"[data-review-validity]",validity ? "Validade mínima de "+validity+" dias a partir da data escolhida." : "");
  }

  function show(form,step) {
    form.dataset.step = step;
    form.querySelectorAll("[data-purchase-panel]").forEach((panel,i) => { panel.hidden = i!==step; });
    form.querySelectorAll(".purchase-steps li").forEach((indicator,i) => {
      if (step === i) indicator.setAttribute("aria-current","step");
      else indicator.removeAttribute("aria-current");
    });
    set(form,"[data-step-title]",headings[step]);
    const preview = form.hasAttribute("data-preview-form");
    set(form,"[data-next] span",step===2 && preview ? "Simular pagamento" : actions[step]);
    form.querySelector("[data-previous]").hidden = step===0 || step===3;
    set(form,".form-status","");
    sync(form);
    form.querySelector(".purchase-columns").scrollTop = 0;
    form.querySelector("[data-step-title]").focus();
  }

  function validateStep(form,step) {
    const panel = form.querySelectorAll("[data-purchase-panel]")[step];
    for (const field of panel.querySelectorAll("input, textarea")) {
      if (field.disabled) continue;
      let message = "";
      if (field.required && field.type!=="radio" && !field.value.trim()) message = "Preencha este campo.";
      if (!message && field.type==="tel") {
        const digits = field.value.replace(/[ ()+.-]/g,"");
        if (!/^(?:55)?[1-9][0-9](?:9[0-9]{8}|[2-5][0-9]{7})$/.test(digits)) message = "Informe um WhatsApp brasileiro com DDD.";
      }
      field.setCustomValidity(message);
      if (!field.reportValidity()) return false;
    }
    return true;
  }

  document.addEventListener("input",event => {
    const form = event.target.closest("form[data-checkout]");
    if (!form) return;
    event.target.setCustomValidity?.("");
    sync(form);
  });

  document.addEventListener("submit",event => {
    const form = event.target.closest("form[data-checkout]");
    if (!form) return;
    event.preventDefault();
    if (form.getAttribute("aria-busy")==="true") return;
    const step = Number(form.dataset.step);
    if (step < 2) {
      if (validateStep(form,step)) show(form,step+1);
      return;
    }
    if (step===3) {
      form.closest("dialog").close();
      return;
    }
    if (form.hasAttribute("data-preview-form")) {
      set(form,"[data-preview-result]","O cartão de " + value(form,"buyer_name") + " seria enviado a " + value(form,"recipient") + " em " + dateLabel(value(form,"delivery_on")) + ".");
      show(form,3);
      return;
    }
    const data = Object.fromEntries(new FormData(form));
    data.price_cents = Number(form.querySelector("[name=option_id]:checked").dataset.price);
    form.dispatchEvent(new CustomEvent("gifts:checkout",{detail:data}));
  });

  document.addEventListener("click",event => {
    const open = event.target.closest("[data-preview-open]");
    const close = event.target.closest("[data-close]");
    const previous = event.target.closest("[data-previous]");
    if (open) {
      const dialog = document.getElementById(open.dataset.previewOpen);
      const form = dialog.querySelector("form[data-checkout]");
      form.reset();
      dialog.showModal();
      show(form,0);
    } else if (close) close.closest("dialog").close();
    else if (previous) {
      const form = previous.closest("form[data-checkout]");
      show(form,Number(form.dataset.step)-1);
    }
  });
})();
