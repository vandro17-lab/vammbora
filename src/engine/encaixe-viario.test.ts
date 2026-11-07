import { describe,it,expect } from 'vitest';
import { calcularPlano,encontrarEncaixe,type Entrada,type MatrizViaria } from './encaixe-viario';
const matriz:MatrizViaria={ids:['saida','casa','escola','nova'],minutos:[
[0,10,30,11],
[10,0,15,4],
[30,15,0,20],
[11,4,20,0],
]};
const base:Entrada={matriz,capacidade:3,reservados:0,saidaDe:360,saidaAte:420,fimAte:420,
 paradas:[
 {id:'saida',tipo:'saida',lat:-21.2,lng:-50.4,embarques:[],desembarques:[],atendimentoMin:0},
 {id:'casa',tipo:'casa',lat:-21.21,lng:-50.41,embarques:['antigo'],desembarques:[],atendimentoMin:1,chegadaOriginal:389},
 {id:'escola',tipo:'escola',lat:-21.22,lng:-50.42,embarques:[],desembarques:['antigo'],atendimentoMin:0,chegadaAte:420,chegadaOriginal:405},
 ]};
describe('encaixe viario: prazo final inegociavel',()=>{
 it('calcula saída retroativa preservando o fim',()=>{const p=calcularPlano(base);expect(p.valido).toBe(true);expect(p.fim).toBeLessThanOrEqual(420);});
 it('recusa quando o prazo final é impossível',()=>{const p=calcularPlano({...base,fimAte:380});expect(p.valido).toBe(false);});
 it('testa posições e entrega horário do novo aluno',()=>{
 const r=encontrarEncaixe(base,{id:'novo-aluno',embarque:{id:'nova',lat:-21.215,lng:-50.415},desembarqueId:'escola',desembarqueAte:420},matriz);
 expect(r.alternativasTestadas).toBe(2);expect(r.disponivel).toBe(true);expect(r.passagemCasa).toBeDefined();expect(r.chegadaDestino).toBeLessThanOrEqual(420);
 });
 it('não aceita aluno se lotar a van',()=>{const r=encontrarEncaixe({...base,capacidade:1},{id:'novo-aluno',embarque:{id:'nova',lat:-21.215,lng:-50.415},desembarqueId:'escola'},matriz);expect(r.disponivel).toBe(false);});
 it('não inventa tempo sem matriz',()=>{const r=encontrarEncaixe(base,{id:'novo-aluno',embarque:{id:'nova',lat:-21.215,lng:-50.415},desembarqueId:'escola'}, {ids:['saida','casa','escola'],minutos:[[0,10,30],[10,0,15],[30,15,0]]});expect(r.disponivel).toBe(false);});
 it('respeita o horário original de cada aluno',()=>{const p=calcularPlano(base);expect(p.valido).toBe(true);expect(Math.abs(p.eventos[1].chegada-389)).toBeLessThanOrEqual(10);expect(Math.abs(p.eventos[2].chegada-405)).toBeLessThanOrEqual(10);});
});
