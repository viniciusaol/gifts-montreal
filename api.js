import config from "./config.js";

const storageKey = "montreal-gifts-admin";
const giftStorageKey = "montreal-gifts-recipient";
const testStorageKey = "montreal-gifts-checkout-test";
const testFragment = new URLSearchParams(location.hash.slice(1)).get("teste");
if (testFragment && /^[A-Za-z0-9_-]{1,1024}\.[a-f0-9]{64}$/.test(testFragment)) {
  sessionStorage.setItem(testStorageKey,testFragment);
  history.replaceState(null,"",location.pathname+location.search);
}

function checkoutTest() {
  try {
    const token = sessionStorage.getItem(testStorageKey);
    if (!token) return null;
    const access = JSON.parse(atob(token.split(".")[0].replaceAll("-","+").replaceAll("_","/")));
    return access.until>Date.now()/1000 ? {token,id:access.id} : null;
  } catch { return null; }
}

function session(key = storageKey) {
  try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; }
}

export const hasSession = () => Boolean(session()?.access_token);
export const signOut = () => sessionStorage.removeItem(storageKey);
export const apiUrl = path => config.apiBase.replace(/\/$/,"") + path;

async function authRequest(path, values, message) {
  if (!config.supabaseUrl || !config.supabasePublicKey) throw new Error("Autenticação ainda sem configuração.");
  const response = await fetch(config.supabaseUrl.replace(/\/$/,"") + "/auth/v1/" + path,{
    method:"POST",headers:{apikey:config.supabasePublicKey,"content-type":"application/json"},body:JSON.stringify(values)
  });
  if (!response.ok) throw new Error(response.status===429 ? "Aguarde um minuto e tente novamente." : message);
  return response.json();
}

function store(key,data) {
  sessionStorage.setItem(key,JSON.stringify({
    access_token:data.access_token,
    refresh_token:data.refresh_token,
    expires_at:data.expires_at || Math.floor(Date.now()/1000) + data.expires_in
  }));
  return data.access_token;
}

async function grant(type, values, key = storageKey) {
  const data = await authRequest("token?grant_type="+type,values,type === "password" ? "Acesso indisponível. Confira suas credenciais." : "Sessão expirada.");
  return store(key,data);
}

export const signIn = (email,password) => grant("password",{email,password});
export const requestPasswordReset = email => authRequest("recover?redirect_to="+encodeURIComponent(location.origin+"/admin/reset/"),{email},"Não foi possível solicitar a recuperação. Tente novamente em instantes.");

export async function recoveryAccount() {
  const params=new URLSearchParams(location.hash.slice(1));
  const access=params.get("access_token"),refresh=params.get("refresh_token");
  history.replaceState(null,"",location.pathname);
  if(params.get("type")!=="recovery" || !access || !refresh) throw new Error("Abra o link de recuperação recebido no seu e-mail.");
  store(storageKey,{access_token:access,refresh_token:refresh,expires_in:Number(params.get("expires_in")) || 3600});
  const response=await fetch(config.supabaseUrl+"/auth/v1/user",{headers:{apikey:config.supabasePublicKey,authorization:"Bearer "+access}});
  if(!response.ok) {signOut();throw new Error("O link de recuperação expirou. Solicite um novo link.");}
  return response.json();
}

export async function setRecoveredPassword(password) {
  const token=await authToken(storageKey);
  if(!token)throw new Error("Solicite um novo link de recuperação.");
  const response=await fetch(config.supabaseUrl+"/auth/v1/user",{method:"PUT",headers:{apikey:config.supabasePublicKey,authorization:"Bearer "+token,"content-type":"application/json"},body:JSON.stringify({password})});
  if(!response.ok)throw new Error("Não foi possível atualizar a senha. Use uma senha forte e tente novamente.");
}
export const emailGiftAccess = email => authRequest("otp",{email,create_user:true},"Não foi possível enviar o código. Confira o e-mail e tente novamente.");
export const confirmGiftAccess = async (email,token) => store(giftStorageKey,await authRequest("verify",{email,token,type:"email"},"Código inválido ou expirado."));
const refreshing = new Map();
async function authToken(key) {
  const auth = session(key);
  if (!auth) return "";
  if (auth.expires_at > Date.now()/1000 + 30) return auth.access_token;
  if (!refreshing.has(key)) refreshing.set(key,grant("refresh_token",{refresh_token:auth.refresh_token},key).finally(()=>refreshing.delete(key)));
  try { return await refreshing.get(key); } catch { sessionStorage.removeItem(key); return ""; }
}

export async function api(path,{body,authorized = false,gift = false,raw = false,timeoutMs=45000} = {}) {
  if (!config.apiBase) throw new Error("O serviço ainda não foi configurado.");
  const key = gift ? giftStorageKey : storageKey;
  const token = authorized || gift ? await authToken(key) : "";
  const test = ["/catalog","/checkout"].includes(path) ? checkoutTest() : null;
  if (test && body && path==="/checkout") body={...body,request_id:test.id};
  const response = await fetch(apiUrl(path),{
    method:body === undefined ? "GET" : "POST",
    cache:"no-store",
    signal:AbortSignal.timeout(timeoutMs),
    referrerPolicy:"no-referrer",
    headers:{...(token ? {authorization:"Bearer "+token} : {}),...(test ? {"x-gift-test":test.token} : {}),
      ...(body === undefined ? {} : {"content-type":"application/json"})},
    body:body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) {
    if ((authorized || gift) && [401,403].includes(response.status)) sessionStorage.removeItem(key);
    const problem = await response.json().catch(() => ({}));
    const error = new Error(problem.message || "Serviço indisponível. Tente novamente.");
    error.status = response.status;
    error.code = problem.error;
    throw error;
  }
  return raw ? response : response.json();
}
