import type { CriteriosBusca, Destino, Turno } from '@/types';
import { trajetoOSRM } from '@/lib/geocode';

export type Ponto = { lat: number; lng: number };
export type ParadaDemo = { titulo: string; ponto: Ponto; horario: string; tipo: 'origem' | 'parada' | 'escola' };
export type OfertaDemo = {
  id: string; nome: string; slug: string; imagem: string; vanImagem: string;
  modelo: string; vagas: number; precoMensal: number; recursos: string[];
  embarque: string; chegada: string; duracaoMin: number; desvioMin: number;
  escola: string; modalidade: CriteriosBusca['modalidade']; origem: Ponto; destino: Ponto;
  paradas: ParadaDemo[]; geometria: [number, number][] | null;
  distanciaAproximadaKm: number; rotaConfirmada: boolean;
};
const NOMES = ['Tio João','Tia Ana','José','Maria','Carlos','Tia Camila','Bruno','Tia Márcia','Antônio','Luciana','Tio Roberto','Patrícia','Tio Lucas','Carolina','Fernando','Tia Denise','André','Vanessa','Seu Joaquim','Beatriz','Rafael','Tia Daniela','Roberto Carlos','Helena','Paulo César','Juliana','Tio Chico','Renata','Sérgio','Tia Vera'];
const SLUGS = ['tio-joao','tia-ana','jose','maria','carlos','tio-paulo','fernanda','tia-marcia','antonio','luciana','tio-roberto','patricia','tia-sandra','marcos','adriana','tio-beto','claudia','ricardo','tia-cida','eduardo','rosana','tio-luiz','simone','marcelo','tia-neide','juliana','tio-chico','renata','sergio','tia-vera'];
const MODELOS = ['Van escolar grande','Van escolar média','Van escolar compacta','Micro-ônibus escolar'];
const TURNOS: Turno[] = ['manha','tarde','noite','integral'];
const minute = (h: string) => { const [a,b]=h.split(':').map(Number); return a*60+b; };
const hora = (n: number) => { const m=((Math.round(n)%1440)+1440)%1440; return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); };
function hash(s: string): number { let h=2166136261; for(const c of s) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0; }
function km(a:Ponto,b:Ponto) { const x=(a.lng-b.lng)*104*Math.cos(a.lat*Math.PI/180); const y=(a.lat-b.lat)*111.2; return Math.hypot(x,y); }
export function horarioPadrao(turno: Turno | null, modalidade: CriteriosBusca['modalidade']) {
  if(modalidade==='volta') return turno==='manha'?'12:00':turno==='noite'?'22:00':'17:30';
  return turno==='tarde'?'13:00':turno==='noite'?'19:00':'07:00';
}
export function catalogoDemo() {
  return NOMES.map((nome,i)=>({
    id:'VB-'+String(i+1).padStart(3,'0'),nome,slug:SLUGS[i],
    imagem:'/vanbora-visual/01_motoristas/motorista-'+String(i+1).padStart(2,'0')+'-'+SLUGS[i]+'.webp',
    vanImagem:'/vanbora-visual/02_veiculos/van-'+String(i+1).padStart(2,'0')+'.webp',
    modelo:MODELOS[i%4],vagas:1+(i*7%5),precoMensal:240+(i*31%240),
    recursos:['Transporte infantil','Documentação',...(i%2===0?['Ar-condicionado']:[]),...(i%3===0?['Monitor']:[])],
    turnos:TURNOS.filter((_,j)=>j===i%4||j===(i+1)%4||i%5===0),
  }));
}
export type PesquisaDemo = { criterios:CriteriosBusca; destino:Destino | null; horario:string };
/**
 * Gera opções independentes de Supabase. Geometria e durações só são exibidas
 * como verificadas quando o provedor OSRM retorna um percurso viário válido.
 */
export async function buscarOfertasDemo({criterios,destino,horario}:PesquisaDemo,signal?:AbortSignal):Promise<OfertaDemo[]> {
  if(!criterios.origemLat || !criterios.origemLng || destino?.lat==null || destino.lng==null) return [];
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) return [];
  const origem={lat:criterios.origemLat,lng:criterios.origemLng};
  const escola={lat:destino.lat,lng:destino.lng};
  const distancia=km(origem,escola);
  if(distancia>38 || distancia<0.02) return [];
  const seed=hash([destino.id,Math.round(origem.lat*200),Math.round(origem.lng*200),criterios.turno,criterios.modalidade].join('|'));
  const candidates=catalogoDemo().filter((m)=>{
    if(criterios.turno&&!m.turnos.includes(criterios.turno)) return false;
    // Cobertura estável por corredores: candidatos variam com origem e destino.
    return hash(m.id+'|'+(seed%17))%100<77;
  }).sort((a,b)=>hash(a.id+'|'+seed)-hash(b.id+'|'+seed)).slice(0,20);
  const isVolta=criterios.modalidade==='volta';
  const inicio=isVolta?escola:origem;
  const fim=isVolta?origem:escola;
  const ofertas=await Promise.all(candidates.map(async(m)=>{
    if(signal?.aborted) return null;
    const count=1+(hash(m.id+'stops'+seed)%3);
    const intermediarios:Ponto[]=Array.from({length:count},(_,j)=>{
      const t=(j+1)/(count+1), lateral=(hash(m.id+seed+'lat'+j)%200-100)/100;
      // Pequena dispersão: o roteador faz o encaixe real nas ruas.
      return {lat:inicio.lat+(fim.lat-inicio.lat)*t + lateral*.0018,
        lng:inicio.lng+(fim.lng-inicio.lng)*t-lateral*.0018};
    });
    const pontos=[inicio,...intermediarios,fim];
    const rota=await trajetoOSRM(pontos,signal);
    // Sem rota válida não fabricamos duração nem traçado como se fossem reais.
    if(!rota||rota.temposMin.length!==pontos.length-1||rota.geometria.length<2) return null;
    const deslocamento=rota.temposMin.reduce((a,b)=>a+b,0)+count;
    if(deslocamento>100 || deslocamento<1) return null;
    const referencia=minute(horario);
    const folga=criterios.modalidade==='volta'?0:2+(hash(m.id+seed)%6);
    const partida=isVolta?referencia:referencia-deslocamento-folga;
    const chegada=partida+deslocamento;
    if(!isVolta&&chegada>referencia) return null;
    let relogio=partida;
    const paradas:ParadaDemo[]=[{titulo:isVolta?destino.nome:'Seu embarque',ponto:inicio,horario:hora(relogio),tipo:'origem'}];
    intermediarios.forEach((p,j)=>{
      relogio+=rota.temposMin[j]+1;
      paradas.push({titulo:'Parada intermediária '+(j+1),ponto:p,horario:hora(relogio),tipo:'parada'});
    });
    relogio+=rota.temposMin[rota.temposMin.length-1];
    paradas.push({titulo:isVolta?'Seu desembarque':destino.nome,ponto:fim,horario:hora(relogio),tipo:'escola'});
    return {...m,embarque:hora(partida),chegada:hora(chegada),duracaoMin:deslocamento,
      desvioMin:count,escola:destino.nome,modalidade:criterios.modalidade,origem,destino:escola,
      paradas,geometria:rota.geometria,distanciaAproximadaKm:distancia,rotaConfirmada:true} as OfertaDemo;
  }));
  return ofertas.filter((x):x is OfertaDemo=>x!==null).sort((a,b)=>a.duracaoMin-b.duracaoMin);
}
