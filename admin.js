import { api, hasSession, signIn, signOut } from "./api.js";
import { date, esc, icon, money } from "./ui.js";

const stages = {
  awaiting_payment:"Aguardando pagamento",awaiting_issue:"Aguardando baixa no TPC",processing:"Em processamento",
  issued:"Emitido",delivered:"Enviado",error:"Revisão necessária",rejected:"Pagamento recusado"
};
const payments = {pending:"Pendente",approved:"Aprovado",rejected:"Recusado",refunded:"Estornado",disputed:"Em disputa"};
const tpcList = "https://app-montrealtenisclubeltda-br.matchpoint.com.es/Tarifas/ListadoGiftCardsBonos.aspx";
const tpcDetail = "https://app-montrealtenisclubeltda-br.matchpoint.com.es/Tarifas/FichaGiftCardBono.aspx";
const jobs = {internal:"Aviso interno",confirmation:"Confirmação ao comprador",render:"Geração do PNG",deliver:"Envio do cartão",resend:"Reenvio"};
const states = {pending:"Na fila",running:"Em processamento",done:"Concluído",error:"Erro",uncertain:"Envio em revisão",cancelled:"Cancelado"};
const tpcStates = {idle:"Reservado",pending:"Aguardando sessão do TPC",checking:"Conferindo no TPC",verification:"Aguardando nova consulta",confirmed:"Cobrado",uncertain:"Resultado em revisão",review:"Revisão necessária"};
const events = {
  order_created:"Pedido criado", payment_approved:"Pagamento aprovado", payment_pending:"Pagamento pendente",
  payment_rejected:"Pagamento recusado", payment_refunded:"Pagamento estornado", payment_disputed:"Pagamento em disputa",
  payment_mismatch:"Divergência no pagamento", duplicate_approved_payment:"Pagamento aprovado duplicado",
  manual_code_confirmed:"Código do TPC registrado", resend_requested:"Reenvio solicitado",job_retried:"Retentativa solicitada",
  stock_reserved:"Cartão reservado",stock_assigned:"Cartão atribuído ao pagamento",stock_released_unused:"Reserva expirada",
  stock_released_reconciled:"Reserva liberada após conciliação",tpc_sync_started:"Conferência no TPC iniciada",
  tpc_mark_started:"Tentativa de baixa registrada",tpc_stock_confirmed:"Baixa confirmada no TPC",
  tpc_sync_review:"Baixa enviada para revisão",tpc_verification_requested:"Nova conferência solicitada"
};
const metricNames = {total:"Vendas aprovadas",revenue:"Receita confirmada",awaiting_payment:"Aguardando pagamento",
  awaiting_issue:"Aguardando emissão",processing:"Em processamento",issued:"Emitidos",delivered:"Enviados",
  error:"Com erro",manual:"Intervenção manual"};
const moneyText = value => value == null ? "—" : money(value);
const number = value => "MG-" + String(value).padStart(6,"0");
const timestamp = value => value ? new Intl.DateTimeFormat("pt-BR", {dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(value)) : "—";
const orderUrl = id => "/admin/?order="+encodeURIComponent(id);
const eventLabel = key => {
  if (events[key]) return events[key];
  const [kind,step] = key.split("_");
  return jobs[kind] ? jobs[kind] + " · " + ({started:"Iniciado",done:"Concluído",pending:"Retentativa",uncertain:"Em revisão",error:"Erro",cancelled:"Cancelado"}[step] || step) : key;
};
const rowTable = (head, rows) => `<div class="table-scroll"><table><thead><tr>${head.map(item=>"<th scope='col'>"+esc(item)+"</th>").join("")}</tr></thead>
  <tbody>${rows.map(row=>"<tr>"+row.map(value=>"<td>"+value+"</td>").join("")+"</tr>").join("")}</tbody></table></div>`;
const label = (name,key,value="",type="text",attrs="") => `<label>${name}<input type="${type}" name="${key}" value="${esc(value)}" ${attrs}></label>`;
const textarea = (name,key,value="",max=230) => `<label>${name}<textarea name="${key}" maxlength="${max}" rows="3">${esc(value)}</textarea></label>`;
const statusLine = '<p class="form-status" role="status"></p>';
const defaultForm = form => Object.fromEntries(new FormData(form));

function stockRows(value) {
  const lines = value.replace(/^\uFEFF/,"").trim().split(/\r?\n/).filter(line=>line.trim());
  const separator = lines[0]?.includes(";") ? ";" : ",";
  const fields = line=>line.split(separator).map(value=>value.trim().replace(/^"(.*)"$/,"$1"));
  const columns = fields(lines.shift() ?? "");
  const validHeaders = ["code","code;document;expiry","tpc_id;code;document;expiry"];
  if (!validHeaders.includes(columns.join(";")) || !lines.length) throw new Error("Use o cabeçalho code, code;document;expiry ou tpc_id;code;document;expiry e informe os cartões abaixo.");
  return lines.map(line=>{
    const values = fields(line);
    if (values.length!==columns.length) throw new Error("Confira se cada linha tem os campos do cabeçalho.");
    return Object.fromEntries(columns.map((field,i)=>[field,values[i]]));
  });
}

export function mountAdmin(view,header,query) {
  let filter = new URLSearchParams();
  let current = "orders";
  const wrap = html => {
    view.innerHTML = header() + `<main id="conteudo" class="admin shell" tabindex="-1">${html}</main>`;
    return view.querySelector("main");
  };
  const toolbar = `<div class="admin-toolbar"><h1>Painel de pedidos</h1><div class="admin-actions">
    <a class="button outline" href="/admin/">Pedidos</a><a class="button outline" href="/admin/?settings=1">Configurações</a>
    <button class="button outline" data-logout>Sair</button></div></div>`;
  const secured = (path,options={}) => api(path,{...options,authorized:true});

  function login(message = "") {
    const page = wrap(`<h1>Painel Montreal Gifts</h1><form class="admin-form admin-login">
      <label>E-mail<input name="email" type="email" autocomplete="username" required></label>
      <label>Senha<input type="password" name="password" autocomplete="current-password" required></label>
      <button class="button primary">Entrar</button>${statusLine}</form>`);
    const status = page.querySelector(".form-status");
    status.textContent = message;
    page.querySelector("form").onsubmit = async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector("button");
      button.disabled = true;
      const values = defaultForm(form);
      try {
        await signIn(values.email,values.password);
        form.reset();
        await show();
      } catch(error) {
        status.textContent = error.message;
        button.disabled = false;
      }
    };
  }

  function screen(html) {
    const page = wrap(toolbar + html);
    page.querySelector("[data-logout]").onclick = () => { signOut(); login(); };
    return page;
  }

  async function fails(error) {
    if ([401,403].includes(error.status)) login(error.message);
    else {
      const page = screen('<p class="notice" role="alert">'+esc(error.message)+'</p><button class="button outline" data-retry>Tentar novamente</button>');
      page.querySelector("[data-retry]").onclick = show;
    }
  }

  async function overview() {
    const {orders,total,metrics,page} = await secured("/admin/orders?"+filter);
    const options = Object.entries(stages).map(([key,text]) => '<option value="'+key+'"'+(filter.get("stage")===key?" selected":"")+'>'+text+'</option>').join("");
    const list = orders.length ? rowTable(["Pedido","Comprador","WhatsApp","Experiência","Valor","Pagamento","Emissão","Código TPC","Envio","Compra"],orders.map(order=>[
      '<a href="'+orderUrl(order.id)+'">'+number(order.number)+'</a>',esc(order.buyer_name || "—"),esc(order.buyer_phone || "—"),esc(order.product_name),money(order.price_cents),
      esc(payments[order.payment_status]),esc(order.processing ? stages.processing : stages[order.stage]),esc(order.code || "—"),order.sent_at ? "Enviado" : "Pendente",timestamp(order.created_at)
    ])) : "<p>Nenhum pedido neste filtro.</p>";
    const doc = screen(`<form id="filters" class="admin-filters">
      ${label("De","from",filter.get("from"),"date")}
      ${label("Até","until",filter.get("until"),"date")}
      <label>Status<select name="stage"><option value="">Todos</option>${options}</select></label>
      <button class="button primary">Filtrar</button><button type="button" id="export" class="button outline">Exportar CSV</button>
    </form>${statusLine}
    <dl class="metrics">${Object.entries(metricNames).map(([key,name])=>"<div><dt>"+name+"</dt><dd>"+(key==="revenue"?money(metrics[key]):metrics[key])+"</dd></div>").join("")}</dl>
    ${list}<div class="admin-actions">
      <button class="button outline" id="prev" ${page===0?"disabled":""}>Anterior</button>
      <span>${total ? page*40+1 : 0} a ${Math.min((page+1)*40,total)} de ${total}</span>
      <button class="button outline" id="next" ${(page+1)*40>=total?"disabled":""}>Próxima</button>
    </div>`);
    doc.querySelector("#filters").onsubmit = e => {
      e.preventDefault();
      filter = new URLSearchParams(Array.from(new FormData(e.currentTarget)).filter(([,value])=>value));
      show();
    };
    doc.querySelector("#prev").onclick = () => { filter.set("page",page-1); show(); };
    doc.querySelector("#next").onclick = () => { filter.set("page",page+1); show(); };
    doc.querySelector("#export").onclick = async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const response = await secured("/admin/export?"+filter,{raw:true});
        const href = URL.createObjectURL(await response.blob());
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.download = "montreal-gifts.csv";
        anchor.click();
        setTimeout(()=>URL.revokeObjectURL(href),1000);
      } catch(error) { doc.querySelector(".form-status").textContent = error.message; }
      finally { button.disabled = false; }
    };
  }

  function connectForm(form,path,map) {
    form.onsubmit = async event => {
      event.preventDefault();
      const button = form.querySelector("button");
      const status = form.querySelector(".form-status");
      button.disabled = true;
      try {
        await secured(path,{body:map(defaultForm(form))});
        if (current === "settings") status.textContent = "Alterações salvas.";
        else await show();
      } catch(error) {
        if ([401,403].includes(error.status)) return fails(error);
        status.textContent = error.message;
      } finally { button.disabled = false; }
    };
  }

  async function detail(id) {
    const locationPath = "/admin/orders/"+id;
    const {order,stock,events:history,jobs:queue,payments:transactions} = await secured(locationPath);
    const info = [
      ["Comprador",order.buyer_name],["WhatsApp do comprador",order.buyer_phone],["E-mail",order.buyer_email],["Presenteado",order.recipient],
      ["Entrega",order.delivery_mode==="recipient" ? "Direto ao presenteado" : "Ao comprador"],
      ["Data programada",order.delivery_on ? date(order.delivery_on) : null],
      ["WhatsApp de entrega",order.delivery_mode==="recipient" ? order.recipient_phone : order.buyer_phone],
      ["Mensagem",order.message],["Experiência",order.product_name],["Valor",moneyText(order.price_cents)],
      ["Pagamento",payments[order.payment_status]],["ID Mercado Pago",order.payment_id],["Comprado em",timestamp(order.created_at)],
      ["Aprovado em",timestamp(order.approved_at)],["Campanha",order.campaign],["Modelo",order.theme],
      ["Produto no TPC",order.tpc_product],["Voucher no TPC",order.tpc_voucher],["Validade prevista",order.validity_days ? order.validity_days+" dias" : "Sem prazo mínimo configurado"],
      ["Condições",order.rules],["Código oficial",order.code],["ID no TPC",order.tpc_id],
      ["Validade efetiva",order.expiry ? date(order.expiry) : null],["Método de emissão",order.method],
      ["Sincronização TPC",tpcStates[stock?.sync_status]],["Ocorrência no TPC",stock?.sync_issue],
      ["Emitido em",timestamp(order.issued_at)],["PNG criado em",timestamp(order.image_at)],["Enviado em",timestamp(order.sent_at)]
    ];
    const cleared = order.payment_status === "approved" && !order.financial_review;
    const doc = screen(`<a href="/admin/">← Voltar aos pedidos</a><section class="admin-panel"><h2>Pedido ${number(order.number)}</h2>
      ${order.financial_review ? '<p class="notice">Concilie a transação no Mercado Pago. Se o código já foi emitido, trate a validade no TPC antes de qualquer novo envio.</p>' : ""}
      ${order.checkout_state === "review" ? '<p class="notice">Verifique a preferência de checkout no Mercado Pago antes de orientar o comprador.</p>' : ""}
      <dl class="order-meta">${info.map(([key,value])=>"<div><dt>"+key+"</dt><dd>"+esc(value||"—")+"</dd></div>").join("")}</dl>
    </section><section class="admin-panel"><h3>Emissão e entrega</h3>
      ${cleared && !order.code && !order.delivery_on ? `<form class="admin-form" id="manual">
        ${label("Código oficial do TPC","code","","text","required maxlength=48")}
        ${label("ID no TPC (opcional)","tpc_id","","text","maxlength=100")}
        ${label("Validade registrada no TPC","expiry","","date","required")}
        <label class="check-label"><input type="checkbox" name="confirmed" required>Conferi o código e o voucher ativo e conciliei o pagamento externo no TPC.</label>
        <button class="button primary">Registrar emissão e preparar envio</button>${statusLine}</form>` : ""}
      ${cleared && !order.code && stock?.state==="sold" ? `<form class="admin-form" id="confirm-tpc">
        <a href="${stock.tpc_id ? tpcDetail+"?id="+encodeURIComponent(stock.tpc_id) : tpcList}" target="_blank" rel="noreferrer">${stock.tpc_id ? "Abrir ficha no Matchpoint" : "Abrir lista no Matchpoint"} ${icon("diagonal")}</a>
        ${stock.tpc_id ? "" : `<p>Pesquise o código <code>${esc(stock.code)}</code> no Matchpoint.</p>`}
        ${label("Confirme a chave exibida no TPC","code","","text","required maxlength=48")}
        ${label("Documento do TPC","document",stock.document,"text","maxlength=100")}
        <label class="check-label"><input type="checkbox" name="confirmed" required>A ficha do cartão mostra Cobrado.</label>
        <button class="button primary">Confirmar baixa manual</button>${statusLine}</form>` : ""}
      <div class="admin-actions">
        <button class="button outline" data-action="recheck">Consultar Mercado Pago</button>
        ${stock?.state==="reserved" && Date.now()>=Date.parse(order.stock_until)+3*86400000 ? '<button class="button outline" data-action="release-stock">Conciliar e liberar reserva</button>' : ""}
        ${["review","uncertain"].includes(stock?.sync_status) && cleared ? '<button class="button outline" data-action="recheck-tpc">Programar nova conferência no TPC</button>' : ""}
        ${order.token && cleared ? '<a class="button outline" href="/card/'+esc(order.token)+'">Visualizar cartão '+icon("diagonal")+'</a>' : ""}
        ${order.sent_at && cleared ? '<button class="button outline" data-action="resend">Reenviar o mesmo cartão</button>' : ""}
      </div><p id="action-status" role="status"></p>
      ${queue.length ? rowTable(["Operação","Status","Tentativas","Retorno","Ação"],queue.map(job=>[
        esc(jobs[job.kind]),esc(states[job.state]),job.attempts,esc(job.last_error || "—"),
        ["error","uncertain"].includes(job.state) && cleared ? '<button class="button outline" data-job="'+esc(job.id)+'">'+(job.state==="uncertain"?"Verificar envio":"Tentar novamente")+'</button>' : "—"
      ])) : "<p>Sem operações na fila.</p>"}
    </section><section class="admin-panel"><h3>Transações</h3>
      ${transactions.length ? rowTable(["Pagamento","Status","Valor","Validado","Atualizado"],transactions.map(pay=>[
        esc(pay.id),esc(pay.provider_status),money(pay.cents),pay.verified?"Sim":"Revisar",timestamp(pay.updated_at)
      ])) : "<p>Sem transações registradas.</p>"}
    </section><section class="admin-panel"><h3>Histórico</h3>
      ${history.length ? rowTable(["Data","Evento","Operador"],history.map(event=>[
        timestamp(event.created_at),esc(eventLabel(event.kind)),esc(event.actor || "Sistema")
      ])) : "<p>Sem eventos registrados.</p>"}
    </section>`);
    const manual = doc.querySelector("#manual");
    if (manual) connectForm(manual,locationPath+"/manual",data=>({...data,confirmed:data.confirmed==="on"}));
    const confirm = doc.querySelector("#confirm-tpc");
    if (confirm) connectForm(confirm,locationPath+"/confirm-tpc",data=>({...data,confirmed:data.confirmed==="on"}));
    for (const button of doc.querySelectorAll("[data-action],[data-job]")) {
      button.onclick = async () => {
        const status = doc.querySelector("#action-status");
        button.disabled = true;
        try {
          await secured(button.dataset.job ? "/admin/jobs/"+button.dataset.job+"/retry" : locationPath+"/"+button.dataset.action,{body:{}});
          await show();
        } catch(error) { status.textContent = error.message; button.disabled = false; }
      };
    }
  }

  async function settingsPage() {
    const {settings,products,options,stock,sales_enabled} = await secured("/admin/settings");
    const themes = [["natal","Natal + Tênis"],["regular","Montreal Gifts Regular"]];
    const doc = screen(`<section class="admin-panel"><h2>Campanhas e operação</h2>
      ${sales_enabled ? "" : '<p class="notice">Vendas indisponíveis até a ativação no ambiente de produção.</p>'}
      <div class="admin-actions">${themes.map(([theme,name])=>'<a class="button outline" href="/preview/?theme='+theme+'">Prévia '+name+'</a>').join("")}</div>
      <form class="admin-form" id="settings">
        <label>Campanha ativa<select name="campaign">${themes.map(([theme,name])=>'<option value="'+theme+'"'+(settings.campaign===theme?" selected":"")+'>'+name+'</option>').join("")}</select></label>
        ${themes.map(([theme,name])=>`<fieldset><legend>${name}</legend>
          ${label("Título",theme+"_title",settings.copies[theme]?.title,"text","maxlength=110")}
          ${textarea("Subtítulo",theme+"_subtitle",settings.copies[theme]?.subtitle,240)}
          ${label("Texto do botão",theme+"_cta",settings.copies[theme]?.cta,"text","maxlength=50")}
        </fieldset>`).join("")}
        ${label("WhatsApp operacional","operations_phone",settings.operations_phone,"tel","maxlength=24")}
        ${label("Link de resgate validado no TPC","redemption_url",settings.redemption_url,"url","maxlength=500")}
        <fieldset><legend>Mensagens do WhatsApp</legend>
          <p>Campos disponíveis. {pedido}, {comprador}, {presenteado}, {produto}, {painel}, {data} e {link}. Campo vazio usa a mensagem padrão.</p>
          ${[["internal","Aviso interno"],["confirmation","Confirmação para quem vai encaminhar"],["confirmation_recipient","Confirmação da compra com envio direto"],["deliver","Cartão para o comprador"],["deliver_recipient","Cartão para o presenteado"]].map(([key,name])=>textarea(name,key,settings.messages[key],1200)).join("")}
        </fieldset>
        <label class="check-label"><input name="tpc_automation" type="checkbox" ${settings.tpc_automation?"checked":""}>Processar a fila de cartões no Chrome da operação</label>
        <button class="button primary">Salvar configuração</button>${statusLine}
      </form>
    </section>
    <section class="admin-panel"><h3>Estoque de cartões do TPC</h3>
      ${rowTable(["Duração","Disponíveis","Reservados","Vendidos","Bloqueados"],options.map(option=>{
        const count = stock[option.id] || {};
        return [esc(option.title),count.available || 0,count.reserved || 0,count.sold || 0,count.blocked || 0];
      }))}
      <form class="admin-form" id="stock-import">
        <label>Duração<select name="option_id" required>${options.map(option=>'<option value="'+esc(option.id)+'">'+esc(option.title)+'</option>').join("")}</select></label>
        <p>Carregue um CSV do Excel ou cole os códigos sob o cabeçalho <code>code</code>. Se informar validade, use AAAA-MM-DD.</p>
        <label>Arquivo CSV<input name="csv" type="file" accept=".csv,text/csv"></label>
        <label>Cartões do mesmo produto<textarea name="rows" rows="5" required placeholder="code"></textarea></label>
        <button class="button primary">Importar cartões</button>${statusLine}
      </form>
    </section>
    ${products.map(p=>`<section class="admin-panel"><h3>${esc(p.name)}</h3><form class="admin-form" data-product-settings="${p.id}">
      ${label("Nome","name",p.name,"text","maxlength=70 required")}
      ${textarea("Descrição","description",p.description,300)}
      ${label("Imagem HTTPS ou caminho /assets/","image",p.image,"text","maxlength=500")}
      <label class="check-label"><input name="active" type="checkbox" ${p.active?"checked":""}>Experiência disponível para venda</label>
      <button class="button primary">Salvar experiência</button>${statusLine}</form>
      ${options.filter(option=>option.product_id===p.id).map(option=>`<details class="option-settings">
        <summary>${esc(option.title)} · ${money(option.price_cents)}</summary>
        <form class="admin-form" data-option-settings="${esc(option.id)}">
          <p>Referência no TPC: ${esc(option.tpc_label)}</p>
          <label>Preço em reais<input name="price" inputmode="decimal" value="${esc((option.price_cents/100).toFixed(2).replace(".",","))}" pattern="[0-9]+([,.][0-9]{1,2})?" required></label>
          ${label("ID do produto no TPC","tpc_product",option.tpc_product,"text","maxlength=120")}
          ${label("Tipo de voucher no TPC","tpc_voucher",option.tpc_voucher,"text","maxlength=120")}
          ${label("Validade prevista em dias (opcional)","validity_days",option.validity_days,"number","min=1 max=36500")}
          ${textarea("Condições e instruções de resgate","rules",option.rules)}
          <label class="check-label"><input name="active" type="checkbox" ${option.active?"checked":""}>Duração disponível para venda</label>
          <button class="button primary">Salvar duração</button>${statusLine}
        </form>
      </details>`).join("")}</section>`).join("")}`);
    connectForm(doc.querySelector("#settings"),"/admin/settings",data=>({
      campaign:data.campaign, operations_phone:data.operations_phone, redemption_url:data.redemption_url, tpc_automation:data.tpc_automation==="on",
      copies:Object.fromEntries(themes.map(([theme])=>[theme,{title:data[theme+"_title"],subtitle:data[theme+"_subtitle"],cta:data[theme+"_cta"]}])),
      messages:Object.fromEntries(["internal","confirmation","confirmation_recipient","deliver","deliver_recipient"].map(key=>[key,data[key]]))
    }));
    const stockForm = doc.querySelector("#stock-import");
    stockForm.elements.csv.onchange = async () => {
      const file = stockForm.elements.csv.files[0];
      if (file && file.size<=250000) stockForm.elements.rows.value = await file.text();
      else if (file) stockForm.querySelector(".form-status").textContent = "O arquivo excede 250 KB.";
    };
    stockForm.onsubmit = async event => {
      event.preventDefault();
      const button = stockForm.querySelector("button");
      const status = stockForm.querySelector(".form-status");
      button.disabled = true;
      try {
        const result = await secured("/admin/stock",{body:{option_id:stockForm.elements.option_id.value,rows:stockRows(stockForm.elements.rows.value)}});
        await settingsPage();
        document.querySelector("#stock-import .form-status").textContent = `${result.inserted} importados. ${result.skipped} já estavam cadastrados.`;
      } catch (error) { status.textContent = error.message; }
      finally { button.disabled = false; }
    };
    for (const form of doc.querySelectorAll("[data-product-settings]")) {
      connectForm(form,"/admin/products/"+form.dataset.productSettings,data=>({...data,active:data.active==="on"}));
    }
    for (const form of doc.querySelectorAll("[data-option-settings]")) {
      connectForm(form,"/admin/options/"+form.dataset.optionSettings,data=>({
        ...data,active:data.active==="on",price_cents:Math.round(Number(data.price.replace(",","."))*100),
        validity_days:data.validity_days ? Number(data.validity_days) : null
      }));
    }
  }

  async function show() {
    if (!hasSession()) return login();
    if (query.get("settings")==="1") current = "settings";
    else if (/^[a-f0-9-]{36}$/.test(query.get("order") ?? "")) current = "detail";
    else current = "orders";
    try {
      if (current === "settings") await settingsPage();
      else if (current === "detail") await detail(query.get("order"));
      else await overview();
    } catch(error) { await fails(error); }
  }

  show();
}
