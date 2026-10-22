# Relatório de Impacto à Proteção de Dados Pessoais (RIPD)

<!--
LGPD (varredura, item L8): o sistema trata biometria (dado sensível, art. 5º, II e art. 11 da LGPD)
em escala — de todos os atletas inscritos — sem nenhum RIPD registrado. Este documento é o RIPD
exigido pelo art. 38 da LGPD, descrevendo o tratamento real feito pelo sistema (não um modelo
genérico). Revise e suba a versão sempre que uma finalidade, base legal ou categoria de dado mudar.
-->

**Versão:** 2026-01 · **Controladora:** Liga de Voleibol Jundiaí (LVJ) · **Sistema:** LVJ (este
repositório) · **Última revisão:** 2026-10-22

## 1. Descrição do tratamento

O sistema administra inscrição de equipes e atletas, aprovação em duas etapas (gestor → admin),
agenda de jogos, controle de frequência e controle de acesso biométrico às partidas. Ver a Política
de Privacidade (`app/privacidade`) para a descrição completa voltada ao titular; este documento foca
nos riscos e nas medidas de mitigação.

## 2. Dados tratados e por quê

| Dado | Categoria | Finalidade | Base legal |
|---|---|---|---|
| Nome, e-mail, telefone, senha | Pessoal | Conta e autenticação | Execução de contrato |
| RG (gestor, atleta, responsável legal) | Pessoal | Identificação, evitar duplicidade | Execução de contrato / legítimo interesse |
| Foto biométrica | **Sensível** (art. 5º, II) | Controle de acesso por reconhecimento facial | Consentimento específico e destacado (art. 11, I) |
| Data de nascimento, status de menor | Pessoal (de criança/adolescente quando < 18) | Identificar necessidade de responsável legal | Cumprimento de obrigação legal (art. 14) + consentimento do responsável |
| Frequência em jogos | Pessoal | Elegibilidade esportiva | Execução de contrato |
| Segredo TOTP (2FA) | Pessoal | Autenticação de administradores | Legítimo interesse de segurança |
| Trilha de auditoria (`audit_logs`) | Pessoal (referenciado por ID) | Prova de consentimento, investigação de incidente | Cumprimento de obrigação legal (arts. 46–49) |

## 3. Riscos identificados e mitigação

| Risco | Probabilidade/Impacto | Mitigação implementada |
|---|---|---|
| Vazamento de biometria por RCE/dependência comprometida | Baixa / Alto | Upload direto por POST pré-assinado (o backend nunca recebe o arquivo em trânsito); containers de produção rodam como usuário não-root; link de leitura expira em minutos |
| Força bruta contra senha de gestor/admin | Média / Alto | Argon2id, limite de tentativas por IP e por conta (login), 2FA obrigatório para admin |
| Enumeração de contas por tempo de resposta do login | Baixa / Médio | Comparação de senha com custo de CPU constante mesmo quando o e-mail não existe |
| Vazamento de segredos (JWT/chave de criptografia) via commit acidental | Baixa / Alto | `.env`/`.env.*` fora do controle de versão; chaves obrigatórias e validadas no boot (fail-closed) |
| Retenção indevida de dados sem base legal (cadastro recusado) | Média / Médio | Rotina automática de anonimização após o prazo de retenção configurado |
| Consentimento insuficiente para dado sensível | Média / Alto | Checkbox específico e destacado para a foto biométrica, separado do aceite geral |
| Uso indevido da trilha de auditoria (alteração/exclusão do histórico) | Baixa / Médio | Trigger de banco bloqueia UPDATE/DELETE/TRUNCATE em `audit_logs` — append-only garantido pelo Postgres, não só por convenção no código |

## 4. Riscos residuais (em acompanhamento)

- Transferência internacional: hoje nenhum provedor está hospedado fora do Brasil (ver Política de
  Privacidade, seção 5); se isso mudar, este RIPD e a política devem ser atualizados antes da
  mudança entrar em vigor.
- Backup (item L11 da varredura): este repositório não implementa rotina de backup automática (ver
  Política de Privacidade, seção 7) — quem implanta o sistema em produção deve definir e documentar
  a própria política de backup/retenção de cópias de segurança, garantindo que elas respeitem os
  mesmos prazos de anonimização/exclusão da política.
- Cláusula de operador com o fornecedor de controle de acesso (item L12 da varredura, art. 39 da
  LGPD): a integração com a Control ID (`backend/src/services/queue.js`) já transmite, em modo
  `CONTROL_ID_MODE=live`, uma URL de leitura temporária da foto biométrica de verdade — mas não há
  nenhum acordo de tratamento de dados (DPA) documentado com esse fornecedor, diferente do e-mail e
  do S3, que são autogerenciados. Antes de operar em modo `live` com dados reais, firmar o DPA com a
  Control ID e referenciá-lo aqui.
- Dependências do frontend: `tailwindcss` 3.x ainda arrasta duas vulnerabilidades sem correção
  disponível nessa major version (`braces`, DoS por padrão de glob profundamente aninhado, via
  `chokidar`/`fast-glob`; `postcss-selector-parser`, CPU em seletor CSS malicioso). Risco aceito:
  as duas só atuam em tempo de build/desenvolvimento (watcher de arquivos e processamento do CSS do
  próprio projeto), nunca recebendo entrada de um usuário do site. Resolver exige migrar para
  tailwindcss 4, com regressão visual completa — fora do escopo desta rodada.

## 5. Revisão

Este RIPD é revisado a cada mudança relevante de finalidade, dado tratado ou fornecedor, e no
mínimo uma vez por temporada da liga. Dúvidas ou pedido de cópia: contato do encarregado (ver
`DPO_EMAIL` nas páginas `/privacidade` e `/termos-de-uso`).
