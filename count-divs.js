const fs = require('fs');
const html = fs.readFileSync('c:/Users/USUÁRIO/OneDrive/Área de Trabalho/Campanha A/index.html', 'utf8');

const lines = html.split('\n');
let divCount = 0;
let sectionCount = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Naive counting (assumes no divs in comments or strings, which might be slightly off but good enough)
    const opens = (line.match(/<div/g) || []).length;
    const closes = (line.match(/<\/div>/g) || []).length;
    divCount += opens - closes;
    
    const secOpens = (line.match(/<section/g) || []).length;
    const secCloses = (line.match(/<\/section>/g) || []).length;
    sectionCount += secOpens - secCloses;

    if (line.includes('id="view-')) {
        console.log(`Line ${i+1}: ${line.trim()} | Open Divs: ${divCount} | Open Sections: ${sectionCount}`);
    }
    if (line.includes('</section>')) {
        console.log(`Line ${i+1}: ${line.trim()} | Open Divs: ${divCount} | Open Sections: ${sectionCount}`);
    }
}
console.log('Final Divs:', divCount);
