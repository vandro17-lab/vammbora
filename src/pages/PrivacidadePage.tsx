import { Link } from 'react-router-dom';

export function PrivacidadePage() {
  return <main style={{minHeight:'100dvh',background:'#f7f7f7',color:'#18202a',fontFamily:'Inter, sans-serif',padding:'36px 18px'}}>
    <article style={{maxWidth:760,margin:'0 auto',background:'#fff',borderRadius:20,padding:'clamp(24px,5vw,48px)',lineHeight:1.75}}>
      <Link to="/" style={{color:'#18202a',fontWeight:800}}>← VanBora</Link>
      <h1 style={{fontSize:32,lineHeight:1.2,marginTop:28}}>Política de Privacidade</h1>
      <p><strong>Última atualização:</strong> 11 de novembro de 2026.</p>
      <p>O VanBora é uma plataforma de transporte escolar em desenvolvimento, com lançamento inicial previsto para Araçatuba, São Paulo. Esta política descreve o tratamento de informações fornecidas por interessados em receber notícias e o futuro link de cadastro.</p>
      <h2>Quais dados coletamos?</h2>
      <p>Nome, telefone/WhatsApp e respostas voluntárias do formulário de interesse, como a confirmação de que a pessoa atua no transporte escolar.</p>
      <h2>Para que usamos esses dados?</h2>
      <p>Para administrar a lista de interessados e, mediante a manifestação de interesse, enviar pelo WhatsApp notícias sobre o lançamento e o link de cadastro gratuito de vans e rotas quando estiver disponível.</p>
      <h2>Compartilhamento</h2>
      <p>Não comercializamos dados pessoais. O formulário pode ser processado pela Meta e por prestadores necessários à gestão dos contatos, sujeitos às condições aplicáveis.</p>
      <h2>Retenção e direitos</h2>
      <p>Os dados serão mantidos pelo período necessário para essas finalidades ou até pedido de exclusão, ressalvadas obrigações legais. O titular pode solicitar acesso, correção, exclusão e interrupção das mensagens.</p>
      <h2>Responsável e contato</h2>
      <p><strong>ATENÇÃO — PREENCHER ANTES DE PUBLICAR:</strong> nome ou razão social do responsável pelo tratamento e canal real (e-mail) para solicitações de privacidade.</p>
      <p style={{fontSize:13,color:'#59636c'}}>Esta página não representa abertura de cadastro de vans, nem promessa de envio em data específica.</p>
    </article>
  </main>;
}
