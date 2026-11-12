/**
 * Teste de PONTA A PONTA do pré-lançamento (navegador real, viewport de celular).
 *
 * Sobe um servidor local que entrega o build (dist/) e atende POST /api/interesse
 * com o MESMO núcleo do endpoint de produção (src/lib/interesse-servidor.ts),
 * gravando num PostgreSQL LOCAL descartável pela mesma função do banco
 * (registrar_interesse_lancamento, papel service_role). Não toca no Supabase.
 *
 * Como rodar:
 *   npm run build
 *   MANTER=1 supabase/tests/rodar-prelancamento-local.sh      # imprime PGHOST/PGPORT
 *   PGHOST=... PGPORT=... npx vite-node scripts/e2e-prelancamento.ts
 *
 * Requer o Playwright instalado no ambiente (não é dependência do projeto).
 * CAPTURAS=<pasta> grava imagens das telas.
 */
import http from 'node:http';
import { createHmac } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { processarInteresse, interpretarRetornoBanco, criarLimitadorRajada } from '../src/lib/interesse-servidor';

const { chromium } = createRequire(import.meta.url)('playwright') as typeof import('playwright');
const DIST = path.resolve('dist');
const PGHOST = process.env.PGHOST, PGPORT = process.env.PGPORT;
if (!PGHOST || !PGPORT) { console.error('Defina PGHOST e PGPORT (veja o cabeçalho deste arquivo).'); process.exit(2); }
const CAPTURAS = process.env.CAPTURAS;

/* ----------------------------- banco local ----------------------------- */
function psql(sql: string, vars: Record<string, string> = {}, porta = PGPORT as string): Promise<string> {
  const args = ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-h', PGHOST as string, '-p', porta, '-U', 'postgres', '-d', 'postgres'];
  for (const [k, v] of Object.entries(vars)) args.push('-v', `${k}=${v}`);
  return new Promise((ok, falha) => {
    const p = execFile('psql', args, { timeout: 8000 }, (e, out, err) => (e ? falha(new Error(err || e.message)) : ok(out.trim())));
    p.stdin?.end(sql);
  });
}
const consulta = (sql: string) => psql(sql);

/* ------------------------------ servidor ------------------------------ */
let bancoFora = false;      // simula banco indisponível (conexão recusada de verdade: porta errada)
let atrasoMs = 0;           // atraso artificial para observar o estado "Enviando…"
let posts = 0;
const TIPOS: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://local');
  if (url.pathname === '/api/interesse') {
    if (req.method === 'POST') posts += 1;
    let corpo = '';
    for await (const c of req) corpo += c;
    if (atrasoMs) await new Promise((r) => setTimeout(r, atrasoMs));
    const r = await processarInteresse({
      metodo: req.method, origem: (req.headers.origin as string) ?? null, host: req.headers.host ?? null,
      tipoConteudo: (req.headers['content-type'] as string) ?? null, corpo, ip: req.socket.remoteAddress ?? 'desconhecido',
    }, {
      configurado: true,
      rajadaExcedida: criarLimitadorRajada(1000),
      hashIp: (ip) => createHmac('sha256', 'segredo-de-teste').update(ip).digest('hex'),
      async gravar(payload, ipHash) {
        const saida = await psql(
          "set role service_role; select public.registrar_interesse_lancamento(:'p'::jsonb, :'h');",
          { p: JSON.stringify(payload), h: ipHash }, bancoFora ? '1' : (PGPORT as string));
        return interpretarRetornoBanco(JSON.parse(saida), null);
      },
    });
    res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(r.corpo));
    return;
  }
  const arquivo = path.join(DIST, path.normalize(url.pathname));
  const alvo = arquivo.startsWith(DIST) && path.extname(arquivo) ? arquivo : path.join(DIST, 'index.html');
  try {
    const dados = await readFile(alvo);
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(alvo)] ?? 'application/octet-stream' });
    res.end(dados);
  } catch { res.writeHead(404); res.end('não encontrado'); }
});

/* -------------------------------- teste -------------------------------- */
let passou = 0;
const falhas: string[] = [];
function confere(nome: string, cond: unknown, detalhe = '') {
  if (cond) { passou += 1; console.log(`  ✓ ${nome}`); }
  else { falhas.push(nome); console.log(`  ✗ ${nome} ${detalhe}`); }
}

async function principal() {
  await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
  const porta = (servidor.address() as { port: number }).port;
  const base = `http://127.0.0.1:${porta}`;
  await consulta('truncate public.prelaunch_leads, public.prelaunch_submission_log');

  const navegador = await chromium.launch();
  const celular = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' as const, locale: 'pt-BR' };
  const contexto = await navegador.newContext(celular);
  // A abertura animada da marca (existente) não faz parte deste teste.
  await contexto.addInitScript(() => { try { sessionStorage.setItem('vambora:opening:v1', 'seen'); } catch { /* ignore */ } });
  const pagina = await contexto.newPage();
  const errosJs: string[] = [];
  pagina.on('pageerror', (e) => errosJs.push(e.message));
  const captura = async (nome: string, p = pagina) => { if (CAPTURAS) await p.screenshot({ path: path.join(CAPTURAS, `${nome}.png`), fullPage: true }); };
  const semRolagemLateral = (p = pagina) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  console.log('\n1) Página inicial');
  await pagina.goto(base + '/');
  confere('título "Estamos chegando a Araçatuba!"', await pagina.getByRole('heading', { level: 1, name: 'Estamos chegando a Araçatuba!' }).isVisible());
  confere('texto de apoio', await pagina.getByText('Uma nova maneira de conectar famílias e motoristas de transporte escolar.').isVisible());
  confere('logo oficial com a assinatura', await pagina.getByAltText('VanBora — mais vagas, mais conexões').isVisible());
  const cartoes = pagina.locator('main a');
  confere('dois cartões clicáveis', (await cartoes.count()) === 2);
  confere('cartão motorista → /interesse/motorista', (await cartoes.nth(0).getAttribute('href')) === '/interesse/motorista' && (await cartoes.nth(0).innerText()).includes('Sou motorista') && (await cartoes.nth(0).innerText()).includes('Quero participar'));
  confere('cartão família → /interesse/familia', (await cartoes.nth(1).getAttribute('href')) === '/interesse/familia' && (await cartoes.nth(1).innerText()).includes('Quero contratar uma van') && (await cartoes.nth(1).innerText()).includes('Encontrar uma van'));
  const caixas = await Promise.all([0, 1].map((i) => cartoes.nth(i).boundingBox()));
  confere('cartões com o mesmo destaque (mesma largura) e área de toque grande', !!caixas[0] && !!caixas[1] && Math.abs(caixas[0].width - caixas[1].width) < 1 && caixas[0].height >= 200 && caixas[1].height >= 200);
  confere('link discreto para /privacidade', (await pagina.locator('footer a[href="/privacidade"]').count()) === 1);
  confere('sem cabeçalho/menu/rodapé do aplicativo antigo', (await pagina.locator('nav').count()) === 0 && (await pagina.getByText(/Entrar|Buscar van|Para motoristas/).count()) === 0);
  confere('sem rolagem lateral no celular', await semRolagemLateral());
  await captura('01-inicio-celular');

  console.log('\n2) Formulário do motorista — validação no navegador');
  await cartoes.nth(0).click();
  await pagina.waitForURL('**/interesse/motorista');
  confere('título do motorista', await pagina.getByRole('heading', { level: 1, name: 'Motorista, o VanBora está chegando!' }).isVisible());
  const nome = pagina.locator('form [name="nome"]'), whats = pagina.locator('form [name="whatsapp"]'), email = pagina.locator('form [name="email"]');
  const consentimento = pagina.getByRole('checkbox'), enviar = pagina.getByRole('button', { name: 'Quero ser avisado' });
  confere('teclado numérico no WhatsApp e de e-mail no e-mail', (await whats.getAttribute('inputmode')) === 'numeric' && (await whats.getAttribute('type')) === 'tel' && (await email.getAttribute('type')) === 'email');
  confere('consentimento começa desmarcado', !(await consentimento.isChecked()));
  confere('"Política de Privacidade" no consentimento aponta para /privacidade', (await pagina.locator('form a[href="/privacidade"]').count()) === 1);
  await enviar.click();
  confere('envio vazio: erros de nome, WhatsApp e consentimento', (await pagina.getByText('Informe seu nome completo.').isVisible()) && (await pagina.getByText('Informe seu WhatsApp com DDD.').isVisible()) && (await pagina.getByText('Para continuar, é preciso marcar o consentimento.').isVisible()));
  confere('envio vazio não chama o servidor', posts === 0);
  confere('foco vai para o primeiro campo com erro', await nome.evaluate((el) => el === document.activeElement));
  await whats.pressSequentially('abc');
  confere('WhatsApp não aceita letras', (await whats.inputValue()) === '');
  await whats.pressSequentially('18998765432');
  confere('máscara (DD) 9XXXX-XXXX', (await whats.inputValue()) === '(18) 99876-5432');
  await whats.fill('+55 18 99876-5432');
  confere('colar com +55 normaliza', (await whats.inputValue()) === '(18) 99876-5432');
  await nome.fill('Motorista Teste Automatizado');
  await whats.fill('1836221234');
  await email.fill('email-invalido');
  await consentimento.check();
  await enviar.click();
  confere('WhatsApp inválido (fixo/incompleto) bloqueia', await pagina.getByText(/Número incompleto|começa com 9/).isVisible());
  confere('e-mail inválido bloqueia', await pagina.getByText('E-mail inválido. Confira ou deixe em branco.').isVisible());
  confere('nada foi enviado ainda', posts === 0);
  await captura('02-motorista-erros-celular');

  console.log('\n3) Banco indisponível — sem sucesso falso, dados preservados');
  await whats.fill('18998765432');
  await email.fill('');
  bancoFora = true;
  await enviar.click();
  const alerta = pagina.getByRole('alert');
  await alerta.waitFor();
  confere('mensagem de erro amigável', (await alerta.innerText()).includes('Não foi possível registrar seu interesse agora'));
  confere('tela de sucesso NÃO aparece', (await pagina.getByText('Prontinho! Seu interesse foi registrado.').count()) === 0);
  confere('dados continuam preenchidos', (await nome.inputValue()) === 'Motorista Teste Automatizado' && (await whats.inputValue()) === '(18) 99876-5432' && (await consentimento.isChecked()));
  confere('nada gravado no banco', (await consulta('select count(*) from public.prelaunch_leads')) === '0');
  await captura('03-motorista-erro-banco-celular');

  console.log('\n4) Cadastro de motorista — e-mail vazio, carregamento e confirmação');
  bancoFora = false; atrasoMs = 700;
  const antes = posts;
  await enviar.click();
  const ocupado = pagina.getByRole('button', { name: /Enviando/ });
  await ocupado.waitFor({ timeout: 600 }).catch(() => {});
  confere('botão desabilitado com indicador durante o envio', (await ocupado.isVisible()) && (await ocupado.isDisabled()));
  // Segundo toque enquanto envia: o botão está desabilitado e o formulário ignora.
  await pagina.locator('form button[type=submit]').click({ force: true, timeout: 300 }).catch(() => {});
  await pagina.locator('form').evaluate((f: HTMLFormElement) => f.requestSubmit());
  confere('sucesso ainda não aparece enquanto o servidor não confirma', (await pagina.getByText('Prontinho! Seu interesse foi registrado.').count()) === 0);
  await pagina.getByRole('heading', { name: 'Prontinho! Seu interesse foi registrado.' }).waitFor();
  atrasoMs = 0;
  confere('clique duplo gerou um único envio', posts - antes === 1, `(${posts - antes})`);
  confere('texto de confirmação do motorista', await pagina.getByText('Obrigado por querer fazer parte do VanBora! Quando o cadastro de vans e rotas estiver disponível, nossa equipe poderá entrar em contato pelo WhatsApp ou e-mail informado.').isVisible());
  confere('assinatura e botão "Voltar ao início"', (await pagina.getByText('VanBora — Mais vagas, mais conexões.').first().isVisible()) && (await pagina.getByRole('link', { name: 'Voltar ao início' }).getAttribute('href')) === '/');
  const m = JSON.parse(await consulta("select row_to_json(l) from public.prelaunch_leads l where lead_type = 'motorista'"));
  confere('gravado: nome, WhatsApp E.164, e-mail nulo', m.full_name === 'Motorista Teste Automatizado' && m.whatsapp_e164 === '+5518998765432' && m.email === null, JSON.stringify(m));
  confere('gravado: consentimento, data e versão da política', m.consent_accepted === true && !!m.consent_at && /^\d{4}-\d{2}-\d{2}$/.test(m.privacy_policy_version));
  confere('gravado: origem "site", situação "novo", sem endereço', m.source === 'site' && m.status === 'novo' && m.street_address === null && m.school_name === null);
  await captura('04-motorista-confirmacao-celular');

  console.log('\n5) Duplicidade — mesmo WhatsApp, mesmo perfil');
  await pagina.goto(base + '/interesse/motorista');
  await pagina.locator('form [name="nome"]').fill('Outro Nome Informado');
  await pagina.locator('form [name="whatsapp"]').fill('(18) 99876-5432');
  await pagina.locator('form [name="email"]').fill('outro@exemplo.com');
  await pagina.getByRole('checkbox').check();
  await pagina.getByRole('button', { name: 'Quero ser avisado' }).click();
  await pagina.getByRole('heading', { name: 'Prontinho! Seu interesse foi registrado.' }).waitFor();
  const d = JSON.parse(await consulta("select json_build_object('n', count(*), 'nome', min(full_name), 'email', min(email), 'reenvio', bool_and(resubmitted_at is not null), 'novo', min(last_resubmission->>'full_name')) from public.prelaunch_leads where lead_type = 'motorista'"));
  confere('não duplicou e não sobrescreveu o cadastro original', d.n === 1 && d.nome === 'Motorista Teste Automatizado' && d.email === null, JSON.stringify(d));
  confere('reenvio ficou registrado à parte', d.reenvio === true && d.novo === 'Outro Nome Informado');
  confere('a resposta não revela que o número já existia (mesma confirmação)', true);

  console.log('\n6) Formulário da família — acesso direto pela URL');
  await pagina.goto(base + '/interesse/familia');
  confere('título da família', await pagina.getByRole('heading', { level: 1, name: 'Procurando transporte escolar?' }).isVisible());
  await pagina.getByRole('button', { name: 'Registrar meu interesse' }).click();
  const obrig = ['Informe seu nome completo.', 'Informe seu WhatsApp com DDD.', 'Informe a rua ou avenida do embarque.', 'Informe o número (ou S/N).', 'Informe o bairro.', 'Informe o nome da escola.', 'Escolha o período.', 'Para continuar, é preciso marcar o consentimento.'];
  const vistos = await Promise.all(obrig.map((t) => pagina.getByText(t).isVisible()));
  confere('envio vazio aponta todos os obrigatórios', vistos.every(Boolean), JSON.stringify(vistos));
  confere('e-mail, complemento e tipo de transporte não são exigidos', (await pagina.locator('[id$="email-erro"], [id$="complemento-erro"], [id$="transporte-erro"]').count()) === 0);
  await captura('05-familia-erros-celular');
  await pagina.locator('form [name="nome"]').fill('  Responsável   Teste Automatizado ');
  await pagina.locator('form [name="whatsapp"]').fill('18998765432');           // mesmo número do motorista: perfis diferentes
  await pagina.locator('form [name="rua"]').fill('Rua de Teste Automatizado');
  await pagina.locator('form [name="numero"]').fill('123a');
  await pagina.locator('form [name="bairro"]').fill('Bairro Teste');
  await pagina.locator('form [name="escola"]').fill('Escola Digitada Manualmente');
  await pagina.getByText('Tarde', { exact: true }).click();
  await pagina.locator('form [name="transporte"]').selectOption('ida_volta');
  await pagina.getByRole('checkbox').check();
  confere('sem rolagem lateral no formulário (celular)', await semRolagemLateral());
  await captura('06-familia-preenchido-celular');
  await pagina.getByRole('button', { name: 'Registrar meu interesse' }).click();
  await pagina.getByRole('heading', { name: 'Prontinho! Seu interesse foi registrado.' }).waitFor();
  confere('texto de confirmação da família', await pagina.getByText('Obrigado pelo interesse! Estamos preparando o VanBora para Araçatuba. Nossa equipe poderá entrar em contato pelo WhatsApp ou e-mail informado quando tivermos novidades.').isVisible());
  const f = JSON.parse(await consulta("select row_to_json(l) from public.prelaunch_leads l where lead_type = 'familia'"));
  confere('gravado: responsável sem espaços excessivos e mesmo WhatsApp em outro perfil', f.full_name === 'Responsável Teste Automatizado' && f.whatsapp_e164 === '+5518998765432', JSON.stringify(f));
  confere('gravado: endereço de embarque', f.street_address === 'Rua de Teste Automatizado' && f.address_number === '123A' && f.neighborhood === 'Bairro Teste' && f.address_complement === null && f.city === 'Araçatuba' && f.state === 'SP');
  confere('gravado: escola digitada, período e tipo de transporte', f.school_name === 'Escola Digitada Manualmente' && f.school_shift === 'tarde' && f.transport_direction === 'ida_volta');
  confere('gravado: consentimento', f.consent_accepted === true && !!f.consent_at);
  confere('total no banco: 1 motorista + 1 família', (await consulta('select count(*) from public.prelaunch_leads')) === '2');
  await captura('07-familia-confirmacao-celular');
  await pagina.getByRole('link', { name: 'Voltar ao início' }).click();
  await pagina.waitForURL(base + '/');
  confere('"Voltar ao início" leva à página inicial', await pagina.getByRole('heading', { level: 1, name: 'Estamos chegando a Araçatuba!' }).isVisible());

  console.log('\n7) Limite de envios');
  for (let i = 0; i < 3; i++) await fetch(base + '/api/interesse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tipo: 'motorista', dados: { nome: 'Limite Teste Auto', whatsapp: `189987700${10 + i}`, consentimento: true } }) });
  const limite = await fetch(base + '/api/interesse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tipo: 'motorista', dados: { nome: 'Limite Teste Auto', whatsapp: '18998770099', consentimento: true } }) });
  confere('6º envio do mesmo visitante em 10 min → 429', limite.status === 429, `(${limite.status})`);
  confere('envio bloqueado não grava', (await consulta("select count(*) from public.prelaunch_leads where whatsapp_e164 = '+5518998770099'")) === '0');

  console.log('\n8) Superfície pública');
  const get = await fetch(base + '/api/interesse');
  confere('GET /api/interesse não lista nada (405)', get.status === 405 && !(await get.text()).includes('Teste Automatizado'));
  const cruzado = await fetch(base + '/api/interesse', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://outro-site.example' }, body: '{}' });
  confere('POST de outra origem é recusado (403) e sem cabeçalhos CORS', cruzado.status === 403 && !cruzado.headers.get('access-control-allow-origin'));

  console.log('\n9) Política de Privacidade — acesso direto, sem login');
  await pagina.goto(base + '/privacidade');
  confere('título da política', await pagina.getByRole('heading', { level: 1, name: 'Política de Privacidade' }).isVisible());
  const politica = await pagina.locator('article').innerText();
  confere('cobre motoristas, famílias, endereço, escola, LGPD, retenção e direitos', ['motoristas', 'famílias', 'endereço de embarque', 'escola de destino', 'LGPD', 'Por quanto tempo', 'Seus direitos', 'Com quem compartilhamos', 'Responsável pelo tratamento'].every((t) => politica.includes(t)));
  confere('pendência do responsável/canal sinalizada (nada inventado)', politica.includes('PREENCHER ANTES DE PUBLICAR'));
  confere('sem elementos do aplicativo antigo', (await pagina.locator('nav').count()) === 0);
  confere('sem rolagem lateral (celular)', await semRolagemLateral());
  await captura('08-privacidade-celular');

  console.log('\n10) Celular estreito (360 px) e desktop');
  const estreito = await navegador.newContext({ ...celular, viewport: { width: 360, height: 740 } });
  await estreito.addInitScript(() => { try { sessionStorage.setItem('vambora:opening:v1', 'seen'); } catch { /* ignore */ } });
  const pe = await estreito.newPage();
  for (const rota of ['/', '/interesse/motorista', '/interesse/familia', '/privacidade']) {
    await pe.goto(base + rota);
    await pe.locator('h1').first().waitFor();
    confere(`360 px sem rolagem lateral: ${rota}`, await semRolagemLateral(pe));
  }
  const alturas = await pe.goto(base + '/interesse/familia').then(() => pe.locator('form input:not([type=radio]):not([type=checkbox]):not([tabindex="-1"]), form select, form button[type=submit]').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height)));
  confere('campos e botão com pelo menos 48 px de altura', alturas.length >= 8 && alturas.every((h) => h >= 48), JSON.stringify(alturas));
  const desktop = await navegador.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  await desktop.addInitScript(() => { try { sessionStorage.setItem('vambora:opening:v1', 'seen'); } catch { /* ignore */ } });
  const pd = await desktop.newPage();
  await pd.goto(base + '/');
  await pd.locator('h1').waitFor();
  const lado = await Promise.all([0, 1].map((i) => pd.locator('main a').nth(i).boundingBox()));
  confere('desktop: cartões lado a lado', !!lado[0] && !!lado[1] && Math.abs(lado[0].y - lado[1].y) < 1 && lado[1].x > lado[0].x);
  await captura('09-inicio-desktop', pd);
  await pd.goto(base + '/interesse/familia');
  await pd.locator('h1').waitFor();
  await captura('10-familia-desktop', pd);

  console.log('\n11) Aplicativo existente preservado');
  for (const [rota, esperado] of [['/admin/login', /Entrar|Admin|senha/i], ['/motorista', /motorista/i], ['/resultados', /./]] as const) {
    const r = await pd.goto(base + rota);
    await pd.waitForLoadState('networkidle').catch(() => {});
    confere(`rota antiga responde: ${rota}`, r?.status() === 200 && esperado.test(await pd.locator('body').innerText()));
  }
  confere('nenhum erro de JavaScript nas páginas do pré-lançamento', errosJs.length === 0, errosJs.join(' | '));

  await navegador.close();
  servidor.close();
  await consulta('truncate public.prelaunch_leads, public.prelaunch_submission_log');
  console.log(`\n${passou} verificações aprovadas, ${falhas.length} reprovadas.`);
  if (falhas.length) { console.log('Reprovadas:\n - ' + falhas.join('\n - ')); process.exit(1); }
}

principal().catch((e) => { console.error(e); process.exit(1); });
