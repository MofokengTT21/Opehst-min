const fs = require('fs');

const fileContent = fs.readFileSync('recovered_all_views.txt', 'utf-8');
const blocks = fileContent.split('=====\n');

let count = 0;
for (const block of blocks) {
    if (block.includes('Total Lines') && block.includes('The following code has been modified')) {
        count++;
        fs.writeFileSync(`recovered_id_tsx_${count}.txt`, block, 'utf-8');
    }
}
console.log('Saved ' + count + ' files.');
