import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search, School } from 'lucide-react';
import type { Contratacao, ModalidadeTrajeto, Turno } from '@/types';
import { CIDADE_PADRAO } from '@/data/cidades';
import { DESTINOS } from '@/data/destinos';
import { TURNO_LABEL, cn } from '@/lib/utils';
import { criteriosParaParams } from '@/lib/searchParams';

const TURNOS: Turno[] = ['manha', 'tarde', 'noite', 'integral'];
const MODALIDADES: { valor: ModalidadeTrajeto; label: string }[] = [
  { valor: 'ida', label: 'Só ida' },
  { valor: 'volta', label: 'Só volta' },
  { valor: 'ambos', label: 'Ida e volta' },
];

export function SearchForm({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [endereco, setEndereco] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [turno, setTurno] = useState<Turno | ''>('');
  const [contratacao, setContratacao] = useState<Contratacao>('mensal');
  const [dataAvulso, setDataAvulso] = useState('');
  const [modalidade, setModalidade] = useState<ModalidadeTrajeto>('ida');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = criteriosParaParams({
      cidadeId: CIDADE_PADRAO.id,
      endereco: endereco.trim(),
      destinoId: destinoId || null,
      turno: turno || null,
      contratacao,
      dataAvulso: contratacao === 'avulso' ? dataAvulso : undefined,
      modalidade,
    });
    navigate(`/resultados?${params}`);
  };

  return (
    <form
      onSubmit={onSubmit}
      className={cn('card p-5 sm:p-6', compact ? '' : 'shadow-float')}
      aria-label="Buscar van"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Cidade (fixa no piloto) */}
        <div>
          <label className="field-label" htmlFor="cidade">
            Cidade
          </label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-navy-300" />
            <select
              id="cidade"
              className="field-input appearance-none pl-10"
              value={CIDADE_PADRAO.id}
              disabled
            >
              <option value={CIDADE_PADRAO.id}>
                {CIDADE_PADRAO.nome} — {CIDADE_PADRAO.uf}
              </option>
            </select>
          </div>
        </div>

        {/* Endereço / região */}
        <div>
          <label className="field-label" htmlFor="endereco">
            Endereço ou bairro de embarque
          </label>
          <input
            id="endereco"
            className="field-input"
            placeholder="Ex: Rua das Flores, Centro"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            autoComplete="off"
          />
        </div>

        {/* Destino (escola/faculdade) */}
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="destino">
            Escola, faculdade ou destino
          </label>
          <div className="relative">
            <School className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-navy-300" />
            <select
              id="destino"
              className="field-input appearance-none pl-10"
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
            >
              <option value="">Qualquer destino</option>
              {DESTINOS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome} — {d.bairro}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Turno */}
      <fieldset className="mt-4">
        <legend className="field-label">Turno</legend>
        <div className="flex flex-wrap gap-2">
          <Segment ativo={turno === ''} onClick={() => setTurno('')}>
            Qualquer
          </Segment>
          {TURNOS.map((t) => (
            <Segment key={t} ativo={turno === t} onClick={() => setTurno(t)}>
              {TURNO_LABEL[t]}
            </Segment>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* Contratação */}
        <fieldset>
          <legend className="field-label">Contratação</legend>
          <div className="flex gap-2">
            <Segment ativo={contratacao === 'mensal'} onClick={() => setContratacao('mensal')}>
              Mensal
            </Segment>
            <Segment ativo={contratacao === 'avulso'} onClick={() => setContratacao('avulso')}>
              Avulso
            </Segment>
          </div>
          {contratacao === 'avulso' && (
            <input
              type="date"
              className="field-input mt-2"
              value={dataAvulso}
              onChange={(e) => setDataAvulso(e.target.value)}
              aria-label="Data do serviço avulso"
            />
          )}
        </fieldset>

        {/* Modalidade */}
        <fieldset>
          <legend className="field-label">Trajeto</legend>
          <div className="flex flex-wrap gap-2">
            {MODALIDADES.map((m) => (
              <Segment
                key={m.valor}
                ativo={modalidade === m.valor}
                onClick={() => setModalidade(m.valor)}
              >
                {m.label}
              </Segment>
            ))}
          </div>
        </fieldset>
      </div>

      <button type="submit" className="btn btn-sheen btn-lg btn-primary mt-6 w-full">
        <Search className="h-5 w-5" />
        Buscar vans compatíveis
      </button>
      <p className="mt-3 text-center text-xs text-navy-400">
        Busca pública, sem login. Mostramos só vans com rota compatível.
      </p>
    </form>
  );
}

function Segment({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'rounded-full px-4 py-2 text-sm font-medium transition-all',
        ativo
          ? 'bg-navy-900 text-white shadow-card'
          : 'bg-navy-50 text-navy-600 ring-1 ring-navy-100 hover:bg-navy-100',
      )}
    >
      {children}
    </button>
  );
}
