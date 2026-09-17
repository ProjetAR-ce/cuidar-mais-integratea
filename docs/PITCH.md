# Roteiro do pitch · 7 minutos

> Regra de ouro: mostrar o sistema funcionando. Slides só na abertura e no fechamento.

## 0:00 – 0:45 · O problema (quem fala: *preencher*)

- "Em Crateús, o cuidado de uma criança autista passa por até cinco serviços: NASF, NAPE, CREAES, Casa Mais Azul e CRASF."
- "Hoje cada um anota em caderno. A mesma criança é cadastrada três vezes, espera em filas paralelas e ninguém sabe o próximo passo."
- Números do tema: registros manuais, duplicidade de atendimento e informação fragmentada.

## 0:45 – 1:15 · A solução

- **Cuidar+**: uma visão única, segura e rastreável da jornada, da entrada à continuidade.
- Três canais, um só banco: **sistema web** para a rede, **app** para as famílias e **WhatsApp** para a população.

## 1:15 – 5:15 · Demonstração ao vivo (4 minutos)

1. **Recepção** (`recepcao@cuidarmais.demo`): busca "Lucas Ferreira Silv" com erro de digitação e encontra. Tenta cadastrar de novo e o **CNS igual é bloqueado**; nome parecido gera **aviso de duplicidade**. *(40 s)*
2. **Profissional NASF** (`profissional@cuidarmais.demo`): **triagem P1 com justificativa** → paciente entra na fila → "**Por que esta posição?**" mostra o cálculo. Agenda direto da fila. *(60 s)*
3. **Agenda:** marca **presença em um toque** 🎉, registra a sessão. Mostra falta justificada. *(30 s)*
4. **Encaminhamento** NASF → CREAES; o **CREAES aceita** e o paciente já entra na fila do destino. Abre a **linha do tempo** do Lucas com 4 serviços. *(50 s)*
5. **Coordenação:** alertas automáticos, com **sobreposição** e **3 faltas seguidas**, revisados com registro; **unificação de cadastro duplicado**. *(40 s)*
6. **Gestão:** **capacidade × demanda**, com o gargalo de Neuropediatria destacado, e indicadores exportáveis **só com dados agregados**. *(20 s)*

## 5:15 – 6:00 · Confiança e LGPD

- Recepção tenta abrir a auditoria → **acesso negado**, e o admin vê a tentativa registrada.
- Regras no banco (RLS), nada é apagado, correções geram versão, dados clínicos separados.
- WhatsApp e API usam só dados agregados. **Dados 100% fictícios.**

## 6:00 – 6:40 · Impacto e escala

- Tira a rede do caderno: fila transparente, fim da duplicidade, continuidade entre Saúde, Educação e Assistência.
- Configurável sem programar: serviços, vagas, prazos, pontos de prioridade.
- API versionada pronta para e-SUS e BI; cabe em outros municípios do Nordeste.

## 6:40 – 7:00 · Fechamento

- "Cada jornada merece cuidado, conexão e respeito. O Cuidar+ conecta a rede para que nenhuma criança se perca no caminho."

---

### Checklist antes de apresentar

- [ ] Servidor no ar e já aquecido (abrir cada tela uma vez antes)
- [ ] Abas logadas: recepção, profissional NASF, profissional CREAES, coordenação, gestão
- [ ] Rodar `npm run seed -- --force` só se precisar de mais dados (não é necessário)
- [ ] Zoom do navegador em 110% para legibilidade no Meet
- [ ] Plano B: vídeo gravado da demonstração
