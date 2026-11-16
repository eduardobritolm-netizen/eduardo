const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel,
  BorderStyle, TabStopType, TabStopPosition,
} = require("docx");

const FONT = "Arial";

// ---- helpers -------------------------------------------------------------
// Justified body paragraph (the argument)
function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.JUSTIFIED,
    spacing: { after: opts.after != null ? opts.after : 160, line: 276 },
    indent: opts.indent,
    children: runs(text),
  });
}
// parse a string with **bold** and *italic* markers into TextRuns
function runs(text) {
  if (Array.isArray(text)) return text;
  const out = [];
  // split on ** first
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      out.push(new TextRun({ text: part.slice(2, -2), bold: true }));
    } else if (part.startsWith("*") && part.endsWith("*")) {
      out.push(new TextRun({ text: part.slice(1, -1), italics: true }));
    } else {
      out.push(new TextRun({ text: part }));
    }
  }
  return out.length ? out : [new TextRun({ text })];
}
// bold ementa header line (left aligned, bold)
function ementa(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 120, after: 40, line: 264 },
    children: runs(text),
  });
}
// transcribed legal device, indented block
function transc(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160, line: 264 },
    indent: { left: 709 },
    children: runs(text),
  });
}
// italic one-line subtitle (latin brocardo / synthesis)
function sub(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 264 },
    children: [new TextRun({ text, italics: true })],
  });
}
function h(num, title) {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    keepNext: true,
    children: [new TextRun({ text: `${num} ${title}`, bold: true })],
  });
}
function center(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: opts.after != null ? opts.after : 0, line: 264 },
    children: runs(text),
  });
}

// ---- document ------------------------------------------------------------
const children = [];

// Cabeçalho institucional
children.push(center("**ESTADO DO AMAZONAS**", { after: 0 }));
children.push(center("**PROCURADORIA-GERAL DO ESTADO**", { after: 0 }));
children.push(center("**COORDENADORIA DE TRANSPARÊNCIA E OUVIDORIA**", { after: 240 }));

// Linha de identificação do memorando
children.push(new Paragraph({
  spacing: { after: 60, line: 276 },
  children: [new TextRun({ text: "MEMORANDO Nº ______/2026 – CTO/PGE", bold: true })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.RIGHT,
  spacing: { after: 160, line: 276 },
  children: [new TextRun({ text: "Manaus, _____ de ______________ de 2026." })],
}));

// De / Ao / Assunto
function field(label, value) {
  return new Paragraph({
    spacing: { after: 60, line: 276 },
    children: [
      new TextRun({ text: label, bold: true }),
      new TextRun({ text: value }),
    ],
  });
}
children.push(field("Do:  ", "Coordenadoria de Transparência e Ouvidoria da Procuradoria-Geral do Estado do Amazonas"));
children.push(field("Ao:  ", "Gabinete do Subprocurador-Geral do Estado"));
children.push(new Paragraph({
  alignment: AlignmentType.JUSTIFIED,
  spacing: { after: 240, line: 276 },
  children: [
    new TextRun({ text: "Assunto:  ", bold: true }),
    new TextRun({ text: "Proposição de abertura de dados e de disponibilização de APIs de dados abertos no âmbito da Procuradoria-Geral do Estado e do Governo do Estado do Amazonas. Encaminhamento à Controladoria-Geral do Estado (CGE) e à Secretaria de Estado de Administração e Gestão (SEAD)/Comitê de Governança e Transformação Digital (CGTD), cada qual segundo a respectiva competência." }),
  ],
}));

// Vocativo
children.push(p("Senhor Subprocurador-Geral do Estado,", { after: 160 }));

// Abertura — proponente e competência (art. 7º-D)
children.push(p("A **Coordenadoria de Transparência e Ouvidoria da Procuradoria-Geral do Estado**, por seu Coordenador, no exercício da competência que lhe confere o art. 7º-D da Lei Orgânica da Procuradoria-Geral do Estado (Lei nº 1.639, de 30 de dezembro de 1983, com o texto consolidado na forma do art. 14 da Lei Complementar nº 270, de 7 de janeiro de 2025, e atualizado até a Lei Complementar nº 290, de 30 de junho de 2026), vem, respeitosamente, propor a este Gabinete o encaminhamento do presente pleito aos órgãos competentes do Poder Executivo Estadual, pelas razões de fato e de direito a seguir expostas."));

// I - DO OBJETO
children.push(h("I –", "DO OBJETO"));
children.push(p("A presente proposição tem por objeto a **abertura de dados** e a **disponibilização de APIs (interfaces de programação de aplicações) de dados abertos** no âmbito da Procuradoria-Geral do Estado e, de modo geral, do Governo do Estado do Amazonas, em formato legível por máquina e sob licença aberta, abrangendo, em especial:"));
children.push(p("a) as **manifestações de ouvidoria**, mediante disponibilização da interface de programação de aplicações (API) da Plataforma Integrada de Ouvidoria e Acesso à Informação – Fala.BR, da Controladoria-Geral da União;", { indent: { left: 426 }, after: 80 }));
children.push(p("b) os dados de **execução orçamentária e de despesas** mantidos pela Secretaria de Estado da Fazenda – SEFAZ, em formato aberto e com disponibilização de *endpoint* estável, dispensado o acesso por *download* protegido;", { indent: { left: 426 }, after: 80 }));
children.push(p("c) o **monitoramento de programas e ações do Plano Plurianual – PPA**, hoje disponibilizado apenas de forma embutida (sistema SPLAM/SEPLAN) e sem interface de programação de aplicações (API), em formato de dados abertos;", { indent: { left: 426 }, after: 80 }));
children.push(p("d) de modo geral, a **adesão a APIs de dados abertos interoperáveis**, em formato legível por máquina e sob licença aberta.", { indent: { left: 426 }, after: 160 }));

// II - DA FUNDAMENTAÇÃO
children.push(h("II –", "DA FUNDAMENTAÇÃO"));

// 1) Lei 6.837/2024
children.push(h("II.1 –", "DO FUNDAMENTO CENTRAL: A POLÍTICA DE GOVERNO DIGITAL DO ESTADO DO AMAZONAS (LEI ESTADUAL Nº 6.837/2024)"));
children.push(sub("Mandamento estadual expresso de interoperabilidade e de dados abertos governamentais."));
children.push(p("O Estado do Amazonas, por lei própria, elegeu a interoperabilidade e os dados abertos governamentais como princípios e objetivos de sua Política de Governo Digital. A Lei nº 6.837, de 16 de abril de 2024, consagra a interoperabilidade entre os seus princípios:"));
children.push(ementa("**LEI Nº 6.837, DE 16 DE ABRIL DE 2024** *– Institui a Política de Governo Digital no âmbito do Poder Executivo do Estado do Amazonas e dá outras providências.*"));
children.push(transc("Art. 2º [...] VIII – a interoperabilidade, característica que se refere à capacidade de diversos sistemas e organizações trabalharem em conjunto, de modo a garantir que pessoas, organizações e sistemas computacionais interajam para trocar informações de maneira eficaz, eficiente e segura;"));
children.push(p("No rol de objetivos, a mesma Lei determina, de forma **expressa**, que se conceda à sociedade acesso amplo à informação e aos **dados abertos governamentais**, e que se promova a integração de dados entre os órgãos do Estado:"));
children.push(ementa("**LEI Nº 6.837, DE 16 DE ABRIL DE 2024** *– Política de Governo Digital do Estado do Amazonas.*"));
children.push(transc("Art. 3º [...] IV – estimular a participação cidadã por meio de consultas e interações online, concedendo à sociedade acesso amplo à informação e aos dados abertos governamentais, contribuindo com a cultura de transparência pública;"));
children.push(transc("Art. 3º [...] XI – promover o compartilhamento de recursos de tecnologia da informação e a integração de dados entre os órgãos e entidades do Estado, assegurando a interoperabilidade e a geração de políticas públicas baseadas em dados;"));
children.push(p("E, entre as diretrizes de ação, impõe a promoção da interoperabilidade de dados entre os órgãos de governo:"));
children.push(ementa("**LEI Nº 6.837, DE 16 DE ABRIL DE 2024** *– Política de Governo Digital do Estado do Amazonas.*"));
children.push(transc("Art. 4º [...] III – promover a interoperabilidade de dados entre os órgãos de governo, reduzindo ou eliminando a exigência de documentos comprobatórios desnecessários;"));
children.push(p("A mesma Lei define a autoridade competente para implementar e coordenar essa política, o que justifica o endereçamento do pleito à **Secretaria de Estado de Administração e Gestão – SEAD** e ao **Comitê de Governança e Transformação Digital – CGTD**:"));
children.push(ementa("**LEI Nº 6.837, DE 16 DE ABRIL DE 2024** *– Política de Governo Digital do Estado do Amazonas.*"));
children.push(transc("Art. 5º Compete ao Poder Executivo a implementação e a coordenação da Política de Governo Digital, exercida, de forma superior, pela Secretaria de Estado de Administração e Gestão – SEAD, com o apoio do Comitê de Governança e Transformação Digital – CGTD."));
children.push(transc("Art. 6º Fica criado o Comitê de Governança e Transformação Digital – CGTD, instância técnica, consultiva e deliberativa, vinculada à Secretaria de Estado de Administração e Gestão – SEAD e presidida por seu titular, com a função de coordenar as ações e propor as diretrizes da Política de Governo Digital."));
children.push(p("Vê-se, pois, que a competência técnica sobre dados abertos, APIs e interoperabilidade recai, por mandamento legal, sobre a **SEAD** e o **CGTD**, enquanto o controle interno e a transparência ativa são afetos à **Controladoria-Geral do Estado**, o que recomenda o encaminhamento do pleito a ambos, cada qual na sua esfera de atribuição."));

// 2) Competência institucional da PGE e da Coordenadoria
children.push(h("II.2 –", "DA COMPETÊNCIA INSTITUCIONAL DA PROCURADORIA-GERAL DO ESTADO E DA COORDENADORIA PROPONENTE"));
children.push(sub("A proposição é exercício regular de competência orgânica."));
children.push(p("A Procuradoria-Geral do Estado, instituição permanente e essencial à Justiça e à Administração Pública, tem, entre as suas funções institucionais, a advocacia preventiva e a contribuição para o aprimoramento institucional da Administração, o zelo pela observância dos princípios constitucionais a ela impostos – entre os quais a publicidade (art. 37, *caput*, da Constituição Federal) – e a representação e defesa do Estado perante os Tribunais de Contas:"));
children.push(ementa("**LEI Nº 1.639, DE 30 DE DEZEMBRO DE 1983** *– Lei Orgânica da Procuradoria-Geral do Estado (texto consolidado na forma do art. 14 da Lei Complementar nº 270, de 7 de janeiro de 2025, atualizado até a Lei Complementar nº 290, de 30 de junho de 2026).*"));
children.push(transc("Art. 2º [...] III – a advocacia preventiva e a contribuição para o aprimoramento institucional da Administração Pública Estadual, inclusive mediante a proposição de diplomas normativos e de medidas de interesse do Estado;"));
children.push(transc("[...] XI – zelar pela observância dos princípios constitucionais impostos à Administração Pública;"));
children.push(transc("[...] XIII – representar e defender o Estado do Amazonas perante os Tribunais de Contas."));
children.push(p("A legitimação **direta** do órgão proponente, por sua vez, está no art. 7º-D da mesma Lei Orgânica, incluído pela Lei Complementar nº 290, de 30 de junho de 2026:"));
children.push(ementa("**LEI Nº 1.639, DE 30 DE DEZEMBRO DE 1983** *– Lei Orgânica da Procuradoria-Geral do Estado.*"));
children.push(transc("Art. 7º-D. À Coordenadoria de Transparência e Ouvidoria compete coordenar as atividades de ouvidoria e transparência da Procuradoria-Geral do Estado."));
children.push(transc("Parágrafo único. A Coordenadoria de Transparência e Ouvidoria será dirigida por Coordenador, símbolo AD-1, nomeado em comissão pelo Procurador-Geral do Estado."));
children.push(p("A proposição encontra ainda respaldo no capítulo de inovação da Lei Orgânica, que prevê o **fomento à participação social e à transparência pública** e o **apoio a políticas públicas orientadas por dados e com base em evidências**, em plena convergência com a Política de Governo Digital do Estado (Lei nº 6.837/2024)."));

// 3) LAI
children.push(h("II.3 –", "DO DIREITO DE ACESSO E DA TRANSPARÊNCIA ATIVA"));
children.push(sub("A abertura de dados é dever de transparência ativa, e não mera liberalidade."));
children.push(p("A Lei de Acesso à Informação impõe o dever de **transparência ativa** e, de modo específico, o dever de disponibilizar informações em **formatos abertos, estruturados e legíveis por máquina**, com **acesso automatizado por sistemas externos** – que é, precisamente, o objeto de uma API de dados abertos:"));
children.push(ementa("**LEI Nº 12.527, DE 18 DE NOVEMBRO DE 2011** *– Regula o acesso a informações previsto na Constituição Federal (Lei de Acesso à Informação).*"));
children.push(transc("Art. 8º É dever dos órgãos e entidades públicas promover, independentemente de requerimentos, a divulgação em local de fácil acesso, no âmbito de suas competências, de informações de interesse coletivo ou geral por eles produzidas ou custodiadas."));
children.push(transc("§ 1º Na divulgação das informações a que se refere o caput deste artigo, deverão constar, no mínimo: [...] IV – informações concernentes a procedimentos licitatórios, inclusive os respectivos editais e resultados, bem como a todos os contratos celebrados; V – dados gerais para o acompanhamento de programas, ações, projetos e obras de órgãos e entidades; [...]."));
children.push(transc("§ 3º Os sítios de que trata o § 2º deverão, na forma de regulamento, atender, entre outros, aos seguintes requisitos: [...] II – possibilitar a gravação de relatórios em diversos formatos eletrônicos, inclusive abertos e não proprietários, tais como planilhas e texto, de modo a facilitar a análise das informações; III – possibilitar o acesso automatizado por sistemas externos em formatos abertos, estruturados e legíveis por máquina; [...]."));
children.push(p("No âmbito estadual, o acesso à informação está regulamentado pelo Decreto nº 48.999, de 9 de fevereiro de 2024, que disciplina a Lei de Acesso à Informação no Poder Executivo do Estado do Amazonas, e pela Instrução Normativa CGE nº 1, de 26 de novembro de 2024, a qual reforça ser a **Controladoria-Geral do Estado** o órgão competente para a matéria:"));
children.push(ementa("**DECRETO Nº 48.999, DE 9 DE FEVEREIRO DE 2024** *– Regulamenta, no âmbito do Poder Executivo Estadual, o acesso à informação de que trata a Lei nº 12.527, de 18 de novembro de 2011.*"));
children.push(ementa("**INSTRUÇÃO NORMATIVA CGE Nº 1, DE 26 DE NOVEMBRO DE 2024** *– Disciplina a aplicação da Lei de Acesso à Informação e da Lei Geral de Proteção de Dados no âmbito do Poder Executivo do Estado do Amazonas.*"));

// 4) Portaria TCE
children.push(h("II.4 –", "DA INSTITUIÇÃO DE DADOS ABERTOS PELO TRIBUNAL DE CONTAS DO ESTADO"));
children.push(sub("O próprio órgão de controle externo já adotou o padrão de dados abertos."));
children.push(p("O Tribunal de Contas do Estado do Amazonas instituiu, por Portaria, a disponibilização de **dados abertos** em seu Portal da Transparência, em formato aberto, legível por máquina e sob licença aberta, tendo por base a Lei de Acesso à Informação, conforme publicação no Diário Oficial Eletrônico do TCE-AM nº 3294, de 17 de abril de 2024. O padrão que o controle externo já observa é o mesmo ora proposto à Administração estadual."));

// 5) Determinações recorrentes do TCE
children.push(h("II.5 –", "DAS DETERMINAÇÕES RECORRENTES DO TRIBUNAL DE CONTAS NAS CONTAS DO GOVERNO"));
children.push(sub("A Administração já foi formalmente instada, exercício após exercício, a estruturar e completar os dados de transparência."));
children.push(p("Nas contas anuais do Governo do Estado, o Tribunal de Contas vem, de forma **recorrente (exercícios de 2022, 2023 e 2024)**, determinar o aprimoramento, a consolidação e o completamento dos dados de transparência no Portal da Transparência. Quanto ao **exercício de 2022**, o Parecer Prévio nº 23/2024-TCE consignou:"));
children.push(ementa("**TRIBUNAL DE CONTAS DO ESTADO DO AMAZONAS – PARECER PRÉVIO Nº 23/2024** *– Contas do Governo do Estado, exercício de 2022.*"));
children.push(transc("Item 10.2.3 – melhorar a qualidade da informação sobre as licitações (mensuração por modalidade, valores, estatísticas e desempenho), resolvendo a indisponibilização de editais e resultados;"));
children.push(transc("Item 10.2.4 – melhorar as consultas dos contratos, com informações completas sobre o quantitativo das unidades gestoras e os valores globais;"));
children.push(transc("Item 10.2.5 – disponibilizar integralmente as Atas das Audiências Públicas no Portal da SEFAZ."));
children.push(p("As determinações de transparência repetiram-se quanto aos exercícios de **2023** (Parecer Prévio nº 52/2025, Pleno, de 9 de dezembro de 2025) e de **2024** (Parecer Prévio nº 53/2025), sempre no sentido de consolidar, unificar e completar os dados do Portal da Transparência. Já quanto ao **exercício de 2021** (Parecer Prévio nº 96/2022), o Parecer do Ministério Público de Contas nº 7893/2022, nele incorporado, constatou, em seu item 67:"));
children.push(ementa("**MINISTÉRIO PÚBLICO DE CONTAS – PARECER Nº 7893/2022** *– Contas do Governo do Estado, exercício de 2021 (Parecer Prévio nº 96/2022).*"));
children.push(transc("Item 67 – \"Portais foram criados, embora tenha identificado, também, que a sua alimentação não tem higidez\"."));
children.push(sub("Ressalva de lealdade argumentativa: nenhum dos pareceres emprega a expressão \"dados abertos\". As determinações apontam na direção da consolidação, unificação e completude de dados estruturados, sem exigir o termo; é a Lei nº 6.837/2024 que o consagra expressamente."));

// 6) PNTP
children.push(h("II.6 –", "DO PROGRAMA NACIONAL DE TRANSPARÊNCIA PÚBLICA (PNTP)"));
children.push(sub("Há um padrão nacional de transparência que o Estado precisa acompanhar."));
children.push(p("O Programa Nacional de Transparência Pública (PNTP), conduzido pela Associação dos Membros dos Tribunais de Contas do Brasil – Atricon, e o respectivo Radar da Transparência Pública estabelecem padrão nacional de avaliação dos portais de transparência, com mobilização de 33 Cortes de Contas na fiscalização de mais de oito mil portais. O próprio Tribunal de Contas do Estado do Amazonas alcançou o selo diamante, sendo o único órgão gestor do Estado a atingir o índice de 100%, em grade de avaliação que subiu de 202 para 258 itens em 2023. A abertura de dados e a disponibilização de APIs são meios idôneos para que a Administração estadual acompanhe esse padrão."));

// III - DOS PEDIDOS
children.push(h("III –", "DO PEDIDO"));
children.push(p("Pelo exposto, a Coordenadoria de Transparência e Ouvidoria requer a Vossa Senhoria se digne de **encaminhar o presente pleito**, segundo a respectiva competência:"));
children.push(p("a) à **Controladoria-Geral do Estado – CGE**, pelo viés da **transparência ativa** e do **controle interno**, nos termos da Lei de Acesso à Informação (Lei nº 12.527/2011, art. 8º), do Decreto estadual nº 48.999/2024 e da Instrução Normativa CGE nº 1/2024; e", { indent: { left: 426 }, after: 80 }));
children.push(p("b) à **Secretaria de Estado de Administração e Gestão – SEAD** e ao **Comitê de Governança e Transformação Digital – CGTD**, a quem compete, por força dos arts. 5º e 6º da Lei nº 6.837/2024, a coordenação da Política de Governo Digital e a competência técnica sobre dados abertos, APIs e interoperabilidade,", { indent: { left: 426 }, after: 120 }));
children.push(p("para que seja promovida a **abertura de dados** e a **disponibilização de APIs de dados abertos** no âmbito da Procuradoria-Geral do Estado e do Governo do Estado, em formato legível por máquina e sob licença aberta, abrangendo, em especial: (i) as manifestações de ouvidoria, mediante a API da Plataforma Fala.BR/CGU; (ii) a execução orçamentária e as despesas (dados da SEFAZ), em formato aberto e com *endpoint* estável, dispensado o acesso por *download* protegido; (iii) o monitoramento de programas e ações do PPA (sistema SPLAM/SEPLAN), em dados abertos; e (iv) de modo geral, a adesão a APIs de dados abertos interoperáveis."));
children.push(p("São estes os termos em que se propõe o encaminhamento, colocando-se esta Coordenadoria à disposição para prestar os esclarecimentos técnicos e jurídicos que se fizerem necessários.", { after: 320 }));

// Fecho / assinatura
children.push(center("Respeitosamente,", { after: 400 }));
children.push(center("**EDUARDO BRITO DE LIMA**", { after: 0 }));
children.push(center("Ouvidor / Autoridade de Monitoramento da LAI", { after: 0 }));
children.push(center("da Procuradoria-Geral do Estado – PGE", { after: 0 }));
children.push(center("Coordenadoria de Transparência e Ouvidoria", { after: 0 }));

// Rodapé institucional (linha)
children.push(new Paragraph({
  border: { top: { style: BorderStyle.SINGLE, size: 6, space: 6, color: "999999" } },
  spacing: { before: 480, after: 0 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: "CNPJ nº 04.312.369/0011-62 – Rua Emílio Moreira, nº 1308, Praça 14, Manaus – AM", size: 16 })],
}));
children.push(center([new TextRun({ text: "fone: (92) 3649-3144 – ", size: 16 }), new TextRun({ text: "www.pge.am.gov.br", size: 16, bold: true })], { after: 0 }));

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: FONT, size: 24 } }, // 12pt
    },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1418, bottom: 1134, left: 1701, right: 1134 },
      },
    },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/claude/eduardo/Memorando_Dados_Abertos_CTO-PGE.docx", buf);
  console.log("ok");
});
