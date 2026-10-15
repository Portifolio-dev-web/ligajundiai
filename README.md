# Liga Jundiaí

Aplicação Next.js com API Express, PostgreSQL e serviços locais para desenvolvimento.

## Executar localmente com Docker

Pré-requisito: Docker Desktop instalado e em execução. Na raiz do projeto:

```powershell
docker compose up --build
```

O primeiro início instala as dependências, aplica o schema PostgreSQL, cria o
administrador definido no ambiente e inicializa o bucket MinIO. Endereços locais:

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

Os e-mails transacionais são enviados ao Mailpit, não a destinatários externos.
O upload biométrico usa POST pré-assinado para o RustFS, com limite de 5 MB e
tipos JPEG, PNG e WebP. A integração Control ID inicia em modo de simulação.
O RustFS local habilita a opção de bypass de verificação de discos porque os
volumes Docker compartilham o mesmo dispositivo virtual; não reutilize essa
opção em produção.

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
