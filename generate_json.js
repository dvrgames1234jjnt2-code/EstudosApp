const fs = require('fs');

const rawText = fs.readFileSync('simulado_2_raw.txt', 'utf8');
const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

const json = {
  id: "2",
  titulo: "3º Simulado Especial - Banco do Brasil",
  duracao_minutos: 300,
  data_json: {
    disciplinas: []
  }
};

let currentDisciplina = null;
let currentQuestion = null;
let currentAlt = null;

const disciplinaNames = [
  "LÍNGUA PORTUGUESA", "LÍNGUA INGLESA", "MATEMÁTICA FINANCEIRA", "MATEMÁTICA", 
  "ATUALIDADES DO MERCADO FINANCEIRO", 
  "CONHECIMENTOS BANCÁRIOS", "CONHECIMENTOS DE INFORMÁTICA", 
  "VENDAS E NEGOCIAÇÃO"
];

let nextQ = 1;

// Regex to detect PDF noise
const isNoise = (str) => {
  if (str.match(/^\d+$/)) return true; // Just a page number
  if (str.includes("3º Simulado Especial") && str.includes("Banco do Brasil")) return true;
  if (str.includes("INSERIR CAPA NESTA PÁGINA")) return true;
  if (str.includes("Caderno de Prova")) return true;
  if (str.includes("CONHECIMENTOS BÁSICOS") || str.includes("CONHECIMENTOS ESPECÍFICOS")) return true;
  return false;
};

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  
  if (isNoise(line)) continue;
  
  // Check for Disciplina header
  let isDisciplina = false;
  for (let d of disciplinaNames) {
    if (line.toUpperCase() === d || line.toUpperCase().startsWith(d)) {
      if (!currentDisciplina || currentDisciplina.nome !== d) {
        currentDisciplina = { nome: d, questoes: [] };
        json.data_json.disciplinas.push(currentDisciplina);
      }
      isDisciplina = true;
      break;
    }
  }
  
  if (isDisciplina) continue;
  
  // Ignore initial instructions
  if (!currentDisciplina && line.includes("INFORMAÇÕES SOBRE O SIMULADO")) {
      // skip until first subject
      continue;
  }
  if (!currentDisciplina) continue;

  // Check for new question
  const qMatch = line.match(/^(\d{1,2})\s*\.\s*(.*)/);
  if (qMatch && parseInt(qMatch[1], 10) === nextQ) {
    nextQ++;
    currentQuestion = {
      id: "q_" + qMatch[1],
      texto: qMatch[2],
      alternativas: {},
      respostaCorreta: "A"
    };
    currentDisciplina.questoes.push(currentQuestion);
    currentAlt = null;
    continue;
  }

  // Check for alternative
  const altMatch = line.match(/^([a-eA-E])\)\s*(.*)/);
  if (altMatch && currentQuestion) {
    currentAlt = altMatch[1].toUpperCase();
    currentQuestion.alternativas[currentAlt] = altMatch[2];
    continue;
  }

  // Clean hyphens at end of line (e.g. "recarregá - los")
  line = line.replace(/\s*-\s*$/, '');

  // Append text to current context
  if (currentAlt && currentQuestion) {
    currentQuestion.alternativas[currentAlt] += " " + line;
  } else if (currentQuestion && !currentAlt) {
    currentQuestion.texto += " " + line;
  }
}

// Clean up extra spaces in the texts
json.data_json.disciplinas.forEach(d => {
    d.questoes.forEach(q => {
        q.texto = q.texto.replace(/\s+/g, ' ').trim();
        for (let k in q.alternativas) {
            q.alternativas[k] = q.alternativas[k].replace(/\s+/g, ' ').trim();
        }
    });
});

fs.writeFileSync('simulado_bb_2.json', JSON.stringify(json, null, 2));
console.log("JSON generated at simulado_bb_2.json");
