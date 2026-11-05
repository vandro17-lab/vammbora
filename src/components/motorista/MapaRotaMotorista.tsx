import { useState } from 'react';
import { MapPin, Loader2, Navigation, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import type { Rota } from '@/types/motorista';
type Sugestao = { rotulo: string; lat: number; lng: number };
type Resposta = { resultados?: Sugestao[]; trechos?: { minutos: number; metros: number }[]; erro?: string };
async function consultar(body: unknown): Promise<Resposta> {
  const response = await fetch('/api/mapas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
  const data = await response.json() as Resposta;
  if (!response.ok) throw new Error(data.erro ?? 'Falha ao consultar mapa.');
  return data;
}
export function MapaRotaMotorista({ rota, setRota }: { rota: Rota; setRota: (r: Rota) => void }) {
  const [editando, setEditando] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const paradas = [...rota.paradas].sort((a,b)=>a.ordem-b.ordem);
  const localizadas = paradas.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const todas = paradas.length >= 2 && localizadas.length === paradas.length;
  async function buscar() {
    setOcupado(true);setAviso('');setSugestoes([]);
    try {
      const r = await consultar({ operacao:'buscar', texto });
      setSugestoes(r.resultados ?? []);
      if (!r.resultados?.length) setAviso('Nenhum endereço encontrado. Informe rua, número e bairro.');
    } catch(e) { setAviso((e as Error).message); }
    finally { setOcupado(false); }
  }
  function selecionar(s: Sugestao) {
    setRota({ ...rota, paradas: rota.paradas.map(p=>p.id===editando?{...p,rotulo:s.rotulo,lat:s.lat,lng:s.lng,confirmado:true,tempoAteProximaMin:null}:p).map((p,i,a)=>i>0?{...p,tempoAteProximaMin:null}:p) });
    setEditando(null);setSugestoes([]);setMostrarMapa(false);setAviso('Ponto confirmado no mapa. Recalcule os tempos de deslocamento.');
  }
  async function calcular() {
    if (!todas) return;
    setOcupado(true);setAviso('');
    try {
      const r=await consultar({operacao:'rota',pontos:paradas.map(p=>({lat:p.lat,lng:p.lng}))});
      if (!r.trechos || r.trechos.length !== paradas.length-1) throw new Error('Trajeto incompleto.');
      const porId = new Map(paradas.slice(0,-1).map((p,i)=>[p.id,r.trechos![i].minutos]));
      setRota({...rota,paradas:rota.paradas.map(p=>({...p,tempoAteProximaMin:porId.get(p.id)??null}))});
      setAviso('Tempos estimados pelas ruas preenchidos. Confira os horários e salve a rota.');
    } catch(e){setAviso((e as Error).message);}
    finally {setOcupado(false);}
  }
  const centro=localizadas[0];
  const src=centro ? 'https://www.openstreetmap.org/export/embed.html?bbox='+encodeURIComponent((centro.lng-0.012)+','+(centro.lat-0.012)+','+(centro.lng+0.012)+','+(centro.lat+0.012))+'&layer=mapnik&marker='+encodeURIComponent(centro.lat+','+centro.lng):'';
  return <section className="card mt-4 p-5" aria-label="Localização real das paradas">
    <div className="flex items-center gap-2"><Navigation className="h-5 w-5 text-mint-600"/><h2 className="font-display text-lg font-bold">Mapa da sua rota</h2></div>
    <p className="mt-2 text-sm text-navy-600">Localize cada endereço no mapa. Depois, calculamos automaticamente os minutos de deslocamento pelas ruas.</p>
    <div className="mt-3 rounded-xl bg-navy-50 p-3 text-sm text-navy-700"><strong>{localizadas.length} de {paradas.length}</strong> paradas localizadas</div>
    <div className="mt-3 space-y-2">{paradas.map((p,i)=><div key={p.id} className="rounded-xl border border-navy-100 p-3">
      <div className="flex items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">{i+1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.tipo==='saida'?'Ponto de saída':p.tipo==='escola'?(p.destinoNome||'Escola'):(p.rotulo||'Casa')}</p><p className="truncate text-xs text-navy-500">{Number.isFinite(p.lat)&&Number.isFinite(p.lng)?'Localização confirmada':'Localização pendente'}</p></div>{Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&<CheckCircle2 className="h-4 w-4 text-mint-600"/>}<button type="button" className="btn btn-sm btn-ghost" onClick={()=>{setEditando(editando===p.id?null:p.id);setTexto(p.rotulo||p.destinoNome||'');setSugestoes([]);setAviso('');}}>{p.lat==null?'Localizar':'Alterar'}</button></div>
      {editando===p.id&&<div className="mt-3 space-y-2"><label className="text-xs font-semibold text-navy-700" htmlFor={'endereco-'+p.id}>Rua, número, bairro e cidade</label><input id={'endereco-'+p.id} className="field-input" value={texto} onChange={e=>setTexto(e.target.value)} placeholder="Rua, número e bairro" autoComplete="street-address"/><button type="button" className="btn btn-primary btn-sm w-full" disabled={ocupado||texto.trim().length<5} onClick={buscar}>{ocupado?<Loader2 className="h-4 w-4 animate-spin"/>:<MapPin className="h-4 w-4"/>} Buscar endereço</button>
        {sugestoes.map((s,k)=><button type="button" key={k} className="w-full rounded-lg border border-navy-200 p-3 text-left text-sm hover:bg-mint-50" onClick={()=>selecionar(s)}><MapPin className="mr-1 inline h-4 w-4 text-mint-600"/>{s.rotulo}<span className="mt-1 block text-xs text-navy-500">Confirmar este ponto</span></button>)}
      </div>}
    </div>)}</div>
    <button type="button" className="btn btn-lg btn-primary mt-4 w-full" onClick={calcular} disabled={!todas||ocupado}>{ocupado?<Loader2 className="h-5 w-5 animate-spin"/>:<Navigation className="h-5 w-5"/>} Calcular tempos reais da rota</button>
    {!todas&&<p className="mt-2 text-xs text-amber-700">Localize todas as paradas para habilitar o cálculo.</p>}
    {aviso&&<p role="status" className="mt-3 flex items-start gap-2 rounded-xl bg-navy-50 p-3 text-sm text-navy-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>{aviso}</p>}
    {centro&&<div className="mt-4"><button type="button" className="inline-flex items-center gap-2 text-sm font-semibold text-navy-700 underline" onClick={()=>setMostrarMapa(v=>!v)}><ExternalLink className="h-4 w-4"/>{mostrarMapa?'Ocultar mapa':'Visualizar ponto no OpenStreetMap'}</button><p className="mt-1 text-xs text-navy-500">Ao abrir o mapa, a localização do primeiro ponto é enviada ao OpenStreetMap. Não compartilhe o endereço de alunos sem necessidade.</p>{mostrarMapa&&<iframe title="Mapa do primeiro ponto da rota" src={src} className="mt-3 h-64 w-full rounded-xl border border-navy-200" loading="lazy" referrerPolicy="no-referrer"/>}</div>}
    <p className="mt-3 text-xs text-navy-500">Fonte: Geoapify / OpenStreetMap. Tempos são estimativas, não garantia de trânsito ou horário. As informações permanecem privadas no cadastro.</p>
  </section>;
}
