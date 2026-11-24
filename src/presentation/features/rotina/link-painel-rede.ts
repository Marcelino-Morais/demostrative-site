/** Monta um link sem senha, token, parâmetros ou rotas de pacientes. */
export function linkPainelNaRede(origem:string,ipLan?:string|null,portaServidor?:number):string|null {
 let atual:URL;try{atual=new URL(origem);}catch{return null;}
 if(!['http:','https:'].includes(atual.protocol))return null;
 const ipv4=(host:string)=>{const partes=host.split('.');if(partes.length!==4||partes.some(p=>! /^(0|[1-9]\d{0,2})$/.test(p)||Number(p)>255))return false;const a=Number(partes[0]),b=Number(partes[1]);return a>0&&a<224&&a!==127&&!(a===169&&b===254);};
 const privado=(host:string)=>ipv4(host)&&(/^(10\.|192\.168\.)/.test(host)||(/^172\./.test(host)&&Number(host.split('.')[1])>=16&&Number(host.split('.')[1])<=31));
 // O servidor identifica a interface física; redes institucionais podem usar IP público na LAN.
 const informado=Boolean(ipLan&&ipv4(ipLan));
 const host=informado?ipLan:privado(atual.hostname)?atual.hostname:null;if(!host)return null;
 const portaValida=typeof portaServidor==='number'&&Number.isInteger(portaServidor)&&portaServidor>0&&portaServidor<=65535;
 const atualNaRede=host===atual.hostname;
 const protocolo=informado&&portaValida?'http:':atualNaRede?atual.protocol:'http:';
 const porta=portaValida?portaServidor:atualNaRede?Number(atual.port||(protocolo==='https:'?443:80)):3999;
 return `${protocolo}//${host}${porta===(protocolo==='https:'?443:80)?'':':'+porta}/`;
}
