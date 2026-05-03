const { PdfReader } = require('pdfreader');
const fs = require('fs');

function extractPdf(filename, outname) {
    return new Promise((resolve, reject) => {
        let lines = [];
        let currentY = null;
        let line = "";
        
        new PdfReader().parseFileItems(filename, (err, item) => {
            if (err) return reject(err);
            if (!item) {
                if (line) lines.push(line);
                fs.writeFileSync(outname, lines.join("\n"));
                resolve();
            } else if (item.text) {
                if (currentY === null || Math.abs(currentY - item.y) > 0.5) {
                    if (line) lines.push(line);
                    line = item.text;
                    currentY = item.y;
                } else {
                    line += " " + item.text;
                }
            }
        });
    });
}

async function run() {
    try {
        console.log("Extracting simulado...");
        await extractPdf('SIMULADO BB (1).pdf', 'simulado_2_raw.txt');
        console.log("Extracting gabarito...");
        try {
            await extractPdf('GABARITO SIMULADO BB (1).pdf', 'gabarito_2_raw.txt');
        } catch(e) {
            console.log("No gabarito pdf found or error.");
        }
        console.log("Done");
    } catch(e) {
        console.error(e);
    }
}
run();
