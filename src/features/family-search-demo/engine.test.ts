import { describe, expect, it, vi, afterEach } from 'vitest';
import { buscarOfertasDemo, catalogoDemo, horarioPadrao } from './engine';
import type { CriteriosBusca, Destino } from '@/types';
const criterios:CriteriosBusca={cidadeId:'aracatuba-sp',endereco:'Centro',destinoId:'fatec',turno:'manha',contratacao:'mensal',modalidade:'ida',origemLat:-21.20,origemLng:-50.44};
const destino:Destino={id:'fatec',nome:'Escola de teste',tipo:'faculdade',bairro:'Centro',cidadeId:'aracatuba-sp',codigoInep:null,turnos:['manha'],fonte:'teste',lat:-21.19,lng:-50.43};
afterEach(()=>vi.unstubAllGlobals());
describe('pesquisa demonstrativa isolada',()=>{
 it('possui 30 identidades estáveis e imagens individuais',()=>{
  const lista=catalogoDemo();expect(lista).toHaveLength(30);
  expect(new Set(lista.map(m=>m.id)).size).toBe(30);
  expect(lista[0].imagem).toContain('motorista-01-tio-joao.webp');
 });
 it('mantém o horário solicitado sem fixá-lo ao turno',()=>{
  expect(horarioPadrao('manha','ida')).toBe('07:00');
  expect(horarioPadrao('manha','volta')).toBe('12:00');
 });
 it('não cria resultados sem coordenadas reais',async()=>{
  const lista=await buscarOfertasDemo({criterios:{...criterios,origemLat:undefined},destino,horario:'07:00'});
  expect(lista).toEqual([]);
 });
 it('rejeita horário inválido',async()=>{
  expect(await buscarOfertasDemo({criterios,destino,horario:'25:90'})).toEqual([]);
 });
 it('gera horários e paradas estáveis a partir de roteamento viário',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
   const coords=url.split('/driving/')[1].split('?')[0].split(';').map(p=>p.split(',').map(Number));
   return {ok:true,json:async()=>({routes:[{geometry:{coordinates:coords},legs:coords.slice(1).map(()=>({duration:360}))}]})};
  }));
  const q={criterios,destino,horario:'07:00'};
  const a=await buscarOfertasDemo(q);const b=await buscarOfertasDemo(q);
  expect(a.length).toBeGreaterThan(0);
  expect(a.map(o=>[o.id,o.embarque,o.chegada,o.paradas])).toEqual(b.map(o=>[o.id,o.embarque,o.chegada,o.paradas]));
  expect(a.every(o=>o.chegada<='07:00'&&o.geometria&&o.paradas.length>=3)).toBe(true);
 });
});
