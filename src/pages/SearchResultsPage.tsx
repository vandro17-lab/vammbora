import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { paramsParaCriterios } from '@/lib/searchParams';
import { useVitrine } from '@/data/VitrineProvider';
import { buscarOfertasDemo, horarioPadrao, type OfertaDemo } from '@/features/family-search-demo/engine';
import { FamilyDemoResults } from '@/features/family-search-demo/FamilyDemoResults';
import { buscaOverlay } from '@/lib/busca-overlay';
import { BUSCA_LIMITE_MS, esperaRestanteDaBusca } from '@/lib/animacoes';
import { DEMO_BUSCA } from '@/lib/supabase';
import { buscarRotasReais, continuarBuscaReal, type RespostaBuscaReal } from '@/lib/busca-rotas-reais-cliente';
import { ResultadosRotasReais } from '@/components/results/ResultadosRotasReais';

export function SearchResultsPage(){
 const [sp]=useSearchParams();
 const parametros=sp.toString();
 const criterios=useMemo(()=>paramsParaCriterios(new URLSearchParams(parametros)),[parametros]);
 const {destinosPorId,modoDemo,carregando:vitrineCarregando}=useVitrine();
 // Fluxo real (padrão): rotas cadastradas, via /api/buscar-rotas. As ofertas de
 // exemplo só aparecem no modo demonstração EXPLÍCITO (ou sem Supabase).
 const buscaDemo=DEMO_BUSCA||modoDemo;
 // Resposta por sentido: cartões + o que ficou sem veredito (e por quê).
 const [real,setReal]=useState<RespostaBuscaReal|null>(null);
 // "Continuar avaliação": pede o PRÓXIMO lote, preservando o que já foi calculado.
 const [continuando,setContinuando]=useState(false);
 const destino=criterios.destinoId?destinosPorId[criterios.destinoId]??null:null;
 const horario=sp.get('horario')||horarioPadrao(criterios.turno,criterios.modalidade);
 const [ofertas,setOfertas]=useState<OfertaDemo[]>([]);
 const [carregando,setCarregando]=useState(true);
 // Tela de busca (animação): aberta pelo formulário no clique em "Buscar vans".
 const overlay=useSyncExternalStore(buscaOverlay.assinar,buscaOverlay.obter,buscaOverlay.obter);
 const [cancelada,setCancelada]=useState(false);
 const [tentativa,setTentativa]=useState(0);
 const [imagensProntas,setImagensProntas]=useState(false);
 const [erro,setErro]=useState('');
 useEffect(()=>{
  // Uma consulta por vez: trocar os critérios (ou sair da página) aborta a
  // anterior, e respostas de consultas abortadas são descartadas.
  const ctrl=new AbortController();
  setCarregando(true);setErro('');setOfertas([]);setReal(null);setContinuando(false);setImagensProntas(false);setCancelada(false);
  const limite=window.setTimeout(()=>{
   ctrl.abort();
   setErro('A busca demorou mais do que o esperado. Verifique a conexão e tente novamente.');
   setCarregando(false);
  },BUSCA_LIMITE_MS);
  const encerrar=()=>{clearTimeout(limite);ctrl.abort();};
  buscaOverlay.definirCancelamento(()=>{clearTimeout(limite);ctrl.abort();setCancelada(true);setCarregando(false);});
  if(!criterios.origemLat||!criterios.origemLng){
   setErro('Selecione um endereço reconhecido pelo mapa para calcular as opções.');
   clearTimeout(limite);setCarregando(false);
   return encerrar;
  }
  // Catálogo de escolas ainda chegando: continua carregando (não é erro).
  if(!destino&&vitrineCarregando)return encerrar;
  if(!destino||destino.lat==null||destino.lng==null){
   setErro('Escolha uma escola com localização disponível para calcular o trajeto.');
   clearTimeout(limite);setCarregando(false);
   return encerrar;
  }
  if(!buscaDemo){
   // BUSCA REAL: o servidor avalia as rotas do Supabase com o motor de encaixe
   // e devolve só o veredito (sem dados de outros passageiros).
   buscarRotasReais(criterios,{lat:destino.lat,lng:destino.lng},ctrl.signal)
    .then(r=>{
     if(ctrl.signal.aborted)return;
     clearTimeout(limite);
     if(r.estado==='ok')setReal(r);
     else setErro(r.estado==='nao_configurado'
      ?'A busca por rotas ainda não está disponível neste ambiente. Tente novamente mais tarde.'
      :'Não foi possível consultar as rotas agora. Verifique a conexão e tente novamente.');
    })
    .finally(()=>{if(!ctrl.signal.aborted)setCarregando(false);});
   return encerrar;
  }
  buscarOfertasDemo({criterios,destino,horario},ctrl.signal)
   .then(lista=>{if(!ctrl.signal.aborted){setOfertas(lista);if(!lista.length)setErro('Não foi possível confirmar rotas viárias compatíveis. Verifique o endereço ou tente novamente mais tarde.');}})
   .catch(()=>{if(!ctrl.signal.aborted)setErro('Falha ao consultar o serviço de trajetos. Tente novamente.');})
   .finally(()=>{if(!ctrl.signal.aborted){clearTimeout(limite);setCarregando(false);}});
  return encerrar;
 },[criterios,destino,horario,buscaDemo,tentativa,vitrineCarregando]);
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
 // Fecha a animação quando a consulta terminou (resultado, vazio ou erro) E o
 // mínimo de exibição já passou; se a consulta demorar mais, espera por ela.
 useEffect(() => {
  if (!overlay.aberta || carregando || !imagensProntas) return;
  const id = window.setTimeout(() => {
   window.scrollTo({top:0,left:0,behavior:'instant'});
   buscaOverlay.fechar();
  }, esperaRestanteDaBusca(overlay.iniciadaEm, Date.now()));
  return () => clearTimeout(id);
 }, [overlay.aberta, overlay.iniciadaEm, carregando, imagensProntas]);
 return <main className="container-page py-8">
  <Link to="/buscar" className="inline-flex items-center gap-2 text-sm font-semibold text-navy-700 hover:text-navy-900"><ArrowLeft size={17}/> Nova busca</Link>
  <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-navy-900">Vans para {destino?.nome||'sua escola'}</h1>
  <p className="mt-2 text-sm text-navy-500">Localização e trajetos consultados em mapas reais.</p>
  {cancelada
   ? <section className="mt-6">
      <p role="status" className="rounded-xl bg-navy-50 p-4 text-sm text-navy-700">Busca cancelada. Nenhum resultado foi carregado.</p>
      <button type="button" className="btn btn-primary mt-4" onClick={()=>setTentativa(n=>n+1)}>Buscar novamente</button>
     </section>
   : buscaDemo
   ? <FamilyDemoResults ofertas={ofertas} carregando={carregando} erro={erro} horario={horario} endereco={criterios.endereco} onEditar={()=>window.location.assign('/buscar')}/>
   : <section className="mt-6" aria-busy={carregando}>
      {carregando&&<p className="text-sm text-navy-500">Avaliando as rotas cadastradas…</p>}
      {erro&&<p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">{erro}</p>}
      {!carregando&&!erro&&real&&<ResultadosRotasReais resposta={real} criterios={criterios} continuando={continuando}
       onTentar={()=>setTentativa(n=>n+1)}
       onContinuar={()=>{
        if(!destino||destino.lat==null||destino.lng==null||continuando)return;
        const base=real;
        setContinuando(true);
        continuarBuscaReal(criterios,{lat:destino.lat,lng:destino.lng},base)
         // Só aplica se ainda é a mesma busca (critérios não mudaram no meio).
         .then(r=>setReal(atual=>atual===base?r:atual))
         .finally(()=>setContinuando(false));
       }}/>}
     </section>}
  {/* Pesquisar NÃO cria solicitação: só abre o formulário, já preenchido com esta busca. */}
  {!cancelada&&!carregando&&<section className="mt-8 rounded-2xl bg-white p-5 ring-1 ring-navy-100" aria-labelledby="registrar-solicitacao">
   <h2 id="registrar-solicitacao" className="font-display text-lg font-bold text-navy-900">Registre o que você procura</h2>
   <p className="mt-1 text-sm text-navy-600">Guarde esta necessidade na sua conta, com os dados desta busca. Você confere tudo antes, e a solicitação só é criada quando você confirmar.</p>
   <Link to={`/familia/solicitacoes/nova?${parametros}`} className="btn btn-primary mt-4">Registrar uma solicitação</Link>
  </section>}
 </main>;
}
