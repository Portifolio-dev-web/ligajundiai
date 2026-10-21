# Relatório de Impacto à Proteção de Dados Pessoais (RIPD)

<!--
LGPD (varredura, item L8): o sistema trata biometria (dado sensível, art. 5º, II e art. 11 da LGPD)
em escala — de todos os atletas inscritos — sem nenhum RIPD registrado. Este documento é o RIPD
exigido pelo art. 38 da LGPD, descrevendo o tratamento real feito pelo sistema (não um modelo
genérico). Revise e suba a versão sempre que uma finalidade, base legal ou categoria de dado mudar.
-->

**Versão:** 2026-01 · **Controladora:** Liga de Voleibol Jundiaí (LVJ) · **Sistema:** LVJ (este
repositório) · **Última revisão:** 2026-10-21

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
| Uso indevido da trilha de auditoria (alteração/exclusão do histórico) | Baixa / Médio | *Residual — ver seção 4* |

## 4. Riscos residuais (em acompanhamento)

- `audit_logs` ainda não tem uma trigger de banco que impeça `UPDATE`/`DELETE`/`TRUNCATE` por quem
  tiver acesso de escrita ao Postgres (achado S15, pendente de correção).
- Transferência internacional: hoje nenhum provedor está hospedado fora do Brasil (ver Política de
  Privacidade, seção 5); se isso mudar, este RIPD e a política devem ser atualizados antes da
  mudança entrar em vigor.

## 5. Revisão

Este RIPD é revisado a cada mudança relevante de finalidade, dado tratado ou fornecedor, e no
mínimo uma vez por temporada da liga. Dúvidas ou pedido de cópia: contato do encarregado (ver
`DPO_EMAIL` nas páginas `/privacidade` e `/termos-de-uso`).
