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
import { buscarRotasReais, type CartaoRotaRealDados } from '@/lib/busca-rotas-reais-cliente';
import { CartaoRotaReal } from '@/components/results/CartaoRotaReal';
import { WaitlistForm } from '@/components/results/WaitlistForm';

export function SearchResultsPage(){
 const [sp]=useSearchParams();
 const parametros=sp.toString();
 const criterios=useMemo(()=>paramsParaCriterios(new URLSearchParams(parametros)),[parametros]);
 const {destinosPorId,modoDemo,carregando:vitrineCarregando}=useVitrine();
 // Fluxo real (padrão): rotas cadastradas, via /api/buscar-rotas. As ofertas de
 // exemplo só aparecem no modo demonstração EXPLÍCITO (ou sem Supabase).
 const buscaDemo=DEMO_BUSCA||modoDemo;
 const [reais,setReais]=useState<CartaoRotaRealDados[]>([]);
 // Rotas candidatas que não puderam ser avaliadas (não é "sem vaga").
 const [inconclusivas,setInconclusivas]=useState(0);
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
  setCarregando(true);setErro('');setOfertas([]);setReais([]);setInconclusivas(0);setImagensProntas(false);setCancelada(false);
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
     if(r.estado==='ok'){setReais(r.resultados);setInconclusivas(r.inconclusivas);}
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
  <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-navy-700 hover:text-navy-900"><ArrowLeft size={17}/> Nova busca</Link>
  <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-navy-900">Vans para {destino?.nome||'sua escola'}</h1>
  <p className="mt-2 text-sm text-navy-500">Localização e trajetos consultados em mapas reais.</p>
  {cancelada
   ? <section className="mt-6">
      <p role="status" className="rounded-xl bg-navy-50 p-4 text-sm text-navy-700">Busca cancelada. Nenhum resultado foi carregado.</p>
      <button type="button" className="btn btn-primary mt-4" onClick={()=>setTentativa(n=>n+1)}>Buscar novamente</button>
     </section>
   : buscaDemo
   ? <FamilyDemoResults ofertas={ofertas} carregando={carregando} erro={erro} horario={horario} endereco={criterios.endereco} onEditar={()=>window.location.assign('/')}/>
   : <section className="mt-6" aria-busy={carregando}>
      {carregando&&<p className="text-sm text-navy-500">Avaliando as rotas cadastradas…</p>}
      {erro&&<p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">{erro}</p>}
      {!carregando&&!erro&&reais.length>0&&<>
       <p className="text-sm text-navy-600">{reais.length} {reais.length===1?'rota compatível encontrada':'rotas compatíveis encontradas'}. Horários estimados — a vaga é confirmada pelo motorista.</p>
       <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{reais.map(r=><CartaoRotaReal key={r.rotaId+r.sentido} r={r}/>)}</div>
       {inconclusivas>0&&<p role="status" className="mt-4 rounded-xl bg-navy-50 p-3 text-xs text-navy-600">{inconclusivas===1?'1 outra rota não pôde ser avaliada agora':`${inconclusivas} outras rotas não puderam ser avaliadas agora`} (falta de dados de trajeto). <button type="button" className="font-semibold text-mint-700 underline" onClick={()=>setTentativa(n=>n+1)}>Tentar de novo</button></p>}
      </>}
      {!carregando&&!erro&&reais.length===0&&inconclusivas>0&&<>
       <p role="status" data-testid="aviso-inconclusivo" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">{inconclusivas===1?'Encontramos 1 rota que passa pela sua escola, mas ela não pôde ser avaliada agora':`Encontramos ${inconclusivas} rotas que passam pela sua escola, mas elas não puderam ser avaliadas agora`} (faltou calcular o trajeto pelas ruas). Isso não significa que não há vaga.</p>
       <button type="button" className="btn btn-primary mt-4" onClick={()=>setTentativa(n=>n+1)}>Tentar de novo</button>
       <div className="mt-6"><WaitlistForm criterios={criterios}/></div>
      </>}
      {!carregando&&!erro&&reais.length===0&&inconclusivas===0&&<>
       <p className="rounded-xl bg-navy-50 p-4 text-sm text-navy-700">Nenhuma rota cadastrada encaixa neste endereço e escola no momento. Deixe seu contato para ser avisado quando surgir uma vaga.</p>
       <div className="mt-4"><WaitlistForm criterios={criterios}/></div>
      </>}
     </section>}
 </main>;
}
