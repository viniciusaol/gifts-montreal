let loading;
function load() {
  if(window.turnstile)return Promise.resolve();
  if(!loading) loading=new Promise((resolve,reject)=>{
    const script=document.createElement("script");script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async=true;script.onload=resolve;script.onerror=()=>reject(new Error("A verificação de segurança está indisponível. Tente novamente."));document.head.append(script);
  });
  return loading;
}

export function createVerification(form,siteKey) {
  let proof="",widget;
  const host=form.querySelector("[data-verification]");
  form.addEventListener("gifts:step",async event=>{
    if(!siteKey || event.detail!==2 || widget!==undefined)return;
    host.hidden=false;
    try {
      await load();
      if(!form.isConnected)return;
      widget=window.turnstile.render(host,{sitekey:siteKey,action:"gift_checkout",size:"flexible","response-field":false,
        callback:token=>{proof=token;},"expired-callback":()=>{proof="";},"error-callback":()=>{proof="";}});
    } catch(error) {form.querySelector(".form-status").textContent=error.message;}
  });
  return {
    token(){if(siteKey && !proof)throw new Error("Conclua a verificação de segurança para continuar.");return proof;},
    reset(){proof="";if(widget!==undefined)window.turnstile?.reset(widget);},
    destroy(){if(widget!==undefined)window.turnstile?.remove(widget);}
  };
}
