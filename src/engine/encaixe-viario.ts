/**
 * Motor determinístico de inserção com prazo final rígido.
 * A matriz vem de um serviço viário externo (nunca distância em linha reta).
 * Não confirma contratação nem substitui trânsito/segurança operacional.
 */
export type Ponto = { id: string; lat: number; lng: number };
export type Parada = Ponto & {
  tipo: 'saida' | 'casa' | 'escola';
  embarques: string[];
  desembarques: string[];
  atendimentoMin: number;
  /** Prazo inegociável de chegada a esta parada (escolas, término da rota). */
  chegadaAte?: number;
  /** Referência contratada, não deve ser alterada a cada encaixe. */
  chegadaOriginal?: number;
};
export type MatrizViaria = { ids: string[]; minutos: number[][]; metros?: number[][] };
export type Entrada = {
  paradas: Parada[];
  matriz: MatrizViaria;
  capacidade: number;
  reservados: number;
  /** Início possível da viagem. */
  saidaDe: number;
  /** Saída máxima autorizada. */
  saidaAte: number;
  /** Chegada ao ponto FINAL, inegociável. */
  fimAte: number;
  toleranciaMin?: number;
  limiteABordoMin?: number;
};
export type Pedido = {
  id: string;
  embarque: Ponto;
  desembarqueId: string;
  /** Ex.: entrada da aula, ou início da janela de embarque na volta. */
  embarqueDe?: number;
  embarqueAte?: number;
  desembarqueAte?: number;
};
export type Evento = { id: string; chegada: number; saida: number; ocupacao: number };
export type Plano = { valido: boolean; motivos: string[]; inicio?: number; fim?: number; eventos: Evento[]; minutosRodando?: number; metros?: number };
export type Encaixe = { disponivel: boolean; motivos: string[]; plano?: Plano; indice?: number; impactoMin?: number; passagemCasa?: number; chegadaDestino?: number; alternativasTestadas: number };
const validoMin = (v: number) => Number.isFinite(v) && v >= 0 && v < 1440;
function tempo(m: MatrizViaria, a: string, b: string): number {
  const i=m.ids.indexOf(a),j=m.ids.indexOf(b);
  if(i<0||j<0) return NaN;
  return m.minutos[i]?.[j] ?? NaN;
}
function validar(e: Entrada): string[] {
  const p=e.paradas;
  const motivos:string[]=[];
  if(p.length<2 || p[0].tipo!=='saida') motivos.push('Rota precisa de início e parada final.');
  if(!Number.isInteger(e.capacidade)||e.capacidade<1||!Number.isInteger(e.reservados)||e.reservados<0||e.reservados>=e.capacidade) motivos.push('Capacidade inválida.');
  if(!validoMin(e.saidaDe)||!validoMin(e.saidaAte)||!validoMin(e.fimAte)||e.saidaDe>e.saidaAte) motivos.push('Horários de saída ou final inválidos.');
  if(new Set(p.map(x=>x.id)).size!==p.length) motivos.push('Paradas duplicadas.');
  if(p.some(x=>!Number.isFinite(x.lat)||!Number.isFinite(x.lng)||x.lat < -90||x.lat >90||x.lng < -180||x.lng >180||!Number.isFinite(x.atendimentoMin)||x.atendimentoMin<0)) motivos.push('Localização ou atendimento inválidos.');
  if(p.some(x=>x.chegadaAte!==undefined&&!validoMin(x.chegadaAte))) motivos.push('Prazo de parada inválido.');
  if(p.some(x=>x.chegadaOriginal!==undefined&&!validoMin(x.chegadaOriginal))) motivos.push('Horário contratado inválido.');
  if(e.toleranciaMin!==undefined&&(!Number.isFinite(e.toleranciaMin)||e.toleranciaMin<0)) motivos.push('Tolerância inválida.');
  if(e.limiteABordoMin!==undefined&&(!Number.isFinite(e.limiteABordoMin)||e.limiteABordoMin<=0)) motivos.push('Tempo máximo a bordo inválido.');
  if(p.some(x=>!Array.isArray(x.embarques)||!Array.isArray(x.desembarques))) motivos.push('Passageiros inválidos.');
  if(p.length>0 && !p.every((x,i)=>i===0 || Number.isFinite(tempo(e.matriz,p[i-1].id,x.id))&&tempo(e.matriz,p[i-1].id,x.id)>=0)) motivos.push('Matriz viária incompleta: não é possível estimar a rota.');
  return motivos;
}
export function calcularPlano(e: Entrada): Plano {
  const motivos=validar(e);
  if(motivos.length) return {valido:false,motivos,eventos:[]};
  const p=e.paradas;
  const offsets=[0];let total=0;
  for(let i=1;i<p.length;i++){total+=p[i-1].atendimentoMin+tempo(e.matriz,p[i-1].id,p[i].id);offsets.push(total);}
  let minimo=e.saidaDe,maximo=Math.min(e.saidaAte,e.fimAte-total);
  for(let i=0;i<p.length;i++){
    const x=p[i];
    if(x.chegadaAte!==undefined) maximo=Math.min(maximo,x.chegadaAte-offsets[i]);
    if(x.chegadaOriginal!==undefined){
      const t=e.toleranciaMin??10;
      minimo=Math.max(minimo,x.chegadaOriginal-t-offsets[i]);
      maximo=Math.min(maximo,x.chegadaOriginal+t-offsets[i]);
    }
  }
  if(minimo>maximo || maximo<0) return {valido:false,motivos:['Não é possível cumprir o horário final e os compromissos existentes.'],eventos:[]};
  // A última saída viável evita antecipar os alunos sem necessidade.
  const inicio=maximo;
  const eventos:Evento[]=[];let ocupacao=0;
  const embarcados=new Map<string,number>();const vistos=new Set<string>();
  for(let i=0;i<p.length;i++){
    const x=p[i],chegada=inicio+offsets[i];
    for(const id of x.desembarques){
      const desde=embarcados.get(id);
      if(desde===undefined) motivos.push('Desembarque sem embarque: '+id);
      else {
        if(e.limiteABordoMin!==undefined&&chegada-desde>e.limiteABordoMin) motivos.push('Tempo a bordo excedido: '+id);
        embarcados.delete(id);ocupacao--;
      }
    }
    for(const id of x.embarques){
      if(vistos.has(id)) motivos.push('Embarque duplicado: '+id);
      vistos.add(id);embarcados.set(id,chegada);ocupacao++;
    }
    if(ocupacao>e.capacidade-e.reservados) motivos.push('Capacidade excedida em '+x.id);
    eventos.push({id:x.id,chegada,saida:chegada+x.atendimentoMin,ocupacao});
  }
  if(embarcados.size) motivos.push('Existem passageiros sem desembarque.');
  if(eventos.at(-1)!.chegada>e.fimAte) motivos.push('Horário final ultrapassado.');
  return {valido:motivos.length===0,motivos,eventos,inicio,fim:eventos.at(-1)!.chegada,minutosRodando:total};
}
/** Testa todas as posições ANTES do destino, mantendo a ordem dos antigos. */
export function encontrarEncaixe(e: Entrada, pedido: Pedido, matrizAmpliada: MatrizViaria): Encaixe {
  const base=calcularPlano(e);
  if(!base.valido) return {disponivel:false,motivos:['Rota original precisa estar válida.',...base.motivos],alternativasTestadas:0};
  if(e.paradas.some(p=>p.id===pedido.embarque.id)||!e.paradas.some(p=>p.id===pedido.desembarqueId)) return {disponivel:false,motivos:['Ponto ou destino inválido.'],alternativasTestadas:0};
  let melhor:Encaixe|undefined;let tentativas=0;
  for(let i=1;i<e.paradas.length;i++){
    const destinoIndex=e.paradas.findIndex(p=>p.id===pedido.desembarqueId);
    if(destinoIndex<i) continue;
    tentativas++;
    const parada:Parada={...pedido.embarque,tipo:'casa',embarques:[pedido.id],desembarques:[],atendimentoMin:1};
    const ps=e.paradas.map(p=>({...p,embarques:[...p.embarques],desembarques:[...p.desembarques]}));
    ps.splice(i,0,parada);
    const destino=ps.find(p=>p.id===pedido.desembarqueId)!;
    destino.desembarques.push(pedido.id);
    if(pedido.desembarqueAte!==undefined) destino.chegadaAte=Math.min(destino.chegadaAte??1439,pedido.desembarqueAte);
    const plano=calcularPlano({...e,paradas:ps,matriz:matrizAmpliada});
    if(!plano.valido) continue;
    const casa=plano.eventos.find(x=>x.id===pedido.embarque.id)!.chegada;
    const chega=plano.eventos.find(x=>x.id===pedido.desembarqueId)!.chegada;
    if((pedido.embarqueDe!==undefined&&casa<pedido.embarqueDe)||(pedido.embarqueAte!==undefined&&casa>pedido.embarqueAte)) continue;
    const impacto=plano.minutosRodando!-base.minutosRodando!;
    if(!melhor||impacto<melhor.impactoMin!) melhor={disponivel:true,motivos:['Encaixe estimado; depende de confirmação do motorista.'],plano,indice:i,impactoMin:impacto,passagemCasa:casa,chegadaDestino:chega,alternativasTestadas:tentativas};
  }
  return melhor?{...melhor,alternativasTestadas:tentativas}:{disponivel:false,motivos:['Nenhuma inserção respeita horários, capacidade, prazo final e janelas.'],alternativasTestadas:tentativas};
}
