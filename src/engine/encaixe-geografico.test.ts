import { describe, expect, it } from 'vitest';
import { encontrarEncaixes, encontrarIdaVolta, simularRota, type RotaOperacional, type MatrizViaria, type PontoGeo } from './encaixe-geografico';
const p = (id: string): PontoGeo => ({ id, nome: id, lat: -21.2, lng: -50.4 });
const matriz: MatrizViaria = { origem: 'fixture-testada', obter: (a,b) => ({ minutos: a.id === b.id ? 0 : 3, metros: a.id === b.id ? 0 : 1000 }) };
const rota = (sentido: 'ida'|'volta' = 'ida'): RotaOperacional => ({
  id: 'r', versao: 1, sentido, inicio: p('garagem'), partidaMin: sentido === 'ida' ? 390 : 720,
  capacidade: 3, ocupacaoInicial: 0, toleranciaMin: 10,
  compromissos: sentido === 'ida' ? [
    { id:'a',ponto:p('a'),tipo:'embarque',alunoId:'a',atendimentoMin:1 },
    { id:'b',ponto:p('b'),tipo:'embarque',alunoId:'b',atendimentoMin:1 },
    { id:'escola',ponto:p('escola'),tipo:'escola',atendimentoMin:1,limiteEscolaMin:420 },
    { id:'d-a',ponto:p('escola'),tipo:'desembarque',alunoId:'a',atendimentoMin:0,limiteEscolaMin:420 },
    { id:'d-b',ponto:p('escola'),tipo:'desembarque',alunoId:'b',atendimentoMin:0,limiteEscolaMin:420 },
  ] : [
    { id:'e-a',ponto:p('escola'),tipo:'embarque',alunoId:'a',atendimentoMin:1 },
    { id:'e-b',ponto:p('escola'),tipo:'embarque',alunoId:'b',atendimentoMin:1 },
    { id:'d-a',ponto:p('a'),tipo:'desembarque',alunoId:'a',atendimentoMin:1 },
    { id:'d-b',ponto:p('b'),tipo:'desembarque',alunoId:'b',atendimentoMin:1 },
  ],
});
const pedido = { alunoId:'novo',casa:p('casa'),escola:p('escola'),horarioEscolaMin:420 };
describe('motor de encaixe geográfico',()=>{
 it('calcula uma rota-base com ocupação por trecho',()=>{const r=simularRota(rota(),matriz);expect(r.valido).toBe(true);expect(r.eventos[1].ocupacaoApos).toBe(2)});
 it('retorna horário de busca em casa e chegada na escola',()=>{const r=encontrarEncaixes(rota(),pedido,matriz);expect(r.length).toBeGreaterThan(0);expect(r[0].horarioBuscaMin).toBeLessThan(r[0].horarioEntregaMin)});
 it('rejeita quando a capacidade está esgotada',()=>{const r=rota();r.capacidade=2;expect(encontrarEncaixes(r,pedido,matriz).length).toBe(0)});
 it('rejeita escola com limite impossível',()=>{const r=rota();r.compromissos[2].limiteEscolaMin=395;expect(encontrarEncaixes(r,pedido,matriz)).toEqual([])});
 it('não altera mais de dez minutos dos antigos',()=>{const r=rota();r.toleranciaMin=0;const op=encontrarEncaixes(r,pedido,matriz);for(const x of op)expect(x.alteracoes.every(a=>a.diferencaMin===0)).toBe(true)});
 it('rejeita trechos sem dados viários',()=>{const incompleta: MatrizViaria={origem:'fixture-testada',obter:()=>null};expect(encontrarEncaixes(rota(),pedido,incompleta)).toEqual([])});
 it('calcula ida e volta com chegada em casa',()=>{const r=encontrarIdaVolta(rota(),rota('volta'),pedido,matriz,720);expect(r.completo).toBe(true);expect(r.volta!.horarioEntregaMin).toBeGreaterThan(r.volta!.horarioBuscaMin)});
 it('não inventa escola fora do itinerário',()=>{expect(encontrarEncaixes(rota(),{...pedido,escola:p('outra-escola')},matriz)).toEqual([])});
 it('não duplica aluno já cadastrado',()=>{expect(encontrarEncaixes(rota(),{...pedido,alunoId:'a'},matriz)).toEqual([])});
 it('não aceita duração negativa de atendimento',()=>{expect(encontrarEncaixes(rota(),{...pedido,atendimentoMin:-2},matriz)).toEqual([])});
 it('não aceita tolerância negativa',()=>{const r=rota();r.toleranciaMin=-1;expect(encontrarEncaixes(r,pedido,matriz)).toEqual([])});
 it('não busca aluno antes da saída da escola',()=>{const r=encontrarEncaixes(rota('volta'),{...pedido,horarioEscolaMin:740},matriz);expect(r).toEqual([])});
});
