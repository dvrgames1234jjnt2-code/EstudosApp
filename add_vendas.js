const fs = require('fs');
let data = JSON.parse(fs.readFileSync('simulado_bb_2.json', 'utf8'));

const vendas = {
  "nome": "VENDAS E NEGOCIAÇÃO",
  "questoes": [
    {
      "id": "q_56",
      "texto": "Durante uma pesquisa de satisfação, os clientes de uma clínica relataram que as recepcionistas sempre os atendem prontamente, com boa vontade e sem fazer o cliente esperar. Essa atitude reflete uma dimensão da qualidade no atendimento chamada de",
      "alternativas": {
        "A": "cordialidade",
        "B": "competência técnica",
        "C": "presteza",
        "D": "simpatia",
        "E": "confiabilidade"
      },
      "respostaCorreta": "A"
    },
    {
      "id": "q_57",
      "texto": "Um passageiro enviou uma mensagem à companhia aérea relatando que o atendimento no balcão de check-in foi lento e desorganizado. Ele não exigiu ressarcimento nem solução imediata, mas manifestou a esperança de que a empresa melhore o processo para futuros passageiros. Esse tipo de reclamação é classificado como:",
      "alternativas": {
        "A": "pessoal",
        "B": "não-instrumental",
        "C": "ativa",
        "D": "instrumental",
        "E": "passiva"
      },
      "respostaCorreta": "A"
    },
    {
      "id": "q_58",
      "texto": "Uma empresa de comércio eletrônico implementou um sistema que monitora as interações dos clientes em todos os pontos de contato com a marca, coletando opiniões, sugestões e críticas, a fim de ajustar processos internos e aperfeiçoar continuamente o relacionamento com o público. Essa prática corresponde ao conceito de:",
      "alternativas": {
        "A": "Gestão da Imagem Institucional",
        "B": "Gestão da Experiência do Cliente",
        "C": "Marketing Institucional",
        "D": "Gestão de Processos",
        "E": "Pesquisa de Satisfação"
      },
      "respostaCorreta": "A"
    },
    {
      "id": "q_59",
      "texto": "Uma empresa de serviços envia aos seus clientes uma pergunta simples:\n“Em uma escala de 0 a 10, qual a probabilidade de você recomendar nossa empresa a um amigo ou colega?”\nCom base nas respostas, ela classifica os clientes em promotores, neutros ou detratores, utilizando esse dado para avaliar o relacionamento com o público. Essa prática se refere ao uso do indicador denominado",
      "alternativas": {
        "A": "Customer Lifetime Value (CLV)",
        "B": "Net Promoter Score (NPS)",
        "C": "Customer Effort Score (CES)",
        "D": "Customer Satisfaction Index (CSI)",
        "E": "Market Share Index (MSI)"
      },
      "respostaCorreta": "A"
    },
    {
      "id": "q_60",
      "texto": "Ao adquirir um novo plano de internet, um cliente avalia não apenas o preço pago, mas também a velocidade, a estabilidade e o suporte técnico oferecido. A partir dessa análise, ele decide se o serviço “vale a pena” em relação ao que pagou. Essa relação entre o que o cliente oferece e o que recebe é chamada de",
      "alternativas": {
        "A": "valor percebido pelo cliente",
        "B": "fidelização de marca",
        "C": "marketing de relacionamento",
        "D": "custo de oportunidade",
        "E": "lealdade comportamental"
      },
      "respostaCorreta": "A"
    },
    {
      "id": "q_61",
      "texto": "Um paciente marcou consulta em uma clínica acreditando que o atendimento seria rápido e personalizado, mas enfrentou longa espera e pouca atenção do profissional. Essa situação representa um caso em que:",
      "alternativas": {
        "A": "a expectativa superou a percepção, gerando insatisfação.",
        "B": "a percepção superou a expectativa, gerando fidelização.",
        "C": "a percepção e a expectativa se igualaram, gerando satisfação.",
        "D": "o custo superou o benefício, mas houve satisfação.",
        "E": "o benefício superou o custo, mas houve neutralidade."
      },
      "respostaCorreta": "A"
    },
    {
      "id": "q_62",
      "texto": "Ao perceber que seus clientes possuem perfis distintos — alguns buscam investimento, outros crédito e outros apenas conta digital —, um banco passou a adotar campanhas e produtos diferentes para cada grupo. Essa medida é um exemplo de:",
      "alternativas": {
        "A": "segmentação de mercado.",
        "B": "pesquisa de clima organizacional.",
        "C": "diversificação de marca.",
        "D": "comunicação integrada.",
        "E": "precificação estratégica."
      },
      "respostaCorreta": "A"
    },
    {
      "id": "q_63",
      "texto": "Os clientes do Banco SF123 preferem resolver suas demandas entrando em contato com a central de atendimento apenas quando consideram necessário, sem receber ligações do banco oferecendo produtos. Nesse caso, o canal de comunicação desejado pelos clientes é o",
      "alternativas": {
        "A": "telemarketing receptivo.",
        "B": "marketing direto.",
        "C": "atendimento ativo.",
        "D": "telemarketing ativo.",
        "E": "pós-venda programada."
      },
      "respostaCorreta": "A"
    },
    {
      "id": "q_64",
      "texto": "Em vez de focar apenas em novas vendas, uma empresa decide investir na fidelização de clientes antigos, oferecendo suporte constante, atendimento personalizado e estimulando a lealdade dos clientes. Essa estratégia está associada ao conceito de:",
      "alternativas": {
        "A": "marketing de relacionamento.",
        "B": "marketing agressivo.",
        "C": "prospecção de mercado.",
        "D": "marketing transacional.",
        "E": "marketing institucional."
      },
      "respostaCorreta": "A"
    },
    {
      "id": "q_65",
      "texto": "Uma academia passou a oferecer uma aula experimental gratuita e um brinde personalizado para quem visitasse suas instalações. A estratégia tem o objetivo de despertar no potencial cliente o desejo de “retribuir” o gesto, aumentando as chances de matrícula. O gatilho mental utilizado nessa situação é o da:",
      "alternativas": {
        "A": "autoridade",
        "B": "escassez",
        "C": "reciprocidade",
        "D": "exclusividade",
        "E": "urgência"
      },
      "respostaCorreta": "A"
    },
    {
      "id": "q_66",
      "texto": "Durante uma aula particular agendada, o aluno não compareceu e o professor não conseguiu reagendar o horário com outro aluno. O tempo não utilizado representa uma perda, pois o serviço não pode ser “guardado” para uso futuro. Essa situação evidencia que os serviços são",
      "alternativas": {
        "A": "intangíveis.",
        "B": "inseparáveis.",
        "C": "variáveis.",
        "D": "perecíveis.",
        "E": "homogêneos."
      },
      "respostaCorreta": "A"
    },
    {
      "id": "q_67",
      "texto": "Uma agência de viagens separou seus clientes entre os que preferem experiências de aventura e contato com a natureza e os que buscam conforto, luxo e tranquilidade. Essa divisão baseia-se no tipo de personalidade e estilo de vida dos viajantes. Essa segmentação é chamada de:",
      "alternativas": {
        "A": "demográfica.",
        "B": "geográfica.",
        "C": "psicográfica.",
        "D": "comportamental.",
        "E": "socioeconômica."
      },
      "respostaCorreta": "A"
    },
    {
      "id": "q_68",
      "texto": "Um cliente trocou de operadora porque percebeu que outra empresa oferecia planos com melhor cobertura e maior qualidade no serviço de internet. Esse tipo de cliente é classificado como:",
      "alternativas": {
        "A": "desertor de preço.",
        "B": "desertor de produto.",
        "C": "desertor de conveniência.",
        "D": "desertor de mercado.",
        "E": "desertor de serviço."
      },
      "respostaCorreta": "A"
    },
    {
      "id": "q_69",
      "texto": "O termo ________ refere-se à técnica de produzir textos com foco em convencer o leitor a realizar uma ação, como clicar em um link, fazer uma compra ou se inscrever em um curso. Trata-se da arte da escrita persuasiva para influenciar as pessoas a tomarem uma ação.",
      "alternativas": {
        "A": "inbound marketing",
        "B": "marketing digital",
        "C": "gatilho mental",
        "D": "marketing de relacionamento",
        "E": "copywriting"
      },
      "respostaCorreta": "A"
    },
    {
      "id": "q_70",
      "texto": "Em uma corretora de seguros, o vendedor inicia seu trabalho buscando empresas e pessoas que possam se interessar pelos serviços oferecidos. Essa fase do processo de vendas, voltada à busca de potenciais clientes, é conhecida como:",
      "alternativas": {
        "A": "abordagem.",
        "B": "prospecção.",
        "C": "fechamento.",
        "D": "negociação.",
        "E": "pós-venda."
      },
      "respostaCorreta": "A"
    }
  ]
};

data.data_json.disciplinas.push(vendas);
fs.writeFileSync('simulado_bb_2.json', JSON.stringify(data, null, 2));
console.log('Vendas adicionadas com sucesso!');
