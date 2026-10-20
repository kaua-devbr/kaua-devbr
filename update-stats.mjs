import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function renderStats(user, repos, date = new Date()) {
  const publicRepos = repos.filter(r => !r.private);
  const original = publicRepos.filter(r => !r.fork);
  const counts = new Map();
  for (const repo of original) if (repo.language) counts.set(repo.language, (counts.get(repo.language) || 0) + 1);
  const languages = [...counts].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
  const all = languages.reduce((n, [, count]) => n + count, 0);
  const colors = ['#c4b5fd','#a78bfa','#8b5cf6','#d8b4fe','#7c3aed','#e9d5ff'];
  const metrics = [[publicRepos.length,'REPOSITÓRIOS PÚBLICOS'],[publicRepos.reduce((n,r)=>n+(r.stargazers_count||0),0),'ESTRELAS RECEBIDAS'],[user.followers,'SEGUIDORES']];
  const stamp = date.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="420" viewBox="0 0 1000 420" role="img" aria-labelledby="title desc">
<title id="title">Estatísticas públicas de ${escape(user.login)}</title><desc id="desc">${metrics.map(([v,l])=>`${v} ${l.toLowerCase()}`).join(', ')}. Linguagens contadas por linguagem principal de repositórios públicos sem forks. Atualização ${stamp}.</desc>
<rect x="1" y="1" width="998" height="418" rx="22" fill="#110b1e" stroke="#382348"/>
<text x="38" y="48" fill="#ede4fa" font-family="Segoe UI,Arial,sans-serif" font-size="22" font-weight="600">Meu GitHub em números<tspan fill="#a78bfa">.</tspan></text>
<text x="38" y="73" fill="#a797bd" font-family="Segoe UI,Arial,sans-serif" font-size="12">Dados públicos · ${escape(user.login)}</text>
${metrics.map(([value,label],i)=>`<rect x="${38+i*313}" y="98" width="298" height="105" rx="12" fill="#1c112d" stroke="#3c2753"/><text x="${58+i*313}" y="148" fill="#d8b4fe" font-family="Segoe UI,Arial,sans-serif" font-size="36" font-weight="700">${escape(value)}</text><text x="${58+i*313}" y="178" fill="#bba9d1" font-family="Segoe UI,Arial,sans-serif" font-size="10" letter-spacing="1.1">${label}</text>`).join('')}
<text x="38" y="246" fill="#ede4fa" font-family="Segoe UI,Arial,sans-serif" font-size="17" font-weight="600">Linguagens nos repositórios</text>
<text x="38" y="269" fill="#a797bd" font-family="Segoe UI,Arial,sans-serif" font-size="11">Linguagem principal por projeto público · sem forks · ${all} repositórios com linguagem detectada</text>
${(() => {let x=38;return languages.map(([,count],i)=>{const w=924*count/(all||1);const rect=`<rect x="${x.toFixed(2)}" y="289" width="${w.toFixed(2)}" height="14" fill="${colors[i%colors.length]}"/>`;x+=w;return rect;}).join('');})()}
${languages.slice(0,6).map(([name,count],i)=>`<circle cx="${44+(i%3)*310}" cy="${330+Math.floor(i/3)*27}" r="4" fill="${colors[i%colors.length]}"/><text x="${57+(i%3)*310}" y="${334+Math.floor(i/3)*27}" fill="#d8c9ec" font-family="Segoe UI,Arial,sans-serif" font-size="12">${escape(name)} · ${count} ${count===1?'repo':'repos'}</text>`).join('')}
<path d="M38 378H962" stroke="#382348"/><text x="38" y="400" fill="#9d8aae" font-family="Segoe UI,Arial,sans-serif" font-size="10">Atualizado em ${stamp} · Fonte: API do GitHub</text>
</svg>`;
}

async function github(path) {
  const headers = {Accept:'application/vnd.github+json','User-Agent':'profile-stats','X-GitHub-Api-Version':'2022-11-28'};
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  const response = await fetch(`https://api.github.com${path}`,{headers,signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`GitHub request failed: ${response.status}`);
  return response.json();
}

async function main() {
  const fixtureIndex = process.argv.indexOf('--fixture');
  const outputIndex = process.argv.indexOf('--output');
  let user, repos;
  if (fixtureIndex >= 0) ({user,repos} = JSON.parse(await readFile(process.argv[fixtureIndex+1],'utf8')));
  else {
    const username = process.env.PROFILE_USER || 'kaua-devbr';
    if (!/^[a-zA-Z0-9-]+$/.test(username)) throw new Error('Invalid username');
    user = await github(`/users/${username}`);
    repos = [];
    for(let page=1;;page++) {
      const batch = await github(`/users/${username}/repos?type=owner&per_page=100&page=${page}`);
      repos.push(...batch);
      if(batch.length<100) break;
    }
  }
  await writeFile(outputIndex>=0?process.argv[outputIndex+1]:'stats.svg',renderStats(user,repos),'utf8');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
