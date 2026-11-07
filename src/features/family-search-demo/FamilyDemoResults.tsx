import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Heart, MapPin, Star, Clock, BusFront, SlidersHorizontal, Route, X, Play, Pause, RotateCcw } from 'lucide-react';
import type { OfertaDemo } from './engine';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Props={ ofertas:OfertaDemo[]; carregando:boolean; erro?:string; horario:string; endereco:string; onEditar:()=>void };
export function FamilyDemoResults({ofertas,carregando,erro,horario,endereco,onEditar}:Props) {
 const [somenteVagas,setSomenteVagas]=useState(true);
 const [ordenacao,setOrdenacao]=useState<'rapido'|'preco'|'vagas'>('rapido');
 const [selecionado,setSelecionado]=useState<OfertaDemo|null>(null);
 const [aba,setAba]=useState<'trajeto'|'perfil'|'avaliacoes'>('trajeto');
 const [favoritos,setFavoritos]=useState<string[]>([]);
 const [parada,setParada]=useState(0);
 const [rodando,setRodando]=useState(false);
 const [fotoAberta,setFotoAberta]=useState(false);
 const [solicitacao,setSolicitacao]=useState(false);
 const lista=ofertas.filter(o=>!somenteVagas||o.vagas>0).sort((a,b)=>ordenacao==='preco'?a.precoMensal-b.precoMensal:ordenacao==='vagas'?b.vagas-a.vagas:a.duracaoMin-b.duracaoMin);
 useEffect(()=>{if(!rodando||!selecionado)return;const timer=window.setInterval(()=>setParada(n=>{if(n>=selecionado.paradas.length-1){setRodando(false);return n;}return n+1;}),1800);return()=>clearInterval(timer);},[rodando,selecionado]);
 function abrir(o:OfertaDemo,tab:'trajeto'|'perfil'|'avaliacoes'){setSelecionado(o);setAba(tab);setParada(0);setRodando(false);setSolicitacao(false);}
 function favoritar(id:string){setFavoritos(a=>a.includes(id)?a.filter(x=>x!==id):[...a,id]);}
 return <section className="mt-7">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="text-xl font-bold text-[#151515]">{carregando?'Calculando trajetos pelas ruas…':lista.length+' opções para sua busca'}</h2><p className="text-sm text-gray-600">Horário escolhido: {horario} · {endereco}</p></div>
   <button type="button" onClick={onEditar} className="rounded-xl border px-4 py-2 text-sm font-semibold">Editar pesquisa</button>
  </div>
  {erro&&<p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm">{erro}</p>}
  {!carregando&&<div className="mt-4 flex flex-wrap items-center gap-4">
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={somenteVagas} onChange={e=>setSomenteVagas(e.target.checked)}/>Só com vagas</label>
   <label className="flex items-center gap-2 text-sm"><SlidersHorizontal size={17}/> Ordenar <select className="rounded-lg border p-2" value={ordenacao} onChange={e=>setOrdenacao(e.target.value as typeof ordenacao)}><option value="rapido">Menor tempo a bordo</option><option value="preco">Menor mensalidade</option><option value="vagas">Mais vagas</option></select></label>
  </div>}
  {!carregando&&lista.length===0&&<div className="mt-8 rounded-2xl bg-gray-50 p-8 text-center"><h3 className="font-bold">Nenhuma opção viável nesta pesquisa</h3><p className="mt-2 text-sm text-gray-600">Confirme o endereço e o destino, ou tente outro horário. O serviço de rotas também pode estar indisponível.</p><button onClick={onEditar} className="mt-4 rounded-xl bg-[#FFC400] px-5 py-3 font-semibold">Alterar pesquisa</button></div>}
  <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{lista.map(o=><article key={o.id} className="overflow-hidden rounded-3xl border bg-white shadow-sm">
   <div className="relative"><img src={o.vanImagem} onError={e=>{e.currentTarget.style.display='none';}} alt={o.modelo} className="h-40 w-full object-cover bg-amber-50" /><button type="button" onClick={()=>favoritar(o.id)} aria-label={favoritos.includes(o.id)?'Remover dos favoritos':'Adicionar aos favoritos'} className="absolute right-3 top-3 rounded-full bg-white p-2 shadow"><Heart size={20} fill={favoritos.includes(o.id)?'#FFC400':'none'}/></button></div>
   <div className="p-5">
    <button onClick={()=>abrir(o,'perfil')} className="flex items-center gap-3 text-left"><img src={o.imagem} alt="" onError={e=>{e.currentTarget.style.display='none';}} className="h-12 w-12 rounded-full object-cover bg-gray-100"/><span><strong className="block">{o.nome}</strong><small className="text-gray-500">{o.modelo}</small></span></button>
    <button onClick={()=>abrir(o,'avaliacoes')} className="mt-3 flex items-center gap-2 text-sm text-gray-600"><Star size={16} className="text-amber-500"/> Ver avaliações <span className="text-xs">(ainda não disponíveis)</span></button>
    <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-3 text-center text-xs"><span><b className="block text-base">{o.embarque}</b>Embarque</span><span><b className="block text-base">{o.chegada}</b>Chegada</span><span><b className="block text-base">{o.duracaoMin} min</b>A bordo</span></div>
    <div className="mt-4 flex justify-between text-sm"><span>{o.vagas} vagas · {o.paradas.length-2} paradas</span><b>R$ {o.precoMensal}/mês</b></div>
    <div className="mt-2 flex flex-wrap gap-1">{o.recursos.map(r=><span key={r} className="rounded-full bg-amber-50 px-2 py-1 text-xs">{r}</span>)}</div>
    <button onClick={()=>abrir(o,'trajeto')} className="mt-5 w-full rounded-xl bg-[#FFC400] px-4 py-3 font-bold text-[#151515]">Ver trajeto completo</button>
   </div></article>)}</div>
  {selecionado&&<div role="dialog" aria-modal="true" aria-label={'Detalhes de '+selecionado.nome} className="fixed inset-0 z-[1000] overflow-y-auto bg-black/60 p-3 sm:p-8">
   <div className="mx-auto max-w-3xl rounded-3xl bg-white p-5 sm:p-7">
    <div className="flex items-center justify-between gap-3"><button className="flex items-center gap-2 font-semibold" onClick={()=>{setSelecionado(null);setRodando(false)}}><ArrowLeft size={18}/> Voltar aos resultados</button><button aria-label="Fechar" onClick={()=>setSelecionado(null)}><X/></button></div>
    <h2 className="mt-5 text-2xl font-bold">{selecionado.nome}</h2>
    <div className="mt-4 flex gap-2 border-b pb-3">{(['trajeto','perfil','avaliacoes'] as const).map(a=><button key={a} onClick={()=>setAba(a)} className={'rounded-lg px-3 py-2 text-sm font-semibold '+(aba===a?'bg-[#FFC400]':'bg-gray-100')}>{a==='trajeto'?'Trajeto':a==='perfil'?'Perfil':'Avaliações'}</button>)}</div>
    {aba==='trajeto'&&<div className="mt-4">
     <p className="mb-3 text-sm text-gray-600">Percurso calculado por serviço viário · posição da van apenas ilustrativa</p>
     <MapaDemo oferta={selecionado} parada={parada}/>
     <div className="mt-4 flex flex-wrap gap-2"><button onClick={()=>setRodando(v=>!v)} className="flex items-center gap-2 rounded-xl bg-[#FFC400] px-4 py-2 font-semibold">{rodando?<Pause size={17}/>:<Play size={17}/>} {rodando?'Pausar':'Reproduzir'}</button><button onClick={()=>{setRodando(false);setParada(0)}} className="flex items-center gap-2 rounded-xl border px-4 py-2"><RotateCcw size={17}/> Reiniciar</button></div>
     <div className="mt-4 space-y-2">{selecionado.paradas.map((p,i)=><button key={i} onClick={()=>{setParada(i);setRodando(false)}} className={'flex w-full items-center gap-3 rounded-xl p-3 text-left '+(parada===i?'bg-amber-100':'bg-gray-50')}><MapPin size={18}/><b className="w-14">{p.horario}</b><span>{p.titulo}</span></button>)}</div>
    </div>}
    {aba==='perfil'&&<div className="mt-5"><div className="flex items-center gap-4"><img src={selecionado.imagem} alt={selecionado.nome} className="h-24 w-24 rounded-full object-cover"/><div><b className="text-lg">{selecionado.nome}</b><p className="text-sm text-gray-500">Perfil demonstrativo · {selecionado.vagas} vagas</p></div></div><button onClick={()=>setFotoAberta(true)} className="mt-5 block w-full"><img src={selecionado.vanImagem} alt={'Ver imagem ampliada de '+selecionado.modelo} className="max-h-72 w-full rounded-2xl object-cover"/></button><p className="mt-3 font-semibold">{selecionado.modelo}</p><p className="mt-2 text-sm">Atendimento demonstrativo para {selecionado.escola}. {selecionado.recursos.join(' · ')}.</p><button onClick={()=>setSolicitacao(true)} className="mt-5 w-full rounded-xl bg-[#FFC400] p-3 font-bold">Tenho interesse nesta van</button>{solicitacao&&<p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">Interesse demonstrativo selecionado. Nenhuma solicitação foi enviada ao motorista.</p>}</div>}
    {aba==='avaliacoes'&&<div className="mt-8 rounded-2xl bg-gray-50 p-8 text-center"><Star className="mx-auto text-amber-500"/><h3 className="mt-3 font-bold">Ainda não há avaliações verificadas</h3><p className="mt-2 text-sm text-gray-600">Não exibimos depoimentos inventados para personagens demonstrativos.</p></div>}
   </div>
   {fotoAberta&&<div role="dialog" aria-label="Foto ampliada" className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/90 p-5" onClick={()=>setFotoAberta(false)}><img src={selecionado.vanImagem} alt={selecionado.modelo} className="max-h-[85vh] max-w-full object-contain"/><button aria-label="Fechar foto" className="absolute right-5 top-5 text-white"><X/></button></div>}
  </div>}
 </section>;
}
function MapaDemo({oferta,parada}:{oferta:OfertaDemo;parada:number}){
 const el=useRef<HTMLDivElement>(null);const map=useRef<L.Map|null>(null);const markers=useRef<L.CircleMarker[]>([]);
 useEffect(()=>{
  if(!el.current||!oferta.geometria)return;
  const m=L.map(el.current,{scrollWheelZoom:false});
  map.current=m;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(m);
  const line=L.polyline(oferta.geometria,{color:'#E3A900',weight:6}).addTo(m);
  markers.current=oferta.paradas.map((p,i)=>L.circleMarker([p.ponto.lat,p.ponto.lng],{radius:i===0||i===oferta.paradas.length-1?9:7,color:'#151515',weight:2,fillColor:i===0?'#22C55E':'#FFC400',fillOpacity:1}).addTo(m).bindPopup(p.horario+' · '+p.titulo));
  m.fitBounds(line.getBounds(),{padding:[25,25]});
  return()=>{m.remove();map.current=null;markers.current=[];};
 },[oferta]);
 useEffect(()=>{const marker=markers.current[parada];if(marker&&map.current){map.current.panTo(marker.getLatLng());marker.openPopup();}},[parada,oferta]);
 return <div ref={el} className="h-[310px] w-full overflow-hidden rounded-2xl bg-gray-100" aria-label="Mapa do trajeto"/>;
}
