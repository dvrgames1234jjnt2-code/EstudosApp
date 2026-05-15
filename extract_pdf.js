const { PdfReader } = require('pdfreader');
const fs = require('fs');

function extractPdf(filename, outname) {
    return new Promise((resolve, reject) => {
        let lines = [];
        let currentY = null;
        let line = "";
        
        new PdfReader().parseFileItems(filename, (err, item) => {
            if (err) {
                console.error(`Error parsing ${filename}:`, err);
                return reject(err);
            }
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
        console.log("Extracting renan 50 questões.pdf...");
        await extractPdf('renan 50 questões.pdf', 'renan_raw.txt');
        console.log("Done");
    } catch(e) {
        console.error(e);
    }
}
run();
