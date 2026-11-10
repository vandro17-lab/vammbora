import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { paramsParaCriterios } from '@/lib/searchParams';
import { useVitrine } from '@/data/VitrineProvider';
import { buscarOfertasDemo, horarioPadrao, type OfertaDemo } from '@/features/family-search-demo/engine';
import { FamilyDemoResults } from '@/features/family-search-demo/FamilyDemoResults';
import { SearchLoadingScreen } from '@/components/search/SearchLoadingScreen';
import { DEMO_BUSCA } from '@/lib/supabase';
import { buscarRotasReais, type CartaoRotaRealDados } from '@/lib/busca-rotas-reais-cliente';
import { CartaoRotaReal } from '@/components/results/CartaoRotaReal';
import { WaitlistForm } from '@/components/results/WaitlistForm';

export function SearchResultsPage(){
 const [sp]=useSearchParams();
 const parametros=sp.toString();
 const criterios=useMemo(()=>paramsParaCriterios(new URLSearchParams(parametros)),[parametros]);
 const {destinosPorId,modoDemo}=useVitrine();
 // Fluxo real (padrão): rotas cadastradas, via /api/buscar-rotas. As ofertas de
 // exemplo só aparecem no modo demonstração EXPLÍCITO (ou sem Supabase).
 const buscaDemo=DEMO_BUSCA||modoDemo;
 const [reais,setReais]=useState<CartaoRotaRealDados[]>([]);
 const destino=criterios.destinoId?destinosPorId[criterios.destinoId]??null:null;
 const horario=sp.get('horario')||horarioPadrao(criterios.turno,criterios.modalidade);
 const [ofertas,setOfertas]=useState<OfertaDemo[]>([]);
 const [carregando,setCarregando]=useState(true);
 const [mostrarOverlay,setMostrarOverlay]=useState(() => sessionStorage.getItem('vambora.busca.transicao') === '1');
 const [imagensProntas,setImagensProntas]=useState(false);
 const [erro,setErro]=useState('');
 useEffect(()=>{
  const ctrl=new AbortController();
  setCarregando(true);setErro('');setOfertas([]);setReais([]);setImagensProntas(false);
  if(!criterios.origemLat||!criterios.origemLng){
   setErro('Selecione um endereço reconhecido pelo mapa para calcular as opções.');
   setCarregando(false);
   return()=>ctrl.abort();
  }
  if(!destino||destino.lat==null||destino.lng==null){
   setErro('Escolha uma escola com localização disponível para calcular o trajeto.');
   setCarregando(false);
   return()=>ctrl.abort();
  }
  if(!buscaDemo){
   // BUSCA REAL: o servidor avalia as rotas do Supabase com o motor de encaixe
   // e devolve só o veredito (sem dados de outros passageiros).
   buscarRotasReais(criterios,{lat:destino.lat,lng:destino.lng})
    .then(r=>{
     if(ctrl.signal.aborted)return;
     if(r.estado==='ok')setReais(r.resultados);
     else setErro(r.estado==='nao_configurado'
      ?'A busca por rotas ainda não está disponível neste ambiente. Tente novamente mais tarde.'
      :'Não foi possível consultar as rotas agora. Verifique a conexão e tente novamente.');
    })
    .finally(()=>{if(!ctrl.signal.aborted)setCarregando(false);});
   return()=>ctrl.abort();
  }
  buscarOfertasDemo({criterios,destino,horario},ctrl.signal)
   .then(lista=>{if(!ctrl.signal.aborted){setOfertas(lista);if(!lista.length)setErro('Não foi possível confirmar rotas viárias compatíveis. Verifique o endereço ou tente novamente mais tarde.');}})
   .catch(()=>{if(!ctrl.signal.aborted)setErro('Falha ao consultar o serviço de trajetos. Tente novamente.');})
   .finally(()=>{if(!ctrl.signal.aborted)setCarregando(false);});
  return()=>ctrl.abort();
 },[criterios,destino,horario,buscaDemo]);
 useEffect(() => {
  if (carregando) return;
  let cancelado = false;
  const imagens = ofertas.slice(0, 6).flatMap(o => [o.vanImagem, o.imagem]).filter((src): src is string => typeof src === 'string' && src.length > 0);
  Promise.all(imagens.map(src => new Promise<void>(resolve => {
   const img = new Image();
   const done = () => resolve();
   img.onload = done; img.onerror = done; img.src = src;
   if (img.complete) done();
  }))).then(() => { if (!cancelado) setImagensProntas(true); });
  return () => { cancelado = true; };
 }, [carregando, ofertas]);
 useEffect(() => {
  if (!mostrarOverlay) return;
  const previous = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  window.scrollTo({top:0,left:0,behavior:'instant'});
  return () => { document.body.style.overflow = previous; };
 }, [mostrarOverlay]);
 useEffect(() => {
  if (carregando || !imagensProntas || !mostrarOverlay) return;
  const iniciadaEm = Number(sessionStorage.getItem('vambora.busca.iniciadaEm')) || Date.now();
  const espera = Math.max(0, 3000 - (Date.now() - iniciadaEm));
  const id = window.setTimeout(() => {
   window.scrollTo({top:0,left:0,behavior:'instant'});
   sessionStorage.removeItem('vambora.busca.transicao');
   sessionStorage.removeItem('vambora.busca.iniciadaEm');
   setMostrarOverlay(false);
  }, espera);
  return () => clearTimeout(id);
 }, [carregando, imagensProntas, mostrarOverlay]);
 return <main className="container-page py-8">
  <AnimatePresence>{mostrarOverlay&&<SearchLoadingScreen key="busca-loading" cidade="Araçatuba" />}</AnimatePresence>
  <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-navy-700 hover:text-navy-900"><ArrowLeft size={17}/> Nova busca</Link>
  <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-navy-900">Vans para {destino?.nome||'sua escola'}</h1>
  <p className="mt-2 text-sm text-navy-500">Localização e trajetos consultados em mapas reais.</p>
  {buscaDemo
   ? <FamilyDemoResults ofertas={ofertas} carregando={carregando} erro={erro} horario={horario} endereco={criterios.endereco} onEditar={()=>window.location.assign('/')}/>
   : <section className="mt-6" aria-busy={carregando}>
      {carregando&&<p className="text-sm text-navy-500">Avaliando as rotas cadastradas…</p>}
      {erro&&<p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">{erro}</p>}
      {!carregando&&!erro&&reais.length>0&&<>
       <p className="text-sm text-navy-600">{reais.length} {reais.length===1?'rota compatível encontrada':'rotas compatíveis encontradas'}. Horários estimados — a vaga é confirmada pelo motorista.</p>
       <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{reais.map(r=><CartaoRotaReal key={r.rotaId+r.sentido} r={r}/>)}</div>
      </>}
      {!carregando&&!erro&&reais.length===0&&<>
       <p className="rounded-xl bg-navy-50 p-4 text-sm text-navy-700">Nenhuma rota cadastrada encaixa neste endereço e escola no momento. Deixe seu contato para ser avisado quando surgir uma vaga.</p>
       <div className="mt-4"><WaitlistForm criterios={criterios}/></div>
      </>}
     </section>}
 </main>;
}
