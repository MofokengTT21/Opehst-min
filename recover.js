const fs = require('fs');

const transcriptPath = 'C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\bfb9a19f-4bad-45bb-9526-fdc27e834c82\\.system_generated\\logs\\transcript.jsonl';
const fileContent = fs.readFileSync(transcriptPath, 'utf-8');

const lines = fileContent.split('\n');
for (const line of lines) {
    if (!line.trim()) continue;
    try {
        const data = JSON.parse(line);
        if (data.source === 'SYSTEM' && data.type === 'TOOL_RESPONSE') {
            const content = data.content || '';
            if (content.includes('[id].tsx')) {
                fs.appendFileSync('recovered_all_views.txt', content + '\n=====\n', 'utf-8');
            }
        }
    } catch (e) {
    }
}
console.log('Done!');
