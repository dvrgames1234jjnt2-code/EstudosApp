const fs = require('fs');

const gabaritoRaw = `
01 D 15 B 29 C 43 C 57 D
02 D 16 B 30 E 44 B 58 B
03 B 17 D 31 D 45 B 59 B
04 E 18 E 32 B 46 C 60 A
05 A 19 B 33 D 47 D 61 A
06 B 20 C 34 A 48 A 62 A
07 D 21 C 35 D 49 B 63 A
08 C 22 C 36 B 50 D 64 A
09 D 23 C 37 B 51 A 65 C
10 E 24 B 38 C 52 E 66 D
11 B 25 C 39 C 53 A 67 C
12 D 26 D 40 C 54 B 68 B
13 B 27 E 41 C 55 E 69 E
14 C 28 B 42 B 56 C 70 B
`;

// Extract all "Number Letter" pairs using regex
const regex = /(\d{2})\s+([A-E])/g;
const respostasMap = {};

let match;
while ((match = regex.exec(gabaritoRaw)) !== null) {
  const qNum = parseInt(match[1], 10);
  const letter = match[2];
  respostasMap[`q_${qNum}`] = letter;
}

// Read the JSON file
const file = 'simulado_bb_2.json';
let data = JSON.parse(fs.readFileSync(file, 'utf8'));

// Update answers
data.data_json.disciplinas.forEach(disciplina => {
  disciplina.questoes.forEach(questao => {
    if (respostasMap[questao.id]) {
      questao.respostaCorreta = respostasMap[questao.id];
    }
  });
});

// Write back to file
fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('Gabarito atualizado com sucesso no simulado_bb_2.json!');
