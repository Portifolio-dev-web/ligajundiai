# Plano de Resposta a Incidentes de Segurança

<!--
LGPD (varredura, item L8): o sistema trata dado sensível em escala (biometria de todos os
atletas) sem nenhum plano de resposta a incidentes registrado. Este runbook descreve passos
concretos, ligados ao que o sistema realmente oferece (ver referências de arquivo abaixo) — não é
um modelo genérico. Mantenha atualizado quando a arquitetura mudar.
-->

**Última revisão:** 2026-10-21

## 1. O que é um incidente

Qualquer acesso, uso, alteração, divulgação ou perda não autorizada de dado pessoal tratado pelo
sistema — por exemplo: sessão de usuário comprometida, vazamento do bucket de biometria, segredo
(`JWT_SECRET`, `APP_ENCRYPTION_KEY`, `WEBHOOK_SECRET`) exposto, ou acesso indevido ao banco de dados.

## 2. Detecção

- Trilha de auditoria: `audit_logs` (ver `backend/sql/schema.sql`) registra ação, ator e metadados
  não identificáveis para cada evento sensível (consentimento, aprovação, anonimização).
- Logs de erro 5xx do backend (`console.error`, ver `backend/src/app.js`), encaminhados ao
  agregador de logs do ambiente de produção.
- Alertas de infraestrutura (uso anômalo de CPU/rede, picos de erro 401/403) — configurar no
  ambiente de produção; não incluído neste repositório.

## 3. Contenção imediata

Ações disponíveis hoje, por tipo de incidente:

| Incidente | Ação |
|---|---|
| Sessão(ões) comprometida(s) | Revogar: `UPDATE sessions SET revoked_at = now() WHERE user_id = $1` (o mesmo que `privacy.js` faz na anonimização) |
| `JWT_SECRET` exposto | Trocar o segredo e reiniciar a API — invalida todas as sessões ativas de uma vez (todo `jwt.verify` passa a falhar) |
| `APP_ENCRYPTION_KEY` exposta | Rotação exige descriptografar e recriptografar os campos sensíveis (`rg_ciphertext`, `guardian_rg_ciphertext`, `totp_secret_ciphertext`) com a chave nova antes de trocar — planejar manutenção, não é uma troca instantânea |
| Credencial do RustFS/S3 exposta | Revogar a chave de acesso no RustFS e emitir uma nova; `S3_ACCESS_KEY`/`S3_SECRET_KEY` no ambiente da API |
| Conta de administrador comprometida | Suspender (`UPDATE users SET status = 'suspended' WHERE id = $1`) e revogar as sessões dela |

## 4. Avaliação e notificação

1. Determinar quais titulares foram afetados e quais dados (consultar `audit_logs` pelo período do
   incidente).
2. Se houver risco ou dano relevante aos titulares (ex.: biometria ou RG exposto), notificar a ANPD
   em até **3 (três) dias úteis** da confirmação do incidente, conforme a Resolução CD/ANPD nº
   15/2024, e comunicar os titulares afetados em linguagem clara.
3. Registrar o incidente (o que aconteceu, quando, dados afetados, ações tomadas) — este registro
   é insumo para a próxima revisão do RIPD (`RIPD.md`).

## 5. Contato

Encarregado (DPO): variáveis `DPO_NAME`/`DPO_ROLE`/`DPO_EMAIL` (ver `lib/legalTerms.js` e as
páginas `/privacidade` e `/termos-de-uso`). Um incidente de segurança sem encarregado identificado
não pode ser respondido adequadamente — configure essas variáveis antes de operar com dados reais.

## 6. Pós-incidente

- Atualizar este documento e o `RIPD.md` com a causa raiz e a mitigação aplicada.
- Se a causa for uma lacuna de segurança já conhecida (ver relatório de varredura de segurança),
  priorizar sua correção.
