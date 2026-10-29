# Ideia Club

Caderno pessoal de ideias de vídeos com visual anos 2000.

Página estática publicada no GitHub Pages. Autenticação e dados ficam no projeto Supabase da proprietária. A senha é verificada pelo Supabase Auth; a chave pública em config.js não concede acesso às ideias. As tabelas usam Row Level Security e uma lista de proprietários autorizados.

Recursos: assunto, editor com formatação e cores, lista, busca, favoritos, status e backup JSON. As ideias atualizam a cada 15 segundos enquanto a página está aberta. Edições concorrentes usam controle de revisão.

## Publicação

Publique os arquivos desta pasta na raiz do repositório e configure GitHub Pages para a branch main, pasta raiz. Mantenha a versão fixada do SDK Supabase (2.118.0) junto da página. Nenhuma chave secreta ou senha faz parte do código.

## Banco

O esquema de implantação é mantido separadamente. Para conceder acesso a outro usuário, a proprietária deve cadastrá-lo em Supabase Auth e autorizar seu UUID na tabela notebook_owners.

Não há dependência do host do ChatGPT.
