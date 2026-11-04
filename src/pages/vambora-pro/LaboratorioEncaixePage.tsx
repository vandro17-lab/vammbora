import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock3, Home, School, ShieldCheck, BusFront, AlertTriangle, Route } from 'lucide-react';
import { encontrarIdaVolta, type MatrizViaria, type PontoGeo, type RotaOperacional } from '@/engine/encaixe-geografico';
import { minutosParaTextoHora } from '@/lib/utils';

/** Laboratório demonstrativo: coordenadas e tempos sintéticos. NÃO é Google Maps nem busca pública. */
const ponto = (id: string, nome: string): PontoGeo => ({ id, nome, lat: -21.2, lng: -50.4 });
const casaA = ponto('casa-a', 'Casa da Ana');
const casaB = ponto('casa-b', 'Casa do Bruno');
const casaNova = ponto('casa-nova', 'Casa da nova família');
const escola = ponto('escola', 'Escola demonstrativa');
const garagem = ponto('garagem', 'Garagem');
const tempo: Record<string, number> = {
  'garagem>casa-a': 5, 'casa-a>casa-b': 5, 'casa-b>escola': 7,
  'garagem>casa-nova': 7, 'casa-a>casa-nova': 3, 'casa-nova>casa-b': 4,
  'casa-b>casa-nova': 4, 'casa-nova>escola': 8,
  'escola>casa-a': 8, 'casa-a>casa-b': 5, 'escola>casa-nova': 6,
  'casa-nova>casa-a': 4, 'casa-b>casa-nova': 4,
};
const matriz: MatrizViaria = {
  origem: 'fixture-testada',
  obter: (a,b) => {
    if (a.id === b.id) return { minutos: 0, metros: 0 };
    const t = tempo[a.id+'>'+b.id] ?? tempo[b.id+'>'+a.id] ?? 6;
    return { minutos: t, metros: t * 320 };
  },
};
function criarRota(sentido: 'ida' | 'volta', limite: number): RotaOperacional {
  return {
    id: sentido, versao: 1, sentido, inicio: sentido === 'ida' ? garagem : escola,
    partidaMin: sentido === 'ida' ? 390 : 730, capacidade: 3, ocupacaoInicial: 0, toleranciaMin: 10,
    compromissos: sentido === 'ida' ? [
      { id:'ana-embarque', ponto:casaA, tipo:'embarque', alunoId:'ana', atendimentoMin:1 },
      { id:'bruno-embarque', ponto:casaB, tipo:'embarque', alunoId:'bruno', atendimentoMin:1 },
      { id:'escola-limite', ponto:escola, tipo:'escola', atendimentoMin:0, limiteEscolaMin:limite },
      { id:'ana-escola', ponto:escola, tipo:'desembarque', alunoId:'ana', atendimentoMin:1, limiteEscolaMin:limite },
      { id:'bruno-escola', ponto:escola, tipo:'desembarque', alunoId:'bruno', atendimentoMin:1, limiteEscolaMin:limite },
    ] : [
      { id:'ana-escola-volta', ponto:escola, tipo:'embarque', alunoId:'ana', atendimentoMin:1 },
      { id:'bruno-escola-volta', ponto:escola, tipo:'embarque', alunoId:'bruno', atendimentoMin:1 },
      { id:'ana-casa', ponto:casaA, tipo:'desembarque', alunoId:'ana', atendimentoMin:1 },
      { id:'bruno-casa', ponto:casaB, tipo:'desembarque', alunoId:'bruno', atendimentoMin:1 },
    ],
  };
}
function Hora({ rotulo, valor, icon: Icon }: { rotulo: string; valor: number; icon: typeof Home }) {
  return <div className="rounded-2xl bg-navy-50 p-4"><div className="flex items-center gap-2 text-xs text-navy-500"><Icon className="h-4 w-4"/>{rotulo}</div><p className="mt-2 font-display text-2xl font-extrabold text-navy-900">{minutosParaTextoHora(valor)}</p></div>;
}
export function LaboratorioEncaixePage() {
  const [limite, setLimite] = useState(420);
  const [vagas, setVagas] = useState(3);
  const resultado = useMemo(() => {
    const ida = criarRota('ida', limite);
    const volta = criarRota('volta', limite);
    ida.capacidade = vagas; volta.capacidade = vagas;
    return encontrarIdaVolta(ida, volta, { alunoId:'novo', casa:casaNova, escola, horarioEscolaMin:limite }, matriz, 730);
  }, [limite, vagas]);
  const { ida, volta, completo } = resultado;
  return <div className="min-h-dvh bg-navy-50 pb-16">
    <header className="bg-navy-900 text-white"><div className="container-page max-w-2xl py-6">
      <Link to="/pro" className="inline-flex items-center gap-2 text-sm text-navy-200"><ArrowLeft className="h-4 w-4"/> Voltar ao Vambora Pro</Link>
      <div className="mt-5 flex items-center gap-3"><span className="rounded-2xl bg-white/10 p-3"><Route className="h-7 w-7"/></span><div><p className="text-xs font-bold uppercase tracking-wider text-mint-300">Laboratório do motor</p><h1 className="font-display text-2xl font-extrabold">Encaixe inteligente</h1></div></div>
      <p className="mt-3 text-sm text-navy-200">Veja como o Vambora testa o encaixe sem ultrapassar os horários das famílias existentes.</p>
    </div></header>
    <main className="container-page max-w-2xl space-y-5 py-6">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0"/><p><strong>Simulação acadêmica.</strong> Todos os endereços, trajetos e horários são fictícios. A integração com mapas rodoviários e a confirmação de vagas ainda não estão ativas.</p></div></div>
      <section className="card p-5"><h2 className="font-display text-lg font-bold">Condições da rota</h2><p className="mt-1 text-sm text-navy-500">Altere as condições para testar o motor.</p>
        <label className="mt-5 block text-sm font-semibold text-navy-800" htmlFor="limite">Horário máximo de chegada à escola</label>
        <select id="limite" value={limite} onChange={e=>setLimite(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-navy-200 bg-white p-3 text-navy-900"><option value={420}>07h00</option><option value={415}>06h55</option><option value={410}>06h50</option><option value={400}>06h40</option></select>
        <label className="mt-4 block text-sm font-semibold text-navy-800" htmlFor="vagas">Capacidade de passageiros da van</label>
        <select id="vagas" value={vagas} onChange={e=>setVagas(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-navy-200 bg-white p-3 text-navy-900"><option value={3}>3 lugares — há espaço para o novo aluno</option><option value={2}>2 lugares — lotação existente</option></select>
        <p className="mt-4 flex items-center gap-2 text-xs text-navy-600"><ShieldCheck className="h-4 w-4 text-mint-600"/> Máximo de 10 minutos de alteração para cada passageiro antigo.</p>
      </section>
      {completo && ida && volta ? <section className="card overflow-hidden"><div className="flex items-center gap-3 bg-mint-50 p-5 text-mint-900"><ShieldCheck className="h-7 w-7"/><div><h2 className="font-display text-lg font-extrabold">Encaixe possível na simulação</h2><p className="text-sm">Ida e volta respeitam as condições testadas.</p></div></div>
        <div className="space-y-5 p-5"><div><h3 className="mb-3 flex items-center gap-2 font-bold"><School className="h-5 w-5"/> Ida para a escola</h3><div className="grid grid-cols-2 gap-3"><Hora rotulo="Busca em casa" valor={ida.horarioBuscaMin} icon={Home}/><Hora rotulo="Chegada à escola" valor={ida.horarioEntregaMin} icon={School}/></div></div>
        <div><h3 className="mb-3 flex items-center gap-2 font-bold"><BusFront className="h-5 w-5"/> Volta para casa</h3><div className="grid grid-cols-2 gap-3"><Hora rotulo="Busca na escola" valor={volta.horarioBuscaMin} icon={School}/><Hora rotulo="Chegada em casa" valor={volta.horarioEntregaMin} icon={Home}/></div></div>
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-navy-100 p-4 text-sm"><div><p className="text-navy-500">Tempo a bordo · ida</p><strong>{ida.minutosABordo} min</strong></div><div><p className="text-navy-500">Tempo a bordo · volta</p><strong>{volta.minutosABordo} min</strong></div><div><p className="text-navy-500">Desvio · ida</p><strong>{ida.desvioMin} min</strong></div><div><p className="text-navy-500">Desvio · volta</p><strong>{volta.desvioMin} min</strong></div></div>
        <p className="text-xs text-navy-500">Resultado calculado sobre matriz de testes, não sobre trânsito real. Não constitui oferta nem reserva.</p></div>
      </section> : <section className="card p-6"><div className="flex items-center gap-3 text-amber-700"><AlertTriangle className="h-6 w-6"/><h2 className="font-display text-lg font-bold">Não há encaixe completo nessas condições</h2></div><p className="mt-3 text-sm text-navy-600">O motor não oferece ida e volta quando a capacidade, a tolerância ou os horários impedem a inclusão. Ajuste os parâmetros acima para testar outra situação.</p><p className="mt-3 text-xs text-navy-500">Ida: {ida ? 'possível' : 'inviável'} · Volta: {volta ? 'possível' : 'inviável'}</p></section>}
      <p className="flex items-center gap-2 text-xs text-navy-500"><Clock3 className="h-4 w-4"/> Próxima etapa: tempos rodoviários reais, localização precisa protegida e confirmação pelo motorista. <ArrowRight className="h-4 w-4"/></p>
    </main>
  </div>;
}
