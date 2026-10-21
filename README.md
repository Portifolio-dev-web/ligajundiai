# Liga Jundiaí

Aplicação Next.js com API Express, PostgreSQL e serviços locais para desenvolvimento.

## Executar localmente com Docker

Pré-requisito: Docker Desktop instalado e em execução. Na raiz do projeto:

```powershell
docker compose up --build
```

O primeiro início instala as dependências, aplica o schema PostgreSQL, cria o
administrador definido no ambiente e inicializa o bucket RustFS. Endereços locais:

| Serviço | Endereço |
| --- | --- |
| Aplicação | <http://localhost:3000> |
| API (health check) | <http://localhost:4000/health> |
| PostgreSQL | `localhost:5432` |
| Armazenamento S3 RustFS API / console | <http://localhost:9000> / <http://localhost:9001> |
| Mailpit (caixa de e-mail local) | <http://localhost:8025> |

As credenciais padrão do Compose são **somente para desenvolvimento local**:

- Admin: `admin@lvj.com` / `Admin123-local-change-me!`
- TOTP do admin: `JBSWY3DPEHPK3PXP` (cadastre em um aplicativo autenticador)
- RustFS: `lvj-local` / `lvj-local-secret-change-me`
- PostgreSQL: banco `ligajundiai`, usuário `liga`, senha `liga_local_only`

Troque todas as credenciais, chaves JWT/criptografia e o segredo do webhook antes
de qualquer implantação. O admin não tem cadastro público. Para sobrescrever os
valores locais, configure as variáveis correspondentes no `compose.yaml`.

Antes de operar com dados reais, defina também `DPO_NAME`, `DPO_ROLE` e `DPO_EMAIL`
no serviço `frontend` do Compose (ou no ambiente de produção): identificam o
encarregado de proteção de dados exigido pelo art. 41 da LGPD nas páginas
`/privacidade` e `/termos-de-uso`. Sem essas variáveis, as páginas mostram
"a definir" em vez de um contato — isso é esperado em desenvolvimento, mas não
pode ir para produção assim.

O [RIPD.md](RIPD.md) (Relatório de Impacto à Proteção de Dados) e o
[RESPOSTA-A-INCIDENTES.md](RESPOSTA-A-INCIDENTES.md) descrevem os riscos de dados
pessoais do sistema e o procedimento de resposta a incidentes; revise os dois antes
de qualquer implantação com dados reais e mantenha-os atualizados quando a
arquitetura mudar.

Os e-mails transacionais são enviados ao Mailpit, não a destinatários externos.
O upload biométrico usa POST pré-assinado para o RustFS, com limite de 5 MB e
tipos JPEG, PNG e WebP. A integração Control ID inicia em modo de simulação.
O RustFS local habilita a opção de bypass de verificação de discos porque os
volumes Docker compartilham o mesmo dispositivo virtual; não reutilize essa
opção em produção.

## Interfaces web

O Next.js encaminha `/api/*` para a API Express. A autenticação usa o cookie
HTTP-only `lvj_session`; as chamadas do browser enviam credenciais same-origin,
sem persistir JWT em `localStorage` nem enviar Bearer token. O middleware do
Next valida assinatura e perfil para as páginas protegidas; `JWT_SECRET` no
serviço frontend deve corresponder ao segredo da API.

- Gestor: `/gestor`, `/gestor/aprovar-atletas`, `/gestor/jogos`
- Cadastro público de atleta: `/cadastro-atleta`
- Administrador: `/admin/aprovacoes`, `/admin/agenda`
- Configuração dos períodos por categoria: `/admin/inscricoes`
- Jogos e frequência: `/jogos` (ou `/atleta/jogos` para o perfil atleta)

O cadastro do atleta permite criar uma conta com e-mail e senha, mas só lista
equipes aprovadas pelo administrador após a inscrição do gestor. Ao concluir, o
atleta aguarda aprovação do gestor e, depois, do administrador. O formulário
valida CPF no navegador, registra consentimento explícito e envia a foto
diretamente ao RustFS com POST pré-assinado. Para acessar câmera em
desenvolvimento, use `localhost` ou HTTPS e permita a permissão do navegador.

O administrador configura períodos independentes para inscrição de equipes e
cadastro de atletas em cada categoria na tela `/admin/inscricoes`. Sem período
configurado ou fora das datas inicial e final, as inscrições ficam fechadas. A
API valida as datas e bloqueia envios mesmo que o formulário seja contornado.

Parar os serviços sem apagar os dados:

```powershell
docker compose down
```

Apagar também os volumes e todos os dados locais (operação irreversível):

```powershell
docker compose down --volumes
```

## API e testes

Os comandos abaixo executam o backend a partir do diretório `backend`:

```powershell
npm ci
npm test
npm run test:unit
npm run test:integration
```

`npm test` executa também a suíte de integração e requer um PostgreSQL acessível.
O comando de integração via Compose abaixo cria um banco temporário isolado.

Para rodar os testes de integração em Docker:

```powershell
docker compose --profile test run --build --rm backend-test
```

A API também pode ser executada fora do Compose após configurar as variáveis
necessárias em `backend/.env`; veja `backend/src/config.js` para a lista validada.

## Retenção automática de dados

A API roda diariamente uma rotina (`backend/src/services/retention.js`, agendada em
`backend/src/services/queue.js`) que anonimiza RG, foto biométrica e dados do
responsável legal de cadastros de atleta **recusados** há mais de
`RETENTION_REJECTED_ATHLETE_DAYS` dias (padrão: 180) — esses cadastros não têm mais
base legal para continuar identificados. Ajuste a variável antes de operar com
dados reais se 180 dias não refletir a política de retenção da organização, e
atualize o mesmo número em `app/privacidade/page.jsx` (`RETENTION_REJECTED_ATHLETE_DAYS`).

## Importação opcional do MongoDB legado

A importação é opt-in e não é iniciada junto com a aplicação. Se o MongoDB antigo
estiver no perfil `legacy`, suba os serviços e execute:

```powershell
docker compose --profile legacy up -d postgres legacy-mongodb
docker compose --profile legacy run --build --rm legacy-migrate
```

O serviço usa `LEGACY_MONGO_DATABASE=ligajundiai` e `LEGACY_MONGO_URL` definidos
no Compose. A importação é transacional e registra a execução em
`legacy_imports`; ela não substitui a revisão dos dados antes da migração. Os
consentimentos que não existiam no sistema antigo ficam marcados como não
registrados, e senhas scrypt são atualizadas para Argon2id no próximo login.
