import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { paramsParaCriterios } from '@/lib/searchParams';
import { useVitrine } from '@/data/VitrineProvider';
import { buscarOfertasDemo, horarioPadrao, type OfertaDemo } from '@/features/family-search-demo/engine';
import { FamilyDemoResults } from '@/features/family-search-demo/FamilyDemoResults';
import { SearchLoadingScreen } from '@/components/search/SearchLoadingScreen';

export function SearchResultsPage(){
 const [sp]=useSearchParams();
 const parametros=sp.toString();
 const criterios=useMemo(()=>paramsParaCriterios(new URLSearchParams(parametros)),[parametros]);
 const {destinosPorId}=useVitrine();
 const destino=criterios.destinoId?destinosPorId[criterios.destinoId]??null:null;
 const horario=sp.get('horario')||horarioPadrao(criterios.turno,criterios.modalidade);
 const [ofertas,setOfertas]=useState<OfertaDemo[]>([]);
 const [carregando,setCarregando]=useState(true);
 const [mostrarOverlay,setMostrarOverlay]=useState(() => sessionStorage.getItem('vambora.busca.transicao') === '1');
 const [imagensProntas,setImagensProntas]=useState(false);
 const [erro,setErro]=useState('');
 useEffect(()=>{
  const ctrl=new AbortController();
  setCarregando(true);setErro('');setOfertas([]);setImagensProntas(false);
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
  buscarOfertasDemo({criterios,destino,horario},ctrl.signal)
   .then(lista=>{if(!ctrl.signal.aborted){setOfertas(lista);if(!lista.length)setErro('Não foi possível confirmar rotas viárias compatíveis. Verifique o endereço ou tente novamente mais tarde.');}})
   .catch(()=>{if(!ctrl.signal.aborted)setErro('Falha ao consultar o serviço de trajetos. Tente novamente.');})
   .finally(()=>{if(!ctrl.signal.aborted)setCarregando(false);});
  return()=>ctrl.abort();
 },[criterios,destino,horario]);
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
  const id = requestAnimationFrame(() => {
   window.scrollTo({top:0,left:0,behavior:'instant'});
   sessionStorage.removeItem('vambora.busca.transicao');
   setMostrarOverlay(false);
  });
  return () => cancelAnimationFrame(id);
 }, [carregando, imagensProntas, mostrarOverlay]);
 return <main className="container-page vb-marketplace-page py-8">
  <AnimatePresence>{mostrarOverlay&&<SearchLoadingScreen key="busca-loading" totalConsultados={0} cidade="Araçatuba" />}</AnimatePresence>
  <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-navy-700 hover:text-navy-900"><ArrowLeft size={17}/> Nova busca</Link>
  <div className="mt-5"><span className="chip bg-mint-100 font-bold text-mint-800 ring-1 ring-mint-200">Experiência demonstrativa</span></div>
  <div className="vb-results-intro"><div><span className="vb-eyebrow">TRANSPORTE ESCOLAR EM ARAÇATUBA</span><h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-navy-900">Encontre a van ideal para sua família</h1><p className="vb-intro-caption">Compare opções para {destino?.nome||'sua escola'}, confira horários e conheça os motoristas.</p></div><div className="vb-intro-symbol" aria-hidden="true"><span>Van<span>Bora</span></span><span className="vb-intro-line" /></div></div>
  <p className="mt-2 text-sm text-navy-500">Ofertas ilustrativas · localização e trajetos consultados em mapas reais.</p>
  <FamilyDemoResults ofertas={ofertas} carregando={carregando} erro={erro} horario={horario} endereco={criterios.endereco} onEditar={()=>window.location.assign('/')}/>
 </main>;
}
